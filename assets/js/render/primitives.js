/* =========================================================================
   primitives.js — the small set of repeating building blocks.
   -------------------------------------------------------------------------
   Cumulative-noise policy (spec §33/§35): repeating information is a ROW,
   not a card, and one row carries at most one strong emphasis channel.
   Anything that repeats 20 times on a busy day is built from these.
   ========================================================================= */

import { el, extLink } from "../core/dom.js";
import * as L from "../core/labels.js";

export function statusPill(status) {
  const span = el("span", "status-pill");
  span.setAttribute("data-status", status);
  span.appendChild(el("span", "dot"));
  span.appendChild(document.createTextNode(L.statusLabel(status)));
  return span;
}

export function badge(kind, value, text) {
  const span = el("span", `badge badge--${kind}`, text);
  span.setAttribute("data-value", value || "unknown");
  return span;
}

export function changeBadge(sig) {
  const v = sig.change_status || "unchanged";
  return badge("change", v, L.changeLabel(v));
}

export function directionBadge(sig, tone) {
  const v = sig.direction || "unknown";
  const b = badge("dir", v, `${L.arrow(v)} ${L.directionLabel(v)}`);
  if (tone) b.setAttribute("data-tone", tone);
  return b;
}

export function impactBadge(sig) {
  const v = sig.impact || "low";
  return badge("impact", v, `${L.UI.sigImpact}: ${L.impactLabel(v)}`);
}

export function confidenceBadge(sig) {
  const v = sig.confidence || "low";
  return badge("conf", v, `${L.UI.sigConfidence}: ${L.confidenceLabel(v)}`);
}

/** Evidence rows. Provenance is shown as one short tier label, never as a
    wall of eight coloured badges (spec §30). */
export function evidenceList(evidence, titleText) {
  const items = Array.isArray(evidence) ? evidence : (evidence ? [evidence] : []);
  if (!items.length) return null;

  const wrap = el("div", "sig__evidence");
  wrap.appendChild(el("p", "eyebrow", titleText || L.UI.sigEvidence));
  const ul = el("ul");
  items.forEach((item) => {
    const li = el("li");
    if (typeof item === "string") {
      li.textContent = item;
    } else if (item && typeof item === "object") {
      if (item.class) {
        const tier = L.evidenceTier(item.class);
        const mark = el("span", "ev-class", tier.label);
        mark.setAttribute("data-tier", tier.tier);
        li.appendChild(mark);
        li.appendChild(document.createTextNode(" "));
      }
      const label = item.source || item.title || item.url || "";
      li.appendChild(item.url ? extLink(item.url, label) : document.createTextNode(label));
      if (item.date) li.appendChild(el("span", "sig__evidence-date", ` ${item.date}`));
    }
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  return wrap;
}

export function emptyState(text) {
  return el("p", "empty-state", text);
}

/**
 * Render a list of rows with a deterministic cap and an in-place expander.
 * Keeps 20-item days navigable without pagination or virtual scrolling.
 *
 * @param {HTMLElement} container   emptied by the caller
 * @param {Array} items
 * @param {(item, index) => Node} renderRow
 * @param {{limit?: number, moreLabel?: (n:number)=>string}} [opts]
 */
export function renderRows(container, items, renderRow, opts = {}) {
  const limit = opts.limit == null ? 5 : opts.limit;
  const visible = items.slice(0, limit);
  visible.forEach((item, i) => container.appendChild(renderRow(item, i)));

  const rest = items.slice(limit);
  if (!rest.length) return;

  const more = el("button", "row-more", (opts.moreLabel || L.UI.showMore)(rest.length));
  more.type = "button";
  more.addEventListener("click", () => {
    const frag = document.createDocumentFragment();
    rest.forEach((item, i) => frag.appendChild(renderRow(item, limit + i)));
    container.insertBefore(frag, more);
    more.remove();
  });
  container.appendChild(more);
}
