"""Source-path contact sheets, not browser screenshots."""
import json
import math
import re
from pathlib import Path
from html import escape
import fitz
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
catalogue = json.loads((root / "src/data/referencePieceCatalogue.snapshot.json").read_text(encoding="utf-8"))
out = root / "doc/evidence/reference-catalogue-20261111"
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)


def image_for(entry, width=300, height=210):
    values = [float(n) for p in entry["paths"] for n in re.findall(r"-?\d+(?:\.\d+)?(?:e[+-]?\d+)?", p["data"], re.I)]
    xs, ys = values[::2], values[1::2]
    x, y = min(xs), min(ys)
    w, h = max(xs) - x, max(ys) - y
    pad = max(12, max(w, h) * 0.05)
    paths = "".join(
        f'<path d="{escape(p["data"], quote=True)}" fill="none" stroke="{("#24657b" if p["layer"] == "net" else "#475569")}" stroke-width="0.8"/>'
        for p in entry["paths"] if p["layer"] in ["net", "cut", "grain"]
    )
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{x-pad} {y-pad} {w+2*pad} {h+2*pad}">{paths}</svg>'
    document = fitz.open(stream=svg.encode(), filetype="svg")
    pdf = fitz.open("pdf", document.convert_to_pdf())
    pixmap = pdf[0].get_pixmap(alpha=False)
    picture = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    picture.thumbnail((width, height))
    canvas = Image.new("RGB", (width, height), "#fafaf8")
    canvas.paste(picture, ((width-picture.width)//2, (height-picture.height)//2))
    return canvas


def sheet(entries, name, columns):
    cellw, cellh = 330, 268
    picture = Image.new("RGB", (columns*cellw, 45+math.ceil(len(entries)/columns)*cellh), "white")
    draw = ImageDraw.Draw(picture)
    draw.text((15, 12), "FreeSewing 4.10.2 source paths - reference only - not a browser screenshot", font=font, fill="#243748")
    for i, entry in enumerate(entries):
        x, y = (i % columns)*cellw, 45+(i//columns)*cellh
        picture.paste(image_for(entry), (x+15, y+4))
        draw.text((x+15, y+220), entry["sourceId"][:38], font=font, fill="#243748")
        draw.text((x+15, y+241), entry["sampleId"][:38], font=font, fill="#64748b")
    picture.save(out / name)


sheet(catalogue["entries"], "all-source-contact.png", 6)
sheet([e for e in catalogue["entries"] if e["family"] in ["collar", "cuff"]], "collar-cuff-source-contact.png", 4)
print("Rendered source contact sheets; no browser screenshots created.")
