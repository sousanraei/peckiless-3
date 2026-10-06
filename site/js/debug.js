// Debug overlay, enabled with ?debug in the URL.
// Shows the current scene label, overall + segment progress, and a clickable
// list of labels that scrolls to each one (useful for screenshots/QA).
//
// ?debug&ref=onion (or ref=diff) also overlays the Desktop frame the static
// layout should match at the current position (50% or difference blend).
// The frames live above site/, so serve the project root for this
// (python3 -m http.server 8081 in `Claude files/`, open /site/?debug&ref=diff)
// and compare at a 1440x1024 viewport.
import { frameAt } from './lib/static.js';
import { fitAll } from './lib/fit.js';

function initRef(app, mode) {
  const box = document.createElement('div');
  box.className = 'fbox debug-ref';
  box.dataset.host = 'viewport';
  box.dataset.fit = 'contain';
  box.dataset.mode = mode === 'diff' ? 'diff' : 'onion';
  const img = new Image();
  img.alt = '';
  box.append(img);
  document.body.append(box);
  fitAll(document);
  let shown = null;
  window.gsap.ticker.add(() => {
    if (!app.master) return;
    const f = frameAt(app.master, app.master.time());
    if (f === shown) return;
    shown = f;
    img.hidden = !f;
    if (f) img.src = `../Desktop%20-%20${f}.svg`;
  });
}

// ?at=<label>[+<fraction of its segment>] scrolls straight there on load
// (e.g. ?at=s5-pixels+0.75). Add &still to detach the timeline from scroll and
// seek it directly instead (deterministic screenshots, e.g. headless Chrome).
function jumpTo(app, spec, still) {
  const [id, frac = '0.02'] = spec.split(/[+ ]/); // '+' arrives as a space
  const tl = app.master;
  const ids = app.scenes.map((s) => s.id);
  const i = ids.indexOf(id);
  if (!tl || !app.trigger || i < 0) return;
  const t0 = tl.labels[id];
  const t1 = tl.labels[ids[i + 1] ?? 'end'];
  const t = t0 + Number(frac) * (t1 - t0);
  if (still) {
    app.trigger.disable(false);
    tl.time(t);
    return;
  }
  const { start, end } = app.trigger;
  window.scrollTo({ top: start + (t / tl.duration()) * (end - start), behavior: 'instant' });
}

export function initDebug(app) {
  const params = new URLSearchParams(location.search);
  if (params.has('ref')) initRef(app, params.get('ref'));
  if (params.has('at')) requestAnimationFrame(() => jumpTo(app, params.get('at'), params.has('still')));
  if (!params.has('debug')) return;
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
