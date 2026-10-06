// T3 Into the skin (D15 → D16). The sampled pixels collapse into a point of
// light that blooms to white ("below the surface"); out of the white, the D16
// skin cross-section rises from the bottom and the incoming beam draws down
// onto it until "Light in" appears.
//
// Segment fractions:
//   0–0.25     D15 headline lines wipe out (the sub-headline is identical in
//              D15 and D16, so it stays)
//   0.02–0.5   camera pushes into the ROI centre (cheek photo + overlays)
//   0.04–0.3   ROI box shrinks into the centre and fades
//   0.06–0.34  swatches collapse into the centre (outer cells first)
//   0.14–0.3   a warm point of light ignites there
//   0.26–0.5   it blooms to white; at 0.5 the static cut swaps S5 → S6
//   0.5–0.84   skin section rises from below the screen (S6 photo)
//   0.55–0.82  S6 headline wipes in
//   0.6–0.88   incoming beam draws to the skin surface, arrow head 0.84–0.92
//   0.88–0.98  "Light in" label pops in
// S6 (s6-vessels.js) then draws the other light paths and runs the pulses.
//
// No layer of its own: like t2-zoom's link(), it drives S5's and S6's
// elements. Reduced motion: nothing (static D15 → D16 cut).
import { ASSETS } from '../assets.js';

const { gsap } = window;

const NS = 'http://www.w3.org/2000/svg';
const [BX, BY, BW, BH] = ASSETS.vectors['roi-d14']['roi-big'];
const C = [BX + BW / 2, BY + BH / 2]; // ROI centre = where the light ignites (frame px)
const SKIN_TOP = ASSETS.photos.skin.frames[16].top;

// fit.js writes `translate(Xpx, Ypx) scale(S)` on every frame box.
function fitOf(el) {
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(el.style.transform);
  return m ? { x: +m[1], y: +m[2], s: +m[3] } : { x: 0, y: 0, s: 1 };
}

export function build() {}

export function link(tl, ctx) {
  const { stage, reduced } = ctx;
  if (reduced) return;
  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;

  const s5 = stage.querySelector('.layer--s5-pixels');
  const s6 = stage.querySelector('.layer--s6-vessels');
  const photo5 = s5.querySelector('.photo');
  const photo6 = s6.querySelector('.photo');

  // ---------- Copy ----------
  const head15 = [...s5.querySelectorAll('.copy--d15 .copy__h span')];
  tl.fromTo(head15, { clipPath: 'inset(-30% -4% -30% -4%)', y: 0 }, {
    clipPath: 'inset(-30% -4% 130% -4%)', y: -28, duration: 0.2 * d, stagger: 0.03 * d,
    ease: 'power2.in', immediateRender: false,
  }, p(0));
  tl.fromTo(s6.querySelectorAll('.copy__h span'), { clipPath: 'inset(130% -4% -30% -4%)', y: 36 }, {
    clipPath: 'inset(-30% -4% -30% -4%)', y: 0, duration: 0.22 * d, stagger: 0.05 * d, ease: 'power3.out',
  }, p(0.55));

  // ---------- Push into the ROI centre ----------
  const img5 = photo5.querySelector('.photo__img--cheek');
  const roi = photo5.querySelector('.roi-big');
  const sw = photo5.querySelector('.swatches');
  const il = parseFloat(img5.style.left) || 0;
  const it = parseFloat(img5.style.top) || 0;
  gsap.set(img5, { transformOrigin: `${C[0] - il}px ${C[1] - it}px` });
  gsap.set([roi, sw], { transformOrigin: `${C[0]}px ${C[1]}px` });
  tl.fromTo([img5, roi, sw], { scale: 1 }, {
    scale: 1.55, duration: 0.48 * d, ease: 'power2.in', immediateRender: false,
  }, p(0.02));

  // ROI box: shrinks into its centre (inside the outer push) and fades.
  const box = roi.querySelector('rect, path');
  if (box) {
    gsap.set(box, { svgOrigin: `${C[0]} ${C[1]}` });
    tl.fromTo(box, { scale: 1, opacity: 1 }, {
      scale: 0.15, opacity: 0, duration: 0.26 * d, ease: 'power2.in', immediateRender: false,
    }, p(0.04));
  }

  // Swatches: every cell flies to the centre, outer cells first.
  const cells = [...sw.querySelectorAll('.swatch')];
  const centre = (el) => {
    const x = +el.getAttribute('x') + +el.getAttribute('width') / 2;
    const y = +el.getAttribute('y') + +el.getAttribute('height') / 2;
    return [x, y];
  };
  const far = Math.max(...cells.map((el) => Math.hypot(...centre(el).map((v, i) => v - C[i]))));
  cells.forEach((el) => {
    const [x, y] = centre(el);
    const k = Math.hypot(x - C[0], y - C[1]) / far; // 0 centre … 1 corner
    tl.fromTo(el, { x: 0, y: 0, scale: 1, opacity: 1 }, {
      x: C[0] - x, y: C[1] - y, scale: 0.12, opacity: 0,
      duration: 0.16 * d, ease: 'power3.in', immediateRender: false,
    }, p(0.06 + 0.12 * (1 - k)));
  });

  // ---------- Point of light → white bloom ----------
  const light = document.createElementNS(NS, 'svg');
  light.setAttribute('class', 'overlay skin-light');
  light.setAttribute('viewBox', '0 0 1440 1024');
  light.setAttribute('aria-hidden', 'true');
  light.innerHTML = `
    <defs>
      <radialGradient id="skin-light-core">
        <stop offset="0" stop-color="#fff"/>
        <stop offset="0.25" stop-color="#fff6dc"/>
        <stop offset="0.55" stop-color="#f59e0b" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="skin-light-bloom">
        <stop offset="0" stop-color="#fff"/>
        <stop offset="0.72" stop-color="#fff"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle class="skin-light__bloom" cx="${C[0]}" cy="${C[1]}" r="0" fill="url(#skin-light-bloom)"/>
    <circle class="skin-light__core" cx="${C[0]}" cy="${C[1]}" r="0" fill="url(#skin-light-core)"/>`;
  photo5.append(light);
  const core = light.querySelector('.skin-light__core');
  const bloom = light.querySelector('.skin-light__bloom');
  tl.fromTo(core, { attr: { r: 0 } }, { attr: { r: 90 }, duration: 0.16 * d, ease: 'power2.out', immediateRender: false }, p(0.14));
  tl.to(core, { attr: { r: 260 }, opacity: 0, duration: 0.18 * d, ease: 'power1.in' }, p(0.3)); // gone by the cut
  // 3200 frame px covers the whole stage from the ROI centre on every fit
  // (mobile scales the photo box to ~0.5, desktop is ≥ 1).
  tl.fromTo(bloom, { attr: { r: 0 } }, { attr: { r: 3200 }, duration: 0.24 * d, ease: 'expo.in', immediateRender: false }, p(0.26));

  // ---------- Skin rises (S6) ----------
  // The skin image and the vessel overlay are lifted by
  // (1 - --rise) × --drop (scenes.css), --drop = the distance (frame px)
  // from the skin's top edge to just below the stage on the current fit.
  const measure = () => {
    const f = fitOf(photo6);
    const drop = (stage.clientHeight - (f.y + SKIN_TOP * f.s)) / f.s + 40;
    photo6.style.setProperty('--drop', `${Math.max(0, drop).toFixed(1)}px`);
  };
  measure();
  const onResize = () => requestAnimationFrame(measure);
  window.addEventListener('resize', onResize);
  ctx.onCleanup(() => window.removeEventListener('resize', onResize));
  tl.fromTo(photo6, { '--rise': 0 }, { '--rise': 1, duration: 0.34 * d, ease: 'power3.out' }, p(0.5));

  // ---------- Incoming beam + "Light in" ----------
  const beamIn = photo6.querySelector('[data-id="beam-in-line"]');
  const beamHead = photo6.querySelector('[data-id="beam-in-head"]');
  tl.fromTo(beamIn, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.28 * d, ease: 'power1.inOut' }, p(0.6));
  tl.fromTo(beamHead, { drawSVG: '50% 50%', opacity: 0 }, { drawSVG: '0% 100%', opacity: 1, duration: 0.08 * d, ease: 'power2.out' }, p(0.84));
  const label = [...photo6.querySelectorAll('.beam-label')].find((el) => el.textContent.trim() === 'Light in');
  tl.fromTo(label, { opacity: 0, '--pop': 0.7 }, { opacity: 1, '--pop': 1, duration: 0.1 * d, ease: 'back.out(2.5)' }, p(0.88));
}
