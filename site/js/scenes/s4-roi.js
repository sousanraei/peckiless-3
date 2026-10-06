// S4 Step 2 ROI (D13): photo B with the three teal ROI boxes (forehead, cheeks).
// T6 draws them on; T7 zooms into [data-id="roi-cheek-right"].
import { svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { FACE_B, FACE_B_TARGET } from './s2-science.js';

await preloadSVG('roi-d13.svg');

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  layer.append(
    photoBox('front', 13, {
      focusM: FACE_B,
      targetM: FACE_B_TARGET,
      overlays: svg('roi-d13.svg', 'class="overlay roi"'),
    }),
    uiBox(copyBlock({ head: ['Step 2:', 'ROI detection'] })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
