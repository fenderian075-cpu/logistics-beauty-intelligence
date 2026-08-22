/* =========================================================================
   signal-card.js — one signal, rendered as a disclosure row.
   Compact variant is a row with a hairline rule; it is the component that has
   to survive 20 repetitions on a busy day, so it carries no card chrome.
   ========================================================================= */

import { el, link, root } from "../core/dom.js";
import * as L from "../core/labels.js";
import * as S from "../domain/signals.js";
import {
  badge, changeBadge, directionBadge, impactBadge, confidenceBadge, evidenceList
} from "./primitives.js";

function metaBadges(sig) {
  const badges = el("div", "sig-card__badges");
  badges.appendChild(changeBadge(sig));
  badges.appendChild(directionBadge(sig, S.directionTone(sig)));
  badges.appendChild(impactBadge(sig));
  badges.appendChild(confidenceBadge(sig));
  if (S.isBeauty(sig)) {
    if (sig.demand_driver) {
      badges.appendChild(badge("driver", sig.demand_driver,
        `${L.UI.sigDemandDriver}: ${L.driverLabel(sig.demand_driver)}`));
    }
    if (sig.duration) {
      badges.appendChild(badge("duration", sig.duration,
        `${L.UI.sigDuration}: ${L.durationLabel(sig.duration)}`));
    }
  }
  return badges;
}

/** Inline SVG history strip: height = impact, fill = change status. */
function historyChart(observations) {
  if (observations.length < 2) return null;
  const points = observations.slice().reverse();          // oldest first
  const barW = 12, gap = 5, h = 34, pad = 2;
  const w = points.length * (barW + gap) - gap + pad * 2;
  const heights = { high: 26, medium: 17, low: 9 };
  const NS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "sig-chart");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", L.UI.sigHistoryChart);

  points.forEach((p, i) => {
    const bh = heights[p.impact] || 9;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", pad + i * (barW + gap));
    rect.setAttribute("y", h - bh - pad);
    rect.setAttribute("width", barW);
    rect.setAttribute("height", bh);
    rect.setAttribute("rx", "1");
    rect.setAttribute("class", "sig-chart__bar");
    rect.setAttribute("data-change", p.change_status);
    const title = document.createElementNS(NS, "title");
    title.textContent = `${p.date} — ${L.changeLabel(p.change_status)} / ${L.impactLabel(p.impact)}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });
  return svg;
}

export function historyBlock(observations, rootPath) {
  const wrap = el("div", "sig__history");
  wrap.appendChild(el("p", "eyebrow", L.UI.sigHistory));

  if (!observations.length) {
    wrap.appendChild(el("p", "sig__history-empty", L.UI.sigHistoryNone));
    return wrap;
  }
  if (observations.length === 1) {
    wrap.appendChild(el("p", "sig__history-empty", L.UI.sigHistoryThin));
  }

  const chart = historyChart(observations);
  if (chart) wrap.appendChild(chart);

  const table = el("table", "sig__history-table");
  const thead = el("thead");
  const hr = el("tr");
  [L.UI.sigDate, L.UI.sigChange, L.UI.sigDirection, L.UI.sigConfidence].forEach((h) => {
    const th = el("th", null, h);
    th.setAttribute("scope", "col");
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  observations.slice(0, 12).forEach((o) => {
    const tr = el("tr");
    const tdDate = el("td");
    if (o.path) tdDate.appendChild(link((rootPath || "") + o.path, null, o.date));
    else tdDate.textContent = o.date;
    tr.appendChild(tdDate);

    const tdChange = el("td");
    tdChange.appendChild(badge("change", o.change_status, L.changeLabel(o.change_status)));
    tr.appendChild(tdChange);

    tr.appendChild(el("td", null, `${L.arrow(o.direction)} ${L.directionLabel(o.direction)}`));
    tr.appendChild(el("td", null, L.confidenceLabel(o.confidence)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const scroll = el("div", "table-scroll");
  scroll.appendChild(table);
  wrap.appendChild(scroll);
  return wrap;
}

/**
 * @param {object} sig
 * @param {{reports?: Array, rootPath?: string, open?: boolean, compact?: boolean,
 *          topicFor?: (sig) => ({topic_id: string, title_ja: string}|null)}} opts
 *
 * `topicFor` is how a signal reaches its Topic Digest. Signal ids and topic
 * ids share one namespace, so most signals have a digest waiting for them;
 * the ones that do not simply render without the link.
 */
export function signalCard(sig, opts = {}) {
  const rootPath = opts.rootPath != null ? opts.rootPath : root();
  const details = el("details", "sig-card" + (opts.compact ? " sig-card--compact" : ""));
  details.setAttribute("data-lens", sig.lens || "");
  details.setAttribute("data-change", sig.change_status || "unchanged");
  details.setAttribute("data-impact", sig.impact || "low");
  if (opts.open) details.open = true;

  const summary = el("summary", "sig-card__summary");
  const head = el("div", "sig-card__head");
  if (!opts.compact) head.appendChild(el("span", "sig-card__lens", L.lensLabel(sig.lens || "disruption")));
  head.appendChild(el("span", "sig-card__name", S.signalName(sig)));
  summary.appendChild(head);

  if (sig.signal && !opts.compact) {
    summary.appendChild(el("p", "sig-card__statement", sig.signal));
  }
  summary.appendChild(metaBadges(sig));
  details.appendChild(summary);

  const body = el("div", "sig-card__body");

  if (sig.signal && opts.compact) {
    body.appendChild(el("p", "sig-card__statement", sig.signal));
  }
  if (sig.operational_implication) {
    const impl = el("p", "sig-card__line");
    impl.appendChild(el("span", "sig-card__label", L.UI.sigImplication));
    impl.appendChild(document.createTextNode(sig.operational_implication));
    body.appendChild(impl);
  }
  if (sig.action_direction) {
    const act = el("p", "sig-card__line sig-card__line--action");
    act.appendChild(el("span", "sig-card__label", L.UI.sigAction));
    act.appendChild(document.createTextNode(sig.action_direction));
    body.appendChild(act);
  }

  const entry = S.registryEntry(sig.id);
  if (entry && entry.description_ja) {
    body.appendChild(el("p", "sig-card__desc", entry.description_ja));
  }

  const ev = evidenceList(sig.evidence);
  if (ev) body.appendChild(ev);

  const topic = opts.topicFor ? opts.topicFor(sig) : null;
  if (topic) {
    const nav = el("p", "sig-card__topic");
    nav.appendChild(link(`${rootPath}topic.html?id=${encodeURIComponent(topic.topic_id)}`, "chip-link",
      `${topic.title_ja || topic.topic_id} ${L.UI.viewTopic}`));
    body.appendChild(nav);
  }

  if (opts.reports) {
    body.appendChild(historyBlock(S.history(opts.reports, sig.id), rootPath));
  }
  if (!body.childNodes.length) {
    body.appendChild(el("p", "sig-card__desc", L.UI.sigNoDetail));
  }
  details.appendChild(body);
  return details;
}
