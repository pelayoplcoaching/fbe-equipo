import { useEffect, useRef, useState } from 'preact/hooks';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { useApp, Hoja, Icono, Cargando, descargar, P } from './comunes.jsx';
import { num } from '../logica/calculos.js';
import { arteSesion, cifrasTarjeta, cifraHeroe, encajarFoto, PLANTILLAS_TARJETA } from '../logica/arte.js';
import { fondoTarjeta, fuenteImagen } from '../logica/imagenes.js';
import { hayImagen } from './Imagen.jsx';

// Tarjeta de la sesión para compartir (Instagram, WhatsApp…): 1080 × 1350, sin datos de salud.
// d: { nombre, subtitulo, fecha (ISO), series, tonelaje (kg), minutos, records: [{ nombre, texto }], mejores: [{ nombre, serie }] }
// Opcionales (para el informe del bloque): etiquetaFecha, cifras [[valor, etiqueta] × 3], tituloMejores
// v0.51: al compartir una sesión, tres plantillas («Cifras», «Mínima» y «Con tu foto»), con la marca de FBE. La foto
// se pinta aquí, en el lienzo del móvil, y no se sube a ningún sitio. Ninguna lleva peso corporal, salud ni nutrición.

const W = 1080, H = 1350, M = 80;
// (diseño, tanda 15) Los colores de la marca nueva: la noche morada de la portada y de la bienvenida (no el negro de
// antes), el lobo en blanco y el dorado solo para los récords. Los cuatro colores de los discos ya no van en el pie.
const C = {
  fondo: '#150F36', noche: '#221957', tinta: '#FFFFFF', tinta2: '#CFC8F4', tinta3: '#A79FD8',
  morado: '#B9ADFF', linea: 'rgba(255, 255, 255, .14)', oro: '#E9D49A',
};
// El fondo: la noche, con el resplandor morado de la portada arriba a la derecha y abajo a la izquierda
function fondoNoche(x) {
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.noche); g.addColorStop(1, C.fondo);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, a] of [[W * 0.88, H * 0.06, 780, 0.5], [W * 0.06, H * 1.02, 720, 0.4]]) {
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(104, 78, 236, ${a})`); g.addColorStop(1, 'rgba(104, 78, 236, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
}
// (imágenes) La ilustración de fondo de la tarjeta (logica/imagenes.js: fondoTarjeta): se carga del móvil o de la red
// (es de la misma app, así que el lienzo se puede exportar) y, si no llega en 2,5 s o falla, la tarjeta sale con la
// noche de siempre
async function cargarFondo(id) {
  if (!id || !hayImagen(id)) return null;
  const f = fuenteImagen(id);
  const url = f.srcset.split(', ').pop().split(' ')[0];
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await Promise.race([img.decode(), new Promise((_, mal) => { setTimeout(() => mal(new Error('tarde')), 2500); })]);
    return img.naturalWidth ? img : null;
  } catch { return null; }
}
// La noche y, encima, la ilustración pegada abajo (cubriendo el ancho), con un velo que la apaga hacia abajo: las
// letras (blancas y lilas) siguen leyéndose sobre el resplandor
function fondoIlustrado(x, img) {
  fondoNoche(x);
  const e = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * e, h = img.naturalHeight * e;
  x.drawImage(img, (W - w) / 2, H - h, w, h);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(21, 15, 54, 0.15)'); g.addColorStop(0.45, 'rgba(21, 15, 54, 0.25)'); g.addColorStop(0.86, 'rgba(21, 15, 54, 0.6)'); g.addColorStop(1, 'rgba(21, 15, 54, 0.74)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
}

// El lobo de la marca, en vectorial (ui/lobo-trazo.js), con la esquina de arriba a la izquierda en (px, py) y el alto
// dado. Devuelve el ancho que ocupa.
export function dibujarLobo(x, px, py, alto, color = '#FFFFFF', opacidad = 1) {
  const [cx, cy, cw, ch] = LOBO_CAJA.split(' ').map(Number);
  const e = alto / ch;
  x.save();
  x.globalAlpha = opacidad; x.translate(px, py); x.scale(e, e); x.translate(-cx, -cy);
  x.fillStyle = color; x.fill(new Path2D(LOBO_D), 'evenodd');
  x.restore();
  return cw * e;
}
// La marca arriba a la izquierda (el lobo y «FBE Equipo») y el pie (un filo y la firma)
function marca(x, letra) {
  const w = dibujarLobo(x, M, M - 4, 64);
  letra(800, 34, 'expanded'); x.fillStyle = C.tinta; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.fillText('FBE Equipo', M + w + 18, M + 40);
}
function pie(x, letra, color = C.tinta3) {
  x.fillStyle = C.linea; x.fillRect(M, H - 132, W - 2 * M, 2);
  const w = dibujarLobo(x, M, H - 98, 34, color);
  letra(500, 30); x.fillStyle = color; x.textAlign = 'left';
  x.fillText('Entrenado con FBE Coaching', M + w + 14, H - 72);
}
export const FUENTE = '"Archivo Variable", "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]}, ${d} de ${MESES[m - 1]}`;
}

export async function dibujarTarjeta(d, { plantilla = 'clasica', foto = null } = {}) {
  try {
    await Promise.all([document.fonts.load(`800 100px ${FUENTE}`), document.fonts.load(`600 36px ${FUENTE}`), document.fonts.load(`500 30px ${FUENTE}`)]);
  } catch { /* sin la fuente se usa la del sistema */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const letra = (peso, tam, ancho = 'normal') => {
    x.font = `${peso} ${tam}px ${FUENTE}`;
    try { x.fontStretch = ancho; } catch { /* navegadores sin fontStretch */ }
  };
  const cortar = (t, ancho) => {
    if (x.measureText(t).width <= ancho) return t;
    let s = t;
    while (s.length > 1 && x.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const lineas = (t, ancho, max) => {
    const palabras = t.split(/\s+/);
    const out = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (x.measureText(prueba).width <= ancho || !actual) actual = prueba;
      else { out.push(actual); actual = p; }
    }
    if (actual) out.push(actual);
    if (out.length > max) { out.length = max; out[max - 1] = cortar(`${out[max - 1]} …`, ancho); }
    return out;
  };
  const icono = (n, cx, cy, tam, color) => {
    x.save();
    x.translate(cx - tam / 2, cy - tam / 2);
    x.scale(tam / 24, tam / 24);
    x.strokeStyle = color; x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D(P[n]));
    x.restore();
  };

  const aBlob = () => new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen.'))), 'image/png'));
  // (imágenes) la ilustración de fondo, salvo con la foto del atleta
  const ilu = plantilla === 'foto' && foto ? null : await cargarFondo(fondoTarjeta(d));
  if (plantilla !== 'clasica') {
    dibujarPlantilla({ x, d, plantilla, foto, letra, cortar, lineas, icono, ilu });
    return aBlob();
  }

  // Fondo: la ilustración o, sin ella, la noche de la marca y, abajo a la derecha, el lobo en grande y muy tenue
  if (ilu) fondoIlustrado(x, ilu);
  else { fondoNoche(x); dibujarLobo(x, W - 560, H - 640, 760, '#FFFFFF', 0.055); }

  // Marca y fecha
  marca(x, letra);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right';
  x.fillText(d.etiquetaFecha || fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';

  // Nombre de la sesión
  let y = 290;
  letra(800, 118, 'semi-expanded'); x.fillStyle = C.tinta;
  for (const l of lineas(d.nombre, W - 2 * M, 2)) { x.fillText(l, M - 4, y); y += 120; }
  y -= 54;
  if (d.subtitulo) { letra(650, 40); x.fillStyle = C.morado; x.fillText(d.subtitulo, M, y); }

  // Cifras
  y += 140;
  const cifras = d.cifras || [[String(d.series), d.series === 1 ? 'serie' : 'series'], [num(d.tonelaje / 1000, 1), 'toneladas'], [d.minutos ? String(d.minutos) : '—', 'minutos']];
  cifras.forEach(([v, k], i) => {
    const cx = M + i * ((W - 2 * M) / 3);
    letra(800, 104, 'semi-expanded'); x.fillStyle = C.tinta; x.fillText(v, cx, y);
    letra(500, 30); x.fillStyle = C.tinta2; x.fillText(k, cx + 2, y + 46);
  });
  y += 100;
  x.fillStyle = C.linea; x.fillRect(M, y, W - 2 * M, 2);
  y += 70;

  // v0.48 («Tu mes»): el calendario de constancia abajo, un punto por día (los entrenados, en morado)
  const cal = Array.isArray(d.calendario) ? d.calendario : null;
  const celda = 30, hueco = 12, altoCal = cal ? cal.length * (celda + hueco) + 40 : 0;
  const limite = H - 190 - altoCal;
  // Récords
  if (d.records.length) {
    icono('trofeo', M + 18, y - 12, 36, C.oro);
    letra(700, 34); x.fillStyle = C.oro;
    x.fillText(d.records.length === 1 ? 'Récord' : `${d.records.length} récords`, M + 50, y);
    y += 64;
    for (const r of d.records.slice(0, 3)) {
      if (y + 40 > limite) break;
      letra(700, 40); x.fillStyle = C.tinta; x.fillText(cortar(r.nombre, W - 2 * M), M, y);
      letra(500, 31); x.fillStyle = C.tinta2; x.fillText(cortar(r.texto, W - 2 * M), M, y + 44);
      y += 104;
    }
    y += 6;
  }
  // Mejor serie de cada ejercicio
  const mejores = d.mejores.filter((m) => !d.records.some((r) => r.nombre === m.nombre));
  if (mejores.length && y + 110 < limite) {
    letra(700, 34); x.fillStyle = C.tinta2; x.fillText(d.tituloMejores || 'Mejores series', M, y);
    y += 62;
    let mostradas = 0;
    for (const m of mejores) {
      if (y > limite) break;
      letra(700, 38, 'semi-expanded'); x.textAlign = 'right'; x.fillStyle = C.tinta;
      x.fillText(m.serie, W - M, y);
      const anchoSerie = x.measureText(m.serie).width;
      x.textAlign = 'left';
      letra(500, 36); x.fillStyle = C.tinta; x.fillText(cortar(m.nombre, W - 2 * M - anchoSerie - 40), M, y);
      y += 58; mostradas++;
    }
    if (mostradas < mejores.length) { letra(500, 30); x.fillStyle = C.tinta3; x.fillText(`y ${mejores.length - mostradas} más`, M, y); }
  }

  if (cal) {
    let cy = H - 170 - altoCal + 40;
    letra(700, 30); x.fillStyle = C.tinta2; x.fillText('Tu constancia', M, cy - 16);
    cal.forEach((semana, f) => semana.forEach((dia, c) => {
      if (dia.fuera) return;
      const cx = M + c * (celda + hueco) + celda / 2, yy = cy + f * (celda + hueco) + celda / 2;
      x.fillStyle = dia.entrenado ? C.morado : C.linea;
      x.beginPath(); x.arc(cx, yy, celda / 2, 0, Math.PI * 2); x.fill();
    }));
  }
  // Pie: un filo y la firma, con el lobo (sobre la ilustración, en claro)
  pie(x, letra, ilu ? '#EDEAFB' : C.tinta3);

  return aBlob();
}

// ---------- v0.51: las tres plantillas de una sesión ----------
// El dibujo de la portada de la sesión (logica/arte.js), escalado a la tarjeta y con los colores de la tarjeta
function dibujarArte(x, d, { escala = 2.7, dx = 0, dy = 0, opacidad = 1 } = {}) {
  const a = arteSesion({ nombre: d.nombre, tipo: d.tipo || 'fuerza', patron: d.patron || null }, 400, 300);
  const tono = { acento: C.morado, claro: '#FFFFFF', tenue: '#8F88C0' };
  x.save();
  x.translate(dx, dy); x.scale(escala, escala);
  x.lineCap = 'round';
  for (const f of a.formas) {
    x.globalAlpha = f.opacidad * opacidad;
    x.strokeStyle = tono[f.tono] || tono.tenue; x.fillStyle = tono[f.tono] || tono.tenue;
    x.lineWidth = (f.grosor || 1) * 1.1;
    x.beginPath();
    if (f.t === 'circulo') { x.arc(f.cx, f.cy, f.r, 0, Math.PI * 2); x.stroke(); }
    else if (f.t === 'elipse') { x.ellipse(f.cx, f.cy, f.rx, f.ry, (f.giro * Math.PI) / 180, 0, Math.PI * 2); x.stroke(); }
    else if (f.t === 'linea') { x.moveTo(f.x1, f.y1); x.lineTo(f.x2, f.y2); x.stroke(); }
    else if (f.t === 'trazo') x.stroke(new Path2D(f.d));
    else { x.arc(f.cx, f.cy, f.r, 0, Math.PI * 2); x.fill(); }
  }
  x.restore();
  x.globalAlpha = 1;
}
function dibujarPlantilla({ x, d, plantilla, foto, letra, cortar, lineas, icono, ilu = null }) {
  const espaciado = (px) => { try { x.letterSpacing = `${px}px`; } catch { /* sin letterSpacing */ } };
  // Fondo: la foto (cubriendo, con un degradado que deja leer) o la noche de la marca con el dibujo de la sesión
  fondoNoche(x);
  const r = plantilla === 'foto' && foto ? encajarFoto(foto.naturalWidth || foto.width, foto.naturalHeight || foto.height, W, H) : null;
  if (r) {
    x.drawImage(foto, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
    let g = x.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, 'rgba(10, 8, 24, .62)'); g.addColorStop(1, 'rgba(10, 8, 24, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, 300);
    g = x.createLinearGradient(0, H * 0.4, 0, H);
    g.addColorStop(0, 'rgba(10, 8, 24, 0)'); g.addColorStop(0.45, 'rgba(10, 8, 24, .72)'); g.addColorStop(1, 'rgba(10, 8, 24, .94)');
    x.fillStyle = g; x.fillRect(0, H * 0.4, W, H * 0.6);
  } else if (ilu) {
    // (imágenes) la ilustración en lugar del dibujo de líneas
    fondoIlustrado(x, ilu);
  } else if (plantilla === 'minima') {
    dibujarArte(x, d, { escala: 3.4, dx: -180, dy: -60, opacidad: 0.9 });
    const g = x.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(21, 15, 54, 0)'); g.addColorStop(0.5, 'rgba(21, 15, 54, .85)'); g.addColorStop(1, C.fondo);
    x.fillStyle = g; x.fillRect(0, H * 0.35, W, H * 0.65);
  } else {
    dibujarArte(x, d, { escala: 2.2, dx: 330, dy: -60, opacidad: 0.4 });
  }
  // La marca: el lobo y «FBE Equipo»; la fecha a la derecha
  marca(x, letra);
  letra(500, 30); x.fillStyle = r ? '#E4E1F2' : C.tinta2; x.textAlign = 'right';
  x.fillText(fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';
  const cifras = cifrasTarjeta(d);
  const etiqueta = (t, cx, cy, color = C.tinta2) => { letra(750, 28); espaciado(3); x.fillStyle = color; x.fillText(t.toUpperCase(), cx, cy); espaciado(0); };
  const cifra = (c, cx, cy, tam, ancho) => {
    letra(650, tam, 'condensed'); x.fillStyle = C.tinta; x.fillText(c.v, cx, cy);
    if (c.u) { const w = x.measureText(c.v).width; letra(700, Math.round(tam * 0.32)); x.fillStyle = C.tinta2; x.fillText(c.u, cx + w + 10, cy); }
    if (ancho) return x.measureText(c.v).width <= ancho;
    return true;
  };
  if (plantilla === 'cifras') {
    // El nombre arriba y las cifras en grande, como un marcador (2 × 2)
    let y = 300;
    letra(800, 96, 'expanded'); x.fillStyle = C.tinta;
    for (const l of lineas(d.nombre, W - 2 * M, 2)) { x.fillText(l, M - 4, y); y += 100; }
    if (d.subtitulo) { letra(650, 38); x.fillStyle = C.morado; x.fillText(d.subtitulo, M, y - 40); }
    const top = Math.max(y + 60, 560);
    const celda = (W - 2 * M) / 2, alto = (H - 220 - top) / 2;
    cifras.slice(0, 4).forEach((c, i) => {
      const cx = M + (i % 2) * celda, cy = top + Math.floor(i / 2) * alto;
      etiqueta(c.t, cx, cy + 10);
      cifra(c, cx - 6, cy + 10 + Math.min(220, alto - 40), Math.min(232, alto - 30));
    });
    x.fillStyle = C.linea; x.fillRect(M, top + alto - 16, W - 2 * M, 2);
  } else {
    // «Mínima» y «Con tu foto»: el nombre y la cifra (o cifras) abajo
    const h = cifraHeroe(d);
    let y = plantilla === 'minima' ? H - 600 : H - 470;
    if (d.subtitulo) { letra(700, 34); x.fillStyle = r ? '#D9D1FF' : C.morado; x.fillText(d.subtitulo, M, y - 112); }
    letra(800, 100, 'expanded'); x.fillStyle = C.tinta;
    const ls = lineas(d.nombre, W - 2 * M, 2);
    y -= (ls.length - 1) * 100;
    for (const l of ls) { x.fillText(l, M - 4, y); y += 104; }
    if (plantilla === 'minima' && h) {
      etiqueta(h.t, M, y + 30);
      cifra(h, M - 8, y + 300, 300);
    } else {
      const fila = cifras.slice(0, 3), ancho = (W - 2 * M) / Math.max(1, fila.length);
      fila.forEach((c, i) => { etiqueta(c.t, M + i * ancho, y + 20, '#D2CEE6'); cifra(c, M + i * ancho - 4, y + 168, 150); });
    }
  }
  // Pie: un filo y la firma, con el lobo
  pie(x, letra, r ? '#E4E1F2' : ilu ? '#EDEAFB' : C.tinta3);
  x.textAlign = 'left';
}

// Hoja con la vista previa y los botones para compartir o guardar la imagen. plantillas (v0.51, al compartir una
// sesión): elegir entre «Cifras», «Mínima» y «Con tu foto» (la foto se elige del móvil y no sale de él).
// v0.52: dibujar (opcional) pinta otra imagen con el mismo flujo de compartir y guardar (el carné de atleta)
export function HojaCompartir({ datos, alCerrar, titulo = 'Compartir la sesión', nota = null, alt = null, plantillas = false, dibujar = null, nombreArchivo = null }) {
  const { aviso } = useApp();
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  const [plantilla, setPlantilla] = useState(plantillas ? 'cifras' : 'clasica');
  const [foto, setFoto] = useState(null); // { img, url }
  const entrada = useRef(null);
  // La imagen que se ve lleva la plantilla (y la foto) con que se pintó: mientras no coincide con lo elegido, se está
  // preparando (y su texto alternativo dice lo que de verdad se ve)
  const clave = `${plantilla}:${plantilla === 'foto' ? foto?.url || '' : ''}`;
  const preparando = !img || img.clave !== clave;
  useEffect(() => {
    let vivo = true;
    const conFoto = plantilla === 'foto' ? foto?.img || null : null;
    (dibujar || dibujarTarjeta)(datos, { plantilla: plantilla === 'foto' && !conFoto ? 'minima' : plantilla, foto: conFoto }).then((blob) => {
      if (!vivo) return;
      const url = URL.createObjectURL(blob);
      setImg((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { blob, url, clave, plantilla, conFoto: !!conFoto, pintada: plantilla === 'foto' && !conFoto ? 'minima' : plantilla }; });
    }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [clave]);
  // Al cerrar, fuera las URL de la imagen y de la foto (la foto no se guarda en ningún sitio)
  const imgRef = useRef(null); imgRef.current = img;
  const fotoRef = useRef(null); fotoRef.current = foto;
  const montada = useRef(true);
  useEffect(() => () => { montada.current = false; if (imgRef.current?.url) URL.revokeObjectURL(imgRef.current.url); if (fotoRef.current?.url) URL.revokeObjectURL(fotoRef.current.url); }, []);
  const elegirFoto = (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { aviso('Elige una imagen (JPG, PNG o HEIC).', 'error'); return; }
    const url = URL.createObjectURL(f);
    const im = new Image();
    // (si la hoja se cierra mientras se abre la foto, su URL se libera aquí: nadie la va a usar)
    im.onload = () => {
      if (!montada.current) { URL.revokeObjectURL(url); return; }
      setFoto((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { img: im, url }; }); setPlantilla('foto');
    };
    im.onerror = () => { URL.revokeObjectURL(url); if (montada.current) aviso('No se ha podido abrir esa imagen. Prueba con otra.', 'error'); };
    im.src = url;
  };
  const nombre = nombreArchivo || `fbe-${datos.fecha}-${datos.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  const archivo = img && (() => { try { return new File([img.blob], nombre, { type: 'image/png' }); } catch { return null; } })();
  const puedeCompartir = !!(archivo && navigator.canShare?.({ files: [archivo] }));
  const texto = plantillas && img
    ? `Tarjeta de ${datos.nombre} (${PLANTILLAS_TARJETA.find(([k]) => k === img.pintada)?.[1] || ''}${img.plantilla === 'foto' && !img.conFoto ? ', hasta que elijas una foto' : ''}): ${cifrasTarjeta(datos).map((c) => `${c.v}${c.u ? ` ${c.u}` : ''} ${c.t.toLowerCase()}`).join(', ')}${img.conFoto ? ', sobre tu foto' : ''}`
    : alt || `Tarjeta de ${datos.nombre}: ${datos.series} series, ${num(datos.tonelaje / 1000, 1)} toneladas`;
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      {plantillas && (
        <fieldset class="plantillas">
          <legend>Plantilla</legend>
          {PLANTILLAS_TARJETA.map(([k, t]) => (
            <label class="plantilla-op" key={k}>
              <input type="radio" name="plantilla-tarjeta" value={k} checked={plantilla === k} onChange={() => { setPlantilla(k); if (k === 'foto' && !foto) entrada.current?.click(); }} />
              <span class="plantilla-mini" aria-hidden="true">{k === 'cifras' ? '42' : k === 'minima' ? 'A' : <Icono n="camara" />}</span>
              <span class="plantilla-nombre">{t}</span>
            </label>
          ))}
        </fieldset>
      )}
      {plantillas && plantilla === 'foto' && (
        <div class="tarjeta-foto-elegir">
          <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => entrada.current?.click()}><Icono n="camara" /> {foto ? 'Cambiar la foto' : 'Elegir una foto'}</button>
          <span class="mini terciario">La foto se prepara aquí, en tu móvil, y no se sube a ningún sitio: solo sale si tú compartes la imagen.</span>
        </div>
      )}
      {plantillas && <input ref={entrada} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Elegir una foto para la tarjeta" onChange={elegirFoto} />}
      {error ? <div class="error" role="alert">{error}</div> : !img ? <Cargando texto="Preparando la imagen" /> : (
        <>
          <div class={`tarjeta-previa ${preparando ? 'cargando' : ''}`} aria-busy={preparando ? 'true' : 'false'}>
            <img class="tarjeta-img" src={img.url} alt={texto} />
          </div>
          <div class="fila-envolver">
            {puedeCompartir && (
              <button class="btn btn-primario" onClick={async () => {
                try { await navigator.share({ files: [archivo], title: datos.nombre }); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: guarda la imagen y súbela tú.', 'error'); }
              }}><Icono n="compartir" /> Compartir</button>
            )}
            <button class={`btn ${puedeCompartir ? '' : 'btn-primario'}`} onClick={async () => { if (!(await descargar(nombre, img.blob, 'image/png'))) aviso('Mantén pulsada la imagen para guardarla.', 'error'); }}><Icono n="descargar" /> Guardar imagen</button>
          </div>
          <p class="mini terciario">{nota || (plantillas ? 'Solo lleva el nombre de la sesión, la duración, las series, el tonelaje y tus récords: nada de peso corporal, salud ni nutrición.' : 'Solo lleva el nombre de la sesión, las series, el tonelaje, los minutos y tus mejores series: nada de peso corporal ni datos de salud.')} En el móvil también puedes mantener pulsada la imagen para guardarla.</p>
        </>
      )}
    </Hoja>
  );
}
