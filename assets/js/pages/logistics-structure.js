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
  if (unit === "years") return `${jp(v, 1)}歳`;
  if (unit === "ten_thousand_jpy_year") return `${jp(v, 1)}万円/年`;
  if (unit === "ten_thousand_jpy_month") return `${jp(v, 1)}万円/月`;
  if (unit === "hours_month") return `${jp(v, 0)}時間/月`;
  if (unit === "ratio") return `${jp(v, 2)}倍`;
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
  const [parcel, workforce, capacity, demography, labor] = await Promise.all([
    loadOptionalJSON("data/economy/parcel-demand.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce.json", {}),
    loadOptionalJSON("data/economy/logistics-capacity.json", {}),
    loadOptionalJSON("data/economy/driver-demography.json", {}),
    loadOptionalJSON("data/economy/logistics-labor-market.json", {})
  ]);
  clear(root);

  const parcelVolume = series(parcel, "parcel_delivery_volume");
  const mailVolume = series(parcel, "mail_delivery_volume");
  const employment = series(workforce, "transport_postal_employment");
  const femaleShare = series(workforce, "transport_postal_female_share");
  const parcelPerWorker = series(capacity, "parcel_per_transport_worker");
  const loadIndex = series(capacity, "parcel_load_index_2015");
  const allAge = series(demography, "all_industries_average_age");
  const largeDriverAge = series(demography, "commercial_large_truck_driver_average_age");
  const smallDriverAge = series(demography, "commercial_small_truck_driver_average_age");
  const currentDriverAge = series(labor, "truck_driver_average_age_2025");
  const income = series(labor, "truck_driver_annual_income");
  const workHours = series(labor, "truck_driver_monthly_work_hours");
  const vacancy = series(labor, "truck_driver_job_openings_ratio");
  const offeredWage = series(labor, "truck_driver_offered_monthly_wage");
  const vacancyHistory = series(labor, "automobile_driver_job_openings_ratio_history");
  const allVacancyHistory = series(labor, "all_occupations_job_openings_ratio_history");

  const pulse = el("div", "value-row");
  pulse.appendChild(card("宅配便取扱個数", parcelVolume, "B2C需要proxy"));
  pulse.appendChild(card("運輸業・郵便業 就業者", employment, "年平均"));
  pulse.appendChild(card("宅配需要/労働力", loadIndex, "2015=100"));
  pulse.appendChild(card("トラックドライバー平均年齢", currentDriverAge, "2025年"));
  pulse.appendChild(card("有効求人倍率", vacancy, "トラックドライバー"));
  pulse.appendChild(card("女性就業者比率", femaleShare, "運輸業・郵便業"));
  root.appendChild(pulse);

  root.appendChild(el("h3", "flow-block__sub", "Parcel / Last-mile demand"));
  const parcelChart = chart({ kind:"line", unitLabel:"百万個", series:[
    { name:"宅配便", unitLabel:"百万個", points:points(parcelVolume) },
    { name:"メール便", unitLabel:"百万冊", points:points(mailVolume) }
  ], note:"宅配便は法人向けを一部含むため、B2Cそのものではなくラストマイル需要の代理指標として扱います。" });
  if (parcelChart) root.appendChild(parcelChart);

  root.appendChild(el("h3", "flow-block__sub", "Logistics workforce supply"));
  const workforceChart = chart({ kind:"line", unitLabel:"万人", series:[{ name:"運輸業・郵便業 就業者", unitLabel:"万人", points:points(employment) }], note:"産業大分類の基準系列。道路貨物運送業・倉庫業の細分系列を次に接続します。" });
  if (workforceChart) root.appendChild(workforceChart);

  root.appendChild(el("h3", "flow-block__sub", "Driver aging"));
  const ageChart = chart({ kind:"line", unitLabel:"歳", series:[
    { name:"営業用大型", unitLabel:"歳", points:points(largeDriverAge) },
    { name:"営業用普通・小型", unitLabel:"歳", points:points(smallDriverAge) },
    { name:"全産業", unitLabel:"歳", points:points(allAge) }
  ], note:"経済産業省が賃金構造基本統計調査から作成。2019年以前は2020年と同じ推計方法による遡及集計。" });
  if (ageChart) root.appendChild(ageChart);
  const ageNow = latest(currentDriverAge);
  if (ageNow) root.appendChild(sourceNote(`最新の2025年賃金構造基本統計調査ベースでは、トラックドライバー平均年齢は${jp(ageNow.value,1)}歳です。長期系列とは職業集約の定義が同一とは限らないため、2020→2025を一本の連続線には接続しません。`));

  root.appendChild(el("h3", "flow-block__sub", "Labor market pressure"));
  const vacancyChart = chart({ kind:"line", unitLabel:"倍", series:[
    { name:"自動車運転", unitLabel:"倍", points:points(vacancyHistory) },
    { name:"全職業", unitLabel:"倍", points:points(allVacancyHistory) }
  ], note:"厚生労働省 一般職業紹介状況を国土交通省が整理した長期系列。" });
  if (vacancyChart) root.appendChild(vacancyChart);
  const laborRow = el("div", "value-row");
  laborRow.appendChild(card("2025年度 有効求人倍率", vacancy, "全国"));
  laborRow.appendChild(card("求人賃金", offeredWage, "求人票ベース"));
  laborRow.appendChild(card("就業者年収", income, "賃金構造基本統計"));
  laborRow.appendChild(card("月間労働時間", workHours, "賃金構造基本統計"));
  root.appendChild(laborRow);

  root.appendChild(el("h3", "flow-block__sub", "Demand / capacity pressure"));
  const capacityChart = chart({ kind:"line", unitLabel:"2015=100", series:[{ name:"宅配需要/物流労働力", unitLabel:"2015=100", points:points(loadIndex) }], note:"宅配便個数 ÷ 運輸業・郵便業就業者を2015年=100に指数化。生産性ではなく需給圧力のproxyです。" });
  if (capacityChart) root.appendChild(capacityChart);
  const loadObs = latest(parcelPerWorker);
  if (loadObs) root.appendChild(sourceNote(`2024年のproxyは物流就業者1人あたり約${jp(loadObs.value,0)}個/年。2015年比では需要/労働力の負荷指数が約30.8%上昇しています。`));

  root.appendChild(sourceNote("次段: 労働力調査の年齢階級×産業表から55歳以上比率・若年比率を投入し、道路貨物運送業・倉庫業へ細分化します。その後、人口動態と接続して複合Labor Capacity Stressを構築します。"));
}

mount().catch((err) => console.error("logistics structure mount failed", err));
