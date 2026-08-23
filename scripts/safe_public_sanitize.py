#!/usr/bin/env python3
"""Schema-aware public sanitizer for LBI.

Privacy cleaning is recursive because a brand name is never a valid internal enum.
Japanese localization is deliberately field-aware so stable IDs, enum values,
URLs, query parameters and HTML attributes are never translated.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BRAND_TERMS = [
    "Dior Beauty", "Dior", "ディオール", "Guerlain", "ゲラン",
    "Givenchy Beauty Japan", "Givenchy Beauty", "Givenchy", "ジバンシイ", "ジバンシー",
    "MAKE UP FOR EVER", "メイクアップフォーエバー", "Officine Universelle Buly", "Buly", "ビュリー",
    "Diptyque Japan", "Diptyque", "ディプティック", "CHANEL Beauty", "CHANEL", "シャネル",
    "YSL Beauty", "イヴ・サンローラン", "イヴサンローラン", "Lancôme", "Lancome", "ランコム",
    "SK-II", "エスケーツー", "Shiseido", "資生堂", "Clé de Peau Beauté",
    "クレ・ド・ポー ボーテ", "クレドポー ボーテ", "Jo Malone London", "Jo Malone", "ジョー マローン ロンドン", "ジョーマローン",
    "La Mer", "ラ・メール", "Byredo", "バイレード", "Rare Beauty", "Rhode beauty", "Rhode",
    "Fenty Beauty", "Charlotte Tilbury", "L'Oréal", "L’Oreal", "Estée Lauder Companies", "Estée Lauder",
]
BRAND_DOMAINS = [
    "dior.com", "guerlain.com", "givenchybeauty.com", "makeupforever.com", "buly1803.com",
    "diptyqueparis.com", "chanel.com", "yslb.jp", "lancome.jp", "sk-ii.jp", "shiseido.co.jp",
    "cledepeau-beaute.com", "jomalone.jp", "cremedelamer.jp", "byredo.com",
    "loreal-finance.com", "elcompanies.com",
]
BRAND_PATTERN = re.compile("|".join(sorted((re.escape(x) for x in BRAND_TERMS), key=len, reverse=True)), re.IGNORECASE)

PROSE_REPLACEMENTS = [
    ("Logistics & Beauty Intelligence Brief", "物流・化粧品インテリジェンス・ブリーフ"),
    ("Logistics & Beauty Intelligence", "物流・化粧品インテリジェンス"),
    ("Market Intelligence", "市場インテリジェンス"),
    ("Critical Radar", "重要動向"),
    ("Topic Intelligence", "トピック分析"),
    ("Brand.com Monitoring", "ブランド公式サイト監視"),
    ("Brand.com/EC", "ブランド公式サイト・EC"),
    ("Brand.com", "ブランド公式サイト"),
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
    ("effective supply", "実効供給力"),
    ("fleet supply", "船腹供給"),
    ("delay absorption", "遅延による供給力吸収"),
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
    ("capacity shortage", "船腹不足"),
    ("幹線capacity", "幹線輸送力"),
    ("promotion/launch", "販促・新製品投入"),
    ("Blank sailing", "欠便"),
    ("blank sailing", "欠便"),
]

PROSE_KEYS = {
    "title", "title_ja", "summary", "bottom_line", "signal", "headline", "description", "description_ja",
    "japan_implication", "operational_implication", "action_direction", "outlook_7d", "outlook_30d", "outlook_90d",
    "note", "public_note", "interpretation", "assessment", "event", "risk", "implication", "methodology",
}
PROSE_LIST_KEYS = {"key_issues", "tags", "structural_drivers", "monitor", "commercial_mechanics", "demand_drivers"}

LAYER_JA = {
    "Domestic Operations": "国内配送", "Weather": "気象・災害", "Roads": "道路",
    "Customs & Regulation": "通関・法令", "Customs": "通関・法令", "Freight Market": "運賃・需給",
    "Air Cargo": "航空貨物", "Professional Media": "専門媒体", "Innovation": "技術・イノベーション",
    "Platform": "EC・小売プラットフォーム", "Brand.com Monitoring": "ブランド公式サイト監視",
    "Brand.com": "ブランド公式サイト監視", "Corporate": "企業情報",
    "Retail / Department Store": "小売・百貨店", "Industry Statistics": "業界統計",
    "Production / Shipment": "生産・出荷", "Retail / Commerce": "小売・商業", "Market Research": "市場調査",
    "Industry Media": "業界メディア", "Trade / Physical Flow": "貿易・実物流",
    "Warehouse / Physical Flow": "倉庫・実物流", "Port / Physical Flow": "港湾・実物流",
    "Truck / Physical Flow": "トラック・実物流", "Air / Physical Flow": "航空・実物流",
    "Logistics Cost": "物流コスト", "Beauty Demand": "化粧品需要", "Macro": "マクロ経済",
    "Inbound Demand": "訪日需要", "Corporate / Market": "企業・市場", "Corporate / IR": "企業IR",
    "Warehouse / IR": "倉庫IR", "Port / IR": "港湾IR", "Integrated Logistics / IR": "総合物流IR",
    "港湾・Reliability": "港湾・定時性", "船腹・Supply": "船腹・供給", "Reliability": "定時性",
    "Carrier IR / Network": "船社IR・ネットワーク", "Structural Outlook": "構造見通し",
    "Synthesis / Discovery": "統合・探索", "Buzz / Search": "話題・検索",
}
EXTRACT_JA = {
    "route rates": "航路別運賃", "weekly change": "週次変化", "blank sailings": "欠便",
    "market commentary": "市況コメント", "load factor": "搭載率", "capacity": "供給力",
    "robotics": "ロボティクス", "computer vision": "画像認識", "sustainability": "持続可能性",
    "visibility": "可視化", "warehouse automation": "倉庫自動化", "decision support": "意思決定支援",
    "ranking": "ランキング", "campaign dates": "施策期間", "coupon": "クーポン", "points": "ポイント",
    "launch date": "発売日", "sales": "売上", "region": "地域", "e-commerce": "EC",
    "Makeup": "メイクアップ", "Skincare": "スキンケア", "Fragrance": "フレグランス",
    "port congestion": "港湾混雑", "vessel waiting": "船舶待機", "capacity deployment": "船腹配分",
    "schedule pressure": "定時性圧力", "fleet capacity": "船腹量", "newbuildings": "新造船",
    "demolition": "解撤", "charter market": "用船市場", "carrier capacity": "船社供給力",
    "schedule reliability": "定時性", "average delay": "平均遅延", "carrier reliability": "船社定時性",
    "liftings": "輸送量", "utilization": "積載率", "freight index": "運賃指数", "profitability": "収益性",
    "network strategy": "ネットワーク戦略", "Japan connectivity": "日本接続性", "service change": "サービス変更",
    "Red Sea": "紅海", "Suez": "スエズ", "port omission": "抜港", "surcharge": "追加料金", "routing": "経路",
    "Supply/Demand整理": "需給整理", "Beauty施策": "化粧品施策", "K-Beauty demand": "K-Beauty需要",
}


def is_brand_url(value: object) -> bool:
    return isinstance(value, str) and any(domain in value.lower() for domain in BRAND_DOMAINS)


def privacy_text(text: str) -> str:
    out = BRAND_PATTERN.sub("個別ブランド", text)
    return re.sub(r"(?:個別ブランド\s*[、,・/]\s*)+個別ブランド", "複数ブランド", out)


def prose_text(text: str) -> str:
    out = privacy_text(text)
    for old, new in PROSE_REPLACEMENTS:
        out = out.replace(old, new)
    return out


def privacy_clean(value):
    if isinstance(value, str):
        return privacy_text(value)
    if isinstance(value, list):
        return [privacy_clean(v) for v in value]
    if isinstance(value, dict):
        out = {}
        original_url = value.get("url")
        for key, item in value.items():
            if key == "url":
                out[key] = None if is_brand_url(item) else item
            else:
                out[key] = privacy_clean(item)
        if is_brand_url(original_url) and "source" in out:
            out["source"] = "ブランド公式サイト監視群"
        return out
    return value


def localize_prose_fields(value):
    if isinstance(value, list):
        return [localize_prose_fields(v) for v in value]
    if not isinstance(value, dict):
        return value
    out = {}
    for key, item in value.items():
        if key in PROSE_KEYS and isinstance(item, str):
            out[key] = prose_text(item)
        elif key in PROSE_LIST_KEYS and isinstance(item, list):
            out[key] = [prose_text(x) if isinstance(x, str) else localize_prose_fields(x) for x in item]
        else:
            out[key] = localize_prose_fields(item)
    return out


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sanitize_priority_brands() -> None:
    write_json(ROOT / "data/beauty-priority-brands.json", {
        "schema_version": "2.0-public", "updated_at": "2026-08-23T13:00:00+09:00",
        "public_note": "個別ブランドの監視対象・URL・優先順位は公開リポジトリに保存しない。公開版は監視カテゴリと判定軸のみ保持する。",
        "individual_targets": "private_external_configuration",
        "monitoring_groups": [
            {"category": "メイクアップ", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]},
            {"category": "スキンケア", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]},
            {"category": "フレグランス", "monitor": ["新製品", "限定品", "販促", "ギフト", "EC限定"]},
        ],
        "commercial_mechanics": ["GWP", "PWP", "チャーム", "ポーチ", "キー・キーチェーン", "ギフト", "限定キット", "セット", "クーポン", "ポイント", "EC限定", "予約販売", "先行販売"],
        "demand_drivers": ["自然需要", "販促", "新製品投入", "話題化"],
    })


def sanitize_watchlist() -> None:
    write_json(ROOT / "data/buzz-watchlist.json", {
        "schema_version": "2.0-public", "anchor": "化粧品",
        "public_note": "個別ブランド検索語は公開しない。公開版はカテゴリ・市場・販促テーマのみ保持する。",
        "terms": [
            {"term": "香水", "category": "fragrance"}, {"term": "リップ", "category": "makeup"},
            {"term": "ファンデーション", "category": "makeup"}, {"term": "クッションファンデ", "category": "makeup"},
            {"term": "美容液", "category": "skincare"}, {"term": "日焼け止め", "category": "skincare"},
            {"term": "韓国コスメ", "category": "market"}, {"term": "チャーム コスメ", "category": "promotion"},
            {"term": "ポーチ コスメ", "category": "promotion"}, {"term": "ギフト コスメ", "category": "promotion"},
            {"term": "限定 コスメ", "category": "promotion"}, {"term": "GWP コスメ", "category": "promotion"},
            {"term": "PWP コスメ", "category": "promotion"},
        ],
        "category_labels_ja": {"fragrance": "フレグランス", "makeup": "メイクアップ", "skincare": "スキンケア", "market": "市場", "promotion": "販促"},
    })


def sanitize_source_matrix(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    sources = []
    aggregate_rows = {}
    for source in data.get("sources", []):
        src = privacy_clean(source)
        original_layer = source.get("layer")
        src["layer"] = LAYER_JA.get(original_layer, original_layer)
        src["extract"] = [EXTRACT_JA.get(x, x) for x in source.get("extract", [])]
        is_private_beauty = source.get("domain") == "beauty" and (
            is_brand_url(source.get("url")) or original_layer in {"Brand.com Monitoring", "Brand.com", "Corporate"}
        )
        if is_private_beauty:
            layer = src["layer"]
            key = (layer, source.get("priority"))
            row = aggregate_rows.get(key)
            if row is None:
                row = {
                    "priority": source.get("priority"), "domain": "beauty", "layer": layer,
                    "name": "化粧品ブランド・企業 公開情報監視群", "url": None,
                    "cadence": list(source.get("cadence", [])), "extract": list(src.get("extract", [])),
                    "public_aggregate": True,
                }
                aggregate_rows[key] = row
                sources.append(row)
            else:
                row["cadence"] = list(dict.fromkeys(row["cadence"] + list(source.get("cadence", []))))
                row["extract"] = list(dict.fromkeys(row["extract"] + list(src.get("extract", []))))
            continue
        sources.append(src)
    data["sources"] = sources
    if path.name == "source-matrix.json":
        data["schema_version"] = "2.7"
    write_json(path, data)


def sanitize_intelligence_data() -> None:
    for rel in ["data/reports.json", "data/topic-intelligence.json", "data/critical-news.json", "data/initial-baseline-note.json"]:
        path = ROOT / rel
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        data = privacy_clean(data)
        data = localize_prose_fields(data)
        write_json(path, data)

    buzz_path = ROOT / "data/buzz.json"
    if buzz_path.exists():
        data = json.loads(buzz_path.read_text(encoding="utf-8"))
        rows = [row for row in data.get("observations", []) if row.get("category") != "brand" and not row.get("brand")]
        data["observations"] = privacy_clean(rows)
        if "note" in data.get("source", {}):
            data["source"]["note"] = prose_text(data["source"]["note"])
        write_json(buzz_path, data)

    cal_path = ROOT / "data/commerce-calendar.json"
    if cal_path.exists():
        data = privacy_clean(json.loads(cal_path.read_text(encoding="utf-8")))
        data = localize_prose_fields(data)
        write_json(cal_path, data)


def sanitize_report_html() -> None:
    domain_re = "|".join(re.escape(d) for d in BRAND_DOMAINS)
    href_re = re.compile(rf'href="https?://[^\"]*(?:{domain_re})[^\"]*"', re.IGNORECASE)
    for path in (ROOT / "reports").glob("**/*.html"):
        text = path.read_text(encoding="utf-8")
        text = href_re.sub('href="#" data-private-source="true"', text)
        text = BRAND_PATTERN.sub("個別ブランド", text)
        text = re.sub(r"(?:個別ブランド\s*[、,・/]\s*)+個別ブランド", "複数ブランド", text)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    sanitize_priority_brands()
    sanitize_watchlist()
    for path in sorted((ROOT / "data").glob("source-matrix*.json")):
        sanitize_source_matrix(path)
    sanitize_intelligence_data()
    sanitize_report_html()
    print("Schema-aware public sanitizer completed; internal enums and non-brand URLs preserved.")


if __name__ == "__main__":
    main()
