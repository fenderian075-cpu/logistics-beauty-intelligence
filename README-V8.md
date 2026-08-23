# LBI Dashboard v8

The v8 frontend uses a charts-first / tables-as-drill-downs presentation while preserving canonical `data/**` values and machine-readable IDs.

## Local validation

```bash
npm install
npm test
python scripts/validate-report.py
python scripts/validate_public_schema_integrity.py
python scripts/validate-customs-taxonomy.py
```

`npm test` runs both the static audit and the jsdom DOM smoke suite.

## Data integrity

- A line chart is not rendered with fewer than two observations.
- Mixed units are refused on a single chart axis.
- WCI/IACI remain displayed in their canonical USD/40ft source units unless a real FX observation is available.
- Tables remain available as drill-downs.
