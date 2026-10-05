// Single source of truth for the film's structure and pacing.
// `units` = scroll length in viewport heights (1 unit = 100svh of scrolling).
// `mobileUnits` (optional) overrides `units` below 900px (tuned in T13).
// `module` = file in js/scenes/ exporting build(tl, ctx); null → placeholder.
// Order here = order on the timeline. Label on the master timeline = `id`.

export const BREAKPOINT = 900; // px; desktop ≥ BREAKPOINT

export const SCENES = [
  { id: 's1-hero',    kind: 'scene',      frames: 'D9 → D10',  title: 'Hero glow + vital chips', units: 2.0, module: null },
  { id: 't1-turn',    kind: 'transition', frames: 'D10 → D11', title: 'Head turn',               units: 1.6, module: null },
  { id: 's2-science', kind: 'scene',      frames: 'D11',       title: 'The science behind',      units: 1.0, module: null },
  { id: 's3-scan',    kind: 'scene',      frames: 'D12',       title: 'Step 1 · Face scan',      units: 1.4, module: null },
  { id: 's4-roi',     kind: 'scene',      frames: 'D13',       title: 'Step 2 · ROI detection',  units: 1.0, module: null },
  { id: 't2-zoom',    kind: 'transition', frames: 'D13 → D14', title: 'Zoom into cheek ROI',     units: 1.2, module: null },
  { id: 's5-pixels',  kind: 'scene',      frames: 'D15',       title: 'Pixel sampling',          units: 1.0, module: null },
  { id: 't3-skin',    kind: 'transition', frames: 'D15 → D16', title: 'Into the skin',           units: 1.2, module: null },
  { id: 's6-vessels', kind: 'scene',      frames: 'D16',       title: 'Step 3 · Extract RGB',    units: 1.2, module: null },
  { id: 't4-beams',   kind: 'transition', frames: 'D16 → D17', title: 'Follow the light beams',  units: 1.4, module: null },
  { id: 's7-clean',   kind: 'scene',      frames: 'D17',       title: 'Step 4 · Clean noises',   units: 2.4, module: null },
  { id: 's8-calc',    kind: 'scene',      frames: 'D18',       title: 'Step 5 · Calculate',      units: 2.0, module: null },
  { id: 't5-vitals',  kind: 'transition', frames: 'D18 → D19', title: 'Wave → vital signs',      units: 1.6, module: null },
  { id: 's9-finale',  kind: 'scene',      frames: 'D19',       title: '5 vital signs measured',  units: 1.4, module: null },
];

// ScrollTrigger scrub smoothing (seconds). Native scroll is never hijacked.
export const SCRUB = 0.5;
