/* =========================================================================
   translation.js — Japanese is the source of truth. English is a view.
   -------------------------------------------------------------------------
   Two independent layers:

   Layer 1  UI chrome (nav, buttons, filter labels, status words)
            A finite, hand-written dictionary. Instant, offline, exact.
            Never fails.

   Layer 2  Report body text
            The browser's built-in on-device translator (Chrome/Edge 138+
            Translator API). No network call to a third party, no API key,
            no external script. If the browser cannot do it, the Japanese
            original stays on screen and a notice explains how to use the
            browser's own page translation instead.

   Nothing here ever replaces Japanese content with an empty or partial
   string: originals are kept in a WeakMap and restored on failure or on
   switching back to 日本語.
   ========================================================================= */

(function () {
  "use strict";

  var STORAGE_KEY = "lbi.lang";

  /* ---------- UI dictionary ---------------------------------------------- */

  var STRINGS = {
    "nav.home":            { ja: "ホーム",            en: "Home" },
    "nav.today":           { ja: "今日のレポート",     en: "Today's brief" },
    "nav.archive":         { ja: "過去のレポート",     en: "Archive" },
    "nav.about":           { ja: "このサイトについて", en: "About" },

    "site.name":           { ja: "Logistics & Beauty Intelligence", en: "Logistics & Beauty Intelligence" },
    "site.tagline":        { ja: "公開情報から作成する物流・ビューティー動向ブリーフ",
                             en: "Logistics and beauty briefs built from public sources" },

    "lang.label":          { ja: "表示言語",           en: "Language" },
    "lang.ja":             { ja: "日本語",             en: "日本語" },
    "lang.en":             { ja: "English",           en: "English" },

    "lang.translating":    { ja: "英語に翻訳しています…", en: "Translating to English…" },
    "lang.done":           { ja: "本文はブラウザ内蔵の翻訳機能で英訳されています。原文は日本語です。",
                             en: "Body text was machine-translated on your device. Japanese is the original." },
    "lang.partial":        { ja: "一部を翻訳できませんでした。その部分は日本語のまま表示しています。",
                             en: "Some blocks could not be translated and are shown in the original Japanese." },
    "lang.unsupported":    { ja: "このブラウザは端末内翻訳に対応していません。画面の文言のみ英語にしました。本文を英訳するには、ブラウザの翻訳機能（Chrome / Edge: 右クリック →「英語に翻訳」、Safari: アドレスバーの翻訳アイコン）をご利用ください。",
                             en: "This browser has no built-in on-device translator, so only the interface is in English. To translate the body text, use your browser's own page translation (Chrome / Edge: right-click → Translate to English; Safari: the translate icon in the address bar)." },
    "lang.downloading":    { ja: "翻訳モデルをダウンロードしています。完了までしばらくお待ちください。",
                             en: "Downloading the on-device translation model. This runs once." },

    "status.normal":       { ja: "Normal",       en: "Normal" },
    "status.watch":        { ja: "Watch",        en: "Watch" },
    "status.disruption":   { ja: "Disruption",   en: "Disruption" },
    "status.unconfirmed":  { ja: "Unconfirmed",  en: "Unconfirmed" },

    "type.daily":          { ja: "デイリー",   en: "Daily" },
    "type.weekly":         { ja: "ウィークリー", en: "Weekly" },
    "type.monthly":        { ja: "マンスリー", en: "Monthly" },

    "domain.domestic":     { ja: "国内配送 / Domestic Delivery", en: "Domestic delivery" },
    "domain.weather":      { ja: "気象・災害 / Weather",         en: "Weather / disaster" },
    "domain.customs":      { ja: "通関・NACCS / Customs",        en: "Customs / NACCS" },
    "domain.ocean":        { ja: "Ocean Freight",               en: "Ocean freight" },
    "domain.air":          { ja: "Air Cargo",                   en: "Air cargo" },
    "domain.global":       { ja: "Global Supply Chain",         en: "Global supply chain" },

    "home.statusTitle":    { ja: "Japan Logistics Status",      en: "Japan Logistics Status" },
    "home.overall":        { ja: "Overall Status",              en: "Overall Status" },
    "home.asOf":           { ja: "基準時点",                    en: "As of" },
    "home.latestDaily":    { ja: "最新のデイリー",              en: "Latest daily" },
    "home.latestWeekly":   { ja: "最新のウィークリー",          en: "Latest weekly" },
    "home.latestMonthly":  { ja: "最新のマンスリー",            en: "Latest monthly" },
    "home.readDaily":      { ja: "デイリーを読む",              en: "Read the daily" },
    "home.readWeekly":     { ja: "ウィークリーを読む",          en: "Read the weekly" },
    "home.readMonthly":    { ja: "マンスリーを読む",            en: "Read the monthly" },
    "home.keyIssues":      { ja: "Key Issues",                  en: "Key issues" },
    "home.execSummary":    { ja: "Executive Summary",           en: "Executive summary" },
    "home.showAll":        { ja: "すべて表示",                  en: "Show all" },
    "home.noReport":       { ja: "このタイプのレポートはまだありません。", en: "No report of this type yet." },
    "home.loadError":      { ja: "レポート一覧（data/reports.json）を読み込めませんでした。ページを再読み込みするか、ローカルではHTTPサーバー経由で開いてください。",
                             en: "Could not load data/reports.json. Reload the page, or serve the site over HTTP when running locally." },

    "archive.title":       { ja: "過去のレポート",     en: "Archive" },
    "archive.year":        { ja: "年",                 en: "Year" },
    "archive.month":       { ja: "月",                 en: "Month" },
    "archive.type":        { ja: "種別",               en: "Type" },
    "archive.status":      { ja: "Overall Status",     en: "Overall status" },
    "archive.keyword":     { ja: "キーワード",         en: "Keyword" },
    "archive.keywordHint": { ja: "タイトル・要約・タグを検索", en: "Search titles, summaries and tags" },
    "archive.all":         { ja: "すべて",             en: "All" },
    "archive.reset":       { ja: "条件をクリア",       en: "Clear filters" },
    "archive.count":       { ja: "{n} 件",             en: "{n} reports" },
    "archive.empty":       { ja: "条件に一致するレポートはありません。条件を減らしてお試しください。",
                             en: "No report matches these filters. Try removing one." },
    "archive.detail":      { ja: "詳細を見る",         en: "Open report" },

    "changes.title":       { ja: "前回からの変化",       en: "Changes since previous brief" },
    "changes.comparedWith":{ ja: "比較対象",             en: "Compared with" },
    "changes.none":        { ja: "前回データなし（初回レポート）。次回から前回比較を表示します。",
                             en: "No previous report to compare with (first brief). Comparison starts from the next one." },
    "changes.unchanged":   { ja: "前回からステータスの変化はありません。",
                             en: "No status changes since the previous brief." },
    "changes.overall":     { ja: "Overall",              en: "Overall" },
    "changes.new":         { ja: "新規リスク",           en: "New risks" },
    "changes.improved":    { ja: "改善",                 en: "Improved" },
    "changes.resolved":    { ja: "解消",                 en: "Resolved" },
    "changes.noItems":     { ja: "なし",                 en: "None" },
    "signals.title":       { ja: "主要指標",             en: "Key signals" },
    "signals.noData":      { ja: "データなし",           en: "No data" },

    "report.prev":         { ja: "← 前のレポート",     en: "← Previous" },
    "report.next":         { ja: "次のレポート →",     en: "Next →" },
    "report.archive":      { ja: "Archive",           en: "Archive" },
    "report.none":         { ja: "これが最新です",     en: "Nothing newer" },
    "report.oldest":       { ja: "これが最初です",     en: "Nothing older" },
    "report.print":        { ja: "印刷 / PDF",        en: "Print / PDF" },

    "footer.policy":       { ja: "本サイトは公開情報のみを扱います。社内・機密情報は掲載しません。",
                             en: "This site carries public-source information only. No internal or confidential material." },
    "footer.source":       { ja: "正本は日本語です。英語は閲覧時の機械翻訳です。",
                             en: "Japanese is the canonical version. English is machine-translated at read time." }
  };

  /* ---------- State ------------------------------------------------------- */

  var lang = "ja";
  var listeners = [];
  var originals = new WeakMap();   // text node -> original Japanese string
  var cache = {};                  // ja string -> en string (session)
  var translator = null;
  var translatorState = "unknown"; // unknown | ready | unavailable

  function readInitialLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "ja") return q;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ja") return saved;
    } catch (e) { /* private mode */ }
    return "ja";
  }

  function t(key, vars) {
    var entry = STRINGS[key];
    var s = entry ? (entry[lang] || entry.ja) : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace("{" + k + "}", vars[k]);
      });
    }
    return s;
  }

  /* ---------- Layer 1: swap UI strings ------------------------------------ */

  function applyUIStrings(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      // format: "placeholder:archive.keywordHint, aria-label:nav.home"
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
  }

  /* ---------- Layer 2: on-device translation of body text ----------------- */

  var BLOCK_TAGS = "p,li,h1,h2,h3,h4,td,th,caption,summary,dt,dd,figcaption,blockquote";

  /** Every leaf block inside (or equal to) an element marked data-translate. */
  function collectBlocks() {
    var blocks = [];
    document.querySelectorAll("[data-translate]").forEach(function (region) {
      if (region.closest("[translate='no'], .no-translate")) return;
      if (region.matches(BLOCK_TAGS)) blocks.push(region);
      region.querySelectorAll(BLOCK_TAGS).forEach(function (b) {
        if (!b.closest("[translate='no'], .no-translate")) blocks.push(b);
      });
    });
    return blocks;
  }

  function collectTextNodes() {
    var nodes = [];
    collectBlocks().forEach(function (block) {
      block.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          var text = n.nodeValue;
          if (text && text.trim().length > 0 && /[\u3000-\u9fff\uff00-\uffef]/.test(text)) {
            nodes.push(n);
          }
        }
      });
    });
    return nodes;
  }

  function restoreJapanese() {
    collectBlocks().forEach(function (block) {
      block.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && originals.has(n)) n.nodeValue = originals.get(n);
      });
    });
  }

  function notice(messageKey, busy) {
    var box = document.getElementById("lang-notice");
    if (!box) return;
    if (!messageKey) { box.hidden = true; box.textContent = ""; return; }
    box.hidden = false;
    box.classList.toggle("is-busy", !!busy);
    box.innerHTML = "<p></p>";
    box.firstChild.textContent = t(messageKey);
  }

  async function ensureTranslator() {
    if (translatorState === "ready") return translator;
    if (translatorState === "unavailable") return null;

    var api = self.Translator || (self.translation && self.translation.createTranslator ? self.translation : null);
    if (!api || typeof api.availability !== "function") {
      translatorState = "unavailable";
      return null;
    }
    try {
      var status = await api.availability({ sourceLanguage: "ja", targetLanguage: "en" });
      if (status === "unavailable") { translatorState = "unavailable"; return null; }
      if (status === "downloadable" || status === "downloading") notice("lang.downloading", true);
      translator = await api.create({ sourceLanguage: "ja", targetLanguage: "en" });
      translatorState = "ready";
      return translator;
    } catch (err) {
      translatorState = "unavailable";
      return null;
    }
  }

  var busy = false, pending = false;

  async function translateBody() {
    if (busy) { pending = true; return; }   // a re-render asked mid-run; queue one pass
    busy = true;
    try {
      await runTranslation();
    } finally {
      busy = false;
      if (pending) { pending = false; translateBody(); }
    }
  }

  async function runTranslation() {
    var nodes = collectTextNodes();
    if (!nodes.length) { notice(null); return; }

    var tr = await ensureTranslator();
    if (!tr) { notice("lang.unsupported"); return; }

    notice("lang.translating", true);
    var failed = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (lang !== "en") { restoreJapanese(); notice(null); return; } // switched back mid-run
      var src = originals.has(node) ? originals.get(node) : node.nodeValue;
      if (!originals.has(node)) originals.set(node, src);

      var key = src.trim();
      if (cache[key]) { node.nodeValue = cache[key]; continue; }

      try {
        var out = await tr.translate(key);
        if (out && out.trim()) {
          cache[key] = out;
          node.nodeValue = out;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;   // leave the Japanese original in place
      }
    }

    notice(failed ? "lang.partial" : "lang.done");
  }

  /* ---------- Public API --------------------------------------------------- */

  function setLang(next, opts) {
    if (next !== "ja" && next !== "en") return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}

    document.documentElement.setAttribute("lang", next);
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang-btn") === next));
    });

    applyUIStrings();
    listeners.forEach(function (fn) { try { fn(next); } catch (e) { console.error(e); } });

    if (next === "ja") {
      restoreJapanese();
      notice(null);
    } else if (!opts || opts.translateBody !== false) {
      translateBody();
    }
  }

  function initSwitch() {
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () { setLang(btn.getAttribute("data-lang-btn")); });
    });
  }

  window.LBI = {
    get lang() { return lang; },
    t: t,
    setLang: setLang,
    applyUIStrings: applyUIStrings,
    /** Re-run body translation, e.g. after JS has injected new Japanese text. */
    refreshTranslation: function () { if (lang === "en") translateBody(); },
    /** Register a callback fired whenever the language changes. */
    onLangChange: function (fn) { listeners.push(fn); },
    statusLabel: function (key) { return t("status." + (key || "unconfirmed")); },
    typeLabel: function (key) { return t("type." + key); }
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSwitch();
    var initial = readInitialLang();
    // Body translation is kicked off by page scripts once their content is rendered.
    setLang(initial, { translateBody: false });
    if (initial === "en") {
      window.setTimeout(function () { LBI.refreshTranslation(); }, 300);
    }
  });
})();
