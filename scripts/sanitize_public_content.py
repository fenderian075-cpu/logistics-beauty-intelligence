#!/usr/bin/env python3
"""Sanitize public LBI data and HTML for brand-target privacy and Japanese prose.

Important: JavaScript source is NOT run through broad text replacement. Public JS
labels are localized explicitly in source so identifiers/enums cannot be corrupted.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BRAND_TERMS = [
    "Dior Beauty", "Dior", "Guerlain", "ゲラン", "Givenchy Beauty Japan", "Givenchy Beauty", "ジバンシイ",
    "MAKE UP FOR EVER", "Officine Universelle Buly", "Buly", "Diptyque Japan", "Diptyque",
    "CHANEL Beauty", "CHANEL", "YSL Beauty", "YSL", "Lancôme", "Lancome", "SK-II",
    "Shiseido", "資生堂", "Clé de Peau Beauté", "クレ・ド・ポー ボーテ", "クレドポー ボーテ",
    "Jo Malone London", "La Mer", "Byredo", "Rare Beauty", "Rhode beauty", "Rhode",
    "Fenty Beauty", "Charlotte Tilbury", "L'Oréal", "L’Oreal", "Estée Lauder Companies", "Estée Lauder",
]
BRAND_DOMAINS = [
    "dior.com", "guerlain.com", "givenchybeauty.com", "makeupforever.com", "buly1803.com",
    "diptyqueparis.com", "chanel.com", "yslb.jp", "lancome.jp", "sk-ii.jp", "shiseido.co.jp",
    "cledepeau-beaute.com", "jomalone.jp", "cremedelamer.jp", "byredo.com", "loreal-finance.com",
    "elcompanies.com",
]

PHRASE_REPLACEMENTS = [
    ("Logistics & Beauty Intelligence Brief", "物流・化粧品インテリジェンス・ブリーフ"),
    ("Logistics & Beauty Intelligence", "物流・化粧品インテリジェンス"),
    ("Economic & Physical Flow", "経済・物流フロー"),
    ("Economic Flow", "経済・物流フロー"),
    ("Market Intelligence", "市場インテリジェンス"),
    ("Critical Radar", "重要動向"),
    ("Topic Intelligence", "トピック分析"),
    ("Source Matrix", "情報源一覧"),
    ("Status History", "ステータス履歴"),
    ("Brand.com Monitoring", "ブランド公式サイト監視"),
    ("Brand.com", "ブランド公式サイト"),
    ("Domestic Operations", "国内配送"),
    ("Customs & Regulation", "通関・法令"),
    ("Freight Market", "運賃・需給"),
    ("Air Cargo", "航空貨物"),
    ("Professional Media", "専門媒体"),
    ("Innovation", "技術・イノベーション"),
    ("Platform", "EC・小売プラットフォーム"),
    ("Corporate", "企業情報"),
    ("Beauty Demand", "化粧品需要"),
    ("Beauty商流", "化粧品商流"),
    ("Beauty需要", "化粧品需要"),
    ("reported event", "発表事象"),
    ("observed impact", "実影響"),
    ("network-wide", "ネットワーク全体"),
    ("organic demand", "自然需要"),
    ("base demand", "基礎需要"),
    ("promotion uplift", "販促による上振れ"),
    ("effective capacity loss", "実効供給力の低下"),
    ("deep-sea capacity", "外航船腹量"),
    ("booking lead time", "予約リードタイム"),
    ("service adjustment", "サービス調整"),
    ("schedule reliability", "定時性"),
    ("port call", "寄港"),
    ("transit time", "輸送日数"),
    ("Asia-origin", "アジア発"),
    ("Transpacific", "太平洋横断航路"),
    ("Asia-Europe/Med", "アジア―欧州・地中海航路"),
    ("Global index", "世界運賃指数"),
    ("global index", "世界運賃指数"),
    ("carrier/service", "輸送会社・サービス"),
    ("routing", "経路"),
    ("surcharge", "追加料金"),
    ("reliability", "定時性"),
    ("promotion", "販促"),
    ("launch", "新製品投入"),
    ("campaign", "施策"),
    ("carrier", "輸送会社"),
    ("capacity", "キャパシティ"),
    ("signal", "指標"),
]

LAYER_JA = {
    "Domestic Operations": "国内配送", "Weather": "気象・災害", "Roads": "道路",
    "Customs & Regulation": "通関・法令", "Customs": "通関・法令",
    "Freight Market": "運賃・需給", "Air Cargo": "航空貨物",
    "Professional Media": "専門媒体", "Innovation": "技術・イノベーション",
    "Platform": "EC・小売プラットフォーム", "Brand.com Monitoring": "ブランド公式サイト監視",
    "Brand.com": "ブランド公式サイト監視", "Corporate": "企業情報",
}
EXTRACT_JA = {
    "route rates": "航路別運賃", "weekly change": "週次変化", "blank sailings": "欠便",
    "market commentary": "市況コメント", "load factor": "搭載率", "capacity": "供給力",
    "robotics": "ロボティクス", "computer vision": "画像認識", "sustainability": "持続可能性",
    "visibility": "可視化", "warehouse automation": "倉庫自動化", "decision support": "意思決定支援",
    "ranking": "ランキング", "campaign dates": "施策期間", "coupon": "クーポン", "points": "ポイント",
    "launch date": "発売日", "sales": "売上", "region": "地域", "e-commerce": "EC",
    "Makeup": "メイクアップ", "Skincare": "スキンケア", "Fragrance": "フレグランス",
}


def normalize_text(text: str) -> str:
    out = text
    brand_pattern = "|".join(sorted((re.escape(x) for x in BRAND_TERMS), key=len, reverse=True))
    out = re.sub(brand_pattern, "個別ブランド", out, flags=re.IGNORECASE)
    out = re.sub(r"(?:個別ブランド\s*[、,・/]\s*)+個別ブランド", "複数ブランド", out)
    for old, new in PHRASE_REPLACEMENTS:
        out = out.replace(old, new)
    word_map = {
        "Daily": "日次", "Weekly": "週次", "Monthly": "月次", "lane": "航路",
        "rate": "運賃", "space": "スペース", "spot": "スポット", "renewal": "契約更新",
        "outlook": "見通し", "risk": "リスク",
    }
    for old, new in word_map.items():
        out = re.sub(rf"\b{re.escape(old)}\b", new, out, flags=re.IGNORECASE)
    return out


def is_brand_url(value: object) -> bool:
    return isinstance(value, str) and any(domain in value.lower() for domain in BRAND_DOMAINS)


def sanitize_obj(value):
    if isinstance(value, str):
        return normalize_text(value)
    if isinstance(value, list):
        result = [sanitize_obj(v) for v in value]
        if result and all(isinstance(v, dict) for v in result):
            seen, deduped = set(), []
            for item in result:
                key = json.dumps(item, ensure_ascii=False, sort_keys=True)
                if key not in seen:
                    seen.add(key); deduped.append(item)
            return deduped
        return result
    if isinstance(value, dict):
        original_url = value.get("url")
        brand_evidence = is_brand_url(original_url)
        out = {}
        for k, v in value.items():
            out[k] = None if (k == "url" and is_brand_url(v)) else sanitize_obj(v)
        if brand_evidence and "source" in out:
            out["source"] = "ブランド公式サイト監視群"
        return out
    return value


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sanitize_source_matrix() -> None:
    path = ROOT / "data/source-matrix.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["schema_version"] = "2.6"
    for source in data.get("sources", []):
        source["layer"] = LAYER_JA.get(source.get("layer"), source.get("layer"))
        source["extract"] = [EXTRACT_JA.get(x, normalize_text(x)) for x in source.get("extract", [])]
        if source.get("domain") == "beauty" and (
            is_brand_url(source.get("url")) or source.get("layer") in {"ブランド公式サイト監視", "企業情報"}
        ):
            source["name"] = "化粧品ブランド・企業 公開情報監視群"
            source["url"] = None
            source["public_aggregate"] = True
        if source.get("name") == "Brand.com監視群":
            source["name"] = "ブランド公式サイト監視群"
            source["url"] = None
            source["public_aggregate"] = True
    write_json(path, sanitize_obj(data))


def replace_priority_brand_file() -> None:
    write_json(ROOT / "data/beauty-priority-brands.json", {
        "schema_version": "2.0-public",
        "updated_at": "2026-08-23T13:00:00+09:00",
        "public_note": "個別ブランドの監視対象・URL・優先順位は公開リポジトリに保存しない。公開版は監視カテゴリと判定軸のみ保持する。",
        "individual_targets": "private_external_configuration",
        "monitoring_groups": [
            {"category": "メイクアップ", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]},
            {"category": "スキンケア", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]},
            {"category": "フレグランス", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]}
        ],
        "commercial_mechanics": ["GWP", "PWP", "チャーム", "ポーチ", "キー・キーチェーン", "ギフト", "限定キット", "セット", "クーポン", "ポイント", "EC限定", "予約販売", "先行販売"],
        "demand_drivers": ["自然需要", "販促", "新製品投入", "話題化"]
    })


def replace_buzz_watchlist() -> None:
    write_json(ROOT / "data/buzz-watchlist.json", {
        "schema_version": "2.0-public", "anchor": "化粧品",
        "public_note": "個別ブランド検索語は公開しない。公開版はカテゴリ・市場・販促テーマのみ保持する。",
        "terms": [
            {"term": "香水", "category": "フレグランス"}, {"term": "リップ", "category": "メイクアップ"},
            {"term": "ファンデーション", "category": "メイクアップ"}, {"term": "クッションファンデ", "category": "メイクアップ"},
            {"term": "美容液", "category": "スキンケア"}, {"term": "日焼け止め", "category": "スキンケア"},
            {"term": "韓国コスメ", "category": "市場"}, {"term": "チャーム コスメ", "category": "販促"},
            {"term": "ポーチ コスメ", "category": "販促"}, {"term": "ギフト コスメ", "category": "販促"},
            {"term": "限定 コスメ", "category": "販促"}, {"term": "GWP コスメ", "category": "販促"},
            {"term": "PWP コスメ", "category": "販促"}
        ]
    })


def sanitize_json_files() -> None:
    for rel in [
        "data/reports.json", "data/topic-intelligence.json", "data/critical-news.json",
        "data/buzz.json", "data/commerce-calendar.json", "data/initial-baseline-note.json"
    ]:
        path = ROOT / rel
        if path.exists():
            write_json(path, sanitize_obj(json.loads(path.read_text(encoding="utf-8"))))


def sanitize_public_html() -> None:
    files = [
        ROOT / "index.html", ROOT / "radar.html", ROOT / "topic.html", ROOT / "archive.html",
        ROOT / "economic-flow.html", ROOT / "source-matrix.html", ROOT / "status-history.html",
        ROOT / "lens-history.html", ROOT / "buzz.html", ROOT / "commerce-calendar.html",
        ROOT / "templates/report-template.html", ROOT / "templates/economic-flow-section.html",
    ]
    files.extend((ROOT / "reports").glob("**/*.html"))
    for path in files:
        if path.exists():
            path.write_text(normalize_text(path.read_text(encoding="utf-8")), encoding="utf-8")


def main() -> None:
    replace_priority_brand_file()
    replace_buzz_watchlist()
    sanitize_source_matrix()
    sanitize_json_files()
    sanitize_public_html()
    print("Public data/HTML sanitized; JavaScript identifiers left untouched.")


if __name__ == "__main__":
    main()
