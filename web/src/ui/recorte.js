// Recortar y aligerar un vídeo en el propio móvil antes de subirlo (v0.30).
// Se reproduce el trozo elegido en un <video> (a la vista si se da un contenedor: Safari pausa los que no se ven), se pinta cada fotograma en un lienzo de 720p como mucho y se
// graba el lienzo con MediaRecorder (MP4 si el navegador sabe; si no, WebM), sin sonido. Tarda lo que dura el trozo.
// Entre colocar el móvil y empezar la serie se van 20-30 s: un minuto de iPhone (~100 MB) se queda en ~10 MB.

export const BITS_POR_SEGUNDO = 2_500_000; // 720p de sobra para ver la técnica fotograma a fotograma
const LADO_CORTO = 720, LADO_LARGO = 1280;
// Solo MP4: el WebM que graba MediaRecorder no lleva la duración y no se puede avanzar ni ir fotograma a fotograma
// (Chrome graba MP4 desde la 126, Safari desde iOS 14.5). Sin MP4, el vídeo se sube como está.
const TIPOS = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4'];

export function tipoSalida() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return TIPOS.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || null;
}
export function sePuedeRecortar() {
  return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function' && !!tipoSalida();
}
// Lo que pesará más o menos (MB) el trozo ya aligerado
export const megasEstimados = (segundos) => (Math.max(0, segundos) * BITS_POR_SEGUNDO) / 8 / 1048576;

// Tamaño de salida: el lado corto a 720 como mucho (y el largo a 1280), en múltiplos de 16 (algunos codificadores
// de Android fallan con otras medidas; la deformación es de menos de un 1 %)
export function medidas(w, h) {
  const k = Math.min(1, LADO_CORTO / Math.min(w, h), LADO_LARGO / Math.max(w, h));
  const m16 = (x) => Math.max(16, Math.round((x * k) / 16) * 16);
  return { w: m16(w), h: m16(h) };
}

const esperar = (el, ev, ms = 15000) => new Promise((ok, mal) => {
  const t = setTimeout(() => { quitar(); mal(new Error('El vídeo no responde')); }, ms);
  const bien = () => { quitar(); ok(); };
  const fallo = () => { quitar(); mal(new Error('Este vídeo no se puede leer en el navegador')); };
  const quitar = () => { clearTimeout(t); el.removeEventListener(ev, bien); el.removeEventListener('error', fallo); };
  el.addEventListener(ev, bien, { once: true });
  el.addEventListener('error', fallo, { once: true });
});

// Se llama dentro del propio toque en «Enviar» (antes de cualquier espera): en iPhone, con el modo de bajo consumo,
// un vídeo solo se puede reproducir si se arranca con el gesto de la persona. Se arranca y se para: queda desbloqueado.
export function prepararVideo(archivo) {
  const url = URL.createObjectURL(archivo);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.src = url;
  let listo = Promise.resolve();
  try { const p = v.play(); if (p && p.then) listo = p.then(() => v.pause(), () => {}); } catch { /* */ }
  // Se espera a que acabe ese arranque antes de recortar (si su pausa llegara después, cortaría la grabación)
  listo = Promise.race([listo, new Promise((r) => setTimeout(r, 5000))]);
  return { video: v, url, listo };
}

// archivo: File/Blob del vídeo; inicio y fin en segundos. alProgreso(0…1). Devuelve un File nuevo.
// senal: { aborted } para cancelar; preparado: lo de prepararVideo (si no, se crea aquí).
// Si se sale de la app a medias, se para el vídeo o se atasca, se acaba con un error que lo dice (nunca se queda colgado).
export async function recortarVideo(archivo, { inicio = 0, fin, alProgreso = () => {}, senal = null, contenedor = null, preparado = null } = {}) {
  const tipo = tipoSalida();
  if (!tipo || !sePuedeRecortar()) throw new Error('Este navegador no puede recortar vídeos');
  const { video: v, url, listo } = preparado || prepararVideo(archivo);
  if (contenedor) { v.className = 'medio'; contenedor.appendChild(v); } else {
    // Fuera de la vista pero «visible» (algunos móviles no decodifican un vídeo con display:none)
    v.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(v);
  }
  const SALIDA = 'Has salido de la app mientras se preparaba el vídeo. Vuelve a enviarlo sin salir de la app.';
  let recorder = null, flujo = null, cancelado = null, vigilar = null;
  const alOcultar = () => { if (document.visibilityState === 'hidden') cancelado = new Error(SALIDA); };
  document.addEventListener('visibilitychange', alOcultar);
  try {
    await listo;
    if (v.readyState < 1) await esperar(v, 'loadedmetadata');
    const dur = Number.isFinite(v.duration) ? v.duration : fin;
    const desde = Math.max(0, Math.min(inicio, dur));
    const hasta = Math.min(dur, fin ?? dur);
    if (!(hasta - desde > 0.2)) throw new Error('El trozo elegido es demasiado corto');
    const { w, h } = medidas(v.videoWidth || 720, v.videoHeight || 1280);
    const lienzo = document.createElement('canvas');
    lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext('2d', { alpha: false });
    v.pause();
    v.currentTime = desde;
    await esperar(v, 'seeked');
    if (cancelado || senal?.aborted) throw cancelado || new Error('Cancelado');
    ctx.drawImage(v, 0, 0, w, h);
    flujo = lienzo.captureStream(30);
    const trozos = [];
    recorder = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: BITS_POR_SEGUNDO });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
    const parado = new Promise((ok) => { recorder.onstop = ok; });
    const pintar = () => { try { ctx.drawImage(v, 0, 0, w, h); } catch { /* */ } };
    await new Promise((ok, mal) => {
      let acabado = false, ultimo = -1, quieto = Date.now();
      const acabar = (err) => {
        if (acabado) return;
        acabado = true; clearInterval(vigilar); v.removeEventListener('pause', alPausar);
        v.pause(); err ? mal(err) : ok();
      };
      // Una pausa que no viene de aquí: el móvil ha parado el vídeo (se ha salido de la app, una llamada…)
      const alPausar = () => { if (!acabado && v.currentTime < hasta - 0.05 && !v.ended) acabar(cancelado || new Error(SALIDA)); };
      const paso = () => {
        if (acabado) return;
        if (cancelado || senal?.aborted) { acabar(cancelado || new Error('Cancelado')); return; }
        pintar();
        alProgreso(Math.min(1, Math.max(0, (v.currentTime - desde) / (hasta - desde))));
        if (v.currentTime >= hasta - 0.01 || v.ended) { acabar(); return; }
        if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(paso); else requestAnimationFrame(paso);
      };
      v.addEventListener('ended', () => acabar(), { once: true });
      v.addEventListener('error', () => acabar(new Error('Este vídeo no se puede leer en el navegador')), { once: true });
      // Un reloj vigila también: cancelar, el final, y un vídeo atascado (más de 4 s sin avanzar)
      vigilar = setInterval(() => {
        if (acabado) return;
        if (cancelado || senal?.aborted) { acabar(cancelado || new Error('Cancelado')); return; }
        if (v.currentTime >= hasta - 0.01) { acabar(); return; }
        if (v.currentTime !== ultimo) { ultimo = v.currentTime; quieto = Date.now(); } else if (Date.now() - quieto > 4000) acabar(new Error('El vídeo se ha atascado al recortarlo'));
      }, 250);
      // La grabación empieza cuando el vídeo ya se mueve (si no, el principio sería un fotograma quieto)
      v.play().then(() => {
        if (acabado) return;
        v.addEventListener('pause', alPausar);
        recorder.start();
        paso();
      }, (e) => acabar(new Error(`No se ha podido reproducir el vídeo para recortarlo (${e?.name || 'error'})`)));
    });
    recorder.stop();
    await parado;
    if (cancelado) throw cancelado;
    const base = tipo.split(';')[0];
    const blob = new Blob(trozos, { type: base });
    if (!blob.size) throw new Error('El vídeo recortado ha salido vacío');
    alProgreso(1);
    return new File([blob], 'video-recortado.mp4', { type: base });
  } finally {
    clearInterval(vigilar);
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* */ } }
    flujo?.getTracks().forEach((t) => t.stop());
    try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch { /* */ }
    URL.revokeObjectURL(url);
    document.removeEventListener('visibilitychange', alOcultar);
  }
}
