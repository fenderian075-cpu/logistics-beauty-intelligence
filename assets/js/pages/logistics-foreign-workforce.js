import { el, byId } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";

const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const points = (s) => (s?.observations || []).map((o) => ({ x:o.period, y:Number(o.value) })).filter((p) => Number.isFinite(p.y));
const latest = (s) => (s?.observations || []).at(-1) || null;
const jp = (v, digits=0) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits:digits });

function card(label, s, formatter, note) {
  const o=latest(s); const item=el("div","value-row__item");
  item.appendChild(el("span","value-row__label",label));
  item.appendChild(el("strong","value-row__value",o ? formatter(Number(o.value)) : "未確認"));
  item.appendChild(el("span","value-row__meta",o ? `${o.period} · ${note}` : note));
  return item;
}

async function mount() {
  const root=byId("logistics-structure"); if (!root) return;
  const data=await loadOptionalJSON("data/economy/logistics-foreign-workforce.json",{});
  const workers=series(data,"transport_postal_foreign_workers");
  const index=series(data,"transport_postal_foreign_worker_index_2023");
  const all=series(data,"foreign_workers_all_industries");
  if (!workers?.observations?.length) return;

  root.appendChild(el("h3","flow-block__sub","Foreign workforce supply"));
  const row=el("div","value-row");
  row.appendChild(card("運輸・郵便 外国人労働者",workers,(v)=>`${jp(v)}人`,"10月末届出"));
  if (index?.observations?.length) row.appendChild(card("外国人物流労働者指数",index,(v)=>jp(v,1),"2023=100"));
  if (all?.observations?.length) row.appendChild(card("外国人労働者 全産業",all,(v)=>`${jp(v)}人`,"10月末届出"));
  root.appendChild(row);

  const c=chart({kind:"line",unitLabel:"人",series:[
    {name:"運輸・郵便 外国人労働者",unitLabel:"人",points:points(workers)}
  ],note:"厚生労働省『外国人雇用状況』の各年10月末届出。労働力調査の年平均就業者とは時点・母集団が異なるため、運輸就業者に占める外国人比率には直接変換しません。"});
  if (c) root.appendChild(c);

  const first=workers.observations[0], now=latest(workers);
  if (first && now) {
    const change=(Number(now.value)/Number(first.value)-1)*100;
    root.appendChild(el("p","flow-block__reading",`運輸業・郵便業の外国人労働者は${first.period}の${jp(first.value)}人から${now.period}の${jp(now.value)}人へ${jp(change,1)}%増加。物流労働供給の補完チャネルとして拡大していますが、道路貨物・倉庫への細分値ではありません。`));
  }
}
mount().catch((err)=>console.warn("foreign workforce mount skipped",err));
