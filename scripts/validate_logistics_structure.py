#!/usr/bin/env python3
"""Validate Demand × Capacity structural logistics datasets."""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ECON=ROOT/'data'/'economy'
def read(name): return json.loads((ECON/name).read_text(encoding='utf-8'))
def series(data,mid):
    for item in data.get('series',[]):
        if item.get('metric_id')==mid:return item
    raise AssertionError(f'missing series: {mid}')
def observations(data,mid):return series(data,mid).get('observations',[])
def by_period(rows):return {str(r['period']):float(r['value']) for r in rows}
def one(data,mid):
    rows=observations(data,mid);assert len(rows)==1,(mid,rows);return rows[0]
def main():
    parcel=read('parcel-demand.json');workforce=read('logistics-workforce.json');capacity=read('logistics-capacity.json')
    driver=read('driver-demography.json');labor=read('logistics-labor-market.json');age_contract=read('logistics-workforce-age.json');jp_demo=read('japan-demography.json')
    parcels=by_period(observations(parcel,'parcel_delivery_volume'));workers=by_period(observations(workforce,'transport_postal_employment'))
    proxy=observations(capacity,'parcel_per_transport_worker');index=observations(capacity,'parcel_load_index_2015')
    assert len(parcels)>=15 and min(parcels)<='2010' and max(parcels)>='2024'
    assert len(workers)>=11 and min(workers)<='2015' and max(workers)>='2025'
    common=sorted(set(parcels)&set(workers));periods=[p for p in common if '2015'<=p<='2024'];assert [str(r['period']) for r in proxy]==periods
    recomputed={p:round(parcels[p]/workers[p]*100,1) for p in periods}
    for r in proxy:assert abs(float(r['value'])-recomputed[str(r['period'])])<=0.11 and r.get('status')=='derived'
    base=recomputed['2015'];idx=by_period(index)
    for p,v in recomputed.items():assert abs(idx[p]-round(v/base*100,1))<=0.11
    female=by_period(observations(workforce,'transport_postal_employment_female'));male=by_period(observations(workforce,'transport_postal_employment_male'));share=by_period(observations(workforce,'transport_postal_female_share'))
    for p in sorted(set(female)&set(male)&set(share)):assert abs(share[p]-round(female[p]/(female[p]+male[p])*100,2))<=0.02
    for mid in ['all_industries_average_age','commercial_large_truck_driver_average_age','commercial_small_truck_driver_average_age']:
        rows=observations(driver,mid);assert len(rows)==11 and rows[0]['period']=='2010' and rows[-1]['period']=='2020';assert all(r.get('status')=='official_secondary' for r in rows)
    current_age=one(labor,'truck_driver_average_age_2025');vacancy=one(labor,'truck_driver_job_openings_ratio')
    assert float(current_age['value'])==51.5 and float(vacancy['value'])==2.94
    expected_age_ids={'transport_postal_age_15_24','transport_postal_age_25_34','transport_postal_age_35_44','transport_postal_age_45_54','transport_postal_age_55_64','transport_postal_age_65_plus','transport_postal_age_55_plus_share','transport_postal_young_share','road_freight_employment','road_freight_age_55_plus_share','road_freight_young_share','road_freight_female_share','warehousing_employment','warehousing_age_55_plus_share','warehousing_young_share','warehousing_female_share'}
    actual_age_ids={s.get('metric_id') for s in age_contract.get('series',[])};assert expected_age_ids<=actual_age_ids
    assert age_contract.get('status')=='source_verified_schema_ready';assert all(not s.get('observations') for s in age_contract.get('series',[])), 'age contract must stay empty until official workbook columns are verified'
    census=one(jp_demo,'population_total_census_preliminary');assert census['period']=='2025-10-01' and abs(float(census['value'])-123.05)<0.001 and census.get('status')=='official_preliminary'
    for mid in ['population_male','population_female','working_age_population_15_64','population_age_65_plus']:
        assert series(jp_demo,mid).get('observations')==[],f'{mid}: do not backfill without official population-estimate series'
    print(json.dumps({'status':'success','latest_load_index':idx[periods[-1]],'driver_age_2025':current_age['value'],'truck_driver_vacancy_2025fy':vacancy['value'],'age_contract_metrics':len(actual_age_ids),'census_2025_million':census['value']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
