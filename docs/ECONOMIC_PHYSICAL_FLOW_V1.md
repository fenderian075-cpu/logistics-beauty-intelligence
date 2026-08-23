# Economic & Physical Flow v1

LBIはニュースを集めるだけでなく、物流現象を実体経済へ接続する。

## Causal chain

Economy / Demand → Trade → Physical Flow → Warehouse / Transport → Logistics Cost / Capacity → Corporate → Operations

## Persistent stores

- `data/economy/japan-trade.json` — 財務省貿易統計。月次・旬次、国別、品目別、運送形態別。
- `data/economy/warehouse-flow.json` — 主要21社倉庫＋倉庫統計季報。入庫、出庫、保管残高、回転率。
- `data/economy/port-throughput.json` — 港湾TEU。主要5港を優先。
- `data/economy/freight-cost.json` — 日銀SPPIの道路・海上・港湾・航空・倉庫・3PL。
- `data/economy/trucking.json` — トラック輸送量、荷待ち・荷役、物流効率化法KPI。
- `data/economy/air-cargo.json` — 国内・国際航空貨物量とload factor。
- `data/economy/retail-beauty.json` — 百貨店・ドラッグストア等のBeauty実需とBeauty輸入。
- `data/economy/macro.json` — GDP、鉱工業、為替、原油等。単独ではSignal化しない。
- `data/economy/logistics-companies.json` — 物流企業の決算、物量、M&A、提携、投資、株価反応。
- `data/economy/overview.json` — ダッシュボード用の最新スナップショット。上記storeから導出する。

## Core rules

1. Reportが数値の正本にならない。時系列storeを正本とし、Reportはそれを参照する。
2. 数値・日付・固有名詞は今回開いた一次情報に基づく。取得できない値は `unknown` / 空 observations のままにする。
3. 前回値は削除せずappendする。訂正値は同じperiodに revision/status を残して更新する。
4. `published_at`, `period`, `source` を保持し、観測期間と公表日を混同しない。
5. Price, Capacity, Demand, Reliability, Inventory, Physical Flowを同一視しない。
6. Macroは背景。Trade/Physical Flow/Cost等への伝達経路が確認できたときだけLBI判断へ昇格する。
7. 株価は通常の小幅変動を保存対象のIntelligenceにしない。材料反応、異常変動、セクター再評価のみ因果を添えて扱う。
8. Beautyでは Brand.com / Google Trends（attention）→ retail/EC（sell-out proxy）→ imports（supply）→ warehouse flow を区別する。Promotionはorganic demandではない。

## Cadence

### Daily
- 財務省旬次・新規統計公表を確認。
- Brand.comは全登録ブランドを確認。
- TDnet / 物流企業IRの重大開示を確認。
- Economyデータ自体は「新規公表」またはDaily判断が変わる場合のみレポートへ載せる。

### Weekly
- `data/economy/**` の新規観測を統合。
- Trade / Port / Warehouse / Truck / Air / Cost / Corporateの方向を別々に記述。
- `templates/economic-flow-section.html` を使い、実体経済→物流のTransmissionを必ず説明する。

### Monthly
- 1〜3か月の系列で構造変化を判定。
- Inventory build / destocking、volume vs price、nominal vs effective capacityを分離。
- 物流企業の収益・投資・再編が供給構造へ与える影響を評価。
- Beauty需要をカテゴリ×チャネル×国×供給に接続する。

## Interpretation examples

- 入庫↑ + 出庫→ + 保管残高↑ = 在庫積み上がりの可能性。
- 入庫↑ + 出庫↑ + 保管残高→ = 荷動き活発化。
- Retail↑ + Import↑ + Warehouse inventory↑ = 需要増と在庫積み増しが併存。sell-throughとの速度差を確認。
- Trade↑ + Port TEU↑ + Truck/Drayage pressure↑ = Physical Flow起点のcapacity risk。
- Rate↑ alone ≠ Capacity shortage。
- Corporate profit↑ + Volume↓ + Unit price↑ = volume growthではなくpricing/mix改善の可能性。

## UI

Dashboardは Operations Radarを維持したまま、その下位分析層として「実体経済と物流」を表示する。詳細は `economic-flow.html` で時系列storeを横断する。
