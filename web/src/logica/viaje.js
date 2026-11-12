// (v0.143) De viaje por zona horaria. El día del atleta en la app es el de su móvil (hoyISO, en fechas.js); la base, las
// notificaciones, la comunidad y el coach siguen la hora de España. Aquí, sin tocar nada del navegador salvo leer la zona:
//  - si el móvil está en otra zona horaria (con otra hora que España), cuánto se lleva y qué hora es en cada sitio;
//  - a qué hora de aquí llegan las notificaciones (que van con la hora de España);
//  - el ajuste de las notificaciones para no recibir nada de noche aquí: el «no molestar» (de 23:00 a 7:00 de aquí) y los
//    recordatorios del día (que el «no molestar» no retrasa) a la hora de aquí que tenían, dentro de lo que admite la base
//    (la mañana, de 5:00 a 12:00 de España; la tarde, de 12:00 a 23:30); si así caen de noche aquí, apagados mientras viaja.
// Las zonas de casa (España peninsular, Ceuta y Melilla, Canarias) no cuentan como viaje, ni las que el atleta marque.

export const ZONA_ESPANA = 'Europe/Madrid';
export const ZONAS_CASA = ['Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary'];

export function zonaDelMovil() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

const pad = (n) => String(n).padStart(2, '0');
function partes(tz, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute) };
}
// Los minutos que una zona va por delante de UTC en ese instante (con su horario de verano)
export function desfaseMin(tz, ms = Date.now()) {
  try {
    const p = partes(tz, ms);
    return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000) / 60000);
  } catch { return null; }
}
export function horaEn(tz, ms = Date.now()) {
  try { const p = partes(tz, ms); return `${pad(p.h)}:${pad(p.mi)}`; } catch { return null; }
}

// Una hora 'HH:MM' movida unos minutos (dando la vuelta al día)
export function moverHora(hora, min) {
  const [h, m] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const t = (((h * 60 + m + Math.round(min)) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
export const horaBonita = (h) => (h ? h.replace(/^0(\d)/, '$1') : h);

// Unos cuantos nombres en español (el resto, el de la zona tal cual: «America/Mexico_City» → «Mexico City»)
const NOMBRES = {
  'America/Mexico_City': 'Ciudad de México', 'America/New_York': 'Nueva York', 'America/Los_Angeles': 'Los Ángeles', 'America/Bogota': 'Bogotá',
  'America/Argentina/Buenos_Aires': 'Buenos Aires', 'America/Sao_Paulo': 'São Paulo', 'America/Lima': 'Lima', 'America/Santiago': 'Santiago de Chile',
  'America/Caracas': 'Caracas', 'America/Montevideo': 'Montevideo', 'America/Panama': 'Panamá', 'America/Havana': 'La Habana', 'America/Santo_Domingo': 'Santo Domingo',
  'America/Chicago': 'Chicago', 'America/Toronto': 'Toronto', 'America/Cancun': 'Cancún', 'Europe/London': 'Londres', 'Europe/Lisbon': 'Lisboa', 'Europe/Dublin': 'Dublín',
  'Europe/Athens': 'Atenas', 'Europe/Helsinki': 'Helsinki', 'Europe/Istanbul': 'Estambul', 'Europe/Moscow': 'Moscú', 'Atlantic/Azores': 'Azores', 'Atlantic/Madeira': 'Madeira',
  'Asia/Tokyo': 'Tokio', 'Asia/Dubai': 'Dubái', 'Asia/Shanghai': 'Shanghái', 'Asia/Singapore': 'Singapur', 'Asia/Bangkok': 'Bangkok', 'Asia/Kolkata': 'India',
  'Australia/Sydney': 'Sídney', 'Pacific/Auckland': 'Auckland', 'Africa/Casablanca': 'Casablanca', 'Pacific/Honolulu': 'Honolulu',
};
export function nombreZona(tz) {
  if (!tz) return null;
  return NOMBRES[tz] || String(tz).split('/').pop().replace(/_/g, ' ');
}

// «7 h menos que en España», «1 h y 30 min más que en España»
export function textoDesfase(min) {
  if (!min) return 'la misma hora que en España';
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  return `${h ? `${h} h` : ''}${h && m ? ' y ' : ''}${m ? `${m} min` : ''} ${min < 0 ? 'menos' : 'más'} que en España`;
}

// ¿Está de viaje? { deViaje, tz, nombre, desfase (min respecto a España), aqui y espana ('HH:MM') }
export function estadoViaje({ tz = zonaDelMovil(), ahora = Date.now(), casa = [] } = {}) {
  if (!tz) return { deViaje: false, tz: null };
  const dz = desfaseMin(tz, ahora), de = desfaseMin(ZONA_ESPANA, ahora);
  if (dz == null || de == null) return { deViaje: false, tz };
  const desfase = dz - de;
  const enCasa = ZONAS_CASA.includes(tz) || (Array.isArray(casa) && casa.includes(tz));
  return { deViaje: !enCasa && desfase !== 0, tz, nombre: nombreZona(tz), desfase, aqui: horaEn(tz, ahora), espana: horaEn(ZONA_ESPANA, ahora) };
}

// A qué hora de aquí llega lo que sale a esa hora de España
export const horaAqui = (horaEspana, desfase) => moverHora(horaEspana, desfase);
// El «no molestar» (en hora de España, como lo guarda la base) para no recibir nada de noche aquí
export function silencioDeViaje(desfase, { desde = '23:00', hasta = '07:00' } = {}) {
  return { silencio_desde: moverHora(desde, -desfase), silencio_hasta: moverHora(hasta, -desfase) };
}
// ¿Ese «no molestar» ya cubre la noche de aquí?
export function silencioCubreNoche(prefs, desfase) {
  if (!prefs?.silencio_desde || !prefs?.silencio_hasta) return false;
  const v = silencioDeViaje(desfase);
  return prefs.silencio_desde === v.silencio_desde && prefs.silencio_hasta === v.silencio_hasta;
}

const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const deNoche = (h) => h >= '23:00' || h < '07:00';
// Una hora (de España) dentro de su ventana; si se sale, al borde más cercano (contando la vuelta al día)
function dentro(esp, min, max) {
  if (esp >= min && esp <= max) return esp;
  const tras = (aMin(esp) - aMin(max) + 1440) % 1440, antes = (aMin(min) - aMin(esp) + 1440) % 1440;
  return tras <= antes ? max : min;
}
export const RECORDATORIOS_VIAJE = [
  { campo: 'hora_manana', min: '05:00', max: '12:00', tipos: ['sesion_hoy'], nombre: 'La de la sesión de hoy' },
  { campo: 'hora_tarde', min: '12:00', max: '23:30', tipos: ['habitos', 'nutricion', 'checkin'], nombre: 'Las de la tarde (hábitos, nutrición y check-in)' },
];
// El ajuste para no recibir nada de noche aquí: { cambios (para guardar), apagados (tipos que se apagan), lineas (qué queda) }
export function ajusteDeViaje(prefs, desfase) {
  const cambios = { ...silencioDeViaje(desfase) };
  const apagados = [];
  const lineas = [`Sin notificaciones de 23:00 a 7:00 de aquí (lo que llegue a esas horas, al acabar).`];
  const desactivados = new Set(Array.isArray(prefs?.desactivados) ? prefs.desactivados : []);
  for (const r of RECORDATORIOS_VIAJE) {
    if (r.tipos.every((t) => desactivados.has(t))) continue;  // ya no le llegan
    const esp = dentro(moverHora(prefs[r.campo], -desfase), r.min, r.max);
    const aqui = moverHora(esp, desfase);
    if (deNoche(aqui)) {
      r.tipos.filter((t) => !desactivados.has(t)).forEach((t) => apagados.push(t));
      lineas.push(`${r.nombre}: apagada${r.tipos.length > 1 ? 's' : ''} mientras viajas (aquí saldría${r.tipos.length > 1 ? 'n' : ''} de noche).`);
    } else {
      cambios[r.campo] = esp;
      lineas.push(`${r.nombre}: a las ${horaBonita(aqui)} de aquí.`);
    }
  }
  cambios.desactivados = [...new Set([...desactivados, ...apagados])];
  return { cambios, apagados, lineas };
}
// Las preferencias de casa: las de ahora sin lo del viaje (si lo hay), para ajustar siempre desde ellas
export const prefsDeCasa = (prefs, previo) => (previo ? deshacerViaje(prefs, previo) : prefs);
// ¿Ya tiene puesto ese ajuste? (para no volver a ofrecerlo)
export function ajusteAplicado(prefs, desfase, previo = null) {
  if (!prefs) return false;
  const { cambios } = ajusteDeViaje(prefsDeCasa(prefs, previo), desfase);
  return Object.entries(cambios).every(([k, v]) => (Array.isArray(v) ? v.length === (prefs[k] || []).length && v.every((t) => prefs[k].includes(t)) : prefs[k] === v));
}
// Lo que se guarda para volver: las horas y el «no molestar» de antes, y qué se apagó (solo eso se vuelve a encender)
export const previoDeViaje = (prefs, apagados) => ({ hora_manana: prefs.hora_manana, hora_tarde: prefs.hora_tarde, silencio_desde: prefs.silencio_desde || null, silencio_hasta: prefs.silencio_hasta || null, apagados: [...apagados] });
export function deshacerViaje(prefs, previo) {
  const apagados = new Set(previo?.apagados || []);
  return {
    ...prefs, hora_manana: previo.hora_manana || prefs.hora_manana, hora_tarde: previo.hora_tarde || prefs.hora_tarde,
    silencio_desde: previo.silencio_desde || null, silencio_hasta: previo.silencio_hasta || null,
    desactivados: (prefs.desactivados || []).filter((t) => !apagados.has(t)),
  };
}
