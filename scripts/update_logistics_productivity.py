#!/usr/bin/env python3
"""Derive structural logistics productivity metrics from committed official datasets.

Freight labor productivity = annual commercial-truck tonne-km / road-freight employment.
Warehouse labor productivity = annual (inbound + outbound) / warehousing employment.
Only complete calendar years are emitted. Warehouse metric is a structural proxy because
flow covers major ordinary-warehouse operators while employment is national industry data.
"""
from __future__ import annotations
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECON = ROOT / "data" / "economy"


def read(name):
    return json.loads((ECON / name).read_text(encoding="utf-8"))


def write(name, data):
    (ECON / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def series(data, metric_id):
    for s in data.get("series", []):
        if s.get("metric_id") == metric_id:
            return s
    raise KeyError(metric_id)


def values_by_period(data, metric_id):
    return {str(o["period"]): float(o["value"]) for o in series(data, metric_id).get("observations", [])}


def set_observations(data, metric_id, rows):
    series(data, metric_id)["observations"] = rows


def annualize_monthly(data, metric_id):
    buckets = defaultdict(list)
    for o in series(data, metric_id).get("observations", []):
        p = str(o.get("period", ""))
        if len(p) >= 7 and p[4] == "-":
            buckets[p[:4]].append(float(o["value"]))
    return {y: sum(vals) for y, vals in buckets.items() if len(vals) == 12}


def find_series(data, candidates):
    ids = {s.get("metric_id") for s in data.get("series", [])}
    for c in candidates:
        if c in ids:
            return c
    raise KeyError(f"none of {candidates} found; available={sorted(ids)}")


def main():
    age = read("logistics-workforce-age.json")
    capacity = read("logistics-capacity.json")
    trucking = read("trucking.json")
    warehouse = read("warehouse-flow.json")

    if age.get("status") != "populated_from_estat_api":
        raise SystemExit("workforce age/industry dataset is not populated")

    road_workers = values_by_period(age, "road_freight_employment")
    warehouse_workers = values_by_period(age, "warehousing_employment")
    tonkm = values_by_period(trucking, "commercial_truck_ton_km_annual")

    freight_rows = []
    for year in sorted(set(road_workers) & set(tonkm)):
        workers = road_workers[year] * 10_000
        if workers <= 0:
            continue
        # trucking source unit is billion tonne-km.
        value = tonkm[year] * 1_000_000_000 / workers / 1_000
        freight_rows.append({
            "period": year,
            "value": round(value, 1),
            "status": "derived",
            "source": "MLIT commercial truck tonne-km / e-Stat road freight employment",
        })

    inbound_id = find_series(warehouse, ["inbound_volume", "warehouse_inbound_volume"])
    outbound_id = find_series(warehouse, ["outbound_volume", "warehouse_outbound_volume"])
    inbound = annualize_monthly(warehouse, inbound_id)
    outbound = annualize_monthly(warehouse, outbound_id)

    warehouse_rows = []
    for year in sorted(set(warehouse_workers) & set(inbound) & set(outbound)):
        workers = warehouse_workers[year] * 10_000
        if workers <= 0:
            continue
        throughput = inbound[year] + outbound[year]
        warehouse_rows.append({
            "period": year,
            "value": round(throughput / workers, 1),
            "status": "derived_proxy",
            "source": "MLIT major-21 ordinary warehouse inbound+outbound / e-Stat warehousing employment",
        })

    set_observations(capacity, "freight_labor_productivity", freight_rows)
    series(capacity, "freight_labor_productivity")["unit"] = "thousand_tonne_km_per_worker_year"
    set_observations(capacity, "warehouse_labor_productivity", warehouse_rows)
    capacity["derived_updated_from"] = "logistics-workforce-age + trucking + warehouse-flow"
    write("logistics-capacity.json", capacity)

    print(json.dumps({
        "status": "success",
        "freight_years": [r["period"] for r in freight_rows],
        "warehouse_years": [r["period"] for r in warehouse_rows],
        "latest_freight": freight_rows[-1] if freight_rows else None,
        "latest_warehouse": warehouse_rows[-1] if warehouse_rows else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
