#!/usr/bin/env python3
"""Validate official trucking physical-capacity data and deterministic ratios."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECON = ROOT / "data/economy"


def read(name):
    return json.loads((ECON / name).read_text(encoding="utf-8"))


def series(data, mid):
    return next(x for x in data.get("series", []) if x.get("metric_id") == mid)


def values(data, mid):
    return {str(o["period"]): float(o["value"]) for o in series(data, mid).get("observations", [])}


def main():
    data = read("trucking-physical-capacity.json")
    assert data.get("status") in {"source_verified_collector_ready", "populated_from_mlit_files"}
    required = {"truck_operators", "commercial_truck_vehicles", "vehicles_per_operator", "ton_km_per_vehicle"}
    assert required <= {x.get("metric_id") for x in data.get("series", [])}

    if data.get("status") == "source_verified_collector_ready":
        assert all(not x.get("observations") for x in data.get("series", []))
        print(json.dumps({"status":"collector_ready"}, ensure_ascii=False))
        return

    operators = values(data, "truck_operators")
    vehicles = values(data, "commercial_truck_vehicles")
    per_operator = values(data, "vehicles_per_operator")
    per_vehicle = values(data, "ton_km_per_vehicle")
    assert len(operators) >= 10 and len(vehicles) >= 10
    assert min(operators) <= "2015" and max(operators) >= "2023"
    assert min(vehicles) <= "2015" and max(vehicles) >= "2023"
    assert all(v > 10000 for v in operators.values())
    assert all(v > 100000 for v in vehicles.values())

    for y in sorted(set(operators) & set(vehicles) & set(per_operator)):
        expected = round(vehicles[y] / operators[y], 2)
        assert abs(per_operator[y] - expected) <= 0.011, (y, per_operator[y], expected)

    trucking = read("trucking.json")
    tkm = values(trucking, "commercial_truck_ton_km_annual")
    for y in sorted(set(tkm) & set(vehicles) & set(per_vehicle)):
        expected = round(tkm[y] * 1_000_000 / vehicles[y], 1)
        assert abs(per_vehicle[y] - expected) <= 0.11, (y, per_vehicle[y], expected)

    print(json.dumps({
        "status": "success",
        "operator_coverage": [min(operators), max(operators)],
        "vehicle_coverage": [min(vehicles), max(vehicles)],
        "latest_operators": operators[max(operators)],
        "latest_vehicles": vehicles[max(vehicles)],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
