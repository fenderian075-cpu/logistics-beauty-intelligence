/* =========================================================================
   radar-row.js — one Operations Radar item.
   ========================================================================= */

import { el, link, extLink, root } from "../core/dom.js";
import { formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";

const SCOPE_LABELS = {
  global: "グローバル",
  network: "幹線・ネットワーク",
  market: "市場・需要波動",
  regional: "地域",
  shipment: "個別出荷"
};

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

export function radarRowCompact(item, intel) {
  const row = headLine(item, intel, { asLink: true });
  row.classList.add("radar-row", "radar-row--compact");
  row.setAttribute("data-status", item.status || "reported");
  row.setAttribute("data-emphasis", emphasis(item));
  row.setAttribute("data-scope", item.operational_scope || "");
  if (item.operational_scope) row.title = `影響範囲: ${SCOPE_LABELS[item.operational_scope] || item.operational_scope}`;
  return row;
}

export function radarRowFull(item, intel) {
  const wrap = el("article", "radar-row radar-row--full");
  wrap.id = item.id || "";
  wrap.setAttribute("data-status", item.status || "reported");
  wrap.setAttribute("data-emphasis", emphasis(item));
  wrap.setAttribute("data-domain", item.domain || "");
  wrap.setAttribute("data-importance", item.importance || "");
  wrap.setAttribute("data-relevance", item.japan_relevance || "");
  wrap.setAttribute("data-scope", item.operational_scope || "");

  wrap.appendChild(headLine(item, intel, { asLink: false }));

  const details = el("details", "radar-row__details");
  const summary = el("summary", "radar-row__toggle");
  summary.appendChild(el("span", null, "詳細と根拠"));
  details.appendChild(summary);

  const body = el("div", "radar-detail");
  const left = el("div", "radar-detail__col");
  const reported = block(L.UI.reportedLabel, item.summary, "radar-block--reported");
  const observed = block(L.UI.observedLabel,
    item.observed_impact || (item.status === "reported" ? "実影響は未確認です。" : null),
    "radar-block--observed");
  if (reported) left.appendChild(reported);
  if (observed) left.appendChild(observed);

  const right = el("div", "radar-detail__col");
  const scope = block("影響範囲", SCOPE_LABELS[item.operational_scope] || item.operational_scope);
  const japan = block(L.UI.japanImplication, item.japan_implication);
  const ops = block(L.UI.operationalImplication, item.operational_implication);
  if (scope) right.appendChild(scope);
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
