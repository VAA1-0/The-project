"""Render the article's Figure 2 at 600 dpi and 180 mm print width."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1100, 1260
PIXELS = round(180 / 25.4 * 600)
S = PIXELS / WIDTH
im = Image.new('RGB', (PIXELS, round(HEIGHT * S)), 'white')
d = ImageDraw.Draw(im)
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
INK = '#20252a'

def xy(point):
    return tuple(round(v * S) for v in point)

def text_at(center, lines, size=28):
    font = ImageFont.truetype(FONT, round(size * S))
    text = '\n'.join(lines)
    bounds = d.multiline_textbbox((0, 0), text, font=font, spacing=round(8*S), align='center')
    x, y = xy(center)
    d.multiline_text((x-(bounds[2]-bounds[0])/2, y-(bounds[3]-bounds[1])/2-bounds[1]), text,
                     font=font, fill=INK, spacing=round(8*S), align='center')

def arrow(points, dashed=False):
    pts = [xy(p) for p in points]
    width = round(2.3*S)
    for a, b in zip(pts, pts[1:]):
        if dashed:
            length = math.dist(a, b)
            for start in range(0, round(length), round(17*S)):
                end = min(start + 9*S, length)
                p = tuple(a[i]+(b[i]-a[i])*start/length for i in (0,1))
                q = tuple(a[i]+(b[i]-a[i])*end/length for i in (0,1))
                d.line([p,q], fill=INK, width=width)
        else:
            d.line([a,b], fill=INK, width=width)
    a,b = pts[-2:]
    angle = math.atan2(b[1]-a[1], b[0]-a[0])
    length, half = 12*S, 5*S
    base = (b[0]-length*math.cos(angle), b[1]-length*math.sin(angle))
    d.polygon([b,(base[0]+half*math.sin(angle),base[1]-half*math.cos(angle)),
               (base[0]-half*math.sin(angle),base[1]+half*math.cos(angle))],fill=INK)

boxes = [
    (60,160,['Source video','and media references']),
    (215,315,['Ingestion and','modality processing']),
    (370,490,['Timed transcript, audio,','visual and OCR artifacts']),
    (545,645,['Coordinated evidence','workbench']),
    (700,820,['Researcher annotation, confirmation,','correction or rejection']),
    (875,975,['Persistent corrections','and canonical decisions']),
    (1030,1130,['Scene, agent and','narrative representations']),
]
# Main processing and decision chain.
for (_,bottom,_),(top,_,_) in zip(boxes,boxes[1:]):
    arrow([(550,bottom),(550,top)])
# Additional relationships reproduce the article's architecture figure.
arrow([(240,110),(150,110),(150,572),(240,572)])
arrow([(860,430),(915,430),(915,1065),(860,1065)])
arrow([(240,1080),(75,1080),(75,618),(240,618)])
arrow([(860,1100),(1025,1100),(1025,110),(860,110)],dashed=True)
for top,bottom,lines in boxes:
    d.rounded_rectangle([xy((240,top)),xy((860,bottom))],radius=round(8*S),
                        fill='white',outline=INK,width=round(2*S))
    text_at((550,(top+bottom)/2),lines)
arrow([(305,1200),(380,1200)],dashed=True)
text_at((635,1200),['Traceback through evidence references'],size=23)
im.save(OUT/'figure_2_operational_evidence_flow.png',dpi=(600,600))
preview = im.copy()
preview.thumbnail((880,1008))
preview.save(OUT/'figure_2_preview.png')
print(f'{im.width} × {im.height} pixels; 600 dpi; 180 mm print width')
