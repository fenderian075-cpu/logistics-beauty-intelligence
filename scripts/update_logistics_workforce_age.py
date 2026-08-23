#!/usr/bin/env python3
"""Refresh logistics workforce age/industry structure from official e-Stat tables.

Source of truth:
- Labour Force Survey Annual Report, Whole Japan, I-B-5 (age x industry)
- Labour Force Survey result table II-2-1 (age x industry)

The collector is intentionally strict: it never interpolates missing cells and it
keeps occupation-level truck-driver statistics separate from industry-level road
freight / warehousing statistics.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "economy" / "logistics-workforce-age.json"

AGE_BANDS = ["15-24", "25-34", "35-44", "45-54", "55-64", "65+"]
INDUSTRIES = {
    "transport_postal": "運輸業，郵便業",
    "road_freight": "道路貨物運送業",
    "warehousing": "倉庫業",
}

SOURCE = {
    "name": "総務省統計局 労働力調査年報 I-B-5 / 結果原表 II-2-1",
    "annual_report_url": "https://www.e-stat.go.jp/stat-search/files?layout=dataset&query=%E7%94%A3%E6%A5%AD%E5%88%A5%E5%B0%B1%E6%A5%AD%E8%80%85%E6%95%B0",
    "table": "I-B-5 / II-2-1",
}


def build_contract():
    series = []
    for key, label in INDUSTRIES.items():
        for band in AGE_BANDS:
            suffix = band.replace("+", "_plus").replace("-", "_")
            series.append({
                "metric_id": f"{key}_age_{suffix}",
                "name_ja": f"{label} {band}歳 就業者数",
                "unit": "ten_thousand_persons",
                "observations": [],
            })
        series.extend([
            {
                "metric_id": f"{key}_age_55_plus_share",
                "name_ja": f"{label} 55歳以上比率",
                "unit": "pct",
                "observations": [],
            },
            {
                "metric_id": f"{key}_young_share",
                "name_ja": f"{label} 34歳以下比率",
                "unit": "pct",
                "observations": [],
            },
        ])
    return {
        "schema_version": "1.0",
        "dataset": "logistics-workforce-age",
        "title_ja": "物流労働力の年齢構造",
        "frequency": "annual",
        "sources": [SOURCE],
        "notes": [
            "年齢階級は公式表の実数のみを使用し、欠損を補間しない。",
            "55歳以上比率=(55-64 + 65+)/総数、34歳以下比率=(15-24 + 25-34)/総数としてLBIで派生する。",
            "道路貨物運送業・倉庫業は産業統計。トラックドライバー職業統計とは混同しない。",
            "平均年齢は年齢階級から推計せず、公式に直接公表された系列のみ別データセットで保持する。",
        ],
        "series": series,
    }


def main():
    # The schema/metric contract is committed first. Runtime workbook discovery
    # and parsing will populate observations only after exact source columns are
    # verified against the official I-B-5 workbook. This prevents silent column
    # drift when e-Stat changes workbook layout.
    data = build_contract()
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "contract_ready", "metrics": len(data["series"]), "source": SOURCE}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
