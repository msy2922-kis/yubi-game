import os
# 생성된 원본 이미지 -> 게임용 에셋 (배경 제거, 크롭, 축소)
import sys
from PIL import Image
from collections import deque
RAW = '/home/rica/game/img/raw/'; OUT = '/home/rica/game/img/'
S = Image.Resampling.LANCZOS

def magenta_mask(im):
    px = im.load(); w, h = im.size
    m = [[False]*w for _ in range(h)]
    for y in range(h):
        row = m[y]
        for x in range(w):
            r, g, b = px[x, y][:3]
            row[x] = r >= 100 and g <= 125 and b >= 60 and r > g + 40 and b > g + 15
    return m

def key_out(im, all_magenta=True):
    """가장자리에서 이어진 마젠타 계열 픽셀을 투명하게."""
    im = im.convert('RGBA'); w, h = im.size; m = magenta_mask(im)
    seen = [[False]*w for _ in range(h)]; q = deque()
    for x in range(w):
        for y in (0, h-1):
            if m[y][x] and not seen[y][x]: seen[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            if m[y][x] and not seen[y][x]: seen[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and m[ny][nx]:
                seen[ny][nx] = True; q.append((nx, ny))
    px = im.load()
    for y in range(h):
        for x in range(w):
            if seen[y][x] or (all_magenta and m[y][x]): px[x, y] = (0, 0, 0, 0)
    return im

def longest_run(vals, thr):
    best=(0,0); start=None
    for i,v in enumerate(list(vals)+[1.0]):
        if v < thr:
            if start is None: start=i
        elif start is not None:
            if i-start > best[1]-best[0]: best=(start,i)
            start=None
    return best

def strip_frame(im, thr=0.85):
    """프레임 선(거의 꽉 찬 불투명 줄)으로 둘러싸인 가장 긴 구간만 남기고 내용 bbox로 크롭."""
    a = im.split()[3]; w, h = im.size; ap = a.load()
    rows = [sum(1 for x in range(w) if ap[x, y] > 0) / w for y in range(h)]
    cols = [sum(1 for y in range(h) if ap[x, y] > 0) / h for x in range(w)]
    y0, y1 = longest_run(rows, 0.97)
    x0 = 0
    while x0 < w and cols[x0] >= 0.97: x0 += 1
    x1 = w
    while x1 > x0 and cols[x1-1] >= 0.97: x1 -= 1
    im = im.crop((x0, y0, x1, y1))
    return im.crop(im.getbbox()) if im.getbbox() else im

def fit_square(im, size, anchor='bottom'):
    w, h = im.size; s = max(w, h)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ox = (s - w) // 2; oy = (s - h) if anchor == 'bottom' else (s - h) // 2
    canvas.paste(im, (ox, oy)); return canvas.resize((size, size), S)

def sprite(src, dst, size=128):
    im = key_out(Image.open(RAW + src).resize((512, 512), S))
    im = im.crop(im.getbbox())
    fit_square(im, size).save(OUT + dst)

def largest_component(m, w, h):
    """위쪽 절반에서 시작하는 가장 큰 마젠타 연결 성분의 bbox."""
    seen = [[False]*w for _ in range(h)]; best = None
    for sy in range(0, h // 2):
        for sx in range(w):
            if not m[sy][sx] or seen[sy][sx]: continue
            q = deque([(sx, sy)]); seen[sy][sx] = True; n = 0
            x0 = x1 = sx; y0 = y1 = sy
            while q:
                x, y = q.popleft(); n += 1
                x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and m[ny][nx]:
                        seen[ny][nx] = True; q.append((nx, ny))
            if not best or n > best[0]: best = (n, x0, y0, x1 + 1, y1 + 1)
    return best[1:]

def remove_thin_lines(im, t=6, frac=0.3):
    """상하(또는 좌우) t픽셀이 모두 투명한 얇은 가로/세로 선 조각 제거."""
    px = im.load(); W, H = im.size
    def tr(x, y): return x < 0 or y < 0 or x >= W or y >= H or px[x, y][3] == 0
    for y in range(H):
        cand = [x for x in range(W) if px[x, y][3] and tr(x, y-t) and tr(x, y+t)]
        if len(cand) > frac * W:
            for x in cand: px[x, y] = (0, 0, 0, 0)
    for x in range(W):
        cand = [y for y in range(H) if px[x, y][3] and tr(x-t, y) and tr(x+t, y)]
        if len(cand) > frac * H:
            for y in cand: px[x, y] = (0, 0, 0, 0)
    return im

def portrait(src, dst, size=192):
    im = Image.open(RAW + src).convert('RGBA').resize((512, 512), S)
    w, h = im.size; m = magenta_mask(im)
    box = largest_component(m, w, h)
    im = key_out(im.crop(box))
    im = strip_frame(im)
    # 가장자리에 남은 얇은 프레임 선 제거 (4px 테두리 투명화 후 재크롭)
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            if x < 4 or y < 4 or x >= W-4 or y >= H-4: px[x, y] = (0, 0, 0, 0)
    im = remove_thin_lines(im)
    im = keep_largest_opaque(im)
    im = im.crop(im.getbbox())
    fit_square(im, size, 'bottom').save(OUT + dst)

def keep_largest_opaque(im):
    """불투명 픽셀의 연결 성분 중 가장 큰 것(흉상)만 남기고 글자·상자 조각 제거."""
    from collections import deque
    px = im.load(); W, H = im.size
    seen = [[False]*W for _ in range(H)]; best = []
    for sy in range(H):
        for sx in range(W):
            if seen[sy][sx] or px[sx, sy][3] == 0: continue
            comp = []; q = deque([(sx, sy)]); seen[sy][sx] = True
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1), (x+1, y+1), (x-1, y-1), (x+1, y-1), (x-1, y+1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and px[nx, ny][3]:
                        seen[ny][nx] = True; q.append((nx, ny))
            if len(comp) > len(best): best = comp
    keep = set(best)
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in keep: px[x, y] = (0, 0, 0, 0)
    return im

def tile(src, dst, box, size=64):
    im = Image.open(RAW + src).convert('RGB'); w, h = im.size
    im = im.crop((int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h)))
    im.resize((size, size), S).save(OUT + dst)

jobs = sys.argv[1:] or ['tiles', 'sprites', 'portraits', 'title']
if 'tiles' in jobs:
    tile('00_grass.png', 't_P.png', (0.42, 0.42, 0.58, 0.58))
    tile('01_road.png', 't_R.png', (0.33, 0.40, 0.55, 0.62))
    tile('02_forest.png', 't_F.png', (0.0, 0.0, 0.60, 0.60))
    tile('04_water.png', 't_W.png', (0.30, 0.25, 0.70, 0.65))
    tile('05_castle.png', 't_C.png', (0.04, 0.04, 0.96, 0.96))
    tile('06_village.png', 't_H.png', (0.15, 0.12, 0.75, 0.72))
if 'mountain' in jobs:
    tile('03_mountain.png', 't_M.png', (0.10, 0.03, 0.57, 0.50))
if 'sprites' in jobs:
    for src, dst in [('07_lord.png','u_lord.png'),('08_spear.png','u_inf.png'),('09_cav.png','u_cav.png'),
                     ('10_archer.png','u_arc.png'),('11_strat.png','u_str.png'),('12_bandit.png','u_bandit.png')]:
        sprite(src, dst)
if 'portraits' in jobs:
    for src, dst in [('13_p_liubei.png','p_liubei.png'),('14_p_guanyu.png','p_guanyu.png'),('15_p_zhangfei.png','p_zhangfei.png'),
                     ('16_p_jianyong.png','p_jianyong.png'),('17_p_zhaoyun.png','p_zhaoyun.png'),('18_p_boss1.png','p_boss1.png'),
                     ('19_p_boss2.png','p_boss2.png'),('20_p_boss3.png','p_boss3.png')]:
        portrait(src, dst)
if 'title' in jobs:
    im = Image.open(RAW + '21_title.png').convert('RGB'); im.resize((576, 1024), S).save(OUT + 'title.jpg', quality=82)
print('done', jobs)

if 'newsprites' in jobs:
    for src, dst in [('22_monk.png','u_monk.png'),('23_tribe.png','u_tribe.png'),('24_beast.png','u_beast.png'),
                     ('25_supply.png','u_supply.png'),('26_band.png','u_band.png'),('27_cata.png','u_cata.png')]:
        if os.path.exists(RAW + src): sprite(src, dst)

# 25_supply / 27_cata 는 배경이 그라데이션이라 마젠타 키잉 대신 가장자리에서 영역 성장(region growing)으로 배경 제거
def key_grow(src, tol=48):
    from collections import deque
    im = Image.open(RAW + src).convert('RGBA').resize((512, 512), S); w, h = im.size; px = im.load()
    seen = [[False]*w for _ in range(h)]; q = deque()
    diff = lambda a, b: abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2])
    for x in range(w):
        for y in (0, h-1): seen[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            if not seen[y][x]: seen[y][x] = True; q.append((x, y))
    bg = []
    while q:
        x, y = q.popleft(); p = px[x, y]; bg.append((x, y))
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and diff(px[nx, ny], p) < tol:
                seen[ny][nx] = True; q.append((nx, ny))
    for x, y in bg: px[x, y] = (0, 0, 0, 0)
    rm = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and any(0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)))]
    for x, y in rm: px[x, y] = (0, 0, 0, 0)
    return im
if 'growsprites' in jobs:
    for src, dst in [('25_supply.png', 'u_supply.png'), ('27_cata.png', 'u_cata.png')]:
        fit_square(key_grow(src).crop(key_grow(src).getbbox()), 128).save(OUT + dst)

if 'tiles2' in jobs:
    tile('30_grassG.png', 't_G.png', (0.30, 0.30, 0.70, 0.70))
    tile('31_waste.png', 't_D.png', (0.30, 0.30, 0.70, 0.70))
    tile('32_bridge.png', 't_B.png', (0.14, 0.30, 0.74, 0.90))
    tile('33_fort.png', 't_S.png', (0.08, 0.08, 0.92, 0.92))
    tile('34_camp.png', 't_E.png', (0.12, 0.15, 0.92, 0.95))
    tile('35_store.png', 't_T.png', (0.10, 0.12, 0.90, 0.92))
    tile('36_granary.png', 't_Q.png', (0.12, 0.08, 0.88, 0.84))
    tile('37_gate.png', 't_K.png', (0.30, 0.12, 0.70, 0.52))
    tile('38_wall.png', 't_X.png', (0.30, 0.30, 0.70, 0.70))

if 'portraits2' in jobs:
    for src, dst in [('40_p_lubu.png', 'p_lubu.png'), ('41_p_yuanshao.png', 'p_yuanshao.png'), ('42_p_caocao.png', 'p_caocao.png'),
                     ('43_p_sunqian.png', 'p_sunqian.png'), ('44_p_chunyuqiong.png', 'p_chunyuqiong.png'), ('45_p_zhanghe.png', 'p_zhanghe.png'),
                     ('46_p_wenchou.png', 'p_wenchou.png'), ('47_p_guanhai.png', 'p_guanhai.png'), ('48_p_yujin.png', 'p_yujin.png'), ('49_p_fangong.png', 'p_fangong.png')]:
        if os.path.exists(RAW + src): portrait(src, dst)
