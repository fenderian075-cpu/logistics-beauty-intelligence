/* =========================================================================
   structural-risk.js — 構造リスク
   -------------------------------------------------------------------------
   Question: 需要と労働供給のギャップは、どの方向に、何によって開いているか。

   This page carries the only DIAGNOSTIC object in LBI — the Labor Capacity
   Stress index — so its whole job is to be honest about what that number is:

     composite trend        総合の水準と方向
     component contribution 何がスコアを押し上げているか（基準100からの差）
     component profile      直近の要素プロファイル（小パネル）
     sensitivity band       1要素を外したときの振れ幅
     population base        その背後にある労働供給の母集団

   Visualization decisions:
     · 総合＋5要素を6本の折れ線で重ねない。総合は帯付き折れ線（感度）、
       要素は基準100からの差の水平バーにして「寄与」として読ませる。
     · 人口は水準の折れ線ではなく、生産年齢人口比率と実数を分けて出す。
   ========================================================================= */

import { el, byId, clear, root } from "../core/dom.js";
import { loadLogisticsBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { findSeries, latest, observations } from "../render/economy.js";
import { chart, smallMultiples, contributionChart, rangeBand } from "../render/chart-kit.js";
import {
  pageHead, headlineSignal, indicator, indicatorRow, block, evidence, datasetEvidence, seeAlso
} from "../render/panel.js";

const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v))
  ? "未確認" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: d }));

const points = (series) => observations(series).map((o) => ({
  period: o.period, value: Number(o.value), display: o.display
}));

const COMPONENTS = [
  ["parcel_labor_load_pressure_v1", "宅配便の労働負荷"],
  ["freight_driver_vacancy_pressure_v1", "貨物運転者の求人逼迫"],
  ["road_freight_aging_pressure_v1", "道路貨物の高齢化"],
  ["road_freight_replacement_pressure_v1", "世代交代の不足"],
  ["working_age_supply_pressure_v1", "生産年齢人口の減少"]
];

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

  const stress = bundle.stress;
  const composite = findSeries(stress, "labor_capacity_stress_v1");
  const compositeObs = composite ? observations(composite) : [];
  const compositeLatest = compositeObs.length ? compositeObs[compositeObs.length - 1] : null;
  const methodology = stress.methodology || {};

  host.appendChild(pageHead({
    eyebrow: "構造リスク",
    title: "労働キャパシティ・ストレス",
    lead: "需要の伸びと労働供給の細りを、2018年=100の透明な診断指数として1本にまとめ、何がそれを押し上げているかを分解します。",
    question: "ストレスは上がっているのか／どの要素が効いているのか／1要素の定義を変えたら結論は変わるのか"
  }));

  if (compositeLatest) {
    const base = compositeObs[0];
    host.appendChild(headlineSignal({
      label: "労働キャパシティ・ストレス指数 v1",
      value: num(compositeLatest.value, 1),
      unit: `（${formatPeriod(compositeLatest.period)} · 2018年=100）`,
      change: base ? {
        text: `${formatPeriod(base.period)} 100 から ${formatPct(Number(compositeLatest.value) - 100, { digits: 1 })}`,
        tone: Number(compositeLatest.value) > 100 ? "up" : "down"
      } : null,
      reading: "5要素を各20%で単純平均した、LBI独自の診断指数です。公的統計・公的指数ではありません。水準そのものより、方向と、どの要素が押し上げているかを読んでください。",
      provenance: "diagnostic",
      tone: Number(compositeLatest.value) >= 110 ? "alert" : "watch"
    }));
  }

  host.appendChild(indicatorRow(COMPONENTS.map(([id, label]) => {
    const obs = latest(findSeries(stress, id));
    return obs ? indicator({
      label,
      value: num(obs.value, 1),
      meta: `${formatPeriod(obs.period)} · 2018=100`,
      provenance: "diagnostic",
      tone: Number(obs.value) >= 115 ? "alert" : Number(obs.value) >= 105 ? "watch" : null
    }) : null;
  })));

  host.appendChild(block({
    id: "composite",
    title: "総合指数と感度範囲",
    purpose: "太線が総合指数、帯は5要素のうち1つを除いて再計算した場合の範囲です。帯が細ければ、結論は特定の要素に依存していません。",
    provenance: "diagnostic",
    figure: rangeBand({
      center: { name: "総合指数", points: points(composite) },
      bands: (bundle.sensitivity.series || [])
        .filter((s) => /^stress_without_/.test(s.metric_id))
        .map((s) => ({ name: s.name_ja || s.metric_id, points: points(s) }))
    }),
    caution: "感度分析は「その要素を外した場合」の再計算であり、要素の寄与度そのものではありません。ウェイトは5要素×20%の固定です。"
  }));

  const contributionRows = COMPONENTS.map(([id, label]) => {
    const obs = latest(findSeries(stress, id));
    return obs ? { name: label, value: Number(obs.value) } : null;
  }).filter(Boolean);

  host.appendChild(block({
    id: "contribution",
    title: "何がスコアを押し上げているか",
    purpose: "各要素の直近水準を、基準100からの差として並べます。右に伸びるほど2018年比で悪化している要素です。折れ線を5本重ねるより、寄与の大小が一目で分かります。",
    provenance: "diagnostic",
    figure: contributionChart({
      rows: contributionRows.sort((a, b) => b.value - a.value),
      baseline: 100,
      unitLabel: "2018=100",
      note: compositeLatest ? `${formatPeriod(compositeLatest.period)} 時点` : null
    }),
    caution: "各要素は等ウェイト（20%）です。差の大きさは寄与の大きさに比例しますが、要素間の重要度をLBIが判断した結果ではありません。"
  }));

  host.appendChild(block({
    id: "component-trend",
    title: "要素別の推移",
    purpose: "どの要素がいつから動いたか。共通スケールの小パネルで、同時に動いたのか順番に動いたのかを確認します。",
    provenance: "diagnostic",
    figure: smallMultiples({
      series: COMPONENTS.map(([id, label]) => {
        const series = findSeries(stress, id);
        return series ? { name: label, points: points(series) } : null;
      }).filter(Boolean),
      unitLabel: "2018=100"
    })
  }));

  const workingAgeShare = findSeries(bundle.demography, "working_age_share");
  const workingAge = findSeries(bundle.demography, "working_age_population_15_64");
  const total = findSeries(bundle.demography, "population_total");
  const elderly = findSeries(bundle.demography, "population_age_65_plus");

  host.appendChild(block({
    id: "population",
    title: "労働供給の母集団",
    purpose: "ストレス指数の最も動きにくい要素。生産年齢人口は物流だけの問題ではなく、他産業との人材獲得競争の前提です。",
    provenance: "official",
    figure: chart({
      kind: "line", unitLabel: "百万人",
      series: [
        total && { name: "総人口", unitLabel: "百万人", points: points(total) },
        workingAge && { name: "生産年齢人口（15〜64歳）", unitLabel: "百万人", points: points(workingAge) },
        elderly && { name: "65歳以上", unitLabel: "百万人", points: points(elderly) }
      ].filter(Boolean)
    }),
    caution: "各年10月1日現在の人口推計を正本としています。国勢調査速報値は別系列であり、推計値と安易に連結していません。",
    extra: workingAgeShare ? chart({
      kind: "line", unitLabel: "%",
      series: [{ name: "生産年齢人口比率", unitLabel: "%", points: points(workingAgeShare) }]
    }) : null
  }));

  const method = el("div");
  if (methodology.version) {
    const dl = el("dl", "policy-list");
    [["バージョン", methodology.version],
     ["対象期間", methodology.common_period],
     ["基準年", methodology.base_year],
     ["ウェイト", Object.entries(methodology.weights || {}).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" / ")]
    ].forEach(([term, desc]) => {
      if (!desc) return;
      dl.appendChild(el("dt", null, term));
      dl.appendChild(el("dd", null, String(desc)));
    });
    method.appendChild(dl);
  }
  host.appendChild(evidence({
    title: "この指数の作り方（DIAGNOSTIC）",
    notes: stress.notes || [],
    extra: method
  }));

  const notes = datasetEvidence([bundle.sensitivity, bundle.demography], { title: "感度分析・人口の定義と出典" });
  if (notes) host.appendChild(notes);

  host.appendChild(seeAlso([
    { href: `${root()}logistics-demand.html`, text: "需要側の実数" },
    { href: `${root()}logistics-workforce.html`, text: "労働供給の実数" },
    { href: `${root()}logistics-capacity.html`, text: "物理キャパシティ" }
  ]));
}
