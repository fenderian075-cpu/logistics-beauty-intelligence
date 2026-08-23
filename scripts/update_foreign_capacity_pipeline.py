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
    r.encoding = "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")
    pdfs = []
    for a in soup.find_all("a"):
        href = a.get("href") or ""
        if ".pdf" not in href.lower():
            continue
        url = urljoin(LANDING, href)
        own = norm(a.get_text(" ", strip=True))
        parent = norm(a.parent.get_text(" ", strip=True)) if a.parent else own
        pdfs.append((url, own, parent))
        if "第3表" in own:
            return url
    excluded = ("概要版", "詳細版", "ポイント", "運用状況")
    for url, own, parent in pdfs:
        if "第3表" in parent and not any(x in own or x in parent[:80] for x in excluded):
            return url
    diagnostic = [f"{u} :: own={o[:100]} :: parent={p[:160]}" for u, o, p in pdfs[:20]]
    raise RuntimeError("Could not discover latest SSW Table 3 PDF; PDF candidates=" + json.dumps(diagnostic, ensure_ascii=False))


def extract_pdf_text(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": UA, "Referer": LANDING}, timeout=45)
    r.raise_for_status()
    reader = PdfReader(io.BytesIO(r.content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise RuntimeError("Latest SSW Table 3 PDF contained no extractable text")
    return unicodedata.normalize("NFKC", text)


def parse_period(text: str) -> str:
    t = norm(text)
    m = re.search(r"令和\s*(\d+)年\s*(6|12)月末", t) or re.search(r"令和\s*(\d+)年\s*(6|12)月(?:末)?(?:現在)?", t)
    if not m:
        raise RuntimeError("Could not resolve SSW half-year period from latest Table 3 PDF; prefix=" + t[:500])
    return f"{era_to_year(int(m.group(1))):04d}-{int(m.group(2)):02d}"


def numeric_tokens(s: str) -> list[int]:
    return [int(x.replace(",", "")) for x in re.findall(r"(?<!\d)(\d[\d,]*)(?!\d)", s)]


def reconciled_quad(nums: list[int]) -> tuple[int, int, int, int] | None:
    """Find a contiguous [total,truck,taxi,bus] or [truck,taxi,bus,total] block."""
    for i in range(max(0, len(nums) - 3)):
        a, b, c, d = nums[i:i + 4]
        # Exclude obvious years/page numbers while preserving plausible small field counts.
        if max(a, b, c, d) >= 1_000_000:
            continue
        if a > 0 and a == b + c + d:
            return a, b, c, d
        if d > 0 and d == a + b + c:
            return d, a, b, c
    return None


def parse_auto_transport(text: str) -> tuple[int, int, int, int]:
    raw = unicodedata.normalize("NFKC", text)
    label_joined = re.sub(r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])", "", raw)
    t = norm(label_joined)
    field = r"自動車運送業(?:分野)?"
    truck_label = r"トラック(?:運転者)?"
    taxi_label = r"タクシー(?:運転者)?"
    bus_label = r"バス(?:運転者)?"

    # First support layouts where labels and values are interleaved in extraction order.
    patterns = [
        field + r"\s*([\d,]+).*?" + truck_label + r"\s*([\d,]+).*?" + taxi_label + r"\s*([\d,]+).*?" + bus_label + r"\s*([\d,]+)",
        field + r".*?" + truck_label + r"\s*([\d,]+).*?" + taxi_label + r"\s*([\d,]+).*?" + bus_label + r"\s*([\d,]+).*?(?:計|総数)\s*([\d,]+)",
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

    # Actual ISA Table 3 currently extracts column labels first and the numeric row later.
    # Restrict the search to the real Table 3 section (not the TOC occurrence), then look shortly
    # after the truck/taxi/bus header for a reconciled four-number block.
    compact_labels = re.sub(r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])", "", raw)
    table3_markers = [m.start() for m in re.finditer(r"【第3表】|第3表", compact_labels)]
    section = compact_labels[table3_markers[-1]:] if table3_markers else compact_labels
    label_pos = section.find("トラック運転者")
    if label_pos < 0:
        label_pos = section.find("トラック")
    if label_pos >= 0:
        after = section[label_pos: label_pos + 12000]
        nums = numeric_tokens(after)[:160]
        quad = reconciled_quad(nums)
        if quad:
            return quad

    # A second guard uses the known field total exposed in Table 1/2. For the latest field-total
    # value, find the auto-transport column around '総数', then require a Table-3 three-part block
    # that sums to it. This makes accidental arithmetic matches much less likely.
    joined = re.sub(r"\s+", "", raw)
    field_pos = joined.find("自動車運送業分野")
    field_total = None
    if field_pos >= 0:
        # The first national '総数' row follows the industry headers. Extract a moderate window and
        # identify plausible current auto-transport total by matching a Table-3 candidate later.
        table1_window = joined[field_pos: field_pos + 1200]
        table1_nums = numeric_tokens(table1_window)
        if table1_nums:
            # 151 is currently in this set; future values remain candidates rather than hard-coded.
            candidate_totals = {n for n in table1_nums if 0 < n < 100000}
            if label_pos >= 0:
                part_nums = numeric_tokens(section[label_pos: label_pos + 12000])[:200]
                for i in range(max(0, len(part_nums) - 2)):
                    truck, taxi, bus = part_nums[i:i + 3]
                    total = truck + taxi + bus
                    if total in candidate_totals and total > 0:
                        field_total = total
                        return field_total, truck, taxi, bus

    keywords = {k: (k in joined) for k in ["自動車運送業", "トラック", "タクシー", "バス"]}
    context = norm(section[label_pos:label_pos + 6000] if label_pos >= 0 else section[:6000])
    raise RuntimeError("Could not confidently parse auto-transport split; keywords=" + json.dumps(keywords, ensure_ascii=False) + "; table3_context=" + context)


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
