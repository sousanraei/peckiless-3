// Single source of truth for the film's structure and pacing.
// `units` = scroll length in viewport heights (1 unit = 100svh of scrolling).
// `mobileUnits` (optional) overrides `units` on the mobile composition
//   (MOBILE_QUERY: < 900px and portrait; tuned in T13).
// `module` = file in js/scenes/ exporting build(tl, ctx); null → nothing yet
//   (transitions until their task; the static layout cuts at their midpoint).
// `shows` = Desktop frame(s) the static layout shows (two → switch at midpoint).
// `step` = how many step pills are lit (pill row is visible when set).
// Order here = order on the timeline. Label on the master timeline = `id`.

export const BREAKPOINT = 900; // px; desktop ≥ BREAKPOINT
// The mobile composition (stacked, text on top) is for portrait screens below
// the breakpoint. Landscape phones (e.g. 812×375) are too short for it and get
// the desktop composition, contain-fitted like the frames. Keep in sync with
// the `@media (max-width: 899px) and (max-aspect-ratio: 1/1)` blocks in css/.
export const MOBILE_QUERY = `(max-width: ${BREAKPOINT - 1}px) and (max-aspect-ratio: 1/1)`;

// Reduced motion (T14): the film becomes a stacked sequence of the static end
// states with fade-only reveals. `?reduced` in the URL forces it for review.
export const REDUCED_QUERY = new URLSearchParams(location.search).has('reduced')
  ? 'all'
  : '(prefers-reduced-motion: reduce)';

export const SCENES = [
  { id: 's1-hero',    kind: 'scene',      frames: 'D9 → D10',  title: 'Hero glow + vital chips', units: 2.0, module: 's1-hero.js',    shows: [9, 10] },
  { id: 't1-turn',    kind: 'transition', frames: 'D10 → D11', title: 'Head turn',               units: 1.6, module: 't1-turn.js' },
  { id: 's2-science', kind: 'scene',      frames: 'D11',       title: 'The science behind',      units: 1.0, module: 's2-science.js', shows: [11], step: 0 },
  { id: 's3-scan',    kind: 'scene',      frames: 'D12',       title: 'Step 1 · Face scan',      units: 1.4, module: 's3-scan.js',    shows: [12], step: 1 },
  { id: 's4-roi',     kind: 'scene',      frames: 'D13',       title: 'Step 2 · ROI detection',  units: 1.0, module: 's4-roi.js',     shows: [13], step: 2 },
  { id: 't2-zoom',    kind: 'transition', frames: 'D13 → D14', title: 'Zoom into cheek ROI',     units: 1.2, module: 't2-zoom.js' },
  { id: 's5-pixels',  kind: 'scene',      frames: 'D14 → D15', title: 'Pixel sampling',          units: 1.0, module: 's5-pixels.js',  shows: [14, 15], step: 2 },
  { id: 't3-skin',    kind: 'transition', frames: 'D15 → D16', title: 'Into the skin',           units: 1.2, module: 't3-skin.js' },
  { id: 's6-vessels', kind: 'scene',      frames: 'D16',       title: 'Step 3 · Extract RGB',    units: 1.2, module: 's6-vessels.js', shows: [16], step: 3 },
  { id: 't4-beams',   kind: 'transition', frames: 'D16 → D17', title: 'Follow the light beams',  units: 1.4, module: 't4-beams.js' },
  { id: 's7-clean',   kind: 'scene',      frames: 'D17',       title: 'Step 4 · Clean noises',   units: 3.0, module: 's7-clean.js',   shows: [17], step: 4 },
  { id: 's8-calc',    kind: 'scene',      frames: 'D18',       title: 'Step 5 · Calculate',      units: 2.0, mobileUnits: 2.4, module: 's8-calc.js',    shows: [18], step: 5 },
  { id: 't5-vitals',  kind: 'transition', frames: 'D18 → D19', title: 'Wave → vital signs',      units: 1.6, module: 't5-vitals.js' },
  { id: 's9-finale',  kind: 'scene',      frames: 'D19',       title: '5 vital signs measured',  units: 1.4, module: 's9-finale.js',  shows: [19] },
];

// Step pill labels (D11–D18).
export const STEPS = ['Face scan', 'ROI detection', 'Extract RGB', 'Clean noises', 'Calculate'];

// ScrollTrigger scrub smoothing (seconds). Native scroll is never hijacked.
export const SCRUB = 0.5;
