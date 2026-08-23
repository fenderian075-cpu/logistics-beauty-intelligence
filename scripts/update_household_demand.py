#!/usr/bin/env python3
"""Collect national resident-register household counts from e-Stat annual files.

The source is the annual YY-01 total table of the Basic Resident Register
population / vital events / households statistics. No interpolation is used.
"""
from __future__ import annotations

import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "economy" / "household-demand.json"
PARCEL = ROOT / "data" / "economy" / "parcel-demand.json"
YEARS = list(range(2015, 2027))
LIST_URL = "https://www.e-stat.go.jp/stat-search/files"
DOWNLOAD_URL = "https://www.e-stat.go.jp/stat-search/file-download"
UA = "LBI-official-statistics-collector/1.0"


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def discover_stat_infid(year: int) -> str:
    params = {
        "cycle": "7",
        "layout": "datalist",
        "month": "0",
        "page": "1",
        "result_back": "1",
        "tclass1": "000001039601",
        "tclass2val": "0",
        "toukei": "00200241",
        "tstat": "000001039591",
        "year": f"{year}0",
    }
    html = fetch_bytes(LIST_URL + "?" + urllib.parse.urlencode(params)).decode("utf-8", errors="replace")
    table_no = f"{str(year)[-2:]}-01"

    # e-Stat listing markup has changed over time. Match the stat_infid closest
    # to the requested table number in either direction rather than pinning DOM.
    candidates = []
    for m in re.finditer(r"stat_infid=(\d+)", html, flags=re.I):
        start = max(0, m.start() - 3500)
        end = min(len(html), m.end() + 3500)
        window = html[start:end]
        if table_no in window and "人口、人口動態及び世帯数" in window:
            candidates.append(m.group(1))
    if candidates:
        # Preserve document order and use first unique candidate.
        return list(dict.fromkeys(candidates))[0]

    raise RuntimeError(f"could not discover stat_infid for {year} {table_no}")


def as_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().replace(",", "").replace("，", "")
        if re.fullmatch(r"-?\d+(?:\.\d+)?", text):
            return float(text)
    return None


def norm(value) -> str:
    return re.sub(r"\s+", "", str(value or "")).replace("　", "")


def extract_households(xlsx: bytes, year: int) -> float:
    wb = load_workbook(io.BytesIO(xlsx), data_only=True, read_only=True)
    diagnostics = []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(min_row=1, max_row=min(ws.max_row, 80), values_only=True))
        if not rows:
            continue
        total_rows = []
        for r_idx, row in enumerate(rows, start=1):
            if any(norm(v) == "合計" for v in row[:12]):
                total_rows.append(r_idx)
        header_cols = set()
        for r_idx, row in enumerate(rows[:30], start=1):
            for c_idx, value in enumerate(row, start=1):
                text = norm(value)
                if text == "世帯数" or text.endswith("世帯数"):
                    header_cols.add(c_idx)

        for r_idx in total_rows:
            row = rows[r_idx - 1]
            for c_idx in sorted(header_cols):
                for candidate_col in range(max(1, c_idx - 1), min(len(row), c_idx + 2) + 1):
                    value = as_number(row[candidate_col - 1])
                    if value is not None and 30_000_000 <= value <= 100_000_000:
                        return value
            diagnostics.append((ws.title, r_idx, list(row[:12]), sorted(header_cols)))

    raise RuntimeError(f"household total not found for {year}; diagnostics={diagnostics[:3]}")


def series(data, metric_id):
    for item in data.get("series", []):
        if item.get("metric_id") == metric_id:
            return item
    raise KeyError(metric_id)


def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    parcel = json.loads(PARCEL.read_text(encoding="utf-8"))
    household_rows = []
    discovered = {}

    for year in YEARS:
        stat_infid = discover_stat_infid(year)
        discovered[str(year)] = stat_infid
        url = DOWNLOAD_URL + "?" + urllib.parse.urlencode({"fileKind": 0, "statInfId": stat_infid})
        count = extract_households(fetch_bytes(url), year)
        household_rows.append({
            "period": str(year),
            "value": round(count / 1_000_000, 6),
            "status": "official_file",
            "source": f"e-Stat BRR {str(year)[-2:]}-01 stat_infid={stat_infid}",
        })

    parcel_values = {
        str(o["period"]): float(o["value"])
        for o in series(parcel, "parcel_delivery_volume").get("observations", [])
    }
    households = {r["period"]: float(r["value"]) for r in household_rows}
    per_household = []
    for year in sorted(set(parcel_values) & set(households)):
        if "2015" <= year <= "2024" and households[year] > 0:
            per_household.append({
                "period": year,
                "value": round(parcel_values[year] / households[year], 1),
                "status": "derived_proxy",
                "source": "MLIT parcel volume / MIC resident-register households",
            })

    series(data, "resident_register_households")["observations"] = household_rows
    series(data, "parcel_per_household")["observations"] = per_household
    data["status"] = "populated_from_estat_files"
    data["file_contract"] = {"table": "YY-01", "stat_infids": discovered}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": data["status"],
        "household_years": [household_rows[0]["period"], household_rows[-1]["period"]],
        "latest_households_million": household_rows[-1]["value"],
        "parcel_per_household_latest": per_household[-1] if per_household else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
