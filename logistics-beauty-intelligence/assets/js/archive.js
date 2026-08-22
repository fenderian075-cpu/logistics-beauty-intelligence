/* =========================================================================
   archive.js — filter and search every past report from data/reports.json
   ========================================================================= */

(function () {
  "use strict";

  var listEl = document.getElementById("archive-list");
  if (!listEl) return;

  var D = window.LBIData;
  var el = D.el;
  var all = [];

  var controls = {
    year:   document.getElementById("f-year"),
    month:  document.getElementById("f-month"),
    type:   document.getElementById("f-type"),
    status: document.getElementById("f-status"),
    q:      document.getElementById("f-q")
  };
  var countEl = document.getElementById("result-count");
  var resetBtn = document.getElementById("f-reset");

  /* ---------- Filter state <-> URL ---------------------------------------- */

  function readURL() {
    var p = new URLSearchParams(location.search);
    controls.year.value   = p.get("year")   || "";
    controls.month.value  = p.get("month")  || "";
    controls.type.value   = p.get("type")   || "";
    controls.status.value = p.get("status") || "";
    controls.q.value      = p.get("q")      || "";
  }

  function writeURL() {
    var p = new URLSearchParams();
    Object.keys(controls).forEach(function (k) {
      var v = controls[k].value.trim();
      if (v) p.set(k === "q" ? "q" : k, v);
    });
    var lang = new URLSearchParams(location.search).get("lang");
    if (lang) p.set("lang", lang);
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  /* ---------- Option lists built from the data ---------------------------- */

  function fillOptions() {
    var years = [];
    all.forEach(function (r) {
      var y = r.date.slice(0, 4);
      if (years.indexOf(y) === -1) years.push(y);
    });
    years.sort().reverse();
    years.forEach(function (y) {
      controls.year.appendChild(new Option(y, y));
    });
    for (var m = 1; m <= 12; m++) {
      var mm = String(m).padStart(2, "0");
      controls.month.appendChild(new Option(mm, mm));
    }
  }

  /* ---------- Matching ----------------------------------------------------- */

  function matches(r) {
    var f = {
      year:   controls.year.value,
      month:  controls.month.value,
      type:   controls.type.value,
      status: controls.status.value,
      q:      controls.q.value.trim().toLowerCase()
    };
    if (f.year   && r.date.slice(0, 4) !== f.year) return false;
    if (f.month  && r.date.slice(5, 7) !== f.month) return false;
    if (f.type   && r.type !== f.type) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.q) {
      var hay = [r.title, r.summary, r.tags.join(" "), r.date, r.type,
                 (r.key_issues || []).join(" ")].join(" ").toLowerCase();
      var ok = f.q.split(/\s+/).every(function (term) { return hay.indexOf(term) !== -1; });
      if (!ok) return false;
    }
    return true;
  }

  /* ---------- Rendering ----------------------------------------------------- */

  function entry(r) {
    var li = el("li", "archive-item");
    li.setAttribute("data-status", r.status);

    var meta = el("div", "archive-item__meta");
    var date = el("span", "archive-item__date",
      r.type === "monthly" ? D.formatMonth(r.period || r.date.slice(0, 7)) : D.formatDate(r.date));
    meta.appendChild(date);
    meta.appendChild(el("span", "archive-item__type", LBI.typeLabel(r.type)));
    li.appendChild(meta);

    var main = el("div");
    var head = el("div", "archive-item__head");
    var h3 = el("h3", "archive-item__title");
    var a = el("a", null, r.title);
    a.href = D.root() + r.path;
    h3.appendChild(a);
    head.appendChild(h3);
    head.appendChild(D.statusPill(r.status));
    main.appendChild(head);

    var summary = el("p", "archive-item__summary", r.summary);
    summary.setAttribute("data-translate", "");
    main.appendChild(summary);

    if (r.tags.length) {
      var tags = el("div", "tags");
      r.tags.forEach(function (tagText) {
        var chip = el("a", "tag", tagText);
        chip.href = "?q=" + encodeURIComponent(tagText);
        tags.appendChild(chip);
      });
      main.appendChild(tags);
    }
    li.appendChild(main);
    return li;
  }

  function render() {
    var hits = all.filter(matches);
    listEl.innerHTML = "";
    var emptyEl = document.getElementById("archive-empty");
    emptyEl.hidden = hits.length > 0;
    emptyEl.textContent = LBI.t("archive.empty");

    var currentYear = null;
    hits.forEach(function (r) {
      var y = r.date.slice(0, 4);
      if (y !== currentYear) {
        currentYear = y;
        var heading = el("li", "year-group", LBI.lang === "en" ? y : y + "年");
        heading.setAttribute("role", "presentation");
        listEl.appendChild(heading);
      }
      listEl.appendChild(entry(r));
    });

    countEl.textContent = LBI.t("archive.count", { n: hits.length });
    writeURL();
    LBI.refreshTranslation();
  }

  /* ---------- Wiring -------------------------------------------------------- */

  Object.keys(controls).forEach(function (k) {
    var input = controls[k];
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", render);
  });

  resetBtn.addEventListener("click", function () {
    Object.keys(controls).forEach(function (k) { controls[k].value = ""; });
    render();
  });

  D.load().then(function (result) {
    all = result.reports;
    fillOptions();
    readURL();
    render();
    LBI.onLangChange(render);
  }).catch(function (err) {
    console.error(err);
    var emptyEl = document.getElementById("archive-empty");
    emptyEl.hidden = false;
    emptyEl.textContent = LBI.t("home.loadError");
  });
})();
