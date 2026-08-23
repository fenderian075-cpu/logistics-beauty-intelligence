import { el, byId } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";

const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const points = (s) => (s?.observations || []).map((o) => ({ x: o.period, y: Number(o.value) })).filter((p) => Number.isFinite(p.y));
const latest = (s) => (s?.observations || []).at(-1) || null;
const jp = (v, digits = 1) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });

function metricCard(label, s, suffix, note) {
  const o = latest(s);
  const item = el("div", "value-row__item");
  item.appendChild(el("span", "value-row__label", label));
  item.appendChild(el("strong", "value-row__value", o ? `${jp(o.value, 1)}${suffix}` : "未確認"));
  item.appendChild(el("span", "value-row__meta", o ? `${o.period} · ${note}` : note));
  return item;
}

async function mount() {
  const root = byId("logistics-structure");
  if (!root) return;
  const capacity = await loadOptionalJSON("data/economy/logistics-capacity.json", {});
  const freight = series(capacity, "freight_labor_productivity");
  const warehouse = series(capacity, "warehouse_labor_productivity");
  if (!freight?.observations?.length && !warehouse?.observations?.length) return;

  root.appendChild(el("h3", "flow-block__sub", "Capacity / labor productivity"));
  const row = el("div", "value-row");
  if (freight?.observations?.length) row.appendChild(metricCard("道路貨物 労働者あたりton-km", freight, "千ton-km/人", "営業用トラック"));
  if (warehouse?.observations?.length) row.appendChild(metricCard("倉庫 労働者あたり荷動き", warehouse, "t/人", "主要21社proxy"));
  root.appendChild(row);

  if (freight?.observations?.length) {
    const c = chart({
      kind: "line",
      unitLabel: "千ton-km/人",
      series: [{ name: "道路貨物 労働者あたりton-km", unitLabel: "千ton-km/人", points: points(freight) }],
      note: "営業用トラック年間ton-km ÷ 道路貨物運送業就業者。道路輸送の物理需要を労働供給で割った構造指標です。"
    });
    if (c) root.appendChild(c);
  }

  if (warehouse?.observations?.length) {
    const c = chart({
      kind: "line",
      unitLabel: "t/人",
      series: [{ name: "倉庫 労働者あたり荷動き", unitLabel: "t/人", points: points(warehouse) }],
      note: "営業普通倉庫主要21社の年間入庫+出庫 ÷ 全国倉庫業就業者。対象範囲が異なるため企業生産性ではなく構造proxyとして扱います。"
    });
    if (c) root.appendChild(c);
  }
}

mount().catch((err) => console.warn("logistics productivity mount skipped", err));
