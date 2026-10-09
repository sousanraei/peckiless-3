// S9 Finale (D19, Oct 2026 version): photo E (heart/lungs overlay) with the
// five vital cards; no connector lines and no CTA. t5-vitals.js (T12) morphs
// the D18 waves into the card charts, fades this layer's content in and
// starts the icon loops.
import { h, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock, card, CARDS } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

await preloadSVG(...CARDS.map((c) => `icons/${c.name}-glyph.svg`));

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  // Desktop: the cards use the UI's contain fit so they never collide with the
  // copy on wide screens. Mobile: a 2-column grid.
  const cards = h(`
    <div class="fbox cards" data-fit="contain" data-m-fit="none">
      ${CARDS.map(card).join('')}
    </div>`);
  // Copy before the cards in the DOM so the h2 precedes the card h3s.
  layer.append(
    photoBox('finale', 19, {
      focusM: '700 140 460 520',
      targetM: '0 0.36 1 0.34',
      alt: 'The woman with an X-ray style view of her heart and lungs, surrounded by her five vital-sign results',
    }),
    uiBox(copyBlock({ head: ['5 vital signs', 'measured'], order: 'h-sub' })),
    cards,
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
