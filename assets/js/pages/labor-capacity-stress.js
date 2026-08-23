import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";
const s=(d,id)=>(d?.series||[]).find((x)=>x.metric_id===id),pts=(x)=>(x?.observations||[]).map((o)=>({x:o.period,y:Number(o.value)})).filter((p)=>Number.isFinite(p.y)),last=(x)=>(x?.observations||[]).at(-1),jp=(v,d=1)=>Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
function item(label,o,note){const i=el('div','value-row__item');i.appendChild(el('span','value-row__label',label));i.appendChild(el('strong','value-row__value',o?jp(o.value,1):'未確認'));i.appendChild(el('span','value-row__meta',o?`${o.period} · ${note}`:note));return i;}
async function mount(){
 const root=byId('labor-capacity-stress'); if(!root)return;
 const [v0,v1]=await Promise.all([loadOptionalJSON('data/economy/labor-capacity-stress.json',{}),loadOptionalJSON('data/economy/labor-capacity-stress-v1.json',{})]); clear(root);
 const score1=s(v1,'labor_capacity_stress_v1'),score0=s(v0,'labor_capacity_stress_equal_weight');
 if(!score1?.observations?.length&&!score0?.observations?.length){root.appendChild(el('p','flow-block__reading','入力系列を同一期間へ整列中です。未計算値は推測で補完しません。'));return;}
 if(score1?.observations?.length){
  const ids=[['宅配需要/労働力','parcel_labor_load_pressure_v1'],['貨物運転者 求人需給','freight_driver_vacancy_pressure_v1'],['道路貨物 高齢化','road_freight_aging_pressure_v1'],['世代交代','road_freight_replacement_pressure_v1'],['生産年齢人口','working_age_supply_pressure_v1']];
  const row=el('div','value-row'); row.appendChild(item('Labor Capacity Stress v1',last(score1),'2018=100 · 5要素等ウェイト'));
  for(const [label,id] of ids)row.appendChild(item(label,last(s(v1,id)),'2018=100')); root.appendChild(row);
  const c=chart({kind:'line',unitLabel:'2018=100',series:[{name:'Labor Capacity Stress v1',unitLabel:'2018=100',points:pts(score1)},...ids.map(([name,id])=>({name,unitLabel:'2018=100',points:pts(s(v1,id))}))],note:'v1は求人需給を「貨物自動車運転者」に限定し、道路貨物の年齢構造と対象を近づけたLBI独自診断指数。2018=100、5要素を各20%で単純平均。公的指数ではありません。'}); if(c)root.appendChild(c);
  root.appendChild(el('p','flow-block__reading','v1では賃金をまだスコアに入れていません。大型・中小型を1本へ集約する際の労働者ウェイトを恣意的に置かないためです。年間所得額は直前の労働条件セクションで独立表示します。'));
 }
 if(score0?.observations?.length){
  const h=el('h3','flow-block__sub','Longer-history reference — v0'); root.appendChild(h);
  const c0=chart({kind:'line',unitLabel:'2015=100',series:[{name:'Labor Capacity Stress v0',unitLabel:'2015=100',points:pts(score0)}],note:'v0は2015–2022の長期比較用。求人倍率にバス・タクシー等を含む「自動車運転の職業」を使うため、v1より対象範囲が広い参考系列です。'}); if(c0)root.appendChild(c0);
 }
}
mount().catch((e)=>console.warn('labor capacity stress mount skipped',e));
