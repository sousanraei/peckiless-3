// T4 Follow the light beams (D16 → D17). The two beams that leave the skin
// (specular reflection + "vessels reflect light") are parallel in D16 (both
// at −35.9°), so a camera that follows them up and to the right and rolls
// +35.9° levels them into the two D17 arrows feeding the RGB box. The beams
// are never cut or swapped mid-way: from the first frame of the segment one
// pair of stroked paths (this layer, screen px) carries them all the way.
//
// Each beam = a 2-point shaft (light direction) + a 3-point chevron
// (arm, tip, arm), the same point count at both ends. Its points are the D16
// points carried by the camera C(u), plus a residual blended in:
//   P(u) = C(u)·p16 + w(u)·(P17 − F·p16)        F = C(1)
// so at u = 0 they are exactly S6's beams and at u = 1 exactly the D17
// arrows (shaft from off-screen left to the box, chevron at x ≈ 222).
// C(u) interpolates scale exponentially and angle linearly, while the pivot
// (the midpoint between the two chevron tips) travels in a straight line on
// screen from its D16 spot to the arrows' chevrons. The skin rides the same
// camera (S6's photo content is wrapped in .beams-cam) and fades out.
//
// Segment fractions:
//   0–0.12     beam labels fade
//   0–0.25     S6 headline wipes out (eyebrow + sub are identical in D16/D17)
//   0.04–0.9   camera (sine.inOut); residual w ramps in over u 0.1–0.95
//   0.12–0.45  skin, vessels, pulses and the other light paths fade out
//   0.5        static cut S6 → S7 (white on white; the beams live here)
//   0.55–0.82  S7 headline wipes in
//   0.56–0.86  RGB box draws on; cells, curves, label, panel fade in
//   0.9–0.97   S7's own arrows fade in on top of the (identical) moving
//              beams; this layer hides at the segment end
//
// Layering: this layer sits between S6 and S7. S7 drops its background while
// the segment runs (data-beams="on"), so the beams stay visible under its
// diagram; .fly__bg paints the white behind them once S6 is gone (from 0.5).
// Reduced motion: nothing (static D16 → D17 cut).
import { h } from '../lib/dom.js';
import { hold } from '../lib/static.js';
import { headLines, wipeOut, wipeIn } from '../lib/wipe.js';

const { gsap } = window;

const NS = 'http://www.w3.org/2000/svg';

// D16 (S6 photo frame px): shaft [from, to] in light direction, chevron
// [arm, tip, arm] (beams-d16.svg; the chevron's midpoint is collinear).
const D16 = [
  { shaft: [[735.912, 475.859], [1462, -49.9922]], head: [[869.293, 420.672], [872.782, 374.383], [826.493, 370.893]] },
  { shaft: [[1149.85, 473.109], [1448.24, 257.63]], head: [[1308.83, 399.961], [1314.97, 353.948], [1268.95, 347.81]] },
];
// D17 (#diagram frame px): centrelines of the outlined arrows in rgb-d17.svg
// (shaft 9.1 wide from off-canvas to the box edge at 352; arms 8 wide, their
// round ends centred where the outline's end caps are). Arm order matches
// D16's: the arm below the shaft first.
const D17 = [
  { y: 587.09, head: [[200.12, 610.4], [221.8, 587.09], [198.22, 565.18]] },
  { y: 674.09, head: [[199.56, 696.96], [221.3, 674.09], [197.66, 651.75]] },
];
const SHAFT_END = 352;
const STROKE16 = 10;
const STROKE17 = { shaft: 9.1, head: 8 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (v, a, b) => clamp01((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = gsap.parseEase('sine.inOut');
const easeW = gsap.parseEase('power2.inOut');

// fit.js writes `translate(Xpx, Ypx) scale(S)` on every frame box.
function fitOf(el) {
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(el.style.transform);
  return m ? { x: +m[1], y: +m[2], s: +m[3] } : { x: 0, y: 0, s: 1 };
}
const apply = (f, [x, y]) => [f.x + f.s * x, f.y + f.s * y];

// Similarity p → a·p + b with a = s·e^{iφ} (complex numbers as [re, im]).
const sim = (s, phi, b) => ({ s, phi, c: s * Math.cos(phi), d: s * Math.sin(phi), b });
const map = (m, [x, y]) => [m.c * x - m.d * y + m.b[0], m.d * x + m.c * y + m.b[1]];

// Beam geometry in D16 frame px: unit light direction, the unit normal
// pointing from the specular beam to the other one, and their separation.
const dir = (() => {
  const v = D16.map(({ shaft: [a, b] }) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return [dx / l, dy / l];
  });
  const m = [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2];
  const l = Math.hypot(...m);
  return [m[0] / l, m[1] / l];
})();
const PHI = -Math.atan2(dir[1], dir[0]); // roll that levels the beams (+35.9°)
const NORMAL = [-dir[1], dir[0]];
const O = D16[0].shaft[0];
const along = (p) => (p[0] - O[0]) * dir[0] + (p[1] - O[1]) * dir[1];
const across = (p) => (p[0] - O[0]) * NORMAL[0] + (p[1] - O[1]) * NORMAL[1];
const SEP = across(D16[1].shaft[0]); // ≈ 240.6
const K = (D17[1].y - D17[0].y) / SEP; // D17 / D16 size ratio ≈ 0.36
// Pivot: midpoint between the two chevron tips (along), midway across.
const S0 = (along(D16[0].head[1]) + along(D16[1].head[1])) / 2;
const PIVOT = [O[0] + S0 * dir[0] + (SEP / 2) * NORMAL[0], O[1] + S0 * dir[1] + (SEP / 2) * NORMAL[1]];
const PIVOT17 = [(D17[0].head[1][0] + D17[1].head[1][0]) / 2, (D17[0].y + D17[1].y) / 2];

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('fly');
  if (reduced) return;
  const beams = D16.map((_, i) => `
    <g class="fly__beam" data-beam="${i}">
      <path class="fly__shaft"/>
      <path class="fly__head"/>
    </g>`).join('');
  layer.append(h('<div class="fly__bg" aria-hidden="true"></div>'));
  layer.append(h(`<svg class="fly__svg" aria-hidden="true" fill="none" stroke="#F59E0B">${beams}</svg>`));
}

// Runs after every layer exists: drives S6's and S7's elements.
export function link(tl, ctx) {
  const { layer, stage, reduced } = ctx;
  if (reduced) return;
  const d = ctx.duration;
  const S = ctx.start;
  const E = S + d;
  const p = (f) => S + f * d;

  const s6 = stage.querySelector('.layer--s6-vessels');
  const s7 = stage.querySelector('.layer--s7-clean');
  const photo6 = s6.querySelector('.photo');
  const diagram = s7.querySelector('#diagram');

  hold(tl, ctx, layer, { from: S, to: E });
  [s6, s7].forEach((l) => {
    gsap.set(l, { attr: { 'data-beams': 'off' } });
    tl.set(l, { attr: { 'data-beams': 'on' } }, S);
    tl.set(l, { attr: { 'data-beams': 'off' } }, E);
  });
  const bg = layer.querySelector('.fly__bg');
  gsap.set(bg, { autoAlpha: 0 });
  tl.set(bg, { autoAlpha: 1 }, p(0.5));

  // ---------- Copy ----------
  wipeOut(tl, headLines(s6), p(0), { duration: 0.2 * d, stagger: 0.04 * d });
  wipeIn(tl, headLines(s7), p(0.55), { duration: 0.22 * d, stagger: 0.05 * d });

  // ---------- Skin: rides the camera, fades out ----------
  // Wrap S6's photo content so the camera can move it without touching the
  // frame box (fit.js owns its transform) or the rise translate (t3-skin).
  const cam = document.createElement('div');
  cam.className = 'beams-cam';
  cam.append(...photo6.childNodes);
  photo6.append(cam);
  const labels = photo6.querySelectorAll('.beam-label');
  tl.fromTo(labels, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.12 * d, immediateRender: false }, p(0));
  tl.fromTo(cam, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.33 * d, ease: 'power1.in', immediateRender: false }, p(0.12));

  // ---------- S7 diagram + panel arrive ----------
  const q = (id) => diagram.querySelector(`[data-id="${id}"]`);
  const arrows = q('arrows');
  const box = q('rgb-box');
  const rest = [q('cells'), q('curves'), diagram.querySelector('.rgb-label'), s7.querySelector('#calc-panel')];
  tl.fromTo(box, { drawSVG: '0% 0%', opacity: 0 }, { drawSVG: '0% 100%', opacity: 1, duration: 0.3 * d, ease: 'power2.inOut' }, p(0.56));
  tl.fromTo(rest, { opacity: 0 }, { opacity: 1, duration: 0.24 * d, stagger: 0.02 * d, ease: 'power1.out' }, p(0.62));
  tl.fromTo(arrows, { opacity: 0 }, { opacity: 1, duration: 0.07 * d, ease: 'none' }, p(0.9));

  // ---------- The beams ----------
  const fly = [...layer.querySelectorAll('.fly__beam')].map((g) => ({
    shaft: g.querySelector('.fly__shaft'),
    head: g.querySelector('.fly__head'),
  }));
  const st = { f: 0 };
  const fmt = (pt) => `${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`;

  const render = () => {
    const f = st.f;
    const A = fitOf(photo6); // D16 frame → screen
    const D = fitOf(diagram); // D17 frame → screen
    const u = ease(span(f, 0.04, 0.9));
    const w = easeW(span(u, 0.1, 0.95));

    // F: the camera at the end. Levels the beams, scales their separation to
    // the arrows', puts the pivot on the arrows' chevrons.
    const sF = K * D.s;
    const pv17 = apply(D, PIVOT17);
    const F0 = sim(sF, PHI, [0, 0]);
    const fPiv = map(F0, PIVOT);
    const F = sim(sF, PHI, [pv17[0] - fPiv[0], pv17[1] - fPiv[1]]);
    // C(u): exponential scale, linear roll, pivot on a straight screen path.
    const s = A.s * (sF / A.s) ** u;
    const phi = PHI * u;
    const pv16 = apply(A, PIVOT);
    const pv = [lerp(pv16[0], pv17[0], u), lerp(pv16[1], pv17[1], u)];
    const C0 = sim(s, phi, [0, 0]);
    const cPiv = map(C0, PIVOT);
    const C = sim(s, phi, [pv[0] - cPiv[0], pv[1] - cPiv[1]]);

    // Skin wrapper: frame → screen is A ∘ R, so R = A⁻¹ ∘ C.
    cam.style.transform =
      `translate(${((C.b[0] - A.x) / A.s).toFixed(3)}px, ${((C.b[1] - A.y) / A.s).toFixed(3)}px) ` +
      `rotate(${((phi * 180) / Math.PI).toFixed(4)}deg) scale(${(s / A.s).toFixed(5)})`;
    // Feather the skin's right and bottom edges as the roll brings them on
    // screen (none at f = 0, so D16 is untouched).
    const fe = 380 * span(f, 0.02, 0.3);
    cam.style.setProperty('--fe', `${fe.toFixed(1)}px`);
    cam.classList.toggle('is-feathered', fe > 0);

    const left = Math.min(D.x + D.s * -24, -24); // shafts enter from off-screen
    const strokeShaft = lerp(STROKE16 * A.s, STROKE17.shaft * D.s, u);
    const strokeHead = lerp(STROKE16 * A.s, STROKE17.head * D.s, u);
    D16.forEach((b16, i) => {
      const b17 = D17[i];
      const y17 = D.y + D.s * b17.y;
      const shaft17 = [[left, y17], apply(D, [SHAFT_END, b17.y])];
      const head17 = b17.head.map((pt) => apply(D, pt));
      const pt = (p16, p17) => {
        const c = map(C, p16);
        const fp = map(F, p16);
        return [c[0] + w * (p17[0] - fp[0]), c[1] + w * (p17[1] - fp[1])];
      };
      const sh = b16.shaft.map((p16, k) => pt(p16, shaft17[k]));
      // Chevron, in the shaft's own frame (along, across) so it always sits
      // on the shaft: the tip at a fraction of the shaft, the arms at offsets
      // whose screen size eases from D16's to D17's (the camera alone would
      // shrink them to a third mid-way).
      const local = (o, e) => [o[0] * e[0] + o[1] * e[1], -o[0] * e[1] + o[1] * e[0]];
      const unit = ([a, b]) => {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, l];
      };
      const e16 = unit(b16.shaft);
      const e17 = unit(shaft17);
      const frac16 = local([b16.head[1][0] - b16.shaft[0][0], b16.head[1][1] - b16.shaft[0][1]], e16)[0] / e16[2];
      const frac17 = local([head17[1][0] - shaft17[0][0], head17[1][1] - shaft17[0][1]], e17)[0] / e17[2];
      const e = unit(sh);
      const fr = lerp(frac16, frac17, w);
      const tip = [sh[0][0] + fr * (sh[1][0] - sh[0][0]), sh[0][1] + fr * (sh[1][1] - sh[0][1])];
      const hd = [0, 1, 2].map((k) => {
        if (k === 1) return tip;
        const l16 = local([(b16.head[k][0] - b16.head[1][0]) * A.s, (b16.head[k][1] - b16.head[1][1]) * A.s], e16);
        const l17 = local([head17[k][0] - head17[1][0], head17[k][1] - head17[1][1]], e17);
        const a = lerp(l16[0], l17[0], w);
        const c = lerp(l16[1], l17[1], w);
        return [tip[0] + a * e[0] - c * e[1], tip[1] + a * e[1] + c * e[0]];
      });
      fly[i].shaft.setAttribute('d', `M${fmt(sh[0])}L${fmt(sh[1])}`);
      fly[i].head.setAttribute('d', `M${fmt(hd[0])}L${fmt(hd[1])}L${fmt(hd[2])}`);
      fly[i].shaft.setAttribute('stroke-width', strokeShaft.toFixed(3));
      fly[i].head.setAttribute('stroke-width', strokeHead.toFixed(3));
    });
  };

  tl.fromTo(st, { f: 0 }, { f: 1, duration: d, ease: 'none', onUpdate: render, immediateRender: false }, S);
  render();
  const onResize = () => requestAnimationFrame(render);
  window.addEventListener('resize', onResize);
  ctx.onCleanup(() => window.removeEventListener('resize', onResize));
}
