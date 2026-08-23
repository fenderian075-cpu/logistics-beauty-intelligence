#!/usr/bin/env python3
"""Collect Japan national weekly gasoline/diesel/kerosene retail prices.

Primary source: Agency for Natural Resources and Energy, Petroleum Product Price Survey.
Supports both OOXML .xlsx and legacy BIFF .xls workbooks. Workbook layout is
identified semantically; fixed cell coordinates are intentionally avoided.
"""
from __future__ import annotations

import io, json, re, traceback
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook
import xlrd

ROOT = Path(__file__).resolve().parents[1]
RESULTS = "https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html"
UA = {"User-Agent": "Mozilla/5.0 LBI-public-fuel-collector/1.1"}
STATUS_PATH = ROOT / "data/economy/fuel-collector-status.json"


def norm(v):
    return re.sub(r"\s+", "", str(v or "")).replace("　", "")


def write_status(status, stage, **extra):
    payload = {
        "schema_version": "1.0",
        "dataset": "fuel-collector-status",
        "status": status,
        "stage": stage,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **extra,
    }
    STATUS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_weekly_url(html):
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        label = norm(a.get_text(" "))
        href = a["href"]
        if "週次" in label and re.search(r"\.xlsx?(?:\?|$)", href, re.I):
            return urljoin(RESULTS, href)
    candidates = [urljoin(RESULTS, a["href"]) for a in soup.find_all("a", href=True)
                  if re.search(r"\.xlsx?(?:\?|$)", a["href"], re.I)]
    if not candidates:
        raise RuntimeError("weekly Excel link not found")
    return candidates[0]


def parse_date(v, datemode=None):
    if isinstance(v, datetime): return v.date().isoformat()
    if isinstance(v, date): return v.isoformat()
    if datemode is not None and isinstance(v, (int, float)) and 25000 < float(v) < 60000:
        try: return xlrd.xldate_as_datetime(v, datemode).date().isoformat()
        except Exception: pass
    s = str(v or "").strip()
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d", "%Y年%m月%d日"):
        try: return datetime.strptime(s, fmt).date().isoformat()
        except ValueError: pass
    return None


def discover_columns_matrix(nrows, ncols, getter):
    max_header = min(nrows, 25)
    columns = {}
    for col in range(ncols):
        header = "|".join(norm(getter(r, col)) for r in range(max_header))
        if "全国" not in header: continue
        if "レギュラー" in header or "ガソリン" in header:
            columns.setdefault("regular_gasoline_national", col)
        if "軽油" in header:
            columns.setdefault("diesel_national", col)
        if "灯油" in header and ("18L" in header.upper() or "１８Ｌ" in header or "配達" in header or "店頭" in header):
            columns.setdefault("kerosene_national", col)
    return columns


def collect_matrix(nrows, ncols, getter, datemode=None):
    cols = discover_columns_matrix(nrows, ncols, getter)
    if len(cols) < 2: return None
    rows = {k: [] for k in cols}
    for r in range(nrows):
        period = None
        for c in range(min(ncols, 8)):
            period = parse_date(getter(r, c), datemode)
            if period: break
        if not period: continue
        for key, col in cols.items():
            v = getter(r, col)
            if isinstance(v, (int, float)) and float(v) > 0:
                rows[key].append({"period": period, "value": round(float(v), 1), "status": "official"})
    score = sum(len(v) for v in rows.values())
    return (score, rows, cols) if score else None


def parse_xlsx(content):
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    best = None
    for ws in wb.worksheets:
        result = collect_matrix(ws.max_row, ws.max_column, lambda r, c: ws.cell(r + 1, c + 1).value)
        if result and (best is None or result[0] > best[0]): best = (*result, ws.title)
    return best


def parse_xls(content):
    wb = xlrd.open_workbook(file_contents=content)
    best = None
    for ws in wb.sheets():
        result = collect_matrix(ws.nrows, ws.ncols, lambda r, c: ws.cell_value(r, c), wb.datemode)
        if result and (best is None or result[0] > best[0]): best = (*result, ws.name)
    return best


def main():
    weekly = None
    try:
        write_status("running", "fetch_index")
        page = requests.get(RESULTS, headers=UA, timeout=30); page.raise_for_status()
        weekly = find_weekly_url(page.text)
        write_status("running", "download_workbook", weekly_workbook_url=weekly)
        book = requests.get(weekly, headers=UA, timeout=60); book.raise_for_status()
        content = book.content
        if content.startswith(b"PK"):
            workbook_format = "xlsx"
            best = parse_xlsx(content)
        elif content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
            workbook_format = "xls"
            best = parse_xls(content)
        else:
            raise RuntimeError(f"unsupported workbook signature: {content[:16].hex()}")
        if not best:
            raise RuntimeError("could not identify national fuel-price columns")
        score, parsed, cols, sheet = best
        if not all(parsed.get(mid) for mid in ("regular_gasoline_national", "diesel_national")):
            raise RuntimeError(f"required gasoline/diesel series missing: {list(parsed)}")

        path = ROOT / "data/economy/fuel-prices.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        by_id = {s["metric_id"]: s for s in data.get("series", [])}
        for mid, rows in parsed.items():
            if mid in by_id and rows:
                by_id[mid]["observations"] = rows
        data["collection_status"] = "official_weekly_history_ingested"
        data["source"]["weekly_workbook_url"] = weekly
        data["last_collected_at"] = datetime.now(timezone.utc).isoformat()
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        counts = {mid: len(rows) for mid, rows in parsed.items()}
        write_status("success", "success", weekly_workbook_url=weekly, workbook_format=workbook_format,
                     selected_sheet=sheet, discovered_columns=cols, row_counts=counts, score=score)
        print(counts)
    except Exception as exc:
        write_status("failure", "collector", weekly_workbook_url=weekly, error=str(exc), diagnostic_tail=traceback.format_exc()[-6000:])
        raise

if __name__ == "__main__": main()
