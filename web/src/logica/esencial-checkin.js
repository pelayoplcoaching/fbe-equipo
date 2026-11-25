// FBE Esencial (sin coach, 16 y 17): lo que pasa con el check-in de quien va por su cuenta (nadie se lo contesta uno a uno)
// y qué hacer con una molestia moderada o grave. Lógica pura. Lo del dolor, con las mismas reglas y palabras que el
// «Semáforo del dolor» de la web (modelo de control del dolor de Thomeé 1997 y Silbernagel 2007): hasta 5 sobre 10
// durante y después, como antes de entrenar a la mañana siguiente y sin ir a más de una semana a otra.
import { WEB_FBE } from './esencial.js';
import { NOMBRE_ZONA } from './calculos.js';

export const URL_SEMAFORO = `${WEB_FBE}/semaforo-dolor.html`;
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
      'La regla para seguir: hasta 5 sobre 10 durante y después del ejercicio, que a la mañana siguiente estés como antes de entrenar y que no vaya a más de una semana a otra.',
      'Si sigue sin mejorar, consúltalo con un fisioterapeuta o con tu médico.',
    ],
    consulta: 'Consulta antes de seguir si el dolor te despierta por la noche o no cede en reposo, si hay hinchazón, calor o enrojecimiento, si empezó con un golpe, una caída o un chasquido, o si notas hormigueo, adormecimiento o pérdida de fuerza.',
  };
}

// f: sus respuestas (energia y recuperacion, de 1 a 5); molestias: { zona: 0-3 } → [{ id, icono, texto }]: dónde queda
// el check-in y lo que la app hace con él (el motor no añade series con la energía o la recuperación en 2 o menos)
export function trasElCheckin({ f = {}, molestias = {}, nombres = NOMBRE_ZONA } = {}) {
  const lineas = [{ id: 'progreso', icono: 'progreso', texto: 'Queda en tu progreso: ahí ves tu peso, tu sueño y tu energía de una semana a otra.' }];
  if (bajo(f?.energia) || bajo(f?.recuperacion)) {
    lineas.push({ id: 'bajo', icono: 'reloj', texto: 'Vas con la energía o la recuperación bajas: la app lo tiene en cuenta al preparar tu semana y no te añade series. Antes de cada sesión, dilo en «¿Cómo llegas hoy?» y te da un consejo para ese día.' });
  } else {
    lineas.push({ id: 'semana', icono: 'calendario', texto: 'La app lo tiene en cuenta al preparar tu semana, junto con lo que apuntas en cada sesión.' });
  }
  const m = queHacerConMolestia(molestias, nombres);
  if (m) lineas.push({ id: 'molestia', icono: 'alerta', texto: `Has marcado una molestia ${m.nivel} en ${m.zonas}: a Pelayo le sale como aviso. Abajo tienes qué hacer mientras tanto.` });
  lineas.push({ id: 'nadie', icono: 'mensaje', texto: 'Nadie te lo contesta uno a uno: FBE Esencial va sin seguimiento personal.' });
  return lineas;
}
