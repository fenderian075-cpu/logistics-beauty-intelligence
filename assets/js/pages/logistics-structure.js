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
  const [parcel, workforce] = await Promise.all([
    loadOptionalJSON("data/economy/parcel-demand.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce.json", {})
  ]);
  clear(root);

  const parcelVolume = series(parcel, "parcel_delivery_volume");
  const mailVolume = series(parcel, "mail_delivery_volume");
  const employment = series(workforce, "transport_postal_employment");
  const femaleShare = series(workforce, "transport_postal_female_share");

  const pulse = el("div", "value-row");
  pulse.appendChild(card("宅配便取扱個数", parcelVolume, "B2C需要proxy"));
  pulse.appendChild(card("運輸業・郵便業 就業者", employment, "年平均"));
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
    note: "産業大分類の基準系列。道路貨物運送業・倉庫業、年齢構成、賃金、求人倍率は次段で接続します。"
  });
  if (workforceChart) root.appendChild(workforceChart);

  root.appendChild(sourceNote("読み方: 宅配需要が増える一方で物流就業者が伸びなければ、1人あたり処理負荷と供給制約が強まりやすくなります。次段では55歳以上比率・若年比率・賃金・求人倍率を重ね、Labor Capacity Stressとして統合します。"));
}

mount().catch((err) => console.error("logistics structure mount failed", err));
