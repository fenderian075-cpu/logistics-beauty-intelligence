#!/usr/bin/env python3
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/economy/driver-labor-history.json'
d=json.loads(P.read_text(encoding='utf-8'))
def vals(mid):
    s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s['observations']}
large=vals('large_truck_driver_annual_work_hours'); small=vals('small_medium_truck_driver_annual_work_hours'); allv=vals('all_industries_annual_work_hours'); prem=vals('large_truck_work_hours_premium_vs_all')
large_inc=vals('large_truck_driver_annual_income'); small_inc=vals('small_medium_truck_driver_annual_income'); all_inc=vals('all_industries_annual_income')
large_gap=vals('large_truck_income_gap_vs_all'); small_gap=vals('small_medium_truck_income_gap_vs_all')
years=[str(y) for y in range(2014,2024)]
for s in (large,small,allv,prem,large_inc,small_inc,all_inc,large_gap,small_gap): assert list(s)==years
assert large['2014']==2592 and large['2023']==2544
assert small['2014']==2580 and small['2023']==2508
assert allv['2014']==2124 and allv['2023']==2136
assert large_inc['2014']==424 and large_inc['2023']==485
assert small_inc['2014']==379 and small_inc['2023']==438
assert all_inc['2014']==480 and all_inc['2023']==507
for y in years:
    assert abs(prem[y]-round((large[y]/allv[y]-1)*100,2))<=0.011
    assert abs(large_gap[y]-round((large_inc[y]/all_inc[y]-1)*100,2))<=0.011
    assert abs(small_gap[y]-round((small_inc[y]/all_inc[y]-1)*100,2))<=0.011
    assert large[y]>allv[y] and small[y]>allv[y]
    assert large_inc[y]<all_inc[y] and small_inc[y]<all_inc[y]
print(json.dumps({'status':'success','coverage':[years[0],years[-1]],'large_hours_2023':large['2023'],'large_income_2023':large_inc['2023'],'small_income_gap_2023':small_gap['2023']},ensure_ascii=False))
