// S5 Pixel sampling (D14 → D15): cheek close-up with the big ROI box.
// The zoom (t2-zoom.js) lands on D14 with the D14 copy wiped in. Then
// (segment fractions): D14 holds 0–0.12; the copy reflows into the D15 order
// (sub-headline first): the sub wipes out 0.12–0.24, the headline glides down
// into its D15 slot 0.2–0.5, the sub reappears in its D15 slot 0.42–0.6,
// and at 0.62 the D14 block hands off to the identical D15 block. The swatch
// grid samples the skin in a diagonal stagger 0.24–0.84, so D15 holds from
// ~0.85 (and on into t3-skin).
import { svg, preloadSVG } from '../lib/dom.js';
import { photoBox, uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold, cut } from '../lib/static.js';
import { wipeOut, wipeIn } from '../lib/wipe.js';

const { gsap } = window;

await preloadSVG('roi-d14.svg', 'swatches-d15.svg');

const HEAD = ['Step 2:', 'ROI', 'detection'];

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene');
  const photo = photoBox('cheek', 14, {
    focusM: '643 294 709 367',
    targetM: '0.03 0.44 0.94 0.34',
    overlays: svg('roi-d14.svg', 'class="overlay roi-big"') + svg('swatches-d15.svg', 'class="overlay swatches"'),
    alt: 'Close-up of her cheek; the region box fills with a grid of sampled skin-colour pixels',
  });
  const d14 = copyBlock({ head: HEAD, order: 'h-sub', cls: 'copy--d14' });
  const d15 = copyBlock({ head: HEAD, cls: 'copy--d15' });
  layer.append(photo, uiBox(d14, d15));

  const win = sceneWindow(tl, ctx.scene.id);
  hold(tl, ctx, layer, win);
  if (reduced) {
    cut(tl, ctx, win.mid, { off: [d14], on: [d15] });
    return;
  }

  const d = ctx.duration;
  const p = (f) => ctx.start + f * d;

  // ---------- Copy reflow D14 → D15 ----------
  const head14 = d14.querySelector('.copy__h');
  const sub14 = d14.querySelector('.copy__sub');
  // Offsets from the D14 slots to the D15 ones, measured from the layout so
  // they hold on mobile too (CSS: .copy__h / .copy__sub top = --k × --shift).
  const measure = () => {
    const base = (el) => el.offsetTop - (parseFloat(getComputedStyle(el).top) || 0);
    head14.style.setProperty('--shift', `${d15.querySelector('.copy__h').offsetTop - base(head14)}px`);
    sub14.style.setProperty('--shift', `${d15.querySelector('.copy__sub').offsetTop - base(sub14)}px`);
  };
  measure();
  document.fonts?.ready.then(measure);
  window.addEventListener('resize', measure);
  ctx.onCleanup(() => window.removeEventListener('resize', measure));

  gsap.set([head14, sub14], { '--k': 0 });
  wipeOut(tl, [sub14], p(0.12), { duration: 0.12 * d, stagger: 0 });
  tl.to(head14, { '--k': 1, duration: 0.3 * d, ease: 'power2.inOut' }, p(0.2));
  tl.set(sub14, { '--k': 1 }, p(0.3)); // moved while fully clipped
  wipeIn(tl, [sub14], p(0.42), { duration: 0.18 * d, stagger: 0, immediateRender: false });
  cut(tl, ctx, p(0.62), { off: [d14], on: [d15] });

  // ---------- Swatch grid: the skin is sampled cell by cell ----------
  const cells = photo.querySelectorAll('.swatch');
  gsap.set(cells, { transformOrigin: '50% 50%' });
  tl.fromTo(cells, { opacity: 0, scale: 0.2 }, {
    opacity: 1,
    scale: 1,
    duration: 0.14 * d,
    ease: 'back.out(2.2)',
    stagger: { grid: [8, 14], from: [0, 0], amount: 0.46 * d },
  }, p(0.24));
}
