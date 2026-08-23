#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MACRO_NAMES = {
    "nominal_gdp_fy_level": "名目GDP（年度）",
    "nominal_gdp_fy_growth_pct": "名目GDP成長率（年度）",
    "real_gdp_fy_growth_pct": "実質GDP成長率（年度）",
    "real_gdp_fy_level": "実質GDP（年度）",
    "real_gdp_qoq_pct": "実質GDP 前期比",
    "nominal_gdp_qoq_pct": "名目GDP 前期比",
    "real_gdp_quarterly_level_saar": "実質GDP 季節調整済年率",
    "nominal_gdp_quarterly_level_saar": "名目GDP 季節調整済年率",
    "industrial_production": "鉱工業生産指数",
    "manufacturing_shipments": "製造工業出荷指数",
    "eur_jpy": "ユーロ円相場",
    "usd_jpy": "ドル円相場",
    "crude_oil_import_cost": "原油輸入価格"
}

HTML_FILES = [
    "index.html", "radar.html", "topic.html", "archive.html", "economic-flow.html",
    "source-matrix.html", "status-history.html", "lens-history.html", "buzz.html",
    "commerce-calendar.html", "templates/report-template.html"
]


def main() -> None:
    macro_path = ROOT / "data/economy/macro.json"
    data = json.loads(macro_path.read_text(encoding="utf-8"))
    for s in data.get("series", []):
        if s.get("metric_id") in MACRO_NAMES:
            s["name_ja"] = MACRO_NAMES[s["metric_id"]]
    data["frequency_ja"] = "月次・四半期・年次"
    for src in data.get("sources", []):
        use = src.get("use")
        if use == "2005FY-2024FY historical annual baseline": src["use_ja"] = "2005年度〜2024年度の年次履歴基準"
        elif use == "latest 2025FY and 2026-Q2 preliminary observations": src["use_ja"] = "2025年度および2026年4-6月期の最新速報"
    macro_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    paths = [ROOT / p for p in HTML_FILES]
    paths.extend((ROOT / "reports").glob("**/*.html"))
    for path in paths:
        if not path.exists(): continue
        text = path.read_text(encoding="utf-8")
        text = text.replace(">話題</a>", ">バズ</a>").replace(">Buzz</a>", ">バズ</a>")
        path.write_text(text, encoding="utf-8")

    print("macro display labels and Buzz navigation localized")

if __name__ == "__main__": main()
