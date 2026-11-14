// «La travesía» (remate, tanda 7): compartir una imagen o un vídeo del juego (o guardarlo si el móvil no deja compartir)
export async function compartirArchivo(blob, nombre, texto = '') {
  if (!blob) throw new Error('sin archivo');
  const archivo = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [archivo] })) { await navigator.share({ files: [archivo], ...(texto ? { text: texto } : {}) }); return 'compartida'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'guardada';
}

// Un lienzo con una franja abajo (los metros y el nombre del juego; ningún nombre de persona), como PNG
export async function conFranja(lienzo, titulo) {
  const w = lienzo.width, h = lienzo.height, k = w / (lienzo.getBoundingClientRect?.().width || w), banda = Math.round(64 * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h + banda;
  const x = c.getContext('2d');
  x.drawImage(lienzo, 0, 0);
  x.fillStyle = '#0E0D15'; x.fillRect(0, h, w, banda);
  x.fillStyle = '#EEEEF2'; x.textBaseline = 'middle';
  x.font = `800 ${Math.round(22 * k)}px system-ui, sans-serif`; x.fillText(titulo, Math.round(18 * k), h + banda / 2);
  x.textAlign = 'right'; x.fillStyle = '#A49CFF'; x.font = `700 ${Math.round(15 * k)}px system-ui, sans-serif`; x.fillText('FBE Equipo', w - Math.round(18 * k), h + banda / 2);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

// (remate, tanda 7) «El clip de la etapa»: graba unos segundos del propio lienzo cuando pasa algo especial (un momento
// raro, el combo ×4). Una vez por etapa, solo donde el navegador sabe (MediaRecorder y captureStream) y nunca con la
// batería baja. Lo grabado se queda en memoria hasta que se comparte o empieza otra etapa: no se sube a ningún sitio.
const TIPOS = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const puedeGrabar = () => typeof MediaRecorder === 'function' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
export function crearGrabadora(lienzo, { segundos = 5, alTener = () => {} } = {}) {
  if (!puedeGrabar() || !lienzo) return null;
  const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  let rec = null, partes = [], hecho = false, empezo = 0, reloj = 0, motivo = '';
  const cerrar = () => { clearTimeout(reloj); if (rec && rec.state !== 'inactive') try { rec.stop(); } catch { /* ya parado */ } };
  return {
    // empieza a grabar (si no ha grabado ya en esta etapa)
    grabar(por) {
      if (hecho || rec) return false;
      try {
        const flujo = lienzo.captureStream(30);
        rec = new MediaRecorder(flujo, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 2_500_000 });
      } catch { hecho = true; return false; }
      motivo = por || ''; empezo = performance.now();
      rec.ondataavailable = (ev) => { if (ev.data?.size) partes.push(ev.data); };
      rec.onstop = () => {
        hecho = true;
        rec.stream?.getTracks?.().forEach((t) => t.stop());
        const dura = (performance.now() - empezo) / 1000;
        if (partes.length && dura >= 1.5) alTener({ blob: new Blob(partes, { type: rec.mimeType || tipo || 'video/webm' }), motivo });
        partes = [];
      };
      try { rec.start(); } catch { hecho = true; rec = null; return false; }
      reloj = setTimeout(cerrar, segundos * 1000);
      return true;
    },
    // al acabar la etapa: si aún graba, corta ya (y entrega lo que haya)
    cerrar,
    // al salir sin acabar: corta y tira lo grabado
    tirar() { hecho = true; partes = []; if (rec) rec.ondataavailable = null; if (rec) rec.onstop = () => rec.stream?.getTracks?.().forEach((t) => t.stop()); cerrar(); },
  };
}
export const extensionDe = (blob) => (/mp4/.test(blob?.type || '') ? 'mp4' : 'webm');
