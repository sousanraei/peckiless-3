// S9 Finale (D19): photo E (heart/lungs overlay) with the five vital cards and
// their connector lines. t5-vitals.js (T12) morphs the D18 waves into the
// card charts, fades this layer's content in and starts the icon loops. The
// Contact us CTA from D9 returns here (not in D19) to close the film: it sits
// where it was in D9 and fades in over the first quarter of the segment.
import { h, svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock, card, CARDS } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

const { gsap } = window;

await preloadSVG('connectors-d19.svg', ...CARDS.map((c) => `icons/${c.name}-glyph.svg`));

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene');
  // Desktop: cards + connectors use the UI's contain fit so they never collide
  // with the copy on wide screens (connector ends stay on the torso: they drift
  // < 20px from the cover-fit photo at 16:9). Mobile: a 2-column grid.
  const cards = h(`
    <div class="fbox cards" data-fit="contain" data-m-fit="none">
      ${svg('connectors-d19.svg', 'class="overlay connectors"')}
      ${CARDS.map(card).join('')}
    </div>`);
  const cta = h(`
    <a class="cta cta--finale" href="#contact">Contact us
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13.3M8.3 1.7 14.6 8l-6.3 6.3" /></svg>
    </a>`);
  layer.append(
    photoBox('finale', 19, { focusM: '700 140 460 520', targetM: '0 0.36 1 0.34' }),
    cards,
    uiBox(copyBlock({ head: ['5 vital signs', 'measured'], order: 'h-sub' }), cta),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
  if (reduced) return;

  tl.fromTo(cta, { autoAlpha: 0, y: 14, scale: 0.96 }, {
    autoAlpha: 1, y: 0, scale: 1, duration: 0.25 * ctx.duration, ease: 'power2.out',
  }, ctx.start);
}
