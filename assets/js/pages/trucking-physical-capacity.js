import { el, byId } from "../core/dom.js";
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
  const root=byId("logistics-structure"); if(!root)return;
  const data=await loadOptionalJSON("data/economy/trucking-physical-capacity.json",{});
  const operators=series(data,"truck_operators"),vehicles=series(data,"commercial_truck_vehicles");
  const vpo=series(data,"vehicles_per_operator"),tpv=series(data,"ton_km_per_vehicle");
  if(!operators?.observations?.length||!vehicles?.observations?.length)return;

  root.appendChild(el("h3","flow-block__sub","Road freight physical capacity"));
  const row=el("div","value-row");
  row.appendChild(card("トラック事業者数",operators,(v)=>`${jp(v,0)}者`,"年度末"));
  row.appendChild(card("営業用トラック車両数",vehicles,(v)=>`${jp(v,0)}台`,"軽自動車除く"));
  if(vpo?.observations?.length)row.appendChild(card("1事業者あたり車両数",vpo,(v)=>`${jp(v,1)}台/者`,"構造指標"));
  if(tpv?.observations?.length)row.appendChild(card("1台あたりton-km",tpv,(v)=>`${jp(v,1)}千ton-km/台`,"capacity load proxy"));
  root.appendChild(row);

  const stock=chart({kind:"line",unitLabel:"2015=100",series:[
    {name:"事業者数",unitLabel:"2015=100",points:indexed(operators)},
    {name:"営業用トラック車両数",unitLabel:"2015=100",points:indexed(vehicles)}
  ],note:"事業者数と車両ストックを2015=100で比較。企業数の増減と物理的な輸送機材の増減を分けて見ます。"});
  if(stock)root.appendChild(stock);
  if(tpv?.observations?.length){
    const c=chart({kind:"line",unitLabel:"千ton-km/台",series:[{name:"営業用トラック1台あたりton-km",unitLabel:"千ton-km/台",points:points(tpv)}],note:"営業用トラック年間ton-km ÷ 営業用トラック車両数。実働率・積載率そのものではなく、車両ストック当たり輸送需要のproxyです。"});
    if(c)root.appendChild(c);
  }
}
function indexed(s){
  const rows=s?.observations||[],base=rows.find((o)=>String(o.period)==="2015");
  if(!base||!Number(base.value))return[];
  return rows.map((o)=>({x:o.period,y:Number((Number(o.value)/Number(base.value)*100).toFixed(1))})).filter((p)=>Number.isFinite(p.y));
}
mount().catch((err)=>console.warn("trucking physical capacity mount skipped",err));
