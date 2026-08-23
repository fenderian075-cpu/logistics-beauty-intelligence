#!/usr/bin/env python3
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/economy/labor-capacity-stress.json'
d=json.loads(P.read_text(encoding='utf-8'))
def vals(mid):
 s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}
assert d.get('methodology',{}).get('version')=='v0-equal-weight-diagnostic'
weights=d['methodology']['weights']; assert abs(sum(weights.values())-1)<1e-9 and set(weights.values())=={0.2}
if d.get('status')=='derived_pending_refresh':
 assert all(not x.get('observations') for x in d['series']); print('{"status":"pending"}'); raise SystemExit
assert d.get('status')=='derived_equal_weight_v0'
years=[str(y) for y in range(2015,2023)]
components=[x for x in d['methodology']['components']]; data={m:vals(m) for m in components}; score=vals('labor_capacity_stress_equal_weight')
for m,v in data.items(): assert list(v)==years and abs(v['2015']-100)<=0.11,(m,v['2015'])
assert list(score)==years and abs(score['2015']-100)<=0.11
for y in years:
 expected=round(sum(data[m][y] for m in components)/5,1); assert abs(score[y]-expected)<=0.11,(y,score[y],expected)
print(json.dumps({'status':'success','score_2015':score['2015'],'score_2022':score['2022']},ensure_ascii=False))
