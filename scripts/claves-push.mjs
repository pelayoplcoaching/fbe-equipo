// Genera lo que necesitan las notificaciones: el par de claves VAPID (identifica a tu servidor ante los
// servicios de push de Google, Apple, Mozilla y Microsoft) y el secreto con el que el programador de Supabase
// llama a la función de envío. Se ejecuta una vez, en tu ordenador: npm run claves-push
//
// Las escribe en supabase/.env.notificaciones (está en .gitignore) para subirlas a Supabase con --env-file,
// sin que la privada quede en el historial de la terminal. Después, guárdalas en tu gestor de contraseñas y
// borra ese archivo. La privada y el secreto no se comparten con nadie (como la service_role). La pública va
// también en web/config.js. Si las cambias, la app rehace sola las suscripciones al abrirse.
import { writeFileSync, existsSync } from 'node:fs';
import { b64url, deB64url, juntar } from '../supabase/functions/enviar-notificaciones/webpush.js';

const archivo = new URL('../supabase/.env.notificaciones', import.meta.url);
if (existsSync(archivo) && !process.argv.includes('--nuevas')) {
  console.log('Ya existe supabase/.env.notificaciones: no lo sobrescribo. Si de verdad quieres claves nuevas: npm run claves-push -- --nuevas');
  process.exit(1);
}
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
const publica = b64url(juntar(new Uint8Array([4]), deB64url(jwk.x), deB64url(jwk.y)));
const secreto = b64url(crypto.getRandomValues(new Uint8Array(24)));
writeFileSync(archivo, [
  '# Secretos de la función enviar-notificaciones. Súbelos con --env-file y BORRA este archivo.',
  `VAPID_PUBLICA=${publica}`,
  `VAPID_PRIVADA=${jwk.d}`,
  `AVISOS_SECRETO=${secreto}`,
  'AVISOS_CONTACTO=mailto:TU_EMAIL',
  'APP_URL=https://atletas.fuerzabasadaenevidencia.com',
  '',
].join('\n'), { mode: 0o600 });

console.log(`
Claves de las notificaciones escritas en supabase/.env.notificaciones (no se sube al repositorio).

1) En ese archivo, cambia TU_EMAIL y, si hace falta, APP_URL (varias direcciones, separadas por comas).

2) En web/config.js:   vapidPublica: '${publica}',

3) Sube los secretos a Supabase:
   npx supabase secrets set --project-ref TU_REFERENCIA --env-file supabase/.env.notificaciones

4) AVISOS_SECRETO, también en Vault (lo usa la tarea programada; README, «Notificaciones al móvil»).

5) Guarda el archivo en tu gestor de contraseñas y bórralo. La privada y el secreto no se comparten con
   nadie (tampoco conmigo).
`);
