// Genera supabase/enviar-notificaciones-panel.ts: la función «enviar-notificaciones» en UN solo archivo, para
// desplegarla desde el panel de Supabase (Edge Functions → Deploy a new function → Via Editor) sin instalar
// nada en el ordenador. Es exactamente el mismo código que supabase/functions/enviar-notificaciones (index.ts,
// envio.js y webpush.js) empaquetado; las pruebas comprueban que está al día: npm run funcion-panel
import { build } from 'esbuild';
import { writeFileSync, readFileSync } from 'node:fs';

export async function generarFuncionPanel() {
  const r = await build({
    entryPoints: [new URL('../supabase/functions/enviar-notificaciones/index.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', write: false, charset: 'utf8',
    legalComments: 'none', logLevel: 'silent',
  });
  const cabecera = [
    '// FBE Equipo · función «enviar-notificaciones» en un solo archivo (generado; no lo edites a mano).',
    '// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: enviar-notificaciones →',
    '// pega TODO este archivo → Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la función comprueba',
    '// ella misma quién la llama). El código fuente está en supabase/functions/enviar-notificaciones.',
    '',
  ].join('\n');
  return cabecera + r.outputFiles[0].text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const salida = new URL('../supabase/enviar-notificaciones-panel.ts', import.meta.url);
  writeFileSync(salida, await generarFuncionPanel());
  console.log(`supabase/enviar-notificaciones-panel.ts  ${Math.round(readFileSync(salida).length / 1024)} KB`);
}
