"""Trace vessel centrelines over assets/img/skin.webp (D16) for the T8 pulses.

Hand-picked waypoints (skin image px) are resampled every 3px and each sample
is snapped to the centre of the vessel of its colour (the midpoint of the
mask run along the local normal), then smoothed and fitted with Catmull-Rom
cubics. Output: js/scenes/vessels-paths.js (frame px; the skin image sits at
frame (-1, 457) at 1:1) + an overlay preview PNG.

    python3 tools/vessels/trace.py [preview.png]
Needs numpy, Pillow, opencv-python-headless.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parents[2]
OFF = (-1, 457)  # skin image origin in frame px (js/assets.js photos.skin.frames[16])

# kind: 'a' = artery (red, pulses travel from the trunk up into the branches,
# trunk left → right), 'v' = vein (blue, from the branches down, right → left).
VESSELS = {
    'a-trunk': ('a', [(0, 372), (120, 388), (260, 420), (380, 452), (480, 490), (560, 498), (650, 468),
                      (730, 450), (820, 462), (900, 495), (1000, 515), (1100, 518), (1200, 495),
                      (1300, 450), (1441, 410)]),
    'a-left': ('a', [(285, 420), (272, 340), (295, 275), (335, 198)]),
    'a-mid': ('a', [(568, 488), (580, 440), (597, 380), (608, 320), (600, 252)]),
    'a-fork': ('a', [(920, 470), (870, 420), (838, 370), (830, 322)]),
    'a-right': ('a', [(1150, 460), (1160, 410), (1140, 360), (1113, 300), (1106, 212)]),
    'v-trunk': ('v', [(1441, 342), (1350, 362), (1250, 402), (1150, 442), (1050, 440), (950, 448),
                      (900, 462)]),
    'v-left': ('v', [(248, 218), (262, 282), (330, 322), (400, 352), (450, 400), (500, 440), (540, 455)]),
    'v-mid': ('v', [(382, 208), (410, 252), (416, 320), (440, 380), (468, 420)]),
    'v-right': ('v', [(862, 215), (920, 280), (962, 338), (1005, 372), (1050, 398)]),
    'v-low': ('v', [(360, 460), (262, 480), (172, 518), (72, 535)]),
}


def masks(img):
    a = img.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = ((r > 160) & (g < 140) & (b < 140)).astype(np.uint8)
    blue = ((b > 170) & (r < 150)).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))  # close the blood-cell holes
    return {'a': cv2.morphologyEx(red, cv2.MORPH_CLOSE, k), 'v': cv2.morphologyEx(blue, cv2.MORPH_CLOSE, k)}


def resample(pts, step):
    pts = np.asarray(pts, float)
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.arange(0, s[-1], step).tolist() + [s[-1]]
    return np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], 1)


def snap(pts, m, reach=26):
    H, W = m.shape
    out = []
    for i, p in enumerate(pts):
        q0 = pts[max(0, i - 3)]
        q1 = pts[min(len(pts) - 1, i + 3)]
        tx, ty = q1 - q0
        n = np.array([-ty, tx]) / (np.hypot(tx, ty) or 1)
        offs = np.arange(-reach, reach + 1)
        xs = np.clip(np.round(p[0] + offs * n[0]).astype(int), 0, W - 1)
        ys = np.clip(np.round(p[1] + offs * n[1]).astype(int), 0, H - 1)
        on = m[ys, xs] > 0
        if not on.any():
            out.append(p)
            continue
        # The run of mask pixels nearest to the waypoint.
        idx = np.flatnonzero(on)
        c = idx[np.argmin(np.abs(idx - reach))]
        lo = c
        while lo > 0 and on[lo - 1]:
            lo -= 1
        hi = c
        while hi < len(on) - 1 and on[hi + 1]:
            hi += 1
        mid = (offs[lo] + offs[hi]) / 2
        out.append(p + mid * n)
    return np.array(out)


def smooth(pts, k=7):
    if len(pts) < k:
        return pts
    ker = np.ones(k) / k
    pad = k // 2
    xs = np.convolve(np.pad(pts[:, 0], pad, mode='edge'), ker, 'valid')
    ys = np.convolve(np.pad(pts[:, 1], pad, mode='edge'), ker, 'valid')
    out = np.stack([xs, ys], 1)
    out[0], out[-1] = pts[0], pts[-1]
    return out


def to_path(pts):
    """Catmull-Rom through every ~8th point (~24px) → cubic Bézier path (frame px)."""
    keep = pts[:: 8]
    if not np.allclose(keep[-1], pts[-1]):
        keep = np.vstack([keep, pts[-1]])
    p = keep + np.array(OFF)
    d = [f'M{p[0][0]:.1f} {p[0][1]:.1f}']
    for i in range(len(p) - 1):
        p0 = p[max(0, i - 1)]
        p1, p2 = p[i], p[i + 1]
        p3 = p[min(len(p) - 1, i + 2)]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ''.join(d)


def main():
    img = np.asarray(Image.open(SITE / 'assets/img/skin.webp').convert('RGB'))
    ms = masks(img)
    res = {}
    traced = {}
    for name, (kind, way) in VESSELS.items():
        pts = resample(way, 3)
        for _ in range(2):
            pts = smooth(snap(pts, ms[kind]))
        H, W = ms[kind].shape
        on = np.mean([ms[kind][min(H - 1, int(round(y))), min(W - 1, int(round(x)))] for x, y in pts])
        print(f'{name:8s} {kind} {len(pts):4d} samples, {on * 100:5.1f}% inside the vessel')
        traced[name] = (kind, pts)
        res[name] = {'kind': kind, 'd': to_path(pts)}
    body = json.dumps(res, indent=1)
    (SITE / 'js/scenes/vessels-paths.js').write_text(
        '// Generated by tools/vessels/trace.py. Do not edit by hand; re-run the script.\n'
        '// Vessel centrelines over skin.webp in frame px. kind a = artery (red), v = vein (blue);\n'
        '// every path runs in its pulse direction.\n'
        f'export const VESSELS = {body};\n')
    if len(sys.argv) > 1:
        o = Image.fromarray(img).convert('RGB')
        o = Image.blend(o, Image.new('RGB', o.size, 'white'), 0.35)
        dr = ImageDraw.Draw(o)
        for name, (kind, pts) in traced.items():
            col = (120, 0, 0) if kind == 'a' else (0, 20, 110)
            dr.line([tuple(p) for p in pts], fill=col, width=3)
            dr.ellipse([pts[0][0] - 5, pts[0][1] - 5, pts[0][0] + 5, pts[0][1] + 5], fill=(0, 160, 0))
            dr.text(tuple(pts[len(pts) // 2] + 6), name, fill=(0, 0, 0))
        o.save(sys.argv[1])


if __name__ == '__main__':
    main()
