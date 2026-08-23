# LBI Comparison Standard

All comparative figures in LBI must state the comparison basis explicitly. A naked percentage such as `+6.9%` is not acceptable.

## Required labels

Use one of the following whenever a percentage or delta is comparative:

- `YoY` — versus the same period in the prior year
- `MoM` — versus the immediately preceding month
- `WoW` — versus the immediately preceding week
- `YTD` — cumulative current year to date; always state the comparison year, e.g. `2026 YTD vs 2025 YTD`
- `QTD` — quarter to date; always state the comparison base
- `vs previous release` — for revised indices / survey releases
- `vs baseline` — only when the baseline period/date is written explicitly

## Examples

Good:
- `百貨店化粧品売上: YoY +6.9% (2026年5月 vs 2025年5月)`
- `道路貨物SPPI: YoY +3.6% (2026年6月)`
- `WCI: WoW +4.0% (2026-08-20 vs 2026-08-13)`
- `2026 YTD輸入額: +5.2% vs 2025 YTD`
- `荷待ち・荷役時間: -1時間16分 vs 2024年度調査`

Bad:
- `+6.9%`
- `+4%` without a reference period
- `YTD +5.2%` without stating what YTD is compared against
- `improved 10%` without a baseline

## Data model

When possible, persistent observations should keep comparison fields separately rather than embedding them only in display text:

```json
{
  "period": "2026-05",
  "value": 42920000000,
  "unit": "JPY",
  "yoy_pct": 6.9,
  "comparison": {
    "type": "yoy",
    "base_period": "2025-05"
  },
  "published_at": "2026-06-25"
}
```

For YTD:

```json
{
  "period": "2026-YTD-05",
  "value": 123,
  "comparison": {
    "type": "ytd_yoy",
    "base_period": "2025-YTD-05"
  }
}
```

## Interpretation rule

Always distinguish:
1. level (`value`)
2. change (`YoY/MoM/WoW/YTD`)
3. comparison base
4. whether the change is value, volume, price/index, share, or time
5. source publication period and publication date

A change in nominal value must not be described as a change in physical demand unless volume evidence supports it.
