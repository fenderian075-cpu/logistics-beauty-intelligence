#!/usr/bin/env python3
"""Normalize remaining public-facing English presentation vocabulary to Japanese.

Stable internal enum keys and established technical acronyms are not changed.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS = [
    ("Logistics & Beauty Intelligence Brief", "物流・化粧品インテリジェンス・ブリーフ"),
    ("Logistics & Beauty Intelligence", "物流・化粧品インテリジェンス"),
    ("NOMINAL → PRICE → REAL", "名目 → 価格 → 実質"),
    ("NOMINAL × REAL × PRICE", "名目 × 実質 × 価格"),
    ("Beauty需要 proxy", "化粧品需要の実質推計"),
    ("Beauty需要", "化粧品需要"),
    ("百貨店Beauty", "百貨店化粧品"),
    ("Drugstore Beauty", "ドラッグストア化粧品"),
    ("ドラッグストアBeauty", "ドラッグストア化粧品"),
    ("Beautyの実質proxy", "化粧品需要の実質推計"),
    ("実質proxy", "実質推計"),
    ("価格proxy", "価格代理指標"),
    ("baseline", "基準系列"),
    ("YoY", "前年比"),
    ("QoQ", "前期比"),
    ("MoM", "前月比"),
    ("vintage", "公表年次"),
    ("Market Regime", "市場局面"),
    ("market regime", "市場局面"),
    ("市場レジーム", "市場局面"),
    ("same-period", "同期間"),
    ("SAME-PERIOD", "同期間"),
    ("Brand.com/EC", "ブランド公式サイト・EC"),
    ("Brand.com", "ブランド公式サイト"),
    ("Daily監視", "日次監視"),
    ("Weekly監視", "週次監視"),
    ("Monthly監視", "月次監視"),
    ("Daily", "日次"),
    ("Weekly", "週次"),
    ("Monthly", "月次"),
    ("EC promotion", "EC販促"),
    ("promotion", "販促"),
    ("launch", "新製品投入"),
    ("campaign", "施策"),
    ("organic demand", "自然需要"),
    ("Buzz", "話題化"),
    ("buzz", "話題化"),
    ("Rate", "運賃"),
    ("Supply", "供給"),
    ("Demand", "需要"),
    ("Reliability", "定時性"),
    ("Risk", "リスク"),
    ("Capacity", "供給力"),
    ("capacity", "供給力"),
    ("Blank sailing", "欠便"),
    ("blank sailing", "欠便"),
    ("carrier", "輸送会社"),
    ("service adjustment", "サービス調整"),
    ("routing", "経路"),
    ("port call", "寄港"),
    ("surcharge", "追加料金"),
    ("transit time", "輸送日数"),
    ("reported event", "発表事象"),
    ("observed impact", "実影響"),
    ("network-wide", "ネットワーク全体"),
    ("lead-time", "リードタイム"),
    ("lead time", "リードタイム"),
    ("signal", "指標"),
]

FILES = [
    "assets/js/core/labels.js",
    "assets/js/pages/economic-flow.js",
    "assets/js/render/industry-deflator-panel.js",
    "assets/js/render/market-regime-panel.js",
    "assets/js/render/market-regime.js",
    "assets/js/domain/market-regimes.js",
    "index.html", "radar.html", "topic.html", "archive.html", "economic-flow.html",
    "source-matrix.html", "status-history.html", "lens-history.html", "buzz.html", "commerce-calendar.html",
    "templates/report-template.html", "templates/economic-flow-section.html",
]


def localize(text: str) -> str:
    out = text
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    return out


def main() -> None:
    paths = [ROOT / rel for rel in FILES]
    paths.extend((ROOT / "reports").glob("**/*.html"))
    for path in paths:
        if not path.exists():
            continue
        original = path.read_text(encoding="utf-8")
        updated = localize(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            print("localized", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
