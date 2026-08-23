# UI_REDESIGN_REPORT

LBI — Economic / Logistics Intelligence の情報設計・可視化・実装の再設計

対象ブランチ: `main`（`19741d1` 時点）を取得して作業。GitHubへのマージは行っていません。

---

## Before

現状は「1ページが増え続けた」状態でした。監査で確認した具体的な問題:

| # | 問題 | 事実 |
|---|---|---|
| 1 | 1ページに責務が集中 | `economic-flow.html` にマクロ・貿易・物量・コスト・宅配需要・EC・労働力・年齢構成・ドライバー処遇・外国人材・物理キャパシティ・独自Stress指数が同居 |
| 2 | ルーター外の自己マウント | 同ページが `<script type="module">` を**5本追加**（logistics-structure / labor-capacity-stress / driver-labor-history / foreign-workforce / trucking-physical-capacity）。app.js のルーティングを経由せず、読み込み順に依存 |
| 3 | 巨大な単一モジュール | `logistics-structure.js` 20.3KB、`economic-flow.js` 18.3KB。チャート生成・データ整形・文言が同居 |
| 4 | チャート実装の重複 | `chart.js` とは別に `cost-trend-panel.js` などが独自のSVG描画を持つ |
| 5 | 図の形式が単調 | ほぼ折れ線と表。構成比・2時点比較・格差・寄与といった「意味の違い」が形式に反映されていない |
| 6 | 階層が弱い | KPIカードの横並びが続き、「何が変わったか」「なぜ重要か」が読み取れない |
| 7 | Fact / Derived / Diagnostic の区別なし | Parcel/worker、倉庫生産性、世代交代比率、Stress指数が公式統計と同じ見た目 |
| 8 | 単位の混在 | 単位の異なる系列が同一パネルに並ぶ箇所があった（例: 千トンキロ/台 と トン/人） |
| 9 | ナビの分岐 | 静的HTMLのレールが世代ごとに4種類。実行時に `ensureCanonicalRail()` が上書きして辻褄を合わせていた |
| 10 | 疑似インタラクティブ要素 | History Explorer が `div` に `role="button"` と `tabIndex` を後付け |

---

## New Information Architecture

「実体経済と物流」を **分析単位** で5ページに分割しました。ページ数を増やすためではなく、
1ページ＝1つの問いにするためです。

```
経済と物流コスト   economic-flow.html      マクロ・貿易・物量・燃料・海上運賃・国内物流価格
物流需要           logistics-demand.html   宅配便・メール便・EC・1人/1世帯あたり
輸送キャパシティ   logistics-capacity.html 事業者・車両・営業用/自家用・1台/1人あたり仕事量・倉庫
物流労働力         logistics-workforce.html 就業者・年齢構成・ドライバー処遇・求人・外国人材
構造リスク         structural-risk.html    Labor Capacity Stress v1・要素分解・感度・人口
```

レールは「実体経済と物流」グループとしてこの5本を並べ、需要 → キャパシティ → 労働力 →
構造リスク の順に読める配置にしました。各ページ末尾に `see-also` を置き、
1ページに戻さず横に渡せるようにしています。

ページ内の階層は全ページ共通で固定です:

```
Headline signal      1文＋1数値＋方向（このページで最初に読むもの）
Key indicators       構造指標 3〜4枚
Main explanatory     主説明図（1〜2枚）
Supporting           補助図
Evidence             定義・注意・出典（ディスクロージャ）
```

---

## Visualization decisions

| 指標 | 旧表示 | 新表示 | 変更理由 |
|---|---|---|---|
| EC市場（金額）× 宅配便（個数） | 別々の折れ線／二軸の懸念 | **2015=100 指数比較** | 単位が違う量を二軸で並べると、縮尺の選び方で結論が変わる。指数なら「どちらがどれだけ速いか」だけを主張できる |
| 1人あたり・1世帯あたり宅配便 | 表 | **実数の折れ線（2系列）** | 指数化すると「1人が年何個受け取るか」という直感的な水準が失われる |
| 宅配便 / メール便 | 折れ線 | 折れ線 + **定義変更の明示** | 2016年10月のゆうパケット計上変更をまたぐため、図より注記が重要 |
| 年齢構成（6階級） | 6本の折れ線 | **100%積み上げ** + **small multiples** | 構成比の問題を折れ線で描くと、総数の増減と構成の変化が混ざる。実数は共通スケールの小パネルで別に見せる |
| 業種別の高齢化 | 各業種の折れ線 | **slope chart（2時点）** | 「どの業種がどれだけ速く高齢化したか」は傾きの比較。3業種×11年の折れ線より1枚で速い |
| ドライバー処遇 vs 全産業 | 各系列の折れ線 | **dumbbell（同一年の対比）+ 格差の折れ線** | 業務的な意味は水準ではなく差。長く働いて収入が低いという関係は、対で並べないと読めない |
| 平均年齢（全産業 vs 大型/中小型） | 3本の折れ線 | **dumbbell（共通観測年）** | 3系列の最新年がずれると異年比較になる。共通年を明示的に選ぶ実装に変更 |
| 有効求人倍率 | 単独系列 | **自動車運転の職業 vs 全職業（同一出典のみ）** | 逼迫は相対値。ただし job tag 系列は接続しない（下記 Semantic safeguards） |
| 営業用 vs 自家用 | 折れ線 | **100%積み上げ ×2（トン数／トンキロ）** | 構成比の問題。かつトン数とトンキロで構成が違うこと自体が知見なので2枚に分ける |
| 事業者数 / 車両数 | 別々の折れ線 | **指数比較 + 1事業者あたりを別図** | 集約という1つの話が3図に割れていた。割り算の結果は別図にして「観測値ではない」と分かるようにした |
| 1台/1人あたり仕事量 | 個別の折れ線 | **small multiples（パネルごと独立スケール）** | 単位が異なるため共通スケールは誤読を生む。独立スケールであることをキャプションに明記 |
| Labor Capacity Stress | 折れ線 | **感度帯付き折れ線 + 寄与バー + 要素small multiples + 手法開示** | 総合と5要素を6本重ねると、水準も寄与も読めない。総合＝帯付き、寄与＝基準100からの水平バー、時系列＝小パネルに分解 |
| 人口 | 折れ線 | 折れ線（総人口・生産年齢・65歳以上）+ **比率を別図** | 実数と比率を同一軸に置かない |

チャート実装の共通ルール（`render/chart-kit.js` が強制）:

- **1系列2観測未満は折れ線にしない**（呼び出し側に `null` を返し、値表示に切り替える）
- **1つの軸に複数の単位を載せない**（混在は描画を拒否）
- 全図に 軸・単位・期間・凡例（複数系列時）・最新点・ツールチップ・`aria-label`・**数値テーブル**
- 補間・外挿は行わない
- **二軸チャートは実装していません**（必要になった場合も指数比較を第一候補にします）

---

## Page responsibilities

| ページ | 答える問い | 置かないもの |
|---|---|---|
| 経済と物流コスト | 市場と価格は何を織り込んでいるか | 労働・人口・需要構造 |
| 物流需要 | 運ぶ荷物はどれだけ・なぜ増えたか | 供給側の指標（Parcel/worker は見出しリンクのみ） |
| 輸送キャパシティ | 運ぶ箱と事業者はどう変わったか | 人の年齢・処遇 |
| 物流労働力 | 運ぶ人は足りているか、誰が運んでいるか | 独自指数（構造リスクへ） |
| 構造リスク | 需要と供給のギャップはどちらへ開いているか | 個別統計の詳細（各ページへ） |

---

## Removed / moved elements

**ルーティングから除外（重複・危険なもの）**

- `pages/logistics-structure.js`（20.3KB）・`labor-capacity-stress.js`・`driver-labor-history.js`・
  `foreign-workforce.js`・`trucking-physical-capacity.js`・`demand-context.js`・
  `logistics-productivity.js` — 内容は4ページへ再実装。既存ファイル自体は互換性・アップロード容易性のため残すが、新ルーターからは参照しない
- `economic-flow.html` の自己マウント `<script>` 5本と、そのホストセクションは除去

**移動**

- 宅配・EC・世帯需要 → 物流需要
- 就業者・年齢・処遇・外国人材 → 物流労働力
- 事業者・車両・営業用構成・生産性・倉庫 → 輸送キャパシティ
- Stress v1・感度・人口 → 構造リスク
- 全系列の一覧表 → 各ページのディスクロージャ（`flow-table` / `chart-data`）に降格。**削除はしていません**

**維持**

- History Explorer（`render/history-analysis.js`）と `data-history-metric` 連携
- 既存の `economic-flow.html` URL（ページの責務は縮小、URLは不変）

---

## Semantic safeguards

UI整理でデータ定義を消していないことを、テストで機械的に確認しています
（`tests/dom-smoke.mjs` の `testStructuralPages`）。

| 定義 | UI上の扱い | テスト |
|---|---|---|
| Parcel volume は純B2Cではない | EC比較図に注記 | 文言の存在を assert |
| EC は金額 / Parcel は個数 | 指数比較のみ。二軸なし | 「=100」表記を assert |
| Occupation ≠ Industry | 年齢構成図に「産業統計」と明記 | 文言を assert |
| Truck driver ≠ Road freight employment | 処遇表と年齢構成を別ブロックに分離 | ブロック分離を assert |
| Warehouse productivity は scope mismatch のある proxy | DERIVED バッジ + 「scope mismatch」明記 | バッジと文言を assert |
| 2020年4月の Methodology Break | 営業用/自家用は2020年度以降のみ、注記あり | 「2020年4月」を assert |
| Job Tag ≠ Comparable freight-driver vacancy | 長期系列に接続せず、「接続してはいけません」と明記 | 文言を assert |
| SSW ≠ MHLW Foreign Worker Total | 左右に分離、「合算しません」と明記 | split-grid と文言を assert |
| Policy intake ≠ Current employment | 「現在の在留者数でも採用確約数でもありません」 | 文言を assert |
| Census preliminary ≠ Population estimates | 「国勢調査速報値は別系列」と明記 | 文言を assert |
| Stress は公的指数ではない | DIAGNOSTIC バッジ + 見出しに明記 + 手法開示 | バッジと文言を assert |

**Fact / Derived / Diagnostic** は `render/panel.js` の1コンポーネントに集約し、
語（OFFICIAL / DERIVED / DIAGNOSTIC）を第一情報、色を補強としています。

---

## Responsive design

- Desktop 1280–1600px を主戦場として設計。左レール + 常設ステータスリボン + 本文1カラム。
- 1080px 以下: レールが横スクロールバー化、`split-grid` が縦積み、small multiples が2列。
- 720px 以下: indicator が2列、small multiples が2列、**slope / dumbbell のラベルは font-size を上げて維持**
  （小画面で意味を落とさないため、非表示にはしない）。
- 全チャートは `viewBox` + `preserveAspectRatio` で伸縮。数値テーブルは常に併設されるため、
  図が小さくなっても値は失われません。

---

## Technical refactoring

```
assets/js/render/chart-kit.js   新規 — indexedLine / shareStack / smallMultiples /
                                slopeChart / dumbbellChart / contributionChart / rangeBand
                                （既存 chart / sparkline を再エクスポートし、入口を1つに）
assets/js/render/panel.js       新規 — pageHead / headlineSignal / indicator / block /
                                evidence / datasetEvidence / seeAlso / provenanceBadge
assets/js/data/store.js         loadLogisticsBundle() を追加（18ファイルを1経路で取得）
assets/js/pages/logistics-*.js  新規4ページ（各 8–13KB、描画ロジックのみ）
assets/js/app.js                ルーターに4ページを登録、レールを単一テーブルから生成
assets/css/{tokens,components}  provenance / headline / indicator / analysis-block /
                                slope / dumbbell / contribution / range-band / small-multiples
```

- ページモジュールは **SVGを直接書きません**（チャート種別の選択のみ）。
- レール定義は「HTMLの静的マークアップ」と「app.js の実行時上書き」の**両方を同一表から生成**し、
  静的監査で一致を強制しています。
- History Explorer のトリガーを `role="button"` + `tabIndex` から**実 `<button>`** に変更。

---

## Validation

| 検証 | 結果 |
|---|---|
| `node tests/dom-smoke.mjs` | **235 checks / 0 failures**（新規4ページ分 65 checks を追加） |
| `node tests/static-audit.mjs` | **13 checks / 0 failures** |
| `python3 scripts/validate-report.py` | 0 errors / 8 warnings（すべてデータ側・既存） |
| `python3 scripts/validate_public_schema_integrity.py` | valid |
| `python3 scripts/audit_public_content.py` | passed（23 files） |
| `validate_labor_capacity_stress(.py/_sensitivity.py)` | success（v1 2024 = 112.1、感度 106.4–119.2） |
| `validate_trucking_business_structure.py` / `_physical_capacity.py` / `_road_freight_driver_capacity.py` / `_foreign_workforce.py` / `_household_demand.py` / `_driver_labor_history.py` / `_logistics_structure.py` | すべて success |
| `validate-customs-taxonomy.py` / `validate-report-cost-snapshot.py` / `validate_economy_history_coverage.py` | valid |
| HTML整合 | 重複ID 0・dead link 0・`data-nav` への日本語混入 0 |
| データ | `data/**` は取得時とバイト単位で一致（無変更） |
| console error | 全ページ 0（jsdomレンダリングで検証） |
| 重複fetch | 全ページ 0（1ファイル1リクエスト） |
| ポーリング/MutationObserver描画 | 0 |

**未検証**: ピクセルレンダリング。ブラウザ実描画環境はCIに含めていないため、DOM・CSS・データレベルの
検証に留まります。マージ前に `python3 -m http.server 8000` で、4ページを
1440 / 1024 / 768 / 390px とダークモードでご確認ください。

---

## Remaining recommendations

1. **`macro.usd_jpy` の観測値** — 入れば海上運賃の円主表示が有効になります（現在はドル原値を主表示にし、理由を明示）。
2. **倉庫就業者の e-Stat 系列** — `logistics-capacity.json` の warehouse productivity が proxy から一段まともになります。
3. **年齢階級の男女別** — 現在は道路貨物の女性比率のみ。階級×性別が揃えば population pyramid 型の表現が可能です。
4. **Stress v2 のウェイト議論** — 現在は等ウェイト（透明性優先）。感度分析で `freight_vacancy` を外すと +7.1 動くため、この要素の定義安定性が v2 の最大の論点です。
5. **需要ページの月次化** — 宅配便が年次のため、需要の変化を四半期以下で追えません。月次系列が入ればダッシュボードの Market Pulse にも載せられます。
6. **`market_intelligence[]` への `topic_ids`** — フロント側に残る唯一のハードコード対応表を削除できます。
