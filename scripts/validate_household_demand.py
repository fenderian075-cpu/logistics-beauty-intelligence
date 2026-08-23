#!/usr/bin/env python3
"""Validate household and EC demand context datasets."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "economy"


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def series(data, mid):
    return next(s for s in data["series"] if s["metric_id"] == mid)


def values(data, mid):
    return {str(o["period"]): float(o["value"]) for o in series(data, mid).get("observations", [])}


def main():
    hh = read("household-demand.json")
    ec = read("ec-demand.json")
    parcel = read("parcel-demand.json")

    households = values(hh, "resident_register_households")
    per_hh = values(hh, "parcel_per_household")
    parcels = values(parcel, "parcel_delivery_volume")
    market = values(ec, "physical_btoc_ec_market")
    ec_rate = values(ec, "physical_btoc_ec_rate")
    ec_index = values(ec, "physical_btoc_ec_index_2015")

    assert list(households) == [str(y) for y in range(2015, 2027)]
    assert 50 < households["2015"] < 70
    assert 50 < households["2026"] < 70
    assert households["2026"] > households["2015"]

    expected = [str(y) for y in range(2015, 2025)]
    assert list(per_hh) == expected
    for y in expected:
        recomputed = round(parcels[y] / households[y], 1)
        assert abs(per_hh[y] - recomputed) <= 0.11, (y, per_hh[y], recomputed)
    assert per_hh["2024"] > per_hh["2015"]

    assert list(market) == expected
    assert list(ec_rate) == expected
    assert list(ec_index) == expected
    base = market["2015"]
    for y in expected:
        recomputed = round(market[y] / base * 100, 1)
        assert abs(ec_index[y] - recomputed) <= 0.11
    assert market["2024"] > market["2015"]
    assert ec_rate["2024"] > ec_rate["2015"]

    print(json.dumps({
        "status": "success",
        "households_2015_million": households["2015"],
        "households_2026_million": households["2026"],
        "parcel_per_household_2015": per_hh["2015"],
        "parcel_per_household_2024": per_hh["2024"],
        "physical_ec_2015_trillion_jpy": market["2015"],
        "physical_ec_2024_trillion_jpy": market["2024"],
        "physical_ec_index_2024": ec_index["2024"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
