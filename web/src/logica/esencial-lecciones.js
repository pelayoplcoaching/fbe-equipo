// FBE Esencial: una lección por semana, de la 1 a la 8 («Lo de esta semana» en Hoy). Textos de las dos guías de Pelayo
// («Cómo empezar: las primeras 4 semanas» y «Dos días de gimnasio a la semana: ¿es suficiente?»), aprobados por él el
// 25/11/2026 (borrador en «claude/esencial-lecciones-borrador.md»). Solo para quien empezó con «Primeras 4 semanas»: la
// semana se cuenta desde el lunes en que empezó ese bloque (también si después cambia de plantilla). Lógica pura.
import { NOMBRE_PRIMERAS_4 } from './esencial.js';

export const LECCIONES = [
  { semana: 1, titulo: 'Aprender el gesto',
    texto: 'Una serie de cada ejercicio, de 10 a 12 repeticiones, y que te sobren 4 o 5. El primer día, pide a alguien de sala que te ajuste las máquinas: son cinco minutos y te ahorran un mes de dudas. El objetivo de enero es llegar a febrero.',
    mas: { titulo: '¿Qué peso pongo?', texto: 'El primer día no lo sabe nadie. Empieza con poco, haz doce repeticiones y pregúntate cuántas más habrías podido hacer: si habrías hecho diez más, sube; si ninguna, baja. Buscas el peso con el que te sobren cuatro o cinco.' } },
  { semana: 2, titulo: 'Dos series',
    texto: 'Dos series de cada ejercicio, y que te sobren 3. Entre una y otra, descansa lo que necesites para repetirla bien: uno o dos minutos. Las agujetas de estas dos semanas son normales: luego bajan, y no dicen si entrenaste bien o mal.' },
  { semana: 3, titulo: 'Tu primera subida de peso',
    texto: 'Dos series, con un poco más de peso, y que te sobren 2. Si fallas una sesión, no la recuperes doblando al día siguiente: sigue donde tocaba.',
    mas: { titulo: 'El espejo', texto: 'A las tres semanas te vas a ver distinto en el espejo. Disfrútalo, pero buena parte es hinchazón: no juzgues el plan por el espejo del primer mes, ni para bien ni para mal.' } },
  { semana: 4, titulo: 'Tus marcas',
    texto: 'Tres series en los dos primeros ejercicios y dos en el resto. Apunta bien el peso y las repeticiones de cada serie: son tus marcas, el punto de partida de todo lo que venga. Con ellas, la app prepara tu semana 5.' },
  { semana: 5, titulo: 'Desde aquí, la app',
    texto: 'Desde esta semana, la app prepara cada semana con lo que apuntas: una repetición más o un poco más de peso. Si algo no cuadra (una serie que no llegó, una molestia en esa zona o un dato que parece mal apuntado), no sube o te pregunta antes. Por eso hay que apuntar: sin registro, la progresión es una opinión.' },
  { semana: 6, titulo: 'Cada serie cuenta',
    texto: 'Si entrenas poco, cada serie tiene que contar: si al acabar podrías haber hecho cinco más, esa serie cuenta poco. Que te sobren 2. Esta semana te llega en «Tu día» una encuesta de tres preguntas: me ayuda mucho que la contestes.' },
  { semana: 7, titulo: 'Molestia o dolor',
    texto: 'La molestia del músculo que ha trabajado aparece al día siguiente, se nota en los dos lados y mejora cuando te mueves. El dolor que preocupa es otro: aparece durante el ejercicio, es punzante, se queda en una articulación o va a más de una sesión a otra.',
    mas: { titulo: 'Cuándo parar', texto: 'Dolor en el pecho, falta de aire que no cuadra con lo que estás haciendo o mareo: paras, y eso se consulta. Para las molestias al entrenar tienes el semáforo del dolor en la web.' } },
  { semana: 8, titulo: 'Dos días que sigas',
    texto: 'Dos días que sigas haciendo en marzo valen más que cuatro que dejas en febrero. Con dos días de fuerza cumples lo que la Organización Mundial de la Salud pide a cualquier adulto.',
    mas: { titulo: '¿Y un tercer día?', texto: 'Antes de pedirlo, mira tu registro: si las series acaban con cuatro o cinco repeticiones de margen, no te faltan días, te falta apretar.' } },
];

// La semana de su plan (1, 2…) desde el lunes en que empezó «Primeras 4 semanas»; null si no empezó con ese bloque o aún
// no ha llegado. bloques: los suyos (api.programa); lunes: el de la semana que está viendo (la actual).
export function semanaDelPlan(bloques = [], lunes) {
  const ini = (bloques || []).filter((b) => b?.nombre === NOMBRE_PRIMERAS_4 && b.fecha_inicio).map((b) => b.fecha_inicio).sort()[0];
  if (!ini || !lunes || lunes < ini) return null;
  return Math.floor((Date.parse(`${lunes}T12:00:00Z`) - Date.parse(`${ini}T12:00:00Z`)) / (7 * 864e5)) + 1;
}

export const leccionDe = (n) => LECCIONES.find((l) => l.semana === n) || null;
