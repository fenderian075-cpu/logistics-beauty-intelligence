#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'data/economy'

def load(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
def vals(d,mid):
 s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}

def validate(d,version,status,years,score_id,base_year):
 assert d.get('methodology',{}).get('version')==version
 weights=d['methodology']['weights']; assert abs(sum(weights.values())-1)<1e-9 and set(weights.values())=={0.2}
 assert d.get('status')==status
 components=list(d['methodology']['components']); data={m:vals(d,m) for m in components}; score=vals(d,score_id)
 for m,v in data.items():
  assert list(v)==years,(m,list(v)); assert abs(v[base_year]-100)<=0.11,(m,v[base_year])
 assert list(score)==years and abs(score[base_year]-100)<=0.11
 for y in years:
  expected=round(sum(data[m][y] for m in components)/5,1); assert abs(score[y]-expected)<=0.11,(y,score[y],expected)
 return components,data,score

v0=load('labor-capacity-stress.json'); v1=load('labor-capacity-stress-v1.json')
_,_,score0=validate(v0,'v0-equal-weight-diagnostic','derived_equal_weight_v0',[str(y) for y in range(2015,2023)],'labor_capacity_stress_equal_weight','2015')
components1,data1,score1=validate(v1,'v1-freight-specific-vacancy','derived_freight_specific_equal_weight_v1',[str(y) for y in range(2018,2024)],'labor_capacity_stress_v1','2018')
assert v1.get('latest_common_year')=='2023'
assert 'freight_driver_vacancy_pressure_v1' in components1
print(json.dumps({'status':'success','v0_2022':score0['2022'],'v1_2018':score1['2018'],'v1_2023':score1['2023'],'v1_components_2023':{m:data1[m]['2023'] for m in components1}},ensure_ascii=False))
