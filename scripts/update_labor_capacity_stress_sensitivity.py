#!/usr/bin/env python3
"""Derive transparent leave-one-component-out sensitivity for Stress v1."""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ECON=ROOT/'data/economy'
V1=ECON/'labor-capacity-stress-v1.json'; OUT=ECON/'labor-capacity-stress-sensitivity.json'
MAP={
 'parcel_labor_load_pressure_v1':'stress_without_parcel_load',
 'freight_driver_vacancy_pressure_v1':'stress_without_freight_vacancy',
 'road_freight_aging_pressure_v1':'stress_without_aging',
 'road_freight_replacement_pressure_v1':'stress_without_replacement',
 'working_age_supply_pressure_v1':'stress_without_working_age',
}
def vals(d,mid):
 s=next(x for x in d['series'] if x['metric_id']==mid); return {str(o['period']):float(o['value']) for o in s.get('observations',[])}
def setser(d,mid,v,source):
 s=next(x for x in d['series'] if x['metric_id']==mid); s['observations']=[{'period':y,'value':round(x,1),'status':'derived','source':source} for y,x in v.items()]
def main():
 v1=json.loads(V1.read_text(encoding='utf-8')); out=json.loads(OUT.read_text(encoding='utf-8'))
 components={mid:vals(v1,mid) for mid in MAP}; years=list(next(iter(components.values())))
 if not years or any(list(v)!=years for v in components.values()): raise RuntimeError('v1 components are not time-aligned')
 loo={}
 for excluded,target in MAP.items():
  remaining=[m for m in MAP if m!=excluded]
  values={y:sum(components[m][y] for m in remaining)/len(remaining) for y in years}
  loo[target]=values; setser(out,target,values,f'LBI leave-one-out: excluded {excluded}; remaining four equal 25%')
 mins={y:min(loo[mid][y] for mid in loo) for y in years}; maxs={y:max(loo[mid][y] for mid in loo) for y in years}; ranges={y:maxs[y]-mins[y] for y in years}
 setser(out,'stress_leave_one_out_min',mins,'Minimum of five leave-one-out variants')
 setser(out,'stress_leave_one_out_max',maxs,'Maximum of five leave-one-out variants')
 setser(out,'stress_leave_one_out_range',ranges,'Max minus min of five leave-one-out variants')
 out['status']='derived_leave_one_out'; out['latest_common_year']=years[-1]
 OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 y=years[-1]
 print(json.dumps({'status':out['status'],'latest_year':y,'leave_one_out':{mid:round(v[y],1) for mid,v in loo.items()},'min':round(mins[y],1),'max':round(maxs[y],1),'range':round(ranges[y],1)},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
