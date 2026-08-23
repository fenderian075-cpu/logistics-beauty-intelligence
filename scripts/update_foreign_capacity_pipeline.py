#!/usr/bin/env python3
"""Refresh the Specified Skilled Worker logistics capacity pipeline from ISA's latest half-year publication.

Design goals:
- discover the latest SSW Table 3 from the stable ISA landing page (do not pin the PDF URL)
- parse the auto-transport field and truck/taxi/bus breakdown
- append only newer half-year observations
- never mix these visa-channel counts with MHLW foreign-employment totals
- fail closed if the current PDF layout cannot be parsed confidently
"""
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
    return 2018 + era_year  # Reiwa 1 = 2019


def discover_latest_table3() -> tuple[str, str]:
    r = requests.get(LANDING, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # ISA keeps the latest half-year section first. Resolve the period from the first Reiwa month-end heading.
    period = None
    section = None
    for tag in soup.find_all(["h2", "h3", "h4"]):
        t = norm(tag.get_text(" ", strip=True))
        m = re.search(r"令和\s*(\d+)年\s*(6|12)月末", t)
        if m:
            period = f"{era_to_year(int(m.group(1))):04d}-{int(m.group(2)):02d}"
            section = tag
            break
    if not period:
        raise RuntimeError("Could not resolve latest SSW half-year period from ISA landing page")

    # Prefer Table 3 inside the latest section; stop at the next period heading.
    candidates = []
    node = section
    while node is not None:
        node = node.find_next()
        if node is None:
            break
        if node.name in {"h2", "h3", "h4"}:
            txt = norm(node.get_text(" ", strip=True))
            if re.search(r"令和\s*\d+年\s*(6|12)月末", txt):
                break
        if node.name == "a":
            txt = norm(node.get_text(" ", strip=True))
            href = node.get("href") or ""
            if "第3表" in txt.replace("３", "3") and ".pdf" in href.lower():
                candidates.append(urljoin(LANDING, href))
    if not candidates:
        # Layout fallback: first Table 3 PDF link on the page, since latest period is presented first.
        for a in soup.find_all("a"):
            txt = norm(a.get_text(" ", strip=True)).replace("３", "3")
            href = a.get("href") or ""
            if "第3表" in txt and ".pdf" in href.lower():
                candidates.append(urljoin(LANDING, href))
                break
    if not candidates:
        raise RuntimeError("Could not discover latest SSW Table 3 PDF")
    return period, candidates[0]


def extract_pdf_text(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": UA, "Referer": LANDING}, timeout=45)
    r.raise_for_status()
    reader = PdfReader(io.BytesIO(r.content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise RuntimeError("Latest SSW Table 3 PDF contained no extractable text")
    return norm(text)


def parse_auto_transport(text: str) -> tuple[int, int, int, int]:
    t = norm(text)
    # Table 3 has a field total plus the three auto-transport work categories. PDF text order can vary,
    # so try label-value and value-label layouts before a guarded local-window fallback.
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
        elif i == 2:
            total, truck, taxi, bus = nums
        else:
            total, truck, taxi, bus = nums
        if total == truck + taxi + bus and total >= 0:
            return total, truck, taxi, bus

    # Guarded fallback: inspect only a short window around the field name. Accept values only if a
    # 4-number combination satisfies total = truck + taxi + bus and all three category labels exist.
    pos = t.find("自動車運送業分野")
    if pos >= 0:
        window = t[pos : pos + 900]
        if all(x in window for x in ("トラック運転者", "タクシー運転者", "バス運転者")):
            nums = [int(x.replace(",", "")) for x in re.findall(r"(?<!\d)([\d,]+)(?!\d)", window)]
            for a in range(min(len(nums), 12)):
                for b in range(a + 1, min(len(nums), 12)):
                    for c in range(b + 1, min(len(nums), 12)):
                        for d in range(c + 1, min(len(nums), 12)):
                            vals = [nums[a], nums[b], nums[c], nums[d]]
                            for total_idx in range(4):
                                total = vals[total_idx]
                                parts = [vals[j] for j in range(4) if j != total_idx]
                                if total == sum(parts) and total > 0:
                                    return total, parts[0], parts[1], parts[2]
    raise RuntimeError("Could not confidently parse auto-transport total/truck/taxi/bus from latest SSW Table 3")


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
    period, pdf_url = discover_latest_table3()
    text = extract_pdf_text(pdf_url)
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

    print(json.dumps({
        "status": "success",
        "period": period,
        "source": pdf_url,
        "auto_transport": total,
        "truck": truck,
        "taxi": taxi,
        "bus": bus,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
