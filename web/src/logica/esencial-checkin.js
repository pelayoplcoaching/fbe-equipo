// FBE Esencial (sin coach, 16 y 17): lo que pasa con el check-in de quien va por su cuenta (nadie se lo contesta uno a uno)
// y qué hacer con una molestia moderada o grave. Lógica pura. Lo del dolor, con las reglas del «Semáforo del dolor» de la
// web (modelo de control del dolor de Thomeé 1997 y Silbernagel 2007: durante y después, como antes de entrenar a la
// mañana siguiente y sin ir a más de una semana a otra), con el margen de Pelayo (v0.256, P3): la web explica el modelo
// (hasta 5 sobre 10); la app va con margen, hasta 3.
import { WEB_FBE } from './esencial.js';
import { NOMBRE_ZONA } from './calculos.js';
// (v0.256) el motor de molestias: la regla con el margen de Pelayo (hasta 3 sobre 10), el semáforo y las señales para parar
import { REGLA, QUE_HACER, SENALES, MARGEN, semaforo } from './dolor.js';

export const URL_SEMAFORO = `${WEB_FBE}/semaforo-dolor.html`;
// (v0.246, 33) El check-in de quien va por su cuenta, más corto: lo que la app usa (su peso, el descanso y las molestias; y la
// alimentación, si lleva nutrición). Sin las medidas ni los datos del reloj, que no lee nadie.
export const APARTADOS_SUYO = ['peso', 'descanso', 'molestias', 'alimentacion'];
const NIVEL = ['', 'leve', 'moderada', 'grave'];
const bajo = (v) => Number(v) >= 1 && Number(v) <= 2;
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// Las molestias moderadas (2) o graves (3) del check-in: { zona: 0-3 } → null o
// { grave, nivel: 'moderada' | 'grave', zonas: 'rodilla y hombro', titulo, pasos: [texto], consulta: texto }
export function queHacerConMolestia(molestias = {}, nombres = NOMBRE_ZONA) {
  const fuertes = Object.entries(molestias || {}).filter(([, v]) => Number(v) >= 2);
  if (!fuertes.length) return null;
  const grave = fuertes.some(([, v]) => Number(v) >= 3);
  const zonas = unir(fuertes.map(([z]) => String(nombres[z] || z).toLowerCase()));
  const cambiar = 'en la sesión, toca «Más» en ese ejercicio y «Cambiar»: te ofrece una alternativa';
  return {
    grave, nivel: NIVEL[grave ? 3 : 2], zonas,
    titulo: grave ? 'Con una molestia grave: que te la vean antes de seguir' : 'Con una molestia moderada: baja la carga, no pares del todo',
    pasos: grave ? [
      'Conviene que te la valore un médico o un fisioterapeuta antes de seguir cargando esa zona.',
      `Mientras tanto, entrena lo que no moleste: ${cambiar}.`,
    ] : [
      `En el ejercicio que moleste, baja la carga (menos peso, menos series o menos recorrido) o cámbialo: ${cambiar}.`,
      REGLA,
      'Si sigue sin mejorar, consúltalo con un fisioterapeuta o con tu médico.',
    ],
    consulta: CONSULTA,
  };
}
// (v0.256, M9) Las señales para parar y consultar ya, en una frase (las mismas de «Me duele algo»)
const ts = SENALES.map(([, t]) => t.toLowerCase());
export const CONSULTA = `Para y consulta ya, sin esperar, si tienes ${ts.slice(0, -1).join(', ')}, o ${ts[ts.length - 1]}.`;

// (v0.256, 109) Las molestias de 0 a 10 de quien va por su cuenta ({ zona: valor }): con alguna en ámbar o en rojo → null o
// { grave, nivel, zonas, titulo, pasos, consulta } (la misma forma que queHacerConMolestia), con el color más alto
export function queHacerDolor(valores = {}, nombres = NOMBRE_ZONA) {
  const fuertes = Object.entries(valores || {}).filter(([, v]) => ['ambar', 'rojo'].includes(semaforo(v)) && Number(v) > 0);
  if (!fuertes.length) return null;
  const rojo = fuertes.some(([, v]) => semaforo(v) === 'rojo');
  const q = QUE_HACER[rojo ? 'rojo' : 'ambar'];
  return { grave: rojo, nivel: rojo ? 'grave' : 'moderada', zonas: unir(fuertes.map(([z]) => String(nombres[z] || z).toLowerCase())), titulo: q.titulo, pasos: q.pasos, consulta: CONSULTA };
}

// f: sus respuestas (energia y recuperacion, de 1 a 5); molestias: { zona: 0-3 } → [{ id, icono, texto }]: dónde queda
// el check-in y lo que la app hace con él (el motor no añade series con la energía o la recuperación en 2 o menos).
// (v0.256) valores: las de 0 a 10 ({ zona: valor }), si las apuntó así
export function trasElCheckin({ f = {}, molestias = {}, valores = null, nombres = NOMBRE_ZONA } = {}) {
  const lineas = [{ id: 'progreso', icono: 'progreso', texto: 'Queda en tu progreso: ahí ves tu peso, tu sueño y tu energía de una semana a otra.' }];
  if (bajo(f?.energia) || bajo(f?.recuperacion)) {
    lineas.push({ id: 'bajo', icono: 'reloj', texto: 'Vas con la energía o la recuperación bajas: la app lo tiene en cuenta al preparar tu semana y no te añade series. Antes de cada sesión, dilo en «¿Cómo llegas hoy?» y te da un consejo para ese día.' });
  } else {
    lineas.push({ id: 'semana', icono: 'calendario', texto: 'La app lo tiene en cuenta al preparar tu semana, junto con lo que apuntas en cada sesión.' });
  }
  const v = valores ? queHacerDolor(valores, nombres) : null;
  const m = valores ? null : queHacerConMolestia(molestias, nombres);
  if (v) {
    const fuertes = Object.values(valores).filter((x) => Number(x) >= MARGEN);
    lineas.push({ id: 'molestia', icono: 'alerta', texto: `${fuertes.length === 1 ? `Has marcado una molestia de ${fuertes[0]} sobre 10` : `Has marcado molestias de ${MARGEN} o más sobre 10`} en ${v.zonas}: a Pelayo le sale como aviso. Abajo tienes qué hacer mientras tanto.` });
  }
  if (m) lineas.push({ id: 'molestia', icono: 'alerta', texto: `Has marcado una molestia ${m.nivel} en ${m.zonas}: a Pelayo le sale como aviso. Abajo tienes qué hacer mientras tanto.` });
  lineas.push({ id: 'nadie', icono: 'mensaje', texto: 'Nadie te lo contesta uno a uno: FBE Esencial va sin seguimiento personal.' });
  return lineas;
}
