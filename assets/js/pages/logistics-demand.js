/* =========================================================================
   logistics-demand.js — 物流需要
   -------------------------------------------------------------------------
   Question: ラストマイルにかかる荷物の量は、どれだけ・なぜ増えているのか。

   Visualization decisions made here:
     · EC市場（金額）と宅配便（個数）は単位が違う。二軸線を使うと縮尺の選び方
       で結論が変わるため、2015=100 の指数比較にする。
     · 人口あたり・世帯あたりは水準ではなく「1人がどれだけ受け取るか」なので、
       指数ではなく実数の折れ線。
     · Parcel / worker は需要と労働供給の比なので、需要ページでは頭出しだけ
       行い、本体は労働力ページに置く（重複を避ける）。
   ========================================================================= */

import { el, byId, clear, root } from "../core/dom.js";
import { loadLogisticsBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { formatPct, formatPeriod } from "../core/units.js";
import { findSeries, latest, observations } from "../render/economy.js";
import { chart, indexedLine } from "../render/chart-kit.js";
import {
  pageHead, headlineSignal, indicator, indicatorRow, block, datasetEvidence, seeAlso
} from "../render/panel.js";

const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v))
  ? "未確認" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: d }));

const points = (series, transform) => observations(series).map((o) => ({
  period: o.period,
  value: transform ? transform(Number(o.value)) : Number(o.value),
  display: o.display
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

  const parcel = findSeries(bundle.parcel, "parcel_delivery_volume");
  const mail = findSeries(bundle.parcel, "mail_delivery_volume");
  const ecMarket = findSeries(bundle.ec, "physical_btoc_ec_market");
  const ecRate = findSeries(bundle.ec, "physical_btoc_ec_rate");
  const perCapita = findSeries(bundle.capacity, "parcel_per_capita");
  const perHousehold = findSeries(bundle.household, "parcel_per_household");
  const perWorker = findSeries(bundle.capacity, "parcel_per_transport_worker");

  const parcelLatest = latest(parcel);
  const parcelHistory = observations(parcel);
  const tenYearsAgo = parcelHistory.length > 10 ? parcelHistory[parcelHistory.length - 11] : parcelHistory[0];

  host.appendChild(pageHead({
    eyebrow: "物流需要",
    title: "ラストマイル需要",
    lead: "宅配便・メール便・物販EC を同じ時間軸で見て、荷物量が何によって増えているかを分解します。",
    question: "取扱個数はどこまで増えたか／EC市場と同じ速さで伸びているか／1人・1世帯あたりの受取頻度はどうなっているか"
  }));

  if (parcelLatest) {
    const growth = tenYearsAgo && Number(tenYearsAgo.value)
      ? ((Number(parcelLatest.value) / Number(tenYearsAgo.value)) - 1) * 100 : null;
    host.appendChild(headlineSignal({
      label: "宅配便取扱個数",
      value: num(Number(parcelLatest.value) / 100, 1),
      unit: `億個（${formatPeriod(parcelLatest.period)}）`,
      change: parcelLatest.yoy != null
        ? { text: `前年比 ${formatPct(parcelLatest.yoy)}`, tone: Number(parcelLatest.yoy) > 0 ? "up" : "down" }
        : null,
      reading: growth != null
        ? `${formatPeriod(tenYearsAgo.period)}比 ${formatPct(growth)}。伸びは続いていますが、直近の前年比は一桁前半に鈍化しています。`
        : "長期の伸びを評価するには観測が不足しています。",
      provenance: "official",
      tone: "watch"
    }));
  }

  host.appendChild(indicatorRow([
    ecRate && latest(ecRate) && indicator({
      label: "EC化率（物販系）",
      value: `${num(latest(ecRate).value, 2)}%`,
      meta: formatPeriod(latest(ecRate).period),
      provenance: "official"
    }),
    perCapita && latest(perCapita) && indicator({
      label: "1人あたり宅配便",
      value: `${num(latest(perCapita).value, 1)} 個/年`,
      meta: `${formatPeriod(latest(perCapita).period)} · 総人口で除した強度`,
      provenance: "derived"
    }),
    perHousehold && latest(perHousehold) && indicator({
      label: "1世帯あたり宅配便",
      value: `${num(latest(perHousehold).value, 1)} 個/年`,
      meta: formatPeriod(latest(perHousehold).period),
      provenance: "derived"
    }),
    perWorker && latest(perWorker) && indicator({
      label: "運輸・郵便就業者1人あたり",
      value: `${num(latest(perWorker).value, 0)} 個/年`,
      meta: "労働負荷の代理指標 → 物流労働力へ",
      provenance: "derived",
      href: `${root()}logistics-workforce.html#parcel-load`
    })
  ]));

  /* EC（金額）と宅配便（個数）: 単位が違うので指数で比較する。 */
  host.appendChild(block({
    id: "ec-vs-parcel",
    title: "EC市場と宅配便の伸びの差",
    purpose: "金額（EC市場）と個数（宅配便）は単位が異なるため、二軸ではなく2015=100の指数で比較します。EC金額の伸びに対して個数の伸びが緩やかなら、単価上昇や1配送あたり点数の増加が起きていることになります。",
    provenance: "official",
    figure: indexedLine({
      base: "2015",
      series: [
        parcel && { name: "宅配便取扱個数", points: points(parcel) },
        ecMarket && { name: "物販系BtoC-EC市場（金額）", points: points(ecMarket) }
      ].filter(Boolean),
      note: "宅配便は個数、ECは金額"
    }),
    caution: "宅配便は法人向け荷物を含み、純粋なB2C統計ではありません。EC市場は金額、宅配便は個数で、同じものを二通りに測った値ではありません。"
  }));

  host.appendChild(block({
    id: "intensity",
    title: "受け取り頻度：1人あたり・1世帯あたり",
    purpose: "総量ではなく強度で見ると、需要の伸びが人口増ではなく利用頻度の上昇によることが分かります。",
    provenance: "derived",
    figure: chart({
      kind: "line",
      unitLabel: "個/年",
      series: [
        perCapita && { name: "1人あたり", unitLabel: "個/年", points: points(perCapita) },
        perHousehold && { name: "1世帯あたり", unitLabel: "個/年", points: points(perHousehold) }
      ].filter(Boolean)
    }),
    caution: "分子の宅配便個数はB2C専用ではないため、EC利用頻度そのものではなくラストマイル需要の強度として読みます。"
  }));

  host.appendChild(block({
    id: "volume",
    title: "宅配便とメール便の水準",
    purpose: "小型軽量荷物の主戦場が郵便系メール便から宅配便へ移っているかを、実数で確認します。",
    provenance: "official",
    figure: chart({
      kind: "line",
      unitLabel: "百万個",
      series: [
        parcel && { name: "宅配便", unitLabel: "百万個", points: points(parcel) },
        mail && { name: "メール便", unitLabel: "百万個", points: points(mail) }
      ].filter(Boolean)
    }),
    caution: "2016年10月以降、ゆうパケットはメール便ではなく宅配便に計上されます。この定義変更をまたぐ長期比較には注意が必要です。"
  }));

  const ecFigure = chart({
    kind: "line", unitLabel: "%",
    series: ecRate ? [{ name: "EC化率（物販系）", unitLabel: "%", points: points(ecRate) }] : []
  });
  host.appendChild(block({
    id: "ec-rate",
    title: "EC化率",
    purpose: "小売全体に占める物販系ECの比率。需要構造の変化そのものであり、宅配便個数の先行指標として見ます。",
    provenance: "official",
    figure: ecFigure
  }));

  const notes = datasetEvidence([bundle.parcel, bundle.ec, bundle.household, bundle.capacity]);
  if (notes) host.appendChild(notes);

  host.appendChild(seeAlso([
    { href: `${root()}logistics-capacity.html`, text: "この荷物を運ぶ車両・事業者" },
    { href: `${root()}logistics-workforce.html`, text: "運ぶ人の供給" },
    { href: `${root()}structural-risk.html`, text: "需要と供給のギャップ" }
  ]));
}
