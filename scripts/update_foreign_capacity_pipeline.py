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


def join_japanese_labels(text: str) -> str:
    return re.sub(r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])", "", text)


def parse_auto_transport(text: str) -> tuple[int, int, int, int]:
    raw = unicodedata.normalize("NFKC", text)
    t = norm(join_japanese_labels(raw))
    total_match = re.search(r"自動車運送業(?:分野)?\s*([\d,]+)\s*鉄道(?:分野)?\s*[\d,]+", t)
    parts_match = re.search(
        r"トラック運転者\s*タクシー運転者\s*バス運転者.*?運輸係員\s*([\d,]+)\s+([\d,]+)\s+([\d,]+)",
        t,
    )
    if total_match and parts_match:
        total = int(total_match.group(1).replace(",", ""))
        truck, taxi, bus = [int(x.replace(",", "")) for x in parts_match.groups()]
        if total > 0 and total == truck + taxi + bus:
            return total, truck, taxi, bus

    label_pos = t.find("トラック運転者")
    field_pos = t.rfind("自動車運送業", 0, label_pos if label_pos >= 0 else len(t))
    if label_pos >= 0 and field_pos >= 0:
        before = t[field_pos:label_pos]
        totals = [int(x.replace(",", "")) for x in re.findall(r"(?<!\d)(\d[\d,]*)(?!\d)", before)]
        totals = [x for x in totals if 0 < x < 100000]
        after = t[label_pos:label_pos + 5000]
        end_header = after.find("運輸係員")
        if end_header >= 0:
            after = after[end_header + len("運輸係員"):]
        nums = [int(x.replace(",", "")) for x in re.findall(r"(?<!\d)(\d[\d,]*)(?!\d)", after)][:80]
        for i in range(max(0, len(nums) - 2)):
            truck, taxi, bus = nums[i:i + 3]
            total = truck + taxi + bus
            if total in totals:
                return total, truck, taxi, bus

    joined = re.sub(r"\s+", "", raw)
    keywords = {k: (k in joined) for k in ["自動車運送業", "トラック", "タクシー", "バス"]}
    context_start = max(0, field_pos) if field_pos >= 0 else 0
    context = norm(join_japanese_labels(raw))[context_start:context_start + 6000]
    raise RuntimeError("Could not confidently parse auto-transport split; keywords=" + json.dumps(keywords, ensure_ascii=False) + "; context=" + context)


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
