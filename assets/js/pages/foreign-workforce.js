import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";
import { formatPeriod } from "../core/units.js";

const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const latest = (s) => (s?.observations || []).at(-1) || null;
const points = (s) => (s?.observations || []).map((o) => ({ x: o.period, y: Number(o.value) })).filter((p) => Number.isFinite(p.y));
const jp = (v, digits = 1) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });

function card(label, s, formatter, note = "") {
  const obs = latest(s);
  const item = el("div", "value-row__item");
  item.appendChild(el("span", "value-row__label", label));
  item.appendChild(el("strong", "value-row__value", obs ? formatter(Number(obs.value)) : "未確認"));
  const meta = [];
  if (obs) meta.push(formatPeriod(obs.period));
  if (note) meta.push(note);
  item.appendChild(el("span", "value-row__meta", meta.join(" · ")));
  return item;
}

async function mount() {
  const root = byId("foreign-workforce");
  if (!root) return;
  const data = await loadOptionalJSON("data/economy/logistics-foreign-workforce.json", {});
  clear(root);

  const all = series(data, "foreign_workers_all_industries");
  const transport = series(data, "transport_postal_foreign_workers");
  const share = series(data, "transport_postal_foreign_share_of_all_foreign");
  const index = series(data, "transport_postal_foreign_worker_index_2023");
  if (!transport?.observations?.length) return;

  const row = el("div", "value-row");
  row.appendChild(card("運輸業・郵便業 外国人労働者", transport, (v) => `${jp(v / 10000, 1)}万人`, "10月末"));
  row.appendChild(card("外国人労働者 全産業", all, (v) => `${jp(v / 10000, 1)}万人`, "10月末"));
  row.appendChild(card("外国人雇用に占める運輸・郵便", share, (v) => `${jp(v, 1)}%`, "全外国人労働者に対する構成比"));
  root.appendChild(row);

  const c = chart({
    kind: "line",
    unitLabel: "2023=100",
    series: [{ name: "運輸業・郵便業 外国人労働者", unitLabel: "2023=100", points: points(index) }],
    note: "厚生労働省『外国人雇用状況』の各年10月末届出。運輸業・郵便業の外国人労働者数を2023年=100に指数化。"
  });
  if (c) root.appendChild(c);

  const first = transport.observations?.[0];
  const now = latest(transport);
  if (first && now) {
    const growth = (Number(now.value) / Number(first.value) - 1) * 100;
    root.appendChild(el("p", "flow-block__reading", `2023年10月の${jp(first.value / 10000,1)}万人から2025年10月の${jp(now.value / 10000,1)}万人へ約${jp(growth,1)}%増加。外国人雇用は物流労働供給の補完要素として拡大していますが、道路貨物・倉庫への内訳はこの大分類統計からは判別できません。`));
  }
}

mount().catch((err) => console.error("foreign workforce mount failed", err));
