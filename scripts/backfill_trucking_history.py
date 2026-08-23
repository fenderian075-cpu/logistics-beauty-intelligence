#!/usr/bin/env python3
"""Backfill Japan commercial-truck tonnes and tonne-km from MLIT/e-Stat.

The monthly survey publishes rolling summary workbooks 2-1 and 2-2. January
snapshots contain the preceding calendar year's monthly observations, so one
January page per year reconstructs the monthly history efficiently.

MLIT notes that pre-April-2020 values in these trend tables were retrospectively
adjusted with connection coefficients after the survey-method change. We retain
those official connected values as published; no interpolation is performed.
"""
from __future__ import annotations

import io,json,re
from datetime import datetime,timezone,timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/economy/trucking.json'
STATUS=ROOT/'data/economy/trucking-history-status.json'
BASE='https://www.e-stat.go.jp'
JAN_LIST='https://www.e-stat.go.jp/stat-search/files?cycle=1&kikan=00600&layout=datalist&month=11010301&page=1&result_page=1&second2=1&tclass1val=0&toukei=00600330&tstat=000001017236&year={year}0'
H={'User-Agent':'Mozilla/5.0 LBI-Trucking-History/1.0','Referer':'https://www.e-stat.go.jp/'}
JST=timezone(timedelta(hours=9))

def now():return datetime.now(JST).replace(microsecond=0).isoformat()

def discover(session):
    found={'2-1':{},'2-2':{}}
    for year in range(2016,2027):
        r=session.get(JAN_LIST.format(year=year),timeout=90);r.raise_for_status();soup=BeautifulSoup(r.content,'html.parser')
        # Dataset title links themselves carry stat_infid; their surrounding block identifies 2-1/2-2.
        for a in soup.find_all('a',href=True):
            href=a.get('href','');sid=re.search(r'stat_infid=(\d+)',href)
            if not sid:continue
            node=a
            context=''
            for _ in range(5):
                if node is None:break
                context+=' '+' '.join(node.stripped_strings)
                node=node.parent
            table=None
            if '輸送トンキロの推移' in context or '総括表（２）' in context or '2-2' in context:table='2-2'
            elif '輸送トン数の推移' in context or '総括表（１）' in context or '2-1' in context:table='2-1'
            if table and f'{year:04d}-01' not in found[table]:
                found[table][f'{year:04d}-01']=f'{BASE}/stat-search/file-download?statInfId={sid.group(1)}&fileKind=0'
        print('discover',year,{k:(f'{year:04d}-01' in v) for k,v in found.items()})
    return found

def parse_time_code(v):
    s=str(v or '').strip().replace('.0','')
    m=re.match(r'^(20\d{2})(\d{2})',s)
    if m:
        y,mo=int(m.group(1)),int(m.group(2))
        if 1<=mo<=12:return f'{y:04d}-{mo:02d}'
    return None

def parse_summary(blob,sheet,source_status):
    wb=load_workbook(io.BytesIO(blob),read_only=True,data_only=True);ws=wb[sheet];out=[]
    for row in ws.iter_rows(values_only=True):
        if len(row)<5:continue
        p=parse_time_code(row[1])
        if not p:continue
        try:x=float(row[4])
        except (TypeError,ValueError):continue
        out.append({'period':p,'value':x,'status':source_status,'source':'国土交通省 自動車輸送統計/e-Stat'})
    wb.close();return out

def changes(obs):
    by={r['period']:r['value'] for r in obs}
    for i,r in enumerate(obs):
        if i and obs[i-1]['value']:r['mom']=round((r['value']/obs[i-1]['value']-1)*100,2)
        y,m=map(int,r['period'].split('-'));pv=by.get(f'{y-1:04d}-{m:02d}')
        if pv:r['yoy']=round((r['value']/pv-1)*100,2)

def collect_metric(session,files,sheet):
    merged={};used=[];fail={}
    for snap,url in sorted(files.items()):
        try:
            r=session.get(url,timeout=90);r.raise_for_status()
            if not r.content.startswith(b'PK'):raise RuntimeError('not xlsx')
            rows=parse_summary(r.content,sheet,'official_connected' if snap<'2021-01' else 'official')
            for x in rows:merged[x['period']]=x
            used.append(snap)
        except Exception as e:fail[snap]=f'{type(e).__name__}: {e}'
    rows=[merged[p] for p in sorted(merged)];changes(rows);return rows,used,fail

def upsert(data,mid,name,unit,obs):
    s=next((x for x in data.setdefault('series',[]) if x.get('metric_id')==mid),None)
    if s is None:s={'metric_id':mid};data['series'].append(s)
    s.update({'name_ja':name,'unit':unit,'observations':obs})

def main():
    s=requests.Session();s.headers.update(H);files=discover(s)
    if len(files['2-1'])<9 or len(files['2-2'])<9:raise RuntimeError(f'too few January truck workbooks discovered: { {k:len(v) for k,v in files.items()} }')
    ton,used1,fail1=collect_metric(s,files['2-1'],'2-1');tkm,used2,fail2=collect_metric(s,files['2-2'],'2-2')
    if len(ton)<100 or len(tkm)<100:raise RuntimeError(f'truck history too short tonnes={len(ton)} tonkm={len(tkm)} fail={fail1|fail2}')
    if ton[0]['period']>'2015-01' or tkm[0]['period']>'2015-01':raise RuntimeError(f'truck history starts too late {ton[0]["period"]}/{tkm[0]["period"]}')
    ton_out=[{**r,'value':round(r['value']/1000,3)} for r in ton]
    tkm_out=[{**r,'value':round(r['value']/1000,3)} for r in tkm]
    for rows in (ton_out,tkm_out):
        for r in rows:r.pop('mom',None);r.pop('yoy',None)
        changes(rows)
    data=json.loads(OUT.read_text(encoding='utf-8'))
    upsert(data,'commercial_truck_tonnage','営業用トラック貨物輸送量','million tonnes',ton_out)
    upsert(data,'commercial_truck_ton_km','営業用トラック貨物輸送トンキロ','billion tonne-km',tkm_out)
    data['historical_backfill_at']=now();data['continuity_note']='2020年4月の調査方法変更に伴い、国土交通省公表の推移表は接続係数により2020年3月以前を遡及改訂した系列を使用。'
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    st={'schema_version':'1.0','dataset':'trucking-history-status','updated_at':now(),'status':'success','discovered':{k:len(v) for k,v in files.items()},'snapshots_used':{'tonnes':used1,'ton_km':used2},'failures':{'tonnes':fail1,'ton_km':fail2},'coverage':{'commercial_truck_tonnage':{'observations':len(ton_out),'start':ton_out[0]['period'],'end':ton_out[-1]['period']},'commercial_truck_ton_km':{'observations':len(tkm_out),'start':tkm_out[0]['period'],'end':tkm_out[-1]['period']}}}
    STATUS.write_text(json.dumps(st,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(st,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
