/* =========================================================================
   archive.js — filter and search past reports.
   Behaviour is unchanged from v2.x (PR2 adds topic and date-range filters);
   the rewrite removes the translation dependency and the duplicate fetch.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatMonth } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadReports, loadRegistry } from "../data/store.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { statusPill } from "../render/primitives.js";

const controls = {};
let all = [];
let structuredAvailable = false;

function readURL() {
  const p = new URLSearchParams(location.search);
  Object.keys(controls).forEach((k) => {
    if (controls[k]) controls[k].value = p.get(k) || "";
  });
}

function writeURL() {
  const p = new URLSearchParams();
  Object.keys(controls).forEach((k) => {
    const input = controls[k];
    if (!input) return;
    const v = input.value.trim();
    if (v) p.set(k, v);
  });
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function fillOptions() {
  const years = [];
  all.forEach((r) => {
    const y = r.date.slice(0, 4);
    if (years.indexOf(y) === -1) years.push(y);
  });
  years.sort().reverse();
  years.forEach((y) => controls.year.appendChild(new Option(y, y)));
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    controls.month.appendChild(new Option(mm, mm));
  }
}

const val = (name) => (controls[name] ? controls[name].value : "");

function matches(r) {
  const f = {
    year: val("year"), month: val("month"), type: val("type"), status: val("status"),
    q: val("q").trim().toLowerCase(),
    lens: val("lens"), change: val("change"), conf: val("conf")
  };
  if (f.year && r.date.slice(0, 4) !== f.year) return false;
  if (f.month && r.date.slice(5, 7) !== f.month) return false;
  if (f.type && r.type !== f.type) return false;
  if (f.status && r.status !== f.status) return false;
  if (f.q) {
    const hay = [r.title, r.summary, r.tags.join(" "), r.date, r.type, r.key_issues.join(" ")]
      .join(" ").toLowerCase();
    if (!f.q.split(/\s+/).every((term) => hay.indexOf(term) !== -1)) return false;
  }
  if (f.lens || f.change || f.conf) {
    const signals = S.signalsOf(r);
    if (!signals.length) return false;
    if (f.lens && !signals.some((x) => x.lens === f.lens)) return false;
    if (f.change && !signals.some((x) => x.change_status === f.change)) return false;
    if (f.conf && !signals.some((x) => x.confidence === f.conf)) return false;
  }
  return true;
}

function entry(r) {
  const li = el("li", "archive-item");
  li.setAttribute("data-status", r.status);

  const meta = el("div", "archive-item__meta");
  meta.appendChild(el("span", "archive-item__date",
    r.type === "monthly" ? formatMonth(r.period || r.date.slice(0, 7)) : formatDate(r.date)));
  meta.appendChild(el("span", "archive-item__type", L.typeLabel(r.type)));
  li.appendChild(meta);

  const main = el("div");
  const head = el("div", "archive-item__head");
  const h3 = el("h3", "archive-item__title");
  h3.appendChild(link(root() + r.path, null, r.title));
  head.appendChild(h3);
  head.appendChild(statusPill(r.status));

  const signalCount = S.signalsOf(r).length;
  if (signalCount) {
    head.appendChild(el("span", "archive-item__signals", L.UI.lensCount(signalCount)));
  } else if (structuredAvailable) {
    head.appendChild(el("span", "archive-item__legacy", L.UI.archiveLegacy));
  }
  main.appendChild(head);
  main.appendChild(el("p", "archive-item__summary", r.summary));

  if (r.tags.length) {
    const tags = el("div", "tags");
    r.tags.forEach((tagText) => {
      tags.appendChild(link(`?q=${encodeURIComponent(tagText)}`, "tag", tagText));
    });
    main.appendChild(tags);
  }
  li.appendChild(main);
  return li;
}

function render() {
  const listEl = byId("archive-list");
  const emptyEl = byId("archive-empty");
  const countEl = byId("result-count");
  const hits = all.filter(matches);

  clear(listEl);
  if (emptyEl) {
    emptyEl.hidden = hits.length > 0;
    emptyEl.textContent = L.UI.archiveEmpty;
  }

  let currentYear = null;
  hits.forEach((r) => {
    const y = r.date.slice(0, 4);
    if (y !== currentYear) {
      currentYear = y;
      const heading = el("li", "year-group", `${y}年`);
      heading.setAttribute("role", "presentation");
      listEl.appendChild(heading);
    }
    listEl.appendChild(entry(r));
  });

  if (countEl) countEl.textContent = L.UI.archiveCount(hits.length);
  writeURL();
}

export function init() {
  ["year", "month", "type", "status", "q", "lens", "change", "conf"].forEach((k) => {
    controls[k] = byId(`f-${k}`);
  });

  Object.keys(controls).forEach((k) => {
    const input = controls[k];
    if (!input) return;
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", render);
  });

  const resetBtn = byId("f-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      Object.keys(controls).forEach((k) => { if (controls[k]) controls[k].value = ""; });
      render();
    });
  }

  return Promise.all([loadReports(), loadRegistry()]).then(([data, registry]) => {
    S.useRegistry(registry);
    all = data.reports;
    structuredAvailable = S.anyIntelligence(all);

    const panel = byId("structured-filters");
    if (panel) panel.hidden = !structuredAvailable;

    bindLatestReportNav(all);
    markCurrent();
    fillOptions();
    readURL();
    render();
  }).catch((err) => {
    console.error(err);
    const emptyEl = byId("archive-empty");
    if (emptyEl) { emptyEl.hidden = false; emptyEl.textContent = L.UI.loadError; }
    throw err;
  });
}
