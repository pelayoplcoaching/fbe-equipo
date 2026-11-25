// FBE Esencial: la plantilla «Primeras 4 semanas», la misma de la guía del vídeo del 3/1/2027 (sirve para la demo y para el
// SQL de la base; aparte de esencial.js para que no vaya en lo que la app carga al abrir).
import { NOMBRE_PRIMERAS_4 } from './esencial.js';

// ---------- La plantilla «Primeras 4 semanas» (la guía del vídeo del 3/1/2027) ----------
// Dos días por semana que no vayan seguidos, la misma sesión las cuatro semanas. Lo que cambia es cuánto haces
// (series) y cuánto aprietas (te sobran). La plancha va por tiempo: 20-30 s la primera semana y 5 s más cada semana
// (decisión de Pelayo del 24/11). Repeticiones: 10-12 las cuatro semanas.
export const PRIMERAS_4 = {
  nombre: NOMBRE_PRIMERAS_4,
  objetivo: 'Aprender los cinco ejercicios y llegar a febrero',
  descripcion: 'La guía del vídeo: dos días por semana que no vayan seguidos y la misma sesión las cuatro semanas. En la cuarta, tus marcas: el punto de partida para todo lo que venga.',
  foco: 'adaptacion',
  sesiones: ['Día 1', 'Día 2'],
  ejercicios: [
    { nombre: 'Prensa de piernas', alternativa: 'Sentadilla a un banco', nota: 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.' },
    { nombre: 'Peso muerto rumano con mancuernas', alternativa: 'Puente de glúteo', nota: 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.' },
    { nombre: 'Press de pecho en máquina', alternativa: 'Flexiones', nota: 'O flexiones, con más o menos inclinación según tu nivel.' },
    { nombre: 'Jalón al pecho', alternativa: 'Remo en máquina', nota: 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.' },
    // (el curl conserva «con mancuernas»: sin esa palabra, la app le pondría discos de barra y saltos de 2,5 kg a todos)
    { nombre: 'Plancha abdominal', alternativa: 'Curl de bíceps con mancuernas', porTiempo: true, nota: 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.' },
  ],
  semanas: [
    { numero: 1, series: [1, 1, 1, 1, 1], rir: 4.5, descanso: null, plancha: [20, 30],
      nota: 'Una serie de cada ejercicio, de diez a doce repeticiones. Aprender el gesto y salir con ganas de volver. Media hora y a casa. El primer día empieza con poco peso: haz doce repeticiones y pregúntate cuántas más habrías podido hacer; buscas el peso con el que te sobren cuatro o cinco.' },
    { numero: 2, series: [2, 2, 2, 2, 2], rir: 3, descanso: 90, plancha: [25, 35],
      nota: 'Dos series de cada ejercicio. Entre una serie y otra, descansa lo que necesites para repetirla bien: uno o dos minutos.' },
    { numero: 3, series: [2, 2, 2, 2, 2], rir: 2, descanso: 90, plancha: [30, 40],
      nota: 'Dos series, con un poco más de peso. Tu primera subida de carga.' },
    { numero: 4, series: [3, 3, 2, 2, 2], rir: 2, descanso: 90, plancha: [35, 45], marcas: true,
      nota: 'Tres series en los dos primeros ejercicios y dos en el resto. Apuntas tus marcas: el peso y las repeticiones de cada ejercicio. Tres cuartos de hora.' },
  ],
  reps: [10, 12],
};

// ---------- Desde la semana 5: «Novato 2 días · FBE Esencial» (propuesta del 24/11, pendiente de Pelayo) ----------
// Los mismos cinco ejercicios con sus alternativas y los dos días iguales, como en la guía. Una semana: la app la repite y
// la hace progresar cada semana con el motor por su cuenta (los cuatro frenos), con los kilos de partida de sus marcas de
// la semana 4. Tres series en los cuatro primeros, te sobran 2 y descanso de 90 s; la plancha, 2 × 40-50 s (la semana 4
// acabó en 35-45). Foco de adaptación, como la full body de dos días de máquinas y mancuernas (la B).
export const NOMBRE_NOVATO_2 = 'Novato 2 días · FBE Esencial';
export const NOVATO_2 = {
  nombre: NOMBRE_NOVATO_2,
  objetivo: 'Ganar fuerza con los cinco ejercicios',
  descripcion: 'Desde la semana 5: los mismos cinco ejercicios, dos días por semana que no vayan seguidos. Cada semana, la app te prepara la siguiente a partir de lo que apuntas, con las reglas de progresión de Pelayo.',
  foco: 'adaptacion',
  sesiones: PRIMERAS_4.sesiones,
  ejercicios: PRIMERAS_4.ejercicios,
  semanas: [
    { numero: 1, series: [3, 3, 3, 3, 2], rir: 2, descanso: 90, plancha: [40, 50],
      nota: 'Tu plan desde ahora: los mismos cinco ejercicios, tres series en los cuatro primeros. Empiezas con los kilos de tus marcas; cada semana, la app te prepara la siguiente con lo que apuntas.' },
  ],
  reps: [10, 12],
};

// ---------- Si lo pide desde la semana 5: «Novato 3 días · FBE Esencial» (Pelayo, 25/11: «crea la plantilla de novato de
// 3 días») ----------
// Tres días que no vayan seguidos: los días 1 y 3, los cinco ejercicios de siempre (como «Novato 2 días»); el día 2, sus
// alternativas (las de la guía), para que cada zona tenga dos ejercicios distintos y no dependa de una sola máquina (su
// guía de los dos días). 3 × 10-12, te sobran 2 y 90 s; la plancha y el curl, 2 series. La app la repite y la hace progresar
// cada semana; al cambiar, la base pone los kilos que llevaba en cada ejercicio (el día de alternativas, sin kilos: busca
// el peso con el que te sobren 2).
export const NOMBRE_NOVATO_3 = 'Novato 3 días · FBE Esencial';
export const NOVATO_3 = {
  nombre: NOMBRE_NOVATO_3,
  objetivo: 'Ganar fuerza con tres días por semana',
  descripcion: 'Desde la semana 5, si quieres un tercer día: tres días por semana que no vayan seguidos. Los días 1 y 3, los cinco ejercicios de siempre; el día 2, sus alternativas. Cada semana, la app te prepara la siguiente a partir de lo que apuntas, con las reglas de progresión de Pelayo.',
  foco: 'adaptacion',
  nota: 'Tu plan pasa a tres días: los días 1 y 3, la sesión de siempre, con los kilos que llevabas; el día 2, sus alternativas: busca el peso con el que te sobren 2. Que no vayan seguidos.',
  sesiones: [
    { nombre: 'Día 1', ejercicios: PRIMERAS_4.ejercicios.map((e) => ({ nombre: e.nombre, porTiempo: !!e.porTiempo, nota: e.nota })) },
    { nombre: 'Día 2', ejercicios: [
      { nombre: 'Sentadilla a un banco', nota: 'El día 2, en lugar de la prensa.' },
      { nombre: 'Puente de glúteo', nota: 'El día 2, en lugar del peso muerto rumano.' },
      { nombre: 'Flexiones', nota: 'El día 2, en lugar del press. Con más o menos inclinación según tu nivel.' },
      { nombre: 'Remo en máquina', nota: 'El día 2, en lugar del jalón.' },
      { nombre: 'Curl de bíceps con mancuernas', nota: 'El día 2, en lugar de la plancha.' },
    ] },
    { nombre: 'Día 3', ejercicios: PRIMERAS_4.ejercicios.map((e) => ({ nombre: e.nombre, porTiempo: !!e.porTiempo, nota: e.nota })) },
  ],
  series: [3, 3, 3, 3, 2], rir: 2, descanso: 90, plancha: [40, 50], reps: [10, 12],
};
// Sus filas, como las de filasPrimeras4 (una semana)
export function filasNovato3(p = NOVATO_3) {
  return [{
    numero: 1, nota: p.nota, marcas: false,
    sesiones: p.sesiones.map((ses, i) => ({
      orden: i + 1, nombre: ses.nombre,
      ejercicios: ses.ejercicios.map((e, k) => ({
        orden: k + 1, nombre: e.nombre, alternativa: null, por_tiempo: !!e.porTiempo,
        series: p.series[k],
        reps_min: e.porTiempo ? p.plancha[0] : p.reps[0],
        reps_max: e.porTiempo ? p.plancha[1] : p.reps[1],
        rir_objetivo: e.porTiempo ? null : p.rir,
        descanso_seg: p.descanso,
        prioridad: k < 2 ? 'alta' : 'media',
        notas_coach: e.nota,
      })),
    })),
  }];
}

// Las filas de la plantilla, sin ids: [{ semana, nota, sesiones: [{ orden, nombre, ejercicios: [{ orden, nombre,
// series, reps_min, reps_max, rir_objetivo, descanso_seg, por_tiempo, notas_coach }] }] }]
export function filasPrimeras4(p = PRIMERAS_4) {
  return p.semanas.map((w) => ({
    numero: w.numero, nota: w.nota, marcas: !!w.marcas,
    sesiones: p.sesiones.map((nombre, i) => ({
      orden: i + 1, nombre,
      ejercicios: p.ejercicios.map((e, k) => ({
        orden: k + 1, nombre: e.nombre, alternativa: e.alternativa, por_tiempo: !!e.porTiempo,
        series: w.series[k],
        reps_min: e.porTiempo ? w.plancha[0] : p.reps[0],
        reps_max: e.porTiempo ? w.plancha[1] : p.reps[1],
        rir_objetivo: e.porTiempo ? null : w.rir,
        descanso_seg: w.descanso,
        prioridad: k < 2 ? 'alta' : 'media',
        notas_coach: e.nota,
      })),
    })),
  }));
}
