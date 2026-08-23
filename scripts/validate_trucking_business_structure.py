#!/usr/bin/env python3
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/economy/trucking-business-structure.json'
d=json.loads(P.read_text(encoding='utf-8'))
def vals(mid):
 s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}
if d.get('status')=='schema_ready':
 assert all(not s.get('observations') for s in d['series']); print('{"status":"pending"}'); raise SystemExit
assert d.get('status')=='populated_post2020_official_api'
years=[str(y) for y in range(2020,2025)]
ct=vals('commercial_tonnage_post2020'); ot=vals('own_account_tonnage_post2020'); cs=vals('commercial_tonnage_share_post2020'); ck=vals('commercial_ton_km_post2020'); ok=vals('own_account_ton_km_post2020'); ks=vals('commercial_ton_km_share_post2020')
for x in (ct,ot,cs,ck,ok,ks): assert list(x)==years
for y in years:
 assert ct[y]>0 and ot[y]>0 and ck[y]>0 and ok[y]>0
 assert abs(cs[y]-round(ct[y]/(ct[y]+ot[y])*100,3))<=0.011
 assert abs(ks[y]-round(ck[y]/(ck[y]+ok[y])*100,3))<=0.011
 assert 50<cs[y]<95 and 70<ks[y]<99
 assert ks[y]>cs[y],(y,cs[y],ks[y])
meta=d.get('resolved_metadata',{}).get('normalization',{}).get('commercial_baseline_error',{})
assert float(meta.get('tonnage',1))<0.03 and float(meta.get('ton_km',1))<0.03
print(json.dumps({'status':'success','coverage':[years[0],years[-1]],'commercial_tonnage_share_2024':cs['2024'],'commercial_ton_km_share_2024':ks['2024'],'own_tonnage_2024':ot['2024'],'own_ton_km_2024':ok['2024']},ensure_ascii=False))
