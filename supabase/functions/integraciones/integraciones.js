// La función «integraciones»: la puerta de la app hacia fuera para lo que no puede pasar por la sesión de la app.
//   GET  …/integraciones/calendario?t=ENLACE  → los entrenos del atleta en formato de calendario (.ics). Su calendario
//        (el del iPhone, Google…) se suscribe a esta dirección y la vuelve a pedir cada cierto tiempo.
//   POST …/integraciones/salud?t=ENLACE       → lo que manda su atajo «FBE Salud» (pasos, sueño, FC en reposo, HRV y
//        peso, de Salud del iPhone). Responde con una frase corta que el atajo puede enseñar.
// ENLACE es el enlace personal de cada atleta (64 caracteres); la base solo guarda su huella. Sin él, nada.
// Se despliega sin verificación de JWT: quien llama no tiene sesión (un calendario, un atajo). Usa la clave de
// servicio, que pone Supabase solo; no necesita ningún secreto más.
import { clienteBase, claveServicio } from '../enviar-notificaciones/envio.js';
import { calendarioICS } from '../../../web/src/logica/plan.js';
import { limpiarSalud, ENLACE } from '../../../web/src/logica/integraciones.js';
import { fechaMadrid } from '../../../web/src/logica/fechas.js';

// (revisión) lo que manda el atajo son unos cientos de bytes: con 16 KB sobra
// (holgado: con los pasos por aparato el atajo manda el origen y el valor de cada muestra del día)
const MAX_CUERPO = 256 * 1024;
const texto = (t, estado = 200, extra = {}) => new Response(t, { status: estado, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const json = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// El enlace: en la cabecera x-fbe-enlace (el atajo: así no queda en los registros de peticiones) o en la dirección (?t=,
// el calendario, que no puede mandar cabeceras)
export function enlaceDe(req, url) {
  const t = (req.headers.get('x-fbe-enlace') || url.searchParams.get('t') || '').trim();
  return ENLACE.test(t) ? t : null;
}

// Los entrenos, en un calendario. Título: «Entreno: Día 2 push A» (o «Hecho: …» si ya está hecha)
export function componerCalendario(datos) {
  const eventos = (datos?.eventos || []).map((e) => ({
    id: e.id, dia: e.dia, nombre: e.nombre,
    titulo: `${e.hecha ? 'Hecho' : e.tipo === 'cardio' ? 'Cardio' : e.tipo === 'movilidad' ? 'Movilidad' : 'Entreno'}: ${e.nombre}`,
    descripcion: e.descripcion || 'Sesión de FBE Equipo.',
    avisoMin: e.hecha ? null : undefined,
  }));
  return calendarioICS(eventos, { hora: datos?.hora || '18:00', minutos: datos?.minutos || 75, avisoMin: datos?.aviso ?? 30, nombre: 'FBE · Entrenos', refrescoMin: 360 });
}

const MENSAJES = {
  enlace: 'Esta clave ya no vale: copia la nueva en la app (Perfil → Conexiones → Salud del iPhone) y pégala en el atajo.',
  baja: 'Tu cuenta está de baja: ya no se guardan datos nuevos.',
  consentimiento: 'Falta tu consentimiento de datos de salud: dalo en la app (Perfil → Privacidad) y vuelve a probar.',
  datos: 'No ha llegado nada que se pueda guardar (revisa el atajo: fecha, pasos, sueño, FC en reposo o HRV).',
  demasiados: 'Demasiados días de una vez: como mucho 31.',
};

export function fraseGuardado(r) {
  const partes = [`${r.dias} ${r.dias === 1 ? 'día' : 'días'}`];
  if (r.habitos) partes.push(`${r.habitos} en tus hábitos`);
  if (r.pesos) partes.push(`${r.pesos} ${r.pesos === 1 ? 'peso' : 'pesos'}`);
  return `FBE: guardado (${partes.join(', ')}).`;
}

export async function atender(req, { env = {}, f = globalThis.fetch, hoy = null } = {}) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
  if (!env.SUPABASE_URL || !claveServicio(env)) return texto('Falta la configuración de Supabase en la función', 500);
  const base = clienteBase(env, f);

  if (/\/calendario(\.ics)?$/.test(ruta)) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return texto('Usa GET', 405, { Allow: 'GET' });
    const enlace = enlaceDe(req, url);
    if (!enlace) return texto('Falta el enlace del calendario', 404);
    let datos;
    try { datos = await base.rpc('calendario_de', { p_enlace: enlace }); } catch { return texto('No se ha podido leer el calendario: prueba más tarde', 503, { 'Retry-After': '600' }); }
    if (!datos) return texto('Este enlace del calendario ya no vale: crea uno nuevo en la app', 404);
    const ics = componerCalendario(datos);
    return new Response(req.method === 'HEAD' ? null : ics, { status: 200, headers: {
      'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="fbe-entrenos.ics"', 'Cache-Control': 'private, max-age=900' } });
  }

  if (/\/salud$/.test(ruta)) {
    if (req.method !== 'POST') return texto('Usa POST', 405, { Allow: 'POST' });
    const enlace = enlaceDe(req, url);
    if (!enlace) return json({ ok: false, mensaje: MENSAJES.enlace }, 401);
    if (Number(req.headers.get('content-length') || 0) > MAX_CUERPO) return json({ ok: false, mensaje: 'Demasiados datos de una vez' }, 413);
    const crudo = await req.text();
    if (crudo.length > MAX_CUERPO) return json({ ok: false, mensaje: 'Demasiados datos de una vez' }, 413);
    let cuerpo;
    try { cuerpo = JSON.parse(crudo); } catch { return json({ ok: false, mensaje: 'El atajo tiene que mandar un JSON (Obtener contenido de URL → Cuerpo de la solicitud: JSON)' }, 400); }
    const dias = limpiarSalud(cuerpo, hoy || fechaMadrid());
    if (!dias.length) return json({ ok: false, mensaje: MENSAJES.datos }, 422);
    let r;
    try { r = await base.rpc('salud_recibir', { p_enlace: enlace, p_dias: dias }); } catch { return json({ ok: false, mensaje: 'No se ha podido guardar: prueba más tarde' }, 503); }
    if (!r?.ok) return json({ ok: false, mensaje: MENSAJES[r?.error] || 'No se ha podido guardar' }, r?.error === 'enlace' ? 401 : r?.error === 'baja' || r?.error === 'consentimiento' ? 403 : 422);
    return json({ ok: true, dias: r.dias, habitos: r.habitos, pesos: r.pesos, mensaje: fraseGuardado(r) });
  }

  return texto('No existe', 404);
}
