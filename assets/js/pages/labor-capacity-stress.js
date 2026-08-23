import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";
const s=(d,id)=>(d?.series||[]).find((x)=>x.metric_id===id),pts=(x)=>(x?.observations||[]).map((o)=>({x:o.period,y:Number(o.value)})).filter((p)=>Number.isFinite(p.y)),last=(x)=>(x?.observations||[]).at(-1),jp=(v,d=1)=>Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
async function mount(){
 const root=byId('labor-capacity-stress'); if(!root)return; const d=await loadOptionalJSON('data/economy/labor-capacity-stress.json',{}); clear(root);
 const score=s(d,'labor_capacity_stress_equal_weight'); if(!score?.observations?.length){root.appendChild(el('p','flow-block__reading','入力系列を同一期間へ整列中です。未計算値は推測で補完しません。'));return;}
 const ids=[['宅配需要/労働力','parcel_labor_load_index'],['求人需給','vacancy_pressure_index'],['道路貨物 高齢化','road_freight_aging_pressure_index'],['世代交代','road_freight_replacement_pressure_index'],['生産年齢人口','working_age_supply_pressure_index']];
 const row=el('div','value-row'); const o=last(score),item=el('div','value-row__item'); item.appendChild(el('span','value-row__label','Labor Capacity Stress v0')); item.appendChild(el('strong','value-row__value',jp(o.value,1))); item.appendChild(el('span','value-row__meta',`${o.period} · 2015=100 · 5要素等ウェイト`)); row.appendChild(item); for(const [label,id] of ids){const x=last(s(d,id));if(!x)continue;const i=el('div','value-row__item');i.appendChild(el('span','value-row__label',label));i.appendChild(el('strong','value-row__value',jp(x.value,1)));i.appendChild(el('span','value-row__meta',`${x.period} · 2015=100`));row.appendChild(i);} root.appendChild(row);
 const c=chart({kind:'line',unitLabel:'2015=100',series:[{name:'Labor Capacity Stress v0',unitLabel:'2015=100',points:pts(score)},...ids.map(([name,id])=>({name,unitLabel:'2015=100',points:pts(s(d,id))}))],note:'LBI独自の診断指数。宅配需要/労働力、求人倍率、道路貨物55+、世代交代、生産年齢人口の5要素を2015=100に正規化し、各20%で単純平均。公的な指数ではありません。'}); if(c)root.appendChild(c);
 root.appendChild(el('p','flow-block__reading','労働時間は長時間化が需給逼迫を示す一方、2024年以降は規制による短縮が供給可能時間を減らすため、符号が一意ではありません。v0スコアには含めず別表示しています。'));
}
mount().catch((e)=>console.warn('labor capacity stress mount skipped',e));
