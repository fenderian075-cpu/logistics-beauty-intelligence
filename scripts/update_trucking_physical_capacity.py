#!/usr/bin/env python3
"""Collect national truck operator and vehicle stock history from MLIT workbooks.

Source: MLIT "数字でみる自動車2025" truck-business trend workbooks.
The parser accepts both legacy XLS and XLSX and only emits observations that are
explicitly present in the official workbooks. No interpolation is performed.
"""
from __future__ import annotations

import io
import json
import re
from pathlib import Path

import requests
import xlrd
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/economy/trucking-physical-capacity.json"
TRUCKING = ROOT / "data/economy/trucking.json"
SOURCES = {
    "operators": "https://www.mlit.go.jp/jidosha/content/001894861.xls",
    "vehicles": "https://www.mlit.go.jp/jidosha/content/001894863.xlsx",
}
HEADERS = {"User-Agent": "Mozilla/5.0 LBI-Trucking-Capacity/1.0", "Referer": "https://www.mlit.go.jp/"}


def norm(v) -> str:
    return re.sub(r"\s+", "", str(v or "")).replace("　", "")


def number(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = norm(v).replace(",", "").replace("，", "")
    m = re.fullmatch(r"-?\d+(?:\.\d+)?", s)
    return float(s) if m else None


def year(v):
    s = norm(v).replace("年度", "").replace("年", "")
    if re.fullmatch(r"20\d{2}", s):
        return int(s)
    m = re.fullmatch(r"(?:H|平成)(\d{1,2})", s, re.I)
    if m:
        return 1988 + int(m.group(1))
    m = re.fullmatch(r"(?:R|令和)(\d{1,2})", s, re.I)
    if m:
        return 2018 + int(m.group(1))
    return None


def workbook_rows(payload: bytes):
    if payload.startswith(b"PK\x03\x04"):
        wb = load_workbook(io.BytesIO(payload), data_only=True, read_only=True)
        for ws in wb.worksheets:
            yield ws.title, [list(r) for r in ws.iter_rows(values_only=True)]
        return
    if payload.startswith(b"\xd0\xcf\x11\xe0"):
        wb = xlrd.open_workbook(file_contents=payload, on_demand=True)
        for name in wb.sheet_names():
            ws = wb.sheet_by_name(name)
            yield name, [ws.row_values(i) for i in range(ws.nrows)]
        return
    raise RuntimeError(f"unsupported workbook magic: {payload[:16]!r}")


def horizontal_candidates(rows):
    """Yield (year_row_idx, year->column) for rows containing >=5 fiscal years."""
    for r_idx, row in enumerate(rows):
        mapping = {}
        for c_idx, cell in enumerate(row):
            y = year(cell)
            if y and 1989 <= y <= 2035:
                mapping[y] = c_idx
        if len(mapping) >= 5:
            yield r_idx, mapping


def parse_metric(payload: bytes, kind: str):
    diagnostics = []
    best = None
    for sheet, rows in workbook_rows(payload):
        for yr_idx, cols in horizontal_candidates(rows):
            for r_idx in range(max(0, yr_idx - 8), min(len(rows), yr_idx + 14)):
                row = rows[r_idx]
                label = "|".join(norm(x) for x in row[:8] if norm(x))
                if kind == "operators":
                    score = 0
                    if "総事業者数" in label: score += 100
                    if "事業者数" in label: score += 40
                    if "総数" in label: score += 20
                else:
                    score = 0
                    if "営業用" in label and "車両" in label: score += 100
                    if "車両数" in label: score += 50
                    if "合計" in label: score += 20
                if score == 0:
                    continue
                values = {}
                for y, c in cols.items():
                    if c < len(row):
                        v = number(row[c])
                        if v is not None and v > 0:
                            values[y] = v
                if len(values) >= 5:
                    candidate = (score + len(values), sheet, label, values)
                    if best is None or candidate[0] > best[0]:
                        best = candidate
            diagnostics.append((sheet, yr_idx + 1, sorted(cols)[:3], sorted(cols)[-3:]))

    if best is None:
        raise RuntimeError(f"{kind}: metric row not found; year-row diagnostics={diagnostics[:12]}")
    _, sheet, label, values = best
    # Keep the modern comparable window and preserve any newer official years.
    values = {y: values[y] for y in sorted(values) if 2010 <= y <= 2035}
    if len(values) < 10:
        raise RuntimeError(f"{kind}: history too short from {sheet}/{label}: {values}")
    return values, {"sheet": sheet, "matched_label": label}


def obs(values, source):
    rows = []
    prev = None
    for y, value in values.items():
        row = {"period": str(y), "value": round(value, 3), "status": "official_file", "source": source}
        if prev and prev[1]:
            row["yoy"] = round((value / prev[1] - 1) * 100, 2)
        rows.append(row)
        prev = (y, value)
    return rows


def series(data, mid):
    for s in data.get("series", []):
        if s.get("metric_id") == mid:
            return s
    raise KeyError(mid)


def main():
    session = requests.Session(); session.headers.update(HEADERS)
    payloads = {}
    for key, url in SOURCES.items():
        r = session.get(url, timeout=90); r.raise_for_status(); payloads[key] = r.content

    operators, op_meta = parse_metric(payloads["operators"], "operators")
    vehicles, vh_meta = parse_metric(payloads["vehicles"], "vehicles")

    common = sorted(set(operators) & set(vehicles))
    vehicles_per_operator = {y: vehicles[y] / operators[y] for y in common if operators[y] > 0}

    trucking = json.loads(TRUCKING.read_text(encoding="utf-8"))
    tkm = {
        int(o["period"]): float(o["value"])
        for o in series(trucking, "commercial_truck_ton_km_annual").get("observations", [])
    }
    # tkm is billion tonne-km; vehicles are units. billion / vehicle -> thousand tonne-km/vehicle after *1e6.
    tkm_per_vehicle = {y: tkm[y] * 1_000_000 / vehicles[y] for y in sorted(set(tkm) & set(vehicles)) if vehicles[y] > 0}

    data = json.loads(OUT.read_text(encoding="utf-8"))
    series(data, "truck_operators")["observations"] = obs(operators, "MLIT 数字でみる自動車 トラック事業者数の推移")
    series(data, "commercial_truck_vehicles")["observations"] = obs(vehicles, "MLIT 数字でみる自動車 トラック車両数の推移")
    series(data, "vehicles_per_operator")["observations"] = [
        {"period": str(y), "value": round(v, 2), "status": "derived", "source": "commercial_truck_vehicles / truck_operators"}
        for y, v in vehicles_per_operator.items()
    ]
    series(data, "ton_km_per_vehicle")["observations"] = [
        {"period": str(y), "value": round(v, 1), "status": "derived_proxy", "source": "commercial_truck_ton_km_annual / commercial_truck_vehicles"}
        for y, v in tkm_per_vehicle.items()
    ]
    data["status"] = "populated_from_mlit_files"
    data["parser_contract"] = {"operators": op_meta, "vehicles": vh_meta, "urls": SOURCES}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": data["status"],
        "operators": [min(operators), max(operators), operators[max(operators)]],
        "vehicles": [min(vehicles), max(vehicles), vehicles[max(vehicles)]],
        "vehicles_per_operator_latest": next(reversed(vehicles_per_operator.values())),
        "ton_km_per_vehicle_latest": next(reversed(tkm_per_vehicle.values())),
        "parser": data["parser_contract"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
