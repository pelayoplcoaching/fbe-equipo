// El análisis de un vídeo, fotograma a fotograma, en este dispositivo (v0.58): un <video> aparte (el del reproductor no se
// toca), se va a cada momento con currentTime (cada 1/30 s) y se lee la imagen reducida. Seguir la barra va en un Web
// Worker (con OffscreenCanvas e ImageBitmap) si el navegador sabe; si no (Safari antiguo), aquí mismo, fotograma a
// fotograma, dejando respirar a la pantalla entre uno y otro. Cancelar (o salir) lo para y suelta el vídeo, el worker y
// las imágenes. Nada sale del dispositivo.
import { aGris, crearSeguidor, tamProceso, momentosDe, tramoAnalisis, DUDOSOS_MAX } from '../../../logica/analisis.js';

export const RUTA_WORKER = typeof __WORKER_ANALISIS__ !== 'undefined' ? __WORKER_ANALISIS__ : null;

export class Cancelado extends Error { constructor() { super('Cancelado'); this.name = 'AbortError'; } }
const comprobar = (senal) => { if (senal?.aborted) throw new Cancelado(); };
const respirar = () => new Promise((ok) => setTimeout(ok, 0));
const conTiempo = (pr, ms, msg) => new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error(msg)), ms); pr.then((x) => { clearTimeout(t); ok(x); }, (e) => { clearTimeout(t); mal(e); }); });

// Un <video> aparte con el mismo archivo, listo para leer sus fotogramas. Un enlace firmado de Storage se lee con CORS
// (crossOrigin): si no, el navegador no deja leer sus píxeles.
export async function abrirVideo(src, senal = null) {
  if (!src) throw new Error('El vídeo aún no está listo');
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  if (!/^blob:|^data:/.test(src)) v.crossOrigin = 'anonymous';
  const cerrar = () => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* */ } };
  try {
    await conTiempo(new Promise((ok, mal) => {
      v.onloadeddata = () => ok();
      v.onerror = () => mal(new Error('Este navegador no puede leer este vídeo para analizarlo.'));
      v.src = src;
      v.load();
    }), 20000, 'El vídeo tarda demasiado en cargar: prueba otra vez.');
    comprobar(senal);
    if (!v.videoWidth || !v.videoHeight) throw new Error('Este vídeo no tiene imagen que analizar.');
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    return { v, w: v.videoWidth, h: v.videoHeight, dur, cerrar };
  } catch (e) { cerrar(); throw e; }
}

// Ir al momento t (con su «seeked»; si no llega, otra vez un poco después, y si tampoco, error)
export async function irA(v, t, ms = 5000) {
  const destino = Math.max(0, Math.min(t, Number.isFinite(v.duration) && v.duration > 0 ? v.duration - 0.001 : t));
  if (Math.abs(v.currentTime - destino) < 0.0005 && v.readyState >= 2) return;
  const una = (x) => new Promise((ok, mal) => {
    const fin = () => { clearTimeout(tm); v.removeEventListener('seeked', listo); v.removeEventListener('error', fallo); };
    const listo = () => { fin(); ok(); };
    const fallo = () => { fin(); mal(new Error('El vídeo ha dado un error al avanzar.')); };
    const tm = setTimeout(() => { fin(); mal(new Error('tiempo')); }, ms);
    v.addEventListener('seeked', listo);
    v.addEventListener('error', fallo);
    try { v.currentTime = x; } catch (e) { fin(); mal(e); }
  });
  try { await una(destino); }
  catch (e) {
    if (e.message !== 'tiempo') throw e;
    try { await una(Math.max(0, destino - 0.001)); } catch { throw new Error('El vídeo no responde al avanzar: prueba otra vez (o con un vídeo más corto).'); }
  }
  // Algunos navegadores avisan de «seeked» antes de tener la imagen: se espera a que la tenga
  if (v.readyState < 2) await conTiempo(new Promise((ok) => { v.addEventListener('loadeddata', ok, { once: true }); v.addEventListener('canplay', ok, { once: true }); }), ms, 'El vídeo no responde al avanzar.').catch(() => {});
}

// Un lienzo para leer la imagen (en este hilo)
function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  return { c, ctx };
}
export function leerGris(v, ctx, w, h, out = null) {
  try {
    ctx.drawImage(v, 0, 0, w, h);
    return aGris(ctx.getImageData(0, 0, w, h).data, w, h, out);
  } catch (e) {
    if (e?.name === 'SecurityError') throw new Error('Este navegador no deja leer la imagen de este vídeo, así que no se puede analizar aquí.');
    throw e;
  }
}

// ---------------------------------------------------------------- seguir la barra
// En un worker (si se puede): cada fotograma va como ImageBitmap (transferido, sin copiarlo)
function seguidorEnWorker() {
  if (!RUTA_WORKER || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') return null;
  let w;
  try { w = new Worker(RUTA_WORKER); } catch { return null; }
  let n = 0;
  const esperando = new Map();
  w.onmessage = (e) => { const f = esperando.get(e.data?.id); if (f) { esperando.delete(e.data.id); f(e.data); } };
  w.onerror = () => { for (const f of esperando.values()) f({ error: 'El análisis se ha parado (worker)' }); esperando.clear(); };
  const pedir = (msg, transfer = []) => new Promise((ok) => { const id = ++n; esperando.set(id, ok); w.postMessage({ ...msg, id }, transfer); });
  return {
    async iniciar(bmp, W, H, c) { const r = await pedir({ tipo: 'iniciar', bmp, w: W, h: H, c }, [bmp]); return !!r.ok; },
    async paso(bmp) { const r = await pedir({ tipo: 'paso', bmp }, [bmp]); if (r.error) throw new Error(r.error); return r.res; },
    cerrar() { try { w.terminate(); } catch { /* */ } esperando.clear(); },
  };
}
// Aquí mismo (sin worker): la misma lógica
function seguidorLocal() {
  let s = null, W = 0, H = 0, ctx = null, buf = null;
  return {
    local: true,
    iniciar(v, w, h, c) { W = w; H = h; ctx = lienzo(w, h).ctx; buf = new Uint8Array(w * h); const g = leerGris(v, ctx, W, H); s = crearSeguidor(g, W, H, c); return !!s; },
    paso(v) { return s.paso(leerGris(v, ctx, W, H, buf)); },
    cerrar() { s = null; ctx = null; buf = null; },
  };
}
const bitmap = (v, W, H) => createImageBitmap(v, { resizeWidth: W, resizeHeight: H, resizeQuality: 'medium' });

// Sigue el disco desde «inicio» ({ t, x, y } de 0 a 1 y r, su radio en píxeles del vídeo) hasta t1. Devuelve
// { puntos: [[t, x, y, conf]] (x e y de 0 a 1), perdida: t | null, w, h (del vídeo), dur, local }
export async function seguirBarra({ src, inicio, t1, alProgreso = () => {}, senal = null, sinWorker = false }) {
  const vid = await abrirVideo(src, senal);
  let seg = null;
  try {
    const { v, w: vw, h: vh, dur } = vid;
    const { t0, t1: fin } = tramoAnalisis(inicio.t, t1, dur || inicio.t + 60);
    const ts = momentosDe(t0, fin);
    if (ts.length < 3) throw new Error('El tramo es demasiado corto para seguir la barra (hacen falta unos fotogramas).');
    const { w: W, h: H, k } = tamProceso(vw, vh, inicio.r);
    const c = { x: inicio.x * W, y: inicio.y * H, r: Math.max(4, inicio.r * k) };
    await irA(v, ts[0]);
    comprobar(senal);
    // El worker, si se puede; si falla al empezar, aquí mismo
    seg = sinWorker ? null : seguidorEnWorker();
    if (seg) {
      let ok = false;
      try { ok = await conTiempo(seg.iniciar(await bitmap(v, W, H), W, H, c), 8000, 'worker'); } catch { ok = false; }
      if (!ok) { seg.cerrar(); seg = null; }
    }
    if (!seg) { seg = seguidorLocal(); if (!seg.iniciar(v, W, H, c)) throw new Error('No se ve bien el disco ahí: toca justo su centro (o agranda el círculo) y prueba otra vez.'); }
    const puntos = [[ts[0], inicio.x, inicio.y, 1]];
    let perdida = null, dudosos = [];
    for (let i = 1; i < ts.length; i++) {
      comprobar(senal);
      await irA(v, ts[i]);
      comprobar(senal);
      const r = seg.local ? seg.paso(v) : await seg.paso(await bitmap(v, W, H));
      if (r.estado === 'ok') { dudosos = []; puntos.push([ts[i], Math.min(1, Math.max(0, r.x / W)), Math.min(1, Math.max(0, r.y / H)), Math.round(r.conf * 100) / 100]); }
      else if (r.estado === 'dudoso') dudosos.push(ts[i]);
      else { perdida = dudosos[0] ?? ts[i]; break; }
      alProgreso(i / (ts.length - 1));
      if (seg.local && i % 2 === 0) await respirar();
    }
    // (si el vídeo acaba con fotogramas dudosos, la barra no se ha perdido: simplemente no se ve bien al final)
    if (perdida == null && dudosos.length >= DUDOSOS_MAX) perdida = dudosos[0];
    alProgreso(1);
    return { puntos, perdida, w: vw, h: vh, dur, local: !!seg.local };
  } finally {
    seg?.cerrar();
    vid.cerrar();
  }
}

// ---------------------------------------------------------------- los puntos del cuerpo
// Cada «paso» s (de 2 en 2 fotogramas), la imagen reducida (como mucho 360 px de ancho) al detector. Devuelve
// { fotos: [{ t, kp: [[x, y, visibilidad] × 33] }], w, h } (solo los fotogramas en que se ve a alguien)
export async function detectarPose({ src, t0, t1, detector, paso = 2 / 30, alProgreso = () => {}, senal = null }) {
  const vid = await abrirVideo(src, senal);
  try {
    const { v, w: vw, h: vh, dur } = vid;
    const tr = tramoAnalisis(t0, t1, dur || t0 + 60);
    const ts = momentosDe(tr.t0, tr.t1, paso);
    if (ts.length < 2) throw new Error('El tramo es demasiado corto.');
    const k = Math.min(1, 360 / vw);
    const W = Math.round(vw * k), H = Math.round(vh * k);
    const { c, ctx } = lienzo(W, H);
    const fotos = [];
    for (let i = 0; i < ts.length; i++) {
      comprobar(senal);
      await irA(v, ts[i]);
      comprobar(senal);
      ctx.drawImage(v, 0, 0, W, H);
      const kp = await detector.detectar(c, ts[i]);
      comprobar(senal);
      if (kp?.length >= 33) fotos.push({ t: ts[i], kp: kp.map((p) => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000, Math.round((p.visibility ?? 1) * 100) / 100]) });
      alProgreso((i + 1) / ts.length);
      await respirar();
    }
    return { fotos, w: vw, h: vh, recortado: tr.recortado };
  } finally { vid.cerrar(); }
}
