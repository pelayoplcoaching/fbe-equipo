// El worker que sigue la barra (v0.58): recibe cada fotograma como ImageBitmap (ya reducido), lo pinta en un
// OffscreenCanvas, lo pasa a grises y da la posición del disco con su confianza. Cada imagen se suelta al usarla.
// (Se empaqueta aparte, en chunks/analisis-<hash>.js, y solo se carga al analizar.)
import { aGris, crearSeguidor } from '../../../logica/analisis.js';

let seguidor = null, W = 0, H = 0, ctx = null, buf = null;

function gris(bmp) {
  ctx.drawImage(bmp, 0, 0, W, H);
  try { bmp.close(); } catch { /* */ }
  return aGris(ctx.getImageData(0, 0, W, H).data, W, H, buf);
}

self.onmessage = (e) => {
  const m = e.data || {};
  try {
    if (m.tipo === 'iniciar') {
      W = m.w; H = m.h;
      if (typeof OffscreenCanvas === 'undefined') { try { m.bmp?.close(); } catch { /* */ } self.postMessage({ id: m.id, ok: false }); return; }
      ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
      if (!ctx) { try { m.bmp?.close(); } catch { /* */ } self.postMessage({ id: m.id, ok: false }); return; }
      buf = new Uint8Array(W * H);
      seguidor = crearSeguidor(gris(m.bmp), W, H, m.c);
      self.postMessage({ id: m.id, ok: !!seguidor });
    } else if (m.tipo === 'paso') {
      if (!seguidor) { try { m.bmp?.close(); } catch { /* */ } self.postMessage({ id: m.id, error: 'Sin empezar' }); return; }
      const r = seguidor.paso(gris(m.bmp));
      self.postMessage({ id: m.id, res: r });
    }
  } catch (err) {
    try { m.bmp?.close(); } catch { /* */ }
    self.postMessage({ id: m.id, ok: false, error: String(err?.message || err) });
  }
};
