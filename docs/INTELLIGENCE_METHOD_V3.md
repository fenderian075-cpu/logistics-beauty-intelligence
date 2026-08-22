# Logistics & Beauty Intelligence — Intelligence Method v3

## Purpose

The portal must not become a generic news digest. DAILY, WEEKLY and MONTHLY have different jobs:

- **DAILY — Exception Intelligence**: what changed today that can alter operations?
- **WEEKLY — Market Intelligence**: what changed in price, capacity, reliability, actual cargo demand and commerce signals, and why?
- **MONTHLY — Structural Intelligence**: which assumptions about supply, demand, networks, regulation, technology and Beauty demand have changed over 1–3 months?

Normal operating telemetry belongs in the Status Board, not in Key Signals. Recovery from an actual problem may appear once as `resolved` or `improving`.

---

## 1. Evidence stack

Use different evidence layers for different questions. Do not substitute one layer for another.

### A. Price / freight market
Examples: Drewry WCI, Drewry IACI, SCFI, Freightos FBX, air-freight indices.

Answers: **What is happening to price?**

### B. Capacity / supply
Examples: blank sailings, deployed capacity, newbuilding deliveries, demolition, charter market, carrier capacity guidance.

Answers: **Why might price move and how much space is structurally available?**

### C. Reliability / service quality
Examples: schedule reliability, average delay, port congestion, vessel waiting, omissions, missed connections, service changes.

Answers: **Can a booked shipment arrive when planned?**

### D. Actual cargo demand
Examples: Japan Maritime Center container statistics, Ministry of Finance trade statistics, carrier liftings/load factor, IATA CTK.

Answers: **Is physical cargo demand actually rising or falling?**

### E. Carrier economics & network strategy
Examples: ONE / Maersk / Hapag-Lloyd / CMA CGM / COSCO / Evergreen / Yang Ming IR and service advisories.

Answers: **How are carriers responding to market economics?**

### F. Operational event evidence
Examples: carrier advisories, port/terminal notices, government warnings, AIS/congestion providers, professional logistics media.

Answers: **Did the announced event actually cause operational impact?**

### G. Macro / structural outlook
Examples: UNCTAD, JETRO, NYK Research, major bank/industry outlooks, government logistics policy.

Answers: **What structural forces may shape the next 1–12 months?**

### H. Beauty demand & commerce
Examples: company IR, Amazon/Rakuten/ZOZOCOSME/Qoo10/@cosme, Brand.com, Google Trends.

Answers: **Is demand organic, promotion-driven, launch-driven or only buzz?**

---

## 2. Core analytical rule: never use one metric as a proxy for another

Examples:

- WCI rising does **not** prove physical capacity is falling.
- Blank sailings rising does **not** automatically prove end-demand is strong.
- Schedule reliability deteriorating does **not** mean freight prices must rise.
- A carrier announcement does **not** prove operational disruption occurred.
- Social/search buzz does **not** prove sell-through.

Price, capacity, reliability, demand and risk must remain separate fields and be connected only through explicit analysis.

---

## 3. Market Intelligence Frame

For each decision-relevant lane / market / topic in WEEKLY or MONTHLY, build a compact frame:

```yaml
market_intelligence:
  - id: asia-europe-ocean
    scope: Asia-Europe ocean freight
    rate:
      direction: rising|falling|stable|volatile|unknown
      evidence: []
    supply:
      direction: tightening|loosening|stable|volatile|unknown
      evidence: []
    demand:
      direction: rising|falling|stable|mixed|unknown
      evidence: []
    reliability:
      direction: improving|deteriorating|stable|volatile|unknown
      evidence: []
    operational_events:
      reported: []
      observed_impact: []
    structural_drivers: []
    japan_implication: "..."
    operational_implication: "..."
    outlook_30d: "..."
    risk_scenario: "..."
    confidence: high|medium|low
```

This is an **optional additive v3 analytical layer**. Existing v2.1 Signal IDs remain the persistent time-series identity layer.

---

## 4. Reported Event vs Observed Impact

Every major disruption should distinguish:

1. **Reported event** — strike announced, port restriction issued, carrier rerouting announced, weather warning issued.
2. **Observed operational impact** — vessels waiting, terminal closure, actual cancellation, missed connection, delivery suspension, measurable delay.

If only an announcement is verified, do not state that material operational impact has already occurred.

Professional media may identify the event; operational impact should be confirmed from primary operational sources or observable operational data where feasible.

---

## 5. Supply / Demand explanation

Do not write only `WCI +4%` or `IACI -3%`.

Explain the balance where evidence permits:

### Downward / easing forces
- new vessel deliveries
- returning capacity after route normalization
- weak US/EU goods demand
- inventory normalization
- overcapacity

### Upward / supporting forces
- blank sailings / slow steaming
- Red Sea / Cape diversion
- port congestion
- stronger Intra-Asia / emerging-market demand
- inventory replenishment
- strikes / weather / capacity withdrawal

State which are **observed facts**, which are **analytical interpretation**, and which are **risk scenarios**.

---

## 6. Japan-first implication chain

For important international developments, use this chain:

`Global market change → Japan-bound / Japan-origin impact → operational implication`

Examples of useful Japan-specific questions:

- Is direct-call frequency changing?
- Is transshipment via Busan / Singapore / Shanghai increasing?
- Is connection risk increasing even if spot rates soften?
- Are Japan import/export volumes confirming the global story?
- Does a regulation affect cosmetics, dangerous goods, customs or documentation?

A global event with no plausible Japan relevance should normally be omitted.

---

## 7. Carrier Network Intelligence

Track not only carrier announcements but the economic logic behind them:

- direct service vs hub-and-spoke
- port-call reduction
- transshipment increase
- alliance redesign
- blank sailing / capacity discipline
- utilization / liftings where disclosed
- profitability / freight index in carrier IR

A network change becomes report-worthy when it changes lead-time variability, connection risk, booking options, cost or Japan connectivity.

---

## 8. Beauty intelligence remains multi-category

Beauty means **Makeup / Skincare / Fragrance**, plus commercial mechanics such as GWP, PWP, pouch, charm and key promotions.

Each demand signal should distinguish:

- `organic`
- `promotion`
- `launch`
- `buzz`

Google Trends is supportive evidence for buzz/search interest, not proof of sales. Cross-channel confirmation from rankings, Brand.com, company IR or commerce platforms increases confidence.

---

## 9. Source hierarchy and conflicts

Priority:

1. Primary operational / government / carrier / corporate sources
2. Official statistics and established market indices
3. Specialist data providers / research organizations
4. Professional logistics and trade media
5. General news
6. Search/social signals

When sources disagree, do not silently reconcile them. State the discrepancy and what each metric measures.

Paid or inaccessible data may be mentioned as the expected source, but unpublished values must not be reconstructed from snippets.

---

## 10. What good WEEKLY output looks like

A strong WEEKLY should answer:

1. What moved?
2. Was the movement price, capacity, demand, reliability or risk?
3. What evidence supports each component?
4. What caused it?
5. Is the event announced or operationally observed?
6. What does it mean for Japan?
7. What should be monitored over the next 2–4 weeks?

The objective is **decision intelligence, not article count**.
