#!/usr/bin/env python3
"""Backfill official transport-service price histories from BOJ SPPI.

Uses the Bank of Japan's 2020-base connected-index CSV (1985-01..2019-12)
and current monthly bulk ZIP (2020-01 onward). Values are never interpolated.
Existing LBI metric IDs are preserved.
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/economy/freight-cost.json"
STATUS = ROOT / "data/economy/transport-history-status.json"

UA = {"User-Agent": "Mozilla/5.0 LBI-Transport-History/1.0"}
CURRENT_URL = "https://www.stat-search.boj.or.jp/ssi/docs/info/sppi_m_jp.zip"
LINKED_URL = "https://www.stat-search.boj.or.jp/ssi/docs/info/sppilink.csv"
SOURCE_NAME = "日本銀行 企業向けサービス価格指数（2020年基準）"
JST = timezone(timedelta(hours=9))

TARGETS = {
    "road_freight": ("PRCS20_5200630002", "道路貨物輸送"),
    "ocean_freight": ("PRCS20_5200730001", "外航貨物輸送"),
    "coastal_freight": ("PRCS20_5200730002", "内航貨物輸送"),
    "port_transport": ("PRCS20_5200730003", "港湾運送"),
    "international_air_freight": ("PRCS20_5200830001", "国際航空貨物輸送"),
    "warehouse_service": ("PRCS20_5200930001", "倉庫"),
    "third_party_logistics": ("PRCS20_5201030001", "3PL"),
}
CODE_TO_METRIC = {code: mid for mid, (code, _name) in TARGETS.items()}


def now_iso() -> str:
    return datetime.now(JST).replace(microsecond=0).isoformat()


def decode_csv(blob: bytes) -> str:
    for enc in ("cp932", "utf-8-sig", "utf-8"):
        try:
            return blob.decode(enc)
        except UnicodeDecodeError:
            pass
    return blob.decode("cp932", errors="replace")


def period(s: str) -> str | None:
    s = str(s or "").strip()
    if len(s) == 6 and s.isdigit():
        y, m = int(s[:4]), int(s[4:])
        if 1980 <= y <= 2100 and 1 <= m <= 12:
            return f"{y:04d}-{m:02d}"
    return None


def num(v) -> float | None:
    s = str(v or "").strip().replace(",", "")
    if not s or s in {"-", "...", "***", "X"}:
        return None
    try:
        x = float(s)
    except ValueError:
        return None
    return x if 0 < x < 2000 else None


def parse_matrix(blob: bytes, status: str) -> dict[str, list[dict]]:
    rows = list(csv.reader(io.StringIO(decode_csv(blob))))
    if not rows or len(rows[0]) < 12:
        raise RuntimeError("BOJ SPPI CSV header is unexpectedly short")
    date_cols: dict[int, str] = {}
    for i, cell in enumerate(rows[0]):
        p = period(cell)
        if p:
            date_cols[i] = p
    if len(date_cols) < 12:
        raise RuntimeError(f"BOJ SPPI date header has only {len(date_cols)} months")

    result: dict[str, list[dict]] = {}
    for row in rows[1:]:
        if not row:
            continue
        code = str(row[0] or "").strip()
        mid = CODE_TO_METRIC.get(code)
        if not mid:
            continue
        obs = []
        for c, p in date_cols.items():
            if c >= len(row):
                continue
            x = num(row[c])
            if x is None:
                continue
            obs.append({
                "period": p,
                "value": round(x, 3),
                "status": status,
                "source": SOURCE_NAME,
            })
        result[mid] = obs
    return result


def yoy_mom(obs: list[dict]) -> None:
    by = {r["period"]: r["value"] for r in obs}
    for i, r in enumerate(obs):
        if i > 0:
            prev = obs[i - 1]["value"]
            if prev:
                r["mom"] = round((r["value"] / prev - 1) * 100, 2)
        y, m = map(int, r["period"].split("-"))
        py = f"{y-1:04d}-{m:02d}"
        prev_y = by.get(py)
        if prev_y:
            r["yoy"] = round((r["value"] / prev_y - 1) * 100, 2)


def merge_history(linked: dict[str, list[dict]], current: dict[str, list[dict]]) -> dict[str, list[dict]]:
    out = {}
    for mid in TARGETS:
        by = {r["period"]: r for r in linked.get(mid, [])}
        # Current publication is authoritative for 2020 onward.
        by.update({r["period"]: r for r in current.get(mid, [])})
        rows = [by[p] for p in sorted(by)]
        yoy_mom(rows)
        out[mid] = rows
    return out


def load_current_blob(session: requests.Session) -> bytes:
    r = session.get(CURRENT_URL, timeout=90)
    r.raise_for_status()
    if not r.content.startswith(b"PK"):
        raise RuntimeError("BOJ current SPPI bulk download is not a ZIP")
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
    if not names:
        raise RuntimeError("BOJ current SPPI ZIP contains no CSV")
    return zf.read(names[0])


def upsert(data: dict, mid: str, name_ja: str, observations: list[dict]) -> None:
    series = data.setdefault("series", [])
    target = next((s for s in series if s.get("metric_id") == mid), None)
    if target is None:
        target = {"metric_id": mid, "name_ja": name_ja, "unit": "index"}
        series.append(target)
    target["name_ja"] = name_ja
    target["unit"] = "index"
    target["observations"] = observations


def main() -> None:
    session = requests.Session()
    session.headers.update(UA)

    lr = session.get(LINKED_URL, timeout=90)
    lr.raise_for_status()
    linked = parse_matrix(lr.content, "official_connected_index")
    current = parse_matrix(load_current_blob(session), "official")
    merged = merge_history(linked, current)

    coverage = {}
    for mid, rows in merged.items():
        if len(rows) < 60:
            raise RuntimeError(f"{mid}: only {len(rows)} official observations")
        if rows[-1]["period"] < "2025-01":
            raise RuntimeError(f"{mid}: current history ends too early at {rows[-1]['period']}")
        periods = [r["period"] for r in rows]
        if len(periods) != len(set(periods)):
            raise RuntimeError(f"{mid}: duplicate periods detected")
        coverage[mid] = {
            "observations": len(rows),
            "start": rows[0]["period"],
            "end": rows[-1]["period"],
            "connected_observations": sum(r["status"] == "official_connected_index" for r in rows),
            "current_observations": sum(r["status"] == "official" for r in rows),
        }

    data = json.loads(OUT.read_text(encoding="utf-8"))
    data["source"] = {"name": SOURCE_NAME, "url": "https://www.boj.or.jp/statistics/pi/sppi_2020/"}
    data["base"] = "2020=100"
    data["historical_backfill_at"] = now_iso()
    for mid, (_code, name) in TARGETS.items():
        upsert(data, mid, name, merged[mid])
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    status = {
        "schema_version": "1.0",
        "dataset": "transport-history-status",
        "updated_at": now_iso(),
        "status": "success",
        "source": SOURCE_NAME,
        "current_url": CURRENT_URL,
        "connected_url": LINKED_URL,
        "coverage": coverage,
    }
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
