/* =========================================================================
   tests/static-audit.mjs — checks that need no DOM.
   Run: node tests/static-audit.mjs   (no dependencies)

     1. every relative href/src in every HTML file resolves on disk;
     2. the header is byte-identical across pages (modulo the path prefix) —
        it used to be repaired at run time by header.js;
     3. every ES module import resolves;
     4. no page still depends on the removed globals (LBI / LBIData /
        LBISignals) or ships translation-layer markup;
     5. !important appears only inside @media print / reduced-motion;
     6. interactive elements are natively focusable (no div[role=link],
        no tabindex on non-interactive tags).
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0, checks = 0;

function ok(name, condition, detail) {
  checks++;
  if (condition) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      walk(rel, filter, out);
    } else if (filter(rel)) out.push(rel);
  }
  return out;
}

const htmlFiles = walk(".", (f) => f.endsWith(".html") && !f.includes("templates/"));
const jsFiles = walk("assets/js", (f) => f.endsWith(".js"));
const cssFiles = walk("assets/css", (f) => f.endsWith(".css"));

/* ---- 1. asset integrity ---------------------------------------------------- */
console.log("\n[links] relative references resolve");
{
  const broken = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(REPO, file), "utf8");
    for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      const target = m[1].split("?")[0].split("#")[0];
      if (/^(https?:|mailto:|data:)/.test(target) || !target) continue;
      const resolved = path.resolve(path.dirname(path.join(REPO, file)), target);
      if (!fs.existsSync(resolved)) broken.push(`${file} → ${target}`);
    }
  }
  ok(`${htmlFiles.length} HTML files, no broken relative links`, broken.length === 0, broken.join("; "));
}

/* ---- 2. shell consistency ----------------------------------------------------
   The navigation rail and the status ribbon must be byte-identical on every
   page (modulo the path prefix). This is what used to be patched at run time
   by header.js, and what makes the ribbon trustworthy: it is the same element
   everywhere, fed by the same data. */
console.log("\n[shell] identical rail on every page");
{
  const normalise = (html) => {
    const m = html.match(/<nav class="app-rail"[\s\S]*?<\/nav>\s*<\/nav>|<nav class="app-rail"[\s\S]*?<\/div>\s*<\/nav>/);
    return m ? m[0].replace(/\.\.\/\.\.\/\.\.\//g, "").replace(/\s+/g, " ").trim() : null;
  };
  const headers = new Map();
  for (const file of htmlFiles) {
    const h = normalise(fs.readFileSync(path.join(REPO, file), "utf8"));
    if (!h) { headers.set(`MISSING:${file}`, file); continue; }
    if (!headers.has(h)) headers.set(h, []);
    headers.get(h).push(file);
  }
  ok("one canonical navigation rail across all pages", headers.size === 1,
    `${headers.size} variants: ` + Array.from(headers.values()).map((v) => (Array.isArray(v) ? v.join(",") : v)).join(" | "));
}

/* ---- 3. import graph ---------------------------------------------------------- */
console.log("\n[modules] every import resolves");
{
  const missing = [];
  for (const file of jsFiles) {
    const src = fs.readFileSync(path.join(REPO, file), "utf8");
    for (const m of src.matchAll(/from\s+"(\.[^"]+)"|import\("(\.[^"]+)"\)/g)) {
      const spec = m[1] || m[2];
      const resolved = path.resolve(path.dirname(path.join(REPO, file)), spec);
      if (!fs.existsSync(resolved)) missing.push(`${file} → ${spec}`);
    }
  }
  ok(`${jsFiles.length} JS files, all imports resolve`, missing.length === 0, missing.join("; "));
}

/* ---- 4. removed globals / translation remnants ---------------------------------- */
console.log("\n[legacy] removed layers stay removed");
{
  const offenders = [];
  for (const file of [...htmlFiles, ...jsFiles]) {
    const src = fs.readFileSync(path.join(REPO, file), "utf8");
    if (/\bwindow\.(LBI|LBIData|LBISignals)\b|\bLBI\.t\(/.test(src)) offenders.push(`${file}: legacy global`);
    if (/data-i18n|lang-switch|data-translate/.test(src)) offenders.push(`${file}: translation markup`);
    if (/MutationObserver|setInterval\(/.test(src) && !file.includes("tests/")) offenders.push(`${file}: render patching`);
  }
  ok("no legacy globals, translation markup or render patching", offenders.length === 0, offenders.join("; "));
}

/* ---- 5. CSS emphasis discipline --------------------------------------------------- */
console.log("\n[css] !important confined to print / reduced-motion");
{
  const offenders = [];
  for (const file of cssFiles) {
    const css = fs.readFileSync(path.join(REPO, file), "utf8");
    const blocks = [];
    for (const m of css.matchAll(/@media[^{]*\{/g)) {
      const start = m.index;
      const isGuarded = /print|prefers-reduced-motion/.test(m[0]);
      let depth = 0, i = start;
      for (; i < css.length; i++) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") { depth--; if (!depth) break; }
      }
      if (isGuarded) blocks.push([start, i]);
    }
    for (const m of css.matchAll(/!important/g)) {
      const inside = blocks.some(([a, b]) => m.index > a && m.index < b);
      if (!inside) offenders.push(`${file}@${m.index}`);
    }
  }
  ok("no unguarded !important", offenders.length === 0, offenders.join(", "));
}

/* ---- 6. focusability ---------------------------------------------------------------- */
console.log("\n[a11y] native focusability");
{
  const offenders = [];
  for (const file of [...htmlFiles, ...jsFiles]) {
    const src = fs.readFileSync(path.join(REPO, file), "utf8");
    if (/role="link"/.test(src)) offenders.push(`${file}: role="link"`);
    if (/setAttribute\("role",\s*"link"\)/.test(src)) offenders.push(`${file}: scripted role=link`);
    if (/tabIndex\s*=\s*0/.test(src)) offenders.push(`${file}: scripted tabindex`);
  }
  ok("no div[role=link] / scripted tabindex", offenders.length === 0, offenders.join("; "));

  const skip = htmlFiles
    .every((f) => fs.readFileSync(path.join(REPO, f), "utf8").includes('class="skip-link"'));
  ok("skip link present on every top-level page", skip);

  const focusRule = cssFiles.some((f) =>
    /:focus-visible/.test(fs.readFileSync(path.join(REPO, f), "utf8")));
  ok(":focus-visible styling exists", focusRule);
}

/* ---- 7. the console shell ------------------------------------------------------- */
console.log("\n[console] ribbon, theme boot, tokens");
{
  const missingRibbon = htmlFiles.filter((f) =>
    !fs.readFileSync(path.join(REPO, f), "utf8").includes('id="app-ribbon"'));
  ok("status ribbon present on every page including reports", missingRibbon.length === 0,
    missingRibbon.join(", "));

  const missingBoot = htmlFiles.filter((f) =>
    !fs.readFileSync(path.join(REPO, f), "utf8").includes('localStorage.getItem("lbi:theme")'));
  ok("theme/density applied before first paint (no flash)", missingBoot.length === 0,
    missingBoot.join(", "));

  const tokens = fs.readFileSync(path.join(REPO, "assets/css/tokens.css"), "utf8");
  ok("dark theme defined for both prefers-color-scheme and the manual switch",
    tokens.includes("prefers-color-scheme: dark") && tokens.includes('[data-theme="dark"]'));
  ok("density is a single token", tokens.includes('[data-density="compact"]'));

  /* Components may not hard-code colour: every colour has to come from a token,
     otherwise dark mode silently breaks. */
  const hardCoded = [];
  for (const file of cssFiles.filter((f) => !f.endsWith("tokens.css"))) {
    const css = fs.readFileSync(path.join(REPO, file), "utf8");
    // Inside @media print the tokens are deliberately redefined for paper.
    const printStart = css.indexOf("@media print");
    const body = printStart === -1 ? css : css.slice(0, printStart);
    for (const m of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      hardCoded.push(`${file}:${body.slice(0, m.index).split("\n").length} ${m[0]}`);
    }
  }
  ok("no hard-coded colours outside tokens.css", hardCoded.length === 0, hardCoded.slice(0, 6).join(", "));
}

console.log(`\n${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
