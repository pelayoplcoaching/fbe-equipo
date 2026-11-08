// Función de Supabase «reloj» (Deno): el modo reloj, el entreno desde el Apple Watch con el atajo «FBE Reloj».
// Toda la lógica está en reloj.js y en web/src/logica/reloj.js (la comprueban las pruebas: test/reloj.test.mjs). Se
// despliega sin verificación de JWT (--no-verify-jwt): quien llama es un atajo, con la clave de cada atleta.
import { atender } from './reloj.js';

Deno.serve((req: Request) => atender(req, { env: Deno.env.toObject() }));
