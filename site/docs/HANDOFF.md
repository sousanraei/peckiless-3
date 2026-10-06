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
