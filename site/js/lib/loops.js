// Vital icon loops (T3, shared with the finale in T12): time-based tweens on
// each icon glyph's [data-id="body"] (and its sparkles). The shadow and glow
// rasters never move. Periods tie in with the vitals the film reports:
// 72 bpm heartbeat, 13 breaths/min. Returned paused; lib/ambient.js plays
// them while their layer is on screen.
const { gsap } = window;

const LOOPS = {
  'heart-rate': (b) =>
    gsap.timeline({ repeat: -1, paused: true })
      .to(b, { scale: 1.14, duration: 0.11, ease: 'power2.out' })
      .to(b, { scale: 1, duration: 0.16, ease: 'power2.in' })
      .to(b, { scale: 1.08, duration: 0.1, ease: 'power2.out' })
      .to(b, { scale: 1, duration: 0.2, ease: 'power2.in' })
      .to({}, { duration: 0.26 }), // ≈ 0.83 s per beat = 72 bpm
  'blood-oxygen': (b) =>
    gsap.to(b, { rotation: 360, duration: 7, ease: 'none', repeat: -1, paused: true }),
  'blood-pressure': (b) =>
    gsap.timeline({ repeat: -1, paused: true, defaults: { transformOrigin: '50% 100%' } })
      .to(b, { scaleX: 1.1, scaleY: 0.86, duration: 0.32, ease: 'power2.in' })
      .to(b, { scaleX: 0.96, scaleY: 1.06, duration: 0.28, ease: 'power2.out' })
      .to(b, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'sine.inOut' })
      .to({}, { duration: 0.5 }),
  'breathing-rate': (b) =>
    gsap.to(b, { scale: 1.08, duration: 2.3, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true }),
  'glucose': (b) =>
    gsap.to(b, { rotation: '+=60', duration: 0.9, ease: 'power2.inOut', repeat: -1, repeatDelay: 1.1, paused: true }),
};

// icons: `.icon.icon--<name>` elements (lib/ui.js icon()).
export function iconLoops(icons) {
  return [...icons].flatMap((el) => {
    const name = Object.keys(LOOPS).find((n) => el.classList.contains(`icon--${n}`));
    const body = el.querySelector('[data-id="body"]');
    if (!name || !body) return [];
    const sparkles = el.querySelector('[data-id="sparkles"]');
    gsap.set(body, { transformOrigin: '50% 50%' });
    const loops = [LOOPS[name](body)];
    if (sparkles) {
      loops.push(gsap.to(sparkles.children, {
        opacity: 0.25, duration: 0.9, ease: 'sine.inOut', paused: true,
        stagger: { each: 0.35, repeat: -1, yoyo: true },
      }));
    }
    return loops;
  });
}
