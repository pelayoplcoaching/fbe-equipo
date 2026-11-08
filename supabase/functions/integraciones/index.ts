// Función de Supabase «integraciones» (Deno): el calendario que se actualiza solo y lo que llega de Salud del iPhone.
// Toda la lógica está en integraciones.js (la comprueban las pruebas: test/integraciones.test.mjs). Se despliega
// sin verificación de JWT (--no-verify-jwt): quien llama es un calendario o un atajo, con el enlace de cada atleta.
import { atender } from './integraciones.js';

Deno.serve((req: Request) => atender(req, { env: Deno.env.toObject() }));
