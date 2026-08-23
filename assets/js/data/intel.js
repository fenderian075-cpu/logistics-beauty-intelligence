/* =========================================================================
   intel.js — the join layer.
   -------------------------------------------------------------------------
   `topic_id` is the only key that actually ties this dataset together:
   critical-news items carry `topic_ids`, topics carry `related_report_ids`,
   and — the important part — signal ids and topic ids share one namespace.
   ========================================================================= */

import { loadReports, loadRegistry, loadCriticalNews, loadTopics } from "./store.js";
import * as S from "../domain/signals.js";

const REGIME_TOPICS = {
  "east-west-container": ["ocean-global-price", "ocean-blank-sailing-pressure", "ocean-schedule-reliability"],
  "intra-asia": ["ocean-intra-asia-capacity", "ocean-global-price"],
  "middle-east-shipping": ["middle-east-maritime-risk", "ocean-schedule-reliability"]
};

const DOMAIN_TOPICS = {
  domestic: (id) => /^japan-domestic/.test(id),
  weather: (id) => /^japan-weather/.test(id),
  customs: (id) => /^japan-(customs|logistics-regulation)/.test(id),
  ocean: (id) => /^ocean-/.test(id) || id === "middle-east-maritime-risk",
  air: (id) => /^air-/.test(id),
  global: (id) => id === "middle-east-maritime-risk" || /^ocean-/.test(id)
};

const NEWS_RANK = { observed: 300, reported: 200, resolved: 100 };
const IMPORTANCE_RANK = { high: 30, medium: 20, low: 10 };
const RELEVANCE_RANK = { high: 3, medium: 2, low: 1 };

/* Critical Radar v4: operational scope is a separate decision axis.
   A shipment-specific exception must not outrank a trunk/network event merely
   because the local impact is already observed. This is intentionally large
   enough to affect ordering, not just break ties. */
const SCOPE_RANK = {
  global: 160,
  network: 150,
  market: 80,
  regional: 40,
  shipment: 0
};

/* Market Intelligence v4: Rate != Supply != Demand != Reliability != Risk.
   Dimension is categorical, while materiality/change/horizon/confidence affect
   decision priority. A routine metric print is retained in the source history
   but does not belong in the default Critical Radar. */
const MATERIALITY_RANK = {
  structural: 120,
  material: 80,
  notable: 30,
  routine: 0
};

const MARKET_CHANGE_RANK = {
  regime_shift: 100,
  acceleration: 60,
  deterioration: 50,
  improvement: 40,
  normalization: 20,
  no_material_change: -20
};

const HORIZON_RANK = {
  immediate: 50,
  "7d": 40,
  "30d": 20,
  "90d": 10
};

const CONFIDENCE_RANK = {
  high: 30,
  medium: 15,
  low: 0
};

export function isRadarEligible(item) {
  return !(item.market_materiality === "routine" &&
           item.market_change === "no_material_change");
}

export function radarRank(item) {
  return (NEWS_RANK[item.status] || 100) +
         (SCOPE_RANK[item.operational_scope] || 0) +
         (MATERIALITY_RANK[item.market_materiality] || 0) +
         (MARKET_CHANGE_RANK[item.market_change] || 0) +
         (HORIZON_RANK[item.time_horizon] || 0) +
         (CONFIDENCE_RANK[item.confidence] || 0) +
         (IMPORTANCE_RANK[item.importance] || 10) +
         (RELEVANCE_RANK[item.japan_relevance] || 1);
}

export function sortRadar(items) {
  return items.slice().sort((a, b) =>
    radarRank(b) - radarRank(a) || String(b.date).localeCompare(String(a.date)));
}

export async function loadIntel() {
  const [reportData, registry, newsData, topicData] = await Promise.all([
    loadReports(), loadRegistry(), loadCriticalNews(), loadTopics()
  ]);
  S.useRegistry(registry);

  const reports = reportData.reports;
  const topics = (topicData && topicData.topics) || [];
  const allNews = sortRadar((newsData && newsData.items) || []);
  const news = allNews.filter(isRadarEligible);

  const topicById = new Map(topics.map((t) => [t.topic_id, t]));
  const reportById = new Map(reports.map((r) => [r.id, r]));

  const newsByTopic = new Map();
  /* Topic Intelligence keeps routine observations as evidence/history even when
     they are suppressed from the Critical Radar surface. */
  allNews.forEach((item) => {
    (item.topic_ids || []).forEach((id) => {
      if (!newsByTopic.has(id)) newsByTopic.set(id, []);
      newsByTopic.get(id).push(item);
    });
  });

  const signalsByTopic = new Map();
  reports.forEach((report) => {
    S.signalsOf(report).forEach((sig) => {
      if (!sig.id) return;
      if (!signalsByTopic.has(sig.id)) signalsByTopic.set(sig.id, []);
      signalsByTopic.get(sig.id).push({ report, sig });
    });
  });
  signalsByTopic.forEach((list) => list.sort((a, b) => (a.report.date < b.report.date ? 1 : -1)));

  const regimeByTopic = new Map();
  reports.forEach((report) => {
    (report.market_intelligence || []).forEach((row) => {
      const ids = Array.isArray(row.topic_ids) ? row.topic_ids : (REGIME_TOPICS[row.id] || []);
      ids.forEach((id) => {
        if (!regimeByTopic.has(id)) regimeByTopic.set(id, []);
        regimeByTopic.get(id).push({ report, row });
      });
    });
  });

  return {
    reports, topics, news, allNews, reportData,
    topic: (id) => topicById.get(id) || null,
    hasTopic: (id) => topicById.has(id),
    report: (id) => reportById.get(id) || null,
    newsFor: (id) => newsByTopic.get(id) || [],
    signalsFor: (id) => signalsByTopic.get(id) || [],
    regimeFor: (id) => regimeByTopic.get(id) || [],
    reportsFor: (topic) => (topic.related_report_ids || []).map((id) => reportById.get(id)).filter(Boolean),
    topicForSignal: (sig) => (sig && sig.id && topicById.has(sig.id) ? topicById.get(sig.id) : null),
    topicsForDomain: (domain) => {
      const match = DOMAIN_TOPICS[domain];
      return match ? topics.filter((t) => match(t.topic_id)) : [];
    },
    topicsForRegime: (row) => {
      const ids = Array.isArray(row.topic_ids) ? row.topic_ids : (REGIME_TOPICS[row.id] || []);
      return ids.map((id) => topicById.get(id)).filter(Boolean);
    },
    lastUpdated: (topic) => {
      const dates = [
        ...(topic.developments || []).map((d) => d.date),
        ...(newsByTopic.get(topic.topic_id) || []).map((n) => n.date)
      ].filter(Boolean).sort();
      return dates.length ? dates[dates.length - 1] : null;
    },
    topicWeight: (topic) => {
      const linkedNews = newsByTopic.get(topic.topic_id) || [];
      const observed = linkedNews.filter((n) => n.status === "observed").length;
      const state = topic.current_state === "disruption" ? 3 : topic.current_state === "watch" ? 2 : 1;
      return state * 100 + observed * 10 + (topic.developments || []).length;
    }
  };
}

const SEEN_KEY = "lbi:radar:lastSeen";

export function readLastSeen() {
  try { return window.localStorage.getItem(SEEN_KEY); } catch { return null; }
}

export function writeLastSeen(value) {
  try { window.localStorage.setItem(SEEN_KEY, value); } catch { /* private mode */ }
}

export function countNewSince(items, lastSeen) {
  if (!lastSeen) return 0;
  return items.filter((item) => String(item.date || "") > lastSeen).length;
}
