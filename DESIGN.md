# Design System — Hit Forensics

## Product Context
- **What this is:** A web application for forensic exploration of what makes a song a hit, built on a join between Billboard Hot 100 chart history (1958–2021) and Spotify audio features for 447,232 tracks.
- **Who it's for:** Music researchers, journalists, data-curious listeners, and CIS 5500 graders. Editorial readers, not power users.
- **Space/industry:** Music data / chart analytics / data journalism.
- **Project type:** Editorial web app. Database-backed pages with charts, tables, and prose.

## Aesthetic Direction
- **Direction:** Editorial / magazine. Light "Music Pudding" reference with the playful gimmicks dialed back.
- **Decoration level:** Intentional. Warm paper, hand-drawn-feeling color blocks for the wordmark and feature cards, but no scribbles, no rotated emoji, no handwritten fonts.
- **Mood:** Considered. Reads like a published research investigation, not a SaaS dashboard.
- **Reference touchstones:** The Pudding, Polygraph, NYT Upshot, FT data desk.

## Typography
- **Display / hero:** Fraunces (variable, opsz 9..144). Italic 800–900 for headlines and feature titles. Reserve italic for emphasis and titles, not body.
- **Body / UI:** Inter, weights 400–700. Tight tracking on headings, normal on body.
- **Labels / numbers / kicker chips:** JetBrains Mono, weights 400–600. Always with `letter-spacing: 0.14–0.18em` and `text-transform: uppercase` for labels; `font-feature-settings: "tnum"` for tabular numbers in tables.
- **Hand / decorative:** None. Removed Caveat entirely.
- **Loading:** Google Fonts via `<link>` in `client/index.html`.
- **Headline scale:** `clamp(56px, 8.4vw, 116px)` for the home display headline; `clamp(40px, 6vw, 72px)` for page heroes.

## Color
- **Approach:** Balanced. Cream paper background, deep ink-blue type, magenta and mustard as named accents.
- **Background (`--bg`):** `#F8EFE3` warm cream
- **Paper (`--paper`):** `#FCF7EE` for cards
- **Paper-2 (`--paper-2`):** `#F1E6D6` for table headers
- **Ink (`--ink`):** `#0E1E3F` primary text, primary buttons, hairline rules
- **Ink-2 (`--ink-2`):** `#34406A` secondary text
- **Ink-3 (`--ink-3`):** `#6E7BA3` tertiary / placeholder text
- **Magenta (`--magenta`):** `#FF2E63` primary accent. Active states, hover-target color, focus rings, hero accent on the word *hit*.
- **Magenta-soft (`--magenta-soft`):** `#FFD9E2` swatch backgrounds, soft alerts
- **Mustard (`--mustard`):** `#F4B936` brand wordmark blob, hero stat tile
- **Mustard-soft (`--mustard-soft`):** `#FFE7B5` card swatches
- **Teal (`--teal`):** `#2BB3A1`, **Teal-soft:** `#BBE7C9` — third accent, used in card swatches and rank chips
- **Semantic:** error → `#C8442B`, uplift / positive → `#1F8D6E`
- **Dark mode:** Not implemented. Cream paper is the brand.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable. Magazine-leaning whitespace.
- **Scale:** `2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 80`
- **Container:** `max-width: 1200px`, padding `22px 40px 80px`

## Layout
- **Approach:** Hybrid. Grid-disciplined for tables and stats; gently asymmetric for the home feature grid (vertical offset every other card).
- **Grid:** Six-column meta-grid for the home feature cards (each card spans 2). Three-column grid for archetype cards.
- **Border radius:** Hairline scale — `10px` (small chips), `16px` (stat tiles, inputs), `22px` (cards), `999px` (pills).

## Motion
- **Approach:** Minimal. Hover states animate `transform: translateY` by 2–3px and `box-shadow` shift on cards. No scroll-driven animation, no entrance choreography.
- **Easing:** ease for hover (default), ease-out for inputs (focus rings).
- **Duration:** 150ms on hover, 200ms on transforms.

## Components

### Brand wordmark
- "Hit" inside a mustard pill with rotation `-2deg`, ink border, `2px 2px 0 ink` shadow.
- "case" in Fraunces italic 800, immediately after the blob.
- Trailing magenta period.

### Kicker chip
- Solid ink pill, paper text, mono uppercase letter-spacing 0.14em, magenta dot prefix.
- Used as the first element on every page hero. Pattern: `[• File Q1 · fuzzy match]`.

### Page hero
- `kicker → h1 (Fraunces 900, italic optional) → lede (Fraunces italic 400)`
- Lede max-width 760px. Bold (`<b>`) for terms, regular for prose.

### Feature cards (home)
- Paper background, 1.5px ink border, 22px radius.
- 60×60 colored swatch with line-icon SVG.
- Fraunces 800 title, Fraunces italic 16px description (in pull-quotes), magenta "go" link.
- Vertical offset every other card (`translateY(14px)` / `(-10px)` / `(20px)`) for asymmetric magazine feel.
- Hover: `translateY(-3px) rotate(-0.4deg)` + `4px 4px 0 ink` shadow.

### Stat tiles
- Cream paper, 1.5px ink border, 16px radius.
- Fraunces 800 number (24px), mono uppercase label (11px).
- Variants: `.brand` (mustard fill), `.brand2` (magenta fill, paper text), `.brand3` (teal-soft fill).

### Buttons
- Default: ink fill, paper text, 999px pill, Inter 700 15px.
- Hover: magenta fill.
- Variants: `.btn-magenta` (magenta default → ink hover), `.btn-ghost` (transparent → ink fill).

### Inputs
- 999px pill border (1.5px ink), magenta focus ring (4px rgba 0.18).
- Italic placeholder in `--ink-3`.

### Tables
- Paper background inside ink-bordered wrapper (16px radius).
- Header row: paper-2 fill, mono uppercase 11px label.
- Rows: hairline ink-line dividers; row hover tints magenta at 5% opacity.
- Links: ink with magenta hover; magenta underline on hover only.
- Rank chip variants: gold (mustard), magenta, teal, default (ink).
- Numeric cells use `.num` for mono font + `tnum`.

### Recharts
- Stroke / grid: `rgba(14,30,63,0.18)` ink at low opacity.
- Axis labels: ink, mono 11px.
- Primary line / radar fill: magenta `#FF2E63`.
- Secondary: mustard `#F4B936`, teal `#2BB3A1`, ink `#0E1E3F`, `#A0537C`.
- Tooltip: paper background, 1.5px ink border, `3px 3px 0 ink` shadow, mono label, magenta value.

## Anti-patterns to avoid
- Caveat or other handwritten fonts. Removed in light-tune pass.
- Decorative scribble SVGs under hero words.
- Rotated colored question marks or emoji used as decoration.
- Purple/violet gradients. Saturated radial gradients on backgrounds (subtle ones in `body` are OK; loud ones are not).
- Centered three-column icon-grid feature blocks (the SaaS template).
- Drop shadows softer than `2–4px 2–4px 0 ink`. The hard offset shadow is part of the brand.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | Initial design system created from Music Pudding mockup. | User picked variant B from `/design-shotgun` (4 hand-coded HTML mockups). Editorial direction won over Forensics Lab, Premium Streaming, and Chart Terminal. |
| 2026-05-07 | Light professional pivot. | Removed Caveat font, magenta scribble SVG under "hit", and rotated mustard `?` qmark. Section subhead changed from handwritten to mono caps. Tilted feature cards and saturated palette retained. |
| 2026-05-07 | Briefly renamed to "Hitcase", then reverted. | User chose to keep the original "Hit Forensics" name. |
