// Static schedule (T2): which composition is on screen when, with hard cuts.
// A scene is held for its own segment plus half of each neighbouring
// transition, so pausing at a transition label shows the frame it starts from
// and pausing at a scene label shows that scene. Scenes with two frames in
// `shows` switch at their midpoint. Transition tasks (T3+) replace these cuts
// with real motion; keep the windows as the anchor points.
import { SCENES } from '../config.js';

const { gsap } = window;

const labelAfter = (tl, i) => tl.labels[SCENES[i + 1]?.id ?? 'end'];

export function sceneWindow(tl, id) {
  const i = SCENES.findIndex((s) => s.id === id);
  const start = tl.labels[id];
  const end = labelAfter(tl, i);
  const prev = SCENES[i - 1];
  const next = SCENES[i + 1];
  let from = start;
  let to = end;
  if (prev?.kind === 'transition') from -= (start - tl.labels[prev.id]) / 2;
  if (next?.kind === 'transition') to += (labelAfter(tl, i + 1) - end) / 2;
  return { from, to, start, end, mid: (start + end) / 2 };
}

// Show `el` only during win.from..win.to. Under reduced motion everything stays
// visible (the stacked fallback shows every end state).
export function hold(tl, ctx, el, win) {
  if (ctx.reduced) return;
  const atStart = win.from <= 1e-6;
  gsap.set(el, { autoAlpha: atStart ? 1 : 0 });
  if (!atStart) tl.set(el, { autoAlpha: 1 }, win.from);
  if (win.to < tl.labels.end - 1e-6) tl.set(el, { autoAlpha: 0 }, win.to);
}

// Hard switch at `at`: `off` elements hide, `on` elements show. `vars` lets a
// scene set other props at the same moment (e.g. a y shift). Reduced motion
// shows the end state.
export function cut(tl, ctx, at, { off = [], on = [], vars = [] } = {}) {
  if (ctx.reduced) {
    if (off.length) gsap.set(off, { autoAlpha: 0 });
    if (on.length) gsap.set(on, { autoAlpha: 1 });
    vars.forEach(([el, v]) => gsap.set(el, v));
    return;
  }
  if (on.length) gsap.set(on, { autoAlpha: 0 });
  if (off.length) tl.set(off, { autoAlpha: 0 }, at);
  if (on.length) tl.set(on, { autoAlpha: 1 }, at);
  vars.forEach(([el, v]) => tl.set(el, v, at));
}

// Which Desktop frame the static layout shows at timeline time t.
export function frameAt(tl, t) {
  let frame = null;
  for (const s of SCENES) {
    if (!s.shows?.length) continue;
    const w = sceneWindow(tl, s.id);
    if (t + 1e-6 < w.from || t > w.to + 1e-6) continue;
    frame = s.shows.length > 1 && t >= w.mid ? s.shows[1] : s.shows[0];
  }
  return frame;
}
