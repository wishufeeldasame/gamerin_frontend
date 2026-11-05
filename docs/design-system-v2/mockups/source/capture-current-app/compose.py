import sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]
font_path = None
for p in ['/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc','/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc','/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf']:
    try: ImageFont.truetype(p, 10); font_path = p; break
    except Exception: pass
def label_font(size): return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default(size=size)
for name in ['home-desktop','profile-desktop','home-mobile','profile-mobile']:
    a = Image.open(f'{S}/shots/before/{name}.png').convert('RGB'); b = Image.open(f'{S}/shots/after/{name}.png').convert('RGB')
    gap, top = 48, 120
    W = a.width + b.width + gap*3; H = max(a.height, b.height) + top + gap
    out = Image.new('RGB', (W, H), (236, 236, 238)); d = ImageDraw.Draw(out); f = label_font(44)
    for i, (img, text) in enumerate([(a, 'BEFORE - current code'), (b, 'AFTER - Design System v2 colors')]):
        x = gap + i*(a.width + gap); out.paste(img, (x, top)); d.text((x, 36), text, fill=(21,21,24), font=f)
    out.save(f'{S}/final/{name}-compare.png', optimize=True)
    b.save(f'{S}/final/{name}-v2.png', optimize=True)
print('font', font_path)
