// «La travesía» (remate, tanda 7): el diario del lobo. Una línea por cada sitio de cada ruta, que se desbloquea al llegar
// (con su postal). Son textos para que los repase Pelayo: cortos, del camino y sin datos que puedan estar mal.
import { RUTAS, RUTAS_NUEVAS, posicionEnRuta, rutaN } from './travesia-ruta.js';

export const DIARIO = {
  'mieres-madrid': [
    'Salgo de casa con el valle aún dormido. Las piernas, frescas; el camino, todo por delante.',
    'Primer pueblo. Huele a hierba mojada y a leña. Bebo en una fuente y sigo.',
    'El puerto. Sube y sube, y arriba el viento corta. Desde aquí se ve todo lo andado.',
    'Bajo hacia la meseta. El paisaje se abre y el cielo se hace enorme.',
    'Una ciudad grande. Mucha gente, mucho ruido. Prefiero el camino, pero descanso bien.',
    'Llanura de cereal hasta donde llega la vista. Aquí se corre a gusto.',
    'Un río ancho y un puente viejo. Me paro a mirar el agua un rato.',
    'Tierra de castillos. Cada uno, en lo alto de su loma, vigilando.',
    'La sierra, por fin. Último esfuerzo antes de bajar.',
    'Llego a la gran ciudad con las patas cansadas y la cabeza contenta.',
  ],
  'madrid-valencia': [
    'Vuelvo a salir. La ciudad se queda atrás antes de que me dé cuenta.',
    'Campos y olivos. Mucho sol: busco la sombra de cada árbol.',
    'Un pueblo de paso, de los de toda la vida. Pan recién hecho en el aire.',
    'La llanura parece no acabar. Cuento postes para no contar kilómetros.',
    'Molinos a lo lejos. Les saludo al pasar; no contestan.',
    'Viñas a un lado y a otro. El camino empieza a bajar hacia el mar.',
    'Cuestas, curvas y túneles. El aire ya sabe distinto.',
    'Un barranco hondo. Lo cruzo despacio y sin mirar mucho abajo.',
    'El mar. Lo huelo antes de verlo. Llego con ganas de meter las patas en el agua.',
  ],
  'valencia-barcelona': [
    'Por la costa, con el mar a la derecha. Buen comienzo.',
    'Un castillo sobre la roca y un pueblo a sus pies. Paro a beber.',
    'Campos de naranjos que no se acaban. El sol aprieta.',
    'Un pueblo sobre el mar, encaramado en una roca. Me quedo mirando las olas.',
    'Un delta lleno de aves. Corro en silencio para no espantarlas.',
    'Una ciudad con piedras muy antiguas. Me cuentan que lleva aquí dos mil años.',
    'Calas pequeñas y caminos de ronda. Subo, bajo, subo.',
    'La gran ciudad del mar. Fin de la ruta de siempre. Y ahora, ¿hacia dónde?',
  ],
  picos: [
    'Empiezo en un pueblo con un puente de piedra muy alto. Las montañas me esperan.',
    'Una cueva en la roca y una cascada. Lugar para pararse y respirar.',
    'Lagos arriba del todo, quietos como espejos. Hace frío y da igual.',
    'Abajo otra vez. Huele a queso y a establo.',
    'Un desfiladero estrecho. Las paredes casi se tocan por encima de mí.',
    'Un pueblo al que solo se llega andando. Merece la pena cada paso.',
    'Prados altos y vacas tranquilas. Me miran pasar sin moverse.',
    'Un valle verde y un pueblo grande. Descanso de verdad.',
    'Al pie de las paredes de roca. Las miro desde abajo y me siento pequeño.',
  ],
  pirineos: [
    'Salgo de una ciudad con una ciudadela. Las montañas, al norte.',
    'Una estación de tren enorme en mitad del valle. Me pregunto cuántos pasaron por aquí.',
    'El paso de montaña. Arriba, la frontera; abajo, todo verde.',
    'Un balneario entre picos. Agua caliente y nieve en las cumbres.',
    'Un pueblo de piedra a la entrada de un valle muy famoso.',
    'El valle: paredes altísimas, cascadas y un río que canta. De lo mejor del viaje.',
    'Otro valle, otro pueblo. Picos de más de tres mil metros alrededor.',
    'Túneles y puertos. El aire es fino y las patas lo notan.',
    'Al final del valle, una ciudad en la frontera. Ruta de montaña completa.',
  ],
  camino: [
    'Empiezo el Camino. Me cruzo con caminantes con mochila y concha. Nos saludamos.',
    'Una ciudad con un palacio de cuento. El Camino sigue recto hacia el oeste.',
    'Un pueblo pequeño de piedra, de los de antes. Albergue y sopa caliente.',
    'Un castillo de caballeros. El valle se abre y hace calor.',
    'Un pueblo entre ríos y viñas. Mañana toca subir.',
    'La montaña. Niebla, piedra y casas redondas. Aquí empieza Galicia.',
    'Mucha gente empieza aquí. El Camino se llena de voces.',
    'Un pueblo junto a un embalse. El agua sube y baja con el tiempo.',
    'Bosques de eucaliptos y aldeas. Ya queda muy poco.',
    'La plaza y la catedral. Lo he conseguido. Me siento un rato a mirarlo todo.',
  ],
};

// Las entradas desbloqueadas (la última primero) y la siguiente por desbloquear: { abiertas: [{ id, lugar, ruta, texto }], siguiente: { lugar, faltan } | null }
export function diarioDe(metros, elegidas = []) {
  const p = posicionEnRuta(metros, elegidas), out = [];
  for (let n = Math.max(0, p.n - 12); n <= p.n; n++) {
    const r = rutaN(n, elegidas), hasta = n < p.n ? r.hitos.length : p.pasados;
    const textos = DIARIO[r.id] || [];
    r.hitos.slice(0, hasta).forEach(([lugar], i) => {
      if (i === 0 && n > 0) return;
      if (textos[i]) out.push({ id: `${n}:${i}`, lugar, ruta: r.nombre, texto: textos[i] });
    });
  }
  return { abiertas: out.reverse(), siguiente: p.siguiente ? { lugar: p.siguiente[0], faltan: p.faltan } : null };
}
// (para las pruebas: cada ruta, con tantas líneas como hitos)
export const diarioCompleto = () => [...RUTAS, ...RUTAS_NUEVAS].every((r) => (DIARIO[r.id] || []).length === r.hitos.length);
