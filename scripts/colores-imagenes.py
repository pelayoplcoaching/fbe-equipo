# (visual 12) El color de cada ilustración, para pintarlo mientras carga (en vez de un hueco en blanco): el color medio
# de su versión más pequeña, un 15 % hacia el gris para que no grite. Se guarda en web/src/datos/imagenes.json
# («color»). Hay que volver a pasarlo al añadir imágenes (sin color, la imagen sale como antes, sin fondo).
#   python3 scripts/colores-imagenes.py      (necesita Pillow)
import json, pathlib
from PIL import Image
raiz = pathlib.Path(__file__).resolve().parent.parent / 'web'
ruta = raiz / 'src' / 'datos' / 'imagenes.json'
lista = json.loads(ruta.read_text())
n = 0
for x in lista.values():
    anchos = sorted(int(a) for a in x.get('archivos', {}))
    if not anchos:
        continue
    with Image.open(raiz / x['archivos'][str(anchos[0])]) as im:
        r, g, b = im.convert('RGB').resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    x['color'] = '#' + ''.join(f'{round(c * .85 + 128 * .15):02x}' for c in (r, g, b))
    n += 1
ruta.write_text(json.dumps(lista, ensure_ascii=False, indent=2) + '\n')
print(f'{n} colores en datos/imagenes.json')
