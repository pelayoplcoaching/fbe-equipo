// (belleza 357 y 362, v0.288) Qué app es en este móvil: FBE Equipo o FBE Esencial. Se apunta al entrar («fbe-app», solo
// eso: ni el nombre ni nada de la cuenta) para que la próxima vez la portada de arranque, el nombre de la pestaña, el
// nombre y el icono al instalarla y su manifiesto sean los suyos desde el primer instante (lo lee web/arranque.js antes
// de pintar). Y se aplica en el momento, por si se instala justo después de entrar por primera vez.
const CLAVE = 'fbe-app';

export const appDe = (esencial) => (esencial ? 'esencial' : 'equipo');

export function aplicarApp(app) {
  if (typeof document === 'undefined') return;
  const es = app === 'esencial';
  const r = document.documentElement;
  if (es) r.setAttribute('data-app', 'esencial'); else r.removeAttribute('data-app');
  const poner = (sel, attr, v) => { const el = document.querySelector(sel); if (el && el.getAttribute(attr) !== v) el.setAttribute(attr, v); };
  poner('meta[name="apple-mobile-web-app-title"]', 'content', es ? 'FBE Esencial' : 'FBE Equipo');
  poner('link[rel="manifest"]', 'href', es ? 'manifest-esencial.webmanifest' : 'manifest.webmanifest');
  poner('link[rel="apple-touch-icon"]', 'href', es ? 'esencial-180.png' : 'icono-180.png');
  poner('link[rel="icon"]', 'href', es ? 'esencial.svg' : 'icono.svg');
}

// (en la demo no se apunta: la demo dice cuál es en su dirección)
export function apuntarApp(app, { recordar = true } = {}) {
  if (recordar) { try { localStorage.setItem(CLAVE, app === 'esencial' ? 'esencial' : 'equipo'); } catch { /* sin almacenamiento: la próxima vez, el nombre de siempre */ } }
  aplicarApp(app);
}
