#!/usr/bin/env python3
import io,requests
from openpyxl import load_workbook
H={'User-Agent':'Mozilla/5.0 LBI-Transport-History/1.0','Referer':'https://www.e-stat.go.jp/'}
URLS={
 'truck_tonnes_trend':'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040488230&fileKind=0',
 'truck_tonkm_trend':'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040488231&fileKind=0',
 'truck_3_1_view':'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040488234&fileKind=4',
 'air_latest':'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040482050&fileKind=0',
}
for name,url in URLS.items():
    r=requests.get(url,headers=H,timeout=90);print('\n===',name,r.status_code,len(r.content),r.headers.get('content-type'))
    if r.status_code!=200 or not r.content.startswith(b'PK'):
        print(repr(r.content[:200]));continue
    wb=load_workbook(io.BytesIO(r.content),read_only=True,data_only=True);print('sheets',wb.sheetnames)
    for ws in wb.worksheets[:5]:
        print('SHEET',ws.title,'rows',ws.max_row,'cols',ws.max_column)
        non=[]
        for i,row in enumerate(ws.iter_rows(values_only=True)):
            vals=tuple(row[:30])
            if any(v not in (None,'') for v in vals): non.append((i+1,vals))
        for x in non[:45]:print(x[0],repr(x[1]))
        print('TAIL')
        for x in non[-20:]:print(x[0],repr(x[1]))
    wb.close()
