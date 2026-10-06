// S5 Pixel sampling (D14 → D15): cheek close-up with the big ROI box.
// First half = D14 (headline first, empty box); second half = D15 (sub-headline
// first, swatch grid filled). T7 builds the zoom and swatch stagger.
import { svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold, cut } from '../lib/static.js';

await preloadSVG('roi-d14.svg', 'swatches-d15.svg');

const HEAD = ['Step 2:', 'ROI', 'detection'];

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  const photo = photoBox('cheek', 14, {
    focusM: '643 294 709 367',
    targetM: '0.03 0.44 0.94 0.34',
    overlays: svg('roi-d14.svg', 'class="overlay roi-big"') + svg('swatches-d15.svg', 'class="overlay swatches"'),
  });
  const d14 = copyBlock({ head: HEAD, order: 'h-sub', cls: 'copy--d14' });
  const d15 = copyBlock({ head: HEAD, cls: 'copy--d15' });
  layer.append(photo, uiBox(d14, d15));

  const win = sceneWindow(tl, ctx.scene.id);
  hold(tl, ctx, layer, win);
  cut(tl, ctx, win.mid, { off: [d14], on: [d15, photo.querySelector('.swatches')] });
}
