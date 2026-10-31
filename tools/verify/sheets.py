import sys, os
from PIL import Image, ImageDraw, ImageFont
M = sys.argv[1]
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
pages = ['today','week','plan','resources','absences','check','settings']
presets = ['mono-noir','midnight','graphite','light','high-contrast']
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()

def sheet(name, rows, cols, cell_w, cell_h, items):
    W = cols * cell_w + (cols + 1) * 12
    H = rows * (cell_h + 34) + 12
    im = Image.new('RGB', (W, H), (245, 245, 240))
    d = ImageDraw.Draw(im)
    for i, (path, label) in enumerate(items):
        r, c = divmod(i, cols)
        x = 12 + c * (cell_w + 12); y = 12 + r * (cell_h + 34)
        d.text((x, y), label, fill=(20, 20, 20), font=font)
        if os.path.exists(path):
            s = Image.open(path).convert('RGB')
            s.thumbnail((cell_w, cell_h))
            im.paste(s, (x, y + 30))
    im.save(os.path.join(out, name), optimize=True)

for p in presets:
    sheet(f'{p}-desktop.jpg'.replace('.jpg', '.png'), 2, 4, 560, 350, [(f'{M}/{p}-{pg}-1440.png', f'{p} · {pg} · 1440') for pg in pages])
    sheet(f'{p}-phone.png', 1, 7, 240, 520, [(f'{M}/{p}-{pg}-390.png', f'{pg}') for pg in pages])
for p in presets:
    items = [(f'{M}/{p}-{pg}-390-sheet.png', f'{pg} + More') for pg in pages]
    if any(os.path.exists(path) for path, _ in items):
        sheet(f'{p}-phone-sheet.png', 1, 7, 240, 520, items)
sheet('glass-modes.png', 2, 4, 560, 350, [(f'{M}/glass-{g}-today-1440.png', f'glass {g} · 1440') for g in ['off','blur','refraction','liquid']] + [(f'{M}/glass-{g}-today-390.png', f'glass {g} · 390') for g in ['off','blur','refraction','liquid']])
print('ok')
