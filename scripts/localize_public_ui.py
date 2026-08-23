#!/usr/bin/env python3
"""Normalize selected public-facing presentation literals to Japanese.

Only exact display phrases are replaced; generic JS identifiers/enums are untouched.
"""
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SAFE_REPLACEMENTS = [
    ("Logistics & Beauty Intelligence Brief", "物流・化粧品インテリジェンス・ブリーフ"),
    ("Logistics & Beauty Intelligence", "物流・化粧品インテリジェンス"),
    ("Topic Intelligence", "トピック分析"),
    ("Critical Radar", "重要動向"),
    ("Source Matrix", "情報源一覧"),
    ("Status History", "ステータス履歴"),
    ("Economic & Physical Flow", "経済・物流フロー"),
    ("Economic Flow", "経済・物流フロー"),
    ("NOMINAL → PRICE → REAL", "名目 → 価格 → 実質"),
    ("NOMINAL × REAL × PRICE", "名目 × 実質 × 価格"),
    ("Beauty商流", "化粧品商流"),
    ("Beauty需要 proxy", "化粧品需要の実質推計"),
    ("Beauty需要", "化粧品需要"),
    ("Beauty Demand", "化粧品需要"),
    ("百貨店Beauty", "百貨店化粧品"),
    ("Drugstore Beauty", "ドラッグストア化粧品"),
    ("ドラッグストアBeauty", "ドラッグストア化粧品"),
    ("Beautyの実質proxy", "化粧品需要の実質推計"),
    ("実質proxy", "実質推計"),
    ("価格proxy", "価格代理指標"),
    ("2015-2025年の年平均接続系列をbaseline化。", "2015-2025年の年平均接続系列を基準系列化。"),
    ("名目YoY 2024", "名目前年比 2024"),
    ("実質QoQ 2026Q1", "実質前期比 2026年1-3月期"),
    ("名目2024", "2024年名目"),
    ("実質2026Q1", "2026年1-3月期実質"),
    ("価格シグナル", "価格指標"),
    ("SNAデフレーター取込待ち", "SNAデフレーター未取込"),
    ("市場レジーム", "市場局面"),
    ("Brand.com/EC", "ブランド公式サイト・EC"),
    ("Brand.com", "ブランド公式サイト"),
    ("Daily監視", "日次監視"), ("Weekly監視", "週次監視"), ("Monthly監視", "月次監視"),
    ("EC promotion", "EC販促"), ("organic demand", "自然需要"),
    ("reported event", "発表事象"), ("observed impact", "実影響"),
    ("network-wide", "ネットワーク全体"), ("service adjustment", "サービス調整"),
    ("booking lead time", "予約リードタイム"), ("schedule reliability", "定時性"),
    ("port call", "寄港"), ("transit time", "輸送日数"),
    ("promotion uplift", "販促による上振れ"), ("effective capacity loss", "実効供給力の低下"),
    ("deep-sea capacity", "外航船腹量"), ("Asia-origin", "アジア発"),
    ("Transpacific", "太平洋横断航路"), ("Asia-Europe/Med", "アジア―欧州・地中海航路"),
    ("この signal の推移", "この指標の推移"), ("通関・NACCS", "通関・法令"),
]

FILES = [
    "assets/js/core/labels.js", "assets/js/pages/economic-flow.js",
    "assets/js/render/industry-deflator-panel.js", "assets/js/render/market-regime-panel.js",
    "assets/js/render/market-regime.js", "assets/js/domain/market-regimes.js",
    "index.html", "radar.html", "topic.html", "archive.html", "economic-flow.html",
    "source-matrix.html", "status-history.html", "lens-history.html", "buzz.html", "commerce-calendar.html",
    "templates/report-template.html", "templates/economic-flow-section.html",
]

def localize(text: str) -> str:
    for old, new in SAFE_REPLACEMENTS:
        text = text.replace(old, new)
    return text

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
