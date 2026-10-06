// T1 Head turn (D10 → D11). Scroll scrubs a 90-frame image sequence (T4) on a
// canvas that sits under the S1 and S2 layers: while the turn runs, those two
// layers drop their photo and background (data-turn="on"), so their copy and
// chips stay on top of the footage. Frame 0 = the D10 glow photo and frame 89
// = the D11 photo, so the hand-offs at both ends are plain swaps, no fade.
//
// Choreography (fractions of the segment): chips + results title sink and fade
// 0–0.3, tags fade, the S1 headline lines wipe out upward 0.16–0.44, the S2
// headline lines wipe in from below 0.54–0.84 (the eyebrow is identical in
// both, so it never moves), the step pills slide in one by one 0.64–0.96. The footage
// itself fades the glow dots and dissolves the window into the blue wall.
//
// Fallback (frames missing / not loaded yet near the playhead, or ?noseq):
// D10 → D11 crossfade with a push-in, a light sweep and blur. It is keyed to
// the same scroll progress, so the layer can switch between the two at any
// point. Reduced motion: this layer is hidden (the stacked end states show
// D10 and D11); T14 can reuse the fallback for its fade-only version.
import { ASSETS } from '../assets.js';
import { h, boxStyle } from '../lib/dom.js';
import { hold } from '../lib/static.js';
import { headLines, wipeOut, wipeIn } from '../lib/wipe.js';

const { gsap } = window;

const DIR = 'assets/seq/turn/';
const FW = 1440;
const FH = 1024;
// Segment fractions the footage plays over (holds a beat at each end).
const SEQ_IN = 0.04;
const SEQ_OUT = 0.96;
// Use a loaded frame this many indices away rather than drop to the fallback.
const NEAR = 3;
// Face centre (frame px): origin of the fallback push-in.
const FACE = [900, 420];

// ---------- Sequence loader (module scope: survives matchMedia rebuilds) ----------

const seq = { count: 0, pattern: '', imgs: [], loaded: 0, failed: false, onLoad: new Set() };
const forceFallback = new URLSearchParams(location.search).has('noseq');

try {
  const res = await fetch(`${DIR}manifest.json`);
  if (!res.ok) throw new Error(res.status);
  const m = await res.json();
  seq.count = m.count;
  seq.pattern = m.pattern;
  seq.imgs = new Array(m.count).fill(null);
} catch (err) {
  seq.failed = true;
  console.warn('turn sequence unavailable, using the crossfade fallback', err);
}

const frameUrl = (i) => DIR + seq.pattern.replace(/\{i(?::0?(\d+)d)?\}/, (_, w) => String(i).padStart(Number(w || 0), '0'));

// Coarse-to-fine order (every 16th, then 8th, 4th, 2nd, rest), so the whole
// turn is scrubbable early and fills in; 4 requests in flight.
function loadOrder(n) {
  const seen = new Set();
  const out = [];
  for (const step of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < n; i += step) if (!seen.has(i)) seen.add(i), out.push(i);
    if (!seen.has(n - 1)) seen.add(n - 1), out.push(n - 1);
  }
  return out;
}

let started = false;
function preload() {
  if (started || seq.failed || forceFallback) return;
  started = true;
  const queue = loadOrder(seq.count);
  const next = async () => {
    const i = queue.shift();
    if (i === undefined) return;
    const img = new Image();
    try {
      // Ready on load; decode() is only a hint (it never settles while the
      // tab is hidden, so it must not gate the queue).
      await new Promise((ok, fail) => {
        img.onload = ok;
        img.onerror = fail;
        img.src = frameUrl(i);
      });
      img.decode?.().catch(() => {});
      seq.imgs[i] = img;
      seq.loaded++;
      seq.onLoad.forEach((fn) => fn(i));
    } catch {
      // A missing frame stays null; the draw falls back around it.
    }
    return next();
  };
  for (let k = 0; k < 4; k++) next();
}
// Let the hero's own images go first; the turn is one scroll away.
if (document.readyState === 'complete') preload();
else window.addEventListener('load', preload, { once: true });

// Nearest loaded frame to i within NEAR, or null.
function nearest(i) {
  for (let k = 0; k <= NEAR; k++) {
    if (seq.imgs[i - k]) return seq.imgs[i - k];
    if (seq.imgs[i + k]) return seq.imgs[i + k];
  }
  return null;
}

// ---------- Fit helpers ----------

// fit.js writes `translate(xpx, ypx) scale(s)` on every frame box.
function boxFit(el) {
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(el?.style.transform || '');
  return m ? m.slice(1).map(Number) : null;
}

const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Scene ----------

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('turn');
  if (reduced) return;

  const a = ASSETS.photos['hero-a-glow'];
  const b = ASSETS.photos.front;
  const fallback = h(`
    <div class="turn__box" aria-hidden="true">
      <div class="turn__from"><img src="${a.file}" alt="" style="${boxStyle([a.frames[10].left, a.frames[10].top, a.frames[10].width, a.frames[10].height])}"></div>
      <div class="turn__to"><img src="${b.file}" alt="" style="${boxStyle([b.frames[11].left, b.frames[11].top, b.frames[11].width, b.frames[11].height])}"></div>
      <div class="turn__sweep"></div>
    </div>`);
  const canvas = h('<canvas class="turn__canvas" role="img" aria-label="She lowers the phone and turns to face the camera"></canvas>');
  layer.append(fallback, canvas);
  layer.dataset.mode = 'fallback';
}

// Runs after every layer exists: the turn drives S1's and S2's elements.
export function link(tl, ctx) {
  const { layer, stage, reduced, isMobile } = ctx;
  if (reduced) return;

  const d = ctx.duration;
  const S = tl.labels[ctx.scene.id];
  const E = S + d;
  const p = (f) => S + f * d;

  const s1 = stage.querySelector('.layer--s1-hero');
  const s2 = stage.querySelector('.layer--s2-science');
  const photoA = s1.querySelector('.photo');
  const photoB = s2.querySelector('.photo');

  // The turn layer is visible for the whole segment; S1/S2 lend it their
  // photo plane meanwhile (CSS: .layer[data-turn="on"]).
  hold(tl, ctx, layer, { from: S, to: E });
  [s1, s2].forEach((l) => {
    gsap.set(l, { attr: { 'data-turn': 'off' } });
    tl.set(l, { attr: { 'data-turn': 'on' } }, S);
    tl.set(l, { attr: { 'data-turn': 'off' } }, E);
  });

  // ---- S1 out ----
  const chips = [...s1.querySelectorAll('.chip')];
  tl.to(s1.querySelector('.results__title'), { autoAlpha: 0, y: 30, duration: 0.16 * d, ease: 'power2.in' }, p(0.02));
  tl.to(chips, {
    autoAlpha: 0, y: '+=64', duration: 0.2 * d, ease: 'power2.in',
    stagger: { each: 0.025 * d, from: 'end' },
  }, p(0.04));
  tl.to(s1.querySelector('.tags'), { autoAlpha: 0, y: '-=10', duration: 0.12 * d, ease: 'power2.in' }, p(0.1));

  // Line-mask wipe (js/lib/wipe.js): S1 lines + sub-headline out, S2 in.
  wipeOut(tl, headLines(s1, true), p(0.16), { duration: 0.16 * d, stagger: 0.035 * d });
  wipeIn(tl, headLines(s2, true), p(0.54), { duration: 0.2 * d, stagger: 0.035 * d });

  // ---- Step pills (shared #pills) slide in from the right, one by one, as
  // she settles. ----
  const pills = stage.querySelectorAll('#pills .pill');
  if (pills.length) {
    tl.fromTo(pills, { autoAlpha: 0, x: isMobile ? 48 : 140 }, {
      autoAlpha: 1, x: 0, duration: 0.2 * d, ease: 'power3.out', stagger: 0.03 * d,
    }, p(0.64));
  }

  // ---- Fallback crossfade (push-in, light sweep, blur), keyed to scroll. ----
  const box = layer.querySelector('.turn__box');
  const from = box.querySelector('.turn__from');
  const to = box.querySelector('.turn__to');
  const sweep = box.querySelector('.turn__sweep');
  gsap.set([from, to], { transformOrigin: `${FACE[0]}px ${FACE[1]}px` });
  tl.fromTo(from, { scale: 1, filter: 'blur(0px)' },
    { scale: 1.07, filter: 'blur(10px)', duration: 0.5 * d, ease: 'power1.in' }, p(0.12));
  tl.to(from, { autoAlpha: 0, duration: 0.25 * d, ease: 'none' }, p(0.38));
  tl.fromTo(to, { autoAlpha: 0, scale: 1.07, filter: 'blur(10px)' },
    { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.5 * d, ease: 'power2.out' }, p(0.38));
  tl.fromTo(sweep, { xPercent: -100, autoAlpha: 0 },
    { xPercent: 100, duration: 0.45 * d, ease: 'sine.inOut' }, p(0.26));
  tl.to(sweep, { autoAlpha: 1, duration: 0.12 * d, yoyo: true, repeat: 1, ease: 'sine.inOut' }, p(0.32));

  // ---- Canvas sequence, drawn from the playhead (works with ?still too). ----
  const canvas = layer.querySelector('.turn__canvas');
  const g = canvas.getContext('2d');
  const ease = gsap.parseEase('sine.inOut');
  const css = getComputedStyle(document.documentElement);
  const bg = gsap.utils.interpolate(css.getPropertyValue('--c-hero-top').trim(), css.getPropertyValue('--c-sky').trim());
  let last = '';

  const draw = (force) => {
    const t = tl.time();
    if (t < S || t > E) return;
    const k = ease(gsap.utils.clamp(0, 1, (t - p(SEQ_IN)) / ((SEQ_OUT - SEQ_IN) * d)));

    // Frame box: S1's fit → S2's fit (identical on desktop; on mobile the
    // face crops differ, so the crop travels with the turn).
    const fa = boxFit(photoA);
    const fb = boxFit(photoB) || fa;
    if (!fa) return;
    const [x, y, s] = fa.map((v, i) => lerp(v, fb[i], k));
    box.style.transform = `translate(${x}px, ${y}px) scale(${s})`;

    const i = Math.round(k * (seq.count - 1));
    const img = seq.failed || forceFallback ? null : nearest(i);
    const mode = img ? 'seq' : 'fallback';
    if (layer.dataset.mode !== mode) layer.dataset.mode = mode;
    if (!img) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(layer.clientWidth * dpr);
    const ch = Math.round(layer.clientHeight * dpr);
    const key = `${img.src}|${x.toFixed(1)},${y.toFixed(1)},${s.toFixed(4)}|${cw}x${ch}`;
    if (!force && key === last) return;
    last = key;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const color = bg(k);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.fillStyle = color;
    g.fillRect(0, 0, cw, ch);
    g.drawImage(img, x, y, FW * s, FH * s);
    if (isMobile) {
      // Same top fade as the mobile photo boxes (mask over the top 16%).
      const fade = g.createLinearGradient(0, y, 0, y + 0.16 * FH * s);
      fade.addColorStop(0, color);
      fade.addColorStop(1, `rgba(${gsap.utils.splitColor(color).slice(0, 3).join(',')},0)`);
      g.fillStyle = fade;
      g.fillRect(0, y, cw, 0.16 * FH * s + 1);
    }
  };

  const tick = () => draw(false);
  const onLoad = () => draw(true);
  gsap.ticker.add(tick);
  seq.onLoad.add(onLoad);
  ctx.onCleanup(() => {
    gsap.ticker.remove(tick);
    seq.onLoad.delete(onLoad);
  });
}
