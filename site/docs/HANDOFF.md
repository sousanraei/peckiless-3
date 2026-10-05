# Handoff log

Newest entry at the bottom. Read the latest entry before starting; append yours when you finish.

---

## T0 Scaffold + handoff docs (done, 2026-10-05)

**Built**
- `index.html`: placeholder nav (fixed), `#track` (tall scroll track) > `#stage` (sticky, 100svh), `#debug` overlay. GSAP 3.15.0 + ScrollTrigger + MotionPathPlugin + DrawSVGPlugin from cdnjs (all registered in main.js). Fonts: Inter + Inter Tight (Google Fonts).
- `js/config.js`: **single source of truth**. `SCENES` = 14 entries (id, kind, frames, title, `units`, optional `mobileUnits`, `module`). 1 unit = 100svh of scroll. Total is currently 20.4 units. `SCRUB = 0.5`, `BREAKPOINT = 900`.
- `js/main.js`: inside `gsap.matchMedia` (isDesktop / isMobile / reduced) it
  - creates one `<section class="layer layer--<id>">` per scene in `#stage`
  - builds one paused master timeline with a label per scene id (plus `end`)
  - calls each module's `build(master, ctx)`, where `ctx = { scene, layer, stage, isMobile, reduced, duration, start }`
  - sets `--track-units` so that scroll length = timeline length
  - binds the timeline with `ScrollTrigger.create({ trigger: #track, start: 'top top', end: 'bottom bottom', scrub: 0.5, animation })`
  - `window.__film = { master, trigger, scenes }` is exposed for console debugging
- `js/scenes/placeholder.js`: used for every scene whose `module` is `null`. It shows a labelled card that fades in and drifts across the segment. The first scene is visible at scroll 0.
- `js/debug.js`: `?debug` overlay showing the current label, overall and segment %, and a clickable label list that jumps to each segment via `trigger.labelToScroll(id)`. The list is hidden under 900px.
- CSS: `tokens.css` holds provisional palette and type tokens (T1 replaces them with exact values), `base.css` the reset, track/stage, nav and debug styles, `scenes.css` the placeholder styles plus a minimal `.is-reduced` stacked fallback.
- `.claude/launch.json` (in the parent folder), "site" attaches to http://localhost:8080.

**How to add a real scene** (T3 onwards): create `js/scenes/sNN-name.js` exporting `build(tl, ctx)`, set `module: 'sNN-name.js'` on its config entry, and add tweens at `ctx.scene.id` (relative offsets like `` `${id}+=0.4` ``), keeping them within `ctx.duration`. Style it under `.layer--<id>` in scenes.css. Tweens that cross into a neighbouring scene (true transitions) belong to the **transition** entry (t1…t5), which may reach the shared elements listed in ASSET_MAP.

**Running locally (important)**
- The app's preview launcher **cannot read iCloud Drive** (macOS privacy: `getcwd: Operation not permitted`). Start the server from the Bash tool instead, as a background task:
  `cd ".../Claude files/site" && exec python3 -m http.server 8080`
  Then use `preview_start` with name `site`, or navigate the Browser pane to `http://localhost:8080/?debug`.
- If the Browser pane is **hidden**, rAF is paused and scrub never advances, so scroll tests return t=0. Either front the pane (`tabs_select`) and take a screenshot, or verify deterministically: `__film.trigger.disable(false,false); __film.master.time(x)`, then check layer opacities, then `trigger.enable(false,true)`.

**Verified**
- Desktop (1024×768): for all 14 segments, forward then reverse, exactly the matching layer is visible at mid-segment, and the debug label matches.
- Scroll mapping: 768px of scroll = 1 unit = 1 viewport, and progress 0/.25/.5/.75/1 maps exactly.
- Mobile (375×812): renders, no horizontal overflow, no console errors (all requests 200).
- Screenshots: `docs/shots/t0-desktop-s3-scan.jpg`, `docs/shots/t0-mobile-s7-clean.jpg`.

**Known issues / notes**
- Reduced motion only gets a crude stacked fallback (`.is-reduced`). The real version is T14. I could not emulate reduced motion in the pane (no tool option).
- Nav is a placeholder (text "P" logo). The real logo comes in T1 and nav styling in T2.
- Scene `units` are first guesses. Tune them only in config.js.

**Next step → T1:** write `tools/extract.py` (python3 is available; check whether Pillow/cwebp exist first, otherwise use `sips` for JPEG) to decode each SVG's `image0_*` base64 PNG, dedupe by hash, and apply the `<pattern>` transform/rect placement so each crop matches its frame. Export to `assets/img/` as listed in ASSET_MAP. Then isolate the vector parts into `assets/svg/` (logo; 5 vital icons with each glyph split from its blur-filter shadow; ROI boxes; D16 beams; D17/D18 arrows, RGB box, curves, rectangle; D19 card charts), set exact palette hex values in `tokens.css`, and fill in ASSET_MAP.

---

## T1 Asset extraction + optimisation (done, 2026-10-05)

**Built**
- `tools/extract.py` (python3 + Pillow; `pip3 install --user Pillow` was needed, and it has WebP). One run regenerates everything below. It never touches the source frames.
  - **Photos** → `assets/img/{hero-a,hero-a-glow,front,cheek,skin,finale}.webp`. Deduped by hash, with a pixel compare as backstop. Each frame's `<pattern>` transform is resolved to a frame-px placement, and each file is cropped (no resampling) to the union of what its frames show. Total 0.31 MB.
  - **Vectors** → `assets/svg/`: `logo.svg`, `icons/<name>-{glyph.svg,shadow.webp,glow.webp}` ×5, `scan-line-d12`, `roi-d13`, `roi-d14`, `swatches-d15`, `beams-d16`, `rgb-d17`, `connectors-d19` (frame-space, viewBox 0 0 1440 1024), and `chart-<vital>.svg` ×5 (card-local).
  - **Data** → `assets/img/manifest.json`, mirrored as the ES module `js/assets.js` (`ASSETS.photos[name].frames[n]`, `ASSETS.icons`, `ASSETS.icons_d19`, `ASSETS.cards_d19`, `ASSETS.vectors[...]`, `ASSETS.logo`), plus `assets/palette.json` (every hex and the frames that use it).
- `css/tokens.css`: exact hex values with their source frame, new tokens (`--c-ink-2/3`, `--c-cta-ink`, `--c-tag*`, `--c-line`, `--c-muted`, `--c-nav-*`, `--c-chart`, `--grad-scan`, icon palettes, radii). Existing token names are kept, so T0 CSS still works. `--c-sky` is now `#d3e2f4`, sampled from the photo.
- `docs/assets-preview.html`: rebuilds all 11 frames from the assets alone, with **diff vs original** and onion-skin toggles, plus an icon sheet at 4×. Serve the **project root** (`python3 -m http.server 8081` in `Claude files/`) and open `/site/docs/assets-preview.html`. The original frames are only reachable from there.
- `docs/ASSET_MAP.md`: fully filled in. It covers every file, its ids, placements, and geometry for the rect-only UI (nav, chips, pills, cards) that T2 builds in CSS.

**Decisions**
- Photos are **not** resampled to a fixed frame size. Each one keeps its native pixels plus a placement box, so nothing is lost for the T7 zoom or for mobile crops. Position each `<img>` at its placement inside a 1440×1024 frame box. Under cover-fit the frame box is what scales.
- `front` is used by D11–D13, but D11 sits **4px higher** (top −5.40 vs −1.40). The manifest has a placement per frame.
- Icons: glyph and shadow are split as planned. The shadow (ground blur + orbit ring) and the glow are pre-rendered at 4× with Pillow (supersampled polygons + Gaussian blur; headless Chrome hangs here). `#body` inside the glyph is the moving part, with `transform-origin` at its own centre. `#sparkles` is separate. D19 reuses the D10 files at 0.8× (`ASSETS.icons_d19`).
- `rgb-d17.svg` also has hidden stroked **centrelines** for the two outlined arrows (`#arrow-centerlines`), so T9 can morph the D16 beam strokes into stroke paths with the same structure.
- Text is not extracted, because T2 rebuilds it as live HTML. The rect-only UI is documented, not exported.

**Verified** (in the Browser pane on the asset preview, by canvas pixel compare against the source SVGs)
- Every frame-space SVG, the logo, the D19 charts and the connectors are pixel-exact (mean diff 0.0 over the pixels they paint). Icon glyphs: mean diff < 1/255 at both the D10 and D19 boxes.
- Photo placement: mean diff 2–4/255 in text-free regions, and 2–4× worse when shifted 2px, so alignment is better than 1px.
- Weight: all of `assets/` is **0.5 MB** (target was under ~6 MB).
- The site (`:8080/?debug`) still loads with no console errors, and `js/assets.js` imports there.
- Screenshots: `docs/shots/t1-desktop-icons.jpg` (icon stacks at 4×), `docs/shots/t1-mobile-d18-d19.jpg` (rebuilt D18/D19 at 375px).

**Known issues / notes**
- The sources are low-res: 0.62–1.0 source px per frame px (`front` is the worst, upscaled 1.62× by Figma). "2× display size" can't be reached without an AI upscale. That's optional, for T15.
- The text in the three D16 label pills isn't recorded beyond "Light in". Read it off `Desktop - 16.svg` in T2.
- The sub-headline gradient in Figma is a user-space diagonal. `--grad-accent` (100deg) is an approximation; tune it in T2 against the frames.
- The D19 heart-rate card sits at x 1083–1370, so it's fully on canvas.

**Next step → T2:** build each scene's static end state in `#stage`. Use a 1440×1024 "frame box" per photo scene, place the `<img>` from `ASSETS.photos[name].frames[n]`, and inline or overlay the frame-space SVGs. Rebuild all text as live HTML (Inter / Inter Tight) using the tokens and the UI geometry table in ASSET_MAP. Then the mobile layouts. Compare against the frames with `docs/assets-preview.html` and the originals.
