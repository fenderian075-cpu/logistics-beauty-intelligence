#!/usr/bin/env python3
"""Populate logistics workforce age structure from e-Stat table 2-2-1.

Requires ESTAT_APP_ID. Uses metadata codes rather than workbook column positions.
No interpolation. Occupation-level truck-driver data remains separate.
"""
from __future__ import annotations
import json, os, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'economy'/'logistics-workforce-age.json'
STATS_DATA_ID='0003007108'
INDUSTRIES={'transport_postal':'42','road_freight':'45','warehousing':'48'}
AGES={
    'total':'00','15_19':'02','20_24':'05','25_29':'07','30_34':'08',
    '35_39':'10','40_44':'11','45_49':'13','50_54':'14',
    '55_59':'16','60_64':'17','65_plus':'18'
}
YEARS=[str(y) for y in range(2015,2026)]
API='https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'

def fetch(app_id, industry, sex='0'):
    params={
        'appId':app_id,'statsDataId':STATS_DATA_ID,'cdTab':'01','cdCat01':industry,
        'cdCat02':sex,'cdArea':'00000','cdTimeFrom':'2015000000','cdTimeTo':'2025000000','limit':10000,
    }
    url=API+'?'+urllib.parse.urlencode(params)
    with urllib.request.urlopen(url,timeout=60) as r: data=json.load(r)
    result=data['GET_STATS_DATA']['RESULT']
    if str(result.get('STATUS'))!='0': raise RuntimeError(result)
    values=data['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF']['VALUE']
    if isinstance(values,dict): values=[values]
    out={}
    for row in values:
        age=row.get('@cat03'); time=row.get('@time','')[:4]; raw=row.get('$')
        if age in AGES.values() and time in YEARS and raw not in (None,'','-','…'):
            out[(time,age)]=float(raw)
    return out

def obs(values, codes, source):
    rows=[]
    for y in YEARS:
        parts=[values.get((y,AGES[c])) for c in codes]
        if any(v is None for v in parts): continue
        rows.append({'period':y,'value':round(sum(parts),1),'status':'official_api','source':source})
    return rows

def derived_share(num_rows,total_rows,source):
    n={r['period']:float(r['value']) for r in num_rows}; t={r['period']:float(r['value']) for r in total_rows}; rows=[]
    for y in YEARS:
        if y in n and y in t and t[y]: rows.append({'period':y,'value':round(n[y]/t[y]*100,2),'status':'derived','source':source})
    return rows

def derived_ratio(young_rows,old_rows,source):
    yv={r['period']:float(r['value']) for r in young_rows}; ov={r['period']:float(r['value']) for r in old_rows}; rows=[]
    for y in YEARS:
        if y in yv and y in ov and ov[y]: rows.append({'period':y,'value':round(yv[y]/ov[y],2),'status':'derived','source':source})
    return rows

def set_series(data,mid,rows):
    for s in data['series']:
        if s['metric_id']==mid: s['observations']=rows; return
    raise KeyError(mid)

def main():
    app_id=os.environ.get('ESTAT_APP_ID')
    if not app_id: raise SystemExit('ESTAT_APP_ID is required')
    data=json.loads(OUT.read_text(encoding='utf-8'))
    for key,code in INDUSTRIES.items():
        total=fetch(app_id,code,'0'); female=fetch(app_id,code,'2')
        source=f'e-Stat 労働力調査 2-2-1 statsDataId={STATS_DATA_ID} cat01={code}'
        total_rows=obs(total,['total'],source)
        bands={
            '15_24':obs(total,['15_19','20_24'],source),
            '25_34':obs(total,['25_29','30_34'],source),
            '35_44':obs(total,['35_39','40_44'],source),
            '45_54':obs(total,['45_49','50_54'],source),
            '55_64':obs(total,['55_59','60_64'],source),
            '65_plus':obs(total,['65_plus'],source),
        }
        if key!='transport_postal': set_series(data,f'{key}_employment',total_rows)
        for band,rows in bands.items(): set_series(data,f'{key}_age_{band}',rows)
        older=[]; young=[]
        d55={r['period']:r['value'] for r in bands['55_64']}; d65={r['period']:r['value'] for r in bands['65_plus']}
        d15={r['period']:r['value'] for r in bands['15_24']}; d25={r['period']:r['value'] for r in bands['25_34']}
        for y in YEARS:
            if y in d55 and y in d65: older.append({'period':y,'value':round(d55[y]+d65[y],1),'status':'derived','source':'55-59 + 60-64 + 65+'})
            if y in d15 and y in d25: young.append({'period':y,'value':round(d15[y]+d25[y],1),'status':'derived','source':'15-24 + 25-34'})
        set_series(data,f'{key}_age_55_plus_share',derived_share(older,total_rows,'LBI: 55+ / total'))
        set_series(data,f'{key}_young_share',derived_share(young,total_rows,'LBI: <=34 / total'))
        set_series(data,f'{key}_replacement_ratio',derived_ratio(young,older,'LBI: <=34 / 55+'))
        if key!='transport_postal':
            female_rows=obs(female,['total'],source+' sex=female')
            set_series(data,f'{key}_female_share',derived_share(female_rows,total_rows,'LBI: female / total'))
    data['status']='populated_from_estat_api'
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':data['status'],'years':[YEARS[0],YEARS[-1]],'industries':INDUSTRIES},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
