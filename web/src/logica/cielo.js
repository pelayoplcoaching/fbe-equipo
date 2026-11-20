// (v0.200, belleza) La luz de cada momento y la temporada: solo cálculos (lo pinta ui/temporada.js y la portada de Hoy).
//
// El cielo sigue al sol de Madrid de cada mes (la salida y la puesta, en hora local y aproximadas a un cuarto de hora):
// amanecer (desde media hora antes de que salga el sol hasta hora y media después), día, atardecer (hora y media antes
// de la puesta hasta media hora después) y noche. Así, en diciembre ya es de noche a las seis y media, y en junio, no.

// [salida, puesta] en horas (con decimales), de enero a diciembre, con el cambio de hora ya puesto
export const SOL_MADRID = [
  [8.6, 18.1], [8.25, 18.7], [7.75, 19.6], [7.65, 21.0], [7.05, 21.45], [6.75, 21.75],
  [6.95, 21.7], [7.4, 21.25], [7.9, 20.45], [8.3, 19.5], [8.1, 18.0], [8.55, 17.85],
];
export const MOMENTOS_CIELO = ['amanecer', 'dia', 'atardecer', 'noche'];
export const NOMBRE_MOMENTO = { amanecer: 'Amanecer', dia: 'Día', atardecer: 'Atardecer', noche: 'Noche' };

const mesDe = (fecha) => { const m = Number(String(fecha || '').slice(5, 7)); return m >= 1 && m <= 12 ? m : null; };

// hora: 0-23,99 (con decimales: 18.5 son las seis y media); fecha: «AAAA-MM-DD» (sin fecha, el sol de marzo)
export function momentoDelDia(hora, fecha = null) {
  const h = hora == null || hora === '' ? NaN : Number(hora);
  if (!Number.isFinite(h) || h < 0 || h >= 24) return null;
  const [sale, pone] = SOL_MADRID[(mesDe(fecha) || 3) - 1];
  if (h >= sale - 0.5 && h < sale + 1.5) return 'amanecer';
  if (h >= sale + 1.5 && h < pone - 1.5) return 'dia';
  if (h >= pone - 1.5 && h < pone + 0.5) return 'atardecer';
  return 'noche';
}
// La hora del móvil, con sus minutos (para momentoDelDia)
export const horaDecimal = (d = new Date()) => d.getHours() + d.getMinutes() / 60;

// Las estrellas de la noche (en % del ancho y del alto, su tamaño en px y cuándo empiezan a titilar): siempre las mismas
export const ESTRELLAS_CIELO = [
  [8, 14, 1, 0], [17, 32, 0.8, 1.2], [26, 9, 1.2, 0.4], [34, 26, 0.7, 2.1], [43, 12, 1, 1.6], [52, 30, 0.8, 0.2],
  [61, 7, 1.1, 2.6], [70, 22, 0.9, 0.9], [79, 11, 1.2, 1.9], [88, 28, 0.8, 0.6], [94, 15, 1, 2.3], [12, 44, 0.7, 3],
];

// ---------- La temporada ----------
// Navidad: del 20 de diciembre al 6 de enero (Reyes). Invierno: el resto de diciembre, de enero y de febrero.
// Fuera de eso, nada. (Es solo decoración, y se puede apagar en Ajustes.)
export function temporadaDe(fecha) {
  const m = mesDe(fecha);
  const d = Number(String(fecha || '').slice(8, 10));
  if (!m || !(d >= 1 && d <= 31)) return null;
  if ((m === 12 && d >= 20) || (m === 1 && d <= 6)) return 'navidad';
  if (m === 12 || m === 1 || m === 2) return 'invierno';
  return null;
}
export const NOMBRE_TEMPORADA = { navidad: 'Navidad', invierno: 'Invierno' };

// Los copos de la decoración: cuántos (pocos: es un adorno) y cada uno con su sitio, tamaño, ritmo y espera, siempre
// los mismos (con la semilla del día no cambian al volver a la app el mismo día)
export function coposDe(temporada, semilla = 1) {
  // (v0.200, segunda tanda) y las estrellas de fondo de la noche en oscuro: 16, quietas (solo titilan)
  const n = temporada === 'navidad' ? 14 : temporada === 'invierno' ? 7 : temporada === 'estrellas' ? 16 : 0;
  let s = (Math.abs(Math.trunc(semilla)) % 2147483646) + 1;
  const azar = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(((i + 0.5) / n) * 100 + (azar() - 0.5) * (100 / n)),
    tam: Math.round((2 + azar() * 3) * 10) / 10,
    dura: Math.round((9 + azar() * 9) * 10) / 10,
    espera: Math.round(-azar() * 18 * 10) / 10,
    deriva: Math.round((azar() - 0.5) * 40),
    op: Math.round((0.35 + azar() * 0.45) * 100) / 100,
    // (con «reducir movimiento» no caen: se quedan quietos a esta altura, en % de la franja)
    y: Math.round(8 + azar() * 80),
  }));
}
// Qué decoración lleva el fondo: la de la temporada; si no hay, de noche, las estrellas (que solo se ven en oscuro)
export function decoracionDe({ fecha, hora, encendida = true } = {}) {
  if (!encendida) return null;
  return temporadaDe(fecha) || (momentoDelDia(hora, fecha) === 'noche' ? 'estrellas' : null);
}
export const semillaDia = (fecha) => Number(String(fecha || '').replace(/\D/g, '')) || 1;

// ---------- (v0.200, segunda tanda) La luna de verdad y lo que cae ----------
// (venían de la travesía: logica/travesia.js las reexporta)
// La fase de la luna en un instante: { ilum: de 0 (nueva) a 1 (llena), creciente }
export function faseLuna(ms) {
  const SINODICO = 29.530588853, NUEVA = Date.UTC(2000, 0, 6, 18, 14);
  const edad = ((((ms - NUEVA) / 86400000) % SINODICO) + SINODICO) % SINODICO;
  return { ilum: (1 - Math.cos((2 * Math.PI * edad) / SINODICO)) / 2, creciente: edad < SINODICO / 2 };
}
// Qué cae, según el código del tiempo (los de la OMM que da la previsión): 'lluvia' | 'nieve' | 'niebla' | 'tormenta' | null
export function climaDe(codigo) {
  if (codigo == null || codigo === '') return null;
  const c = Number(codigo);
  if (!Number.isFinite(c)) return null;
  if (c >= 95) return 'tormenta';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'nieve';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'lluvia';
  if (c === 45 || c === 48) return 'niebla';
  return null;
}
// Lo que cae ahora donde está, con la previsión que ya guardó la sección del tiempo (fbe-tiempo-cache): sin pedir nada.
// Solo si es reciente (tres horas) y tiene la hora de ahora. cache: { en, prev: { offset, horas: [{ hora, codigo }] } }
export function climaDeCache(cache, ahoraMs = Date.now()) {
  const prev = cache?.prev;
  if (!prev || !Array.isArray(prev.horas) || !(ahoraMs - Number(cache.en) < 3 * 3600 * 1000)) return null;
  const hora = `${new Date(ahoraMs + (Number(prev.offset) || 0) * 1000).toISOString().slice(0, 13)}:00`;
  const h = prev.horas.find((x) => x?.hora === hora);
  return h ? climaDe(h.codigo) : null;
}
// Cuánta luna: nada en luna nueva (menos de un 4 %), y si no, su fase para pintarla
export function lunaParaPintar(ms) {
  const f = faseLuna(ms);
  return f.ilum < 0.04 ? null : { ilum: Math.round(f.ilum * 100) / 100, creciente: f.creciente, llena: f.ilum > 0.96 };
}

// ---------- Nochevieja y Año Nuevo ----------
// Del 31 de diciembre a las 20:00 al 1 de enero a las 23:59 (hora del móvil): fuegos en la portada de Hoy
export function esFinDeAno(fecha, hora) {
  const m = mesDe(fecha), d = Number(String(fecha || '').slice(8, 10)), h = Number(hora);
  return (m === 12 && d === 31 && h >= 20) || (m === 1 && d === 1);
}
