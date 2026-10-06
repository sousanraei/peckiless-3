// Line-mask wipe for headline lines (T5, shared from T6). Each line is clipped
// to its own box (padded for ascenders and descenders); out = the clip closes
// from the bottom while the line lifts, in = it opens from the top edge down
// while the line rises into place. All tweens sit on the master timeline.
const OPEN = 'inset(-30% -4% -30% -4%)';
const SHUT_UP = 'inset(-30% -4% 130% -4%)';
const SHUT_DOWN = 'inset(130% -4% -30% -4%)';

// Headline lines of a layer; `withSub` adds the gradient sub-headline, which
// is painted by its <p> (background-clip: text), so it wipes as one block.
export const headLines = (layer, withSub = false) =>
  [...layer.querySelectorAll(withSub ? '.copy__h span, .copy__sub' : '.copy__h span')];

export function wipeOut(tl, els, at, { duration, stagger, y = -28 }) {
  return tl.fromTo(els, { clipPath: OPEN, y: 0 }, {
    clipPath: SHUT_UP, y, duration, stagger, ease: 'power2.in', immediateRender: false,
  }, at);
}

// immediateRender (default true): the lines start hidden before the wipe.
export function wipeIn(tl, els, at, { duration, stagger, y = 36, immediateRender = true }) {
  return tl.fromTo(els, { clipPath: SHUT_DOWN, y }, {
    clipPath: OPEN, y: 0, duration, stagger, ease: 'power3.out', immediateRender,
  }, at);
}
