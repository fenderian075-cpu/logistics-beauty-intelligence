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
  if (unit === "million_persons") return `${jp(v, 2)}百万人`;
  if (unit === "pct") return `${jp(v, 1)}%`;
  if (unit === "years") return `${jp(v, 1)}歳`;
  if (unit === "ten_thousand_jpy_year") return `${jp(v, 1)}万円/年`;
  if (unit === "ten_thousand_jpy_month") return `${jp(v, 1)}万円/月`;
  if (unit === "hours_month") return `${jp(v, 0)}時間/月`;
  if (unit === "ratio") return `${jp(v, 2)}倍`;
  if (unit === "parcels_per_person_year") return `${jp(v, 1)}個/人・年`;
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
  const [parcel, workforce, capacity, demography, labor, population] = await Promise.all([
    loadOptionalJSON("data/economy/parcel-demand.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce.json", {}),
    loadOptionalJSON("data/economy/logistics-capacity.json", {}),
    loadOptionalJSON("data/economy/driver-demography.json", {}),
    loadOptionalJSON("data/economy/logistics-labor-market.json", {}),
    loadOptionalJSON("data/economy/japan-demography.json", {})
  ]);
  clear(root);

  const parcelVolume = series(parcel, "parcel_delivery_volume");
  const mailVolume = series(parcel, "mail_delivery_volume");
  const allEmployment = series(workforce, "all_industries_employment");
  const employment = series(workforce, "transport_postal_employment");
  const employmentShare = series(workforce, "transport_postal_employment_share");
  const femaleShare = series(workforce, "transport_postal_female_share");
  const parcelPerCapita = series(capacity, "parcel_per_capita");
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
  const popTotal = series(population, "population_total");
  const popMale = series(population, "population_male");
  const popFemale = series(population, "population_female");
  const workingAge = series(population, "working_age_population_15_64");
  const age65 = series(population, "population_age_65_plus");
  const workingAgeShare = series(population, "working_age_share");
  const foreignPopulation = series(population, "foreign_population");

  const pulse = el("div", "value-row");
  pulse.appendChild(card("宅配便取扱個数", parcelVolume, "B2C需要proxy"));
  pulse.appendChild(card("1人当たり宅配便", parcelPerCapita, "Parcel intensity"));
  pulse.appendChild(card("運輸業・郵便業 就業者", employment, "年平均"));
  pulse.appendChild(card("物流就業者シェア", employmentShare, "全産業就業者比"));
  pulse.appendChild(card("宅配需要/労働力", loadIndex, "2015=100"));
  pulse.appendChild(card("トラックドライバー平均年齢", currentDriverAge, "2025年"));
  pulse.appendChild(card("有効求人倍率", vacancy, "トラックドライバー"));
  pulse.appendChild(card("生産年齢人口比率", workingAgeShare, "15-64歳"));
  root.appendChild(pulse);

  root.appendChild(el("h3", "flow-block__sub", "Parcel / Last-mile demand"));
  const parcelChart = chart({ kind:"line", unitLabel:"百万個", series:[
    { name:"宅配便", unitLabel:"百万個", points:points(parcelVolume) },
    { name:"メール便", unitLabel:"百万冊", points:points(mailVolume) }
  ], note:"宅配便は法人向けを一部含むため、B2Cそのものではなくラストマイル需要の代理指標として扱います。" });
  if (parcelChart) root.appendChild(parcelChart);

  const intensityChart = chart({ kind:"line", unitLabel:"個/人・年", series:[
    { name:"人口1人当たり宅配便", unitLabel:"個/人・年", points:points(parcelPerCapita) }
  ], note:"宅配便取扱個数 ÷ 総人口。純B2Cではなく、人口当たりラストマイル需要の強度です。" });
  if (intensityChart) root.appendChild(intensityChart);

  root.appendChild(el("h3", "flow-block__sub", "Logistics workforce supply"));
  const workforceChart = chart({ kind:"line", unitLabel:"万人", series:[
    { name:"日本総就業者", unitLabel:"万人", points:points(allEmployment) },
    { name:"運輸業・郵便業", unitLabel:"万人", points:points(employment) }
  ], note:"同じ労働力調査の年平均系列。物流就業者の絶対数だけでなく、日本全体の雇用拡大との相対差を見ます。" });
  if (workforceChart) root.appendChild(workforceChart);
  const shareChart = chart({ kind:"line", unitLabel:"%", series:[
    { name:"運輸・郵便就業者シェア", unitLabel:"%", points:points(employmentShare) }
  ], note:"運輸業・郵便業就業者 ÷ 日本総就業者。2015年5.27%から2025年5.05%へ低下。" });
  if (shareChart) root.appendChild(shareChart);

  root.appendChild(el("h3", "flow-block__sub", "Japan demographic base"));
  const populationChart = chart({ kind:"line", unitLabel:"百万人", series:[
    { name:"総人口", unitLabel:"百万人", points:points(popTotal) },
    { name:"生産年齢人口 15-64", unitLabel:"百万人", points:points(workingAge) },
    { name:"65歳以上", unitLabel:"百万人", points:points(age65) }
  ], note:"各年10月1日現在。2025年人口推計は2020年国勢調査基準の確定値で、2025年国勢調査の基本集計後に改定予定。" });
  if (populationChart) root.appendChild(populationChart);

  const sexChart = chart({ kind:"line", unitLabel:"百万人", series:[
    { name:"男性", unitLabel:"百万人", points:points(popMale) },
    { name:"女性", unitLabel:"百万人", points:points(popFemale) }
  ], note:"男女とも減少傾向。物流労働供給の母集団変化を見る人口基盤系列です。" });
  if (sexChart) root.appendChild(sexChart);

  const popRow = el("div", "value-row");
  popRow.appendChild(card("総人口", popTotal, "各年10月1日"));
  popRow.appendChild(card("生産年齢人口", workingAge, "15-64歳"));
  popRow.appendChild(card("65歳以上", age65, "人口構造"));
  popRow.appendChild(card("外国人人口", foreignPopulation, "直近確定値"));
  root.appendChild(popRow);

  const pop2015 = popTotal?.observations?.find((o) => o.period === "2015");
  const pop2025 = latest(popTotal);
  const work2015 = workingAge?.observations?.find((o) => o.period === "2015");
  const work2025 = latest(workingAge);
  if (pop2015 && pop2025 && work2015 && work2025) {
    const totalChange = (Number(pop2025.value) / Number(pop2015.value) - 1) * 100;
    const workChange = (Number(work2025.value) / Number(work2015.value) - 1) * 100;
    root.appendChild(sourceNote(`2015→2025で総人口は${jp(totalChange,1)}%、生産年齢人口は${jp(workChange,1)}%。一方で日本総就業者は増加しているため、物流の供給制約は人口減だけでなく、産業間の人材獲得競争としても見る必要があります。`));
  }

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
  laborRow.appendChild(card("女性就業者比率", femaleShare, "運輸業・郵便業"));
  root.appendChild(laborRow);

  root.appendChild(el("h3", "flow-block__sub", "Demand / capacity pressure"));
  const capacityChart = chart({ kind:"line", unitLabel:"2015=100", series:[{ name:"宅配需要/物流労働力", unitLabel:"2015=100", points:points(loadIndex) }], note:"宅配便個数 ÷ 運輸業・郵便業就業者を2015年=100に指数化。生産性ではなく需給圧力のproxyです。" });
  if (capacityChart) root.appendChild(capacityChart);
  const loadObs = latest(parcelPerWorker);
  const intensityObs = latest(parcelPerCapita);
  if (loadObs && intensityObs) root.appendChild(sourceNote(`2024年は人口1人当たり宅配便が約${jp(intensityObs.value,1)}個/年、物流就業者1人当たりproxyが約${jp(loadObs.value,0)}個/年。需要強度と労働供給負荷を分けて追えるようになりました。`));

  root.appendChild(sourceNote("次段: 労働力調査I-B-5/2-2-1の年齢階級実数を投入し、55歳以上比率・34歳以下比率・replacement ratioを算出。続いて道路貨物運送業・倉庫業へ同じ構造を細分化します。"));
}

mount().catch((err) => console.error("logistics structure mount failed", err));
