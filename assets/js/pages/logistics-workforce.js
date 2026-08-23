/* =========================================================================
   logistics-workforce.js — 物流労働力
   -------------------------------------------------------------------------
   Question: 荷物を運ぶ人は足りているのか、そして誰が運んでいるのか。

   Visualization decisions:
     · 年齢構成は6本の折れ線ではなく 100%積み上げ。構成比の問題だから。
       業種間の比較は small multiples（共通スケール）と slope（2時点）で行う。
     · ドライバーの賃金・労働時間・平均年齢は「全産業との差」が業務的な意味
       を持つので、単独の時系列ではなく dumbbell（全産業 vs トラック）。
     · 外国人材は「現在の雇用」と「制度上の受入れ見込（政策容量）」を同じ
       グラフに置かない。加算も接続もしない。
   ========================================================================= */

import { el, byId, clear, root } from "../core/dom.js";
import { loadLogisticsBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { findSeries, latest, observations } from "../render/economy.js";
import { chart, shareStack, smallMultiples, slopeChart, dumbbellChart } from "../render/chart-kit.js";
import {
  pageHead, headlineSignal, indicator, indicatorRow, block, datasetEvidence, seeAlso, provenanceBadge
} from "../render/panel.js";

const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v))
  ? "未確認" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: d }));

const points = (series) => observations(series).map((o) => ({
  period: o.period, value: Number(o.value), display: o.display
}));

const COHORTS = [
  ["15_24", "15〜24歳"], ["25_34", "25〜34歳"], ["35_44", "35〜44歳"],
  ["45_54", "45〜54歳"], ["55_64", "55〜64歳"], ["65_plus", "65歳以上"]
];

const INDUSTRIES = [
  ["transport_postal", "運輸業・郵便業"],
  ["road_freight", "道路貨物運送業"],
  ["warehousing", "倉庫業"]
];

const cohortSeries = (age, prefix) => COHORTS
  .map(([key, label]) => {
    const series = findSeries(age, `${prefix}_age_${key}`);
    return series ? { name: label, points: points(series) } : null;
  })
  .filter(Boolean);

export async function init() {
  const host = byId("page-root");
  if (!host) return;

  const [bundle, reports, news] = await Promise.all([
    loadLogisticsBundle(), loadReports(), loadCriticalNews()
  ]);
  mountShell({ reports: reports.reports, news: (news && news.items) || [] });
  bindLatestReportNav(reports.reports);
  markCurrent();
  clear(host);

  const age = bundle.workforceAge;
  const transportEmployment = findSeries(bundle.workforce, "transport_postal_employment");
  const share = findSeries(bundle.workforce, "transport_postal_employment_share");
  const roadOld = findSeries(age, "road_freight_age_55_plus_share");
  const roadYoung = findSeries(age, "road_freight_young_share");
  const roadReplacement = findSeries(age, "road_freight_replacement_ratio");
  const perWorker = findSeries(bundle.capacity, "parcel_per_transport_worker");
  const femaleShare = findSeries(age, "road_freight_female_share");

  host.appendChild(pageHead({
    eyebrow: "物流労働力",
    title: "運ぶ人の供給",
    lead: "就業者数・年齢構成・ドライバー処遇・外国人材を、産業統計と職業統計を混ぜずに並べます。",
    question: "物流の担い手は増えているか／高齢化はどこまで進んだか／若手はどれだけ入っているか／処遇は他産業とどれだけ違うか"
  }));

  const replacementLatest = latest(roadReplacement);
  if (replacementLatest) {
    const oldest = observations(roadReplacement)[0];
    host.appendChild(headlineSignal({
      label: "道路貨物運送業の世代交代比率（34歳以下 ÷ 55歳以上）",
      value: num(replacementLatest.value, 2),
      unit: `（${formatPeriod(replacementLatest.period)}）`,
      change: oldest ? {
        text: `${formatPeriod(oldest.period)} ${num(oldest.value, 2)} から`,
        tone: Number(replacementLatest.value) < Number(oldest.value) ? "up" : "down"
      } : null,
      reading: "1.0を下回るほど、退職期の人数に対して若手の入職が足りていないことを意味します。これは公式指標ではなく、公式の年齢階級値からLBIが算出した比率です。",
      provenance: "derived",
      tone: Number(replacementLatest.value) < 0.6 ? "alert" : "watch"
    }));
  }

  host.appendChild(indicatorRow([
    transportEmployment && latest(transportEmployment) && indicator({
      label: "運輸業・郵便業 就業者数",
      value: `${num(latest(transportEmployment).value, 0)} 万人`,
      meta: formatPeriod(latest(transportEmployment).period),
      provenance: "official"
    }),
    share && latest(share) && indicator({
      label: "全就業者に占める比率",
      value: `${num(latest(share).value, 2)}%`,
      meta: formatPeriod(latest(share).period),
      provenance: "official"
    }),
    roadOld && latest(roadOld) && indicator({
      label: "道路貨物 55歳以上比率",
      value: `${num(latest(roadOld).value, 1)}%`,
      meta: formatPeriod(latest(roadOld).period),
      provenance: "derived"
    }),
    femaleShare && latest(femaleShare) && indicator({
      label: "道路貨物 女性比率",
      value: `${num(latest(femaleShare).value, 1)}%`,
      meta: formatPeriod(latest(femaleShare).period),
      provenance: "derived"
    })
  ]));

  host.appendChild(block({
    id: "age-structure",
    title: "年齢構成の変化（道路貨物運送業）",
    purpose: "人数の増減ではなく「誰で構成されているか」の問題なので、100%積み上げで見ます。帯の下側（若年）が薄くなり上側（高齢）が厚くなる動きが、担い手不足の実体です。",
    provenance: "official",
    figure: shareStack({
      categories: cohortSeries(age, "road_freight"),
      highlight: "65歳以上",
      note: "労働力調査（産業分類45）"
    }),
    caution: "道路貨物運送業は産業統計です。トラックドライバーという職業統計とは範囲が異なります（運転以外の職種も含みます）。"
  }));

  const slopeRows = INDUSTRIES.map(([prefix, label]) => {
    const oldShare = findSeries(age, `${prefix}_age_55_plus_share`);
    const list = observations(oldShare);
    if (list.length < 2) return null;
    return { name: label, from: Number(list[0].value), to: Number(list[list.length - 1].value), periods: [list[0].period, list[list.length - 1].period] };
  }).filter(Boolean);

  if (slopeRows.length) {
    host.appendChild(block({
      id: "aging-slope",
      title: "業種別の高齢化スピード",
      purpose: "3業種の55歳以上比率を2時点で結び、どの業種がどれだけ速く高齢化したかを1枚で比較します。線の傾きがそのまま速度です。",
      provenance: "derived",
      figure: slopeChart({
        rows: slopeRows.map(({ name, from, to }) => ({ name, from, to })),
        fromLabel: formatPeriod(slopeRows[0].periods[0]),
        toLabel: formatPeriod(slopeRows[0].periods[1]),
        unitLabel: "%（55歳以上比率）"
      }),
      caution: "55歳以上比率は公式の年齢階級値からLBIが算出した派生値です。"
    }));
  }

  host.appendChild(block({
    id: "cohort-multiples",
    title: "年齢階級別の人数（道路貨物運送業）",
    purpose: "構成比では見えない実数の増減を、階級ごとの小さなパネルで確認します。全パネル共通スケールなので、階級間の規模差もそのまま読めます。",
    provenance: "official",
    figure: smallMultiples({
      series: cohortSeries(age, "road_freight"),
      unitLabel: "万人"
    })
  }));

  const ageSeries = ["all_industries_average_age",
                     "commercial_large_truck_driver_average_age",
                     "commercial_small_truck_driver_average_age"]
    .map((id) => findSeries(bundle.driverAge, id));
  const commonYear = ageSeries.every(Boolean)
    ? ageSeries.map((s) => observations(s).map((o) => o.period))
        .reduce((acc, list) => acc.filter((period) => list.includes(period)))
        .sort().pop()
    : null;
  const at = (series) => (series && commonYear
    ? observations(series).find((o) => o.period === commonYear) : null);
  const [allAge, largeAge, smallAge] = ageSeries.map(at);

  const hist = bundle.driverLabor;
  const histYear = (() => {
    const lists = ["all_industries_annual_income", "large_truck_driver_annual_income",
                   "all_industries_annual_work_hours", "large_truck_driver_annual_work_hours"]
      .map((id) => observations(findSeries(hist, id)).map((o) => o.period))
      .filter((list) => list.length);
    return lists.length ? lists.reduce((acc, list) => acc.filter((p) => list.includes(p))).sort().pop() : null;
  })();
  const atYear = (id) => {
    const series = findSeries(hist, id);
    return series && histYear ? observations(series).find((o) => o.period === histYear) : null;
  };

  const gapRows = [
    allAge && largeAge && { name: "平均年齢：大型トラック", a: Number(allAge.value), b: Number(largeAge.value),
      gapText: `${num(Number(largeAge.value) - Number(allAge.value), 1)} 歳` },
    allAge && smallAge && { name: "平均年齢：中小型トラック", a: Number(allAge.value), b: Number(smallAge.value),
      gapText: `${num(Number(smallAge.value) - Number(allAge.value), 1)} 歳` }
  ].filter(Boolean);

  const incomeRows = [
    ["年間所得：大型トラック", "all_industries_annual_income", "large_truck_driver_annual_income", "万円"],
    ["年間所得：中小型トラック", "all_industries_annual_income", "small_medium_truck_driver_annual_income", "万円"],
    ["年間労働時間：大型トラック", "all_industries_annual_work_hours", "large_truck_driver_annual_work_hours", "時間"],
    ["年間労働時間：中小型トラック", "all_industries_annual_work_hours", "small_medium_truck_driver_annual_work_hours", "時間"]
  ].map(([label, baseId, driverId, unit]) => {
    const base = atYear(baseId), driver = atYear(driverId);
    if (!base || !driver) return null;
    const diff = Number(driver.value) - Number(base.value);
    return { name: label, a: Number(base.value), b: Number(driver.value),
      gapText: `${diff > 0 ? "+" : ""}${num(diff, 0)} ${unit}` };
  }).filter(Boolean);

  if (gapRows.length) {
    host.appendChild(block({
      id: "driver-gap",
      title: "全産業とドライバーの差",
      purpose: "水準そのものより「全産業との差」が採用競争力を決めます。同一年・同一出典で比較できる平均年齢を並べました。",
      provenance: "official",
      figure: dumbbellChart({
        rows: gapRows,
        aName: "全産業平均",
        bName: "トラック運転者",
        unitLabel: "歳",
        note: `${formatPeriod(commonYear)} 時点（3系列で共通して観測がある最新年）`
      }),
      caution: "賃金・労働時間は出典と概念（求人票ベースと就業者統計）が異なるため、同一図での差分表示は行わず、下の表に条件付きで併記します。"
    }));
  }

  const laborRows = [
    ["トラックドライバー 平均年齢", "truck_driver_average_age_2025", "歳", "official"],
    ["トラックドライバー 年収", "truck_driver_annual_income", "万円/年", "official"],
    ["トラックドライバー 月間労働時間", "truck_driver_monthly_work_hours", "時間/月", "official"],
    ["トラックドライバー 有効求人倍率", "truck_driver_job_openings_ratio", "倍", "official"],
    ["トラックドライバー 求人賃金", "truck_driver_offered_monthly_wage", "万円/月", "official"]
  ].map(([label, id, unit]) => {
    const obs = latest(findSeries(bundle.laborMarket, id));
    return obs ? [label, `${num(obs.value, 1)} ${unit}`, formatPeriod(obs.period)] : null;
  }).filter(Boolean);

  if (laborRows.length) {
    const table = el("table", "data-table");
    const thead = el("thead");
    const hr = el("tr");
    ["指標", "値", "時点"].forEach((h) => { const th = el("th", null, h); th.setAttribute("scope", "col"); hr.appendChild(th); });
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el("tbody");
    laborRows.forEach((row) => {
      const tr = el("tr");
      row.forEach((cell, i) => tr.appendChild(el("td", i === 1 ? "num" : null, cell)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = el("div", "table-scroll");
    wrap.appendChild(table);

    host.appendChild(block({
      id: "driver-conditions",
      title: "ドライバーの処遇（job tag 加工統計）",
      purpose: "求人倍率・年収・労働時間は出典も概念も異なるため、時系列を重ねず一覧で示します。",
      provenance: "official",
      figure: wrap,
      caution: "job tag のトラックドライバーは複数職業を集約した職業情報で、道路貨物運送業（産業統計）や国土交通省の貨物自動車運転手系列とは定義が異なります。2025年度 job tag 2.94倍を 2018–2024 の貨物運転者系列に接続してはいけません。"
    }));
  }

  if (incomeRows.length) {
    host.appendChild(block({
      id: "driver-treatment-gap",
      title: `処遇の格差：全産業平均との差（${formatPeriod(histYear)}）`,
      purpose: "長く働いて、収入は低い。水準を別々の折れ線で見るとこの関係が読み取れないため、同一年・同一出典の値を対で並べ、差を右端に出します。採用競争力に直結する数字です。",
      provenance: "official",
      figure: dumbbellChart({
        rows: incomeRows,
        aName: "全産業平均",
        bName: "トラック運転者",
        note: "国土交通省が同一グラフで遡及掲載している系列"
      }),
      caution: "2024年4月から自動車運転者にも時間外労働の上限規制が適用されています。2024年は制度変更後の最初の年次観測です。2025年 job tag の年収・労働時間はこの車格別長期系列に接続していません。"
    }));

    const gapSeries = ["large_truck_income_gap_vs_all", "small_medium_truck_income_gap_vs_all",
                       "large_truck_work_hours_premium_vs_all"]
      .map((id) => findSeries(hist, id)).filter(Boolean);
    if (gapSeries.length) {
      host.appendChild(block({
        id: "driver-gap-trend",
        title: "格差は縮んでいるか",
        purpose: "水準ではなく差の推移。所得差がマイナス、労働時間差がプラスのまま推移していれば、制度改正後も採用条件の不利は解消していないことになります。",
        provenance: "derived",
        figure: chart({
          kind: "line", unitLabel: "%",
          series: gapSeries.map((s) => ({ name: s.name_ja || s.metric_id, unitLabel: "%", points: points(s) }))
        }),
        caution: "全産業平均に対する比率としてLBIが算出した派生値です。"
      }));
    }
  }

  const vacancyDriver = findSeries(bundle.laborMarket, "automobile_driver_job_openings_ratio_history");
  const vacancyAll = findSeries(bundle.laborMarket, "all_occupations_job_openings_ratio_history");
  if (vacancyDriver && vacancyAll) {
    host.appendChild(block({
      id: "vacancy",
      title: "有効求人倍率：自動車運転の職業 vs 全職業",
      purpose: "同一出典・同一定義で接続できる長期系列だけを使い、労働市場の逼迫度の差を見ます。",
      provenance: "official",
      figure: chart({
        kind: "line", unitLabel: "倍",
        series: [
          { name: "自動車運転の職業", unitLabel: "倍", points: points(vacancyDriver) },
          { name: "全職業", unitLabel: "倍", points: points(vacancyAll) }
        ]
      }),
      caution: "この長期系列に job tag のトラックドライバー系列は接続していません（分類・集約条件が異なるため）。"
    }));
  }

  if (perWorker) {
    host.appendChild(block({
      id: "parcel-load",
      title: "就業者1人あたり宅配便個数",
      purpose: "需要（個数）を労働供給（就業者）で割った負荷の代理指標。生産性そのものではありません。",
      provenance: "derived",
      figure: chart({
        kind: "line", unitLabel: "個/人・年",
        series: [{ name: "運輸・郵便 就業者1人あたり", unitLabel: "個/人・年", points: points(perWorker) }]
      }),
      caution: "分子の宅配便には法人向けを含み、分母の就業者には宅配以外の運輸・郵便従事者を含みます。方向を見るための比率であり、労働生産性ではありません。"
    }));
  }

  const foreignTransport = findSeries(bundle.foreignWorkforce, "transport_postal_foreign_workers");
  const sswResidents = findSeries(bundle.foreignPipeline, "ssw_auto_transport_residents");
  const intakeAuto = latest(findSeries(bundle.foreignPipeline, "ssw_auto_transport_intake_capacity_to_2029_03"));
  const intakeWarehouse = latest(findSeries(bundle.foreignPipeline, "ssw_logistics_warehouse_intake_capacity_to_2029_03"));

  const foreignWrap = el("div", "split-grid");
  const employmentSide = el("div", "split-grid__col");
  const employmentHead = el("div", "split-grid__head");
  employmentHead.appendChild(el("h3", "split-grid__title", "現在の雇用（実績）"));
  employmentHead.appendChild(provenanceBadge("official"));
  employmentSide.appendChild(employmentHead);
  const foreignFigure = chart({
    kind: "bar", unitLabel: "人",
    series: foreignTransport ? [{ name: "運輸業・郵便業の外国人労働者", unitLabel: "人", points: points(foreignTransport) }] : []
  });
  if (foreignFigure) employmentSide.appendChild(foreignFigure);
  const sswObs = observations(sswResidents);
  if (sswObs.length) {
    employmentSide.appendChild(el("p", "split-grid__note",
      `うち特定技能・自動車運送業の在留者は ${formatPeriod(sswObs[sswObs.length - 1].period)} 時点で ${num(sswObs[sswObs.length - 1].value, 0)} 人。` +
      "厚生労働省の外国人雇用状況とは別定義のため合算しません。"));
  }
  foreignWrap.appendChild(employmentSide);

  const policySide = el("div", "split-grid__col");
  const policyHead = el("div", "split-grid__head");
  policyHead.appendChild(el("h3", "split-grid__title", "制度上の受入れ見込（政策容量）"));
  policyHead.appendChild(provenanceBadge("official"));
  policySide.appendChild(policyHead);
  const policyList = el("dl", "policy-list");
  [[intakeAuto, "自動車運送業"], [intakeWarehouse, "物流倉庫"]].forEach(([obs, label]) => {
    if (!obs) return;
    policyList.appendChild(el("dt", null, label));
    policyList.appendChild(el("dd", null, `${num(obs.value, 0)} 人（${formatPeriod(obs.period)} までの受入れ見込数）`));
  });
  policySide.appendChild(policyList);
  policySide.appendChild(el("p", "split-grid__note",
    "受入れ見込数は制度上の上限・容量であり、現在の在留者数でも採用確約数でもありません。現在の雇用と同じ図には置きません。"));
  foreignWrap.appendChild(policySide);

  host.appendChild(block({
    id: "foreign-workforce",
    title: "外国人材：実績と政策容量",
    purpose: "「今どれだけ働いているか」と「制度上どれだけ受け入れられるか」は別の量です。左右に分けて、加算も接続もしない形で示します。",
    provenance: "official",
    figure: foreignWrap
  }));

  const notes = datasetEvidence([
    bundle.workforce, bundle.workforceAge, bundle.laborMarket, bundle.driverAge, bundle.driverLabor,
    bundle.roadFreightDrivers, bundle.foreignWorkforce, bundle.foreignPipeline
  ]);
  if (notes) host.appendChild(notes);

  host.appendChild(seeAlso([
    { href: `${root()}logistics-demand.html`, text: "運ぶ荷物の量" },
    { href: `${root()}logistics-capacity.html`, text: "車両と事業者" },
    { href: `${root()}structural-risk.html`, text: "労働キャパシティ・ストレス" }
  ]));
}
