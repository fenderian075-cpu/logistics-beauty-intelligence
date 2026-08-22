/* =========================================================================
   radar-row.js — one Operations Radar item.
   -------------------------------------------------------------------------
   Two variants of the same row, so the dashboard and radar.html never drift:

     compact  — one line, used on the dashboard. Links straight to the topic.
     full     — the same line plus a disclosure holding 概要 / 実影響 /
                日本への意味 / 業務への意味 / 根拠.

   Design rules this component exists to enforce:
     - reported ≠ observed, and the difference is carried by a text label and
       the left rule style, never by colour alone (spec §10, §42);
     - one emphasis channel per row: only an observed, high-importance item
       with high Japan relevance gets the solid accent rule (§35);
     - the row is a row. Twenty of them in one list must still read as a list,
       so there is no card chrome, no shadow, no radius (§33, §36).
   ========================================================================= */

import { el, link, extLink, root } from "../core/dom.js";
import { formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";

function emphasis(item) {
  if (item.status === "observed" && item.importance === "high") return "high";
  if (item.status === "observed" || (item.importance === "high" && item.japan_relevance === "high")) return "medium";
  return "low";
}

function headlineTarget(item, intel) {
  const topicId = (item.topic_ids || []).find((id) => intel && intel.hasTopic(id));
  if (topicId) return `${root()}topic.html?id=${encodeURIComponent(topicId)}`;
  return `${root()}radar.html#${encodeURIComponent(item.id || "")}`;
}

function stateCell(item) {
  const span = el("span", "radar-row__state", L.newsStatusLabel(item.status));
  span.title = L.NEWS_STATUS_NOTE[item.status] || "";
  return span;
}

/** The single line. Shared by both variants. */
function headLine(item, intel, { asLink }) {
  const target = headlineTarget(item, intel);
  const node = asLink ? link(target, "radar-row__head") : el("div", "radar-row__head");

  node.appendChild(stateCell(item));
  node.appendChild(el("span", "radar-row__date", formatShortDate(item.date)));
  node.appendChild(el("span", "radar-row__domain", L.newsDomainLabel(item.domain)));

  const headline = asLink
    ? el("span", "radar-row__headline", item.headline || "")
    : link(target, "radar-row__headline", item.headline || "");
  node.appendChild(headline);

  if (item.japan_relevance) {
    node.appendChild(el("span", "radar-row__jp", `日本 ${L.relevanceLabel(item.japan_relevance)}`));
  }
  return node;
}

function block(labelText, text, className) {
  if (!text) return null;
  const box = el("div", `radar-block${className ? ` ${className}` : ""}`);
  box.appendChild(el("p", "radar-block__label", labelText));
  box.appendChild(el("p", "radar-block__text", text));
  return box;
}

function evidenceBlock(evidence) {
  const items = Array.isArray(evidence) ? evidence : [];
  if (!items.length) return null;
  const box = el("div", "radar-block radar-block--evidence");
  box.appendChild(el("p", "radar-block__label", L.UI.sigEvidence));
  const list = el("ul", "evidence-list");
  items.forEach((ev) => {
    const li = el("li");
    const tier = L.evidenceTier(ev.class);
    const mark = el("span", "ev-class", tier.label);
    mark.setAttribute("data-tier", tier.tier);
    li.appendChild(mark);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(ev.url ? extLink(ev.url, ev.source || ev.url) : document.createTextNode(ev.source || ""));
    if (ev.date) li.appendChild(el("span", "sig__evidence-date", ` ${ev.date}`));
    list.appendChild(li);
  });
  box.appendChild(list);
  return box;
}

function topicLinks(item, intel) {
  const ids = (item.topic_ids || []).filter((id) => intel && intel.hasTopic(id));
  if (!ids.length) return null;
  const box = el("div", "radar-block radar-block--topics");
  box.appendChild(el("p", "radar-block__label", L.UI.relatedTopics));
  const row = el("div", "chip-links");
  ids.forEach((id) => {
    row.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(id)}`, "chip-link",
      intel.topic(id).title_ja || id));
  });
  box.appendChild(row);
  return box;
}

/** Dashboard variant: one line, whole row is the link. */
export function radarRowCompact(item, intel) {
  const row = headLine(item, intel, { asLink: true });
  row.classList.add("radar-row", "radar-row--compact");
  row.setAttribute("data-status", item.status || "reported");
  row.setAttribute("data-emphasis", emphasis(item));
  return row;
}

/** Radar page variant: line + disclosure. */
export function radarRowFull(item, intel) {
  const wrap = el("article", "radar-row radar-row--full");
  wrap.id = item.id || "";
  wrap.setAttribute("data-status", item.status || "reported");
  wrap.setAttribute("data-emphasis", emphasis(item));
  wrap.setAttribute("data-domain", item.domain || "");
  wrap.setAttribute("data-importance", item.importance || "");
  wrap.setAttribute("data-relevance", item.japan_relevance || "");

  wrap.appendChild(headLine(item, intel, { asLink: false }));

  const details = el("details", "radar-row__details");
  const summary = el("summary", "radar-row__toggle");
  summary.appendChild(el("span", null, "詳細と根拠"));
  details.appendChild(summary);

  const body = el("div", "radar-detail");

  /* Reported vs observed, kept apart on purpose: an announcement is not a
     confirmed impact, and the layout should not let one read as the other. */
  const left = el("div", "radar-detail__col");
  const reported = block(L.UI.reportedLabel, item.summary, "radar-block--reported");
  const observed = block(L.UI.observedLabel,
    item.observed_impact || (item.status === "reported" ? "実影響は未確認です。" : null),
    "radar-block--observed");
  if (reported) left.appendChild(reported);
  if (observed) left.appendChild(observed);

  const right = el("div", "radar-detail__col");
  const japan = block(L.UI.japanImplication, item.japan_implication);
  const ops = block(L.UI.operationalImplication, item.operational_implication);
  if (japan) right.appendChild(japan);
  if (ops) right.appendChild(ops);

  if (left.childNodes.length) body.appendChild(left);
  if (right.childNodes.length) body.appendChild(right);

  const topics = topicLinks(item, intel);
  if (topics) body.appendChild(topics);
  const evidence = evidenceBlock(item.evidence);
  if (evidence) body.appendChild(evidence);

  details.appendChild(body);
  wrap.appendChild(details);
  return wrap;
}
