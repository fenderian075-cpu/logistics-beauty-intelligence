#!/usr/bin/env python3
"""Temporary diagnostic for the MLIT 21-company warehouse workbook layout."""
from io import BytesIO
from urllib.parse import urljoin
import re
import requests
from bs4 import BeautifulSoup
import xlrd

PAGE="https://www.mlit.go.jp/seisakutokatsu/freight/seisakutokatsu_freight_mn2_000009.html"
UA={"User-Agent":"Mozilla/5.0 LBI-Warehouse-Diagnostic/1.0"}
html=requests.get(PAGE,headers=UA,timeout=60); html.raise_for_status()
soup=BeautifulSoup(html.text,"html.parser")
links=[]
for a in soup.find_all("a",href=True):
    href=urljoin(PAGE,a["href"])
    if re.search(r"\.xls[x]?(?:$|\?)",href,re.I): links.append((a.get_text(" ",strip=True),href))
print("excel links",len(links))
# Page is newest-to-oldest; inspect first valid workbook.
label,url=links[0]
print("selected",label,url)
blob=requests.get(url,headers=UA,timeout=60); blob.raise_for_status()
book=xlrd.open_workbook(file_contents=blob.content)
print("sheets",book.sheet_names())
keywords=("入庫","出庫","保管残高","普通倉庫","合計","回転率","倉庫利用")
for sname in book.sheet_names():
    ws=book.sheet_by_name(sname)
    hits=[]
    for r in range(ws.nrows):
        vals=[str(ws.cell_value(r,c)).strip() for c in range(ws.ncols)]
        joined=" | ".join(v for v in vals if v)
        if any(k in joined for k in keywords):
            hits.append((r+1,joined[:900]))
    if hits:
        print("SHEET",sname,"rows",ws.nrows,"cols",ws.ncols)
        for r,text in hits[:80]: print(f"R{r}: {text}")
