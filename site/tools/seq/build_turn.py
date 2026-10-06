#!/usr/bin/env python3
"""T4: head-turn clip -> assets/seq/turn/turn-NNN.webp (frame space, 1280x910).

Inputs (all in this folder):
  turn-source.mp4        image-to-video clip, D10 photo -> D11 photo (752x560, 97 frames)
  user-first-d10.jpg     D10 photo the clip was generated from (2000x1422 = 1440x1024 frame px)
  user-last-d11.jpg      D11 photo the clip was generated towards

Every output frame is the full 1440x1024 frame box at OUT_W px wide, so T5 draws it with
the same fit as the photo boxes (frame px = OUT_W / 1440). Steps:
  1. SIFT + RANSAC similarity: clip frame 1 -> D10 photo, clip last frame -> D11 photo.
  2. Each clip frame is warped with the similarity interpolated linearly between the two,
     so the generator's framing drift is corrected at both ends.
  3. The first/last EASE frames blend into the site's own D10 / D11 photos (assets/img,
     placed per manifest), so the sequence starts and ends on exactly what the page shows.
Needs: pip3 install --user numpy opencv-python-headless Pillow
"""
import json, os, cv2, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(SITE, 'assets', 'seq', 'turn')
OUT_W, OUT_H = 1280, 910           # 1440x1024 frame box at 1280w
N_OUT = 90                         # PLAN: 60-90 frames
EASE = 6                           # frames blended into the exact end photos
QUALITY = 74

def similarity(src, dst):
    sift = cv2.SIFT_create(4000)
    ka, da = sift.detectAndCompute(cv2.cvtColor(src, cv2.COLOR_BGR2GRAY), None)
    kb, db = sift.detectAndCompute(cv2.cvtColor(dst, cv2.COLOR_BGR2GRAY), None)
    good = [m for m, n in cv2.BFMatcher().knnMatch(da, db, k=2) if m.distance < 0.75 * n.distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, ransacReprojThreshold=4)
    s, a = np.hypot(M[0, 0], M[1, 0]), np.arctan2(M[1, 0], M[0, 0])
    print(f'  {len(good)} matches, {int(inl.sum())} inliers, scale {s:.3f}, rot {np.degrees(a):.2f}deg')
    return np.array([s, a, M[0, 2], M[1, 2]])

def to_matrix(p):
    s, a, tx, ty = p
    return np.array([[s * np.cos(a), -s * np.sin(a), tx], [s * np.sin(a), s * np.cos(a), ty]])

def site_photo(name, frame):
    """The site's photo for a frame, placed in the frame box at OUT_W (as T2 places it)."""
    p = json.load(open(os.path.join(SITE, 'assets', 'img', 'manifest.json')))['photos'][name]
    pl, k = p['frames'][frame], OUT_W / 1440
    im = Image.open(os.path.join(SITE, p['file'])).convert('RGB')
    im = im.resize((round(pl['width'] * k), round(pl['height'] * k)), Image.LANCZOS)
    box = Image.new('RGB', (OUT_W, OUT_H))
    box.paste(im, (round(pl['left'] * k), round(pl['top'] * k)))
    return cv2.cvtColor(np.asarray(box), cv2.COLOR_RGB2BGR)

def main():
    cap, clip = cv2.VideoCapture(os.path.join(HERE, 'turn-source.mp4')), []
    while True:
        ok, f = cap.read()
        if not ok: break
        clip.append(f)
    print(f'clip: {len(clip)} frames, {clip[0].shape[1]}x{clip[0].shape[0]}')

    k = OUT_W / 2000                # user photos are 2000px = 1440 frame px
    ref_a = cv2.imread(os.path.join(HERE, 'user-first-d10.jpg'))
    ref_b = cv2.imread(os.path.join(HERE, 'user-last-d11.jpg'))
    print('first frame -> D10:'); pa = similarity(clip[0], ref_a)
    print('last frame  -> D11:'); pb = similarity(clip[-1], ref_b)
    pa[0] *= k; pa[2:] *= k; pb[0] *= k; pb[2:] *= k

    end_a, end_b = site_photo('hero-a-glow', '10'), site_photo('front', '11')
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.webp'): os.remove(os.path.join(OUT, f))

    idx = np.round(np.linspace(0, len(clip) - 1, N_OUT)).astype(int)
    total = 0
    for i, src in enumerate(idx):
        t = src / (len(clip) - 1)
        frame = cv2.warpAffine(clip[src], to_matrix(pa + (pb - pa) * t), (OUT_W, OUT_H),
                               flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        if i < EASE:                # smoothstep from the exact D10 photo into the clip
            w = (i / EASE) ** 2 * (3 - 2 * i / EASE)
            frame = cv2.addWeighted(end_a, 1 - w, frame, w, 0)
        elif i >= N_OUT - EASE:     # and out of the clip into the exact D11 photo
            u = (N_OUT - 1 - i) / EASE
            w = u * u * (3 - 2 * u)
            frame = cv2.addWeighted(end_b, 1 - w, frame, w, 0)
        path = os.path.join(OUT, f'turn-{i:03d}.webp')
        Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).save(path, quality=QUALITY, method=6)
        total += os.path.getsize(path)

    json.dump({'count': N_OUT, 'pattern': 'turn-{i:03d}.webp', 'pad': 3, 'px': [OUT_W, OUT_H],
               'frame': [1440, 1024], 'fps_source': 24, 'from': {'photo': 'hero-a-glow', 'frame': 10},
               'to': {'photo': 'front', 'frame': 11}, 'bytes': total},
              open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print(f'wrote {N_OUT} frames, {total / 1e6:.2f} MB -> {os.path.relpath(OUT, SITE)}')

if __name__ == '__main__':
    main()
