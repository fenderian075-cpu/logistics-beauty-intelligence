/* =========================================================================
   store.js — the only place in the frontend that fetches data/*.json.
   ========================================================================= */

import { root } from "../core/dom.js";
import { adaptReports, adaptRegistry } from "./adapters.js";

const inflight = new Map();

export function loadJSON(path) {
  if (inflight.has(path)) return inflight.get(path);
  const url = root() + path;
  const promise = fetch(url, { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return res.json();
    });
  inflight.set(path, promise);
  return promise;
}

export function resetCache() { inflight.clear(); }

export function loadOptionalJSON(path, fallback) {
  return loadJSON(path).catch((err) => {
    console.warn(`${path} unavailable — continuing without it.`, err);
    return fallback;
  });
}

export const loadReports = () => loadJSON("data/reports.json").then(adaptReports);
export const loadRegistry = () =>
  loadOptionalJSON("data/signal-registry.json", { signals: {} }).then(adaptRegistry);
export const loadCommerceCalendar = () => loadOptionalJSON("data/commerce-calendar.json", { events: [] });
export const loadHolidays = () => loadOptionalJSON("data/jp-holidays.json", { holidays: {} });
export const loadBuzz = () => loadJSON("data/buzz.json");

function normalizeMonitoringSource(source) {
  const s = { ...source };
  const cadence = Array.isArray(s.cadence) ? s.cadence.slice() : [];
  if (String(s.layer || "").toLowerCase().includes("brand.com") && !cadence.includes("daily")) cadence.unshift("daily");
  s.cadence = Array.from(new Set(cadence));
  return s;
}

export const loadSourceMatrix = () =>
  Promise.all([
    loadJSON("data/source-matrix.json"),
    loadOptionalJSON("data/source-matrix-extra.json", { sources: [] }),
    loadOptionalJSON("data/source-matrix-economics.json", { sources: [] }),
    loadOptionalJSON("data/source-matrix-beauty-economy.json", { sources: [] })
  ]).then(([base, extra, economics, beautyEconomy]) =>
    (base.sources || [])
      .concat(extra.sources || [], economics.sources || [], beautyEconomy.sources || [])
      .map(normalizeMonitoringSource));

export const loadCriticalNews = () => loadOptionalJSON("data/critical-news.json", { items: [] });
export const loadTopics = () => loadOptionalJSON("data/topic-intelligence.json", { topics: [] });
export const loadBeautyBrands = () => loadOptionalJSON("data/beauty-priority-brands.json", { priority_brands: [] });

/* Economic & Physical Flow layer. Individual files are persistent time-series
   stores. overview.json is a presentation snapshot derived from those stores. */
export const loadEconomyOverview = () =>
  loadOptionalJSON("data/economy/overview.json", { cards: [], transmission_chain: [] });

export const loadIndustryDeflators = () =>
  loadOptionalJSON("data/economy/industry-deflators.json", { industries: [] });

export const loadEconomyBundle = () => Promise.all([
  loadOptionalJSON("data/economy/japan-trade.json", {}),
  loadOptionalJSON("data/economy/warehouse-flow.json", {}),
  loadOptionalJSON("data/economy/port-throughput.json", {}),
  loadOptionalJSON("data/economy/freight-cost.json", {}),
  loadOptionalJSON("data/economy/trucking.json", {}),
  loadOptionalJSON("data/economy/air-cargo.json", {}),
  loadOptionalJSON("data/economy/retail-beauty.json", {}),
  loadOptionalJSON("data/economy/beauty-market.json", {}),
  loadOptionalJSON("data/economy/macro.json", {}),
  loadOptionalJSON("data/economy/logistics-companies.json", {}),
  loadOptionalJSON("data/economy/prices.json", {}),
  loadOptionalJSON("data/economy/industry-comparison.json", {}),
  loadOptionalJSON("data/economy/deflator-decomposition.json", {}),
  loadOptionalJSON("data/economy/fuel-prices.json", {}),
  loadOptionalJSON("data/economy/ocean-freight-market.json", {}),
  loadOptionalJSON("data/economy/fuel-collector-status.json", {}),
  loadOptionalJSON("data/economy/industry-deflators.json", { industries: [] })
]).then(([trade, warehouse, port, cost, trucking, air, beauty, beautyMarket, macro, companies,
          prices, industry, decomposition, fuel, ocean, fuelStatus, deflators]) => ({
  trade, warehouse, port, cost, trucking, air, beauty, beautyMarket, macro, companies,
  prices, industry, decomposition, fuel, ocean, fuelStatus, deflators
}));

/* ---- logistics structure bundle (demand / workforce / capacity / risk) ----
   The demand, workforce, capacity and risk pages read from one loader so the
   four of them cannot disagree about a number, and each JSON is still fetched
   exactly once per page. */
export const loadLogisticsBundle = () => Promise.all([
  loadOptionalJSON("data/economy/parcel-demand.json", {}),
  loadOptionalJSON("data/economy/ec-demand.json", {}),
  loadOptionalJSON("data/economy/household-demand.json", {}),
  loadOptionalJSON("data/economy/logistics-capacity.json", {}),
  loadOptionalJSON("data/economy/logistics-workforce.json", {}),
  loadOptionalJSON("data/economy/logistics-workforce-age.json", {}),
  loadOptionalJSON("data/economy/logistics-labor-market.json", {}),
  loadOptionalJSON("data/economy/driver-demography.json", {}),
  loadOptionalJSON("data/economy/driver-labor-history.json", {}),
  loadOptionalJSON("data/economy/road-freight-driver-capacity.json", {}),
  loadOptionalJSON("data/economy/trucking-physical-capacity.json", {}),
  loadOptionalJSON("data/economy/trucking-business-structure.json", {}),
  loadOptionalJSON("data/economy/japan-demography.json", {}),
  loadOptionalJSON("data/economy/logistics-foreign-workforce.json", {}),
  loadOptionalJSON("data/economy/logistics-foreign-capacity-pipeline.json", {}),
  loadOptionalJSON("data/economy/labor-capacity-stress-v1.json", {}),
  loadOptionalJSON("data/economy/labor-capacity-stress-sensitivity.json", {}),
  loadOptionalJSON("data/economy/warehouse-flow.json", {}),
  loadOptionalJSON("data/economy/trucking.json", {})
]).then(([parcel, ec, household, capacity, workforce, workforceAge, laborMarket, driverAge,
          driverLabor, roadFreightDrivers, physicalCapacity, businessStructure, demography, foreignWorkforce,
          foreignPipeline, stress, sensitivity, warehouse, trucking]) => ({
  parcel, ec, household, capacity, workforce, workforceAge, laborMarket, driverAge,
  driverLabor, roadFreightDrivers, physicalCapacity, businessStructure, demography, foreignWorkforce,
  foreignPipeline, stress, sensitivity, warehouse, trucking
}));
