// Placeholder scene used for every config entry whose `module` is null.
// Shows a labelled card that fades/slides in and out across its segment, so the
// whole film can be scrubbed before real scenes exist.

export function build(tl, ctx) {
  const { scene, layer } = ctx;
  layer.classList.add('ph', `ph--${scene.kind}`);
  layer.innerHTML = `
    <div class="ph__card">
      <div class="ph__kind">${scene.kind}</div>
      <h2 class="ph__title">${scene.title}</h2>
      <div class="ph__frame">${scene.frames} · <code>${scene.id}</code></div>
    </div>`;

  if (ctx.reduced) return;

  const d = ctx.duration;
  const card = layer.querySelector('.ph__card');
  // The first scene is already on screen at scroll 0; the rest fade in.
  const first = ctx.start === 0;
  tl.fromTo(layer, { autoAlpha: first ? 1 : 0 }, { autoAlpha: 1, duration: d * 0.2, ease: 'none' }, scene.id)
    .fromTo(card, { y: first ? 0 : 60 }, { y: -60, duration: d, ease: 'none' }, scene.id)
    .to(layer, { autoAlpha: 0, duration: d * 0.2, ease: 'none' }, `${scene.id}+=${d * 0.8}`);
}
