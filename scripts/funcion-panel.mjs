// Genera las funciones de Supabase en UN solo archivo cada una, para desplegarlas desde el panel de Supabase (Edge
// Functions → Deploy a new function → Via Editor) sin instalar nada en el ordenador:
//   supabase/enviar-notificaciones-panel.ts  (supabase/functions/enviar-notificaciones: index.ts, envio.js y webpush.js)
//   supabase/integraciones-panel.ts          (v0.105, supabase/functions/integraciones: el calendario y Salud del iPhone)
//   supabase/youtube-canal-panel.ts          (059, supabase/functions/youtube-canal: los últimos vídeos del canal del coach)
// Es exactamente el mismo código empaquetado; las pruebas comprueban que están al día: npm run funcion-panel
import { build } from 'esbuild';
import { writeFileSync, readFileSync } from 'node:fs';

const CABECERAS = {
  'enviar-notificaciones': [
    '// FBE Equipo · función «enviar-notificaciones» en un solo archivo (generado; no lo edites a mano).',
    '// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: enviar-notificaciones →',
    '// pega TODO este archivo → Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la función comprueba',
    '// ella misma quién la llama). El código fuente está en supabase/functions/enviar-notificaciones.',
  ],
  integraciones: [
    '// FBE Equipo · función «integraciones» en un solo archivo (generado; no lo edites a mano).',
    '// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: integraciones → pega TODO este',
    '// archivo → Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la llaman un calendario o un atajo, con el',
    '// enlace personal de cada atleta). No necesita secretos. El código fuente está en supabase/functions/integraciones.',
  ],
  'youtube-canal': [
    '// FBE Equipo · función «youtube-canal» en un solo archivo (generado; no lo edites a mano).',
    '// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: youtube-canal → pega TODO este',
    '// archivo → Deploy. Deja «Verify JWT» PUESTO (la llaman la app del coach y la de sus atletas, con su sesión).',
    '// No necesita secretos. El código fuente está en supabase/functions/youtube-canal.',
  ],
};

export async function generarFuncionPanel(nombre = 'enviar-notificaciones') {
  const r = await build({
    entryPoints: [new URL(`../supabase/functions/${nombre}/index.ts`, import.meta.url).pathname],
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', write: false, charset: 'utf8',
    legalComments: 'none', logLevel: 'silent',
  });
  return [...CABECERAS[nombre], ''].join('\n') + r.outputFiles[0].text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const nombre of Object.keys(CABECERAS)) {
    const salida = new URL(`../supabase/${nombre}-panel.ts`, import.meta.url);
    writeFileSync(salida, await generarFuncionPanel(nombre));
    console.log(`supabase/${nombre}-panel.ts  ${Math.round(readFileSync(salida).length / 1024)} KB`);
  }
}
