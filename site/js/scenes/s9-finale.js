// S9 Finale (D19): photo E (heart/lungs overlay) with the five vital cards and
// their connector lines. T12 morphs the D18 waves into the card charts.
import { h, svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock, card, CARDS } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

await preloadSVG('connectors-d19.svg', ...CARDS.map((c) => `icons/${c.name}-glyph.svg`));

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  // Desktop: cards + connectors use the UI's contain fit so they never collide
  // with the copy on wide screens (connector ends stay on the torso: they drift
  // < 20px from the cover-fit photo at 16:9). Mobile: a 2-column grid.
  const cards = h(`
    <div class="fbox cards" data-fit="contain" data-m-fit="none">
      ${svg('connectors-d19.svg', 'class="overlay connectors"')}
      ${CARDS.map(card).join('')}
    </div>`);
  layer.append(
    photoBox('finale', 19, { focusM: '700 140 460 520', targetM: '0 0.36 1 0.34' }),
    cards,
    uiBox(copyBlock({ head: ['5 vital signs', 'measured'], order: 'h-sub' })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
