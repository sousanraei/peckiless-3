// T5 Wave → vital signs (D18 → D19). The measured signals leave the Step 5
// panel and become the D19 card charts; the diagram dissolves while photo E
// fades in, the cards settle, the icon loops come back on.
//
// Morphs (this layer, stage px). Each one is a polyline with the same point
// count at both ends, so a wave is never cut or swapped: at f = 0 it lies
// exactly on S8's path (same samples, stroke, colour), at its window end
// exactly on the card chart, which then takes over in a short crossfade.
//   BVP (block A)          → heart-rate trace (the right end leads, so the
//                            pulse wave reads as running out of the panel)
//   respiration envelope   → breathing-rate wave
//   SpO₂ R trace           → blood-oxygen step line
//   9 of the 16 HRV bars   → the 9 glucose bars (line → wide butt line)
//   PSD / B trace          → systolic / diastolic blood-pressure bars
// Source points come from S8's svg (its root CTM; nothing animated sits on
// those paths' ancestors at the end of S8), target points from the chart
// SVGs' own geometry mapped through each chart <img>'s box. Geometry is
// measured lazily (fit.js places the boxes after link()) and again on resize.
//
// Segment fractions:
//   0          S8's source paths hide under their copies
//   0–0.2      S8 headline wipes out, sub-headline + pills fade
//   0.04–0.3   diagram and panel fade
//   0.12–0.5   photo E (and the finale background) fades in
//   0.06–0.78  morphs, staggered by 0.04; each card fades in just before its
//              chart lands, its icon glyph pops, chart crossfades over 0.06
//   0.5–0.8    S9 headline wipes in, sub-headline follows
//   0.7 →      icon loops run (to the end of the film)
// Reduced motion: nothing (static D18 → D19).
import { h, svg, preloadSVG } from '../lib/dom.js';
import { CARDS } from '../lib/ui.js';
import { hold } from '../lib/static.js';
import { ambient } from '../lib/ambient.js';
import { iconLoops } from '../lib/loops.js';
import { headLines, wipeOut, wipeIn } from '../lib/wipe.js';

const { gsap } = window;

await preloadSVG(...CARDS.map((c) => `chart-${c.name}.svg`));

const NS = 'http://www.w3.org/2000/svg';
const CHART = '#ce73a8';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (v, a, b) => clamp01((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = gsap.parseEase('power2.inOut');
const nums = (d) => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
const pairs = (a) => a.reduce((o, v, i) => (i % 2 ? o[o.length - 1].push(v) : o.push([v]), o), []);

// ---------- Chart geometry (D19 frame px, as in the chart SVGs) ----------

// viewBox size and the frame → chart-local offset of each chart SVG.
const CH = Object.fromEntries(CARDS.map(({ name }) => {
  const el = h(svg(`chart-${name}.svg`));
  const vb = el.getAttribute('viewBox').split(/\s+/).map(Number);
  const off = nums(el.querySelector('g[transform]').getAttribute('transform'));
  return [name, { vb: [vb[2], vb[3]], off, el }];
}));

// Heart rate: the ECG polyline (M/H/L only), clipped to its window.
const HR_WIN = [1096, 1297];
const ECG = (() => {
  const d = CH['heart-rate'].el.querySelector('path').getAttribute('d');
  const pts = [];
  let x = 0;
  let y = 0;
  for (const [, c, args] of d.matchAll(/([MLH])([^MLH]*)/g)) {
    const n = nums(args);
    if (c === 'H') n.forEach((v) => pts.push([(x = v), y]));
    else pairs(n).forEach(([a, b]) => pts.push([(x = a), (y = b)]));
  }
  return pts;
})();
const yOn = (pts, x) => {
  let i = pts.findIndex((p) => p[0] >= x);
  if (i <= 0) return pts[Math.max(0, i)][1];
  const [a, b] = [pts[i - 1], pts[i]];
  return b[0] === a[0] ? b[1] : lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
};
function ecgTarget() {
  const [x0, x1] = HR_WIN;
  const xs = new Set();
  for (let i = 0; i <= 300; i++) xs.add(+lerp(x0, x1, i / 300).toFixed(3));
  ECG.forEach(([x]) => x > x0 && x < x1 && xs.add(x));
  return [...xs].sort((a, b) => a - b).map((x) => [x, yOn(ECG, x)]);
}

// Breathing rate: half-period cubics with evenly spaced control x, so x is
// linear in t and y = c ∓ 3·a·t(1 − t) exactly.
const BR = { x0: 528.615, x1: 787.385, half: 24.0595, c: 504.825, a: 9.624 };
function breathTarget(n) {
  return Array.from({ length: n }, (_, i) => {
    const x = lerp(BR.x0, BR.x1, i / (n - 1));
    const k = (x - BR.x0) / BR.half;
    const seg = Math.floor(k);
    const t = k - seg;
    return [x, BR.c + (seg % 2 ? 1 : -1) * 3 * BR.a * t * (1 - t)];
  });
}

// Blood oxygen: the step line drawn as 2.41px rects → its centreline.
const O2 = [[362.842, 681.359], [392.916, 681.359], [392.916, 685.368], [421.787, 685.368], [421.787, 668.527],
  [450.659, 668.527], [450.659, 662.913], [479.53, 662.913], [479.53, 655.695], [508.401, 655.695],
  [508.401, 681.359], [537.272, 681.359], [537.272, 662.913], [566.144, 662.913], [566.144, 670.933],
  [595.015, 670.933], [595.015, 681.359], [617.069, 681.359]];
const O2_W = 2.406;

// Blood pressure: pink fills (round ends, 4.81 tall) of the two bars.
const BP = [{ y: 753.708, x: [1140.41, 1328.07] }, { y: 781.331, x: [1140.41, 1259.1] }];
const BP_W = 4.812;

// Glucose: bars as [x, y, w, h] from the chart's rects.
const GLU = [...CH.glucose.el.querySelectorAll('rect')].map((r) => ['x', 'y', 'width', 'height'].map((k) => +r.getAttribute(k)));

// ---------- Polyline helpers ----------

// n points evenly by arc length.
function byLength(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum.at(-1);
  let j = 1;
  return Array.from({ length: n }, (_, i) => {
    const s = (L * i) / (n - 1);
    while (j < pts.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    return [lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)];
  });
}
// Samples a function-of-x polyline at fractions us of its x range.
const byX = (pts, us) => {
  const x0 = pts[0][0];
  const x1 = pts.at(-1)[0];
  return us.map((u) => {
    const x = lerp(x0, x1, u);
    return [x, yOn(pts, x)];
  });
};
const fracsOf = (pts) => pts.map(([x]) => (x - pts[0][0]) / (pts.at(-1)[0] - pts[0][0]));
const evenly = (n) => Array.from({ length: n }, (_, i) => i / (n - 1));
const fmt = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
const dOf = (pts) => `M${pts.map(fmt).join('L')}`;

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('vitals');
  if (reduced) return;
  layer.append(h('<svg class="vitals__svg" aria-hidden="true" fill="none" stroke-linejoin="round"></svg>'));
}

// Runs after every layer exists: drives S7's, S8's, S9's and the pills' elements.
export function link(tl, ctx) {
  const { layer, stage, reduced } = ctx;
  if (reduced) return;
  const d = ctx.duration;
  const S = ctx.start;
  const E = S + d;
  const p = (f) => S + f * d;

  const s7 = stage.querySelector('.layer--s7-clean');
  const s8 = stage.querySelector('.layer--s8-calc');
  const s9 = stage.querySelector('.layer--s9-finale');
  const calc = stage.querySelector('#calc-panel svg.calc'); // S8's drawing
  const q = (sel) => calc.querySelector(sel);
  const cardEl = (name) => s9.querySelector(`.card--${name}`);
  const over = layer.querySelector('.vitals__svg');

  // Above every layer (the morphs fly over photo E and the cards).
  stage.append(layer);
  hold(tl, ctx, layer, { from: S, to: E });

  // ---------- Morph definitions ----------
  // src: () => points in calc user space; tgt: chart-frame points; el: S8 path.
  const hrvLines = [...calc.querySelectorAll('.calc__bars line')];
  const pick = GLU.map((_, k) => hrvLines[Math.round((k * (hrvLines.length - 1)) / (GLU.length - 1))]);
  const ECG_T = ecgTarget();
  const lines = [
    { card: 'heart-rate', el: q('.calc__bvp'), at: 0.06, lead: true,
      src: (el) => byX(pairs(nums(el.getAttribute('d'))), fracsOf(ECG_T)), tgt: () => ECG_T, w: 1.7454 },
    { card: 'breathing-rate', el: q('.calc__env'), at: 0.1,
      src: (el) => sampleLen(el, 160), tgt: () => breathTarget(160), w: 2.08515 },
    { card: 'blood-oxygen', el: q('.calc__ch--r'), at: 0.14,
      src: (el) => byX(pairs(nums(el.getAttribute('d'))), evenly(160)), tgt: () => byLength(O2, 160), w: O2_W, cap: 'butt' },
    { card: 'blood-pressure', el: q('.calc__psd'), at: 0.22,
      src: (el) => byX(pairs(nums(el.getAttribute('d'))), evenly(120)),
      tgt: () => evenly(120).map((u) => [lerp(BP[0].x[0], BP[0].x[1], u), BP[0].y]), w: BP_W },
    { card: 'blood-pressure', el: q('.calc__ch--b'), at: 0.24,
      src: (el) => byX(pairs(nums(el.getAttribute('d'))), evenly(120)),
      tgt: () => evenly(120).map((u) => [lerp(BP[1].x[0], BP[1].x[1], u), BP[1].y]), w: BP_W },
  ];
  const bars = pick.map((el, k) => ({ card: 'glucose', el, at: 0.18 + k * 0.006, rect: GLU[k] }));
  const WIN = 0.54; // each morph's length (fraction of the segment)
  const FADE = 0.06; // overlay → chart crossfade
  const all = [...lines, ...bars];
  all.forEach((m) => {
    m.path = document.createElementNS(NS, 'path');
    over.append(m.path);
  });

  function sampleLen(el, n) {
    const L = el.getTotalLength();
    return evenly(n).map((u) => {
      const pt = el.getPointAtLength(u * L);
      return [pt.x, pt.y];
    });
  }

  // ---------- Geometry (stage px) ----------
  let geo = null;
  function measure() {
    const st = stage.getBoundingClientRect();
    const M = calc.getScreenCTM();
    if (!M || !st.width) return null;
    const k = Math.hypot(M.a, M.b);
    const src = (pt) => [M.a * pt[0] + M.c * pt[1] + M.e - st.left, M.b * pt[0] + M.d * pt[1] + M.f - st.top];
    const charts = {};
    CARDS.forEach(({ name }) => {
      const card = cardEl(name);
      const keep = card.style.transform;
      card.style.transform = 'none'; // measure the settled card
      const r = card.querySelector('.card__chart').getBoundingClientRect();
      card.style.transform = keep;
      const { vb, off } = CH[name];
      const s = Math.min(r.width / vb[0], r.height / vb[1]);
      const ox = r.left + (r.width - vb[0] * s) / 2 - st.left;
      const oy = r.top + (r.height - vb[1] * s) / 2 - st.top;
      charts[name] = { s, map: ([x, y]) => [ox + (x + off[0]) * s, oy + (y + off[1]) * s] };
    });
    const style = (el) => {
      const cs = getComputedStyle(el);
      const sw = parseFloat(cs.strokeWidth) || 1;
      return {
        color: cs.stroke,
        alpha: parseFloat(cs.strokeOpacity) || 1,
        width: cs.vectorEffect === 'non-scaling-stroke' ? sw : sw * k,
        cap: cs.strokeLinecap,
      };
    };
    const out = new Map();
    lines.forEach((m) => {
      const c = charts[m.card];
      const a = m.src(m.el).map(src);
      const b = m.tgt().map(c.map);
      const us = fracsOf(m.tgt());
      out.set(m, { a, b, us, from: style(m.el), w1: m.w * c.s });
    });
    bars.forEach((m) => {
      const c = charts.glucose;
      const x = +m.el.getAttribute('x1');
      const a = [src([x, +m.el.getAttribute('y1')]), src([x, +m.el.dataset.y2])];
      const [rx, ry, rw, rh] = m.rect;
      const b = [c.map([rx + rw / 2, ry + rh]), c.map([rx + rw / 2, ry])];
      out.set(m, { a, b, us: [0, 1], from: style(m.el), w1: rw * c.s });
    });
    return out;
  }

  // ---------- Render (pure function of f) ----------
  const st = { f: 0 };
  const color = new Map();
  function render() {
    const f = st.f;
    if (!geo) geo = measure();
    if (!geo) return;
    all.forEach((m) => {
      const g = geo.get(m);
      const t = span(f, m.at, m.at + WIN);
      const e = ease(t);
      // Lead: the right end moves first (the wave runs out of the panel).
      // Bars move as one piece.
      const lag = m.rect ? 0 : m.lead ? 0.35 : 0.2;
      const pts = g.a.map((pa, i) => {
        const u = m.lead ? 1 - g.us[i] : g.us[i];
        const ti = ease(span(t, lag * u, lag * u + 1 - lag));
        return [lerp(pa[0], g.b[i][0], ti), lerp(pa[1], g.b[i][1], ti)];
      });
      if (!color.has(m)) color.set(m, gsap.utils.interpolate(g.from.color, CHART));
      const out = span(f, m.at + WIN, m.at + WIN + FADE);
      m.path.setAttribute('d', dOf(pts));
      m.path.setAttribute('stroke', color.get(m)(e));
      // Strokes keep their weight in flight and take the chart's on landing.
      m.path.setAttribute('stroke-width', lerp(g.from.width, g.w1, ease(span(t, 0.6, 1))).toFixed(3));
      m.path.setAttribute('stroke-opacity', lerp(g.from.alpha, 1, e).toFixed(3));
      m.path.setAttribute('stroke-linecap', e < 0.5 ? g.from.cap : m.cap || (m.rect ? 'butt' : 'round'));
      m.path.style.opacity = (1 - out).toFixed(3);
    });
  }
  tl.fromTo(st, { f: 0 }, { f: 1, duration: d, ease: 'none', onUpdate: render, immediateRender: false }, S);
  const onResize = () => requestAnimationFrame(() => {
    geo = null;
    if (tl.time() >= S && tl.time() <= E) render();
  });
  window.addEventListener('resize', onResize);
  ctx.onCleanup(() => window.removeEventListener('resize', onResize));

  // S8's sources hide under their copies for the whole segment.
  const sources = all.map((m) => m.el);
  tl.set(sources, { opacity: 0 }, S);

  // ---------- D18 out ----------
  wipeOut(tl, headLines(s8), p(0), { duration: 0.2 * d, stagger: 0.04 * d });
  const fadeOut = (els, a, b, ease = 'power1.in') =>
    tl.fromTo(els, { opacity: 1 }, { opacity: 0, duration: (b - a) * d, ease, immediateRender: false }, p(a));
  fadeOut(s8.querySelector('.copy__sub'), 0, 0.16);
  fadeOut(stage.querySelector('#pills'), 0.04, 0.2);
  fadeOut([s7.querySelector('#diagram'), s7.querySelector('.panel-box')], 0.04, 0.3, 'power1.inOut');

  // ---------- D19 in ----------
  // S9 shows from the segment start: its background and photo fade in over
  // S7's white, everything else enters below.
  tl.set(s9, { autoAlpha: 1 }, S);
  const dissolve = { duration: 0.38 * d, ease: 'power1.inOut' };
  tl.fromTo(s9, { '--bga': 0 }, { '--bga': 1, ...dissolve }, p(0.12));
  tl.fromTo(s9.querySelector('.photo'), { opacity: 0 }, { opacity: 1, ...dissolve }, p(0.12));

  wipeIn(tl, headLines(s9), p(0.5), { duration: 0.22 * d, stagger: 0.05 * d });
  tl.fromTo(s9.querySelector('.copy__sub'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.18 * d, ease: 'power2.out' }, p(0.62));

  // Cards: each settles just before its chart lands; the chart image takes
  // over from the morph in a crossfade.
  CARDS.forEach(({ name }) => {
    const card = cardEl(name);
    const land = Math.max(...all.filter((m) => m.card === name).map((m) => m.at)) + WIN;
    tl.fromTo(card, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.18 * d, ease: 'power2.out' }, p(land - 0.24));
    tl.fromTo(card.querySelector('.icon__glyph'), { scale: 0.3, rotation: -25, autoAlpha: 0 },
      { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.14 * d, ease: 'back.out(2.2)' }, p(land - 0.16));
    tl.fromTo(card.querySelector('.card__chart'), { opacity: 0 }, { opacity: 1, duration: FADE * d, ease: 'none' }, p(land));
  });

  ambient(tl, ctx, p(0.7), tl.labels.end, iconLoops(s9.querySelectorAll('.card .icon')));
}
