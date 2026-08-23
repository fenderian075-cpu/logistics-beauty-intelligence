#!/usr/bin/env bash
set -euo pipefail

# 2ae7e197 is the last main commit immediately before the broad public-content
# bot rewrite. Restore only files touched by that bot commit, then apply the
# schema-aware sanitizer in the same workflow before anything is committed.
BASELINE="2ae7e1979a2c8ea67168ef6f813a4579bf4adcc8"

files=(
  archive.html
  assets/js/core/labels.js
  assets/js/pages/economic-flow.js
  assets/js/render/market-regime.js
  buzz.html
  commerce-calendar.html
  data/beauty-priority-brands.json
  data/buzz-watchlist.json
  data/buzz.json
  data/commerce-calendar.json
  data/critical-news.json
  data/initial-baseline-note.json
  data/reports.json
  data/source-matrix-beauty-economy.json
  data/source-matrix-economics.json
  data/source-matrix-extra.json
  data/source-matrix.json
  data/topic-intelligence.json
  economic-flow.html
  index.html
  lens-history.html
  radar.html
  reports/2026/08/2026-08-22-daily.html
  reports/2026/08/2026-08-23-daily.html
  reports/2026/08/2026-08-23-monthly.html
  reports/2026/08/2026-08-23-weekly.html
  source-matrix.html
  status-history.html
  templates/economic-flow-section.html
  templates/report-template.html
  topic.html
)

git cat-file -e "${BASELINE}^{commit}"
git checkout "$BASELINE" -- "${files[@]}"
echo "Restored ${#files[@]} public files from pre-sanitize baseline $BASELINE"
