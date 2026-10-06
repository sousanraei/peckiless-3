// Builders for the recurring pieces of the frames: photo box, UI box, copy
// block, vital chips/cards and icon stacks. Geometry comes from js/assets.js
// and the UI table in docs/ASSET_MAP.md (frame px).
import { ASSETS } from '../assets.js';
import { h, svg, boxStyle, at } from './dom.js';

// ---------- Frame boxes ----------

// Photo in a frame box: cover-fit on desktop; on mobile the `focusM` rect
// (frame px) is fitted into `targetM` (fractions of the stage).
export function photoBox(name, frame, { focusM, targetM = '0 0.4 1 0.5', overlays = '' } = {}) {
  const p = ASSETS.photos[name];
  const b = p.frames[frame];
  return h(`
    <div class="fbox photo" data-fit="cover" data-m-fit="focus" data-m-focus="${focusM}" data-m-target="${targetM}" data-m-fill>
      <img class="photo__img photo__img--${name}" src="${p.file}" alt="" decoding="async"
        style="${boxStyle([b.left, b.top, b.width, b.height])}">
      ${overlays}
    </div>`);
}

// Frame-space box that holds UI (text, chips, pills). Contain-fit on desktop
// so it matches the frame exactly at 1440x1024; plain flow layout on mobile.
export function uiBox(...children) {
  const el = h('<div class="fbox ui" data-fit="contain" data-m-fit="none"></div>');
  el.append(...children);
  return el;
}

// ---------- Copy block (eyebrow + headline + gradient sub-headline) ----------

// The sub-headline gradient is a user-space linear gradient in Figma. These are
// its endpoints relative to the sub-headline box origin (frame px), for the
// one-line (D9/D10) and two-line (D11–D19) variants. Converted to em so the
// mobile type scale keeps the same look.
const GRAD = {
  one: [[0, 18.78], [29.95, 142.73]],
  two: [[0, 37.73], [124.38, 210.57]],
};
const SUB_PX = 46.2; // desktop sub-headline font size
const STOPS = [['#0baa7a', 0], ['#087957', 0.269231], ['#ae1d72', 0.990385]];

function gradStyle(kind) {
  const [p0, p1] = GRAD[kind];
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dx, -dy);
  // Big square background centred on the gradient midpoint; the CSS gradient
  // line through it is longer than the Figma vector, so remap the stops.
  const A = 4000;
  const line = A * (Math.abs(Math.sin(ang)) + Math.abs(Math.cos(ang)));
  const a = 0.5 - len / (2 * line);
  const b = 0.5 + len / (2 * line);
  const stops = STOPS.map(([c, o]) => `${c} ${((a + o * (b - a)) * 100).toFixed(3)}%`).join(', ');
  const em = (v) => `${(v / SUB_PX).toFixed(4)}em`;
  const mx = (p0[0] + p1[0]) / 2;
  const my = (p0[1] + p1[1]) / 2;
  return `background-image:linear-gradient(${((ang * 180) / Math.PI).toFixed(3)}deg, ${stops});` +
    `background-size:${em(A)} ${em(A)};background-position:${em(mx - A / 2)} ${em(my - A / 2)}`;
}

// order: 'h-sub' (headline first) or 'sub-h'. tag: heading element.
export function copyBlock({ head, sub = ['5 steps', 'in simple language'], order = 'sub-h', grad = 'two', tag = 'h2', cls = '' }) {
  const H = `<${tag} class="copy__h">${head.map((l) => `<span>${l}</span>`).join(' ')}</${tag}>`;
  const S = `<p class="copy__sub" style="${gradStyle(grad)}">${sub.map((l) => `<span>${l}</span>`).join(' ')}</p>`;
  return h(`
    <div class="copy ${cls}">
      <p class="copy__eyebrow">Camera-based health intelligence</p>
      ${order === 'h-sub' ? H + S : S + H}
    </div>`);
}

// ---------- Vital icons ----------

// Shadow + glow rasters and the inline glyph SVG stacked in one box. The glyph's
// moving part is [data-id="body"] (T3 loops); the shadow never moves.
export function icon(name, box) {
  const ic = ASSETS.icons[name];
  return `
    <div class="icon icon--${name} at" style="${at(box)}" aria-hidden="true">
      <img class="icon__shadow" src="${ic.shadow}" alt="">
      <img class="icon__glow" src="${ic.glow}" alt="">
      ${svg(ic.glyph.replace('assets/svg/', ''), 'class="icon__glyph"')}
    </div>`;
}

// D10 vital chips. rect = the Figma rect (its 1px stroke straddles the edge).
export const CHIPS = [
  { name: 'heart-rate', label: 'Heart rate', rect: [80.5, 646.5, 254.5, 75] },
  { name: 'blood-oxygen', label: 'Blood oxygen', rect: [355, 643.5, 295, 81] },
  { name: 'blood-pressure', label: 'Blood pressure', rect: [80.5, 741.5, 325, 81] },
  { name: 'breathing-rate', label: 'Breathing rate', rect: [425.5, 741.5, 305, 81] },
  { name: 'glucose', label: 'Glucose level', rect: [80.5, 839.5, 294, 81] },
];

export function chip({ name, label, rect }) {
  const [x, y, w, hh] = rect;
  const ic = ASSETS.icons[name];
  const [ix, iy] = ic.box_in_chip;
  return `
    <li class="chip chip--${name} at" style="${at([x - 0.5, y - 0.5, w + 1, hh + 1])}">
      <span class="chip__label">${label}</span>
      ${icon(name, [ix + 0.5, iy + 0.5, ic.box[2], ic.box[3]])}
    </li>`;
}

// ---------- D19 vital cards (card-local px) ----------

export const CARDS = [
  { name: 'breathing-rate', title: 'Breathing rate', value: '13', unit: '/min', delta: '↑0.0', foot: 115.5 },
  { name: 'heart-rate', title: 'Heart rate', value: '72', unit: 'bpm', delta: '↓2.0', foot: 111.3 },
  { name: 'blood-oxygen', title: 'Blood oxygen', value: '96%', foot: 113.5 },
  {
    name: 'glucose', title: 'Glucose', value: '5.2', unit: 'mmol/L', delta: '↑5.0', foot: 115.5,
    rows: [['Ref 3.9–5.6', '3.0', 98.6]],
  },
  {
    name: 'blood-pressure', title: 'Blood pressure', value: '115/78', unit: 'mmHg', delta: '↑0.0', foot: 115.3,
    rows: [['Systolic', '115', 59.4], ['Diastolic', '78', 87.5]],
  },
];

export function card(c) {
  const box = ASSETS.cards_d19[c.name];
  const ib = ASSETS.icons_d19[c.name].box;
  const rows = (c.rows || [])
    .map(([k, v, top]) => `<div class="card__row" style="top:${top}px"><span>${k}</span><span>${v}</span></div>`)
    .join('');
  return `
    <article class="card card--${c.name} at" style="${at(box)}">
      <img class="card__chart" src="assets/svg/chart-${c.name}.svg" alt="">
      <h3 class="card__title">${c.title}</h3>
      ${icon(c.name, [ib[0] - box[0], ib[1] - box[1], ib[2], ib[3]])}
      ${rows}
      <p class="card__foot" style="top:${c.foot}px">
        <span class="card__value">${c.value}</span>${c.unit ? `<span class="card__unit">${c.unit}</span>` : ''}
        ${c.delta ? `<span class="card__delta">${c.delta}</span>` : ''}
      </p>
    </article>`;
}
