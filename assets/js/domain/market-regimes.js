/* =========================================================================
   market-regimes.js — deterministic cross-source regime classification.
   -------------------------------------------------------------------------
   Principles:
   - Rate != Supply != Demand != Reliability != Risk.
   - Promotion/buzz are leading or attention signals, never proof of organic demand.
   - Official retail/shipment/trade observations are confirmation layers.
   - Industry market research is structural/category context, not current demand proof.
   - A single price print cannot create a capacity-tightness regime by itself.
   ========================================================================= */

const CHANGE_SCORE = {
  regime_shift: 3,
  acceleration: 2,
  deterioration: 2,
  improvement: -1,
  normalization: -1,
  no_material_change: 0
};

const MATERIALITY_WEIGHT = {
  structural: 3,
  material: 2,
  notable: 1,
  routine: 0
};

function score(item) {
  return (CHANGE_SCORE[item.market_change] || 0) *
         (MATERIALITY_WEIGHT[item.market_materiality] || 0);
}

function byDimension(items, dimension) {
  return items.filter((item) => item.market_dimension === dimension);
}

function latestObservation(series) {
  const obs = (series && series.observations) || [];
  return obs.slice().sort((a, b) => String(b.period || b.published_at || "")
    .localeCompare(String(a.period || a.published_at || "")))[0] || null;
}

function latestMetric(dataset, metricId) {
  const series = ((dataset && dataset.series) || []).find((row) => row.metric_id === metricId);
  return latestObservation(series);
}

function daysOld(dateString) {
  if (!dateString) return null;
  const ts = Date.parse(dateString);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function visibleNews(newsData) {
  return ((newsData && newsData.items) || []).filter((item) =>
    !(item.market_materiality === "routine" && item.market_change === "no_material_change"));
}

function oceanRegime(newsData) {
  const items = visibleNews(newsData).filter((item) => item.domain === "ocean");
  const rate = byDimension(items, "rate").reduce((sum, item) => sum + score(item), 0);
  const supply = byDimension(items, "supply").reduce((sum, item) => sum + score(item), 0);
  const reliability = byDimension(items, "reliability").reduce((sum, item) => sum + score(item), 0);
  const risk = byDimension(items, "risk").reduce((sum, item) => sum + score(item), 0);

  let state = "balanced";
  let label = "均衡 / 個別監視";
  if (risk >= 4 || reliability >= 4) {
    state = "stressed";
    label = "ストレス上昇";
  } else if (supply >= 4 && rate >= 2) {
    state = "tightening";
    label = "需給引き締まり";
  } else if (supply >= 4) {
    state = "capacity_adjustment";
    label = "供給調整";
  } else if (rate >= 2) {
    state = "price_pressure";
    label = "価格上昇・逼迫未確認";
  }

  return {
    id: "ocean-market",
    title: "海上物流市場",
    state,
    label,
    confidence: items.some((i) => i.confidence === "high") ? "high" : "medium",
    summary: state === "tightening"
      ? "供給制約と運賃上昇が同時に確認され、単なる価格変動を超えた引き締まり。"
      : state === "stressed"
        ? "Reliability / Riskの悪化が主因。運賃変化とは分離して判断。"
        : state === "capacity_adjustment"
          ? "Blank sailing等の供給調整はあるが、価格と実booking障害の同時確認は不足。"
          : state === "price_pressure"
            ? "Rateは上向きだがSupply / Reliabilityの裏付けが不足。Capacity shortageとは判定しない。"
            : "Rate / Supply / Reliability / Riskを分離すると、全面的な市場逼迫は未確認。",
    dimensions: { rate, supply, reliability, risk }
  };
}

function strongestBeautyCategory(beautyMarket) {
  const rows = ((beautyMarket && beautyMarket.observations) || [])
    .filter((row) => Number.isFinite(Number(row.yoy)) && /skincare|lip|face|fragrance|cosmetic/i.test(row.metric || ""));
  if (!rows.length) return null;
  return rows.slice().sort((a, b) => Number(b.yoy) - Number(a.yoy))[0];
}

function beautyDemandRegime(economy, buzz, commerce) {
  const retail = economy && economy.beauty;
  const beautyMarket = economy && economy.beautyMarket;
  const dept = latestMetric(retail, "department_store_cosmetics_sales");
  const deptYoy = dept && Number.isFinite(Number(dept.yoy)) ? Number(dept.yoy) : null;
  const deptAge = dept ? daysOld(dept.published_at) : null;
  const categoryContext = strongestBeautyCategory(beautyMarket);

  const buzzRows = (buzz && buzz.observations) || [];
  const meaningfulBuzz = buzzRows.filter((row) =>
    Number(row.anchor_normalized || 0) >= 0.1 && Number(row.change_pct || 0) >= 20);

  const events = ((commerce && commerce.events) || []).filter((event) =>
    event.status === "active" || event.status === "scheduled");
  const promotionEvents = events.filter((event) => event.driver === "promotion");
  const organicEvents = events.filter((event) => event.driver === "organic");

  /* Monthly retail confirmation decays quickly. Older official data remains useful
     as context but must not certify today's demand regime. */
  const confirmationFresh = deptAge !== null && deptAge <= 45;
  const confirmedGrowth = deptYoy !== null && deptYoy >= 5;
  const confirmedWeakness = deptYoy !== null && deptYoy < 0;

  let state = "mixed";
  let label = "先行強含み / 実需確認待ち";
  if (confirmedWeakness && confirmationFresh) {
    state = "weakening";
    label = "実需弱含み";
  } else if (confirmedGrowth && confirmationFresh && organicEvents.length) {
    state = "organic_strengthening";
    label = "オーガニック需要強化";
  } else if (promotionEvents.length && (!confirmationFresh || !confirmedGrowth)) {
    state = "promotion_pressure";
    label = "販促需要圧力";
  } else if (confirmedGrowth && confirmationFresh) {
    state = "confirmed_growth";
    label = "実需堅調";
  }

  const confirmation = dept
    ? `百貨店化粧品売上 ${dept.period}: YoY ${deptYoy >= 0 ? "+" : ""}${deptYoy}%${confirmationFresh ? "" : "（現在判定には時差あり）"}`
    : "百貨店化粧品売上: 未取得";
  const structural = categoryContext
    ? `構造参考: ${categoryContext.metric} YoY ${Number(categoryContext.yoy) >= 0 ? "+" : ""}${categoryContext.yoy}%（市場調査値、現在実需の証拠には使わない）`
    : "構造参考: カテゴリ市場データ未取得";

  return {
    id: "beauty-demand",
    title: "Beauty需要",
    state,
    label,
    confidence: confirmationFresh ? "high" : (dept ? "medium" : "low"),
    summary: `${confirmation}。販促 ${promotionEvents.length}件、意味のあるBuzz加速 ${meaningfulBuzz.length}件。${structural}。Promotion / Buzz / 市場予測はorganic demandの証拠として扱わない。`,
    dimensions: {
      department_store_yoy: deptYoy,
      department_store_data_age_days: deptAge,
      promotion_events: promotionEvents.length,
      organic_events: organicEvents.length,
      meaningful_buzz: meaningfulBuzz.length,
      structural_category_metric: categoryContext ? categoryContext.metric : null,
      structural_category_yoy: categoryContext ? Number(categoryContext.yoy) : null
    }
  };
}

function japanDistributionRegime(newsData) {
  const items = visibleNews(newsData).filter((item) => item.domain === "domestic_delivery");
  const network = items.filter((item) => item.operational_scope === "network");
  const observedNetwork = network.filter((item) => item.status === "observed");
  const shipment = items.filter((item) => item.operational_scope === "shipment");

  let state = "normal_watch";
  let label = "通常 / 幹線監視";
  if (observedNetwork.length) {
    state = "network_disruption";
    label = "幹線実影響";
  } else if (network.length) {
    state = "network_risk";
    label = "幹線リスク";
  } else if (shipment.length) {
    state = "local_exceptions";
    label = "局地例外";
  }

  return {
    id: "japan-distribution",
    title: "国内配送",
    state,
    label,
    confidence: network.some((i) => i.confidence === "high") ? "high" : "medium",
    summary: observedNetwork.length
      ? `全国・幹線レベルで実影響 ${observedNetwork.length}件。個別出荷例外とは分離して扱う。`
      : network.length
        ? `幹線・ネットワーク級リスク ${network.length}件を監視中。実遅延確認前は予防モード。`
        : `個別・地域例外 ${shipment.length}件。全国ネットワークの悪化とは判定しない。`,
    dimensions: { network_risks: network.length, observed_network: observedNetwork.length, shipment_exceptions: shipment.length }
  };
}

export function deriveMarketRegimes({ newsData, economy, buzz, commerce }) {
  return [
    oceanRegime(newsData),
    beautyDemandRegime(economy, buzz, commerce),
    japanDistributionRegime(newsData)
  ];
}
