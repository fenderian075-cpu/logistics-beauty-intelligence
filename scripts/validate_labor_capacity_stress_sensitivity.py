#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'data/economy'
d=json.loads((ROOT/'labor-capacity-stress-sensitivity.json').read_text(encoding='utf-8'))
v1=json.loads((ROOT/'labor-capacity-stress-v1.json').read_text(encoding='utf-8'))
def vals(data,mid):
 s=next(x for x in data['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}
if d.get('status')=='schema_ready':
 assert all(not s.get('observations') for s in d['series']); print('{"status":"pending"}'); raise SystemExit
assert d.get('status')=='derived_leave_one_out'
years=[str(y) for y in range(2018,2025)]
base=vals(v1,'labor_capacity_stress_v1')
ids=['stress_without_parcel_load','stress_without_freight_vacancy','stress_without_aging','stress_without_replacement','stress_without_working_age']
loo={mid:vals(d,mid) for mid in ids}; mn=vals(d,'stress_leave_one_out_min'); mx=vals(d,'stress_leave_one_out_max'); rg=vals(d,'stress_leave_one_out_range')
for x in [base,*loo.values(),mn,mx,rg]: assert list(x)==years
for y in years:
 assert abs(mn[y]-min(loo[mid][y] for mid in ids))<=0.11
 assert abs(mx[y]-max(loo[mid][y] for mid in ids))<=0.11
 assert abs(rg[y]-round(mx[y]-mn[y],1))<=0.11
 assert mn[y]<=base[y]<=mx[y] or y=='2018'
assert rg['2024']<20
print(json.dumps({'status':'success','base_2024':base['2024'],'min_2024':mn['2024'],'max_2024':mx['2024'],'range_2024':rg['2024'],'variants_2024':{mid:loo[mid]['2024'] for mid in ids}},ensure_ascii=False))
