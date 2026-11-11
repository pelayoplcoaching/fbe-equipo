// Demo (057): dos guías cortas con sus fichas de ejercicio, para ver «Aprende» y la pestaña Técnica. Textos inventados
// para la demo (las guías de verdad son contenido del coach y no van en el repositorio).
const ficha = (cabecera, descripcion, patron, principales, secundarios, pasos, errores, niveles, si, no, tabla) => ({
  cabecera, descripcion, patron, principales, secundarios, pasos, errores,
  niveles: { principiante: niveles[0], intermedio: niveles[1], avanzado: niveles[2] }, si, no,
  tabla: tabla.map(([objetivo, reps, rpe, descanso]) => ({ objetivo, reps, rpe, descanso })),
});
const TABLA_BASE = [['Fuerza', '3-6', '7-9', '2-3 min'], ['Hipertrofia', '6-12', '7-8', '1,5-2 min'], ['Resistencia muscular', '12-20', '6-7', '1-1,5 min']];

export const GUIAS_DEMO = [
  { clave: 'rutinas', titulo: 'Tipos de rutina', subtitulo: 'Cómo se reparte la semana', grupo: null, orden: 0,
    contenido: {
      entrada: 'Las distribuciones de la semana más habituales, con su porqué.',
      cita: 'La mejor rutina es la que puedes mantener.',
      secciones: [
        { titulo: 'Antes de elegir', subtitulo: 'Lo primero, los días', bloques: [{ t: 'p', x: 'Cuenta los días que **de verdad** puedes entrenar. La rutina se monta sobre ese número.' }] },
        { clave: 'upper-lower-4', titulo: 'Torso y pierna en 4 días', subtitulo: 'Dos días de torso y dos de pierna', bloques: [
          { t: 'p', x: 'Cada grupo muscular se trabaja **dos veces por semana**, con un día pesado y otro de más repeticiones.' },
          { t: 'h', x: 'Estructura semanal' },
          { t: 'tabla', cab: ['Día', 'Sesión', 'Qué lleva'], filas: [['Lunes', 'Torso A', 'Press y remo pesados'], ['Martes', 'Pierna A', 'Sentadilla y bisagra'], ['Jueves', 'Torso B', 'Más repeticiones'], ['Viernes', 'Pierna B', 'Unilateral y accesorios']] },
          { t: 'caja', tono: 'aviso', titulo: 'Cuándo cambiar', bloques: [{ t: 'p', x: 'Si no llegas a los cuatro días varias semanas seguidas, mejor tres días de cuerpo entero.' }] },
        ] },
        { clave: 'con-cardio', titulo: 'Fuerza con cardio', subtitulo: 'Dos o tres días de fuerza y uno o dos de cardio', bloques: [
          { t: 'p', x: 'El cardio suave **suma salud** y casi no resta a la fuerza si va en días distintos.' },
          { t: 'ul', xs: ['Fuerza de cuerpo entero dos o tres días.', 'Cardio suave, a ritmo de conversación, uno o dos días.'] },
        ] },
      ],
      ideas: [{ titulo: 'Los días mandan', x: 'Primero cuántos días; después, qué rutina.' }],
    },
    fichas: [] },
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
  // (filosofía) Guías de leer, sin fichas: para ver las estanterías, el buscador, las guías «a cuento» y el mito de la
  // semana. Textos inventados para la demo.
  { clave: 'manual', titulo: 'Cómo funciona esto', subtitulo: 'Tu semana con tu coach, paso a paso', grupo: null, orden: 100,
    contenido: {
      entrada: 'Lo que haces tú, lo que hace tu coach y cuándo.',
      secciones: [
        { clave: 'ritmo', titulo: 'El ritmo de la semana', subtitulo: 'Entrenar, apuntar y contar cómo ha ido', bloques: [
          { t: 'p', x: 'Entrenas tus sesiones y **apuntas cada serie** en el momento. El domingo envías tu check-in y tu coach te contesta con los ajustes.' },
          { t: 'tabla', cab: ['Cuándo', 'Qué toca'], filas: [['Cada sesión', 'Kilos, repeticiones y esfuerzo de cada serie'], ['Domingo', 'El check-in de la semana'], ['Fin de semana', 'La revisión de tu coach']] },
          { t: 'cita', x: 'Un dato apuntado a tiempo vale más que diez recordados a medias.' },
        ] },
        { clave: 'rpe', titulo: 'El esfuerzo, del 1 al 10', subtitulo: 'Cuántas repeticiones te quedaban', bloques: [
          { t: 'p', x: 'El esfuerzo de una serie se mide por las repeticiones que **te quedaban en la recámara**: con dos, un 8; con una, un 9.' },
        ] },
      ],
      ideas: [{ titulo: 'Apunta en el momento', x: 'Lo que no se apunta, no se puede ajustar.' }],
    },
    fichas: [] },
  { clave: 'deload', titulo: 'La semana de descarga', subtitulo: 'Bajar para seguir subiendo', grupo: null, orden: 110,
    contenido: {
      entrada: 'Por qué una semana más suave es parte del plan.',
      secciones: [
        { titulo: 'Para qué sirve', bloques: [{ t: 'p', x: 'Las semanas duras dejan **cansancio acumulado**. La descarga lo baja para que se vea lo que has ganado.' }] },
        { clave: 'como-hacerla', titulo: 'Cómo se hace', subtitulo: 'Menos series y más margen', bloques: [
          { t: 'ul', xs: ['**Menos series**: en torno a la mitad de las habituales.', '**Más margen**: deja tres o cuatro repeticiones en la recámara.', '**Mismos ejercicios**: no es semana de probar cosas nuevas.'] },
          { t: 'caja', tono: 'aviso', titulo: 'Lo que no es', bloques: [{ t: 'p', x: 'No es una semana de vacaciones ni una semana para compensar con cardio intenso.' }] },
        ] },
      ],
      ideas: [{ titulo: 'Descargar es entrenar', x: 'La semana suave es la que deja que las duras sirvan.' }],
    },
    fichas: [] },
  { clave: 'volver', titulo: 'Volver tras un parón', subtitulo: 'Sin prisa y sin culpa', grupo: null, orden: 112,
    contenido: {
      entrada: 'Cómo retomar después de unas semanas sin entrenar.',
      secciones: [
        { clave: 'reglas-de-oro', titulo: 'Dos reglas para la vuelta', subtitulo: 'Quedarse corto y tener paciencia', bloques: [
          { t: 'ol', xs: ['**Empieza por debajo** de donde lo dejaste: menos peso y menos series.', '**Sube poco a poco**: en dos o tres semanas estarás donde estabas.'] },
        ] },
      ],
      ideas: [],
    },
    fichas: [] },
  { clave: 'cardio', titulo: 'Cardio y fuerza', subtitulo: 'Cómo se llevan bien', grupo: null, orden: 113,
    contenido: {
      entrada: 'El cardio suma salud y, bien puesto, no resta fuerza.',
      secciones: [
        { clave: 'combinar', titulo: 'Cómo combinarlos', subtitulo: 'Días, orden e intensidad', bloques: [
          { t: 'p', x: 'Si puedes, **en días distintos**. Si van el mismo día, primero la fuerza y después el cardio suave.' },
        ] },
      ],
      ideas: [],
    },
    fichas: [] },
  { clave: 'composicion', titulo: 'Las fases de la dieta', subtitulo: 'Ganar, mantener y perder', grupo: null, orden: 121,
    contenido: {
      entrada: 'Cada fase tiene su objetivo y su ritmo.',
      secciones: [
        { clave: 'volumen', titulo: 'Ganar músculo', subtitulo: 'Un poco por encima, mucho tiempo', bloques: [{ t: 'p', x: 'Un **pequeño superávit** sostenido durante meses da más músculo y menos grasa que comer de más unas semanas.' }] },
        { clave: 'definicion', titulo: 'Perder grasa', subtitulo: 'Un poco por debajo, sin pasar hambre', bloques: [{ t: 'p', x: 'Un **déficit pequeño** se sostiene; uno grande se abandona. La proteína alta y la fuerza protegen el músculo.' }] },
        { clave: 'mantenimiento', titulo: 'Mantener', subtitulo: 'La fase que da descanso', bloques: [{ t: 'p', x: 'Entre fase y fase, unas semanas **comiendo lo que gastas** asientan lo conseguido.' }] },
      ],
      ideas: [{ titulo: 'La prisa sale cara', x: 'Fases largas y cambios pequeños.' }],
    },
    fichas: [] },
  { clave: 'sueno', titulo: 'Dormir mejor', subtitulo: 'El descanso también se entrena', grupo: null, orden: 130,
    contenido: {
      entrada: 'Dormir bien es lo que más ayuda a recuperar.',
      secciones: [
        { clave: 'higiene', titulo: 'Hábitos que ayudan', subtitulo: 'Lo sencillo, primero', bloques: [
          { t: 'ul', xs: ['**Horario regular**, también el fin de semana.', '**Habitación fresca y a oscuras**.', '**La cafeína, por la mañana**: después de comer ya estorba.'] },
        ] },
      ],
      ideas: [],
    },
    fichas: [] },
  { clave: 'motivacion', titulo: 'Los días sin ganas', subtitulo: 'El hábito pesa más que las ganas', grupo: null, orden: 131,
    contenido: {
      entrada: 'Qué hacer cuando no apetece.',
      secciones: [
        { clave: 'que-hacer', titulo: 'Qué hacer cuando no apetece', subtitulo: 'Empezar pequeño', bloques: [
          { t: 'p', x: 'Pacta contigo **diez minutos**. Si a los diez minutos sigues sin ganas, recoges; casi nunca pasa.' },
          { t: 'cita', x: 'Una sesión corta también cuenta.' },
        ] },
      ],
      ideas: [],
    },
    fichas: [] },
  { clave: 'mitos', titulo: 'Mitos del gimnasio', subtitulo: 'Lo que se repite y lo que se sabe', grupo: null, orden: 143,
    contenido: {
      entrada: 'Frases que se oyen en cualquier vestuario, miradas con calma.',
      secciones: [
        { titulo: 'Sobre entrenar', bloques: [
          { t: 'caja', tono: 'nota', titulo: 'MITO 1 · "Sin agujetas no has entrenado bien"', bloques: [
            { t: 'p', x: '**Lo que se sabe**: las agujetas dicen que el estímulo era nuevo, no que fuera bueno. Con las semanas desaparecen aunque sigas progresando.' },
            { t: 'p', x: '**Lo que sí cuenta**: que con el tiempo muevas más peso o hagas más repeticiones.' }] },
          { t: 'caja', tono: 'nota', titulo: 'MITO 2 · "Hay que cambiar de ejercicios cada semana"', bloques: [
            { t: 'p', x: '**Lo que se sabe**: para mejorar en un ejercicio hay que repetirlo. Cambiarlo todo cada semana impide ver si avanzas.' }] },
        ] },
        { titulo: 'Sobre comer', bloques: [
          { t: 'caja', tono: 'nota', titulo: 'MITO 3 · "Cenar tarde engorda"', bloques: [
            { t: 'p', x: '**Lo que se sabe**: lo que cuenta es lo que comes en el conjunto del día y de la semana, no la hora.' }] },
        ] },
      ],
      ideas: [{ titulo: 'Pregunta siempre', x: 'Quién lo dice, con qué datos y qué gana.' }],
    },
    fichas: [] },
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
