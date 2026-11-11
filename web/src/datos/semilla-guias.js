// Demo (057): dos guías cortas con sus fichas de ejercicio, para ver «Aprende» y la pestaña Técnica. Textos inventados
// para la demo (las guías de verdad son contenido del coach y no van en el repositorio).
const ficha = (cabecera, descripcion, patron, principales, secundarios, pasos, errores, niveles, si, no, tabla) => ({
  cabecera, descripcion, patron, principales, secundarios, pasos, errores,
  niveles: { principiante: niveles[0], intermedio: niveles[1], avanzado: niveles[2] }, si, no,
  tabla: tabla.map(([objetivo, reps, rpe, descanso]) => ({ objetivo, reps, rpe, descanso })),
});
const TABLA_BASE = [['Fuerza', '3-6', '7-9', '2-3 min'], ['Hipertrofia', '6-12', '7-8', '1,5-2 min'], ['Resistencia muscular', '12-20', '6-7', '1-1,5 min']];

export const GUIAS_DEMO = [
  { clave: 'pectoral', titulo: 'Pectoral', subtitulo: 'Tren superior · empuje', grupo: 'pectoral', orden: 1,
    contenido: {
      entrada: 'Una guía corta para entender y ejecutar bien los ejercicios de pecho.',
      cita: 'Un press bien hecho vale por tres mal hechos.',
      secciones: [
        { titulo: 'Cómo usar esta guía', subtitulo: 'Qué vas a encontrar', bloques: [
          { t: 'p', x: 'Cada ejercicio tiene su ficha: **cómo se hace**, los errores más habituales y cuándo encaja en un programa.' },
          { t: 'ul', xs: ['**Press horizontal**: banco plano, con barra o con mancuernas.', '**Press inclinado**: el banco a unos 30 grados.'] },
          { t: 'caja', tono: 'aviso', titulo: 'Antes de empezar', bloques: [{ t: 'p', x: 'Si te molesta el hombro al empujar, baja la carga y consúltalo con tu coach antes de seguir.' }] },
        ] },
        { titulo: 'Anatomía en dos minutos', subtitulo: 'Un músculo en abanico', bloques: [
          { t: 'p', x: 'El pectoral mayor tiene dos porciones que responden distinto según el **ángulo del banco**.' },
          { t: 'h', x: 'Lo que cambia con el ángulo' },
          { t: 'caja', tono: 'clave', titulo: 'En la práctica', bloques: [{ t: 'ol', xs: ['El **plano** trabaja el pectoral entero.', 'El **inclinado** carga más la parte alta.'] }] },
          { t: 'caja', tono: 'ojo', titulo: 'Un mito', bloques: [{ t: 'p', x: 'No hay «pectoral interno» ni «externo»: las fibras son continuas.' }] },
        ] },
        { titulo: 'Ejercicios principales', subtitulo: 'Los dos que no fallan', bloques: [{ t: 'p', x: 'Con un press plano y uno inclinado tienes cubierto casi todo.' }], fichas: [1, 2] },
      ],
      ideas: [{ titulo: 'Ángulo, no ejercicios mágicos', x: 'Varía el ángulo del banco antes que el ejercicio.' }, { titulo: 'Codos a media altura', x: 'Ni pegados al cuerpo ni en cruz.' }],
    },
    fichas: [
      { orden: 1, nombre: 'Press de banca con barra', enlaces: ['Press banca'], ficha: ficha('PRESS HORIZONTAL · BARRA',
        'El básico del tren superior. Merece técnica antes que kilos.', 'Empuje horizontal bilateral', 'Pectoral mayor, tríceps', 'Deltoides anterior',
        ['Túmbate con **cinco apoyos**: cabeza, hombros, glúteo y los dos pies.', 'Agarra la barra algo más ancho que los hombros, con las muñecas rectas.', 'Baja con control hasta rozar el pecho, con los **codos a media altura**.', 'Empuja hasta estirar los brazos sin despegar los hombros del banco.', 'Si no sale una repetición, deja la barra en los seguros.'],
        ['**Codos en cruz**: carga el hombro. Llévalos a media altura.', '**Rebotar la barra** en el pecho: pierdes el control de la bajada.', '**Despegar el glúteo** del banco al empujar.'],
        ['Empieza con mancuernas o en máquina para aprender el gesto.', 'Barra con cargas medias, de 5 a 10 repeticiones.', 'Bajada lenta de tres segundos o una pausa en el pecho.'],
        'Casi siempre, si el hombro está bien y la técnica está aprendida.', 'Con molestias de hombro al empujar: mejor mancuernas o máquina.', TABLA_BASE) },
      { orden: 2, nombre: 'Press inclinado con mancuernas', enlaces: ['Press inclinado con mancuernas'], ficha: ficha('PRESS INCLINADO · MANCUERNAS',
        'El complemento del press plano: más recorrido y cada brazo trabaja por su cuenta.', 'Empuje inclinado bilateral', 'Pectoral (parte alta), deltoides anterior', 'Tríceps',
        ['Pon el banco a **unos 30 grados**.', 'Sube las mancuernas con ayuda de las rodillas.', 'Baja hasta notar el pecho estirado, sin perder la postura.', 'Empuja hacia arriba y ligeramente hacia dentro.', 'Deja las mancuernas en el suelo con control al acabar.'],
        ['**Banco demasiado inclinado**: se convierte en un press de hombro.', '**Recorrido corto**: baja hasta donde el hombro te deje sin dolor.', '**Chocar las mancuernas** arriba: no aporta nada.'],
        ['Cargas ligeras y recorrido completo.', 'De 8 a 12 repeticiones con dos en reserva.', 'Una pausa abajo de un segundo.'],
        'Como segundo ejercicio de pecho, después de un press pesado.', 'Si el hombro se queja al bajar: recorta el recorrido o cambia de ángulo.', TABLA_BASE.slice(1)) },
    ] },
  { clave: 'cuadriceps', titulo: 'Cuádriceps', subtitulo: 'Tren inferior · empuje', grupo: 'cuadriceps', orden: 2,
    contenido: {
      entrada: 'Una guía corta para la sentadilla y sus parientes.',
      secciones: [
        { titulo: 'Cómo usar esta guía', bloques: [{ t: 'p', x: 'Agrupamos por **patrón de movimiento**, no por máquina.' }] },
        { titulo: 'Ejercicios principales', subtitulo: 'Empieza por aquí', bloques: [], fichas: [1] },
      ],
      ideas: [{ titulo: 'Profundidad antes que kilos', x: 'Baja hasta donde mantengas la espalda neutra.' }],
    },
    fichas: [
      { orden: 1, nombre: 'Sentadilla con barra alta', enlaces: ['Sentadilla barra alta'], ficha: ficha('SENTADILLA · BARRA',
        'El ejercicio de pierna por excelencia.', 'Sentadilla bilateral', 'Cuádriceps, glúteo', 'Aductores, erectores de la columna',
        ['Barra sobre los trapecios, pies a la anchura de los hombros.', 'Toma aire y aprieta el abdomen antes de bajar.', 'Baja con las **rodillas siguiendo la línea de los pies**.', 'Llega al menos a la paralela si tu movilidad lo permite.', 'Sube empujando el suelo, sin que la cadera suba antes que el pecho.'],
        ['**Rodillas hacia dentro** al subir.', '**Talones que se despegan**: revisa la movilidad de tobillo.', '**Redondear la espalda** en la parte baja.'],
        ['Sentadilla goblet con una mancuerna.', 'Barra alta, de 5 a 8 repeticiones.', 'Pausa de dos segundos abajo.'],
        'En casi todos los programas de pierna.', 'Con dolor lumbar activo: mejor prensa o sentadilla hack.', TABLA_BASE) },
    ] },
];

// db: la base de la demo; ctx: { uuid, ahoraISO }
export function sembrarGuias(db, { uuid, ahoraISO }) {
  Object.assign(db, { guias: [], fichas_ejercicio: [], ejercicios_fichas: [] });
  for (const { fichas, ...g } of GUIAS_DEMO) {
    const guia = { id: uuid(), ...g, publicada: true, creada_en: ahoraISO, actualizada_en: ahoraISO };
    db.guias.push(guia);
    for (const { enlaces = [], ...f } of fichas) {
      const fila = { id: uuid(), guia_id: guia.id, ...f, actualizada_en: ahoraISO };
      db.fichas_ejercicio.push(fila);
      for (const nombre of enlaces) {
        const e = (db.ejercicios || []).find((x) => x.nombre === nombre);
        if (e && !db.ejercicios_fichas.some((x) => x.ejercicio_id === e.id)) db.ejercicios_fichas.push({ ejercicio_id: e.id, ficha_id: fila.id, creado_en: ahoraISO });
      }
    }
  }
}
