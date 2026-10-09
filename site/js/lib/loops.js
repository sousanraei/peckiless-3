// Vital icon loops (shared by the D10 chips and the D19 cards): time-based
// tweens on each icon's [data-id="body"] (glow + body + highlight) or, for
// the spinning ones, its [data-id="core"] so the highlight stays lit from the
// same side. The [data-id="shadow"] on the ground never moves. Motion follows
// the reference film (artifact 8Zn8Hgc85QRnzLRf8zCzYi): heart double beat,
// O₂ and glucose spin, blood pressure squashes on its base, lungs breathe from
// the top. Returned paused; lib/ambient.js plays them while their layer is on
// screen.
const { gsap } = window;

// GSAP percentage keyframes, one ease per segment (the CSS keyframes' timing).
const keys = (el, duration, origin, frames, easeEach) =>
  gsap.to(el, {
    keyframes: { ...frames, easeEach },
    duration,
    ease: 'none',
    repeat: -1,
    paused: true,
    transformOrigin: origin,
  });

const LOOPS = {
  'heart-rate': (body) =>
    keys(body, 1.05, '50% 50%', {
      '0%': { scale: 1 }, '14%': { scale: 1.16 }, '28%': { scale: 0.97 },
      '42%': { scale: 1.09 }, '60%': { scale: 1 }, '100%': { scale: 1 },
    }, 'sine.inOut'),
  'blood-oxygen': (body, core) =>
    gsap.to(core, { rotation: 360, duration: 5, ease: 'none', repeat: -1, paused: true, transformOrigin: '50% 50%' }),
  'glucose': (body, core) =>
    gsap.to(core, { rotation: 360, duration: 7, ease: 'none', repeat: -1, paused: true, transformOrigin: '50% 50%' }),
  'blood-pressure': (body) =>
    keys(body, 1.8, '50% 100%', {
      '0%': { scaleX: 1, scaleY: 1 }, '22%': { scaleX: 1.1, scaleY: 0.84 },
      '36%': { scaleX: 0.97, scaleY: 1.04 }, '46%': { scaleX: 1.01, scaleY: 0.99 },
      '55%': { scaleX: 1, scaleY: 1 }, '100%': { scaleX: 1, scaleY: 1 },
    }, 'power2.inOut'),
  'breathing-rate': (body) =>
    keys(body, 3.6, '50% 10%', {
      '0%': { scaleX: 0.94, scaleY: 0.95 }, '45%': { scaleX: 1.1, scaleY: 1.07 },
      '100%': { scaleX: 0.94, scaleY: 0.95 },
    }, 'sine.inOut'),
};

// icons: `.icon.icon--<name>` elements (lib/ui.js icon()).
export function iconLoops(icons) {
  return [...icons].flatMap((el) => {
    const name = Object.keys(LOOPS).find((n) => el.classList.contains(`icon--${n}`));
    const body = el.querySelector('[data-id="body"]');
    if (!name || !body) return [];
    return [LOOPS[name](body, el.querySelector('[data-id="core"]'))];
  });
}
