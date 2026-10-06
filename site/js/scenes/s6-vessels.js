// S6 Step 3 Extract RGB (D16): skin cross-section with the orange light paths
// and their three label pills. t3-skin.js brings the skin up and draws the
// incoming beam + "Light in"; T9 morphs the beams on into D17.
//
// Segment fractions: the vessel pulses fade in 0–0.1, then the rest of the
// light path draws: specular reflection 0.02–0.14 (+ head, "Reflected
// lights"), into the tissue 0.12–0.26, back out of it 0.26–0.4 (+ "Vessels
// reflect light"), out of the skin 0.42–0.54. D16 is complete from ~0.57.
//
// Vessel signals: blinking pulse dots ride the vessel centrelines traced in
// tools/vessels/trace.py (MotionPath, time-based via ambient(), so they keep
// moving while the scroll is still). Arteries carry them up from the trunk
// into the branches (trunk left → right), veins down and back (right → left),
// veins a little slower. Each dot blinks at 1.2 Hz (72 BPM, the pulse the
// later steps measure). No filters: the glow is a radial gradient.
import { svg, preloadSVG, at } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { ambient } from '../lib/ambient.js';
import { VESSELS } from './vessels-paths.js';

const { gsap } = window;

await preloadSVG('beams-d16.svg');

// Label pills (frame px rects; white 65% fill, orange stroke).
const LABELS = [
  ['Reflected lights', [1109, 248, 192, 59]],
  ['Light in', [652, 572, 118, 59]],
  ['Vessels reflect light', [1100, 583, 227, 59]],
];

const SPEED = { a: 150, v: 105 }; // frame px / s along the vessel
const SPACING = 230; // frame px between pulses on one vessel
const BEAT = 1 / 1.2; // s per blink (72 BPM)

function vesselsMarkup() {
  const paths = Object.entries(VESSELS)
    .map(([id, v]) => `<path class="vessel-path" data-vessel="${id}" data-kind="${v.kind}" d="${v.d}"/>`)
    .join('');
  return `
    <svg class="overlay vessels" viewBox="0 0 1440 1024" aria-hidden="true">
      <defs>
        <radialGradient id="pulse-glow-a">
          <stop offset="0" stop-color="#fff" stop-opacity="1"/>
          <stop offset="0.3" stop-color="#ffd2c4" stop-opacity="0.9"/>
          <stop offset="0.6" stop-color="#ff5a4a" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#ff3b30" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="pulse-glow-v">
          <stop offset="0" stop-color="#fff" stop-opacity="1"/>
          <stop offset="0.3" stop-color="#d4e6ff" stop-opacity="0.9"/>
          <stop offset="0.6" stop-color="#4f8cff" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#2f6fe0" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g class="vessels__paths">${paths}</g>
      <g class="vessels__pulses"></g>
    </svg>`;
}

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene', 'scene--light');
  const labels = LABELS.map(([t, r]) => `<span class="beam-label at" style="${at(r)}">${t}</span>`).join('');
  const photo = photoBox('skin', 16, {
    focusM: '560 230 760 640',
    targetM: '0 0.38 1 0.5',
    overlays: vesselsMarkup() + svg('beams-d16.svg', 'class="overlay beams"') + labels,
  });
  layer.append(photo, uiBox(copyBlock({ head: ['Step 3:', 'Extract RGB'] })));
  const win = sceneWindow(tl, ctx.scene.id);
  hold(tl, ctx, layer, win);

  // ---------- Vessel pulses ----------
  const group = photo.querySelector('.vessels__pulses');
  const loops = [];
  photo.querySelectorAll('.vessel-path').forEach((path, vi) => {
    const kind = path.dataset.kind;
    const len = path.getTotalLength();
    const n = Math.max(1, Math.round(len / SPACING));
    const dur = len / SPEED[kind];
    for (let i = 0; i < n; i++) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      dot.setAttribute('class', `pulse pulse--${kind}`);
      dot.innerHTML = `<circle r="24" fill="url(#pulse-glow-${kind})"/><circle r="5" fill="#fff"/>`;
      group.append(dot);
      const phase = (i + 0.37 * vi) / n; // spread along the vessel, staggered per vessel
      const ride = gsap.to(dot, {
        motionPath: { path, autoRotate: false },
        duration: dur,
        ease: 'none',
        repeat: -1,
        paused: true,
      });
      ride.progress(phase % 1);
      // Blink: bright on the beat, dim between; the phase follows the dot's
      // position so a pulse wave appears to travel through the network.
      gsap.set(dot, { opacity: 0.4 });
      const blink = gsap.to(dot, {
        keyframes: [
          { opacity: 1, duration: 0.18 * BEAT, ease: 'power2.out' },
          { opacity: 0.4, duration: 0.82 * BEAT, ease: 'power1.in' },
        ],
        repeat: -1,
        paused: true,
      });
      blink.progress((phase * 3) % 1);
      loops.push(ride, blink);
    }
  });
  if (reduced) {
    gsap.set(group.children, { opacity: 0.9 });
    return;
  }
  ambient(tl, ctx, win.from, win.to, loops);

  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;
  tl.fromTo(group, { opacity: 0 }, { opacity: 1, duration: 0.1 * d }, p(0));

  // ---------- Light paths ----------
  const q = (id) => photo.querySelector(`[data-id="${id}"]`);
  const label = (t) => [...photo.querySelectorAll('.beam-label')].find((el) => el.textContent.trim() === t);
  const line = (id, at0, dur) =>
    tl.fromTo(q(id), { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur * d, ease: 'power1.inOut' }, p(at0));
  const head = (id, at0) =>
    tl.fromTo(q(id), { drawSVG: '50% 50%', opacity: 0 }, { drawSVG: '0% 100%', opacity: 1, duration: 0.05 * d, ease: 'power2.out' }, p(at0));
  const pop = (t, at0) =>
    tl.fromTo(label(t), { opacity: 0, '--pop': 0.7 }, { opacity: 1, '--pop': 1, duration: 0.06 * d, ease: 'back.out(2.5)' }, p(at0));
  // The dashed tissue paths can't be drawn with DrawSVG (it owns the dash
  // array), so each is revealed through a mask holding a solid copy.
  const dashed = (id, at0, dur) => {
    const el = q(id);
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    m.id = `${el.id}-reveal`;
    m.setAttribute('maskUnits', 'userSpaceOnUse');
    ['x', 'y'].forEach((k) => m.setAttribute(k, '-100'));
    m.setAttribute('width', '1640');
    m.setAttribute('height', '1224');
    const solid = el.cloneNode();
    ['id', 'data-id', 'stroke-dasharray'].forEach((a) => solid.removeAttribute(a));
    solid.setAttribute('stroke', '#fff');
    solid.setAttribute('stroke-width', '16');
    m.append(solid);
    el.ownerSVGElement.prepend(m);
    el.setAttribute('mask', `url(#${m.id})`);
    tl.fromTo(solid, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur * d, ease: 'power1.inOut' }, p(at0));
  };

  line('beam-specular-line', 0.02, 0.12);
  head('beam-specular-head', 0.1);
  pop('Reflected lights', 0.13);
  dashed('tissue-in-line', 0.12, 0.14);
  head('tissue-in-head', 0.22);
  dashed('tissue-out-line', 0.26, 0.14);
  head('tissue-out-head', 0.36);
  pop('Vessels reflect light', 0.39);
  line('beam-out-line', 0.42, 0.12);
  head('beam-out-head', 0.52);
}
