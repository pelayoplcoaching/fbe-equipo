// (v0.142) El tiempo para el cardio de fuera, con Open-Meteo (gratis, sin cuenta y con CORS). Aquí solo la lógica, sin
// red ni navegador: las direcciones, leer lo que contesta, los avisos (calor, frío, tormenta, lluvia, viento, sol y aire)
// y la mejor hora para salir hoy.
//  - La zona (lat/lon) se redondea a 1 decimal (unos 10 km) antes de salir del móvil, y solo se guarda en ese móvil.
//  - Las horas son las del sitio (timezone=auto): «ahora» sale de utc_offset_seconds, no de la hora del móvil.
//  - Los avisos son consejos generales (ir por sensaciones, beber, abrigarse, entrenar dentro); no tocan la pauta.

export const AIRE_LIBRE = new Set(['carrera', 'andar', 'bici']);
// ¿La pauta de cardio es de las que se hacen fuera?
export const deFuera = (pauta) => !!pauta && typeof pauta === 'object' && AIRE_LIBRE.has(pauta.modalidad);

export const redondear = (x) => Math.round(Number(x) * 10) / 10;
export function zonaValida(z) {
  if (!z || typeof z !== 'object') return false;
  const lat = Number(z.lat), lon = Number(z.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
// Lo que se guarda en el móvil: la zona redondeada, su nombre (si lo eligió por ciudad) y de dónde salió
export function zonaLimpia(z) {
  if (!zonaValida(z)) return null;
  const nombre = typeof z.nombre === 'string' ? z.nombre.trim().slice(0, 80) : '';
  return { lat: redondear(z.lat), lon: redondear(z.lon), nombre: nombre || null, origen: z.origen === 'ciudad' ? 'ciudad' : 'ubicacion' };
}

export const HORARIAS = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'is_day'];
export const HOSTS_TIEMPO = ['https://api.open-meteo.com', 'https://air-quality-api.open-meteo.com', 'https://geocoding-api.open-meteo.com'];
const coords = (z) => `latitude=${redondear(z.lat)}&longitude=${redondear(z.lon)}`;
export const urlPrevision = (z) => `${HOSTS_TIEMPO[0]}/v1/forecast?${coords(z)}&hourly=${HORARIAS.join(',')}&timezone=auto&forecast_days=2&wind_speed_unit=kmh`;
export const urlAire = (z) => `${HOSTS_TIEMPO[1]}/v1/air-quality?${coords(z)}&hourly=european_aqi&timezone=auto&forecast_days=2`;
export function urlBuscar(texto) {
  const t = String(texto || '').trim().slice(0, 60);
  return t.length >= 2 ? `${HOSTS_TIEMPO[2]}/v1/search?name=${encodeURIComponent(t)}&count=5&language=es&format=json` : null;
}

const numero = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));

// Lo que contesta el buscador de ciudades: nombre, provincia y país, y la zona ya redondeada
export function leerBusqueda(json) {
  const r = Array.isArray(json?.results) ? json.results : [];
  return r.filter((x) => zonaValida({ lat: x.latitude, lon: x.longitude }) && x.name).slice(0, 5).map((x) => ({
    nombre: String(x.name).slice(0, 80),
    detalle: [x.admin1, x.country].filter((s) => s && s !== x.name).join(', '),
    lat: redondear(x.latitude), lon: redondear(x.longitude),
  }));
}

// La previsión por horas: { offset, horas: [{ hora: 'AAAA-MM-DDTHH:00', t, st, lluvia, mm, codigo, viento, rachas, uv, dia }] }
export function leerPrevision(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) return null;
  const v = (k, i) => numero(h[k]?.[i]);
  return {
    offset: numero(json.utc_offset_seconds) || 0,
    horas: h.time.map((hora, i) => ({
      hora: String(hora).slice(0, 16),
      t: v('temperature_2m', i), st: v('apparent_temperature', i), lluvia: v('precipitation_probability', i), mm: v('precipitation', i),
      codigo: v('weather_code', i), viento: v('wind_speed_10m', i), rachas: v('wind_gusts_10m', i), uv: v('uv_index', i), dia: h.is_day ? h.is_day[i] === 1 : true,
      ica: null,
    })),
  };
}
// La calidad del aire (índice europeo, 0–100+), hora a hora, sobre la previsión
export function conAire(prev, json) {
  const h = json?.hourly;
  if (!prev || !h || !Array.isArray(h.time)) return prev;
  const por = new Map(h.time.map((t, i) => [String(t).slice(0, 16), numero(h.european_aqi?.[i])]));
  return { ...prev, horas: prev.horas.map((x) => ({ ...x, ica: por.has(x.hora) ? por.get(x.hora) : x.ica })) };
}

// La hora de ahora en el sitio de la previsión ('AAAA-MM-DDTHH:00')
export const horaLocal = (prev, ahoraMs = Date.now()) => `${new Date(ahoraMs + (prev?.offset || 0) * 1000).toISOString().slice(0, 13)}:00`;
export const ahoraTiempo = (prev, ahoraMs = Date.now()) => prev?.horas?.find((h) => h.hora === horaLocal(prev, ahoraMs)) || null;
// Las horas que quedan hoy (desde la de ahora)
export function horasDeHoy(prev, ahoraMs = Date.now()) {
  if (!prev?.horas) return [];
  const ya = horaLocal(prev, ahoraMs);
  return prev.horas.filter((h) => h.hora.slice(0, 10) === ya.slice(0, 10) && h.hora >= ya);
}

// El cielo en palabras y su icono (códigos WMO de Open-Meteo)
export function cielo(codigo, dia = true) {
  const c = Number(codigo);
  if (c === 0) return { texto: 'Despejado', icono: dia ? 'sol' : 'luna' };
  if (c === 1 || c === 2) return { texto: 'Algunas nubes', icono: 'nube' };
  if (c === 3) return { texto: 'Nublado', icono: 'nube' };
  if (c === 45 || c === 48) return { texto: 'Niebla', icono: 'niebla' };
  if (c >= 51 && c <= 57) return { texto: 'Llovizna', icono: 'lluvia' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { texto: c >= 80 ? 'Chubascos' : 'Lluvia', icono: 'lluvia' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { texto: 'Nieve', icono: 'nieve' };
  if (c >= 95) return { texto: 'Tormenta', icono: 'tormenta' };
  return { texto: 'Tiempo variable', icono: 'nube' };
}
const TORMENTA = new Set([95, 96, 99]);
const RESBALA = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
const grados = (x) => `${Math.round(x)} °C`;

// Los avisos para salir a esa hora, los de más peso primero: [{ clave, nivel: 'alto' | 'precaucion', titulo, texto }]
export function avisosTiempo(h, { modalidad = 'carrera' } = {}) {
  if (!h) return [];
  const a = [];
  const tormenta = TORMENTA.has(h.codigo);
  if (tormenta) a.push({ clave: 'tormenta', nivel: 'alto', titulo: 'Tormenta', texto: 'Con tormenta, mejor no salir: cambia la hora o hazlo dentro (cinta, bici estática o elíptica).' });
  if (h.st != null) {
    if (h.st >= 32) a.push({ clave: 'calor', nivel: 'alto', titulo: `Calor fuerte (sensación de ${grados(h.st)})`, texto: 'Sal a primera o a última hora y por sombra. Con calor el pulso sube y el mismo ritmo cuesta más: ve por sensaciones. Bebe antes y durante; si te mareas o te da frío, para.' });
    else if (h.st >= 27) a.push({ clave: 'calor', nivel: 'precaucion', titulo: `Calor (sensación de ${grados(h.st)})`, texto: 'Bebe antes de salir y lleva agua si pasas de 45 minutos. Ropa clara y gorra; ve por sensaciones, no por ritmo.' });
    else if (h.st <= -10) a.push({ clave: 'frio', nivel: 'alto', titulo: `Frío intenso (sensación de ${grados(h.st)})`, texto: 'Capas, guantes, gorro y algo que te tape la cara. Calienta dentro y, si hay viento, empieza contra él para volver con él a favor.' });
    else if (h.st <= 0) a.push({ clave: 'frio', nivel: 'precaucion', titulo: `Frío (sensación de ${grados(h.st)})`, texto: 'Calienta dentro y sal por capas: a los 10 minutos te sobrará una. Guantes y gorro ayudan mucho.' });
  }
  if (RESBALA.has(h.codigo)) a.push({ clave: 'suelo', nivel: 'precaucion', titulo: 'Suelo resbaladizo', texto: modalidad === 'bici' ? 'Nieve o lluvia que se hiela: en bici, mejor dentro hoy.' : 'Nieve o lluvia que se hiela: calzado con agarre y zancada más corta; si hay hielo, mejor dentro.' });
  else if (!tormenta && ((h.lluvia ?? 0) >= 60 || (h.mm ?? 0) >= 1)) a.push({ clave: 'lluvia', nivel: 'precaucion', titulo: `Lluvia${h.lluvia != null ? ` (${Math.round(h.lluvia)} %)` : ''}`, texto: modalidad === 'bici' ? 'Frena antes y ojo con las líneas pintadas y las tapas: resbalan.' : 'Ropa que no empape y ojo con los pasos de cebra, las tapas y las hojas: resbalan.' });
  if ((h.rachas ?? 0) >= 70) a.push({ clave: 'viento', nivel: 'alto', titulo: `Viento muy fuerte (rachas de ${Math.round(h.rachas)} km/h)`, texto: 'Mejor dentro hoy, o por sitios abiertos y sin árboles.' });
  else if ((h.rachas ?? 0) >= 50) a.push({ clave: 'viento', nivel: 'precaucion', titulo: `Viento (rachas de ${Math.round(h.rachas)} km/h)`, texto: modalidad === 'bici' ? 'Cuidado con las rachas de lado; empieza contra el viento para volver con él a favor.' : 'Empieza contra el viento para volver con él a favor, y ve por sensaciones: con viento, el ritmo engaña.' });
  if ((h.uv ?? 0) >= 8 && h.dia) a.push({ clave: 'sol', nivel: 'precaucion', titulo: `Sol fuerte (índice UV ${Math.round(h.uv)})`, texto: 'Crema solar, gorra y gafas; mejor por sombra.' });
  if (h.ica != null) {
    if (h.ica > 80) a.push({ clave: 'aire', nivel: 'alto', titulo: 'Aire muy contaminado', texto: 'Hoy, mejor entrena dentro o deja la intensidad para otro día.' });
    else if (h.ica > 60) a.push({ clave: 'aire', nivel: 'precaucion', titulo: 'Aire malo', texto: 'Si tienes asma o te molesta la garganta, baja la intensidad o entrena dentro; evita las calles con mucho tráfico.' });
  }
  return a.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'alto' ? -1 : 1));
}

// Lo «incómoda» que es una hora para salir (menos es mejor): lejos de 8–15 °C de sensación (el calor pesa más),
// lluvia, tormenta, rachas, aire y, por poco, la noche
export function puntosHora(h) {
  let p = 0;
  if (h.st != null) p += h.st > 15 ? (h.st - 15) * 1.5 : h.st < 8 ? 8 - h.st : 0;
  p += (h.lluvia ?? 0) / 10 + (h.mm ?? 0) * 4;
  if (TORMENTA.has(h.codigo)) p += 40;
  if ((h.rachas ?? 0) > 30) p += (h.rachas - 30) / 4;
  if ((h.ica ?? 0) > 40) p += (h.ica - 40) / 4;
  if (!h.dia) p += 1.5;
  return p;
}
export function motivoHora(h) {
  const partes = [];
  if (h.st != null) partes.push(`${grados(h.st)} de sensación`);
  partes.push((h.lluvia ?? 0) < 20 && !(h.mm > 0) ? 'sin lluvia' : `${Math.round(h.lluvia ?? 0)} % de lluvia`);
  if ((h.rachas ?? 0) >= 30) partes.push(`rachas de ${Math.round(h.rachas)} km/h`);
  return partes.join(', ');
}
// La mejor hora para salir lo que queda de hoy (de 6 a 22 h): { hora: 'HH:MM', ahora, motivo, h } o null (si quedan menos de 2)
export function mejorHora(prev, ahoraMs = Date.now(), { desde = 6, hasta = 22 } = {}) {
  const horas = horasDeHoy(prev, ahoraMs).filter((h) => { const H = Number(h.hora.slice(11, 13)); return H >= desde && H <= hasta; });
  if (horas.length < 2) return null;
  const mejor = horas.reduce((m, h) => (puntosHora(h) < puntosHora(m) - 0.5 ? h : m));
  return { hora: mejor.hora.slice(11, 16), ahora: mejor === horas[0] && mejor.hora === horaLocal(prev, ahoraMs), motivo: motivoHora(mejor), h: mejor };
}

// Una línea para el resumen de Hoy: «14 °C, algunas nubes · mejor a las 19:00»
export function resumenTiempo(prev, ahoraMs = Date.now()) {
  const h = ahoraTiempo(prev, ahoraMs);
  if (!h) return null;
  const m = mejorHora(prev, ahoraMs);
  return [`${h.t != null ? grados(h.t) : '—'}, ${cielo(h.codigo, h.dia).texto.toLowerCase()}`, m && (m.ahora ? 'buen momento ahora' : `mejor a las ${m.hora}`)].filter(Boolean).join(' · ');
}

// El índice europeo de calidad del aire, en palabras (bandas de la Agencia Europea de Medio Ambiente)
export function textoAire(ica) {
  if (ica == null) return null;
  return ica <= 20 ? 'Bueno' : ica <= 40 ? 'Aceptable' : ica <= 60 ? 'Regular' : ica <= 80 ? 'Malo' : 'Muy malo';
}
