#!/usr/bin/env python3
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/economy/road-freight-driver-capacity.json'
d=json.loads(P.read_text(encoding='utf-8'))
def vals(mid):
 s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}
if d.get('status')=='schema_ready':
 assert all(not s.get('observations') for s in d['series']); print('{"status":"pending"}'); raise SystemExit
assert d.get('status')=='populated_from_estat_api'
w=vals('road_freight_transport_machine_workers'); m=vals('road_freight_transport_machine_male'); f=vals('road_freight_transport_machine_female'); sh=vals('road_freight_transport_machine_share'); fs=vals('road_freight_transport_machine_female_share'); vpw=vals('commercial_truck_vehicles_per_transport_machine_worker')
assert len(w)>=10 and min(w)<='2010' and max(w)>='2023'
# Published LFS/JTA cross-checks, unit = ten-thousand persons. Allow LFS rounding/revision tolerance.
for y,expected in {'2015':80,'2018':86,'2022':86}.items():
 assert y in w and abs(w[y]-expected)<=3,(y,w[y],expected)
for y in set(m)&set(f)&set(w): assert abs((m[y]+f[y])-w[y])<=2.1,(y,m[y],f[y],w[y])
for y in sh: assert 30<sh[y]<70
for y in fs: assert 0<=fs[y]<20
for y in vpw: assert 0.5<vpw[y]<5
latest=max(w)
print(json.dumps({'status':'success','coverage':[min(w),latest],'latest_workers_10k':w[latest],'latest_worker_share_pct':sh.get(latest),'latest_female_share_pct':fs.get(latest),'vehicles_per_worker_latest':vpw.get(max(vpw))},ensure_ascii=False))
