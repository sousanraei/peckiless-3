// Debug overlay, enabled with ?debug in the URL.
// Shows the current scene label, overall + segment progress, and a clickable
// list of labels that scrolls to each one (useful for screenshots/QA).

export function initDebug(app) {
  if (!new URLSearchParams(location.search).has('debug')) return;
  const el = document.getElementById('debug');
  el.hidden = false;
  el.innerHTML = `
    <div class="debug__now">scene <b data-now>–</b></div>
    <div>overall <span data-all>0</span>%</div>
    <div class="debug__bar"><i data-allbar></i></div>
    <div>segment <span data-seg>0</span>%</div>
    <div class="debug__bar"><i data-segbar></i></div>
    <ol>${app.scenes
      .map((s) => `<li data-id="${s.id}"><button type="button">${s.id}<span>${s.frames}</span></button></li>`)
      .join('')}</ol>`;

  const $ = (sel) => el.querySelector(sel);
  const items = [...el.querySelectorAll('li')];

  el.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || !app.trigger) return;
    // +1px so we land just inside the segment, not on the previous one's end.
    window.scrollTo({ top: app.trigger.labelToScroll(li.dataset.id) + 1, behavior: 'instant' });
  });

  let last = '';
  window.gsap.ticker.add(() => {
    const tl = app.master;
    if (!tl) return;
    const t = tl.time();
    const ids = app.scenes.map((s) => s.id);
    let i = ids.findLastIndex((id) => tl.labels[id] <= t + 1e-6);
    if (i < 0) i = 0;
    const start = tl.labels[ids[i]];
    const end = i + 1 < ids.length ? tl.labels[ids[i + 1]] : tl.labels.end;
    const seg = Math.min(1, Math.max(0, (t - start) / (end - start)));
    const all = tl.duration() ? t / tl.duration() : 0;

    $('[data-all]').textContent = (all * 100).toFixed(1);
    $('[data-allbar]').style.width = `${all * 100}%`;
    $('[data-seg]').textContent = (seg * 100).toFixed(1);
    $('[data-segbar]').style.width = `${seg * 100}%`;
    if (ids[i] !== last) {
      last = ids[i];
      $('[data-now]').textContent = last;
      items.forEach((li) => li.classList.toggle('is-active', li.dataset.id === last));
    }
  });
}
