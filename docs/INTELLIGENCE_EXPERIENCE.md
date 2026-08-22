# Intelligence Experience (v6) — information architecture and design rules

This note explains *why* the front end is shaped the way it is, so that the
next change to it — by a human or by an assistant — does not quietly undo a
decision. It complements `docs/FRONTEND_MIGRATION.md`, which covers the
foundation work (v5).

---

## 1. Four layers, four URLs

```
index.html                 Layer 1   今、何に注意すべきか        (10 seconds)
radar.html                 Layer 1.5 見逃してはいけない動き      (20 seconds)
topic.html?id=<topic_id>   Layer 2   このテーマで何が起きている  (1 interaction)
reports/YYYY/MM/*.html     Layer 3   分析成果物
外部リンク                  Layer 4   一次情報
```

Every layer has a real URL. Nothing important lives only behind a click that
cannot be shared, bookmarked or reloaded.

## 2. topic_id is the spine

`topic_id` is the only key that actually connects the dataset:

| Source | Carries |
|---|---|
| `critical-news.json` | `topic_ids[]` |
| `topic-intelligence.json` | `topic_id`, `related_report_ids[]` |
| `signal-registry.json` / `reports.json` | signal `id` — **the same namespace as `topic_id`** |
| `reports.json` `market_intelligence[]` | mapped to topics in `assets/js/data/intel.js` |

Because signal ids and topic ids coincide (`ocean-global-price`,
`middle-east-maritime-risk`, `beauty-japan-ec-promotion` …), a signal card, a
radar row, a lens group, an archive hit and a market-regime row can all resolve
to the same digest. All of that resolution happens once, in
`assets/js/data/intel.js`. **Do not re-derive relationships in a page module.**

The one hard-coded relationship is `REGIME_TOPICS` in that file, because
`market_intelligence[]` has no `topic_ids` yet. If the pipeline starts emitting
`topic_ids` on those rows, the code already prefers the data.

Dangling ids are expected: `critical-news.json` references
`ocean-intra-asia-capacity`, which has no digest yet. `intel.hasTopic(id)`
gates every link, so a missing topic degrades to plain text.

## 3. Reported ≠ observed

The distinction appears at three levels — `critical-news.status`,
`developments[].type`, and `market_intelligence[].operational_events` — and it
uses **one** representation everywhere:

- a text label (報告 / 実影響), always present;
- rule style: solid for confirmed impact, dashed for an announcement;
- colour, only as reinforcement.

A reported item with no confirmed impact says so explicitly
(「実影響は未確認です。」) rather than leaving the reader to assume.

## 4. Unknown is information

Two of six status domains, three of five dimensions on intra-Asia, several
`outlook_90d`, every `comparison_base`, and `buzz.signals` are empty in the
current baseline. The rule: **state it, weakly.**

| Situation | Treatment |
|---|---|
| 未確認 status | rendered, quiet tone, never the same weight as 障害 |
| `unknown` market dimension | 未確認 + why ("判断できる公開データを確認できていません") |
| no data points | words, never an empty chart frame |
| one data point | value + source, no sparkline — a chart of one point is decoration |
| no comparison base | 「前回データなし（初回ベースライン）」 |
| partial Buzz collection | collector state + the terms that failed |

## 5. Emphasis budget

One strong channel per row. Radar rows encode emphasis in the **weight** of the
left rule and reported/observed in its **style**; they do not also get a
background, a badge, a shadow and a colour. Strong treatment is reserved for
observed + high importance.

## 6. Cumulative noise

Everything that repeats is a row built from `render/primitives.js`, capped and
expandable:

| Component | Cap | Then |
|---|---|---|
| Dashboard radar | observed + 2, max 6 | 「すべて表示 →」 to radar.html |
| Radar group | 6 per state group | inline expander |
| Topic developments | 6 | inline expander |
| Related radar on a topic | 4 | inline expander |
| Signal history on a topic | 3 | inline expander |
| Key signals / changed signals | 5 | inline expander |
| Buzz observations | 10 | inline expander |

`tests/dom-smoke.mjs` renders each of these at 1 / 5 / 10 / 20 items.

## 7. What each page is for

| Page | Question | Not for |
|---|---|---|
| `index.html` | 今、何に注意すべきか | reading the news |
| `radar.html` | 見逃してはいけない動きは | a general news feed |
| `topic.html?id=` | このテーマで何が起きている | a link dump — the order is fixed (below) |
| `status-history.html?domain=` | このドメインで何が起きてきたか | one theme in depth |
| `lens-history.html?lens=` | この分析軸は何を言い続けているか | one theme in depth |
| `archive.html` | 過去3か月・定時性・悪化 | chronological browsing |

Topic digest order is fixed and must not be reshuffled:

```
現在の状態 → 何が変わったか → 最新動向 → データ → 含意（日本 / 業務）
→ 見通し → 関連レーダー → シグナル履歴 → 市場レジーム → 関連レポート → 根拠
```

`何が変わったか` is a synthesis (latest confirmed impact, latest reported item,
recent movement), not a repeat of the top of the chronology below it.

## 8. State lives in the URL

Filters on radar, archive and the lens explorer are written with
`history.replaceState`, and the bar preserves query parameters it does not own
(`?lens=` survives a filter change). A query can be pasted into Slack.

`localStorage` is used for exactly one thing: the timestamp behind
「前回閲覧以降の更新 n 件」. No account, nothing leaves the browser.

## 9. For the content pipeline

The frontend stays a read-only consumer of `data/**`. Things that would
immediately improve the UI if the pipeline emitted them, none of them required:

- `topic_ids[]` on `market_intelligence[]` rows (removes the last hard-coded map);
- a topic entry for every id referenced by `critical-news.topic_ids`;
- repeated `data_points` for the same `metric` (that is what turns a value into
  a sparkline);
- `class` on evidence in `reports.json` signals — topics and radar items have it
  already, and it drives the provenance tiers;
- `comparison_base` on `change_summary` once a second report of a type exists.
