#!/usr/bin/env python3
"""Build a transparent equal-weight diagnostic Logistics Labor Capacity Stress index."""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ECON=ROOT/'data/economy'

def read(n): return json.loads((ECON/n).read_text(encoding='utf-8'))
def s(data,mid): return next(x for x in data['series'] if x['metric_id']==mid)
def vals(data,mid): return {str(o['period']):float(o['value']) for o in s(data,mid).get('observations',[])}
def rows(v,source): return [{'period':y,'value':round(x,1),'status':'derived','source':source} for y,x in v.items()]

def main():
    cap=read('logistics-capacity.json'); labor=read('logistics-labor-market.json'); age=read('logistics-workforce-age.json'); demo=read('japan-demography.json'); out=read('labor-capacity-stress.json')
    load=vals(cap,'parcel_load_index_2015'); vacancy=vals(labor,'automobile_driver_job_openings_ratio_history'); old=vals(age,'road_freight_age_55_plus_share'); repl=vals(age,'road_freight_replacement_ratio'); work=vals(demo,'working_age_population_15_64')
    years=[str(y) for y in range(2015,2023)]
    for name,v in [('load',load),('vacancy',vacancy),('old',old),('replacement',repl),('working_age',work)]:
        missing=[y for y in years if y not in v]
        if missing: raise RuntimeError(f'{name} missing {missing}')
    base_vac=vacancy['2015']; base_old=old['2015']; base_repl=repl['2015']; base_work=work['2015']
    components={
      'parcel_labor_load_index':{y:load[y] for y in years},
      'vacancy_pressure_index':{y:vacancy[y]/base_vac*100 for y in years},
      'road_freight_aging_pressure_index':{y:old[y]/base_old*100 for y in years},
      'road_freight_replacement_pressure_index':{y:base_repl/repl[y]*100 for y in years},
      'working_age_supply_pressure_index':{y:base_work/work[y]*100 for y in years},
    }
    for mid,v in components.items(): s(out,mid)['observations']=rows(v,'LBI transparent normalization; 2015=100')
    score={y:sum(components[mid][y] for mid in components)/len(components) for y in years}
    s(out,'labor_capacity_stress_equal_weight')['observations']=rows(score,'Arithmetic mean of five disclosed 2015=100 pressure components')
    out['status']='derived_equal_weight_v0'; out['latest_common_year']=years[-1]
    (ECON/'labor-capacity-stress.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':out['status'],'score_2015':round(score['2015'],1),'score_2022':round(score['2022'],1),'components_2022':{k:round(v['2022'],1) for k,v in components.items()}},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
