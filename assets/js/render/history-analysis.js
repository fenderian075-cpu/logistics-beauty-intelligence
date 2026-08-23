import { el, clear } from "../core/dom.js";
import { formatObservation, formatPct, formatPeriod, frequencyLabel, metricName, UNKNOWN } from "../core/units.js";
import { chart } from "./chart.js";
import { observations, latest, seriesOf, unitLabelOf } from "./economy.js";

const DATASET_LABELS = {
  trade: "貿易", warehouse: "倉庫", port: "港湾", cost: "物流サービス価格",
  trucking: "トラック", air: "航空貨物", beauty: "化粧品需要",
  beautyMarket: "化粧品市場", macro: "マクロ", companies: "物流企業",
  prices: "物価", fuel: "燃料", ocean: "海上運賃"
};
const WINDOWS = [
  { key: "all", label: "全期間", years: null }, { key: "10y", label: "10年", years: 10 },
  { key: "5y", label: "5年", years: 5 }, { key: "3y", label: "3年", years: 3 },
  { key: "1y", label: "1年", years: 1 }
];

function sourceOf(dataset) {
  if (!dataset) return null;
  return dataset.source || (Array.isArray(dataset.sources) ? dataset.sources[0] : null) || null;
}

function buildRegistry(bundle) {
  const registry = new Map();
  Object.entries(bundle || {}).forEach(([key, dataset]) => {
    seriesOf(dataset).forEach((series) => {
      if (!series || !series.metric_id) return;
      const candidate = { key, dataset, series }, current = registry.get(series.metric_id);
      if (!current || observations(series).length > observations(current.series).length) registry.set(series.metric_id, candidate);
    });
  });
  return registry;
}

function periodIndex(period) {
  const match = String(period || "").match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * 12 + (match[2] ? Number(match[2]) - 1 : 11);
}

function rowsForWindow(rows, years) {
  if (!years || rows.length < 2) return rows.slice();
  const end = periodIndex(rows[rows.length - 1].period);
  if (end == null) return rows.slice();
  const start = end - years * 12 + 1;
  const filtered = rows.filter((row) => { const idx = periodIndex(row.period); return idx != null && idx >= start; });
  return filtered.length >= 2 ? filtered : rows.slice(-Math.min(rows.length, 2));
}

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
function turningPoint(rows) {
  if (rows.length < 3) return null;
  for (let i = rows.length - 2; i >= 1; i--) {
    const prev = Number(rows[i - 1].value), current = Number(rows[i].value), next = Number(rows[i + 1].value);
    if (![prev, current, next].every(Number.isFinite)) continue;
    if (current > prev && current > next) return { type: "peak", row: rows[i] };
    if (current < prev && current < next) return { type: "trough", row: rows[i] };
  }
  return null;
}

function statsFor(rows) {
  const values = rows.map((row) => Number(row.value)).filter(Number.isFinite), last = rows[rows.length - 1] || null, first = rows[0] || null;
  if (!values.length || !last) return null;
  const min = Math.min(...values), max = Math.max(...values), mean = average(values), latestValue = Number(last.value);
  return {
    min, max, mean, last, first, count: rows.length, turn: turningPoint(rows),
    rangePosition: max === min ? 50 : ((latestValue - min) / (max - min)) * 100,
    averageGap: mean && mean !== 0 ? ((latestValue / mean) - 1) * 100 : null
  };
}

function yearChange(row) {
  if (!row) return null;
  const value = row.yoy ?? row.yoy_pct ?? row.yoy_store_adjusted_pct ?? null;
  return value == null ? null : Number(value);
}

function shortChange(row) {
  if (!row) return { label: "短期変化", value: null };
  if (row.mom != null) return { label: "前月比", value: Number(row.mom) };
  if (row.wow_pct != null) return { label: "前週比", value: Number(row.wow_pct) };
  if (row.qoq != null || row.qoq_pct != null) return { label: "前期比", value: Number(row.qoq ?? row.qoq_pct) };
  return { label: "短期変化", value: null };
}

function statCard(label, value, note) {
  const card = el("div", "history-stat");
  card.appendChild(el("span", "history-stat__label", label)); card.appendChild(el("strong", "history-stat__value", value || "—"));
  if (note) card.appendChild(el("span", "history-stat__note", note)); return card;
}
const formatSeriesValue = (series, value) => value == null || !Number.isFinite(Number(value)) ? UNKNOWN : formatObservation(series.unit, Number(value)).text;
function directionalPhrase(value, positive, negative, flat = "横ばい") {
  if (value == null || !Number.isFinite(value)) return null;
  if (value > 0.05) return positive; if (value < -0.05) return negative; return flat;
}

function analysisNotes(series, rows, stats) {
  if (!stats) return [];
  const notes = [], current = stats.last, yoy = yearChange(current), short = shortChange(current);
  if (yoy != null) notes.push(`前年比 ${formatPct(yoy)}で${directionalPhrase(yoy, "上昇", "低下")}。`);
  if (short.value != null) notes.push(`${short.label} ${formatPct(short.value)}で${directionalPhrase(short.value, "上向き", "下向き")}。`);
  if (stats.averageGap != null) notes.push(`現在値は表示期間平均を ${formatPct(stats.averageGap)} ${stats.averageGap >= 0 ? "上回っています" : "下回っています"}。`);
  notes.push(`表示期間のレンジでは下限から ${stats.rangePosition.toFixed(0)}% の位置です。`);
  if (stats.turn) notes.push(`直近の局所${stats.turn.type === "peak" ? "高値" : "安値"}は ${formatPeriod(stats.turn.row.period)}（${formatSeriesValue(series, stats.turn.row.value)}）です。`);
  else if (rows.length >= 3) notes.push("表示期間内では直近に明確な局所転換点を検出していません。");
  return notes;
}

function historyTable(series, rows) {
  const details = el("details", "history-table"); details.appendChild(el("summary", "history-table__toggle", `観測値を表示（${rows.length}件）`));
  const wrap = el("div", "table-scroll"), table = el("table", "data-table history-table__table"), thead = el("thead"), hr = el("tr");
  ["期間", "値", "前年比", "短期変化", "区分"].forEach((label) => { const th = el("th", null, label); th.setAttribute("scope", "col"); hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead); const tbody = el("tbody");
  rows.slice().reverse().forEach((row) => {
    const tr = el("tr"), yoy = yearChange(row), short = shortChange(row);
    [formatPeriod(row.period), formatSeriesValue(series, row.value), yoy == null ? "—" : formatPct(yoy), short.value == null ? "—" : `${short.label} ${formatPct(short.value)}`, row.status || "—"].forEach((value) => tr.appendChild(el("td", null, value)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); details.appendChild(wrap); return details;
}

function sourceNode(entry) {
  const source = sourceOf(entry.dataset), meta = el("div", "history-source");
  meta.appendChild(el("span", "history-source__dataset", entry.dataset.title_ja || DATASET_LABELS[entry.key] || entry.dataset.dataset || entry.key));
  if (entry.dataset.frequency) meta.appendChild(el("span", "history-source__frequency", frequencyLabel(entry.dataset.frequency)));
  if (source) {
    if (source.url) { const a = el("a", "history-source__link", source.name || "一次情報"); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; meta.appendChild(a); }
    else meta.appendChild(el("span", "history-source__link", source.name || "一次情報"));
  }
  return meta;
}

function createShell() {
  const backdrop = el("button", "history-backdrop"); backdrop.type = "button"; backdrop.setAttribute("aria-label", "分析パネルを閉じる"); backdrop.hidden = true;
  const panel = el("aside", "history-panel"); panel.id = "history-analysis"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "history-analysis-title");
  const top = el("div", "history-panel__top"), heading = el("div"); heading.appendChild(el("p", "eyebrow", "HISTORY ANALYSIS")); heading.appendChild(el("h2", "history-panel__title", "長期推移分析")); heading.lastChild.id = "history-analysis-title";
  const close = el("button", "history-panel__close", "閉じる"); close.type = "button"; close.setAttribute("aria-label", "長期推移分析を閉じる"); top.appendChild(heading); top.appendChild(close); panel.appendChild(top);
  const body = el("div", "history-panel__body"); panel.appendChild(body); document.body.appendChild(backdrop); document.body.appendChild(panel); return { backdrop, panel, body, close };
}

function updateUrl(metricId) {
  try { const url = new URL(window.location.href); if (metricId) url.searchParams.set("metric", metricId); else url.searchParams.delete("metric"); window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); }
  catch (_) { /* static file / embedded preview */ }
}

function renderEntry(entry, shell, windowKey) {
  const { series, dataset } = entry, allRows = observations(series), def = WINDOWS.find((item) => item.key === windowKey) || WINDOWS[0], rows = rowsForWindow(allRows, def.years), stats = statsFor(rows), current = latest(series), short = shortChange(current), yoy = yearChange(current);
  clear(shell.body);
  const head = el("header", "history-summary"); head.appendChild(el("h3", "history-summary__metric", metricName(series))); head.appendChild(sourceNode(entry)); head.appendChild(el("p", "history-summary__period", allRows.length ? `${formatPeriod(allRows[0].period)} 〜 ${formatPeriod(allRows[allRows.length - 1].period)} · ${allRows.length}観測` : "観測値なし")); shell.body.appendChild(head);
  const controls = el("div", "history-window"); controls.setAttribute("aria-label", "表示期間"); WINDOWS.forEach((item) => { const button = el("button", "history-window__button", item.label); button.type = "button"; button.setAttribute("data-history-window", item.key); button.setAttribute("aria-pressed", item.key === def.key ? "true" : "false"); controls.appendChild(button); }); shell.body.appendChild(controls);
  const statGrid = el("div", "history-stats");
  statGrid.appendChild(statCard("現在値", current ? formatSeriesValue(series, current.value) : UNKNOWN, current ? formatPeriod(current.period) : "取得待ち"));
  statGrid.appendChild(statCard("前年比", yoy == null ? "—" : formatPct(yoy), "前年同月・前年同期間との比較"));
  statGrid.appendChild(statCard(short.label, short.value == null ? "—" : formatPct(short.value), short.label === "短期変化" ? "比較値なし" : "直近期間との比較"));
  statGrid.appendChild(statCard("期間平均", stats ? formatSeriesValue(series, stats.mean) : "—", stats && stats.averageGap != null ? `現在値との差 ${formatPct(stats.averageGap)}` : "—"));
  statGrid.appendChild(statCard("レンジ位置", stats ? `${stats.rangePosition.toFixed(0)}%` : "—", stats ? `${formatSeriesValue(series, stats.min)} → ${formatSeriesValue(series, stats.max)}` : "—"));
  statGrid.appendChild(statCard("表示期間", stats ? `${stats.count}観測` : "—", stats ? `${formatPeriod(stats.first.period)} → ${formatPeriod(stats.last.period)}` : "—")); shell.body.appendChild(statGrid);
  const figure = chart({ kind: "line", height: 280, unitLabel: unitLabelOf(series), series: [{ name: metricName(series), unitLabel: unitLabelOf(series), points: rows.map((row) => { const formatted = formatObservation(series.unit, row.value); return { period: row.period, value: formatted.plot, display: formatted.text }; }) }], note: `${def.label}表示` });
  if (figure) { figure.classList.add("history-chart"); shell.body.appendChild(figure); } else shell.body.appendChild(el("p", "chart-absent", "推移グラフを描くための観測が不足しています。"));
  const notes = analysisNotes(series, rows, stats);
  if (notes.length) { const section = el("section", "history-reading"); section.appendChild(el("h4", "history-reading__title", "データから読めること")); const list = el("ul", "history-reading__list"); notes.forEach((note) => list.appendChild(el("li", null, note))); section.appendChild(list); section.appendChild(el("p", "history-reading__caution", "数値の位置と変化を要約したもので、因果関係を推定するものではありません。")); shell.body.appendChild(section); }
  if (rows.length) shell.body.appendChild(historyTable(series, rows));
  const source = sourceOf(dataset); if (source && source.url) { const p = el("p", "source-note"), a = el("a", null, "一次情報を開く"); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.appendChild(a); shell.body.appendChild(p); }
}

function enhanceTargets(registry) {
  document.querySelectorAll("[data-history-metric]").forEach((node) => {
    if (!registry.has(node.getAttribute("data-history-metric"))) return;
    /* A real button rather than role="button" + scripted tabindex: it gets
       keyboard activation, focus order and screen-reader semantics for free,
       and the audit can then assert that nothing fakes interactivity. */
    node.classList.add("history-trigger");
    if (node.querySelector(".history-trigger__button")) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "history-trigger__button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.title = "長期推移を分析";
    trigger.setAttribute("aria-label", `${node.textContent.trim().slice(0, 40)} の長期推移を分析`);
    trigger.textContent = "推移";
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      node.dispatchEvent(new CustomEvent("lbi:history-open", { bubbles: true }));
      node.click();
    });
    node.appendChild(trigger);
  });
}

export function mountHistoryExplorer(bundle) {
  const registry = buildRegistry(bundle), shell = createShell(); let activeMetric = null, activeWindow = "all", lastFocus = null;
  enhanceTargets(registry);
  const open = (metricId, { updateHistory = true } = {}) => {
    const entry = registry.get(metricId); if (!entry) return; activeMetric = metricId; activeWindow = "all"; lastFocus = document.activeElement; renderEntry(entry, shell, activeWindow); shell.backdrop.hidden = false; shell.panel.hidden = false; document.documentElement.setAttribute("data-history-open", "true"); if (updateHistory) updateUrl(metricId); shell.close.focus();
  };
  const close = ({ updateHistory = true } = {}) => {
    shell.backdrop.hidden = true; shell.panel.hidden = true; document.documentElement.removeAttribute("data-history-open"); if (updateHistory) updateUrl(null); const focus = lastFocus; activeMetric = null; if (focus && typeof focus.focus === "function") focus.focus();
  };
  document.addEventListener("click", (event) => {
    const target = event.target.closest && event.target.closest("[data-history-metric]");
    if (target) { const id = target.getAttribute("data-history-metric"); if (registry.has(id)) { event.preventDefault(); open(id); return; } }
    const windowButton = event.target.closest && event.target.closest("[data-history-window]");
    if (windowButton && activeMetric) { activeWindow = windowButton.getAttribute("data-history-window") || "all"; renderEntry(registry.get(activeMetric), shell, activeWindow); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shell.panel.hidden) { event.preventDefault(); close(); return; }
    if ((event.key === "Enter" || event.key === " ") && event.target && event.target.matches && event.target.matches("[data-history-metric]")) { event.preventDefault(); open(event.target.getAttribute("data-history-metric")); }
  });
  shell.close.addEventListener("click", () => close()); shell.backdrop.addEventListener("click", () => close());
  try { const metric = new URL(window.location.href).searchParams.get("metric"); if (metric && registry.has(metric)) open(metric, { updateHistory: false }); } catch (_) { /* no-op */ }
  return { open, close, registry };
}
