// Reduced motion (T14): the stacked scenes fade in once as they scroll into
// view. Opacity only (CSS transition on .layer, see scenes.css) — nothing
// moves, scales or loops. Returns a teardown for the matchMedia rebuild.
export function reveal(stage) {
  const layers = [...stage.querySelectorAll('.layer')].filter((l) => l.dataset.kind === 'scene');
  if (!('IntersectionObserver' in window)) return () => {};
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('is-veiled');
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  layers.forEach((l, i) => {
    if (i === 0) return; // the first scene is on screen at load
    l.classList.add('is-veiled');
    io.observe(l);
  });
  return () => {
    io.disconnect();
    layers.forEach((l) => l.classList.remove('is-veiled'));
  };
}
