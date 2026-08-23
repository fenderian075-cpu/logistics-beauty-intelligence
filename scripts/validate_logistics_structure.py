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
    parcels=by_period(observations(parcel,'parcel_delivery_volume'));workers=by_period(observations(workforce,'transport_postal_employment'));all_workers=by_period(observations(workforce,'all_industries_employment'));worker_share=by_period(observations(workforce,'transport_postal_employment_share'))
    proxy=observations(capacity,'parcel_per_transport_worker');index=observations(capacity,'parcel_load_index_2015');parcel_capita=by_period(observations(capacity,'parcel_per_capita'))
    assert len(parcels)>=15 and min(parcels)<='2010' and max(parcels)>='2024'
    expected_years=[str(y) for y in range(2015,2026)]
    assert list(workers)==expected_years and list(all_workers)==expected_years and list(worker_share)==expected_years
    assert all_workers['2015']==6376 and all_workers['2025']==6828
    for p in expected_years:
        assert abs(worker_share[p]-round(workers[p]/all_workers[p]*100,2))<=0.011,(p,worker_share[p])
    assert worker_share['2025']<worker_share['2015']
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
    census=one(jp_demo,'population_total_census_preliminary');assert census['period']=='2025-10-01' and abs(float(census['value'])-123.05)<0.001
    pop=by_period(observations(jp_demo,'population_total'));pm=by_period(observations(jp_demo,'population_male'));pf=by_period(observations(jp_demo,'population_female'));young=by_period(observations(jp_demo,'population_age_0_14'));working=by_period(observations(jp_demo,'working_age_population_15_64'));old=by_period(observations(jp_demo,'population_age_65_plus'));working_share=by_period(observations(jp_demo,'working_age_share'))
    for name,values in [('total',pop),('male',pm),('female',pf),('0-14',young),('15-64',working),('65+',old),('working_share',working_share)]:assert list(values)==expected_years,(name,list(values))
    for y in expected_years:
        assert abs((pm[y]+pf[y])-pop[y])<=0.002
        assert abs((young[y]+working[y]+old[y])-pop[y])<=0.003
        assert abs(working_share[y]-round(working[y]/pop[y]*100,1))<=0.1
    for p in [str(y) for y in range(2015,2025)]:
        expected=round(parcels[p]/pop[p],1)
        assert abs(parcel_capita[p]-expected)<=0.11,(p,parcel_capita[p],expected)
    assert parcel_capita['2024']>parcel_capita['2015']
    foreign=by_period(observations(jp_demo,'foreign_population'));assert abs(foreign['2024-10-01']-3.506)<0.001 and abs(foreign['2025-10-01']-3.839)<0.001
    snap_total=one(jp_demo,'population_snapshot_2026_01_total');assert abs(float(snap_total['value'])-122.980)<0.001
    print(json.dumps({'status':'success','latest_load_index':idx[periods[-1]],'parcel_per_capita_2015':parcel_capita['2015'],'parcel_per_capita_2024':parcel_capita['2024'],'employment_share_2015':worker_share['2015'],'employment_share_2025':worker_share['2025'],'driver_age_2025':current_age['value'],'truck_driver_vacancy_2025fy':vacancy['value'],'population_2025_million':pop['2025']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
