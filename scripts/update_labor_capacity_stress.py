#!/usr/bin/env python3
"""Build transparent Logistics Labor Capacity Stress diagnostics (v0 and v1)."""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ECON=ROOT/'data/economy'

def read(n): return json.loads((ECON/n).read_text(encoding='utf-8'))
def s(data,mid): return next(x for x in data['series'] if x['metric_id']==mid)
def vals(data,mid): return {str(o['period']):float(o['value']) for o in s(data,mid).get('observations',[])}
def rows(v,source): return [{'period':y,'value':round(x,1),'status':'derived','source':source} for y,x in v.items()]
def require(name,v,years):
    missing=[y for y in years if y not in v]
    if missing: raise RuntimeError(f'{name} missing {missing}')

def main():
    cap=read('logistics-capacity.json'); labor=read('logistics-labor-market.json'); freight_vac=read('freight-driver-vacancy-history.json')
    age=read('logistics-workforce-age.json'); demo=read('japan-demography.json')
    out0=read('labor-capacity-stress.json'); out1=read('labor-capacity-stress-v1.json')
    load=vals(cap,'parcel_load_index_2015'); vacancy0=vals(labor,'automobile_driver_job_openings_ratio_history'); vacancy1=vals(freight_vac,'freight_driver_job_openings_ratio')
    old=vals(age,'road_freight_age_55_plus_share'); repl=vals(age,'road_freight_replacement_ratio'); work=vals(demo,'working_age_population_15_64')

    # v0: longer history, broader automobile-driver vacancy definition.
    years0=[str(y) for y in range(2015,2023)]
    for name,v in [('load',load),('vacancy0',vacancy0),('old',old),('replacement',repl),('working_age',work)]: require(name,v,years0)
    base_vac=vacancy0['2015']; base_old=old['2015']; base_repl=repl['2015']; base_work=work['2015']
    components0={
      'parcel_labor_load_index':{y:load[y] for y in years0},
      'vacancy_pressure_index':{y:vacancy0[y]/base_vac*100 for y in years0},
      'road_freight_aging_pressure_index':{y:old[y]/base_old*100 for y in years0},
      'road_freight_replacement_pressure_index':{y:base_repl/repl[y]*100 for y in years0},
      'working_age_supply_pressure_index':{y:base_work/work[y]*100 for y in years0},
    }
    for mid,v in components0.items(): s(out0,mid)['observations']=rows(v,'LBI transparent normalization; 2015=100')
    score0={y:sum(components0[mid][y] for mid in components0)/len(components0) for y in years0}
    s(out0,'labor_capacity_stress_equal_weight')['observations']=rows(score0,'Arithmetic mean of five disclosed 2015=100 pressure components')
    out0['status']='derived_equal_weight_v0'; out0['latest_common_year']=years0[-1]
    (ECON/'labor-capacity-stress.json').write_text(json.dumps(out0,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    # v1: freight-driver-specific vacancy definition, now verified through 2024.
    years1=[str(y) for y in range(2018,2025)]
    for name,v in [('load',load),('freight_vacancy',vacancy1),('old',old),('replacement',repl),('working_age',work)]: require(name,v,years1)
    base_load=load['2018']; base_vac1=vacancy1['2018']; base_old1=old['2018']; base_repl1=repl['2018']; base_work1=work['2018']
    components1={
      'parcel_labor_load_pressure_v1':{y:load[y]/base_load*100 for y in years1},
      'freight_driver_vacancy_pressure_v1':{y:vacancy1[y]/base_vac1*100 for y in years1},
      'road_freight_aging_pressure_v1':{y:old[y]/base_old1*100 for y in years1},
      'road_freight_replacement_pressure_v1':{y:base_repl1/repl[y]*100 for y in years1},
      'working_age_supply_pressure_v1':{y:base_work1/work[y]*100 for y in years1},
    }
    for mid,v in components1.items(): s(out1,mid)['observations']=rows(v,'LBI transparent normalization; 2018=100')
    score1={y:sum(components1[mid][y] for mid in components1)/len(components1) for y in years1}
    s(out1,'labor_capacity_stress_v1')['observations']=rows(score1,'Arithmetic mean of five disclosed 2018=100 pressure components')
    out1['status']='derived_freight_specific_equal_weight_v1'; out1['latest_common_year']=years1[-1]
    (ECON/'labor-capacity-stress-v1.json').write_text(json.dumps(out1,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    print(json.dumps({
      'v0':{'status':out0['status'],'latest_year':years0[-1],'latest_score':round(score0[years0[-1]],1)},
      'v1':{'status':out1['status'],'latest_year':years1[-1],'latest_score':round(score1[years1[-1]],1),'components':{k:round(v[years1[-1]],1) for k,v in components1.items()}}
    },ensure_ascii=False,indent=2))
if __name__=='__main__': main()
