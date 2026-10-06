// S3 Step 1 Face scan (D12): photo B; a glowing green line sweeps her face top
// to bottom, mapped 1:1 to scroll (linear), with a soft trail behind it.
//
// The scanner is the D12 line (same stroke and gradient as
// assets/svg/scan-line-d12.svg) drawn wider than the face and clipped to a face
// outline (FACE, frame px), so its length follows the face as it moves; at the
// brow (y 374.5) the clip gives exactly D12's x 757.5 → 991. A blurred copy is
// the glow; the trail is a gradient band above the line, clipped the same way.
//
// Segment fractions: headline wipes in 0–0.28 (the sub-headline already glided
// up at the end of S2, see link()), scanner fades in at the hairline 0.08–0.14,
// sweeps 0.12–0.82 (passes the brow = D12 at ~0.35), fades at the chin, then
// the headline wipes out 0.84–1 for "Step 2". A shimmer runs along the line
// while it is on screen. Pill 1 lights at the segment start (shared.js).
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import { headLines, wipeIn, wipeOut } from '../lib/wipe.js';
import { ambient } from '../lib/ambient.js';
import { FACE_B, FACE_B_TARGET } from './s2-science.js';

const { gsap } = window;

// D12 line (y) and the sweep range: hairline → chin (frame px).
const LINE_Y = 374.5;
const Y_TOP = 262;
const Y_BOT = 598;
// Face outline (frame px), traced on the D12/D13 photo.
const FACE = 'M870 262 L935 268 L972 290 L986 330 L991 374.5 L1002 420 L1006 460 L998 505 L975 548 L935 582 L885 598 ' +
  'L850 596 L808 578 L778 545 L758 500 L752 450 L754 410 L757.5 374.5 L764 330 L785 292 L822 270 Z';
const TRAIL = 120; // trail height above the line (frame px)

// One instance per build (the stage is rebuilt on breakpoint changes), so
// fixed ids with a suffix are unique.
const SCANNER = `
    <svg class="overlay scan" viewBox="0 0 1440 1024" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="scan-grad--s3" x1="757.5" y1="0" x2="991" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00816D"/>
          <stop offset="0.317308" stop-color="#00816D"/>
          <stop offset="0.490385" stop-color="#B4FFF3"/>
          <stop offset="0.644231" stop-color="#00816D"/>
          <stop offset="1" stop-color="#00816D"/>
        </linearGradient>
        <linearGradient id="scan-trail--s3" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#B4FFF3" stop-opacity="0"/>
          <stop offset="0.75" stop-color="#B4FFF3" stop-opacity="0.14"/>
          <stop offset="1" stop-color="#4DE5A1" stop-opacity="0.38"/>
        </linearGradient>
        <clipPath id="scan-face--s3"><path d="${FACE}"/></clipPath>
        <filter id="scan-blur--s3" filterUnits="userSpaceOnUse" x="680" y="${LINE_Y - 24}" width="400" height="48"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <g clip-path="url(#scan-face--s3)">
        <g class="scan__head">
          <rect class="scan__trail" x="700" y="${LINE_Y - TRAIL}" width="360" height="${TRAIL}" fill="url(#scan-trail--s3)"/>
          <path class="scan__glow" d="M700 ${LINE_Y}H1060" stroke="#B4FFF3" stroke-width="6" filter="url(#scan-blur--s3)"/>
          <path class="scan__line" d="M700 ${LINE_Y}H1060" stroke="url(#scan-grad--s3)" stroke-width="2"/>
        </g>
      </g>
    </svg>`;

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene');
  layer.append(
    photoBox('front', 12, {
      focusM: FACE_B,
      targetM: FACE_B_TARGET,
      overlays: SCANNER,
      alt: 'A glowing green scan line passes over her face from top to bottom',
    }),
    uiBox(copyBlock({ head: ['Step 1:', 'Face scan'] })),
  );
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));

  const head = layer.querySelector('.scan__head');
  const trail = layer.querySelector('.scan__trail');
  if (reduced) {
    // Static D12: the line at the brow, no trail.
    gsap.set(trail, { autoAlpha: 0 });
    return;
  }

  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;
  const lines = headLines(layer);

  wipeIn(tl, lines, p(0), { duration: 0.2 * d, stagger: 0.04 * d });

  // Scanner: appear at the hairline, sweep linearly, fade at the chin.
  gsap.set(head, { y: Y_TOP - LINE_Y, autoAlpha: 0 });
  tl.to(head, { autoAlpha: 1, duration: 0.06 * d }, p(0.08));
  tl.to(head, { y: Y_BOT - LINE_Y, duration: 0.7 * d, ease: 'none' }, p(0.12));
  tl.to(head, { autoAlpha: 0, duration: 0.06 * d }, p(0.82));

  wipeOut(tl, lines, p(0.84), { duration: 0.12 * d, stagger: 0.04 * d });

  // Shimmer: the bright stop drifts along the line (time-based, on screen only).
  const grad = layer.querySelector('linearGradient[id^="scan-grad"]');
  const shimmer = gsap.fromTo(grad, { attr: { x1: 687.5, x2: 921 } }, {
    attr: { x1: 827.5, x2: 1061 }, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true,
  });
  ambient(tl, ctx, p(0.08), p(0.88), [shimmer]);
}

// S2 → S3 reflow: S2's sub-headline glides up into the slot it has here (sub
// first in Step 1), measured from the layout so it also holds on mobile, where
// the lines wrap. CSS: .copy__sub translate = var(--k) × var(--shift).
export function link(tl, ctx) {
  const { stage, reduced } = ctx;
  if (reduced) return;
  const s2 = stage.querySelector('.layer--s2-science');
  const from = s2.querySelector('.copy__sub');
  const to = ctx.layer.querySelector('.copy__sub');
  // offsetTop ignores the glide (a translate), so it is the layout slot.
  const measure = () => {
    from.style.setProperty('--shift', `${to.offsetTop - from.offsetTop}px`);
  };
  measure();
  document.fonts?.ready.then(measure);
  window.addEventListener('resize', measure);
  ctx.onCleanup(() => window.removeEventListener('resize', measure));

  const d2 = tl.labels['s3-scan'] - tl.labels['s2-science'];
  tl.fromTo(from, { '--k': 0 }, {
    '--k': 1, duration: 0.3 * d2, ease: 'power2.inOut', immediateRender: false,
  }, tl.labels['s2-science'] + 0.7 * d2);
}
