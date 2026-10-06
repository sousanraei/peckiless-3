// Debug overlay, enabled with ?debug in the URL.
// Shows the current scene label, overall + segment progress, and a clickable
// list of labels that scrolls to each one (useful for screenshots/QA).
//
// The overlay also shows the frame rate (rolling 1 s) and the worst frame.
// ?debug&autoscroll[=seconds] scrolls the whole film forward then back at a
// steady pace (native scroll, default 40 s each way) and prints the frame
// rate per scene with console.table (T15 perf QA; needs a visible tab).
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

const sceneAt = (app, t) => {
  const ids = app.scenes.map((s) => s.id);
  return ids[Math.max(0, ids.findLastIndex((id) => app.master.labels[id] <= t + 1e-6))];
};

// Frame timing from rAF: rolling fps + worst frame for the overlay, and
// per-scene stats while an autoscroll run records.
function initFps(app, out) {
  let prev = 0;
  let win = [];
  let rec = null;
  const loop = (now) => {
    if (prev) {
      const dt = now - prev;
      win.push([now, dt]);
      while (win.length && now - win[0][0] > 1000) win.shift();
      if (rec && app.master) (rec[sceneAt(app, app.master.time())] ??= []).push(dt);
      if (out) {
        out.fps.textContent = win.length;
        out.worst.textContent = Math.max(...win.map((w) => w[1])).toFixed(1);
      }
    }
    prev = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return {
    start() { rec = {}; },
    stop() {
      const r = rec;
      rec = null;
      return Object.fromEntries(app.scenes.filter((s) => r[s.id]).map((s) => {
        const d = r[s.id].slice().sort((a, b) => a - b);
        const mean = d.reduce((a, b) => a + b, 0) / d.length;
        return [s.id, {
          fps: Math.round(1000 / mean),
          p95ms: +d[Math.floor(d.length * 0.95)].toFixed(1),
          worstms: +d.at(-1).toFixed(1),
          over20ms: d.filter((x) => x > 20).length,
          frames: d.length,
        }];
      }));
    },
  };
}

function autoscroll(app, fps, seconds) {
  const { start, end } = app.trigger;
  const leg = (from, to) => new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (seconds * 1000));
      window.scrollTo({ top: from + (to - from) * k, behavior: 'instant' });
      if (k < 1) requestAnimationFrame(step);
      else setTimeout(done, 600); // let the scrub settle
    };
    requestAnimationFrame(step);
  });
  window.scrollTo({ top: start, behavior: 'instant' });
  setTimeout(async () => {
    fps.start();
    await leg(start, end);
    const forward = fps.stop();
    fps.start();
    await leg(end, start);
    const reverse = fps.stop();
    console.log('[autoscroll] forward');
    console.table(forward);
    console.log('[autoscroll] reverse');
    console.table(reverse);
    app.perf = { forward, reverse };
  }, 1500);
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
    <div>fps <span data-fps>–</span> · worst <span data-worst>–</span> ms</div>
    <ol>${app.scenes
      .map((s) => `<li data-id="${s.id}"><button type="button">${s.id}<span>${s.frames}</span></button></li>`)
      .join('')}</ol>`;

  const $ = (sel) => el.querySelector(sel);
  const items = [...el.querySelectorAll('li')];
  const fps = initFps(app, { fps: $('[data-fps]'), worst: $('[data-worst]') });
  if (params.has('autoscroll') && app.trigger) {
    autoscroll(app, fps, Number(params.get('autoscroll')) || 40);
  }

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
