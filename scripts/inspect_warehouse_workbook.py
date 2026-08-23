#!/usr/bin/env python3
"""Temporary diagnostic for the MLIT 21-company warehouse workbook layout."""
from io import BytesIO
from urllib.parse import urljoin
import re
import requests
from bs4 import BeautifulSoup
import xlrd
from openpyxl import load_workbook

PAGE="https://www.mlit.go.jp/seisakutokatsu/freight/seisakutokatsu_freight_mn2_000009.html"
UA={"User-Agent":"Mozilla/5.0 LBI-Warehouse-Diagnostic/1.0"}
html=requests.get(PAGE,headers=UA,timeout=60); html.raise_for_status()
soup=BeautifulSoup(html.text,"html.parser")
links=[]
for a in soup.find_all("a",href=True):
    href=urljoin(PAGE,a["href"])
    if re.search(r"\.xls[x]?(?:$|\?)",href,re.I): links.append((a.get_text(" ",strip=True),href))
print("excel links",len(links))
label,url=links[0]
print("selected",label,url)
blob=requests.get(url,headers=UA,timeout=60); blob.raise_for_status()
keywords=("入庫","出庫","保管残高","普通倉庫","合計","回転率","倉庫利用")

if url.lower().split("?")[0].endswith(".xlsx"):
    book=load_workbook(BytesIO(blob.content),data_only=True,read_only=True)
    print("sheets",book.sheetnames)
    for sname in book.sheetnames:
        ws=book[sname]
        hits=[]
        for r_idx,row in enumerate(ws.iter_rows(values_only=True),1):
            vals=[str(v).strip() for v in row if v not in (None,"")]
            joined=" | ".join(vals)
            if any(k in joined for k in keywords): hits.append((r_idx,joined[:1200]))
        if hits:
            print("SHEET",sname,"rows",ws.max_row,"cols",ws.max_column)
            for r,text in hits[:100]: print(f"R{r}: {text}")
else:
    book=xlrd.open_workbook(file_contents=blob.content)
    print("sheets",book.sheet_names())
    for sname in book.sheet_names():
        ws=book.sheet_by_name(sname)
        hits=[]
        for r in range(ws.nrows):
            vals=[str(ws.cell_value(r,c)).strip() for c in range(ws.ncols)]
            joined=" | ".join(v for v in vals if v)
            if any(k in joined for k in keywords): hits.append((r+1,joined[:1200]))
        if hits:
            print("SHEET",sname,"rows",ws.nrows,"cols",ws.ncols)
            for r,text in hits[:100]: print(f"R{r}: {text}")
