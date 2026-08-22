# LBI Console v7.1 UI Fix

このZIPは **現在公開中のrepositoryへ上書きする差分**です。
`data/reports.json`、`data/critical-news.json`、`data/topic-intelligence.json`、既存レポート本文は含みません。
したがって、2026-08-23以降の自動更新データを古いベースラインで上書きしません。

## 修正内容

- LBIロゴ/ブランド名がデスクトップRail内で不自然に改行されないようRail幅とbrandレイアウトを修正
- Operations Radar の「実影響」「報告」列幅を拡張し、日付/本文との重なりを解消
- 情報源テーブルの優先度列を固定幅化し、P0/P1/P2が縦割れしないよう修正
- Buzzは「観測」を先頭にし、「取得状況」を後段へ移動
- レポート本文を他ページと同じ標準コンテンツ幅へ変更
- 旧shellで生成された最新Dailyでも、app.js起動時に一度だけRail/Ribbonへアップグレードする互換処理を追加
  - DOMポーリング/MutationObserverは使用しない
  - report本文は書き換えず外側shellのみ補完
- 新規レポートは `templates/report-template.html` からRail/Ribbon付きで生成
- `MARKET REGIME / 市場はなぜ動いているか` を `物流市場 / 運賃・需給・定時性・リスク` に変更
- 監視ソースに以下を追加
  - 国土交通省 物流効率化法
  - 物流効率化法 理解促進ポータル
  - 全日本トラック協会 調査・研究
  - 国土交通省 コンテナターミナルゲート高度化
  - 国土交通省 サイバーポート
  - 全日本トラック協会 物流2024年問題

## 適用方法

ZIPを展開し、中身をrepository rootへそのまま上書きしてください。

Gitの場合:

```bash
git add -A
git commit -m "Fix console layout and expand Japan domestic logistics coverage"
git push origin main
```

## 自動調査側

ChatGPTのDaily / Weekly / Monthly / Critical Radarも更新済みです。
局地的・低ボリュームの配送遅延は原則トップ優先にせず、以下を優先します。

- 全国/地域間の幹線トラック
- 首都圏・関西圏など主要物流圏
- ドレージ/海上コンテナ搬出入
- コンテナターミナルのゲート混雑・待機時間
- 港湾dwell / chassis / container pickup制約
- 荷待ち・荷役時間
- ドライバー不足・運賃・燃料・輸送力
- 共同配送・中継輸送・モーダルシフト
- 物流効率化法、特定荷主、CLO、中長期計画、定期報告
- トラック・物流Gメン、標準的運賃、多重下請構造
- 物流2024年問題の継続的な構造影響
