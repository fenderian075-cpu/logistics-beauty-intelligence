#!/usr/bin/env python3
"""Validate Demand × Capacity structural logistics datasets.

This intentionally recomputes derived parcel/worker observations from their
canonical source stores so the frontend cannot silently drift from source data.
No interpolation is permitted. Published age series are also guarded against
coverage collapse and pseudo-derived averages.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECON = ROOT / "data" / "economy"


def read(name):
    return json.loads((ECON / name).read_text(encoding="utf-8"))


def series(data, metric_id):
    for item in data.get("series", []):
        if item.get("metric_id") == metric_id:
            return item
    raise AssertionError(f"missing series: {metric_id}")


def observations(data, metric_id):
    return series(data, metric_id).get("observations", [])


def by_period(rows):
    return {str(row["period"]): float(row["value"]) for row in rows}


def main():
    parcel = read("parcel-demand.json")
    workforce = read("logistics-workforce.json")
    capacity = read("logistics-capacity.json")
    demography = read("driver-demography.json")

    parcels = by_period(observations(parcel, "parcel_delivery_volume"))
    workers = by_period(observations(workforce, "transport_postal_employment"))
    proxy = observations(capacity, "parcel_per_transport_worker")
    index = observations(capacity, "parcel_load_index_2015")

    assert len(parcels) >= 15 and min(parcels) <= "2010" and max(parcels) >= "2024", "parcel history collapsed"
    assert len(workers) >= 11 and min(workers) <= "2015" and max(workers) >= "2025", "workforce history collapsed"
    assert proxy and index, "derived capacity series missing"

    common = sorted(set(parcels) & set(workers))
    expected_periods = [p for p in common if "2015" <= p <= "2024"]
    actual_periods = [str(r["period"]) for r in proxy]
    assert actual_periods == expected_periods, (actual_periods, expected_periods)

    recomputed = {}
    for period in expected_periods:
        # million parcels / ten-thousand persons => parcels per worker = *100
        value = round(parcels[period] / workers[period] * 100, 1)
        recomputed[period] = value
    for row in proxy:
        period = str(row["period"])
        assert abs(float(row["value"]) - recomputed[period]) <= 0.11, (period, row["value"], recomputed[period])
        assert row.get("status") == "derived", period

    base = recomputed["2015"]
    idx = {str(r["period"]): float(r["value"]) for r in index}
    for period, value in recomputed.items():
        expected = round(value / base * 100, 1)
        assert abs(idx[period] - expected) <= 0.11, (period, idx[period], expected)

    female = by_period(observations(workforce, "transport_postal_employment_female"))
    male = by_period(observations(workforce, "transport_postal_employment_male"))
    female_share = by_period(observations(workforce, "transport_postal_female_share"))
    for period in sorted(set(female) & set(male) & set(female_share)):
        expected = round(female[period] / (female[period] + male[period]) * 100, 2)
        assert abs(female_share[period] - expected) <= 0.02, (period, female_share[period], expected)

    age_ids = [
        "all_industries_average_age",
        "commercial_large_truck_driver_average_age",
        "commercial_small_truck_driver_average_age",
    ]
    age = {mid: observations(demography, mid) for mid in age_ids}
    for mid, rows in age.items():
        periods = [str(r["period"]) for r in rows]
        assert len(rows) == 11 and periods[0] == "2010" and periods[-1] == "2020", (mid, periods)
        assert all(r.get("status") == "official_secondary" for r in rows), f"{mid}: average age must be published, not pseudo-derived"
    large = by_period(age["commercial_large_truck_driver_average_age"])
    all_industry = by_period(age["all_industries_average_age"])
    assert large["2020"] == 49.4 and all_industry["2020"] == 43.2
    assert large["2020"] > all_industry["2020"]

    print(json.dumps({
        "status": "success",
        "parcel_coverage": [min(parcels), max(parcels), len(parcels)],
        "workforce_coverage": [min(workers), max(workers), len(workers)],
        "derived_coverage": [actual_periods[0], actual_periods[-1], len(actual_periods)],
        "latest_load_index": idx[actual_periods[-1]],
        "driver_age_coverage": ["2010", "2020", len(age["commercial_large_truck_driver_average_age"])],
        "large_driver_age_2020": large["2020"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
