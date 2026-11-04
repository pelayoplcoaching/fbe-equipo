// v0.60: el «compositor» de vídeo, en el propio móvil u ordenador. Pinta en un lienzo el fotograma de un vídeo y lo que va
// encima (los dibujos, las marcas y sus textos, la nota, la burbuja de la cámara de delante, la cara tapada) y graba el
// lienzo (canvas.captureStream) con MediaRecorder, con el sonido que se le dé (el micro, la voz del coach). Devuelve un Blob.
// Lo usan «Grabar la revisión» (1), su burbuja con la cara del coach (2), «Exportar con correcciones» (3) y «Difuminar la
// cara» (13). Formato: MP4 si el navegador sabe; si no, WebM. Como mucho 720p y 3 minutos. Se puede cancelar y, al acabar
// (bien, mal o cancelado), suelta todo: las pistas de la cámara y el micro, el lienzo, los vídeos y sus URL.
// Lo que se puede probar sin navegador (el formato, los topes, la línea de tiempo de lo de encima) está en logica/composicion.js.
import { elegirFormato, medidasSalida, encajar, capasEn, burbuja, MARCA_AGUA, FPS_COMPOSICION, BITS_COMPOSICION, MAX_SEG_REVISION, MAX_SEG_DIFUMINAR, progresoDe } from '../../logica/composicion.js';
import { cajaEn, cajaMinima, tramoDifuminar } from '../../logica/cara.js';
import { tiempoVoz } from '../../logica/tecnica.js';
import { pintarFormas } from '../Video.jsx';

const esCompatible = (t) => { try { return !!globalThis.MediaRecorder?.isTypeSupported?.(t); } catch { return false; } };
// ¿Se puede componer aquí? (lienzo que se graba y MediaRecorder con algún formato). Si no, el botón no sale.
export function puedeComponer({ audio = false } = {}) {
  return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && typeof globalThis.MediaRecorder === 'function' && !!elegirFormato(esCompatible, { audio });
}
export const formatoComposicion = (audio = false) => elegirFormato(esCompatible, { audio });

export class Cancelado extends Error { constructor() { super('Cancelado'); this.name = 'AbortError'; this.cancelado = true; } }
// Suelta un flujo de la cámara o el micro (todas sus pistas)
export function soltarFlujo(flujo) { try { flujo?.getTracks?.().forEach((t) => t.stop()); } catch { /* */ } }
// La URL de una vista previa, fuera un poco después de quitarla de la pantalla (si no, el <video> que se va aún la pide)
export const revocarLuego = (url) => { if (url) setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* */ } }, 3000); };
// Deja un <video> sin nada que retener (la memoria del decodificador)
export function soltarVideo(v) { try { v.pause(); v.removeAttribute('src'); v.srcObject = null; v.load(); v.remove(); } catch { /* */ } }

// ---------------------------------------------------------------- grabar el lienzo
// { lienzo, ctx, empezar(), parar() → { blob, seg, tipo, ext }, cancelar(), seg(), liberar() }. pistas: las de sonido.
export function crearGrabacion({ w, h, pistas = [], fps = FPS_COMPOSICION, bits = BITS_COMPOSICION, maxSeg = MAX_SEG_REVISION, alTope = null }) {
  const formato = formatoComposicion(pistas.length > 0);
  if (!formato || !puedeComponer()) throw new Error('Este navegador no puede grabar vídeo así');
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { alpha: false });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const flujo = lienzo.captureStream(fps);
  for (const p of pistas) { try { flujo.addTrack(p); } catch { /* */ } }
  let rec;
  try { rec = new MediaRecorder(flujo, { mimeType: formato.grabar, videoBitsPerSecond: bits, ...(pistas.length ? { audioBitsPerSecond: 64000 } : {}) }); }
  catch (e) { soltarFlujo(flujo); throw new Error(`Este navegador no puede grabar vídeo así (${e?.message || e})`); }
  const trozos = [];
  let inicio = 0, acumulado = 0, enMarcha = false, cancelada = false, vigilante = null;
  rec.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data); };
  const seg = () => (acumulado + (enMarcha ? performance.now() - inicio : 0)) / 1000;
  const parado = new Promise((ok) => { rec.onstop = ok; });
  const liberar = () => {
    clearInterval(vigilante);
    try { if (rec.state !== 'inactive') rec.stop(); } catch { /* */ }
    // (las pistas del lienzo; las de sonido las suelta quien las abrió: la cámara y el micro)
    try { flujo.getVideoTracks().forEach((t) => t.stop()); } catch { /* */ }
    lienzo.width = 1; lienzo.height = 1;
  };
  return {
    lienzo, ctx, formato, seg,
    empezar() {
      rec.start(500); inicio = performance.now(); enMarcha = true;
      vigilante = setInterval(() => { if (seg() >= maxSeg) { clearInterval(vigilante); alTope?.(); } }, 250);
    },
    pausar() { if (rec.state === 'recording') { try { rec.pause(); } catch { /* */ } acumulado += performance.now() - inicio; enMarcha = false; } },
    seguir() { if (rec.state === 'paused') { try { rec.resume(); } catch { /* */ } inicio = performance.now(); enMarcha = true; } },
    async parar() {
      const s = seg();
      clearInterval(vigilante);
      if (rec.state !== 'inactive') { try { rec.requestData?.(); } catch { /* */ } rec.stop(); }
      await parado;
      enMarcha = false;
      liberar();
      if (cancelada) throw new Cancelado();
      const blob = new Blob(trozos, { type: formato.tipo });
      if (!blob.size) throw new Error('La grabación ha salido vacía: prueba otra vez');
      return { blob, seg: Math.min(maxSeg, s), tipo: formato.tipo, ext: formato.ext };
    },
    cancelar() { cancelada = true; liberar(); },
    liberar,
  };
}

// ---------------------------------------------------------------- pintar
// El fotograma del vídeo en todo el lienzo (W × H con su misma proporción) y, si hay zoom, como en el reproductor: el
// zoom y el desplazamiento son los de su caja en pantalla (px), con la imagen en rect dentro de ella.
export function pintarFotograma(ctx, v, W, H, { zoom = null, caja = null, rect = null } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const r = encajar(W, H, v.videoWidth || W, v.videoHeight || H);
  if (zoom && zoom.z > 1 && caja?.w && rect?.w) {
    // (un punto de la imagen u, en el lienzo sin zoom r.xy + u, va a z·(r.xy + u) + r.xy·(1 − z) + k·((centro − rect.xy)·(1 − z) + desplazamiento))
    const k = r.w / rect.w, z = zoom.z;
    ctx.setTransform(z, 0, 0, z, r.x * (1 - z) + k * ((caja.w / 2 - rect.x) * (1 - z) + zoom.x), r.y * (1 - z) + k * ((caja.h / 2 - rect.y) * (1 - z) + zoom.y));
  }
  try { ctx.drawImage(v, r.x, r.y, r.w, r.h); } catch { /* (un fotograma que aún no está) */ }
  return r;
}
// Las formas en la imagen (con el mismo zoom ya puesto)
export function pintarDibujo(ctx, formas, r, proporcion) {
  if (!formas?.length) return;
  ctx.save(); ctx.translate(r.x, r.y);
  pintarFormas(ctx, formas, r.w, r.h, proporcion);
  ctx.restore();
}
const redondo = (ctx, x, y, w, h, rr) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, rr); else ctx.rect(x, y, w, h); };
// Un texto en su píldora (abajo a la izquierda, uno encima de otro; o en una esquina)
export function pintarPildora(ctx, texto, x, y, { k = 1, fondo = 'rgba(15,14,23,.78)', color = '#fff', alinear = 'izq' } = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `700 ${Math.round(15 * k)}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(texto).width + 20 * k, h = 28 * k;
  const x0 = alinear === 'der' ? x - w : x;
  ctx.fillStyle = fondo; redondo(ctx, x0, y, w, h, 8 * k); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(texto, x0 + 10 * k, y + h / 2);
  ctx.restore();
  return h;
}
export function pintarTextos(ctx, textos, W, H) {
  const k = Math.max(1, Math.min(W, H) / 400);
  let y = H - 14 * k;
  for (const t of [...(textos || [])].reverse()) {
    y -= 28 * k;
    pintarPildora(ctx, t.texto, 14 * k, y, { k, color: t.estado === 'bien' ? '#7CE0A3' : t.estado === 'mal' ? '#FF9A9A' : '#fff' });
    y -= 6 * k;
  }
}
export function pintarMarcaAgua(ctx, W, H, texto = MARCA_AGUA) {
  const k = Math.max(1, Math.min(W, H) / 400);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `800 ${Math.round(12 * k)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3 * k;
  ctx.strokeText(texto, W - 10 * k, H - 8 * k); ctx.fillText(texto, W - 10 * k, H - 8 * k);
  ctx.restore();
}
// La cámara de delante en su burbuja redonda (como en un espejo, como la ve quien se graba)
export function pintarBurbuja(ctx, cam, esquina, W, H) {
  if (!cam?.videoWidth) return;
  const { d, cx, cy } = burbuja(esquina, W, H);
  const lado = Math.min(cam.videoWidth, cam.videoHeight);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.translate(cx + d / 2, cy - d / 2); ctx.scale(-1, 1);
  try { ctx.drawImage(cam, (cam.videoWidth - lado) / 2, (cam.videoHeight - lado) / 2, lado, lado, 0, 0, d, d); } catch { /* */ }
  ctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.lineWidth = Math.max(2, d / 40); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); ctx.restore();
}
// Tapar una zona (de 0 a 1 dentro de la imagen r) con un mosaico de cuadros grandes: no se reconoce la cara y se ve
// igual en todos los navegadores (el desenfoque del lienzo, ctx.filter, no lo tiene Safari)
const tesela = typeof document !== 'undefined' ? document.createElement('canvas') : null;
// (revisión L1) Falla cerrado: una caja diminuta se agranda al mínimo y, si no se puede pintar el mosaico, la zona se tapa
// entera con una forma opaca (nunca se deja la cara a la vista)
export function taparZona(ctx, fuente, cajaDada, r, { cuadros = 9 } = {}) {
  const caja = cajaMinima(cajaDada);
  if (!caja) return;
  const x = r.x + caja.x * r.w, y = r.y + caja.y * r.h, w = Math.max(2, caja.w * r.w), h = Math.max(2, caja.h * r.h);
  const forma = () => { ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, w, h); };
  const opaca = () => { ctx.save(); forma(); ctx.fillStyle = '#5B5670'; ctx.fill(); ctx.restore(); };
  if (!tesela) { opaca(); return; }
  try {
    const n = Math.max(4, Math.min(16, cuadros));
    tesela.width = n; tesela.height = Math.max(4, Math.round((n * h) / w));
    const tx = tesela.getContext('2d');
    const vw = fuente.videoWidth || r.w, vh = fuente.videoHeight || r.h;
    tx.drawImage(fuente, caja.x * vw, caja.y * vh, Math.max(1, caja.w * vw), Math.max(1, caja.h * vh), 0, 0, tesela.width, tesela.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    forma(); ctx.clip();
    ctx.drawImage(tesela, x, y, w, h);
    ctx.restore();
  } catch { try { ctx.restore(); } catch { /* */ } opaca(); }
}

// ---------------------------------------------------------------- un vídeo para leer sus fotogramas
// Un <video> aparte con el archivo, a la vista (Safari no avanza uno escondido) dentro de «contenedor» si se da. Un enlace
// firmado de Storage se lee con CORS: si no, el lienzo no se podría grabar.
export function abrirFuente(src, { contenedor = null, sonido = false } = {}) {
  return new Promise((ok, mal) => {
    const v = document.createElement('video');
    v.muted = !sonido; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', ''); if (!sonido) v.setAttribute('muted', '');
    if (!/^blob:|^data:/.test(src || '')) v.crossOrigin = 'anonymous';
    if (contenedor) { v.className = 'medio compositor-fuente'; contenedor.appendChild(v); }
    else { v.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.appendChild(v); }
    const t = setTimeout(() => { soltarVideo(v); mal(new Error('El vídeo tarda demasiado en cargar: prueba otra vez')); }, 20000);
    v.onloadeddata = () => { clearTimeout(t); ok(v); };
    v.onerror = () => { clearTimeout(t); soltarVideo(v); mal(new Error('Este navegador no puede leer este vídeo para prepararlo')); };
    v.src = src;
    v.load();
  });
}
const irA = (v, t, ms = 5000) => new Promise((ok, mal) => {
  if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) { ok(); return; }
  const fin = () => { clearTimeout(tm); v.removeEventListener('seeked', listo); };
  const listo = () => { fin(); ok(); };
  const tm = setTimeout(() => { fin(); mal(new Error('El vídeo no responde al avanzar: prueba otra vez')); }, ms);
  v.addEventListener('seeked', listo);
  try { v.currentTime = t; } catch (e) { fin(); mal(e); }
});
// Duración real (los WebM de MediaRecorder no la traen: se va al final una vez)
async function duracionDe(v) {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await irA(v, 1e7, 8000).catch(() => {});
  const d = Number.isFinite(v.duration) ? v.duration : 0;
  await irA(v, 0, 5000).catch(() => {});
  return d;
}

// Reproduce el vídeo de «desde» a «hasta» (1×) y pinta cada fotograma con pintar(v, t) mientras se graba. Devuelve lo de
// crearGrabacion().parar(). senal: { aborted }. Si el vídeo se atasca más de 5 s, para con un error.
async function grabarReproduciendo(v, { desde, hasta, w, h, pistas = [], pintar, alProgreso = () => {}, senal = null, alEmpezar = null, maxSeg = MAX_SEG_REVISION }) {
  if (senal?.aborted) throw new Cancelado();
  // (revisión L2) con su tope: si llega a él (el vídeo no acaba donde dice), se para ahí
  let tope = false;
  const g = crearGrabacion({ w, h, pistas, maxSeg: maxSeg + 1, alTope: () => { tope = true; } });
  try {
    await irA(v, desde);
    pintar(g.ctx, v, v.currentTime);
    await v.play();
    g.empezar();
    alEmpezar?.();
    await new Promise((ok, mal) => {
      let ultimo = -1, quieto = Date.now(), fin = false;
      const acabar = (e) => { if (fin) return; fin = true; clearInterval(reloj); v.pause(); e ? mal(e) : ok(); };
      const paso = () => {
        if (fin) return;
        if (senal?.aborted) { acabar(new Cancelado()); return; }
        pintar(g.ctx, v, v.currentTime);
        alProgreso(progresoDe(v.currentTime, desde, hasta));
        if (v.currentTime >= hasta - 0.02 || v.ended || tope) { acabar(); return; }
        if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(paso); else requestAnimationFrame(paso);
      };
      const reloj = setInterval(() => {
        if (senal?.aborted) { acabar(new Cancelado()); return; }
        if (v.currentTime >= hasta - 0.02 || v.ended) { acabar(); return; }
        if (v.paused && document.visibilityState === 'visible') v.play().catch(() => {});
        if (v.currentTime !== ultimo) { ultimo = v.currentTime; quieto = Date.now(); } else if (Date.now() - quieto > 5000) acabar(new Error('El vídeo se ha atascado al prepararlo: prueba otra vez'));
      }, 250);
      v.addEventListener('ended', () => acabar(), { once: true });
      paso();
    });
    return await g.parar();
  } catch (e) { g.cancelar(); throw e; }
}

// ---------------------------------------------------------------- 3. Exportar con correcciones
// El vídeo con lo que corrigió el coach encima (los dibujos en su tramo, los comentarios con su momento y los puntos clave
// con el suyo, la nota en una esquina y la marca «FBE») y su voz sobre el vídeo, si la hay. Nada sale del dispositivo.
export async function exportarCorregido({ src, linea = [], nota = null, voz = null, contenedor = null, alProgreso = () => {}, senal = null }) {
  const v = await abrirFuente(src, { contenedor });
  let audio = null, actx = null, destino = null;
  try {
    const dur = await duracionDe(v);
    if (!(dur > 0)) throw new Error('No se sabe cuánto dura este vídeo: no se puede exportar');
    const hasta = Math.min(dur, MAX_SEG_REVISION);
    const { w, h } = medidasSalida(v.videoWidth, v.videoHeight);
    const pistas = [];
    // La voz del coach, al ritmo del vídeo (como en el reproductor): un <audio> que pasa por WebAudio a la grabación
    if (voz?.url) {
      try {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (C) {
          audio = new Audio();
          if (!/^blob:|^data:/.test(voz.url)) audio.crossOrigin = 'anonymous';
          audio.preload = 'auto'; audio.src = voz.url;
          actx = new C();
          destino = actx.createMediaStreamDestination();
          actx.createMediaElementSource(audio).connect(destino);
          pistas.push(...destino.stream.getAudioTracks());
        }
      } catch { audio = null; }
    }
    const kNota = Math.max(1, Math.min(w, h) / 400);
    const sincronizarVoz = (t) => {
      if (!audio) return;
      const tv = tiempoVoz(t, voz.inicio || 0, voz.dur || audio.duration || 0);
      if (tv == null) { if (!audio.paused) audio.pause(); return; }
      if (Math.abs(audio.currentTime - tv) > 0.3) { try { audio.currentTime = tv; } catch { /* */ } }
      if (audio.paused) audio.play().catch(() => {});
    };
    const pintar = (ctx, vid, t) => {
      const r = pintarFotograma(ctx, vid, w, h);
      const { dibujos, textos } = capasEn(linea, t);
      for (const d of dibujos) pintarDibujo(ctx, d.formas, r, r.w / r.h);
      pintarTextos(ctx, textos, w, h);
      if (nota) pintarPildora(ctx, nota, w - 14 * kNota, 14 * kNota, { k: kNota, alinear: 'der', fondo: 'rgba(124,92,255,.88)' });
      pintarMarcaAgua(ctx, w, h);
      sincronizarVoz(t);
    };
    if (actx?.state === 'suspended') await actx.resume().catch(() => {});
    const r = await grabarReproduciendo(v, { desde: 0, hasta, w, h, pistas, pintar, alProgreso, senal });
    return { ...r, recortado: dur > MAX_SEG_REVISION + 0.5 };
  } finally {
    soltarVideo(v);
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* */ } }
    soltarFlujo(destino?.stream);
    try { await actx?.close(); } catch { /* */ }
  }
}

// ---------------------------------------------------------------- 13. Difuminar la cara
// Primero se busca la cara (el modelo de los puntos del cuerpo, en este dispositivo) en unos 5 fotogramas por segundo;
// después se graba el vídeo con la cabeza tapada en cada fotograma (la caja, a medio camino entre los fotogramas mirados).
// Sin sonido (como los vídeos que aligera la app). detector: { detectar(lienzo, t), cerrar() }. Devuelve { blob, … } o,
// si no se encuentra la cara en ningún fotograma, lanza un error con .sinCara (y no se graba nada).
export async function buscarCaras(src, { desde = 0, hasta = null, detector, tiempos: tiemposDe, cajaDe, alProgreso = () => {}, senal = null, tope = 180000 }) {
  const v = await abrirFuente(src);
  const c = document.createElement('canvas');
  try {
    const dur = await duracionDe(v);
    // (revisión L2) de 2 minutos como mucho (MAX_SEG_DIFUMINAR), aunque no se haya recortado
    const tr = tramoDifuminar(desde, hasta, dur, MAX_SEG_DIFUMINAR);
    const fin = tr.hasta;
    desde = tr.desde;
    const ts = tiemposDe(Math.max(0.1, fin - desde)).map((t) => desde + t);
    const lado = 480, k = Math.min(1, lado / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.max(16, Math.round(v.videoWidth * k)); c.height = Math.max(16, Math.round(v.videoHeight * k));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const limite = Date.now() + tope;
    const muestras = [];
    for (const [i, t] of ts.entries()) {
      if (senal?.aborted) throw new Cancelado();
      if (Date.now() > limite) throw new Error('Buscar la cara está tardando demasiado: prueba con un vídeo más corto (o recórtalo)');
      await irA(v, Math.min(t, dur - 0.02));
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const puntos = await detector.detectar(c, t).catch(() => null);
      muestras.push({ t, caja: puntos ? cajaDe(puntos, { w: v.videoWidth, h: v.videoHeight }) : null });
      alProgreso((i + 1) / ts.length);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    return { muestras, dur, desde, hasta: fin, recortado: tr.recortado };
  } finally { soltarVideo(v); c.width = 1; c.height = 1; }
}
export async function grabarDifuminado(src, { desde = 0, hasta, cajas, contenedor = null, alProgreso = () => {}, senal = null }) {
  const v = await abrirFuente(src, { contenedor });
  try {
    const dur = await duracionDe(v);
    const tr = tramoDifuminar(desde, hasta, dur, MAX_SEG_DIFUMINAR);
    const { w, h } = medidasSalida(v.videoWidth, v.videoHeight);
    const pintar = (ctx, vid, t) => { const r = pintarFotograma(ctx, vid, w, h); taparZona(ctx, vid, cajaEn(cajas, t), r); };
    const res = await grabarReproduciendo(v, { desde: tr.desde, hasta: tr.hasta, w, h, pintar, alProgreso, senal, maxSeg: MAX_SEG_DIFUMINAR });
    // (lo que dura de verdad: el tramo, no lo que tardó en grabarse)
    return { ...res, seg: Math.min(res.seg, tr.hasta - tr.desde), recortado: tr.recortado };
  } finally { soltarVideo(v); }
}

// ---------------------------------------------------------------- guardar en el móvil
// Con «Compartir» (los archivos) si el navegador sabe (el iPhone lo guarda en Fotos desde ahí); si no, una descarga.
export async function guardarEnMovil(blob, nombre) {
  const f = new File([blob], nombre, { type: blob.type || 'video/mp4' });
  try {
    if (navigator.canShare?.({ files: [f] }) && typeof navigator.share === 'function') { await navigator.share({ files: [f], title: nombre }); return 'compartido'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  const u = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  return 'descargado';
}
