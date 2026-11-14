"""Static illustration from verified mesh JSON. This is not a browser screenshot."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'doc/evidence/capability-20261111'
FONT = 'C:/Windows/Fonts/msyh.ttc'

def render(pattern_id):
    model = json.loads((OUT / f'{pattern_id}-mesh.json').read_text(encoding='utf-8'))
    yaw, tilt = math.radians(25), math.radians(12)
    def project(point):
        x, y, z = point
        xx = x * math.cos(yaw) + z * math.sin(yaw)
        zz = -x * math.sin(yaw) + z * math.cos(yaw)
        return xx, -(y * math.cos(tilt) - zz * math.sin(tilt))
    projected = [[project(p) for p in panel['positionsMm']] for panel in model['panels']]
    points = [p for panel in projected for p in panel]
    min_x, max_x = min(p[0] for p in points), max(p[0] for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)
    scale = min(1450 / (max_x - min_x), 930 / (max_y - min_y))
    origin_x = (1680 - (max_x - min_x) * scale) / 2
    def screen(point):
        return (origin_x + (point[0] - min_x) * scale, 185 + (point[1] - min_y) * scale)
    canvas = Image.new('RGB', (1680, 1320), '#f5f7fa')
    draw = ImageDraw.Draw(canvas)
    title_font, body_font, label_font = [ImageFont.truetype(FONT, n) for n in (34, 21, 17)]
    name = '包边背心' if pattern_id == 'bound-tank' else '开襟连帽卫衣'
    draw.text((55, 26), f'{name}：真实毫米裁片 → 三维网格', font=title_font, fill='#132742')
    draw.text((55, 84), f"{len(model['panels'])}片实际数量 | 对折片按折边展开 | 保留源二维坐标与三维坐标 | 当前均未缝合", font=body_font, fill='#5a6778')
    draw.rounded_rectangle((40, 142, 1640, 1215), radius=15, fill='#ffffff', outline='#dde3ed')
    colors = ['#b9d9f2', '#c6e2ce', '#e1d1f5', '#f7deb2']
    for index, (panel, positions) in enumerate(zip(model['panels'], projected)):
        vertices = [screen(p) for p in positions]
        faces = panel['triangles']
        for j in range(0, len(faces), 3):
            draw.polygon([vertices[i] for i in faces[j:j+3]], fill=colors[index % len(colors)], outline='#8c9eb2', width=1)
        x, y = min(p[0] for p in vertices), max(p[1] for p in vertices)
        aliases = {'front':'前身','back':'后身','armBinding':'袖窿包条','neckBinding':'领口包条','sleeve':'袖片','pocket':'前半袋','hood':'帽侧片','waistband':'下摆罗纹','cuff':'罗纹袖口'}
        label = aliases.get(panel['sourceId'].split('.')[-1], panel['sourceId']) + f" #{panel['copy']}"
        draw.text((x, y+5), label, font=label_font, fill='#27364b')
    draw.text((55, 1245), '数据静态渲染，不是浏览器截图。尚未执行人体碰撞、缝合闭合或布料垂坠仿真。', font=body_font, fill='#985d13')
    canvas.save(OUT / f'{pattern_id}-3d-data-preview.png')

if __name__ == '__main__':
    for pattern_id in ['bound-tank', 'hooded-zip-sweatshirt']:
        render(pattern_id)
