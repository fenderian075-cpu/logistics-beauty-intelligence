#!/usr/bin/env python3
"""Guard against accidental loss of long-running official economy histories."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(name):
    return json.loads((ROOT / "data/economy" / name).read_text(encoding="utf-8"))

def series(data, metric_id):
    return next((s for s in data.get("series", []) if s.get("metric_id") == metric_id), None)

def count(data, metric_id):
    s = series(data, metric_id)
    return len((s or {}).get("observations", []))

trade = load("japan-trade.json")
assert count(trade, "exports_total_annual") >= 70, count(trade, "exports_total_annual")
assert count(trade, "imports_total_annual") >= 70, count(trade, "imports_total_annual")
assert count(trade, "exports_total") >= 400, count(trade, "exports_total")
assert count(trade, "imports_total") >= 400, count(trade, "imports_total")

sna = load("industry-deflators.json")
assert len(sna.get("industries", [])) >= 16
for industry in sna.get("industries", []):
    rows = industry.get("observations", [])
    assert len(rows) >= 30, (industry.get("id"), len(rows))
    assert rows[-1].get("deflator_index_2020_100") is not None, industry.get("id")

warehouse = load("warehouse-flow.json")
for metric in ("inbound_volume", "outbound_volume", "inventory_balance"):
    assert count(warehouse, metric) >= 24, (metric, count(warehouse, metric))

print("economy history coverage valid")
