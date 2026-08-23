#!/usr/bin/env python3
"""Validate Demand × Capacity structural logistics datasets.

Recompute derived parcel/worker observations from canonical sources and guard
published age/labor-market series against silent coverage or semantic drift.
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


def one(data, metric_id):
    rows = observations(data, metric_id)
    assert len(rows) == 1, (metric_id, rows)
    return rows[0]


def main():
    parcel = read("parcel-demand.json")
    workforce = read("logistics-workforce.json")
    capacity = read("logistics-capacity.json")
    demography = read("driver-demography.json")
    labor = read("logistics-labor-market.json")

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
        value = round(parcels[period] / workers[period] * 100, 1)
        recomputed[period] = value
    for row in proxy:
        period = str(row["period"])
        assert abs(float(row["value"]) - recomputed[period]) <= 0.11
        assert row.get("status") == "derived"

    base = recomputed["2015"]
    idx = {str(r["period"]): float(r["value"]) for r in index}
    for period, value in recomputed.items():
        assert abs(idx[period] - round(value / base * 100, 1)) <= 0.11

    female = by_period(observations(workforce, "transport_postal_employment_female"))
    male = by_period(observations(workforce, "transport_postal_employment_male"))
    female_share = by_period(observations(workforce, "transport_postal_female_share"))
    for period in sorted(set(female) & set(male) & set(female_share)):
        expected = round(female[period] / (female[period] + male[period]) * 100, 2)
        assert abs(female_share[period] - expected) <= 0.02

    age_ids = ["all_industries_average_age", "commercial_large_truck_driver_average_age", "commercial_small_truck_driver_average_age"]
    age = {mid: observations(demography, mid) for mid in age_ids}
    for mid, rows in age.items():
        periods = [str(r["period"]) for r in rows]
        assert len(rows) == 11 and periods[0] == "2010" and periods[-1] == "2020", (mid, periods)
        assert all(r.get("status") == "official_secondary" for r in rows)
    large = by_period(age["commercial_large_truck_driver_average_age"])
    all_industry = by_period(age["all_industries_average_age"])
    assert large["2020"] == 49.4 and all_industry["2020"] == 43.2

    current_age = one(labor, "truck_driver_average_age_2025")
    income = one(labor, "truck_driver_annual_income")
    hours = one(labor, "truck_driver_monthly_work_hours")
    vacancy = one(labor, "truck_driver_job_openings_ratio")
    offered = one(labor, "truck_driver_offered_monthly_wage")
    assert (current_age["period"], float(current_age["value"])) == ("2025", 51.5)
    assert float(income["value"]) == 507.2 and float(hours["value"]) == 175
    assert (vacancy["period"], float(vacancy["value"])) == ("2025FY", 2.94)
    assert float(offered["value"]) == 29.5
    long_vacancy = observations(labor, "automobile_driver_job_openings_ratio_history")
    assert len(long_vacancy) == 17 and long_vacancy[0]["period"] == "2006" and long_vacancy[-1]["period"] == "2022"

    print(json.dumps({
        "status": "success",
        "parcel_coverage": [min(parcels), max(parcels), len(parcels)],
        "workforce_coverage": [min(workers), max(workers), len(workers)],
        "derived_coverage": [actual_periods[0], actual_periods[-1], len(actual_periods)],
        "latest_load_index": idx[actual_periods[-1]],
        "driver_age_2025": current_age["value"],
        "truck_driver_vacancy_2025fy": vacancy["value"],
        "truck_driver_income_2025": income["value"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
