// v0.62: genera web/src/datos/pista-descanso.js, los sonidos de «Avisar aunque bloquees el móvil» ya troceados en tramas MP3
// iguales (48 kHz, mono, 48 kbit/s CBR: 144 bytes por trama, 24 ms cada una). Así la app compone en el móvil, al empezar el
// descanso, una sola pista (tramas en silencio + la cuenta atrás + el aviso) que suena aunque el móvil se bloquee y la
// página deje de ejecutar código (ver web/src/ui/pista-descanso.js). Hace falta ffmpeg (con libmp3lame).
//
// Uso:  node scripts/pista-descanso.mjs                  (los sonidos de siempre: los de FBE Timer, el pitido y el suave)
//       node scripts/pista-descanso.mjs --voces <carpeta> (y además las frases grabadas por el coach, si las hay: fin, vamos,
//                                                          ultima, tres, dos, uno, en .m4a, .mp3, .wav, .ogg, .webm o .caf)
// Las frases: «Se acabó el descanso» (fin), «¡Vamos!» (vamos), «Última serie» (ultima) y la cuenta (tres, dos, uno). Se
// recortan los silencios del principio y del final y se igualan de volumen. Sin carpeta (o sin alguna de las seis), la pista
// usa el aviso que elige el atleta y los pitidos, como hasta ahora.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SONIDOS } from '../web/src/datos/sonidos-descanso.js';
import { tramasDe, FORMATO_PISTA } from '../web/src/logica/pista.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'fbe-pista-'));
const FRASES = ['fin', 'vamos', 'ultima', 'tres', 'dos', 'uno'];
const EXT = ['m4a', 'mp3', 'wav', 'ogg', 'webm', 'caf', 'aac'];
const arg = process.argv.indexOf('--voces');
const carpetaVoces = arg > 0 ? process.argv[arg + 1] : null;

const SALIDA = ['-ac', '1', '-ar', String(FORMATO_PISTA.tasa), '-c:a', 'libmp3lame', '-b:a', `${FORMATO_PISTA.kbps}k`,
  '-write_xing', '0', '-id3v2_version', '0', '-write_id3v1', '0', '-map_metadata', '-1', '-f', 'mp3'];
function ffmpeg(entrada, nombre, filtro = null) {
  const out = join(tmp, `${nombre}.mp3`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...entrada, ...(filtro ? ['-af', filtro] : []), ...SALIDA, out]);
  const t = tramasDe(new Uint8Array(readFileSync(out)));
  if (!t.length) throw new Error(`${nombre}: ffmpeg no ha dado tramas del formato de la pista`);
  return Buffer.from(t).toString('base64');
}

const CLIPS = {};
// Los avisos de FBE Timer, tal cual (con su volumen)
for (const [k, uri] of Object.entries(SONIDOS)) {
  const f = join(tmp, `${k}-orig.mp3`);
  writeFileSync(f, Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'));
  CLIPS[k] = ffmpeg(['-i', f], k);
}
// «Pitido suave» (el de pitidoSuave: dos notas de 880 Hz) y el pitido de la cuenta atrás (el de tono(660, 0.1))
CLIPS.suave = ffmpeg(['-f', 'lavfi', '-i', 'aevalsrc=0.5*sin(2*PI*880*t)*(lt(mod(t\\,0.28)\\,0.22))*exp(-6*mod(t\\,0.28)):s=48000:d=0.52'], 'suave', 'afade=t=in:d=0.01');
CLIPS.pitido = ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000:duration=0.12'], 'pitido', 'volume=2.8,afade=t=in:d=0.01,afade=t=out:st=0.06:d=0.06');

const VOCES = {};
if (carpetaVoces) {
  for (const k of FRASES) {
    const f = EXT.map((e) => join(carpetaVoces, `${k}.${e}`)).find((x) => existsSync(x));
    if (!f) { console.log(`  (sin «${k}»)`); continue; }
    VOCES[k] = ffmpeg(['-i', f], `voz-${k}`,
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,loudnorm=I=-16:TP=-1.5:LRA=11');
  }
  // Las seis o ninguna: con media cuenta atrás grabada y la otra media en pitidos sonaría raro
  if (Object.keys(VOCES).length !== FRASES.length) {
    console.log(`  Faltan frases (${FRASES.filter((k) => !VOCES[k]).join(', ')}): la pista seguirá con los pitidos y el aviso.`);
    for (const k of Object.keys(VOCES)) delete VOCES[k];
  }
}
rmSync(tmp, { recursive: true, force: true });

const js = (o) => `{\n${Object.entries(o).map(([k, v]) => `  '${k}': '${v}',`).join('\n')}${Object.keys(o).length ? '\n' : ''}}`;
const texto = `// Sonidos de «Avisar aunque bloquees el móvil» (v0.62), en tramas MP3 de la pista (logica/pista.js, FORMATO_PISTA), en
// base64. Generado por scripts/pista-descanso.mjs; no editar a mano. CLIPS: los avisos de FBE Timer, el «Pitido suave» y el
// pitido de la cuenta atrás. VOCES: las frases grabadas por el coach (vacío si no las ha grabado).
export const CLIPS = ${js(CLIPS)};
export const VOCES = ${js(VOCES)};
`;
writeFileSync(join(raiz, 'web/src/datos/pista-descanso.js'), texto);
const kb = (Buffer.byteLength(texto) / 1024).toFixed(0);
console.log(`web/src/datos/pista-descanso.js: ${Object.keys(CLIPS).length} sonidos${Object.keys(VOCES).length ? ` y ${Object.keys(VOCES).length} frases del coach` : ''} (${kb} KB)`);
