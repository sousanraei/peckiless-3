// Elements shared by several scenes (listed in docs/ASSET_MAP.md):
//   #pills — the step-pill row (D11–D18). Visible from the first scene with a
//   `step` in config.js to the last; `data-active` = number of lit pills.
//   Lighting a pill: colours ease in (CSS transition) and its dot pops
//   (scrubbed, so it reverses). Mobile: the scroller follows the active pill.
import { SCENES, STEPS } from './config.js';
import { h, at } from './lib/dom.js';
import { uiBox } from './lib/ui.js';
import { sceneWindow } from './lib/static.js';

const { gsap } = window;

// Figma rects (x, w); all at y 833.5, h 64. Their 1px strokes straddle the edge.
const PILLS = [[130.5, 202], [349.5, 248], [614.5, 226], [857.5, 239], [1113.5, 196]];

export function buildShared(stage, tl, { reduced, isMobile }) {
  const layer = h('<section class="layer layer--shared" aria-label="Steps"></section>');
  const row = h(`
    <ol class="pills" id="pills" data-active="0">
      ${STEPS.map((label, i) => `
        <li class="pill at" style="${at([PILLS[i][0] - 0.5, 833, PILLS[i][1] + 1, 65])}">
          <span class="pill__dot">${i + 1}</span><span class="pill__label">${label}</span>
        </li>`).join('')}
    </ol>`);
  layer.append(uiBox(row));
  stage.append(layer);
  if (reduced) return { layer, row };

  const stepped = SCENES.filter((s) => s.step !== undefined);
  const first = sceneWindow(tl, stepped[0].id);
  const last = sceneWindow(tl, stepped.at(-1).id);
  gsap.set(layer, { autoAlpha: 0 });
  tl.set(layer, { autoAlpha: 1 }, first.from);
  tl.set(layer, { autoAlpha: 0 }, last.to);
  const dots = row.querySelectorAll('.pill__dot');
  stepped.forEach((s, i) => {
    const at = sceneWindow(tl, s.id).from;
    tl.set(row, { attr: { 'data-active': s.step } }, at);
    if (s.step > (stepped[i - 1]?.step ?? 0)) {
      tl.to(dots[s.step - 1], {
        keyframes: [
          { scale: 1.35, duration: 0.08, ease: 'power2.out' },
          { scale: 1, duration: 0.2, ease: 'back.out(3)' },
        ],
      }, at);
    }
  });
  if (isMobile) followActive(row);
  return { layer, row };
}

// Mobile pill scroller: keep the newest lit pill in view.
function followActive(row) {
  const follow = () => {
    const n = Number(row.dataset.active);
    const pill = row.children[Math.max(0, n - 1)];
    if (!pill || row.scrollWidth <= row.clientWidth) return;
    const left = Math.max(0, pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2);
    row.scrollTo({ left, behavior: 'smooth' });
  };
  new MutationObserver(follow).observe(row, { attributes: true, attributeFilter: ['data-active'] });
}
