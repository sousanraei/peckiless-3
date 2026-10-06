// Synthetic but realistic rPPG data (seeded, so every load is identical) and
// the Step 4 processing chain the S7 panel draws. Pure functions, no DOM: the
// same numbers feed T11's analysis (PSD, HRV, SpO2, respiration), so the
// constants below are what Step 5 has to "measure".
//
// Model: mean ROI colour per frame, C_c(t) = DC_c · (1 + pulse + resp + drift
// + motion) + sensor noise, at 30 fps for 16 s. The panel shows 10 s of it
// (VIEW), away from the filter edges.
//   pulse    1.2 Hz mean (72 BPM) with respiratory sinus arrhythmia, a
//            dicrotic 2nd harmonic, AC/DC per channel G > B > R
//   resp     13 breaths/min: baseline wander + pulse amplitude modulation
//   drift    slow illumination change (common to all channels) + a small
//            per-channel white-balance creep
//   motion   two head movements: a large intensity change common to all
//            channels plus a small specular (colour-neutral) part
// Processing (what the panel calls Step 4):
//   1. detrend: C̃_c = C_c / μ_c − 1 − poly3 trend      (per channel)
//   2. POS (Wang et al. 2017): in 1.6 s windows, Cn = C / mean(C),
//      X = Gn − Bn, Y = Gn + Bn − 2Rn, h = X + (σX/σY)·Y, overlap-added
//   3. band-pass 0.7–4 Hz: 2nd-order Butterworth high-pass + low-pass,
//      run forward and backward (zero-phase, 4th-order magnitude)
//   4. BVP = z-score of the band-passed signal

export const FS = 30; // frames per second
export const DURATION = 16; // s generated
export const VIEW = [3, 13]; // s shown in the panel (10 s)
export const HR_HZ = 1.2; // 72 BPM
export const RESP_HZ = 13 / 60; // 13 breaths/min
export const BAND = [0.7, 4]; // Hz (42–240 BPM)
export const POS_WIN = 1.6; // s
// AC/DC of the pulse per channel. Ratio of ratios R/B = 0.556 → with the
// camera calibration SpO2 = 110 − 25·RoR this reads 96 %.
export const AC = { r: 0.0025, g: 0.01, b: 0.0045 };
export const DC = { r: 182.4, g: 121.3, b: 96.2 }; // 8-bit means
export const SPO2_CAL = [110, 25];
export const MOTION_AT = [6.4, 11.1]; // s (absolute), centres of the movements

// ---------- seeded random ----------
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd) {
  const u = Math.max(rnd(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

// ---------- small numeric helpers ----------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

// Least-squares polynomial trend (normal equations, t scaled to [-1, 1]).
function polyTrend(y, deg = 3) {
  const n = y.length;
  const xs = y.map((_, i) => (2 * i) / (n - 1) - 1);
  const m = deg + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const p = [1];
    for (let k = 1; k < m; k++) p[k] = p[k - 1] * xs[i];
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) A[r][c] += p[r] * p[c];
      A[r][m] += p[r] * y[i];
    }
  }
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  const coef = A.map((row, i) => row[m] / row[i]);
  return xs.map((x) => coef.reduceRight((s, c) => s * x + c, 0));
}

// RBJ biquad (Butterworth, Q = 1/√2).
function biquad(type, f0, fs) {
  const w = (2 * Math.PI * f0) / fs;
  const cw = Math.cos(w);
  const al = Math.sin(w) / (2 * Math.SQRT1_2);
  const b = type === 'low' ? [(1 - cw) / 2, 1 - cw, (1 - cw) / 2] : [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2];
  const a0 = 1 + al;
  return { b: b.map((v) => v / a0), a: [1, (-2 * cw) / a0, (1 - al) / a0] };
}
function runBiquad({ b, a }, x) {
  const y = new Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const SECTIONS = () => [biquad('high', BAND[0], FS), biquad('low', BAND[1], FS)];

// Zero-phase band-pass with 2 s reflect padding against edge transients.
export function bandpass(x) {
  const pad = 2 * FS;
  const ext = [...x.slice(1, pad + 1).reverse(), ...x, ...x.slice(-pad - 1, -1).reverse()];
  let y = ext;
  for (const s of SECTIONS()) y = runBiquad(s, y);
  y.reverse();
  for (const s of SECTIONS()) y = runBiquad(s, y);
  y.reverse();
  return y.slice(pad, pad + x.length);
}

// |H(f)|² of the forward–backward cascade (= its magnitude response).
export function bandpassGain(f) {
  const w = (2 * Math.PI * f) / FS;
  let g = 1;
  for (const { b, a } of SECTIONS()) {
    const re = (c) => c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w);
    const im = (c) => -(c[1] * Math.sin(w) + c[2] * Math.sin(2 * w));
    g *= (re(b) ** 2 + im(b) ** 2) / (re(a) ** 2 + im(a) ** 2);
  }
  return g;
}

function pos(R, G, B) {
  const n = R.length;
  const l = Math.round(POS_WIN * FS);
  const H = new Array(n).fill(0);
  for (let s = 0; s + l <= n; s++) {
    const seg = (c) => {
      const w = c.slice(s, s + l);
      const m = mean(w);
      return w.map((v) => v / m);
    };
    const r = seg(R), g = seg(G), b = seg(B);
    const X = g.map((v, i) => v - b[i]);
    const Y = g.map((v, i) => v + b[i] - 2 * r[i]);
    const alpha = std(X) / std(Y);
    const h = X.map((v, i) => v + alpha * Y[i]);
    const hm = mean(h);
    for (let i = 0; i < l; i++) H[s + i] += h[i] - hm;
  }
  return H;
}

// Local maxima ≥ minDist apart and above `thr` (for the period bracket; T11
// does the full peak detection).
export function findPeaks(y, { minDist = Math.round(0.4 * FS), thr = 0.3 } = {}) {
  const out = [];
  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] < thr || y[i] < y[i - 1] || y[i] < y[i + 1]) continue;
    if (out.length && i - out.at(-1) < minDist) {
      if (y[i] > y[out.at(-1)]) out[out.length - 1] = i;
      continue;
    }
    out.push(i);
  }
  return out;
}

export function generate(seed = 0x5ec4) {
  const rnd = mulberry32(seed);
  const n = DURATION * FS;
  const t = Array.from({ length: n }, (_, i) => i / FS);
  // Pulse phase: 1.2 Hz ± 0.05 Hz RSA (mean exactly 1.2 Hz).
  const rsa = 0.05;
  const ph = t.map((x) => 2 * Math.PI * HR_HZ * x - (rsa / RESP_HZ) * Math.cos(2 * Math.PI * RESP_HZ * x));
  const resp = t.map((x) => Math.sin(2 * Math.PI * RESP_HZ * x + 0.6));
  // Pulse shape: fast upstroke, dicrotic notch (fundamental + 2 harmonics).
  const pulse = ph.map((p, i) => (Math.sin(p) + 0.32 * Math.sin(2 * p - 0.9) + 0.08 * Math.sin(3 * p - 1.6)) / 1.1 * (1 + 0.18 * resp[i]));
  const drift = t.map((x) => 0.022 * (x / DURATION) - 0.018 * Math.sin((Math.PI * x) / DURATION) + 0.004 * Math.sin(2 * Math.PI * 0.06 * x));
  const bump = (x, c, w) => Math.exp(-0.5 * ((x - c) / w) ** 2);
  const motion = t.map((x) => -0.03 * bump(x, MOTION_AT[0], 0.22) + 0.018 * bump(x, MOTION_AT[0] + 0.45, 0.18) + 0.016 * bump(x, MOTION_AT[1], 0.3));
  const creep = { r: 0.006, g: -0.004, b: 0.003 };
  const ch = {};
  for (const c of ['r', 'g', 'b']) {
    ch[c] = t.map((x, i) =>
      DC[c] * (1 + AC[c] * pulse[i] + 0.004 * resp[i] + drift[i] + creep[c] * (x / DURATION) + motion[i]) +
      0.11 * gauss(rnd)
    );
  }

  // 1. detrend + normalise (per channel)
  const norm = {};
  for (const c of ['r', 'g', 'b']) {
    const m = mean(ch[c]);
    const v = ch[c].map((x) => x / m - 1);
    const tr = polyTrend(v, 3);
    norm[c] = v.map((x, i) => x - tr[i]);
  }
  // 2. POS: global X / Y for display, overlap-added h as the signal
  const X = norm.g.map((v, i) => v - norm.b[i]);
  const Y = norm.g.map((v, i) => v + norm.b[i] - 2 * norm.r[i]);
  const S = pos(ch.r, ch.g, ch.b);
  // 3. band-pass, 4. BVP
  const bp = bandpass(S);
  const i0 = VIEW[0] * FS;
  const i1 = VIEW[1] * FS;
  const vm = mean(bp.slice(i0, i1));
  const vs = std(bp.slice(i0, i1));
  const bvp = bp.map((v) => (v - vm) / vs);

  return { t, raw: ch, norm, pos: { x: X, y: Y, s: S }, bp, bvp, i0, i1, pulse, resp };
}

export const view = (arr, d) => arr.slice(d.i0, d.i1 + 1);

// ---------- Step 5 analysis (T11) ----------
// Everything S8 shows is measured here from generate()'s output:
//   HR    Welch PSD of the BVP (8 s Hann, 50 % overlap), peak in BAND,
//         parabolic refinement → HR = 60·f₀; cross-checked by peak detection
//   HRV   inter-beat intervals from sub-sample systolic peaks → RMSSD, SDNN
//   RR    pulse-amplitude envelope (peak heights, resampled at 4 Hz) → its
//         spectral peak in 0.1–0.5 Hz
//   SpO₂  ratio of ratios: each normalised channel band-passed and regressed
//         onto the BVP per 2.5 s window, median window (motion-robust),
//         R = (AC/DC)_R / (AC/DC)_B → SpO₂ = a − b·R (SPO2_CAL)
const hann = (n) => Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

// Power spectrum of a real signal at nfft points (direct DFT, half-spectrum).
function power(x, nfft) {
  const out = new Array(nfft / 2 + 1);
  for (let k = 0; k <= nfft / 2; k++) {
    const w = (2 * Math.PI * k) / nfft;
    let re = 0, im = 0;
    for (let n = 0; n < x.length; n++) {
      re += x[n] * Math.cos(w * n);
      im -= x[n] * Math.sin(w * n);
    }
    out[k] = re * re + im * im;
  }
  return out;
}

export function welch(x, { fs = FS, seg = 8 * FS, nfft = 1024 } = {}) {
  const w = hann(seg);
  const u = w.reduce((s, v) => s + v * v, 0);
  const psd = new Array(nfft / 2 + 1).fill(0);
  let count = 0;
  for (let s = 0; s + seg <= x.length; s += seg / 2) {
    const part = x.slice(s, s + seg);
    const m = mean(part);
    power(part.map((v, i) => (v - m) * w[i]), nfft).forEach((v, k) => (psd[k] += v / (fs * u)));
    count++;
  }
  return { freqs: psd.map((_, k) => (k * fs) / nfft), psd: psd.map((v) => v / count) };
}

// Highest bin in [lo, hi] Hz, refined by a parabola through its neighbours.
function spectralPeak(freqs, p, lo, hi) {
  let k = -1;
  for (let i = 1; i < p.length - 1; i++) {
    if (freqs[i] >= lo && freqs[i] <= hi && (k < 0 || p[i] > p[k])) k = i;
  }
  const [a, b, c] = [p[k - 1], p[k], p[k + 1]];
  const d = (0.5 * (a - c)) / (a - 2 * b + c || 1);
  return freqs[k] + d * (freqs[1] - freqs[0]);
}

// Systolic peaks with sub-sample time and height (parabolic interpolation).
export function systolicPeaks(y, fs = FS) {
  return findPeaks(y, { minDist: Math.round(0.33 * fs), thr: 0.3 * std(y) }).map((i) => {
    const [a, b, c] = [y[i - 1], y[i], y[i + 1]];
    const d = (0.5 * (a - c)) / (a - 2 * b + c || 1);
    return { i, t: (i + d) / fs, y: b - 0.25 * (a - c) * d };
  });
}

export function analyse(d) {
  // Skip 1 s at each end (filter edges).
  const e0 = FS;
  const e1 = d.bvp.length - FS;
  const bvp = d.bvp.slice(e0, e1);
  const { freqs, psd } = welch(bvp);
  const f0 = spectralPeak(freqs, psd, ...BAND);

  const peaks = systolicPeaks(bvp).map((p) => ({ ...p, i: p.i + e0, t: p.t + e0 / FS }));
  const ibi = peaks.slice(1).map((p, i) => (p.t - peaks[i].t) * 1000);
  const meanIbi = mean(ibi);
  const rmssd = Math.sqrt(mean(ibi.slice(1).map((v, i) => (v - ibi[i]) ** 2)));

  // Respiration: envelope through the peak heights at 4 Hz.
  const efs = 4;
  const env = [];
  for (let s = peaks[0].t, j = 0; s <= peaks.at(-1).t; s += 1 / efs) {
    while (peaks[j + 1] && peaks[j + 1].t < s) j++;
    const a = peaks[j];
    const b = peaks[j + 1] ?? a;
    env.push(b.t > a.t ? a.y + ((s - a.t) / (b.t - a.t)) * (b.y - a.y) : a.y);
  }
  const em = mean(env);
  const ew = hann(env.length);
  const ep = power(env.map((v, i) => (v - em) * ew[i]), 1024);
  const fResp = spectralPeak(ep.map((_, k) => (k * efs) / 1024), ep, 0.1, 0.5);

  // SpO₂: pulsatile part of each DC-normalised channel, measured along the
  // BVP in 2.5 s windows (~3 beats, 50 % overlap); the median window wins, so
  // the two motion windows (ratio → 1, motion is colour-neutral) drop out.
  const ac = { r: bandpass(d.norm.r).slice(e0, e1), b: bandpass(d.norm.b).slice(e0, e1) };
  const n = Math.round(2.5 * FS);
  const wins = [];
  for (let s = 0; s + n <= bvp.length; s += Math.round(n / 2)) {
    const along = (x) => {
      let xy = 0, yy = 0;
      for (let i = s; i < s + n; i++) { xy += x[i] * bvp[i]; yy += bvp[i] * bvp[i]; }
      return xy / yy;
    };
    wins.push({ t: (s + e0 + n / 2) / FS, r: along(ac.r), b: along(ac.b) });
  }
  wins.forEach((w) => (w.ratio = w.r / w.b));
  const med = [...wins].sort((p, q) => p.ratio - q.ratio)[wins.length >> 1];
  const acdc = { r: med.r, b: med.b };
  const ratio = med.ratio;

  return {
    psd: { freqs, psd, f0 },
    peaks,
    ibi,
    hr: 60 * f0,
    hrPeaks: 60000 / meanIbi,
    meanIbi,
    rmssd,
    sdnn: std(ibi),
    fResp,
    rr: 60 * fResp,
    acdc,
    ratio,
    spo2Windows: wins,
    ac, // band-passed R / B over DC (from 1 s), for the SpO₂ plot
    spo2: SPO2_CAL[0] - SPO2_CAL[1] * ratio,
  };
}
