// Small DOM helpers: build elements from markup and inline the extracted SVGs.

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Inline SVG cache. Scene modules call `await preloadSVG(...)` at the top level
// (main.js awaits every module import), then use svg() synchronously in build().
const cache = new Map();
let uid = 0;

export async function preloadSVG(...names) {
  await Promise.all(
    names
      .filter((n) => !cache.has(n))
      .map(async (n) => {
        const res = await fetch(`assets/svg/${n}`);
        if (!res.ok) throw new Error(`svg ${n}: ${res.status}`);
        cache.set(n, await res.text());
      })
  );
}

// Returns the SVG markup with every id made unique (`<id>--<n>`) so the same
// file can be inlined more than once. The original id is kept as data-id, so
// scenes query parts with `[data-id="body"]` rather than `#body`.
export function svg(name, attrs = '') {
  const src = cache.get(name);
  if (!src) throw new Error(`svg ${name} not preloaded`);
  const n = ++uid;
  const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  let out = src;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}--${n}" data-id="${id}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}--${n})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${id}--${n}"`);
  }
  out = out.replace(/<title>[^<]*<\/title>/, '');
  return attrs ? out.replace('<svg ', `<svg ${attrs} `) : out;
}

// `left/top/width/height` in px from a [x, y, w, h] box.
export const boxStyle = ([x, y, w, hh]) =>
  `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;

// Frame-px placement as CSS variables, consumed by `.at` (desktop absolute
// positioning); mobile rules can then reflow the element without overrides.
export const at = ([x, y, w, hh]) => `--x:${x};--y:${y};--w:${w};--h:${hh}`;
