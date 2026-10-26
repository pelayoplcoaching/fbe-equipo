// Función de Supabase «enviar-notificaciones» (Deno). Toda la lógica está en envio.js y webpush.js, la misma
// que comprueban las pruebas (test/envio.test.mjs). Se despliega sin verificación de JWT (--no-verify-jwt):
// la propia función comprueba quién llama (el programador con su secreto, o una sesión de la app).
import { atender } from './envio.js';

Deno.serve((req: Request) => atender(req, { env: Deno.env.toObject() }));
