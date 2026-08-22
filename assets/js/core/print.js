/* =========================================================================
   print.js — expand every disclosure before printing so progressive
   disclosure never hides evidence in a PDF, and restore state afterwards.
   ========================================================================= */

import { qsa } from "./dom.js";

let reopened = [];

export function initPrint() {
  window.addEventListener("beforeprint", () => {
    reopened = qsa("details:not([open])");
    reopened.forEach((d) => { d.open = true; });
  });
  window.addEventListener("afterprint", () => {
    reopened.forEach((d) => { d.open = false; });
    reopened = [];
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-print]");
    if (btn) {
      e.preventDefault();
      window.print();
    }
  });
}
