# v2.1 — signal-based decision intelligence dashboard

## Summary

Additive extension. No destructive schema migration, no removed fields, no deleted
reports. The existing production report (`2026-08-22-daily`) validates clean and
renders unchanged apart from gaining an empty (auto-hidden) signal section.

The portal moves from "archive of briefs" to "decision dashboard": the top of
`index.html` now answers *is action required today* before anything else, then
shows what moved since the previous brief, then five intelligence lenses, then
the most decision-relevant signals with their history.

## New files

| File | Purpose |
|---|---|
| `data/signal-registry.json` | Canonical registry of the 18 persistent signal IDs. Single source of truth for signal identity (`name_ja`, `lens`, `polarity`, `beauty`). |
| `assets/js/signals.js` | Signal model: registry loading, enums, display-only aggregation, signal cards, history derivation, inline SVG history strip. |
| `data/examples/intelligence-entry.example.json` | Documentation fixture showing the shape of a v2.1 entry. Never fetched by the site. |
| `.nojekyll` | Was missing from the repository. Disables Jekyll processing on GitHub Pages. |

## Changed files

| File | Change |
|---|---|
| `index.html` | New hierarchy: decision header (overall / action required / conclusion / timestamp / status board) → WHAT CHANGED → 5 LENSES → KEY SIGNALS → latest reports. Loads `signals.js`. |
| `archive.html` | Adds Lens / Change / Confidence filters in a second filter row, hidden unless v2.1 data exists. |
| `assets/js/site.js` | Carries `intelligence` and `bottom_line` through normalisation; adds the four new dashboard renderers; adds the report-type explainer to each latest-report panel; loads the registry alongside reports. |
| `assets/js/archive.js` | Structured filtering, URL state for the new filters, per-item signal-count / legacy markers. |
| `assets/js/report.js` | Renders signal cards from `reports.json` into the optional `#report-signals` container; hides the section when a report has no signals. |
| `assets/js/translation.js` | ~70 new JA/EN keys for lenses, enums, badges, the decision header and the archive filters. |
| `assets/css/style.css` | Appended v2.1 block: decision grid, action box, change counters, lens grid, badges, signal cards, history strip, type explainer, archive additions, responsive and print rules. Nothing above the v2.1 block was edited. |
| `templates/report-template.html` | v2.1 header docs, the `#report-signals` container, loads `signals.js`. |
| `data/reports.json` | `schema_version` → `"2.1"`; `meta` gains the registry pointer, lens list and enums. **No production entry was modified.** |
| `scripts/validate-report.py` | Registry validation, signal enum validation, lens consistency, duplicate signal IDs, `change_summary` ID resolution, evidence warnings, and a warning when a derived-only field (`action_required`) is stored. |
| `reports/2026/08/2026-08-22-daily.html` | Loads `signals.js` and gains the empty `#report-signals` container. Content untouched. |
| `README.md` | **Fully rewritten for v2.1.** Every section audited for internal consistency: schema is `2.1` throughout, the publishing workflow is ChatGPT → CODEX HANDOFF → Codex Web → PR, and the canonical data model (section 6) is now stated explicitly. Remaining v1.1 references exist only as backward-compatibility notes and are labelled as such. |

## Canonical model, stated explicitly (README section 6)

The four axes stay separated, and the README now says so as the normative spec:

| Axis | Values | Owner |
|---|---|---|
| `direction` | `rising` / `falling` / `stable` / `volatile` / `unknown` | per-report (ChatGPT) |
| `impact` | `high` / `medium` / `low` — magnitude only, no sign | per-report (ChatGPT) |
| `confidence` | `high` / `medium` / `low` | per-report (ChatGPT) |
| `polarity` | `up_is_bad` / `down_is_bad` / `neutral` | `signal-registry.json`, fixed per signal |

Whether a movement is favourable is derived from `polarity × direction` and never
encoded into `impact`. A full truth table for `directionTone()` is documented.

## ACTION REQUIRED stays derived

`action_required` is not an author-supplied field. README section 6.2 lists every
derived-only value, the CODEX HANDOFF spec (5.3) explicitly forbids it, and
`validate-report.py` now warns if `action_required`, `action_state` or
`lens_status` appears on an entry. `signals.js` carries a comment stating the
field is deliberately ignored if present.

## Workflow documentation corrected

The README no longer describes ChatGPT creating or committing GitHub files.
Responsibilities are now a hard boundary table (5.1): ChatGPT researches and
produces the handoff, Codex Web only publishes and must not research
independently. Section 5.3 specifies the CODEX HANDOFF contents; 5.4 gives
Codex's step list ending in validation and PR creation. Fail-safe ordering (10)
is reframed around the atomic PR, with the HTML-first rule kept for split
commits.

## Logistics Demand × Capacity extension (PR #71)

This branch also adds the structural logistics layer built after PR #70:

- official parcel / mail demand history and parcel intensity
- Japan total employment, transport/postal employment and employment share
- parcel-per-worker and 2015=100 demand/capacity load proxy
- driver aging, wage, working-time and vacancy pressure data
- Japan total / male / female / working-age / 65+ population history
- e-Stat API contract for transport/postal, road freight and warehousing age structure
- 15–24 / 25–34 / 35–44 / 45–54 / 55–64 / 65+ bands for all three industries
- derived 55+ share, <=34 share and <=34/55+ replacement ratio
- conditional UI: age/industry cards and charts appear automatically once official API observations are populated
- strict validation recomputes all derived ratios and checks age-band totals against published employment totals

The official e-Stat API requires an application ID. `ESTAT_APP_ID` is therefore a
repository secret consumed only by `.github/workflows/logistics-workforce-structure.yml`.
Without the secret the workflow compiles the collector, validates the last committed
dataset and exits without fabricating data. With the secret it refreshes the official
2015–2025 observations and commits only verified changes on `main`.

## Not done

No intelligence data was invented to populate the new UI. The dashboard therefore
currently shows "シグナル未登録" for all five lenses, which is the correct empty
state for the data that exists. It fills in as soon as a brief carries an
`intelligence` block.

For the logistics extension, road-freight / warehousing age observations remain
empty until the authenticated e-Stat collector runs. Freight labor productivity and
warehouse labor productivity intentionally wait for those official employment
series rather than using an estimated denominator.

## Validation

```
$ python3 scripts/validate-report.py
checked 1 report(s): 0 error(s), 0 warning(s)
```

Behaviour was additionally exercised against a temporary fixture (two synthetic
v2.1 reports, not committed) covering: lens aggregation, action-required
derivation, change ordering, key-signal ranking, history with two observations,
beauty badges, EN switching, all three archive filters, a v2.1 report page and a
legacy report page. A fault-seeded run of the validator produced 9 errors and
2 warnings across every new rule.
