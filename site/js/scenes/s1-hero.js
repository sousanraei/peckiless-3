// S1 Hero (D9 → D10). Static layout: D9 for the first half of the segment,
// D10 (glow photo, results line, vital chips, tags moved up, no CTA) after.
// T3 replaces the cut with the radial glow reveal and chip entrances.
import { ASSETS } from '../assets.js';
import { h, preloadSVG, boxStyle } from '../lib/dom.js';
import { uiBox, copyBlock, chip, CHIPS } from '../lib/ui.js';
import { sceneWindow, hold, cut } from '../lib/static.js';

await preloadSVG(...CHIPS.map((c) => `icons/${c.name}-glyph.svg`));

const place = (name, frame) => {
  const b = ASSETS.photos[name].frames[frame];
  return boxStyle([b.left, b.top, b.width, b.height]);
};

export function build(tl, ctx) {
  const { layer } = ctx;
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

  const win = sceneWindow(tl, ctx.scene.id);
  hold(tl, ctx, layer, win);
  // D9 → D10 at the midpoint.
  cut(tl, ctx, win.mid, {
    off: [cta],
    on: [photo.querySelector('.hero__glow'), results],
    vars: [[tags, { attr: { 'data-state': 'up' } }]], // D10: tags sit 14px higher (desktop)
  });
}
