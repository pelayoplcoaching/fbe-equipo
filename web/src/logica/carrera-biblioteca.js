// v0.219: la biblioteca FBE de sesiones de carrera (lista para usar desde «Desde la biblioteca…», junto a las del coach) y
// el porqué de cada tipo de sesión, en una línea, para el atleta. Todo puro.
// Cada sesión: { id, nombre, porque, pauta } con la misma forma que comprueba la base (cardio.js, pautaValida).

// Para qué sirve cada tipo de sesión (lo ve el atleta en su sesión de carrera)
export const PORQUE_TIPO = {
  facil: 'Suave, para sumar kilómetros sin cansarte: mejora tu base aeróbica y llegas fresco a las sesiones duras.',
  calidad: 'La sesión dura de la semana: te acostumbra a ir más rápido y sube el ritmo que eres capaz de aguantar.',
  larga: 'La más larga de la semana: el cuerpo aprende a aguantar más tiempo y a gastar mejor la energía.',
  carrera: 'El día de la carrera: sal a tu ritmo, no al de los demás, y disfrútala.',
  recuperacion: 'Muy suave, para mover las piernas y recuperar: no es para entrenar más.',
  cross: 'Otro deporte suave: suma forma sin el impacto de correr.',
  test: 'Para medir cómo estás y ajustar tus zonas y tus ritmos.',
  tecnica: 'Ejercicios y rectas para correr mejor y gastar menos en cada zancada.',
};
// Y de las rectas (strides), que salen en muchas
export const PORQUE_RECTAS = 'Las rectas: cortas y rápidas pero relajadas, para ganar soltura y técnica sin cansarte.';

// El porqué de una pauta de carrera: el de su tipo y, si lleva rectas y no es de técnica, el de las rectas
export function porqueDe(pauta) {
  if (!pauta || pauta.modalidad !== 'carrera') return null;
  const base = PORQUE_TIPO[pauta.tipo] || null;
  const rectas = Array.isArray(pauta.partes) && pauta.partes.some((p) => p?.fase === 'strides') && pauta.tipo !== 'tecnica';
  return [base, rectas ? PORQUE_RECTAS : null].filter(Boolean).join(' ') || null;
}

const C = 'calentar', B = 'bloque', S = 'strides', E = 'enfriar';
const calentar = (seg = 900) => ({ fase: C, seg, zona: 1, zona_hasta: 2 });
const enfriar = (seg = 600) => ({ fase: E, seg, zona: 1 });
const rectas = (reps = 4) => ({ fase: S, reps, seg: 20, rec_seg: 60, rec: 'andando o trote muy suave' });
const sesion = (id, nombre, porque, tipo, partes, extra = {}) => ({ id: `fbe-${id}`, nombre, porque, fbe: true, pauta: { modalidad: 'carrera', tipo, ...extra, partes } });

export const BIBLIOTECA_FBE = [
  // Suaves
  sesion('rodaje', 'Rodaje suave', 'Base aeróbica sin cansar: la sesión que más se repite.', 'facil',
    [{ fase: B, seg: 2400, zona: 2, nota: 'Cómodo: puedes hablar con frases largas' }], { minutos: 40, zona: 2 }),
  sesion('rodaje-rectas', 'Rodaje con rectas', 'Rodaje suave con unas rectas al final para ganar soltura.', 'facil',
    [{ fase: B, seg: 2100, zona: 2 }, { ...rectas(6), nota: 'Rápidas pero relajadas, sin apretar los dientes' }, enfriar(300)], { minutos: 45, zona: 2 }),
  sesion('progresivo', 'Rodaje progresivo', 'Empieza suave y termina algo más vivo: enseña a cambiar de ritmo sin cansar.', 'facil',
    [{ fase: B, seg: 1500, zona: 2 }, { fase: B, seg: 600, zona: 3, nota: 'Ve subiendo poco a poco' }, enfriar(300)], { minutos: 40, zona: 2, zona_hasta: 3 }),
  sesion('recuperacion', 'Recuperación', 'Para el día después de una sesión dura: mover las piernas y recuperar.', 'recuperacion',
    [{ fase: B, seg: 1500, zona: 1, nota: 'Muy suave: si dudas, más despacio' }], { minutos: 25, zona: 1 }),
  sesion('andar-1-1', 'Correr y andar 1 y 1', 'Para empezar a correr o volver tras una molestia, sin impacto de golpe.', 'facil',
    [{ fase: C, seg: 300, zona: 1, nota: 'Andando rápido' }, { fase: B, reps: 10, seg: 60, zona: 2, rec_seg: 60, rec: 'andando' }, enfriar(300)], { minutos: 30, zona: 2 }),
  sesion('andar-3-1', 'Correr y andar 3 y 1', 'El paso siguiente: más minutos corriendo seguidos.', 'facil',
    [{ fase: C, seg: 300, zona: 1, nota: 'Andando rápido' }, { fase: B, reps: 6, seg: 180, zona: 2, rec_seg: 60, rec: 'andando' }, enfriar(300)], { minutos: 34, zona: 2 }),
  // Umbral y tempo
  sesion('umbral-3x8', 'Umbral 3 × 8 min', 'Sube el ritmo que eres capaz de aguantar mucho rato.', 'calidad',
    [calentar(), rectas(4), { fase: B, reps: 3, seg: 480, zona: 4, rec_seg: 120, rec: 'trote suave', nota: 'Duro pero sostenido: palabras sueltas' }, enfriar()], { zona: 4 }),
  sesion('umbral-2x15', 'Umbral 2 × 15 min', 'Umbral en bloques largos, para medias y maratones.', 'calidad',
    [calentar(), { fase: B, reps: 2, seg: 900, zona: 4, rec_seg: 180, rec: 'trote suave' }, enfriar()], { zona: 4 }),
  sesion('tempo-20', 'Tempo 20 min', 'Ritmo controlado y sostenido: la transición entre lo suave y lo duro.', 'calidad',
    [calentar(), { fase: B, seg: 1200, zona: 3, nota: 'Controlado: frases cortas' }, enfriar()], { zona: 3 }),
  sesion('cruceros', 'Cruceros 5 × 1 km', 'Umbral troceado en kilómetros, con poca pausa.', 'calidad',
    [calentar(), { fase: B, reps: 5, m: 1000, zona: 4, rec_seg: 60, rec: 'trote suave' }, enfriar()], { zona: 4 }),
  // Series
  sesion('series-800', 'Series 6 × 800 m', 'Por encima del umbral: más potencia aeróbica para 5 y 10 km.', 'calidad',
    [calentar(), rectas(4), { fase: B, reps: 6, m: 800, zona: 5, rec_seg: 120, rec: 'trote' }, enfriar()], { zona: 5 }),
  sesion('series-400', 'Series 10 × 400 m', 'Series cortas y rápidas: velocidad y soltura.', 'calidad',
    [calentar(), rectas(4), { fase: B, reps: 10, m: 400, zona: 5, rec_seg: 90, rec: 'trote' }, enfriar()], { zona: 5 }),
  sesion('series-1000', 'Series 5 × 1.000 m', 'Series largas por encima del umbral: el trabajo clave del 10 km.', 'calidad',
    [calentar(), rectas(4), { fase: B, reps: 5, m: 1000, zona: 5, rec_seg: 150, rec: 'trote' }, enfriar()], { zona: 5 }),
  sesion('series-4x4', 'Series 4 × 4 min', 'Cuatro bloques muy duros con buena pausa: suben el consumo de oxígeno.', 'calidad',
    [calentar(), { fase: B, reps: 4, seg: 240, zona: 5, rec_seg: 180, rec: 'trote' }, enfriar()], { zona: 5 }),
  sesion('piramide', 'Pirámide 1-2-3-2-1 min', 'Cambios de duración para no aburrirse y tocar varios ritmos.', 'calidad',
    [calentar(), { fase: B, seg: 60, zona: 5, rec_seg: 60, rec: 'trote' }, { fase: B, seg: 120, zona: 5, rec_seg: 60, rec: 'trote' }, { fase: B, seg: 180, zona: 4, rec_seg: 90, rec: 'trote' },
      { fase: B, seg: 120, zona: 5, rec_seg: 60, rec: 'trote' }, { fase: B, seg: 60, zona: 5 }, enfriar()], { zona: 4, zona_hasta: 5 }),
  // Cuestas
  sesion('cuestas-cortas', 'Cuestas cortas 8 × 15 s', 'Fuerza y técnica de carrera con poco impacto.', 'calidad',
    [calentar(), { fase: B, reps: 8, seg: 15, zona: 5, rec_seg: 90, rec: 'bajando andando', nota: 'Cuesta empinada, a tope pero relajado' }, enfriar()], { zona: 5 }),
  sesion('cuestas-largas', 'Cuestas largas 6 × 1 min', 'Potencia aeróbica cuesta arriba, más amable con las piernas que las series en llano.', 'calidad',
    [calentar(), { fase: B, reps: 6, seg: 60, zona: 4, zona_hasta: 5, rec_seg: 120, rec: 'bajando al trote' }, enfriar()], { zona: 4, zona_hasta: 5 }),
  // Fartlek
  sesion('fartlek-1', 'Fartlek 10 × 1 min', 'Cambios de ritmo sin pista ni reloj exacto: ideal para empezar con la calidad.', 'calidad',
    [calentar(), { fase: B, reps: 10, seg: 60, zona: 4, rec_seg: 60, rec: 'trote' }, enfriar()], { zona: 4 }),
  sesion('fartlek-libre', 'Fartlek libre', 'Juega con el ritmo: de farola a farola, en las cuestas o con la música.', 'calidad',
    [{ fase: B, seg: 2400, zona: 2, zona_hasta: 4, nota: 'Cambios cuando te apetezca; vuelve siempre a suave' }], { minutos: 40, zona: 2, zona_hasta: 4 }),
  // Tirada larga
  sesion('larga', 'Tirada larga', 'La resistencia de la semana, siempre cómoda.', 'larga',
    [{ fase: B, seg: 4500, zona: 2, nota: 'Cómoda de principio a fin; lleva agua si pasa de una hora' }], { minutos: 75, zona: 2 }),
  sesion('larga-final', 'Tirada larga con final a ritmo', 'Acostumbra a las piernas a tu ritmo de carrera cuando ya están cansadas.', 'larga',
    [{ fase: B, seg: 4200, zona: 2 }, { fase: B, seg: 1200, zona: 3, nota: 'A tu ritmo de media o de maratón' }], { minutos: 90, zona: 2, zona_hasta: 3 }),
  sesion('larga-cambios', 'Tirada larga con cambios', 'Larga con unos bloques algo más vivos: menos monótona y más específica.', 'larga',
    [{ fase: B, seg: 3000, zona: 2 }, { fase: B, reps: 3, seg: 300, zona: 3, rec_seg: 300, rec: 'suave' }, enfriar()], { zona: 2, zona_hasta: 3 }),
  // Ritmo de carrera
  sesion('ritmo-media', 'Ritmo de media 3 × 3 km', 'Tu ritmo de media maratón, en bloques: lo aprendes de memoria.', 'calidad',
    [calentar(), { fase: B, reps: 3, m: 3000, zona: 3, zona_hasta: 4, rec_seg: 120, rec: 'trote', nota: 'A tu ritmo objetivo de media maratón' }, enfriar()], { zona: 3, zona_hasta: 4 }),
  sesion('ritmo-maraton', 'Ritmo de maratón 2 × 5 km', 'Tu ritmo de maratón, en bloques largos, para que salga solo el día de la carrera.', 'calidad',
    [calentar(), { fase: B, reps: 2, m: 5000, zona: 3, rec_seg: 180, rec: 'trote', nota: 'A tu ritmo objetivo de maratón' }, enfriar()], { zona: 3 }),
  // Técnica y test
  sesion('tecnica', 'Técnica de carrera', 'Correr mejor y gastar menos: ejercicios de técnica y rectas.', 'tecnica',
    [{ fase: C, seg: 600, zona: 1, zona_hasta: 2 }, { fase: B, nota: 'Skipping, talones al glúteo y zancada exagerada: 2 × 20 m de cada uno, volviendo andando' },
      rectas(6), { fase: B, seg: 900, zona: 2 }], { minutos: 35 }),
  sesion('test-30', 'Test de 30 minutos', 'Para calcular tu FC umbral y tu ritmo umbral (y con ellos, tus zonas).', 'test',
    [calentar(), { fase: B, seg: 1800, zona: 4, zona_hasta: 5, nota: 'Lo más que puedas aguantar 30 min, parejo. Apunta el ritmo medio de los 30 min (tu ritmo umbral) y la FC media de los últimos 20 (tu FC umbral)' }, enfriar()], { zona: 4, zona_hasta: 5 }),
];
