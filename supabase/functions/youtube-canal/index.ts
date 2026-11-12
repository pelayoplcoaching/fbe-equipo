// FBE Equipo · función «youtube-canal»: los últimos vídeos del canal del coach (migración 059). Con «Verify JWT»
// puesto (la llaman la app del coach y la de sus atletas, con su sesión). No necesita secretos.
import { atender } from './canal.js';

Deno.serve((req: Request) => atender(req, { env: Deno.env.toObject() }));
