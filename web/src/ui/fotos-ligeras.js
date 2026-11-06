// Pulido 2.1: fotos de perfil ligeras. La foto de siempre (384 px, unos 60 KB en texto) viajaba entera en cada lista.
// Con la migración 047, «foto» guarda una miniatura (128 px, unos 6 KB) y «foto_grande» la de siempre, que solo se
// pide al ampliarla. Aquí: sacar la miniatura de una foto y aligerar las que ya había (una vez, en segundo plano).

import { FOTO_MINI_MAX } from '../datos/api.js';

export const LADO_MINI = 128;

// La miniatura de una foto de perfil (un data URL cuadrado) → otro data URL JPEG de `lado` píxeles
export async function miniaturaDe(dataUrl, { lado = LADO_MINI, max = FOTO_MINI_MAX } = {}) {
  const img = await new Promise((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error('No se ha podido abrir la foto.'));
    i.src = dataUrl;
  });
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('No se ha podido abrir la foto.');
  const c = Math.min(w, h);
  const lienzo = document.createElement('canvas');
  lienzo.width = lado; lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lado, lado);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (w - c) / 2, (h - c) / 2, c, c, 0, 0, lado, lado);
  for (const q of [0.82, 0.74, 0.66, 0.56, 0.46]) {
    const datos = lienzo.toDataURL('image/jpeg', q);
    if (datos.startsWith('data:image/jpeg;base64,') && datos.length <= max) return datos;
  }
  throw new Error('La miniatura pesa demasiado.');
}

// Las fotos que no se han podido aligerar (una imagen que el navegador no abre) no se vuelven a intentar en este
// dispositivo: si no, se bajarían en cada arranque para nada
const CLAVE = 'fbe-fotos-sin-aligerar';
const leerFallidas = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')); } catch { return new Set(); } };
const guardarFallidas = (s) => { try { localStorage.setItem(CLAVE, JSON.stringify([...s].slice(-200))); } catch { /* */ } };

// Aligera las fotos que aún van enteras en «foto»: el coach, las de todos; un atleta, la suya. Devuelve cuántas.
// Sin la migración 047 no hace nada (la API contesta null). Se puede llamar las veces que haga falta.
let enMarcha = null;
export function aligerarFotos(api) {
  enMarcha ||= (async () => {
    let hechas = 0;
    try {
      const filas = await api.fotosPorAligerar();
      if (!filas?.length) return 0;
      const fallidas = leerFallidas();
      for (const f of filas) {
        if (fallidas.has(f.id)) continue;
        let mini = null;
        try { mini = await miniaturaDe(f.foto); } catch { fallidas.add(f.id); guardarFallidas(fallidas); continue; }
        // (si no se puede guardar ahora —sin conexión, sin permiso—, se intentará en otro arranque)
        try { await api.guardarFotoLigera(f.id, mini, f.foto); hechas++; } catch { /* */ }
      }
    } catch { /* */ } finally { enMarcha = null; }
    return hechas;
  })();
  return enMarcha;
}
