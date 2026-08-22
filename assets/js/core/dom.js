/* =========================================================================
   dom.js — tiny DOM helpers.
   No framework, no template strings with user data: every node is built
   explicitly so nothing can be injected through report content.
   ========================================================================= */

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function frag() {
  return document.createDocumentFragment();
}

/** Anchor with a real href — the only navigation primitive we use. */
export function link(href, className, text) {
  const a = el("a", className, text);
  a.href = href;
  return a;
}

/** External link: opens in a new tab, never leaks the referrer chain. */
export function extLink(href, text) {
  const a = link(href, null, text);
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function qs(selector, scope) {
  return (scope || document).querySelector(selector);
}

export function qsa(selector, scope) {
  return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
}

export function byId(id) {
  return document.getElementById(id);
}

export function attrs(node, map) {
  Object.keys(map).forEach((k) => {
    const v = map[k];
    if (v == null) node.removeAttribute(k);
    else node.setAttribute(k, v);
  });
  return node;
}

/** Root path prefix for a page ("" at the site root, "../../../" in reports). */
export function root() {
  return document.body.getAttribute("data-root") || "";
}
