// S7 Step 4 Clean noises (D17). Owns the shared RGB diagram (#diagram: arrows,
// RGB box, cells, curves) and the calculation panel (#calc-panel), which stay
// on screen through S8 (D18 repeats them). T10/T11 draw into .panel__body.
import { h, svg, preloadSVG } from '../lib/dom.js';
import { uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

await preloadSVG('rgb-d17.svg');

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene', 'scene--light');

  // Desktop: both boxes contain-fit like the UI, so they line up with the
  // frame. Mobile: the diagram row sits under the copy, the panel below it.
  const diagram = h(`
    <div class="fbox diagram" id="diagram" data-fit="contain" data-m-fit="focus" data-m-focus="-28 440 718 300" data-m-target="0.02 0.33 0.96 0.24">
      ${svg('rgb-d17.svg', 'class="overlay rgb"')}
      <p class="rgb-label">RGB channels<br>Derived from facial scan</p>
    </div>`);
  const panel = h(`
    <div class="fbox panel-box" data-fit="contain" data-m-fit="focus" data-m-focus="689 178 686 583" data-m-target="0.04 0.58 0.92 0.29">
      <div class="panel" id="calc-panel"><div class="panel__body"></div></div>
    </div>`);
  // The arrows enter from off-canvas: extend their shafts far to the left so
  // they still reach the screen edge when the box is narrower than the screen.
  diagram.querySelector('[data-id="arrows"]').insertAdjacentHTML('afterbegin', `
    <g data-id="arrow-tails" fill="#F59E0B">
      <rect x="-1500" y="582.54" width="1490" height="9.1" />
      <rect x="-1500" y="669.54" width="1490" height="9.1" />
    </g>`);
  const copy = copyBlock({ head: ['Step 4:', 'Clean noises'] });
  layer.append(diagram, panel, uiBox(copy));

  const win = sceneWindow(tl, ctx.scene.id);
  const winCalc = sceneWindow(tl, 's8-calc');
  hold(tl, ctx, layer, { ...win, to: winCalc.to });
  hold(tl, ctx, copy, win);
}
