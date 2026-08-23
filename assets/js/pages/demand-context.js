import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { chart } from "../render/chart.js";
import { formatPeriod } from "../core/units.js";

const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const latest = (s) => (s?.observations || []).at(-1) || null;
const points = (s) => (s?.observations || []).map((o) => ({ x: o.period, y: Number(o.value) })).filter((p) => Number.isFinite(p.y));
const jp = (v, digits = 1) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });

function display(unit, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "未確認";
  if (unit === "trillion_jpy") return `${jp(v, 2)}兆円`;
  if (unit === "pct") return `${jp(v, 2)}%`;
  if (unit === "million_households") return `${jp(v, 2)}百万世帯`;
  if (unit === "parcels_per_household_year") return `${jp(v, 1)}個/世帯・年`;
  if (unit === "index_2015_100") return jp(v, 1);
  return jp(v, 1);
}

function card(label, s, note = "") {
  const obs = latest(s);
  const item = el("div", "value-row__item");
  item.appendChild(el("span", "value-row__label", label));
  item.appendChild(el("strong", "value-row__value", obs ? display(s.unit, obs.value) : "未確認"));
  const meta = [];
  if (obs) meta.push(formatPeriod(obs.period));
  if (note) meta.push(note);
  item.appendChild(el("span", "value-row__meta", meta.join(" · ")));
  return item;
}

function indexFrom(baseSeries, basePeriod = "2015") {
  const obs = baseSeries?.observations || [];
  const base = obs.find((o) => String(o.period) === basePeriod);
  if (!base || !Number(base.value)) return [];
  return obs
    .map((o) => ({ x: String(o.period), y: Number(o.value) / Number(base.value) * 100 }))
    .filter((p) => Number.isFinite(p.y));
}

async function mount() {
  const root = byId("demand-context");
  if (!root) return;
  const [ec, household, parcel] = await Promise.all([
    loadOptionalJSON("data/economy/ec-demand.json", {}),
    loadOptionalJSON("data/economy/household-demand.json", {}),
    loadOptionalJSON("data/economy/parcel-demand.json", {})
  ]);
  clear(root);

  const market = series(ec, "physical_btoc_ec_market");
  const ecRate = series(ec, "physical_btoc_ec_rate");
  const ecIndex = series(ec, "physical_btoc_ec_index_2015");
  const households = series(household, "resident_register_households");
  const parcelPerHousehold = series(household, "parcel_per_household");
  const parcelVolume = series(parcel, "parcel_delivery_volume");

  const row = el("div", "value-row");
  row.appendChild(card("物販系BtoC-EC市場", market, "物流関連需要"));
  row.appendChild(card("物販系EC化率", ecRate, "METI定義"));
  row.appendChild(card("住民基本台帳 世帯数", households, "1月1日現在"));
  row.appendChild(card("1世帯あたり宅配便", parcelPerHousehold, "需要密度proxy"));
  root.appendChild(row);

  const indexChart = chart({
    kind: "line",
    unitLabel: "2015=100",
    series: [
      { name: "物販系BtoC-EC市場", unitLabel: "2015=100", points: points(ecIndex) },
      { name: "宅配便取扱個数", unitLabel: "2015=100", points: indexFrom(parcelVolume) }
    ],
    note: "金額ベースの物販EC市場と物量ベースの宅配便を同じ2015=100で比較します。宅配便には法人向けを一部含むため、純粋なBtoC個数ではありません。"
  });
  if (indexChart) root.appendChild(indexChart);

  const householdChart = chart({
    kind: "line",
    unitLabel: "個/世帯・年",
    series: [
      { name: "1世帯あたり宅配便", unitLabel: "個/世帯・年", points: points(parcelPerHousehold) }
    ],
    note: "国交省の年度宅配便個数 ÷ 各年1月1日の住民基本台帳世帯数。時点差があるため年間需要密度のproxyとして扱います。"
  });
  if (householdChart) root.appendChild(householdChart);

  const a = market?.observations?.find((o) => String(o.period) === "2015");
  const b = latest(market);
  const pA = parcelVolume?.observations?.find((o) => String(o.period) === "2015");
  const pB = parcelVolume?.observations?.find((o) => String(o.period) === "2024");
  if (a && b && pA && pB) {
    const ecGrowth = (Number(b.value) / Number(a.value) - 1) * 100;
    const parcelGrowth = (Number(pB.value) / Number(pA.value) - 1) * 100;
    root.appendChild(el("p", "flow-block__reading", `2015→2024で物販系BtoC-EC市場は約${jp(ecGrowth,1)}%増、宅配便個数は約${jp(parcelGrowth,1)}%増。EC金額の伸びが宅配物量を大きく上回っており、単価・商品構成・配送集約なども含めて読む必要があります。`));
  }
}

mount().catch((err) => console.error("demand context mount failed", err));
