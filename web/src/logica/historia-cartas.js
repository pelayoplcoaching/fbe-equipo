// (belleza 304) Cada tarjeta de una historia (la del final de la sesión, «Tu semana», «Tu mes» y «Tu año»), tal cual, para
// compartirla: la tarjeta de logro de ui/Compartir.jsx (pintarLogro) con lo que dice esa tarjeta: su etiqueta, su título,
// su cifra y hasta tres líneas. Solo las de entreno: las de peso, hábitos, nutrición o música no llevan el botón (aquí
// devuelven null). Va aparte y se pide al tocar el botón: no pesa en el arranque.
import { num, textoSerie, NOMBRE_GRUPO } from './calculos.js';
import { pesoTxt } from './unidades.js';
import { hoyISO } from './fechas.js';

const ton = (kg) => num(Math.round((Number(kg) || 0) / 100) / 10, 1);
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
const pl = (n, uno, varios) => (Number(n) === 1 ? uno : varios);
const carta = (o) => ({ fecha: hoyISO(), ...o, lineas: (o.lineas || []).filter(Boolean).slice(0, 3) });
const grupo = (g) => NOMBRE_GRUPO[g] || g;

// Los récords: uno, como la tarjeta de un récord; varios, juntos (los tres primeros)
function cartaRecords(lista, etiqueta, fecha, nombreDe, textoDe) {
  if (!lista?.length) return null;
  if (lista.length === 1) return carta({ tipo: 'record', etiqueta: 'Nuevo récord', nombre: nombreDe(lista[0]), lineas: [textoDe(lista[0])], fecha });
  return carta({ tipo: 'logro', etiqueta, nombre: `${lista.length} récords`, lineas: lista.slice(0, 3).map((x) => `${nombreDe(x)}: ${textoDe(x)}`), fecha });
}

// El final de la sesión (HistoriaSesion): «Lo que has hecho» es la tarjeta de la sesión de siempre (con sus plantillas)
export function cartaSesion(r, id, { nombre = '' } = {}) {
  if (!r) return null;
  if (id === 'hecho') return r.tarjeta ? { sesion: true, datos: r.tarjeta } : null;
  if (id === 'records') return cartaRecords(r.records, 'Tus récords de hoy', hoyISO(), (x) => x.nombre, (x) => x.r?.texto || '');
  if (id === 'musculos') {
    const g = Object.entries(r.musculos || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!g.length) return null;
    return carta({ tipo: 'logro', icono: 'rayo', etiqueta: 'Tus músculos de hoy', nombre: grupo(g[0][0]), cifra: { v: num(g[0][1]), t: pl(g[0][1], 'serie', 'series') },
      lineas: [nombre, ...g.slice(1, 3).map(([k, v]) => `${grupo(k)}: ${num(v)} ${pl(v, 'serie', 'series')}`)] });
  }
  return null;
}

// «Tu semana» (rango: «del 9 al 15 de noviembre»)
export function cartaSemana(r, id, { rango = '' } = {}) {
  if (!r) return null;
  const fecha = r.domingo || hoyISO();
  const titulo = `Tu semana ${rango}`.trim();
  if (id === 'portada') {
    return carta({ tipo: 'semana', etiqueta: titulo, nombre: r.sesiones?.completa ? 'Semana completa' : `${r.sesiones?.hechas || 0} de ${r.sesiones?.total || 0} sesiones`,
      lineas: [r.racha > 0 ? (r.racha === 1 ? '1 semana completa' : `${r.racha} semanas completas seguidas`) : ''], fecha });
  }
  if (id === 'volumen') {
    return carta({ tipo: 'semana', icono: 'progreso', etiqueta: 'Has movido', nombre: titulo, cifra: { v: ton(r.tonelaje), u: 't', t: 'toneladas' },
      lineas: [`${r.series} series${r.minutos ? ` en ${horas(r.minutos)}` : ''}`, r.cardio?.minutos ? `${r.cardio.minutos} min de cardio${r.cardio.km ? ` (${num(r.cardio.km, 1)} km)` : ''}` : ''], fecha });
  }
  if (id === 'records') {
    if (r.records?.length) return cartaRecords(r.records, 'Récords de la semana', fecha, (x) => x.ejercicio, (x) => x.texto);
    return r.mejor ? carta({ tipo: 'logro', etiqueta: 'Tu mejor serie', nombre: r.mejor.ejercicio, lineas: [textoSerie(r.mejor.serie), `1RM estimado de ${pesoTxt(r.mejor.e1rm, 1)}`], fecha }) : null;
  }
  if (id === 'momento') {
    return r.momento ? carta({ tipo: 'record', etiqueta: 'Tu mejor momento', nombre: r.momento.ejercicio, cifra: { v: `+${num(r.momento.pct, 1)}`, u: '%', t: 'sobre tu mejor marca' }, lineas: [r.momento.texto], fecha }) : null;
  }
  if (id === 'musculos') {
    return r.musculoTop ? carta({ tipo: 'logro', icono: 'rayo', etiqueta: 'Lo que más has trabajado', nombre: grupo(r.musculoTop.grupo), cifra: { v: num(r.musculoTop.series), t: pl(r.musculoTop.series, 'serie', 'series') }, lineas: [titulo], fecha }) : null;
  }
  return null;
}

// «Tu mes» (tu: «Tu noviembre»; mes: «noviembre»)
export function cartaMes(r, id, { tu = '', mes = '' } = {}) {
  if (!r?.conEntreno) return null;
  if (id === 'portada') {
    return carta({ tipo: 'mes', etiqueta: tu, nombre: `${r.sesiones.hechas} ${pl(r.sesiones.hechas, 'sesión', 'sesiones')}`,
      lineas: [r.sesiones.previstas ? `de ${r.sesiones.previstas} previstas` : '', `${r.dias} ${pl(r.dias, 'día', 'días')} entrenando${r.minutos ? `, ${horas(r.minutos)} en total` : ''}`] });
  }
  if (id === 'volumen') return carta({ tipo: 'mes', icono: 'progreso', etiqueta: 'Has movido', nombre: tu, cifra: { v: ton(r.tonelaje), u: 't', t: 'toneladas' }, lineas: [`en ${r.series} series`] });
  if (id === 'records') return cartaRecords(r.records, `Récords de ${mes}`.trim(), hoyISO(), (x) => x.ejercicio, (x) => x.texto);
  if (id === 'racha') {
    return r.mejorRacha > 0 ? carta({ tipo: 'racha', llama: true, etiqueta: 'Tu mejor racha', nombre: tu, cifra: { v: String(r.mejorRacha), t: pl(r.mejorRacha, 'semana completa', 'semanas completas seguidas') },
      lineas: [r.semanasCompletas ? `${r.semanasCompletas} ${pl(r.semanasCompletas, 'semana', 'semanas')} con todo lo previsto hecho` : ''] }) : null;
  }
  if (id === 'calendario') return carta({ tipo: 'mes', etiqueta: 'Tu constancia', nombre: `${r.dias} ${pl(r.dias, 'día', 'días')}`, lineas: [`entrenando en ${mes}`] });
  if (id === 'cardio') return r.cardio?.sesiones ? carta({ tipo: 'mes', icono: 'pasos', etiqueta: 'Cardio', nombre: tu, cifra: { v: String(r.cardio.minutos), t: 'minutos' }, lineas: [`${r.cardio.km ? `${num(r.cardio.km, 1)} km en ` : 'En '}${r.cardio.sesiones} ${pl(r.cardio.sesiones, 'sesión', 'sesiones')}`] }) : null;
  return null;
}

// «Tu año»
export function cartaAnio(r, id) {
  if (!r) return null;
  const tu = `Tu ${r.anio} en FBE`;
  if (id === 'portada') return carta({ tipo: 'anio', etiqueta: tu, nombre: `${r.sesiones} ${pl(r.sesiones, 'sesión', 'sesiones')}`, lineas: [`${r.dias} ${pl(r.dias, 'día', 'días')} entrenando${r.minutos ? `, unas ${horas(r.minutos)}` : ''}`] });
  if (id === 'volumen') return carta({ tipo: 'anio', icono: 'progreso', etiqueta: 'Has movido', nombre: tu, cifra: { v: ton(r.tonelaje), u: 't', t: 'toneladas' }, lineas: [`en ${r.series} series`] });
  if (id === 'meses') return r.mesTop ? carta({ tipo: 'anio', etiqueta: 'Mes a mes', nombre: `Tu mejor mes, ${r.mesTop.mes}`, lineas: [`${r.mesTop.sesiones} ${pl(r.mesTop.sesiones, 'sesión', 'sesiones')}`, tu] }) : null;
  if (id === 'records') return r.records > 0 ? carta({ tipo: 'logro', etiqueta: 'Récords', nombre: tu, cifra: { v: String(r.records), t: pl(r.records, 'récord', 'récords') }, lineas: [r.ejerciciosConRecord ? `en ${r.ejerciciosConRecord} ${pl(r.ejerciciosConRecord, 'ejercicio', 'ejercicios')}` : ''] }) : null;
  if (id === 'progreso') return r.progreso ? carta({ tipo: 'record', etiqueta: 'Lo que más ha subido', nombre: r.progreso.ejercicio, cifra: { v: `+${num(r.progreso.pct, 1)}`, u: '%', t: 'de 1RM estimado' }, lineas: [tu] }) : null;
  if (id === 'racha') return r.mejorRacha > 0 ? carta({ tipo: 'racha', llama: true, etiqueta: 'Tu mejor racha', nombre: tu, cifra: { v: String(r.mejorRacha), t: pl(r.mejorRacha, 'semana completa', 'semanas completas seguidas') }, lineas: [`${r.semanasCompletas} ${pl(r.semanasCompletas, 'semana', 'semanas')} con todo lo previsto hecho`] }) : null;
  if (id === 'cardio') return r.cardio?.sesiones ? carta({ tipo: 'anio', icono: 'pasos', etiqueta: 'Cardio', nombre: tu, cifra: { v: String(r.cardio.minutos), t: 'minutos' }, lineas: [`${r.cardio.km ? `${num(r.cardio.km, 1)} km en ` : 'En '}${r.cardio.sesiones} ${pl(r.cardio.sesiones, 'sesión', 'sesiones')}`] }) : null;
  return null;
}

// Qué tarjetas de cada historia llevan el botón (las de entreno)
export const CARTAS = {
  sesion: ['hecho', 'records', 'musculos'],
  semana: ['portada', 'volumen', 'records', 'momento', 'musculos'],
  mes: ['portada', 'volumen', 'records', 'racha', 'calendario', 'cardio'],
  anio: ['portada', 'volumen', 'meses', 'records', 'progreso', 'racha', 'cardio'],
};
