// S6 Step 3 Extract RGB (D16): skin cross-section with the orange light paths
// and their three label pills. T8 adds vessel pulses, T9 morphs the beams.
import { svg, preloadSVG, at } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

await preloadSVG('beams-d16.svg');

// Label pills (frame px rects; white 65% fill, orange stroke).
const LABELS = [
  ['Reflected lights', [1109, 248, 192, 59]],
  ['Light in', [652, 572, 118, 59]],
  ['Vessels reflect light', [1100, 583, 227, 59]],
];

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene', 'scene--light');
  const labels = LABELS.map(([t, r]) => `<span class="beam-label at" style="${at(r)}">${t}</span>`).join('');
  layer.append(
    photoBox('skin', 16, {
      focusM: '560 230 760 640',
      targetM: '0 0.38 1 0.5',
      overlays: svg('beams-d16.svg', 'class="overlay beams"') + labels,
    }),
    uiBox(copyBlock({ head: ['Step 3:', 'Extract RGB'] })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
