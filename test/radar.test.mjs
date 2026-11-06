// «A quién escribir» (el radar de contacto del coach): contactos, motivos, borradores, reparto y lo apuntado a mano.
// Lógica pura, y la lectura de datos contra la demo.
//   node test/radar.test.mjs
import { difusiones, contactosPorAtleta, contactoDe, textoContacto, haceDias, DIAS_SIN_CONTESTAR,
  motivosDe, semanasSeguidas, cuandoFue, queApunto,
  borradorDe, cuantasFrases, varianteInicial, MAX_BORRADOR,
  radar, filaRadar, ordenRadar, textoResumenRadar, AJUSTES_RADAR, GRUPOS_RADAR,
  leerLocal, limpiarLocal, marcarHablado, posponer, PREFIJO_RADAR } from '../web/src/logica/radar/index.js';
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
  check(ids(todo) === 'molestia_fuerte,dia_malo,record,semana_completa,cumplimiento,sin_checkin,saludo', 'el orden de los motivos');
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
  const vistos = new Set(); let malos = [], n = 0;
  for (const r of casos) for (const ss of sesionesDe) for (const rec of [[], records]) {
    for (const m of motivosDe({ resumen: r, sesiones: ss, records: rec, hoy: HOY })) {
      vistos.add(m.id);
      for (let v = 0; v < cuantasFrases(m); v++) {
        const t = borradorDe(m, { hoy: HOY, variante: v }); n++;
        if (!t || t.length > 160 || /undefined|null|NaN|\[object|\s{2}|\(\)/.test(t) || /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t) || /^(hola|buenas)/i.test(t) || /[.!]$/.test(t) || t !== t.trim() || t[0] !== t[0].toUpperCase()) malos.push(`${m.id}/${v}: ${t}`);
      }
    }
  }
  check(malos.length === 0, `${n} borradores (todos los motivos y frases): cortos, sin emojis, sin saludo de fórmula ni punto final, sin huecos${malos.length ? `: ${malos.slice(0, 3).join(' | ')}` : ''}`);
  check(['molestia_fuerte', 'molestia', 'dia_malo', 'dia_flojo', 'parado', 'pendientes', 'cumplimiento', 'sin_checkin', 'record', 'semana_completa', 'racha', 'saludo'].every((k) => vistos.has(k)), 'la prueba pasa por los doce motivos');
  const m = (id, datos) => ({ id, datos });
  check(borradorDe(m('parado', { dias: 6 }), { hoy: HOY, variante: 0 }) === 'Llevas 6 días sin apuntar nada. ¿Todo bien?', 'lleva días sin registrar');
  check(borradorDe(m('parado', { dias: null }), { hoy: HOY, variante: 0 }) === '¿Has podido empezar ya? Si tienes cualquier duda con la app o con el programa, dime', 'quien no ha empezado');
  check(borradorDe(m('record', { ejercicio: 'Sentadilla', texto: '1RM estimado 100 kg (antes 97,5)' }), { hoy: HOY, variante: 0 }) === 'Récord en Sentadilla: 1RM estimado 100 kg. Buen trabajo', 'el récord, con la marca y sin la coletilla «(antes…)»');
  check(borradorDe(m('semana_completa', { total: 4 }), { hoy: HOY, variante: 0 }) === 'Semana completa, 4 de 4. Buen trabajo' && borradorDe(m('semana_completa', { total: 1 }), { hoy: HOY, variante: 0 }) === 'Semana completa. Buen trabajo', 'semana completa (con una sola sesión, sin la cuenta)');
  check(borradorDe(m('pendientes', { hechas: 1, total: 4, faltan: 3 }), { hoy: HOY, variante: 2 }) === 'Te quedan 3 sesiones esta semana. Si vas justo de tiempo, lo reorganizamos'
    && borradorDe(m('pendientes', { hechas: 1, total: 2, faltan: 1 }), { hoy: HOY, variante: 2 }).startsWith('Te queda 1 sesión'), 'le quedan sesiones (en singular también)');
  check(borradorDe(m('dia_malo', { sesion: 'Pierna A', fecha: dia(1), que: 'habías dormido mal' }), { hoy: HOY, variante: 0 }) === 'Ayer apuntaste que habías dormido mal. ¿Cómo estás hoy?'
    && borradorDe(m('dia_malo', { sesion: 'Pierna A', fecha: HOY, que: 'habías dormido mal' }), { hoy: HOY, variante: 0 }) === 'Hoy apuntaste que habías dormido mal. ¿Cómo ha ido?'
    && borradorDe(m('dia_flojo', { sesion: 'Pierna A', fecha: dia(3), que: 'habías dormido mal' }), { hoy: HOY, variante: 2 }) === '¿Qué tal la sesión del lunes? Vi que habías dormido mal', 'el día difícil, con su día («del lunes», «de ayer»)');
  check(borradorDe(m('molestia', { zonas: 'Rodilla, hombro' }), { hoy: HOY, variante: 0 }) === 'Vi lo que apuntaste en el check-in (rodilla, hombro). ¿Cómo sigue?' && borradorDe(m('molestia', { zonas: '' }), { hoy: HOY, variante: 0 }) === 'Vi lo que apuntaste en el check-in. ¿Cómo sigue?', 'la molestia, con sus zonas (o sin ellas)');
  check(borradorDe(m('saludo', { sesion: 'Torso A', fecha: dia(1) }), { hoy: HOY, variante: 0 }) === '¿Qué tal fue Torso A ayer?' && borradorDe(m('saludo', {}), { hoy: HOY, variante: 0 }) === '¿Cómo va la semana?'
    && borradorDe(m('saludo', { nutricion: true }), { hoy: HOY, variante: 0 }) === '¿Qué tal llevas el plan esta semana?', 'el saludo: con su última sesión, sin ella y para quien solo lleva nutrición');
  check(borradorDe(m('saludo', {}), { hoy: HOY, variante: 3 }) === borradorDe(m('saludo', {}), { hoy: HOY, variante: 0 }) && borradorDe(m('saludo', {}), { hoy: HOY, variante: -1 }) === borradorDe(m('saludo', {}), { hoy: HOY, variante: 2 }), 'las frases dan la vuelta (cualquier entero vale)');
  check(borradorDe(null, { hoy: HOY }) === '¿Cómo va la semana?' && borradorDe(m('raro', {}), { hoy: HOY }) === '¿Cómo va la semana?' && cuantasFrases(m('raro')) === 3, 'un motivo desconocido cae en el saludo');
  check(varianteInicial('a', HOY) === varianteInicial('a', HOY) && varianteInicial('a', HOY) !== varianteInicial('b', HOY) && varianteInicial('a', HOY) !== varianteInicial('a', dia(1)) && Number.isInteger(varianteInicial('a', HOY)), 'cada atleta empieza por una frase distinta, estable en el día');
  check(borradorDe(m('record', { ejercicio: 'x'.repeat(900), texto: '' }), { hoy: HOY }).length === MAX_BORRADOR, `nunca pasa de ${MAX_BORRADOR} letras`);
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

console.log('Con la demo (lo que lee de la base)');
{
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
  check(g['Ana López'].grupo === 'al_dia' && g['Rubén Martín'].grupo === 'hoy' && !!g['Rubén Martín'].teEscribio && g['Carlos Vera'].motivo.id === 'parado' && g['Lucía Ferrer'].motivo.datos.nutricion === true, 'Ana al día; Rubén te escribió; Carlos lleva días parado; a Lucía (solo nutrición), saludo de nutrición');
  const rec = await recordsRecientes({ api }, g['Ana López'].atleta_id, { hoy: d.hoy });
  check(rec.length > 0 && rec.every((r) => r.ejercicio && !/^Récord/.test(r.ejercicio) && r.fecha), 'los récords recientes de una atleta, con su ejercicio');
  check(JSON.stringify(await b.select('comentarios', {})) === antes, 'no escribe nada');
  // Como atleta no se ve nada de otros (lo cierra la base, no esta pantalla)
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const suyos = await b.select('comentarios', { cols: 'id,atleta_id' });
  check(new Set(suyos.map((c) => c.atleta_id)).size <= 1, 'una atleta solo alcanza sus propios mensajes');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
