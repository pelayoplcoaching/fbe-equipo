// v0.68: la bienvenida personalizada al abrir la app (una vez al día). Lo puro: qué dice y cuándo sale.
import { diasEntre } from './fechas.js';

// El nombre de pila (lo primero del nombre), sin espacios de más
export const nombreDePila = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || '';

// ¿Sale hoy? Una vez al día (la primera vez que se abre la app ese día, por la fecha de Madrid), nunca con una sesión a medias
// (entonces se va directo a ella) y nunca si no se sabe la fecha
export function tocaBienvenida({ vista = null, hoy, sesionEnCurso = false }) {
  if (!hoy || sesionEnCurso) return false;
  return vista !== hoy;
}

// Qué dice. Para el atleta: { saludo, nombre, mensaje, detalle? }, según cómo va:
//   · si aún no ha entrenado nunca: que su primera sesión le espera (la bienvenida de su primer día es la de siempre);
//   · si viene de un récord (de ayer o anteayer): el récord;
//   · 7 días o más sin entrenar (o más de 11 semanas: haceMucho): «¿Retomamos hoy?»; de 4 a 6: un empujón suave;
//   · si hoy toca sesión: cuál (y la racha si la hay);
//   · si hoy es descanso o ya la ha hecho: eso;
//   · si no, lo de siempre.
// Para el coach: «Valar morghulis, coach supremo» (lo pidió Pelayo).
export function mensajeBienvenida({ rol = 'atleta', nombre = '', primeraVez = false, ultimoDia = null, hoy, toca = null, estado = null, racha = 0, record = null, haceMucho = false } = {}) {
  const pila = nombreDePila(nombre);
  if (rol === 'coach') return { saludo: 'Valar morghulis,', nombre: 'coach supremo', mensaje: 'Tus atletas te esperan.' };
  if (primeraVez) return { saludo: 'Hola,', nombre: pila, mensaje: toca ? `Tu primera sesión te espera: ${toca}.` : 'Aquí verás cada día lo que te toca. Empezamos cuando quieras.' };
  const saludo = 'Hola de nuevo,';
  const dias = ultimoDia && hoy ? diasEntre(ultimoDia, hoy) : null;
  const conRacha = racha >= 2 ? `Llevas ${racha} semanas completas seguidas.` : null;
  if (record?.ejercicio && record.fecha && hoy && diasEntre(record.fecha, hoy) >= 0 && diasEntre(record.fecha, hoy) <= 2) {
    return { saludo, nombre: pila, mensaje: `Vienes de un récord en ${record.ejercicio}. ¡A por más!`, detalle: toca ? `Hoy toca ${toca}.` : null };
  }
  if (haceMucho && dias == null) return { saludo, nombre: pila, mensaje: 'Hace tiempo de tu último entreno. ¿Retomamos hoy?', detalle: toca ? `Te espera ${toca}.` : null };
  if (dias != null && dias >= 7) return { saludo, nombre: pila, mensaje: `Llevas ${dias} días sin entrenar. ¿Retomamos hoy?`, detalle: toca ? `Te espera ${toca}.` : null };
  if (dias != null && dias >= 4) return { saludo, nombre: pila, mensaje: `Hace ${dias} días de tu último entreno: hoy es buen día para volver.`, detalle: toca ? `Te espera ${toca}.` : null };
  if (estado === 'hecha') return { saludo, nombre: pila, mensaje: 'La sesión de hoy ya está hecha. ¡Buen trabajo!', detalle: conRacha };
  if (estado === 'descanso') return { saludo, nombre: pila, mensaje: 'Hoy toca descanso: recupera bien.', detalle: conRacha };
  if (estado === 'semana') return { saludo, nombre: pila, mensaje: 'Semana completa. ¡Enhorabuena!', detalle: conRacha };
  if (toca) return { saludo, nombre: pila, mensaje: `Hoy toca ${toca}.`, detalle: conRacha };
  return { saludo, nombre: pila, mensaje: conRacha || '¿Qué toca hoy?' };
}
