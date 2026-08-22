# Logistics &amp; Beauty Intelligence Portal

公開情報から作成した物流・ビューティー領域のインテリジェンス・ブリーフを蓄積・閲覧するための静的サイトです。
GitHub Pages で運用します。ビルドツール・データベース・サーバーサイド処理はありません。

このリポジトリは **本番レポート専用** です。デモ用データや架空のレポートは登録・公開しません。

- Repository: `fenderian075-cpu/logistics-beauty-intelligence`（**Public**）
- Stack: HTML / CSS / vanilla JavaScript / JSON のみ
- 正本言語: **日本語**（English は閲覧時の翻訳レイヤー）
- Version: **v1.1** — ChatGPT による完全クラウド自動運用に対応

---

## 0. v1.1 で何が変わったか

v1.1 の目的はサイト機能を増やすことではありません。**ChatGPT が最小限の読み込み量で過去を参照し、前回との差分を含むレポートを生成し、ユーザーの端末なしで GitHub へ安全に公開できる構造** を作ることです。

| 変更 | 内容 |
|---|---|
| `reports.json` を structured memory 化 | `signals`（WCI / SCFI）と `change_summary` を追加。ChatGPT は原則このファイルだけを読んで前回比較する |
| 「前回からの変化」component | Daily は Status Board 直後、Weekly / Monthly は Executive Summary 直後 |
| Idempotency 規定 | `date + type` は一意。再実行時は追加ではなく置換 |
| Fail-safe publish 順序 | HTML を先に create、`reports.json` は最後に update |
| `scripts/validate-report.py` | 構造検証スクリプト（自動運用の必須依存ではない） |
| Public 運用前提 | Private repository 前提の注意事項を削除 |

---

## 1. Project purpose

| | |
|---|---|
| 何のためのサイトか | 物流・ビューティーに関する **公開情報ベースのブリーフ** を、日次・週次・月次で蓄積し、後から検索できるようにする |
| 誰が読むか | 物流オペレーション担当者。朝の30秒で「今日、対応が必要か」を判断したい |
| 最優先の画面 | トップページの Overall Status / Status Board / 前回からの変化 |
| 掲載しないもの | 社内・機密情報（→ セクション9） |

### 役割分担

| 担当 | 範囲 |
|---|---|
| **ChatGPT** | Web 検索、情報収集、事実確認、出典確認、前回との差分分析、日本語レポート本文の生成、GitHub への commit |
| **このリポジトリ（サイト実装）** | UI / UX、HTML / CSS / JS、Archive、Timeline、翻訳レイヤー、印刷対応、データ構造、検証スクリプト |

比較・分析の中身は **すべて ChatGPT が生成** します。JavaScript 側は、保存済みのステータス値同士・数値同士を機械的に突き合わせて矢印と増減率を描くだけで、事実分析は一切行いません。

---

## 2. Architecture

```
data/reports.json  ── structured memory / index（軽量・毎回読む）
        │
        ├── index.html    ダッシュボード（最新 Daily / Weekly / Monthly、Status Board、前回からの変化）
        ├── archive.html  絞り込み・検索
        │
        └── reports/YYYY/MM/*.html   detailed historical record（必要なときだけ読む）
```

設計上の約束事は4つです。

1. **`data/reports.json` が唯一のインデックスであり、長期記憶。** トップの表示も Archive も、すべてこの1ファイルから生成されます。
2. **レポート本文は HTML に直書き。JSON はメタデータのみ。** 本文を JSON に入れないので、レポートが増えてもインデックスは軽いままです。
3. **JSON の並び順は問いません。** サイト側が日付降順にソートします。
4. **JSON = structured memory / index、HTML = detailed historical record。** ChatGPT は原則 JSON だけを読み、詳細確認が必要なときだけ `path` を使って過去 HTML を取得します。

JavaScript が失敗しても、レポート本文・折りたたみ・印刷は動作します（前後リンクだけが静的な Archive リンクのまま残ります）。

### ファイル別の役割

| ファイル | 役割 |
|---|---|
| `index.html` | ダッシュボード |
| `archive.html` | 過去レポート検索 |
| `assets/css/style.css` | 全ページ共通。デザイントークン、Status 表現、変化 component、印刷 CSS |
| `assets/js/translation.js` | 言語切替。UI 辞書 + 本文の端末内機械翻訳 |
| `assets/js/site.js` | 共通ヘルパー、比較ヘルパー、トップページ描画 |
| `assets/js/archive.js` | Archive の絞り込みと描画 |
| `assets/js/report.js` | 個別レポートの前後ナビとパンくず |
| `data/reports.json` | **structured memory**（索引・前回比較用メタ） |
| `templates/report-template.html` | 新規レポートの雛形（**ここをコピーして使う**） |
| `scripts/validate-report.py` | 構造検証（人間 / QA / 将来の CI 用） |
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
│   └── js/{translation,site,archive,report}.js
│
├── data/
│   └── reports.json
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

- `.nojekyll` があるため Jekyll のビルドは走りません。push した内容がそのまま配信されます。
- 反映には通常30秒〜2分かかります。push 直後に404が出ても、少し待ってから再確認してください。
- Public なので、ChatGPT は Pages 経由（`https://fenderian075-cpu.github.io/...`）でも過去データを取得できます。ただし **自動運用では repository 上のファイルを直接取得する方式を基本** とします。Pages はキャッシュにより数分遅れることがあり、直後に push した内容と食い違う可能性があるためです。

### ローカルで確認する方法

`file://` で直接開くとブラウザの制約で `data/reports.json` の fetch がブロックされます。

```bash
cd logistics-beauty-intelligence
python3 -m http.server 8000
# → http://localhost:8000/
```

---

## 5. Automated ChatGPT Publishing

**このセクションは ChatGPT が運用仕様として読むためのものです。ここに書かれていない構造を追加しないでください。**

### 5.1 全体フロー

```
ChatGPT Scheduled Task
   ↓ ① data/reports.json を取得（これだけで前回比較を組み立てる）
   ↓ ② 必要な場合のみ前回レポート HTML を path から取得
   ↓ ③ Web 検索・公式情報確認
   ↓ ④ 前回との差分分析
   ↓ ⑤ 日本語 HTML レポート生成
   ↓ ⑥ GitHub に新規 HTML を create      ← 先にこちら
   ↓ ⑦ data/reports.json を update       ← 最後にこちら
   ↓ GitHub Pages に自動反映
```

ユーザーの PC / Mac は起動していなくても成立します。GitHub Actions は不要です。

### 5.2 Token efficiency — 何を読み、何を読まないか

| 目的 | 読むもの |
|---|---|
| 前回の Overall / Status Board を知る | `reports.json` の該当エントリのみ |
| 前回の WCI / SCFI と比べる | `reports.json` の `signals` のみ |
| 前回どんなリスクを挙げたか知る | `reports.json` の `summary` / `key_issues` / `change_summary` のみ |
| 前回の分析の詳細な根拠を確認したい | **そのときだけ** `path` の HTML を取得 |

**やってはいけないこと:** Archive 全体の走査、複数の過去 HTML の一括取得、`reports.json` にない情報を過去 HTML から毎回拾い直すこと。`reports.json` に十分な情報が入っていないと感じた場合は、HTML を読みにいくのではなく、次回以降のエントリに必要なフィールドを足してください。

### 5.3 Daily を追加する手順

1. `data/reports.json` を取得する
2. `type: "daily"` のエントリのうち `date` が最大のものを「前回 Daily」とする
3. 必要な場合のみ、その `path` の HTML を取得する（通常は不要）
4. Web research を実施する（公開情報のみ）
5. Comparison を生成する
   - Overall の遷移（例: `normal` → `watch`）
   - `status_board` の6領域のうち **変化したものだけ**
   - 新規リスク / 改善 / 解消
   - WCI・SCFI の最新値とデータ日付
6. `templates/report-template.html` に準拠した HTML を生成する
7. `reports/YYYY/MM/YYYY-MM-DD-daily.html` を **create** する
8. `data/reports.json` に entry を **追加** する
9. 追加前に、同じ `id`（= `date`+`type`）が既に存在しないことを確認する（→ セクション7）

### 5.4 Weekly / Monthly

手順は Daily と同じで、比較対象だけが変わります。

| Report | 比較対象 | 「前回からの変化」の位置 |
|---|---|---|
| Daily | 前回 Daily | Status Board の直後 |
| Weekly | 前回 Weekly | Executive Summary の直後 |
| Monthly | 前回 Monthly | Executive Summary の直後 |

Weekly は `period` に `"2026-08-10/2026-08-16"` 形式、Monthly は `"2026-07"` を入れてください。Monthly の HTML には `data-report-period="2026-07"` も必要です。

### 5.5 Comparison の書き方（重要）

- **変化したものを最優先。** 変化していない項目を並べない。6領域のうち1つだけ変わったなら、行は1つだけです。
- **New / Improved / Resolved を区別する。** 「改善」は状況が良くなったが継続監視が必要なもの、「解消」は監視対象から外れたもの。
- **前回データなしに対応する。** アーカイブに同 type のレポートがない場合、HTML は `.changes--none` ブロックだけを残し、JSON は `"compared_with": null, "overall": "no_previous"` とします。
- **同じ内容を2か所に書く。** 「前回からの変化」は HTML（人が読む）と `reports.json` の `change_summary`（ダッシュボードが読む）の両方に必要です。片方だけだと表示が食い違います。

---

## 6. reports.json schema (v1.1)

`schema_version` は `"1.1"`。v1 のフィールドはすべて有効で、`signals` と `change_summary` が追加されました。

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | **必須** | string | `<date>-<type>`。重複禁止 |
| `date` | **必須** | string | `YYYY-MM-DD`。Monthly は対象月の末日 |
| `type` | **必須** | string | `daily` / `weekly` / `monthly` |
| `title` | **必須** | string | レポート名（日付は含めない） |
| `status` | **必須** | string | `normal` / `watch` / `disruption` / `unconfirmed` |
| `summary` | **必須** | string | 1〜3文。トップと Archive に表示 |
| `path` | **必須** | string | ルートからの相対パス |
| `as_of` | 任意 | string | 基準時点の表記 |
| `tags` | 任意 | string[] | Archive のキーワード検索とタグリンク |
| `key_issues` | daily 推奨 | string[] | 最大3件 |
| `status_board` | **最新 daily では必須** | object | 6キー固定 |
| `signals` | 推奨 | object | 継続比較する主要指標（→ 6.1） |
| `change_summary` | 推奨 | object | 前回との差分（→ 6.2） |
| `highlights` | weekly 推奨 | object | `logistics_risk` / `freight_market` / `beauty_trend` |
| `takeaways` | monthly 推奨 | string[] | Structural Takeaways |
| `period` | 任意 | string | Weekly は `YYYY-MM-DD/YYYY-MM-DD`、Monthly は `YYYY-MM` |
| `sample` | 任意 | boolean | 後方互換用。本番公開時は `false` とし、`true` のエントリは登録しない |

`status_board` のキーは6つ固定です: `domestic` / `weather` / `customs` / `ocean` / `air` / `global`。
省略したキーは `unconfirmed` として扱われます。

### 6.1 `signals`

継続比較に価値のある **主要指標だけ** を入れます。v1.1 では `wci` と `scfi` の2つを想定します。

```json
"signals": {
  "wci":  { "value": 4526, "unit": "USD/40ft", "data_date": "2026-08-20" },
  "scfi": { "value": null, "unit": null,       "data_date": null }
}
```

- `value` は **数値または `null`**。文字列や `"4,526"` は不可（増減率が計算できなくなります）
- 値が取得できなかった場合はキーごと消さず、`null` を入れる。「今日は取れなかった」という事実も記録です
- `data_date` は指標そのものの発表日。レポート日と一致しないことが普通です
- 将来 `bdi`、`jet_fuel`、`usdjpy` などを足す場合も、同じ `{value, unit, data_date}` の形にしてください。ダッシュボードは `signals` のキーを走査するので、コード変更なしで表示されます
- **ここに入れるのは指標だけです。** 文章・分析・出典 URL は入れません（JSON が肥大化します）

### 6.2 `change_summary`

```json
"change_summary": {
  "compared_with": "2026-08-20-daily",
  "overall": "normal_to_watch",
  "changed_categories": ["ocean"],
  "new_risks": ["港湾混雑と spot freight の上昇"],
  "improved_risks": [],
  "resolved_risks": []
}
```

| キー | 内容 |
|---|---|
| `compared_with` | 比較した相手の `id`。存在しない場合は `null` |
| `overall` | `<from>_to_<to>` 形式（例 `normal_to_watch`）／変化なしは `unchanged`／初回は `no_previous` |
| `changed_categories` | `status_board` のキーのうち変化したものだけ。変化なしは `[]` |
| `new_risks` | 今回新たに挙げたリスク。**最大3件** |
| `improved_risks` | 改善したが監視継続のもの。**最大3件** |
| `resolved_risks` | 監視対象から外れたもの。**最大3件** |

リストの各要素は1行（目安40字以内）。長い説明は HTML 側に書きます。

---

## 7. Idempotency / Retry

自動処理は再実行される可能性があります。**`date` + `type` の組み合わせは、`reports.json` 全体で一意** です。

| ケース | 判定 | やること |
|---|---|---|
| **New report** | 同じ `id` が `reports.json` に無い | HTML を create し、`reports.json` に entry を追加する |
| **Retry**（前回の実行が途中で失敗した） | `id` が無いが HTML ファイルは既に存在する | HTML を **update**（上書き）し、`reports.json` に entry を追加する。新しいファイル名を作らない |
| **Existing report replacement**（同日分を作り直す） | 同じ `id` の entry が既に存在する | HTML を **update**、`reports.json` は該当 entry を **置換**。**entry を新規追加しない** |

判定手順:

1. `reports.json` を取得する
2. `reports[]` の中に `id === "<date>-<type>"` があるか調べる
3. あれば置換モード、なければ追加モード

**やってはいけないこと:**
- 同じ `date` + `type` で2つ目の entry を append する
- 重複を避けるために `2026-08-24-daily-2.html` のようなファイル名を作る
- 既存 entry を消してから追加する（消した直後に失敗すると、HTML が孤立します）

---

## 8. Automated Publishing Safety（fail-safe な公開順序）

publish は必ず次の順序で行います。

```
1. data/reports.json を取得
2. 新しい HTML を生成
3. 新しい HTML を GitHub に create   ← 先
4. data/reports.json を update       ← 後
```

**この順序には意図があります。**

| 途中で失敗した場所 | 結果 | サイトへの影響 |
|---|---|---|
| 3 で失敗 | 何も変わらない | なし |
| 3 は成功、4 で失敗 | HTML は存在するが、`reports.json` から参照されない **孤立ファイル** | **なし。** Portal も Archive もこのファイルを表示しないため、サイトは壊れません。次回の実行で HTML を上書きし、entry を追加すれば復旧します |
| 逆順にした場合（4 → 3）で 3 が失敗 | `reports.json` は新レポートを指しているが HTML が無い | **トップと Archive にリンク切れが出ます。** これは避けたい状態です |

したがって **`reports.json` の更新は必ず最後** です。孤立 HTML は無害な失敗、リンク切れは有害な失敗、という非対称性を利用しています。

孤立ファイルは `python3 scripts/validate-report.py` を実行すると警告として一覧されます。

---

## 9. Security / public information policy

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

- レポートに書くのは、報道・公的機関・キャリア公式発表・公開インデックスなど、出典 URL を示せる情報に限ります。
- 「自社への影響」を書く場合も、公開情報から誰でも導ける一般的な示唆の範囲にとどめ、具体的な社内数値・取引先名・契約条件には触れません。
- **一度 push した内容は Git 履歴に残ります。** commit 前に必ず確認してください。誤って機密情報を push した場合、ファイルを消すだけでは不十分です（履歴の書き換えが必要）。
- 自動運用では ChatGPT が人手の確認なしに commit します。**Web research の結果をそのまま貼るのではなく、公開ソースに出典があることを毎回確認** してください。

---

## 10. Adding a new report（HTML の書き方）

`templates/report-template.html` をコピーし、`{{...}}` をすべて置換します。

### 絶対に変更してはいけない箇所

- `<html lang="ja">`
- `<body data-root="../../../" data-report-date="..." data-report-type="...">`
  - `data-report-date` / `data-report-type` は `reports.json` の entry と完全一致
  - Monthly のみ `data-report-period="2026-07"` を追加
- `<head>` の `<link>`、末尾の3つの `<script>`（パスは `../../../` 固定）
- ヘッダー / フッター / パンくず / `.timeline-nav` のマークアップ
- 各セクションの `data-translate=""`（英訳対象の指定に使われます）

本番テンプレートにデモ用バナーを追加しないでください。`reports.json` へは本番レポートのみを登録します。

### Fact と分析を必ず分ける

```html
<p class="fact"><span class="fact__label">Fact</span>船社Aが欧州発サービスの寄港順変更を告知した。</p>
<div class="analysis">
  <p><span class="analysis__label">分析</span>遅延幅は小さいが、日本側では通関・検品に順送りで波及する。</p>
</div>
```

### 前回からの変化（v1.1）

`.changes` と `.changes--none` は **どちらか一方だけ** を残します。

```html
<section aria-labelledby="chg-h" data-translate="">
  <h2 id="chg-h">前回からの変化</h2>
  <div class="changes">
    <p class="changes__meta">
      <span>比較対象: <a href="2026-08-20-daily.html">2026年8月20日 Daily</a></span>
      <span>WCI 2,150 USD/40ft（前回比 +1.4%）</span>
    </p>
    <ul class="change-list">
      <li class="change-row" data-direction="worse">
        <span class="change-row__key">Overall</span>
        <span class="change-row__from"><span class="status-pill" data-status="normal"><span class="dot"></span>Normal</span></span>
        <span class="change-row__arrow" aria-hidden="true">&rarr;</span>
        <span class="change-row__to"><span class="status-pill" data-status="watch"><span class="dot"></span>Watch</span></span>
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

## 11. Validation

```bash
python3 scripts/validate-report.py                    # 全件
python3 scripts/validate-report.py 2026-08-24-daily   # 1件だけ
```

標準ライブラリのみ。exit code は 0（OK）/ 1（エラーあり）/ 2（`reports.json` を読めない）。

チェック内容:

- `reports.json` が valid JSON か / 必須フィールドの有無
- `id` の一意性、`date + type` の重複、`path` の重複
- `status` / `type` / `status_board` のキーと値
- `path` の命名規則と、HTML ファイルの実在
- HTML 側の `data-root` / `data-report-date` / `data-report-type` が JSON と一致するか
- `data-translate` が必要なセクションに付いているか
- `.changes` と `.changes--none` が排他になっているか、JSON の `change_summary` と矛盾しないか
- `<table>` が `.table-scroll` で包まれているか
- 相対リンク切れ
- 孤立 HTML（`reports.json` から参照されていないファイル）

**このスクリプトは ChatGPT Scheduled Task の必須依存ではありません。** 主用途は人間による確認、repository QA、将来の GitHub Actions です。

---

## 12. Japanese / English translation behavior

日本語が正本です。英語版の HTML は作りません。ChatGPT は日本語レポートだけを生成します。

### Layer 1 — UI 文言（辞書方式）

ナビ、ボタン、絞り込みラベル、Status 語など **有限の UI 文言** は `assets/js/translation.js` の `STRINGS` 辞書で切り替えます。通信なし、失敗しません。HTML 側に `data-i18n="key"` を付け、辞書に `ja` / `en` を追加します。

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

## 13. Future expansion

v1.1 では実装していません。現在のデータ構造のまま追加できます。

| 機能 | 実現方法の見通し |
|---|---|
| Freight index の推移チャート | 既存の `signals` を日付順に読むだけ。SVG 描画（ライブラリ不要） |
| Status history | 既存の `status_board` を日付順に並べる |
| Carrier risk history | `tags` にキャリア名を含める運用で代替可能 |
| 全文検索 | 本文抽出済みの `search-index.json` を生成する方式 |
| GitHub Actions による validation | `scripts/validate-report.py` をそのまま CI に載せる |
| 月次比較ビュー | monthly の `takeaways` と `signals` を並べる |

**やらないこと（v1.1 時点）:** Database、Backend server、React / Vue、Build system、外部 translation API、GitHub Actions による自動レポート生成。

---

## 14. Troubleshooting

| 症状 | 原因と対処 |
|---|---|
| トップに何も表示されない | `data/reports.json` の構文エラー。Console を確認。末尾カンマ・全角引用符が典型 |
| ローカルで開くと空 | `file://` では fetch がブロックされる。`python3 -m http.server 8000` 経由で開く |
| Status Board が全部 Unconfirmed | 最新の daily entry に `status_board` がない |
| 「前回からの変化」が出ない | 同 type の過去 entry が1件もない（正常）。または `change_summary` が無い |
| 変化の矢印は出るが新規リスクが出ない | `change_summary.new_risks` が空。HTML にだけ書いても、ダッシュボードは JSON を読みます |
| 指標の増減率（%）が出ない | `signals.*.value` が文字列になっている。数値または `null` にする |
| 同じ日のレポートが2件出る | `date + type` が重複。片方の entry を削除する（→ セクション7） |
| Archive にレポートが出ない | `path` のスペルミス、または `date` の形式違反（`2026-8-24` は不可） |
| リンク切れ（クリックすると404） | `reports.json` 更新後に HTML の create が失敗した。publish 順序を守る（→ セクション8） |
| 前後リンクが「これが最新です」のまま | `data-report-date` / `data-report-type` が entry と一致していない |
| CSS が当たらない | 階層が `reports/YYYY/MM/` になっていない。`../../../` が合わない |
| GitHub Pages が404 | Settings → Pages のブランチ設定を確認。反映まで1〜2分 |
| 英語にしても本文が日本語のまま | 非対応ブラウザ。仕様どおりの動作 |
| 印刷で折りたたみの中身が消える | JavaScript 無効時に発生。印刷前に `<details>` を手動で開く |

---

## License / 運用メモ

- 本リポジトリは業務外の個人プロジェクトとして運用します。
- レポート本文の著作権・引用の扱いは出典元の規約に従ってください。全文転載はせず、要約と出典リンクにとどめます。
