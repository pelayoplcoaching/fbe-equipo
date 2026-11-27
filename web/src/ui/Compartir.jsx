import { useEffect, useRef, useState } from 'preact/hooks';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { useApp, useCarga, Hoja, Icono, Cargando, descargar, copiar, usePreferencia, Segmentos, P } from './comunes.jsx';
import { esPorSuCuenta } from '../logica/esencial.js';
import { num } from '../logica/calculos.js';
import { arteSesion, cifrasTarjeta, cifraHeroe, encajarFoto, PLANTILLAS_TARJETA } from '../logica/arte.js';
import { fondoTarjeta, fondoLogro, fondoElegido, focoFondo, fuenteImagen, fondosDisponibles, grupoFondo } from '../logica/imagenes.js';
import { fmtCorta, hoyISO } from '../logica/fechas.js';
import { hayImagen } from './Imagen.jsx';
// (belleza 324) tu portada ilustrada del perfil, como fondo (su lista viaja con las pantallas que la usan, no con el arranque)
import LISTA_TROZOS from '../datos/imagenes-trozos.json';
import { anadirImagenes } from '../logica/imagenes.js';
import { imagenPortadaPerfil } from '../logica/perfil.js';
import { leerPreferencia } from './preferencias.js';
anadirImagenes(LISTA_TROZOS);
// tu portada ilustrada de ahora (perfil-…), o null (los colores y tu foto no valen de fondo: la foto no se puede pintar en la tarjeta)
const portadaPerfil = () => imagenPortadaPerfil(leerPreferencia('fbe-portada-perfil', 'noche'));
import { FORMATOS, tamanoFormato, PEGATINAS_TARJETA, pegatinaTarjeta, limpiarHandle, conArroba, handleEquipo, PREF_HANDLE, pieDeFoto, resumenTexto, nombreArchivo as nombreArchivoDe, cifrasCardio, PREF_RECORDATORIO, recordatorioCompartir,
  PALETAS, paletaDe, PREF_PALETA, limpiarFrase, PREF_FRASE, TONOS, PREF_TONO, textoAlternativo, PREF_COMPARTIDOS, anotarCompartido, textoCompartido,
  PREF_FONDO, PREF_PLANTILLA, PREF_PEGATINA, PREF_PERSONALIZAR, plantillaInicial, sorpresa } from '../logica/compartir.js';
import { leerAjustes } from './ajustes.js';
import { textoMensajeCoach, mensajeDe } from '../logica/personal.js';
import { lanzarConfeti } from './confeti.js';
import { conTransicion, sinMovimiento } from './transiciones.js';

// Tarjeta de la sesión para compartir (Instagram, WhatsApp…): 1080 × 1350, sin datos de salud.
// d: { nombre, subtitulo, fecha (ISO), series, tonelaje (kg), minutos, records: [{ nombre, texto }], mejores: [{ nombre, serie }] }
// Opcionales (para el informe del bloque): etiquetaFecha, cifras [[valor, etiqueta] × 3], tituloMejores
// v0.51: al compartir una sesión, tres plantillas («Cifras», «Mínima» y «Con tu foto»), con la marca de FBE. La foto
// se pinta aquí, en el lienzo del móvil, y no se sube a ningún sitio. Ninguna lleva peso corporal, salud ni nutrición.

// (compartir) El ancho es siempre 1080; el alto depende del formato: 1350 (publicación, 4:5) o 1920 (historia, 9:16).
// Lo que se dibuja ocupa siempre HC = 1350 de alto, centrado: en la historia, el fondo sigue arriba y abajo (el hueco que
// tapan los controles de Instagram). H y oy se fijan en cada tarjeta (empezar) antes de pintar.
// (v0.187) La historia reparte el contenido en 1440 de alto (deja 230 arriba y 250 abajo, lo que tapan los controles) y el
// cuadrado (1080 x 1080) pinta lo mismo a escala 0,8 y centrado. entrar() y salir() ponen y quitan ese encaje.
const W = 1080, M = 80;
let HC = 1350, H = HC, oy = 0, ox = 0, EC = 1;
const entrar = (x) => { x.save(); x.translate(ox, oy); x.scale(EC, EC); };
const salir = (x) => { x.restore(); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; };
// (v0.190) Tu foto en un recuadro, arriba a la derecha (bajo la fecha), sin tapar las cifras: el titulo se estrecha para
// dejarle sitio. REC es la foto de la tarjeta que se esta pintando (las tarjetas se pintan de una en una).
const FW = 280, FH = 350, FX = W - M - FW, FY = 150, FB = FY + FH;
let REC = null;
const anchoTitulo = () => W - 2 * M - (REC ? FW + 30 : 0);
function recuadroFoto(x) {
  if (!REC) return;
  const r = encajarFoto(REC.naturalWidth || REC.width, REC.naturalHeight || REC.height, FW, FH);
  x.save();
  x.shadowColor = C.clara ? 'rgba(20, 11, 58, .22)' : 'rgba(0, 0, 0, .5)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.fillStyle = C.fondo; x.beginPath(); x.roundRect(FX, FY, FW, FH, 28); x.fill();
  x.restore();
  x.save();
  x.beginPath(); x.roundRect(FX, FY, FW, FH, 28); x.clip();
  x.drawImage(REC, r.sx, r.sy, r.sw, r.sh, FX, FY, FW, FH);
  x.restore();
  x.save();
  x.strokeStyle = 'rgba(255, 255, 255, .9)'; x.lineWidth = 5; x.beginPath(); x.roundRect(FX, FY, FW, FH, 28); x.stroke();
  x.restore();
}
// (diseño, tanda 15) Los colores de la marca nueva: la noche morada de la portada y de la bienvenida (no el negro de
// antes), el lobo en blanco y el dorado solo para los récords. Los cuatro colores de los discos ya no van en el pie.
// (compartir, tanda 2) Las paletas están en logica/compartir.js (PALETAS): «Noche» es la de la marca; «Clara», fondo claro;
// Bosque, Brasa, Hielo y Grafito, la noche con otro acento. C es la paleta de la tarjeta que se está pintando.
let C = paletaDe('noche'), PAL = 'noche';
// (v0.188) Las tarjetas se pintan de una en una. El formato, la paleta y la firma son de todo el modulo y pintar espera
// a la letra y al dibujo de fondo: si dos se pintaban a la vez (al cambiar deprisa de formato o de colores, o con el
// movil lento cargando el fondo), la segunda le cambiaba el formato y los colores a la primera a medio pintar y salia
// una tarjeta mezclada (clara por dentro, oscura por fuera y con el dibujo encima).
let turno = Promise.resolve();
function enTurno(fn) {
  const r = turno.then(fn, fn);
  turno = r.catch(() => {});
  return r;
}
export const dibujarTarjeta = (d, o) => enTurno(() => pintarTarjeta(d, o));
export const dibujarLogro = (d, o) => enTurno(() => pintarLogro(d, o));
// Prepara el lienzo de una tarjeta: su formato, su paleta y el desplazamiento del contenido
function empezar({ formato = 'publicacion', paleta = 'noche' } = {}) {
  const t = tamanoFormato(formato);
  H = t.H; C = paletaDe(paleta, leerAjustes().acento); PAL = paleta; REC = null;
  if (formato === 'historia') { HC = 1440; oy = 230; ox = 0; EC = 1; }
  else if (formato === 'cuadrado') { HC = 1350; EC = H / HC; oy = 0; ox = Math.round((W - W * EC) / 2); }
  else { HC = 1350; oy = 0; ox = 0; EC = 1; }
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
    g.addColorStop(0, `rgba(${C.resplandor}, ${a})`); g.addColorStop(1, `rgba(${C.resplandor}, 0)`);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
}
// (tanda 2) La frase propia del atleta, en cursiva y en el acento, bajo el nombre
function frasePropia(x, letra, cortar, t, y, color = C.morado, tam = 38) {
  if (!t) return y;
  letra(500, tam, 'normal', 'italic'); x.fillStyle = color;
  x.fillText(cortar(`«${t}»`, REC && y - tam < FB + 12 ? anchoTitulo() : W - 2 * M), M, y);
  letra(500, tam);
  return y + tam + 26;
}
// (tanda 2) Una línea con los últimos puntos (la gráfica del récord o del antes/ahora)
function graficaLinea(x, puntos, { x0 = M, y0, ancho = W - 2 * M, alto = 150, color = C.morado } = {}) {
  const ys = puntos.map((p) => Number(p.y));
  const min = Math.min(...ys), max = Math.max(...ys);
  const px = (i) => x0 + (puntos.length === 1 ? ancho / 2 : (i / (puntos.length - 1)) * ancho);
  const py = (v) => y0 + alto - (max === min ? alto / 2 : ((v - min) / (max - min)) * alto);
  x.save();
  // la sombra bajo la línea
  const g = x.createLinearGradient(0, y0, 0, y0 + alto + 30);
  g.addColorStop(0, `rgba(${C.resplandor}, .35)`); g.addColorStop(1, `rgba(${C.resplandor}, 0)`);
  x.beginPath(); x.moveTo(px(0), y0 + alto + 30);
  puntos.forEach((p, i) => x.lineTo(px(i), py(Number(p.y))));
  x.lineTo(px(puntos.length - 1), y0 + alto + 30); x.closePath(); x.fillStyle = g; x.fill();
  x.beginPath(); puntos.forEach((p, i) => (i ? x.lineTo(px(i), py(Number(p.y))) : x.moveTo(px(i), py(Number(p.y)))));
  x.strokeStyle = color; x.lineWidth = 6; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke();
  puntos.forEach((p, i) => { x.beginPath(); x.arc(px(i), py(Number(p.y)), i === puntos.length - 1 ? 13 : 7, 0, Math.PI * 2); x.fillStyle = i === puntos.length - 1 ? C.oro : color; x.fill(); });
  x.restore();
}
// (tanda 2) Los destellos de un récord: rayos tenues y chispas de cuatro puntas alrededor del icono
function destellos(x, cx, cy, color = C.oro) {
  x.save();
  x.globalAlpha = C.clara ? 0.35 : 0.5;
  x.strokeStyle = color; x.lineWidth = 3; x.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, r1 = 118 + (i % 2) * 22, r2 = r1 + 30 + (i % 3) * 18;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); x.stroke();
  }
  x.globalAlpha = 1; x.fillStyle = color;
  for (const [sx, sy, t] of [[cx - 150, cy - 110, 16], [cx + 140, cy + 120, 12], [cx + 170, cy - 140, 9], [cx - 170, cy + 60, 8]]) {
    x.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? t * 0.38 : t, a = (k / 8) * Math.PI * 2 - Math.PI / 2; x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    x.closePath(); x.fill();
  }
  x.restore();
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
  // (belleza 324) tu portada, una franja 3:1: arriba, a todo lo ancho, fundida por abajo con la noche (estirada a toda la
  // tarjeta se vería borrosa); el velo, sobre ella, donde van las letras de arriba
  if (img.naturalWidth >= img.naturalHeight * 2.4) {
    // (un tercio de la tarjeta, como mínimo su franja entera: la imagen cubre ese hueco, centrada, sin estirarse de más)
    const hb = Math.round(Math.max((img.naturalHeight * W) / img.naturalWidth, H * 0.32));
    const eb = Math.max(W / img.naturalWidth, hb / img.naturalHeight), wb = img.naturalWidth * eb;
    const tb = document.createElement('canvas');
    tb.width = W; tb.height = hb;
    const bx = tb.getContext('2d');
    bx.drawImage(img, (W - wb) / 2, 0, wb, img.naturalHeight * eb);
    const fb = bx.createLinearGradient(0, 0, 0, hb);
    fb.addColorStop(0, 'rgba(0, 0, 0, 1)'); fb.addColorStop(0.55, 'rgba(0, 0, 0, .9)'); fb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bx.globalCompositeOperation = 'destination-in'; bx.fillStyle = fb; bx.fillRect(0, 0, W, hb);
    x.save();
    if (PAL !== 'noche') x.globalCompositeOperation = 'luminosity';
    x.drawImage(tb, 0, 0);
    x.restore();
    velo(x, 0, H, [[0, 0.38], [0.2, 0.24], [0.36, 0.06], [1, 0.04]]);
    alPieYHalo(x);
    return;
  }
  // (v0.187) las verticales cubren el ancho y se pegan abajo; las apaisadas (cardio) cubren todo. Arriba se funden con
  // la noche (sin corte) y, con otra paleta oscura, solo ponen la luz: el color lo da la paleta.
  const vertical = img.naturalHeight >= img.naturalWidth;
  const e = vertical ? W / img.naturalWidth : Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * e, h = Math.ceil(img.naturalHeight * e);
  const t = document.createElement('canvas');
  t.width = W; t.height = h;
  const tx = t.getContext('2d');
  tx.drawImage(img, (W - w) * (img.fbeFoco ?? 0.5), 0, w, h);
  if (H - h > -40) {
    // (de una vez y a todo el lienzo: «destination-in» borra lo que queda fuera de lo pintado)
    const f = tx.createLinearGradient(0, 0, 0, h);
    f.addColorStop(0, 'rgba(0, 0, 0, 0)'); f.addColorStop(0.1, 'rgba(0, 0, 0, .3)'); f.addColorStop(0.26, 'rgba(0, 0, 0, 1)'); f.addColorStop(1, 'rgba(0, 0, 0, 1)');
    tx.globalCompositeOperation = 'destination-in'; tx.fillStyle = f; tx.fillRect(0, 0, W, h);
  }
  x.save();
  if (PAL !== 'noche') x.globalCompositeOperation = 'luminosity';
  x.drawImage(t, 0, H - h);
  x.restore();
  // El velo: algo mas arriba (donde van las letras) y una franja al pie para la firma; el motivo, casi limpio
  velo(x, 0, H, [[0, 0.34], [0.5, 0.22], [0.8, 0.06], [1, 0.06]]);
  alPieYHalo(x);
}
// La franja al pie para la firma y el halo de las letras (con cualquier dibujo detrás: el de siempre o tu portada)
function alPieYHalo(x) {
  const pieY = Math.round(oy + (HC - 190) * EC);
  velo(x, pieY, H, [[0, 0], [Math.min(1, (150 * EC) / Math.max(1, H - pieY)), 0.62], [1, 0.62]]);
  // (v0.188) con un dibujo detras, cada letra lleva un halo del color del fondo: se lee tambien encima de lo claro
  // (el oro del trofeo, la barra). Dos pasadas (un filo y la letra): una sola se queda corta sobre el dorado.
  if (!x.fbeHalo) {
    const escribir = x.fillText.bind(x);
    x.fbeHalo = true;
    x.fillText = (...a) => {
      x.save(); x.shadowColor = C.fondo; x.shadowBlur = 26; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
      x.strokeStyle = C.fondo; x.lineWidth = 3; x.lineJoin = 'round'; x.strokeText(...a);
      escribir(...a);
      x.restore();
    };
  }
}
// Un velo del color de fondo de la paleta entre dos alturas: paradas [posicion, opacidad]
function velo(x, y0, y1, paradas) {
  if (y1 <= y0) return;
  const t = document.createElement('canvas');
  t.width = 4; t.height = y1 - y0;
  const tx = t.getContext('2d');
  const g = tx.createLinearGradient(0, 0, 0, t.height);
  for (const [p, a] of paradas) g.addColorStop(p, `rgba(0, 0, 0, ${a})`);
  tx.fillStyle = g; tx.fillRect(0, 0, 4, t.height);
  tx.globalCompositeOperation = 'source-in'; tx.fillStyle = C.fondo; tx.fillRect(0, 0, 4, t.height);
  x.drawImage(t, 0, y0, W, y1 - y0);
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
// La marca arriba a la izquierda (el lobo y el nombre de su app) y el pie (un filo y la firma)
// (belleza C140) «FBE Esencial» para quien va por su cuenta; lo pone HojaCompartir al abrirse
let MARCA_APP = 'FBE Equipo';
function marca(x, letra) {
  const w = dibujarLobo(x, M, M - 4, 64, C.tinta);
  letra(800, 34, 'expanded'); x.fillStyle = C.tinta; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.fillText(MARCA_APP, M + w + 18, M + 40);
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
  // (v0.190) con tu foto en el recuadro, la pegatina va en su borde de abajo (arriba le tapaba la cara)
  x.translate(W - M - w / 2, REC ? FB - 20 : 190); x.rotate(-0.07);
  x.fillStyle = C.clara ? '#593EDE' : C.oro;
  x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 16); x.fill();
  x.fillStyle = C.clara ? '#FFFFFF' : '#140B3A'; x.textAlign = 'center'; x.textBaseline = 'middle';
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
  const letra = (peso, tam, ancho = 'normal', estilo = '') => {
    x.font = `${estilo ? `${estilo} ` : ''}${peso} ${tam}px ${FUENTE}`;
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

  // (v0.187) Un titulo que siempre cabe: prueba los tamanos de mayor a menor hasta que entra en `max` lineas sin cortar
  // ninguna palabra; si ni con el menor, se corta con puntos. Las lineas salen parejas (sin una palabra suelta al final).
  const titulo = (texto, { tams, ancho, max = 2, peso = 800, estilo = 'expanded', luego = null }) => {
    const t = String(texto || '').trim();
    for (const tam of tams) {
      letra(peso, tam, estilo);
      const ls = lineas(t, ancho, 99);
      if (ls.length <= max && ls.every((l) => x.measureText(l).width <= ancho)) {
        let mejor = ls;
        if (ls.length > 1) for (let a = ancho * 0.96; a > ancho * 0.5; a -= ancho * 0.04) { const p = lineas(t, a, 99); if (p.length !== ls.length || p.some((l) => x.measureText(l).width > ancho)) break; mejor = p; }
        return { ls: mejor, tam };
      }
    }
    // (luego: otra tanda de tamanos con mas lineas, antes de cortar)
    if (luego) return titulo(texto, { ancho, peso, estilo, ...luego, luego: null });
    const tam = tams[tams.length - 1];
    letra(peso, tam, estilo);
    return { ls: lineas(t, ancho, max).map((l) => cortar(l, ancho)), tam };
  };

  return { letra, cortar, lineas, icono, titulo };
}
const aBlob = (cv) => new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen.'))), 'image/png'));

// (compartir) formato: publicacion | historia; pegatina: la clave de una pegatina (o ''); handle y equipo: los @ del pie
async function pintarTarjeta(d, { plantilla = 'clasica', foto = null, formato = 'publicacion', pegatina: peg = '', handle = '', equipo = handleEquipo(), paleta = 'noche', frase = '', fondo = 'auto', recuadro = null } = {}) {
  await cargarFuentes();
  const cv = empezar({ formato, paleta });
  d = frase ? { ...d, frase } : d;
  FIRMA = { handle, equipo };
  const x = cv.getContext('2d');
  const { letra, cortar, lineas, icono, titulo } = utiles(x);
  REC = plantilla === 'foto' ? null : recuadro;
  // (imágenes) la ilustración de fondo, salvo con la foto del atleta (y no en la clara)
  // (v0.187) fondo: 'auto' (el de la tarjeta), '' (sin dibujo) o el que elija; vale con todas las paletas oscuras
  if (plantilla === 'lista') plantilla = 'clasica';
  if (plantilla === 'record' && !(d.records || []).length) plantilla = 'cifras';
  const idFondo = fondoElegido(fondo, fondoTarjeta(d), undefined, portadaPerfil());
  const ilu = (plantilla === 'foto' && foto) || C.clara || !idFondo ? null : await cargarFondo(idFondo);
  if (ilu) ilu.fbeFoco = focoFondo(idFondo);
  if (plantilla !== 'clasica') {
    dibujarPlantilla({ x, d, plantilla, foto, letra, cortar, lineas, icono, titulo, ilu });
    entrar(x); pegatina(x, letra, pegatinaTarjeta(peg)); salir(x);
    return aBlob(cv);
  }

  // Fondo: la ilustración o, sin ella, la noche de la marca y, abajo a la derecha, el lobo en grande y muy tenue
  if (ilu) fondoIlustrado(x, ilu);
  else { fondoNoche(x); dibujarLobo(x, W - 560, H - 640, 760, C.clara ? '#140B3A' : '#FFFFFF', C.clara ? 0.04 : 0.055); }
  entrar(x);

  // Marca y fecha
  marca(x, letra);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right';
  x.fillText(d.etiquetaFecha || fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';
  recuadroFoto(x);

  // Nombre de la sesión
  let y = 290;
  const tn = titulo(d.nombre, { tams: [118, 98, 82], ancho: anchoTitulo(), estilo: 'semi-expanded', luego: { tams: [70, 60], max: 3 } });
  x.fillStyle = C.tinta;
  for (const l of tn.ls) { x.fillText(l, M - 4, y); y += tn.tam + 2; }
  y += 66 - (tn.tam + 2);
  if (d.subtitulo) { letra(650, 40); x.fillStyle = C.morado; x.fillText(REC ? cortar(d.subtitulo, anchoTitulo()) : d.subtitulo, M, y); }
  if (d.frase) { y = frasePropia(x, letra, cortar, d.frase, y + (d.subtitulo ? 58 : 0)) - 20; }

  // Cifras (con tu foto en el recuadro, por debajo de ella)
  if (REC) y = Math.max(y, FB - 30);
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
  pie(x, letra, ilu ? C.tinta2 : C.tinta3);
  pegatina(x, letra, pegatinaTarjeta(peg));
  salir(x);
  return aBlob(cv);
}

// ---------- v0.51: las tres plantillas de una sesión ----------
// El dibujo de la portada de la sesión (logica/arte.js), escalado a la tarjeta y con los colores de la tarjeta
function dibujarArte(x, d, { escala = 2.7, dx = 0, dy = 0, opacidad = 1 } = {}) {
  const a = arteSesion({ nombre: d.nombre, tipo: d.tipo || 'fuerza', patron: d.patron || null }, 400, 300);
  const tono = C.clara ? { acento: C.morado, claro: '#4F4E5E', tenue: '#AAA9B5' } : { acento: C.morado, claro: '#FFFFFF', tenue: '#858492' };
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
function dibujarPlantilla({ x, d, plantilla, foto, letra, cortar, lineas, icono, titulo, ilu = null }) {
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
    velo(x, Math.round(oy + HC * 0.35), H, [[0, 0], [0.5, 0.85], [1, 1]]);
  } else {
    // (v0.187) en la clara, mas abajo y mas tenue: no choca con la fecha
    dibujarArte(x, d, { escala: 2.2, dx: 330, dy: oy + (C.clara ? 90 : -60) * EC, opacidad: C.clara ? 0.2 : 0.4 });
  }
  // (v0.187) el brillo dorado del record, detras de la marca
  if (plantilla === 'record' && !C.clara) {
    const g = x.createRadialGradient(W * 0.5, oy + 640 * EC, 0, W * 0.5, oy + 640 * EC, 700 * EC);
    g.addColorStop(0, 'rgba(233, 212, 154, .2)'); g.addColorStop(1, 'rgba(233, 212, 154, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  entrar(x);
  // La marca: el lobo y «FBE Equipo»; la fecha a la derecha
  marca(x, letra);
  letra(500, 30); x.fillStyle = r ? '#DDDDE3' : C.tinta2; x.textAlign = 'right';
  x.fillText(fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';
  recuadroFoto(x);
  const cifras = d.cardio ? cifrasCardio(d.cardio) : cifrasTarjeta(d);
  const etiqueta = (t, cx, cy, color = C.tinta2) => { letra(750, 28); espaciado(3); x.fillStyle = color; x.fillText(t.toUpperCase(), cx, cy); espaciado(0); };
  const cifra = (c, cx, cy, tam, ancho) => {
    letra(650, tam, 'condensed'); x.fillStyle = C.tinta; x.fillText(c.v, cx, cy);
    if (c.u) { const w = x.measureText(c.v).width; letra(700, Math.round(tam * 0.32)); x.fillStyle = C.tinta2; x.fillText(c.u, cx + w + 10, cy); }
    if (ancho) return x.measureText(c.v).width <= ancho;
    return true;
  };
  if (plantilla === 'poster') {
    // (tanda 2) El nombre enorme, en condensada, llenando la tarjeta; las cifras pequeñas abajo
    // (v0.187) el tamano baja hasta que cabe entero: tres lineas como mucho en grande, cuatro en pequeno
    const nombre = String(d.nombre || '').toUpperCase();
    // (v0.190) con tu foto arriba, el nombre empieza debajo de ella y algo mas pequeno
    let tp = titulo(nombre, { tams: REC ? (d.frase ? [150, 130, 112] : [170, 150, 130]) : [230, 210, 190, 170, 150], ancho: W - 2 * M, max: 3, peso: 650, estilo: 'condensed' });
    if (tp.ls.some((l) => l.endsWith('…'))) tp = titulo(nombre, { tams: REC ? (d.frase ? [104, 92, 80] : [124, 112, 96]) : [150, 130, 112, 96], ancho: W - 2 * M, max: 4, peso: 650, estilo: 'condensed' });
    const filas = tp.ls, tam = tp.tam;
    x.fillStyle = C.tinta;
    const altoFila = Math.round(tam * 0.92);
    const bloque = filas.length * altoFila;
    let y = Math.max(REC ? FB + 30 : 330, Math.round((HC - 320 - bloque) / 2)) + Math.round(tam * 0.8);
    for (const l of filas) { x.fillText(l, M - 8, y); y += altoFila; }
    y -= Math.round(tam * 0.1);
    if (d.frase) y = frasePropia(x, letra, cortar, d.frase, y + 40, C.morado, 40) - 10;
    // Las cifras, en una fila pequeña
    const fila = HC - 215;
    const anchoCol = (W - 2 * M) / Math.max(1, Math.min(4, cifras.length));
    cifras.slice(0, 4).forEach((c, i) => {
      const cx = M + i * anchoCol;
      letra(800, 64, 'semi-expanded'); x.fillStyle = C.tinta; x.fillText(c.v, cx, fila);
      const w = x.measureText(c.v).width;
      if (c.u) { letra(600, 28); x.fillStyle = C.tinta2; x.fillText(c.u, cx + w + 8, fila); }
      etiqueta(c.t, cx, fila + 38, C.tinta3);
    });
  } else if (plantilla === 'cifras') {
    // El nombre arriba y las cifras en grande, como un marcador (2 × 2)
    let y = 300;
    const tn = titulo(d.nombre, { tams: [96, 80, 66], ancho: anchoTitulo(), luego: { tams: [60, 52], max: 3 } });
    x.fillStyle = C.tinta;
    for (const l of tn.ls) { x.fillText(l, M - 4, y); y += tn.tam + 4; }
    y += 100 - (tn.tam + 4) + 6;
    if (d.subtitulo) { letra(650, 38); x.fillStyle = C.morado; x.fillText(REC ? cortar(d.subtitulo, anchoTitulo()) : d.subtitulo, M, y - 40); }
    if (d.frase) y = frasePropia(x, letra, cortar, d.frase, y + (d.subtitulo ? 24 : -20), C.tinta2, 36) - 10;
    // (v0.187) cada cifra con su etiqueta y aire hasta la fila siguiente (antes la etiqueta de abajo se pegaba al numero)
    const top = Math.max(y + 50, 540);
    const celda = (W - 2 * M) / 2, alto = (HC - 200 - top) / 2;
    const tamC = Math.max(120, Math.min(210, alto - 110));
    cifras.slice(0, 4).forEach((c, i) => {
      const cx = M + (i % 2) * celda, cy = top + Math.floor(i / 2) * alto;
      etiqueta(c.t, cx, cy + 34);
      cifra(c, cx - 6, cy + 34 + 28 + Math.round(tamC * 0.78), tamC);
    });
    if (cifras.length > 2) { x.fillStyle = C.linea; x.fillRect(M, top + alto - 12, W - 2 * M, 2); }
  } else if (plantilla === 'record') {
    // (v0.187) «Récord»: el ejercicio y la marca en grande y en dorado; la sesion y sus cifras, pequenas abajo
    const rs = d.records || [], r0 = rs[0] || {};
    let y = 318;
    icono('trofeo', M + 20, y - 12, 40, C.oro);
    letra(750, 30); espaciado(4); x.fillStyle = C.oro; x.fillText(rs.length === 1 ? 'NUEVO RÉCORD' : `${rs.length} RÉCORDS`, M + 56, y); espaciado(0);
    y += 104;
    const tn = titulo(r0.nombre, { tams: [92, 78, 64], ancho: anchoTitulo(), estilo: 'semi-expanded', luego: { tams: [56, 50], max: 3 } });
    x.fillStyle = C.tinta;
    for (const l of tn.ls) { x.fillText(l, M - 3, y); y += tn.tam + 6; }
    // la marca: tan grande como quepa
    let tm = 250;
    const marcaTxt = String(r0.texto || '');
    letra(650, tm, 'condensed');
    while (tm > 110 && x.measureText(marcaTxt).width > W - 2 * M) { tm -= 10; letra(650, tm, 'condensed'); }
    y += Math.round(tm * 0.74);
    x.fillStyle = C.oro; x.fillText(cortar(marcaTxt, W - 2 * M), M - 6, y);
    y += 74;
    for (const r of rs.slice(1, 3)) {
      if (y > HC - 440) break;
      letra(700, 36); x.fillStyle = C.tinta; const nn = cortar(r.nombre, (W - 2 * M) * 0.58); x.fillText(nn, M, y);
      letra(700, 36, 'semi-expanded'); x.fillStyle = C.oro; x.textAlign = 'right'; x.fillText(cortar(r.texto, (W - 2 * M) * 0.38), W - M, y); x.textAlign = 'left';
      y += 56;
    }
    if (d.frase && y < HC - 440) frasePropia(x, letra, cortar, d.frase, y + 6, C.tinta2, 36);
    // abajo: la sesion y sus cifras
    x.fillStyle = C.linea; x.fillRect(M, HC - 372, W - 2 * M, 2);
    letra(700, 38); x.fillStyle = C.tinta2; x.fillText(cortar(`${d.nombre}${d.subtitulo ? ` · ${d.subtitulo}` : ''}`, W - 2 * M), M, HC - 308);
    const resto = cifras.filter((c) => c.k !== 'records').slice(0, 3);
    const anchoCol = (W - 2 * M) / Math.max(1, resto.length);
    resto.forEach((c, i) => {
      const cx = M + i * anchoCol;
      letra(800, 60, 'semi-expanded'); x.fillStyle = C.tinta; x.fillText(c.v, cx, HC - 218);
      const w = x.measureText(c.v).width;
      if (c.u) { letra(600, 28); x.fillStyle = C.tinta2; x.fillText(c.u, cx + w + 8, HC - 218); }
      etiqueta(c.t, cx, HC - 180, C.tinta3);
    });
  } else {
    // «Mínima» y «Con tu foto»: el nombre y la cifra (o cifras) abajo
    const h = d.cardio ? cifras[1] || cifras[0] : cifraHeroe(d);
    let y = plantilla === 'minima' ? HC - 600 : HC - 470;
    if (d.frase) y -= 70;
    // (v0.187) el subtitulo va encima de la primera linea del nombre, tenga una o dos (antes se montaba con dos)
    let tn = titulo(d.nombre, { tams: [100, 84, 70], ancho: W - 2 * M, luego: { tams: [62, 54], max: 3 } });
    // (v0.190) si el nombre sube hasta la altura de tu foto, se estrecha para no meterse debajo
    const arriba = (t) => y - (t.ls.length - 1) * (t.tam + 4) - t.tam - (d.subtitulo ? 50 : 0);
    const junto = REC && arriba(tn) < FB + 16;
    if (junto) tn = titulo(d.nombre, { tams: [84, 70], ancho: anchoTitulo(), luego: { tams: [62, 54], max: 3 } });
    const ls = tn.ls;
    y -= (ls.length - 1) * (tn.tam + 4);
    if (d.subtitulo) { letra(700, 34); x.fillStyle = r ? '#DDD9FF' : C.morado; x.fillText(cortar(d.subtitulo, junto ? anchoTitulo() : W - 2 * M), M, y - tn.tam - 12); }
    letra(800, tn.tam, 'expanded'); x.fillStyle = C.tinta;
    for (const l of ls) { x.fillText(l, M - 4, y); y += tn.tam + 4; }
    y += 100 - tn.tam;
    if (d.frase) y = frasePropia(x, letra, cortar, d.frase, y - 30, r ? '#DDD9FF' : C.morado, 36) - 10;
    if (plantilla === 'minima' && h) {
      etiqueta(h.t, M, y + 30);
      cifra(h, M - 8, y + 300, 300);
    } else {
      const fila = cifras.slice(0, 3), ancho = (W - 2 * M) / Math.max(1, fila.length);
      fila.forEach((c, i) => { etiqueta(c.t, M + i * ancho, y + 20, '#C7C6CF'); cifra(c, M + i * ancho - 4, y + 168, 150); });
    }
  }
  // Pie: un filo y la firma, con el lobo
  pie(x, letra, r ? '#DDDDE3' : ilu ? C.tinta2 : C.tinta3);
  salir(x);
}

// ---------- (compartir) la tarjeta de un logro: récord, racha, semana completa, la semana del equipo, un reto… ----------
// d: { tipo, etiqueta, nombre, cifra { v, u, t }, lineas [texto…], fecha, llama, puntos (la gráfica), comparar (antes y
// ahora), lista (el plan de la semana), cita { texto, autor } } (logica/compartir.js). paleta: la de PALETAS.
async function pintarLogro(d, { formato = 'publicacion', pegatina: peg = '', handle = '', equipo = handleEquipo(), paleta = 'noche', frase = '', fondo = 'auto' } = {}) {
  await cargarFuentes();
  const cv = empezar({ formato, paleta });
  d = frase ? { ...d, frase } : d;
  FIRMA = { handle, equipo };
  const x = cv.getContext('2d');
  const { letra, cortar, lineas, icono, titulo } = utiles(x);
  const espaciado = (px) => { try { x.letterSpacing = `${px}px`; } catch { /* sin letterSpacing */ } };
  // (v0.187) con ilustracion de fondo (la del logro o la elegida); sin ella, el lobo en grande y muy tenue
  const idFondo = fondoElegido(fondo, fondoLogro(d), undefined, portadaPerfil());
  const ilu = C.clara || !idFondo ? null : await cargarFondo(idFondo);
  if (ilu) fondoIlustrado(x, ilu);
  else { fondoNoche(x); dibujarLobo(x, W - 560, H - 640, 760, C.clara ? '#140B3A' : '#FFFFFF', C.clara ? 0.04 : 0.055); }
  const dorado = d.tipo === 'record' || d.tipo === 'logro';
  let g = x.createRadialGradient(W * 0.8, oy + 420 * EC, 0, W * 0.8, oy + 420 * EC, 620);
  g.addColorStop(0, dorado ? (C.clara ? 'rgba(233, 212, 154, .35)' : 'rgba(233, 212, 154, .22)') : `rgba(${C.resplandor}, ${C.clara ? 0.16 : 0.28})`); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  entrar(x);
  marca(x, letra);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right';
  x.fillText(fechaLarga(d.fecha || hoyISO()), W - M, M + 40);
  x.textAlign = 'left';
  // El icono del logro, a la derecha (con destellos si es un récord)
  const acento = dorado ? C.oro : C.morado;
  const icoX = W - M - 80, icoY = 400;
  if (d.tipo === 'record') destellos(x, icoX + 75, icoY + 75, C.oro);
  icono(d.icono && P[d.icono] ? d.icono : d.llama ? 'llama' : d.tipo === 'equipo' ? 'equipo' : d.tipo === 'semana' || d.tipo === 'plan' ? 'calendario' : d.tipo === 'comparativa' ? 'progreso' : d.tipo === 'reto' ? 'bandera' : 'trofeo', icoX, icoY, 150, acento);
  // La etiqueta y el nombre
  let y = 330;
  letra(750, 30); espaciado(4); x.fillStyle = acento; x.fillText(String(d.etiqueta || '').toUpperCase(), M, y); espaciado(0);
  y += 96;
  // El nombre: en grande si cabe en dos líneas; si no, algo más pequeño y hasta tres
  const anchoNombre = W - 2 * M - 190;
  // (v0.187) lineas parejas («Del 9 nov / al 15 nov») y sin cortar si cabe mas pequeno
  let tn = titulo(d.nombre || '', { tams: [88], ancho: anchoNombre, max: 2, estilo: 'semi-expanded' });
  if (tn.ls.some((l) => l.endsWith('…'))) tn = titulo(d.nombre || '', { tams: [66, 56], ancho: anchoNombre, max: 3, estilo: 'semi-expanded' });
  const ls = tn.ls, tam = tn.tam;
  x.fillStyle = C.tinta;
  for (const l of ls) { x.fillText(l, M - 3, y); y += tam + 6; }
  if (ls.length > 2) y -= 40;
  if (d.frase) y = frasePropia(x, letra, cortar, d.frase, y + 10, C.morado, 36) - 30;

  if (d.comparar) {
    // (tanda 2) Antes y ahora: dos cifras grandes, lado a lado, con su fecha y una flecha
    const c = d.comparar;
    y += 160;
    const col = (W - 2 * M) / 2;
    const bloque = (t, v, fecha, cx, color) => {
      letra(750, 28); espaciado(3); x.fillStyle = C.tinta3; x.fillText(t.toUpperCase(), cx, y - 150); espaciado(0);
      letra(650, 190, 'condensed'); x.fillStyle = color; x.fillText(v, cx - 6, y);
      const w = x.measureText(v).width;
      letra(700, 44); x.fillStyle = C.tinta2; x.fillText(c.unidad, cx + w + 10, y);
      letra(500, 30); x.fillStyle = C.tinta2; x.fillText(fecha, cx, y + 48);
    };
    bloque('Antes', c.antes.v, c.antes.fecha, M, C.tinta3);
    bloque('Ahora', c.ahora.v, c.ahora.fecha, M + col + 20, C.tinta);
    // la flecha entre las dos
    x.strokeStyle = C.morado; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round';
    const ax = M + col - 30, ay = y - 70;
    x.beginPath(); x.moveTo(ax - 10, ay); x.lineTo(ax + 40, ay); x.moveTo(ax + 22, ay - 18); x.lineTo(ax + 40, ay); x.lineTo(ax + 22, ay + 18); x.stroke();
    letra(750, 30); espaciado(3); x.fillStyle = C.tinta2; x.fillText(String(c.metrica || '').toUpperCase(), M, y + 100); espaciado(0);
    y += 150;
  } else if (d.lista) {
    // (tanda 2) El plan de la semana: una fila por día, con la letra del día en un círculo
    y += 40;
    const alto = Math.min(84, Math.floor((HC - 330 - y) / Math.max(1, d.lista.length)));
    for (const f of d.lista) {
      const cx = M + 30, cy = y + alto / 2 - 10;
      x.beginPath(); x.arc(cx, cy, 30, 0, Math.PI * 2);
      x.fillStyle = f.hecha ? C.morado : f.texto === 'Descanso' ? C.linea : `rgba(${C.resplandor}, .35)`; x.fill();
      letra(800, 30); x.fillStyle = f.hecha ? (C.clara ? '#FFFFFF' : '#140B3A') : C.tinta; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(f.dia, cx, cy + 1); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      letra(f.texto === 'Descanso' ? 500 : 700, 40); x.fillStyle = f.texto === 'Descanso' ? C.tinta3 : C.tinta;
      x.fillText(cortar(f.texto, W - 2 * M - 120), M + 90, cy + 14);
      if (f.hecha) icono('hecho', W - M - 40, cy - 18, 36, C.morado);
      y += alto;
    }
    y += 20;
  } else if (d.cifra) {
    // La cifra, enorme
    y += 230;
    letra(650, 280, 'condensed'); x.fillStyle = C.tinta; x.fillText(d.cifra.v, M - 8, y);
    const wv = x.measureText(d.cifra.v).width;
    if (d.cifra.u) { letra(700, 70); x.fillStyle = C.tinta2; x.fillText(d.cifra.u, M + wv + 14, y); }
    letra(750, 30); espaciado(3); x.fillStyle = C.tinta2; x.fillText(String(d.cifra.t || '').toUpperCase(), M, y + 52); espaciado(0);
    // (tanda 2) la gráfica, a la derecha de la cifra, si hay puntos
    if (d.puntos?.length >= 3) {
      const gx = M + wv + (d.cifra.u ? 180 : 60);
      if (W - M - gx > 260) graficaLinea(x, d.puntos, { x0: gx, y0: y - 230, ancho: W - M - gx, alto: 170 });
    }
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
  // (tanda 2) la cita del coach, en cursiva, con su nombre
  if (d.cita?.texto && y + 60 < HC - 170) {
    letra(500, 34, 'normal', 'italic'); x.fillStyle = C.tinta2;
    const ql = lineas(`«${d.cita.texto}»`, W - 2 * M - 40, 2);
    for (const l of ql) { if (y > HC - 190) break; x.fillText(l, M, y); y += 44; }
    if (d.cita.autor && y <= HC - 180) { letra(600, 30); x.fillStyle = C.tinta3; x.fillText(`— ${d.cita.autor}`, M, y + 4); }
  }
  pie(x, letra, ilu ? C.tinta2 : C.tinta3);
  pegatina(x, letra, pegatinaTarjeta(peg));
  salir(x);
  return aBlob(cv);
}

// (belleza 310) Fondo de pantalla: la tarjeta ya pintada (la de 4:5, o el carné) sobre la noche de tu color, en 1080 x
// 2340, por debajo del reloj (el tercio de arriba, libre) y por encima de la barra de abajo, con sus esquinas y su sombra
function aImagen(blob) {
  return new Promise((ok, mal) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); mal(new Error('No se ha podido preparar el fondo.')); }; im.src = u; });
}
async function pintarFondoPantalla(blob, paleta = 'noche') {
  const im = await aImagen(blob);
  const cv = empezar({ formato: 'fondo', paleta });
  const x = cv.getContext('2d');
  fondoNoche(x);
  dibujarLobo(x, W - 560, H - 760, 760, C.clara ? '#140B3A' : '#FFFFFF', C.clara ? 0.04 : 0.05);
  const w = 900, h = Math.round((w * im.naturalHeight) / im.naturalWidth);
  const x0 = (W - w) / 2, y0 = Math.max(Math.round(H * 0.34), Math.round(H - 240 - h));
  x.save(); x.shadowColor = C.clara ? 'rgba(20, 11, 58, .25)' : 'rgba(0, 0, 0, .5)'; x.shadowBlur = 70; x.shadowOffsetY = 28;
  x.fillStyle = C.fondo; x.beginPath(); x.roundRect(x0, y0, w, h, 44); x.fill(); x.restore();
  x.save(); x.beginPath(); x.roundRect(x0, y0, w, h, 44); x.clip(); x.drawImage(im, x0, y0, w, h); x.restore();
  return aBlob(cv);
}

// Hoja con la vista previa y los botones para compartir o guardar la imagen. plantillas (v0.51, al compartir una
// sesión): elegir entre «Cifras», «Mínima», «Con tu foto» y (tanda 2) «Póster» (la foto se elige del móvil y no sale de él).
// v0.52: dibujar (opcional) pinta otra imagen con el mismo flujo de compartir y guardar (el carné de atleta).
// (compartir) logro: la tarjeta de un logro (dibujarLogro); tipo: para el pie de foto; formatos: Publicación o Historia;
// pegatina; el @ del atleta (en este móvil); el texto para pegar; los destinos (WhatsApp, Instagram, Facebook); el resumen
// en texto; y equipo: { tema, texto } para publicarla también en el muro del equipo.
// (tanda 2) paleta (Noche, Clara, Bosque, Brasa, Hielo, Grafito), tu frase, el tono del texto, el texto alternativo, la
// vista «como en Instagram», deslizar para cambiar de plantilla, el carrusel (varias imágenes), la versión animada (vídeo
// corto), lo que has compartido (en el móvil) y la cita del coach en los récords.
const DESTINOS = [
  ['whatsapp', 'WhatsApp', 'https://wa.me/?text='],
  ['instagram', 'Instagram', 'instagram://'],
  ['facebook', 'Facebook', 'fb://'],
];
const puedeCompartirArchivo = (archivos) => !!(archivos?.length && typeof navigator !== 'undefined' && navigator.canShare?.({ files: archivos }));
const aArchivo = (blob, nombre, tipo) => { try { return new File([blob], nombre, { type: tipo }); } catch { return null; } };

export function HojaCompartir({ datos, alCerrar, titulo = 'Compartir la sesión', nota = null, alt = null, plantillas = false, dibujar = null, nombreArchivo = null,
  logro = false, tipo = 'sesion', equipo = null, alPublicado = null, carrusel = null }) {
  const { aviso, api, propio, atleta } = useApp();
  MARCA_APP = !propio && esPorSuCuenta(atleta) ? 'FBE Esencial' : 'FBE Equipo';
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  // (v0.187) «Récord» solo si la sesión tuvo alguno; la plantilla, el fondo y la pegatina se recuerdan en el móvil
  const nRecords = (datos?.records || []).length;
  const lasPlantillas = plantillas ? PLANTILLAS_TARJETA.filter(([k]) => k !== 'record' || nRecords > 0) : null;
  const [plantillaGuardada, setPlantillaGuardada] = usePreferencia(PREF_PLANTILLA, 'cifras');
  const [plantilla, setPlantillaAhora] = useState(() => (plantillas ? plantillaInicial(plantillaGuardada, PLANTILLAS_TARJETA.map(([k]) => k), { records: nRecords }) : 'clasica'));
  const setPlantilla = (k) => { setPlantillaAhora(k); if (plantillas && k !== 'foto') setPlantillaGuardada(k); };
  const [fondo, setFondo] = usePreferencia(PREF_FONDO, 'auto');
  const [personalizar, setPersonalizar] = usePreferencia(PREF_PERSONALIZAR, false);
  const [fraseEquipo, setFraseEquipo] = useState('');
  const [formato, setFormato] = usePreferencia('fbe-compartir-formato', 'publicacion');
  const [paleta, setPaleta] = usePreferencia(PREF_PALETA, 'noche');
  const [peg, setPeg] = usePreferencia(PREF_PEGATINA, '');
  const [handle, setHandle] = usePreferencia(PREF_HANDLE, '');
  const [frase, setFrase] = usePreferencia(PREF_FRASE, '');
  const [conFrase, setConFrase] = useState(false);
  const [tono, setTono] = usePreferencia(PREF_TONO, 'sobrio');
  const [editarHandle, setEditarHandle] = useState(false);
  const [foto, setFoto] = useState(null); // { img, url }
  const [recuadro, setRecuadro] = useState(null); // (v0.190) { img, url }: tu foto en un recuadro de la tarjeta
  const entradaRec = useRef(null);
  const [verTexto, setVerTexto] = useState(false);
  const [comoInstagram, setComoInstagram] = usePreferencia('fbe-compartir-marco', false);
  const [publicando, setPublicando] = useState(false);
  const [publicada, setPublicada] = useState(false);
  const [video, setVideo] = useState(null);   // { estado: 'grabando' | 'listo' | 'error', blob, url, tipo }
  const [, setCompartidos] = usePreferencia(PREF_COMPARTIDOS, []);
  const entrada = useRef(null);
  const personalizable = !dibujar;   // el carné y otras imágenes propias no tienen formato, paleta, pegatina ni @
  // (belleza 310) el carné y las imágenes propias, también como fondo de pantalla (las demás, con su formato)
  const [comoFondo, setComoFondo] = usePreferencia('fbe-compartir-pantalla', false);
  // (belleza 307-309) la tarjeta que se coge, el viaje al guardarla y su ✓
  const carta = useRef(null);
  const imgEl = useRef(null);
  const botonGuardar = useRef(null);
  const coger = useRef(null);
  const [guardada, setGuardada] = useState(false);
  const equipoHandle = handleEquipo();
  // «Publicar en el equipo» solo estando dentro de la comunidad (y nunca el coach desde la ficha de un atleta)
  const enEquipo = useCarga(() => (!equipo || propio ? Promise.resolve(false) : Promise.all([api.comunidad(), api.miembroComunidad()]).then(([c, m]) => !!c.activa && api.dentroDeComunidad(m)).catch(() => false)), [!!equipo]);
  // (tanda 2) La cita del coach en la tarjeta de un récord: su mensaje automático de récord, con su nombre
  const cita = useCarga(() => (logro && tipo === 'record' && !propio && !datos?.cita
    ? Promise.all([api.mensajesCoach().catch(() => []), api.nombreCoach().catch(() => null)]).then(([ms, coach]) => {
      const t = mensajeDe(ms, 'record');
      return t ? { texto: textoMensajeCoach(t, { nombre: '', ejercicio: datos?.nombre || '' }).replace(/\s+/g, ' ').trim(), autor: typeof coach === 'string' ? coach.split(' ')[0] : coach?.nombre?.split(' ')[0] || '' } : null;
    }).catch(() => null) : Promise.resolve(null)), [logro, tipo]);
  const datosConCita = cita.datos ? { ...datos, cita: cita.datos } : datos;
  const fraseActiva = conFrase && personalizable ? frase : '';
  const opciones = { plantilla: plantilla === 'foto' && !foto?.img ? 'minima' : plantilla, foto: plantilla === 'foto' ? foto?.img || null : null, recuadro: plantillas && plantilla !== 'foto' ? recuadro?.img || null : null, formato: personalizable ? formato : 'publicacion',
    pegatina: personalizable ? peg : '', handle, equipo: equipoHandle, paleta: personalizable ? paleta : 'noche', frase: fraseActiva, fondo: personalizable ? fondo : 'auto' };
  // (v0.187) los fondos que hay, con los de esta tarjeta delante
  // (belleza 324) y, delante, «Tu portada» (la ilustración que has puesto en tu perfil), si es de las ilustradas
  const miPortada = atleta && !propio ? portadaPerfil() : null;
  const fondos = personalizable && hayImagen('compartir-sesion') ? [...(miPortada && hayImagen(miPortada) ? [['portada', 'Tu portada', 'portada']] : []), ...fondosDisponibles(grupoFondo(datos, logro || !plantillas ? tipo : 'sesion'))] : [];
  const conFondo = fondos.length > 0 && opciones.paleta !== 'clara' && plantilla !== 'foto';
  const sorprender = () => {
    const s = sorpresa({ plantillas: lasPlantillas ? lasPlantillas.map(([k]) => k) : [], fondos: conFondo ? fondos.map(([k]) => k) : [], ahora: { plantilla, paleta, fondo } });
    if (lasPlantillas && s.plantilla) setPlantilla(s.plantilla);
    setPaleta(s.paleta); if (conFondo) setFondo(s.fondo);
  };
  // La imagen que se ve lleva lo con que se pintó: mientras no coincide con lo elegido, se está preparando
  const enPantalla = opciones.formato === 'fondo' || (!personalizable && comoFondo);
  const clave = `${plantilla}:${plantilla === 'foto' ? foto?.url || '' : ''}:${recuadro?.url || ''}:${opciones.formato}:${opciones.pegatina}:${handle}:${opciones.paleta}:${fraseActiva}:${cita.datos?.texto || ''}:${opciones.fondo}:${enPantalla ? 'pantalla' : ''}`;
  const preparando = !img || img.clave !== clave;
  // (310) el fondo de pantalla: se pinta la tarjeta de siempre (4:5) y se pone sobre la noche, por debajo del reloj
  const pintar = (d, o) => {
    const base = dibujar || (logro ? dibujarLogro : dibujarTarjeta);
    if (!enPantalla) return base(d, o);
    return base(d, { ...o, formato: 'publicacion' }).then((b) => enTurno(() => pintarFondoPantalla(b, o.paleta)));
  };
  const forma = enPantalla ? 'fondo' : opciones.formato;
  useEffect(() => {
    let vivo = true;
    pintar(datosConCita, opciones).then(async (blob) => {
      if (!vivo) return;
      const url = URL.createObjectURL(blob);
      const poner = () => setImg((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { blob, url, clave, plantilla, conFoto: !!opciones.foto, pintada: opciones.plantilla, forma }; });
      // (309) al cambiar de plantilla o de formato, la tarjeta se transforma en la nueva (cambia de forma y funde), sin
      // saltar; con la nueva ya decodificada, para que no parpadee
      const antes = imgRef.current;
      if (antes?.url && carta.current && (antes.plantilla !== plantilla || antes.forma !== forma) && !sinMovimiento()) {
        try { const im = new Image(); im.src = url; await im.decode(); } catch { /* sin decodificar: igual */ }
        if (!vivo) { URL.revokeObjectURL(url); return; }
        conTransicion(poner, 'morph', [{ nombre: 'vt-viaje', desde: carta.current, hasta: '.cpt-carta' }]);
      } else poner();
    }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [clave]);
  // (307) La tarjeta se coge: al arrastrarla se inclina en 3D, siguiendo al dedo, y le corre un brillo (las de récord,
  // tornasol, como el carné); al soltarla, vuelve con un muelle. Nunca con «reducir movimiento»
  const moverCarta = (e) => {
    const el = carta.current;
    if (!el || coger.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))), py = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
    el.style.setProperty('--cpt-ry', `${((px - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty('--cpt-rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
    el.style.setProperty('--cpt-x', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--cpt-y', `${(py * 100).toFixed(1)}%`);
  };
  const cogerCarta = (e) => {
    if (sinMovimiento() || (e.pointerType === 'mouse' && e.button !== 0) || !carta.current) return;
    coger.current = e.pointerId;
    carta.current.classList.add('cpt-coge');
    moverCarta(e);
  };
  const soltarCarta = (e) => {
    const el = carta.current;
    if (!el || coger.current !== e.pointerId) return;
    coger.current = null;
    const desde = getComputedStyle(el).transform;
    el.classList.remove('cpt-coge');
    el.style.removeProperty('--cpt-rx'); el.style.removeProperty('--cpt-ry');
    if (desde && desde !== 'none') { try { el.animate([{ transform: desde }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.2, 1.3, .4, 1)' }); } catch { /* de golpe */ } }
  };
  // (308) «Guardar imagen», con su viaje: la tarjeta se encoge hacia el botón y el botón dice «Guardada» con su ✓
  const viajeGuardar = () => {
    setGuardada(true);
    setTimeout(() => { if (montada.current) setGuardada(false); }, 1800);
    const a = imgEl.current, b = botonGuardar.current;
    if (sinMovimiento() || !a || !b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (!ra.width || !rb.width) return;
    const c = a.cloneNode();
    c.removeAttribute('alt'); c.setAttribute('aria-hidden', 'true'); c.className = 'cpt-viaje';
    Object.assign(c.style, { left: `${ra.left}px`, top: `${ra.top}px`, width: `${ra.width}px`, height: `${ra.height}px` });
    document.body.appendChild(c);
    const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2), dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
    const k = Math.max(0.06, Math.min(0.22, rb.height / ra.height));
    try {
      const an = c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${k.toFixed(3)})`, opacity: 0.15 }], { duration: 540, easing: 'cubic-bezier(.5, 0, .2, 1)' });
      an.onfinish = () => c.remove(); an.oncancel = () => c.remove();
    } catch { c.remove(); }
  };
  // Al cerrar, fuera las URL de la imagen, de la foto y del vídeo (la foto no se guarda en ningún sitio)
  const imgRef = useRef(null); imgRef.current = img;
  const fotoRef = useRef(null); fotoRef.current = foto;
  const recRef = useRef(null); recRef.current = recuadro;
  const videoRef = useRef(null); videoRef.current = video;
  const montada = useRef(true);
  useEffect(() => () => { montada.current = false; if (imgRef.current?.url) URL.revokeObjectURL(imgRef.current.url); if (fotoRef.current?.url) URL.revokeObjectURL(fotoRef.current.url); if (recRef.current?.url) URL.revokeObjectURL(recRef.current.url); if (videoRef.current?.url) URL.revokeObjectURL(videoRef.current.url); }, []);
  const elegirFoto = (e, enRecuadro = false) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { aviso('Elige una imagen (JPG, PNG o HEIC).', 'error'); return; }
    const url = URL.createObjectURL(f);
    const im = new Image();
    // (si la hoja se cierra mientras se abre la foto, su URL se libera aquí: nadie la va a usar)
    im.onload = () => {
      if (!montada.current) { URL.revokeObjectURL(url); return; }
      if (enRecuadro) { setRecuadro((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { img: im, url }; }); return; }
      setFoto((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return { img: im, url }; }); setPlantilla('foto');
    };
    im.onerror = () => { URL.revokeObjectURL(url); if (montada.current) aviso('No se ha podido abrir esa imagen. Prueba con otra.', 'error'); };
    im.src = url;
  };
  const nombre = nombreArchivo || nombreArchivoDe(datos, opciones.formato);
  const archivo = img && aArchivo(img.blob, nombre, 'image/png');
  const puedeCompartir = puedeCompartirArchivo(archivo ? [archivo] : null);
  const pie = pieDeFoto(datosConCita, { tipo, handle, equipo: equipoHandle, tono });
  const alternativo = textoAlternativo(datos, tipo);
  const resumen = tipo === 'sesion' && (datos.mejores || []).length ? resumenTexto(datos, { handle, equipo: equipoHandle }) : null;
  const texto = plantillas && img
    ? `Tarjeta de ${datos.nombre} (${PLANTILLAS_TARJETA.find(([k]) => k === img.pintada)?.[1] || ''}${img.plantilla === 'foto' && !img.conFoto ? ', hasta que elijas una foto' : ''}): ${(datos.cardio ? cifrasCardio(datos.cardio) : cifrasTarjeta(datos)).map((c) => `${c.v}${c.u ? ` ${c.u}` : ''} ${c.t.toLowerCase()}`).join(', ')}${img.conFoto ? ', sobre tu foto' : ''}`
    : alt || alternativo;
  // (tanda 2) lo que has compartido: se apunta al compartir, guardar o publicar (qué y con qué opciones; la imagen, no)
  const anotar = () => { if (!personalizable) return; setCompartidos((lista) => anotarCompartido(lista, { datos, tipo, logro, plantillas, opciones, titulo })); };

  // Compartir con la hoja del móvil (la imagen y el texto; cada app coge lo que admite)
  const compartirHoja = async (archivos = [archivo]) => {
    try { await navigator.share({ files: archivos, title: datos.nombre || MARCA_APP, text: pie }); anotar(); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: guarda la imagen y súbela tú.', 'error'); }
  };
  const guardar = async () => { if (!(await descargar(nombre, img.blob, 'image/png'))) { aviso('Mantén pulsada la imagen para guardarla.', 'error'); return false; } anotar(); return true; };
  const guardarConViaje = async () => { if (await guardar()) viajeGuardar(); };
  // Un destino: con la hoja del móvil si admite archivos (WhatsApp e Instagram salen en ella); si no, se guarda la
  // imagen, se copia el texto y se abre la app (Instagram y Facebook no admiten que una web les pase una imagen)
  const aDestino = async (k, url) => {
    if (puedeCompartir) { await compartirHoja(); return; }
    const copiado = await copiar(pie);
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
      await api.publicarEnComunidad({ fotos: [jpeg], texto: [fraseEquipo.trim(), equipo.texto ?? pie.split('\n').slice(0, 2).join('\n')].filter(Boolean).join('\n').slice(0, 500), tema: equipo.tema || 'logros' });
      setPublicada(true); aviso('Publicado en el equipo'); anotar(); lanzarConfeti({ vibracion: null }); alPublicado?.();
    } catch (e) { aviso(e.message, 'error'); } finally { setPublicando(false); }
  };
  // (tanda 2) El carrusel: varias imágenes de una vez (la hoja del móvil las admite juntas; si no, se guardan una a una)
  const paginasCarrusel = carrusel || (plantillas ? [
    { datos, opciones: { ...opciones, plantilla: 'cifras', foto: null } },
    { datos, opciones: { ...opciones, plantilla: 'clasica', foto: null } },
    ...((datos.records || []).length ? [{ datos: { tipo: 'record', etiqueta: 'Nuevo récord', nombre: datos.records[0].nombre, fecha: datos.fecha, cifra: null, lineas: [datos.records[0].texto] }, logro: true }] : []),
  ] : null);
  const [carruselEstado, setCarruselEstado] = useState(null);
  const compartirCarrusel = async () => {
    if (!paginasCarrusel?.length || carruselEstado === 'preparando') return;
    setCarruselEstado('preparando');
    try {
      const blobs = [];
      for (const pg of paginasCarrusel) blobs.push(await (pg.logro ? dibujarLogro : dibujarTarjeta)(pg.datos, { ...opciones, ...(pg.opciones || {}), formato: 'publicacion' }));
      const archivos = blobs.map((b, i) => aArchivo(b, nombre.replace(/\.png$/, `-${i + 1}.png`), 'image/png')).filter(Boolean);
      if (puedeCompartirArchivo(archivos)) { await compartirHoja(archivos); }
      else { for (const [i, b] of blobs.entries()) { await descargar(nombre.replace(/\.png$/, `-${i + 1}.png`), b, 'image/png'); await new Promise((r) => setTimeout(r, 600)); } aviso(`${blobs.length} imágenes guardadas: súbelas juntas como carrusel.`); anotar(); }
    } catch (e) { aviso(e.message || 'No se ha podido preparar el carrusel', 'error'); } finally { setCarruselEstado(null); }
  };
  // (tanda 2) La versión animada: un vídeo corto (5 s) de la tarjeta entrando con un brillo que la recorre, para historias
  const puedeVideo = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  const grabarVideo = async () => {
    if (!img?.blob || video?.estado === 'grabando') return;
    setVideo({ estado: 'grabando' });
    try {
      const r = await animarTarjeta(img.blob);
      if (!montada.current) { URL.revokeObjectURL(r.url); return; }
      setVideo({ estado: 'listo', ...r });
    } catch (e) { if (montada.current) setVideo({ estado: 'error', mensaje: e.message }); }
  };
  const compartirVideo = async () => {
    const f = aArchivo(video.blob, nombre.replace(/\.png$/, video.tipo.includes('mp4') ? '.mp4' : '.webm'), video.tipo);
    if (puedeCompartirArchivo(f ? [f] : null)) { try { await navigator.share({ files: [f], title: datos.nombre || MARCA_APP, text: pie }); anotar(); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir el vídeo: guárdalo y súbelo tú.', 'error'); } }
    else if (await descargar(f?.name || 'fbe.webm', video.blob, video.tipo)) { aviso('Vídeo guardado'); anotar(); }
    else aviso('No se ha podido guardar el vídeo en este navegador.', 'error');
  };
  const guardarHandle = (v) => { try { setHandle(limpiarHandle(v)); setEditarHandle(false); } catch (e) { aviso(e.message, 'error'); } };
  // (tanda 2) deslizar sobre la vista previa para pasar de plantilla
  const toque = useRef(null);
  const indicePlantilla = lasPlantillas ? lasPlantillas.findIndex(([k]) => k === plantilla) : -1;
  const pasarPlantilla = (paso) => {
    if (!lasPlantillas) return;
    const n = (indicePlantilla + paso + lasPlantillas.length) % lasPlantillas.length;
    const k = lasPlantillas[n][0];
    setPlantilla(k); if (k === 'foto' && !foto) entrada.current?.click();
  };
  const alTocar = (e) => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const alSoltar = (e) => {
    if (!toque.current) return;
    const dx = e.changedTouches[0].clientX - toque.current.x, dy = e.changedTouches[0].clientY - toque.current.y;
    toque.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) pasarPlantilla(dx < 0 ? 1 : -1);
  };
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      {lasPlantillas && (
        <fieldset class="plantillas">
          <legend>Plantilla</legend>
          {lasPlantillas.map(([k, t]) => (
            <label class="plantilla-op" key={k}>
              <input type="radio" name="plantilla-tarjeta" value={k} checked={plantilla === k} onChange={() => { setPlantilla(k); if (k === 'foto' && !foto) entrada.current?.click(); }} />
              <span class={`plantilla-mini mini-${k}`} aria-hidden="true">{k === 'cifras' ? '42' : k === 'minima' ? 'A' : k === 'foto' ? <Icono n="camara" /> : k === 'poster' ? 'Aa' : k === 'lista' ? <Icono n="ordenar" /> : k === 'record' ? <Icono n="trofeo" /> : <Icono n="luna" />}</span>
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
      {plantillas && <input ref={entrada} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Elegir una foto para la tarjeta" onChange={(e) => elegirFoto(e)} />}
      {plantillas && <input ref={entradaRec} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Elegir tu foto para el recuadro" onChange={(e) => elegirFoto(e, true)} />}
      {error ? <div class="error" role="alert">{error}</div> : !img ? <Cargando texto="Preparando la imagen" /> : (
        <>
          <div class={`tarjeta-previa ${preparando ? 'cargando' : ''} ${img.forma === 'fondo' ? 'previa-fondo cpt-pantalla' : opciones.formato === 'historia' ? 'previa-historia' : opciones.formato === 'cuadrado' ? 'previa-cuadrado' : ''} ${comoInstagram ? 'marco-ig' : ''}`} aria-busy={preparando ? 'true' : 'false'}
            onTouchStart={lasPlantillas ? alTocar : undefined} onTouchEnd={lasPlantillas ? alSoltar : undefined}
            onPointerDown={cogerCarta} onPointerMove={moverCarta} onPointerUp={soltarCarta} onPointerCancel={soltarCarta} onLostPointerCapture={soltarCarta}>
            {comoInstagram && (
              <div class="marco-ig-cab" aria-hidden="true">
                <span class="marco-ig-avatar">{(handle || datos.nombre || 'F').slice(0, 1).toUpperCase()}</span>
                <span class="marco-ig-nombre">{handle ? conArroba(handle) : 'tu_instagram'}</span>
                <span class="marco-ig-puntos">···</span>
              </div>
            )}
            <span class={`cpt-carta${['record', 'logro'].includes(tipo) || ['record', 'logro'].includes(datos?.tipo) || plantilla === 'record' ? ' cpt-tornasol' : ''}`} ref={carta} data-ig={comoInstagram ? '' : undefined}>
              <img class="tarjeta-img" src={img.url} alt={texto} ref={imgEl} draggable={false} />
              <i class="cpt-brillo" aria-hidden="true" />
            </span>
            {comoInstagram && opciones.formato !== 'historia' && (
              <div class="marco-ig-pie" aria-hidden="true">
                <span>♡</span><span>◯</span><span>➤</span><span class="marco-ig-guardar">⊟</span>
                <p class="marco-ig-texto"><strong>{handle ? handle : 'tu_instagram'}</strong> {pie.split('\n')[0]}</p>
              </div>
            )}
            {lasPlantillas && (
              <div class="previa-puntos" aria-hidden="true">{lasPlantillas.map(([k]) => <i key={k} class={k === plantilla ? 'activo' : ''} />)}</div>
            )}
          </div>
          {!personalizable && (
            <div class="fila-envolver previa-herramientas">
              <button type="button" class="btn-texto mini" aria-pressed={comoFondo ? 'true' : 'false'} onClick={() => setComoFondo(!comoFondo)}><Icono n="movil" /> {comoFondo ? 'Volver a la tarjeta' : 'Como fondo de pantalla'}</button>
            </div>
          )}
          {personalizable && (
            <div class="fila-envolver previa-herramientas">
              {lasPlantillas && <span class="mini terciario">Desliza la imagen para cambiar de plantilla.</span>}
              <button type="button" class="btn-texto mini" aria-pressed={comoInstagram ? 'true' : 'false'} onClick={() => setComoInstagram(!comoInstagram)}>{comoInstagram ? 'Quitar el marco' : 'Ver como en Instagram'}</button>
            </div>
          )}
          <div class="fila-envolver compartir-botones">
            {puedeCompartir && <button class="btn btn-primario" onClick={() => compartirHoja()}><Icono n="compartir" /> Compartir…</button>}
            <button ref={botonGuardar} class={`btn ${puedeCompartir ? '' : 'btn-primario'}${guardada ? ' cpt-guardada' : ''}`} onClick={guardarConViaje}><Icono n={guardada ? 'hecho' : 'descargar'} /> {guardada ? 'Guardada' : 'Guardar imagen'}</button>
            {paginasCarrusel?.length > 1 && <button class="btn" disabled={carruselEstado === 'preparando' || preparando} onClick={compartirCarrusel}><Icono n="imagen" /> {carruselEstado === 'preparando' ? 'Preparando…' : `Carrusel (${paginasCarrusel.length})`}</button>}
          </div>
          {/* (v0.187) publicar en el equipo, a la vista y con una frase si quiere */}
          {equipo && enEquipo.datos === true && !publicada && (
            <div class="compartir-equipo">
              <input class="entrada" type="text" maxLength={140} value={fraseEquipo} placeholder="Unas palabras para el equipo (opcional)" aria-label="Unas palabras para el equipo" onInput={(e) => setFraseEquipo(e.currentTarget.value)} />
              <button type="button" class="btn" disabled={publicando || preparando} onClick={publicarEquipo}><Icono n="equipo" /> {publicando ? 'Publicando…' : 'Publicar en el equipo'}</button>
            </div>
          )}
          {publicada && <p class="nota peq"><Icono n="hecho" /> Publicada en el muro del equipo.</p>}
          {personalizable && (
            <div class="fila-envolver compartir-estilo">
              <button type="button" class="btn btn-peq" aria-expanded={personalizar ? 'true' : 'false'} aria-controls="compartir-opciones" onClick={() => setPersonalizar(!personalizar)}><Icono n="ajustes" /> {personalizar ? 'Ocultar las opciones' : 'Personalizar'}</button>
              <button type="button" class="btn btn-peq" disabled={preparando} onClick={sorprender}><Icono n="estrella" /> Sorpréndeme</button>
            </div>
          )}
          {personalizable && personalizar && (
        <div class="compartir-opciones" id="compartir-opciones">
          <div class="campo"><span class="etq">Formato</span><Segmentos etiqueta="Formato de la imagen" valor={formato} alCambiar={(v) => setFormato(v || 'publicacion')} opciones={FORMATOS.map(([k, t]) => [k, t])} /></div>
          {plantillas && plantilla !== 'foto' && (
            <div class="campo">
              <span class="etq">Tu foto</span>
              <div class="fila-envolver">
                <button type="button" class="btn btn-peq" onClick={() => entradaRec.current?.click()}><Icono n="camara" /> {recuadro ? 'Cambiar mi foto' : 'Añadir mi foto'}</button>
                {recuadro && <button type="button" class="btn-texto mini" onClick={() => setRecuadro((previa) => { if (previa?.url) URL.revokeObjectURL(previa.url); return null; })}>Quitar mi foto</button>}
              </div>
              <span class="mini terciario">Sale en un recuadro, arriba a la derecha. Se prepara en tu móvil y no se sube a ningún sitio.</span>
            </div>
          )}
          {plantilla !== 'foto' && (
            <div class="campo">
              <span class="etq">Colores</span>
              <div class="chips-fila paletas" role="radiogroup" aria-label="Colores">
                {PALETAS.map(([k, t, c]) => <button type="button" key={k} role="radio" aria-checked={paleta === k ? 'true' : 'false'} class={`paleta-op ${paleta === k ? 'activo' : ''}`} style={`--pf:${c.noche};--pa:${c.morado};--pt:${c.tinta}`} onClick={() => setPaleta(k)}><span class="paleta-muestra" aria-hidden="true"><i /></span>{t}</button>)}
              </div>
            </div>
          )}
          {conFondo && (
            <div class="campo">
              <span class="etq">Fondo</span>
              <div class="chips-fila fondos-fila" role="radiogroup" aria-label="Fondo">
                {[['auto', 'Automático'], ['', 'Sin dibujo'], ...fondos].map(([k, t]) => (
                  <button type="button" key={k || 'ninguno'} role="radio" aria-checked={fondo === k ? 'true' : 'false'} class={`fondo-op ${fondo === k ? 'activo' : ''}`} onClick={() => setFondo(k)}>
                    <span class="fondo-muestra" aria-hidden="true">{k && k !== 'auto' ? <img src={fuenteImagen(k === 'portada' ? miPortada : k).src} alt="" loading="lazy" /> : <Icono n={k === 'auto' ? 'estrella' : 'cerrar'} />}</span>{t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div class="campo">
            <span class="etq">Pegatina</span>
            <div class="chips-fila" role="radiogroup" aria-label="Pegatina">
              {PEGATINAS_TARJETA.map(([k, t]) => <button type="button" key={k} role="radio" aria-checked={peg === k ? 'true' : 'false'} class={`chip chip-boton ${peg === k ? 'activo' : ''}`} onClick={() => setPeg(k)}>{t}</button>)}
            </div>
          </div>
          <div class="campo compartir-frase">
            {conFrase ? (
              <div class="fila">
                <input class="entrada" type="text" maxLength={70} value={frase} placeholder="Tu frase (hasta 70 letras)" aria-label="Tu frase en la tarjeta" onInput={(e) => setFrase(limpiarFrase(e.currentTarget.value))} autoFocus />
                <button type="button" class="btn btn-peq" onClick={() => { setConFrase(false); }}>Quitar</button>
              </div>
            ) : <button type="button" class="btn-texto" onClick={() => setConFrase(true)}>{frase ? `Añadir tu frase: «${frase}»` : 'Añadir una frase tuya a la tarjeta'}</button>}
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
          {personalizable && (
            <div class="fila-envolver compartir-destinos" aria-label="Enviar a">
              {DESTINOS.map(([k, t, url]) => <button type="button" key={k} class={`btn btn-peq destino-${k}`} onClick={() => aDestino(k, url)}>{t}</button>)}
              <button type="button" class="btn btn-peq" onClick={async () => { const ok = await copiar(pie); aviso(ok ? 'Texto copiado: pégalo en tu publicación' : 'No se ha podido copiar', ok ? undefined : 'error'); }}><Icono n="copiar" /> Copiar texto</button>
              {resumen && <button type="button" class="btn btn-peq" onClick={async () => aviso((await copiar(resumen)) ? 'Resumen copiado: pégalo en el grupo' : 'No se ha podido copiar')}><Icono n="mensaje" /> Resumen para el grupo</button>}
              <button type="button" class="btn-texto mini" aria-expanded={verTexto ? 'true' : 'false'} onClick={() => setVerTexto(!verTexto)}>{verTexto ? 'Ocultar el texto' : 'Ver el texto'}</button>
            </div>
          )}
          {verTexto && (
            <div class="pila-s compartir-texto-caja">
              <Segmentos etiqueta="Tono del texto" valor={tono} alCambiar={(v) => setTono(v || 'sobrio')} opciones={TONOS} clase="seg-compacto" />
              <pre class="compartir-texto">{pie}</pre>
              <button type="button" class="btn-texto mini" onClick={async () => aviso((await copiar(alternativo)) ? 'Descripción copiada: pégala en «Texto alternativo» de Instagram' : 'No se ha podido copiar')}>Copiar la descripción para accesibilidad</button>
            </div>
          )}
          {personalizable && puedeVideo && (
            <div class="compartir-video">
              {!video || video.estado === 'error' ? (
                <button type="button" class="btn btn-peq" disabled={preparando} onClick={grabarVideo}><Icono n="video" /> Versión animada (5 s)</button>
              ) : video.estado === 'grabando' ? <Cargando texto="Grabando el vídeo (5 s)" />
                : <div class="fila-envolver"><video class="video-previa" src={video.url} muted playsInline autoPlay loop aria-label="La tarjeta animada" /><button type="button" class="btn btn-peq btn-primario" onClick={compartirVideo}><Icono n="compartir" /> Compartir el vídeo</button></div>}
              {video?.estado === 'error' && <span class="mini terciario">No se ha podido grabar aquí ({video.mensaje}).</span>}
            </div>
          )}
          <p class="mini terciario">{nota || (logro ? 'Solo lleva el logro y sus cifras: nada de peso corporal, salud ni nutrición.' : plantillas ? 'Solo lleva el nombre de la sesión, la duración, las series, el tonelaje y tus récords: nada de peso corporal, salud ni nutrición.' : 'Solo lleva el nombre de la sesión, las series, el tonelaje, los minutos y tus mejores series: nada de peso corporal ni datos de salud.')} {personalizable && 'Instagram y Facebook no cogen la imagen desde una web: con sus botones se guarda, se copia el texto y se abre la app para que la subas. '}En el móvil también puedes mantener pulsada la imagen para guardarla.</p>
        </>
      )}
    </Hoja>
  );
}

// (tanda 2) La tarjeta animada: 5 segundos en los que entra con un zoom suave y la recorre un brillo; después se queda
// quieta (así en una historia se lee bien). Sale como vídeo del navegador (mp4 en el iPhone, webm en Android y Chrome).
async function animarTarjeta(blob, { segundos = 5, fps = 30 } = {}) {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    img.src = url; await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const x = cv.getContext('2d');
    const tipo = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!tipo) throw new Error('este navegador no graba vídeo');
    const flujo = cv.captureStream(fps);
    const rec = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
    const trozos = [];
    rec.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data); };
    const fin = new Promise((ok, mal) => { rec.onstop = ok; rec.onerror = (e) => mal(e.error || new Error('no se ha podido grabar')); });
    const fondo = C.fondo;
    const pintar = (t) => {
      // t: 0..1. Entrada (0–0,5 s): zoom de 0,92 a 1 y aparición. Brillo (0,6–1,8 s) que recorre la tarjeta en diagonal.
      const s = Math.min(1, t * segundos / 0.5), e = 1 - (1 - s) ** 3;
      x.fillStyle = fondo; x.fillRect(0, 0, cv.width, cv.height);
      x.save(); x.globalAlpha = e; x.translate(cv.width / 2, cv.height / 2); const z = 0.92 + 0.08 * e; x.scale(z, z); x.drawImage(img, -cv.width / 2, -cv.height / 2); x.restore();
      const b = (t * segundos - 0.6) / 1.2;
      if (b >= 0 && b <= 1) {
        const px = -cv.width * 0.6 + b * cv.width * 2.2;
        const g = x.createLinearGradient(px, 0, px + cv.width * 0.5, cv.height);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
      }
    };
    pintar(0);
    rec.start(200);
    const inicio = performance.now();
    await new Promise((ok) => {
      const paso = () => { const t = (performance.now() - inicio) / (segundos * 1000); if (t >= 1) { pintar(1); ok(); return; } pintar(t); requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    });
    await new Promise((r) => setTimeout(r, 250));
    rec.stop();
    await fin;
    flujo.getTracks().forEach((t) => t.stop());
    const salida = new Blob(trozos, { type: tipo.split(';')[0] });
    if (!salida.size) throw new Error('el vídeo ha salido vacío');
    return { blob: salida, url: URL.createObjectURL(salida), tipo: tipo.split(';')[0] };
  } finally { URL.revokeObjectURL(url); }
}

// (tanda 2) En el perfil: lo que has compartido desde este móvil (las últimas 12 tarjetas), para volver a verlas y
// compartirlas. Se guarda qué era y con qué opciones, nunca la imagen ni la foto.
export function LoCompartido() {
  const [lista, setLista] = usePreferencia(PREF_COMPARTIDOS, []);
  const [abierta, setAbierta] = useState(null);
  if (!Array.isArray(lista) || !lista.length) return null;
  return (
    <section class="seccion lo-compartido">
      <h2>Lo que has compartido</h2>
      <div class="panel">
        <ul class="lista">
          {lista.map((x, i) => (
            <li key={`${x.cuando}-${i}`}>
              <button class="fila-ios fila-boton" onClick={() => setAbierta(x)} aria-label={`Volver a compartir: ${textoCompartido(x)}`}>
                <span class="ico-fila"><Icono n={x.logro ? 'trofeo' : 'compartir'} /></span>
                <span class="fila-ios-texto"><span class="fila-ios-titulo">{textoCompartido(x)}</span><span class="peq terciario">{x.cuando ? fmtCorta(String(x.cuando).slice(0, 10)) : ''}{x.opciones?.formato === 'historia' ? ' · historia' : ''}</span></span>
                <Icono n="derecha" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p class="mini terciario">Solo en este móvil: qué compartiste y cómo (la imagen se vuelve a preparar; la foto no se guarda). <button type="button" class="btn-texto mini" onClick={() => setLista([])}>Borrar la lista</button></p>
      {abierta && <HojaCompartir datos={abierta.datos} tipo={abierta.tipo} logro={!!abierta.logro} plantillas={!!abierta.plantillas} titulo={abierta.titulo || 'Compartir'} alCerrar={() => setAbierta(null)} />}
    </section>
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
    x.fillStyle = '#140B3A'; x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(img, 0, 0);
    return await new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido preparar la imagen.'))), 'image/jpeg', 0.9));
  } finally { URL.revokeObjectURL(url); }
}

// (v0.207) RecordatorioCompartir, en su propio archivo (va en Hoy, y así Hoy no carga esta hoja entera al abrir la app)
export { RecordatorioCompartir } from './RecordatorioCompartir.jsx';
