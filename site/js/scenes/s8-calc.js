// S8 Step 5 Calculate (D18). The diagram and panel are S7's (#diagram,
// #calc-panel), held on screen through this scene. S7 (T10) leaves the panel
// on its BVP stage; S8 takes it over and draws the analysis into .panel__body
// from the same seeded recording (lib/rppg.js generate() → analyse()), so
// every number shown is measured, not typed in:
//   A  BVP with detected systolic peaks + inter-beat intervals (ms)
//   B  Welch PSD, pulse band shaded, spectral peak f₀ marked
//   C  heart-rate readout, HR = 60·f₀
//   D  HRV strip (IBI tachogram) with RMSSD / SDNN
//   E  SpO₂ ratio of ratios (R and B pulsatile AC over DC)
//   F  respiration from the pulse-amplitude envelope
// Hand-off: at the S8 label our BVP line sits exactly on S7's (same samples,
// same affine map), then S7's panel fades while the line glides into block A.
// Segment fractions: hand-off 0–0.14, A 0.08–0.28, B 0.22–0.4, C 0.34–0.48,
// D 0.46–0.62, E 0.6–0.78, F 0.74–0.9, hold to the end (t5-vitals.js takes
// it from there: BVP, PSD, HRV bars, R/B traces and the envelope morph into
// the D19 card charts). Each block gets ≥ 0.28 viewport of scroll.
import { h } from '../lib/dom.js';
import { uiBox, copyBlock } from '../lib/ui.js';
import { sceneWindow, hold } from '../lib/static.js';
import * as RP from '../lib/rppg.js';
import { BVP_PLOT } from './s7-clean.js';

const { gsap } = window;

const D = RP.generate();
const A = RP.analyse(D);

// Panel-local px (the panel is 686×583 in frame px).
const W = 686;
const H = 583;
const L = 32;
const R = 654;
const BOX = {
  bvp: [L, 64, R - L, 98], // x, y, w, h (plot area)
  psd: [L, 222, 340, 138],
  hr: [396, 206, R - 396, 172],
  hrv: [L, 418, R - L, 34],
  spo2: [L, 498, 110, 56],
  resp: [356, 498, R - 356, 56],
};
const BVP_K = 28; // px per z-score unit in block A
const BVP_CY = BOX.bvp[1] + 58; // z = 0
const SPO2_WIN = [9.5, 13]; // s shown in E
const SPAN = [1, RP.DURATION - 1]; // s analysed (filter edges skipped)

const f = (v, n = 0) => v.toFixed(n);
const sx = ([x, , w], [a, b]) => (v) => x + ((v - a) / (b - a)) * w;
const sy = ([, y, , hh], [a, b]) => (v) => y + hh - ((v - a) / (b - a)) * hh;
const line = (xs, ys, X, Y) => xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join('');
const range = (x) => [Math.min(...x), Math.max(...x)];
const pad = ([a, b], k = 0.08) => [a - (b - a) * k, b + (b - a) * k];

function markup() {
  const out = [];

  // ---------- A: BVP + peaks (S7's 10 s window) ----------
  {
    const [v0, v1] = RP.VIEW;
    const t = RP.view(D.t, D);
    const y = RP.view(D.bvp, D);
    const X = sx(BOX.bvp, [v0, v1]);
    const Y = (v) => BVP_CY - v * BVP_K;
    const pk = A.peaks.filter((p) => p.t >= v0 && p.t <= v1);
    const base = BOX.bvp[1] + BOX.bvp[3];
    const ticks = [];
    for (let s = 0; s <= v1 - v0; s += 2) {
      ticks.push(`<line x1="${X(v0 + s)}" x2="${X(v0 + s)}" y1="${base}" y2="${base + 4}"/>
        <text class="calc__tick" x="${X(v0 + s)}" y="${base + 16}" text-anchor="middle">${s}</text>`);
    }
    const ibis = pk.slice(1).map((p, i) => {
      const xm = (X(pk[i].t) + X(p.t)) / 2;
      return `<text class="calc__ibi" x="${f(xm, 1)}" y="${BOX.bvp[1] - 4}" text-anchor="middle">${f((p.t - pk[i].t) * 1000)}</text>`;
    });
    out.push(`
      <g class="calc__block" data-block="bvp">
        <text class="calc__title" x="${L}" y="34">BVP · systolic peak detection</text>
        <text class="calc__note" x="${R}" y="34" text-anchor="end">${A.peaks.length} beats / ${SPAN[1] - SPAN[0]} s · mean IBI ${f(A.meanIbi)} ms</text>
        <g class="calc__axis">
          <line x1="${L}" x2="${R}" y1="${base}" y2="${base}"/>
          ${ticks.join('')}
          <text class="calc__tick" x="${R}" y="${base + 16}" text-anchor="end" dx="22">s</text>
        </g>
        <g class="calc__ibis">${ibis.join('')}</g>
      </g>
      <g class="calc__bvp-move"><path class="calc__bvp" d="${line(t, y, X, Y)}"/></g>
      <g class="calc__peaks">${pk.map((p) => `<circle cx="${f(X(p.t), 1)}" cy="${f(Y(p.y), 1)}" r="4"/>`).join('')}</g>`);
  }

  // ---------- B: Welch PSD ----------
  {
    const FMAX = 4.5;
    const { freqs, psd, f0 } = A.psd;
    const keep = freqs.map((_, i) => i).filter((i) => freqs[i] <= FMAX);
    const fr = keep.map((i) => freqs[i]);
    const top = Math.max(...keep.map((i) => psd[i]));
    const p = keep.map((i) => psd[i] / top);
    const X = sx(BOX.psd, [0, FMAX]);
    const Y = sy(BOX.psd, [0, 1.12]);
    const [bx, by, bw, bh] = BOX.psd;
    const base = by + bh;
    const area = `${line(fr, p, X, Y)}L${X(fr.at(-1))} ${base}L${X(0)} ${base}Z`;
    const x0 = X(f0);
    const k2 = Math.round((2 * f0) / (fr[1] - fr[0]));
    const ticks = [0, 1, 2, 3, 4].map((v) => `<line x1="${X(v)}" x2="${X(v)}" y1="${base}" y2="${base + 4}"/>
      <text class="calc__tick" x="${X(v)}" y="${base + 16}" text-anchor="middle">${v}</text>`);
    out.push(`
      <g class="calc__block" data-block="psd">
        <g class="calc__frame">
          <text class="calc__title" x="${L}" y="198">Welch PSD</text>
          <text class="calc__note" x="${bx + bw}" y="198" text-anchor="end">8 s Hann · 50 % overlap</text>
          <rect class="calc__band" x="${X(RP.BAND[0])}" y="${by}" width="${X(RP.BAND[1]) - X(RP.BAND[0])}" height="${bh}"/>
          <text class="calc__bandlabel" x="${X(RP.BAND[1]) - 4}" y="${by + 12}" text-anchor="end">pulse band ${RP.BAND[0]}–${RP.BAND[1]} Hz</text>
          <g class="calc__axis">
            <line x1="${bx}" x2="${bx + bw}" y1="${base}" y2="${base}"/>
            ${ticks.join('')}
            <text class="calc__tick" x="${bx + bw}" y="${base + 16}" text-anchor="end">Hz</text>
          </g>
        </g>
        <path class="calc__psd-area" d="${area}"/>
        <path class="calc__psd" d="${line(fr, p, X, Y)}"/>
        <g class="calc__f0">
          <line class="calc__f0-line" x1="${f(x0, 1)}" x2="${f(x0, 1)}" y1="${f(Y(1), 1)}" y2="${base}"/>
          <circle cx="${f(x0, 1)}" cy="${f(Y(1), 1)}" r="4.5"/>
          <text class="calc__f0-label" x="${f(x0 + 9, 1)}" y="${f(Y(1) + 4, 1)}">f₀ = ${f(f0, 2)} Hz</text>
          <text class="calc__note" x="${f(X(2 * f0), 1)}" y="${f(Y(p[k2]) - 8, 1)}" text-anchor="middle">2f₀</text>
        </g>
      </g>`);
  }

  // ---------- C: heart-rate readout ----------
  {
    const [x, y, w, hh] = BOX.hr;
    out.push(`
      <g class="calc__block" data-block="hr">
        <rect class="calc__card" x="${x}" y="${y}" width="${w}" height="${hh}" rx="14"/>
        <text class="calc__title" x="${x + 18}" y="${y + 28}">Heart rate</text>
        <text class="calc__big" x="${x + 18}" y="${y + 100}"><tspan data-count="hr">${f(A.hr)}</tspan><tspan class="calc__unit" dx="8">BPM</tspan></text>
        <text class="calc__formula" x="${x + 18}" y="${y + 132}">HR = 60 · f₀ = 60 × ${f(A.psd.f0, 2)} Hz</text>
        <text class="calc__note" x="${x + 18}" y="${y + 154}">peak-to-peak: ${f(A.hrPeaks, 1)} BPM</text>
      </g>`);
  }

  // ---------- D: HRV strip ----------
  {
    const [x, y, w, hh] = BOX.hrv;
    const X = sx(BOX.hrv, SPAN);
    const mid = y + hh / 2;
    const dev = Math.max(...A.ibi.map((v) => Math.abs(v - A.meanIbi)));
    const bars = A.ibi.map((v, i) => {
      const xx = X(A.peaks[i + 1].t);
      const yy = mid - ((v - A.meanIbi) / dev) * (hh / 2);
      return `<line x1="${f(xx, 1)}" x2="${f(xx, 1)}" y1="${mid}" y2="${f(yy, 1)}" data-y2="${f(yy, 1)}"/><circle cx="${f(xx, 1)}" cy="${f(yy, 1)}" r="2.6"/>`;
    });
    out.push(`
      <g class="calc__block" data-block="hrv">
        <g class="calc__frame">
          <text class="calc__title" x="${L}" y="${y - 16}">HRV · inter-beat intervals</text>
          <text class="calc__note" x="${R}" y="${y - 16}" text-anchor="end">RMSSD <tspan class="calc__val" data-count="rmssd">${f(A.rmssd)}</tspan> ms · SDNN <tspan class="calc__val" data-count="sdnn">${f(A.sdnn)}</tspan> ms</text>
          <line class="calc__mid" x1="${x}" x2="${x + w}" y1="${mid}" y2="${mid}"/>
        </g>
        <g class="calc__bars">${bars.join('')}</g>
      </g>`);
  }

  // ---------- E: SpO₂ ratio of ratios ----------
  {
    // A.ac starts at SPAN[0].
    const i0 = Math.round((SPO2_WIN[0] - SPAN[0]) * RP.FS);
    const i1 = Math.round((SPO2_WIN[1] - SPAN[0]) * RP.FS);
    const t = D.t.slice(i0 + SPAN[0] * RP.FS, i1 + SPAN[0] * RP.FS);
    const r = A.ac.r.slice(i0, i1);
    const b = A.ac.b.slice(i0, i1);
    const X = sx(BOX.spo2, SPO2_WIN);
    const Y = sy(BOX.spo2, pad(range([...r, ...b]), 0.05));
    const tx = BOX.spo2[0] + BOX.spo2[2] + 14;
    const y = BOX.spo2[1];
    const pct = (v) => f(v * 100, 2);
    out.push(`
      <g class="calc__block" data-block="spo2">
        <text class="calc__title" x="${L}" y="${y - 16}">SpO₂ · ratio of ratios</text>
        <text class="calc__note" x="${BOX.resp[0] - 24}" y="${y - 16}" text-anchor="end">median of ${A.spo2Windows.length} windows</text>
        <path class="calc__ch calc__ch--b" d="${line(t, b, X, Y)}"/>
        <path class="calc__ch calc__ch--r" d="${line(t, r, X, Y)}"/>
        <text class="calc__formula" x="${tx}" y="${y + 8}">R = (AC/DC)<tspan class="calc__r">R</tspan> ÷ (AC/DC)<tspan class="calc__b">B</tspan></text>
        <text class="calc__formula" x="${tx}" y="${y + 27}">  = ${pct(A.acdc.r)} % ÷ ${pct(A.acdc.b)} % = ${f(A.ratio, 2)}</text>
        <text class="calc__formula" x="${tx}" y="${y + 50}">SpO₂ = ${RP.SPO2_CAL[0]} − ${RP.SPO2_CAL[1]}·R = <tspan class="calc__val calc__val--lg" data-count="spo2">${f(A.spo2)}</tspan> <tspan class="calc__val">%</tspan></text>
      </g>`);
  }

  // ---------- F: respiration envelope ----------
  {
    const box = BOX.resp;
    const X = sx(box, SPAN);
    const i0 = SPAN[0] * RP.FS;
    const i1 = SPAN[1] * RP.FS;
    const yy = D.bvp.slice(i0, i1);
    const Y = sy(box, pad(range(yy), 0.02));
    const pts = A.peaks.map((p) => [X(p.t), Y(p.y)]);
    // Smooth envelope through the peaks (Catmull-Rom → cubic Bézier).
    const env = pts.map(([x, y], i) => {
      if (!i) return `M${f(x, 1)} ${f(y, 1)}`;
      const p0 = pts[i - 2] ?? pts[i - 1];
      const p1 = pts[i - 1];
      const p3 = pts[i + 1] ?? [x, y];
      const c1 = [p1[0] + (x - p0[0]) / 6, p1[1] + (y - p0[1]) / 6];
      const c2 = [x - (p3[0] - p1[0]) / 6, y - (p3[1] - p1[1]) / 6];
      return `C${f(c1[0], 1)} ${f(c1[1], 1)} ${f(c2[0], 1)} ${f(c2[1], 1)} ${f(x, 1)} ${f(y, 1)}`;
    }).join('');
    out.push(`
      <g class="calc__block" data-block="resp">
        <text class="calc__title" x="${box[0]}" y="${box[1] - 16}">Respiration · pulse-amplitude envelope</text>
        <path class="calc__bvp-faint" d="${line(D.t.slice(i0, i1), yy, X, Y)}"/>
        <path class="calc__env" d="${env}"/>
        <text class="calc__note" x="${R}" y="${box[1] + box[3] + 20}" text-anchor="end">f = ${f(A.fResp, 3)} Hz → RR = <tspan class="calc__val calc__val--lg" data-count="rr">${f(A.rr)}</tspan> <tspan class="calc__val">/min</tspan></text>
      </g>`);
  }

  return `<svg class="calc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calculated vital signs: heart rate ${f(A.hr)} BPM, respiration ${f(A.rr)} per minute, SpO₂ ${f(A.spo2)} percent">${out.join('')}</svg>`;
}

export function build(tl, ctx) {
  const { layer, reduced } = ctx;
  layer.classList.add('scene', 'scene--overlay');
  layer.append(uiBox(copyBlock({ head: ['Step 5:', 'Calculate'] })));
  hold(tl, ctx, layer, sceneWindow(tl, ctx.scene.id));

  const body = ctx.stage.querySelector('#calc-panel .panel__body');
  const sp = body.querySelector('.sp'); // S7's signal panel
  const calc = h(markup());
  body.append(calc);
  if (reduced) {
    // End state: the analysis replaces S7's panel.
    if (sp) sp.style.display = 'none';
    return;
  }

  const dur = ctx.duration;
  const p = (fr) => ctx.start + fr * dur;
  const q = (sel) => calc.querySelectorAll(sel);
  const blk = (name) => calc.querySelector(`[data-block="${name}"]`);
  const draw = (els, at, len) =>
    tl.fromTo(els, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: len * dur, ease: 'power1.inOut' }, p(at));
  const fade = (els, at, len, from = {}, stagger = 0) =>
    tl.fromTo(els, { autoAlpha: 0, ...from }, {
      autoAlpha: 1, x: 0, y: 0, duration: len * dur, ease: 'power2.out', stagger: { amount: stagger * dur },
    }, p(at));
  const pop = (els, at, amount) =>
    tl.fromTo(els, { scale: 0, transformOrigin: '50% 50%' }, {
      scale: 1, duration: 0.05 * dur, ease: 'back.out(3)', stagger: { amount: amount * dur },
    }, p(at));
  // Count a number up (scrubbed, so it also counts down on the way back).
  const count = (key, at, len, decimals = 0) => {
    const el = calc.querySelector(`[data-count="${key}"]`);
    const end = Number(el.textContent);
    const o = { v: 0 };
    el.textContent = f(0, decimals);
    tl.fromTo(o, { v: 0 }, {
      v: end, duration: len * dur, ease: 'power2.out',
      onUpdate: () => (el.textContent = f(o.v, decimals)),
    }, p(at));
  };

  // ---------- Hand-off from S7's BVP stage ----------
  // Our line is drawn in block A coordinates; this matrix maps it onto S7's
  // plot (same samples, same z-score scale) and eases to identity.
  const [v0, v1] = RP.VIEW;
  const P = BVP_PLOT;
  const ax = (P.w / (R - L)) * ((v1 - v0) / P.secs);
  const ay = P.k / BVP_K;
  const from = { a: ax, d: ay, e: P.x - L * ax, f: P.y + P.h / 2 - BVP_CY * ay, sw: 2.8 };
  const to = { a: 1, d: 1, e: 0, f: 0, sw: 2 };
  const move = calc.querySelector('.calc__bvp-move');
  const bvpLine = calc.querySelector('.calc__bvp');
  const hand = { u: 0 };
  const applyMove = () => {
    const at = (k) => from[k] + (to[k] - from[k]) * hand.u;
    move.setAttribute('transform', `matrix(${at('a').toFixed(5)} 0 0 ${at('d').toFixed(5)} ${at('e').toFixed(2)} ${at('f').toFixed(2)})`);
    bvpLine.style.strokeWidth = at('sw').toFixed(2);
  };
  applyMove();
  tl.fromTo(hand, { u: 0 }, { u: 1, duration: 0.12 * dur, ease: 'power2.inOut', onUpdate: applyMove, immediateRender: false }, p(0.02));

  // Before S8 our drawing is hidden (S7's panel shows). From the label on,
  // our line covers S7's, and S7's panel fades out underneath.
  gsap.set(calc, { autoAlpha: 0 });
  tl.set(calc, { autoAlpha: 1 }, ctx.start);
  if (sp) tl.fromTo(sp, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.07 * dur, ease: 'power1.in', immediateRender: false }, p(0));

  // A — BVP frame, peaks, IBIs
  fade(blk('bvp').querySelectorAll('.calc__title, .calc__note, .calc__axis'), 0.08, 0.06, { y: 6 });
  pop(q('.calc__peaks circle'), 0.12, 0.12);
  fade(q('.calc__ibi'), 0.14, 0.04, { y: 4 }, 0.12);

  // B — PSD
  fade(blk('psd').querySelector('.calc__frame'), 0.22, 0.06, { y: 6 });
  draw(q('.calc__psd'), 0.24, 0.1);
  fade(q('.calc__psd-area'), 0.28, 0.07);
  draw(q('.calc__f0-line'), 0.33, 0.04);
  pop(q('.calc__f0 circle'), 0.33, 0);
  fade(q('.calc__f0 text'), 0.35, 0.05, { x: -6 });

  // C — HR readout
  fade(blk('hr'), 0.34, 0.06, { y: 10 });
  count('hr', 0.36, 0.1);
  fade(blk('hr').querySelectorAll('.calc__formula, .calc__note'), 0.42, 0.06, { y: 4 });

  // D — HRV strip
  fade(blk('hrv').querySelector('.calc__frame'), 0.46, 0.05, { y: 6 });
  const bars = [...q('.calc__bars line')];
  const ends = bars.map((el) => el.getAttribute('y2'));
  fade(q('.calc__bars'), 0.47, 0.01);
  tl.fromTo(bars, { attr: { y2: (i, el) => el.getAttribute('y1') } }, {
    attr: { y2: (i) => ends[i] }, duration: 0.04 * dur, ease: 'power2.out', stagger: { amount: 0.1 * dur },
  }, p(0.48));
  pop(q('.calc__bars circle'), 0.49, 0.1);
  count('rmssd', 0.5, 0.1);
  count('sdnn', 0.5, 0.1);

  // E — SpO₂
  fade(blk('spo2').querySelectorAll('.calc__title, .calc__note'), 0.6, 0.05, { y: 6 });
  draw(q('.calc__ch'), 0.61, 0.1);
  fade(blk('spo2').querySelectorAll('.calc__formula'), 0.65, 0.1, { x: -8 });
  count('spo2', 0.68, 0.1);

  // F — respiration
  fade(blk('resp').querySelector('.calc__title'), 0.74, 0.05, { y: 6 });
  fade(q('.calc__bvp-faint'), 0.75, 0.05);
  draw(q('.calc__env'), 0.77, 0.1);
  fade(blk('resp').querySelector('.calc__note'), 0.8, 0.05, { y: 4 });
  count('rr', 0.81, 0.08);
}
