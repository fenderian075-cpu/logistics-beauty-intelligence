#!/usr/bin/env python3
"""Backfill commercial-truck physical-flow history from MLIT/e-Stat trend tables.

The current official 2-1/2-2 trend workbooks contain connected annual history
(2015 onward) plus recent monthly observations. MLIT retrospectively adjusted
pre-April-2020 values with connection coefficients after the survey-method
change, so these published trend tables are the canonical continuous series.
No interpolation is performed.
"""
from __future__ import annotations

import io,json,re
from datetime import datetime,timezone,timedelta
from pathlib import Path

import requests
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/economy/trucking.json'
STATUS=ROOT/'data/economy/trucking-history-status.json'
H={'User-Agent':'Mozilla/5.0 LBI-Trucking-History/1.0','Referer':'https://www.e-stat.go.jp/'}
JST=timezone(timedelta(hours=9))
SOURCES={
    'tonnes':('https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040488230&fileKind=0','2-1'),
    'ton_km':('https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040488231&fileKind=0','2-2'),
}

def now():return datetime.now(JST).replace(microsecond=0).isoformat()

def number(v):
    if v in (None,''):return None
    s=str(v).strip().replace(',','')
    m=re.match(r'^-?[0-9]+(?:\.[0-9]+)?',s)
    if not m:return None
    try:return float(m.group(0))
    except ValueError:return None

def period(v):
    s=str(v or '').strip().replace('.0','')
    m=re.match(r'^(20\d{2})(\d{2})',s)
    if m and 1<=int(m.group(2))<=12:return f'{m.group(1)}-{int(m.group(2)):02d}'
    return None

def year_token(v):
    x=number(v)
    if x is not None and 2000<=x<=2100 and float(x).is_integer():return str(int(x))
    s=str(v or '').strip()
    m=re.fullmatch(r'(20\d{2})年?',s)
    return m.group(1) if m else None

def parse(blob,sheet_name):
    wb=load_workbook(io.BytesIO(blob),read_only=True,data_only=True)
    ws=wb[sheet_name] if sheet_name in wb.sheetnames else wb[wb.sheetnames[0]]
    annual=[];monthly=[]
    for row in ws.iter_rows(values_only=True):
        if len(row)<5:continue
        v=number(row[4])
        if v is None:continue
        p=period(row[1])
        if p:
            monthly.append({'period':p,'value':v,'status':'official','source':'国土交通省 自動車輸送統計/e-Stat'})
            continue
        y=year_token(row[1])
        if y and 2015<=int(y)<=2100:
            annual.append({'period':y,'value':v,'status':'official_connected','source':'国土交通省 自動車輸送統計/e-Stat'})
    wb.close()
    annual={r['period']:r for r in annual};monthly={r['period']:r for r in monthly}
    return [annual[p] for p in sorted(annual)],[monthly[p] for p in sorted(monthly)]

def changes(obs,monthly=False):
    by={r['period']:r['value'] for r in obs}
    for i,r in enumerate(obs):
        if monthly and i and obs[i-1]['value']:
            r['mom']=round((r['value']/obs[i-1]['value']-1)*100,2)
        if monthly:
            y,m=map(int,r['period'].split('-'));prev=by.get(f'{y-1:04d}-{m:02d}')
        else:
            prev=by.get(str(int(r['period'])-1))
        if prev:r['yoy']=round((r['value']/prev-1)*100,2)

def upsert(data,mid,name,unit,obs):
    s=next((x for x in data.setdefault('series',[]) if x.get('metric_id')==mid),None)
    if s is None:s={'metric_id':mid};data['series'].append(s)
    s.update({'name_ja':name,'unit':unit,'observations':obs})

def scaled(rows,divisor):
    return [{**r,'value':round(r['value']/divisor,3)} for r in rows]

def main():
    sess=requests.Session();sess.headers.update(H);parsed={}
    for key,(url,sheet) in SOURCES.items():
        r=sess.get(url,timeout=90);r.raise_for_status()
        if not r.content.startswith(b'PK'):raise RuntimeError(f'{key}: official workbook is not XLSX')
        parsed[key]=parse(r.content,sheet)

    ton_a,ton_m=parsed['tonnes'];tkm_a,tkm_m=parsed['ton_km']
    if len(ton_a)<10 or len(tkm_a)<10 or ton_a[0]['period']>'2015' or tkm_a[0]['period']>'2015':
        raise RuntimeError(f'annual truck history too short: tonnes={len(ton_a)} {ton_a[:1]}, tkm={len(tkm_a)} {tkm_a[:1]}')
    if len(ton_m)<12 or len(tkm_m)<12:
        raise RuntimeError(f'monthly truck history too short: tonnes={len(ton_m)}, tkm={len(tkm_m)}')

    # 2-1 workbook unit: thousand tonnes -> LBI million tonnes.
    # 2-2 workbook unit: million tonne-km -> LBI billion tonne-km.
    ton_a=scaled(ton_a,1000);ton_m=scaled(ton_m,1000)
    tkm_a=scaled(tkm_a,1000);tkm_m=scaled(tkm_m,1000)
    for rows,is_monthly in ((ton_a,False),(ton_m,True),(tkm_a,False),(tkm_m,True)):changes(rows,is_monthly)

    data=json.loads(OUT.read_text(encoding='utf-8'))
    upsert(data,'commercial_truck_tonnage','営業用トラック貨物輸送量（月次）','million tonnes',ton_m)
    upsert(data,'commercial_truck_ton_km','営業用トラック貨物輸送トンキロ（月次）','billion tonne-km',tkm_m)
    upsert(data,'commercial_truck_tonnage_annual','営業用トラック貨物輸送量（年次）','million tonnes',ton_a)
    upsert(data,'commercial_truck_ton_km_annual','営業用トラック貨物輸送トンキロ（年次）','billion tonne-km',tkm_a)
    data['historical_backfill_at']=now()
    data['continuity_note']='2020年4月の調査方法変更に伴い、国土交通省公表の推移表は接続係数により2020年3月以前を遡及改訂した系列を使用。'
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    cov={
      'commercial_truck_tonnage_annual':{'observations':len(ton_a),'start':ton_a[0]['period'],'end':ton_a[-1]['period']},
      'commercial_truck_ton_km_annual':{'observations':len(tkm_a),'start':tkm_a[0]['period'],'end':tkm_a[-1]['period']},
      'commercial_truck_tonnage':{'observations':len(ton_m),'start':ton_m[0]['period'],'end':ton_m[-1]['period']},
      'commercial_truck_ton_km':{'observations':len(tkm_m),'start':tkm_m[0]['period'],'end':tkm_m[-1]['period']},
    }
    st={'schema_version':'1.0','dataset':'trucking-history-status','updated_at':now(),'status':'success','sources':{k:v[0] for k,v in SOURCES.items()},'coverage':cov}
    STATUS.write_text(json.dumps(st,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(st,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
