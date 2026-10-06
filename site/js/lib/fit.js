// Frame boxes. A `.fbox` is a 1440x1024 box in Figma frame px; children are
// placed at frame coordinates. fit() scales/positions each box into its host
// (its parent element, or the viewport with data-host="viewport").
//
// Attributes (data-m-* override on mobile, < BREAKPOINT):
//   data-fit     cover | contain | contain-top | focus | none
//   data-focus   "x y w h"  frame-px rect to keep in view (focus mode)
//   data-target  "x y w h"  fractions of the host the focus rect fits into
//                (default "0 0 1 1")
//   data-fill    present → the frame must cover the host width and bottom
//                (photos). The top may stay open; mobile fades it out.
// The applied scale is exposed as --fs on the box for counter-scaling.
import { BREAKPOINT } from '../config.js';

const FW = 1440;
const FH = 1024;
const boxes = new Set();

const nums = (s) => s.trim().split(/[\s,]+/).map(Number);

function attr(el, name, mobile) {
  const own = el.getAttribute(`data-${name}`);
  return mobile ? el.getAttribute(`data-m-${name}`) ?? own : own;
}

function apply(el) {
  if (!el.isConnected) {
    boxes.delete(el);
    return;
  }
  const mobile = window.innerWidth < BREAKPOINT;
  const mode = attr(el, 'fit', mobile) || 'cover';
  if (mode === 'none') {
    el.style.transform = '';
    el.style.removeProperty('--fs');
    return;
  }
  const host = el.dataset.host === 'viewport' ? null : el.parentElement;
  const cw = host ? host.clientWidth : window.innerWidth;
  const ch = host ? host.clientHeight : window.innerHeight;

  let s;
  let x;
  let y;
  if (mode === 'focus') {
    const [fx, fy, fw, fh] = nums(attr(el, 'focus', mobile) || `0 0 ${FW} ${FH}`);
    const [tx, ty, tw, th] = nums(attr(el, 'target', mobile) || '0 0 1 1');
    const T = [tx * cw, ty * ch, tw * cw, th * ch];
    s = Math.min(T[2] / fw, T[3] / fh);
    const fill = (mobile && el.hasAttribute('data-m-fill')) || (!mobile && el.hasAttribute('data-fill'));
    if (fill) s = Math.max(s, cw / FW);
    x = T[0] + T[2] / 2 - (fx + fw / 2) * s;
    y = T[1] + T[3] / 2 - (fy + fh / 2) * s;
    if (fill) {
      x = Math.min(0, Math.max(cw - FW * s, x));
      y = Math.max(y, ch - FH * s);
    }
  } else {
    s = mode === 'cover' ? Math.max(cw / FW, ch / FH) : Math.min(cw / FW, ch / FH);
    x = (cw - FW * s) / 2;
    y = mode === 'contain-top' ? 0 : (ch - FH * s) / 2;
  }
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(5)})`;
  el.style.setProperty('--fs', s.toFixed(5));
}

export function fitAll(root = document) {
  root.querySelectorAll('.fbox').forEach((el) => boxes.add(el));
  refit();
}

export function refit() {
  boxes.forEach(apply);
  // Mobile card grid: 2 columns of 290px-wide cards scaled to fit (see scenes.css).
  const vw = document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--card-zoom', Math.min(1, (vw - 32 - 10) / 2 / 290).toFixed(4));
}

let raf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(refit);
});
