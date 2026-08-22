# Upload

This folder is the repository root for the LBI Frontend Foundation + Intelligence Experience v6.

Key additions over Foundation v5:
- Operations Radar on the dashboard and `radar.html`
- Topic Intelligence Digest via `topic.html?id=<topic_id>`
- Dashboard IA rebuilt around decision -> radar -> status -> latest reports -> change/lenses/signals/topics
- Real `critical-news.json` and `topic-intelligence.json` are consumed directly
- Reported event and observed impact are visually distinguished
- Responsive dense-row design, not repeated large cards

## Replace an existing working tree

Copy all files in this folder over your existing repository root, then:

```bash
git add -A
git commit -m "Add LBI Intelligence Experience v6"
git push origin main
```

No changes are required to `data/**` before upload.

## Validation performed

- `python3 scripts/validate-report.py`: 0 errors / 7 existing data/content warnings
- `node tests/static-audit.mjs`: 8 checks / 0 failures
- JS syntax check passed for app/home/radar/topic modules

The 7 validator warnings are existing baseline/report-content warnings (comparison baseline / report HTML metadata), not frontend build failures.
