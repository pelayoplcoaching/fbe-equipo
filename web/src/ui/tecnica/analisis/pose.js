// Los puntos del cuerpo en el dispositivo (v0.58): MediaPipe Pose (@mediapipe/pose, de Google, licencia Apache-2.0), con
// su modelo «lite», su wasm y su grafo copiados en la app al empaquetarla (modelos/pose-<versión>/): se sirven desde la
// propia app, no de un CDN, y solo se descargan la primera vez que se usa (unos 12 MB; el service worker los guarda
// entonces, no al instalar la app). La imagen va al modelo en este dispositivo: no sale a ningún sitio.
// crearDetector() → { detectar(lienzo, t) → [33 × { x, y, visibility }] | null, cerrar() }: la misma interfaz para el
// modelo de verdad y para el de prueba de la demo (window.__fbePosePrueba(t), solo en la demo).

export const RUTA_POSE = typeof __POSE__ !== 'undefined' ? __POSE__ : null;
export const poseDisponible = (demo = false) => !!RUTA_POSE || (demo && typeof globalThis.__fbePosePrueba === 'function');

let cargando = null;
// El script del modelo, una vez (y solo cuando se usa)
function cargarScript() {
  if (typeof window !== 'undefined' && window.Pose) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = `${RUTA_POSE}pose.js`;
    s.async = true;
    s.dataset.fbeModelo = 'pose';
    s.onload = () => (window.Pose ? ok() : mal(new Error('El modelo no se ha cargado bien')));
    s.onerror = () => { cargando = null; s.remove(); mal(new Error('No se ha podido descargar el modelo de los puntos del cuerpo: comprueba la conexión y prueba otra vez.')); };
    document.head.appendChild(s);
  });
  return cargando;
}

export async function crearDetector({ demo = false, alEstado = () => {} } = {}) {
  // La demo puede probar la pantalla con puntos de mentira (las pruebas de punta a punta)
  if (demo && typeof globalThis.__fbePosePrueba === 'function') {
    const f = globalThis.__fbePosePrueba;
    return { prueba: true, async detectar(_c, t) { return f(t) || null; }, cerrar() {} };
  }
  if (!RUTA_POSE) throw new Error('Los puntos del cuerpo no están disponibles en esta versión de la app.');
  alEstado('descargando');
  await cargarScript();
  const pose = new window.Pose({ locateFile: (f) => `${RUTA_POSE}${f}` });
  pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, smoothSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, selfieMode: false });
  let pendiente = null;
  pose.onResults((r) => { const f = pendiente; pendiente = null; f?.(r?.poseLandmarks || null); });
  alEstado('preparando');
  try { await pose.initialize(); } catch (e) { try { await pose.close(); } catch { /* */ } throw new Error(`El modelo no arranca en este navegador (${e?.message || e}).`); }
  let cerrado = false;
  return {
    detectar(lienzo) {
      if (cerrado) return Promise.resolve(null);
      return new Promise((ok, mal) => {
        pendiente = ok;
        pose.send({ image: lienzo }).then(() => { if (pendiente === ok) { pendiente = null; ok(null); } }, (e) => { pendiente = null; mal(e); });
      });
    },
    // Suelta el modelo (la memoria de WebGL y del wasm)
    cerrar() { if (cerrado) return; cerrado = true; pendiente?.(null); pendiente = null; try { pose.close(); } catch { /* */ } },
  };
}
