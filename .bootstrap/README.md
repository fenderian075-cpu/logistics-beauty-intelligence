# Logistics & Beauty Intelligence (LBI)

公開情報から物流・Beautyの重要変化を抽出し、日本の実務判断につなげる静的インテリジェンスポータルです。GitHub Pagesで公開し、GitHubリポジトリを正本として運用します。

- Repository: `fenderian075-cpu/logistics-beauty-intelligence` (Public)
- Hosting: GitHub Pages
- UI language: 日本語のみ
- Frontend: buildless ES Modules + HTML/CSS/JavaScript
- Structured data: `data/*.json`
- Production data only: 架空の本番レポートや架空ニュースは登録しません

## Production architecture

```text
Public Web
  ↓
ChatGPT Intelligence Engine
  ├─ Critical News / Operations Radar
  ├─ persistent Signals / Topic history
  ├─ Market Intelligence
  ├─ Daily / Weekly / Monthly reports
  └─ Commerce / Buzz context where supported
  ↓
GitHub branch
  ↓
validation
  ↓
Pull Request
  ↓
safe content-only updates: automatic merge
  ↓
main
  ↓
GitHub Pages
```

### Responsibility boundary

| Layer | Responsibility |
|---|---|
| ChatGPT | Web research, source verification, Critical News, Signals, Topic Intelligence, Market Intelligence, report generation, structured JSON updates, validation, safe content publication |
| Frontend | `data/**` の read-only consumer。表示・集計・ナビゲーション・visualizationのみ |
| Claude / frontend development | UX、frontend architecture、interaction、visualization、frontend PR。frontend変更は自動mergeしない |
| GitHub | Source of Truth、Git history、PR、Pages deployment |

Recurring research logicをブラウザ側へ移さないでください。Frontendは保存済みデータを読み、未知キーを無視し、optional/null/emptyを正常な状態として扱います。

## Canonical specifications

- Research / publishing pipeline: `docs/INTELLIGENCE_PIPELINE_V4.md`
- Market Intelligence method: `docs/INTELLIGENCE_METHOD_V3.md`
- Frontend migration / compatibility: `docs/FRONTEND_MIGRATION.md`
- Current report HTML contract: `templates/report-template.html`
- Persistent signal identity: `data/signal-registry.json`

READMEは現在のproduction architectureだけを説明します。旧運用はGit historyを参照してください。

## Information model

LBIは4層で構成します。

1. **Overview** — 今何に注意すべきか
2. **Topic Intelligence Digest** — 一つのテーマで何が起きているか
3. **Daily / Weekly / Monthly report** — 横断的な分析
4. **Original Evidence** — 一次情報・統計・専門媒体・IR等

Report horizons:

- Daily: Exception Intelligence — 「今日、業務を変える必要があるか」
- Weekly: Market Intelligence — 「来週〜数週間の判断材料は何か」
- Monthly: Structural Intelligence — 「何の前提が変わったか」

## Important data

| File | Role |
|---|---|
| `data/reports.json` | report index / structured memory |
| `data/signal-registry.json` | persistent Signal IDs and polarity |
| `data/critical-news.json` | decision-relevant Operations Radar |
| `data/topic-intelligence.json` | Topic Digest history/evidence |
| `data/commerce-calendar.json` | verified Beauty commerce events |
| `data/buzz.json` | Google Trends supporting evidence |
| `data/source-matrix*.json` | monitoring/source universe |
| `data/beauty-priority-brands.json` | priority Beauty brand universe |

Do not edit Signal IDs or polarity casually. History depends on stable IDs.

## Frontend v5 foundation

Frontend v5 uses a single ES Module graph rooted at:

`assets/js/app.js`

Main structure:

```text
assets/
  css/
    tokens.css
    base.css
    components.css
    pages.css
  js/
    app.js
    core/
    data/
    domain/
    render/
    pages/
```

`assets/js/data/store.js` is the single JSON loading layer. Page modules should not introduce duplicate direct fetches for the same datasets.

Legacy CSS/JS filenames remain temporarily as compatibility shims for already-published static report pages. Do not add new functionality to those shims. Removal conditions are documented in `docs/FRONTEND_MIGRATION.md`.

The old translation layer is retired. `translation.js` may temporarily remain only as a compatibility loader; there is no language switch and new markup must not use `data-translate`.

## Report publication contract

New report pages must use the CURRENT `templates/report-template.html` from latest `main`. Do not reconstruct report markup from old pages or historical templates.

Report path convention:

```text
reports/<YYYY>/<MM>/<YYYY-MM-DD>-<daily|weekly|monthly>.html
```

Recurring content updates should preserve existing report history unless an explicit correction/replacement is intended.

## Validation

Run before frontend/content PR review as applicable:

```bash
python3 scripts/validate-report.py
node tests/static-audit.mjs
node tests/dom-smoke.mjs
```

Frontend changes should additionally verify:

- no MutationObserver/setInterval post-render patching
- no duplicate dataset fetches
- real `<a href>` navigation for navigational elements
- keyboard/focus behavior
- unknown/null/empty states
- busy/repeated rows at 1/5/10/20 items
- desktop/mobile rendering
- no console errors

Warnings caused by genuinely unavailable source data should remain explicit rather than being filled with invented values.

## Source/evidence principle

LBI is not a generic news feed, but important logistics news must not be missed. The analytical chain is:

```text
source → event → observed impact → signal/topic update → Japan implication → operational decision
```

Always distinguish reported events from observed operational impact where the source data supports that distinction.

## Security / publication

This is a public repository and public website.

Do not commit:

- internal/company-confidential information
- credentials, API keys, tokens or cookies
- personal data
- private documents or internal URLs

Frontend code must not require secrets in the browser.
