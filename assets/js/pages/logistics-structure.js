import { el, byId, clear } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { chart } from "../render/chart.js";

const latest = (s) => (s?.observations || []).at(-1) || null;
const series = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const points = (s) => (s?.observations || []).map((o) => ({ x: o.period, y: Number(o.value) })).filter((p) => Number.isFinite(p.y));
const jp = (v, digits = 1) => Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });
const hasData = (s) => Boolean(s?.observations?.length);

function indexedPoints(s, basePeriod = "2015") {
  const rows = s?.observations || [];
  const base = rows.find((o) => String(o.period) === basePeriod);
  if (!base || !Number(base.value)) return [];
  return rows.map((o) => ({ x: o.period, y: Number((Number(o.value) / Number(base.value) * 100).toFixed(1)) }))
    .filter((p) => Number.isFinite(p.y));
}

function displayValue(unit, value) {
  if (value == null || !Number.isFinite(Number(value))) return "未確認";
  const v = Number(value);
  if (unit === "million parcels") return `${jp(v / 100, 2)}億個`;
  if (unit === "million items") return `${jp(v / 100, 2)}億冊`;
  if (unit === "ten_thousand_persons") return `${jp(v, 0)}万人`;
  if (unit === "million_persons") return `${jp(v, 2)}百万人`;
  if (unit === "million_households") return `${jp(v, 2)}百万世帯`;
  if (unit === "pct") return `${jp(v, 1)}%`;
  if (unit === "years") return `${jp(v, 1)}歳`;
  if (unit === "ten_thousand_jpy_year") return `${jp(v, 1)}万円/年`;
  if (unit === "ten_thousand_jpy_month") return `${jp(v, 1)}万円/月`;
  if (unit === "hours_month") return `${jp(v, 0)}時間/月`;
  if (unit === "ratio") return `${jp(v, 2)}倍`;
  if (unit === "trillion_jpy") return `${jp(v, 2)}兆円`;
  if (unit === "parcels_per_worker_year") return `${jp(v, 0)}個/人・年`;
  if (unit === "parcels_per_person_year") return `${jp(v, 1)}個/人・年`;
  if (unit === "parcels_per_household_year") return `${jp(v, 1)}個/世帯・年`;
  if (unit === "thousand_tonne_km_per_worker_year") return `${jp(v, 1)}千ton-km/人`;
  if (unit === "tonnes_per_worker_year") return `${jp(v, 1)}t/人`;
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
  const [parcel, workforce, capacity, demography, labor, population, workforceAge, ecDemand, householdDemand] = await Promise.all([
    loadOptionalJSON("data/economy/parcel-demand.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce.json", {}),
    loadOptionalJSON("data/economy/logistics-capacity.json", {}),
    loadOptionalJSON("data/economy/driver-demography.json", {}),
    loadOptionalJSON("data/economy/logistics-labor-market.json", {}),
    loadOptionalJSON("data/economy/japan-demography.json", {}),
    loadOptionalJSON("data/economy/logistics-workforce-age.json", {}),
    loadOptionalJSON("data/economy/ec-demand.json", {}),
    loadOptionalJSON("data/economy/household-demand.json", {})
  ]);
  clear(root);

  const parcelVolume = series(parcel, "parcel_delivery_volume");
  const mailVolume = series(parcel, "mail_delivery_volume");
  const employment = series(workforce, "transport_postal_employment");
  const totalEmployment = series(workforce, "all_industries_employment");
  const employmentShare = series(workforce, "transport_postal_employment_share");
  const femaleShare = series(workforce, "transport_postal_female_share");
  const parcelPerWorker = series(capacity, "parcel_per_transport_worker");
  const parcelPerCapita = series(capacity, "parcel_per_capita");
  const loadIndex = series(capacity, "parcel_load_index_2015");
  const freightProductivity = series(capacity, "freight_labor_productivity");
  const warehouseProductivity = series(capacity, "warehouse_labor_productivity");
  const physicalEc = series(ecDemand, "physical_btoc_ec_market");
  const physicalEcRate = series(ecDemand, "physical_btoc_ec_rate");
  const physicalEcIndex = series(ecDemand, "physical_btoc_ec_index_2015");
  const households = series(householdDemand, "resident_register_households");
  const parcelPerHousehold = series(householdDemand, "parcel_per_household");
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

  const tp55 = series(workforceAge, "transport_postal_age_55_plus_share");
  const tpReplacement = series(workforceAge, "transport_postal_replacement_ratio");
  const roadEmployment = series(workforceAge, "road_freight_employment");
  const road55 = series(workforceAge, "road_freight_age_55_plus_share");
  const roadYoung = series(workforceAge, "road_freight_young_share");
  const roadReplacement = series(workforceAge, "road_freight_replacement_ratio");
  const roadFemale = series(workforceAge, "road_freight_female_share");
  const warehouseEmployment = series(workforceAge, "warehousing_employment");
  const warehouse55 = series(workforceAge, "warehousing_age_55_plus_share");
  const warehouseYoung = series(workforceAge, "warehousing_young_share");
  const warehouseReplacement = series(workforceAge, "warehousing_replacement_ratio");
  const warehouseFemale = series(workforceAge, "warehousing_female_share");

  const pulse = el("div", "value-row");
  pulse.appendChild(card("宅配便取扱個数", parcelVolume, "B2C需要proxy"));
  pulse.appendChild(card("物販系BtoC-EC", physicalEc, "金額ベース需要"));
  pulse.appendChild(card("1世帯当たり宅配便", parcelPerHousehold, "世帯需要proxy"));
  pulse.appendChild(card("運輸業・郵便業 就業者", employment, "年平均"));
  pulse.appendChild(card("宅配需要/労働力", loadIndex, "2015=100"));
  pulse.appendChild(card("有効求人倍率", vacancy, "トラックドライバー"));
  root.appendChild(pulse);

  root.appendChild(el("h3", "flow-block__sub", "Parcel / Last-mile demand"));
  const parcelChart = chart({ kind:"line", unitLabel:"百万個", series:[
    { name:"宅配便", unitLabel:"百万個", points:points(parcelVolume) },
    { name:"メール便", unitLabel:"百万冊", points:points(mailVolume) }
  ], note:"宅配便は法人向けを一部含むため、B2Cそのものではなくラストマイル需要の代理指標として扱います。" });
  if (parcelChart) root.appendChild(parcelChart);
  const intensityChart = chart({ kind:"line", unitLabel:"個/年", series:[
    { name:"人口1人当たり", unitLabel:"個/人・年", points:points(parcelPerCapita) },
    { name:"1世帯当たり", unitLabel:"個/世帯・年", points:points(parcelPerHousehold) }
  ], note:"人口当たりと世帯当たりの2方向からラストマイル需要密度を確認します。世帯系列は1月1日住民基本台帳との組合せのためproxyです。" });
  if (intensityChart) root.appendChild(intensityChart);
  if (hasData(households)) {
    const hhRow = el("div", "value-row");
    hhRow.appendChild(card("住民基本台帳 世帯数", households, "1月1日現在"));
    hhRow.appendChild(card("1世帯当たり宅配便", parcelPerHousehold, "年度宅配÷世帯数"));
    root.appendChild(hhRow);
    const hh2015 = households.observations?.find((o) => o.period === "2015");
    const hhNow = latest(households);
    const pph2015 = parcelPerHousehold?.observations?.find((o) => o.period === "2015");
    const pphNow = latest(parcelPerHousehold);
    if (hh2015 && hhNow && pph2015 && pphNow) {
      root.appendChild(sourceNote(`住民基本台帳世帯数は2015年${jp(hh2015.value,2)}百万世帯から2026年${jp(hhNow.value,2)}百万世帯へ増加。一方、1世帯当たり宅配便は2015年${jp(pph2015.value,1)}個から2024年${jp(pphNow.value,1)}個へ上昇しており、世帯細分化だけではなく世帯当たり配送需要も高まっています。`));
    }
  }

  if (hasData(physicalEc)) {
    root.appendChild(el("h3", "flow-block__sub", "EC demand context"));
    const ecRow = el("div", "value-row");
    ecRow.appendChild(card("物販系BtoC-EC市場", physicalEc, "物販のみ"));
    ecRow.appendChild(card("物販EC化率", physicalEcRate, "METI定義"));
    root.appendChild(ecRow);
    const ecCompareChart = chart({ kind:"line", unitLabel:"2015=100", series:[
      { name:"物販系BtoC-EC市場", unitLabel:"2015=100", points:points(physicalEcIndex) },
      { name:"宅配便個数", unitLabel:"2015=100", points:indexedPoints(parcelVolume) }
    ], note:"金額ベースの物販EC市場と物量ベースの宅配便個数を2015=100で比較。サービス・デジタルECは除外しています。" });
    if (ecCompareChart) root.appendChild(ecCompareChart);
    const ecNow = latest(physicalEcIndex);
    const parcelIdx = indexedPoints(parcelVolume).at(-1);
    if (ecNow && parcelIdx) root.appendChild(sourceNote(`2015→2024で物販系BtoC-EC市場は指数${jp(ecNow.value,1)}、宅配便個数は${jp(parcelIdx.y,1)}。EC取引金額の伸びが宅配個数を大きく上回っており、単純な「EC金額増=同率の配送個数増」ではありません。`));
  }

  root.appendChild(el("h3", "flow-block__sub", "Logistics workforce supply"));
  const workforceChart = chart({ kind:"line", unitLabel:"万人", series:[
    { name:"日本総就業者", unitLabel:"万人", points:points(totalEmployment) },
    { name:"運輸業・郵便業", unitLabel:"万人", points:points(employment) }
  ], note:"日本全体の就業者数と物流産業の就業者数を同じ年平均系列で比較します。" });
  if (workforceChart) root.appendChild(workforceChart);
  const shareChart = chart({ kind:"line", unitLabel:"%", series:[
    { name:"運輸・郵便 就業者シェア", unitLabel:"%", points:points(employmentShare) }
  ], note:"運輸業・郵便業就業者 ÷ 日本総就業者。物流が労働市場全体からどの程度人材を確保できているかを見る構造指標です。" });
  if (shareChart) root.appendChild(shareChart);

  if (hasData(tp55) && hasData(road55) && hasData(warehouse55)) {
    root.appendChild(el("h3", "flow-block__sub", "Workforce age structure"));
    const ageRow = el("div", "value-row");
    ageRow.appendChild(card("運輸・郵便 55歳以上", tp55, "年齢構造"));
    ageRow.appendChild(card("道路貨物 55歳以上", road55, "産業中分類"));
    ageRow.appendChild(card("倉庫業 55歳以上", warehouse55, "産業中分類"));
    ageRow.appendChild(card("道路貨物 就業者", roadEmployment, "年平均"));
    ageRow.appendChild(card("倉庫業 就業者", warehouseEmployment, "年平均"));
    root.appendChild(ageRow);

    const agingChart = chart({ kind:"line", unitLabel:"%", series:[
      { name:"運輸・郵便 55+", unitLabel:"%", points:points(tp55) },
      { name:"道路貨物 55+", unitLabel:"%", points:points(road55) },
      { name:"倉庫業 55+", unitLabel:"%", points:points(warehouse55) }
    ], note:"55–64歳 + 65歳以上 ÷ 各産業就業者。将来の退出圧力をみる指標です。" });
    if (agingChart) root.appendChild(agingChart);

    const replacementChart = chart({ kind:"line", unitLabel:"倍", series:[
      { name:"運輸・郵便 ≤34/55+", unitLabel:"倍", points:points(tpReplacement) },
      { name:"道路貨物 ≤34/55+", unitLabel:"倍", points:points(roadReplacement) },
      { name:"倉庫業 ≤34/55+", unitLabel:"倍", points:points(warehouseReplacement) }
    ], note:"34歳以下 ÷ 55歳以上。1を下回るほど若年層が高齢層より少なく、世代交代圧力が強いと解釈します。" });
    if (replacementChart) root.appendChild(replacementChart);

    const mixRow = el("div", "value-row");
    mixRow.appendChild(card("道路貨物 34歳以下", roadYoung, "若年比率"));
    mixRow.appendChild(card("道路貨物 女性比率", roadFemale, "労働供給余地"));
    mixRow.appendChild(card("倉庫業 34歳以下", warehouseYoung, "若年比率"));
    mixRow.appendChild(card("倉庫業 女性比率", warehouseFemale, "労働供給構造"));
    root.appendChild(mixRow);
  }

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
  popRow.appendChild(card("生産年齢人口比率", workingAgeShare, "15-64歳"));
  root.appendChild(popRow);

  const pop2015 = popTotal?.observations?.find((o) => o.period === "2015");
  const pop2025 = latest(popTotal);
  const work2015 = workingAge?.observations?.find((o) => o.period === "2015");
  const work2025 = latest(workingAge);
  if (pop2015 && pop2025 && work2015 && work2025) {
    const totalChange = (Number(pop2025.value) / Number(pop2015.value) - 1) * 100;
    const workChange = (Number(work2025.value) / Number(work2015.value) - 1) * 100;
    root.appendChild(sourceNote(`2015→2025で総人口は${jp(totalChange,1)}%、生産年齢人口は${jp(workChange,1)}%。物流人材の供給制約は業界固有の採用難だけでなく、母集団そのものの縮小と接続して見る必要があります。`));
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

  if (hasData(freightProductivity) || hasData(warehouseProductivity)) {
    root.appendChild(el("h3", "flow-block__sub", "Capacity / labor productivity"));
    const productivityRow = el("div", "value-row");
    productivityRow.appendChild(card("道路貨物 労働処理量", freightProductivity, "ton-km/就業者"));
    productivityRow.appendChild(card("倉庫 労働処理量", warehouseProductivity, "主要21社proxy"));
    root.appendChild(productivityRow);
    const freightChart = chart({ kind:"line", unitLabel:"千ton-km/人", series:[
      { name:"道路貨物", unitLabel:"千ton-km/人", points:points(freightProductivity) }
    ], note:"営業用トラック年間ton-km ÷ 道路貨物運送業就業者。道路貨物キャパシティを労働供給と接続する構造指標です。" });
    if (freightChart) root.appendChild(freightChart);
    const warehouseChart = chart({ kind:"line", unitLabel:"t/人", series:[
      { name:"倉庫", unitLabel:"t/人", points:points(warehouseProductivity) }
    ], note:"主要21社の営業普通倉庫入庫+出庫 ÷ 全国倉庫業就業者。対象範囲が一致しないため、企業生産性ではなく構造proxyです。" });
    if (warehouseChart) root.appendChild(warehouseChart);
  }

  root.appendChild(el("h3", "flow-block__sub", "Demand / capacity pressure"));
  const capacityChart = chart({ kind:"line", unitLabel:"2015=100", series:[
    { name:"宅配需要/物流労働力", unitLabel:"2015=100", points:points(loadIndex) }
  ], note:"宅配便個数 ÷ 運輸業・郵便業就業者を2015年=100に指数化。生産性ではなく需給圧力のproxyです。" });
  if (capacityChart) root.appendChild(capacityChart);
  const loadObs = latest(parcelPerWorker);
  if (loadObs) root.appendChild(sourceNote(`2024年のproxyは物流就業者1人あたり約${jp(loadObs.value,0)}個/年。2015年比では需要/労働力の負荷指数が約30.8%上昇しています。`));

  root.appendChild(sourceNote("次段: 外国人物流労働者・ドライバー数・賃金/労働時間の長期系列とトラック物理capacityを補強し、入力系列の時間整合性を確認したうえで複合Labor Capacity Stressを構築します。"));
}

mount().catch((err) => console.error("logistics structure mount failed", err));
