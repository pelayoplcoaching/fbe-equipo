// La función «reloj» (migración 058): el modo reloj, el entreno desde el Apple Watch con el atajo «FBE Reloj».
//   POST …/functions/v1/reloj  con la cabecera x-fbe-clave: CLAVE y un JSON { accion, … }:
//     { accion: 'ver' }                               → la serie que toca (texto, opciones del menú y lo que hace cada una)
//     { accion: 'hecha', ref, kg?, reps?, rir? }      → guarda la serie (sin kg ni reps, los propuestos) y dice el descanso
//     { accion: 'saltar', ref }                       → salta ese ejercicio en esta sesión y dice lo siguiente
//     { accion: 'terminar', sesion?, rpe? }           → la marca como hecha (con su esfuerzo y su duración)
//     { accion: 'elegir', sesion }                    → otra sesión de su semana (también 'otra' con sesion)
//     ('cambiar' con kg y reps es 'hecha': el atajo manda la acción del menú tal cual)
// La clave es la de cada atleta (64 caracteres); la base solo guarda su huella. Responde siempre JSON con «mensaje» (lo
// que el atajo enseña) y, si toca, «texto», «opciones» y «acciones» para el siguiente menú.
// Se despliega sin verificación de JWT: quien llama es un atajo, sin sesión. Usa la clave de servicio, que pone Supabase.
import { clienteBase, claveServicio } from '../enviar-notificaciones/envio.js';
import { vistaReloj, limpiarPeticion, trasGuardar, MENSAJES_RELOJ, CLAVE } from '../../../web/src/logica/reloj.js';

const MAX_CUERPO = 8 * 1024;
const json = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fallo = (error, estado = 422) => json({ ok: false, error, mensaje: MENSAJES_RELOJ[error] || 'No se ha podido hacer' }, estado);
const estadoHttp = (e) => (e === 'clave' ? 401 : e === 'baja' ? 403 : e === 'sesion' || e === 'terminada' || e === 'cardio' ? 409 : 422);

// (sin cabeceras CORS a propósito: solo la llama el atajo, nunca una web)
export async function atender(req, { env = {}, f = globalThis.fetch } = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  if (req.method !== 'POST') return json({ ok: false, mensaje: 'Usa POST' }, 405);
  if (!env.SUPABASE_URL || !claveServicio(env)) return json({ ok: false, mensaje: 'Falta la configuración de Supabase en la función' }, 500);
  // La clave, antes que nada (y sin leer el cuerpo si no vale)
  const clave = (req.headers.get('x-fbe-clave') || '').trim();
  if (!CLAVE.test(clave)) return fallo('clave', 401);
  if (Number(req.headers.get('content-length') || 0) > MAX_CUERPO) return json({ ok: false, mensaje: 'Demasiados datos' }, 413);
  const crudo = await req.text();
  if (new TextEncoder().encode(crudo).length > MAX_CUERPO) return json({ ok: false, mensaje: 'Demasiados datos' }, 413);
  let cuerpo = {};
  if (crudo.trim()) { try { cuerpo = JSON.parse(crudo); } catch { return json({ ok: false, mensaje: 'El atajo tiene que mandar un JSON' }, 400); } }
  const base = clienteBase(env, f);
  let ultima = '';
  const rpc = async (nombre, args) => { ultima = nombre; return base.rpc(nombre, args); };
  // (v0.141, revisión) a la base solo va la HUELLA de la clave (sha-256): la clave no sale de esta función
  const huella = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave)))].map((b) => b.toString(16).padStart(2, '0')).join('');

  try {
    // Lo que hay ahora (y la unidad, para leer los kilos que manda)
    let estado = await rpc('reloj_estado', { p_clave: huella, p_sesion: null });
    if (!estado?.ok) return fallo(estado?.error || 'clave', estadoHttp(estado?.error));
    const p = limpiarPeticion(cuerpo, estado.unidad);
    // «Otra sesión» con la sesión elegida es elegirla (así el atajo no tiene que cambiar la acción)
    if (p.accion === 'otra' && p.sesion) p.accion = 'elegir';
    const vista = vistaReloj(estado);

    if (p.accion === 'ver' || p.accion === 'otra') return json({ ...vista, mensaje: vista.texto });

    if (p.accion === 'hecha' || p.accion === 'cambiar') {
      const ref = p.ref || (vista.ref ? limpiarPeticion({ ref: vista.ref }).ref : null);
      if (!ref) return json({ ...vista, ok: false, error: 'datos', mensaje: 'No hay ninguna serie que apuntar.' }, 409);
      let kg = p.kg, reps = p.reps;
      // Sin kilos ni repeticiones: los que propone el reloj para esa serie (si es la que toca)
      if (kg == null && reps == null && vista.ref === `${ref.pauta}:${ref.numero}`) {
        kg = vista.kg != null ? limpiarPeticion({ kg: vista.kg }, estado.unidad).kg : null;
        reps = vista.reps;
      }
      const sustituto = (estado.hechas || []).find((s) => s.sesion_ejercicio_id === ref.pauta && s.sustituto_id)?.sustituto_id || null;
      const r = await rpc('reloj_serie', { p_clave: huella, p_pauta: ref.pauta, p_numero: ref.numero, p_kg: kg, p_reps: reps, p_rir: p.rir, p_sustituto: sustituto });
      if (!r?.ok) return fallo(r?.error || 'datos', estadoHttp(r?.error));
      const tras = trasGuardar(estado, ref, kg, reps, estado.unidad);
      const despues = vistaReloj(await rpc('reloj_estado', { p_clave: huella, p_sesion: r.sesion_id || null }));
      return json({ ...despues, ok: true, descanso_seg: tras.descanso_seg, mensaje: tras.mensaje,
        siguiente: despues.estado === 'serie' ? `Después: ${despues.titulo} · ${despues.serie}${despues.carga ? ` · ${despues.carga}` : ''}` : despues.estado === 'terminar' ? 'No queda ninguna serie: termínala.' : '' });
    }

    if (p.accion === 'saltar') {
      const pauta = p.ref?.pauta || (vista.ref ? vista.ref.split(':')[0] : null);
      if (!pauta) return json({ ...vista, ok: false, error: 'datos', mensaje: 'No hay ningún ejercicio que saltar.' }, 409);
      const r = await rpc('reloj_saltar', { p_clave: huella, p_pauta: pauta });
      if (!r?.ok) return fallo(r?.error || 'datos', estadoHttp(r?.error));
      const despues = vistaReloj(await rpc('reloj_estado', { p_clave: huella, p_sesion: null }));
      return json({ ...despues, ok: true, descanso_seg: 0, mensaje: `Saltado.${despues.estado === 'serie' ? ` Ahora: ${despues.titulo}` : ''}` });
    }

    if (p.accion === 'elegir') {
      if (!p.sesion) return json({ ...vista, ok: false, error: 'datos', mensaje: 'Elige una sesión.' }, 422);
      const r = await rpc('reloj_elegir', { p_clave: huella, p_sesion: p.sesion });
      if (!r?.ok) return fallo(r?.error || 'sesion', estadoHttp(r?.error));
      const despues = vistaReloj(await rpc('reloj_estado', { p_clave: huella, p_sesion: p.sesion }));
      return json({ ...despues, ok: true, mensaje: despues.texto });
    }

    if (p.accion === 'terminar') {
      const sesion = p.sesion || vista.sesion_id;
      if (!sesion) return json({ ...vista, ok: false, error: 'datos', mensaje: 'No hay ninguna sesión que terminar.' }, 409);
      const r = await rpc('reloj_terminar', { p_clave: huella, p_sesion: sesion, p_rpe: p.rpe, p_minutos: null });
      if (!r?.ok) return fallo(r?.error || 'datos', estadoHttp(r?.error));
      return json({ ok: true, estado: 'hecha', descanso_seg: 0, opciones: [], acciones: {},
        mensaje: `¡Sesión terminada${r.minutos ? ` (${r.minutos} min)` : ''}! Abre la app cuando quieras para ver el resumen.` });
    }
    return json({ ...vista, mensaje: vista.texto });
  } catch (e) {
    // (en los registros de la función: qué llamada falló y su estado; nunca la clave)
    console.error(`reloj: falló ${ultima || 'la llamada'}${e?.status ? ` (${e.status})` : ''}`);
    return json({ ok: false, mensaje: 'No se ha podido conectar con la app: prueba otra vez en un momento.' }, 503);
  }
}
