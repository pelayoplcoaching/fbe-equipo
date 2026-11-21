// «A quién escribir» (el radar de contacto del coach): contactos, motivos, borradores, reparto y lo apuntado a mano.
// Lógica pura, y la lectura de datos contra la demo.
//   node test/radar.test.mjs
import { difusiones, contactosPorAtleta, contactoDe, textoContacto, haceDias, DIAS_SIN_CONTESTAR,
  motivosDe, semanasSeguidas, cuandoFue, queApunto,
  borradorDe, cuantasFrases, varianteInicial, MAX_BORRADOR,
  radar, filaRadar, ordenRadar, textoResumenRadar, AJUSTES_RADAR, GRUPOS_RADAR,
  leerLocal, limpiarLocal, marcarHablado, posponer, PREFIJO_RADAR,
  TONOS, NOMBRE_TONO, borradorVarios, aplicarEstilo, limpiarEstilo, ESTILO_DEFECTO, EMOJIS_ESTILO, normalFrase, yaEnviada, cuantasConDatos, hayFrases,
  SITUACIONES, motivoDeSituacion, ultimosMensajes, programadosPorAtleta, mensajesDelAtleta, cuandoSale,
  leerPendiente, escribirPendiente, pendientesPorAtleta, textoSeguimiento, enfriandoDe, resumenCheckin, objetivoPrincipal,
  limpiarAjustesRadar, limpiarEnlace, objetivoDe, OBJETIVOS, conEnvio, MAX_ENVIOS, tonoQueContesta, juntarLocal, conHablado, conPospuesto,
  historiaContacto, cumplimientoContacto, horaHabitual, motivosOtros } from '../web/src/logica/radar/index.js';
import { rellenarHuecos, HUECOS } from '../web/src/logica/mensajes.js';
import { sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

const HOY = '2026-11-05';                                  // jueves
const AHORA = Date.parse('2026-11-05T18:00:00+01:00');
const dia = (n) => sumarDias(HOY, -n);
// Un mensaje a las 12:00 de Madrid de hace n días
let nid = 0;
const M = (atleta, autor, n, extra = {}) => ({ id: `c${++nid}`, atleta_id: atleta, autor, creado_en: `${dia(n)}T11:00:00.000Z`, eliminado_en: null, enviar_en: null, cliente_id: null, ...extra });

console.log('Difusiones');
{
  const cs = [M('a', 'coach', 1, { cliente_id: 'x' }), M('b', 'coach', 1, { cliente_id: 'x' }), M('a', 'coach', 2, { cliente_id: 'y' }), M('a', 'coach', 2, { cliente_id: 'y' }),
    M('a', 'coach', 3), M('b', 'coach', 3), M('c', 'coach', 3), M('a', 'coach', 4), M('b', 'coach', 4), M('a', 'atleta', 1, { cliente_id: 'x' })];
  const d = difusiones(cs);
  check(d.has(cs[0].id) && d.has(cs[1].id), 'el mismo envío (cliente_id) a dos atletas es una difusión');
  check(!d.has(cs[2].id) && !d.has(cs[3].id), 'el mismo cliente_id dos veces al mismo atleta (un reintento) no lo es');
  check(d.has(cs[4].id) && d.has(cs[5].id) && d.has(cs[6].id), 'sin cliente_id, tres atletas en el mismo instante exacto lo son');
  check(!d.has(cs[7].id) && !d.has(cs[8].id), 'dos en el mismo instante, no');
  check(!d.has(cs[9].id), 'los mensajes del atleta nunca');
  check(difusiones([]).size === 0 && difusiones([null, {}]).size === 0, 'sin mensajes (o con basura), ninguna');
}

console.log('Contactos');
{
  const cs = [
    M('a', 'coach', 0), M('a', 'coach', 0), M('a', 'coach', 3), M('a', 'coach', 8), M('a', 'coach', 20), M('a', 'coach', 40),
    M('b', 'coach', 1, { cliente_id: 'dif' }), M('c', 'coach', 1, { cliente_id: 'dif' }),
    M('b', 'coach', 2, { eliminado_en: '2026-11-03T12:00:00Z' }),
    M('b', 'coach', 5, { enviar_en: '2026-11-09T08:00:00.000Z' }),                  // programado: aún no ha salido
    M('c', 'coach', 9, { enviar_en: `${dia(2)}T08:00:00.000Z` }),                   // programado: salió hace 2 días
    M('d', 'coach', 4), M('d', 'atleta', 2), M('d', 'atleta', 1, { resumen_sesion: true }),
    M('e', 'atleta', 20), M('f', 'atleta', 3), M('f', 'coach', 3, { creado_en: `${dia(3)}T15:00:00.000Z` }),
    { id: 'tarde', atleta_id: 'g', autor: 'coach', creado_en: `${dia(1)}T23:30:00.000Z`, eliminado_en: null },   // 00:30 de hoy en Madrid
  ];
  const c = contactosPorAtleta(cs, { hoy: HOY, ahora: AHORA });
  const a = contactoDe(c, 'a');
  check(igual(a.dias, [dia(20), dia(8), dia(3), dia(0)]), 'los días con contacto de las 4 últimas semanas, sin repetir (dos mensajes el mismo día son un contacto)');
  check(a.en7 === 2 && a.mensajes7 === 3, 'en los últimos 7 días: 2 días de contacto (3 mensajes)');
  check(a.ultimo === HOY && a.diasSin === 0, 'el último contacto, hoy');
  check(igual(a.semanas, [0, 1, 1, 2]), 'los días de contacto de cada ventana de 7 días, de la más antigua a la actual');
  const b = contactoDe(c, 'b');
  check(b.en7 === 0 && b.ultimo === null && b.diasSin === null, 'las difusiones, lo eliminado y lo programado sin salir no cuentan');
  const cc = contactoDe(c, 'c');
  check(cc.en7 === 1 && cc.ultimo === dia(2), 'un mensaje programado cuenta el día en que sale, no el día en que se escribió');
  check(contactoDe(c, 'g').ultimo === HOY, 'el día es el de Madrid (las 23:30 UTC ya son mañana)');
  const d = contactoDe(c, 'd');
  check(d.teEscribio && d.teEscribio.dia === dia(2) && d.teEscribio.hace === 2, 'te escribió y lo último es suyo: sin contestar (el resumen automático de la sesión no cuenta)');
  check(contactoDe(c, 'e').teEscribio === null, `un mensaje suyo de hace más de ${DIAS_SIN_CONTESTAR} días ya no se da por pendiente`);
  check(contactoDe(c, 'f').teEscribio === null, 'si le contestaste después, nada pendiente');
  check(contactoDe(c, 'nadie').en7 === 0 && igual(contactoDe(c, 'nadie').semanas, [0, 0, 0, 0]) && contactoDe(null, 'x').dias.length === 0, 'de quien no hay mensajes, todo a cero');
  // Lo apuntado a mano
  const f = contactosPorAtleta(cs, { hoy: HOY, ahora: AHORA, fuera: { b: [HOY, dia(40), 'mal'], d: [dia(1)], z: [dia(2)] } });
  check(contactoDe(f, 'b').en7 === 1 && contactoDe(f, 'b').diasSin === 0 && igual(contactoDe(f, 'b').fuera, [HOY]), '«Ya hablamos» cuenta como contacto de ese día (lo caducado y lo raro se tira)');
  check(contactoDe(f, 'd').teEscribio === null, 'y da por contestado lo que te escribió antes');
  check(contactoDe(f, 'z').en7 === 1, 'también de quien no tiene ningún mensaje en la app');
  check(contactosPorAtleta(cs, { hoy: dia(1), ahora: AHORA }).a.ultimo === dia(3), 'lo posterior al día pedido no cuenta');
  check(haceDias(null) === 'nunca' && haceDias(0) === 'hoy' && haceDias(1) === 'ayer' && haceDias(5) === 'hace 5 días', 'hace cuánto, en palabras');
  check(textoContacto(a) === '2 de 2 días de contacto en los últimos 7 · último: hoy' && textoContacto(b) === '0 de 2 días de contacto en los últimos 7 · sin mensajes tuyos en 4 semanas'
    && textoContacto(cc, { objetivo: 1 }) === '1 de 1 día de contacto en los últimos 7 · último: hace 2 días', 'la línea de contacto de cada atleta');
}

console.log('Motivos');
const R = (extra = {}) => ({ atleta_id: 'a', nombre: 'Ana López', estado: 'activo', servicio: 'completo', sesiones: { completadas: 1, total: 4 }, alertas: [], ultimaSerie: dia(1), checkin: { semana: '2026-10-26' }, chispas: { sesiones: [] }, ...extra });
const ids = (ms) => ms.map((m) => m.id).join(',');
{
  check(ids(motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 } }), hoy: HOY })) === 'saludo', 'sin nada especial, solo saludar');
  check(motivosDe({ resumen: null, hoy: HOY }).length === 0, 'sin resumen, ningún motivo');
  // Lo que va flojo
  const parado = motivosDe({ resumen: R({ ultimaSerie: dia(6), alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: '6 días sin registrar series' }] }), hoy: HOY });
  check(ids(parado) === 'parado,saludo' && parado[0].datos.dias === 6 && parado[0].grupo === 'flojo' && parado[0].etiqueta === '6 días sin registrar series', 'lleva días sin registrar (el aviso del panel), con los días');
  check(motivosDe({ resumen: R({ ultimaSerie: null, alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: 'Todavía no ha registrado ninguna serie' }] }), hoy: HOY })[0].datos.dias === null, 'quien no ha empezado: sin días');
  check(ids(motivosDe({ resumen: R(), hoy: HOY })) === 'pendientes,saludo', 'jueves con 1 de 4 sesiones: le quedan sesiones');
  check(ids(motivosDe({ resumen: R(), hoy: '2026-11-04' })) === 'saludo', 'el miércoles aún no se le dice nada');
  check(ids(motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 } }), hoy: HOY })) === 'saludo', 'con la mitad hechas, tampoco');
  const flojo = motivosDe({ resumen: R({ alertas: [{ tipo: 'sin_checkin', nivel: 'info', texto: 'Sin check-in la semana pasada' }, { tipo: 'cumplimiento', nivel: 'aviso', texto: 'Solo el 60 % de lo pautado (4 sem.)' }], cumplimiento: { series: { pct: 60 } } }), hoy: HOY });
  check(ids(flojo) === 'pendientes,cumplimiento,sin_checkin,saludo' && flojo[1].datos.pct === 60, 'cumplimiento bajo y sin check-in, en su orden');
  check(ids(motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 }, checkin: null, alertas: [{ tipo: 'sin_checkin', nivel: 'info', texto: 'Sin check-in la semana pasada' }] }), hoy: HOY })) === 'saludo', 'a quien nunca ha enviado un check-in no se le reclama el de la semana pasada');
  // Lo que va bien
  const bien = motivosDe({ resumen: R({ sesiones: { completadas: 4, total: 4 }, chispas: { sesiones: [{ hechas: 1, total: 3 }, { hechas: 3, total: 3 }, { hechas: 4, total: 4 }, { hechas: 4, total: 4 }] } }),
    records: [{ ejercicio: 'Sentadilla', texto: '1RM estimado 100 kg (antes 97,5)', fecha: dia(2) }, { ejercicio: 'Banca', texto: '', fecha: dia(3) }, { ejercicio: 'Viejo', texto: '', fecha: dia(9) }], hoy: HOY });
  check(ids(bien) === 'record,semana_completa,racha,saludo', 'récord reciente (uno), semana completa y racha');
  check(bien[0].datos.ejercicio === 'Sentadilla' && bien[1].datos.total === 4 && bien[2].datos.semanas === 3 && bien.every((m) => m.id === 'saludo' || m.nivel === 'ok'), 'con sus datos, en verde');
  check(!ids(motivosDe({ resumen: R(), records: [{ ejercicio: 'Viejo', texto: '', fecha: dia(9) }], hoy: HOY })).includes('record'), 'un récord de hace más de 7 días ya no es motivo');
  check(semanasSeguidas([{ hechas: 3, total: 3 }, { hechas: 2, total: 3 }, { hechas: 3, total: 3 }, { hechas: 1, total: 3 }]) === 1
    && semanasSeguidas([{ hechas: 0, total: 0 }, { hechas: 3, total: 3 }, { hechas: 0, total: 3 }]) === 1 && semanasSeguidas([]) === 0
    && semanasSeguidas([{ hechas: 3, total: 3 }, { hechas: 0, total: 0 }, { hechas: 3, total: 3 }, { hechas: 0, total: 3 }]) === 1, 'semanas seguidas completas: hasta la pasada (la actual, si ya lo está); una sin plan corta la racha');
  // Molestias y días malos
  const mol = (nivel, ultimo = null) => motivosDe({ resumen: R({ alertas: [{ tipo: 'molestia', nivel, texto: nivel === 'alerta' ? 'Dolor grave: Rodilla, hombro' : 'Dolor moderado: Rodilla' }] }), ultimoContacto: ultimo, hoy: HOY });
  check(mol('alerta')[0].id === 'molestia_fuerte' && mol('alerta')[0].urgente && mol('alerta')[0].datos.zonas === 'Rodilla, hombro' && mol('alerta')[0].desde === '2026-10-30', 'molestia fuerte: lo primero, urgente, con las zonas');
  check(!mol('alerta', '2026-10-31')[0].urgente && mol('alerta', '2026-10-29')[0].urgente, 'deja de ser urgente si le has escrito desde el viernes de ese check-in');
  check(mol('aviso')[0].id === 'molestia' && !mol('aviso')[0].urgente, 'la moderada es motivo, no urgencia');
  const conDia = (ultimo) => motivosDe({ resumen: R({ alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Dolor grave: Rodilla' }] }), ultimoContacto: ultimo, checkinEl: '2026-11-02', hoy: HOY })[0];
  check(conDia('2026-10-31').urgente && !conDia('2026-11-02').urgente && conDia(null).desde === '2026-11-02', 'sabiendo el día en que envió el check-in, cuenta desde ese día (un mensaje anterior no lo da por hablado)');
  const prep = (p, n, ultimo = null) => motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 } }), sesiones: [{ nombre: 'Pierna A', fecha: dia(n), preparacion: p }, { nombre: 'Torso A', fecha: dia(5), preparacion: { sueno: 3, energia: 3, molestias: 3 } }], ultimoContacto: ultimo, hoy: HOY });
  const malo = prep({ sueno: 1, energia: 1, molestias: 2 }, 1);
  check(malo[0].id === 'dia_malo' && malo[0].urgente && malo[0].etiqueta === 'Día difícil ayer (Pierna A)' && malo[0].datos.que === 'habías dormido mal y ibas con la energía baja', 'día difícil en «¿Cómo llegas hoy?»: urgente, con lo que apuntó');
  check(!prep({ sueno: 1, energia: 1, molestias: 2 }, 1, dia(1))[0].urgente, 'ya no es urgente si le has escrito ese día o después');
  const flo = prep({ sueno: 1, energia: 2, molestias: 3 }, 2);
  check(flo[0].id === 'dia_flojo' && !flo[0].urgente && flo[0].nivel === 'info', 'el día flojo es motivo, sin urgencia');
  check(ids(prep({ sueno: 1, energia: 1, molestias: 1 }, 4)) === 'saludo', 'de hace más de 3 días ya no se saca');
  check(ids(prep({ sueno: 3, energia: 3, molestias: 3 }, 1)) === 'saludo' && ids(prep(null, 1)) === 'saludo', 'un buen día (o sin contestar) no es motivo');
  check(queApunto({ sueno: 1, energia: 1, molestias: 1 }) === 'habías dormido mal, ibas con la energía baja y tenías bastantes agujetas o molestias' && queApunto({ sueno: 2, energia: 2, molestias: 2 }) === 'no llegabas en tu mejor día', 'lo que apuntó, en una frase');
  // El saludo lleva su última sesión; solo nutrición, nada de entreno
  check(prep(null, 2).at(-1).datos.sesion === 'Pierna A' && prep(null, 2).at(-1).datos.fecha === dia(2), 'el saludo lleva su última sesión');
  const nut = motivosDe({ resumen: R({ servicio: 'nutricion', sesiones: { completadas: 0, total: 0 }, alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: 'x' }, { tipo: 'sin_checkin', nivel: 'info', texto: 'Sin check-in la semana pasada' }] }), hoy: HOY });
  check(ids(nut) === 'sin_checkin,saludo' && nut.at(-1).datos.nutricion === true, 'a quien solo lleva nutrición no se le habla de entrenos');
  check(cuandoFue(HOY, HOY) === 'hoy' && cuandoFue(dia(1), HOY) === 'ayer' && cuandoFue(dia(3), HOY) === 'el lunes' && cuandoFue(dia(9), HOY) === 'el día 27', 'cuándo fue, en palabras');
  // El orden: salud fuerte, día difícil, molestia, parado, día flojo, lo que va bien, lo demás, saludar
  const todo = motivosDe({ resumen: R({ sesiones: { completadas: 4, total: 4 }, alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Dolor grave: Lumbar' }, { tipo: 'sin_checkin', nivel: 'info', texto: 's' }, { tipo: 'cumplimiento', nivel: 'aviso', texto: 'c' }] }),
    sesiones: [{ nombre: 'S', fecha: dia(0), preparacion: { sueno: 1, energia: 1, molestias: 1 } }], records: [{ ejercicio: 'E', texto: '', fecha: dia(0) }], hoy: HOY });
  check(ids(todo) === 'molestia_fuerte,dia_malo,llamada,record,semana_completa,cumplimiento,sin_checkin,saludo', 'el orden de los motivos');
}

console.log('Borradores');
{
  const casos = [
    R({ alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Dolor grave: Rodilla' }] }),
    R({ alertas: [{ tipo: 'molestia', nivel: 'aviso', texto: 'Dolor moderado' }] }),
    R({ ultimaSerie: dia(6), alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: '6 días sin registrar series' }] }),
    R({ ultimaSerie: null, alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: 'Todavía no ha registrado ninguna serie' }] }),
    R({ alertas: [{ tipo: 'sin_checkin', nivel: 'info', texto: 's' }, { tipo: 'cumplimiento', nivel: 'aviso', texto: 'c' }] }),
    R({ sesiones: { completadas: 4, total: 4 }, chispas: { sesiones: [{ hechas: 3, total: 3 }, { hechas: 3, total: 3 }, { hechas: 4, total: 4 }] } }),
    R({ sesiones: { completadas: 1, total: 1 } }), R({ sesiones: { completadas: 0, total: 2 } }), R({ sesiones: { completadas: 1, total: 3 } }),
    R({ servicio: 'nutricion', sesiones: { completadas: 0, total: 0 } }),
  ];
  const sesionesDe = [[], [{ nombre: 'Torso A', fecha: dia(0), preparacion: { sueno: 1, energia: 1, molestias: 1 } }], [{ nombre: 'Pierna B', fecha: dia(2), preparacion: { sueno: 1, energia: 3, molestias: 3 } }], [{ nombre: 'Full body', fecha: dia(5), preparacion: null }]];
  const records = [{ ejercicio: 'Sentadilla barra alta', texto: '1RM estimado 100 kg (antes 97,5)', fecha: dia(1) }];
  // Todas las situaciones de la biblioteca, sin datos (elegidas a mano), en los cuatro tonos
  const aMano = SITUACIONES.flatMap(([, xs]) => xs.map(([id]) => ({ id, datos: {} })));
  const vistos = new Set(); const malos = []; let n = 0;
  const GENERO = /\b(listo|lista|preparado|preparada|motivado|motivada|cansado|cansada|bienvenido|vivo|viva|sobrado|sobrada|seguro|segura|contento|contenta)\b/i;
  const revisa = (m, t, tono, v) => {
    n++;
    const entrada = /[\s:]$/.test(t);   // las entradas («Visto. », «Un tema pendiente: ») esperan que sigas escribiendo
    if (!t || t.length > 200 || /undefined|null|NaN|\[object|\s{2}|\(\)/.test(t) || /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t) || /^(hola|buenas)/i.test(t)
      || (!entrada && /\.$/.test(t)) || (!entrada && t !== t.trim()) || t[0] !== t[0].toUpperCase() || GENERO.test(t)) malos.push(`${m.id}/${tono}/${v}: ${t}`);
  };
  for (const r of casos) for (const ss of sesionesDe) for (const rec of [[], records]) {
    for (const m of motivosDe({ resumen: r, sesiones: ss, records: rec, hoy: HOY })) {
      vistos.add(m.id);
      for (const tono of TONOS) for (let v = 0; v < cuantasFrases(m, tono); v++) revisa(m, borradorDe(m, { hoy: HOY, vuelta: v, tono }), tono, v);
    }
  }
  for (const m of aMano) for (const tono of TONOS) for (let v = 0; v < cuantasFrases(m, tono); v++) revisa(m, borradorDe(m, { hoy: HOY, vuelta: v, tono }), tono, v);
  check(malos.length === 0, `${n} borradores (todos los motivos, las situaciones a mano y los cuatro tonos): cortos, sin emojis, sin saludo de fórmula ni punto final, sin huecos y sin depender del género${malos.length ? `: ${malos.slice(0, 3).join(' | ')}` : ''}`);
  check(['molestia_fuerte', 'molestia', 'dia_malo', 'dia_flojo', 'parado', 'pendientes', 'cumplimiento', 'sin_checkin', 'record', 'semana_completa', 'racha', 'saludo'].every((k) => vistos.has(k)), 'la prueba pasa por los doce motivos de siempre');
  check(aMano.length >= 36 && aMano.every((m) => hayFrases(m.id)) && TONOS.length === 4 && TONOS.every((t) => NOMBRE_TONO[t]), 'cada situación de la biblioteca tiene sus frases, y hay cuatro tonos');
  const m = (id, datos) => ({ id, datos });
  check(borradorDe(m('parado', { dias: 6 }), { hoy: HOY, tono: 'directo' }) === 'Llevas 6 días sin apuntar nada. ¿Todo bien?', 'lleva días sin registrar');
  check(borradorDe(m('parado', { dias: null }), { hoy: HOY }) === '¿Has podido empezar ya? Si tienes cualquier duda con la app o con el programa, dime', 'quien no ha empezado');
  check(borradorDe(m('record', { ejercicio: 'Sentadilla', texto: '1RM estimado 100 kg (antes 97,5)' }), { hoy: HOY, tono: 'directo' }) === 'Récord en Sentadilla: 1RM estimado 100 kg. Buen trabajo', 'el récord, con la marca y sin la coletilla «(antes…)»');
  check(borradorDe(m('semana_completa', { total: 4 }), { hoy: HOY, tono: 'directo' }) === 'Semana completa, 4 de 4. Buen trabajo' && borradorDe(m('semana_completa', { total: 1 }), { hoy: HOY, tono: 'directo' }) === 'Semana completa. Buen trabajo', 'semana completa (con una sola sesión, sin la cuenta)');
  check(borradorDe(m('pendientes', { hechas: 1, total: 4, faltan: 3 }), { hoy: HOY, tono: 'directo' }) === 'Te quedan 3 sesiones esta semana. Si vas justo de tiempo, lo reorganizamos'
    && borradorDe(m('pendientes', { hechas: 1, total: 2, faltan: 1 }), { hoy: HOY, tono: 'directo' }).startsWith('Te queda 1 sesión'), 'le quedan sesiones (en singular también)');
  check(borradorDe(m('dia_malo', { sesion: 'Pierna A', fecha: dia(1), que: 'habías dormido mal' }), { hoy: HOY }) === 'Ayer apuntaste que habías dormido mal. ¿Cómo estás hoy?'
    && borradorDe(m('dia_malo', { sesion: 'Pierna A', fecha: HOY, que: 'habías dormido mal' }), { hoy: HOY }) === 'Hoy apuntaste que habías dormido mal. ¿Cómo ha ido?'
    && borradorDe(m('dia_flojo', { sesion: 'Pierna A', fecha: dia(3), que: 'habías dormido mal' }), { hoy: HOY, vuelta: 1 }) === '¿Qué tal la sesión del lunes? Vi que habías dormido mal', 'el día difícil, con su día («del lunes», «de ayer»)');
  check(borradorDe(m('molestia', { zonas: 'Rodilla, hombro' }), { hoy: HOY }) === 'Vi lo que apuntaste en el check-in (rodilla, hombro). ¿Cómo sigue?' && borradorDe(m('molestia', { zonas: '' }), { hoy: HOY }) === 'Vi lo que apuntaste en el check-in. ¿Cómo sigue?'
    && borradorDe(m('molestia', { zonas: 'Hombros (moderada), Zona lumbar (leve)' }), { hoy: HOY }) === 'Vi lo que apuntaste en el check-in (hombros, zona lumbar). ¿Cómo sigue?', 'la molestia, con sus zonas (sin la intensidad entre paréntesis) o sin ellas');
  check(borradorDe(m('saludo', { sesion: 'Torso A', fecha: dia(1) }), { hoy: HOY }) === '¿Qué tal fue Torso A ayer?' && borradorDe(m('saludo', {}), { hoy: HOY }) === '¿Cómo va la semana?'
    && borradorDe(m('saludo', { nutricion: true }), { hoy: HOY }) === '¿Qué tal llevas el plan esta semana?', 'el saludo: con su última sesión, sin ella y para quien solo lleva nutrición');
  check(borradorDe(m('saludo', {}), { hoy: HOY, vuelta: 2 }) === borradorDe(m('saludo', {}), { hoy: HOY, vuelta: 0 }) && borradorDe(m('saludo', {}), { hoy: HOY, vuelta: -1 }) === borradorDe(m('saludo', {}), { hoy: HOY, vuelta: 1 }), 'las frases dan la vuelta (cualquier entero vale)');
  check(borradorDe(null, { hoy: HOY }) === '¿Cómo va la semana?' && borradorDe(m('raro', {}), { hoy: HOY }) === '¿Cómo va la semana?' && cuantasFrases(m('raro')) === 2, 'un motivo desconocido cae en el saludo');
  // Los cuatro tonos, distintos; primero las frases con su dato; lo ya enviado se salta
  const rec = m('record', { ejercicio: 'Press banca', texto: '80 kg × 5' });
  const cuatro = TONOS.map((t) => borradorDe(rec, { hoy: HOY, tono: t }));
  check(new Set(cuatro).size === 4 && cuatro.every((t) => t.includes('Press banca')), `los cuatro tonos dicen cosas distintas, todos con el dato: ${cuatro.join(' | ')}`);
  check(borradorDe(rec, { hoy: HOY, tono: 'humor', variante: 7 }).includes('Press banca'), 'la variante (atleta y día) gira entre las frases con dato, sin caer en la de cualquiera');
  const yaDicho = [normalFrase(cuatro[1])];
  check(borradorDe(rec, { hoy: HOY, tono: 'directo', evitar: yaDicho }) !== cuatro[1] && yaEnviada(`${cuatro[1]}!`, yaDicho) && !yaEnviada('Hola', yaDicho), 'una frase que ya le mandaste se salta (y se reconoce aunque cambie un signo)');
  check(borradorDe(m('sin_checkin', {}), { hoy: HOY, tono: 'motivador', evitar: [normalFrase(borradorDe(m('sin_checkin', {}), { hoy: HOY, tono: 'motivador' }))] }).length > 0, 'si todas se enviaron ya, vuelve a la primera (nunca vacío)');
  check(cuantasConDatos(rec, { hoy: HOY, tono: 'cercano' }) === 2 && cuantasConDatos(m('video', {}), { hoy: HOY, tono: 'directo' }) === 1, 'cuántas frases distintas hay con esos datos (para «Otras frases»)');
  // Varios temas en un mensaje
  const mol = m('molestia', { zonas: 'Hombros' });
  const ck = m('sin_checkin', {});
  const varios = borradorVarios([ck, rec, mol], { hoy: HOY });
  check(varios.startsWith('Vi lo que apuntaste en el check-in (hombros). ¿Cómo sigue? Por cierto, he visto el récord en Press banca') && varios.includes(' Y otra cosa: no me ha llegado tu check-in') && !/\.$/.test(varios), `varios temas, en orden de importancia y unidos («Por cierto», «Y otra cosa»): «${varios}»`);
  check(borradorVarios([m('responder', { mensajeId: 'x' }), rec], { hoy: HOY, tono: 'directo' }) === 'Visto. Récord en Press banca: 80 kg × 5. Buen trabajo', 'contestarle es una entrada: lo demás va detrás sin «Por cierto»');
  check(borradorVarios([], { hoy: HOY }) === '¿Cómo va la semana?' && borradorVarios([rec], { hoy: HOY, tono: 'directo' }) === borradorDe(rec, { hoy: HOY, tono: 'directo' }), 'sin temas, saludar; con uno, su frase');
  // Tu manera de escribir
  const base = borradorVarios([mol, rec], { hoy: HOY });
  check(aplicarEstilo(base, { saludo: 'nombre' }, { nombre: 'Ana' }).startsWith('Ana, vi lo que apuntaste') && aplicarEstilo(base, { saludo: 'hola' }, { nombre: 'Ana' }).startsWith('Hola, Ana. Vi lo que'), 'empezar con su nombre («Ana, …» o «Hola, Ana. …»)');
  check(aplicarEstilo(base, { saludo: 'nombre', apodo: true }, { nombre: 'Ana', apodo: 'Anita' }).startsWith('Anita, ') && aplicarEstilo(base, { saludo: 'nombre', apodo: true }, { nombre: 'Ana', apodo: '' }).startsWith('Ana, '), 'con su apodo si lo tiene (si no, su nombre)');
  check(aplicarEstilo('Récord nuevo. Buen trabajo', { cierre: '¡Vamos!', emoji: '💪' }) === 'Récord nuevo. Buen trabajo. ¡Vamos! 💪' && aplicarEstilo('¿Cómo sigue?', { cierre: 'Un abrazo' }) === '¿Cómo sigue? Un abrazo', 'tu cierre y tu emoji, al final y con su punto');
  check(aplicarEstilo(base, { corto: true }) === 'Vi lo que apuntaste en el check-in (hombros). Por cierto, he visto el récord en Press banca (80 kg × 5)', `más corto: la primera frase de cada tema («${aplicarEstilo(base, { corto: true })}»)`);
  check(aplicarEstilo('Visto. ', { cierre: '¡Vamos!', emoji: '💪', saludo: 'nombre' }, { nombre: 'Ana' }) === 'Ana, visto. ', 'a una entrada no se le pone cierre ni emoji (sigues escribiendo tú)');
  check(aplicarEstilo('¿Qué tal?', ESTILO_DEFECTO, { nombre: 'Ana' }) === '¿Qué tal?' && aplicarEstilo('RPE alto', { saludo: 'nombre' }, { nombre: 'Ana' }) === 'Ana, RPE alto', 'de serie no cambia nada; las siglas no se pasan a minúscula');
  const raro = limpiarEstilo({ saludo: 'grito', apodo: 'si', cierre: `a\nb${'x'.repeat(60)}`, emoji: '🐍', corto: 1 });
  check(raro.saludo === 'no' && raro.apodo === false && raro.cierre.length === 40 && !/\n/.test(raro.cierre) && raro.emoji === '' && raro.corto === false && EMOJIS_ESTILO.includes(''), 'lo que no vale se limpia (saludo, emoji, cierre de 40 como mucho y sin saltos)');
  // Los huecos de tus respuestas
  check(rellenarHuecos('{nombre}: {ejercicio} en {dias} días. {apodo}', { nombre: 'Ana', ejercicio: 'Sentadilla', dias: 3 }) === 'Ana: Sentadilla en 3 días. Ana'
    && rellenarHuecos('Hola {apodo}, {marca} y {objetivo}', { nombre: 'Ana', apodo: 'Anita' }) === 'Hola Anita, {marca} y {objetivo}' && HUECOS.length === 7, 'los huecos se rellenan con lo que se sabe; lo que no, se queda a la vista; {apodo} sin apodo es su nombre');
}

console.log('A quién escribir hoy');
{
  const res = [
    R({ atleta_id: 'cero', nombre: 'Cero' }), R({ atleta_id: 'viejo', nombre: 'Viejo' }), R({ atleta_id: 'ayer', nombre: 'Ayer' }), R({ atleta_id: 'dos', nombre: 'Dos' }),
    R({ atleta_id: 'escribe', nombre: 'Escribe' }), R({ atleta_id: 'dolor', nombre: 'Dolor', alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Dolor grave: Lumbar' }], checkin: { semana: '2026-10-26' } }),
    R({ atleta_id: 'luego', nombre: 'Luego' }), R({ atleta_id: 'baja', nombre: 'Baja', estado: 'baja' }), R({ atleta_id: 'inv', nombre: 'Invitada', estado: 'invitado' }),
    R({ atleta_id: 'alba', nombre: 'Alba' }),
  ];
  const cs = [M('viejo', 'coach', 5), M('ayer', 'coach', 1), M('dos', 'coach', 0), M('dos', 'coach', 4), M('escribe', 'coach', 2), M('escribe', 'coach', 4), M('escribe', 'atleta', 1),
    M('dolor', 'coach', 0), M('dolor', 'coach', 3), M('alba', 'coach', 5)];
  const x = radar({ resumenes: res, contactos: contactosPorAtleta(cs, { hoy: HOY, ahora: AHORA }), pospuestos: { luego: sumarDias(HOY, 1), cero: dia(1) }, hoy: HOY });
  const g = Object.fromEntries(x.filas.map((f) => [f.atleta_id, f]));
  check(x.filas.length === 8 && !g.baja && !g.inv, 'solo los atletas activos');
  check(g.cero.grupo === 'hoy' && g.cero.porque === 'Ningún mensaje personal tuyo en las últimas 4 semanas' && g.cero.faltan === 2, 'sin ningún contacto: hoy');
  check(g.viejo.grupo === 'hoy' && g.viejo.porque === 'Tu último mensaje personal fue hace 5 días' && g.viejo.faltan === 1, 'por debajo del objetivo y sin saber de ti desde hace días: hoy');
  check(g.ayer.grupo === 'pronto' && g.ayer.porque === 'Le escribiste ayer: le toca otra vez mañana', 'por debajo, pero le escribiste ayer: en unos días (y dice cuándo)');
  check(g.dos.grupo === 'al_dia' && g.dos.faltan === 0 && g.dos.porque === '2 días de contacto en los últimos 7', 'con el objetivo cumplido: al día');
  check(g.escribe.grupo === 'hoy' && g.escribe.contacto.en7 === 2 && /^Te escribió ayer/.test(g.escribe.porque) && g.escribe.teEscribio.hace === 1, 'aunque vaya al día, si te escribió y lo último es suyo: hoy');
  check(g.dolor.grupo === 'al_dia' && !g.dolor.urgente, 'una molestia fuerte ya hablada (le has escrito desde el check-in) no vuelve a saltar');
  check(g.luego.grupo === 'pospuesto' && g.luego.porque === 'Lo dejaste para mañana' && g.luego.pospuestoHasta === sumarDias(HOY, 1) && g.cero.grupo === 'hoy', 'lo pospuesto espera a su día (lo caducado ya no cuenta)');
  check(igual(x.cuenta, { hoy: 4, pronto: 1, al_dia: 2, pospuesto: 1 }) && igual(GRUPOS_RADAR, ['hoy', 'pronto', 'al_dia', 'pospuesto']), 'cuántos hay en cada grupo');
  check(igual(x.filas.map((f) => f.atleta_id), ['escribe', 'cero', 'alba', 'viejo', 'ayer', 'dolor', 'dos', 'luego']), 'el orden: hoy (quien te escribió, quien nunca supo de ti, quien lleva más días y, a igualdad, por nombre), en unos días, al día, pospuestos');
  check(x.resumen.atletas === 8 && x.resumen.cumplen === 3 && x.resumen.sinContacto === 2 && x.objetivo === 2 && x.resumen.mediaSemanas.length === 4, 'el resumen del equipo');
  check(textoResumenRadar(x) === '3 de 8 con 2 días de contacto en los últimos 7; 2 sin ningún mensaje tuyo', 'y su frase');
  check(textoResumenRadar(radar({ resumenes: [], hoy: HOY })) === 'Aún no tienes atletas activos', 'sin atletas, lo dice');
  check(g.cero.motivo.id === 'pendientes' && g.cero.motivos.at(-1).id === 'saludo' && g.cero.primerNombre === 'Cero', 'cada fila lleva sus motivos (el primero, el principal)');
  // Urgente sin hablar: hoy, aunque cumpla el objetivo
  const u = filaRadar({ resumen: { ...res[5], checkin: { semana: '2026-11-02' } }, contacto: contactoDe(contactosPorAtleta([M('dolor', 'coach', 2), M('dolor', 'coach', 8)], { hoy: HOY, ahora: AHORA }), 'dolor'), hoy: HOY, ajustes: { objetivo: 1 } });
  check(u.grupo === 'hoy' && u.urgente && u.faltan === 0 && u.porque === 'Molestia fuerte en el check-in y aún no habéis hablado', 'una molestia fuerte sin hablar: hoy, aunque vaya al día');
  const dm = filaRadar({ resumen: R(), contacto: contactoDe(contactosPorAtleta([M('a', 'coach', 2), M('a', 'coach', 3)], { hoy: HOY, ahora: AHORA }), 'a'), sesiones: [{ nombre: 'Pierna', fecha: dia(1), preparacion: { sueno: 1, energia: 1, molestias: 1 } }], hoy: HOY });
  check(dm.grupo === 'hoy' && dm.porque === 'Llegó en un día difícil y aún no habéis hablado', 'un día difícil sin hablar: hoy');
  // Con otro objetivo
  const uno = radar({ resumenes: res, contactos: contactosPorAtleta(cs, { hoy: HOY, ahora: AHORA }), hoy: HOY, ajustes: { objetivo: 1 } });
  check(uno.resumen.cumplen === 6 && uno.filas.find((f) => f.atleta_id === 'viejo').grupo === 'al_dia' && /con 1 día de contacto/.test(textoResumenRadar(uno)), 'con objetivo de 1 día, el listón baja');
  check(igual(AJUSTES_RADAR, { objetivo: 2, separacion: 2 }), 'de serie: 2 días por semana y no proponer a quien le escribiste hoy o ayer');
  check(ordenRadar(null).length === 0, 'ordenar nada no rompe');
}

console.log('Lo apuntado a mano (en el dispositivo)');
{
  const caja = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
  const a = caja();
  check(igual(leerLocal(a, 'u1', HOY), { fuera: {}, pospuestos: {} }), 'vacío al empezar');
  let e = marcarHablado(a, 'u1', 'ana', HOY);
  check(igual(e.fuera, { ana: [HOY] }) && igual(leerLocal(a, 'u1', HOY).fuera, { ana: [HOY] }) && [...a._m.keys()][0] === `${PREFIJO_RADAR}u1`, '«Ya hablamos» apunta hoy y se guarda');
  check(igual(marcarHablado(a, 'u1', 'ana', HOY).fuera, { ana: [HOY] }), 'dos veces el mismo día, una');
  check(igual(leerLocal(a, 'u2', HOY), { fuera: {}, pospuestos: {} }), 'cada usuario, lo suyo');
  e = posponer(a, 'u1', 'ruben', HOY, 1);
  check(igual(e.pospuestos, { ruben: sumarDias(HOY, 1) }) && igual(e.fuera, { ana: [HOY] }), '«Mañana» lo deja para mañana');
  check(igual(posponer(a, 'u1', 'ruben', HOY, 30).pospuestos, { ruben: sumarDias(HOY, 7) }), 'como mucho, una semana');
  check(igual(leerLocal(a, 'u1', sumarDias(HOY, 7)).pospuestos, {}) && igual(leerLocal(a, 'u1', sumarDias(HOY, 6)).pospuestos, { ruben: sumarDias(HOY, 7) }), 'al llegar el día, deja de estar pospuesto');
  check(igual(posponer(a, 'u1', 'ruben', HOY, 0).pospuestos, {}), '«Proponer ya» lo quita');
  posponer(a, 'u1', 'ana', HOY, 1);
  check(igual(marcarHablado(a, 'u1', 'ana', HOY).pospuestos, {}), 'al apuntar que habéis hablado, deja de estar pospuesto');
  check(igual(marcarHablado(a, 'u1', 'ana', HOY, false).fuera, {}), 'y se puede deshacer');
  marcarHablado(a, 'u1', 'ana', HOY);
  check(igual(leerLocal(a, 'u1', sumarDias(HOY, 27)).fuera, { ana: [HOY] }) && igual(leerLocal(a, 'u1', sumarDias(HOY, 28)).fuera, {}), 'lo apuntado caduca a las 4 semanas');
  check(igual(limpiarLocal({ fuera: { a: 'x', b: [1, null, '2026-13-99x', HOY, HOY], c: [sumarDias(HOY, 1)] }, pospuestos: { a: 5, b: HOY, c: 'mañana' } }, HOY), { fuera: { b: [HOY] }, pospuestos: {} })
    && igual(limpiarLocal(null, HOY), { fuera: {}, pospuestos: {} }) && igual(limpiarLocal('x', HOY), { fuera: {}, pospuestos: {} }), 'lo guardado con otra forma se descarta');
  const rota = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
  check(igual(leerLocal(rota, 'u', HOY), { fuera: {}, pospuestos: {} }) && igual(marcarHablado(rota, 'u', 'a', HOY).fuera, { a: [HOY] }) && igual(leerLocal(null, 'u', HOY), { fuera: {}, pospuestos: {} }), 'sin almacén (bloqueado o lleno) no rompe: solo no se recuerda');
  a.setItem(`${PREFIJO_RADAR}u1`, '{mal');
  check(igual(leerLocal(a, 'u1', HOY), { fuera: {}, pospuestos: {} }), 'ni con lo guardado estropeado');
}

console.log('(v0.201) Lo último de cada conversación, lo programado y cuánto escribe');
{
  const cs = [M('a', 'coach', 3), M('a', 'atleta', 1), M('b', 'atleta', 4), M('b', 'coach', 2), M('c', 'coach', 1, { cliente_id: 'd' }), M('d', 'coach', 1, { cliente_id: 'd' }),
    M('e', 'atleta', 0, { resumen_sesion: true }), M('e', 'coach', 2)];
  const u = ultimosMensajes(cs, { ahora: AHORA });
  check(u.a.atleta.dia === dia(1) && u.a.coach.dia === dia(3) && u.b.coach.dia === dia(2) && u.b.atleta.dia === dia(4), 'lo último del atleta y lo último tuyo, de cada uno');
  check(!u.c?.coach && !u.d?.coach && !u.e.atleta && u.e.coach.dia === dia(2), 'sin las difusiones ni los resúmenes automáticos de sesión');
  const futuro = new Date(AHORA + 15 * 3600000).toISOString(), luego = new Date(AHORA + 40 * 3600000).toISOString();
  const pg = programadosPorAtleta([{ id: 'p1', atleta_id: 'a', autor: 'coach', creado_en: dia(0), enviar_en: luego }, { id: 'p2', atleta_id: 'a', autor: 'coach', creado_en: dia(0), enviar_en: futuro },
    { id: 'p3', atleta_id: 'b', autor: 'coach', creado_en: dia(1), enviar_en: new Date(AHORA - 3600000).toISOString() }, { id: 'p4', atleta_id: 'c', autor: 'coach', creado_en: dia(0), enviar_en: futuro, eliminado_en: dia(0) }], { ahora: AHORA });
  check(pg.a?.id === 'p2' && !pg.b && !pg.c, 'lo programado que aún no ha salido (el más próximo); ni lo ya enviado ni lo eliminado');
  check(cuandoSale('2026-11-06T08:00:00Z', HOY) === 'mañana a las 9:00' && cuandoSale('2026-11-05T17:30:00Z', HOY) === 'hoy a las 18:30' && cuandoSale('2026-11-09T08:00:00Z', HOY) === 'el lunes a las 9:00', 'cuándo sale, en palabras y en hora de Madrid');
  const me = mensajesDelAtleta([M('a', 'atleta', 1), M('a', 'atleta', 3), M('a', 'atleta', 15), M('a', 'atleta', 16), M('a', 'atleta', 20), M('a', 'atleta', 27), M('a', 'atleta', 30), M('a', 'coach', 1)], { hoy: HOY, ahora: AHORA });
  check(me.a.ult === 2 && me.a.prev === 4, 'cuántos mensajes te ha escrito en las 2 últimas semanas y en las 2 anteriores');
}

console.log('(v0.201) Tus temas pendientes');
{
  const t = escribirPendiente('  Preguntarle   por la boda ', { desde: HOY });
  check(t === '#pend:2026-11-05# Preguntarle por la boda' && leerPendiente(t).texto === 'Preguntarle por la boda' && leerPendiente(t).desde === HOY && leerPendiente(t).hecho === null, 'se escriben con su marca (y se leen)');
  check(leerPendiente(escribirPendiente('x', { desde: HOY, hecho: dia(-1) })).hecho === dia(-1) && escribirPendiente('', { desde: HOY }) === null && escribirPendiente('x', { desde: 'mal' }) === null && leerPendiente('Nota normal') === null && leerPendiente('#ej:abc# nota') === null, 'hechos, vacíos, sin fecha y notas normales');
  const notas = [{ id: '1', atleta_id: 'a', texto: '#pend:2026-11-04# Uno' }, { id: '2', atleta_id: 'a', texto: '#pend:2026-11-01:hecho:2026-11-03# Hecho' }, { id: '3', atleta_id: 'a', texto: 'Normal' }, { id: '4', atleta_id: 'a', texto: '#pend:2026-11-02# Antes' }];
  const pa = pendientesPorAtleta(notas);
  check(pa.a.map((p) => p.id).join(',') === '4,1' && pendientesPorAtleta(notas, { todos: true }).a.length === 3, 'los abiertos de cada atleta, del más antiguo al más nuevo (con todos: también los hechos)');
  check(textoSeguimiento('Molestias: Hombros') === 'Preguntar cómo sigue: molestias: Hombros' && textoSeguimiento('') === 'Preguntar cómo sigue', 'el texto de «Recuérdamelo»');
}

console.log('(v0.201) Cómo está: si se enfría, su check-in y su objetivo');
{
  const sem = (xs) => ({ servicio: 'completo', chispas: { sesiones: xs.map((h) => ({ hechas: h, total: 3 })) } });
  const enf = enfriandoDe({ resumen: sem([3, 3, 3, 1, 0, 0]), mensajes: { ult: 1, prev: 6 }, conexion: `${dia(9)}T10:00:00Z`, hoy: HOY });
  check(enf && enf.razones.length === 3 && /9 días/.test(enf.razones[0].texto) && /0,5 sesiones por semana, antes 3/.test(enf.razones[1].texto) && /1 mensaje en 2 semanas, antes 6/.test(enf.razones[2].texto), 'se enfría: no abre la app, entrena menos que su media y te escribe menos (con el porqué)');
  check(enfriandoDe({ resumen: sem([3, 3, 3, 1, 0, 0]), mensajes: null, conexion: null, hoy: HOY }) === null, 'con una sola señal, no');
  check(enfriandoDe({ resumen: sem([1, 1, 1, 0, 0, 0]), mensajes: { ult: 0, prev: 2 }, conexion: `${dia(2)}T10:00:00Z`, hoy: HOY }) === null, 'quien entrenaba poco o escribía poco, no cuenta como enfriarse');
  const rc = resumenCheckin({ semana_inicio: '2026-11-02', horas_sueno: '5-6', energia: 2, recuperacion: 4, motivacion: 5, adherencia_desayuno: 5, adherencia_comida: 3, notas: ' Semana dura ', revisado_en: null });
  check(rc.partes.join(' · ') === 'Sueño 5-6 h · Energía 2/5 · Recuperación 4/5 · Motivación 5/5 · Comida 80 %' && rc.nota === 'Semana dura' && rc.bajo.join(',') === 'sueño,energía' && resumenCheckin(null) === null, 'su check-in en una línea, con su nota y lo que va bajo');
  const ob = objetivoPrincipal([{ id: 'x', titulo: 'Viejo', estado: 'completado' }, { id: 'y', titulo: 'Sentadilla 140', auto: { pct: 88, prevision: { fecha: '2027-01-10', aTiempo: true } } }]);
  check(ob.titulo === 'Sentadilla 140' && ob.pct === 88 && ob.cerca && !ob.conseguido && ob.aTiempo === true, 'su objetivo en curso, con su progreso: cerca y en fecha');
  check(objetivoPrincipal([{ titulo: 'Peso 70', autoPeso: { pct: 100, llegado: true } }]).conseguido && objetivoPrincipal([{ titulo: 'Peso 70', autoPeso: { pct: 20, alejandose: true } }]).peso.alejandose && objetivoPrincipal([]) === null, 'conseguido, peso que se aleja y sin objetivos');
}

console.log('(v0.201) Los motivos nuevos');
{
  const con = (extra, r = {}, ultimo = null) => motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 }, ...r }), ultimoContacto: ultimo, hoy: HOY, extra });
  const resp = con({ teEscribio: { dia: dia(1) }, mensajeAtleta: { id: 'm1', texto: '¿Cambio el press?' } });
  check(resp[0].id === 'responder' && resp[0].pendiente && resp[0].datos.pregunta && resp[0].datos.mensajeId === 'm1' && resp[0].etiqueta === 'Te escribió ayer', 'te escribió: lo primero que contestar, con su texto (y si era una pregunta)');
  check(ids(con({ preguntaCoach: { texto: '¿Qué tal la rodilla?', dia: dia(4) } })) === 'pregunta_sin_respuesta,saludo' && ids(con({ preguntaCoach: { texto: '¿Qué tal?', dia: dia(1) } })) === 'saludo'
    && ids(con({ preguntaCoach: { texto: 'Buen trabajo', dia: dia(4) } })) === 'saludo', 'tu pregunta sin respuesta, desde los 3 días (y solo si era una pregunta)');
  const pm = con({ pendientes: [{ id: 'n1', texto: 'Preguntarle por la boda', desde: dia(1) }, { id: 'n2', texto: 'Futuro', desde: dia(-2) }] });
  check(pm[0].id === 'pendiente_mio' && pm[0].clave === 'pend-n1' && pm[0].pideHoy && !pm.some((m) => m.etiqueta === 'Futuro'), 'tus pendientes que ya han llegado (los de otro día, aún no), con su clave y pidiendo hoy');
  check(!con({ pendientes: [{ id: 'n1', texto: 'x', desde: dia(1) }] }, {}, dia(0))[0].pideHoy, 'si ya le has escrito desde entonces, no pide hoy (pero sigue pendiente hasta que lo marques)');
  check(con({ recordatorio: { fecha: HOY, texto: 'Mirar su rodilla' } })[0].pideHoy === 'Tu recordatorio: «Mirar su rodilla»' && ids(con({ recordatorio: { fecha: dia(-1), texto: 'x' } })) === 'saludo', 'tu recordatorio de la lista de Atletas, cuando llega su día');
  check(ids(con({ checkin: { notas: 'Duermo poco', revisado_en: null, semana_inicio: '2026-10-26' } })) === 'nota_checkin,saludo' && ids(con({ checkin: { notas: 'x', revisado_en: '2026-11-04', semana_inicio: '2026-10-26' } })) === 'saludo'
    && ids(con({ checkin: { notas: 'x', revisado_en: null, semana_inicio: '2026-10-26' } }, {}, dia(0))) === 'saludo', 'una nota en su check-in sin revisar ni contestar');
  check(ids(con({ videos: { n: 2, desde: dia(2) }, propuestas: 1 }, { alertas: [{ tipo: 'receta', nivel: 'aviso', texto: 'Pide cambiar una receta' }] })) === 'video,objetivo_propuesto,receta,saludo', 'vídeos sin corregir, un objetivo propuesto y una receta que pide cambiar');
  const flojos = con({ enfriando: { razones: [{ id: 'app', texto: 'a' }, { id: 'entrena', texto: 'b' }] } }, { alertas: [{ tipo: 'esfuerzo', nivel: 'info', texto: 'RPE' }, { tipo: 'carga', nivel: 'info', texto: 'C' }, { tipo: 'habitos', nivel: 'info', texto: 'H' }, { tipo: 'nutricion_registro', texto: 'N' }, { tipo: 'nutricion_ritmo', texto: 'P' }, { tipo: 'sin_bloque', nivel: 'aviso', texto: 'S' }] });
  check(ids(flojos) === 'enfriando,llamada,esfuerzo,carga,habitos,comidas,peso,sin_bloque,saludo' && flojos[0].datos.razones.length === 2, 'se enfría y los avisos del panel que antes no miraba (y, si se enfría, proponerle una llamada)');
  const cumpleHoy = con({ cumple: { mes: 11, dia: 5 } });
  check(cumpleHoy[0].id === 'cumple' && cumpleHoy[0].pideHoy === 'Hoy es su cumpleaños' && con({ cumple: { mes: 11, dia: 4 } })[0].datos.cuando === 'ayer' && ids(con({ cumple: { mes: 11, dia: 4 } }, {}, dia(1))) === 'saludo', 'su cumpleaños hoy (o ayer, si aún no le has escrito)');
  const car = con({ carreras: [{ nombre: '10K', fecha: dia(-1) }, { nombre: 'Media', fecha: dia(2) }, { nombre: 'Lejana', fecha: dia(-10) }] });
  check(car.find((m) => m.id === 'carrera_antes')?.etiqueta === '10K: mañana' && car.find((m) => m.id === 'carrera_antes').pideHoy && car.find((m) => m.id === 'carrera_despues')?.datos.nombre === 'Media' && !car.some((m) => /Lejana/.test(m.etiqueta)), 'antes y después de una carrera (la de mañana pide hoy)');
  check(con({ pausaFin: dia(2) })[0].id === 'vuelta_pausa' && ids(con({ pausaFin: dia(9) })) === 'saludo', 'vuelve de una pausa (en la última semana)');
  check(ids(con({}, { fecha_alta: dia(3) })) === 'nuevo_dia3,saludo' && ids(con({}, { fecha_alta: dia(5) })) === 'primera_semana,saludo' && ids(con({}, { fecha_alta: dia(0) })) === 'nuevo_dia1,saludo' && con({}, { fecha_alta: '2025-11-05' })[0].pideHoy === 'Hoy hace 1 año que empezó en FBE' && ids(con({}, { fecha_alta: '2024-11-03' })) === 'aniversario,saludo', 'su primera semana y su aniversario con FBE');
  check(ids(con({}, { semana: { numero: 4, total: 4, foco: 'descarga' }, bloque: { nombre: 'Fuerza' } })) === 'fin_bloque,descarga,saludo' && ids(con({}, { semana: { numero: 1, total: 4 } })) === 'bloque_nuevo,saludo', 'fin de bloque, bloque nuevo y descarga');
  check(ids(con({ objetivo: { titulo: 'Sentadilla 140', conseguido: true } })) === 'objetivo_cumplido,saludo' && con({ objetivo: { titulo: 'S', cerca: true, pct: 90 } })[0].etiqueta === 'Cerca de su objetivo (90 %)', 'su objetivo, conseguido o cerca');
  check(ids(motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 } }), hoy: '2026-12-24' })) === 'fiestas,saludo' && ids(motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 } }), hoy: '2027-01-07' })) === 'saludo', 'en Navidad, el tema de las fiestas');
  check(motivoDeSituacion('viaje', []).etiqueta === 'De viaje' && motivoDeSituacion('molestia', motivosDe({ resumen: R({ alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Dolor grave: Rodilla' }] }), hoy: HOY })).id === 'molestia_fuerte' && motivoDeSituacion('raro', []).grupo === 'saludo', 'elegir una situación de la biblioteca (si ya está detectada, la detectada)');
}

console.log('(v0.201) A quién escribir: lo que pide hoy y lo programado');
{
  const alDia = [M('x', 'coach', 0), M('x', 'coach', 3)];
  const cts = contactosPorAtleta(alDia, { hoy: HOY, ahora: AHORA });
  const fila = (extra = {}, programado = null) => filaRadar({ resumen: R({ atleta_id: 'x', sesiones: { completadas: 2, total: 4 } }), contacto: cts.x, hoy: HOY, extra, programado });
  check(fila().grupo === 'al_dia' && fila({ cumple: { mes: 11, dia: 5 } }).grupo === 'al_dia', 'al día; su cumpleaños no lo saca si hoy ya le has escrito');
  const sin = contactosPorAtleta([M('y', 'coach', 2), M('y', 'coach', 3)], { hoy: HOY, ahora: AHORA });
  const f2 = filaRadar({ resumen: R({ atleta_id: 'y', sesiones: { completadas: 2, total: 4 } }), contacto: sin.y, hoy: HOY, extra: { cumple: { mes: 11, dia: 5 } } });
  check(f2.grupo === 'hoy' && f2.porque === 'Hoy es su cumpleaños' && f2.hito?.tipo === 'cumple', 'aunque vaya al día, su cumpleaños lo pone en «Hoy», con el porqué y su hito');
  const lejos = contactosPorAtleta([M('z', 'coach', 9)], { hoy: HOY, ahora: AHORA });
  const fz = filaRadar({ resumen: R({ atleta_id: 'z', sesiones: { completadas: 2, total: 4 } }), contacto: lejos.z, hoy: HOY, programado: { enviar_en: '2026-11-06T08:00:00Z' } });
  check(fz.grupo === 'pronto' && fz.porque === 'Tienes un mensaje programado para mañana a las 9:00', 'si tocaba hoy pero tienes un mensaje programado, «En unos días»: ya le llega');
  const fp = filaRadar({ resumen: R({ atleta_id: 'z', sesiones: { completadas: 2, total: 4 } }), contacto: lejos.z, hoy: HOY, extra: { pendientes: [{ id: 'n', texto: 'Boda', desde: dia(1) }], videos: { n: 1 } } });
  check(fp.pendientes.map((m) => m.id).join(',') === 'pendiente_mio,video' && fp.extra.videos.n === 1, 'cada fila lleva lo pendiente de hablar y lo suyo');
}

console.log('(v0.202) Lo tuyo en la base: objetivo, tono, enlace, envíos, «Ya hablamos» y «Mañana»');
{
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const aj = limpiarAjustesRadar({ objetivos: { [A]: 3, [B]: 7, mal: 1 }, tonos: { [A]: 'humor', [B]: 'gritón' }, enlace: 'https://calendly.com/pelayo/30min',
    envios: [{ a: A, t: '2026-11-01T10:00:00Z', tono: 'directo' }, { a: 'x', t: 'y', tono: 'z' }], hablado: { [A]: [{ dia: dia(1), canal: 'whatsapp' }, { dia: dia(40) }, { dia: dia(2), canal: 'raro' }] },
    pospuestos: { [A]: dia(-1), [B]: dia(1) }, reenganche: { [A]: dia(3), [B]: 'no' }, estilo: { saludo: 'hola' } }, HOY);
  check(aj.objetivos[A] === 3 && !(B in aj.objetivos) && aj.tonos[A] === 'humor' && !(B in aj.tonos) && aj.enlace.startsWith('https://calendly.com/') && aj.estilo.saludo === 'hola', 'se limpia: objetivos de 1 a 3, tonos que existen, enlace http(s) y tu manera de escribir');
  check(aj.envios.length === 1 && aj.envios[0].t === '2026-11-01T10:00Z' && aj.hablado[A].length === 2 && aj.hablado[A][1].canal === 'whatsapp' && aj.hablado[A][0].canal === 'app' && aj.pospuestos[A] === dia(-1) && !aj.pospuestos[B] && aj.reenganche[A] === dia(3) && !aj.reenganche[B],
    'envíos válidos (al minuto), «Ya hablamos» de las 4 últimas semanas con su canal, «Mañana» que aún no ha llegado y a quién ya escribiste');
  check(limpiarEnlace('javascript:alert(1)') === '' && limpiarEnlace('https://a.com/x y') === '' && limpiarEnlace('ftp://a.com') === '' && limpiarEnlace('http://a.com').startsWith('http://'), 'el enlace: solo http o https, sin espacios');
  check(objetivoDe(aj, A) === 3 && objetivoDe(aj, B) === 2 && objetivoDe(null, A) === 2 && OBJETIVOS.join() === '1,2,3', 'tu objetivo con cada uno (de serie, 2)');
  let e = aj;
  for (let i = 0; i < 130; i++) e = conEnvio(e, { atleta: A, tono: 'cercano', t: new Date(Date.parse('2026-11-01T10:00:00Z') + i * 60000).toISOString() });
  check(e.envios.length === MAX_ENVIOS && conEnvio(aj, { atleta: A, tono: 'raro' }) === aj, `se guardan los últimos ${MAX_ENVIOS} envíos con tono (y un tono que no existe, no)`);
  const env = [{ a: A, t: '2026-11-01T10:00Z', tono: 'directo' }, { a: A, t: '2026-11-03T10:00Z', tono: 'directo' }, { a: A, t: '2026-11-05T10:00Z', tono: 'cercano' }, { a: A, t: '2026-11-07T10:00Z', tono: 'cercano' }];
  const cs = [{ atleta_id: A, autor: 'atleta', creado_en: '2026-11-01T12:00:00Z' }, { atleta_id: A, autor: 'atleta', creado_en: '2026-11-03T20:00:00Z' }, { atleta_id: A, autor: 'atleta', creado_en: '2026-11-08T22:00:00Z' }];
  const tq = tonoQueContesta(env, cs, A);
  check(tq.tono === 'directo' && tq.contestadas === 2 && tq.total === 2 && tonoQueContesta(env.slice(0, 1), cs, A) === null, `con qué tono te contesta más (en 48 h; con al menos 2 envíos): ${tq.tono}, ${tq.contestadas} de ${tq.total}`);
  const j = juntarLocal({ fuera: { [A]: [dia(0)] }, pospuestos: { [B]: dia(-2) }, canales: {} }, { hablado: { [A]: [{ dia: dia(1), canal: 'llamada' }] }, pospuestos: { [B]: dia(-1), [A]: dia(-3) } });
  check(j.fuera[A].join() === [dia(1), dia(0)].join() && j.canales[A][dia(1)] === 'llamada' && j.pospuestos[B] === dia(-2) && j.pospuestos[A] === dia(-3), 'lo de este aparato y lo de la base, juntos (el «Mañana» más lejano)');
  const h = conHablado(aj, B, HOY, true, 'persona');
  check(h.hablado[B][0].canal === 'persona' && !conHablado(h, B, HOY, false).hablado[B] && conPospuesto(aj, B, HOY, 2).pospuestos[B] === dia(-2) && !conPospuesto(aj, A, HOY, 0).pospuestos[A], '«Ya hablamos» con su canal (y quitarlo) y «Mañana» (y «Proponer ya»)');
}

console.log('(v0.202) Tu contacto en 8 semanas y su hora');
{
  const cs = [M('a', 'coach', 0), M('a', 'coach', 1), M('a', 'coach', 8), M('a', 'coach', 50), M('b', 'coach', 3, { cliente_id: 'd' }), M('c', 'coach', 3, { cliente_id: 'd' }), M('b', 'coach', 20)];
  const hi = historiaContacto(cs, { hoy: HOY, ahora: AHORA, fuera: { b: [dia(2)] } });
  check(hi.a.join() === '1,0,0,0,0,0,1,2' && hi.b.join() === '0,0,0,0,0,1,0,1' && !hi.c, `días de contacto por semana, sin difusiones y con «Ya hablamos»: a ${hi.a}, b ${hi.b}`);
  const cu = cumplimientoContacto(hi, ['a', 'b', 'z'], (id) => (id === 'b' ? 1 : 2), { hoy: HOY });
  check(cu.length === 8 && cu[7].cumplen === 2 && cu[7].pct === 67 && cu[6].cumplen === 0 && cu[7].hasta === HOY, 'qué parte llega a su objetivo cada semana (cada uno con el suyo)');
  const hora = (h, n) => ({ atleta_id: 'a', autor: 'atleta', creado_en: `2026-11-0${n}T${String(h - 1).padStart(2, '0')}:10:00Z` });
  check(horaHabitual([hora(19, 1), hora(20, 2), hora(19, 3), hora(9, 4), hora(20, 4)], 'a')?.hora === 19 && horaHabitual([hora(19, 1)], 'a') === null, 'la hora a la que suele escribirte (con al menos 4 mensajes)');
}

console.log('(v0.202) Motivos nuevos y los que no están activos');
{
  const con = (extra, r = {}, ultimo = null, hoy = HOY) => motivosDe({ resumen: R({ sesiones: { completadas: 2, total: 4 }, ...r }), ultimoContacto: ultimo, hoy, extra });
  const d1 = con({}, { fecha_alta: dia(1) });
  check(d1[0].id === 'nuevo_dia1' && d1[0].pideHoy && ids(con({}, { fecha_alta: dia(1) }, dia(1))).startsWith('primera_semana') && ids(con({}, { fecha_alta: dia(7) })).startsWith('nuevo_semana1') && ids(con({}, { fecha_alta: dia(29) })).startsWith('nuevo_mes1') && ids(con({}, { fecha_alta: dia(15) })) === 'saludo',
    'el plan de los nuevos: primer día, tercero, primera semana y primer mes (pidiendo hoy si aún no le has escrito)');
  const dom = '2026-11-08';
  check(ids(con({}, { sesiones: { completadas: 1, total: 3 } }, null, dom)).includes('semana_corta') && !ids(con({}, { sesiones: { completadas: 3, total: 3 } }, null, dom)).includes('semana_corta') && !ids(con({}, { sesiones: { completadas: 1, total: 3 } })).includes('semana_corta'), 'el domingo, la semana que se ha quedado corta');
  check(con({ mesCifras: { sesiones: 12, records: 2 } }, {}, null, '2026-11-30').find((m) => m.id === 'mes')?.datos.sesiones === 12 && con({}, {}, null, '2026-12-01').find((m) => m.id === 'mes')?.etiqueta === 'Su mes pasado en números' && !ids(con({})).includes('mes'), 'su mes en números (los dos últimos y los dos primeros días)');
  check(con({ enfriando: { razones: [] }, enlace: 'https://c.com/x' }).find((m) => m.id === 'llamada')?.datos.enlace === 'https://c.com/x' && ids(con({}, { ultimaSerie: dia(12), alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: 'x' }] })).includes('llamada') && !ids(con({}, { ultimaSerie: dia(6), alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: 'x' }] })).includes('llamada'), 'proponerle una llamada (se enfría, 10 días parado o molestia fuerte), con tu enlace');
  check(con({ bloqueCifras: { hechas: 14, totalSesiones: 16, records: 3 } }, { semana: { numero: 4, total: 4 } })[0].datos.records === 3, 'el fin de bloque, con sus números');
  const inv = motivosOtros({ resumen: { estado: 'invitado' }, extra: { invitacion: { creada_en: '2026-11-01T10:00:00Z' } }, hoy: HOY });
  check(inv[0].id === 'invitado' && inv[0].datos.dias === 4 && /1\/11/.test(inv[0].etiqueta), 'sin activar su cuenta, con el día de la invitación');
  check(motivosOtros({ resumen: { estado: 'pausado', pausa: { desde: dia(10), hasta: dia(-10) } }, hoy: HOY })[0].id === 'pausa_mitad' && motivosOtros({ resumen: { estado: 'pausado', pausa: { desde: dia(10), hasta: dia(-1) } }, hoy: HOY })[0].id === 'pausa_vuelta', 'en pausa: a mitad y cuando vuelve');
  check(motivosOtros({ resumen: { estado: 'baja' }, extra: { bajaEn: dia(45) }, hoy: HOY })[0].id === 'antiguo' && motivosOtros({ resumen: { estado: 'activo' }, hoy: HOY }).length === 0, 'antiguos atletas');
}

console.log('(v0.202) El reparto con tu objetivo, «sin leer» y los no activos');
{
  const cs = [M('t', 'coach', 2), M('u', 'coach', 2), M('v', 'coach', 3)];
  const res = [R({ atleta_id: 't', nombre: 'T' }), R({ atleta_id: 'u', nombre: 'U' }), R({ atleta_id: 'v', nombre: 'V' }),
    R({ atleta_id: 'i', nombre: 'Inés', estado: 'invitado' }), R({ atleta_id: 'p', nombre: 'Pau', estado: 'pausado', pausa: { desde: dia(5), hasta: dia(-20) } }),
    R({ atleta_id: 'b1', nombre: 'Baja vieja', estado: 'baja' }), R({ atleta_id: 'b2', nombre: 'Baja reciente', estado: 'baja' }), R({ atleta_id: 'b3', nombre: 'Baja ya escrita', estado: 'baja' })];
  const x = radar({ resumenes: res, contactos: contactosPorAtleta(cs, { hoy: HOY, ahora: AHORA }), hoy: HOY, objetivoDe: (id) => (id === 't' ? 1 : 2),
    extra: { v: { sinLeer: { dia: dia(3) } } }, extraOtros: { i: { invitacion: { creada_en: dia(2) } }, b1: { bajaEn: dia(200) }, b2: { bajaEn: dia(40) }, b3: { bajaEn: dia(40) } }, reenganche: { b3: dia(1) } });
  const g = Object.fromEntries(x.filas.map((f) => [f.atleta_id, f]));
  check(g.t.grupo === 'al_dia' && g.t.objetivo === 1 && g.u.grupo === 'hoy' && x.variosObjetivos && /al día con su objetivo de contacto/.test(textoResumenRadar(x)), 'cada uno con su objetivo: con 1 día por semana, al día; el resumen lo dice');
  check(g.v.grupo === 'pronto' && /no ha leído tu último mensaje/i.test(g.v.porque) && g.v.sinLeer, 'si no ha leído tu último mensaje, no se le propone otro encima («En unos días»)');
  check(x.otros.invitado.map((f) => f.nombre).join() === 'Inés' && x.otros.pausado[0]?.motivo.id === 'pausa_mitad' && x.otros.antiguo.map((f) => f.nombre).join() === 'Baja reciente', 'aparte: sin activar, en pausa y antiguos (de baja hace 30 a 90 días y una sola vez)');
}

console.log('Con la demo (lo que lee de la base)');
// (v0.93) la demo siembra el contacto «hace N horas» y el radar cuenta por días de Madrid: de noche lo de hace unas
// horas caía en el día anterior. Esta parte corre con el reloj a mediodía de hoy (Madrid); al acabar, el de verdad
const RelojReal = Date;
{
  const hoyM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new RelojReal());
  const desfase = RelojReal.parse(`${hoyM}T12:00:00+01:00`) - RelojReal.now();
  globalThis.Date = class extends RelojReal {
    constructor(...a) { super(...(a.length ? a : [RelojReal.now() + desfase])); }
    static now() { return RelojReal.now() + desfase; }
  };
}
try {
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const { datosRadar, recordsRecientes } = await import('../web/src/datos/radar.js');
  const { fechaMadrid } = await import('../web/src/logica/fechas.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const antes = JSON.stringify(await b.select('comentarios', {}));
  const d = await datosRadar({ api, backend: b });
  check(d.hoy === fechaMadrid() && d.resumenes.length === 7 && d.comentarios.length > 0 && d.comentarios.every((c) => !('texto' in c)), 'lee el resumen del panel y los mensajes recientes, sin su texto');
  check(Object.values(d.checkins).every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)) && Object.keys(d.checkins).length >= 1, 'el día en que cada atleta envió su último check-in (solo la fecha)');
  check(Object.values(d.sesiones).flat().every((s) => s.nombre && s.fecha && 'preparacion' in s) && Object.keys(d.sesiones).length >= 1, 'y las sesiones hechas en la última semana de cada atleta');
  const x = radar({ ...d, contactos: contactosPorAtleta(d.comentarios, { hoy: d.hoy }) });
  const g = Object.fromEntries(x.filas.map((f) => [f.nombre, f]));
  check(x.filas.length === 5 && !g['Marta Gil'] && !g['Sergio Rey'], 'los cinco atletas activos (ni la invitada ni el de baja)');
  // (entre las 23 y las 24, el mensaje «de ayer» de la demo —hace 23 horas— cae en el día de hoy: Ana tiene entonces un
  // solo día de contacto en la semana y sale «en unos días» en vez de «al día»; las dos cosas están bien)
  const ana = g['Ana López'];
  check((ana.contacto.en7 >= 2 ? ana.grupo === 'al_dia' : ana.grupo === 'pronto') && g['Rubén Martín'].grupo === 'hoy' && !!g['Rubén Martín'].teEscribio && g['Carlos Vera'].motivos.some((m) => m.id === 'parado') && g['Lucía Ferrer'].motivos.at(-1).datos.nutricion === true, 'Ana al día; Rubén te escribió; Carlos lleva días parado; a Lucía (solo nutrición), saludo de nutrición');
  // (v0.201) lo de cada uno: lo que te escribió (con su texto), su check-in entero, su cumpleaños, lo programado
  check(/peso muerto/.test(g['Rubén Martín'].mensajeAtleta?.texto || '') && g['Rubén Martín'].motivos[1]?.id === 'responder', 'lo que te escribió Rubén, a la vista y como lo primero que contestar tras su día difícil');
  check(g['Carlos Vera'].grupo === 'hoy' && g['Carlos Vera'].porque === 'Hoy es su cumpleaños' && g['Carlos Vera'].hito?.tipo === 'cumple', 'el cumpleaños de Carlos (la demo lo pone hoy) lo pone en «Hoy», con su porqué');
  check(Object.values(d.extra).some((e) => e.checkin && 'energia' in e.checkin) && Object.keys(d.programados).length >= 1 && d.extra[g['Ana López'].atleta_id].videos?.n >= 1, 'su check-in entero, lo programado y los vídeos sin corregir');
  const { abrirRadar, apuntarPendiente, pendienteHecho } = await import('../web/src/datos/radar.js');
  const ab = await abrirRadar({ api, backend: b }, g['Ana López'].atleta_id, { hoy: d.hoy });
  check(Array.isArray(ab.objetivos) && ab.enviados.length > 0 && ab.enviados.every((t) => t === t.toLowerCase()), 'al abrir su fila: sus objetivos y lo que le has escrito (para no repetirlo)');
  const rec = await recordsRecientes({ api }, g['Ana López'].atleta_id, { hoy: d.hoy });
  check(rec.length > 0 && rec.every((r) => r.ejercicio && !/^Récord/.test(r.ejercicio) && r.fecha), 'los récords recientes de una atleta, con su ejercicio');
  check(JSON.stringify(await b.select('comentarios', {})) === antes, 'no escribe nada');
  // (v0.202) El contacto para la ficha: 8 semanas, tu último mensaje y tu objetivo con él
  const { contactoDeAtleta } = await import('../web/src/datos/radar.js');
  const cf = await contactoDeAtleta({ api, backend: b }, g['Ana López'].atleta_id, { hoy: d.hoy });
  check(cf.semanas.length === 8 && cf.semanas[7] >= 1 && cf.objetivo === 2 && /hoy|ayer|hace/.test(cf.ultimo || ''), `el contacto de su ficha: ${cf.semanas.join(' · ')}, último ${cf.ultimo}`);
  check(d.otros && Object.keys(d.otros).length >= 1 && Object.values(d.extra).some((e) => 'sinLeer' in e), 'lo de los que no están activos y si han leído tu último mensaje');
  // Tus pendientes: van con tus notas privadas (con su marca) y no salen entre las notas de la ficha
  const nota = await apuntarPendiente({ api }, g['Ana López'].atleta_id, 'Preguntarle por el viaje', { desde: d.hoy });
  const d2 = await datosRadar({ api, backend: b });
  check(d2.extra[g['Ana López'].atleta_id].pendientes.some((p) => p.texto === 'Preguntarle por el viaje'), 'un tema pendiente apuntado sale en su fila');
  const ficha = await api.ficha(g['Ana López'].atleta_id);
  check(!ficha.notas.some((n) => /pend:/.test(n.texto)) && ficha.pendientes.some((p) => p.texto === 'Preguntarle por el viaje' && !p.hecho), 'en la ficha, aparte de las notas');
  await pendienteHecho({ api }, nota, { hoy: d.hoy });
  check(!(await datosRadar({ api, backend: b })).extra[g['Ana López'].atleta_id].pendientes.length && (await api.ficha(g['Ana López'].atleta_id)).pendientes[0].hecho === d.hoy, 'y al marcarlo hecho deja de salir (se queda en su historia)');
  // Como atleta no se ve nada de otros (lo cierra la base, no esta pantalla)
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const suyos = await b.select('comentarios', { cols: 'id,atleta_id' });
  check(new Set(suyos.map((c) => c.atleta_id)).size <= 1, 'una atleta solo alcanza sus propios mensajes');
} finally { globalThis.Date = RelojReal; }

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
