import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";

const series=(d,id)=>(d?.series||[]).find((s)=>s.metric_id===id);
const points=(s)=>(s?.observations||[]).map((o)=>({x:o.period,y:Number(o.value)})).filter((p)=>Number.isFinite(p.y));
const latest=(s)=>(s?.observations||[]).at(-1)||null;
const jp=(v,d=1)=>Number(v).toLocaleString("ja-JP",{maximumFractionDigits:d});

async function mount(){
  const root=byId("driver-labor-history"); if(!root)return;
  const data=await loadOptionalJSON("data/economy/driver-labor-history.json",{}); clear(root);
  const large=series(data,"large_truck_driver_annual_work_hours");
  const small=series(data,"small_medium_truck_driver_annual_work_hours");
  const all=series(data,"all_industries_annual_work_hours");
  const premium=series(data,"large_truck_work_hours_premium_vs_all");
  if(!large?.observations?.length)return;
  const row=el("div","value-row");
  for(const [label,s] of [["大型トラック 年間労働時間",large],["中小型トラック 年間労働時間",small],["全産業平均",all]]){
    const o=latest(s),item=el("div","value-row__item"); item.appendChild(el("span","value-row__label",label));
    item.appendChild(el("strong","value-row__value",`${jp(o.value,0)}時間/年`)); item.appendChild(el("span","value-row__meta",`${o.period} · 賃金構造基本統計調査`)); row.appendChild(item);
  }
  const po=latest(premium),pitem=el("div","value-row__item"); pitem.appendChild(el("span","value-row__label","大型トラック 全産業比")); pitem.appendChild(el("strong","value-row__value",`+${jp(po.value,1)}%`)); pitem.appendChild(el("span","value-row__meta",`${po.period} · 労働時間プレミアム`)); row.appendChild(pitem); root.appendChild(row);
  const c=chart({kind:"line",unitLabel:"時間/年",series:[
    {name:"大型トラック",unitLabel:"時間/年",points:points(large)},
    {name:"中小型トラック",unitLabel:"時間/年",points:points(small)},
    {name:"全産業平均",unitLabel:"時間/年",points:points(all)}
  ],note:"厚生労働省『賃金構造基本統計調査』を同省ポータルが整理した2014–2022年系列。2024年4月の時間外労働上限規制・改善基準告示改正前の基準線として扱います。"});
  if(c)root.appendChild(c);
  root.appendChild(el("p","flow-block__reading","2025年job tagの月間労働時間は別の処理済み職業統計のため、この2014–2022年年次系列には直結しません。規制後の連続系列は同一定義で確認できた年から追加します。"));
}
mount().catch((err)=>console.warn("driver labor history mount skipped",err));
