#!/usr/bin/env python3
"""Write the LBI HTML pages from one shared shell.

There is no build step in production: this script is run once, by hand, and
its output is committed. It exists so the header, the stylesheet list and the
module entry point are provably identical on every page — that consistency
used to be patched in at run time by header.js.
"""
import pathlib

REPO = pathlib.Path("/home/claude/lbi")

CSS = ["tokens.css", "base.css", "components.css", "pages.css"]


def head(title, description, prefix=""):
    links = "\n".join(
        f'  <link rel="stylesheet" href="{prefix}assets/css/{name}">' for name in CSS
    )
    desc = f'\n  <meta name="description" content="{description}">' if description else ""
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>{desc}
  <meta name="color-scheme" content="light">
{links}
</head>"""


def header(prefix=""):
    return f"""<header class="site-header site-header--minimal">
  <div class="site-header__bar">
    <a class="brand brand--minimal" href="{prefix}index.html" aria-label="ホーム"><span class="brand__mark">LBI</span></a>
    <nav class="site-nav site-nav--reports" aria-label="ナビゲーション">
      <a data-nav="radar" href="{prefix}radar.html">レーダー</a>
      <a data-nav="topic" href="{prefix}topic.html">トピック</a>
      <a id="nav-latest-daily" data-nav="daily" href="{prefix}archive.html?type=daily">日次</a>
      <a id="nav-latest-weekly" data-nav="weekly" href="{prefix}archive.html?type=weekly">週次</a>
      <a id="nav-latest-monthly" data-nav="monthly" href="{prefix}archive.html?type=monthly">月次</a>
      <a data-nav="commerce" href="{prefix}commerce-calendar.html">EC予定</a>
      <a data-nav="buzz" href="{prefix}buzz.html">Buzz</a>
      <a data-nav="archive" href="{prefix}archive.html">過去</a>
    </nav>
  </div>
</header>"""


def footer(prefix=""):
    return f"""<footer class="site-footer">
  <div class="wrap">
    <nav aria-label="フッター">
      <a href="{prefix}index.html">ホーム</a>
      <a href="{prefix}radar.html">レーダー</a>
      <a href="{prefix}topic.html">トピック</a>
      <a href="{prefix}commerce-calendar.html">EC予定</a>
      <a href="{prefix}buzz.html">Buzz</a>
      <a href="{prefix}archive.html">過去</a>
      <a href="{prefix}source-matrix.html">情報源</a>
    </nav>
    <p class="footer-note">公開情報のみを扱います。数値・事実は必ず一次情報で確認してください。</p>
  </div>
</footer>"""


def page(*, path, title, description, body_attrs, main, prefix=""):
    html = f"""{head(title, description, prefix)}
<body {body_attrs}>
<a class="skip-link" href="#main">本文へスキップ</a>
{header(prefix)}
<main id="main">
{main}
</main>
{footer(prefix)}
<script type="module" src="{prefix}assets/js/app.js"></script>
<noscript><p class="empty-state wrap">このページは data/*.json をJavaScriptで読み込みます。JavaScriptが無効な場合は、各レポートページを直接ご覧ください。</p></noscript>
</body>
</html>
"""
    (REPO / path).write_text(html, encoding="utf-8")
    print("wrote", path, len(html), "bytes")


# --------------------------------------------------------------------------- home
page(
    path="index.html",
    title="Logistics & Beauty Intelligence",
    description="物流・通関・国際輸送・Beauty Commerceの意思決定ダッシュボード。",
    body_attrs='data-root="" data-page="home"',
    main="""<div class="wrap dashboard" id="dashboard">
  <p class="empty-state" id="dashboard-error" hidden></p>

  <section class="section section--decision" aria-labelledby="decision-title">
    <div class="section__head">
      <div>
        <p class="eyebrow">TODAY</p>
        <h1 class="section__title" id="decision-title">本日の判断</h1>
      </div>
      <p class="section__note">最終更新 <span id="data-stamp">—</span></p>
    </div>
    <div class="decision-grid">
      <div class="overall" id="overall" data-status="unconfirmed" aria-live="polite"></div>
      <div class="action-box" id="action-box" data-action="unknown" aria-live="polite"></div>
    </div>
    <div class="callout callout--bottom-line" id="conclusion" hidden></div>
  </section>

  <section class="section section--span" aria-labelledby="radar-title">
    <div class="section__head">
      <div>
        <p class="eyebrow">OPERATIONS RADAR</p>
        <h2 class="section__title" id="radar-title">見逃してはいけない動き</h2>
      </div>
      <div class="section__actions">
        <span class="section__note" id="operations-radar-meta"></span>
        <a class="section__link" href="radar.html">すべて表示 →</a>
      </div>
    </div>
    <div class="radar-summary" id="operations-radar"></div>
  </section>

  <section class="section section--span" aria-labelledby="status-title">
    <div class="status-title-row">
      <h2 class="section__title" id="status-title">日本物流ステータス</h2>
      <div class="status-legend status-legend--inline">
        <span data-status="normal"><span class="dot"></span>平常</span>
        <span data-status="watch"><span class="dot"></span>監視</span>
        <span data-status="disruption"><span class="dot"></span>障害</span>
        <span data-status="unconfirmed"><span class="dot dot--ring"></span>未確認</span>
      </div>
    </div>
    <div class="status-board" id="status-board"></div>
  </section>

  <section class="section section--span section--compact-latest" aria-labelledby="latest-title">
    <div class="section__head">
      <h2 class="section__title" id="latest-title">最新レポート</h2>
      <a class="section__link" href="archive.html">過去のレポート →</a>
    </div>
    <div class="latest-grid" id="latest-grid"><p class="empty-state">読み込み中…</p></div>
  </section>

  <section class="section" aria-labelledby="changed-title">
    <div class="section__head">
      <h2 class="section__title" id="changed-title">前回からの変化</h2>
      <p class="section__note" id="changed-base"></p>
    </div>
    <div class="change-counts" id="changed-counts"></div>
    <div id="changed-list"></div>
  </section>

  <section class="section" aria-labelledby="key-title">
    <div class="section__head">
      <h2 class="section__title" id="key-title">主要シグナル</h2>
    </div>
    <div id="key-signals"></div>
  </section>

  <section class="section section--span" aria-labelledby="regime-title">
    <div class="section__head">
      <div>
        <p class="eyebrow">MARKET REGIME</p>
        <h2 class="section__title" id="regime-title">市場はなぜ動いているか</h2>
      </div>
      <p class="section__note" id="market-regime-note"></p>
    </div>
    <div id="market-regime-strip"></div>
    <p class="regime-note">運賃・供給・実需・定時性・リスクは独立した次元です。未確認は判断材料が揃っていないことを示します。</p>
  </section>

  <section class="section section--span" aria-labelledby="lenses-title">
    <div class="section__head">
      <h2 class="section__title" id="lenses-title">5つの視点</h2>
    </div>
    <p class="empty-state" id="lenses-note" hidden></p>
    <div class="lens-grid" id="lens-grid"></div>
  </section>

  <section class="section section--span" aria-labelledby="topics-title">
    <div class="section__head">
      <div>
        <p class="eyebrow">TOPIC INTELLIGENCE</p>
        <h2 class="section__title" id="topics-title">注目トピック</h2>
      </div>
      <a class="section__link" href="topic.html">一覧 →</a>
    </div>
    <div class="topic-index" id="featured-topics"></div>
  </section>
</div>""",
)

# --------------------------------------------------------------------------- radar
page(
    path="radar.html",
    title="オペレーションレーダー | LBI",
    description="実影響が確認された事象と、報告段階のリスクを分けて追跡します。",
    body_attrs='data-root="" data-page="radar"',
    main="""<div class="wrap">
  <header class="page-head">
    <p class="eyebrow">OPERATIONS RADAR</p>
    <h1 class="page-title">オペレーションレーダー</h1>
    <p class="page-lead">見逃してはいけない動きだけを、実影響 → 報告 の順で表示します。並び順は日付ではなく状態が優先です。</p>
    <p class="page-meta" id="radar-summary"></p>
    <p class="notice" id="radar-new" hidden></p>
  </header>
  <div id="radar-filters"></div>
  <div id="radar-list"><p class="empty-state">読み込み中…</p></div>
</div>""",
)

# --------------------------------------------------------------------------- topic
page(
    path="topic.html",
    title="トピック | LBI",
    description="テーマごとに、いま何が起きているかを追跡するTopic Intelligence Digest。",
    body_attrs='data-root="" data-page="topic"',
    main="""<div class="wrap">
  <div id="topic-root"><p class="empty-state">読み込み中…</p></div>
</div>""",
)

# ------------------------------------------------------------------------ archive
page(
    path="archive.html",
    title="過去 | Logistics & Beauty Intelligence",
    description="日次・週次・月次レポートの分析的な検索。視点・変化・確度・期間で絞り込めます。",
    body_attrs='data-root="" data-page="archive"',
    main="""<div class="wrap">
  <header class="page-head">
    <p class="eyebrow">ARCHIVE</p>
    <h1 class="page-title">過去のレポート</h1>
    <p class="page-lead">「過去3か月・定時性・悪化」のような条件で検索できます。条件はURLに保存されるため、そのまま共有できます。</p>
  </header>

  <div class="no-print" id="archive-filters"></div>
  <div class="preset-row no-print" id="archive-presets"></div>

  <p class="empty-state" id="archive-empty" hidden></p>
  <ul class="archive-list" id="archive-list"></ul>
</div>""",
)

# ----------------------------------------------------------------------- commerce
page(
    path="commerce-calendar.html",
    title="EC予定 | LBI",
    description="Beauty Commerceのキャンペーン・EC施策カレンダー。",
    body_attrs='data-root="" data-page="commerce"',
    main="""<div class="wrap">
  <section class="section">
    <div class="section__head">
      <div>
        <h1 class="section__title">Beauty Commerce Calendar</h1>
        <p class="section__note">メイク / スキンケア / フレグランス</p>
      </div>
      <div class="calendar-nav">
        <button type="button" class="btn btn--quiet" id="cal-prev" aria-label="前の月">←</button>
        <strong id="cal-month" aria-live="polite">—</strong>
        <button type="button" class="btn btn--quiet" id="cal-next" aria-label="次の月">→</button>
      </div>
    </div>
    <div class="month-calendar-scroll">
      <div id="month-calendar" class="month-calendar"><p class="empty-state">読み込み中…</p></div>
    </div>
  </section>

  <section class="section">
    <div class="section__head"><h2 class="section__title">予定一覧</h2></div>
    <div id="calendar-list" class="calendar-list"><p class="empty-state">読み込み中…</p></div>
  </section>

  <section class="section">
    <div class="section__head">
      <h2 class="section__title">ブランド × チャネル</h2>
      <p class="section__note">観測が蓄積され次第、カテゴリ・需要要因を含めた形に拡張します。</p>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">ブランド / シグナル</th><th scope="col">Amazon</th><th scope="col">楽天</th><th scope="col">ZOZOCOSME</th><th scope="col">Qoo10</th><th scope="col">@cosme</th><th scope="col">Brand.com</th></tr></thead>
        <tbody id="brand-channel-body"></tbody>
      </table>
    </div>
  </section>
</div>""",
)

# --------------------------------------------------------------------------- buzz
page(
    path="buzz.html",
    title="Beauty Buzz | LBI",
    description="Google Trendsから化粧品の検索関心を観測するBeauty Buzzページ。",
    body_attrs='data-root="" data-page="buzz"',
    main="""<div class="wrap">
  <section class="section">
    <div class="section__head">
      <div>
        <p class="eyebrow">BEAUTY BUZZ</p>
        <h1 class="section__title">Google Trends モニター</h1>
      </div>
      <p class="section__note" id="buzz-stamp">—</p>
    </div>
    <p class="muted">Google Trendsが示すのは<strong>検索関心</strong>であり、販売実績ではありません。指数は期間内の相対値で、母数が小さいほど変化率は大きく振れます。</p>
    <div class="buzz-grid" id="buzz-sources"></div>
  </section>

  <section class="section">
    <div class="section__head"><h2 class="section__title">観測</h2></div>
    <div class="buzz-list" id="buzz-list"><p class="empty-state">読み込み中…</p></div>
  </section>

  <section class="section">
    <div class="section__head"><h2 class="section__title">監視対象</h2></div>
    <p class="muted">主要Beautyブランドに加え、フレグランス、リップ、ファンデーション、美容液、日焼け止めなどを定点観測します。監視語は data/buzz-watchlist.json で管理します。</p>
  </section>
</div>""",
)

# ------------------------------------------------------------------- source matrix
page(
    path="source-matrix.html",
    title="情報源 | LBI",
    description="LBIが定常監視する情報源の一覧。",
    body_attrs='data-root="" data-page="sources"',
    main="""<div class="wrap">
  <section class="section">
    <div class="section__head">
      <div>
        <p class="eyebrow">SOURCE MATRIX</p>
        <h1 class="section__title">調査対象と役割</h1>
      </div>
      <p class="section__note" id="source-count">—</p>
    </div>
    <p class="muted">一次運用・規制 → 公式統計 → 市場データ → 専門媒体 → Beauty Commerce の順に優先します。ニュース一覧ではなく、何を定常的に見ているかの台帳です。</p>
    <div class="matrix-tabs">
      <label class="sr-only" for="f-domain">領域</label>
      <select id="f-domain" class="matrix-chip"><option value="">領域: すべて</option><option value="logistics">Logistics</option><option value="beauty">Beauty</option></select>
      <label class="sr-only" for="f-priority">優先度</label>
      <select id="f-priority" class="matrix-chip"><option value="">優先度: すべて</option><option>P0</option><option>P1</option><option>P2</option></select>
      <label class="sr-only" for="f-cadence">頻度</label>
      <select id="f-cadence" class="matrix-chip"><option value="">頻度: すべて</option><option value="daily">日次</option><option value="weekly">週次</option><option value="monthly">月次</option></select>
      <label class="sr-only" for="f-q">検索</label>
      <input id="f-q" class="matrix-chip" type="search" placeholder="情報源・取得項目を検索">
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">優先度</th><th scope="col">領域 / レイヤ</th><th scope="col">情報源</th><th scope="col">頻度</th><th scope="col">取得する内容</th></tr></thead>
        <tbody id="source-body"></tbody>
      </table>
    </div>
  </section>
</div>""",
)

# ------------------------------------------------------------------ status history
page(
    path="status-history.html",
    title="ステータス履歴 | LBI",
    description="運用ドメイン別のステータス推移と関連シグナル。",
    body_attrs='data-root="" data-page="status-history"',
    main="""<div class="wrap">
  <section class="section">
    <div class="section__head">
      <div>
        <p class="eyebrow">STATUS HISTORY</p>
        <h1 class="section__title" id="history-title">履歴</h1>
      </div>
      <p class="section__note" id="history-lead"></p>
    </div>
    <div class="history-context">
      <section class="section">
        <div class="section__head"><h2 class="section__title">このドメインのトピック</h2></div>
        <div class="topic-index" id="status-topics"></div>
      </section>
      <section class="section">
        <div class="section__head"><h2 class="section__title">関連レーダー</h2></div>
        <div class="radar-list" id="status-radar"></div>
      </section>
    </div>

    <div class="section__head"><h2 class="section__title">ステータス推移</h2></div>
    <div id="history-list" class="timeline"><p class="empty-state">読み込み中…</p></div>
  </section>
</div>""",
)

# -------------------------------------------------------------------- lens history
page(
    path="lens-history.html",
    title="シグナル履歴 | LBI",
    description="5つの視点ごとの構造化シグナル履歴。",
    body_attrs='data-root="" data-page="lens-history"',
    main="""<div class="wrap">
  <section class="section">
    <div class="section__head">
      <div>
        <p class="eyebrow">INTELLIGENCE HISTORY</p>
        <h1 class="section__title" id="lens-history-title">シグナル履歴</h1>
      </div>
      <p class="section__note" id="lens-history-lead"></p>
    </div>
    <nav class="lens-switch" id="lens-switch" aria-label="視点の切り替え"></nav>
    <div class="no-print" id="lens-filters"></div>

    <div class="lens-layout">
      <div id="lens-history-list"><p class="empty-state">読み込み中…</p></div>
      <aside class="lens-side">
        <section class="section">
          <div class="section__head"><h2 class="section__title">この視点のトピック</h2></div>
          <div class="topic-index" id="lens-topics"></div>
        </section>
      </aside>
    </div>
  </section>
</div>""",
)
