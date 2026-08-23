#!/usr/bin/env python3
"""Refresh the Specified Skilled Worker logistics capacity pipeline from ISA's latest half-year publication."""
from __future__ import annotations

import io
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "economy" / "logistics-foreign-capacity-pipeline.json"
LANDING = "https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00215.html"
UA = "Mozilla/5.0 (compatible; LogisticsBeautyIntelligence/1.0; +https://github.com/fenderian075-cpu/logistics-beauty-intelligence)"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", s or "")).strip()


def era_to_year(era_year: int) -> int:
    return 2018 + era_year


def discover_latest_table3() -> str:
    r = requests.get(LANDING, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    pdfs = []
    for a in soup.find_all("a"):
        href = a.get("href") or ""
        if ".pdf" not in href.lower():
            continue
        own = norm(a.get_text(" ", strip=True))
        parent = norm(a.parent.get_text(" ", strip=True)) if a.parent else own
        grand = norm(a.parent.parent.get_text(" ", strip=True)) if a.parent and a.parent.parent else parent
        context = " | ".join((own, parent, grand))
        pdfs.append((urljoin(LANDING, href), context))
        # On ISA pages the anchor itself may only say 'PDF'; the table name sits in the surrounding li/p.
        if "第3表" in context:
            return urljoin(LANDING, href)
    diagnostic = [f"{u} :: {c[:180]}" for u, c in pdfs[:20]]
    raise RuntimeError("Could not discover latest SSW Table 3 PDF; PDF candidates=" + json.dumps(diagnostic, ensure_ascii=False))


def extract_pdf_text(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": UA, "Referer": LANDING}, timeout=45)
    r.raise_for_status()
    reader = PdfReader(io.BytesIO(r.content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise RuntimeError("Latest SSW Table 3 PDF contained no extractable text")
    return norm(text)


def parse_period(text: str) -> str:
    t = norm(text)
    m = re.search(r"令和\s*(\d+)年\s*(6|12)月末", t) or re.search(r"令和\s*(\d+)年\s*(6|12)月(?:末)?(?:現在)?", t)
    if not m:
        raise RuntimeError("Could not resolve SSW half-year period from latest Table 3 PDF; prefix=" + t[:500])
    return f"{era_to_year(int(m.group(1))):04d}-{int(m.group(2)):02d}"


def parse_auto_transport(text: str) -> tuple[int, int, int, int]:
    t = norm(text)
    patterns = [
        r"自動車運送業分野\s*([\d,]+).*?トラック運転者\s*([\d,]+).*?タクシー運転者\s*([\d,]+).*?バス運転者\s*([\d,]+)",
        r"自動車運送業分野.*?トラック運転者\s*([\d,]+).*?タクシー運転者\s*([\d,]+).*?バス運転者\s*([\d,]+).*?(?:計|総数)\s*([\d,]+)",
        r"自動車運送業分野.*?([\d,]+)\s*トラック運転者.*?([\d,]+)\s*タクシー運転者.*?([\d,]+)\s*バス運転者.*?([\d,]+)",
    ]
    for i, p in enumerate(patterns):
        m = re.search(p, t)
        if not m:
            continue
        nums = [int(x.replace(",", "")) for x in m.groups()]
        if i == 1:
            truck, taxi, bus, total = nums
        else:
            total, truck, taxi, bus = nums
        if total == truck + taxi + bus and total >= 0:
            return total, truck, taxi, bus
    pos = t.find("自動車運送業分野")
    window = t[pos : pos + 1800] if pos >= 0 else ""
    raise RuntimeError("Could not confidently parse auto-transport split; context=" + window[:1600])


def get_series(data: dict, metric_id: str) -> dict:
    return next(x for x in data["series"] if x["metric_id"] == metric_id)


def upsert(series: dict, period: str, value: int, source: str) -> None:
    obs = series.setdefault("observations", [])
    row = {"period": period, "value": value, "status": "official_preliminary", "source": source}
    for i, old in enumerate(obs):
        if str(old.get("period")) == period:
            obs[i] = row
            break
    else:
        obs.append(row)
    obs.sort(key=lambda x: str(x["period"]))


def main() -> None:
    pdf_url = discover_latest_table3()
    text = extract_pdf_text(pdf_url)
    period = parse_period(text)
    total, truck, taxi, bus = parse_auto_transport(text)
    data = json.loads(DATA.read_text(encoding="utf-8"))
    source = f"Immigration Services Agency SSW Table 3 ({period}); {pdf_url}"
    upsert(get_series(data, "ssw_auto_transport_residents"), period, total, source)
    upsert(get_series(data, "ssw_auto_transport_truck_drivers"), period, truck, source)
    upsert(get_series(data, "ssw_auto_transport_taxi_drivers"), period, taxi, source)
    upsert(get_series(data, "ssw_auto_transport_bus_drivers"), period, bus, source)
    data["status"] = "official_half_year_auto_refresh_plus_policy_capacity"
    data["latest_snapshot"] = period
    data["latest_source_url"] = pdf_url
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status":"success","period":period,"source":pdf_url,"auto_transport":total,"truck":truck,"taxi":taxi,"bus":bus}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
