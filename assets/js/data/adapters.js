/* =========================================================================
   adapters.js — normalise pipeline output for the view layer.
   -------------------------------------------------------------------------
   The pipeline owns data/**. Schema versions differ per file (reports.json is
   2.1, topic-intelligence.json and critical-news.json are 1.0) and new keys
   appear over time. The adapters therefore:

     - never drop unknown keys (the raw record is spread first),
     - fill only the fields the renderers rely on,
     - treat null / missing / empty as legitimate states, not errors.
   ========================================================================= */

export const STATUS_VALUES = ["disruption", "watch", "unconfirmed", "normal"];
export const REPORT_TYPES = ["daily", "weekly", "monthly"];
export const DOMAINS = ["domestic", "weather", "customs", "ocean", "air", "global"];

export function normalizeStatus(value) {
  const s = String(value || "").toLowerCase();
  return STATUS_VALUES.indexOf(s) === -1 ? "unconfirmed" : s;
}

function normalizeReport(raw) {
  return {
    ...raw,                                   // unknown keys survive untouched
    id: raw.id || `${raw.date}-${raw.type}`,
    date: raw.date,
    type: REPORT_TYPES.indexOf(raw.type) === -1 ? "daily" : raw.type,
    title: raw.title || "",
    status: normalizeStatus(raw.status),
    summary: raw.summary || "",
    bottom_line: raw.bottom_line || "",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    key_issues: Array.isArray(raw.key_issues) ? raw.key_issues : [],
    takeaways: Array.isArray(raw.takeaways) ? raw.takeaways : [],
    highlights: raw.highlights || null,
    status_board: raw.status_board || null,
    intelligence: raw.intelligence || null,
    market_intelligence: Array.isArray(raw.market_intelligence) ? raw.market_intelligence : [],
    signals: raw.signals || null,
    change_summary: raw.change_summary || null,
    period: raw.period || "",
    as_of: raw.as_of || "",
    path: raw.path || "",
    sample: !!raw.sample
  };
}

/** Sorted newest first so the JSON can be appended to in any order. */
export function adaptReports(json) {
  const list = ((json && json.reports) || [])
    .map(normalizeReport)
    .filter((r) => r.date && r.path);

  list.sort((a, b) => {
    if (a.date === b.date) return REPORT_TYPES.indexOf(a.type) - REPORT_TYPES.indexOf(b.type);
    return a.date < b.date ? 1 : -1;
  });

  return {
    schema_version: (json && json.schema_version) || null,
    meta: (json && json.meta) || {},
    reports: list
  };
}

export function adaptRegistry(json) {
  return json && json.signals ? json : { signals: {} };
}

/** The entry of the same type immediately older than `report`. */
export function previousOf(reports, report) {
  if (!report) return null;
  const sameType = reports.filter((r) => r.type === report.type);
  const i = sameType.findIndex((r) => r.id === report.id);
  return (i === -1 || i === sameType.length - 1) ? null : sameType[i + 1];
}

export function latestOf(reports, type) {
  return reports.find((r) => r.type === type) || null;
}

const SEVERITY = { normal: 0, unconfirmed: 1, watch: 2, disruption: 3 };

export function direction(from, to) {
  const a = SEVERITY[from], b = SEVERITY[to];
  if (a === undefined || b === undefined || a === b) return "side";
  return b > a ? "worse" : "better";
}

/** Status transitions between two reports. `null` when there is no baseline. */
export function statusDiff(current, previous) {
  if (!previous) return null;
  const rows = [];
  if (current.status !== previous.status) {
    rows.push({ key: "overall", from: previous.status, to: current.status });
  }
  const a = current.status_board || {}, b = previous.status_board || {};
  DOMAINS.forEach((k) => {
    const from = normalizeStatus(b[k]), to = normalizeStatus(a[k]);
    if (from !== to) rows.push({ key: k, from, to });
  });
  return rows;
}
