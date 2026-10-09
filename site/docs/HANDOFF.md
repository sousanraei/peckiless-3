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

---

## T2 Static layout of all scenes (done, 2026-10-06)

**Built**
- One module per scene: `js/scenes/s1-hero.js` … `s9-finale.js` (file name = scene id). Transitions (`t1`–`t5`) have `module: null` → an empty layer for now; `placeholder.js` and its CSS are gone.
- `js/lib/fit.js`: frame boxes (`.fbox`) fitted per breakpoint (`data-fit` / `data-m-fit`: cover, contain, contain-top, focus, none; `data-focus`, `data-target`, `data-fill`). Refits on resize; sets `--fs` and `--card-zoom`.
- `js/lib/ui.js`: `photoBox`, `uiBox`, `copyBlock` (eyebrow + headline + gradient sub-headline), `icon`, `chip`/`CHIPS`, `card`/`CARDS`. `js/lib/dom.js`: `h`, `preloadSVG`/`svg` (inline with unique ids, see ASSET_MAP), `at`, `boxStyle`.
- `js/lib/static.js`: `sceneWindow`, `hold`, `cut`, `frameAt` (see "Static schedule" in ASSET_MAP). `js/shared.js`: the step-pill row.
- `js/config.js`: `module` set for all 9 scenes, plus `shows` (frames per scene) and `step` (lit pills); `STEPS` labels.
- Nav rebuilt to the frame geometry (logo, 6 links, Contact us), `index.html` loads Inter 300–900 / Inter Tight 500–900 (variable).
- Debug: `?at=<label>+<fraction>` jumps there on load, `&still` seeks the timeline instead of scrolling (deterministic screenshots), `?ref=onion|diff` overlays the matching Desktop frame (serve the project root on :8081 and open `/site/?debug&ref=diff` at 1440×1024).

**Type (fitted to the outlined text in the frames)**: headline Inter Tight 640 93.33px/84px, −0.0225em; sub-headline Inter 620 46.2px/46px with the Figma user-space gradient reproduced exactly (em-based, so it scales on mobile); eyebrow Inter 710 12.21px, 0.153em; chips Inter 770 26.39px; pills Inter 800 26.39px; nav Inter 340 14.4px. All sizes/offsets are in scenes.css/base.css with comments.

**Verified**
- Desktop 1440×1024, headless Chrome capture vs. the original frames (`?still&at=…`): mean pixel diff **1.5–3.2 / 255 for all 11 frames** (D9 2.6, D10 3.2, D11 2.3, D12 2.2, D13 2.2, D14 2.3, D15 3.0, D16 2.4, D17 1.5, D18 1.6, D19 2.7). Text ink boxes are within ~1–2px of the frames.
- 1280×720 and 1440×900: nav, copy, pills and diagram contain-fit (side margins on wide screens), photos cover; D19 cards no longer collide with the copy; D17 arrows reach the screen edge.
- Mobile 375×812 and tablet 768×1024 (Browser pane): copy on top, face crops, 2-column chips and cards, pill scroller, stacked diagram + panel. No horizontal overflow.
- Forward and reverse sweeps (70 sample points) give identical layer/pill states; native scroll → ScrollTrigger → scrub verified by ticking GSAP manually (pane hidden). No console errors.
- Screenshots: `docs/shots/t2-desktop-frames-vs-site.jpg` (frame | site for D9–D19), `docs/shots/t2-mobile-375.jpg` (D10, D12, D15, D16, D18, D19).

**Decisions / deviations**
- Label → frame: `s1-hero` shows D9 then D10 (switch at its midpoint), `s5-pixels` shows D14 then D15. A transition label shows the frame it starts from (the previous scene is held for its first half).
- D15 in Figma has the eyebrow overlapping the sub-headline (a mid-reorder snapshot). Built as eyebrow → sub-headline → headline, like D12.
- D18 lights pill 5 ("Calculate"); the frame leaves it grey, which looks like an oversight since the headline is "Step 5". Change `step: 4` on `s8-calc` in config.js to match the frame exactly.
- S7 owns the diagram and panel and holds them through S8; S8's layer only adds its copy.
- D19 cards + connectors use the contain fit (with the UI) instead of the photo's cover fit; connector ends drift < 20px on the torso at 16:9 and match exactly at the frame aspect.
- Desktop at non-1.406 aspects: UI is contain-fit (centred, with side or top margins), photos cover. Fine for the presentation; T13/T15 can revisit.

**Known issues / notes**
- Pane-hidden caveat still applies: screenshots and scroll tests need either `?still&at=` or manual `gsap.ticker.tick()` calls. Headless Chrome cannot capture below ~500px wide, so mobile shots come from the pane.
- The browser caches CSS/JS from `python3 -m http.server` aggressively: after edits, hard-reload (or `fetch(url, {cache:'reload'})` each file) before checking.
- Mobile pill scroller does not auto-scroll to the active pill yet (later pills sit off-screen on D16–D18). Do it in T6/T13.
- Reduced motion: layers stack at 100svh each showing their end state (S8 copy and the floating pill row are hidden there). Not emulated here; T14 builds the real version.
- `Blood pressure` wraps to two lines in the 375px chip grid; fine, but T13 can tune chip type.

**Next step → T3:** in `js/scenes/s1-hero.js`, replace the midpoint `cut(...)` with motion: radial-mask reveal of `.hero__glow` over the D9 photo (grow from the forehead hotspot, ~frame px 894,386), chip stagger (`.chips .chip`), tags sliding to `data-state="up"` (animate `top` 421→407 on desktop, or `y: -14`), CTA fade-out. Then the 5 icon loops on `[data-id="body"]` inside each `.chip .icon` (time-based gsap tweens, toggled by a ScrollTrigger on the s1 window, off under reduced motion). Keep the layer's hold window (`sceneWindow`) as is.

---

## T3 S1 Hero glow and vital chips (done, 2026-10-06)

**Built** (`js/scenes/s1-hero.js`; the midpoint `cut` is gone)
- Glow reveal: `.hero__glow` (D10 photo) sits over the D9 photo with a feathered radial `mask-image` (scenes.css). Centre `--gx/--gy` = forehead hotspot (frame px 894,386, corrected for the glow image's placement); `--r` is scrubbed 0 → 1400px (feather `--f` 220px) over 5–60% of the segment, `sine.inOut`. Scrolling back shrinks it into the forehead.
- Copy re-layout: CTA fades/drops out (10–22%), tags lift `y: -14` on desktop (14–30%; the old `.tags[data-state="up"]` CSS rules are removed), "A 30-second facial scan results in:" rises in (30–44%).
- Chips: stagger from 38% (`y 48 → 0`, scale 0.94 → 1, 0.075 seg per chip, `power3.out`); each icon glyph pops in just after its chip (`back.out`). All in by ~84%, so the tail of S1 and the first half of t1-turn hold D10.
- Icon loops (time-based, glyph `[data-id="body"]` only; shadow and glow rasters never move): heart beats at 72 bpm (double-thump), O₂ molecule spins (7 s), blood-pressure sphere squashes from its base, lungs breathe (2.3 s each way ≈ 13/min), glucose hexagon ticks +60° steps. `#sparkles` children twinkle (staggered opacity).
- New `js/lib/ambient.js` + `ctx.onCleanup` in main.js (see ASSET_MAP "Ambient loops"). Loops run while the playhead is in [chips start, S1 window end] and pause outside it.
- All timings are fractions of `ctx.duration`, so a `mobileUnits` change in config.js rescales them.

**Verified** (Browser pane, `?still` + `tl.time()` sampling)
- 10-point forward and reverse sweeps give identical glow radius, CTA, tags and chip states.
- Loops: blood-oxygen body rotates at t = 1.7 / 2.3 / 1.8 (in the window), frozen at t = 0.3 (before chips) and t = 5 (S1 hidden); shadow `transform: none` throughout.
- No console errors. Mobile 375×812: glow mask follows the focus crop, chips enter in the 2-column grid, CTA fade leaves only a small gap.
- Screenshots: `docs/shots/t3-desktop-glow-mid.jpg` (mask mid-grow), `docs/shots/t3-desktop-d10.jpg` (chips landed), `docs/shots/t3-mobile-375.jpg`.

**Known issues / notes**
- `frameAt` (the `?ref=` overlay) still switches D9 → D10 at S1's midpoint; the animated end state matches D10 from ~85% of the segment. Compare D10 with `?at=s1-hero+0.95`.
- Animating `--r` repaints the mask on a full-size image each frame; smooth here, but T15 should profile it (fallback: `clip-path: circle()` with a blurred edge layer).
- Reduced motion: end state set statically (glow on, CTA hidden, tags up), no loops.
- The preview launcher still can't read iCloud: start `python3 -m http.server 8080` from Bash in `site/`, then `preview_start site`.

**Next step → T4:** generate the head-turn image-to-video clip (first frame `assets/img/hero-a-glow.webp` placed as D10, last frame `front.webp` as D11), export 60–90 WebP frames to `assets/seq/turn/`, or mark T4 `blocked` with the reason so T5 uses the crossfade fallback. Note for T5: the S1 icon loops currently run until S1's window end (mid t1-turn); T5 should fade the chips out there.

---

## T4 Head-turn footage (done, 2026-10-06)

**Built**
- `assets/seq/turn/turn-000…089.webp`: 90 frames, 1280×910 (the full 1440×1024 frame box), WebP q74, **3.0 MB** total, plus `manifest.json`. See ASSET_MAP "Image sequences".
- `tools/seq/build_turn.py` (python3 + numpy + opencv-python-headless + Pillow, all `pip3 install --user`): decodes the clip, aligns it to the frames, writes the sequence. Re-run it to rebuild after replacing the clip.
- `tools/seq/turn-source.mp4`: the clip (copy of the user's `davinci_locked_off_static_camera…mp4` in the project root). `tools/seq/user-first-d10.jpg` / `user-last-d11.jpg`: the 2000×1422 end frames the user generated it from.

**How the clip was made**: Figma Weave could not be used (video models need a paid Figma plan; this account is Starter/View seat, and uploads returned 403). The user generated the clip themselves (first/last-frame image-to-video, prompt: locked-off camera, phone lowers, head turns to camera, glow dots fade, window background dissolves to a soft pale-blue wall, same identity).

**Alignment (why the frames line up)**
- The generator crops/reframes slightly: clip frame 1 → D10 is a similarity at scale 2.816, clip frame 97 → D11 at 2.632 (SIFT + RANSAC, ~140 and ~115 inliers). Each clip frame is warped by the similarity interpolated linearly in time between the two, then edge-replicated (the last frame was a few px short of the right edge).
- The user's 2000px frames are exactly frame space (they map onto the site's photo boxes at scale 0.6400, offset < 1px).
- The first and last 6 frames smoothstep-blend into the site's own `hero-a-glow`/`front` photos placed as in T2: frame 000 vs D10 1.7/255, frame 089 vs D11 1.3/255 (WebP noise only).
- 97 → 90 frames by even resampling. Step-to-step mean diff 3.4/255, max 6.0 (where a source frame was skipped), no spikes.

**Review**: `docs/shots/t4-sequence-sheet.jpg` (every 6th frame), `docs/shots/t4-faces.jpg` (face crops at 0/20/40/60/75/89), `docs/shots/t4-preview.webp` (animated, forward + back). Identity holds (face, freckles, hair, sweater).

**Known issues / notes**
- The clip is only 752×560, so mid-turn frames are ~1.8× upscaled and softer than the photos; the sharp end photos blend in over 6 frames at each end. A regenerated clip at 1080p+ would drop straight into `build_turn.py` (keep the same end frames).
- Eye colour reads slightly browner mid-turn (frames ~30–70) than in D10/D11 (green). Subtle at full size.
- She blinks around frame 20 (natural, but visible when scrubbing slowly).
- Only the site's photos are used as end anchors; `user-*.jpg` are higher-res versions of `hero-a-glow`/`front` and could replace them later (T15) if crispness matters.
- No site code changed in T4.

**Next step → T5:** in a `t1-turn` module, add a `<canvas>` in a frame box over the S1 photos, preload `assets/seq/turn/manifest.json` + frames (decode with `createImageBitmap`), and map the t1-turn segment progress → frame index (draw cover-fit like the photo boxes). Show the canvas only inside t1-turn: at frame 0 it equals the D10 glow photo, at frame 89 it equals the D11 `front` photo, so swap layers there with no crossfade. Choreograph the chips sinking/fading (S1 icon loops currently run until S1's window end, mid t1-turn), the headline line-mask swap, and build the crossfade fallback for reduced motion / missing frames.

---

## T5 T1 transition: head turn (done, 2026-10-06)

**Built**
- `js/scenes/t1-turn.js` (config: `module: 't1-turn.js'`). `build()` makes the layer (canvas + fallback box); `link()` does the choreography.
- `main.js`: new optional **second pass** — after every layer and the shared pills exist, `module.link?.(tl, ctx)` runs. Use it when a transition has to drive elements of the scene after it.
- **Layering**: the turn layer sits under every layer (`z-index: -1`) and is visible for the whole t1-turn segment. S1 and S2 get `data-turn="on"` for that segment, which hides their background and `.photo` (scenes.css), so their copy/chips stay on top of the footage. Frame 0 = D10 glow photo, frame 89 = D11 photo, so both ends are plain swaps.
- **Sequence scrubber**: full-stage canvas (DPR ≤ 2), drawn from a `gsap.ticker` check of the playhead (so `?still` seeks work too) only when the frame/fit/size changes. Frame = `sine.inOut` of segment progress 4–96%. Cover-fit = the S1 photo box's fit.js transform interpolated to S2's (identical on desktop; on mobile the face crop travels with the turn). Mobile repaints the same top fade as the photo boxes, with the layer colour going `--c-hero-top` → `--c-sky`.
- **Preload**: manifest fetched at import; frames start after `window.load`, coarse-to-fine (every 16th → 8th → 4th → 2nd → all), 4 in flight, as `Image` elements (ready on `load`; `decode()` is only a hint — it never settles in a hidden tab). Not ImageBitmaps: 90 decoded frames would be ~420 MB.
- **Choreography** (segment fractions): results title + chips sink and fade 0.02–0.3 (stagger from the last chip), tags fade 0.1–0.22, S1 headline lines + sub-headline line-mask wipe out upward 0.16–0.44, S2 lines wipe in from below 0.54–0.84 (the eyebrow is the same in both, so it never moves), `#pills` eases in from the right 0.7–0.95. The glow dots and the window → blue wall come from the footage.
- **Fallback** (`data-mode="fallback"`): D10 → D11 crossfade with push-in (scale 1.07 at the face), blur (10px) and a soft-light sweep band, on the same scroll progress. Used when the manifest fails, when no frame within ±3 of the playhead has loaded yet, or with `?noseq`. The layer can switch between modes at any point.

**Verified** (Browser pane)
- Desktop 1440×1024: seams at the segment start (S1 photo → frame 0) and end (frame 89 → S2 photo) are invisible; mid-turn frames, wipes and pills as intended. All 90 frames load; no console errors.
- Forward vs reverse sweep over 8 points (chips, S1/S2 lines, tags, pills, turn layer): identical states.
- Native scroll (not `?still`) to mid-turn → timeline at the expected time, `seq` mode.
- `?noseq`: fallback blur crossfade shows the whole way.
- Mobile 375×812: seams clean, crop interpolates from the S1 face crop to the S2 one, top fade matches.
- Screenshots: `docs/shots/t5-desktop-turn.jpg` (0 / 0.3 / 0.47 / 0.7 / 1.0), `docs/shots/t5-desktop-fallback.jpg`, `docs/shots/t5-mobile-375.jpg` (0 / 0.5 / 1.0).

**Known issues / notes**
- Reduced motion: the turn layer is hidden (`display: none`); the stacked end states show D10 then D11. T14 can reuse the fallback box for a fade-only version.
- `#pills` entrance (x 120 → 0 + fade) now lives in t1-turn.js. T6 can replace it with its own slide-in; keep it inside the turn's tail or the row will pop in at the segment midpoint (that is where its layer becomes visible).
- The `?ref=` overlay still switches D10 → D11 at the turn's midpoint.
- Pane-hidden caveat still applies (rAF stops): use `?still` + `gsap.ticker.tick()`, or take a screenshot to wake the pane.

**Next step → T6:** S2–S4 (D11–D13) in `s2-science.js`, `s3-scan.js`, `s4-roi.js`: pill active states (and optionally take over the pill entrance from t1-turn.js), headline reflow, the green scan line mapped 1:1 to scroll with a face-clipped trail, ROI boxes drawn on with DrawSVG.

---

## T6 S2–S4 Science, face scan, ROI (done, 2026-10-06)

**Built**
- `js/lib/wipe.js`: the line-mask wipe from T5 as helpers (`headLines`, `wipeOut`, `wipeIn`); t1-turn.js now uses them too.
- **Pill row** (`js/shared.js`, `t1-turn.js`, scenes.css): the pills slide in from the right one by one (stagger) at 64–96% of the turn, replacing the whole-row slide. When a step lights, its colours ease (0.35s CSS transition) and its dot pops (scrubbed keyframes 1 → 1.35 → 1, so it reverses cleanly); this applies to every later step too. Mobile: a MutationObserver on `data-active` smooth-scrolls the pill scroller to centre the newest lit pill (this closes the T2 note).
- **S2 (D11)**, `s2-science.js` (segment fractions): reading pause 0–0.5, headline lines wipe out upward 0.5–0.8, photo eases +4px (D11 → D12 placement) 0.7–1.0. `s3-scan.js` `link()` glides S2's sub-headline up into its Step 1 slot 0.7–1.0: CSS `top: calc(var(--k) * var(--shift))` with `--shift` measured from the layout (re-measured on resize and `fonts.ready`), so it also holds on mobile where the lines wrap. A relative `top` rather than `translate`, because GSAP writes `translate: none` inline on elements it transforms.
- **S3 (D12)**, `s3-scan.js`: headline wipes in 0–0.28. The scanner is the D12 line (same 2px stroke and gradient) plus a blurred glow and a 120px gradient trail, drawn 700–1060 wide and clipped to a face outline (`FACE`, frame px), so the line's length follows the face; at the brow it is exactly D12's 757.5 → 991. It fades in at the hairline 0.08–0.14, sweeps y 262 → 598 **linearly** 0.12–0.82 (passes the brow = D12 at ~0.35), fades at the chin, then the headline wipes out 0.84–1. A shimmer (the bright stop drifts along the line, 1.4s yoyo) runs via `ambient()` only while the scanner is on screen. The static `scan-line-d12.svg` is no longer inlined (its values live in the scanner markup).
- **S4 (D13)**, `s4-roi.js`: headline wipes in 0–0.28 (the sub-headline stays). The three boxes draw on with DrawSVG 0.1 / 0.2 / 0.3 (forehead, viewer-left cheek, viewer-right cheek), each settling from scale 1.12 with a brief teal lock-on fill; all settled by ~0.65, so the rest of S4 and the hold into t2-zoom show D13.

**Verified** (Browser pane, `?still` + `__film.master.time()`)
- Seams: at the s3-scan label the S2 and S3 sub-headlines and photos are at identical positions (desktop 172.16px both, photo top −1.40 both; mobile within 0.12px); S3's headline is fully clipped at its start and wiped out by its end; the scanner is at opacity 0 by the s4-roi label.
- Scan maps 1:1 to scroll: constant 342.9 frame px per unit across five samples, hairline → chin. Native scroll to `s3-scan+0.5` → t = 5.300, line at y 444.5 as predicted.
- ROI end state = D13 exactly (bboxes 773.5,300.5 132×62 · 755.5,433.5 81×62 · 911.5,407.5 81×62, fully drawn, identity transform, fill-opacity 0).
- Forward vs reverse sweep over 61 points from the turn to mid t2-zoom (layer visibility, every headline line's clip/transform, sub offsets, photo transform, scanner, pill opacity/transform/dot scale, ROI dash/transform/fill): identical.
- Mobile 375×812: reflow, scan and ROI read cleanly; pill scroller follows the active step (scrollLeft 359 at step 4); no horizontal overflow. No console errors.
- Screenshots: `docs/shots/t6-desktop.jpg` (S2 0.88 / S3 0.2 / S3 0.6 / S4 0.25 / S4 0.8), `docs/shots/t6-mobile-375.jpg` (S3 0.5, S4 0.8).

**Known issues / notes**
- Pausing exactly at the `s3-scan` / `s4-roi` labels now shows mid-reflow (headline not yet in). Matching frames: D11 at `s2-science+0.3`, D12 at `s3-scan+0.35` (line at the brow), D13 at `s4-roi+0.7`. The `?ref=` overlay still switches at the labels.
- Headless Chrome screenshots (`--screenshot`) hung this time; pane screenshots need a ~1s wait after a seek or they show the previous paint.
- The face outline is hand-traced; the top of the clip includes a little hair at the hairline, which reads as the scan "entering" the face.
- Reduced motion: scanner static at the brow (= D12) without trail; ROI boxes and headlines static. T14 does the real version.

**Next step → T7:** t2-zoom (D13 → D15): push the camera into `[data-id="roi-cheek-right"]` of the S4 layer, hand off to the `cheek` photo (S5) with no jump, grow the small box into `#roi-big` (roi-d14.svg), then the swatch grid fill in S5. S4's boxes are settled from ~0.65 of its segment, and its hold runs to mid t2-zoom.

---

## T7 Zoom + pixel sampling (done, 2026-10-06)

**Built**
- `js/scenes/t2-zoom.js` (config: `module: 't2-zoom.js'`), `build()` makes the camera layer, `link()` drives it and S4/S5's copy.
- **One camera, no swap**: photo C (`cheek`) is a crop of photo B (`front`). SIFT + RANSAC (35 inliers) gives C → B as a similarity at scale 1/7.4464, rotation −0.23° (ignored, ≤1 world px), origin (816.81, 380.20). The D14 big box maps back onto B at 903–999 × 420–468, i.e. right on the D13 viewer-right cheek box (911–993 × 408–470). So the camera is a world (= B frame px) with C placed inside it at that origin, scaled 1/Z. The camera transform goes from S4's photo fit to S5's photo fit composed with ×Z, scale interpolated **exponentially** about the transform's fixed point (constant perceived speed), progress `sine.inOut` over 0.06–0.9 of the segment. Fits are read from the photo boxes' `fit.js` transforms, so desktop and mobile both land exactly.
- **B → C hand-off**: C fades in (u 0.26–0.5) with a rectangular feathered edge (`--fe`, 420 C px → 0 as u → 1, so C's edge never shows as a line over B); B stays underneath with a growing 0–0.7px blur until the camera lands, then hides.
- **ROI box**: the viewer-right cheek rect morphs in world space into the world rect of `#roi-big` (`power2.inOut`, u 0.2–1) while its screen stroke eases 3 → 8 and radius 9.5 → 28 (set in world units as screen / scale). The other two boxes fade 0.04–0.22 as they fly out.
- **Copy**: S4 headline + sub wipe out 0–0.3; the D14 copy (S5 layer) wipes in 0.6–0.9.
- **Layering**: like t1-turn: `.layer--t2-zoom` is `z-index: -1` and visible for its whole segment; S4/S5 get `data-zoom="on"` for that time (no background, no `.photo`). Mobile: `.zoom__fade` repaints the photos' top fade band (sky above) in screen space, interpolated between the S4 and S5 bands.
- **S5** (`s5-pixels.js`, segment fractions): D14 holds 0–0.12; copy reflow D14 → D15: sub wipes out 0.12–0.24, headline glides down into its D15 slot 0.2–0.5 (relative `top` = `--k` × measured `--shift`; the CSS rule now covers `.copy__h` too), sub is moved while clipped and wipes in at its D15 slot 0.42–0.6, then the D14 block cuts to the identical D15 block at 0.62. Swatches pop in (opacity 0 → 1, scale 0.2 → 1, `back.out`) on a diagonal grid stagger 0.24–0.84. D15 holds from ~0.85 into t3-skin.

**Verified** (Browser pane, `?still` + `__film.master.time()`)
- **No jump at B → C**: at t2-zoom 0.9999 vs s5-pixels 0.0001, photo C rect differs by ≤0.04px and the ROI box equals `#roi-big` exactly (643,294 709×367, stroke 8) — desktop 1440×1024 and mobile 375×812.
- Copy cut at s5 0.62: D14 and D15 headline/sub positions identical (81.5,271.16 / 80,172.16).
- Forward vs reverse sweep, 81 points from s4-roi+0.3 to t3-skin+0.3 (layer visibility + `data-zoom`, camera transform, box attrs, every copy line's clip/transform/top, all 112 swatches, C/B styles): identical.
- Native scroll to `t2-zoom+0.5` → timeline 7.600 as expected. No console errors. Mobile: no horizontal overflow.
- Screenshots: `docs/shots/t7-desktop.jpg` (t2 0.3 / 0.4 / 0.55 / 0.85, s5 0.45 / 0.9), `docs/shots/t7-mobile-375.jpg` (t2 0.55 / 0.8, s5 0.9).

**Known issues / notes**
- Mid-zoom, the sharp C detail reads as a soft "focus" patch inside a slightly blurred B (by design; B is only 0.62 px/frame px).
- S5's static `shows: [14, 15]` / `?ref=` still switches at the S5 midpoint; matching frames now: D14 at `s5-pixels+0.05`, D15 at `s5-pixels+0.9`.
- Reduced motion: zoom layer hidden; S5 keeps the static D14 → D15 cut.
- Pane screenshots still need ~1s after a seek (they sometimes show the previous paint).

**Next step → T8:** t3-skin (D15 → D16): collapse the 112 `.swatch` rects of the S5 layer into a point of light, raise the `skin` section (S6), draw the incoming beam to "Light in", then trace 6–10 vessel paths over `skin.webp` with time-based MotionPath pulses (via `ambient()`). S5 holds D15 from ~0.85 of its segment into the first half of t3-skin.

---

## T8 Into the skin + vessel signals (done, 2026-10-06)

**Built**
- `js/scenes/t3-skin.js` (config: `module: 't3-skin.js'`). No layer content: `link()` drives S5's and S6's elements (segment fractions):
  - D15 headline lines wipe out 0–0.25 (the sub-headline is identical in D15/D16 and stays put through the cut).
  - Camera push 1 → 1.55 into the ROI centre (997.5, 477.5) on the cheek photo + ROI + swatch overlays, 0.02–0.5 (`power2.in`).
  - ROI box shrinks into its centre and fades 0.04–0.3; the 112 swatches fly into the centre (outer cells first, `power3.in`) 0.06–0.34.
  - A warm point of light (`.skin-light__core`, radial gradient white → orange) ignites there 0.14–0.3, then grows and fades out by 0.48; a white bloom (`.skin-light__bloom`, r 0 → 3200 frame px, `expo.in`) covers the stage 0.26–0.5. The static cut S5 → S6 at the segment midpoint is white-on-white (verified: both sides pure white below the copy, desktop and mobile).
  - Skin rises 0.5–0.84 (`--rise` 0 → 1; the skin image and vessel overlay translate by (1 − `--rise`) × `--drop`, `--drop` re-measured per fit/resize so it always starts just below the stage).
  - S6 headline wipes in 0.55–0.82; incoming beam draws (DrawSVG) 0.6–0.88, head 0.84–0.92; "Light in" pops 0.88–0.98 (`--pop`, a `transform` scale, so the mobile `scale` rule on labels still holds).
- `js/scenes/s6-vessels.js`: S6 now draws the rest of the light story (segment fractions): specular reflection 0.02–0.14 + head + "Reflected lights", into the tissue 0.12–0.26, back out 0.26–0.4 + "Vessels reflect light", out of the skin 0.42–0.54. D16 is complete from ~0.57 and holds into t4-beams. The dashed tissue paths are revealed through a `<mask>` holding a solid copy (DrawSVG would overwrite their dash array).
- **Vessel signals**: `tools/vessels/trace.py` (numpy + Pillow + opencv-python-headless, `pip3 install --user`) snaps hand-picked waypoints to the centre of the red/blue vessel masks of `skin.webp`, smooths and fits cubics → `js/scenes/vessels-paths.js` (10 paths, 5 arteries + 5 veins, 95–100% of samples inside their vessel; re-run it to retune). 19 pulse dots (one per ~230 frame px) ride them with MotionPath — arteries 150 px/s from the trunk up into the branches, veins 105 px/s back down and right → left — each blinking at 1.2 Hz (72 BPM, the pulse later steps measure). Glow = radial-gradient circles, no SVG filters. All loops are time-based through `ambient()` (play only inside S6's window); the pulse group's opacity is scrubbed in over S6 0–0.1.
- `css/scenes.css`: rise/pop/vessel rules (T3 into the skin block).

**Verified** (headless Chromium via Playwright; GSAP served from the npm package because cdnjs is blocked in this cloud environment's network policy, the site itself is unchanged)
- Forward vs reverse sweep, 61 points from s5-pixels+0.5 to t4-beams+0.3, every element of S5/S6 (opacity, visibility, transform, clip-path, translate, SVG transform/r, dash offsets, `--rise`, `--pop`): identical at 1440×1024 and 375×812.
- Pulses: all 19 move while the scroll is still; none move when the playhead is outside S6's window. Frame timing with the pulses running: median 16.7 ms, p95 16.8 ms, max 16.8 ms (no spikes).
- No console errors from T8 code. (A pre-existing GSAP warning, "Invalid property transformOrigin set to 50% 100%", comes from a `defaults: { transformOrigin }` on an icon-loop timeline in `s1-hero.js:41`; it is present without T8's changes. T15 can fix it.)
- Screenshots: `docs/shots/t8-desktop.jpg` (t3 0.15 / 0.3 / 0.42 / 0.65 / 0.95, s6 0.3 / 0.7), `docs/shots/t8-mobile-375.jpg` (t3 0.2 / 0.4 / 0.7, s6 0.7).

**Known issues / notes**
- Matching frames: D15 at `s5-pixels+0.9`, D16 from `s6-vessels+0.6`. `?ref=` still switches at the labels.
- Pulses are drawn over the vessels but under the beams and labels; on desktop the pill row covers part of the lower trunk (layout from T2).
- Reduced motion: no transition; S6 shows D16 with the pulses static (dots visible at their start positions, no loops).
- This session ran in a cloud container (no Browser pane), so screenshots come from headless Chromium rather than the pane.

**Next step → T9:** t4-beams (D16 → D17): keep the S6 beam paths (`[data-id="beam-in-line"]`, `beam-specular`, `beam-out`, tissue paths) persistent, interpolate their points (same point count) while the camera pans until they become the D17 arrows feeding the RGB box (`#diagram`, `[data-id="arrow-tails"]`). The pulses' `ambient()` window ends at t4-beams' midpoint (S6's hold); fade `.vessels__pulses` with the skin as it slides away.

---

## T9 T4 Follow the light beams (done, 2026-10-06)

**Built**
- `js/scenes/t4-beams.js` (config: `module: 't4-beams.js'`). `build()` makes the beam layer; `link()` drives it plus S6's and S7's elements.
- **Idea**: the two beams leaving the skin (`beam-specular`, `beam-out`) are parallel in D16 (−35.9°, 240.6 frame px apart). A camera that follows them up and to the right and rolls +35.9° levels them, so they *become* the two D17 arrows (86.6 apart → scale 0.36). Specular → `arrow-0`, beam-out → `arrow-1`.
- **One pair of beams for the whole segment** (`.layer--t4-beams > .fly__svg`, screen px). Each beam = 2-point shaft + 3-point chevron at both ends. Point = `C(u)·p16 + w·(P17 − F·p16)`: carried by the camera `C(u)` (exponential scale, linear roll, the pivot = midpoint between the chevron tips travelling straight on screen from its D16 spot to the D17 chevrons), plus a residual that lands exactly on the D17 centrelines (`F = C(1)`). The chevron is built in the shaft's own frame (tip at an interpolated fraction of the shaft, arms at interpolated local offsets), so it always sits on its shaft and keeps a screen size that eases from D16's (46 frame px arms) to D17's, instead of shrinking with the camera. Shafts end off-screen left at D17 (the real arrows have off-canvas tails). Stroke widths ease 10 → 9.1 (shaft) / 8 (arms) in screen terms.
- **Skin rides the camera**: S6's photo content is wrapped in `.beams-cam` (so neither fit.js's transform on the frame box nor t3-skin's `--rise` translate is touched); its transform is `A⁻¹ ∘ C(u)`. Its right and bottom edges get a growing feathered mask (`--fe` 0 → 380 frame px over 0.02–0.3) so the rolled image never shows a hard edge. The incoming beam, tissue paths, vessels and pulses go with it.
- **Segment fractions**: labels fade 0–0.12; S6 headline wipes out 0–0.25; camera 0.04–0.9 (`sine.inOut`), residual weight over u 0.1–0.95 (`power2.inOut`); skin fades 0.12–0.45; cut S6 → S7 at 0.5 (white on white, `.fly__bg` takes over the white); S7 headline wipes in 0.55–0.82; RGB box draws on 0.56–0.86; cells, curves, label and panel fade in 0.62–0.9; S7's real arrows fade in on top of the (identical) beams 0.9–0.97; the beam layer hides at the segment end.
- **Layering**: `.layer--t4-beams` sits between S6 and S7 in DOM order. `data-beams="on"` (whole segment) hides S6's own two outgoing beams and drops S7's background (scenes.css, "T4 follow the beams").

**Verified** (headless Chromium via Playwright, GSAP from the npm package as in T8)
- **Never disappear / never replaced**: frame-stepping 57 steps from t4 −0.08 to +1.08, the count of beam-orange pixels falls smoothly from 28.4k (D16) to 6.5k (D17) with no gap. The beam layer is visible at every step inside the segment; shaft length ≥ 280 screen px throughout.
- **Seams**: S6 0.9999 vs t4 0.0001 and t4 0.9999 vs S7 0.0001 differ only in anti-aliased edge pixels of the beams (plus the time-based pulses at the start seam); the midpoint cut differs only where the scene is meant to change (the step-4 pill lights there).
- Forward vs reverse sweep, 61 points from t4 −0.3 to +1.5, every element of S6/T4/S7 (inline styles, path `d`, stroke widths, `data-beams`), excluding the time-based pulse dots: identical.
- 1440×1024, 1920×1080, 375×812: geometry is read from the photo and diagram fits, so all three land exactly on the D17 arrows. Reduced motion: layer hidden, no `.beams-cam`, arrows static. No console errors.
- Screenshots: `docs/shots/t9-desktop.jpg` (t4 0.02 / 0.2 / 0.35 / 0.5 / 0.65 / 0.8), `docs/shots/t9-mobile-375.jpg` (t4 0.2 / 0.45 / 0.65 / 0.9).

**Known issues / notes**
- This session ran in a cloud container; T8 lived on the unmerged branch `claude/t8-implementation-1zwuiu`, so T9 is built on top of it (the T9 branch includes T8's commit).
- Matching frames: D16 at `s6-vessels+0.6`…`t4-beams+0`, D17 from `t4-beams+0.9`. `?ref=` still switches at the labels.
- The RGB box / cells / curves / panel entrance here is a simple draw + fade so S7 doesn't pop in; T10 may replace the cells lighting up and the curves drawing into the panel inside S7 (they are fully visible from t4 0.9).
- Mobile: the pill scroller's smooth scroll to "Clean noises" starts at the midpoint cut (existing behaviour).
- Reduced motion: no transition (static D16 → D17).

**Next step → T10:** S7 Step 4 (D17) in `s7-clean.js`: seeded synthetic rPPG data (1.2 Hz pulse, 0.25 Hz respiration, drift, motion noise), draw raw → detrend → POS → band-pass → BVP into `#calc-panel .panel__body` with axes, units and a formula, scroll-scrubbed across S7's 2.4 units (each stage readable for ~half a viewport). The diagram and panel are fully in from `t4-beams+0.9`.

---

## PR #1 review fixes (T8/T9, 2026-10-06)

Checked in the desktop app's Browser pane (real Chrome, GSAP from cdnjs) at 1440×1024 and 375×812. Fixed:
- **Mobile skin rise started on screen**: `t3-skin.js` measured `--drop` in `link()`, before fit.js places the frame boxes, and again only on resize. On a fresh 375×812 load it was 395px instead of 607px, so the skin began its rise about 195px above the bottom edge. It now re-measures on the next frame, once the fits exist.
- **Forward vs reverse mismatch**: the D15 headline lines kept `clip-path: none` going forward but `inset(-30% -4%)` after reversing past the wipe-out. They now get the open clip up front (same fix T7 uses for S4's sub-headline).
- **`rx: Expected length, "NaN"` console error** (pre-existing, from `t2-zoom.js`): render is skipped while a fit scale is 0 (a zero-size stage at boot); same guard on the `--drop` measure.

Verified after the fixes: no console errors, no failed requests; forward vs reverse identical at 92 points from s4-roi+0.3 to s7-clean+0.6 (311 elements, pulses excluded); pulses move on the vessels; mobile skin now starts below the stage (top 832px on an 812px stage).

---

## T10 S7 Step 4: signal-conditioning panel (done, 2026-10-06)

**Built**
- `js/lib/rppg.js`: seeded synthetic rPPG data and the Step 4 chain, pure functions (no DOM; runs in node too). 30 fps, 16 s generated, 3–13 s shown (`VIEW`, clear of the filter edges). Model per channel: `DC · (1 + AC·pulse + resp + drift + motion) + noise`.
  - pulse: 1.2 Hz mean (72 BPM) with ±0.05 Hz respiratory sinus arrhythmia, 2nd/3rd harmonics, AC/DC G 1.0 % > B 0.45 % > R 0.25 %
  - respiration: **13/min (0.217 Hz)**, as baseline wander plus pulse-amplitude modulation. PLAN's T10 says 0.25 Hz, but T11's acceptance needs 13/min, so I went with 13/min.
  - drift: a slow illumination change common to all channels, plus a small white-balance creep per channel
  - motion: two head movements (6.4 s, 11.1 s), mostly a colour-neutral intensity change
  - chain: normalise + cubic detrend → POS (Wang 2017, 1.6 s windows, overlap-add) → 2nd-order Butterworth high-pass 0.7 Hz + low-pass 4 Hz, run forward–backward (zero phase) → z-scored BVP
  - checked in node: BVP vs true pulse r = 0.994; detected peaks give a mean IBI of 0.833 s = 72.0 BPM; the band-passed spectrum peaks at 1.20 Hz
  - SpO₂ for T11: ratio of ratios R/B = 0.0025/0.0045 = 0.556, and `SPO2_CAL` [110, 25] → 96.1 %
- `js/scenes/s7-clean.js`: the panel (`.sp` in `#calc-panel .panel__body`) has an HTML header (eyebrow, stage title, 5-step track), an SVG plot (axes, t 0–10 s) and an HTML formula card. **Three polylines (301 points each) carry all five stages.** For each stage, every line gets data, colour, width and opacity (`LINES`); the lines morph between stages and are never swapped:
  - line 0: R lane → R̃ → X → S ghost → gone
  - line 1: G lane → G̃ → S → S band-pass → BVP
  - line 2: B lane → B̃ → Y → gone
  - Ticks, units, legend, annotations and formulas are per-stage groups. The outgoing group fades over the first half of a morph and the incoming one over the second, so text never overlaps. Annotations: the motion band (raw/detrend) turns into "cancelled" (POS); the |H(f)| inset (top right of the header) marks the 0.7–4 Hz band, HR and respiration; BVP shows peak markers and one period bracket.
- **One scrubbed state** `f` 0 → 1 over S7, and everything is rendered from `f` (like t4-beams). S7 fractions:
  - 0–0.1: cells light up row by row (scale + brightness pop)
  - 0.02–0.13: a dot of each channel's colour runs along its curve into the panel
  - 0.06–0.17: raw traces draw on left → right (clip)
  - stage morphs at 0.27–0.33, 0.45–0.51, 0.63–0.69 and 0.81–0.87
- `js/config.js`: S7 goes from 2.4 to **3.0 units**, so each stage reads for ≥ 0.54 viewport of scroll (the BVP stage then holds through all of S8).
- `css/scenes.css`: "S7 Step 4 signal panel" block. `--ts` scales the text up where the panel is fitted small. Mobile: the diagram is moved to `0.02 0.27 0.96 0.2` and the panel to `0.03 0.48 0.94 0.38` (bigger), and the eyebrow and notes are hidden.

**Verified** (headless Chromium via Playwright; GSAP from the npm package because cdnjs is blocked here, as in T8/T9)
- Forward vs reverse sweep, 121 points from t4-beams+0.5 to s8-calc+0.5, covering every line's `d`/stroke/width/opacity, stage groups, titles, formulas, track, the clip, pulse dots and cells: identical at 1440×1024 and 375×812. Jumping from S8 back to t4 restores the empty-panel state. S7's start seam is identical either side.
- Native scroll to `s7-clean+0.5` (no `?still`) → POS stage shown. Reduced motion: static BVP end state. No console errors.
- Screenshots: `docs/shots/t10-desktop.jpg` (s7 0.08 / 0.2 / 0.39 / 0.57 / 0.75 / 0.95), `docs/shots/t10-mobile-375.jpg` (s7 0.08 / 0.2 / 0.57 / 0.95).

**Known issues / notes**
- I could not view the reference artifact (it's from another organisation and needs the user's approval to open), so the panel follows the site's own palette and type.
- Mobile: legend items sit a little tight (their spacing is computed for desktop text size). T13 can measure them with `getComputedTextLength`.
- The formula card uses system serif math fonts (STIX Two / Cambria / Times), not a web font.
- T8 and T9 are still only on unmerged branches (`claude/t8-implementation-1zwuiu`, `claude/brave-johnson-5b1qep`). This branch, `claude/lucid-fermat-s5pcrr`, contains T8 + T9 + T10.
- Matching frame: D17 is the panel before stage 1 (`t4-beams+0.95`); the panel content is new (D17's rectangle is empty).

**Next step → T11:** S8 Step 5 (D18) in `s8-calc.js`. Import `generate()` from `js/lib/rppg.js` (same seed → same data) and take over `#calc-panel .sp`: the BVP stage is on screen from s7 0.87 through S8. Morph line 1 (BVP) or fade the stage-5 chrome (`.sp__stage[data-i="4"]`, `.sp__title[data-i="4"]`, `.sp__f[data-i="4"]`) into the analysis views: Welch PSD peak 1.2 Hz = 72 BPM, peaks, HRV strip, SpO₂ ratio of ratios (`AC`, `SPO2_CAL` → 96 %), respiration envelope (13/min).

---

## T11 S8 Step 5: Calculate (done, 2026-10-06)

Built on `claude/lucid-fermat-s5pcrr` (T8 + T9 + T10). That chain is still not merged to `main`.

**Built**
- `js/lib/rppg.js`, `analyse(d)` (pure, ~15 ms): measures Step 5 from `generate()`'s output and skips 1 s at each end for filter edges. Nothing is copied from the constants.
  - **HR**: Welch PSD of the BVP (8 s Hann, 50 % overlap, nfft 1024), highest bin in 0.7–4 Hz with parabolic refinement: f₀ = 1.2027 Hz → **72.16 → 72 BPM**. Cross-check from systolic peaks (`systolicPeaks()`, sub-sample): 71.99 BPM, mean IBI 833 ms.
  - **HRV**: from the 16 IBIs, RMSSD 35 ms and SDNN 26 ms. The RSA is the only variability in T10's model.
  - **RR**: peak heights resampled at 4 Hz, Hann, FFT peak in 0.1–0.5 Hz: 0.2187 Hz → **13.12 → 13 /min**.
  - **SpO₂**: band-passed R and B (normalised by DC), regressed onto the BVP in 2.5 s windows (~3 beats, 50 % overlap), median window: R = 0.555 → 110 − 25·R = **96.13 → 96 %**.
  - Why windowed: a whole-signal regression gave 0.63 (94 %), because T10's motion is colour-neutral and pulls the ratio toward 1; the two motion windows read 0.79 and 0.83. Masking motion, or regressing on G, gave 0.51–0.71. The median over windows is the motion-robust estimate and lands on T10's design value of 0.556.
- `js/scenes/s7-clean.js`: one added export, `BVP_PLOT` (plot box + z-score scale), so S8 can map onto S7's line.
- `js/scenes/s8-calc.js` draws `svg.calc` into `.panel__body`:
  - A: BVP over S7's 10 s window with systolic peaks and IBIs in ms.
  - B: Welch PSD 0–4.5 Hz with the band shaded, f₀ = 1.20 Hz marked and 2f₀ labelled.
  - C: HR card, "72 BPM", HR = 60·f₀, plus the peak-to-peak cross-check.
  - D: HRV lollipop strip with RMSSD and SDNN.
  - E: band-passed R/B traces, the ratio-of-ratios formula and "96 %" (median of 10 windows).
  - F: faint BVP over 14 s with the Catmull-Rom peak envelope: f = 0.219 Hz → RR = 13 /min.
- **Hand-off from S7, no swap**:
  - At the s8-calc label, our BVP path sits exactly on S7's line: same samples, and a matrix maps block A onto S7's plot (`vector-effect: non-scaling-stroke`, stroke 2.8 to match).
  - S7's `.sp` fades out over 0–0.07 (we only touch the `.sp` wrapper; T10's render keeps every child).
  - The line eases into block A over 0.02–0.14 as one scrubbed progress value, so both scroll directions give identical matrices.
- Choreography, in segment fractions (S8 = 2 units):
  - A frame 0.08, peaks pop 0.12–0.29, IBIs 0.14–0.3
  - B 0.22–0.4
  - C 0.34–0.48 (HR counts up)
  - D 0.46–0.62
  - E 0.6–0.78
  - F 0.74–0.9
  - then the panel holds into t5-vitals
  - Counters are scrubbed tweens. Every block gets at least 0.28 viewport.
- CSS (`.calc*` in scenes.css) uses `fill-opacity` / `stroke-opacity` only, because GSAP's `autoAlpha` owns `opacity`.
- Reduced motion: S7's `.sp` is hidden and the analysis is shown complete.

**Verified** (headless Chromium via Playwright; GSAP from the npm package because cdnjs is blocked here)
- DOM counters at s8+0.95: `hr=72 rmssd=35 sdnn=26 spo2=96 rr=13`. Under reduced motion they are the same.
- Forward vs reverse sweep, 41 points from s8 − 0.2 to t5 + 0.2, covering every `.calc` node's opacity, transform, DrawSVG, y2 and text: identical.
- The s7+0.99 → s8+0.001 seam only differs where two identical lines overlap.
- No console or page errors at 1440×1024 or 375×812.
- Screenshots:
  - `docs/shots/t11-desktop.jpg`: panel at s7 0.99 / s8 0.001 / 0.07 / 0.3 / 0.56 / 0.95
  - `docs/shots/t11-desktop-full.jpg`: s8 0.95
  - `docs/shots/t11-mobile-375.jpg`: s8 0.04 (mid hand-off) / 0.95

**Known issues / notes**
- Mobile: labels are 11px in panel px, about 6px on screen at 375. T13 should give `.calc` T10's `--ts` text scaling, or a stacked mobile layout (the `BOX` table at the top of s8-calc.js).
- `generate()` runs twice, once in S7 and once in S8 (~20 ms each, identical output). It could be memoised.
- If T10's noise, motion or seed changes, re-check `analyse(generate())` in node: hr/rr/spo2 must round to 72/13/96.

**Next step → T12:** t5-vitals (D18 → D19). Continue `.calc__bvp` (block A) out of the panel into the heart-rate card trace. Morph the PSD, HRV, SpO₂ and envelope paths into the four card charts (same-structure polylines), fade in photo E, and bring back the icon loops and the CTA.

---

## T12 T5 Wave → vitals + finale (done, 2026-10-06)

Built directly on `main` (T8–T11 are merged there now).

**Built**
- `js/scenes/t5-vitals.js` (new; `config.js` now points t5-vitals at it). One scrubbed state `f` 0 → 1 over the 1.6-unit segment; everything is rendered from `f`.
  - **Morphs** (overlay `svg.vitals__svg`, stage px). Every one is a polyline with the same point count at both ends, so no wave is ever cut or swapped:
    - BVP (block A) → heart-rate ECG trace. 330 points: a 301-step grid plus the ECG's own vertices inside the chart's clip window. The right end leads, so the pulse wave reads as running out of the panel.
    - respiration envelope `.calc__env` → breathing-rate wave. 160 points; the target is the chart's exact cubic (x is linear in t, so y = c ∓ 3a·t(1−t)).
    - SpO₂ R trace `.calc__ch--r` → blood-oxygen step line. 160 points, by arc length along the centreline of the chart's 2.41 px rects.
    - 9 of the 16 HRV bars → the 9 glucose bars (a line whose stroke widens into a butt-capped 23.26 px bar; bars move as one piece).
    - PSD `.calc__psd` → systolic bar fill; B trace `.calc__ch--b` → diastolic bar fill. 120 points each, 4.81 px round caps.
  - Sources come from S8's svg via its root CTM (identity hand-off matrix at the end of S8; S8's x/y fades sit on other nodes). Targets come from each chart SVG's own geometry (viewBox + translate parsed at load) mapped through the `<img>` box with the card transform cleared. Geometry is measured lazily on the first render (fit.js places the boxes after `link()`) and again after a resize.
  - Stroke colour, opacity and width interpolate from S8's computed style to the chart's (`#ce73a8`); width only changes over the last 40 % of each flight. S8's source paths hide for the segment (their copies sit exactly on them at f = 0).
- Choreography (segment fractions):
  - 0–0.2: S8 headline wipes out; the sub-headline and pills fade
  - 0.04–0.3: diagram and panel fade
  - 0.12–0.5: photo E and the finale background (`--bga`) dissolve in over S7's white
  - morph windows start at 0.06 / 0.1 / 0.14 / 0.18–0.23 / 0.22 / 0.24, each 0.54 long, plus a 0.06 crossfade into the chart image
  - each card settles 0.24 before its chart lands, and its icon glyph pops
  - 0.5: S9 headline wipes in, sub-headline from 0.62
  - 0.8–0.95: connectors
  - from 0.7 to the end of the film: icon loops
- `js/lib/loops.js` (new): S1's icon loops moved out of `s1-hero.js` as `iconLoops(iconEls)` so the D19 cards reuse them. S1 behaviour is unchanged.
- `js/scenes/s9-finale.js`: the D9 **Contact us CTA returns** at its D9 spot (80, 478; clear of the cards) and fades in over S9 0–0.25. D19 itself has no CTA, so `s9-finale+0` is the exact D19 match and the CTA arrives just after it.
- `js/scenes/s8-calc.js`: HRV bar lines carry `data-y2` (their drawn end, since S8 animates `y2`). Comment updated.
- `css/scenes.css`: the finale background is `color-mix(… var(--bga, 1) …)` so it can fade; `.vitals__svg`.

**Verified** (desktop app Browser pane, real Chrome, GSAP from cdnjs, 1440×1024 and 375×812)
- No console errors.
- Seam: `t5-vitals −0.001` and `+0.001` look identical (the overlay sits on S8's paths).
- Landing: with the chart images hidden, the overlay lines alone at their landing reproduce all five card charts (white BP tracks excepted; they arrive with the image crossfade).
- Forward sweep vs reverse sweep vs a direct jump from 0, 81 points from t5 −0.375 to the end of the film, across 161 elements (inline styles, path `d`, stroke attributes; icon loop bodies excluded): identical. Reversing therefore re-forms the S8 panel exactly.
- Icon loops: driven by ticks, all five glyphs move in S9 and stand still in S8. S1's loops still run after the refactor.
- Screenshots:
  - `docs/shots/t12-desktop.jpg`: t5 0.001 / 0.2 / 0.4 / 0.55 / 0.61 / 0.85, the last with the morph lines forced visible and the chart images hidden (landing check)
  - `docs/shots/t12-mobile-375.jpg`: t5 0.001 / 0.35 / 0.6 / S9 with the CTA

**Known issues / notes**
- The pane's python server sends no cache headers, so the browser can hold on to stale ES modules. Hard-reload (or `fetch(…, {cache:'reload'})`) after editing.
- When the Browser pane is hidden, rAF stops: the GSAP ticker freezes and `?at=` (which waits a rAF) does nothing. That is not a bug in the code.
- Reduced motion: t5 adds nothing (the static D18 → D19 cut) and the CTA is shown statically. T14 builds the full stacked alternative.
- Mobile: the morphs work unchanged (all geometry is measured). T13 can tune the timing, since on mobile the lines travel from the panel to the bottom card grid.
- The 7 HRV bars that aren't picked, and the lollipop dots, fade out with the panel.

**Next step → T13:** mobile choreography pass (`mobileUnits` in config.js, camera targets, 375×812 and 768×1024 portrait and landscape).

---

## T13 Mobile choreography pass (done, 2026-10-06)

Built directly on `main`.

**Audit** (Browser pane, real Chrome; each scene seeked at 2–3 fractions at 375×812, 768×1024 and 812×375). What I found:
- S8 analysis labels were about 6px on a phone.
- Phone landscape was broken: the stacked mobile composition was squeezed into 375px of height, with the headline under the chips and the cards over the copy.
- On tablet the S7/S8 panel was fitted by height and sat small above empty space.

Everything else (S1 chips, turn, scan, ROI, zoom, pixels, skin, beams, vitals morphs, finale) already read cleanly on mobile, because their camera targets are measured from the fitted boxes. I left them alone.

**Findings by scene.** Seeked with `trigger.disable(false)` + `master.time()`. Phone = 375×812, tablet = 768×1024, landscape = 812×375. Landscape before the fix used the stacked composition and was broken in every scene; the landscape notes below are after the fix (desktop composition).

| Scene | Phone | Tablet | Landscape (after fix) | Action |
|---|---|---|---|---|
| S1 hero (D9→D10) | Copy on top, face glow centred, 5 chips in a 2-col grid over her lower face ("Glucose level" alone on row 3). Clean. | Clean, chips across the bottom. | The D10 frame at ~0.37×. Chips readable. | none |
| T1 turn | Footage fills, eyebrow stays, headline swaps. Clean. | — | — | none |
| S2 science | Headline + pills scroller along the bottom. A big empty band in the middle is the D11 reading pause (photo B sits under it). | — | — | none |
| S3 scan | Scan line spans the face width and maps 1:1 to scroll. Pill 1 lit. | — | — | none |
| S4 ROI | 3 boxes on forehead/cheeks. | Boxes sit right on the face. | — | none |
| T2 zoom | Push into the right-cheek box, no jump. Headline is gone mid-zoom, by design. | — | — | none |
| S5 pixels | Swatch grid fills the box. The "Step 2: ROI detection" headline wraps to 3 lines. | Also wraps to 3 lines (66px clamp). | — | none (acceptable) |
| T3 skin | At 0.5 the stage is white (the bloom cut, by design); the skin rises after. | — | — | none |
| S6 vessels | Skin section on the bottom half, beams run past the right edge, "Vessels reflect light" label slightly clipped on the right. | Clean. | Clean. | none (minor) |
| T4 beams | Two beams pan across an empty stage, then become the D17 arrows. | Clean. | — | none |
| S7 clean | The panel (POS / band-pass stages) is readable through `--ts`. **The RGB curves exit at the right screen edge** instead of feeding the panel (which is below). | The panel was height-bound and small → target made taller. | Desktop frame, small but whole. | panel target `0.03 0.475 0.94 0.42` |
| S8 calc | **Labels ~6px**. After the fix: ~8–10px, with the f₀/band labels and SpO₂/respiration collisions removed. SpO₂ formulas ~7px. | ~8.6px text, clean. | Desktop frame, small. | `--tc/--tb/--tf` text scale, notes hidden, `mobileUnits 2.4` |
| T5 vitals | Lines fly from the panel down to the card grid over photo E. Clean. | Clean. | — | none |
| S9 finale | Headline, CTA, 2-col card grid over the photo. Clean. | Cards zoom capped at 1 (they don't fill the columns). | The D19 frame, cards readable, CTA visible. | none |

**Other findings**
- Screenshots taken straight after a seek can show stale paint (a missing photo). Wait ~0.8 s before taking one. This is not a bug.
- The pane serves ES modules from cache. Edits need `fetch(url, {cache:'reload'})` + reload (as noted in T12).
- With the app pane hidden, `document.visibilityState` is `hidden`, so rAF stops and scrolling doesn't advance the timeline. Testing scroll needs `ScrollTrigger.update()` + a loop of `gsap.ticker.tick()`. With that, scrollY → master time is exact at every test point.
- The first forward/reverse sweep that queried the DOM inside each snapshot showed false diffs (t5 builds its overlay lazily). Snapshot a fixed element list instead; the sweep is then identical at all 61 points.

**Changed**
- **Mobile = portrait.** `config.js` has a new `MOBILE_QUERY = (max-width: 899px) and (max-aspect-ratio: 1/1)`. `main.js` matchMedia uses it (`isDesktop` = `not all and …`), and so does `fit.js` (`mobileMq.matches` instead of `innerWidth < BREAKPOINT`). All six `@media (max-width: 899px)` blocks in `css/` are now `… and (max-aspect-ratio: 1/1)`.
  - Landscape phones (e.g. 812×375, and anything under 900px wide that is wider than tall) now get the desktop composition, contain-fitted like the frames. gsap.matchMedia rebuilds the film when the device rotates.
  - **Keep the CSS and JS queries in sync** if either changes.
- **S8 mobile text** (`css/scenes.css`): `.calc` font sizes are now `calc(Npx * var(--tc, 1))`. The big HR number and its unit use `--tb`, and formulas use `--tf`. On mobile:
  - `--tc = clamp(1, 0.78/--fs, 1.6)`, which is ≈1.5 at 375px, so labels are about 8–10px on screen
  - `--tb ≤ 1.25` and `--tf ≤ 1.15` (SpO₂'s formula column has to end before block F at x 356)
  - Hidden on mobile because they would collide: the BVP / PSD / SpO₂ method notes, the "pulse band" label (the band stays shaded) and the " · pulse-amplitude envelope" tail of F's title (`.calc__long` tspan in `s8-calc.js`)
  - Desktop sizes are unchanged (the vars default to 1)
- **S7/S8 panel target** on mobile goes from `0.03 0.48 0.94 0.38` to `0.03 0.475 0.94 0.42`. Phones are width-bound, so nothing changes there; on tablet the panel grows about 10% into the empty band above the pills.
- **Pacing**: S8 gets `mobileUnits: 2.4` (vs 2.0) because the analysis is denser to read on a phone. Mobile film length is 21.4 viewports (desktop 21).

**Touch-scroll feel**
- Native scroll and `scrub: 0.5` are unchanged; there's no scroll normalisation (PLAN: no scroll-jacking).
- The track and stage use `svh`, so the iOS URL bar collapsing doesn't change the scroll length. Frame boxes are fitted to the stage (100svh), not `innerHeight`.

**Verified**
- 375×812:
  - forward vs reverse seek sweep, 61 points over the whole film, every stage element's style / `d` / `transform`: identical
  - native scroll (ticker pumped by hand, since the pane was hidden so rAF was paused) at 0.2 / 0.5 / 0.85 / 0.4 / 0.05 / 1 of the track lands exactly on master time = fraction × 21.4
  - no console errors
- 768×1024 and 812×375: each scene seeked, layouts clean.
- 1440×1024: duration 21, `.calc` text at its original sizes, S8 looks as before.
- Screenshots:
  - `docs/shots/t13-mobile-375.jpg`: S8, before and after
  - `docs/shots/t13-tablet-768.jpg`: S7 POS stage, S8, t5 mid-morph
  - `docs/shots/t13-landscape-812.jpg`: S1, S6, S8, S9 in the desktop composition

**Known issues / notes**
- Mobile S7/S8: the three RGB curves still leave the diagram at the right screen edge (the panel sits below rather than to the right). It reads as "off to the panel" but isn't a literal connection. Bending them down into the panel would need a mobile-only curve geometry in s7-clean.js.
- Landscape phones show the whole 1440×1024 frame at about 0.37×, so the nav links and pill text are small (about 8px). That's acceptable for a presentation prototype; a dedicated landscape composition would be a new layout.
- The SpO₂ formula lines on a phone are about 7px (capped by block F's position).
- The Browser pane hides its tab when the app pane isn't shown. rAF then stops, so scroll tests need `gsap.ticker.tick()` pumping (see Verified).

**Next step → T14:** reduced motion and accessibility (stacked static end states, fade-only reveals, heading order, alt text, focus states, contrast).

---

## T14 Reduced motion + accessibility (done, 2026-10-06)

Built directly on `main`.

**Reduced motion** (`prefers-reduced-motion: reduce`, or `?reduced` in the URL to force it for review, `REDUCED_QUERY` in config.js)
- The film becomes a stacked page: no pinned stage, no ScrollTrigger, one full-screen (100svh) section per **scene** in story order (S1 → S9; 9 sections). Every scene shows its static end state (the module `reduced` branches from T2–T13, unchanged).
- All transition layers are hidden by kind: main.js sets `data-kind` on each layer and CSS hides `.is-reduced .layer[data-kind="transition"]`. Before this, the empty t3-skin and t5-vitals layers left two blank screens.
- **S8 Step 5 has its own section now.** Previously S8 was hidden and its analysis replaced S7's panel under the "Step 4" headline. In reduced mode s8-calc.js clones S7's `#diagram` and `.panel-box` (ids stripped, diagram clone `aria-hidden`), hides the clone's `.sp` and draws the analysis into it. S7 keeps its BVP end state.
- **Step pills:** shared.js gives each stepped scene its own static copy of the row with that scene's `data-active` (the shared layer stays hidden). On mobile each copy's scroller is centred on the active pill.
- **Fade-only reveals:** `js/lib/reveal.js` veils every scene section except the first and fades it in once (opacity 0.6 s CSS transition) when 20 % of it enters the viewport. Opacity only; nothing moves.
- **No loops, no image sequence:** ambient loops were already never created under reduced motion. t1-turn's sequence preload now returns when `REDUCED_QUERY` matches, so the 90 frames are never fetched (verified: 0 `turn-*.webp` requests in reduced mode, 90 in motion mode). If the user switches reduced motion off, t1-turn's `link()` starts the preload. The mobile pill scroller uses instant scrolling in reduced mode, and `html { scroll-behavior: auto }` under the media query.

**Accessibility**
- **Heading order:** one `h1` (S1), an `h2` per scene, `h3` for the S7 stage titles and D19 card titles. S7 and S9 now put their copy block before the panel/cards in the DOM so each `h2` precedes its `h3`s (visual stacking unchanged; checked on desktop and 375px).
- **Alt text:** `photoBox()` takes `alt`. S2, S3, S4, S5, S6 and S9 photos describe what the scene shows; S1 already had one. Decorative layers (glow photo, icon rasters, chart images next to their live values) stay `alt=""`. S7's diagram is `role="img"` with a label; S8's analysis already had one.
- **Step pills:** `<ol aria-label="How it works">`, the newest lit pill carries `aria-current="step"` (updated by a MutationObserver on `data-active`, in the film too), the number dots are `aria-hidden` (the list order carries the number).
- **Focus states:** `:focus-visible` is a 3 px navy (`--c-focus`) outline at 3 px offset over a 6 px white halo, so it reads on the light UI and on photos (the old mint ring was 1.2–1.6:1). Nav links get a 4 px radius for the ring. Checked with Tab / Shift+Tab on the nav CTA (`docs/shots/t14-focus-ring-desktop.jpg`).
- **`#contact`:** the "Contact us" links pointed to a missing id. An empty `#contact` anchor after the track now lands on the end of the film (S9 with its CTA) in both modes.

**Contrast check** (WCAG 2.2 AA; ratios computed from the token hex values)
| Pair | Before | After | Fix |
|---|---|---|---|
| sub-headline gradient start `#0baa7a` on sky (46px, large) | 2.3 | 3.1 | first stop → `#078f67` (ui.js `STOPS`, `--grad-accent`) |
| inactive pill label `#8f9ea7` on `#f3f3f3` (26px bold, large) | 2.5 | 3.5 | `--c-muted-ink #74838c` |
| S7 eyebrow / stage track / ticks / `.dim` (11–12px) `#8f9ea7`, `#6b7c87` on white | 2.8 / 4.3 | 5.2 | `--c-muted-text #5d6f7a` |
| S8 formula subscripts R `#ef4444`, B `#01aeff` (9px) on white | 3.8 / 2.5 | 4.8 / 5.9 | `--c-r-ink #dc2626`, `--c-b-ink #0369a1` (text only; lines keep the frame colours) |
| focus ring | 1.2–1.6 | 10.9 | navy + white halo |
Passing already: headline navy on sky 10.9, eyebrow plum 9.1, tag ink 5.8, CTA ink on mint 11.8, chip label on chip green 4.7, active pill 14.7, nav 19.7, card text 12.7, calc notes 5.2, calc magenta 6.5, band label 4.8, D16 label pills 18.9.
The frame hex values stay in tokens.css for strokes and fills; the new tokens are text-only.

**Verified** (desktop app Browser pane, real Chrome; reduced via `?reduced`, since the pane can't emulate the media query)
- Desktop 800×600 pane and 375×812: all 9 sections in order, each matching its end state, pills lit per step, fade-in on scroll, no horizontal overflow (scrollWidth 375), no console errors.
- Motion mode unchanged: duration 21, the turn sequence loads (90 frames), `?at=` seeks, `aria-current` follows the pills (S3 → Face scan, S6 → Extract RGB, S8 → Calculate), no console errors.
- Screenshots: `docs/shots/t14-reduced-desktop-s6.jpg`, `t14-reduced-desktop-s8.jpg`, `t14-reduced-mobile-375-s8.jpg`, `t14-reduced-mobile-375-s9.jpg`, `t14-focus-ring-desktop.jpg`.

**Known issues / notes**
- Design deviations to sign off: the gradient's first stop is a touch deeper green, and the inactive pill labels are a touch darker. Revert = `STOPS` in ui.js + `--grad-accent`, and `--c-muted-ink` → `var(--c-muted)`.
- Not changed: the white step numbers on the mint / grey pill dots (1.6:1 / 1.4:1) are frame design; they are `aria-hidden` and the label next to each carries the meaning.
- In motion mode only the current scene is in the accessibility tree (others are `visibility: hidden`), which is expected for a scroll film. Screen-reader users with reduced motion get the full stacked story.
- S7's five stage titles (`h3`) are all in the accessibility tree in reduced mode (only the BVP one is visible). They read as the list of processing stages.

**Next step → T15:** performance + QA (Lighthouse / perf trace, `will-change` only on the active scene, lazy-decoded images, full forward/reverse scroll at desktop, tablet and mobile sizes).

---

## T15 Performance + QA (done, 2026-10-06)

Built directly on `main`.

**Perf audit** (Browser pane, real Chrome). The pane was hidden for the whole session (`visibilityState: hidden`, rAF paused), so frame rates could not be read from rAF. Instead each step was timed synchronously: seek the master timeline + `gsap.ticker.tick()` + forced style/layout, every 0.0125 timeline units (~1,700 steps) over the full film, forward and reverse.
- Warm (second pass), every scene: p95 ≤ 0.7 ms of main-thread work per frame, worst < 4 ms. That leaves most of a 16.7 ms frame for paint/composite, so ~60 fps on desktop is expected. Run `?debug&autoscroll` in a visible tab to confirm on real hardware (see Tooling).
- First pass after load had spikes: up to **37 ms** at the start of T5 (GSAP initialises each tween on its first render) and **10–14 ms every turn frame** (drawImage decoding a 1280×910 WebP on the main thread; 90 decoded frames ≈ 420 MB, so Chrome evicts them). After the fixes below, worst first-pass frame is 11.8 ms and turn frames are ≤ 6 ms.

**Fixed**
- **Layout-thrashing properties removed.**
  - The headline reflow glides (S2→S3, D14→D15) animated `top` (layout every frame). They now use `translate: 0 calc(--k × --shift) !important`. `!important` because GSAP writes `translate: none` inline on elements it transforms; `translate` composes with GSAP's `transform`, so glide + wipe offsets still add up. s3-scan.js / s5-pixels.js measure with plain `offsetTop` (translate doesn't affect it).
  - S7's stage-track bars animated `width`; now `transform: scaleX(var(--fill))`.
  - Remaining animated non-transform properties are paint-only and small or deliberate: the S1 glow mask radius, the T2/T4 mask feather (`--fe`), the S9 background colour, `clip-path` on headline lines, `stroke-dashoffset` (DrawSVG). The fallback turn's `filter: blur` only runs when the sequence is missing (`?noseq`).
- **`will-change` only around the playhead.** main.js tags the active layer and its two neighbours `.is-live` (master `onUpdate`, changes only on a scene boundary). CSS promotes only the big moving layers there (`.zoom__cam`, `.zoom__c`, `.beams-cam`, `.turn__box`, `.photo__img--skin`, `.vessels`) plus the vessel `.pulse` dots (previously always promoted). Off in reduced mode.
- **Lazy-decoded images.** Every stage image + the nav logo is `decoding="async"`; the up-front `img.decode()` now runs in `requestIdleCallback`.
- **Turn sequence.** Preload still starts on page load but waits for the first idle moment (the hero's own images go first). New decoded-frame window in t1-turn.js: frames within ±8 of the playhead are decoded **off the main thread** into `ImageBitmap`s (`fetch` from HTTP cache → `createImageBitmap(blob)`); the window starts filling 0.6 viewport before the turn, slides with it, and is closed/released when the playhead is further away (≈ 80 MB max). Draws prefer a bitmap within ±3 frames and fall back to the `<img>`. Verified: a 40 ms/step scrub through the turn drew 116/116 frames from bitmaps.
- **Tween warm-up.** After the ScrollTrigger is created, main.js renders the whole film once at idle (`master.progress(1)` → `master.time(t)`, same task, no paint). Verified: no visible element differs before/after (computed opacity, visibility, transform, clip-path, filter, dash), and the 61-point forward/reverse sweep (global timeline paused so ambient loops don't count) is identical on all 1,142 stage elements.

**QA sweep** (automated: every scene at 0.25/0.5/0.75/0.98, every visible text node checked for viewport clipping and on-screen size < 7.5 px; pill scrollers excluded)
| Viewport | Found | Action |
|---|---|---|
| 1440×900 | nothing | — |
| 1280×720 | D19 card units/deltas/rows ~6.3–7 px; S7 inset ticks, S8 peak labels, R/B subscripts ~6–6.8 px | cards: `--ct` text scale `clamp(1, 0.8/--fs, 1.2)`; S7/S8 logged (frame annotation size) |
| 768×1024 | S7 inset ticks 6.8 px, S8 peak labels 7.2 px, R/B subscripts 6.8 px | S7 inset ticks now scale with `--ts`; S8 logged |
| 375×812 | S9 card text 5.7–6.3 px; S6 "Vessels reflect light" clipped at the right edge; S7 inset ticks 4.4 px and stage-number badge 6.2 px; S8 as T13 notes | cards `--ct` from `--card-zoom` (≈1.39 → ~8–9 px; rows lifted so they clear the bars); right-edge beam labels grow leftwards + `translate: -36px` (`.beam-label--right`, set in s6-vessels.js); `.sp__tick--s` and the `.sp__title span` badge scale with `--ts` |
No horizontal overflow at any size. No console errors in motion, `?reduced` or `?noseq` modes. Reduced mode: no `.is-live`, 0 turn-frame requests.

**Tooling** (js/debug.js)
- `?debug` overlay now shows fps (rolling 1 s) and the worst frame.
- `?debug&autoscroll[=seconds]` scrolls the whole film forward then back with native scroll (default 40 s each way) and prints per-scene fps / p95 / worst / frames > 20 ms via `console.table` (also on `__film.perf`). Needs a visible tab — I could only run it with a patched rAF in the hidden pane, where throttled timers make the numbers meaningless.

**Screenshots:** `docs/shots/t15-turn-bitmap-1280.jpg` (turn mid-way, bitmap draw), `t15-finale-cards-1280x720.jpg`, `t15-mobile-375-s7-labels.jpg`, `t15-mobile-375-s9-cards.jpg`.

**Known issues / logged**
- Real-device fps not measured (hidden pane). Do one `?debug&autoscroll` run in a visible desktop Chrome before stakeholder review.
- S8 analysis annotations (RR interval labels, R/B subscripts, SpO₂ formulas) are 6–7 px below ~1300 px wide and on phones. Bumping them collides with neighbouring blocks (see T13); a fix needs a re-laid-out S8.
- S7 band-pass inset tick labels are ~7 px on a phone even after the fix (small inset by design).
- First-pass cost before the idle warm-up finishes: scrolling straight into the film within ~1 s of load can still hit one 10–12 ms frame.

**Next step → T16:** publish `site/` as a multi-file private Artifact (page + `files` map; the 90 turn frames ≈ 3 MB fit), check it in the Browser pane, write `site/README.md` (run locally + scene map), give the user the link.

## T16 Publish (done, 2026-10-06)

Built directly on `main`.

**Published:** https://claude.ai/artifact/HqidruF44hYMCb8mBAuzef (private; share from the page's Share menu). 160 files: the page + everything under `assets/`, `css/`, `js/` (≈ 3.7 MB). `docs/` and `tools/` are not published.

**How**
- The Artifact host wraps the page in its own doctype/html/head/body skeleton (with charset + `viewport-fit=cover` viewport). New `tools/artifact_page.py` strips those wrappers (and the duplicate charset/viewport metas) from `index.html` into a page file; it's published with `root` = `site/` and a `files` list so all relative paths (CSS, ES modules, `fetch('assets/svg/…')`, the turn sequence) resolve unchanged.
- All external loads are on the Artifact CSP allowlist already (GSAP from cdnjs, fonts from Google Fonts).
- `README.md` added: run locally, review switches, scene map (from `js/config.js`), folder layout, how to republish.

**Checks**
- Artifact file listing confirms all 160 files live with the right MIME types.
- The Browser pane isn't signed in to claude.ai, so the live URL could not be opened there. Instead the exact stripped page was wrapped in an equivalent skeleton and served locally: the film scrubs through every label forward and back, no console errors, no horizontal overflow, finale reached at 375×812. Screenshots: `docs/shots/t16-artifact-wrap-desktop-s3.jpg`, `t16-artifact-wrap-mobile-375-s9.jpg`.
- Photos missing in those shots are a hidden-pane artefact (async image decode never runs while the pane is hidden); the same happens with plain `index.html`, and forcing `img.decode()` paints them.

**Known issues**
- Query-string switches (`?debug`, `?reduced`, `?noseq`) don't reach the published page (the viewer strips them); reduced motion still follows the viewer's OS setting.
- Owner should open the link once while signed in to confirm on real hardware (and run `?debug&autoscroll` locally in a visible tab, per T15).

**Next step:** none in the plan. Polish requests from stakeholder review → republish the same page file to the same URL (see README).

## R1 Revisions after review (done, 2026-10-09)

Built directly on `main`. Three requested edits.

**1. New vital icons + reference loops.** Drawings now come from `../health icons.svg` (no orbit rings or sparkles). `tools/extract.py` `extract_icons()` builds one SVG per icon (`assets/svg/icons/<name>-glyph.svg`) placed where D10's icons sat (same shapes, so a pure offset): `#shadow` (stays put), `#body > #core` (glow + shape + sheen) and `#body > #hl` (highlight). Glow and shadow are inline `feGaussianBlur` now (the 10 `*-shadow/glow.webp` rasters are deleted), so the glow moves with the body. `js/lib/loops.js` follows the reference film (artifact 8Zn8Hgc85QRnzLRf8zCzYi): heart double beat 1.05 s (scale 1 → 1.16 → 0.97 → 1.09 → 1), O₂ spin 5 s and glucose spin 7 s (on `#core`, so the highlight stays lit from the same side), BP squash on its base 1.8 s, lungs breathe from 10 % below the top 3.6 s. GSAP percentage keyframes; still paused off screen by `ambient.js`, off under reduced motion.

**2. Headline descenders.** The gradient sub-headline (`.copy__sub`) is painted with `background-clip: text`, which only paints inside the element box; with line-height ≈ font-size the "p"/"g" descenders were cut ("simple language", "smart phone"). It now has `padding-bottom: 0.3em` cancelled by `margin-bottom: -0.3em`; `.copy` became a flex column so that negative margin can't collapse into the next line's `margin-top`. Every `.copy` child's `offsetTop` is unchanged (checked in all 10 copy blocks).

**3. New D19.** Same photo; changes read off the new `Desktop - 19.svg`:
- cards `#CDF4F3` with a `#CEFAF3` stroke (`--c-card`, new `--c-card-line`); no connector lines (`connectors-d19.svg` removed) and no Contact us CTA in the finale (the old build added one; the new frame has none).
- Blood pressure moved to 1121.4,675.4 (267.2 wide); heart rate is 226.2 wide with a new trace (x 1096–1297); glucose is 154.7 tall (contents 3 px lower); breathing contents 1 px lower. `extract.py` finds cards by fill and names them by icon glow colour (the rings are gone). Card text tops updated in `ui.js` `CARDS`.
- Icons in D19 are full size now (were 0.8×): `icons_d19` boxes come from the glow positions.
- `t5-vitals.js` targets updated: `HR_WIN` [1096, 1297], `BR.c` 504.825, `BP` bars y 753.708 / 781.331 from x 1140.41. Checked at t5 0.795: the morph end points land on the charts within 1 px.
- Mobile: the grid keeps cards 290 wide, so the two narrower cards keep their chart at its D19 width on the left, the icon keeps its gap to the right edge (`--r`), and the BP rows end where their bars end.

**Checks:** 1440×900 and 375×812, forward through S1 and T5 into S9, `?reduced`; no console errors (only the browser's own `/favicon.ico` 404). Screenshots: `docs/shots/r1-finale-desktop-1440x900.jpg`, `r1-finale-cards-mobile-375.jpg`, `r1-chips-new-icons.jpg`.

**Local server note:** the Claude app's launcher can't read iCloud Drive (`getcwd: Operation not permitted`), so `.claude/launch.json` stays in attach mode; start `python3 -m http.server 8080` from `site/` in a terminal.
