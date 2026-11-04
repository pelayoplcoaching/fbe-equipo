// Genera el vídeo de ejemplo del análisis de la barra (v0.58) para la demo y las pruebas: un disco de 45 cm (90 px de
// diámetro en un vídeo de 360 × 640, así que 0,5 cm por píxel) que hace 3 repeticiones de sentadilla con un recorrido de
// 160 px (80 cm), bajando en 0,7 s y subiendo en 0,8, 0,9 y 1,05 s (velocidad media de la subida: 1,00, 0,89 y 0,76 m/s),
// sobre un fondo con ruido fijo. WebM (VP9), sin sonido, 30 fotogramas por segundo y un fotograma clave por segundo.
// Escribe web/src/datos/video-barra-demo.js (el vídeo en base64) y, con --archivo, también el .webm al lado.
// Uso: node scripts/video-barra-demo.mjs   (hace falta ffmpeg con libvpx-vp9; el resultado va al repositorio)
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const W = 360, H = 640, FPS = 30;
export const DISCO = { r: 45, cm: 45 };
export const FASES = [[0.4, 'q'], [0.7, 'b'], [0.8, 's'], [0.7, 'b'], [0.9, 's'], [0.7, 'b'], [1.05, 's'], [0.4, 'q']];
export const Y_ARRIBA = 200, RECORRIDO = 160, X0 = 180;
export const DURACION = FASES.reduce((s, f) => s + f[0], 0);

// Dónde está el centro del disco en el momento t (en píxeles del vídeo)
export function centroEn(t) {
  let t0 = 0;
  for (const [d, f] of FASES) {
    if (t <= t0 + d + 1e-9) {
      const u = Math.max(0, Math.min(1, (t - t0) / d));
      const c = (1 - Math.cos(Math.PI * u)) / 2;
      if (f === 'q') return [X0, Y_ARRIBA];
      // Al subir, la barra se va un poco hacia delante y vuelve (para ver el desvío de la vertical)
      if (f === 'b') return [X0 - 4 * Math.sin(Math.PI * u), Y_ARRIBA + RECORRIDO * c];
      return [X0 + 8 * Math.sin(Math.PI * u), Y_ARRIBA + RECORRIDO * (1 - c)];
    }
    t0 += d;
  }
  return [X0, Y_ARRIBA];
}

function fotograma(t, fondo) {
  const px = Buffer.from(fondo);
  const [cx, cy] = centroEn(t);
  const pon = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
  // La barra (de lado: se ve su extremo, que sale del disco hacia la cámara y hacia atrás)
  for (let y = Math.round(cy) - 3; y <= Math.round(cy) + 3; y++) for (let x = Math.round(cx) - 120; x <= Math.round(cx) + 120; x++) pon(x, y, [190, 190, 200]);
  // El disco: borde oscuro, cara roja con un aro claro y el buje blanco
  for (let y = Math.floor(cy - DISCO.r - 2); y <= Math.ceil(cy + DISCO.r + 2); y++) {
    for (let x = Math.floor(cx - DISCO.r - 2); x <= Math.ceil(cx + DISCO.r + 2); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > DISCO.r) continue;
      const col = d < 9 ? [245, 245, 245] : d < 13 ? [60, 60, 70] : d > DISCO.r - 4 ? [70, 16, 24] : Math.abs(d - 30) < 2 ? [240, 120, 130] : [211, 38, 58];
      pon(x, y, col);
    }
  }
  return px;
}

export function generarFondo() {
  let s = 12345;
  const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const fondo = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = 26 + Math.round((y / H) * 18) + Math.floor(azar() * 14);
      const i = (y * W + x) * 3;
      // El suelo
      const suelo = y > 560 ? 22 : 0;
      fondo[i] = g + suelo; fondo[i + 1] = g + suelo - 4; fondo[i + 2] = g + 18;
    }
  }
  // Unas rayas verticales (el rack, al fondo) para que la imagen tenga algo de textura
  for (const x0 of [40, 320]) for (let y = 80; y < 560; y++) for (let x = x0; x < x0 + 10; x++) { const i = (y * W + x) * 3; fondo[i] = 70; fondo[i + 1] = 70; fondo[i + 2] = 86; }
  return fondo;
}

async function codificar() {
  const fondo = generarFondo();
  const n = Math.round(DURACION * FPS);
  // (a un archivo, no a la salida: así el WebM lleva su duración y su índice, y se puede ir a cualquier momento)
  const dir = mkdtempSync(join(tmpdir(), 'video-barra-'));
  const archivo = join(dir, 'barra.webm');
  const ff = spawn('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-an',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-g', String(FPS), '-pix_fmt', 'yuv420p', '-y', archivo]);
  ff.stderr.pipe(process.stderr);
  for (let i = 0; i < n; i++) {
    if (!ff.stdin.write(fotograma(i / FPS, fondo))) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await new Promise((ok, mal) => ff.on('close', (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg ha salido con ${c}`)))));
  const webm = readFileSync(archivo);
  rmSync(dir, { recursive: true, force: true });
  return webm;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const webm = await codificar();
  const js = `// Vídeo de ejemplo del análisis de la barra (v0.58): un disco de 45 cm que hace 3 repeticiones (lo genera
// scripts/video-barra-demo.mjs; ${webm.length} bytes, WebM VP9 de 360 × 640, ${DURACION.toFixed(2).replace('.', ',')} s, sin sonido). Solo lo carga la demo.
export const VIDEO_BARRA = 'data:video/webm;base64,${webm.toString('base64')}';
`;
  writeFileSync(new URL('../web/src/datos/video-barra-demo.js', import.meta.url), js);
  if (process.argv.includes('--archivo')) writeFileSync(new URL('../web/src/datos/video-barra-demo.webm', import.meta.url), webm);
  console.log(`web/src/datos/video-barra-demo.js  ${(js.length / 1024).toFixed(0)} KB (vídeo de ${(webm.length / 1024).toFixed(0)} KB)`);
}
