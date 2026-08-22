/* =========================================================================
   format.js — dates and numbers. Japanese formatting only.
   ========================================================================= */

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function parseISO(iso) {
  const p = String(iso || "").split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
}

/** "2026-08-22" -> "2026年8月22日（土）" */
export function formatDate(iso, opts) {
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return String(iso || "");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` +
    (opts && opts.weekday ? `（${WEEKDAY_JA[d.getDay()]}）` : "");
}

/** "2026-08-22" -> "8/22" (compact row use) */
export function formatShortDate(iso) {
  const p = String(iso || "").split("-");
  if (p.length < 3) return String(iso || "");
  return `${Number(p[1])}/${Number(p[2])}`;
}

/** "2026-08" -> "2026年8月" */
export function formatMonth(ym) {
  const p = String(ym || "").split("-");
  if (p.length < 2) return String(ym || "");
  return `${p[0]}年${Number(p[1])}月`;
}

export function formatNumber(value) {
  if (value == null || value === "") return "—";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatPercent(value, digits) {
  if (value == null || isNaN(Number(value))) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return sign + Math.abs(n).toFixed(digits == null ? 1 : digits) + "%";
}

/** Local (JST for this audience) date without UTC drift. */
export function localDate(iso) {
  return new Date(String(iso) + "T00:00:00");
}

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((((x - y) / 86400000) + 1) / 7);
}

export function formatTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP", { hour12: false });
}
