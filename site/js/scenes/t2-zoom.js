// T2 Zoom (D13 → D14). One camera pushes into the viewer-right cheek ROI box.
// The cheek close-up (photo C) is a 7.45× crop of photo B (SIFT match, T7:
// 35 inliers, rotation 0.2°), so both live in ONE world = photo B's frame
// space: C sits inside the camera at the B region it depicts, scaled 1/Z. The
// camera zooms 1 → Z about its fixed point, so the B → C hand-off is a
// feathered reveal inside a single continuous motion: no jump by construction.
// At the end the camera equals S5's photo placement exactly (desktop and
// mobile: the start/end camera are read from the S4/S5 photo boxes' fit).
//
// The small ROI box morphs in world space into the region the D14 big box
// covers, while its screen stroke and corner radius ease 3 → 8 and 9.5 → 28,
// so on screen it grows into #roi-big. The other two boxes fade as they fly
// out. Copy (segment fractions): S4 headline + sub wipe out 0–0.3, the D14
// copy (S5 layer) wipes in 0.6–0.9.
//
// Layering: like t1-turn, this layer sits under every layer for its whole
// segment, and S4/S5 lend it their photo plane (data-zoom="on" hides their
// photo, ROI overlays and background). Reduced motion: hidden.
import { ASSETS } from '../assets.js';
import { h, boxStyle } from '../lib/dom.js';
import { hold } from '../lib/static.js';
import { headLines, wipeOut, wipeIn } from '../lib/wipe.js';

const { gsap } = window;

// Photo C's frame (1440×1024) in photo B's frame space: origin + scale 1/Z.
const O = [816.81, 380.2];
const Z = 7.4464;
const ROI_SMALL = ASSETS.vectors['roi-d13']['roi-cheek-right']; // world px
const ROI_BIG = ASSETS.vectors['roi-d14']['roi-big']; // C frame px
const ROI_BIG_W = [O[0] + ROI_BIG[0] / Z, O[1] + ROI_BIG[1] / Z, ROI_BIG[2] / Z, ROI_BIG[3] / Z];
const STROKE = [3, 8];
const RX = [9.5, 28];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (v, a, b) => clamp01((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = gsap.parseEase('sine.inOut');
const easeBox = gsap.parseEase('power2.inOut');

// fit.js writes `translate(Xpx, Ypx) scale(S)` on every frame box.
function fitOf(el) {
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(el.style.transform);
  return m ? { x: +m[1], y: +m[2], s: +m[3] } : { x: 0, y: 0, s: 1 };
}

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('zoom');
  if (reduced) return;
  const b = ASSETS.photos.front;
  const c = ASSETS.photos.cheek;
  const [sx, sy, sw, sh] = ROI_SMALL;
  const rois = ASSETS.vectors['roi-d13'];
  const others = ['roi-forehead', 'roi-cheek-left']
    .map((id) => {
      const [x, y, w, hh] = rois[id];
      return `<rect class="zoom__other" x="${x}" y="${y}" width="${w}" height="${hh}" rx="9.5" stroke="#44B3A2" stroke-width="3"/>`;
    })
    .join('');
  layer.append(h(`
    <div class="zoom__cam" aria-hidden="true">
      <img class="zoom__b" src="${b.file}" alt="" style="${boxStyle([b.frames[13].left, b.frames[13].top, b.frames[13].width, b.frames[13].height])}">
      <div class="zoom__c" style="left:${O[0]}px;top:${O[1]}px;transform:scale(${1 / Z})">
        <img src="${c.file}" alt="" style="${boxStyle([c.frames[14].left, c.frames[14].top, c.frames[14].width, c.frames[14].height])}">
      </div>
      <svg class="overlay zoom__roi" viewBox="0 0 1440 1024" fill="none">
        ${others}
        <rect class="zoom__box" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="9.5" stroke="#44B3A2" stroke-width="3"/>
      </svg>
    </div>`));
  layer.append(h('<div class="zoom__fade" aria-hidden="true"></div>'));
}

// Runs after every layer exists: the zoom drives S4's and S5's elements.
export function link(tl, ctx) {
  const { layer, stage, reduced, isMobile } = ctx;
  if (reduced) return;
  const d = ctx.duration;
  const S = ctx.start;
  const E = S + d;
  const p = (f) => S + f * d;

  const s4 = stage.querySelector('.layer--s4-roi');
  const s5 = stage.querySelector('.layer--s5-pixels');
  const photo4 = s4.querySelector('.photo');
  const photo5 = s5.querySelector('.photo');

  hold(tl, ctx, layer, { from: S, to: E });
  [s4, s5].forEach((l) => {
    gsap.set(l, { attr: { 'data-zoom': 'off' } });
    tl.set(l, { attr: { 'data-zoom': 'on' } }, S);
    tl.set(l, { attr: { 'data-zoom': 'off' } }, E);
  });

  // ---------- Copy ----------
  // S4's sub-headline was never wiped in; give it the open clip the wipe
  // starts from, so forward and reverse scrubs leave identical styles.
  gsap.set(s4.querySelector('.copy__sub'), { clipPath: 'inset(-30% -4% -30% -4%)' });
  wipeOut(tl, headLines(s4, true), p(0), { duration: 0.22 * d, stagger: 0.03 * d });
  const d14 = s5.querySelector('.copy--d14');
  wipeIn(tl, headLines(d14, true), p(0.6), { duration: 0.22 * d, stagger: 0.04 * d });

  // ---------- Camera ----------
  const cam = layer.querySelector('.zoom__cam');
  const imgB = layer.querySelector('.zoom__b');
  const wrapC = layer.querySelector('.zoom__c');
  const box = layer.querySelector('.zoom__box');
  const others = layer.querySelectorAll('.zoom__other');
  const fade = layer.querySelector('.zoom__fade');
  const st = { f: 0 };

  const render = () => {
    const f = st.f;
    // Start camera = S4's photo fit, end = S5's photo fit composed with the
    // world → C mapping. Scale interpolates exponentially (constant
    // perceived speed) about the transform's fixed point.
    const A = fitOf(photo4);
    const B = fitOf(photo5);
    if (!(A.s > 0 && B.s > 0)) return; // not laid out yet (zero-size stage)
    const a0 = A.s;
    const a1 = B.s * Z;
    const b0 = [A.x, A.y];
    const b1 = [B.x - a1 * O[0], B.y - a1 * O[1]];
    const u = ease(span(f, 0.06, 0.9));
    const a = a0 * (a1 / a0) ** u;
    const g = [0, 1].map((i) => (b1[i] - b0[i]) / (a0 - a1)); // world fixed point
    const fp = [0, 1].map((i) => a0 * g[i] + b0[i]); // its screen position
    const tx = fp[0] - a * g[0];
    const ty = fp[1] - a * g[1];
    cam.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${a.toFixed(5)})`;

    // C: fades in once B starts to soften (B is 0.62 px/frame px), with a
    // soft rectangular edge that narrows to nothing as C reaches the screen
    // edges (u = 1), so it never shows a hard border over B.
    const r = span(u, 0.26, 0.5);
    wrapC.style.opacity = r.toFixed(3);
    wrapC.style.setProperty('--fe', `${(420 * (1 - span(u, 0.3, 1))).toFixed(1)}px`);
    // B stays under C until the zoom lands, softening as C takes over.
    imgB.style.filter = r > 0 && u < 1 ? `blur(${(0.7 * r).toFixed(3)}px)` : '';
    imgB.style.visibility = u >= 1 ? 'hidden' : '';

    // ROI box: world rect morph + screen-constant stroke and radius.
    const v = easeBox(span(u, 0.2, 1));
    const rect = ROI_SMALL.map((s, i) => lerp(s, ROI_BIG_W[i], v));
    const k0 = a0; // screen px per frame px at the start / end
    const k1 = B.s;
    const strokeScr = lerp(STROKE[0] * k0, STROKE[1] * k1, v);
    const rxScr = lerp(RX[0] * k0, RX[1] * k1, v);
    box.setAttribute('x', rect[0].toFixed(3));
    box.setAttribute('y', rect[1].toFixed(3));
    box.setAttribute('width', rect[2].toFixed(3));
    box.setAttribute('height', rect[3].toFixed(3));
    box.setAttribute('rx', (rxScr / a).toFixed(4));
    box.setAttribute('stroke-width', (strokeScr / a).toFixed(4));
    const o = (1 - span(f, 0.04, 0.22)).toFixed(3);
    others.forEach((el) => { el.style.opacity = o; });

    // Mobile: the photos fade into the layer colour at their top edge (16% of
    // the frame); repaint that band in screen space between the two fits.
    if (isMobile) {
      const top0 = A.y + A.s * ASSETS.photos.front.frames[13].top;
      const top1 = B.y + B.s * ASSETS.photos.cheek.frames[14].top;
      const hh0 = A.s * ASSETS.photos.front.frames[13].height * 0.16;
      const hh1 = B.s * ASSETS.photos.cheek.frames[14].height * 0.16;
      fade.style.top = `${lerp(top0, top1, u).toFixed(1)}px`;
      fade.style.height = `${lerp(hh0, hh1, u).toFixed(1)}px`;
    }
  };

  tl.fromTo(st, { f: 0 }, { f: 1, duration: d, ease: 'none', onUpdate: render, immediateRender: false }, S);
  render();
  const onResize = () => requestAnimationFrame(render);
  window.addEventListener('resize', onResize);
  ctx.onCleanup(() => window.removeEventListener('resize', onResize));
}
