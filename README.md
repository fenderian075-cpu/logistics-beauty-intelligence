# Logistics &amp; Beauty Intelligence Portal

公開情報から作成した物流・ビューティー領域のインテリジェンス・ブリーフを蓄積・閲覧するための静的サイトです。
GitHub Pages で運用します。ビルドツール・データベース・サーバーサイド処理はありません。

このリポジトリは **本番レポート専用** です。デモ用データや架空のレポートは登録・公開しません。

- Repository: `fenderian075-cpu/logistics-beauty-intelligence`（**Public**）
- Stack: HTML / CSS / vanilla JavaScript / JSON のみ
- 正本言語: **日本語**（English は閲覧時の翻訳レイヤー）
- Version: **v2.1** — signal ベースの decision intelligence dashboard
- `data/reports.json` の `schema_version`: **`"2.1"`**

---

## 0. v2.1 で何が変わったか

v2.1 は **追加のみの拡張** です。既存のレポート、既存の `reports.json` フィールド、日本語優先のデザイン、Archive、翻訳挙動はすべてそのまま動きます。破壊的なスキーマ移行は行っていません。

目的は、ポータルを「レポート置き場」から **signal ベースの decision intelligence dashboard** に変えることです。

| 変更 | 内容 |
|---|---|
| `data/signal-registry.json`（新規） | 永続 signal ID と `polarity` の正本。signal identity の Single Source of Truth |
| `intelligence` ブロック（任意） | 5つの lens ごとの構造化シグナル。未登録のレポートは従来どおり動作 |
| signal ベースの `change_summary` | `comparison_base` / `new` / `deteriorating` / `improving` / `resolved` / `unchanged_high_risk` |
| ダッシュボード再構成 | 判断ヘッダー → WHAT CHANGED → 5 LENSES → KEY SIGNALS → 最新レポート |
| Signal history | 永続 ID を突き合わせて `reports.json` から推移を導出。軽量 SVG のみ |
| Archive 構造化フィルター | Lens / 変化 / 確度。v2.1 データが存在するときだけ表示 |
| Validator 拡張 | registry 照合、enum 検証、`change_summary` の ID 解決 |
| レポート種別の説明 | Daily / Weekly / Monthly が何を答えるレポートかを常時表示 |

### 後方互換について

`intelligence` を持たない過去のレポート（v1.1 / v2 形式）は、そのまま表示・検索できます。ダッシュボードは構造化シグナルがなければ従来のステータスボードと比較ブロックにフォールバックします。

このドキュメントの中で `v1.1` に言及している箇所は、**後方互換の説明としてだけ** 残しています。新規レポートの作成手順としては使わないでください。現行の手順はセクション5・6・7です。

---

## 1. Project purpose

| | |
|---|---|
| 何のためのサイトか | 物流・ビューティーに関する **公開情報ベースのブリーフ** を、日次・週次・月次で蓄積し、後から検索できるようにする |
| 誰が読むか | 物流オペレーション担当者。朝の30秒で「今日、対応が必要か」を判断したい |
| 最優先の画面 | トップページの ACTION REQUIRED / WHAT CHANGED / 5 LENSES |
| 掲載しないもの | 社内・機密情報（→ セクション11） |

### 役割分担

現行の運用は3者で構成されます。境界を越えないことが、この仕組みが壊れない条件です。

| 担当 | 範囲 | やらないこと |
|---|---|---|
| **ChatGPT** | 公開 Web リサーチ、出典の確認、signal 生成、前回との比較、`report_body`（日本語本文）の作成、**CODEX HANDOFF の作成** | リポジトリへの直接 commit・push はしない |
| **Codex Web** | リポジトリへの反映のみ。HTML 生成、`reports.json` 更新、validation 実行、**PR 作成** | **独自に現況を調査しない。** HANDOFF にない事実を補完・推測・加筆しない |
| **GitHub** | structured memory（`reports.json`）、履歴（Git + 過去 HTML）、公開（Pages） | — |
| **このリポジトリのコード** | UI / UX、Archive、翻訳レイヤー、印刷、集計の導出、検証スクリプト | 事実分析は一切行わない |

**Codex は調査主体ではありません。** Codex が Web を見て情報を足すと、出典確認を経ていない記述がリポジトリに入り、`evidence` と本文が食い違います。Codex の入力は CODEX HANDOFF だけです。HANDOFF に不足があれば、埋めるのではなく ChatGPT に差し戻してください。

集計・判定は JavaScript が行いますが、それは **保存済みの enum 値と数値を機械的に突き合わせているだけ** です（セクション6.2）。事実の解釈は ChatGPT の担当です。

---

## 2. Architecture

### 2.1 Publishing pipeline

```
ChatGPT
  ├ data/reports.json を取得（前回比較の材料）
  ├ 必要なときだけ前回レポート HTML を取得
  ├ 公開 Web リサーチ / 出典確認
  ├ signal 生成・前回との比較
  └ CODEX HANDOFF を出力  ─────────┐
                                    │  （人が受け渡す／貼り付ける）
Codex Web  ◄────────────────────────┘
  ├ HANDOFF から HTML を生成（templates/report-template.html 準拠）
  ├ data/reports.json に entry を追加または置換
  ├ python3 scripts/validate-report.py を実行
  └ PR を作成
                    │
                人がレビュー・merge
                    │
GitHub Pages に反映（main / root、ビルドなし）
```

### 2.2 Data architecture

```
data/signal-registry.json ── signal identity の正本（ID・name_ja・lens・polarity）
data/reports.json         ── structured memory / index（軽量・毎回読む）
        │
        ├── index.html    ダッシュボード
        ├── archive.html  絞り込み・検索
        │
        └── reports/YYYY/MM/*.html   detailed historical record（必要なときだけ読む）
```

設計上の約束事は5つです。

1. **`data/reports.json` が唯一のインデックスであり、長期記憶。** トップの表示も Archive も、すべてこの1ファイルから生成されます。
2. **レポート本文は HTML に直書き。JSON はメタデータと構造化シグナルのみ。** 本文を JSON に入れないので、レポートが増えてもインデックスは軽いままです。
3. **JSON の並び順は問いません。** サイト側が日付降順にソートします。
4. **JSON = structured memory / index、HTML = detailed historical record。** ChatGPT は原則 JSON だけを読み、詳細確認が必要なときだけ `path` を使って過去 HTML を取得します。
5. **signal ID は `signal-registry.json` にあるものだけ。** ID は改名も再利用もしません。履歴はこの ID の一致だけで導出されます。

JavaScript が失敗しても、レポート本文・折りたたみ・印刷は動作します（前後リンクだけが静的な Archive リンクのまま残ります）。

### 2.3 ファイル別の役割

| ファイル | 役割 |
|---|---|
| `index.html` | ダッシュボード |
| `archive.html` | 過去レポート検索 |
| `assets/css/style.css` | 全ページ共通。デザイントークン、Status 表現、signal component、印刷 CSS |
| `assets/js/translation.js` | 言語切替。UI 辞書 + 本文の端末内機械翻訳 |
| `assets/js/signals.js` | signal モデル。registry 読込、集計、カード描画、履歴 SVG |
| `assets/js/site.js` | 共通ヘルパー、比較ヘルパー、トップページ描画 |
| `assets/js/archive.js` | Archive の絞り込みと描画 |
| `assets/js/report.js` | 個別レポートの前後ナビ、パンくず、signal カード描画 |
| `data/reports.json` | **structured memory**（索引・比較メタ・構造化シグナル） |
| `data/signal-registry.json` | 永続 signal ID の正本。`name_ja` / `lens` / `polarity` を定義 |
| `data/examples/intelligence-entry.example.json` | 記入例。サイトからは読まれません |
| `templates/report-template.html` | 新規レポートの雛形（**Codex はここをコピーして使う**） |
| `scripts/validate-report.py` | 構造検証（Codex / 人間 / 将来の CI 用） |
| `.nojekyll` | GitHub Pages の Jekyll 処理を無効化 |

---

## 3. Folder structure

```
/
├── .nojekyll
├── index.html
├── archive.html
├── README.md
│
├── assets/
│   ├── css/style.css
│   └── js/{translation,signals,site,archive,report}.js
│
├── data/
│   ├── reports.json
│   ├── signal-registry.json          ← signal ID と polarity の正本
│   └── examples/
│       └── intelligence-entry.example.json   ← 記入例（サイトからは読まれない）
│
├── scripts/
│   └── validate-report.py
│
├── templates/
│   └── report-template.html
│
└── reports/
    └── 2026/
        └── 08/2026-08-22-daily.html
```

命名規則（例外なし）:

```
reports/<YYYY>/<MM>/<YYYY-MM-DD>-<daily|weekly|monthly>.html
```

- `<MM>` は2桁ゼロ埋め（`08`。`8` は不可）
- `<YYYY-MM-DD>` はレポートの発行日。Monthly は対象月の末日（2026年7月号 → `2026-07-31-monthly.html`）
- レポートページからルートまでは常に3階層（`../../../`）。この前提が崩れると CSS・JS のパスが壊れます

---

## 4. GitHub Pages deployment

Repository と Pages は **Public** 運用です。

1. Settings → **Pages**
2. **Source** を `Deploy from a branch`
3. **Branch** を `main`、フォルダを `/ (root)` → **Save**
4. 公開URL: `https://fenderian075-cpu.github.io/logistics-beauty-intelligence/`

- `.nojekyll` があるため Jekyll のビルドは走りません。merge した内容がそのまま配信されます。
- 反映には通常30秒〜2分かかります。merge 直後に404が出ても、少し待ってから再確認してください。
- Public なので Pages 経由でも過去データを読めますが、**ChatGPT は repository 上のファイル（`data/reports.json`）を直接取得する方式を基本** とします。Pages はキャッシュにより数分遅れることがあり、直前に merge した内容と食い違う可能性があるためです。

### ローカルで確認する方法

`file://` で直接開くとブラウザの制約で `data/reports.json` の fetch がブロックされます。

```bash
cd logistics-beauty-intelligence
python3 -m http.server 8000
# → http://localhost:8000/
```

---

## 5. Publishing workflow — ChatGPT → CODEX HANDOFF → Codex Web → PR

**このセクションは ChatGPT と Codex Web が運用仕様として読むためのものです。ここに書かれていない構造を追加しないでください。**

### 5.1 責任境界（最重要）

| | ChatGPT | Codex Web |
|---|---|---|
| 公開 Web リサーチ | **する** | **しない** |
| 出典 URL の確認 | **する** | しない |
| signal の生成・enum の決定 | **する** | しない |
| 前回との比較（`change_status` の判定） | **する** | しない |
| 日本語本文（`report_body`）の作成 | **する** | しない（そのまま埋め込む） |
| HTML の組み立て | しない | **する** |
| `reports.json` の編集 | しない | **する** |
| validation 実行 | しない | **する** |
| PR 作成 | しない | **する** |

Codex は HANDOFF に書かれていない事実を **補完・推測・加筆してはいけません。** 日付が古い、出典がない、enum が欠けている──いずれの場合も、埋めずに ChatGPT へ差し戻します。

### 5.2 Token efficiency — ChatGPT が何を読み、何を読まないか

| 目的 | 読むもの |
|---|---|
| 前回の Overall / Status Board を知る | `reports.json` の該当エントリのみ |
| 前回どの signal が立っていたか知る | `reports.json` の `intelligence` の `id` と `change_status` のみ |
| 前回の WCI / SCFI と比べる | `reports.json` の `signals` のみ |
| 使える signal ID を確認する | `data/signal-registry.json` |
| 前回の分析の詳細な根拠を確認したい | **そのときだけ** `path` の HTML を取得 |

**やってはいけないこと:** Archive 全体の走査、複数の過去 HTML の一括取得、`reports.json` にある情報を過去 HTML から拾い直すこと。`reports.json` に情報が足りないと感じた場合は、HTML を読みにいくのではなく、次回以降のエントリに必要なフィールドを足してください。

### 5.3 CODEX HANDOFF の中身

ChatGPT が出力し、Codex Web が受け取る唯一の入力です。次の要素をすべて含めます。

| 要素 | 内容 |
|---|---|
| `mode` | `new`（新規） / `replace`（同 `id` の作り直し） |
| `id` / `date` / `type` | `<date>-<type>` / `YYYY-MM-DD` / `daily`・`weekly`・`monthly` |
| `path` | `reports/YYYY/MM/YYYY-MM-DD-<type>.html` |
| `title` / `status` / `as_of` | `status` は `normal` / `watch` / `disruption` / `unconfirmed` |
| `summary` / `bottom_line` | 1〜3文 / 一行結論（任意） |
| `key_issues` / `tags` | 最大3件 / Archive 検索用 |
| `status_board` | 6キー固定 |
| `signals` | WCI / SCFI などの数値指標（→ 7.3） |
| `intelligence` | lens ごとの構造化シグナル（→ 7.2）。**enum は ChatGPT が確定させる** |
| `change_summary` | v2.1 形式（→ 7.4） |
| `registry_additions` | 新規に必要な signal ID があれば、`id` / `name_ja` / `lens` / `polarity` / `beauty` をここに列挙 |
| `report_body` | レポート本文の日本語 HTML 断片（Fact / 分析 / 出典を含む） |
| `sources` | 出典の一覧（発表元・URL・日付） |

**HANDOFF に含めてはいけないもの:**

- `action_required` — ダッシュボードが導出します（→ 6.2）
- lens の集計結果・KEY SIGNALS の並び順 — 同上
- 社内情報（→ セクション11）

### 5.4 Codex Web の手順

1. `data/reports.json` と `data/signal-registry.json` を読む
2. `registry_additions` があれば、先に `data/signal-registry.json` へ追記する（`name_ja` と `lens` は必須）
3. `templates/report-template.html` をコピーし、HANDOFF の値と `report_body` を差し込んで `path` に配置する
   - `<div id="report-signals"></div>` は空のまま残す（signal カードは `reports.json` から描画されます）
4. `reports.json` の `reports[]` に entry を **追加**、`mode: replace` なら同 `id` の entry を **置換**（→ セクション9）
5. `python3 scripts/validate-report.py` を実行し、**error がゼロ** であることを確認する
6. PR を作成する。PR 本文には HANDOFF の要約と validation 結果を貼る
7. error が残る場合は PR を作らず、内容を ChatGPT に差し戻す

### 5.5 比較対象と配置

| Report | 比較対象 | 「前回からの変化」の位置 |
|---|---|---|
| Daily | 前回 Daily | Status Board の直後 |
| Weekly | 前回 Weekly | Executive Summary の直後 |
| Monthly | 前回 Monthly | Executive Summary の直後 |

Weekly は `period` に `"2026-08-10/2026-08-16"` 形式、Monthly は `"2026-07"` を入れます。Monthly の HTML には `data-report-period="2026-07"` も必要です。

同 type の過去レポートが存在しない場合、HTML は `.changes--none` ブロックだけを残し、`change_summary` は `"comparison_base": null` として各配列を空にします。

---

## 6. Canonical v2.1 model

**このセクションが v2.1 の正準モデルです。他の記述と矛盾した場合、ここが優先します。**

### 6.1 direction / impact / confidence / polarity の分離

4つの軸は独立しています。**良い・悪いの意味を `impact` や `direction` に混ぜてはいけません。**

| 軸 | 意味 | 値 | 誰が決めるか |
|---|---|---|---|
| `direction` | **観測対象そのものの動き。** 良し悪しの判断を含まない | `rising` / `falling` / `stable` / `volatile` / `unknown` | ChatGPT（レポートごと） |
| `impact` | **影響の大きさ（magnitude のみ）。** 符号を持たない | `high` / `medium` / `low` | ChatGPT（レポートごと） |
| `confidence` | その観測の確度 | `high` / `medium` / `low` | ChatGPT（レポートごと） |
| `polarity` | **どちらの方向が不利か。** signal の性質であって観測ではない | `up_is_bad` / `down_is_bad` / `neutral` | `signal-registry.json`（signal ごとに固定） |

**上昇が良いのか悪いのかは、必ず `signal-registry.json` の `polarity` から導出されます。**

- `ocean-global-price`（運賃）は `up_is_bad`。`rising` は不利。
- `ocean-intra-asia-capacity`（キャパシティ）は `down_is_bad`。`falling` が不利。
- `logistics-warehouse-automation` は `neutral`。方向だけでは良し悪しが決まらない。

同じ `direction: "rising"` が、signal によって不利にも有利にもなります。これを signal 側に埋め込むと、キャパシティ系や技術成熟度系で破綻します。だから分離しています。

UI 側の扱い（`assets/js/signals.js` の `directionTone()`）:

| polarity | rising | falling | stable | volatile | unknown |
|---|---|---|---|---|---|
| `up_is_bad` | 不利 | 有利 | 中立 | 不利 | 中立 |
| `down_is_bad` | 有利 | 不利 | 中立 | 不利 | 中立 |
| `neutral` | 中立 | 中立 | 中立 | 中立 | 中立 |

`impact` は大きさだけなので、**「影響度: 大」は良い意味にも悪い意味にもなりえます。** 良し悪しは `change_status` と `polarity × direction` が担当します。

`change_status` は前回同 type レポートとの比較結果です。`direction` とは別物で、`direction: "stable"` かつ `change_status: "deteriorating"` は矛盾しません（水準は横ばいだが、状況の評価は悪化した）。

| `change_status` | 意味 |
|---|---|
| `new` | 今回はじめて立てた signal |
| `deteriorating` | 前回より悪化 |
| `improving` | 前回より改善（ただし監視は継続） |
| `resolved` | 監視対象から外れた |
| `unchanged` | 変化なし |
| `unchanged_high_risk` | 変化はないが高リスク。見落とし防止のため「変化なし」とは別枠 |

enum を増やす場合は、`data/signal-registry.json` の `meta.enums`、`assets/js/signals.js`、`scripts/validate-report.py` の **3か所を同時に** 更新してください。

### 6.2 Derived-only — 保存しないもの

以下は **すべて表示時の導出** です。`reports.json` には保存せず、HANDOFF にも書きません。元データを書き換えることもありません。

| 表示 | 導出ルール |
|---|---|
| **ACTION REQUIRED** | 総合ステータスが `disruption`、`status_board` に `disruption`、または高影響 signal が `new`/`deteriorating` → **対応が必要**。`watch` または変化中 signal あり → **監視のみ**。ステータスが `unconfirmed` で判断材料がない → **判定不能**。それ以外 → **対応不要** |
| Lens ステータス | **表示専用の導出値**。Lensごとに語彙を分ける：Disruption = 平常/監視/障害、Cost & Capacity = 改善/安定/逼迫/変動大、Reliability = 改善/安定/悪化/変動大、Demand & Commerce = 低下/安定/上昇/変動大、Regulatory & Structural = 安定/監視/重大変化。判定には `change_status`・registry `polarity`・`direction`・`impact` を使い、reports.jsonには保存しない。 |
| WHAT CHANGED の並び | `deteriorating` → `new` → `improving` → `resolved` → `unchanged_high_risk`、同順位内はスコア順。上位5件のみ表示 |
| KEY SIGNALS の並び | `(変化の重み × 2 + 影響度 × 3) × 確度係数` の降順、上位5件 |
| direction の有利／不利 | `polarity × direction`（→ 6.1） |
| Signal history | 全レポートを同じ signal ID で突き合わせ、日付降順 |
| 指標の増減率（%） | 前回同 type レポートの `signals` との差分 |

**`action_required` は author が書くフィールドではありません。** ChatGPT も Codex も `reports.json` に書き込まないでください。手で書けるようにすると、signal は「悪化」なのに判定は「対応不要」という矛盾が起こりえます。validator はこのフィールドを見つけると警告します。

代わりに、**`operational_implication` と `action_direction` を必ず書いてください。** ダッシュボードは「対応が必要」までは導出できますが、「何をすべきか」はこの2つからしか出せません。

---

## 7. reports.json schema (v2.1)

`schema_version` は `"2.1"`。v1.1 / v2 のフィールドはすべて有効のまま、`intelligence`・`bottom_line`・signal ベースの `change_summary` が追加されています。

### 7.1 エントリ共通フィールド

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | **必須** | string | `<date>-<type>`。重複禁止 |
| `date` | **必須** | string | `YYYY-MM-DD`。Monthly は対象月の末日 |
| `type` | **必須** | string | `daily` / `weekly` / `monthly` |
| `title` | **必須** | string | レポート名（日付は含めない） |
| `status` | **必須** | string | `normal` / `watch` / `disruption` / `unconfirmed` |
| `summary` | **必須** | string | 1〜3文。トップと Archive に表示 |
| `path` | **必須** | string | ルートからの相対パス |
| `bottom_line` | 任意 | string | 一行結論。あればトップの結論表示に優先使用 |
| `as_of` | 任意 | string | 基準時点の表記 |
| `tags` | 任意 | string[] | Archive のキーワード検索とタグリンク |
| `key_issues` | daily 推奨 | string[] | 最大3件 |
| `status_board` | **最新 daily では必須** | object | 6キー固定 |
| `intelligence` | 推奨 | object | 構造化シグナル（→ 7.2） |
| `change_summary` | 推奨 | object | 前回との差分（→ 7.4） |
| `signals` | 推奨 | object | 数値指標（→ 7.3） |
| `highlights` | weekly 推奨 | object | `logistics_risk` / `freight_market` / `beauty_trend` |
| `takeaways` | monthly 推奨 | string[] | Structural Takeaways |
| `period` | 任意 | string | Weekly は `YYYY-MM-DD/YYYY-MM-DD`、Monthly は `YYYY-MM` |
| `sample` | 任意 | boolean | 後方互換用。本番公開時は `false` とし、`true` のエントリは登録しない |
| ~~`action_required`~~ | **禁止** | — | 導出フィールド。書かないこと（→ 6.2） |

`status_board` のキーは6つ固定です: `domestic` / `weather` / `customs` / `ocean` / `air` / `global`。省略したキーは `unconfirmed` として扱われます。

### 7.2 `intelligence`

5つの lens をキーとするオブジェクトです。該当がない lens は空配列にします。

| lens キー | 名称 | 何を入れるか |
|---|---|---|
| `disruption` | Disruption（障害） | 今まさに輸送を止めている／止めうる事象 |
| `cost_capacity` | Cost & Capacity | 運賃水準、スペース需給、blank sailing |
| `reliability` | Reliability | 定時性、ETA の信頼度 |
| `demand_commerce` | Demand & Commerce | 需要、EC 施策、ローンチ、市場動向 |
| `regulatory_structural` | Regulatory & Structural | 規制、制度、技術成熟度など前提の変化 |

signal 1件の形:

```json
{
  "id": "ocean-global-price",
  "signal": "観測した事実を1文で。解釈はここに書かない",
  "lens": "cost_capacity",
  "direction": "rising",
  "impact": "medium",
  "change_status": "new",
  "confidence": "medium",
  "evidence": [
    { "source": "発表元", "url": "https://…", "date": "2026-08-24" }
  ],
  "operational_implication": "自社オペレーションに何が起きるか",
  "action_direction": "とるべき対応の方向"
}
```

Beauty 系 signal（registry で `beauty: true`）は、さらに次の2つを付けます。

```json
"demand_driver": "organic | promotion | launch | buzz",
"duration": "temporary | persistent | unknown"
```

- `id` は `signal-registry.json` に **登録済みのものだけ**（→ セクション8）
- `lens` は registry の定義と一致し、かつ置かれているブロックと一致させる
- 同じ signal ID を1つのレポート内で2回使わない
- 同じ事象には **前回と同じ ID を使い回す**。新しい ID を振ると履歴が切れます

### 7.3 `signals`（数値指標）

継続比較に価値のある **主要指標だけ** を入れます。現行は `wci` と `scfi` の2つ。

```json
"signals": {
  "wci":  { "value": 4526, "unit": "USD/40ft", "data_date": "2026-08-20", "source": "…" },
  "scfi": { "value": null, "unit": null,       "data_date": null,         "source": null }
}
```

- `value` は **数値または `null`**。文字列や `"4,526"` は不可（増減率が計算できなくなります）
- 値が取得できなかった場合はキーごと消さず、`null` を入れる。「今日は取れなかった」という事実も記録です
- `data_date` は指標そのものの発表日。レポート日と一致しないことが普通です
- 将来 `bdi`、`jet_fuel`、`usdjpy` などを足す場合も同じ形にしてください。ダッシュボードはキーを走査するので、コード変更なしで表示されます
- **ここに入れるのは指標だけです。** 文章・分析は `intelligence` 側に書きます

`intelligence` との違い: `signals` は「数字の推移」、`intelligence` は「判断のついた観測」です。同じ運賃上昇でも、数字は `signals.wci`、それをどう見るかは `ocean-global-price` の signal に入ります。

### 7.4 `change_summary`（v2.1 形式）

```json
"change_summary": {
  "comparison_base": "2026-08-23-daily",
  "new": ["ocean-global-price"],
  "deteriorating": ["japan-weather-disruption"],
  "improving": ["beauty-japan-ec-promotion"],
  "resolved": [],
  "unchanged_high_risk": ["ocean-schedule-reliability"]
}
```

ここに書く ID は **同じレポートの `intelligence` に実在する signal** でなければなりません。validator が解決できない ID をエラーにします。

同 type の前回レポートがない場合は `"comparison_base": null` とし、各配列を空にします。

> **後方互換（新規レポートでは使わない）**
> v1.1 形式の `compared_with` / `overall` / `changed_categories` / `new_risks` / `improved_risks` / `resolved_risks` も引き続き読み込めます。過去のエントリを書き換える必要はありません。ただし **新規レポートは v2.1 形式で書いてください。** 両形式を1つのエントリに混在させないこと。どちらが正なのか判別できなくなります。

---

## 8. signal-registry.json

`data/signal-registry.json` は **signal identity と polarity の正本** です。

```json
"ocean-global-price": {
  "name_ja": "海上運賃（グローバル水準）",
  "name_en": "Ocean freight price, global",
  "lens": "cost_capacity",
  "polarity": "up_is_bad",
  "description_ja": "WCI・SCFI など主要インデックスに表れる海上コンテナ運賃の水準とトレンド。"
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `name_ja` | **必須** | 表示名（日本語） |
| `lens` | **必須** | 5つの lens キーのいずれか |
| `name_en` | 任意 | 英語表示時に使用 |
| `polarity` | 任意（推奨） | `up_is_bad` / `down_is_bad` / `neutral`。省略時は `neutral` |
| `beauty` | 任意 | `true` の場合、`demand_driver` と `duration` が期待される |
| `description_ja` | 任意 | signal カードを開いたときの補足 |

**ルール:**

- 登録されていない ID は使えません。validator がエラーにします
- **ID は改名しない。再利用しない。** 履歴はこの ID の一致だけで導出されます
- 新しい観測対象が必要になったら、ChatGPT が HANDOFF の `registry_additions` に列挙し、Codex が先に registry へ追記します
- `polarity` は signal の性質であってレポートごとの観測ではありません。レポート側で上書きできません

初期登録は18件です（`japan-domestic-delivery`, `japan-weather-disruption`, `japan-customs-naccs`, `ocean-global-price`, `ocean-intra-asia-capacity`, `ocean-schedule-reliability`, `ocean-blank-sailing-pressure`, `air-global-capacity`, `middle-east-maritime-risk`, `japan-logistics-regulation`, `beauty-luxury-fragrance`, `beauty-china-selective`, `beauty-japan-ec-promotion`, `beauty-major-launch`, `beauty-regulatory-risk`, `logistics-ai-exception-management`, `logistics-transport-visibility`, `logistics-warehouse-automation`）。

---

## 9. Idempotency / Retry

再実行は起こりえます。**`date` + `type` の組み合わせは、`reports.json` 全体で一意** です。

| ケース | 判定 | Codex がやること |
|---|---|---|
| **New report** | 同じ `id` が `reports.json` に無い | HTML を作成し、`reports.json` に entry を追加する |
| **Retry**（前回の PR が作られなかった等） | `id` が無いが HTML ファイルは既に存在する | HTML を **上書き** し、`reports.json` に entry を追加する。新しいファイル名を作らない |
| **Existing report replacement**（`mode: replace`） | 同じ `id` の entry が既に存在する | HTML を **上書き**、`reports.json` は該当 entry を **置換**。**entry を新規追加しない** |

判定手順:

1. `reports.json` を読む
2. `reports[]` の中に `id === "<date>-<type>"` があるか調べる
3. あれば置換モード、なければ追加モード

**やってはいけないこと:**

- 同じ `date` + `type` で2つ目の entry を append する
- 重複を避けるために `2026-08-24-daily-2.html` のようなファイル名を作る
- 既存 entry を消してから追加する（消した直後に失敗すると、HTML が孤立します）

すでに merge 済みのレポートの **事実内容を後から書き換えない** でください。訂正が必要な場合は、`mode: replace` として ChatGPT に新しい HANDOFF を作らせ、訂正の経緯を本文に残します。

---

## 10. Publishing safety

### 10.1 PR は原子的

HTML と `reports.json` は **同じ PR に含めます。** merge すれば両方が同時に反映され、merge しなければどちらも反映されません。片方だけが main に入る状態は起きません。これが v2.1 の基本です。

### 10.2 分割 commit する場合の順序

Codex が PR 内で commit を分ける場合は、必ず次の順序にします。

```
1. HTML を追加   ← 先
2. reports.json を更新 ← 後
```

| 途中で止まった場所 | 結果 | サイトへの影響 |
|---|---|---|
| 1 で止まった | 何も変わらない | なし |
| 1 は成功、2 で止まった | HTML は存在するが `reports.json` から参照されない **孤立ファイル** | **なし。** Portal も Archive も表示しないため壊れません |
| 逆順にして 1 が失敗 | `reports.json` が存在しない HTML を指す | **トップと Archive にリンク切れ** |

孤立 HTML は無害な失敗、リンク切れは有害な失敗、という非対称性を利用しています。孤立ファイルは `python3 scripts/validate-report.py` が警告として一覧します。

### 10.3 PR に必ず書くこと

- 追加・置換したレポートの `id` と `mode`
- `python3 scripts/validate-report.py` の出力（error 0 であること）
- `registry_additions` があればその内容
- 出典の一覧

---

## 11. Security / public information policy

Repository が Public であるため、**この方針の遵守はより重要になります。**

**このサイトには、公開情報から作成した Intelligence Report のみを掲載します。**

掲載しないもの:

- LVMH の機密情報
- 社内在庫データ
- 顧客情報
- 社内インシデント記録
- 社内物流データ（実績・KPI・コストを含む）
- 社内メール、非公開資料

判断基準: **「その情報を、社外の第三者が公開ソースだけで同じように書けるか」**。書けないなら掲載しません。

- レポートに書くのは、報道・公的機関・キャリア公式発表・公開インデックスなど、出典 URL を示せる情報に限ります
- 「自社への影響」を書く場合も、公開情報から誰でも導ける一般的な示唆の範囲にとどめ、具体的な社内数値・取引先名・契約条件には触れません
- **一度 merge した内容は Git 履歴に残ります。** 誤って機密情報を含めた場合、ファイルを消すだけでは不十分です（履歴の書き換えが必要）
- PR は人がレビューしてから merge します。**このレビューが最後の防波堤** です。`report_body` と `evidence` に社内情報が混ざっていないか、毎回確認してください

---

## 12. レポート HTML の書き方

`templates/report-template.html` をコピーし、`{{...}}` をすべて置換します。この作業は Codex が行います。

### 絶対に変更してはいけない箇所

- `<html lang="ja">`
- `<body data-root="../../../" data-report-date="..." data-report-type="...">`
  - `data-report-date` / `data-report-type` は `reports.json` の entry と完全一致
  - Monthly のみ `data-report-period="2026-07"` を追加
- `<head>` の `<link>`、末尾の4つの `<script>`（パスは `../../../` 固定）
- ヘッダー / フッター / パンくず / `.timeline-nav` のマークアップ
- 各セクションの `data-translate=""`（英訳対象の指定に使われます）
- `<div id="report-signals"></div>` — **空のまま残す。** signal カードは `reports.json` から描画されます

本番テンプレートにデモ用バナーを追加しないでください。`reports.json` へは本番レポートのみを登録します。

### Fact と分析を必ず分ける

```html
<p class="fact"><span class="fact__label">Fact</span>船社Aが欧州発サービスの寄港順変更を告知した。</p>
<div class="analysis">
  <p><span class="analysis__label">分析</span>遅延幅は小さいが、日本側では通関・検品に順送りで波及する。</p>
</div>
```

### 前回からの変化（人が読むブロック）

`.changes` と `.changes--none` は **どちらか一方だけ** を残します。`reports.json` の `change_summary` と内容を一致させてください。片方だけだとダッシュボードと本文が食い違います。

```html
<section aria-labelledby="chg-h" data-translate="">
  <h2 id="chg-h">前回からの変化</h2>
  <div class="changes">
    <p class="changes__meta">
      <span>比較対象: <a href="2026-08-23-daily.html">2026年8月23日 Daily</a></span>
    </p>
    <ul class="change-list">
      <li class="change-row" data-direction="worse">
        <span class="change-row__key">Overall</span>
        <span class="change-row__from"><span class="status-pill" data-status="normal"><span class="dot"></span>平常</span></span>
        <span class="change-row__arrow" aria-hidden="true">&rarr;</span>
        <span class="change-row__to"><span class="status-pill" data-status="watch"><span class="dot"></span>監視</span></span>
      </li>
    </ul>
    <div class="change-groups">
      <div class="change-group" data-kind="new">
        <p class="eyebrow">新規リスク</p>
        <ul><li>西日本で週末に大雨の予報</li></ul>
      </div>
      <div class="change-group" data-kind="improved">
        <p class="eyebrow">改善</p><p class="none">なし</p>
      </div>
      <div class="change-group" data-kind="resolved">
        <p class="eyebrow">解消</p><p class="none">なし</p>
      </div>
    </div>
  </div>
</section>
```

`data-direction` は `worse`（悪化）/ `better`（改善）/ `side`（横ばい）。行の左端に色の縦線が付きます。

初回の場合:

```html
<div class="changes changes--none">
  <p>前回データなし（アーカイブ上の初回Daily）。次回以降、前回Dailyとの差分をここに表示します。</p>
</div>
```

### そのほかのルール

- **重要度チップ:** `data-level` は `high` / `medium` / `low`。色だけでなく必ず文字も入れる
- **常時表示:** タイトル / 日付 / Overall Status / Status Board / 前回からの変化 / Executive Summary / Bottom Line / Key Issues
- **折りたたみ:** Ports、Carrier details、Regulations、Freight indices、Secondary indicators、Beauty detail
- **表は必ず `.table-scroll` で包む。** これがないとモバイルで横にはみ出します
- **出典:** 各 Fact の直下、または `.item` の末尾に `<p class="source-note">`
- **用語:** Ocean Freight / Air Cargo / WCI / SCFI / capacity / allocation / replenishment / lead time は英語のまま日本語文中で使ってよい

---

## 13. Validation

```bash
python3 scripts/validate-report.py                    # 全件
python3 scripts/validate-report.py 2026-08-24-daily   # 1件だけ
```

標準ライブラリのみ。exit code は 0（OK）/ 1（エラーあり）/ 2（`reports.json` を読めない）。**Codex は PR 作成前に必ず実行し、error 0 を確認します。**

### 構造チェック

- `reports.json` が valid JSON か / 必須フィールドの有無
- `id` の一意性、`date + type` の重複、`path` の重複
- `status` / `type` / `status_board` のキーと値
- `path` の命名規則と、HTML ファイルの実在
- HTML 側の `data-root` / `data-report-date` / `data-report-type` が JSON と一致するか
- `data-translate` が必要なセクションに付いているか
- `.changes` と `.changes--none` が排他になっているか
- `<table>` が `.table-scroll` で包まれているか
- 相対リンク切れ
- 孤立 HTML（`reports.json` から参照されていないファイル）

### v2.1 チェック

- `data/signal-registry.json` 自体の妥当性（`name_ja` 必須、`lens` と `polarity` が有効値）
- signal ID が registry に存在するか
- signal の `lens` が registry の定義と一致するか、置かれているブロックと矛盾しないか
- `direction` / `impact` / `confidence` / `change_status` の enum
- Beauty signal の `demand_driver` / `duration` の enum
- 同一レポート内での signal ID の重複
- `change_summary` の ID が同じレポートの signal に解決できるか

### 警告（エラーにはしない）

- `evidence` が未記載
- `confidence` が `high` なのに `evidence` がない
- `operational_implication` が未記載
- Beauty signal に `demand_driver` / `duration` がない
- **`action_required` が書かれている**（導出フィールドなので削除する → 6.2）

**出典 URL の到達性は検証しません。** validator はネットワークアクセスを一切行いません。到達性の確認は ChatGPT のリサーチ段階の責任です。

---

## 14. Japanese / English translation behavior

日本語が正本です。英語版の HTML は作りません。ChatGPT は日本語レポートだけを生成します。

### Layer 1 — UI 文言（辞書方式）

ナビ、ボタン、絞り込みラベル、Status 語、lens 名、enum ラベルなど **有限の UI 文言** は `assets/js/translation.js` の `STRINGS` 辞書で切り替えます。通信なし、失敗しません。HTML 側に `data-i18n="key"` を付け、辞書に `ja` / `en` を追加します。

### Layer 2 — レポート本文（端末内機械翻訳）

`data-translate=""` が付いた要素の本文を、**ブラウザ内蔵の Translator API**（Chrome / Edge 138+ の on-device 翻訳）で翻訳します。外部翻訳サービスへの通信なし・API キーなし・外部スクリプトなし。日本語原文は保持され、「日本語」に戻すと即復元されます。

非対応ブラウザ（Safari / Firefox）では UI だけ英語になり、本文は日本語のまま残ります。画面上部にブラウザ自身のページ翻訳機能の案内が出ます。**レイアウトは崩れません。**

| 方式 | 判断 |
|---|---|
| 日英2セットの HTML を管理 | ✗ 生成コストが倍 |
| Google Translate Website Widget | ✗ 提供終了済み |
| 外部翻訳 API（DeepL 等） | ✗ 静的サイトから呼ぶと API キーが露出する |
| **ブラウザ内蔵翻訳 + UI 辞書** | ✓ 依存ゼロ・鍵なし・失敗時も原文維持。**採用** |

翻訳対象外にしたい要素には `translate="no"` または `class="no-translate"` を付けます。

---

## 15. Future expansion

現在のデータ構造のまま追加できます。

| 機能 | 実現方法の見通し |
|---|---|
| Freight index の推移チャート | 既存の `signals` を日付順に読むだけ。SVG 描画（ライブラリ不要） |
| Signal ごとの詳細ページ | `signal-registry.json` の ID をそのままルーティングに使える |
| Lens 別のアーカイブビュー | 既存の構造化フィルターを URL 化するだけ |
| 全文検索 | 本文抽出済みの `search-index.json` を生成する方式 |
| GitHub Actions による validation | `scripts/validate-report.py` をそのまま CI に載せる（PR チェック） |
| 月次比較ビュー | monthly の `takeaways` と `signals` を並べる |

**やらないこと:** Database、Backend server、React / Vue、Build system、外部 translation API、大きなチャートライブラリ、Codex による自動リサーチ。

---

## 16. Troubleshooting

| 症状 | 原因と対処 |
|---|---|
| トップに何も表示されない | `data/reports.json` の構文エラー。Console を確認。末尾カンマ・全角引用符が典型 |
| ローカルで開くと空 | `file://` では fetch がブロックされる。`python3 -m http.server 8000` 経由で開く |
| Status Board が全部 Unconfirmed | 最新の daily entry に `status_board` がない |
| Lens がすべて「シグナル未登録」 | 最新 Daily に `intelligence` がない。従来のステータスボードは通常どおり動作する |
| signal カードが出ない | `intelligence` 未登録、または signal ID が registry にない。validator で確認する |
| signal history が1件だけ | 過去レポートで同じ ID を使っていない。ID を使い回すこと |
| 方向の色が逆に見える | `signal-registry.json` の `polarity` を確認する。レポート側では変えられない（→ 6.1） |
| Archive の構造化フィルターが出ない | `intelligence` を持つレポートが1件もない。データが入れば自動的に表示される |
| 「対応が必要」の判定に納得できない | 判定は導出ルール（→ 6.2）による。手で上書きはできない。signal の `impact` / `change_status` を正しく付けること |
| validator が `action_required` を警告する | 導出フィールドを書いてしまっている。エントリから削除する |
| 指標の増減率（%）が出ない | `signals.*.value` が文字列になっている。数値または `null` にする |
| 同じ日のレポートが2件出る | `date + type` が重複。片方の entry を削除する（→ セクション9） |
| Archive にレポートが出ない | `path` のスペルミス、または `date` の形式違反（`2026-8-24` は不可） |
| リンク切れ（クリックすると404） | `reports.json` が存在しない HTML を指している。commit 順序を守る（→ 10.2） |
| 前後リンクが「これが最新です」のまま | `data-report-date` / `data-report-type` が entry と一致していない |
| CSS が当たらない | 階層が `reports/YYYY/MM/` になっていない。`../../../` が合わない |
| GitHub Pages が404 | Settings → Pages のブランチ設定を確認。反映まで1〜2分 |
| 英語にしても本文が日本語のまま | 非対応ブラウザ。仕様どおりの動作 |
| 印刷で折りたたみの中身が消える | JavaScript 無効時に発生。印刷前に `<details>` を手動で開く |

---

## License / 運用メモ

- 本リポジトリは業務外の個人プロジェクトとして運用します。
- レポート本文の著作権・引用の扱いは出典元の規約に従ってください。全文転載はせず、要約と出典リンクにとどめます。
