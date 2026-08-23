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
function indexed(s,baseYear="2015"){
  const rows=s?.observations||[],base=rows.find((o)=>String(o.period)===baseYear);
  if(!base||!Number(base.value))return[];
  return rows.map((o)=>({x:o.period,y:Number((Number(o.value)/Number(base.value)*100).toFixed(1))})).filter((p)=>Number.isFinite(p.y));
}

async function mount(){
  const root=byId("trucking-physical-capacity"); if(!root)return;
  const [data,driver]=await Promise.all([
    loadOptionalJSON("data/economy/trucking-physical-capacity.json",{}),
    loadOptionalJSON("data/economy/road-freight-driver-capacity.json",{})
  ]);
  clear(root);
  const operators=series(data,"truck_operators"),vehicles=series(data,"commercial_truck_vehicles");
  const vpo=series(data,"vehicles_per_operator"),tpv=series(data,"ton_km_per_vehicle");
  const workers=series(driver,"road_freight_transport_machine_workers");
  const workerShare=series(driver,"road_freight_transport_machine_share");
  const femaleShare=series(driver,"road_freight_transport_machine_female_share");
  const vehiclesPerWorker=series(driver,"commercial_truck_vehicles_per_transport_machine_worker");
  if(!operators?.observations?.length||!vehicles?.observations?.length){
    root.appendChild(el("p","flow-block__reading","国土交通省の事業者数・車両数長期系列を取得中です。未取得値は推測で補完しません。"));
    return;
  }

  const row=el("div","value-row");
  row.appendChild(card("トラック事業者数",operators,(v)=>`${jp(v,0)}者`,"年度末"));
  row.appendChild(card("営業用トラック車両数",vehicles,(v)=>`${jp(v,0)}台`,"軽自動車除く"));
  if(workers?.observations?.length)row.appendChild(card("道路貨物 運転系従事者",workers,(v)=>`${jp(v,0)}万人`,"輸送・機械運転従事者"));
  if(workerShare?.observations?.length)row.appendChild(card("道路貨物就業者に占める運転系",workerShare,(v)=>`${jp(v,1)}%`,"産業×職業"));
  if(femaleShare?.observations?.length)row.appendChild(card("運転系 女性比率",femaleShare,(v)=>`${jp(v,1)}%`,"労働力調査"));
  if(vpo?.observations?.length)row.appendChild(card("1事業者あたり車両数",vpo,(v)=>`${jp(v,1)}台/者`,"事業構造"));
  if(vehiclesPerWorker?.observations?.length)row.appendChild(card("運転系1人あたり営業用車両",vehiclesPerWorker,(v)=>`${jp(v,2)}台/人`,"車両÷運転系proxy"));
  if(tpv?.observations?.length)row.appendChild(card("1台あたりton-km",tpv,(v)=>`${jp(v,1)}千ton-km/台`,"capacity load proxy"));
  root.appendChild(row);

  const stockSeries=[
    {name:"事業者数",unitLabel:"2015=100",points:indexed(operators)},
    {name:"営業用トラック車両数",unitLabel:"2015=100",points:indexed(vehicles)}
  ];
  if(workers?.observations?.length)stockSeries.push({name:"道路貨物 運転系従事者",unitLabel:"2015=100",points:indexed(workers)});
  const stock=chart({kind:"line",unitLabel:"2015=100",series:stockSeries,note:"事業者数・営業用車両・道路貨物の輸送／機械運転従事者を2015=100で比較。設備側と人側のcapacityが同じ速度で増えているかを確認します。"});
  if(stock)root.appendChild(stock);

  if(workers?.observations?.length){
    const c=chart({kind:"line",unitLabel:"万人",series:[{name:"道路貨物 輸送・機械運転従事者",unitLabel:"万人",points:points(workers)}],note:"総務省『労働力調査』年次2-5-1の道路貨物運送業×輸送・機械運転従事者。主に自動車運転従事者を含みますが、純粋な『トラックドライバー職業人数』とは同一ではありません。"});
    if(c)root.appendChild(c);
  }
  if(tpv?.observations?.length){
    const c=chart({kind:"line",unitLabel:"千ton-km/台",series:[{name:"営業用トラック1台あたりton-km",unitLabel:"千ton-km/台",points:points(tpv)}],note:"営業用トラック年間ton-km ÷ 営業用トラック車両数。実働率・積載率そのものではなく、車両ストック当たり輸送需要のproxyです。"});
    if(c)root.appendChild(c);
  }
  if(workers?.observations?.length){
    const first=workers.observations.find((o)=>String(o.period)==="2015"),now=latest(workers);
    if(first&&now)root.appendChild(el("p","flow-block__reading",`道路貨物の輸送・機械運転従事者は2015年の${jp(first.value,0)}万人から2025年の${jp(now.value,0)}万人へ増えていますが、2025年でも道路貨物就業者の${jp(latest(workerShare)?.value,1)}%にとどまり、女性比率は${jp(latest(femaleShare)?.value,1)}%です。人員数だけでなく高齢化・世代交代・労働時間と併せてcapacityを読みます。`));
  }
}
mount().catch((err)=>console.warn("trucking physical capacity mount skipped",err));
