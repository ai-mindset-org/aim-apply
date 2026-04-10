# covers/

Open Graph / social preview images for **aim-apply** pages.

All covers are **single-file HTML** sized exactly to their target pixel dimensions. Screenshot them at 2x for retina crispness, then down-scale to produce the final PNG.

## Files

| File | Target PNG | Dimensions | Used by |
|------|------------|------------|---------|
| `analytics-og.html` | `analytics-og.png` | 1200 × 630 | `/analytics` dashboard OG image |
| `ig-story.html` | `ig-story.png` | 1080 × 1920 | Instagram story |
| `square-card.html` | `square-card.png` | 1080 × 1080 | IG square |
| `tg-banner.html` | `tg-banner.png` | 1500 × 500 | Telegram banner |

## `analytics-og.html`

**Purpose:** Open Graph cover for the live analytics page at `aim-apply.aimindset.org/analytics` (and any share-out of the dashboard to Telegram / Twitter / LinkedIn).

**Visual DNA:** teal-grid — deep dark `#161620`, teal accent `#4dc9d4`, IBM Plex Mono + Space Grotesk, 60px grid, circuit decoration, noise overlay. Inherits the exact hero aesthetic from `docs/jd-marketing.html`.

**Composition:**
- Left 60% — editorial type: mini label, big `/analytics` title, subtitle, meta row
- Right 40% — mock terminal card with KPI grid and sparkline
- Corner accents: `2026` stamp top-right, dot logo bottom-left, version bottom-right

## Screenshot to PNG

### Option A — Playwright (recommended)

```bash
# from repo root
npx playwright screenshot \
  --viewport-size=1200,630 \
  --device-scale-factor=2 \
  --wait-for-timeout=1500 \
  "file://$(pwd)/docs/covers/analytics-og.html" \
  docs/covers/analytics-og.png
```

The `--wait-for-timeout` gives Google Fonts time to load. The `--device-scale-factor=2` produces a 2400×1260 image; resize to 1200×630 with `sips` or `magick`:

```bash
sips -Z 1200 docs/covers/analytics-og.png
# or
magick docs/covers/analytics-og.png -resize 1200x630 docs/covers/analytics-og.png
```

### Option B — Chrome headless

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --window-size=1200,630 \
  --default-background-color=00000000 \
  --screenshot=docs/covers/analytics-og.png \
  "file://$(pwd)/docs/covers/analytics-og.html"
```

### Option C — wkhtmltoimage

```bash
wkhtmltoimage \
  --width 1200 --height 630 \
  --enable-local-file-access \
  docs/covers/analytics-og.html \
  docs/covers/analytics-og.png
```

## Notes

- Fonts load from Google Fonts. If offline, the HTML falls back to system monospace + `system-ui`. Preview in a browser with network first for the true look.
- The stage is locked via `html, body { width: 1200px; height: 630px; overflow: hidden }` — the HTML will not reflow at other viewport sizes.
- Do **not** embed external images. Everything is inline CSS + inline SVG so the file is portable and deterministic.
