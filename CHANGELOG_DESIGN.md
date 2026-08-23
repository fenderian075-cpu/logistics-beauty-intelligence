# Design Changelog — Dashboard v8

## Added
- Market Pulse cards and operational flow on the dashboard.
- Inline SVG chart renderer with accessible numeric drill-down tables.
- Central Japanese unit/metric presentation layer.
- Economic Flow charts-first analytical layout.
- Reproducible frontend test dependency via `package.json`.
- Frontend regression GitHub Actions workflow.

## Changed
- Economic Flow tables are retained as drill-downs rather than the primary presentation.
- Fuel and ocean freight time-series are first-class frontend datasets.
- Ocean freight remains USD/40ft, matching the canonical source values.
- Archive structured filters require a single signal to satisfy all active signal criteria.
- Buzz collector health and relative-index base are shown explicitly.

## Removed
- Deprecated `cost-trend-panel.js`.
- Deprecated post-render `economy-display-ja.js` TreeWalker localization.

## Preserved
- `data/**` canonical values and schemas.
- Collector/workflow behavior other than the new regression CI.
- Internal IDs, enums, report types, URLs and privacy rules.
