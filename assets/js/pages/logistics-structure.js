import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { chart } from "../render/chart.js";

const latest = (s) => (s?.observations || []).at(-1) || null;
const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const points = (s) => (s?.observations || []).map((o) => ({ x: o.period, y: Number(o.value) })).filter((p) => Number.isFinite(p.y));
const jp = (v, digits = 1) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });

function displayValue(unit, value) {
  if (value == null || !Number.isFinite(Number(value))) return "未確認";
  const v = Number(value);
  if (unit === "million parcels") return `${jp(v / 100, 2)}億個`;
  if (unit === "million items") return `${jp(v / 100, 2)}億冊`;
  if (unit === "ten_thousand_persons") return `${jp(v, 0)}万人`;
  if (unit === "pct") return `${jp(v, 1)}%`;
  if (unit === "parcels_per_worker_year") return `${jp(v, 0)}個/人・年`;
  if (unit === "index_2015_100") return jp(v, 1);
  return jp(v, 1);
}

function card(label, s, note) {
  const obs = latest(s);
  const item = el("div", "value-row__item");
  item.appendChild(el("span", "value-row__label", label));
  item.appendChild(el("strong", "value-row__value", obs ? displayValue(s.unit, obs.value) : "未確認"));
  const meta = [];
  if (obs) meta.push(formatPeriod(obs.period));
  if (obs?.yoy != null) meta.push(`前年比 ${formatPct(obs.yoy)}`);
  if (note) meta.push(note);
  item.appendChild(el("span", "value-row__meta", meta.join(" · ")));
  return item;
}

function sourceNote(text) { return el("p", "flow-block__reading", text); }

async function mount() {
  const root = byId("logistics-structure");
  if (!root) return;
  const [parcel, workforce, capacity] = await Promise.all([
    loadOptionalJSON("data/economy/parcel-demand.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce.json", {}),
    loadOptionalJSON("data/economy/logistics-capacity.json", {})
  ]);
  clear(root);

  const parcelVolume = series(parcel, "parcel_delivery_volume");
  const mailVolume = series(parcel, "mail_delivery_volume");
  const employment = series(workforce, "transport_postal_employment");
  const femaleShare = series(workforce, "transport_postal_female_share");
  const parcelPerWorker = series(capacity, "parcel_per_transport_worker");
  const loadIndex = series(capacity, "parcel_load_index_2015");

  const pulse = el("div", "value-row");
  pulse.appendChild(card("宅配便取扱個数", parcelVolume, "B2C需要proxy"));
  pulse.appendChild(card("運輸業・郵便業 就業者", employment, "年平均"));
  pulse.appendChild(card("宅配需要/労働力", loadIndex, "2015=100"));
  pulse.appendChild(card("女性就業者比率", femaleShare, "月次スナップショット"));
  root.appendChild(pulse);

  root.appendChild(el("h3", "flow-block__sub", "Parcel / Last-mile demand"));
  const parcelChart = chart({
    kind: "line",
    unitLabel: "百万個",
    series: [
      { name: "宅配便", unitLabel: "百万個", points: points(parcelVolume) },
      { name: "メール便", unitLabel: "百万冊", points: points(mailVolume) }
    ],
    note: "宅配便は法人向けを一部含むため、B2Cそのものではなくラストマイル需要の代理指標として扱います。"
  });
  if (parcelChart) root.appendChild(parcelChart);

  root.appendChild(el("h3", "flow-block__sub", "Logistics workforce supply"));
  const workforceChart = chart({
    kind: "line",
    unitLabel: "万人",
    series: [{ name: "運輸業・郵便業 就業者", unitLabel: "万人", points: points(employment) }],
    note: "産業大分類の基準系列。次段で道路貨物運送業・倉庫業と年齢構成を接続します。"
  });
  if (workforceChart) root.appendChild(workforceChart);

  root.appendChild(el("h3", "flow-block__sub", "Demand / capacity pressure"));
  const capacityChart = chart({
    kind: "line",
    unitLabel: "2015=100",
    series: [{ name: "宅配需要/物流労働力", unitLabel: "2015=100", points: points(loadIndex) }],
    note: "宅配便個数 ÷ 運輸業・郵便業就業者を2015年=100に指数化。生産性ではなく需給圧力のproxyです。"
  });
  if (capacityChart) root.appendChild(capacityChart);
  const loadObs = latest(parcelPerWorker);
  if (loadObs) root.appendChild(sourceNote(`2024年のproxyは物流就業者1人あたり約${jp(loadObs.value, 0)}個/年。2015年比では需要/労働力の負荷指数が約30.8%上昇しています。`));

  root.appendChild(sourceNote("次段: 55歳以上比率・若年比率・道路貨物/倉庫の産業細分・賃金・求人倍率を公式系列で追加し、それらが揃った段階で複合的なLabor Capacity Stressを構築します。"));
}

mount().catch((err) => console.error("logistics structure mount failed", err));
