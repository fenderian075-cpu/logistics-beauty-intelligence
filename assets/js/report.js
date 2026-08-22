/* Compatibility shim — report.js
   -------------------------------------------------------------------------
   This file no longer contains logic. The frontend is a single ES module
   graph rooted at assets/js/app.js (see docs/FRONTEND_MIGRATION.md).

   Why it still exists: the content pipeline publishes report pages as static
   HTML. A report generated from the pre-v5 template still requests this
   path, so the shim forwards to app.js. Dynamic import goes through the
   module map, so however many shims a legacy page loads, app.js is fetched
   and evaluated exactly once.

   Note: this is a CLASSIC script, so a bare "./app.js" specifier would
   resolve against the document URL (wrong for pages under reports/YYYY/MM/).
   The URL is therefore resolved against this script's own src.

   Safe to delete once no published page references it — see the migration
   note for the checklist. */
(function () {
  "use strict";
  var self = document.currentScript && document.currentScript.src;
  var target = new URL("app.js", self || document.baseURI).href;
  import(target).catch(function (err) {
    console.error("LBI: failed to load app.js from " + target, err);
  });
})();
