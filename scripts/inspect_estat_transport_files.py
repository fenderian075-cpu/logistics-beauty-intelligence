#!/usr/bin/env python3
import io
import requests
from openpyxl import load_workbook

URLS={
 'port_2025':'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040251292',
 'port_2020':'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000031917650',
 'truck_recent':'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040390331',
 'truck_older':'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000031894228',
}
H={'User-Agent':'Mozilla/5.0 LBI-Transport-History/1.0','Referer':'https://www.e-stat.go.jp/'}
for name,url in URLS.items():
    r=requests.get(url,headers=H,timeout=90)
    print('\n===',name,r.status_code,len(r.content),r.headers.get('content-type'))
    if r.status_code!=200 or not r.content.startswith(b'PK'):
        print(repr(r.content[:300]));continue
    wb=load_workbook(io.BytesIO(r.content),read_only=True,data_only=True)
    print('sheets',wb.sheetnames)
    for ws in wb.worksheets[:8]:
        print('SHEET',ws.title,'rows',ws.max_row,'cols',ws.max_column)
        for i,row in enumerate(ws.iter_rows(values_only=True)):
            vals=tuple(row[:24])
            if any(v not in (None,'') for v in vals):print(i+1,repr(vals))
            if i>=22:break
    wb.close()
