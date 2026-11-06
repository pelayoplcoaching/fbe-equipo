// «Programar según FBE» (fase 1b): el borrador de la nota de la semana para el atleta. Lógica pura.
//
// Decisión de Pelayo (5/11/2026): el borrador dice solo lo que cambia, en dos o tres frases (en qué ejercicios sube
// kilos, en cuáles suma repeticiones y que el resto sigue igual), sin motivos. Es un punto de partida: el coach lo
// edita antes de guardarlo en `semanas.nota_coach`, que es lo que el atleta ve arriba en su pantalla de hoy.
// Solo cuenta lo que se va a aplicar (las filas marcadas, con la opción elegida en cada una).
import { tieneDetalle } from '../calculos.js';
import { claseDeSerie, seriesPautadas } from './sombra.js';

const MAX_NOMBRES = 3;

// «Press banca» → «press banca»; «RDL con barra» se queda como está
const enFrase = (nombre) => { const n = String(nombre || '').trim(); return n.length > 1 && n[1] === n[1].toLowerCase() && n[1] !== n[1].toUpperCase() ? n[0].toLowerCase() + n.slice(1) : n; };
// «a», «a y b», «a, b y c»; con muchos, «a, b, c y 3 más»
export function enumerar(nombres) {
  const u = [...new Set(nombres.map(enFrase).filter(Boolean))];
  if (u.length <= 1) return u[0] || '';
  const vistos = u.slice(0, MAX_NOMBRES), mas = u.length - vistos.length;
  if (mas > 0) return `${vistos.join(', ')} y ${mas} más`;
  return `${vistos.slice(0, -1).join(', ')} y ${vistos[vistos.length - 1]}`;
}

// Qué le pasa a un ejercicio con lo que se va a aplicar, para la nota:
//   'kilos' | 'reps' | 'series' | 'peaking' (menos repeticiones en la top) | 'peaking_kilos' | 'baja' | null (igual, o
//   lo cuenta la frase de la semana: descarga, vuelta, mantenimiento)
//   fila: la del motor · alternativa: la elegida (o null) · propuesta: la que se aplica · hechas: las series de la base
export function claseParaNota({ fila, alternativa = null, propuesta = null, hechas = [] }) {
  if (!alternativa) {
    if (fila.tipo === 'subir') return fila.fase === 'peaking' ? 'peaking_kilos' : 'kilos';
    return { reps: 'reps', series: 'series', peaking: 'peaking', bajar: 'baja' }[fila.tipo] || null;
  }
  if (alternativa.id === 'mantener' || !propuesta) return null;
  // Otra opción de un toque: se mira qué hace con cada serie respecto a lo que se hizo
  const porNumero = Object.fromEntries((hechas || []).filter((s) => !s.sustituto_id && Number(s.reps) > 0).map((s) => [Number(s.numero), s]));
  const clases = seriesPautadas(propuesta, fila.ejercicio).map((o, i) => (porNumero[i + 1] ? claseDeSerie(o, porNumero[i + 1]) : null)).filter(Boolean);
  if (clases.includes('sube_kilos')) return 'kilos';
  if (tieneDetalle(propuesta) && clases.includes('sube_reps')) return 'reps';
  if (clases.length && clases.every((c) => c === 'baja')) return 'baja';
  return null;
}

const DESCARGA = {
  ligera: 'Semana de descarga: menos carga y menos series para recuperar. Quédate lejos del fallo en todo.',
  volumen: 'Semana de descarga: mismas cargas con menos series. Quédate lejos del fallo.',
  intensidad: 'Semana de descarga: mismas series con menos carga. Quédate lejos del fallo.',
  tecnica: 'Semana de descarga: cargas ligeras para pulir la técnica. Nada cerca del fallo.',
};
const SEMANA = {
  vuelta: 'Vuelves después de unos días sin entrenar: esta semana bajamos cargas para retomar con buenas sensaciones.',
  repetir: 'Repetimos la semana pasada, que quedó a medias: mismas cargas y repeticiones.',
  mantenimiento: 'Semana de mantenimiento: mismas cargas con menos series.',
};

// El borrador.
//   filas: [{ ejercicio, clase }] de lo que se va a aplicar (clase de claseParaNota; las null no hace falta pasarlas)
//   semana: 'normal' | 'descarga' | 'vuelta' | 'repetir' | 'mantenimiento' · descarga: su tipo, si lo es
//   total: cuántos ejercicios tiene la semana (para saber si queda «el resto»)
export function notaDeSemana({ filas = [], semana = 'normal', descarga = 'ligera', total = 0 } = {}) {
  if (semana === 'descarga') return DESCARGA[descarga] || DESCARGA.ligera;
  if (SEMANA[semana]) return SEMANA[semana];
  const de = (...clases) => filas.filter((f) => clases.includes(f.clase)).map((f) => f.ejercicio);
  const kilos = de('kilos'), reps = de('reps'), series = de('series'), pico = de('peaking', 'peaking_kilos'), baja = de('baja');
  const frases = [];
  if (pico.length) frases.push(`Semana de peaking: en ${enumerar(pico)} haces menos repeticiones en la serie pesada${de('peaking_kilos').length ? ', con más carga' : ''}.`);
  if (kilos.length) frases.push(`${frases.length ? 'Subes' : 'Esta semana subes'} kilos en ${enumerar(kilos)}.`);
  if (reps.length) frases.push(`${frases.length ? 'Busca' : 'Esta semana busca'} una repetición más en ${enumerar(reps)}.`);
  if (series.length) frases.push(`${frases.length ? 'Haces' : 'Esta semana haces'} una serie más en ${enumerar(series)}.`);
  if (baja.length) frases.push(`${frases.length ? 'Bajas' : 'Esta semana bajas'} un poco la carga en ${enumerar(baja)} para que salgan bien las repeticiones.`);
  if (!frases.length) return 'Esta semana repites lo de la anterior: mismas cargas y repeticiones, buscando que salgan igual de bien o más fáciles.';
  const nombrados = new Set([...kilos, ...reps, ...series, ...pico, ...baja]).size;
  if (total > nombrados) frases.push('El resto, igual que la semana pasada.');
  return frases.join(' ');
}
