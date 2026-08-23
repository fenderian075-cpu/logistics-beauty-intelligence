import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";

const series=(d,id)=>(d?.series||[]).find((s)=>s.metric_id===id);
const points=(s)=>(s?.observations||[]).map((o)=>({x:o.period,y:Number(o.value)})).filter((p)=>Number.isFinite(p.y));
const latest=(s)=>(s?.observations||[]).at(-1)||null;
const jp=(v,d=1)=>Number(v).toLocaleString("ja-JP",{maximumFractionDigits:d});

function card(label,s,format,note){
  const o=latest(s),item=el("div","value-row__item");
  item.appendChild(el("span","value-row__label",label));
  item.appendChild(el("strong","value-row__value",o?format(Number(o.value)):"未確認"));
  item.appendChild(el("span","value-row__meta",o?`${o.period} · ${note}`:note));
  return item;
}

async function mount(){
  const root=byId("driver-labor-history"); if(!root)return;
  const data=await loadOptionalJSON("data/economy/driver-labor-history.json",{}); clear(root);
  const large=series(data,"large_truck_driver_annual_work_hours");
  const small=series(data,"small_medium_truck_driver_annual_work_hours");
  const all=series(data,"all_industries_annual_work_hours");
  const premium=series(data,"large_truck_work_hours_premium_vs_all");
  const largeInc=series(data,"large_truck_driver_annual_income");
  const smallInc=series(data,"small_medium_truck_driver_annual_income");
  const allInc=series(data,"all_industries_annual_income");
  const largeGap=series(data,"large_truck_income_gap_vs_all");
  const smallGap=series(data,"small_medium_truck_income_gap_vs_all");
  if(!large?.observations?.length)return;

  const row=el("div","value-row");
  row.appendChild(card("大型トラック 年間労働時間",large,(v)=>`${jp(v,0)}時間/年`,"賃金構造基本統計"));
  row.appendChild(card("大型トラック 年間所得",largeInc,(v)=>`${jp(v,0)}万円/年`,"賃金構造基本統計"));
  row.appendChild(card("大型 所得格差",largeGap,(v)=>`${v>0?"+":""}${jp(v,1)}%`,"全産業比"));
  row.appendChild(card("中小型 所得格差",smallGap,(v)=>`${v>0?"+":""}${jp(v,1)}%`,"全産業比"));
  root.appendChild(row);

  const hours=chart({kind:"line",unitLabel:"時間/年",series:[
    {name:"大型トラック",unitLabel:"時間/年",points:points(large)},
    {name:"中小型トラック",unitLabel:"時間/年",points:points(small)},
    {name:"全産業平均",unitLabel:"時間/年",points:points(all)}
  ],note:"厚生労働省『賃金構造基本統計調査』を厚労省・国交省が整理した年次系列。2024年4月の時間外労働上限規制・改善基準告示改正前後を読む基準線です。"});
  if(hours)root.appendChild(hours);

  if(largeInc?.observations?.length){
    const income=chart({kind:"line",unitLabel:"万円/年",series:[
      {name:"大型トラック",unitLabel:"万円/年",points:points(largeInc)},
      {name:"中小型トラック",unitLabel:"万円/年",points:points(smallInc)},
      {name:"全産業平均",unitLabel:"万円/年",points:points(allInc)}
    ],note:"年間所得額 = きまって支給する現金給与額×12 + 年間賞与その他特別給与額。大型は全産業との差が縮小している一方、中小型は2023年でも約14%低い水準です。"});
    if(income)root.appendChild(income);
  }

  const po=latest(premium),lg=latest(largeGap),sg=latest(smallGap);
  root.appendChild(el("p","flow-block__reading",`2023年の大型トラックは年間労働時間が全産業より${jp(po.value,1)}%長い一方、年間所得は${jp(Math.abs(lg.value),1)}%低い。中小型の所得差は${jp(Math.abs(sg.value),1)}%で、賃金競争力の弱さは車格によって差が残っています。2025年job tagは別の処理済み職業統計のため、この長期系列には直結しません。`));
}
mount().catch((err)=>console.warn("driver labor history mount skipped",err));
