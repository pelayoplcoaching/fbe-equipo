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
  x.fillStyle = '#0B0726'; x.fillRect(0, h, w, banda);
  x.fillStyle = '#F1F0F6'; x.textBaseline = 'middle';
  x.font = `800 ${Math.round(22 * k)}px system-ui, sans-serif`; x.fillText(titulo, Math.round(18 * k), h + banda / 2);
  x.textAlign = 'right'; x.fillStyle = '#A08CFF'; x.font = `700 ${Math.round(15 * k)}px system-ui, sans-serif`; x.fillText('FBE Equipo', w - Math.round(18 * k), h + banda / 2);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
