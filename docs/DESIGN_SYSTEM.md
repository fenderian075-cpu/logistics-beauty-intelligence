# LBI Console — design system (v7)

v7 is a ground-up redesign, not a restyle. The engineering from v5/v6 (module
graph, data layer, join layer, tests) is unchanged; the entire visual and
interaction layer was rewritten from an empty file.

This document is the contract. If a future change contradicts something here,
change this document deliberately or don't make the change.

---

## 1. What this product is

One person, in a Tokyo office, checks LBI several times a day between other
work, and occasionally spends twenty minutes inside it. That single sentence
decides everything below:

| Because… | The design does this |
|---|---|
| checks are short and frequent | current state is visible on **every** page, always, in the ribbon |
| the same person uses it daily | preferences (theme, density) and keyboard shortcuts, not onboarding |
| the content is professional intelligence | data-ink over decoration: rules, not boxes; no shadows on content |
| mistakes are expensive | 報告 and 実影響 can never look alike; 未確認 is shown, never hidden |
| a busy day is 20+ items | every repeating component is capped and expandable |
| it is read on a phone on the train | mobile keeps the ribbon and reflows rows; it does not just stack |

## 2. The frame

```
┌──────────┬──────────────────────────────────────────────┐
│          │  RIBBON  state · action · 6 domains · radar  │  ← every page
│   RAIL   ├──────────────────────────────────────────────┤
│  layers  │                                              │
│  grouped │  MAIN                                        │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Rail** — nine destinations grouped by layer (現況 / レポート / ビューティー /
参照). Vertically they read as a structure; across a top bar they were a
scanning tax. Live counts sit against レーダー and トピック, so the navigation
itself carries state.

**Ribbon** — the structural idea of v7. Overall state, the action verdict, the
six operational domains, radar counts and data freshness, on every page
including published reports. Three clicks into the archive you still know
whether something is on fire. It is rendered by `core/shell.js` from the same
data the dashboard uses; it never derives its own judgement.

**Main** — one column, max 1360px, with an optional sticky reference rail on
analytical pages (topic digest, lens explorer).

Below 1080px the rail becomes a horizontal scroller and the ribbon drops its
labels but keeps its dots; below 720px rows reflow onto two lines rather than
truncating. Nothing is simply stacked.

## 3. Colour

| Token | Light | Role |
|---|---|---|
| `--paper` | `#f7f6f3` | warm off-white; pure white is fatiguing for long reading |
| `--surface` | `#ffffff` | raised: tables, sticky bars |
| `--ink` / `--ink-2` / `--ink-3` | `#17191d` / `#464a53` / `#7b8090` | text, prose, meta |
| `--accent` | `#0f3d4c` | deep petrol. **One** accent; if everything is accented, nothing is |
| `--st-normal` / `--st-watch` / `--st-disruption` / `--st-unconfirmed` | `#3f7d5c` / `#a4741a` / `#b1443a` / `#8b909c` | separated by lightness as well as hue, so they survive greyscale printing and colour-blind vision |

Dark mode is not an inversion: paper becomes a deep neutral with a blue cast,
ink stays warm, state colours lighten to hold contrast. It follows
`prefers-color-scheme` and can be overridden with the rail's theme button;
either way it is applied before first paint by an inline snippet, so there is
no flash.

**No component may hard-code a colour.** `tests/static-audit.mjs` fails the
build if one does — that check is what keeps dark mode from silently breaking.

## 4. Type

- Text: `Hiragino Sans` → `Noto Sans JP` → system, with `font-feature-settings:
  "palt" 1`. Proportional kana spacing is the single most visible difference
  between a default Japanese page and a designed one.
- Numbers and ids: monospace with `tabular-nums`, so columns compare by eye.
- Scale, one role each: 10.5 eyebrow · 11.5 meta · 12.5 **row** · 13.5 prose ·
  15 lead · 17 h2 · 23 h1 · 29 the one number that matters.
- Line height 1.85 for Japanese prose (Latin defaults are too tight), 1.55 for
  rows. Prose is capped at 42em.

## 5. Composition rules

1. **A repeating item is a row.** One hairline, no radius, no shadow, no
   background. Cards are for singular objects only.
2. **One emphasis channel per row.** Emphasis is spent on confirmed
   disruption, deterioration, and what is new since the last visit.
3. **Colour never carries meaning alone.** Every state has a word. Where a
   rule carries meaning it also carries a distinct style — radar rows encode
   importance in the *weight* of the left rule and reported/observed in its
   *style* (solid = confirmed, dashed = announced).
4. **Numbers right-aligned and monospaced.**
5. **Unknown is stated, weakly.** Never hidden, never alarming.
6. **Two elevations only**: sticky chrome and the shortcut overlay. Content
   never floats.

## 6. Density and preferences

`--row-pad` is the only thing the density switch changes: 9px → 5px. On a 20
item radar that is about a screenful. Theme and density are single attributes
on `<html>` (`data-theme`, `data-density`) persisted in localStorage.

## 7. Keyboard

| Key | Action |
|---|---|
| `g` then `d` / `r` / `t` / `a` / `c` | dashboard / radar / topics / archive / EC予定 |
| `/` | focus the page's search field |
| `?` | shortcut sheet |
| `Esc` | close |

Shortcuts never fire while typing in a field. The sheet is a real dialog with
a focusable close button.

## 8. Print

A printed brief is a different artefact: navigation, filters, ribbon and
toggles are removed, every disclosure is expanded by `core/print.js`, tokens
switch to black on white, and **evidence URLs are printed after their link
text** so the paper copy remains traceable.

## 9. Files

```
assets/css/tokens.css      colour · type · space · density · dark mode
assets/css/base.css        reset · Japanese typography · focus · print
assets/css/layout.css      rail · ribbon · main · help sheet · responsive frame
assets/css/components.css  every repeating primitive
assets/css/pages.css       composition belonging to one page
assets/js/core/shell.js    ribbon · rail counts · theme · density · keyboard
```

`style.css`, `portal-v22.css`, `ui-fixes-v26.css` and `intelligence-v3.css`
remain empty compatibility shims for reports published before v5. Do not add
rules to them.
