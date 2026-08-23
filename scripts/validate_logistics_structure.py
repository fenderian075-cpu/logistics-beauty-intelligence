#!/usr/bin/env python3
"""Validate Demand × Capacity structural logistics datasets."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ECON = ROOT / "data" / "economy"


def read(name):
    return json.loads((ECON / name).read_text(encoding="utf-8"))


def series(data, mid):
    for item in data.get("series", []):
        if item.get("metric_id") == mid:
            return item
    raise AssertionError(f"missing series: {mid}")


def observations(data, mid):
    return series(data, mid).get("observations", [])


def by_period(rows):
    return {str(r["period"]): float(r["value"]) for r in rows}


def one(data, mid):
    rows = observations(data, mid)
    assert len(rows) == 1, (mid, rows)
    return rows[0]


def validate_age_structure(age_data, transport_workers, expected_years):
    bands = ["15_24", "25_34", "35_44", "45_54", "55_64", "65_plus"]
    expected_ids = set()
    for key in ["transport_postal", "road_freight", "warehousing"]:
        expected_ids |= {f"{key}_age_{b}" for b in bands}
        expected_ids |= {f"{key}_age_55_plus_share", f"{key}_young_share", f"{key}_replacement_ratio"}
    expected_ids |= {"road_freight_employment", "road_freight_female_share", "warehousing_employment", "warehousing_female_share"}
    actual_ids = {s.get("metric_id") for s in age_data.get("series", [])}
    assert expected_ids <= actual_ids
    api = age_data.get("api_contract", {})
    assert api.get("stats_data_id") == "0003007108"
    assert api.get("industry") == {"transport_postal": "42", "road_freight": "45", "warehousing": "48"}
    age_codes = api.get("age", {})
    assert age_codes.get("55_59") == "16" and age_codes.get("60_64") == "17" and age_codes.get("65_plus") == "18"
    status = age_data.get("status")
    assert status in {"source_verified_api_ready", "populated_from_estat_api"}
    if status == "source_verified_api_ready":
        assert all(not s.get("observations") for s in age_data.get("series", []))
        return status, actual_ids
    for key in ["transport_postal", "road_freight", "warehousing"]:
        band_values = {b: by_period(observations(age_data, f"{key}_age_{b}")) for b in bands}
        for b, values in band_values.items():
            assert list(values) == expected_years, (key, b, list(values))
            assert all(v >= 0 for v in values.values())
        total_from_bands = {y: sum(band_values[b][y] for b in bands) for y in expected_years}
        if key == "transport_postal":
            total = transport_workers
        else:
            total = by_period(observations(age_data, f"{key}_employment"))
            assert list(total) == expected_years
        old_share = by_period(observations(age_data, f"{key}_age_55_plus_share"))
        young_share = by_period(observations(age_data, f"{key}_young_share"))
        replacement = by_period(observations(age_data, f"{key}_replacement_ratio"))
        for y in expected_years:
            assert abs(total_from_bands[y] - total[y]) <= 3.0
            old = band_values["55_64"][y] + band_values["65_plus"][y]
            young = band_values["15_24"][y] + band_values["25_34"][y]
            assert abs(old_share[y] - round(old / total[y] * 100, 2)) <= 0.02
            assert abs(young_share[y] - round(young / total[y] * 100, 2)) <= 0.02
            assert old > 0 and abs(replacement[y] - round(young / old, 2)) <= 0.02
        if key != "transport_postal":
            female_share = by_period(observations(age_data, f"{key}_female_share"))
            assert list(female_share) == expected_years
            assert all(0 <= female_share[y] <= 100 for y in expected_years)
    return status, actual_ids


def main():
    parcel = read("parcel-demand.json")
    workforce = read("logistics-workforce.json")
    capacity = read("logistics-capacity.json")
    driver = read("driver-demography.json")
    labor = read("logistics-labor-market.json")
    age_contract = read("logistics-workforce-age.json")
    jp_demo = read("japan-demography.json")
    ec = read("ec-demand.json")
    household = read("household-demand.json")

    parcels = by_period(observations(parcel, "parcel_delivery_volume"))
    workers = by_period(observations(workforce, "transport_postal_employment"))
    all_workers = by_period(observations(workforce, "all_industries_employment"))
    worker_share = by_period(observations(workforce, "transport_postal_employment_share"))
    proxy = observations(capacity, "parcel_per_transport_worker")
    index = observations(capacity, "parcel_load_index_2015")
    parcel_capita = by_period(observations(capacity, "parcel_per_capita"))

    assert len(parcels) >= 15 and min(parcels) <= "2010" and max(parcels) >= "2024"
    expected_years = [str(y) for y in range(2015, 2026)]
    periods = [str(y) for y in range(2015, 2025)]
    assert list(workers) == expected_years and list(all_workers) == expected_years and list(worker_share) == expected_years
    assert all_workers["2015"] == 6376 and all_workers["2025"] == 6828
    for p in expected_years:
        assert abs(worker_share[p] - round(workers[p] / all_workers[p] * 100, 2)) <= 0.011
    assert worker_share["2025"] < worker_share["2015"]

    assert [str(r["period"]) for r in proxy] == periods
    recomputed = {p: round(parcels[p] / workers[p] * 100, 1) for p in periods}
    for r in proxy:
        assert abs(float(r["value"]) - recomputed[str(r["period"])]) <= 0.11 and r.get("status") == "derived"
    base = recomputed["2015"]
    idx = by_period(index)
    for p, v in recomputed.items():
        assert abs(idx[p] - round(v / base * 100, 1)) <= 0.11

    ec_market = by_period(observations(ec, "physical_btoc_ec_market"))
    ec_rate = by_period(observations(ec, "physical_btoc_ec_rate"))
    ec_index = by_period(observations(ec, "physical_btoc_ec_index_2015"))
    assert list(ec_market) == periods and list(ec_rate) == periods and list(ec_index) == periods
    assert abs(ec_market["2015"] - 7.2398) < 0.0001 and abs(ec_market["2024"] - 15.2194) < 0.0001
    assert abs(ec_rate["2015"] - 4.75) < 0.001 and abs(ec_rate["2024"] - 9.78) < 0.001
    ec_base = ec_market["2015"]
    for p in periods:
        assert abs(ec_index[p] - round(ec_market[p] / ec_base * 100, 1)) <= 0.11
    assert ec_index["2024"] > 200

    household_values = by_period(observations(household, "resident_register_households"))
    parcel_household = by_period(observations(household, "parcel_per_household"))
    expected_household_years = [str(y) for y in range(2015, 2027)]
    assert household.get("status") == "populated_from_estat_files"
    assert list(household_values) == expected_household_years
    assert list(parcel_household) == periods
    assert abs(household_values["2015"] - 56.41214) < 0.000001
    assert abs(household_values["2026"] - 61.74714) < 0.000001
    assert all(30 < household_values[y] < 100 for y in expected_household_years)
    for p in periods:
        assert abs(parcel_household[p] - round(parcels[p] / household_values[p], 1)) <= 0.11
    assert abs(parcel_household["2015"] - 66.4) <= 0.01
    assert abs(parcel_household["2024"] - 82.8) <= 0.01
    assert parcel_household["2024"] > parcel_household["2015"]

    female = by_period(observations(workforce, "transport_postal_employment_female"))
    male = by_period(observations(workforce, "transport_postal_employment_male"))
    share = by_period(observations(workforce, "transport_postal_female_share"))
    for p in sorted(set(female) & set(male) & set(share)):
        assert abs(share[p] - round(female[p] / (female[p] + male[p]) * 100, 2)) <= 0.02

    for mid in ["all_industries_average_age", "commercial_large_truck_driver_average_age", "commercial_small_truck_driver_average_age"]:
        rows = observations(driver, mid)
        assert len(rows) == 11 and rows[0]["period"] == "2010" and rows[-1]["period"] == "2020"
        assert all(r.get("status") == "official_secondary" for r in rows)
    current_age = one(labor, "truck_driver_average_age_2025")
    vacancy = one(labor, "truck_driver_job_openings_ratio")
    assert float(current_age["value"]) == 51.5 and float(vacancy["value"]) == 2.94
    age_status, age_ids = validate_age_structure(age_contract, workers, expected_years)

    census = one(jp_demo, "population_total_census_preliminary")
    assert census["period"] == "2025-10-01" and abs(float(census["value"]) - 123.05) < 0.001
    pop = by_period(observations(jp_demo, "population_total"))
    pm = by_period(observations(jp_demo, "population_male"))
    pf = by_period(observations(jp_demo, "population_female"))
    young = by_period(observations(jp_demo, "population_age_0_14"))
    working = by_period(observations(jp_demo, "working_age_population_15_64"))
    old = by_period(observations(jp_demo, "population_age_65_plus"))
    working_share = by_period(observations(jp_demo, "working_age_share"))
    for values in [pop, pm, pf, young, working, old, working_share]:
        assert list(values) == expected_years
    for y in expected_years:
        assert abs((pm[y] + pf[y]) - pop[y]) <= 0.002
        assert abs((young[y] + working[y] + old[y]) - pop[y]) <= 0.003
        assert abs(working_share[y] - round(working[y] / pop[y] * 100, 1)) <= 0.1
    for p in periods:
        assert abs(parcel_capita[p] - round(parcels[p] / pop[p], 1)) <= 0.11
    assert parcel_capita["2024"] > parcel_capita["2015"]

    foreign = by_period(observations(jp_demo, "foreign_population"))
    assert abs(foreign["2024-10-01"] - 3.506) < 0.001 and abs(foreign["2025-10-01"] - 3.839) < 0.001
    snap_total = one(jp_demo, "population_snapshot_2026_01_total")
    assert abs(float(snap_total["value"]) - 122.980) < 0.001

    print(json.dumps({
        "status": "success",
        "latest_load_index": idx[periods[-1]],
        "parcel_per_capita_2015": parcel_capita["2015"],
        "parcel_per_capita_2024": parcel_capita["2024"],
        "households_2015_million": household_values["2015"],
        "households_2026_million": household_values["2026"],
        "parcel_per_household_2015": parcel_household["2015"],
        "parcel_per_household_2024": parcel_household["2024"],
        "physical_ec_2015_trillion_jpy": ec_market["2015"],
        "physical_ec_2024_trillion_jpy": ec_market["2024"],
        "physical_ec_index_2024": ec_index["2024"],
        "employment_share_2015": worker_share["2015"],
        "employment_share_2025": worker_share["2025"],
        "age_api_status": age_status,
        "age_metric_count": len(age_ids),
        "driver_age_2025": current_age["value"],
        "truck_driver_vacancy_2025fy": vacancy["value"],
        "population_2025_million": pop["2025"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
