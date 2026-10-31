import { aISO, diasEntre, fmtConDia } from './fechas.js';

// Notificaciones al móvil: los tipos que se pueden elegir, las preferencias de entrada (las mismas que la
// migración 010) y lo que hace falta para activarlas en el navegador.

// [tipo, nombre, cuándo llega]
export const TIPOS_ATLETA = [
  ['respuesta', 'Respuestas de tu coach', 'Cuando te contesta en una sesión, tu check-in o un vídeo'],
  ['semana', 'Semana publicada', 'Cuando tu coach publica tu semana'],
  ['aviso', 'Avisos de tu coach', 'Los que publique para ti o para todos'],
  ['sesion_hoy', 'Sesión de hoy', 'Por la mañana, si la planificaste para ese día'],
  ['checkin', 'Check-in de la semana', 'El día que elijas, si aún no lo has hecho'],
  ['habitos', 'Hábitos', 'Por la tarde, los que te falten de hoy'],
  ['nutricion', 'Nutrición', 'Por la tarde, si aún no la has apuntado'],
  ['cuestionario', 'Peticiones de tu coach', 'Si te pide que rellenes o actualices tu cuestionario'],
  ['descanso', 'Descansos terminados', 'Al acabar tu descanso, si no tienes la app delante (música, otra app, pantalla bloqueada)'],
];
export const TIPOS_COACH = [
  ['mensaje', 'Mensajes de tus atletas', 'Cuando te escriben en una sesión, un check-in o un vídeo'],
  ['checkin_recibido', 'Check-ins', 'Cuando alguien envía el suyo'],
  ['video_recibido', 'Vídeos de técnica', 'Cuando alguien sube uno'],
  ['sesion_hecha', 'Sesiones terminadas', 'Una por sesión: pueden ser muchas al día'],
  ['cuestionario_recibido', 'Cuestionarios', 'Cuando alguien completa o actualiza el suyo'],
];
export const RECORDATORIOS = ['sesion_hoy', 'checkin', 'habitos', 'nutricion'];

export const PREFERENCIAS_DEFECTO = {
  desactivados: ['sesion_hecha'], hora_manana: '08:30', hora_tarde: '21:00', dia_checkin: 7,
  silencio_desde: '22:30', silencio_hasta: '08:00', email: false,
};

export const DIAS_CHECKIN = [[5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo'], [1, 'Lunes']];

export const ESTADO_NOTIFICACION = {
  pendiente: 'Pendiente', enviando: 'Enviándose', enviada: 'Enviada', caducada: 'No salió a tiempo', fallida: 'No se pudo enviar',
};

// «08:30:00» → «08:30»
export const horaCorta = (h) => (h ? String(h).slice(0, 5) : null);

// Las preferencias guardadas (o ninguna) con lo de entrada
export function conDefecto(p) {
  const d = { ...PREFERENCIAS_DEFECTO, ...(p || {}) };
  return {
    ...d,
    desactivados: Array.isArray(d.desactivados) ? d.desactivados : PREFERENCIAS_DEFECTO.desactivados,
    hora_manana: horaCorta(d.hora_manana), hora_tarde: horaCorta(d.hora_tarde),
    silencio_desde: horaCorta(d.silencio_desde), silencio_hasta: horaCorta(d.silencio_hasta),
    dia_checkin: Number(d.dia_checkin) || 7, email: !!d.email,
  };
}

// Lo que la base acepta (como la restricción de la migración 010)
export function preferenciasValidas(p) {
  const hm = (h) => /^\d\d:\d\d$/.test(h || '');
  const todos = [...TIPOS_ATLETA, ...TIPOS_COACH].map(([t]) => t);
  return (p.desactivados || []).every((t) => todos.includes(t))
    && hm(p.hora_manana) && p.hora_manana >= '05:00' && p.hora_manana <= '12:00'
    && hm(p.hora_tarde) && p.hora_tarde >= '12:00' && p.hora_tarde <= '23:30'
    && Number.isInteger(p.dia_checkin) && p.dia_checkin >= 1 && p.dia_checkin <= 7
    && (p.silencio_desde == null) === (p.silencio_hasta == null)
    && (p.silencio_desde == null || (hm(p.silencio_desde) && hm(p.silencio_hasta) && p.silencio_desde !== p.silencio_hasta));
}

// La clave pública VAPID (base64url) como la pide pushManager.subscribe
export function claveServidor(b64) {
  const t = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Las claves de la suscripción, en base64url sin relleno (algún navegador las da con «=» o en base64 normal)
export const normalizarB64url = (s) => String(s || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// «Android · Chrome», para reconocer cada móvil en la lista
export function describirDispositivo(ua = '') {
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPod/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad'
    : /CrOS/.test(ua) ? 'Chromebook' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const nav = /Edg[A]?\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Navegador';
  return `${so} · ${nav}`;
}

// ¿Se pueden activar aquí? demo · sin_configurar (falta la clave VAPID en config.js) · ios_instalar (en iPhone,
// solo desde la app añadida a la pantalla de inicio) · no_soportado · bloqueado (permiso denegado) · ok
export function soportePush({ demo = false, vapid = '', sw = false, push = false, notificaciones = false, permiso = 'default', ios = false, instalada = false } = {}) {
  if (demo) return 'demo';
  if (!vapid) return 'sin_configurar';
  if (ios && !instalada) return 'ios_instalar';
  if (!sw || !push || !notificaciones) return 'no_soportado';
  if (permiso === 'denied') return 'bloqueado';
  return 'ok';
}

export const esIos = (ua = '', toques = 0) => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1);

// «hoy, 21:00» · «ayer, 9:35» · «mié 21 oct, 8:30» (hora de este dispositivo)
export function momentoNotificacion(iso, ahora = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = aISO(d);
  const n = diasEntre(dia, aISO(ahora));
  return `${n === 0 ? 'hoy' : n === 1 ? 'ayer' : fmtConDia(dia)}, ${hora}`;
}
