# LBI Intelligence Pipeline v4

## Purpose

LBI is a decision-intelligence system, not a generic news feed. Each scheduled research run must transform public information through the chain:

`source -> event -> observed impact -> signal/topic update -> Japan implication -> operational decision`

The research layer is responsible for producing data that supports four frontend layers:

1. Dashboard overview
2. Topic Intelligence Digest
3. Daily / Weekly / Monthly report
4. Original evidence

Frontend design is intentionally separate from this specification.

## Automated publishing

Normal report/content runs are fully automated:

1. Read latest `main` and current LBI data/history.
2. Research public web sources.
3. Produce/update report HTML and structured JSON.
4. Create a feature branch from latest `main`.
5. Validate JSON/schema/signal IDs and repository checks.
6. Create a PR.
7. Merge automatically when validation and mergeability checks pass.
8. If validation fails, sources conflict materially, schema/polarity must change, or the change includes frontend/code architecture work, do not auto-merge; leave the PR open and report the issue.

Content automation must never invent data merely to keep a section populated.

## Output objects from one research session

A run may update:

- `reports.json` / report HTML
- `critical_news[]`
- `topic_updates[]`
- `market_intelligence[]`
- persistent `intelligence[]` signals
- `commerce_events[]` when a concrete campaign/event is verified
- Buzz context when available

## Critical News / Operations Radar

LBI must not miss decision-relevant logistics news. Low-value general news is filtered out, but professionally essential events are retained even before they mature into persistent signals.

Priority:

1. Active operational disruption
2. Imminent disruption
3. Regulation effective soon
4. Major carrier/network change
5. Material capacity/reliability change
6. Significant Japan logistics structural news

Each item should contain where available:

- `id`
- `date`
- `event_date`
- `headline`
- `domain`
- `importance`
- `japan_relevance`
- `status`: `reported|observed|resolved`
- `summary`
- `observed_impact`
- `japan_implication`
- `operational_implication`
- `topic_ids[]`
- `evidence[]`

Do not promote normal telemetry into Critical News.

## Topic Intelligence Digest feed

Persistent topics use signal IDs where possible. Topic history must allow the frontend to answer:

- when it started
- when it deteriorated/improved/resolved
- what developments caused the change
- what data supports it
- what it means for Japan
- which reports discuss it

`data/topic-intelligence.json` stores the latest topic digest material and chronological developments. It is additive evidence/history, not a replacement for `signal-registry.json` or `reports.json`.

A topic update may contain:

- `topic_id`
- `title_ja`
- `current_state`
- `confidence`
- `summary`
- `japan_implication`
- `operational_implication`
- `outlook_7d`
- `outlook_30d`
- `outlook_90d`
- `developments[]`
- `data_points[]`
- `related_report_ids[]`

Development classification:

- `reported_event`
- `observed_impact`
- `market_data`
- `regulatory_update`
- `corporate_update`
- `commerce_event`
- `buzz_signal`
- `resolution`

Every development must retain source provenance.

## Evidence classes

Prefer and classify evidence as:

1. `primary_operational` — carrier, delivery company, port, terminal, government, customs, NACCS
2. `official_statistics` — Japan Maritime Center, MOF trade statistics, IATA, government statistics
3. `market_data` — Drewry, Sea-Intelligence, Alphaliner, Linerlytica, Freightos etc.
4. `professional_media` — 日本海事新聞, LOGISTICS TODAY, Daily Cargo, 日本物流新聞, カーゴニュース, The Loadstar, Air Cargo News etc.
5. `corporate_ir`
6. `brand_official`
7. `commerce_platform`
8. `search_buzz` — Google Trends

Professional media is important for discovery and context. Material facts should be traced to primary/statistical sources when practical.

## Logistics research universe

### Japan operations

Yamato, Sagawa, Japan Post, JARTIC, NEXCO, Metropolitan Expressway, Hanshin Expressway, JR Freight, major Japanese ports, airports, ferry/terminal disruptions.

### Weather/disaster

JMA: typhoon, heavy rain, snow, earthquake, tsunami, volcanic activity and transport consequences.

### Customs/trade/regulation

NACCS, Japan Customs, MOF, METI, MLIT, MHLW. Prioritize cosmetics imports but also material HS/tariff/EPA/FTA/bonded/customs/sanctions/export-control changes.

### Ocean

Carrier service changes, blank sailings, port omissions, congestion, strikes, new/suspended services, alliance/network redesign, Suez/Red Sea/Hormuz/Panama/Taiwan Strait/South China Sea.

### Air

Capacity, airport disruption, integrator disruption, dangerous goods, lithium battery/security rules, cancellations and strikes.

### Market structure

Drewry WCI/IACI, SCFI, Freightos, Alphaliner, Sea-Intelligence, Linerlytica, Japan Maritime Center, MOF trade statistics, carrier IR/liftings/utilization, IATA CTK, NYK research, Mizuho industry research, UNCTAD/JETRO where relevant.

## Market Intelligence rules

Weekly/Monthly must keep separate:

`Rate != Supply != Demand != Reliability != Risk`

Do not infer physical capacity from price alone. Distinguish announcement from observed operational impact. Explain global change -> Japan implication -> operational implication.

## Beauty scope

Equal category coverage:

- Makeup
- Skincare
- Fragrance

Commercial mechanics:

- GWP
- PWP
- charm / チャーム
- pouch / ポーチ
- key / keychain / キー
- gift
- limited kit/set
- coupon/points
- EC-exclusive
- preorder/early access

Always distinguish `organic|promotion|launch|buzz` and `temporary|persistent|unknown` where supported.

## Priority Beauty brands

Brand.com monitoring must include at minimum:

- Dior
- Guerlain / ゲラン
- Givenchy Beauty / ジバンシイ
- MAKE UP FOR EVER
- Officine Universelle Buly / Buly
- Diptyque
- Chanel
- YSL Beauty
- Lancôme
- SK-II
- 資生堂
- クレ・ド・ポー ボーテ
- Jo Malone London
- La Mer
- Byredo
- Charlotte Tilbury
- Fenty Beauty
- Rare Beauty
- Rhode
- Glossier

Other relevant brands may be added based on market significance.

## Beauty channels

Amazon Japan, Rakuten, ZOZOCOSME, Qoo10, @cosme, Brand.com, department stores and travel retail where relevant.

The research layer should preserve Brand x Category x Channel x Demand Driver relationships for future frontend drill-down.

## Google Trends

Google Trends is supporting search-interest evidence only. It is not sales evidence. X/Instagram are not assumed connected.

## Daily / Weekly / Monthly role

### Daily — Exception Intelligence

Focus on what may change operations today. Keep normal telemetry out of headlines. Important news may enter Critical News even when no persistent Signal is created.

### Weekly — Market Intelligence

Integrate freight price, supply, actual demand, reliability, network changes, operational events, Beauty demand, commerce and launches. Produce `market_intelligence` and topic updates.

### Monthly — Structural Intelligence

Explain what assumptions changed across supply/demand, connectivity, regulation, carrier economics, trade structure, logistics technology and Beauty demand/channel structure. Produce 30/90 day scenarios only when evidence supports them.

## Auto-merge guardrails

Auto-merge normal content/data updates only when:

- PR is mergeable
- structured JSON parses
- all Signal IDs exist in registry
- enum values are valid
- no production report is unexpectedly deleted
- no signal polarity/schema is changed
- validation/checks pass
- changes are limited to expected report/data/content files

Do not auto-merge when:

- frontend/application code changes
- schema changes
- signal polarity/identity changes
- large unexpected deletions
- primary sources materially conflict on a critical fact
- validation fails

In those cases, create/leave the PR open and surface the reason.
