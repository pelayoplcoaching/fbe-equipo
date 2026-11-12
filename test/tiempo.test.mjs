// (v0.142) El tiempo para salir (Open-Meteo): direcciones, lectura, avisos, la mejor hora y su sitio en la app.
import {
  deFuera, redondear, zonaValida, zonaLimpia, urlPrevision, urlAire, urlBuscar, leerBusqueda, leerPrevision, conAire, horaLocal, ahoraTiempo,
  horasDeHoy, cielo, avisosTiempo, puntosHora, mejorHora, motivoHora, resumenTiempo, textoAire, HOSTS_TIEMPO,
} from '../web/src/logica/tiempo.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Qué sale fuera y la zona');
check(deFuera({ modalidad: 'carrera' }) && deFuera({ modalidad: 'andar' }) && deFuera({ modalidad: 'bici' }) && !deFuera({ modalidad: 'eliptica' }) && !deFuera({ modalidad: 'nadar' }) && !deFuera(null), 'carrera, andar y bici salen fuera; elíptica, natación o nada, no');
check(redondear(40.41678) === 40.4 && redondear(-3.70379) === -3.7 && redondear(-0.05) === -0, 'la zona, a un decimal (unos 10 km)');
check(zonaValida({ lat: 40.4, lon: -3.7 }) && !zonaValida({ lat: 91, lon: 0 }) && !zonaValida({ lat: 'x', lon: 0 }) && !zonaValida(null), 'zonas válidas (y las raras, no)');
const zl = zonaLimpia({ lat: 39.46975, lon: -0.37739, nombre: '  Valencia ', origen: 'ciudad', extra: 'nada' });
check(JSON.stringify(zl) === '{"lat":39.5,"lon":-0.4,"nombre":"Valencia","origen":"ciudad"}' && zonaLimpia({ lat: 1, lon: 1 }).origen === 'ubicacion' && zonaLimpia({ lat: 99, lon: 1 }) === null, 'lo que se guarda en el móvil: la zona redondeada, su nombre y de dónde salió; nada más');

console.log('Las direcciones de Open-Meteo');
const z = { lat: 40.41678, lon: -3.70379 };
const up = urlPrevision(z);
check(up.startsWith('https://api.open-meteo.com/v1/forecast?latitude=40.4&longitude=-3.7&') && /timezone=auto/.test(up) && /apparent_temperature/.test(up) && /wind_gusts_10m/.test(up) && !/40\.41/.test(up), 'la previsión: solo la zona redondeada (40.4, -3.7), por horas y con la hora del sitio');
check(urlAire(z).startsWith('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=40.4&longitude=-3.7&') && /european_aqi/.test(urlAire(z)), 'la calidad del aire, igual de redondeada');
check(urlBuscar(' Alcalá de Henares ') === 'https://geocoding-api.open-meteo.com/v1/search?name=Alcal%C3%A1%20de%20Henares&count=5&language=es&format=json' && urlBuscar('a') === null && urlBuscar('x'.repeat(200)).includes('x'.repeat(60) + '&'), 'buscar una ciudad (lo escrito, recortado a 60 letras)');
const bus = leerBusqueda({ results: [{ name: 'Valencia', latitude: 39.46975, longitude: -0.37739, admin1: 'Comunidad Valenciana', country: 'España' }, { name: 'Valencia', latitude: 10.16, longitude: -68.0, country: 'Venezuela' }, { name: 'Rara', latitude: 200, longitude: 0 }] });
check(bus.length === 2 && bus[0].lat === 39.5 && bus[0].detalle === 'Comunidad Valenciana, España' && bus[1].detalle === 'Venezuela' && leerBusqueda({}).length === 0, 'lo que encuentra: nombre, provincia y país, ya redondeado (y lo raro fuera)');

console.log('Leer la previsión');
// 48 horas desde las 00:00 del 12/11/2026 en un sitio a UTC+1
const horas = Array.from({ length: 48 }, (_, i) => `2026-11-${12 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
const sitio = (f) => ({ utc_offset_seconds: 3600, hourly: { time: horas, ...Object.fromEntries(['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'is_day'].map((k) => [k, horas.map((h, i) => f(k, Number(h.slice(11, 13)), i))])) } });
const base = (k, H) => ({ temperature_2m: 6 + H * 0.5, apparent_temperature: -2 + H * 0.75, precipitation_probability: H >= 15 && H <= 17 ? 80 : 10, precipitation: H >= 15 && H <= 17 ? 1.2 : 0, weather_code: H >= 15 && H <= 17 ? 61 : 2, wind_speed_10m: 10, wind_gusts_10m: 20, uv_index: 2, is_day: H >= 8 && H <= 18 ? 1 : 0 })[k];
const prev = leerPrevision(sitio(base));
check(prev.offset === 3600 && prev.horas.length === 48 && prev.horas[10].t === 11 && prev.horas[10].dia === true && prev.horas[20].dia === false && prev.horas[16].lluvia === 80, 'por horas: temperatura, sensación, lluvia, viento, sol y si es de día');
check(leerPrevision({}) === null && leerPrevision({ hourly: { time: [] } }) === null, 'sin horas, nada');
const conA = conAire(prev, { hourly: { time: horas.slice(0, 24), european_aqi: horas.slice(0, 24).map((_, i) => (i === 12 ? 75 : 25)) } });
check(conA.horas[12].ica === 75 && conA.horas[11].ica === 25 && conA.horas[30].ica === null && conAire(prev, null) === prev, 'el aire, hora a hora (y si no llega, la previsión sigue)');

console.log('Ahora y lo que queda de hoy');
const a = Date.parse('2026-11-12T09:20:00Z'); // 10:20 en el sitio (UTC+1)
check(horaLocal(prev, a) === '2026-11-12T10:00' && ahoraTiempo(prev, a).hora === '2026-11-12T10:00', '«ahora» es la hora del sitio (por su desfase), no la del móvil');
check(horasDeHoy(prev, a).length === 14 && horasDeHoy(prev, a)[0].hora === '2026-11-12T10:00' && horasDeHoy(prev, a).at(-1).hora === '2026-11-12T23:00', 'lo que queda de hoy: de las 10 a las 23');

console.log('El cielo y los avisos');
check(cielo(0, true).icono === 'sol' && cielo(0, false).icono === 'luna' && cielo(3).texto === 'Nublado' && cielo(45).icono === 'niebla' && cielo(63).icono === 'lluvia' && cielo(81).texto === 'Chubascos' && cielo(75).icono === 'nieve' && cielo(95).icono === 'tormenta', 'el cielo en palabras y su icono');
const h0 = { st: 15, t: 15, lluvia: 10, mm: 0, codigo: 1, rachas: 20, uv: 3, dia: true, ica: 20 };
check(avisosTiempo(h0).length === 0 && avisosTiempo(null).length === 0, 'con buen tiempo, ningún aviso');
const calor = avisosTiempo({ ...h0, st: 34 });
check(calor.length === 1 && calor[0].clave === 'calor' && calor[0].nivel === 'alto' && /sensación de 34 °C/.test(calor[0].titulo) && /sensaciones/.test(calor[0].texto), 'calor fuerte (34 °C de sensación): alto, salir temprano o tarde e ir por sensaciones');
check(avisosTiempo({ ...h0, st: 28 })[0].nivel === 'precaucion' && avisosTiempo({ ...h0, st: -2 })[0].clave === 'frio' && avisosTiempo({ ...h0, st: -12 })[0].nivel === 'alto', 'calor (27+), frío (0 o menos) y frío intenso (−10)');
const torm = avisosTiempo({ ...h0, codigo: 95, lluvia: 90, mm: 5 });
check(torm.length === 1 && torm[0].clave === 'tormenta' && /dentro/.test(torm[0].texto), 'tormenta: mejor dentro (y no repite la lluvia)');
check(avisosTiempo({ ...h0, lluvia: 70 })[0].clave === 'lluvia' && avisosTiempo({ ...h0, codigo: 66 })[0].clave === 'suelo' && /bici/.test(avisosTiempo({ ...h0, codigo: 71 }, { modalidad: 'bici' })[0].texto), 'lluvia, y el suelo que resbala (en bici, mejor dentro)');
check(avisosTiempo({ ...h0, rachas: 55 })[0].nivel === 'precaucion' && avisosTiempo({ ...h0, rachas: 75 })[0].nivel === 'alto', 'viento: rachas de 50 km/h o más (70, alto)');
check(avisosTiempo({ ...h0, uv: 9 })[0].clave === 'sol' && avisosTiempo({ ...h0, uv: 9, dia: false }).length === 0, 'sol fuerte (UV 8+) solo de día');
check(avisosTiempo({ ...h0, ica: 70 })[0].nivel === 'precaucion' && avisosTiempo({ ...h0, ica: 90 })[0].nivel === 'alto' && /asma/.test(avisosTiempo({ ...h0, ica: 70 })[0].texto), 'aire malo (60+) y muy malo (80+)');
const varios = avisosTiempo({ ...h0, st: 28, ica: 90 });
check(varios.map((x) => x.nivel).join() === 'alto,precaucion', 'los de más peso, primero');
check(textoAire(15) === 'Bueno' && textoAire(35) === 'Aceptable' && textoAire(55) === 'Regular' && textoAire(70) === 'Malo' && textoAire(95) === 'Muy malo' && textoAire(null) === null, 'el aire en palabras (bandas europeas)');

console.log('La mejor hora para salir');
check(puntosHora({ ...h0, st: 12 }) < puntosHora({ ...h0, st: 25 }) && puntosHora({ ...h0, st: 25 }) > puntosHora({ ...h0, st: 3 }) && puntosHora({ ...h0, codigo: 95 }) > 40, 'el calor pesa más que el frío; la tormenta, muchísimo');
// a las 10:20: hace frío por la mañana, llueve de 15 a 17 y por la noche no es de día → lo mejor, a las 13 (8 °C de sensación; a las 14 apenas mejora y se queda la primera)
const m = mejorHora(prev, a);
check(m.hora === '13:00' && !m.ahora && m.motivo === '8 °C de sensación, sin lluvia', `la mejor hora de lo que queda: la más agradable y seca (${m.hora}: ${m.motivo})`);
const m2 = mejorHora(leerPrevision(sitio((k, H) => (k === 'apparent_temperature' ? 12 : base(k, H)))), a);
check(m2.ahora && m2.hora === '10:00', 'si ahora ya es tan buena como cualquiera, «buen momento ahora»');
check(mejorHora(prev, Date.parse('2026-11-12T21:30:00Z')) === null, 'a las 22:30 ya no quedan horas (no se propone nada)');
check(motivoHora({ st: 30.4, lluvia: 40, rachas: 35 }) === '30 °C de sensación, 40 % de lluvia, rachas de 35 km/h', 'el motivo, en palabras');
check(resumenTiempo(prev, a) === '11 °C, algunas nubes · mejor a las 13:00' && resumenTiempo(prev, Date.parse('2027-01-01T00:00:00Z')) === null, 'el resumen para Hoy: los grados, el cielo y la mejor hora');

console.log('En la app');
const html = readFileSync(join(raiz, 'web/index.html'), 'utf8');
check(HOSTS_TIEMPO.every((h) => new RegExp(`connect-src[^;]*${h.replace(/[./]/g, '\\$&')}`).test(html)), 'la política de seguridad deja hablar con Open-Meteo (previsión, aire y buscador)');
const ui = readFileSync(join(raiz, 'web/src/ui/atleta/Tiempo.jsx'), 'utf8');
check(/fbe-tiempo-zona:\$\{/.test(ui) && /credentials: 'omit'/.test(ui) && /referrerPolicy: 'no-referrer'/.test(ui) && /enableHighAccuracy: false/.test(ui) && !/api\.(insert|update|rpc)/.test(ui), 'la zona, en el móvil por cuenta; sin cookies ni referencia; ubicación aproximada; nada a la base');
check(/removeItem\(CLAVE_CACHE\)/.test(ui) && /Quitar el tiempo/.test(ui), '«Quitar el tiempo» borra la zona y la previsión del móvil');
const hoy = readFileSync(join(raiz, 'web/src/ui/atleta/Hoy.jsx'), 'utf8');
check(/tiempo: \(e\.tipo === 'entreno' && deFuera\(siguiente\?\.cardio\)\) \|\| \(conCarrera\(atleta\) && !propio\)/.test(hoy) && /<Plegable id="tiempo"/.test(hoy), 'en Hoy, solo si lo que toca es cardio de fuera o si corre');
const ses = readFileSync(join(raiz, 'web/src/ui/atleta/Sesion.jsx'), 'utf8');
check(/!h && !completada && deFuera\(pauta\) && <TiempoSesion/.test(ses), 'en la sesión, encima de la pauta de cardio de fuera (y no en una hecha)');
const css = readFileSync(join(raiz, 'web/src/tiempo.css'), 'utf8');
check(!/[^\x00-\x7F]/.test(css) && !/#[0-9a-f]{3,6}\b/i.test(css) && /prefers-reduced-motion/.test(css) && readFileSync(join(raiz, 'web/src/main.jsx'), 'utf8').includes("import './tiempo.css';"), 'su hoja de estilos: ASCII, solo tokens, respeta el movimiento reducido, y se carga');

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);
