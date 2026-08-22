# Frontend migration note — v5 (PR 1: Frontend Foundation)

This note is for whoever maintains the frontend next, and for the content
pipeline owner. It records what changed, what is a temporary shim, and what has
to be true before each shim can be deleted.

PR 1 deliberately **keeps the current information structure**. The Operations
Radar, the Topic Intelligence Digest and the homepage IA rebuild are PR 2.

---

## 1. What the frontend is now

```
assets/js/app.js                  single entry point (ES module)
  core/dom.js                     element/link/clear helpers, root() path
  core/format.js                  dates, numbers, ISO weeks
  core/labels.js                  Japanese display vocabulary
  core/nav.js                     日次/週次/月次 → latest report, current page
  core/print.js                   expand disclosures before printing
  data/store.js                   the ONLY place that fetches data/*.json
  data/adapters.js                schema tolerance, sorting, status diffing
  domain/signals.js               ranking, lens state, action-required (display only)
  render/primitives.js            row / badge / evidence / bounded list
  render/signal-card.js           signal disclosure + history strip
  render/market-regime.js         RATE/SUPPLY/DEMAND/RELIABILITY/RISK matrix
  pages/*.js                      one module per page, each exporting init()

assets/css/tokens.css             colour, type, density, breakpoints
assets/css/base.css               reset, header, page furniture, print
assets/css/components.css         reusable primitives
assets/css/pages.css              per-page layout
```

Pages declare themselves with `<body data-page="…">` and load exactly one
script: `<script type="module" src="…/assets/js/app.js">`.

**There is no build step.** That is a deliberate constraint: the content
pipeline commits directly to `main` and auto-merges, so a broken build step
would mean a broken site with no human in the loop.

---

## 2. Removed

| Removed | Why | Where the behaviour went |
|---|---|---|
| `portal-v22.js` | Re-ran a DOM rewrite every 200 ms for 6 s after load; the page never settled | Lens labels, telemetry suppression and drill links are now produced by the renderers themselves |
| `translation.js` | UI is Japanese-only; the switch existed on report pages only, and 27 KB shipped on every page | `core/labels.js` holds the Japanese vocabulary the renderers need |
| `header.js` DOM repair (`ensureBuzz`) | Papered over pages whose header markup differed | All pages now ship the same header; `tests/static-audit.mjs` enforces it |
| Duplicate `reports.json` fetches | 2× on the dashboard, 3× on report pages | `data/store.js` de-duplicates per page load |
| Runtime `<link>` / `<script>` injection in `report.js` | Race-dependent loading of the market-intelligence renderer | Static imports; the stylesheet set is in the page |
| `div[role="link"]` + scripted `tabIndex` | Not middle-clickable, not shareable, awkward for screen readers | Real `<a href>` |

Fixed along the way: the market-regime risk pill took its colour from
`confidence` while displaying `risk`, so `risk: high / confidence: medium`
rendered as 高 in amber. Risk and confidence are now separate columns.

---

## 3. Compatibility shims — and when to delete them

The content pipeline publishes report HTML from `templates/report-template.html`.
Between merging this PR and the pipeline picking up the new template, a report
may be generated that still references the old asset names. The shims exist
only for that window.

### CSS

| File | Contents | Delete when |
|---|---|---|
| `assets/css/style.css` | `@import` of the four v5 stylesheets | no file under `reports/` links `style.css` |
| `assets/css/portal-v22.css` | empty | same |
| `assets/css/ui-fixes-v26.css` | empty | same |
| `assets/css/intelligence-v3.css` | empty | same |

### JS

`site.js`, `report.js`, `signals.js`, `market-intelligence.js`, `header.js`,
`archive.js`, `buzz.js`, `commerce-calendar.js`, `source-matrix.js`,
`status-history.js`, `lens-history.js`, `portal-v22.js`, `translation.js` are
one-line forwarders to `app.js`. Delete when no published page loads them.

**Do not add rules or logic to any shim.** New styles go in
`components.css` / `pages.css`; new behaviour goes in a module.

### Removal check

```bash
grep -rl "assets/js/site.js\|assets/css/style.css" reports/ templates/
```

Empty output → the shims can go. `scripts/validate-report.py` already emits a
warning for every report that still references a legacy asset, so the warning
count is the countdown.

---

## 4. What the content pipeline needs to know

- `data/**` is untouched by the frontend and always will be. The frontend is a
  read-only consumer: unknown keys are preserved, `null` / missing / empty are
  rendered as legitimate states (未確認 / 該当なし / 比較対象なし), and schema
  version differences are absorbed in `data/adapters.js`.
- Report pages must keep: `data-root`, `data-report-date`, `data-report-type`,
  `data-page="report"`, the three `nav-latest-*` ids, and the empty
  `<div id="report-signals">`.
- `data-i18n`, `data-translate` and the language switch must **not** come back;
  the validator now fails on them.
- Regenerate new reports from `templates/report-template.html` — it already
  contains the v5 head, header, footer and script tag.

---

## 5. Tests

```bash
python3 scripts/validate-report.py     # data ↔ HTML contract (no deps)
node tests/static-audit.mjs            # links, header, imports, CSS, a11y (no deps)
npm install jsdom && node tests/dom-smoke.mjs   # renders every page against real data
```

`tests/dom-smoke.mjs` renders the real `data/**` — including the awkward parts:
unknown market dimensions, empty `data_points`, missing comparison baseline,
partial Buzz collection, month-crossing EC campaigns. Stress cases (1 / 5 / 10 /
20 repeated rows) are generated in memory; no synthetic intelligence is ever
written into `data/`.
