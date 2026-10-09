# Pecki!less: scroll-driven film

A presentation-grade prototype that tells the Pecki!less story (camera-based
health intelligence) as one animated film controlled by native scroll. It is
built from the Figma frames `Desktop - 9.svg` … `Desktop - 19.svg` in the parent
folder. Scrolling scrubs the film both ways. It adapts to phones and tablets and
has a static, fade-only version for reduced motion.

**Published (private Artifact):** https://claude.ai/artifact/HqidruF44hYMCb8mBAuzef
Only the owner can open it until it is shared from the page's Share menu.

## Run locally

No build step. Serve this folder over HTTP (ES modules and `fetch` don't work
from `file://`):

```bash
cd site
python3 -m http.server 8080
```

Then open http://localhost:8080. In the Claude desktop app, `.claude/launch.json`
in the parent folder has a `site` entry for the Browser pane.

GSAP 3.15 (+ ScrollTrigger, MotionPathPlugin, DrawSVGPlugin) loads from cdnjs
and the fonts (Inter, Inter Tight) from Google Fonts, so the first load needs a
network connection.

### Review switches (local only)

| URL | What it does |
|---|---|
| `?debug` | Overlay with the current scene label, progress, fps and worst frame |
| `?debug&autoscroll[=seconds]` | Scrolls the whole film forward then back and prints per-scene fps (`console.table`, `__film.perf`). Needs a visible tab |
| `?reduced` | Forces the reduced-motion version (stacked static scenes, fade-only) |
| `?noseq` | Skips the head-turn image sequence and uses the CSS crossfade fallback |

The Artifact viewer strips query strings, so these only work on the local server.
The published page follows the viewer's own `prefers-reduced-motion` setting.

## Scene map

One pinned `#stage` inside a tall scroll track, driven by one master GSAP
timeline with a label per scene. Order and pacing live in `js/config.js`
(`units` = scroll length in viewport heights; `mobileUnits` overrides on
portrait phones). Each module in `js/scenes/` exports `build(tl, ctx)`.

| # | Label | Frames | What happens | Units |
|---|---|---|---|---|
| 1 | `s1-hero` | D9 → D10 | Face glow grows from the forehead; 5 vital chips enter with looping icons | 2.0 |
| 2 | `t1-turn` | D10 → D11 | Head turn: 90-frame image sequence scrubbed on canvas; chips sink, headline wipes | 1.6 |
| 3 | `s2-science` | D11 | "The science behind Pecki!less"; step pills slide in | 1.0 |
| 4 | `s3-scan` | D12 | Step 1 Face scan: green line sweeps the face | 1.4 |
| 5 | `s4-roi` | D13 | Step 2 ROI detection: three boxes draw on | 1.0 |
| 6 | `t2-zoom` | D13 → D14 | Camera pushes into the cheek ROI; photo B hands off to close-up C | 1.2 |
| 7 | `s5-pixels` | D14 → D15 | Swatch grid samples skin colour into the box | 1.0 |
| 8 | `t3-skin` | D15 → D16 | Swatches collapse to light; skin cross-section rises; "Light in" beam | 1.2 |
| 9 | `s6-vessels` | D16 | Step 3 Extract RGB: pulses travel along the vessels | 1.2 |
| 10 | `t4-beams` | D16 → D17 | The same two beams bend into the arrows feeding the RGB box | 1.4 |
| 11 | `s7-clean` | D17 | Step 4 Clean noises: raw RGB → detrend → POS → band-pass → BVP | 3.0 |
| 12 | `s8-calc` | D18 | Step 5 Calculate: PSD peak 1.2 Hz = 72 BPM, HRV, SpO₂ 96 %, resp. 13/min | 2.0 (2.4 mobile) |
| 13 | `t5-vitals` | D18 → D19 | The BVP wave leaves the panel and becomes the heart-rate card trace | 1.6 |
| 14 | `s9-finale` | D19 | "5 vital signs measured": the five cards around her, icon loops | 1.4 |

The signals in S7/S8 are synthetic but seeded and consistent (`js/lib/rppg.js`).

## Folder layout

| Path | Contents |
|---|---|
| `index.html` | Page shell: nav, scroll track, `#stage`, CDN scripts |
| `css/` | `tokens.css` (palette from the frames), `base.css`, `scenes.css` |
| `js/main.js` | Builds the stage and master timeline, ScrollTrigger, matchMedia branches |
| `js/config.js` | Scene order, pacing, breakpoints, scrub |
| `js/scenes/` | One module per scene or transition |
| `js/lib/` | Shared helpers (fit, loops, wipes, rPPG data, reduced-motion static mode) |
| `assets/img/` | Photos extracted from the frames (WebP) |
| `assets/seq/turn/` | 90-frame head-turn sequence |
| `assets/svg/` | Logo, icons (glyph and shadow split), ROI boxes, beams, diagram, charts |
| `tools/` | Asset extraction, sequence build, vessel tracing, Artifact page builder |
| `docs/` | `TASKS.md`, `HANDOFF.md`, `ASSET_MAP.md`, review screenshots |

## Republishing the Artifact

The Artifact host wraps the page in its own `<html>/<head>/<body>`, so publish a
stripped copy of `index.html` plus the runtime files:

```bash
python3 tools/artifact_page.py /path/to/scratch/pecki-film.html
```

Publish that file with `root` = `site/` and a `files` list of everything under
`assets/`, `css/` and `js/` (159 files, about 3.7 MB). `docs/` and `tools/` are
not published. Republish to the same URL to keep the link.
