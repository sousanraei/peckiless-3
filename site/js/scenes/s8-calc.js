// S8 Step 5 Calculate (D18). Only the copy lives here; the diagram and panel
// are S7's (#diagram, #calc-panel), held on screen through this scene.
import { uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';

export function build(tl, ctx) {
  const { layer } = ctx;
  layer.classList.add('scene', 'scene--overlay');
  layer.append(uiBox(copyBlock({ head: ['Step 5:', 'Calculate'] })));
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));
}
