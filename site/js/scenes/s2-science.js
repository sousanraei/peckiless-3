// S2 Science (D11): photo B facing the camera, "The science behind Pecki!less".
// The step-pill row is the shared #pills (js/shared.js); T6 adds its entrance.
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

// Mobile: her face (frame px) fitted below the copy.
export const FACE_B = '700 170 400 430';
export const FACE_B_TARGET = '0 0.35 1 0.5';

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene');
  layer.append(
    photoBox('front', 11, { focusM: FACE_B, targetM: FACE_B_TARGET }),
    uiBox(copyBlock({ head: ['The science', 'behind', 'Pecki!less'], order: 'h-sub' })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
