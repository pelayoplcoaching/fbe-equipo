import { useEffect, useRef, useState } from 'preact/hooks';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { useApp, useCarga, Hoja, Icono, Cargando, descargar, copiar, usePreferencia, Segmentos, P } from './comunes.jsx';
import { num } from '../logica/calculos.js';
import { arteSesion, cifrasTarjeta, cifraHeroe, encajarFoto, PLANTILLAS_TARJETA } from '../logica/arte.js';
import { fondoTarjeta, fuenteImagen } from '../logica/imagenes.js';
import { hayImagen } from './Imagen.jsx';
import { FORMATOS, tamanoFormato, PEGATINAS_TARJETA, pegatinaTarjeta, limpiarHandle, conArroba, handleEquipo, PREF_HANDLE, pieDeFoto, resumenTexto, nombreArchivo as nombreArchivoDe, cifrasCardio, PREF_RECORDATORIO, recordatorioCompartir } from '../logica/compartir.js';

// Tarjeta de la sesión para compartir (Instagram, WhatsApp…): 1080 × 1350, sin datos de salud.
// d: { nombre, subtitulo, fecha (ISO), series, tonelaje (kg), minutos, records: [{ nombre, texto }], mejores: [{ nombre, serie }] }
// Opcionales (para el informe del bloque): etiquetaFecha, cifras [[valor, etiqueta] × 3], tituloMejores
// v0.51: al compartir una sesión, tres plantillas («Cifras», «Mínima» y «Con tu foto»), con la marca de FBE. La foto
// se pinta aquí, en el lienzo del móvil, y no se sube a ningún sitio. Ninguna lleva peso corporal, salud ni nutrición.

// (compartir) El ancho es siempre 1080; el alto depende del formato: 1350 (publicación, 4:5) o 1920 (historia, 9:16).
// Lo que se dibuja ocupa siempre HC = 1350 de alto, centrado: en la historia, el fondo sigue arriba y abajo (el hueco que
// tapan los controles de Instagram). H y oy se fijan en cada tarjeta (empezar) antes de pintar.
const W = 1080, HC = 1350, M = 80;
let H = HC, oy = 0;
// (diseño, tanda 15) Los colores de la marca nueva: la noche morada de la portada y de la bienvenida (no el negro de
// antes), el lobo en blanco y el dorado solo para los récords. Los cuatro colores de los discos ya no van en el pie.
const NOCHE = {
  fondo: '#150F36', noche: '#221957', tinta: '#FFFFFF', tinta2: '#CFC8F4', tinta3: '#A79FD8',
  morado: '#B9ADFF', linea: 'rgba(255, 255, 255, .14)', oro: '#E9D49A', clara: false,
};
// (compartir) La plantilla «Clara»: fondo claro y las letras de la noche
const CLARA = {
  fondo: '#F4F1FF', noche: '#FFFFFF', tinta: '#150F36', tinta2: '#4A4180', tinta3: '#7A72AE',
  morado: '#684EEC', linea: 'rgba(21, 15, 54, .12)', oro: '#9A7A1C', clara: true,
};
let C = NOCHE;
// Prepara el lienzo de una tarjeta: su formato, su paleta y el desplazamiento del contenido
function empezar({ formato = 'publicacion', clara = false } = {}) {
  const t = tamanoFormato(formato);
  H = t.H; oy = Math.round((H - HC) / 2); C = clara ? CLARA : NOCHE;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  return cv;
}
// El fondo: la noche, con el resplandor morado de la portada arriba a la derecha y abajo a la izquierda
function fondoNoche(x) {
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.noche); g.addColorStop(1, C.fondo);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, a] of [[W * 0.88, H * 0.06, 780, C.clara ? 0.16 : 0.5], [W * 0.06, H * 1.02, 720, C.clara ? 0.12 : 0.4]]) {
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
  const g = x.createLinearGradient(0, oy, 0, H);
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
  const w = dibujarLobo(x, M, M - 4, 64, C.tinta);
  letra(800, 34, 'expanded'); x.fillStyle = C.tinta; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.fillText('FBE Equipo', M + w + 18, M + 40);
}
// (compartir) El pie lleva, a la derecha, el @ del atleta si lo puso; y «Entreno con @equipo» si el coach puso el del
// equipo en config.js
let FIRMA = { handle: '', equipo: '' };
function pie(x, letra, color = C.tinta3) {
  x.fillStyle = C.linea; x.fillRect(M, HC - 132, W - 2 * M, 2);
  const w = dibujarLobo(x, M, HC - 98, 34, color);
  letra(500, 30); x.fillStyle = color; x.textAlign = 'left';
  x.fillText(FIRMA.equipo ? `Entreno con ${conArroba(FIRMA.equipo)}` : 'Entrenado con FBE Coaching', M + w + 14, HC - 72);
  if (FIRMA.handle) { letra(700, 30); x.textAlign = 'right'; x.fillText(conArroba(FIRMA.handle), W - M, HC - 72); x.textAlign = 'left'; }
}
// (compartir) La pegatina: una etiqueta inclinada arriba a la derecha, bajo la fecha
function pegatina(x, letra, texto) {
  if (!texto) return;
  letra(800, 34, 'expanded');
  const t = texto.toUpperCase();
  const w = x.measureText(t).width + 56, h = 72;
  x.save();
  x.translate(W - M - w / 2, 190); x.rotate(-0.07);
  x.fillStyle = C.clara ? '#684EEC' : C.oro;
  x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 16); x.fill();
  x.fillStyle = C.clara ? '#FFFFFF' : '#150F36'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(t, 0, 2);
  x.restore();
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
}
export const FUENTE = '"Archivo Variable", "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]}, ${d} de ${MESES[m - 1]}`;
}

async function cargarFuentes() {
  try {
    await Promise.all([document.fonts.load(`800 100px ${FUENTE}`), document.fonts.load(`600 36px ${FUENTE}`), document.fonts.load(`500 30px ${FUENTE}`)]);
  } catch { /* sin la fuente se usa la del sistema */ }
}
// Las herramientas de texto de una tarjeta (letra, cortar, lineas, icono)
function utiles(x) {
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

  return { letra, cortar, lineas, icono };
}
const aBlob = (cv) => new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen.'))), 'image/png'));

// (compartir) formato: publicacion | historia; pegatina: la clave de una pegatina (o ''); handle y equipo: los @ del pie
export async function dibujarTarjeta(d, { plantilla = 'clasica', foto = null, formato = 'publicacion', pegatina: peg = '', handle = '', equipo = handleEquipo() } = {}) {
  await cargarFuentes();
  const cv = empezar({ formato, clara: plantilla === 'clara' });
  FIRMA = { handle, equipo };
  const x = cv.getContext('2d');
  const { letra, cortar, lineas, icono } = utiles(x);
  // (imágenes) la ilustración de fondo, salvo con la foto del atleta (y no en la clara)
  const ilu = (plantilla === 'foto' && foto) || plantilla === 'clara' ? null : await cargarFondo(fondoTarjeta(d));
  if (plantilla !== 'clasica') {
    dibujarPlantilla({ x, d, plantilla, foto, letra, cortar, lineas, icono, ilu });
    x.translate(0, oy); pegatina(x, letra, pegatinaTarjeta(peg)); x.translate(0, -oy);
    return aBlob(cv);
  }

  // Fondo: la ilustración o, sin ella, la noche de la marca y, abajo a la derecha, el lobo en grande y muy tenue
  if (ilu) fondoIlustrado(x, ilu);
  else { fondoNoche(x); dibujarLobo(x, W - 560, H - 640, 760, '#FFFFFF', 0.055); }
  x.translate(0, oy);

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
  const cifras = d.cifras || (d.cardio ? cifrasCardio(d.cardio).map((c) => [`${c.v}${c.u ? ` ${c.u}` : ''}`, c.t.toLowerCase()])
    : [[String(d.series), d.series === 1 ? 'serie' : 'series'], [num(d.tonelaje / 1000, 1), 'toneladas'], [d.minutos ? String(d.minutos) : '—', 'minutos']]);
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
  const limite = HC - 190 - altoCal;
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
    let cy = HC - 170 - altoCal + 40;
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
  pegatina(x, letra, pegatinaTarjeta(peg));
  x.translate(0, -oy);
  return aBlob(cv);
}

// ---------- v0.51: las tres plantillas de una sesión ----------
// El dibujo de la portada de la sesión (logica/arte.js), escalado a la tarjeta y con los colores de la tarjeta
function dibujarArte(x, d, { escala = 2.7, dx = 0, dy = 0, opacidad = 1 } = {}) {
  const a = arteSesion({ nombre: d.nombre, tipo: d.tipo || 'fuerza', patron: d.patron || null }, 400, 300);
  const tono = C.clara ? { acento: C.morado, claro: '#4A4180', tenue: '#B3ACDB' } : { acento: C.morado, claro: '#FFFFFF', tenue: '#8F88C0' };
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
    let g = x.createLinearGradient(0, 0, 0, oy + 300);
    g.addColorStop(0, 'rgba(10, 8, 24, .62)'); g.addColorStop(1, 'rgba(10, 8, 24, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, oy + 300);
    g = x.createLinearGradient(0, oy + HC * 0.4, 0, H);
    g.addColorStop(0, 'rgba(10, 8, 24, 0)'); g.addColorStop(0.45, 'rgba(10, 8, 24, .72)'); g.addColorStop(1, 'rgba(10, 8, 24, .94)');
    x.fillStyle = g; x.fillRect(0, oy + HC * 0.4, W, H - oy - HC * 0.4);
  } else if (ilu) {
    // (imágenes) la ilustración en lugar del dibujo de líneas
    fondoIlustrado(x, ilu);
  } else if (plantilla === 'minima') {
    dibujarArte(x, d, { escala: 3.4, dx: -180, dy: oy - 60, opacidad: 0.9 });
    const g = x.createLinearGradient(0, oy + HC * 0.35, 0, H);
    g.addColorStop(0, 'rgba(21, 15, 54, 0)'); g.addColorStop(0.5, 'rgba(21, 15, 54, .85)'); g.addColorStop(1, C.fondo);
    x.fillStyle = g; x.fillRect(0, oy + HC * 0.35, W, H - oy - HC * 0.35);
  } else {
    dibujarArte(x, d, { escala: 2.2, dx: 330, dy: oy - 60, opacidad: C.clara ? 0.5 : 0.4 });
  }
  x.translate(0, oy);
  // La marca: el lobo y «FBE Equipo»; la fecha a la derecha
  marca(x, letra);
  letra(500, 30); x.fillStyle = r ? '#E4E1F2' : C.tinta2; x.textAlign = 'right';
  x.fillText(fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';
  const cifras = d.cardio ? cifrasCardio(d.cardio) : cifrasTarjeta(d);
  const etiqueta = (t, cx, cy, color = C.tinta2) => { letra(750, 28); espaciado(3); x.fillStyle = color; x.fillText(t.toUpperCase(), cx, cy); espaciado(0); };
  const cifra = (c, cx, cy, tam, ancho) => {
    letra(650, tam, 'condensed'); x.fillStyle = C.tinta; x.fillText(c.v, cx, cy);
    if (c.u) { const w = x.measureText(c.v).width; letra(700, Math.round(tam * 0.32)); x.fillStyle = C.tinta2; x.fillText(c.u, cx + w + 10, cy); }
    if (ancho) return x.measureText(c.v).width <= ancho;
    return true;
  };
  if (plantilla === 'cifras' || plantilla === 'clara') {
    // El nombre arriba y las cifras en grande, como un marcador (2 × 2)
    let y = 300;
    letra(800, 96, 'expanded'); x.fillStyle = C.tinta;
    for (const l of lineas(d.nombre, W - 2 * M, 2)) { x.fillText(l, M - 4, y); y += 100; }
    if (d.subtitulo) { letra(650, 38); x.fillStyle = C.morado; x.fillText(d.subtitulo, M, y - 40); }
    const top = Math.max(y + 60, 560);
    const celda = (W - 2 * M) / 2, alto = (HC - 220 - top) / 2;
    cifras.slice(0, 4).forEach((c, i) => {
      const cx = M + (i % 2) * celda, cy = top + Math.floor(i / 2) * alto;
      etiqueta(c.t, cx, cy + 10);
      cifra(c, cx - 6, cy + 10 + Math.min(220, alto - 40), Math.min(232, alto - 30));
    });
    x.fillStyle = C.linea; x.fillRect(M, top + alto - 16, W - 2 * M, 2);
  } else {
    // «Mínima» y «Con tu foto»: el nombre y la cifra (o cifras) abajo
    const h = d.cardio ? cifras[1] || cifras[0] : cifraHeroe(d);
    let y = plantilla === 'minima' ? HC - 600 : HC - 470;
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
  x.translate(0, -oy);
}

// ---------- (compartir) la tarjeta de un logro: récord, racha, semana completa, la semana del equipo, un reto… ----------
// d: { tipo, etiqueta, nombre, cifra { v, u, t }, lineas [texto…], fecha, llama } (logica/compartir.js). clara: fondo claro.
export async function dibujarLogro(d, { plantilla = 'noche', formato = 'publicacion', pegatina: peg = '', handle = '', equipo = handleEquipo() } = {}) {
  await cargarFuentes();
  const cv = empezar({ formato, clara: plantilla === 'clara' });
  FIRMA = { handle, equipo };
  const x = cv.getContext('2d');
  const { letra, cortar, lineas, icono } = utiles(x);
  const espaciado = (px) => { try { x.letterSpacing = `${px}px`; } catch { /* sin letterSpacing */ } };
  fondoNoche(x);
  // El lobo en grande y muy tenue abajo a la derecha, y un resplandor dorado arriba (los récords) o morado
  dibujarLobo(x, W - 560, H - 640, 760, C.clara ? '#150F36' : '#FFFFFF', C.clara ? 0.04 : 0.055);
  const dorado = d.tipo === 'record' || d.tipo === 'logro';
  let g = x.createRadialGradient(W * 0.8, oy + 420, 0, W * 0.8, oy + 420, 620);
  g.addColorStop(0, dorado ? (C.clara ? 'rgba(233, 212, 154, .35)' : 'rgba(233, 212, 154, .22)') : (C.clara ? 'rgba(104, 78, 236, .16)' : 'rgba(185, 173, 255, .22)')); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.translate(0, oy);
  marca(x, letra);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right';
  x.fillText(fechaLarga(d.fecha || new Date().toISOString().slice(0, 10)), W - M, M + 40);
  x.textAlign = 'left';
  // El icono del logro, a la derecha
  const acento = dorado ? C.oro : C.morado;
  icono(d.llama ? 'llama' : d.tipo === 'equipo' ? 'equipo' : d.tipo === 'semana' ? 'hecho' : 'trofeo', W - M - 80, 400, 150, acento);
  // La etiqueta y el nombre
  let y = 330;
  letra(750, 30); espaciado(4); x.fillStyle = acento; x.fillText(String(d.etiqueta || '').toUpperCase(), M, y); espaciado(0);
  y += 96;
  // El nombre: en grande si cabe en dos líneas; si no, algo más pequeño y hasta tres
  const anchoNombre = W - 2 * M - 190;
  letra(800, 88, 'semi-expanded'); x.fillStyle = C.tinta;
  let ls = lineas(d.nombre || '', anchoNombre, 3), tam = 88;
  if (ls.length > 2) { tam = 66; letra(800, tam, 'semi-expanded'); ls = lineas(d.nombre || '', anchoNombre, 3); }
  for (const l of ls) { x.fillText(l, M - 3, y); y += tam + 6; }
  if (ls.length > 2) y -= 40;
  // La cifra, enorme
  if (d.cifra) {
    y += 230;
    letra(650, 280, 'condensed'); x.fillStyle = C.tinta; x.fillText(d.cifra.v, M - 8, y);
    const wv = x.measureText(d.cifra.v).width;
    if (d.cifra.u) { letra(700, 70); x.fillStyle = C.tinta2; x.fillText(d.cifra.u, M + wv + 14, y); }
    letra(750, 30); espaciado(3); x.fillStyle = C.tinta2; x.fillText(String(d.cifra.t || '').toUpperCase(), M, y + 52); espaciado(0);
    y += 130;
  } else y += 40;
  // Las líneas
  x.fillStyle = C.linea; x.fillRect(M, y, W - 2 * M, 2);
  y += 70;
  for (const t of (d.lineas || []).slice(0, 3)) {
    if (y > HC - 190) break;
    letra(500, 40); x.fillStyle = C.tinta; x.fillText(cortar(t, W - 2 * M), M, y);
    y += 62;
  }
  pie(x, letra, C.tinta3);
  pegatina(x, letra, pegatinaTarjeta(peg));
  x.translate(0, -oy);
  return aBlob(cv);
}

// Hoja con la vista previa y los botones para compartir o guardar la imagen. plantillas (v0.51, al compartir una
// sesión): elegir entre «Cifras», «Mínima», «Con tu foto» y (compartir) «Clara» (la foto se elige del móvil y no sale de él).
// v0.52: dibujar (opcional) pinta otra imagen con el mismo flujo de compartir y guardar (el carné de atleta).
// (compartir) logro: la tarjeta de un logro (dibujarLogro, con «Noche» y «Clara»); tipo: para el pie de foto; formatos:
// Publicación o Historia; pegatina; el @ del atleta (en este móvil); el texto para pegar; los destinos (WhatsApp,
// Instagram, Facebook); el resumen en texto; y equipo: { tema, texto } para publicarla también en el muro del equipo.
const DESTINOS = [
  ['whatsapp', 'WhatsApp', 'https://wa.me/?text='],
  ['instagram', 'Instagram', 'instagram://'],
  ['facebook', 'Facebook', 'fb://'],
];
const puedeCompartirArchivo = (archivo) => !!(archivo && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [archivo] }));

export function HojaCompartir({ datos, alCerrar, titulo = 'Compartir la sesión', nota = null, alt = null, plantillas = false, dibujar = null, nombreArchivo = null,
  logro = false, tipo = 'sesion', equipo = null, alPublicado = null }) {
  const { aviso, api, propio } = useApp();
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  const [plantilla, setPlantilla] = useState(plantillas ? 'cifras' : logro ? 'noche' : 'clasica');
  // «Publicar en el equipo» solo estando dentro de la comunidad (y nunca el coach desde la ficha de un atleta)
  const enEquipo = useCarga(() => (!equipo || propio ? Promise.resolve(false) : Promise.all([api.comunidad(), api.miembroComunidad()]).then(([c, m]) => !!c.activa && api.dentroDeComunidad(m)).catch(() => false)), [!!equipo]);
  const [formato, setFormato] = usePreferencia('fbe-compartir-formato', 'publicacion');
  const [peg, setPeg] = useState('');
  const [handle, setHandle] = usePreferencia(PREF_HANDLE, '');
  const [editarHandle, setEditarHandle] = useState(false);
  const [foto, setFoto] = useState(null); // { img, url }
  const [verTexto, setVerTexto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicada, setPublicada] = useState(false);
  const entrada = useRef(null);
  const personalizable = !dibujar;   // el carné y otras imágenes propias no tienen formato, pegatina ni @
  const equipoHandle = handleEquipo();
  const opciones = { plantilla: plantilla === 'foto' && !foto?.img ? 'minima' : plantilla, foto: plantilla === 'foto' ? foto?.img || null : null, formato: personalizable ? formato : 'publicacion', pegatina: peg, handle, equipo: equipoHandle };
  // La imagen que se ve lleva lo con que se pintó: mientras no coincide con lo elegido, se está preparando
  const clave = `${plantilla}:${plantilla === 'foto' ? foto?.url || '' : ''}:${opciones.formato}:${peg}:${handle}`;
  const preparando = !img || img.clave !== clave;
  useEffect(() => {
    let vivo = true;
    (dibujar || (logro ? dibujarLogro : dibujarTarjeta))(datos, opciones).then((blob) => {
      if (!vivo) return;
      const url = URL.createObjectURL(blob);
      setImg((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { blob, url, clave, plantilla, conFoto: !!opciones.foto, pintada: opciones.plantilla }; });
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
  const nombre = nombreArchivo || nombreArchivoDe(datos, opciones.formato);
  const archivo = img && (() => { try { return new File([img.blob], nombre, { type: 'image/png' }); } catch { return null; } })();
  const puedeCompartir = puedeCompartirArchivo(archivo);
  const pie = pieDeFoto(datos, { tipo, handle, equipo: equipoHandle });
  const resumen = tipo === 'sesion' && (datos.mejores || []).length ? resumenTexto(datos, { handle, equipo: equipoHandle }) : null;
  const texto = plantillas && img
    ? `Tarjeta de ${datos.nombre} (${PLANTILLAS_TARJETA.find(([k]) => k === img.pintada)?.[1] || ''}${img.plantilla === 'foto' && !img.conFoto ? ', hasta que elijas una foto' : ''}): ${(datos.cardio ? cifrasCardio(datos.cardio) : cifrasTarjeta(datos)).map((c) => `${c.v}${c.u ? ` ${c.u}` : ''} ${c.t.toLowerCase()}`).join(', ')}${img.conFoto ? ', sobre tu foto' : ''}`
    : alt || (logro ? `Tarjeta: ${datos.etiqueta || ''} ${datos.nombre || ''}${datos.cifra ? `, ${datos.cifra.v} ${datos.cifra.u || ''} ${datos.cifra.t || ''}` : ''}` : `Tarjeta de ${datos.nombre}: ${datos.series} series, ${num((datos.tonelaje || 0) / 1000, 1)} toneladas`);

  // Compartir con la hoja del móvil (la imagen y el texto; cada app coge lo que admite)
  const compartirHoja = async () => {
    try { await navigator.share({ files: [archivo], title: datos.nombre || 'FBE Equipo', text: pie }); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: guarda la imagen y súbela tú.', 'error'); }
  };
  const guardar = async () => { if (!(await descargar(nombre, img.blob, 'image/png'))) { aviso('Mantén pulsada la imagen para guardarla.', 'error'); return false; } return true; };
  // Un destino: con la hoja del móvil si admite archivos (WhatsApp e Instagram salen en ella); si no, se guarda la
  // imagen, se copia el texto y se abre la app (Instagram y Facebook no admiten que una web les pase una imagen)
  const aDestino = async (k, url) => {
    if (puedeCompartir) { await compartirHoja(); return; }
    const copiado = await copiar(k === 'whatsapp' ? `${pie}` : pie);
    const guardada = await guardar();
    if (k === 'whatsapp') { window.open(`${url}${encodeURIComponent(pie)}`, '_blank', 'noopener'); return; }
    aviso(`${guardada ? 'Imagen guardada' : 'Guarda la imagen'}${copiado ? ' y texto copiado' : ''}: en ${DESTINOS.find(([c]) => c === k)[1]}, súbela como historia o publicación.`);
    setTimeout(() => { try { window.location.href = url; } catch { /* sin la app */ } }, 900);
  };
  // Publicarla en el muro del equipo: la imagen como foto (JPEG) de una publicación, con el texto
  const publicarEquipo = async () => {
    if (!img?.blob || publicando) return;
    setPublicando(true);
    try {
      const jpeg = await aJpeg(img.blob);
      await api.publicarEnComunidad({ fotos: [jpeg], texto: equipo.texto ?? pie.split('\n').slice(0, 2).join('\n'), tema: equipo.tema || 'logros' });
      setPublicada(true); aviso('Publicado en el equipo'); alPublicado?.();
    } catch (e) { aviso(e.message, 'error'); } finally { setPublicando(false); }
  };
  const guardarHandle = (v) => { try { setHandle(limpiarHandle(v)); setEditarHandle(false); } catch (e) { aviso(e.message, 'error'); } };
  const lasPlantillas = plantillas ? PLANTILLAS_TARJETA : logro ? [['noche', 'Noche', 'La noche de la marca'], ['clara', 'Clara', 'Fondo claro']] : null;
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      {lasPlantillas && (
        <fieldset class="plantillas">
          <legend>Plantilla</legend>
          {lasPlantillas.map(([k, t]) => (
            <label class="plantilla-op" key={k}>
              <input type="radio" name="plantilla-tarjeta" value={k} checked={plantilla === k} onChange={() => { setPlantilla(k); if (k === 'foto' && !foto) entrada.current?.click(); }} />
              <span class={`plantilla-mini ${k === 'clara' ? 'clara' : ''}`} aria-hidden="true">{k === 'cifras' ? '42' : k === 'minima' ? 'A' : k === 'foto' ? <Icono n="camara" /> : k === 'clara' ? '42' : <Icono n="luna" />}</span>
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
      {personalizable && (
        <div class="compartir-opciones">
          <div class="campo"><span class="etq">Formato</span><Segmentos etiqueta="Formato de la imagen" valor={formato} alCambiar={(v) => setFormato(v || 'publicacion')} opciones={FORMATOS.map(([k, t]) => [k, t])} /></div>
          <div class="campo">
            <span class="etq">Pegatina</span>
            <div class="chips-fila" role="radiogroup" aria-label="Pegatina">
              {PEGATINAS_TARJETA.map(([k, t]) => <button type="button" key={k} role="radio" aria-checked={peg === k ? 'true' : 'false'} class={`chip chip-boton ${peg === k ? 'activo' : ''}`} onClick={() => setPeg(k)}>{t}</button>)}
            </div>
          </div>
          <div class="campo compartir-handle">
            {editarHandle ? (
              <form class="fila" onSubmit={(e) => { e.preventDefault(); guardarHandle(e.currentTarget.elements.h.value); }}>
                <input name="h" class="entrada" type="text" inputMode="text" autoCapitalize="off" autoComplete="off" maxLength={31} placeholder="@tu_instagram" defaultValue={handle} aria-label="Tu nombre de Instagram" autoFocus />
                <button class="btn btn-peq btn-primario">Guardar</button>
                {handle && <button type="button" class="btn btn-peq" onClick={() => { setHandle(''); setEditarHandle(false); }}>Quitar</button>}
              </form>
            ) : <button type="button" class="btn-texto" onClick={() => setEditarHandle(true)}>{handle ? `${conArroba(handle)} en la tarjeta · cambiar` : 'Poner tu @ de Instagram en la tarjeta'}</button>}
            {editarHandle && <span class="mini terciario">Sale en el pie de la imagen y en el texto. Se guarda solo en este móvil.</span>}
          </div>
        </div>
      )}
      {error ? <div class="error" role="alert">{error}</div> : !img ? <Cargando texto="Preparando la imagen" /> : (
        <>
          <div class={`tarjeta-previa ${preparando ? 'cargando' : ''} ${opciones.formato === 'historia' ? 'historia' : ''}`} aria-busy={preparando ? 'true' : 'false'}>
            <img class="tarjeta-img" src={img.url} alt={texto} />
          </div>
          <div class="fila-envolver compartir-botones">
            {puedeCompartir && <button class="btn btn-primario" onClick={compartirHoja}><Icono n="compartir" /> Compartir…</button>}
            <button class={`btn ${puedeCompartir ? '' : 'btn-primario'}`} onClick={guardar}><Icono n="descargar" /> Guardar imagen</button>
          </div>
          {personalizable && (
            <div class="fila-envolver compartir-destinos" aria-label="Enviar a">
              {DESTINOS.map(([k, t, url]) => <button type="button" key={k} class={`btn btn-peq destino-${k}`} onClick={() => aDestino(k, url)}>{t}</button>)}
              <button type="button" class="btn btn-peq" onClick={async () => aviso((await copiar(pie)) ? 'Texto copiado: pégalo en tu publicación' : 'No se ha podido copiar', (await copiar(pie)) ? undefined : 'error')}><Icono n="copiar" /> Copiar texto</button>
              {resumen && <button type="button" class="btn btn-peq" onClick={async () => aviso((await copiar(resumen)) ? 'Resumen copiado: pégalo en el grupo' : 'No se ha podido copiar')}><Icono n="mensaje" /> Resumen para el grupo</button>}
              <button type="button" class="btn-texto mini" aria-expanded={verTexto ? 'true' : 'false'} onClick={() => setVerTexto(!verTexto)}>{verTexto ? 'Ocultar el texto' : 'Ver el texto'}</button>
            </div>
          )}
          {verTexto && <pre class="compartir-texto">{pie}</pre>}
          {equipo && enEquipo.datos === true && !publicada && (
            <button type="button" class="btn" disabled={publicando || preparando} onClick={publicarEquipo}><Icono n="equipo" /> {publicando ? 'Publicando…' : 'Publicar en el equipo'}</button>
          )}
          {publicada && <p class="nota peq"><Icono n="hecho" /> Publicada en el muro del equipo.</p>}
          <p class="mini terciario">{nota || (logro ? 'Solo lleva el logro y sus cifras: nada de peso corporal, salud ni nutrición.' : plantillas ? 'Solo lleva el nombre de la sesión, la duración, las series, el tonelaje y tus récords: nada de peso corporal, salud ni nutrición.' : 'Solo lleva el nombre de la sesión, las series, el tonelaje, los minutos y tus mejores series: nada de peso corporal ni datos de salud.')} {personalizable && 'Instagram y Facebook no cogen la imagen desde una web: con sus botones se guarda, se copia el texto y se abre la app para que la subas. '}En el móvil también puedes mantener pulsada la imagen para guardarla.</p>
        </>
      )}
    </Hoja>
  );
}

// El PNG de la tarjeta, como JPEG (para publicarlo en el muro: Storage solo acepta JPEG)
async function aJpeg(blob) {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const x = cv.getContext('2d');
    x.fillStyle = '#150F36'; x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(img, 0, 0);
    return await new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido preparar la imagen.'))), 'image/jpeg', 0.9));
  } finally { URL.revokeObjectURL(url); }
}

// (compartir) En Hoy: si la última sesión (de hace 3 días como mucho) tuvo récords y no se compartió nada, lo propone
// una vez. Se quita con la cruz o al compartir. Lo guarda el resumen de la sesión en este móvil (PREF_RECORDATORIO).
export function RecordatorioCompartir() {
  const [estado, setEstado] = usePreferencia(PREF_RECORDATORIO, null);
  const [abrir, setAbrir] = useState(false);
  const r = recordatorioCompartir(estado);
  if (!r || !estado?.tarjetas?.length) return null;
  return (
    <section class="panel panel-pad recordatorio-compartir" aria-label="Compartir tu récord">
      <span class="ico" aria-hidden="true"><Icono n="trofeo" /></span>
      <button type="button" class="pila-xs recordatorio-texto" onClick={() => setAbrir(true)}>
        <strong>{r.titulo}</strong>
        <span class="peq secundario">{r.texto}</span>
      </button>
      <button type="button" class="btn btn-icono plano" aria-label="Quitar" onClick={() => setEstado({ ...estado, quitado: true })}><Icono n="cerrar" /></button>
      {abrir && <HojaCompartir logro tipo="record" titulo="Compartir el récord" datos={estado.tarjetas[0]} equipo={{ tema: 'logros' }} alCerrar={() => { setAbrir(false); setEstado(null); }} />}
    </section>
  );
}
