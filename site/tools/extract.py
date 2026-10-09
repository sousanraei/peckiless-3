#!/usr/bin/env python3
"""T1 asset extraction for the Pecki!less film.

Reads the Figma exports `../../Desktop - N.svg` (never modified) and writes:

  assets/img/*.webp           photos, deduped, cropped to what the frames show
  assets/img/manifest.json    per-frame placement of every photo (frame px)
  assets/svg/...              logo, vital icons (from `health icons.svg`),
                              ROI boxes, scan line, swatches, beams, RGB diagram,
                              D19 card charts
  assets/palette.json         every colour used, with counts (feeds tokens.css)
  js/assets.js                the same placement data as an ES module

Run from anywhere:  python3 site/tools/extract.py
Needs Pillow with WebP support (pip3 install --user Pillow).

Coordinate conventions
  * "frame px" = the 1440x1024 Figma frame coordinate space.
  * Files named *-dNN.svg use viewBox "0 0 1440 1024": overlay them on the frame
    1:1 (same box as the photo layer) and they line up exactly.
  * chart-*.svg are card-local: viewBox = the D19 card rect, origin at its corner.
  * Icon files: viewBox = the icon's box in D10 frame px (manifest "icons");
    D19 places the same file at manifest "icons_d19".
"""
import base64, copy, hashlib, io, json, math, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
SRC = SITE.parent
IMG = SITE / 'assets' / 'img'
SVG = SITE / 'assets' / 'svg'
FRAME_W, FRAME_H = 1440, 1024
WEBP_Q = 82

NS = 'http://www.w3.org/2000/svg'
XL = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', NS)
ET.register_namespace('xlink', XL)
q = lambda t: f'{{{NS}}}{t}'

PHOTO_NAMES = {9: 'hero-a', 10: 'hero-a-glow', 11: 'front', 12: 'front', 13: 'front',
               14: 'cheek', 15: 'cheek', 16: 'skin', 19: 'finale'}
# Placement used for the crop when a photo is shared (the others get offsets).
ICON_BY_RING = {'#22BFA6': 'heart-rate', '#4DB6E6': 'blood-oxygen', '#D44A9B': 'blood-pressure',
                '#9152BC': 'breathing-rate', '#BEA1D9': 'glucose'}


def frame_path(n):
    return SRC / f'Desktop - {n}.svg'


def load(n):
    return ET.parse(frame_path(n)).getroot()


def top_children(root):
    """Children of the frame's clip group (the drawing order)."""
    g = root.find(q('g'))
    return list(g)


def defs_of(root):
    return root.find(q('defs'))


def a(el, k, default=None):
    return el.attrib.get(k, default)


# --------------------------------------------------------------------------
# geometry: minimal SVG path flattener (absolute + relative M L H V C S Q T Z)
# --------------------------------------------------------------------------
TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?')


def flatten(d, steps=16):
    """Return a list of subpaths, each a list of (x, y)."""
    toks = TOK.findall(d)
    i, cmd = 0, None
    x = y = sx = sy = 0.0
    lc = None  # last control point for S/T
    subs, cur = [], []

    def nums(k):
        nonlocal i
        v = [float(t) for t in toks[i:i + k]]
        i += k
        return v

    def bez(p0, p1, p2, p3):
        for s in range(1, steps + 1):
            t = s / steps
            mt = 1 - t
            cur.append((mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0],
                        mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]))

    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in 'Zz':
                if cur:
                    cur.append((sx, sy))
                    subs.append(cur)
                cur = []
                x, y = sx, sy
                lc = None
                continue
        rel = cmd.islower()
        C = cmd.upper()
        ox, oy = (x, y) if rel else (0, 0)
        if C == 'M':
            px, py = nums(2)
            x, y = ox + px, oy + py
            if cur:
                subs.append(cur)
            cur = [(x, y)]
            sx, sy = x, y
            cmd = 'l' if rel else 'L'
            lc = None
        elif C == 'L':
            px, py = nums(2)
            x, y = ox + px, oy + py
            cur.append((x, y))
            lc = None
        elif C == 'H':
            (px,) = nums(1)
            x = ox + px
            cur.append((x, y))
            lc = None
        elif C == 'V':
            (py,) = nums(1)
            y = (y if rel else 0) + py
            cur.append((x, y))
            lc = None
        elif C == 'C':
            v = nums(6)
            p1 = (ox + v[0], oy + v[1]); p2 = (ox + v[2], oy + v[3]); p3 = (ox + v[4], oy + v[5])
            bez((x, y), p1, p2, p3)
            lc = p2
            x, y = p3
        elif C == 'S':
            v = nums(4)
            p1 = (2 * x - lc[0], 2 * y - lc[1]) if lc else (x, y)
            p2 = (ox + v[0], oy + v[1]); p3 = (ox + v[2], oy + v[3])
            bez((x, y), p1, p2, p3)
            lc = p2
            x, y = p3
        elif C in 'QT':
            if C == 'Q':
                v = nums(4)
                qc = (ox + v[0], oy + v[1]); p3 = (ox + v[2], oy + v[3])
            else:
                v = nums(2)
                qc = (2 * x - lc[0], 2 * y - lc[1]) if lc else (x, y)
                p3 = (ox + v[0], oy + v[1])
            p1 = (x + 2 / 3 * (qc[0] - x), y + 2 / 3 * (qc[1] - y))
            p2 = (p3[0] + 2 / 3 * (qc[0] - p3[0]), p3[1] + 2 / 3 * (qc[1] - p3[1]))
            bez((x, y), p1, p2, p3)
            lc = qc
            x, y = p3
        elif C == 'A':  # approximated as a line (not used by the elements we raster)
            v = nums(7)
            x, y = ox + v[5], oy + v[6]
            cur.append((x, y))
            lc = None
    if cur:
        subs.append(cur)
    return subs


def bbox_pts(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def union(b1, b2):
    if b1 is None:
        return list(b2)
    return [min(b1[0], b2[0]), min(b1[1], b2[1]), max(b1[2], b2[2]), max(b1[3], b2[3])]


def el_bbox(el):
    """Geometric bbox of an element subtree (ignores transforms except on clip rects)."""
    tag = el.tag.replace(f'{{{NS}}}', '')
    b = None
    if tag == 'path':
        pts = [p for s in flatten(a(el, 'd')) for p in s]
        if pts:
            b = bbox_pts(pts)
            sw = float(a(el, 'stroke-width', 0)) if a(el, 'stroke') else 0
            b = [b[0] - sw / 2, b[1] - sw / 2, b[2] + sw / 2, b[3] + sw / 2]
    elif tag == 'rect':
        x, y = float(a(el, 'x', 0)), float(a(el, 'y', 0))
        w, h = float(a(el, 'width')), float(a(el, 'height'))
        sw = float(a(el, 'stroke-width', 1)) if a(el, 'stroke') else 0
        b = [x - sw / 2, y - sw / 2, x + w + sw / 2, y + h + sw / 2]
    for c in el:
        cb = el_bbox(c)
        if cb:
            b = union(b, cb)
    return b


def r2(v):
    return round(v, 2)


# --------------------------------------------------------------------------
# rasters
# --------------------------------------------------------------------------
def parse_transform(t):
    """Return (a, d, e, f) for 'matrix(a 0 0 d e f)' or 'translate(..) scale(..)'."""
    m = re.match(r'matrix\(([^)]+)\)', t)
    if m:
        v = [float(x) for x in re.split(r'[ ,]+', m.group(1).strip())]
        assert abs(v[1]) < 1e-9 and abs(v[2]) < 1e-9, 'rotated pattern not supported'
        return v[0], v[3], v[4], v[5]
    e = f = 0.0
    sxv = syv = 1.0
    for name, args in re.findall(r'(\w+)\(([^)]+)\)', t):
        v = [float(x) for x in re.split(r'[ ,]+', args.strip())]
        if name == 'translate':
            e, f = v[0], (v[1] if len(v) > 1 else 0.0)
        elif name == 'scale':
            sxv, syv = v[0], (v[1] if len(v) > 1 else v[0])
    return sxv, syv, e, f


def photo_info(n):
    """Decode a frame's embedded photo and work out where it lands on the frame."""
    root = load(n)
    defs = defs_of(root)
    img_el = next(defs.iter(q('image')), None)
    if img_el is None:
        return None
    href = img_el.attrib.get(f'{{{XL}}}href') or img_el.attrib.get('href')
    png = base64.b64decode(href.split('base64,', 1)[1])
    iw, ih = int(img_el.attrib['width']), int(img_el.attrib['height'])
    pat = next(defs.iter(q('pattern')))
    use = pat.find(q('use'))
    sa, sd, se, sf = parse_transform(use.attrib['transform'])
    rect = next(el for el in root.iter(q('rect')) if 'pattern' in a(el, 'fill', ''))
    rx, ry = float(a(rect, 'x', 0)), float(a(rect, 'y', 0))
    rw, rh = float(rect.attrib['width']), float(rect.attrib['height'])
    # image px -> unit box (patternContentUnits=objectBoundingBox) -> frame px
    X0, Y0 = rx + rw * se, ry + rh * sf
    kx, ky = rw * sa, rh * sd  # frame px per image px
    # visible part = rect ∩ frame, mapped back to image px
    vx0, vy0 = max(rx, 0), max(ry, 0)
    vx1, vy1 = min(rx + rw, FRAME_W), min(ry + rh, FRAME_H)
    src = [(vx0 - X0) / kx, (vy0 - Y0) / ky, (vx1 - X0) / kx, (vy1 - Y0) / ky]
    return dict(frame=n, png=png, sha=hashlib.sha1(png).hexdigest()[:12], iw=iw, ih=ih,
                X0=X0, Y0=Y0, kx=kx, ky=ky, src=src)


def extract_photos(manifest):
    IMG.mkdir(parents=True, exist_ok=True)
    groups = {}
    for n, name in PHOTO_NAMES.items():
        info = photo_info(n)
        groups.setdefault(name, []).append(info)
    total = 0
    manifest['photos'] = {}
    for name, infos in groups.items():
        shas = {i['sha'] for i in infos}
        if len(shas) > 1:
            # Same name must mean same pixels; compare decoded pixels before giving up.
            ims = [Image.open(io.BytesIO(i['png'])).convert('RGB') for i in infos]
            same = all(im.size == ims[0].size and im.tobytes() == ims[0].tobytes() for im in ims)
            if not same:
                sys.exit(f'{name}: frames {[i["frame"] for i in infos]} embed different pixels')
        im = Image.open(io.BytesIO(infos[0]['png']))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.mode == 'RGBA' and im.getextrema()[3][0] == 255:
            im = im.convert('RGB')
        # crop = union over frames of the visible region, rounded outward, clamped
        u = None
        for i in infos:
            u = union(u, i['src'])
        cx0, cy0 = max(0, math.floor(u[0])), max(0, math.floor(u[1]))
        cx1, cy1 = min(im.width, math.ceil(u[2])), min(im.height, math.ceil(u[3]))
        crop = im.crop((cx0, cy0, cx1, cy1))
        out = IMG / f'{name}.webp'
        crop.save(out, 'WEBP', quality=WEBP_Q, method=6)
        size = out.stat().st_size
        total += size
        place = {}
        for i in infos:
            # where the cropped file's box sits on this frame (frame px; may overhang the frame)
            place[str(i['frame'])] = dict(left=r2(i['X0'] + cx0 * i['kx']), top=r2(i['Y0'] + cy0 * i['ky']),
                                          width=r2(crop.width * i['kx']), height=r2(crop.height * i['ky']))
        density = 1 / max(infos[0]['kx'], infos[0]['ky'])
        manifest['photos'][name] = dict(file=f'assets/img/{name}.webp', px=[crop.width, crop.height],
                                        source_px=[im.width, im.height], crop=[cx0, cy0, cx1, cy1],
                                        bytes=size, frames=place, density=r2(density))
        print(f'  img/{name}.webp {crop.width}x{crop.height} {size/1024:.0f} KB  frames {list(place)}'
              f'  ({density:.2f} source px per frame px)')
    print(f'  photos total {total/1024/1024:.2f} MB')
    return total


# --------------------------------------------------------------------------
# vector helpers
# --------------------------------------------------------------------------
URL = re.compile(r'url\(#([^)]+)\)')


def refs(el):
    out = set()
    for e in el.iter():
        for k, v in e.attrib.items():
            out.update(URL.findall(v))
            if k.endswith('href') and v.startswith('#'):
                out.add(v[1:])
    return out


def emit(path, elements, defs, viewbox, prefix, wrap_transform=None, title=None, extra_attrs=None):
    """Write a standalone SVG with the given elements and every def they need.

    Ids are rewritten to `<prefix>-<short>` so several files can be inlined in one page."""
    svg = ET.Element(q('svg'), {'viewBox': ' '.join(str(r2(v)) for v in viewbox), 'fill': 'none'})
    if extra_attrs:
        svg.attrib.update(extra_attrs)
    if title:
        ET.SubElement(svg, q('title')).text = title
    body = [copy.deepcopy(e) for e in elements]
    # collect defs transitively
    by_id = {d.attrib['id']: d for d in defs.iter() if 'id' in d.attrib}
    need, stack = [], []
    for e in body:
        stack += list(refs(e))
    seen = set()
    while stack:
        i = stack.pop()
        if i in seen or i not in by_id:
            continue
        seen.add(i)
        need.append(i)
        stack += list(refs(by_id[i]))
    rename = {}
    for i in need:
        short = re.sub(r'_\d+_\d+$', '', i)
        rename[i] = f'{prefix}-{short}'
    out_defs = []
    for i in need:
        d = copy.deepcopy(by_id[i])
        out_defs.append(d)

    def fix(e):
        for x in e.iter():
            for k, v in list(x.attrib.items()):
                if k == 'id' and v in rename:
                    x.attrib[k] = rename[v]
                elif 'url(#' in v:
                    x.attrib[k] = URL.sub(lambda m: f'url(#{rename.get(m.group(1), m.group(1))})', v)
                elif k.endswith('href') and v.startswith('#') and v[1:] in rename:
                    x.attrib[k] = '#' + rename[v[1:]]
    for e in body + out_defs:
        fix(e)
    if out_defs:
        dd = ET.SubElement(svg, q('defs'))
        dd.extend(out_defs)
    parent = svg
    if wrap_transform:
        parent = ET.SubElement(svg, q('g'), {'transform': wrap_transform})
    parent.extend(body)
    ET.indent(svg, space='  ')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ET.tostring(svg, encoding='unicode') + '\n')
    return path


def frame_svg(name, elements, defs, title, extra=None):
    return emit(SVG / name, elements, defs, (0, 0, FRAME_W, FRAME_H), Path(name).stem, title=title,
                extra_attrs=extra)


def with_id(el, i):
    e = copy.deepcopy(el)
    e.attrib['id'] = i
    return e


def group(id_, children, **attrs):
    g = ET.Element(q('g'), {'id': id_, **attrs})
    g.extend(copy.deepcopy(c) for c in children)
    return g


# --------------------------------------------------------------------------
# icons
# --------------------------------------------------------------------------
# Icon drawings come from `health icons.svg` (Oct 2026 set: no rings or
# sparkles; glow + shadow stay vector). Each icon is a run of top-level
# elements: shadow <g filter> (stays put), glow <g filter>, radial body, white
# overlay, highlight(s), and for the lungs a stem stroke. Named by glow colour.
ICONS_SRC = SRC / 'health icons.svg'
ICON_BY_GLOW = {'#0D834F': 'heart-rate', '#8EE6F2': 'blood-oxygen', '#F28CC0': 'blood-pressure',
                '#B9A6F0': 'breathing-rate', '#ED7D1C': 'glucose'}


def first_pt(d):
    x, y = re.findall(r'-?[\d.]+', d)[:2]
    return float(x), float(y)


def icon_set():
    """name -> dict(shadow, glow, core, hl, body) from health icons.svg (its own coordinates)."""
    root = ET.parse(ICONS_SRC).getroot()
    kids = [e for e in root if e.tag != q('defs') and not (e.tag == q('rect') and a(e, 'fill') == 'white')]
    runs, cur = [], None
    for e in kids:
        if e.tag == q('g') and a(e, 'filter') and float(a(e, 'opacity', 1)) < 0.4:
            cur = [e]
            runs.append(cur)
        else:
            cur.append(e)
    out = {}
    for run in runs:
        shadow, glow = run[0], run[1]
        name = ICON_BY_GLOW[glow.find(q('path')).attrib['fill']]
        body = next(e for e in run if e.tag == q('path') and 'radial' in a(e, 'fill', ''))
        # highlights: white paths after the overlay group; the rest moves as the body
        hl = [e for e in run[2:] if e.tag == q('path') and a(e, 'fill') == 'white']
        core = [e for e in run[1:] if e not in hl]
        out[name] = dict(shadow=shadow, glow=glow, core=core, hl=hl, body=body)
    return out, defs_of(root)


def icon_box(ic, defs, dx=0.0, dy=0.0):
    """Bbox of all of an icon's layers + its filter regions, offset by (dx, dy)."""
    box = None
    for e in [ic['shadow'], *ic['core'], *ic['hl']]:
        box = union(box, el_bbox(e))
    for g_ in (ic['shadow'], ic['glow']):
        f = defs.find(f".//*[@id='{URL.search(g_.attrib['filter']).group(1)}']")
        fx, fy = float(f.attrib['x']), float(f.attrib['y'])
        box = union(box, [fx, fy, fx + float(f.attrib['width']), fy + float(f.attrib['height'])])
    return [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy]


def extract_icons(manifest):
    """Vital icons: one SVG per icon (#shadow stays put; #body moves, holding
    #core = glow + body + overlay, and #hl = specular highlight), placed where
    D10's icons sit. D19 uses the same drawings; record where each sits there."""
    icons, idefs = icon_set()
    root = load(10)
    kids = top_children(root)
    chip_idx = [i for i, e in enumerate(kids) if e.tag == q('rect') and a(e, 'fill') == '#00816D']
    manifest['icons'] = {}
    (SVG / 'icons').mkdir(parents=True, exist_ok=True)
    for old in (SVG / 'icons').glob('*.webp'):
        old.unlink()  # pre-Oct 2026 rasterised shadow/glow layers
    offsets = {}
    for ci, start in enumerate(chip_idx):
        end = chip_idx[ci + 1] if ci + 1 < len(chip_idx) else len(kids)
        chip = kids[start]
        els = kids[start + 3:end]
        ring = next(e for e in els if e.tag == q('path') and a(e, 'stroke-opacity'))
        name = ICON_BY_RING[ring.attrib['stroke']]
        old_body = next(e for e in els if e.tag == q('path') and 'radial' in a(e, 'fill', ''))
        ic = icons[name]
        (ox, oy), (nx, ny) = first_pt(old_body.attrib['d']), first_pt(ic['body'].attrib['d'])
        dx, dy = ox - nx, oy - ny  # same drawing, new file's coordinates -> D10 frame px
        offsets[name] = (dx, dy)
        b = icon_box(ic, idefs, dx, dy)
        box = [math.floor(b[0]) - 1, math.floor(b[1]) - 1, math.ceil(b[2]) + 1, math.ceil(b[3]) + 1]
        w, h = box[2] - box[0], box[3] - box[1]
        g_body = group('body', [group('core', ic['core']), group('hl', ic['hl'])])
        emit(SVG / 'icons' / f'{name}-glyph.svg', [group('shadow', [ic['shadow']]), g_body], idefs,
             (box[0], box[1], w, h), f'ic-{name}', wrap_transform=f'translate({r2(dx)} {r2(dy)})',
             title=f'{name} icon')
        bb = el_bbox(ic['body'])
        cx, cy = float(chip.attrib['x']), float(chip.attrib['y'])
        manifest['icons'][name] = dict(
            glyph=f'assets/svg/icons/{name}-glyph.svg', box=[box[0], box[1], w, h],
            box_in_chip=[r2(box[0] - cx), r2(box[1] - cy)],
            body_center=[r2((bb[0] + bb[2]) / 2 + dx), r2((bb[1] + bb[3]) / 2 + dy)])
        print(f'  icons/{name}: box {w}x{h} at {box[0]},{box[1]}')
    # D19 (Oct 2026): the same drawings at full size, found by glow colour.
    k19 = top_children(load(19))
    manifest['icons_d19'] = {}
    for e in k19:
        p = e.find(q('path')) if e.tag == q('g') and a(e, 'filter') else None
        if p is None or float(a(e, 'opacity', 1)) < 0.4 or a(p, 'fill') not in ICON_BY_GLOW:
            continue
        name = ICON_BY_GLOW[p.attrib['fill']]
        (gx, gy), (nx, ny) = first_pt(p.attrib['d']), first_pt(icons[name]['glow'].find(q('path')).attrib['d'])
        dx, dy = offsets[name]
        b = manifest['icons'][name]['box']
        manifest['icons_d19'][name] = dict(box=[r2(b[0] - dx + gx - nx), r2(b[1] - dy + gy - ny), b[2], b[3]], scale=1)


# --------------------------------------------------------------------------
# frame-space vector pieces
# --------------------------------------------------------------------------
def nav_logo(manifest):
    root = load(9)
    logo = [e for e in top_children(root) if e.tag == q('path') and a(e, 'fill') == '#4DE5A1']
    b = None
    for e in logo:
        b = union(b, el_bbox(e))
    b = [math.floor(b[0]), math.floor(b[1]), math.ceil(b[2]), math.ceil(b[3])]
    emit(SVG / 'logo.svg', logo, defs_of(root), (b[0], b[1], b[2] - b[0], b[3] - b[1]), 'logo',
         title='Pecki!less')
    manifest['logo'] = dict(file='assets/svg/logo.svg', box=[b[0], b[1], b[2] - b[0], b[3] - b[1]])
    print(f'  logo.svg {b[2]-b[0]}x{b[3]-b[1]} at {b[0]},{b[1]}')


def scan_line(manifest):
    root = load(12)
    line = next(e for e in top_children(root) if e.tag == q('path') and 'linear' in a(e, 'stroke', ''))
    frame_svg('scan-line-d12.svg', [with_id(line, 'scan-line')], defs_of(root), 'D12 scan line')
    manifest['vectors']['scan-line-d12'] = dict(bbox=[r2(v) for v in el_bbox(line)])


def roi(manifest):
    root = load(13)
    rects = [e for e in top_children(root) if e.tag == q('rect') and a(e, 'stroke') == '#44B3A2']
    names = {}
    for e in rects:
        x = float(e.attrib['x'])
        names[x] = e
    xs = sorted(names)
    # forehead = the wide one; the two small ones by viewer-side position
    fore = max(rects, key=lambda e: float(e.attrib['width']))
    small = sorted([e for e in rects if e is not fore], key=lambda e: float(e.attrib['x']))
    out = [with_id(fore, 'roi-forehead'), with_id(small[0], 'roi-cheek-left'), with_id(small[1], 'roi-cheek-right')]
    frame_svg('roi-d13.svg', out, defs_of(root), 'D13 regions of interest')
    manifest['vectors']['roi-d13'] = {e.attrib['id']: [float(e.attrib[k]) for k in ('x', 'y', 'width', 'height')]
                                      for e in out}
    root14 = load(14)
    big = next(e for e in top_children(root14) if e.tag == q('rect') and a(e, 'stroke') == '#44B3A2')
    frame_svg('roi-d14.svg', [with_id(big, 'roi-big')], defs_of(root14), 'D14 cheek region of interest')
    manifest['vectors']['roi-d14'] = {'roi-big': [float(big.attrib[k]) for k in ('x', 'y', 'width', 'height')]}


def swatches(manifest):
    root = load(15)
    sw = [e for e in top_children(root) if e.tag == q('rect') and a(e, 'rx') == '12' and a(e, 'fill', '').startswith('#')]
    xs = sorted({float(e.attrib['x']) for e in sw})
    ys = sorted({float(e.attrib['y']) for e in sw})
    out = []
    grid = []
    for e in sw:
        c, r = xs.index(float(e.attrib['x'])), ys.index(float(e.attrib['y']))
        ee = with_id(e, f'sw-{r}-{c}')
        ee.attrib['class'] = 'swatch'
        ee.attrib['data-row'], ee.attrib['data-col'] = str(r), str(c)
        out.append(ee)
        grid.append((r, c, e.attrib['fill']))
    frame_svg('swatches-d15.svg', [group('swatches', out)], defs_of(root), 'D15 skin colour samples')
    rows = [[None] * len(xs) for _ in ys]
    for r, c, f in grid:
        rows[r][c] = f
    manifest['vectors']['swatches-d15'] = dict(cols=len(xs), rows=len(ys), cell=[38.8571, 30.75], rx=12,
                                               origin=[xs[0], ys[0]], step=[r2(xs[1] - xs[0]), r2(ys[1] - ys[0])],
                                               colors=rows)
    print(f'  swatches-d15.svg {len(xs)}x{len(ys)} = {len(sw)} cells')


def beams(manifest):
    root = load(16)
    kids = [e for e in top_children(root) if e.tag == q('path') and a(e, 'stroke') == '#F59E0B']
    # drawing order in D16: line, its arrowhead, line, head, ...  (see ASSET_MAP for the story)
    names = ['beam-in', 'beam-specular', 'beam-out', 'tissue-out', 'tissue-in']
    out = []
    for i, n in enumerate(names):
        line, head = kids[2 * i], kids[2 * i + 1]
        out.append(group(n, [with_id(line, f'{n}-line'), with_id(head, f'{n}-head')]))
    pills = [e for e in top_children(root) if e.tag == q('rect') and a(e, 'stroke') == '#F59E0B']
    frame_svg('beams-d16.svg', out, defs_of(root), 'D16 light paths')
    manifest['vectors']['beams-d16'] = dict(
        paths={n: kids[2 * i].attrib['d'] for i, n in enumerate(names)},
        label_pills=[[float(e.attrib[k]) for k in ('x', 'y', 'width', 'height')] for e in pills],
        stroke_width=10, dasharray='31 20')


def rgb_diagram(manifest):
    root = load(17)
    kids = top_children(root)
    arrows = [e for e in kids if e.tag == q('path') and a(e, 'fill') == '#F59E0B']
    arrows.sort(key=lambda e: el_bbox(e)[1])
    box = next(e for e in kids if e.tag == q('rect') and a(e, 'stroke') == '#44B3A2')
    cells = [e for e in kids if e.tag == q('rect') and a(e, 'rx') == '8']
    curves = [e for e in kids if e.tag == q('path') and (a(e, 'stroke') == '#01AEFF' or a(e, 'fill') in ('#00816D', '#EF4444'))]
    panel = next(e for e in kids if e.tag == q('rect') and a(e, 'fill') == '#F3F3F3' and a(e, 'rx') == '26')
    rows = {'#EF4444': 'r', '#00816D': 'g', '#01AEFF': 'b'}
    cell_groups = []
    for col, ch in rows.items():
        cs = sorted([c for c in cells if a(c, 'fill') == col], key=lambda e: float(e.attrib['x']))
        cell_groups.append(group(f'cells-{ch}', [with_id(c, f'cell-{ch}-{i}') for i, c in enumerate(cs)]))
    curve_ids = {'#EF4444': 'curve-r', '#00816D': 'curve-g', '#01AEFF': 'curve-b'}
    cur = [with_id(c, curve_ids[a(c, 'fill') if a(c, 'fill', 'none') != 'none' else a(c, 'stroke')]) for c in curves]
    # centrelines of the two outlined arrows, for T9's beam -> arrow morph (hidden by default)
    cl = []
    for i, ar in enumerate(arrows):
        b = el_bbox(ar)
        yc = r2((b[1] + b[3]) / 2)
        cl.append(ET.Element(q('path'), {'id': f'arrow-{i}-centerline', 'd': f'M-24 {yc}H352',
                                         'stroke': '#F59E0B', 'stroke-width': '9.1', 'stroke-linecap': 'round'}))
    out = [group('arrows', [with_id(ar, f'arrow-{i}') for i, ar in enumerate(arrows)]),
           group('arrow-centerlines', cl, visibility='hidden'),
           group('curves', cur),
           with_id(box, 'rgb-box'), group('cells', cell_groups),
           with_id(panel, 'calc-panel')]
    frame_svg('rgb-d17.svg', out, defs_of(root), 'D17 RGB channels diagram')
    manifest['vectors']['rgb-d17'] = dict(
        rgb_box=[float(box.attrib[k]) for k in ('x', 'y', 'width', 'height')],
        panel=[float(panel.attrib[k]) for k in ('x', 'y', 'width', 'height')],
        arrows_y=[r2((el_bbox(x)[1] + el_bbox(x)[3]) / 2) for x in arrows],
        cell=[24, 24], cell_step=28, note='D18 repeats this diagram (arrow outlines differ by <0.01px)')
    print(f'  rgb-d17.svg arrows {len(arrows)} cells {len(cells)} curves {len(cur)}')


def d19_charts(manifest):
    root = load(19)
    defs = defs_of(root)
    kids = top_children(root)
    cards = [e for e in kids if e.tag == q('rect') and a(e, 'rx') and a(e, 'fill') in ('#CEFAF3', '#CDF4F3')]
    card_names = {}
    # name each card by the icon glow that sits inside it
    glows = [e for e in kids if e.tag == q('g') and a(e, 'filter') and e.find(q('path')) is not None
             and a(e.find(q('path')), 'fill') in ICON_BY_GLOW]
    for c in cards:
        x, y, w, h = (float(c.attrib[k]) for k in ('x', 'y', 'width', 'height'))
        for g_ in glows:
            gb = el_bbox(g_)
            if x <= gb[0] <= x + w and y <= gb[1] <= y + h:
                card_names[ICON_BY_GLOW[g_.find(q('path')).attrib['fill']]] = [x, y, w, h]
    manifest['cards_d19'] = {k: [r2(v) for v in b] for k, b in card_names.items()}

    def clip_bbox(e):
        """bbox of a clip-path group = its clip rect (the wave paths overhang it)."""
        if not a(e, 'clip-path'):
            return el_bbox(e)
        cid = URL.search(e.attrib['clip-path']).group(1)
        cr = defs.find(f".//*[@id='{cid}']/{q('rect')}")
        if cr is None:
            return el_bbox(e)
        tx, ty = re.findall(r'-?[\d.]+', cr.attrib.get('transform', 'translate(0 0)'))[:2]
        return [float(tx), float(ty), float(tx) + float(cr.attrib['width']), float(ty) + float(cr.attrib['height'])]

    def inside(e, b):
        eb = clip_bbox(e)
        return eb and eb[0] >= b[0] - 2 and eb[1] >= b[1] - 2 and eb[0] <= b[0] + b[2] and eb[3] <= b[1] + b[3] + 2

    pink = '#CE73A8'

    def is_chart(e):
        if a(e, 'clip-path') and e.find(q('path')) is not None:
            p = e.findall(q('path'))
            return any(a(x, 'stroke') == pink or a(x, 'fill') == pink for x in p)
        return a(e, 'fill') == pink or a(e, 'stroke') == pink
    for name, b in card_names.items():
        parts = [e for e in kids if is_chart(e) and inside(e, b)]
        if not parts:
            continue
        cb = None
        for p in parts:
            cb = union(cb, clip_bbox(p))
        emit(SVG / f'chart-{name}.svg', [group('chart', parts)], defs, (0, 0, b[2], b[3]), f'ch-{name}',
             wrap_transform=f'translate({-b[0]} {-b[1]})', title=f'{name} card chart (card-local)')
        manifest['vectors'][f'chart-{name}'] = dict(card=[r2(v) for v in b],
                                                    chart_box_in_card=[r2(cb[0] - b[0]), r2(cb[1] - b[1]),
                                                                       r2(cb[2] - cb[0]), r2(cb[3] - cb[1])],
                                                    parts=len(parts))
        print(f'  chart-{name}.svg parts {len(parts)}')
    # The Oct 2026 D19 has no connector lines between the cards and the body.
    (SVG / 'connectors-d19.svg').unlink(missing_ok=True)


# --------------------------------------------------------------------------
# palette
# --------------------------------------------------------------------------
def palette(manifest):
    counts = {}
    for n in range(9, 20):
        s = frame_path(n).read_text()
        s = re.sub(r'base64,[A-Za-z0-9+/=]+', '', s)
        for m in re.finditer(r'(fill|stroke|stop-color)="(#[0-9A-Fa-f]{6})"', s):
            c = m.group(2).upper()
            counts.setdefault(c, set()).add(n)
    out = {c: sorted(f) for c, f in sorted(counts.items(), key=lambda kv: (-len(kv[1]), kv[0]))}
    (SITE / 'assets').mkdir(exist_ok=True)
    (SITE / 'assets' / 'palette.json').write_text(json.dumps(out, indent=1) + '\n')
    print(f'  palette.json {len(out)} colours')


def main():
    manifest = {'frame': [FRAME_W, FRAME_H], 'vectors': {}}
    print('photos'); extract_photos(manifest)
    print('vectors'); nav_logo(manifest); extract_icons(manifest); scan_line(manifest); roi(manifest)
    swatches(manifest); beams(manifest); rgb_diagram(manifest); d19_charts(manifest)
    print('palette'); palette(manifest)
    (IMG / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    js = ('// Generated by tools/extract.py. Do not edit by hand; re-run the script.\n'
          '// Frame px = the 1440x1024 Figma frame space. See docs/ASSET_MAP.md.\n'
          f'export const ASSETS = {json.dumps(manifest, indent=1)};\n')
    (SITE / 'js' / 'assets.js').write_text(js)
    weight = sum(p.stat().st_size for p in (SITE / 'assets').rglob('*') if p.is_file())
    print(f'total assets/ weight {weight/1024/1024:.2f} MB')


if __name__ == '__main__':
    main()
