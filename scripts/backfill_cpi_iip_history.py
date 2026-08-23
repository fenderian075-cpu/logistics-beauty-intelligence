#!/usr/bin/env python3
"""Harden CPI and IIP long-history backfill using official e-Stat downloads.

CPI long-history CSVs place metrics in columns and may split year/month across
separate cells. IIP is fetched from e-Stat because METI blocks GitHub-hosted
requests with HTTP 403. No values are synthesized.
"""
from __future__ import annotations

import csv, io, json, re
from pathlib import Path
import requests
from openpyxl import load_workbook

from backfill_official_economy_history import (
    ROOT, UA, CPI_LABELS, IIP_LABELS, extract_e_stat_csv_links, decode_bytes,
    number, period_token, upsert_series, yoy, load_json, save_json, now_iso,
)

IIP_ESTAT_CURRENT = "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040172363"
IIP_METI_CONNECTED = "https://www.meti.go.jp/statistics/tyo/iip/result/xls/b2020_sgs1j.xlsx"


def norm(v):
    return re.sub(r"\s+", "", str(v or "")).replace("　", "")


def metric_match(value, targets):
    t = norm(value)
    for mid, aliases in targets.items():
        if t in {norm(a) for a in aliases}:
            return mid
    return None


def row_period(row, carried_year=None):
    """Return YYYY-MM and updated year from common e-Stat CSV row formats."""
    cells = [str(x or "").strip() for x in row[:8]]
    # A complete date in one cell.
    for cell in cells:
        p = period_token(cell)
        if p and "-" in p:
            return p, int(p[:4])
        m = re.search(r"((?:19|20)\d{2})\D*?(1[0-2]|0?[1-9])\s*月?", cell)
        if m:
            return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}", int(m.group(1))
    # Separate year/month columns; year may only appear on the first row of a block.
    year = carried_year
    month = None
    for cell in cells[:4]:
        ym = re.fullmatch(r"\s*((?:19|20)\d{2})\s*年?\s*", cell)
        if ym:
            year = int(ym.group(1)); continue
        mm = re.fullmatch(r"\s*(1[0-2]|0?[1-9])\s*月\s*", cell)
        if mm:
            month = int(mm.group(1)); continue
    # Pure numeric year/month in first columns.
    nums = [number(x) for x in cells[:4]]
    if year is None:
        for v in nums:
            if v is not None and 1970 <= v <= 2100:
                year = int(v); break
    if month is None:
        for v in nums:
            if v is not None and 1 <= v <= 12 and (year is None or int(v) != year):
                month = int(v); break
    return (f"{year:04d}-{month:02d}" if year and month else None), year


def parse_cpi_csv(blob, targets):
    rows = list(csv.reader(io.StringIO(decode_bytes(blob))))
    best = {}
    for hi, header in enumerate(rows[:30]):
        cols = {mid:c for c,cell in enumerate(header) if (mid := metric_match(cell, targets))}
        if not cols:
            continue
        candidate = {mid:[] for mid in cols}
        year = None
        for row in rows[hi+1:]:
            p, year = row_period(row, year)
            if not p:
                continue
            for mid,c in cols.items():
                if c >= len(row): continue
                v = number(row[c])
                if v is not None and 20 <= v <= 500:
                    candidate[mid].append({"period":p,"value":round(v,3),"status":"official","source":"総務省統計局/e-Stat"})
        score=sum(len(x) for x in candidate.values())
        if score > sum(len(x) for x in best.values()): best=candidate
    out={}
    for mid,obs in best.items():
        by={r["period"]:r for r in obs}; clean=[by[p] for p in sorted(by)]
        if len(clean)>=24: out[mid]=clean
    return out


def collect_cpi():
    middle_url,item_url=extract_e_stat_csv_links(); s=requests.Session(); s.headers.update(UA)
    mr=s.get(middle_url,timeout=90); mr.raise_for_status(); ir=s.get(item_url,timeout=90); ir.raise_for_status()
    middle=parse_cpi_csv(mr.content,{k:v for k,v in CPI_LABELS.items() if k!="cpi_cosmetics"})
    item=parse_cpi_csv(ir.content,{"cpi_cosmetics":CPI_LABELS["cpi_cosmetics"]})
    if len(middle)<8:
        # Useful diagnostic without dumping the complete government file.
        sample=" | ".join(decode_bytes(mr.content).splitlines()[:12])[:5000]
        raise RuntimeError(f"CPI parser produced {len(middle)} middle series; first_rows={sample}")
    parsed={**middle,**item}; data=load_json("data/economy/prices.json")
    names={x.get("metric_id"):x.get("name_ja") for x in data.get("series",[])}
    for mid,obs in parsed.items():
        yoy(obs); upsert_series(data,mid,name_ja=names.get(mid) or mid,unit="2020=100",observations=obs,basis="national_monthly")
    data["historical_backfill_at"]=now_iso(); save_json("data/economy/prices.json",data)
    return {"status":"success","series":{k:len(v) for k,v in parsed.items()},"middle_url":middle_url,"item_url":item_url}


def iip_metric(cells):
    joined="|".join(norm(x) for x in cells)
    if "在庫率" in joined:return "industrial_inventory_ratio"
    if "在庫" in joined:return "industrial_inventories"
    if "出荷" in joined:return "manufacturing_shipments"
    if "生産" in joined and "予測" not in joined and "能力" not in joined:return "industrial_production"
    return None


def excel_period(row, carried_year=None):
    p,year=row_period(row,carried_year)
    if p:return p,year
    # Excel datetime objects stringify as YYYY-MM-DD and are caught by period_token.
    for x in row[:10]:
        pp=period_token(x)
        if pp and "-" in pp:return pp,int(pp[:4])
    return None,year


def parse_iip_excel(blob):
    wb=load_workbook(io.BytesIO(blob),read_only=True,data_only=True); best={}
    for ws in wb.worksheets:
        rows=[tuple(r) for r in ws.iter_rows(values_only=True)]
        # Most IIP tables have multi-row headers. Build a column label from first 20 rows.
        ncols=max((len(r) for r in rows),default=0)
        cols={}
        for c in range(ncols):
            label=[rows[r][c] if c<len(rows[r]) else None for r in range(min(25,len(rows)))]
            mid=iip_metric(label)
            if mid: cols[mid]=c
        candidate={mid:[] for mid in cols}; year=None
        for row in rows:
            p,year=excel_period(row,year)
            if not p:continue
            for mid,c in cols.items():
                if c>=len(row):continue
                v=number(row[c])
                if v is not None and 10<=v<=500:
                    candidate[mid].append({"period":p,"value":round(v,2),"status":"official","source":"経済産業省/e-Stat 鉱工業指数"})
        if sum(len(x) for x in candidate.values())>sum(len(x) for x in best.values()):best=candidate
    wb.close(); out={}
    for mid,obs in best.items():
        by={r["period"]:r for r in obs}; clean=[by[p] for p in sorted(by)]
        if len(clean)>=48:out[mid]=clean
    return out


def collect_iip():
    headers={**UA,"Referer":"https://www.e-stat.go.jp/"}
    r=requests.get(IIP_ESTAT_CURRENT,headers=headers,timeout=90);r.raise_for_status()
    if not r.content.startswith(b"PK"):raise RuntimeError(f"e-Stat IIP download is not XLSX: {r.content[:80]!r}")
    parsed=parse_iip_excel(r.content)
    if len(parsed)<3:
        raise RuntimeError(f"IIP e-Stat parser produced { {k:len(v) for k,v in parsed.items()} }")
    data=load_json("data/economy/macro.json"); names={
      "industrial_production":"鉱工業生産指数","manufacturing_shipments":"製造工業出荷指数",
      "industrial_inventories":"鉱工業在庫指数","industrial_inventory_ratio":"鉱工業在庫率指数"}
    for mid,obs in parsed.items():
        yoy(obs);upsert_series(data,mid,name_ja=names[mid],unit="2020=100",observations=obs,basis="seasonally_adjusted_monthly")
    data["historical_backfill_at"]=now_iso();save_json("data/economy/macro.json",data)
    return {"status":"success","series":{k:len(v) for k,v in parsed.items()},"current_source":IIP_ESTAT_CURRENT,
            "current_official_start":"2018-01","connected_official_target":"1978-01","connected_status":"METI direct download blocked from GitHub Actions; separate official route pending"}


def safe_coverage(stages):
    series=[]
    skip={"historical-coverage.json","historical-backfill-status.json"}
    for path in sorted((ROOT/"data/economy").glob("*.json")):
        if path.name in skip:continue
        try:d=json.loads(path.read_text(encoding="utf-8"))
        except Exception:continue
        for s in d.get("series",[]):
            obs=s.get("observations",[])
            if not isinstance(obs,list):continue
            periods=sorted(str(o.get("period")) for o in obs if isinstance(o,dict) and o.get("period") is not None)
            series.append({"file":str(path.relative_to(ROOT)),"dataset":d.get("dataset"),"metric_id":s.get("metric_id"),"name_ja":s.get("name_ja"),"unit":s.get("unit"),"observations":len(periods),"start":periods[0] if periods else None,"end":periods[-1] if periods else None})
    return {"schema_version":"1.0","dataset":"historical-coverage","updated_at":now_iso(),"stages":stages,"series":series}


def main():
    p=ROOT/"data/economy/historical-backfill-status.json";status=json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"schema_version":"1.0","dataset":"historical-backfill-status","stages":{}}
    for name,func in (("cpi",collect_cpi),("iip",collect_iip)):
        try:result=func();status.setdefault("stages",{})[name]=result;print(name,"OK",json.dumps(result,ensure_ascii=False))
        except Exception as exc:status.setdefault("stages",{})[name]={"status":"error","error":f"{type(exc).__name__}: {exc}"};print(name,"ERROR",status["stages"][name]["error"])
    status["updated_at"]=now_iso();status["status"]="success" if all(v.get("status") in {"success","delegated"} for v in status.get("stages",{}).values()) else "partial"
    save_json("data/economy/historical-backfill-status.json",status);save_json("data/economy/historical-coverage.json",safe_coverage(status.get("stages",{})))
    print(json.dumps(status,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
