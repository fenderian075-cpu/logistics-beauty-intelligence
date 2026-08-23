# LBI Publication Privacy Rules

LBI is published from a public GitHub repository. Monitoring scope may therefore be broader than what is safe or useful to expose in repository files or rendered pages.

## Public / private boundary

Public repository files and UI may contain:
- general Japan trade and physical-flow statistics;
- major-port, warehouse, truck, air-cargo and logistics-cost statistics;
- Beauty retail, shipment, market-size and category data;
- Brand.com source names already intended for public source transparency;
- generalized statements such as `重点輸入レーン`, `重点調達地域`, `主要T/S接続` or `priority import flow`.

Public repository files and UI must NOT contain:
- privately prioritized origin countries, ports or routing combinations;
- raw country-specific series collected only because of a private monitoring preference;
- a list from which the private sourcing pattern can be trivially reconstructed;
- hidden monitoring rationale or user-specific operational context.

## Processing rule

Sensitive monitoring dimensions are applied only during the private intelligence run. The run may use public primary sources to evaluate trade movement, origin-port conditions, carrier services, transshipment connections, congestion, blank sailings, schedule reliability and air alternatives. Before publication, the result must be generalized.

Examples of safe public outputs:
- `重点輸入レーン: 平常`
- `重点輸入レーンで接続リスク上昇`
- `主要T/S接続に24–48時間の遅延リスク`

The public result should include the operational implication without naming the private route unless the underlying event itself is independently important enough to belong in the general LBI news layer.

## Persistence

Do not persist private route/origin raw observations in `data/**`. Persist only generalized public status or conclusions when they add value. General Japan-wide trade statistics remain publishable.
