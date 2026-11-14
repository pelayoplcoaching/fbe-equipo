// (música 3) Que la voz del coach no pise la música: cuando suena un audio del coach (una frase de su voz en la sesión,
// su nota de voz, su audio-píldora o su mensaje de voz), el reproductor de Spotify de la app se pausa y luego sigue.
//
// Sin scripts de fuera (la CSP de la app no los deja): se habla con nuestro propio reproductor incrustado por mensajes
// (postMessage), como hace por dentro la «iFrame API» de Spotify. El reproductor cuenta su estado con mensajes
// { type: 'playback_update', payload: { isPaused, … } } y entiende { command: 'pause' } y { command: 'resume' }.
// Solo se pausa uno que esté sonando (se sabe por esos mensajes) y solo se reanuda el que se pausó aquí: si el
// reproductor no cuenta nada, no se toca (nunca arranca una música que el atleta tenía parada).
//
// Solo maneja el reproductor de la app: la música de la app de Spotify, de otra pestaña o de otro servicio no se toca
// (ningún navegador lo permite).
const ORIGEN = 'https://open.spotify.com';
const reproductores = new Map(); // iframe → { sonando: boolean | null, pausadoAqui: boolean }
let pausas = 0;                  // cuántos audios del coach suenan a la vez
let escuchando = false;

const enviar = (iframe, command) => { try { iframe.contentWindow?.postMessage({ command }, ORIGEN); } catch { /* el reproductor ya no está */ } };

function alMensaje(e) {
  if (e.origin !== ORIGEN) return;
  for (const [iframe, est] of reproductores) {
    if (iframe.contentWindow !== e.source) continue;
    const d = e.data;
    if (d && typeof d === 'object' && d.type === 'playback_update' && d.payload && typeof d.payload.isPaused === 'boolean') {
      est.sonando = !d.payload.isPaused;
    }
  }
}
function alSonarAudio(e) {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement) || !el.hasAttribute('data-pausa-musica')) return;
  if (e.type === 'play') pausarMusica();
  else reanudarMusica();
}
function alSonidoApp(e) {
  const d = e.detail || {};
  if (!String(d.tipo || '').startsWith('voz:')) return;
  pausarMusica();
  setTimeout(reanudarMusica, Math.round((Math.max(0.5, Number(d.segundos) || 1.5) + 0.4) * 1000));
}
function escuchar() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener('message', alMensaje);
  // los avisos de los <audio> no suben: se escuchan en la fase de captura
  document.addEventListener('play', alSonarAudio, true);
  document.addEventListener('pause', alSonarAudio, true);
  document.addEventListener('ended', alSonarAudio, true);
  window.addEventListener('fbe-sonido', alSonidoApp);
}

// El reproductor de la app se apunta al montarse (y se borra al quitarlo)
export function apuntarReproductor(iframe) {
  if (!iframe) return () => {};
  escuchar();
  reproductores.set(iframe, { sonando: null, pausadoAqui: false });
  return () => reproductores.delete(iframe);
}
export function pausarMusica() {
  pausas++;
  for (const [iframe, est] of reproductores) {
    if (est.sonando === true && !est.pausadoAqui) { est.pausadoAqui = true; enviar(iframe, 'pause'); }
  }
}
export function reanudarMusica() {
  pausas = Math.max(0, pausas - 1);
  if (pausas) return;
  for (const [iframe, est] of reproductores) {
    if (est.pausadoAqui) { est.pausadoAqui = false; enviar(iframe, 'resume'); }
  }
}
// (para las pruebas)
export const estadoReproductores = () => [...reproductores.values()].map((x) => ({ ...x }));
