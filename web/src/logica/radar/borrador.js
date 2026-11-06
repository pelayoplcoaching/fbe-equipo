// Radar de contacto: el borrador del mensaje. Lógica pura.
//
// Frases cortas, como escribe el coach: una o dos, sin emojis ni saludo de fórmula, con el dato concreto. Varias por
// motivo, para que no se repitan; ninguna depende del género de quien la recibe. El coach siempre lo edita antes de enviar.
import { cuandoFue } from './motivos.js';

const mayus = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// «de ayer», «de hoy», «del lunes»
const deCuando = (c) => (c.startsWith('el ') ? `del ${c.slice(3)}` : `de ${c}`);
// La marca de un récord sin la coletilla «(antes 72,4)»
const marca = (d) => String(d.texto || '').replace(/\s*\(antes[^)]*\)\s*$/, '').trim();
const sesiones = (n) => (n === 1 ? '1 sesión' : `${n} sesiones`);

// Cada motivo: una lista de funciones (datos, hoy) → frase (o null si con esos datos no encaja)
const FRASES = {
  molestia_fuerte: [
    (d) => `He visto la molestia que apuntaste en el check-in${d.zonas ? ` (${d.zonas.toLowerCase()})` : ''}. ¿Cómo sigue? Hasta que me digas, nada que la provoque`,
    (d) => `¿Cómo va esa molestia${d.zonas ? ` (${d.zonas.toLowerCase()})` : ''}? Cuéntame cuándo la notas y adapto la semana`,
    () => 'Vi lo del check-in. Antes de la próxima sesión dime cómo estás y vemos qué cambiamos',
  ],
  molestia: [
    (d) => `Vi lo que apuntaste en el check-in${d.zonas ? ` (${d.zonas.toLowerCase()})` : ''}. ¿Cómo sigue?`,
    (d) => `¿Cómo va esa molestia${d.zonas ? ` (${d.zonas.toLowerCase()})` : ''}? Si sigue igual, adaptamos los ejercicios`,
    (d) => `Cuéntame cómo notas la molestia${d.zonas ? ` (${d.zonas.toLowerCase()})` : ''} entrenando y vemos qué cambiar`,
  ],
  dia_malo: [
    (d, hoy) => `${mayus(cuandoFue(d.fecha, hoy))} apuntaste que ${d.que}. ¿Cómo ${d.fecha === hoy ? 'ha ido' : 'estás hoy'}?`,
    (d, hoy) => `Vi que ${cuandoFue(d.fecha, hoy)} no llegaste en tu mejor día a ${d.sesion}. ¿Qué tal ${d.fecha === hoy ? 'ha ido' : 'estás'}?`,
    (d, hoy) => `¿Qué tal la sesión ${deCuando(cuandoFue(d.fecha, hoy))}? Vi que ${d.que}`,
  ],
  parado: [
    (d) => (d.dias == null ? '¿Has podido empezar ya? Si tienes cualquier duda con la app o con el programa, dime' : `Llevas ${d.dias} días sin apuntar nada. ¿Todo bien?`),
    (d) => (d.dias == null ? 'Todavía no veo ninguna sesión tuya apuntada. ¿Te ayudo con algo para arrancar?' : `¿Qué tal vas? Hace ${d.dias} días que no veo sesiones tuyas`),
    (d) => (d.dias == null ? '¿Cómo vas para empezar? Si algo del programa no te cuadra, lo cambiamos' : `${d.dias} días sin registrar. Si se te ha complicado la semana, dime y la ajustamos`),
  ],
  pendientes: [
    (d) => `Llevas ${d.hechas} de ${sesiones(d.total)} esta semana. ¿Cómo lo ves para lo que queda?`,
    () => '¿Qué tal la semana? Si no te da tiempo a todas las sesiones, dime cuáles priorizamos',
    (d) => `${d.faltan === 1 ? 'Te queda 1 sesión' : `Te quedan ${d.faltan} sesiones`} esta semana. Si vas justo de tiempo, lo reorganizamos`,
  ],
  cumplimiento: [
    () => 'Estas semanas te estás dejando series de lo pautado. ¿Se te hace larga la sesión o es falta de tiempo?',
    () => 'Veo que no te da para todo lo pautado. ¿Recortamos algo para que salga completo?',
  ],
  sin_checkin: [
    () => 'No me ha llegado tu check-in de la semana pasada. Cuando puedas, mándamelo y lo miro',
    () => '¿Me mandas el check-in cuando tengas un rato? Así ajusto la semana con datos',
  ],
  record: [
    (d) => `Récord en ${d.ejercicio}${marca(d) ? `: ${marca(d)}` : ''}. Buen trabajo`,
    (d) => `He visto el récord en ${d.ejercicio}${marca(d) ? ` (${marca(d)})` : ''}. ¿Qué tal lo sentiste?`,
    (d) => `Récord en ${d.ejercicio}. Eso es progreso`,
  ],
  semana_completa: [
    (d) => (d.total > 1 ? `Semana completa, ${d.total} de ${d.total}. Buen trabajo` : 'Semana completa. Buen trabajo'),
    (d) => (d.total > 1 ? `Las ${d.total} sesiones hechas. ¿Cómo te has visto esta semana?` : 'Sesión de la semana hecha. ¿Cómo te has visto?'),
    () => 'Has cerrado la semana entera. Así da gusto',
  ],
  racha: [
    (d) => `${d.semanas} semanas seguidas completas. Esa constancia es la que da resultados`,
    (d) => `Llevas ${d.semanas} semanas sin fallar una sesión. Muy buen trabajo`,
  ],
  saludo: [
    (d, hoy) => (d.nutricion ? '¿Qué tal llevas el plan esta semana?' : d.sesion ? `¿Qué tal fue ${d.sesion} ${cuandoFue(d.fecha, hoy)}?` : '¿Cómo va la semana?'),
    (d) => (d.nutricion ? '¿Cómo vas con las comidas? ¿Algo que se te esté haciendo cuesta arriba?' : '¿Qué tal vas con el programa? ¿Algo que quieras ajustar?'),
    (d) => (d.nutricion ? '¿Qué tal de hambre y de energía estos días?' : d.sesion ? '¿Cómo te está sentando la semana?' : '¿Cómo te encuentras estos días?'),
  ],
};
// El día flojo se dice igual que el difícil
FRASES.dia_flojo = FRASES.dia_malo;

export const MAX_BORRADOR = 600;
export const cuantasFrases = (motivo) => (FRASES[motivo?.id] || FRASES.saludo).length;

// Un número estable para (atleta, día): con qué frase empieza cada uno (que no les llegue a todos la misma)
export function varianteInicial(atletaId, hoy) {
  let h = 0;
  for (const ch of `${atletaId}|${hoy}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// El borrador para un motivo. variante: cualquier entero (se reparte entre las frases de ese motivo)
export function borradorDe(motivo, { hoy, variante = 0 } = {}) {
  const lista = FRASES[motivo?.id] || FRASES.saludo;
  const n = lista.length, i = ((Math.trunc(variante) % n) + n) % n;
  const t = lista[i](motivo?.datos || {}, hoy) || lista[0](motivo?.datos || {}, hoy) || '';
  return String(t).slice(0, MAX_BORRADOR);
}
