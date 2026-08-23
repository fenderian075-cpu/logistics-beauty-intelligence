/* =========================================================================
   logistics-capacity.js — 輸送キャパシティ
   -------------------------------------------------------------------------
   Question: 荷物を運ぶ「箱と事業者」はどう変わったか、1台・1人あたりどれだけ
   運んでいるか。

   Visualization decisions:
     · 事業者数・車両数・1事業者あたり車両数を別々の折れ線にすると、業界の
       集約という一つの話が三つに割れる。事業者数と車両数を指数で重ね、
       1事業者あたり台数を別図にして「割り算の結果」だと分かるようにする。
     · 営業用と自家用は構成比の話なので100%積み上げ。トン数とトンキロで
       構成が違うこと自体が知見なので、2本並べる。
     · 生産性（ton-km/vehicle, ton-km/worker, 倉庫）は派生値なので DERIVED を
       付け、scope mismatch を各図に明記する。
   ========================================================================= */

import { el, byId, clear, root } from "../core/dom.js";
import { loadLogisticsBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { findSeries, latest, observations } from "../render/economy.js";
import { chart, indexedLine, shareStack, smallMultiples } from "../render/chart-kit.js";
import {
  pageHead, headlineSignal, indicator, indicatorRow, block, datasetEvidence, seeAlso
} from "../render/panel.js";

const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v))
  ? "未確認" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: d }));

const points = (series) => observations(series).map((o) => ({
  period: o.period, value: Number(o.value), display: o.display
}));

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

  const operators = findSeries(bundle.physicalCapacity, "truck_operators");
  const vehicles = findSeries(bundle.physicalCapacity, "commercial_truck_vehicles");
  const perOperator = findSeries(bundle.physicalCapacity, "vehicles_per_operator");
  const tonKmPerVehicle = findSeries(bundle.physicalCapacity, "ton_km_per_vehicle");
  const freightProductivity = findSeries(bundle.capacity, "freight_labor_productivity");
  const warehouseProductivity = findSeries(bundle.capacity, "warehouse_labor_productivity");

  host.appendChild(pageHead({
    eyebrow: "輸送キャパシティ",
    title: "車両・事業者・輸送仕事量",
    lead: "事業者数と車両数、営業用と自家用の構成、そして1台・1人あたりの輸送仕事量を、同じ物差しで並べます。",
    question: "運べる箱は増えているか／業界は集約しているか／1台あたりの稼働はどう変わったか／営業用への集中は進んでいるか"
  }));

  const perOperatorLatest = latest(perOperator);
  if (perOperatorLatest) {
    const first = observations(perOperator)[0];
    host.appendChild(headlineSignal({
      label: "1事業者あたり車両数",
      value: num(perOperatorLatest.value, 1),
      unit: `台（${formatPeriod(perOperatorLatest.period)}）`,
      change: first ? {
        text: `${formatPeriod(first.period)} 比 ${formatPct(((Number(perOperatorLatest.value) / Number(first.value)) - 1) * 100)}`,
        tone: Number(perOperatorLatest.value) > Number(first.value) ? "up" : "down"
      } : null,
      reading: "車両数がほぼ横ばいで事業者数が減れば、この値は上がります。業界集約の程度を1つの数字で見るための指標です。",
      provenance: "derived"
    }));
  }

  host.appendChild(indicatorRow([
    operators && latest(operators) && indicator({
      label: "貨物自動車運送事業者数",
      value: `${num(latest(operators).value, 0)} 者`,
      meta: formatPeriod(latest(operators).period),
      provenance: "official"
    }),
    vehicles && latest(vehicles) && indicator({
      label: "営業用トラック車両数",
      value: `${num(latest(vehicles).value, 0)} 台`,
      meta: formatPeriod(latest(vehicles).period),
      provenance: "official"
    }),
    tonKmPerVehicle && latest(tonKmPerVehicle) && indicator({
      label: "1台あたり輸送トンキロ",
      value: `${num(latest(tonKmPerVehicle).value, 1)} 千トンキロ/年`,
      meta: formatPeriod(latest(tonKmPerVehicle).period),
      provenance: "derived"
    }),
    freightProductivity && latest(freightProductivity) && indicator({
      label: "道路貨物 就業者1人あたり",
      value: `${num(latest(freightProductivity).value, 1)} 千トンキロ/年`,
      meta: "代理指標",
      provenance: "derived"
    })
  ]));

  host.appendChild(block({
    id: "consolidation",
    title: "事業者数と車両数：業界集約",
    purpose: "台数（数万台）と事業者数（数万者）は桁が近くても意味が違います。水準の重ね描きではなく指数で、どちらがどれだけ動いたかを比較します。",
    provenance: "official",
    figure: indexedLine({
      series: [
        operators && { name: "事業者数", points: points(operators) },
        vehicles && { name: "営業用トラック車両数", points: points(vehicles) }
      ].filter(Boolean),
      note: "初年=100"
    }),
    caution: "事業者数は許可事業者ベースで、稼働の有無を示しません。"
  }));

  host.appendChild(block({
    id: "per-operator",
    title: "1事業者あたり車両数",
    purpose: "上の2系列の割り算そのもの。別図にすることで、これが観測値ではなく比率であることを明示します。",
    provenance: "derived",
    figure: chart({
      kind: "line", unitLabel: "台/者",
      series: perOperator ? [{ name: "1事業者あたり車両数", unitLabel: "台/者", points: points(perOperator) }] : []
    })
  }));

  const tonnage = [
    findSeries(bundle.businessStructure, "commercial_tonnage_post2020"),
    findSeries(bundle.businessStructure, "own_account_tonnage_post2020")
  ];
  const tonKm = [
    findSeries(bundle.businessStructure, "commercial_ton_km_post2020"),
    findSeries(bundle.businessStructure, "own_account_ton_km_post2020")
  ];

  if (tonnage[0] && tonnage[1]) {
    host.appendChild(block({
      id: "commercial-share-tonnage",
      title: "営業用・自家用の構成（輸送トン数）",
      purpose: "何割を運送事業者が運んでいるかという構成比の問題なので、100%積み上げで見ます。",
      provenance: "official",
      figure: shareStack({
        categories: [
          { name: "営業用", points: points(tonnage[0]) },
          { name: "自家用", points: points(tonnage[1]) }
        ],
        note: "2020年度以降のみ"
      }),
      caution: "2020年4月に調査・集計方法が変更され、国土交通省は前後の連続性を保証していません。本図は2020年度以降のみを連続系列として扱い、2019年度以前と接続していません。"
    }));
  }

  if (tonKm[0] && tonKm[1]) {
    host.appendChild(block({
      id: "commercial-share-tonkm",
      title: "営業用・自家用の構成（輸送トンキロ）",
      purpose: "トン数とトンキロで構成比が異なること自体が知見です。距離を加味した輸送仕事量では営業用の比重がさらに高くなります。",
      provenance: "official",
      figure: shareStack({
        categories: [
          { name: "営業用", points: points(tonKm[0]) },
          { name: "自家用", points: points(tonKm[1]) }
        ],
        note: "2020年度以降のみ"
      }),
      caution: "トン数は物量、トンキロは距離を加味した輸送仕事量です。両者を同じ「シェア」として混同しないでください。"
    }));
  }

  host.appendChild(block({
    id: "productivity",
    title: "1台あたり・1人あたりの輸送仕事量",
    purpose: "キャパシティが増えたのか、同じ設備をより多く使っているのかを分けます。3つは単位が異なるため、パネルごとに独立スケールにしています（高さの比較はできません。読むのは各パネルの向きです）。",
    provenance: "derived",
    figure: smallMultiples({
      perPanelScale: true,
      series: [
        tonKmPerVehicle && { name: "1台あたり", unitLabel: "千トンキロ/台・年", points: points(tonKmPerVehicle) },
        freightProductivity && { name: "道路貨物 1人あたり", unitLabel: "千トンキロ/人・年", points: points(freightProductivity) },
        warehouseProductivity && { name: "倉庫 1人あたり", unitLabel: "トン/人・年", points: points(warehouseProductivity) }
      ].filter(Boolean)
    }),
    caution: "いずれもLBIの派生値です。特に倉庫は、分子が営業普通倉庫の主要21社系列、分母が全国倉庫業就業者で範囲が一致しません（scope mismatch）。企業の生産性ではなく構造の方向を見る代理指標です。"
  }));

  const warehouse = bundle.warehouse;
  const warehouseSeries = (warehouse.series || []).filter((s) => observations(s).length >= 2);
  if (warehouseSeries.length) {
    host.appendChild(block({
      id: "warehouse",
      title: "倉庫の荷動き",
      purpose: "入庫・出庫・保管残高の関係から、在庫が積み上がっているのか流れているのかを見ます。",
      provenance: "official",
      figure: chart({
        kind: "line",
        unitLabel: "トン",
        series: warehouseSeries.map((s) => ({ name: s.name_ja || s.metric_id, unitLabel: "トン", points: points(s) }))
      })
    }));
  } else {
    host.appendChild(block({
      id: "warehouse",
      title: "倉庫の荷動き",
      purpose: "入庫・出庫・保管残高。",
      provenance: "official",
      figure: null,
      caution: "月次観測は取得待ちです。推測値では補完していません。"
    }));
  }

  const notes = datasetEvidence([
    bundle.physicalCapacity, bundle.businessStructure, bundle.capacity, bundle.warehouse, bundle.trucking
  ]);
  if (notes) host.appendChild(notes);

  host.appendChild(seeAlso([
    { href: `${root()}logistics-demand.html`, text: "運ぶ荷物の量" },
    { href: `${root()}logistics-workforce.html`, text: "運転する人の供給" },
    { href: `${root()}economic-flow.html#cost`, text: "輸送コスト" }
  ]));
}
