/* =========================================================================
   report.js — published report pages.
   -------------------------------------------------------------------------
   Fixed in v5: report pages never loaded header.js, so 日次 / 週次 / 月次 in
   the header were dead links (href="#") on every report. They are now
   resolved by the shared nav module, with archive.html?type=… as the static
   fallback baked into the HTML.

   Also removed: run-time <link> and <script> injection. Weekly and monthly
   reports used to inject intelligence-v3.css and market-intelligence.js from
   JavaScript after load; the stylesheet is part of the standard bundle and
   the renderer is imported statically.
   ========================================================================= */

import { el, link, byId, qsa, clear, root } from "../core/dom.js";
import { formatDate, formatMonth } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadIntel } from "../data/intel.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { signalCard } from "../render/signal-card.js";
import { marketRegimeSection } from "../render/market-regime.js";

/* Read at init() time, not at module-evaluation time: the page identity
   belongs to the render, not to the module. */
let selfDate = null;
let selfType = null;

function label(report) {
  return report.type === "monthly"
    ? formatMonth(report.period || report.date.slice(0, 7))
    : formatDate(report.date);
}

function neighbours(reports) {
  const same = reports.filter((r) => r.type === selfType);
  const i = same.findIndex((r) => r.date === selfDate);
  if (i === -1) return { prev: null, next: null };
  return { next: i > 0 ? same[i - 1] : null, prev: i < same.length - 1 ? same[i + 1] : null };
}

function slot(which, report, dirText, emptyText) {
  const node = report
    ? link(root() + report.path, `tl-${which}`)
    : el("span", `tl-${which} is-disabled`);
  node.setAttribute("data-tl", which);
  node.appendChild(el("span", "tl-dir", dirText));
  node.appendChild(el("span", "tl-title", report ? label(report) : emptyText));
  return node;
}

function renderNav(near) {
  qsa(".timeline-nav").forEach((nav) => {
    const prev = nav.querySelector('[data-tl="prev"]');
    const next = nav.querySelector('[data-tl="next"]');
    const center = nav.querySelector('[data-tl="center"]');
    if (prev) prev.replaceWith(slot("prev", near.prev, L.UI.reportPrev, L.UI.reportOldest));
    if (next) next.replaceWith(slot("next", near.next, L.UI.reportNext, L.UI.reportNewest));
    if (center) {
      clear(center);
      center.appendChild(link(`${root()}archive.html?type=${selfType}`, null, L.UI.reportArchive));
    }
  });
}

function renderBreadcrumb() {
  if (!selfDate) return;
  const year = selfDate.slice(0, 4);
  const month = selfDate.slice(5, 7);
  qsa("[data-bc]").forEach((node) => {
    const kind = node.getAttribute("data-bc");
    if (kind === "year") node.textContent = `${year}年`;
    if (kind === "month") node.textContent = `${Number(month)}月`;
    if (kind === "self") {
      node.textContent = (selfType === "monthly"
        ? formatMonth(document.body.getAttribute("data-report-period") || `${year}-${month}`)
        : formatDate(selfDate)) + ` ${L.typeLabel(selfType)}`;
    }
  });
}

/** The status board belongs to the daily exception view only. */
function hideNonDailyStatus() {
  if (selfType === "daily") return;
  const heading = byId("board-h");
  const section = heading && heading.closest("section");
  if (section) section.remove();
}

function renderSignals(reports, entry, intel) {
  const box = byId("report-signals");
  if (!box) return;
  clear(box);

  const section = box.closest("section");
  const signals = entry
    ? S.signalsOf(entry).filter((sig) => !S.isTelemetryOnly(sig, entry))
    : [];

  if (!signals.length) {
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;

  S.LENSES.forEach((lens) => {
    const list = S.rank(signals.filter((s) => s.lens === lens));
    if (!list.length) return;
    const group = el("section", "signal-lens-group");
    group.setAttribute("data-lens", lens);
    group.appendChild(el("h3", "signal-lens-group__title", L.lensLabel(lens)));
    list.forEach((sig) => {
      group.appendChild(signalCard(sig, {
        reports, rootPath: root(), compact: true, topicFor: intel.topicForSignal
      }));
    });
    box.appendChild(group);
  });
}

function renderMarketRegime(entry, intel) {
  if (!entry || !entry.market_intelligence.length) return;
  const host = byId("market-regime-host") || byId("report-signals");
  if (!host) return;
  const anchor = host.closest("section") || host;
  const section = marketRegimeSection(entry, intel);
  if (section) anchor.parentNode.insertBefore(section, anchor.nextSibling);
}

/** Topics this report feeds. The report is Layer 3; this is the way back up
    to Layer 2 without going through the dashboard. */
function renderTopicRail(entry, intel) {
  if (!entry) return;
  const ids = new Set();
  intel.topics.forEach((topic) => {
    if ((topic.related_report_ids || []).indexOf(entry.id) !== -1) ids.add(topic.topic_id);
  });
  S.signalsOf(entry).forEach((sig) => { if (intel.hasTopic(sig.id)) ids.add(sig.id); });
  if (!ids.size) return;

  const host = byId("report-signals");
  const anchor = host ? (host.closest("section") || host) : null;
  if (!anchor) return;

  const section = el("section", "section report-topics");
  const head = el("div", "section__head");
  head.appendChild(el("h2", "section__title", "このレポートが扱うトピック"));
  section.appendChild(head);

  const row = el("div", "chip-links");
  Array.from(ids).forEach((id) => {
    const topic = intel.topic(id);
    row.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(id)}`, "chip-link",
      topic.title_ja || id));
  });
  section.appendChild(row);
  anchor.parentNode.insertBefore(section, anchor);
}

export function init() {
  selfDate = document.body.getAttribute("data-report-date");
  selfType = document.body.getAttribute("data-report-type");
  if (!selfDate || !selfType) return Promise.resolve();
  renderBreadcrumb();
  hideNonDailyStatus();

  return loadIntel().then((intel) => {
    const reports = intel.reports;
    mountShell(intel);
    const entry = reports.find((r) => r.date === selfDate && r.type === selfType) || null;

    bindLatestReportNav(reports);
    renderNav(neighbours(reports));
    renderSignals(reports, entry, intel);
    renderMarketRegime(entry, intel);
    renderTopicRail(entry, intel);
  }).catch((err) => {
    // The static report body is complete on its own; navigation degrades.
    console.warn("reports.json unavailable — keeping static report content.", err);
  });
}
