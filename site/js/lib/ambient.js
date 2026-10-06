// Ambient loops: time-based tweens (icon loops, pulses, glows) that run on
// their own clock, separate from scroll. They play only while the master
// timeline's playhead is inside [from, to] — i.e. while their layer is on
// screen, including the scrub lag — and are never created under reduced motion.
// One ticker check per window; the loops themselves are paused when inactive.
const { gsap } = window;

export function ambient(tl, ctx, from, to, loops) {
  if (ctx.reduced || !loops.length) return;
  let on = null;
  const tick = () => {
    const t = tl.time();
    const active = t >= from && t <= to;
    if (active === on) return;
    on = active;
    loops.forEach((l) => (active ? l.play() : l.pause()));
  };
  gsap.ticker.add(tick);
  tick();
  ctx.onCleanup(() => gsap.ticker.remove(tick));
}
