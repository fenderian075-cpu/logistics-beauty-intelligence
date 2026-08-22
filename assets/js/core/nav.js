/* =========================================================================
   nav.js — resolve 日次 / 週次 / 月次 to the latest published report.
   -------------------------------------------------------------------------
   Before v5 this lived in header.js, which report pages never loaded: the
   three primary nav links on every report page pointed at "#" and did
   nothing. The header markup is now identical on every page and this module
   runs everywhere, with archive.html?type=… as the no-JS / no-data fallback
   already present in the HTML.
   ========================================================================= */

import { qsa, root } from "./dom.js";
import { latestOf } from "../data/adapters.js";
import * as L from "./labels.js";

const TYPES = ["daily", "weekly", "monthly"];

export function bindLatestReportNav(reports) {
  const prefix = root();
  TYPES.forEach((type) => {
    const latest = latestOf(reports, type);
    if (!latest || !latest.path) return;
    qsa(`#nav-latest-${type}`).forEach((a) => {
      a.href = prefix + latest.path;
      a.title = `最新${L.typeLabel(type)} — ${latest.date}`;
    });
  });
}

/** Mark the current page in the navigation rail for orientation and a11y. */
export function markCurrent() {
  const page = document.body.getAttribute("data-page");
  if (!page) return;
  qsa(`[data-nav="${page}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
}
