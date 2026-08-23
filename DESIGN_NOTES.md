# Design Notes — Dashboard v8

## Design goals
LBIを「数字の一覧」ではなく、毎朝短時間で変化・背景・実務影響を把握できる Operational Intelligence Dashboard として読む。Economic Flow は charts first / tables as drill-downs を原則とする。

## Information hierarchy
1. 最新KPIとMarket Pulse
2. 需要 → 貿易 → 物量 → 輸送・倉庫 → コストの因果順
3. 意味のある時系列チャート
4. 全系列・原数値は disclosure 内の表で確認

## Chart strategy
- 2観測未満の系列に折れ線を描かない。
- 異なる単位を同一Y軸へ混在させない。
- 軸、単位、期間、凡例、最新点、tooltip、数値表を標準装備する。
- WCI/IACIは原典どおりUSD/40ftを表示する。

## Data formatting
表示単位は日本の実務で読みやすい兆円・億円・万TEU・万トン・億トンキロ等へrender時に変換する。保存値、metric_id、enum、URL、data属性は変更しない。

## Privacy
公開版では個別ブランド監視対象・個別ブランドURL・非公開優先順位を復活させない。

## Preserved contracts
`data/**`、collector、machine-readable enum、report type、signal IDは既存契約を維持する。

## Regression
`npm test` でstatic auditとjsdom smoke testを実行し、Python側のreport/public-schema/customs validatorもCIで実行する。
