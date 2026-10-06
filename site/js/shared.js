// Elements shared by several scenes (listed in docs/ASSET_MAP.md):
//   #pills — the step-pill row (D11–D18). Visible from the first scene with a
//   `step` in config.js to the last; `data-active` = number of lit pills.
import { SCENES, STEPS } from './config.js';
import { h, at } from './lib/dom.js';
import { uiBox } from './lib/ui.js';
import { sceneWindow } from './lib/static.js';

const { gsap } = window;

// Figma rects (x, w); all at y 833.5, h 64. Their 1px strokes straddle the edge.
const PILLS = [[130.5, 202], [349.5, 248], [614.5, 226], [857.5, 239], [1113.5, 196]];

export function buildShared(stage, tl, { reduced }) {
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
  stepped.forEach((s) => tl.set(row, { attr: { 'data-active': s.step } }, sceneWindow(tl, s.id).from));
  return { layer, row };
}
