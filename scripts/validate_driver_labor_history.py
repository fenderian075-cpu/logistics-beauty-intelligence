#!/usr/bin/env python3
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/economy/driver-labor-history.json'
d=json.loads(P.read_text(encoding='utf-8'))
def vals(mid):
    s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s['observations']}
large=vals('large_truck_driver_annual_work_hours'); small=vals('small_medium_truck_driver_annual_work_hours'); allv=vals('all_industries_annual_work_hours'); prem=vals('large_truck_work_hours_premium_vs_all')
years=[str(y) for y in range(2014,2023)]
assert list(large)==years and list(small)==years and list(allv)==years and list(prem)==years
assert large['2014']==2592 and large['2022']==2568
assert small['2014']==2580 and small['2022']==2520
assert allv['2014']==2136 and allv['2022']==2124
for y in years:
    assert abs(prem[y]-round((large[y]/allv[y]-1)*100,2))<=0.011
    assert large[y]>allv[y] and small[y]>allv[y]
print(json.dumps({'status':'success','large_2014':large['2014'],'large_2022':large['2022'],'premium_2022':prem['2022']},ensure_ascii=False))
