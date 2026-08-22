/* =========================================================================
   report.js — timeline navigation and breadcrumb for a single report page.
   Reads its own identity from <body data-report-date data-report-type>.
   If data/reports.json cannot be loaded, the static fallback links to the
   archive stay in place; the report itself remains fully readable.
   ========================================================================= */

(function () {
  "use strict";

  var body = document.body;
  var selfDate = body.getAttribute("data-report-date");
  var selfType = body.getAttribute("data-report-type");
  if (!selfDate || !selfType) return;

  var D = window.LBIData;
  var el = D.el;
  var neighbours = { prev: null, next: null };

  function findNeighbours(reports) {
    // reports are sorted newest first; timeline moves within the same type.
    var sameType = reports.filter(function (r) { return r.type === selfType; });
    var i = sameType.findIndex(function (r) { return r.date === selfDate; });
    if (i === -1) return;
    neighbours.next = i > 0 ? sameType[i - 1] : null;              // newer
    neighbours.prev = i < sameType.length - 1 ? sameType[i + 1] : null; // older
  }

  function label(r) {
    return r.type === "monthly"
      ? D.formatMonth(r.period || r.date.slice(0, 7))
      : D.formatDate(r.date);
  }

  /** Build a fresh slot element every time, so a previous render can never
      leave a stale href behind when the neighbour disappears. */
  function buildSlot(which, report, dirKey, emptyKey) {
    var node = el(report ? "a" : "span",
                  "tl-" + which + (report ? "" : " is-disabled"));
    node.setAttribute("data-tl", which);
    if (report) node.href = D.root() + report.path;
    node.appendChild(el("span", "tl-dir", LBI.t(dirKey)));
    node.appendChild(el("span", "tl-title", report ? label(report) : LBI.t(emptyKey)));
    return node;
  }

  function renderNav() {
    document.querySelectorAll(".timeline-nav").forEach(function (nav) {
      var prevSlot = nav.querySelector('[data-tl="prev"]');
      var nextSlot = nav.querySelector('[data-tl="next"]');
      var centerSlot = nav.querySelector('[data-tl="center"]');

      if (prevSlot) prevSlot.replaceWith(buildSlot("prev", neighbours.prev, "report.prev", "report.oldest"));
      if (nextSlot) nextSlot.replaceWith(buildSlot("next", neighbours.next, "report.next", "report.none"));
      if (centerSlot) {
        centerSlot.textContent = "";
        var link = el("a", null, LBI.t("report.archive"));
        link.href = D.root() + "archive.html?type=" + selfType;
        centerSlot.appendChild(link);
      }
    });
  }

  function renderBreadcrumb() {
    var year = selfDate.slice(0, 4);
    var month = selfDate.slice(5, 7);
    document.querySelectorAll("[data-bc]").forEach(function (node) {
      var kind = node.getAttribute("data-bc");
      if (kind === "year") node.textContent = LBI.lang === "en" ? year : year + "年";
      if (kind === "month") node.textContent = LBI.lang === "en"
        ? D.formatMonth(year + "-" + month)
        : Number(month) + "月";
      if (kind === "self") {
        node.textContent = (selfType === "monthly"
          ? D.formatMonth(body.getAttribute("data-report-period") || year + "-" + month)
          : D.formatDate(selfDate)) + " " + LBI.typeLabel(selfType);
      }
    });
  }

  /* ---- v2.1: structured signal cards -------------------------------------
     Rendered from data/reports.json into the optional #report-signals
     container, so a report author only maintains the JSON entry. A page
     without the container, or an entry without `intelligence`, renders
     nothing and the prose report is unaffected. */

  var allReports = [];

  function renderSignals() {
    var box = document.getElementById("report-signals");
    if (!box || !window.LBISignals) return;
    var S = window.LBISignals;

    var entry = allReports.filter(function (r) {
      return r.date === selfDate && r.type === selfType;
    })[0];
    var signals = entry ? S.signalsOf(entry) : [];

    box.innerHTML = "";
    if (!signals.length) {
      var section = box.closest("section");
      if (section) section.hidden = true;
      return;
    }
    var section2 = box.closest("section");
    if (section2) section2.hidden = false;

    S.rank(signals).forEach(function (sig) {
      box.appendChild(S.card(sig, { reports: allReports, rootPath: D.root() }));
    });
  }

  function renderAll() {
    renderNav();
    renderBreadcrumb();
    renderSignals();
    LBI.applyUIStrings();
  }

  renderBreadcrumb();

  Promise.all([
    D.load(),
    window.LBISignals ? window.LBISignals.loadRegistry(D.root()) : Promise.resolve(null)
  ]).then(function (results) {
    allReports = results[0].reports;
    findNeighbours(allReports);
    renderAll();
    LBI.onLangChange(renderAll);
  }).catch(function (err) {
    console.warn("reports.json unavailable — keeping static navigation.", err);
    LBI.onLangChange(renderBreadcrumb);
  });
})();
