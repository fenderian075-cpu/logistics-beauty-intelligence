#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
H={'User-Agent':'Mozilla/5.0 LBI-Transport-History/1.0','Referer':'https://www.e-stat.go.jp/'}
LISTS={
 'port':'https://www.e-stat.go.jp/stat-search/files?cycle=0&layout=dataset&page=1&tclass1val=0&toukei=00600280&tstat=000001135203',
 'truck':'https://www.e-stat.go.jp/stat-search/files?cycle=1&layout=dataset&page=1&tclass1val=0&toukei=00600330&tstat=000001017236',
 'air':'https://www.e-stat.go.jp/stat-search/files?cycle=1&layout=dataset&page=1&tclass1val=0&toukei=00600360',
}
for key,url in LISTS.items():
    r=requests.get(url,headers=H,timeout=90);print('\nLIST',key,r.status_code,len(r.content),r.url);r.raise_for_status()
    soup=BeautifulSoup(r.content,'html.parser')
    seen=set()
    for a in soup.find_all('a',href=True):
        txt=' '.join(a.stripped_strings);href=a['href']
        parent=' '.join(a.parent.stripped_strings) if a.parent else txt
        context=(txt+' '+parent)
        if key=='port' and not ('港別集計値' in context or 'stat_infid' in href or 'file-download' in href):continue
        if key=='truck' and not ('貨物輸送量' in context or '３－１' in context or '3-1' in context or 'stat_infid' in href or 'file-download' in href):continue
        if key=='air' and not ('航空' in context or '国際' in context or 'stat_infid' in href or 'file-download' in href):continue
        pair=(txt,href,parent[:300])
        if pair in seen:continue
        seen.add(pair);print('LINK',repr(pair))
    print('TOTAL LINKS',len(seen))
