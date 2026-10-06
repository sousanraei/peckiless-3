// S7 Step 4 Clean noises (D17). Owns the shared RGB diagram (#diagram: arrows,
// RGB box, cells, curves) and the calculation panel (#calc-panel), which stay
// on screen through S8 (D18 repeats them). T10 draws the signal-conditioning
// chain into .panel__body; T11 takes the panel over in S8.
//
// The panel plots seeded synthetic rPPG data (js/lib/rppg.js) through five
// stages: raw R/G/B → detrend → POS projection → band-pass → BVP. Three
// polylines (same point count) carry the whole story: each stage gives every
// line its data, colour, width and opacity, and the lines morph between
// stages, so nothing is ever swapped. Header, stage track, axes, legend,
// annotations and the formula card cross-fade per stage.
//
// Everything is one scrubbed state `f` (0 → 1 over S7) rendered from scratch
// on each update, so forward and reverse scrolling give identical frames.
// Segment fractions (S7 = 3 units, so 0.18 ≈ 0.54 viewport per stage):
//   0–0.1      RGB cells light up row by row (left → right)
//   0.02–0.13  a pulse of each channel's colour runs along its curve
//   0.06–0.17  raw traces draw into the plot, left → right
//   0.27–0.33  raw → detrend        (stage readable ~0.12–0.30)
//   0.45–0.51  detrend → POS        (0.30–0.48)
//   0.63–0.69  POS → band-pass      (0.48–0.66)
//   0.81–0.87  band-pass → BVP      (0.66–0.84; BVP holds 0.84 → S8)
// Reduced motion: the BVP end state, static.
import { h, svg, preloadSVG } from '../lib/dom.js';
import { uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import * as R from '../lib/rppg.js';

await preloadSVG('rgb-d17.svg');

const { gsap } = window;
const NS = 'http://www.w3.org/2000/svg';

// ---------- panel geometry (panel-local px; the panel is 686×583) ----------
const P = { x: 92, y: 150, w: 554, h: 286 }; // plot area
const SECS = 10; // seconds shown

// ---------- data ----------
const D = R.generate();
const V = (a) => R.view(a, D);
const N = D.i1 - D.i0 + 1;
const xs = Array.from({ length: N }, (_, i) => P.x + (i / (N - 1)) * P.w);
const motionX = (s) => P.x + ((s - R.VIEW[0]) / SECS) * P.w;

const pct = (lo, hi, a) => {
  const s = [...a].sort((p, q) => p - q);
  return [s[Math.floor(lo * (s.length - 1))], s[Math.floor(hi * (s.length - 1))]];
};
const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (v, a, b) => clamp01((v - a) / (b - a));
const smooth = gsap.parseEase('power2.inOut');

// Stage 0: each channel in its own lane, robust min–max (motion overshoots).
const LANES = { r: 0.17, g: 0.5, b: 0.83 };
const laneY = (c) => {
  const a = V(D.raw[c]);
  const [lo, hi] = pct(0.02, 0.98, a);
  const mid = (lo + hi) / 2;
  const k = (0.24 * P.h) / (hi - lo);
  return a.map((v) => P.y + LANES[c] * P.h - (v - mid) * k);
};
// Common-scale stages: value → y about the plot's centre line.
const centred = (a, k) => a.map((v) => P.y + P.h / 2 - v * k);
const NORM_K = (0.42 * P.h) / 0.03; // ±3 % fills ±0.42 h
const sv = V(D.pos.s);
const POS_K = (0.42 * P.h) / Math.max(...pct(0.005, 0.995, sv).map(Math.abs));
const XY_K = (0.42 * P.h) / 0.016; // X, Y in their own units (±1.6 %)
const Z_K = (0.42 * P.h) / 3; // z-score ±3
// S8 (T11) picks the BVP line up from here: plot box + z-score scale.
export const BVP_PLOT = { ...P, k: Z_K, secs: SECS };

const Y = {
  rLane: laneY('r'), gLane: laneY('g'), bLane: laneY('b'),
  rN: centred(V(D.norm.r), NORM_K), gN: centred(V(D.norm.g), NORM_K), bN: centred(V(D.norm.b), NORM_K),
  X: centred(V(D.pos.x), XY_K), Yp: centred(V(D.pos.y), XY_K), S: centred(sv, POS_K),
  bp: centred(V(D.bp), POS_K), bvp: centred(V(D.bvp), Z_K),
};

// Per stage, per line: [data, colour, width, opacity].
const C = { r: '#ef4444', g: '#00816d', b: '#01aeff', navy: '#042d45', grey: '#9aa8b1', plum: '#ae1d72', ghost: '#bcc7ce', teal: '#00816d' };
const LINES = [
  [[Y.rLane, C.r, 1.6, 1], [Y.rN, C.r, 1.5, 0.85], [Y.X, C.grey, 1.4, 0.75], [Y.S, C.ghost, 1.6, 1], [Y.S, C.ghost, 1.6, 0]],
  [[Y.gLane, C.g, 1.6, 1], [Y.gN, C.g, 1.7, 1], [Y.S, C.navy, 2.4, 1], [Y.bp, C.teal, 2.6, 1], [Y.bvp, C.teal, 2.8, 1]],
  [[Y.bLane, C.b, 1.6, 1], [Y.bN, C.b, 1.5, 0.85], [Y.Yp, C.plum, 1.4, 0.55], [Y.S, C.ghost, 1.6, 0], [Y.S, C.ghost, 1.6, 0]],
];
const MORPHS = [[0.27, 0.33], [0.45, 0.51], [0.63, 0.69], [0.81, 0.87]];

// Stage position k ∈ [0, 4] from f (integer = settled stage).
const stageOf = (f) => MORPHS.reduce((k, [a, b]) => k + smooth(span(f, a, b)), 0);

// ---------- stage copy ----------
const STAGES = [
  {
    name: 'Raw', title: 'Raw RGB traces',
    unit: 'mean ROI intensity (8-bit)',
    formula: '<i>C</i><sub><i>c</i></sub>(<i>t</i>) = <span class="fr"><span>1</span><span>|ROI|</span></span> <span class="big">Σ</span><sub><i>x</i>∈ROI</sub> <i>I</i><sub><i>c</i></sub>(<i>x</i>, <i>t</i>), &nbsp; <i>c</i> ∈ {<i>R</i>, <i>G</i>, <i>B</i>}',
    note: 'Pixel average per frame at 30 fps. The pulse is &lt;1 % of the signal, buried under drift and motion.',
  },
  {
    name: 'Detrend', title: 'Normalise + detrend',
    unit: 'ΔC / μ (%)',
    formula: '<i>C̃</i><sub><i>c</i></sub>(<i>t</i>) = <span class="fr"><span><i>C</i><sub><i>c</i></sub>(<i>t</i>)</span><span><i>μ</i><sub><i>c</i></sub></span></span> − 1 − <i>p</i><sub>3</sub>(<i>t</i>)',
    note: 'Divide by each channel’s mean, subtract a cubic trend. Drift is gone; the motion spike is not.',
  },
  {
    name: 'POS', title: 'POS projection',
    unit: 'projected signal (a.u.)',
    formula: '<i>X</i> = <i>G̃</i> − <i>B̃</i>, &nbsp; <i>Y</i> = <i>G̃</i> + <i>B̃</i> − 2<i>R̃</i>, &nbsp; <i>S</i> = <i>X</i> + <span class="fr"><span><i>σ</i><sub><i>X</i></sub></span><span><i>σ</i><sub><i>Y</i></sub></span></span><i>Y</i>',
    note: 'Plane orthogonal to skin tone, tuned per 1.6 s window. Intensity changes along [1, 1, 1] cancel out.',
  },
  {
    name: 'Band-pass', title: 'Band-pass 0.7–4 Hz',
    unit: 'filtered signal (a.u.)',
    formula: '<i>S</i><sub>bp</sub> = <i>h</i><sub>BP</sub> ∗ <i>S</i>, &nbsp; |<i>H</i>(<i>f</i>)|: 0.7–4 Hz &nbsp;<span class="dim">(42–240 BPM)</span>',
    note: 'Butterworth, run forward and backward (zero phase). Respiration (0.22 Hz) and sensor noise drop out.',
  },
  {
    name: 'BVP', title: 'Blood volume pulse',
    unit: 'BVP (z-score)',
    formula: 'BVP(<i>t</i>) = <span class="fr"><span><i>S</i><sub>bp</sub>(<i>t</i>) − <i>μ</i></span><span><i>σ</i></span></span>',
    note: 'One clean wave per heartbeat, systolic peaks marked. Ready for Step 5.',
  },
];
const LEGENDS = [
  [['R', C.r], ['G', C.g], ['B', C.b]],
  [['R̃', C.r], ['G̃', C.g], ['B̃', C.b]],
  [['X', C.grey], ['Y', C.plum], ['S', C.navy]],
  [['S', C.ghost], ['S bp', C.teal]],
  [['BVP', C.teal]],
];

// y ticks per stage: [value, label]; value → y via the stage's scale.
const tickY = {
  1: [-2, 0, 2].map((v) => [P.y + P.h / 2 - (v / 100) * NORM_K, `${v > 0 ? '+' : ''}${v}`]),
  4: [-2, 0, 2].map((v) => [P.y + P.h / 2 - v * Z_K, `${v > 0 ? '+' : ''}${v}`]),
};
tickY[2] = [[P.y + P.h / 2, '0']];
tickY[3] = [[P.y + P.h / 2, '0']];
tickY[0] = ['r', 'g', 'b'].map((c) => [P.y + LANES[c] * P.h, R.DC[c].toFixed(0)]);

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}

function buildPanel(body) {
  body.innerHTML = `
    <div class="sp">
      <p class="sp__eyebrow">Signal conditioning · 30 fps · 10 s</p>
      <div class="sp__titles">${STAGES.map((s, i) => `<h3 class="sp__title" data-i="${i}"><span>${i + 1}</span>${s.title}</h3>`).join('')}</div>
      <ol class="sp__track">${STAGES.map((s, i) => `<li data-i="${i}"><span class="sp__bar"><i></i></span>${s.name}</li>`).join('')}</ol>
      <div class="sp__formula">
        ${STAGES.map((s, i) => `<div class="sp__f" data-i="${i}"><p class="sp__math">${s.formula}</p><p class="sp__note">${s.note}</p></div>`).join('')}
      </div>
    </div>`;
  const plot = el('svg', { class: 'sp__plot', viewBox: '0 0 686 583', 'aria-hidden': 'true' });
  body.querySelector('.sp').append(plot);

  // Axes (shared) + x ticks.
  const axes = el('g', { class: 'sp__axes' }, plot);
  el('path', { d: `M${P.x} ${P.y - 6}V${P.y + P.h}H${P.x + P.w + 6}`, class: 'sp__axis' }, axes);
  for (let s = 0; s <= SECS; s += 2) {
    const x = P.x + (s / SECS) * P.w;
    el('path', { d: `M${x} ${P.y + P.h}v5`, class: 'sp__axis' }, axes);
    el('text', { x, y: P.y + P.h + 21, class: 'sp__tick', 'text-anchor': 'middle' }, axes).textContent = s;
  }
  el('text', { x: P.x + P.w, y: P.y + P.h + 40, class: 'sp__unit', 'text-anchor': 'end' }, axes).textContent = 'time (s)';

  // Per-stage y ticks, grid, y-axis unit, legend.
  const stageGroups = STAGES.map((s, i) => {
    const g = el('g', { class: 'sp__stage', 'data-i': i }, plot);
    tickY[i].forEach(([y, label]) => {
      el('path', { d: `M${P.x} ${y}H${P.x + P.w}`, class: 'sp__grid' }, g);
      el('text', { x: P.x - 10, y: y + 4, class: 'sp__tick', 'text-anchor': 'end' }, g).textContent = label;
    });
    el('text', { x: 0, y: 0, class: 'sp__unit', 'text-anchor': 'middle', transform: `translate(${P.x - 52} ${P.y + P.h / 2}) rotate(-90)` }, g).textContent = s.unit;
    let lx = P.x + P.w;
    [...LEGENDS[i]].reverse().forEach(([label, col]) => {
      const t = el('text', { x: lx, y: P.y - 14, class: 'sp__legend', 'text-anchor': 'end' }, g);
      t.textContent = label;
      const w = 7.4 * label.length + 4;
      el('path', { d: `M${lx - w - 18} ${P.y - 18.5}h13`, stroke: col, class: 'sp__key' }, g);
      lx -= w + 30;
    });
    return g;
  });

  // Annotations.
  const m = motionX(R.MOTION_AT[0]);
  const ann = stageGroups;
  // Stage 0/1: motion artefact (lane band) and drift.
  [0, 1].forEach((i) => {
    el('rect', { x: m - 22, y: P.y + 2, width: 56, height: P.h - 4, rx: 8, class: 'sp__band' }, ann[i]);
    el('text', { x: m + 6, y: P.y + P.h - 10, class: 'sp__ann', 'text-anchor': 'middle' }, ann[i]).textContent = 'motion';
  });
  el('text', { x: P.x + P.w - 4, y: P.y + 0.17 * P.h - 26, class: 'sp__ann', 'text-anchor': 'end' }, ann[0]).textContent = 'illumination drift ↗';
  // Stage 2: motion cancelled.
  el('rect', { x: m - 22, y: P.y + 2, width: 56, height: P.h - 4, rx: 8, class: 'sp__band sp__band--ok' }, ann[2]);
  el('text', { x: m + 6, y: P.y + P.h - 10, class: 'sp__ann sp__ann--ok', 'text-anchor': 'middle' }, ann[2]).textContent = 'cancelled';
  // Stage 3: |H(f)| inset.
  buildInset(ann[3]);
  // Stage 4: peaks + one period bracket.
  const pk = R.findPeaks(V(D.bvp));
  pk.forEach((i) => el('circle', { cx: xs[i], cy: Y.bvp[i], r: 3.6, class: 'sp__peak' }, ann[4]));
  const [a, b] = [pk[5], pk[6]];
  const yb = Math.min(Y.bvp[a], Y.bvp[b]) - 16;
  el('path', { d: `M${xs[a]} ${yb + 6}V${yb}H${xs[b]}V${yb + 6}`, class: 'sp__bracket' }, ann[4]);
  el('text', { x: (xs[a] + xs[b]) / 2, y: yb - 7, class: 'sp__ann sp__ann--ok', 'text-anchor': 'middle' }, ann[4]).textContent =
    `T = ${((b - a) / R.FS).toFixed(2)} s`;

  // The three lines + the draw-on clip.
  const clip = el('clipPath', { id: 'sp-clip' }, el('defs', {}, plot));
  const clipRect = el('rect', { x: P.x - 4, y: P.y - 40, width: 0, height: P.h + 80 }, clip);
  const lg = el('g', { 'clip-path': 'url(#sp-clip)' }, plot);
  const order = [0, 2, 1]; // G / S on top
  const lines = [];
  order.forEach((i) => (lines[i] = el('path', { class: 'sp__line' }, lg)));
  // Stage 4 sits on top of the lines (peaks).
  plot.append(stageGroups[4]);

  return {
    plot, lines, clipRect, stageGroups,
    titles: [...body.querySelectorAll('.sp__title')],
    track: [...body.querySelectorAll('.sp__track li')],
    formulas: [...body.querySelectorAll('.sp__f')],
  };
}

function buildInset(g) {
  // Top-right of the panel header (free space beside the stage title).
  const B = { x: 470, y: 22, w: 168, h: 36 };
  el('rect', { x: B.x - 10, y: B.y - 6, width: B.w + 20, height: B.h + 26, rx: 10, class: 'sp__inset' }, g);
  const fx = (f) => B.x + (f / 6) * B.w;
  el('rect', { x: fx(R.BAND[0]), y: B.y, width: fx(R.BAND[1]) - fx(R.BAND[0]), height: B.h, class: 'sp__pass' }, g);
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const f = (i / 120) * 6;
    d += `${i ? 'L' : 'M'}${fx(f).toFixed(1)} ${(B.y + B.h - R.bandpassGain(f) * (B.h - 6)).toFixed(1)}`;
  }
  el('path', { d: `M${B.x} ${B.y + B.h}H${B.x + B.w}`, class: 'sp__axis' }, g);
  el('path', { d, class: 'sp__resp' }, g);
  [[R.BAND[0], '0.7'], [R.BAND[1], '4'], [6, '6 Hz']].forEach(([f, l]) =>
    (el('text', { x: fx(f), y: B.y + B.h + 14, class: 'sp__tick sp__tick--s', 'text-anchor': 'middle' }, g).textContent = l));
  el('text', { x: B.x, y: B.y + 8, class: 'sp__tick sp__tick--s' }, g).textContent = '|H(f)|';
  // Where the heart and the breath sit.
  el('path', { d: `M${fx(R.HR_HZ)} ${B.y + 2}V${B.y + B.h}`, class: 'sp__mark' }, g);
  el('path', { d: `M${fx(R.RESP_HZ)} ${B.y + 2}V${B.y + B.h}`, class: 'sp__mark sp__mark--off' }, g);
}

// Centrelines of the D17 curves (the SVG draws them as outlined fills).
const CURVE_PATHS = {
  r: 'M579.5 602C586 599 604 584 626 536C646 486 662 455 688 448',
  g: 'M580.5 630C592 629 613 622 630.5 601.5C653 575 669 554 688 554',
  b: 'M584 651.5L688 651',
};

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene', 'scene--light');

  // Desktop: both boxes contain-fit like the UI, so they line up with the
  // frame. Mobile: the diagram row sits under the copy, the panel below it.
  const diagram = h(`
    <div class="fbox diagram" id="diagram" data-fit="contain" data-m-fit="focus" data-m-focus="-28 440 718 300" data-m-target="0.02 0.27 0.96 0.2">
      ${svg('rgb-d17.svg', 'class="overlay rgb"')}
      <p class="rgb-label">RGB channels<br>Derived from facial scan</p>
    </div>`);
  const panel = h(`
    <div class="fbox panel-box" data-fit="contain" data-m-fit="focus" data-m-focus="689 178 686 583" data-m-target="0.03 0.475 0.94 0.42">
      <div class="panel" id="calc-panel"><div class="panel__body"></div></div>
    </div>`);
  // The arrows enter from off-canvas: extend their shafts far to the left so
  // they still reach the screen edge when the box is narrower than the screen.
  diagram.querySelector('[data-id="arrows"]').insertAdjacentHTML('afterbegin', `
    <g data-id="arrow-tails" fill="#F59E0B">
      <rect x="-1500" y="582.54" width="1490" height="9.1" />
      <rect x="-1500" y="669.54" width="1490" height="9.1" />
    </g>`);
  const copy = copyBlock({ head: ['Step 4:', 'Clean noises'] });
  layer.append(diagram, panel, uiBox(copy));

  const win = sceneWindow(tl, ctx.scene.id);
  const winCalc = sceneWindow(tl, 's8-calc');
  hold(tl, ctx, layer, { ...win, to: winCalc.to });
  hold(tl, ctx, copy, win);

  // ---------- signal panel ----------
  const ui = buildPanel(panel.querySelector('.panel__body'));

  // Channel pulses along the curves + cells lighting up.
  const rgb = diagram.querySelector('svg.rgb');
  const pulseG = el('g', { class: 'rgb-pulses' }, rgb);
  const pulses = Object.entries(CURVE_PATHS).map(([c, d], i) => {
    const path = el('path', { d, fill: 'none', stroke: 'none' }, pulseG);
    const dot = el('circle', { r: 7, class: `rgb-pulse rgb-pulse--${c}` }, pulseG);
    return { path, dot, len: path.getTotalLength(), i };
  });
  const rows = ['r', 'g', 'b'].map((c) => [...diagram.querySelectorAll(`[data-id="cells-${c}"] rect`)]);

  const st = { f: ctx.reduced ? 1 : 0 };
  const render = () => {
    const f = st.f;
    const k = stageOf(f);
    const i0 = Math.min(3, Math.floor(k));
    const u = k - i0;

    // Lines: data, colour, width, opacity interpolated between stages.
    ui.lines.forEach((line, li) => {
      const A = LINES[li][i0];
      const B = LINES[li][i0 + 1];
      let d = '';
      for (let i = 0; i < N; i++) d += `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${lerp(A[0][i], B[0][i], u).toFixed(1)}`;
      line.setAttribute('d', d);
      line.setAttribute('stroke', gsap.utils.interpolate(A[1], B[1], u));
      line.setAttribute('stroke-width', lerp(A[2], B[2], u).toFixed(2));
      line.setAttribute('opacity', lerp(A[3], B[3], u).toFixed(3));
    });
    // Draw-on (left → right) of the raw traces.
    ui.clipRect.setAttribute('width', (P.w + 8) * smooth(span(f, 0.06, 0.17)));

    // Per-stage chrome: the outgoing stage fades out over the first half of
    // a morph and the incoming one in over the second, so text never overlaps.
    const show = (i) => clamp01(1 - 2 * Math.abs(k - i));
    const intro = span(f, 0.04, 0.12);
    ui.stageGroups.forEach((g, i) => g.setAttribute('opacity', (show(i) * (i === 0 ? intro : 1)).toFixed(3)));
    ui.titles.forEach((t, i) => {
      t.style.opacity = (show(i) * (i === 0 ? intro : 1)).toFixed(3);
      t.style.transform = `translateY(${((i - k) * 14).toFixed(2)}px)`;
    });
    ui.formulas.forEach((t, i) => {
      t.style.opacity = (show(i) * (i === 0 ? span(f, 0.12, 0.18) : 1)).toFixed(3);
      t.style.transform = `translateY(${((i - k) * 10).toFixed(2)}px)`;
    });
    ui.track.forEach((li, i) => {
      const fill = i === 0 ? span(f, 0.06, 0.17) : clamp01(k - i + 1);
      li.style.setProperty('--fill', fill.toFixed(3));
      li.classList.toggle('is-on', k > i - 0.5 && (i === 0 ? f > 0.06 : true));
    });
    ui.plot.querySelector('.sp__axes').setAttribute('opacity', intro.toFixed(3));

    // Cells: row by row, left → right, a quick bright pop.
    rows.forEach((cells, r) => cells.forEach((cell, c) => {
      const p = span(f, 0.005 + r * 0.025 + c * 0.006, 0.035 + r * 0.025 + c * 0.006);
      const s = 1 + 0.22 * Math.sin(Math.PI * p);
      cell.setAttribute('transform', s === 1 ? '' : `translate(${(+cell.getAttribute('x') + 12) * (1 - s)} ${(+cell.getAttribute('y') + 12) * (1 - s)}) scale(${s})`);
      cell.style.filter = p > 0 && p < 1 ? `brightness(${(1 + 0.45 * Math.sin(Math.PI * p)).toFixed(3)})` : '';
    }));
    // One pulse per channel runs along its curve into the panel.
    pulses.forEach(({ path, dot, len, i }) => {
      const p = span(f, 0.02 + i * 0.012, 0.1 + i * 0.012);
      const pt = path.getPointAtLength(len * gsap.parseEase('power1.in')(p));
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('opacity', (Math.sin(Math.PI * p) ** 0.5).toFixed(3));
    });
  };

  if (ctx.reduced) {
    render();
    return;
  }
  tl.fromTo(st, { f: 0 }, { f: 1, duration: ctx.duration, ease: 'none', onUpdate: render, onStart: render }, ctx.start);
  render();
}
