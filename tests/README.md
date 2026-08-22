# tests

Two suites, both optional to run the site and neither shipped to GitHub Pages.

## `static-audit.mjs` — no dependencies

```bash
node tests/static-audit.mjs
```

Relative links resolve · the header is identical on every page · every ES module
import resolves · no removed globals (`LBI`, `LBIData`, `LBISignals`) or
translation markup · `!important` only inside `@media print` /
`prefers-reduced-motion` · no `div[role="link"]` or scripted `tabindex`.

## `dom-smoke.mjs` — needs jsdom

```bash
npm install jsdom      # dev only; the site itself has no dependencies
node tests/dom-smoke.mjs
```

Renders every page in jsdom against the **real** `data/**` and asserts, among
other things:

- no console errors, no duplicate fetches, no `setInterval` / `MutationObserver`
  render patching;
- status cells and lens cards are real links;
- repeating components stay bounded at 1 / 5 / 10 / 20 rows and the remainder is
  reachable through the expander;
- the live edge cases render honestly: unknown market dimensions, missing
  comparison baseline, empty lenses, partial Buzz collection, month-crossing EC
  campaigns, reported vs observed impact.

Stress fixtures are built in memory. Nothing synthetic is ever written into
`data/` — that directory belongs to the content pipeline.

## What these do not cover

Pixel rendering. Run the site locally and look at it before merging:

```bash
python3 -m http.server 8000     # then open http://localhost:8000/
```

Check 1440 / 1024 / 768 / 390 px wide, tab through the dashboard, and print one
report to PDF.
