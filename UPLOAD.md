# GitHub upload

This folder is the clean LBI Frontend Foundation v5 repository root.

## Recommended: replace the working tree of the existing repository

```bash
git clone https://github.com/fenderian075-cpu/logistics-beauty-intelligence.git
cd logistics-beauty-intelligence

# Copy all files from this package into this folder, replacing existing files.
# Then remove old tracked files that are no longer present in the package:
git add -A

git status
python3 scripts/validate-report.py
node tests/static-audit.mjs

git commit -m "Frontend Foundation v5"
git push origin main
```

Optional DOM smoke test:

```bash
npm install jsdom
node tests/dom-smoke.mjs
```

## Local preview

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/ and check desktop/mobile before pushing if desired.

## Notes

- `data/**` contains the latest v4 production baseline available in this package.
- Legacy asset filenames remain as compatibility shims; do not add new logic to them.
- Current research/publishing contract: `docs/INTELLIGENCE_PIPELINE_V4.md`
- Current report HTML contract: `templates/report-template.html`
