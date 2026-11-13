// La familia sonora de FBE (sonido, tanda 1): todos los sonidos de la app salen de aquí, con un mismo timbre y una misma
// escala (pentatónica de mi mayor) y un motivo propio de tres notas (mi, si y mi una octava arriba). Aquí solo está qué
// suena (las notas) y cuándo puede sonar (los ajustes): se toca en ui/sonido.js. Sin archivos de audio.

// La escala: mi, fa#, sol#, si, do# (y sus octavas). nota(0) = mi5
const PENTA = [0, 2, 4, 7, 9];
export const MI5 = 659.25;
export function nota(i) {
  const k = Math.round(i), o = Math.floor(k / 5), g = ((k % 5) + 5) % 5;
  return Math.round(MI5 * 2 ** ((PENTA[g] + 12 * o) / 12) * 100) / 100;
}
// El motivo: mi5, si5, mi6
export const MOTIVO = [nota(0), nota(3), nota(5)];

// Cada cosa que suena: su apartado (con su volumen) y sus notas [frecuencia, empieza (s), dura (s), volumen 0–1].
// Las que dependen de algo (la serie que es, el nivel del logro…) son funciones.
// Apartados: entreno, chat, avisos (logros, comunidad y la interfaz) y juego (el juego tiene sus sonidos, en su motor)
export const SONIDOS = {
  // Las series suben de nota: la n del ejercicio, un escalón más; la última «resuelve» en el mi de arriba
  serie: { apartado: 'entreno', notas: ({ n = 1, total = 0 } = {}) => {
    const i = Math.max(0, Math.min(7, n - 1)), f = nota(i);
    return n >= total && total > 0 ? [[f, 0, 0.09, 0.8], [nota(Math.max(5, i + 2)), 0.09, 0.32, 0.9]] : [[f, 0, 0.11, 0.8]];
  } },
  ejercicio: { apartado: 'entreno', notas: () => [[nota(3), 0, 0.08, 0.7], [nota(0), 0.08, 0.08, 0.6], [nota(5), 0.16, 0.2, 0.8]] },
  'record-peso': { apartado: 'entreno', notas: () => [[nota(0), 0, 0.12, 0.8], [nota(2), 0.11, 0.12, 0.8], [nota(3), 0.22, 0.12, 0.85], [nota(5), 0.33, 0.6, 1]] },
  'record-reps': { apartado: 'entreno', notas: () => [[nota(3), 0, 0.08, 0.8], [nota(3), 0.1, 0.08, 0.8], [nota(4), 0.2, 0.1, 0.85], [nota(5), 0.32, 0.55, 1]] },
  mitad: { apartado: 'entreno', notas: () => [[nota(-2), 0, 0.3, 0.55]] },
  diez: { apartado: 'entreno', notas: () => [[nota(-2), 0, 0.14, 0.6], [nota(0), 0.16, 0.24, 0.65]] },
  // La cuenta atrás que sube: a los 5, 4, 3, 2 y 1 segundos, cada vez más aguda
  cuenta: { apartado: 'entreno', notas: ({ segundo = 3 } = {}) => [[nota(Math.max(0, 5 - segundo)), 0, 0.1, 0.75 + (5 - segundo) * 0.05]] },
  'fin-sesion': { apartado: 'entreno', notas: ({ adorno = false } = {}) => [
    [nota(0), 0, 0.16, 0.8], [nota(2), 0.09, 0.16, 0.8], [nota(3), 0.18, 0.16, 0.85], [nota(5), 0.27, 0.7, 1],
    ...(adorno ? [[nota(10), 0.5, 0.12, 0.4], [nota(13), 0.6, 0.12, 0.4], [nota(15), 0.7, 0.4, 0.45]] : []),
  ] },
  'mas-15': { apartado: 'entreno', notas: () => [[nota(3), 0, 0.06, 0.55], [nota(5), 0.06, 0.1, 0.6]] },
  'menos-15': { apartado: 'entreno', notas: () => [[nota(5), 0, 0.06, 0.55], [nota(3), 0.06, 0.1, 0.6]] },
  pausa: { apartado: 'entreno', notas: () => [[nota(0), 0, 0.1, 0.5], [nota(-2), 0.1, 0.18, 0.5]] },
  sigue: { apartado: 'entreno', notas: () => [[nota(-2), 0, 0.1, 0.5], [nota(0), 0.1, 0.18, 0.55]] },
  // El aviso del final del descanso propio de FBE: el motivo, dos veces
  'fin-descanso': { apartado: 'entreno', notas: () => [...MOTIVO.map((f, i) => [f, i * 0.12, i === 2 ? 0.3 : 0.11, 1]), ...MOTIVO.map((f, i) => [f, 0.5 + i * 0.12, i === 2 ? 0.5 : 0.11, 1])] },
  'grabar-cuenta': { apartado: 'entreno', notas: () => [[nota(3), 0, 0.08, 0.7]] },
  'grabar-empieza': { apartado: 'entreno', notas: () => [[nota(5), 0, 0.28, 0.9]] },
  'grabar-acaba': { apartado: 'entreno', notas: () => [[nota(5), 0, 0.1, 0.8], [nota(3), 0.1, 0.22, 0.75]] },
  // La respiración: un soplo (ruido filtrado) que sube al inspirar o baja al espirar, lo que dure esa fase
  'respira-dentro': { apartado: 'entreno', soplo: 'sube' },
  'respira-fuera': { apartado: 'entreno', soplo: 'baja' },
  // Fuera de la sesión
  ui: { apartado: 'avisos', interfaz: true, notas: () => [[nota(8), 0, 0.035, 0.35]] },
  logro: { apartado: 'avisos', notas: ({ nivel = 0 } = {}) => {
    const n = Math.max(0, Math.min(3, nivel));
    return [...MOTIVO.slice(0, 2 + (n > 0 ? 1 : 0)).map((f, i) => [f, i * 0.12, 0.14, 0.8]), ...(n >= 2 ? [[nota(7), 0.38, 0.14, 0.7]] : []), ...(n >= 3 ? [[nota(10), 0.5, 0.5, 0.75]] : [[MOTIVO[2], 0.36, 0.4, 0.8]])];
  } },
  animo: { apartado: 'avisos', notas: () => [[nota(2), 0, 0.1, 0.7], [nota(3), 0.1, 0.24, 0.75]] },
  reto: { apartado: 'avisos', notas: () => [...MOTIVO.map((f, i) => [f, i * 0.1, 0.12, 0.85]), [nota(7), 0.32, 0.5, 0.8], [nota(5), 0.32, 0.5, 0.6]] },
  // El chat: los dos de siempre, con el timbre de la familia, y uno propio para los mensajes del coach
  enviado: { apartado: 'chat', notas: () => [[nota(0) * 4 / 3, 0, 0.07, 0.55], [nota(3) * 4 / 3, 0.06, 0.09, 0.6]] },
  recibido: { apartado: 'chat', notas: () => [[nota(5) * 0.8, 0, 0.09, 0.7], [nota(3) * 0.8, 0.08, 0.14, 0.65]] },
  // (sonido 2) el «no» (algo no se puede), la tecla del teclado de la app, el RPE, la aproximación (más suave), el paso de
  // superserie, «¿Seguimos?», la progresión, los hitos, la nota de voz del chat (empezar y acabar) y los avisos del coach
  no: { apartado: 'avisos', interfaz: true, notas: () => [[nota(1) * 0.75, 0, 0.07, 0.5], [nota(-1) * 0.75, 0.08, 0.12, 0.45]] },
  // (sonido 2) una nota suelta de la familia (el metrónomo y los intervalos): { f, v, dura }
  nota: { apartado: 'entreno', notas: ({ f = nota(0), v = 0.7, dura = 0.1 } = {}) => [[f, 0, dura, v]] },
  tecla: { apartado: 'entreno', tecla: true, notas: () => [[nota(10), 0, 0.018, 0.22]] },
  rpe: { apartado: 'entreno', notas: ({ f = nota(0) } = {}) => [[f, 0, 0.12, 0.6]] },
  aproximacion: { apartado: 'entreno', notas: ({ n = 1 } = {}) => [[nota(Math.max(-3, Math.min(2, n - 3))), 0, 0.08, 0.4]] },
  superserie: { apartado: 'entreno', notas: () => [[nota(2), 0, 0.06, 0.6], [nota(5), 0.06, 0.06, 0.6], [nota(7), 0.12, 0.12, 0.65]] },
  seguimos: { apartado: 'entreno', notas: () => [[nota(3), 0, 0.12, 0.75], [nota(3), 0.2, 0.12, 0.75], [nota(5), 0.4, 0.3, 0.8]] },
  progresion: { apartado: 'entreno', notas: () => [[nota(3), 0, 0.1, 0.7], [nota(7), 0.1, 0.28, 0.8]] },
  hito: { apartado: 'avisos', notas: ({ tipo = 'racha' } = {}) => {
    const base = { racha: 0, aniversario: 2, bloque: 3 }[tipo] ?? 0;
    return [[nota(base), 0, 0.14, 0.8], [nota(base + 2), 0.12, 0.14, 0.8], [nota(base + 3), 0.24, 0.14, 0.85], [nota(base + 5), 0.36, 0.14, 0.9], [nota(base + 7), 0.48, 0.6, 1], [nota(base + 5), 0.48, 0.6, 0.6]];
  } },
  'nota-empieza': { apartado: 'chat', notas: () => [[nota(3), 0, 0.07, 0.6]] },
  'nota-acaba': { apartado: 'chat', notas: () => [[nota(5), 0, 0.06, 0.55], [nota(3), 0.06, 0.1, 0.5]] },
  'aviso-coach': { apartado: 'avisos', notas: () => [[MOTIVO[0], 0, 0.09, 0.75], [MOTIVO[2], 0.1, 0.09, 0.75], [MOTIVO[1], 0.2, 0.25, 0.75]] },
  coach: { apartado: 'chat', notas: () => [[MOTIVO[0], 0, 0.08, 0.8], [MOTIVO[1], 0.08, 0.08, 0.8], [MOTIVO[2], 0.16, 0.22, 0.85]] },
};

// Lo que suena en «Escuchar todos», en orden, con su nombre
export const ESCUCHAR = [
  ['serie', 'Las series (de la primera a la última)', [{ n: 1, total: 4 }, { n: 2, total: 4 }, { n: 3, total: 4 }, { n: 4, total: 4 }]],
  ['ejercicio', 'Cambio de ejercicio'], ['record-peso', 'Récord de peso'], ['record-reps', 'Récord de repeticiones'],
  ['mitad', 'Mitad del descanso'], ['diez', 'Quedan diez segundos'],
  ['cuenta', 'La cuenta atrás', [5, 4, 3, 2, 1].map((segundo) => ({ segundo }))],
  ['fin-descanso', 'Fin del descanso (FBE)'], ['mas-15', '+15 segundos'], ['menos-15', '−15 segundos'],
  ['fin-sesion', 'Fin de la sesión', [{ adorno: true }]], ['logro', 'Un logro', [{ nivel: 3 }]], ['animo', 'Un ánimo de la comunidad'],
  ['reto', 'Reto del equipo conseguido'], ['coach', 'Mensaje del coach'], ['ui', 'Al marcar algo como hecho'],
  // (sonido 2)
  ['aproximacion', 'Una serie de aproximación'], ['superserie', 'Superserie: al siguiente'], ['rpe', 'El esfuerzo (RPE 6 a 10)', [6, 7, 8, 9, 10].map((r) => ({ f: notaRpe(r) }))],
  ['progresion', 'La app propone subir carga'], ['seguimos', '¿Seguimos?'], ['hito', 'Un hito (la racha de semanas)'], ['aviso-coach', 'Un aviso del coach en la comunidad'], ['no', 'Algo no se puede'],
];

// ---------- Cuándo puede sonar ----------
export const APARTADOS = [['entreno', 'Entreno'], ['juego', 'Juego del descanso'], ['chat', 'Chat'], ['avisos', 'Logros y comunidad']];
export const VOLUMENES_DEFECTO = { entreno: 1, juego: 1, chat: 1, avisos: 1 };
const limitar = (v, d = 1) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);
export function limpiarVolumenes(v) {
  const o = v && typeof v === 'object' ? v : {};
  return Object.fromEntries(APARTADOS.map(([k]) => [k, limitar(o[k], 1)]));
}
// El volumen de un apartado: el general por el suyo
export const volumenDe = (a, apartado) => limitar(a?.volumen, 1) * limitar(a?.volumenes?.[apartado], 1);

// Qué deja sonar cada ajuste
export function puedeSonar(a, clave) {
  const s = SONIDOS[clave];
  if (!s || !a) return false;
  // (sonido 2) en el horario sin sonidos, nada del chat, los logros, la comunidad ni la interfaz
  if ((s.apartado === 'chat' || s.apartado === 'avisos') && enSilencio(a)) return false;
  if (s.apartado === 'chat') return a.sonidosChat !== false;
  if (s.apartado === 'avisos') return s.interfaz ? a.sonidosInterfaz === true : a.sonidosAvisos !== false;
  if (s.tecla) return a.sonidoTeclado === true;
  if (['rpe', 'aproximacion', 'superserie', 'progresion'].includes(clave)) return a.sonidoSerie !== false;
  if (clave === 'seguimos') return a.sonido !== false && a.avisoSeguimos !== false;
  if (['serie', 'ejercicio', 'fin-sesion'].includes(clave)) return a.sonidoSerie !== false;
  if (clave === 'mitad') return a.sonido !== false && a.avisoMitad === true;
  if (clave === 'diez') return a.sonido !== false && a.avisoDiez === true;
  if (clave === 'cuenta') return a.cuentaAtras !== false;
  if (clave.startsWith('respira')) return a.sonido !== false && a.respira === true && a.respiraSonido !== false;
  return a.sonido !== false;
}

// ---------- Los tres perfiles de un toque ----------
// Cada uno pone estos ajustes; «a tu manera» es cualquier otra combinación
export const PERFILES = {
  justo: { nombre: 'Solo lo justo', ayuda: 'El aviso del final del descanso y su cuenta atrás', ajustes: { sonido: true, cuentaAtras: true, sonidoSerie: false, sonidosChat: false, sonidosAvisos: false, sonidosInterfaz: false, avisoMitad: false, avisoDiez: false } },
  equilibrado: { nombre: 'Equilibrado', ayuda: 'Lo de la sesión, el chat y los logros', ajustes: { sonido: true, cuentaAtras: true, sonidoSerie: true, sonidosChat: true, sonidosAvisos: true, sonidosInterfaz: false, avisoMitad: false, avisoDiez: true } },
  todo: { nombre: 'Todo', ayuda: 'También a mitad del descanso y al marcar cosas', ajustes: { sonido: true, cuentaAtras: true, sonidoSerie: true, sonidosChat: true, sonidosAvisos: true, sonidosInterfaz: true, avisoMitad: true, avisoDiez: true } },
};
export function perfilDe(a) {
  for (const [k, p] of Object.entries(PERFILES)) if (Object.entries(p.ajustes).every(([c, v]) => (a?.[c] === true) === v)) return k;
  return null;
}

// ---------- Los avisos de dentro del descanso ----------
// ¿Toca el de la mitad (descansos de 40 s o más) o el de los diez segundos (de 30 s o más) en este segundo?
export function avisoDescanso(segundo, total) {
  if (!(total > 0) || !(segundo > 0)) return null;
  if (total >= 40 && segundo === Math.round(total / 2) && segundo > 12) return 'mitad';
  if (total >= 30 && segundo === 10) return 'diez';
  return null;
}
// «¿Cuánto queda?»: lo que dice la voz al tocar dos veces el reloj
export function fraseQueda(segundos) {
  const s = Math.max(0, Math.round(segundos));
  if (s <= 0) return 'Se acabó el descanso';
  const m = Math.floor(s / 60), r = s % 60;
  if (!m) return `Quedan ${r} segundos`;
  return `Queda${m > 1 ? 'n' : ''} ${m === 1 ? 'un minuto' : `${m} minutos`}${r ? ` y ${r} segundos` : ''}`;
}

// =====================================================================
// (sonido 2, tanda 4) La mezcla, el horario sin sonidos y lo nuevo de la segunda lista (claude/sonido-mejoras-2.md)
// =====================================================================
// Cuánto importa cada cosa: 3, lo que no se puede perder (el final del descanso, su cuenta, el récord); 2, la sesión; 1, el
// chat, los logros y la comunidad; 0, los toques de la interfaz. Nunca suenan dos a la vez: si suena algo más importante,
// lo de la sesión espera a que acabe y lo de menos se omite
const PRIORIDAD = { 'fin-descanso': 3, cuenta: 3, 'record-peso': 3, 'record-reps': 3, seguimos: 3, 'voz-coach': 3 };
export function prioridadDe(clave) {
  if (PRIORIDAD[clave] != null) return PRIORIDAD[clave];
  const s = SONIDOS[clave];
  if (!s) return 0;
  if (s.interfaz || clave === 'ui' || clave === 'no' || clave === 'tecla') return 0;
  return s.apartado === 'entreno' ? 2 : 1;
}
// ¿Suena ya, espera o se omite? estado: { hasta (s, en el reloj del audio), prioridad } de lo que está sonando
export function turno(estado, clave, ahora) {
  const p = prioridadDe(clave);
  if (!estado || !(estado.hasta > ahora) || p >= estado.prioridad) return { accion: 'ya', retraso: 0 };
  if (p >= 2) return { accion: 'espera', retraso: Math.min(1.5, estado.hasta - ahora) };
  return { accion: 'omite', retraso: 0 };
}
// Cuánto dura un sonido de la familia (s)
export function duracionDe(clave, datos = {}) {
  const s = SONIDOS[clave];
  if (!s) return 0;
  if (s.soplo) return Math.max(1, Math.min(8, datos.dura || 4));
  return Math.max(0, ...s.notas(datos).map(([, d, dura]) => d + dura));
}

// El horario sin sonidos: de silencioDesde a silencioHasta («HH:MM»; puede cruzar la medianoche), sin chat, logros,
// comunidad ni interfaz. Lo del entreno sigue sonando
const aMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m && +m[1] <= 23 && +m[2] <= 59 ? +m[1] * 60 + +m[2] : null; };
export function enSilencio(a, fecha = new Date()) {
  if (!a?.silencioActivo) return false;
  const d = aMin(a.silencioDesde), h = aMin(a.silencioHasta);
  if (d == null || h == null || d === h) return false;
  const m = fecha.getHours() * 60 + fecha.getMinutes();
  return d < h ? m >= d && m < h : m >= d || m < h;
}
export const horaValida = (x) => aMin(x) != null;

// ---------- (tanda 5) En el entreno ----------
// El RPE suena: de 6 (grave) a 10 (agudo), medio escalón por cada medio punto
export function notaRpe(rpe) { const r = Number(rpe); return Number.isFinite(r) && r >= 6 ? nota(Math.round((Math.min(10, r) - 6) * 2) - 1) : null; }
// «¿Seguimos?»: si el descanso acabó hace un rato y no se ha marcado la serie, un recordatorio (a los 60 s y a los 180 s)
export const SEGUIMOS = [60, 180];
export function tocaSeguimos(segundosDesdeFin, avisados = 0) {
  if (!(segundosDesdeFin >= 0)) return false;
  return avisados < SEGUIMOS.length && segundosDesdeFin >= SEGUIMOS[avisados];
}
// El metrónomo y los intervalos con la familia: en cada fase del tempo, su nota (bajar, pausa, subir, arriba), con
// acento en el primer segundo de la fase; los intervalos, trabajo / descanso / el último
export function notaTempo(fase, primero) { return { f: nota([0, 2, 5, 3][fase] ?? 0) * (fase === 0 ? 0.5 : 1), v: primero ? 1 : 0.6, dura: primero ? 0.12 : 0.07 }; }

// ---------- (tanda 7) Escuchar tu progreso ----------
// La línea de un valor por semana (el 1RM estimado) hecha melodía: cada punto, una nota de la escala según dónde cae entre
// el mínimo y el máximo (dos octavas), con su duración. [{ f, d, dura }]
export function melodiaDe(valores, { paso = 0.22, dura = 0.2 } = {}) {
  const v = (valores || []).map(Number).filter((x) => Number.isFinite(x));
  if (v.length < 2) return [];
  const min = Math.min(...v), max = Math.max(...v), rango = max - min || 1;
  return v.slice(-16).map((x, i) => ({ f: nota(Math.round(((x - min) / rango) * 10) - 2), d: i * paso, dura }));
}
