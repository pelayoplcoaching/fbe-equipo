// Radar de contacto: el borrador del mensaje. Lógica pura.
//
// Frases cortas, como escribe el coach: una o dos, sin emojis ni saludo de fórmula, con el dato concreto. (v0.201) Cada
// motivo, en cuatro tonos (cercano, directo, motivador y con humor; en lo delicado, el humor es suave) y con varias
// frases por tono, para que no se repitan; ninguna depende del género de quien la recibe. Varios temas se unen en un
// mensaje («Por cierto, …»), «tu manera de escribir» (su nombre al empezar, tu cierre, un emoji, más corto) se aplica
// encima, y una frase que ya le mandaste en las últimas semanas se salta. El coach siempre lo edita antes de enviar.
import { cuandoFue, ORDEN_MOTIVOS } from './motivos.js';
import { normalLetras } from '../mensajes.js';

export const TONOS = ['cercano', 'directo', 'motivador', 'humor'];
export const NOMBRE_TONO = { cercano: 'Cercano', directo: 'Directo', motivador: 'Motivador', humor: 'Con humor' };

const mayus = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// «de ayer», «de hoy», «del lunes»
const deCuando = (c) => (c.startsWith('el ') ? `del ${c.slice(3)}` : `de ${c}`);
// La marca de un récord sin la coletilla «(antes 72,4)»
const marca = (d) => String(d.texto || '').replace(/\s*\(antes[^)]*\)\s*$/, '').trim();
const sesiones = (n) => (n === 1 ? '1 sesión' : `${n} sesiones`);
// «(hombros, zona lumbar)»: las zonas del aviso del panel sin su intensidad entre paréntesis
const z = (d) => { const t = String(d.zonas || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase(); return t ? ` (${t})` : ''; };
const corta = (t, n = 80) => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x; };
const anos = (n) => (n === 1 ? 'un año' : `${n} años`);
const esHoy = (d, hoy) => d.fecha === hoy;
const esSeguimiento = (d) => /^Preguntar c\u00f3mo sigue/i.test(String(d.texto || ''));

// Cada motivo: { tono: [funciones (datos, hoy) → frase o null si con esos datos no encaja] }. En cada tono, al menos
// una que vale sin datos (para elegir la situación a mano desde la biblioteca).
const FRASES = {
  molestia_fuerte: {
    cercano: [
      (d) => `He visto la molestia que apuntaste en el check-in${z(d)}. ¿Cómo sigue? Hasta que me digas, nada que la provoque`,
      (d) => `¿Cómo va esa molestia${z(d)}? Cuéntame cuándo la notas y adapto la semana`,
    ],
    directo: [
      (d) => `Vi lo del check-in${z(d)}. Antes de la próxima sesión dime cómo estás y vemos qué cambiamos`,
      (d) => `Molestia fuerte en el check-in${z(d)}: dime en qué ejercicios la notas y cuánto, del 0 al 10. Mientras, fuera lo que la provoque`,
    ],
    motivador: [
      (d) => `Lo de la molestia${z(d)} lo vamos a solucionar: adaptamos lo que haga falta y seguimos sumando. ¿Cómo la notas hoy?`,
      (d) => `Una molestia no tira por tierra lo que llevas hecho. Cuéntame cómo sigue${z(d)} y ajustamos para que entrenes sin dolor`,
    ],
    humor: [
      (d) => `Esa molestia${z(d)} quiere protagonismo y no se lo vamos a dar. ¿Cómo la notas? Le busco un plan B a la semana`,
      (d) => `He visto el parte del check-in${z(d)}. ¿Cómo va? Prometo no mandarte nada que la despierte`,
    ],
  },
  molestia: {
    cercano: [
      (d) => `Vi lo que apuntaste en el check-in${z(d)}. ¿Cómo sigue?`,
      (d) => `Cuéntame cómo notas la molestia${z(d)} entrenando y vemos qué cambiar`,
    ],
    directo: [
      (d) => `¿Cómo va esa molestia${z(d)}? Si sigue igual, adaptamos los ejercicios`,
      (d) => `Molestia${z(d)}: dime si te limita en algún ejercicio y lo cambiamos esta semana`,
    ],
    motivador: [
      (d) => `Vamos a cuidar esa molestia${z(d)} para que no te frene. ¿Cómo la notas esta semana?`,
      (d) => `Con un par de ajustes, esa molestia${z(d)} no tiene por qué pararte. ¿Cómo sigue?`,
    ],
    humor: [
      (d) => `¿Qué tal se porta la molestia${z(d)}? Si da guerra, la mandamos al banquillo y entrenamos alrededor`,
      (d) => `Vi la molestia${z(d)} en el check-in. ¿Sigue de inquilina o ya se ha ido?`,
    ],
  },
  dia_malo: {
    cercano: [
      (d, hoy) => (d.fecha && d.que ? `${mayus(cuandoFue(d.fecha, hoy))} apuntaste que ${d.que}. ¿Cómo ${esHoy(d, hoy) ? 'ha ido' : 'estás hoy'}?` : null),
      (d, hoy) => (d.fecha && d.que ? `¿Qué tal la sesión ${deCuando(cuandoFue(d.fecha, hoy))}? Vi que ${d.que}` : null),
      () => 'Vi que no llegaste en tu mejor día a la última sesión. ¿Cómo estás?',
    ],
    directo: [
      (d, hoy) => (d.fecha && d.sesion ? `Vi que ${cuandoFue(d.fecha, hoy)} no llegaste en tu mejor día a ${d.sesion}. ¿Qué tal ${esHoy(d, hoy) ? 'ha ido' : 'estás'}?` : null),
      () => 'Si vuelves a llegar con poca energía, baja un poco la carga esa sesión y me lo dices. ¿Cómo estás?',
    ],
    motivador: [
      (d, hoy) => (d.fecha ? `Vi que ${cuandoFue(d.fecha, hoy)} no llegabas en tu mejor día y aun así entrenaste. Eso es constancia. ¿Cómo estás?` : null),
      () => 'Los días flojos también suman, y mucho. Entrenar sin ganas es lo que más se nota a la larga. ¿Cómo te encuentras?',
    ],
    humor: [
      (d, hoy) => (d.fecha && d.que ? `${mayus(cuandoFue(d.fecha, hoy))} apuntaste que ${d.que}. Lo importante es que la sesión no ganó. ¿Cómo estás?` : null),
      () => 'Día de esos en los que la cama tira más que la barra, ¿eh? ¿Cómo estás?',
    ],
  },
  responder: {
    cercano: [() => 'Perdona la tardanza, acabo de leerte. ', () => 'Gracias por contármelo. '],
    directo: [() => 'Visto. ', () => 'Te contesto: '],
    motivador: [() => 'Bien que me lo cuentes, así lo ajustamos. ', () => 'Gracias por escribirme. '],
    humor: [() => 'Ya estoy aquí, que no se diga que no contesto. ', () => 'Recibido alto y claro. '],
  },
  pregunta_sin_respuesta: {
    cercano: [
      (d) => (d.texto ? `Te pregunté hace unos días: «${corta(d.texto)}». Cuando puedas, dime` : null),
      () => '¿Pudiste mirar lo que te pregunté el otro día? Sin prisa, cuando puedas',
    ],
    directo: [
      (d) => (d.texto ? `Retomo lo de «${corta(d.texto, 60)}»: ¿qué me dices?` : null),
      () => 'Me quedé esperando tu respuesta a lo del otro día. ¿Qué me dices?',
    ],
    motivador: [() => 'Tu respuesta a lo que te pregunté me ayuda a ajustarte bien la semana. ¿Lo hablamos?'],
    humor: [() => 'Mi pregunta del otro día sigue flotando por el chat. ¿La rescatamos?', () => 'Te dejé una pregunta y creo que se la llevó el viento. ¿Me cuentas?'],
  },
  recordatorio: {
    cercano: [() => 'Oye, una cosa que quería preguntarte: '],
    directo: [() => 'Un tema pendiente: '],
    motivador: [() => 'Quería retomar una cosa contigo: '],
    humor: [() => 'Lo tenía apuntado para no olvidarme (sí, apunto cosas): '],
  },
  pendiente_mio: {
    cercano: [(d) => (esSeguimiento(d) ? '¿Cómo sigue lo que hablamos el otro día?' : null), () => 'Oye, una cosa que tenía pendiente contarte: '],
    directo: [(d) => (esSeguimiento(d) ? 'Retomo lo del otro día: ¿cómo va?' : null), () => 'Un tema pendiente: '],
    motivador: [(d) => (esSeguimiento(d) ? '¿Cómo va lo que hablamos? Quiero ver que vamos en buena dirección' : null), () => 'Quería retomar una cosa contigo: '],
    humor: [(d) => (esSeguimiento(d) ? 'Paso a hacer seguimiento, como buen coach pesado: ¿cómo sigue lo del otro día?' : null), () => 'Lo tenía apuntado para no olvidarme (sí, apunto cosas): '],
  },
  nota_checkin: {
    cercano: [(d) => (d.nota ? `He leído tu nota del check-in: «${corta(d.nota)}». Cuéntame un poco más` : null), () => 'He leído la nota que me dejaste en el check-in. Cuéntame un poco más'],
    directo: [() => 'Visto lo que me dejaste en el check-in. Lo tengo en cuenta para la semana', () => 'Sobre la nota de tu check-in: '],
    motivador: [() => 'Gracias por dejarme la nota en el check-in: con eso puedo ajustarte mucho mejor la semana'],
    humor: [() => 'Tu nota del check-in ha llegado a buen puerto. Te cuento: '],
  },
  video: {
    cercano: [(d) => (d.n > 1 ? `Tengo tus ${d.n} vídeos pendientes: hoy los miro y te comento` : null), () => 'He visto que me mandaste vídeo. Lo miro y te digo'],
    directo: [() => 'Vídeo recibido. Hoy te lo corrijo'],
    motivador: [() => 'Gracias por grabarte: es de lo que más ayuda a mejorar la técnica. Te lo corrijo hoy'],
    humor: [() => 'Tu vídeo está en la cola de estreno. Hoy te digo qué tal'],
  },
  objetivo_propuesto: {
    cercano: [() => 'He visto el objetivo que me propusiste. Dame un día y te digo cómo lo planteamos'],
    directo: [() => 'Visto tu objetivo. Lo reviso y te contesto con el plan'],
    motivador: [() => 'Me encanta que te marques objetivos. Le doy una vuelta y lo ponemos en marcha'],
    humor: [() => 'Tu objetivo ha llegado a mi mesa. Lo estudio con lupa y te digo'],
  },
  receta: {
    cercano: [() => 'He visto que quieres cambiar alguna receta. Te busco una alternativa y te digo'],
    directo: [() => 'Visto lo de la receta. Te propongo un cambio hoy'],
    motivador: [() => 'Bien que me lo digas: el plan tiene que gustarte para que funcione. Te busco otra'],
    humor: [() => 'Receta vetada, entendido. Te busco una sustituta que pase el casting'],
  },
  enfriando: {
    cercano: [
      () => '¿Cómo estás? Te noto con menos ritmo estas semanas y quería saber si va todo bien',
      () => 'Hace tiempo que no hablamos con calma. ¿Cómo lo llevas todo, dentro y fuera del gimnasio?',
    ],
    directo: [
      () => 'Estas semanas vas con menos ritmo. ¿Qué ha cambiado? Lo ajustamos a lo que puedas',
      () => '¿Ajustamos el plan? Te veo con menos ritmo y prefiero adaptarlo a que se haga cuesta arriba',
    ],
    motivador: [
      () => 'Todo el mundo tiene rachas así. Lo importante es no soltarlo del todo: ¿lo adaptamos para que vuelva a apetecer?',
      () => 'Lo que has construido sigue ahí. Busquemos una versión de la semana que te encaje ahora',
    ],
    humor: [
      () => 'Te echo de menos por aquí. ¿Te han secuestrado o es que la vida aprieta?',
      () => 'Aviso del coach: se busca atleta con ganas de volver. ¿Cómo va todo?',
    ],
  },
  parado: {
    cercano: [
      (d) => (d.dias ? `¿Qué tal vas? Hace ${d.dias} días que no veo sesiones tuyas` : d.dias === null ? '¿Has podido empezar ya? Si tienes cualquier duda con la app o con el programa, dime' : null),
      () => '¿Cómo va todo? Hace unos días que no veo nada apuntado y quería saber de ti',
    ],
    directo: [
      (d) => (d.dias ? `Llevas ${d.dias} días sin apuntar nada. ¿Todo bien?` : d.dias === null ? 'Todavía no veo ninguna sesión tuya apuntada. ¿Te ayudo con algo para arrancar?' : null),
      (d) => (d.dias ? `${d.dias} días sin registrar. Si se te ha complicado la semana, dime y la ajustamos` : '¿Se te ha complicado la semana? Dime y la ajustamos a lo que puedas'),
    ],
    motivador: [
      (d) => (d.dias ? `${d.dias} días sin entrenar no borran nada de lo que llevas. Retomamos con una sesión cómoda y en marcha` : d.dias === null ? 'El primer día es el que más cuesta. ¿Lo hacemos esta semana? Si algo del programa no te cuadra, lo cambiamos' : null),
      () => 'Volver es lo único que importa: una sesión y ya estás otra vez en marcha. ¿Cuándo la hacemos?',
    ],
    humor: [
      (d) => (d.dias ? `Llevo ${d.dias} días sin noticias tuyas y la barra empieza a preguntar por ti. ¿Todo bien?` : d.dias === null ? 'La app está deseando ver tu primera sesión apuntada. ¿Arrancamos esta semana?' : null),
      () => 'Las pesas preguntan por ti. ¿Cómo va todo?',
    ],
  },
  dia_flojo: null, // (el día flojo se dice igual que el difícil: abajo)
  pendientes: {
    cercano: [
      (d) => (d.total ? `Llevas ${d.hechas} de ${sesiones(d.total)} esta semana. ¿Cómo lo ves para lo que queda?` : null),
      () => '¿Qué tal la semana? Si no te da tiempo a todas las sesiones, dime cuáles priorizamos',
    ],
    directo: [
      (d) => (d.faltan ? `${d.faltan === 1 ? 'Te queda 1 sesión' : `Te quedan ${d.faltan} sesiones`} esta semana. Si vas justo de tiempo, lo reorganizamos` : null),
      () => 'Si esta semana no llegas a todo, dime cuántas sesiones puedes hacer y te digo cuáles',
    ],
    motivador: [
      (d) => (d.faltan ? `Aún estás a tiempo: ${d.faltan === 1 ? 'una sesión más' : `${d.faltan} sesiones más`} y cierras la semana. ¿Cuándo las encajas?` : null),
      () => 'Todavía queda semana para cerrarla bien. ¿Cuándo encajas las que faltan?',
    ],
    humor: [
      (d) => (d.faltan ? `${d.faltan === 1 ? 'Tu sesión pendiente te echa' : `Tus ${d.faltan} sesiones pendientes te echan`} de menos. ¿Cuándo os veis?` : null),
      () => 'Las sesiones de esta semana siguen esperando su turno. ¿Cuándo les toca?',
    ],
  },
  cumplimiento: {
    cercano: [
      () => 'Estas semanas te estás dejando series de lo pautado. ¿Se te hace larga la sesión o es falta de tiempo?',
      () => 'Veo que no te da para todo lo pautado. ¿Recortamos algo para que salga completo?',
    ],
    directo: [
      (d) => (d.pct ? `Estás haciendo el ${d.pct} % de lo pautado. ¿Recorto la sesión para que salga entera?` : null),
      () => 'Te estás dejando series. Dime cuánto tiempo tienes de verdad por sesión y lo ajusto',
    ],
    motivador: [
      () => 'Mejor una sesión más corta y completa que una larga a medias. ¿La ajustamos para que te salga entera?',
      () => 'Vas entrenando, que es lo importante. Ahora vamos a que salga todo lo pautado: ¿qué te lo impide?',
    ],
    humor: [
      () => 'Las últimas series de cada sesión se sienten un poco abandonadas. ¿Las recortamos o les damos otra oportunidad?',
      () => 'Creo que a tus sesiones les sobran ejercicios o les falta reloj. ¿Cuál de las dos?',
    ],
  },
  esfuerzo: {
    cercano: [() => 'Veo que muchas series se te van por encima del RPE pautado. ¿Te cuesta calcularlo o te ves con más fuerza?'],
    directo: [() => 'Te estás pasando del RPE en bastantes series. Ajusta la carga para quedarte en lo pautado', () => 'Quédate en el RPE pautado: si sale más fácil, me lo dices y subo yo'],
    motivador: [() => 'Se nota que vas con ganas. Guárdalas para cuando toque: quedarte en el RPE pautado es lo que te hace progresar sin pararte'],
    humor: [() => 'Me alegra que vayas con fuerza de sobra, pero el RPE pautado no es una sugerencia. Un poco de calma con los discos'],
  },
  carga: {
    cercano: [() => 'La semana pasada metiste bastante más carga de lo normal. ¿Cómo te has recuperado?'],
    directo: [() => 'La semana pasada fue mucha carga para ti. Si notas fatiga, esta semana bajamos'],
    motivador: [() => 'Gran semana de trabajo la pasada. Ahora toca recuperar bien para que se note'],
    humor: [() => 'La semana pasada fuiste a por todas. ¿Tus piernas te siguen hablando?'],
  },
  habitos: {
    cercano: [() => '¿Qué tal con los hábitos? Esta semana han costado un poco más; ¿alguno que se te atragante?'],
    directo: [() => 'Los hábitos han bajado esta semana. ¿Cuál te cuesta más? Lo simplificamos'],
    motivador: [() => 'Los hábitos son los que sostienen todo lo demás. Elige uno y esta semana vamos a por ese'],
    humor: [() => 'Tus hábitos se han tomado unos días libres. ¿Los convocamos otra vez?'],
  },
  comidas: {
    cercano: [() => 'Estos días apenas veo comidas apuntadas. ¿Cómo vas con el plan?'],
    directo: [() => 'Apunta las comidas aunque no sean perfectas: con eso ajusto el plan'],
    motivador: [() => 'Apuntar las comidas es lo que me deja ajustar el plan a tu vida real. Aunque sea en dos toques, ¿lo retomamos?'],
    humor: [() => 'Tus comidas se han vuelto misteriosas: no veo ninguna apuntada. ¿Me cuentas qué estás comiendo?'],
  },
  peso: {
    cercano: [() => '¿Cómo te ves con el plan? El peso no se está moviendo como esperábamos y quiero entender por qué'],
    directo: [() => 'El peso no va al ritmo del plan. Cuéntame cómo están yendo las comidas y ajustamos'],
    motivador: [() => 'El peso va a su ritmo, pero lo que haces cuenta. Revisamos juntos el plan para que se note más'],
    humor: [() => 'La báscula está un poco terca estas semanas. ¿Le preparamos un plan B?'],
  },
  sin_bloque: {
    cercano: [() => 'Te estoy preparando el bloque nuevo. ¿Hay algo que quieras cambiar o probar?'],
    directo: [() => 'Bloque nuevo en camino. Dime si tienes algún cambio de horario o de material'],
    motivador: [() => 'Bloque nuevo en preparación: vamos a por la siguiente fase. ¿Algo que quieras priorizar?'],
    humor: [() => 'Estoy cocinando tu bloque nuevo. ¿Algún ingrediente que quieras añadir?'],
  },
  sin_checkin: {
    cercano: [() => 'No me ha llegado tu check-in de la semana pasada. Cuando puedas, mándamelo y lo miro', () => '¿Me mandas el check-in cuando tengas un rato? Así ajusto la semana con datos'],
    directo: [() => 'Me falta tu check-in de la semana pasada. Mándamelo hoy si puedes, que con él ajusto la siguiente', () => 'Check-in pendiente: son dos minutos y me ayuda mucho a ajustar'],
    motivador: [() => 'Con tu check-in afino mucho mejor la semana. ¿Me lo mandas cuando puedas?'],
    humor: [() => 'Tu check-in se ha perdido por el camino. ¿Lo rescatamos?', () => 'Sin check-in voy a ciegas. ¿Me lo mandas y me devuelves la vista?'],
  },
  record: {
    cercano: [(d) => (d.ejercicio ? `He visto el récord en ${d.ejercicio}${marca(d) ? ` (${marca(d)})` : ''}. ¿Qué tal lo sentiste?` : null), () => 'He visto tu récord. ¿Qué tal lo sentiste?'],
    directo: [(d) => (d.ejercicio ? `Récord en ${d.ejercicio}${marca(d) ? `: ${marca(d)}` : ''}. Buen trabajo` : null), () => 'Récord nuevo. Buen trabajo'],
    motivador: [(d) => (d.ejercicio ? `Récord en ${d.ejercicio}. Eso es el trabajo de semanas dando la cara. A por el siguiente` : null), () => 'Récord nuevo: esto es lo que pasa cuando hay constancia. A por el siguiente'],
    humor: [(d) => (d.ejercicio ? `Récord en ${d.ejercicio}${marca(d) ? ` (${marca(d)})` : ''}. Habrá que avisar a la barra de que ahora pesa menos` : null), () => 'Récord nuevo. A este ritmo vamos a tener que comprar más discos'],
  },
  semana_completa: {
    cercano: [(d) => (d.total > 1 ? `Las ${d.total} sesiones hechas. ¿Cómo te has visto esta semana?` : 'Semana completa. ¿Cómo te has visto esta semana?')],
    directo: [(d) => (d.total > 1 ? `Semana completa, ${d.total} de ${d.total}. Buen trabajo` : 'Semana completa. Buen trabajo')],
    motivador: [() => 'Has cerrado la semana entera. Así es como se progresa', () => 'Semana completa. Esa constancia es la que da resultados'],
    humor: [() => 'Semana completa. Ya no te quedan excusas ni sesiones pendientes', () => 'Semana cerrada al 100 %. Así da gusto programar'],
  },
  racha: {
    cercano: [(d) => (d.semanas ? `Llevas ${d.semanas} semanas sin fallar una sesión. ¿Cómo te encuentras?` : null), () => 'Llevas unas semanas sin fallar una sesión. ¿Cómo te encuentras?'],
    directo: [(d) => (d.semanas ? `${d.semanas} semanas seguidas completas. Muy buen trabajo` : null), () => 'Semanas seguidas completas. Muy buen trabajo'],
    motivador: [(d) => (d.semanas ? `${d.semanas} semanas seguidas completas. Esa constancia es la que da resultados` : null), () => 'Otra semana completa. Esa constancia es la que da resultados'],
    humor: [(d) => (d.semanas ? `${d.semanas} semanas seguidas sin fallar. Empiezo a pensar que te gusta esto` : null), () => 'Otra semana sin fallar. Empiezo a pensar que te gusta esto'],
  },
  objetivo_cumplido: {
    cercano: [(d) => (d.objetivo ? `¡Lo has conseguido: ${d.objetivo}! ¿Cómo te sientes?` : null), () => '¡Objetivo conseguido! ¿Cómo te sientes?'],
    directo: [(d) => (d.objetivo ? `Objetivo cumplido: ${d.objetivo}. ¿Pensamos el siguiente?` : null), () => 'Objetivo cumplido. ¿Pensamos el siguiente?'],
    motivador: [() => 'Objetivo conseguido. Esto es lo que pasa cuando haces el trabajo semana tras semana. A por el siguiente'],
    humor: [() => 'Objetivo cumplido. Ahora tendré que inventarme uno más difícil'],
  },
  cerca_objetivo: {
    cercano: [(d) => (d.objetivo && d.pct ? `Ya casi está: vas por el ${d.pct} % de tu objetivo (${d.objetivo}). ¿Cómo lo ves?` : null), () => 'Ya casi tienes tu objetivo. ¿Cómo lo ves?'],
    directo: [(d) => (d.pct ? `Estás al ${d.pct} % de tu objetivo. Unas semanas más así y está` : null), () => 'Estás muy cerca de tu objetivo. Unas semanas más así y está'],
    motivador: [() => 'Estás a nada de tu objetivo. Ahora es cuando se nota todo lo que llevas hecho'],
    humor: [() => 'Tu objetivo ya te ve venir. No le des tiempo a esconderse'],
  },
  cumple: {
    cercano: [(d) => (d.cuando === 'ayer' ? '¡Felicidades por tu cumpleaños de ayer! Espero que lo pasaras genial' : '¡Feliz cumpleaños! Que pases un gran día')],
    directo: [(d) => (d.cuando === 'ayer' ? 'Felicidades atrasadas. Que este año venga cargado de récords' : 'Feliz cumpleaños. Que este año venga cargado de récords')],
    motivador: [(d) => (d.cuando === 'ayer' ? 'Felicidades atrasadas. Un año más, y más fuerte que el anterior. A por este' : '¡Feliz cumpleaños! Un año más, y más fuerte que el anterior. A por este')],
    humor: [
      (d) => (d.cuando === 'ayer' ? 'Felicidades con un día de retraso. La tarta de ayer, perdonada' : '¡Feliz cumpleaños! Hoy la tarta no cuenta como saltarse el plan'),
      (d) => (d.cuando === 'ayer' ? null : '¡Felicidades! Un año más, y no lo digo por las repeticiones'),
    ],
  },
  aniversario: {
    cercano: [(d) => (d.anos ? `Estos días se cumple ${anos(d.anos)} desde que empezamos. Gracias por la confianza` : null), () => 'Ya llevamos tiempo entrenando juntos. Gracias por la confianza'],
    directo: [(d) => (d.anos ? `${mayus(anos(d.anos))} entrenando juntos. Buen trabajo todo este tiempo` : null), () => 'Ya llevamos tiempo entrenando juntos. Buen trabajo todo este tiempo'],
    motivador: [(d) => (d.anos ? `${mayus(anos(d.anos))} de trabajo constante. Mira dónde estabas y dónde estás ahora. A por el siguiente` : null), () => 'Mira dónde estabas cuando empezamos y dónde estás ahora. A por más'],
    humor: [(d) => (d.anos ? `${mayus(anos(d.anos))} aguantándome como coach. Eso también merece una medalla` : null), () => 'Ya llevas tiempo aguantándome como coach. Eso también merece una medalla'],
  },
  primera_semana: {
    cercano: [() => 'Te doy la bienvenida al equipo. ¿Qué tal estos primeros días? Cualquier duda con la app o el programa, me dices'],
    directo: [() => '¿Todo claro con el programa y la app? Si algo no encaja, lo cambiamos esta semana'],
    motivador: [() => 'Primera semana en marcha: lo más difícil ya está hecho, que es empezar. ¿Cómo te encuentras?'],
    humor: [() => 'Primera semana superada (o casi). ¿La app te trata bien o tengo que hablar con ella?'],
  },
  vuelta_pausa: {
    cercano: [() => '¡Qué bien tenerte de vuelta! ¿Cómo estás? Empezamos suave y vamos subiendo'],
    directo: [() => 'De vuelta. Estas primeras sesiones van más suaves para retomar. Dime cómo te sientan'],
    motivador: [() => 'Volver es lo que cuenta. Retomamos con calma y en unas semanas estás donde lo dejaste'],
    humor: [() => 'Se acabaron las vacaciones del hierro. ¿Con ganas de volver?'],
  },
  fin_bloque: {
    cercano: [() => 'Última semana del bloque. ¿Cómo te has visto estas semanas? Me sirve para preparar el siguiente'],
    directo: [() => 'Esta es la última semana del bloque. Dime qué te ha funcionado y qué no, y lo tengo en cuenta para el siguiente'],
    motivador: [() => 'Última semana del bloque: a cerrarlo bien. Luego vemos todo lo que has avanzado'],
    humor: [() => 'Última semana del bloque: el último capítulo de la temporada. Que no decaiga'],
  },
  bloque_nuevo: {
    cercano: [() => 'Empezamos bloque nuevo. ¿Qué tal las primeras sesiones? Dime si algo no te encaja'],
    directo: [() => 'Bloque nuevo: revisa los ejercicios y dime si alguno no te cuadra antes de cogerle el ritmo'],
    motivador: [() => 'Bloque nuevo, objetivos nuevos. Esta fase te va a gustar. A por ella'],
    humor: [() => 'Bloque nuevo recién salido del horno. Cuidado, que quema'],
  },
  descarga: {
    cercano: [() => 'Esta semana toca descarga: menos series y sin apretar. Aprovecha para recuperar bien'],
    directo: [() => 'Semana de descarga: menos volumen y repeticiones en recámara. No es para apretar'],
    motivador: [() => 'La descarga también es entrenar: es lo que te deja llegar con fuerza al siguiente bloque'],
    humor: [() => 'Semana de descarga: tu permiso oficial para no darlo todo. Disfrútalo'],
  },
  carrera_antes: {
    cercano: [(d) => (d.nombre ? `${d.dias === 0 ? 'Hoy' : d.dias === 1 ? 'Mañana' : 'Esta semana'} tienes ${d.nombre}. ¿Cómo llegas?` : null), () => 'Mucha suerte en la carrera. Disfrútala'],
    directo: [(d) => (d.nombre ? `${d.nombre}, ${d.dias === 0 ? 'hoy' : d.dias === 1 ? 'mañana' : `en ${d.dias} días`}: sal a tu ritmo y no te dejes llevar los primeros kilómetros` : null), () => 'Sal a tu ritmo y no te dejes llevar los primeros kilómetros'],
    motivador: [() => 'Has hecho el trabajo; ahora toca disfrutarla. A por ella'],
    humor: [() => 'Recuerda: la carrera se gana en la meta, no en el primer kilómetro. ¡Suerte!'],
  },
  carrera_despues: {
    cercano: [(d) => (d.nombre ? `¿Qué tal ${d.nombre}? Cuéntamelo todo` : null), () => '¿Qué tal la carrera? Cuéntamelo todo'],
    directo: [(d) => (d.nombre ? `¿Cómo fue ${d.nombre}? Dime tiempo, sensaciones y cómo tienes las piernas` : null), () => '¿Cómo fue la carrera? Dime tiempo, sensaciones y cómo tienes las piernas'],
    motivador: [() => 'Enhorabuena por la carrera, salga como salga el tiempo: llegar a la salida ya es mucho trabajo. ¿Cómo fue?'],
    humor: [() => '¿Qué tal la carrera? ¿Ya puedes bajar escaleras?'],
  },
  viaje: {
    cercano: [() => '¿Cómo vas con el viaje? Si quieres, te adapto las sesiones a lo que tengas allí'],
    directo: [() => 'Para el viaje: dime qué material tienes y cuántos días, y te dejo una versión corta'],
    motivador: [() => 'De viaje también se puede mantener: con dos sesiones cortas no pierdes nada. Te las preparo'],
    humor: [() => 'Las pesas no caben en la maleta, pero las sesiones sí. ¿Te preparo una versión viajera?'],
  },
  fiestas: {
    cercano: [() => '¿Cómo vas con las fiestas? Disfrútalas; si quieres, ajustamos las sesiones a tu agenda'],
    directo: [() => 'Para estas fiestas: dime qué días puedes entrenar y adapto la semana'],
    motivador: [() => 'En Navidad no se trata de progresar, sino de no soltarlo. Con un par de sesiones por semana, en enero lo agradeces'],
    humor: [() => 'Navidad: turrón, cenas y sentadillas. No en ese orden, pero casi. ¿Cómo lo llevas?'],
  },
  saludo: {
    cercano: [
      (d, hoy) => (d.nutricion ? '¿Qué tal llevas el plan esta semana?' : d.sesion && d.fecha ? `¿Qué tal fue ${d.sesion} ${cuandoFue(d.fecha, hoy)}?` : '¿Cómo va la semana?'),
      (d) => (d.nutricion ? '¿Qué tal de hambre y de energía estos días?' : '¿Cómo te encuentras estos días?'),
    ],
    directo: [
      (d) => (d.nutricion ? '¿Cómo vas con las comidas? ¿Algo que se te esté haciendo cuesta arriba?' : '¿Qué tal vas con el programa? ¿Algo que quieras ajustar?'),
      () => '¿Todo en orden esta semana? Si hay algo que cambiar, dime',
    ],
    motivador: [
      (d) => (d.nutricion ? 'Pasaba a ver cómo vas con el plan. Cada semana que lo sigues cuenta' : 'Pasaba a ver cómo vas. Sigue así, que se nota el trabajo'),
      () => '¿Cómo va la semana? Aquí sigo para lo que necesites',
    ],
    humor: [
      () => 'Control de calidad del coach: ¿qué tal va la semana?',
      (d) => (d.sesion ? `¿Qué tal ${d.sesion}? Cuéntame, que me encanta el cotilleo de gimnasio` : '¿Qué tal todo? Cuéntame, que me encanta el cotilleo de gimnasio'),
    ],
  },
};
// El día flojo se dice igual que el difícil
FRASES.dia_flojo = FRASES.dia_malo;

export const MAX_BORRADOR = 600;
const lista = (motivo, tono) => {
  const f = FRASES[motivo?.id] || FRASES.saludo;
  return f[tono] || f.cercano;
};
export const cuantasFrases = (motivo, tono = 'cercano') => lista(motivo, tono).length;
export const hayFrases = (id) => !!FRASES[id];

// Un número estable para (atleta, día): con qué frase empieza cada uno (que no les llegue a todos la misma)
export function varianteInicial(atletaId, hoy) {
  let h = 0;
  for (const ch of `${atletaId}|${hoy}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Para comparar con lo ya enviado: sin tildes, mayúsculas, signos ni espacios de más
export const normalFrase = (t) => normalLetras(String(t || '')).replace(/[^a-z0-9\u00f1]+/g, ' ').trim();
// ¿Esta frase ya se la mandaste? enviados: los textos normalizados (normalFrase) de tus mensajes recientes
export function yaEnviada(frase, enviados = []) {
  const f = normalFrase(frase);
  if (f.length < 12) return false;
  return (enviados || []).some((e) => e && (e === f || (e.length >= 12 && (e.includes(f) || f.includes(e)))));
}

// El borrador de un motivo en un tono. Primero las frases con su dato (el ejercicio, los días, la zona) y después las
// que valen para cualquiera. variante: cualquier entero estable (atleta y día: con qué frase con dato empieza cada
// uno); vuelta: cuántas veces se ha pedido otra (va pasando por todas). Con evitar (textos ya enviados, normalizados),
// se salta las que ya le mandaste.
export function borradorDe(motivo, { hoy, variante = 0, vuelta = 0, tono = 'cercano', evitar = [] } = {}) {
  const l = lista(motivo, TONOS.includes(tono) ? tono : 'cercano');
  const d = motivo?.datos || {};
  const conDato = [], general = [];
  for (const fn of l) { const t = fn(d, hoy); if (t) (fn.length > 0 ? conDato : general).push(t); }
  const giro = conDato.length ? ((Math.trunc(variante) % conDato.length) + conDato.length) % conDato.length : 0;
  const orden = [...new Set([...conDato.slice(giro), ...conDato.slice(0, giro), ...general])];
  if (!orden.length) return String(FRASES.saludo.cercano[1](d, hoy) || '').slice(0, MAX_BORRADOR);
  const n = orden.length, i0 = ((Math.trunc(vuelta) % n) + n) % n;
  for (let k = 0; k < n; k++) { const t = orden[(i0 + k) % n]; if (!yaEnviada(t, evitar)) return t.slice(0, MAX_BORRADOR); }
  return orden[i0].slice(0, MAX_BORRADOR);
}
// Cuántas frases distintas hay para ese motivo en ese tono con sus datos (para «Otras frases»)
export function cuantasConDatos(motivo, { hoy, tono = 'cercano' } = {}) {
  const d = motivo?.datos || {};
  return new Set(lista(motivo, tono).map((fn) => fn(d, hoy)).filter(Boolean)).size;
}

const UNIONES = ['Por cierto, ', 'Y otra cosa: ', 'Además, '];
// La primera letra en minúscula (detrás de «¿» o «¡» también), salvo siglas como «RPE»
const minusPrimera = (t) => {
  if (/^[\u00bf\u00a1]/.test(t)) return t.charAt(0) + minusPrimera(t.slice(1));
  return t.length > 1 && /[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/.test(t.charAt(1)) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};
const conPunto = (t) => (/[.?!:\u2026]\s*$/.test(t) ? t.trimEnd() : `${t.trimEnd()}.`);

// (v0.201) Varios temas en un mensaje, en el orden de importancia y unidos con naturalidad. «Contestarle» es una
// entrada: lo siguiente va detrás sin «Por cierto».
export function borradorVarios(motivos = [], { hoy, variante = 0, vuelta = 0, tono = 'cercano', evitar = [] } = {}) {
  const xs = [...(motivos || [])].filter(Boolean).sort((a, b) => ORDEN_MOTIVOS.indexOf(a.id) - ORDEN_MOTIVOS.indexOf(b.id));
  if (!xs.length) return borradorDe(null, { hoy, variante, vuelta, tono, evitar });
  if (xs.length === 1) return borradorDe(xs[0], { hoy, variante, vuelta, tono, evitar });
  let out = '', unidas = 0;
  xs.forEach((m, i) => {
    const t = borradorDe(m, { hoy, variante: variante + i, vuelta, tono, evitar });
    if (!t) return;
    if (!out) { out = t; return; }
    const entrada = /[\s:]$/.test(out);   // «Visto. », «Un tema pendiente: »
    if (entrada) out = `${out.trimEnd()} ${t}`;
    else out = `${conPunto(out)} ${UNIONES[Math.min(unidas++, UNIONES.length - 1)]}${minusPrimera(t)}`;
  });
  return out.replace(/\.\s*$/, '').slice(0, MAX_BORRADOR);
}

// ---------- (v0.201) Tu manera de escribir ----------
// saludo: 'no' (de serie) | 'nombre' («Ana, …») | 'hola' («Hola, Ana. …»); apodo: con su apodo si lo tiene;
// cierre: tu frase de despedida («¡Vamos!»); emoji: uno al final; corto: solo la primera frase de cada tema
export const ESTILO_DEFECTO = { saludo: 'no', apodo: false, cierre: '', emoji: '', corto: false };
export const EMOJIS_ESTILO = ['', '💪', '🔥', '🙌', '😊', '👊'];
export const MAX_CIERRE = 40;
export function limpiarEstilo(x) {
  const e = x && typeof x === 'object' ? x : {};
  const cierre = [...String(e.cierre || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_CIERRE).join('');
  return {
    saludo: ['no', 'nombre', 'hola'].includes(e.saludo) ? e.saludo : 'no',
    apodo: e.apodo === true, cierre, emoji: EMOJIS_ESTILO.includes(e.emoji) ? e.emoji : '', corto: e.corto === true,
  };
}
// Solo la primera frase (si lo que queda después es otra frase entera); una entrada («Visto. ») se deja como está
function primeraFrase(t) {
  if (/[\s:]$/.test(t)) return t;
  const m = /^(.{20,}?[.?!])\s+(\S.*)$/s.exec(t);
  return m ? m[1].replace(/\.$/, '') : t;
}
export function aplicarEstilo(texto, estilo = ESTILO_DEFECTO, { nombre = '', apodo = '' } = {}) {
  const e = limpiarEstilo(estilo);
  let t = String(texto || '');
  if (!t.trim()) return t;
  const entrada = /[\s:]$/.test(t);
  if (e.corto && !entrada) {
    // Cada tema por su lado (van unidos con «Por cierto, …»), y de cada uno la primera frase
    let marcado = t;
    for (const u of UNIONES) marcado = marcado.split(` ${u}`).join(`\n${u}`);
    const partes = marcado.split('\n').map(primeraFrase);
    t = partes.map((p, i) => (i < partes.length - 1 ? conPunto(p) : p)).join(' ');
  }
  const quien = (e.apodo && apodo ? apodo : nombre || '').trim();
  if (quien && e.saludo === 'nombre') t = `${quien}, ${minusPrimera(t)}`;
  else if (quien && e.saludo === 'hola') t = `Hola, ${quien}. ${t}`;
  if (!entrada) {
    if (e.cierre) t = `${conPunto(t)} ${e.cierre}`;
    if (e.emoji) t = `${t.trimEnd()} ${e.emoji}`;
  }
  return t.slice(0, MAX_BORRADOR);
}
