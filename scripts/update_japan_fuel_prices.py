#!/usr/bin/env python3
"""Collect Japan national weekly gasoline/diesel/kerosene retail prices.

Source: Agency for Natural Resources and Energy, Petroleum Product Price Survey.
The official result page exposes a weekly Excel workbook with history from 1990.
The parser searches headers semantically rather than depending on fixed cells.
"""
from __future__ import annotations

import io, json, re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
RESULTS = "https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html"
UA = {"User-Agent": "Mozilla/5.0 LBI-public-fuel-collector/1.0"}


def norm(v):
    return re.sub(r"\s+", "", str(v or "")).replace("　", "")


def find_weekly_url(html):
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        label = norm(a.get_text(" "))
        href = a["href"]
        if "週次" in label and re.search(r"\.xlsx?(?:\?|$)", href, re.I):
            return urljoin(RESULTS, href)
    # fallback: workbook links close to gasoline/diesel/kerosene section
    candidates = [urljoin(RESULTS, a["href"]) for a in soup.find_all("a", href=True)
                  if re.search(r"\.xlsx?(?:\?|$)", a["href"], re.I)]
    if not candidates:
        raise RuntimeError("weekly Excel link not found")
    return candidates[0]


def parse_date(v):
    if isinstance(v, datetime): return v.date().isoformat()
    if isinstance(v, date): return v.isoformat()
    s = str(v or "").strip()
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d"):
        try: return datetime.strptime(s, fmt).date().isoformat()
        except ValueError: pass
    return None


def discover_columns(ws):
    max_header = min(ws.max_row, 20)
    columns = {}
    for col in range(1, ws.max_column + 1):
        header = "|".join(norm(ws.cell(r, col).value) for r in range(1, max_header + 1))
        if "全国" not in header: continue
        if "レギュラー" in header or "ガソリン" in header:
            columns.setdefault("regular_gasoline_national", col)
        if "軽油" in header:
            columns.setdefault("diesel_national", col)
        if "灯油" in header and ("18L" in header.upper() or "１８Ｌ" in header or "配達" in header or "店頭" in header):
            columns.setdefault("kerosene_national", col)
    return columns


def parse_workbook(content):
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    best = None
    for ws in wb.worksheets:
        cols = discover_columns(ws)
        if len(cols) < 2: continue
        rows = {k: [] for k in cols}
        for r in range(1, ws.max_row + 1):
            period = None
            for c in range(1, min(ws.max_column, 6) + 1):
                period = parse_date(ws.cell(r, c).value)
                if period: break
            if not period: continue
            for key, col in cols.items():
                v = ws.cell(r, col).value
                if isinstance(v, (int, float)) and v > 0:
                    rows[key].append({"period": period, "value": round(float(v), 1), "status": "official"})
        score = sum(len(v) for v in rows.values())
        if score and (best is None or score > best[0]): best = (score, rows)
    if not best: raise RuntimeError("could not identify national fuel-price columns")
    return best[1]


def main():
    page = requests.get(RESULTS, headers=UA, timeout=30); page.raise_for_status()
    weekly = find_weekly_url(page.text)
    book = requests.get(weekly, headers=UA, timeout=60); book.raise_for_status()
    if not book.content.startswith(b"PK"):
        raise RuntimeError("official weekly workbook is not XLSX/ZIP content")
    parsed = parse_workbook(book.content)
    path = ROOT / "data/economy/fuel-prices.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    by_id = {s["metric_id"]: s for s in data.get("series", [])}
    for mid, rows in parsed.items():
        if mid in by_id:
            by_id[mid]["observations"] = rows
    data["collection_status"] = "official_weekly_history_ingested"
    data["source"]["weekly_workbook_url"] = weekly
    data["last_collected_at"] = datetime.now().astimezone().isoformat()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({mid: len(rows) for mid, rows in parsed.items()})

if __name__ == "__main__": main()
