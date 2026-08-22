/* =========================================================================
   store.js — the only place in the frontend that fetches data/*.json.
   -------------------------------------------------------------------------
   Why this exists: before v5, index.html fetched data/reports.json twice
   (header.js + site.js) and report pages fetched it a third time from
   market-intelligence.js. Every module now goes through this store, so one
   page load issues exactly one request per file.

   Contract with the content pipeline (docs/INTELLIGENCE_PIPELINE_V4.md):
   the frontend is a read-only consumer. Nothing here writes to data/**, and
   unknown keys are passed through untouched.
   ========================================================================= */

import { root } from "../core/dom.js";
import { adaptReports, adaptRegistry } from "./adapters.js";

const inflight = new Map();

/** Fetch a JSON file once per page load. Returns the same promise on repeat. */
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

/** Test seam: drop the per-page request cache. Never called by the site —
    tests/dom-smoke.mjs renders several pages inside one Node process, which
    would otherwise share this module's state. */
export function resetCache() {
  inflight.clear();
}

/** Optional file: resolves to `fallback` instead of rejecting. */
export function loadOptionalJSON(path, fallback) {
  return loadJSON(path).catch((err) => {
    console.warn(`${path} unavailable — continuing without it.`, err);
    return fallback;
  });
}

export const loadReports = () => loadJSON("data/reports.json").then(adaptReports);

/* The registry is optional by design: signal rendering degrades to inline
   metadata when it is missing, so a registry problem never blanks a page. */
export const loadRegistry = () =>
  loadOptionalJSON("data/signal-registry.json", { signals: {} }).then(adaptRegistry);

export const loadCommerceCalendar = () =>
  loadOptionalJSON("data/commerce-calendar.json", { events: [] });

export const loadHolidays = () =>
  loadOptionalJSON("data/jp-holidays.json", { holidays: {} });

export const loadBuzz = () => loadJSON("data/buzz.json");

export const loadSourceMatrix = () =>
  Promise.all([
    loadJSON("data/source-matrix.json"),
    loadOptionalJSON("data/source-matrix-extra.json", { sources: [] })
  ]).then(([base, extra]) => (base.sources || []).concat(extra.sources || []));

/* Layer-2 feeds. Consumed by the Intelligence Experience work (PR2); exposed
   here so there is exactly one loading path when those pages land. */
export const loadCriticalNews = () =>
  loadOptionalJSON("data/critical-news.json", { items: [] });

export const loadTopics = () =>
  loadOptionalJSON("data/topic-intelligence.json", { topics: [] });

export const loadBeautyBrands = () =>
  loadOptionalJSON("data/beauty-priority-brands.json", { priority_brands: [] });
