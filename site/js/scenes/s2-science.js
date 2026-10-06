// S2 Science (D11): photo B facing the camera, "The science behind Pecki!less".
// The step pills slide in at the end of the turn (t1-turn.js). After a reading
// pause, the headline reflows into Step 1: its lines wipe out upward 0.5–0.8,
// and (s3-scan.js link) the sub-headline glides up into its Step 1 slot while
// the photo eases the 4px D11 → D12 offset, so the cut to S3 is invisible.
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { headLines, wipeOut } from '../lib/wipe.js';
import { ASSETS } from '../assets.js';

// Mobile: her face (frame px) fitted below the copy.
export const FACE_B = '700 170 400 430';
export const FACE_B_TARGET = '0 0.35 1 0.5';

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene');
  layer.append(
    photoBox('front', 11, { focusM: FACE_B, targetM: FACE_B_TARGET }),
    uiBox(copyBlock({ head: ['The science', 'behind', 'Pecki!less'], order: 'h-sub' })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
  if (reduced) return;

  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;
  wipeOut(tl, headLines(layer), p(0.5), { duration: 0.2 * d, stagger: 0.05 * d });

  // D11 places the photo 4px higher than D12/D13 (same image).
  const f = ASSETS.photos.front.frames;
  tl.to(layer.querySelector('.photo__img'), {
    y: f[12].top - f[11].top, duration: 0.3 * d, ease: 'sine.inOut',
  }, p(0.7));
}
