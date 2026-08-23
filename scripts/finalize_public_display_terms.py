#!/usr/bin/env python3
"""Localize final display-only terms and normalize public report shell details.

Only presentation text and an obsolete app.js cache-buster are changed. Stable
JSON enums, IDs, external-source URLs and HTML data attributes are untouched.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NAME_REPLACEMENTS = {
    "Beauty需要": "化粧品需要",
    "Beauty Demand": "化粧品需要",
}
EXTRACT_REPLACEMENTS = {
    "K-Beauty需要": "K-Beauty関連需要",
    "K-Beauty demand": "K-Beauty関連需要",
    "Beauty施策": "化粧品施策",
}
REPORT_JSON_REPLACEMENTS = {
    "effective supply": "実効供給力",
    "delay absorption": "遅延による供給力吸収",
}
HTML_REPLACEMENTS = {
    "Logistics &amp; Beauty Intelligence": "物流・化粧品インテリジェンス",
    "Corporate / Market": "企業・市場",
    "Beauty需要": "化粧品需要",
    "Beauty — ブランド公式サイト / Commerce": "化粧品 — ブランド公式サイト / 商流",
    "ECONOMIC &amp; PHYSICAL FLOW": "実体経済・物流フロー",
    "海上 — Rate / Supply / Reliability": "海上 — 運賃 / 供給 / 定時性",
    "<h3>Rate:": "<h3>運賃:",
    "<h3>Reliability:": "<h3>定時性:",
    '<span class="fact__label">Fact</span>': '<span class="fact__label">事実</span>',
    "コストSignal": "コスト指標",
    "space shortage": "船腹不足",
    "booking状況": "予約状況",
    "connectionを別確認": "接続状況を別確認",
    "effective supply": "実効供給力",
    "fleet supply": "船腹供給",
    "delay absorption": "遅延による供給力吸収",
    "Trade → Port/Air/Truck → Warehouse → Cost → Corporate": "貿易 → 港湾・航空・トラック → 倉庫 → コスト → 企業",
    "inventory build": "在庫積み上がり",
    "capacity逼迫": "供給力逼迫",
    "幹線capacity": "幹線輸送力",
    "余裕capacity": "余剰輸送力",
    "volume、pricing、profitability、capacity investment": "取扱量、価格設定、収益性、輸送力・設備投資",
    "launch、限定、GWP/PWP、ギフト、EC限定、価格変更": "新製品投入、限定、GWP/PWP、ギフト、EC限定、価格変更",
    "promotion/launch": "販促・新製品投入",
    "organic demand": "自然需要",
    "Daily監視": "日次監視",
    "Weekly": "週次",
    "Monthly": "月次",
    'assets/js/app.js?v=8.0.0': 'assets/js/app.js',
}


def replace_strings(value, replacements):
    if isinstance(value, str):
        out = value
        for old, new in replacements.items():
            out = out.replace(old, new)
        return out
    if isinstance(value, list):
        return [replace_strings(v, replacements) for v in value]
    if isinstance(value, dict):
        return {k: replace_strings(v, replacements) for k, v in value.items()}
    return value


def fix_source_display_fields() -> None:
    for path in sorted((ROOT / "data").glob("source-matrix*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for source in data.get("sources", []):
            name = source.get("name")
            if isinstance(name, str):
                new_name = name
                for old, new in NAME_REPLACEMENTS.items():
                    new_name = new_name.replace(old, new)
                if new_name != name:
                    source["name"] = new_name
                    changed = True
            extracts = source.get("extract")
            if isinstance(extracts, list):
                new_extracts = [EXTRACT_REPLACEMENTS.get(item, item) for item in extracts]
                if new_extracts != extracts:
                    source["extract"] = new_extracts
                    changed = True
        if changed:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fix_report_json() -> None:
    path = ROOT / "data/reports.json"
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    updated = replace_strings(data, REPORT_JSON_REPLACEMENTS)
    if updated != data:
        path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fix_report_html() -> None:
    for path in (ROOT / "reports").glob("**/*.html"):
        text = path.read_text(encoding="utf-8")
        updated = text
        for old, new in HTML_REPLACEMENTS.items():
            updated = updated.replace(old, new)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def main() -> None:
    fix_source_display_fields()
    fix_report_json()
    fix_report_html()
    print("Final public display/shell terms normalized; machine values untouched.")


if __name__ == "__main__":
    main()
