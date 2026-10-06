// S4 Step 2 ROI (D13): photo B with the three teal ROI boxes (forehead, cheeks).
// The headline wipes in ("Step 1:" → "Step 2:", the sub-headline stays) 0–0.28
// while pill 2 lights (shared.js); the boxes draw on with DrawSVG one after the
// other 0.1–0.54 (forehead, viewer-left cheek, viewer-right cheek), each
// settling from a slight scale with a brief teal lock-on fill. All three are
// settled by ~0.65, so the rest of the segment (and the hold into t2-zoom) is D13.
// T7 zooms into [data-id="roi-cheek-right"].
import { svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { headLines, wipeIn } from '../lib/wipe.js';
import { FACE_B, FACE_B_TARGET } from './s2-science.js';

const { gsap } = window;

await preloadSVG('roi-d13.svg');

const ROIS = ['roi-forehead', 'roi-cheek-left', 'roi-cheek-right'];

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
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
  if (reduced) return;

  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;

  wipeIn(tl, headLines(layer), p(0), { duration: 0.2 * d, stagger: 0.04 * d });

  ROIS.forEach((id, i) => {
    const box = layer.querySelector(`[data-id="${id}"]`);
    const at = p(0.1 + i * 0.1);
    gsap.set(box, { fill: '#44B3A2', fillOpacity: 0, transformOrigin: '50% 50%' });
    tl.fromTo(box, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.22 * d, ease: 'power2.inOut' }, at);
    tl.fromTo(box, { scale: 1.12 }, { scale: 1, duration: 0.26 * d, ease: 'power3.out' }, at);
    tl.to(box, {
      keyframes: [
        { fillOpacity: 0.22, duration: 0.05 * d, ease: 'power1.out' },
        { fillOpacity: 0, duration: 0.12 * d, ease: 'power1.in' },
      ],
    }, at + 0.18 * d);
  });
}
