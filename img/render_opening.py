#!/usr/bin/env python3
"""오프닝 동영상 렌더링: 삽화 4장 + 켄 번즈 카메라 + 자막 + 한국어 내레이션 → img/story/opening.mp4
사용: python3 img/render_opening.py   (ffmpeg, Pillow 필요)
"""
import glob
import math
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'img', 'raw', 'story')
OUT = os.path.join(ROOT, 'img', 'story')
W, H, FPS = 960, 540, 24
XF = 0.8  # 크로스페이드(초)

from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402


def find_font(cands, size):
    for c in cands:
        for p in glob.glob(c):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


HOME = os.path.expanduser('~')
TITLE_FONT = find_font([HOME + '/.local/share/fonts/ko_brush/SongMyung-Regular.ttf',
                        HOME + '/.local/share/fonts/NotoSerifCJKkr-Regular.otf', '/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf'], 96)
SUB_FONT = find_font([HOME + '/.local/share/fonts/NotoSerifCJKkr-Regular.otf', '/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf'], 30)
CAP_FONT = find_font([HOME + '/.local/share/fonts/NotoSerifCJKkr-Regular.otf', '/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf'], 27)
HEAD_FONT = find_font([HOME + '/.local/share/fonts/ko_brush/SongMyung-Regular.ttf', HOME + '/.local/share/fonts/NotoSerifCJKkr-Regular.otf',
                       '/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf'], 44)


def dur(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


SCENES = [
    {'key': 'op1_peach', 'head': '도원결의', 'text': '후한 말, 어지러운 세상. 탁군의 유비는 관우·장비와 복숭아밭에서 의형제의 맹세를 맺는다. "한날한시에 태어나지는 못했으나, 한날한시에 죽기를 원하노라."', 'kb': ((0.0, 0.05, 1.0), (0.04, 0.0, 0.88)), 'petals': True},
    {'key': 'op2_turmoil', 'head': '황건적의 난', 'text': '"창천은 이미 죽었고 황천이 서리라." 황건적의 난이 천하를 휩쓸고, 세 형제는 의병을 일으켜 백성을 지키며 이름을 떨친다.', 'kb': ((0.1, 0.1, 0.86), (0.0, 0.0, 1.0))},
    {'key': 'op3_dongzhuo', 'head': '동탁의 폭정', 'text': '난이 끝나자 동탁이 낙양에 들어와 어린 황제를 쥐고 폭정을 일삼는다. 그 곁에는 천하무쌍의 맹장 여포가 서 있었다.', 'kb': ((0.0, 0.0, 1.0), (0.05, 0.08, 0.84))},
    {'key': 'op4_coalition', 'head': '반동탁 연합군', 'text': '원소를 맹주로 제후들이 동탁 토벌군을 일으킨다. 유비 삼형제도 공손찬의 군에 합류해 사수관으로 향한다. 영걸들의 이야기가 시작된다.', 'kb': ((0.08, 0.12, 0.84), (0.0, 0.0, 1.0))},
]


def wrap(text, font, maxw, draw):
    lines, cur = [], ''
    for ch in text:
        t = cur + ch
        if draw.textlength(t, font=font) > maxw and cur:
            lines.append(cur); cur = ch
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


def caption_layer(head, text):
    """자막 레이어(RGBA): 아래쪽 어두운 띠 + 소제목 + 본문"""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(H // 2, H):
        a = int(220 * ((y - H // 2) / (H / 2)) ** 1.6)
        bd.line([(0, y), (W, y)], fill=(0, 0, 0, a))
    layer.alpha_composite(band)
    d = ImageDraw.Draw(layer)
    lines = wrap(text, CAP_FONT, W - 120, d)
    y = H - 44 - 36 * len(lines)
    d.text((60, y - 58), head, font=HEAD_FONT, fill=(255, 230, 160, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    for ln in lines:
        d.text((60, y), ln, font=CAP_FONT, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
        y += 36
    return layer


def title_frame(k):
    """타이틀 카드: 검은 배경, 붉은 도장 느낌의 사각 + 제목"""
    im = Image.new('RGB', (W, H), (4, 5, 14))
    d = ImageDraw.Draw(im)
    a = max(0.0, min(1.0, k))
    col = tuple(int(c * a) for c in (255, 230, 160))
    t = '삼국지 영걸전'
    tw = d.textlength(t, font=TITLE_FONT)
    d.text(((W - tw) / 2, H / 2 - 86), t, font=TITLE_FONT, fill=col)
    sub = '— 유비전 —'
    sw = d.textlength(sub, font=SUB_FONT)
    d.text(((W - sw) / 2, H / 2 + 36), sub, font=SUB_FONT, fill=tuple(int(c * a) for c in (207, 200, 176)))
    d.rectangle([W / 2 - 140, H / 2 + 90, W / 2 + 140, H / 2 + 92], fill=tuple(int(c * a) for c in (212, 175, 55)))
    return im


def kb_frame(src, kb0, kb1, k):
    """켄 번즈: (x,y,zoom) 두 점 사이 보간. x,y는 0~1 오프셋(여백 비율), zoom은 보이는 폭 비율"""
    x = kb0[0] + (kb1[0] - kb0[0]) * k; y = kb0[1] + (kb1[1] - kb0[1]) * k; z = kb0[2] + (kb1[2] - kb0[2]) * k
    sw, sh = src.size
    cw, ch = sw * z, sh * z
    cx = x * (sw - cw); cy = y * (sh - ch)
    return src.crop((int(cx), int(cy), int(cx + cw), int(cy + ch))).resize((W, H), Image.LANCZOS)


class Petals:
    def __init__(self, n=28):
        random.seed(7)
        self.p = [[random.random() * W, random.random() * H, 10 + random.random() * 25, random.random() * 6.28, 3 + random.random() * 4] for _ in range(n)]

    def draw(self, im, t):
        d = ImageDraw.Draw(im, 'RGBA')
        for p in self.p:
            x = (p[0] + math.sin(t * 1.3 + p[3]) * 30 + t * 12) % (W + 40) - 20
            y = (p[1] + t * p[2]) % (H + 30) - 15
            r = p[4]
            d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=(255, 190, 210, 190))


def ease(k):
    return k * k * (3 - 2 * k)


def main():
    os.makedirs(OUT, exist_ok=True)
    # 장면 길이 = 내레이션 길이 + 1.2초
    for s in SCENES:
        s['audio'] = os.path.join(OUT, s['key'] + '.mp3')
        s['dur'] = dur(s['audio']) + 1.2
        s['img'] = Image.open(os.path.join(RAW, s['key'] + '.png')).convert('RGB').resize((1440, 810), Image.LANCZOS)
        s['cap'] = caption_layer(s['head'], s['text'])
    title_d = 3.6
    timeline = [('title', title_d)] + [(s, s['dur']) for s in SCENES]
    # 시작 시각 (크로스페이드만큼 겹침)
    starts, t = [], 0.0
    for item, d in timeline:
        starts.append(t); t += d - XF
    total = t + XF + 1.0  # 마지막 페이드아웃
    nframes = int(total * FPS)
    print(f'total {total:.1f}s, {nframes} frames', file=sys.stderr)

    # 오디오: 각 내레이션을 장면 시작 + 0.4초에 배치
    ainputs, filters = [], []
    audio_items = [(os.path.join(OUT, 'title.mp3'), 0.5)] + [(s['audio'], starts[i + 1] + 0.5) for i, s in enumerate(SCENES)]
    for i, (path, at) in enumerate(audio_items):
        ainputs += ['-i', path]
        filters.append(f'[{i + 1}:a]adelay={int(at * 1000)}|{int(at * 1000)}[a{i}]')
    amix = ''.join(f'[a{i}]' for i in range(len(audio_items))) + f'amix=inputs={len(audio_items)}:normalize=0,volume=1.0[aout]'
    cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-'] + ainputs + \
          ['-filter_complex', ';'.join(filters + [amix]), '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '96k', '-t', f'{total:.2f}', '-movflags', '+faststart', os.path.join(OUT, 'opening.mp4')]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    petals = Petals()

    def render_item(idx, lt):
        item = timeline[idx][0]
        if item == 'title':
            return title_frame(min(1.0, lt / 1.2))
        k = ease(max(0.0, min(1.0, lt / item['dur'])))
        fr = kb_frame(item['img'], item['kb'][0], item['kb'][1], k)
        if item.get('petals'):
            petals.draw(fr, lt)
        capa = max(0.0, min(1.0, (lt - 0.3) / 0.6))
        if capa > 0:
            cap = item['cap'] if capa >= 1 else Image.eval(item['cap'], lambda v: v)  # noqa
            fr = fr.convert('RGBA')
            if capa < 1:
                a = item['cap'].split()[3].point(lambda v: int(v * capa))
                cap = item['cap'].copy(); cap.putalpha(a)
            fr.alpha_composite(cap)
            fr = fr.convert('RGB')
        return fr

    for f in range(nframes):
        t = f / FPS
        # 현재 항목과 (겹치는 경우) 다음 항목
        cur = max(i for i, st in enumerate(starts) if st <= t)
        frame = render_item(cur, t - starts[cur])
        if cur + 1 < len(starts) and t >= starts[cur + 1]:
            nxt = render_item(cur + 1, t - starts[cur + 1])
            k = (t - starts[cur + 1]) / XF
            frame = Image.blend(frame, nxt, ease(min(1.0, k)))
        fade = max(0.0, min(1.0, (total - t) / 1.0))
        if fade < 1:
            frame = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), frame, fade)
        if t < 0.6:  # 첫 페이드인
            frame = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), frame, t / 0.6)
        proc.stdin.write(frame.tobytes())
        if f % 120 == 0:
            print(f'frame {f}/{nframes}', file=sys.stderr)
    proc.stdin.close(); proc.wait()
    print('done', proc.returncode, file=sys.stderr)


if __name__ == '__main__':
    main()
