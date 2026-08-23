#!/usr/bin/env python3
"""Japanese-localize public source-matrix vocabulary without altering source identities."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LAYER_MAP = {
    "Retail / Department Store": "小売・百貨店",
    "Industry Statistics": "業界統計",
    "Production / Shipment": "生産・出荷",
    "Retail / Commerce": "小売・商業",
    "Market Research": "市場調査",
    "Industry Media": "業界メディア",
    "Trade / Physical Flow": "貿易・実物流",
    "Warehouse / Physical Flow": "倉庫・実物流",
    "Port / Physical Flow": "港湾・実物流",
    "Truck / Physical Flow": "トラック・実物流",
    "Air / Physical Flow": "航空・実物流",
    "Logistics Cost": "物流コスト",
    "Beauty Demand": "化粧品需要",
    "Macro": "マクロ経済",
    "Inbound Demand": "訪日需要",
    "Corporate / Market": "企業・市場",
    "Corporate / IR": "企業IR",
    "Warehouse / IR": "倉庫IR",
    "Port / IR": "港湾IR",
    "Integrated Logistics / IR": "総合物流IR",
    "港湾・Reliability": "港湾・定時性",
    "船腹・Supply": "船腹・供給",
    "Reliability": "定時性",
    "Carrier IR / Network": "船社IR・ネットワーク",
    "Structural Outlook": "構造見通し",
    "Synthesis / Discovery": "統合・探索",
    "Buzz / Search": "話題・検索",
}

TERM_MAP = {
    "port congestion": "港湾混雑", "vessel waiting": "船舶待機", "capacity deployment": "船腹配分",
    "schedule pressure": "定時性圧力", "fleet capacity": "船腹量", "newbuildings": "新造船",
    "demolition": "解撤", "charter market": "用船市場", "carrier capacity": "船社供給力",
    "schedule reliability": "定時性", "average delay": "平均遅延", "carrier reliability": "船社定時性",
    "liftings": "輸送量", "utilization": "積載率", "freight index": "運賃指数",
    "profitability": "収益性", "network strategy": "ネットワーク戦略", "Japan connectivity": "日本接続性",
    "service change": "サービス変更", "Red Sea": "紅海", "Suez": "スエズ", "capacity": "供給力",
    "port omission": "抜港", "surcharge": "追加料金", "routing": "経路", "network": "ネットワーク",
    "Supply/Demand整理": "需給整理", "Makeup": "メイクアップ", "Skincare": "スキンケア",
    "Fragrance": "フレグランス",
}


def localize_value(value):
    if isinstance(value, str):
        return TERM_MAP.get(value, value)
    if isinstance(value, list):
        return [localize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: localize_value(v) for k, v in value.items()}
    return value


def main() -> None:
    for path in sorted((ROOT / "data").glob("source-matrix*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for source in data.get("sources", []):
            source["layer"] = LAYER_MAP.get(source.get("layer"), source.get("layer"))
            source["extract"] = [TERM_MAP.get(x, x) for x in source.get("extract", [])]
        path.write_text(json.dumps(localize_value(data), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("localized", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
