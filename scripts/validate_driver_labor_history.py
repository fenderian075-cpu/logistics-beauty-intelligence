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
years=[str(y) for y in range(2016,2025)]
for x in (large,small,allv,prem,large_inc,small_inc,all_inc,large_gap,small_gap): assert list(x)==years
# Latest MLIT/MHLW retrospective chart anchors.
assert large['2016']==2604 and large['2024']==2484
assert small['2016']==2484 and small['2024']==2424
assert allv['2016']==2148 and allv['2024']==2052
assert large_inc['2016']==453 and large_inc['2024']==492
assert small_inc['2016']==404 and small_inc['2024']==437
assert all_inc['2016']==487 and all_inc['2024']==527
for y in years:
    assert abs(prem[y]-round((large[y]/allv[y]-1)*100,2))<=0.011
    assert abs(large_gap[y]-round((large_inc[y]/all_inc[y]-1)*100,2))<=0.011
    assert abs(small_gap[y]-round((small_inc[y]/all_inc[y]-1)*100,2))<=0.011
    assert large[y]>allv[y] and small[y]>allv[y]
    assert large_inc[y]<all_inc[y] and small_inc[y]<all_inc[y]
# 2024 is the first observation after the overtime-cap / revised improvement-standard regime.
assert prem['2024']>20
assert large_gap['2024']<-5 and small_gap['2024']<-15
print(json.dumps({'status':'success','coverage':[years[0],years[-1]],'large_hours_2024':large['2024'],'small_hours_2024':small['2024'],'large_income_2024':large_inc['2024'],'small_income_2024':small_inc['2024'],'large_income_gap_2024':large_gap['2024'],'small_income_gap_2024':small_gap['2024']},ensure_ascii=False))
