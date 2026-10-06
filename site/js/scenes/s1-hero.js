// S1 Hero (D9 → D10). Scroll-scrubbed: the glowing-dots photo (D10) is
// revealed over the plain one (D9) through a feathered radial mask that grows
// from the forehead hotspot; the CTA fades out, the tags lift 14px (desktop),
// the results line and the five vital chips enter one at a time. Once the
// chips are in, each icon runs a time-based loop on its glyph body only — the
// shadow and glow rasters never move. Everything lands by ~85% of the segment,
// so the rest of it (and the first half of t1-turn) holds D10.
import { ASSETS } from '../assets.js';
import { h, preloadSVG, boxStyle } from '../lib/dom.js';
import { uiBox, copyBlock, chip, CHIPS } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { ambient } from '../lib/ambient.js';

const { gsap } = window;

await preloadSVG(...CHIPS.map((c) => `icons/${c.name}-glyph.svg`));

const place = (name, frame) => {
  const b = ASSETS.photos[name].frames[frame];
  return boxStyle([b.left, b.top, b.width, b.height]);
};

// Glow reveal: forehead hotspot (frame px) and the radius that clears the
// farthest frame corner plus the feather (--f in scenes.css).
const HOT = [894, 386];
const R_MAX = 1400;

// Icon loops on the glyph's [data-id="body"]. Periods tie in with the vitals
// the film reports later: 72 bpm heartbeat, 13 breaths/min.
const LOOPS = {
  'heart-rate': (b) =>
    gsap.timeline({ repeat: -1, paused: true })
      .to(b, { scale: 1.14, duration: 0.11, ease: 'power2.out' })
      .to(b, { scale: 1, duration: 0.16, ease: 'power2.in' })
      .to(b, { scale: 1.08, duration: 0.1, ease: 'power2.out' })
      .to(b, { scale: 1, duration: 0.2, ease: 'power2.in' })
      .to({}, { duration: 0.26 }), // ≈ 0.83 s per beat = 72 bpm
  'blood-oxygen': (b) =>
    gsap.to(b, { rotation: 360, duration: 7, ease: 'none', repeat: -1, paused: true }),
  'blood-pressure': (b) =>
    gsap.timeline({ repeat: -1, paused: true, defaults: { transformOrigin: '50% 100%' } })
      .to(b, { scaleX: 1.1, scaleY: 0.86, duration: 0.32, ease: 'power2.in' })
      .to(b, { scaleX: 0.96, scaleY: 1.06, duration: 0.28, ease: 'power2.out' })
      .to(b, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'sine.inOut' })
      .to({}, { duration: 0.5 }),
  'breathing-rate': (b) =>
    gsap.to(b, { scale: 1.08, duration: 2.3, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true }),
  'glucose': (b) =>
    gsap.to(b, { rotation: '+=60', duration: 0.9, ease: 'power2.inOut', repeat: -1, repeatDelay: 1.1, paused: true }),
};

function iconLoops(chips) {
  return chips.flatMap((el) => {
    const name = CHIPS.find((c) => el.classList.contains(`chip--${c.name}`)).name;
    const body = el.querySelector('[data-id="body"]');
    const sparkles = el.querySelector('[data-id="sparkles"]');
    gsap.set(body, { transformOrigin: '50% 50%' });
    const loops = [LOOPS[name](body)];
    if (sparkles) {
      loops.push(gsap.to(sparkles.children, {
        opacity: 0.25, duration: 0.9, ease: 'sine.inOut', paused: true,
        stagger: { each: 0.35, repeat: -1, yoyo: true },
      }));
    }
    return loops;
  });
}

export function build(tl, ctx) {
  const { layer, isMobile, reduced } = ctx;
  layer.classList.add('scene');

  const photo = h(`
    <div class="fbox photo" data-fit="cover" data-m-fit="focus" data-m-focus="770 190 440 540" data-m-target="0 0.38 1 0.46" data-m-fill>
      <img class="photo__img" src="${ASSETS.photos['hero-a'].file}" alt="Woman holding up a smartphone to her face" style="${place('hero-a', 9)}">
      <img class="photo__img hero__glow" src="${ASSETS.photos['hero-a-glow'].file}" alt="" style="${place('hero-a-glow', 10)}">
    </div>`);

  const copy = copyBlock({
    head: ['Measure 5 health', 'parameters'],
    sub: ['With just your smart phone!'],
    order: 'h-sub',
    grad: 'one',
    tag: 'h1',
  });
  const tags = h(`<ul class="tags"><li>#privacy</li><li>#diversity</li></ul>`);
  const cta = h(`
    <a class="cta" href="#contact">Contact us
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13.3M8.3 1.7 14.6 8l-6.3 6.3" /></svg>
    </a>`);
  const results = h(`
    <div class="results">
      <p class="results__title">A 30-second facial scan results in:</p>
      <ul class="chips">${CHIPS.map(chip).join('')}</ul>
    </div>`);

  layer.append(photo, uiBox(copy, tags, cta, results));

  const glow = photo.querySelector('.hero__glow');
  const title = results.querySelector('.results__title');
  const chips = [...results.querySelectorAll('.chip')];
  const glyphs = chips.map((c) => c.querySelector('.icon__glyph'));

  // Mask centre in the glow image's own box (its placement is a hair off 0,0).
  const g = ASSETS.photos['hero-a-glow'].frames[10];
  gsap.set(glow, { '--gx': `${HOT[0] - g.left}px`, '--gy': `${HOT[1] - g.top}px` });

  const win = sceneWindow(tl, ctx.scene.id);
  hold(tl, ctx, layer, win);

  if (reduced) {
    // End state (D10): glow fully revealed, CTA gone, tags up.
    gsap.set(glow, { '--r': `${R_MAX}px` });
    gsap.set(cta, { autoAlpha: 0 });
    if (!isMobile) gsap.set(tags, { y: -14 });
    return;
  }

  const d = ctx.duration;
  const p = (f) => win.start + f * d;

  // Glow: grows from the forehead out over the whole photo; shrinks back on reverse.
  tl.fromTo(glow, { autoAlpha: 0, '--r': '0px' }, { autoAlpha: 1, duration: 0.02 * d }, p(0.05));
  tl.to(glow, { '--r': `${R_MAX}px`, duration: 0.55 * d, ease: 'sine.inOut' }, p(0.05));

  // D9 → D10 copy re-layout.
  tl.to(cta, { autoAlpha: 0, y: 14, scale: 0.96, duration: 0.12 * d, ease: 'power2.in' }, p(0.1));
  if (!isMobile) tl.to(tags, { y: -14, duration: 0.16 * d, ease: 'power2.inOut' }, p(0.14));
  tl.fromTo(title, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.14 * d, ease: 'power3.out' }, p(0.3));

  // Chips one by one; each icon glyph pops in just after its chip.
  const each = 0.075 * d;
  const chipsAt = p(0.38);
  tl.fromTo(chips, { autoAlpha: 0, y: 48, scale: 0.94 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.16 * d, ease: 'power3.out', stagger: each }, chipsAt);
  tl.fromTo(glyphs, { scale: 0.3, rotation: -25, autoAlpha: 0 },
    { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.14 * d, ease: 'back.out(2.2)', stagger: each }, chipsAt + 0.05 * d);

  // Icon loops run while the chips are on screen (through the hold into t1).
  ambient(tl, ctx, chipsAt, win.to, iconLoops(chips));
}
