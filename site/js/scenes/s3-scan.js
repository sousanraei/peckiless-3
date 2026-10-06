// S3 Step 1 Face scan (D12): photo B with the green scan line across her brow.
// T6 animates the line top → bottom with a face-clipped trail.
import { svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { FACE_B, FACE_B_TARGET } from './s2-science.js';

await preloadSVG('scan-line-d12.svg');

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  layer.append(
    photoBox('front', 12, {
      focusM: FACE_B,
      targetM: FACE_B_TARGET,
      overlays: svg('scan-line-d12.svg', 'class="overlay scan"'),
    }),
    uiBox(copyBlock({ head: ['Step 1:', 'Face scan'] })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
