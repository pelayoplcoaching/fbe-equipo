// FBE Esencial (acompañamiento, tanda 6, v0.247): «Automatizaciones: la vida real». La lógica pura (el viaje, los días que
// de verdad entrena, cambiar un ejercicio, pasar a tres días, el objetivo con fecha, las marcas de antes y de ahora, el
// final de «Primeras 4 semanas», cuando la app no basta, los avisos y el resumen del coach), lo apagado (que no cambie
// nada mientras lo esté) y, en la demo con un reloj que adelanta las semanas, los datos que lee cada pieza.
const RealDate = Date;
let desfase = 0;
class Falsa extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfase); else super(...a); }
  static now() { return RealDate.now() + desfase; }
}
globalThis.Date = Falsa;
const v = await import('../web/src/logica/esencial-vida.js');
const { APAGADO, encendido } = await import('../web/src/logica/esencial-respuestas.js');
const { explicar } = await import('../web/src/logica/esencial-porque.js');
const { propuestaEsencial, NOTA_CONSERVAR } = await import('../web/src/logica/esencial-motor.js');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const { hoyISO } = await import('../web/src/logica/fechas.js');
const datos = await import('../web/src/datos/api-esencial.js');
const { readFileSync } = await import('node:fs');
const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const mas = (iso, n) => new RealDate(RealDate.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

console.log('«Me voy de viaje»');
const HOY = '2027-02-10';   // miércoles
check(v.validarViaje({ desde: '2027-02-12', hasta: '2027-02-21', hoy: HOY }) === null && /cuándo|día/.test(v.validarViaje({ desde: '', hasta: '2027-02-21', hoy: HOY }))
  && /después/.test(v.validarViaje({ desde: '2027-02-21', hasta: '2027-02-12', hoy: HOY })) && /ya ha pasado/.test(v.validarViaje({ desde: '2027-01-01', hasta: '2027-01-08', hoy: HOY }))
  && /Como mucho, 60 días/.test(v.validarViaje({ desde: '2027-02-12', hasta: '2027-05-30', hoy: HOY })) && /Queda mucho/.test(v.validarViaje({ desde: '2027-12-01', hasta: '2027-12-08', hoy: HOY }))
  && /Pon el día/.test(v.validarViaje({ desde: '2027-02-30', hasta: '2027-03-02', hoy: HOY })), 'las fechas: las dos, en orden, sin pasar, 60 días como mucho y no a más de medio año');
const nota = (desde, hasta, modo = 'pausa', id = 'n1') => ({ id, desde, hasta, datos: { modo } });
let vj = v.viajeDe([nota('2027-02-15', '2027-02-21')], HOY);
check(vj.estado === 'antes' && vj.faltan === 5 && vj.dias === 7 && vj.modo === 'pausa' && /Te vas el lunes 15 de febrero/.test(v.textoViaje(vj).titulo) && /no te manda avisos de entreno/.test(v.textoViaje(vj).texto) && !v.viajeCalla(vj),
  `antes de irse (desde 14 días antes): «${v.textoViaje(vj).titulo}»; los avisos aún no callan`);
check(v.viajeDe([nota('2027-03-15', '2027-03-21')], HOY) === null && v.viajeDe([], HOY) === null && v.viajeDe([nota('2027-02-21', '2027-02-15')], HOY) === null, 'a más de dos semanas vista aún no sale; sin viajes o con fechas al revés, nada');
check(v.proximoViaje([nota('2027-03-15', '2027-03-21', 'viaje', 'lejos'), nota('2027-01-01', '2027-01-05', 'pausa', 'pasado')], HOY)?.id === 'lejos' && v.proximoViaje([nota('2027-01-01', '2027-01-05')], HOY) === null && v.proximoViaje([], HOY) === null,
  'pero en «Me voy de viaje» sí se ve (y se cambia) el que tiene por delante, falte lo que falte; los pasados, no');
vj = v.viajeDe([nota('2027-02-08', '2027-02-14')], HOY);
check(vj.estado === 'durante' && vj.quedan === 4 && v.viajeCalla(vj) && /De viaje hasta el domingo 14 de febrero/.test(v.textoViaje(vj).titulo) && /nada que recuperar/.test(v.textoViaje(vj).texto), `durante: «${v.textoViaje(vj).titulo}», y calla los avisos de entreno`);
check(!v.viajeCalla(v.viajeDe([nota('2027-02-08', '2027-02-14', 'igual')], HOY)) && v.viajeCalla(v.viajeDe([nota('2027-02-08', '2027-02-14', 'viaje')], HOY))
  && v.viajeDe([nota('2027-02-08', '2027-02-14', 'otra')], HOY).modo === 'pausa', 'con «sigo igual» los avisos no callan; con la rutina de viaje, sí; un modo desconocido cuenta como pausa');
vj = v.viajeDe([nota('2027-02-01', '2027-02-08')], HOY);
check(vj.estado === 'vuelta' && v.textoViaje(vj).titulo === '¿Ya de vuelta?' && v.viajeDe([nota('2027-02-01', '2027-02-06')], HOY) === null, 'los tres días de después: «¿Ya de vuelta?»; al cuarto, ya no');
check(/vuelve a ella/.test(v.textoViaje(v.viajeDe([nota('2027-02-01', '2027-02-08', 'viaje')], HOY)).texto), 'a la vuelta, con la rutina de viaje: que vuelva a la suya');
check(v.viajeDe([nota('2027-02-20', '2027-02-24', 'pausa', 'b'), nota('2027-02-09', '2027-02-11', 'pausa', 'a')], HOY).id === 'a', 'con dos, el que toca antes');
check(v.MODOS_VIAJE.length === 3 && v.MODOS_VIAJE.every(([id, t, x]) => id && t && x) && v.fechaCorta('2027-02-14') === 'domingo 14 de febrero' && v.fechaCorta('nada') === '', 'tres maneras de irse, cada una con lo que pasa; las fechas, en llano');

console.log('\n«Entreno en otro sitio»');
check(v.SITIOS.length === 3 && v.SITIOS.map((s) => s[3]).join() === ',ejercicios,rutina' && /Dónde entrenas hoy/.test(v.SITIOS[0][2]), 'solo hoy (lo arregla la sesión), otro gimnasio (cambiar ejercicios) y en casa (otra rutina)');

console.log('\nLos días que de verdad entrena');
const lunes = '2027-02-08';
const en = (...dias) => [-28, -21, -14, -7].flatMap((s) => dias.map((d) => ({ fecha: mas(lunes, s + d - 1) })));
let dr = v.diasReales({ hechas: en(2, 4), elegidos: [1, 3], n: 2, hoy: HOY });
check(dr && dr.dias.join() === '2,4' && dr.semanas === 4, 'eligió lunes y miércoles y lleva cuatro semanas yendo martes y jueves: se lo propone');
check(v.diasReales({ hechas: en(1, 3), elegidos: [1, 3], n: 2, hoy: HOY }) === null && v.diasReales({ hechas: en(2, 4), elegidos: null, n: 2, hoy: HOY }) === null
  && v.diasReales({ hechas: en(2, 4).slice(0, 4), elegidos: [1, 3], n: 2, hoy: HOY }) === null && v.diasReales({ hechas: en(2), elegidos: [1, 3], n: 2, hoy: HOY }) === null,
  'si va los días que eligió, si no eligió ninguno, con solo dos semanas o con un solo día claro: nada');
check(v.diasReales({ hechas: [...en(2, 4), { fecha: HOY }], elegidos: [1, 3], n: 2, hoy: HOY }).dias.join() === '2,4', 'la semana en curso no cuenta');

console.log('\n«Cambiar un ejercicio»');
const E = { p: { id: 'p', nombre: 'Prensa', alternativas: ['s', 'h', 'x'] }, s: { id: 's', nombre: 'Sentadilla a un banco' }, h: { id: 'h', nombre: 'Hack', activo: false },
  x: { id: 'x', nombre: 'Sentadilla isométrica', por_tiempo: true }, c: { id: 'c', nombre: 'Curl', alternativas: [] }, pl: { id: 'pl', nombre: 'Plancha', por_tiempo: true, alternativas: ['x'] } };
let ec = v.ejerciciosCambiables({ pautas: [{ ejercicio_id: 'p' }, { ejercicio_id: 'c' }, { ejercicio_id: 'p' }, { ejercicio_id: 'pl' }, { ejercicio_id: 'no' }], ejercicios: E, estancados: ['c'] });
check(ec.length === 3 && ec[0].opciones.map((o) => o.id).join() === 's' && !ec[0].guia && ec[1].opciones.length === 0 && ec[1].estancado && !ec[0].estancado && ec[2].opciones[0].id === 'x',
  'cada ejercicio una vez, con las alternativas que se miden igual y siguen activas; el atascado, marcado');
ec = v.ejerciciosCambiables({ pautas: [{ ejercicio_id: 's' }], ejercicios: E, puestas: { p: 's' } });
check(ec[0].guia?.id === 'p' && ec[0].opciones.length === 0, 'si lo que hace ya es una alternativa, se ve cuál era el de su rutina (para volver)');

console.log('\nPasar a tres días cuando toca');
const sem = (n, ini, extra = {}) => ({ id: `w${n}`, numero: n, fecha_inicio: ini, ...extra });
const cuatro = [sem(5, mas(lunes, -28)), sem(6, mas(lunes, -21)), sem(7, mas(lunes, -14)), sem(8, mas(lunes, -7)), sem(9, lunes)];
const todas = (hecha = () => true) => Object.fromEntries(cuatro.map((w) => [w.id, [{ completada: hecha(w, 0) }, { completada: hecha(w, 1) }]]));
const N2 = 'Novato 2 días · FBE Esencial';
check(v.subirNivel({ rutina: N2, actual: cuatro[4], semanas: cuatro, sesiones: todas() })?.semanas === 4, 'con la de novato de dos días y cuatro semanas completas: lo propone');
check(v.subirNivel({ rutina: N2, actual: cuatro[4], semanas: cuatro, sesiones: todas((w, i) => !(w.numero === 7 && i === 1)) }) === null
  && v.subirNivel({ rutina: 'Novato 3 días · FBE Esencial', actual: cuatro[4], semanas: cuatro, sesiones: todas() }) === null
  && v.subirNivel({ rutina: N2, actual: cuatro[4], semanas: cuatro, sesiones: todas(), pedido: 3 }) === null
  && v.subirNivel({ rutina: N2, actual: cuatro[4], semanas: cuatro.slice(2), sesiones: todas() }) === null
  && v.subirNivel({ rutina: N2, actual: cuatro[4], semanas: cuatro.map((w) => (w.numero === 6 ? { ...w, esencial_cierre: 'pausa' } : w)), sesiones: todas() }) === null,
  'si faltó a una, si ya va a tres, si ya lo ha pedido, con menos de cuatro semanas o con una en pausa: no');

console.log('\nUn objetivo con fecha');
check(v.validarObjetivo({ texto: 'No faltar hasta el verano', fecha: '2027-06-21', hoy: HOY }) === null && /qué quieres/.test(v.validarObjetivo({ texto: ' a ', fecha: '2027-06-21', hoy: HOY }))
  && /fecha/.test(v.validarObjetivo({ texto: 'No faltar', fecha: '', hoy: HOY })) && /dos semanas/.test(v.validarObjetivo({ texto: 'No faltar', fecha: '2027-02-15', hoy: HOY }))
  && /un año/.test(v.validarObjetivo({ texto: 'No faltar', fecha: '2028-06-01', hoy: HOY })) && /Más corto/.test(v.validarObjetivo({ texto: 'x'.repeat(161), fecha: '2027-06-21', hoy: HOY })),
  'qué y para cuándo: de dos semanas a un año, y corto');
const ob = (hoy, extra = {}) => v.objetivoDe({ texto: 'No faltar', hasta: '2027-04-07', creada_en: '2027-01-13T10:00:00Z', datos: {}, ...extra }, hoy);
check(ob('2027-01-20').momento === 'camino' && ob('2027-01-20').semanas === 11 && ob('2027-01-20').total === 12 && /Quedan 11 semanas/.test(v.textoObjetivo(ob('2027-01-20'))), 'en camino: las semanas que quedan');
check(ob('2027-02-24').momento === 'mitad' && /Vas por la mitad: quedan 6 semanas/.test(v.textoObjetivo(ob('2027-02-24'))) && ob('2027-02-24', { datos: { mitad: true } }).momento === 'camino', 'a mitad de camino lo dice una vez');
check(ob('2027-04-02').momento === 'final' && ob('2027-04-10').momento === 'pasado' && /Llegó la fecha/.test(v.textoObjetivo(ob('2027-04-10'))) && ob('2027-04-30') === null && ob('2027-02-01', { datos: { hecho: true } }) === null
  && v.objetivoDe(null, HOY) === null && ob('2027-04-07').pct === 100 && ob('2027-01-13').pct === 0, 'la última semana, la fecha pasada (dos semanas, y luego se va) y el porcentaje del tiempo');

console.log('\nSus marcas, antes y ahora');
const m = (id, kg, reps, extra = {}) => ({ ejercicio_id: id, nombre: id, kg, reps, porTiempo: false, texto: kg != null ? `${kg} kg × ${reps}` : `${reps} repeticiones`, ...extra });
const cm = v.compararMarcas([m('prensa', 80, 10), m('press', 30, 10), m('curl', 8, 12), m('plancha', null, 40, { porTiempo: true, texto: '40 s' }), m('viejo', 10, 10)],
  [m('prensa', 90, 8), m('press', 30, 12), m('curl', 8, 12), m('plancha', null, 50, { porTiempo: true, texto: '50 s' }), m('nuevo', 5, 5)]);
check(cm.filas.length === 4 && cm.suben === 3 && cm.filas[0].antes === '80 kg × 10' && cm.filas[0].ahora === '90 kg × 8' && cm.filas[0].sube && cm.filas[1].sube && !cm.filas[2].sube && cm.filas[3].sube,
  'más kilos, o los mismos con más repeticiones, es subir; lo que no estaba antes (o ya no está) no se compara');

console.log('\nEl final de «Primeras 4 semanas»');
const p4 = [sem(1, mas(lunes, -21)), sem(2, mas(lunes, -14)), sem(3, mas(lunes, -7)), sem(4, lunes)];
const s4 = (ultima) => Object.fromEntries(p4.map((w) => [w.id, w.numero === 4 ? ultima : [{ completada: true }, { completada: w.numero !== 2 }]]));
let fp = v.finPrimeras({ bloque: 'Primeras 4 semanas', actual: p4[3], semanas: p4, sesiones: s4([{ completada: true }, { completada: true }]), marcas: 5 });
check(fp && fp.sesiones === 7 && fp.total === 8 && /7 sesiones hechas de 8/.test(fp.lineas[0]) && /marcas en 5 ejercicios/.test(fp.lineas[3]) && /Tu rutina/.test(fp.sigue), 'con la cuarta semana hecha: lo que ha aprendido y qué viene');
check(v.finPrimeras({ bloque: 'Primeras 4 semanas', actual: p4[3], semanas: p4, sesiones: s4([{ completada: true }, { completada: false }]) }) === null
  && v.finPrimeras({ bloque: 'Primeras 4 semanas', actual: p4[2], semanas: p4, sesiones: s4([{ completada: true }, { completada: true }]) }) === null
  && v.finPrimeras({ bloque: N2, actual: p4[3], semanas: p4, sesiones: s4([{ completada: true }, { completada: true }]) }) === null, 'sin acabarla, antes de la cuarta o con otra rutina: nada');

console.log('\nCuando la app no basta');
check(v.noBasta({ molestias: 3, semanas: 16 }).motivo === 'molestia' && v.noBasta({ estancados: 2, cambios: 1, semanas: 16 }).motivo === 'estancado' && v.noBasta({ objetivo: true, semanas: 24 }).motivo === 'objetivo',
  'una molestia que se repite, atascarse otra vez tras cambiar de rutina o medio año con un objetivo');
check(v.noBasta({ molestias: 2, estancados: 2, cambios: 0, semanas: 30 }) === null && v.noBasta({ estancados: 3, cambios: 2, semanas: 12 }) === null && v.noBasta({ objetivo: true, semanas: 20 }) === null && v.noBasta() === null, 'por debajo de eso, no se dice nada');
check(['molestia', 'estancado', 'objetivo'].every((k, i) => !/debes|tienes que|necesitas/i.test(v.noBasta([{ molestias: 3 }, { estancados: 2, cambios: 1, semanas: 16 }, { objetivo: true, semanas: 24 }][i]).texto)), 'y lo dice sin presión');

console.log('\nLos avisos y el resumen del coach');
check(v.sinAvisos({ suscripciones: 0, email: false, semana: 2 }) && !v.sinAvisos({ suscripciones: 1, email: false, semana: 5 }) && !v.sinAvisos({ suscripciones: 0, email: true, semana: 5 }) && !v.sinAvisos({ suscripciones: 0, email: false, semana: 1 }),
  'sin avisos en ningún móvil ni por correo, desde su segunda semana');
let rc = v.resumenCoach({ filas: [{ total: 2, hechas: 2 }, { total: 2, hechas: 1 }, { total: 3, hechas: 0, dias: 12 }, { total: 1, hechas: 0, pausa: true }, { total: 1, hechas: 0, viaje: true }, { total: 0, hechas: 0 }],
  preguntas: 2, notas: [{ datos: { nota: 8 } }, { datos: { nota: 9 } }, { datos: {} }] });
check(rc.total === 5 && rc.entrenando === 2 && rc.completas === 1 && rc.sinEmpezar === 1 && rc.pausa === 1 && rc.viaje === 1 && rc.parados === 1 && rc.preguntas === 2 && rc.nota === 8.5 && rc.notas === 2
  && rc.frase === 'De 3 personas con semana en marcha, 2 han entrenado y una la tiene completa.', `la semana, en cifras («${rc.frase}»)`);
check(v.resumenCoach({ filas: [] }).frase === 'Aún no hay nadie con su plan en marcha.' && v.resumenCoach({ filas: [{ total: 2, hechas: 2 }] }).nota === null, 'sin nadie, o sin notas, lo dice');

console.log('\nLo apagado (hasta que Pelayo lo vea)');
check(['enfermo', 'salud_al_dia', 'alarma', 'suave', 'dos_duras', 'variante'].every((k) => !APAGADO.has(k) && encendido(k)) && ['molestia_sigue', 'molestia_frena'].every((k) => APAGADO.has(k) && !encendido(k) && encendido(k, true)), 'de la tanda 6, seis encendidas por Pelayo (26/11) y dos apagadas (las sustituye el motor de molestias); la vista previa las enseña');
check(v.ENFERMO.pasos.length === 4 && v.MOLESTIA_SIGUE.length === 3 && v.SUAVE.texto && v.ALARMA.texto && /112/.test(v.ALARMA.texto) && !/no te sube/.test(v.ALARMA.despues), 'los borradores están escritos (y la alarma no promete lo que no está hecho)');
check(v.molestiaToca({ dicho: '2027-02-07', hoy: HOY }) === 3 && v.molestiaToca({ dicho: '2027-02-03', hoy: HOY }) === 7 && v.molestiaToca({ dicho: '2027-02-09', hoy: HOY }) === null
  && v.molestiaToca({ dicho: '2027-02-07', respondido: [3], hoy: HOY }) === null && v.molestiaToca({ dicho: '2027-01-20', hoy: HOY }) === null && v.molestiaToca({ hoy: HOY }) === null, 'la molestia: pregunta a los tres y a los siete días, una vez cada una');
check(v.suaveDe([], HOY).puede && v.suaveDe([{ desde: lunes }], HOY).esta && !v.suaveDe([{ desde: lunes }], HOY).puede && !v.suaveDe([{ desde: mas(lunes, -14) }], HOY).puede && v.suaveDe([{ desde: mas(lunes, -28) }], HOY).puede,
  'la semana suave: una de cada cuatro como mucho');
check(v.dosDuras([{ rpe: 8 }, { rpe: 9 }, { rpe: 10 }]) && !v.dosDuras([{ rpe: 9 }, { rpe: 8 }]) && !v.dosDuras([{ rpe: 10 }]) && !v.dosDuras([{ rpe: null }, { rpe: 9 }]), 'dos sesiones duras seguidas: las dos últimas, a 9 o más');
check(v.saludAlDia({ fecha: '2026-08-01T10:00:00Z', hoy: HOY }) && !v.saludAlDia({ fecha: '2026-11-01', hoy: HOY }) && !v.saludAlDia({ hoy: HOY }), 'repasar la salud: a los seis meses de contestarla');
check(/La semana pasada la pediste suave/.test(explicar({ frenos: ['suave'], tipo: 'mantener', hecho: [], antes: { kg: 80, min: 10, max: 12, series: 3 }, despues: { kg: 80, min: 10, max: 12, series: 3 } }).texto)
  && /dos últimas sesiones fueron muy duras/.test(explicar({ frenos: ['dos_duras'], tipo: 'mantener', hecho: [], antes: { kg: 80, min: 10, max: 12, series: 3 }, despues: { kg: 80, min: 10, max: 12, series: 3 } }).texto), 'y cada una tiene su porqué escrito');
{
  const vida = lee('web/src/ui/atleta/EsencialVida.jsx'), ayuda = lee('web/src/ui/atleta/EsencialAyuda.jsx');
  check(/encendido\('suave', previa\) \? suaveDe/.test(vida) && /encendido\('molestia_sigue', previa\) && !conMotorDolor && mol/.test(vida) && /encendido\('salud_al_dia', previa\)/.test(vida) && /encendido\('variante', previa\)/.test(vida)
    && /if \(!encendido\('alarma', previa\)\) return null/.test(vida) && /encendido\('alarma', previaAlarma\) && <Alarma/.test(ayuda), 'en la app, cada una sale solo si está encendida (v0.257: el seguimiento de una molestia, el de siempre solo sin el motor de molestias)');
  check(/if \(!on\('molestia_frena'\) && !on\('suave'\) && !on\('dos_duras'\) && !on\('molestias_zona'\) && !on\('descarga_senales'\) && !on\('vuelta_esencial'\)\) return null;/.test(lee('web/src/datos/api-esencial.js')), 'y, con las cuatro reglas apagadas (v0.257: y el motor de molestias), al motor no le llega nada');
}

console.log('\nEn la demo: Tomás, de la semana 5 a la 7');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const yo = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
const hacer = async (rpe = 8) => {
  const pr = await api.programa(yo.id);
  for (const s of pr.sesiones[pr.actual.id] || []) {
    const d = await api.sesion(s.id, yo.id);
    for (const e of d.ejercicios) {
      const kg = e.carga_sugerida_kg == null ? 20 : Number(e.carga_sugerida_kg);
      for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg, reps: e.reps_max, rpe: e.ejercicio.por_tiempo ? null : 8 }, yo.id);
    }
    await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO(), rpe_sesion: rpe });
  }
  return pr;
};
// Sus ejercicios de la semana, con sus alternativas
await api.prepararSemanaEsencial(yo.id);
let lista = await datos.ejerciciosDeRutina(api, bd, yo.id);
check(Array.isArray(lista) && lista.length >= 5 && lista.every((e) => e.id && e.nombre && Array.isArray(e.opciones)) && lista.some((e) => e.opciones.length > 0) && lista.every((e) => !e.guia && !e.estancado),
  `«Cambiar un ejercicio»: los ${lista.length} de su semana, con sus alternativas (${lista.filter((e) => e.opciones.length).length} se pueden cambiar)`);
// (uno que no sea la prensa: al cambiarlo se queda sin kilos puestos, y la prensa hace falta más abajo con los suyos)
const cambiable = lista.find((e) => e.opciones.length > 0 && !/Prensa/.test(e.nombre));
await api.esencialAlternativa(cambiable.id, cambiable.opciones[0].id);
lista = await datos.ejerciciosDeRutina(api, bd, yo.id);
const cambiado = lista.find((e) => e.id === cambiable.opciones[0].id);
check(!!cambiado && cambiado.guia?.id === cambiable.id && !lista.some((e) => e.id === cambiable.id), `al cambiarlo, su semana ya lleva la alternativa («${cambiado?.nombre}», en lugar de «${cambiado?.guia?.nombre}»)`);
await api.esencialAlternativa(cambiado.id, null);
check((await datos.ejerciciosDeRutina(api, bd, yo.id)).some((e) => e.id === cambiable.id && !e.guia), 'y se puede volver al de su rutina');

// El viaje y el objetivo: uno cada vez; solo fechas y qué va a hacer
const hoy0 = hoyISO();
let r = await datos.apuntarViaje(bd, yo.id, { desde: mas(hoy0, 3), hasta: mas(hoy0, 9), modo: 'pausa' });
r = await datos.apuntarViaje(bd, yo.id, { desde: mas(hoy0, 5), hasta: mas(hoy0, 12), modo: 'viaje' });
let nv = await datos.notasVida(bd, yo.id);
check(nv.viaje.length === 1 && nv.viaje[0].datos.modo === 'viaje' && String(nv.viaje[0].desde).slice(0, 10) === mas(hoy0, 5) && nv.viaje[0].texto == null && Object.keys(nv.viaje[0].datos).join() === 'modo'
  && v.viajeDe(nv.viaje, hoy0).estado === 'antes', 'un viaje cada vez (el nuevo quita el anterior): se guardan las fechas y qué va a hacer, nada más');
await datos.apuntarObjetivo(bd, yo.id, { texto: 'No faltar ninguna semana', fecha: mas(hoy0, 84) });
await datos.apuntarObjetivo(bd, yo.id, { texto: 'No faltar hasta el verano', fecha: mas(hoy0, 90) });
nv = await datos.notasVida(bd, yo.id);
check(nv.objetivo.length === 1 && nv.objetivo[0].texto === 'No faltar hasta el verano' && nv.objetivo[0].desde == null && v.objetivoDe(nv.objetivo[0], hoy0)?.momento === 'camino', 'y un objetivo cada vez, con su fecha');
await datos.quitarNota(bd, nv.viaje[0].id);

// El resumen del coach lee la semana de todos
await hacer(9);
{
  const coach = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
  await coach.auth.entrar('coach@fbe.demo', 'demo').catch(() => null);
  const todo = await datos.semanaDeTodos(bd).catch((e) => ({ error: e.message }));
  const res = todo.filas ? v.resumenCoach(todo) : null;
  check(!!res && res.total >= 1 && todo.filas.some((f) => f.atleta_id === yo.id && f.hechas === f.total && f.total >= 2), `el resumen de la semana sale de lo que hay («${res?.frase}»)`);
}

// Las reglas apagadas: sin `extras`, la propuesta es la de siempre; con ellas, lo que dicen (su semana 5, hecha entera)
const pr = await api.programa(yo.id);
const d = await api.bloqueCompleto(pr.bloque.id);
const base = d.semanas.find((w) => w.id === pr.actual.id);
const ejercicios = Object.fromEntries((await api.ejerciciosPorIds([...new Set(Object.values(d.pautas).flat().map((x) => x.ejercicio_id))])).map((e) => [e.id, e]));
const args = { d, base, tipo: 'siguiente', ejercicios, atleta: yo, hoy: hoyISO() };
const normal = propuestaEsencial(args);
const kilos = (p) => p.sesiones.flatMap((s) => s.pautas.map((x) => `${x.ejercicio_id}:${x.carga_sugerida_kg}:${x.reps_min}-${x.reps_max}:${x.series}`)).join('|');
const deBase = [...d.sesiones[base.id]].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).flatMap((s) => [...d.pautas[s.id]].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((x) => `${x.ejercicio_id}:${x.carga_sugerida_kg}:${x.reps_min}-${x.reps_max}:${x.series}`)).join('|');
check(kilos(normal) !== deBase && normal.porque.some((f) => ['subir', 'reps', 'series'].includes(f.tipo)) && !normal.conservada && kilos(propuestaEsencial({ ...args, extras: null })) === kilos(normal) && kilos(propuestaEsencial({ ...args, extras: {} })) === kilos(normal),
  'sin extras (como está ahora), tras cumplir en todo, la semana siguiente sube');
const suave = propuestaEsencial({ ...args, extras: { conservar: 'suave' } });
check(kilos(suave) === deBase && suave.nota === NOTA_CONSERVAR.suave && suave.conservada === 'suave' && suave.porque.length === normal.porque.length && suave.porque.every((f) => f.frenos.join() === 'suave' && explicar(f).clase === 'igual') && !suave.descarga && !suave.preguntas.length,
  '(apagado) tras una semana que pidió suave: repite la carga tal cual, con su nota y su porqué');
const duras = propuestaEsencial({ ...args, extras: { conservar: 'duras' } });
check(kilos(duras) === deBase && duras.nota === NOTA_CONSERVAR.duras && duras.porque.every((f) => f.frenos.join() === 'dos_duras'), '(apagado) con dos sesiones a 9 o más: lo mismo, con el suyo');
check(kilos(propuestaEsencial({ ...args, tipo: 'novato', extras: { conservar: 'suave' } })) === kilos(propuestaEsencial({ ...args, tipo: 'novato' })), 'en la semana que sale de sus marcas no se aplica');
const zona = { zona: 'cuadriceps', intensidad: 2, semana_inicio: base.fecha_inicio };
const avisa = propuestaEsencial({ ...args, molestias: [zona] }), frena = propuestaEsencial({ ...args, molestias: [zona], extras: { molestiaFrena: true } });
const conFreno = frena.porque.filter((f) => f.frenos.includes('molestia'));
const subia = normal.porque.filter((f) => /Prensa/.test(f.nombre) && f.tipo === 'subir').length;
check(subia >= 1 && avisa.porque.every((f) => !f.frenos.includes('molestia')) && kilos(avisa) === kilos(normal) && conFreno.length === subia && conFreno.every((f) => /Prensa/.test(f.nombre) && (f.despues.kg ?? null) === (f.antes.kg ?? null) && /molestia apuntada en esa zona/.test(explicar(f).texto))
  && frena.porque.filter((f) => !/Prensa/.test(f.nombre)).every((f, i) => f.despues.kg === normal.porque.filter((x) => !/Prensa/.test(x.nombre))[i].despues.kg),
  `(apagado) con una molestia moderada en el cuádriceps: hoy solo avisa; con la regla encendida, la prensa no sube de peso (${conFreno.length} de ${subia}) y lo demás sigue igual`);
check(kilos(propuestaEsencial({ ...args, molestias: [{ ...zona, intensidad: 1 }], extras: { molestiaFrena: true } })) === kilos(normal), 'una molestia leve no frena ni con la regla encendida');

// Sus marcas de antes y de ahora
const marcas = await datos.marcasAntesYAhora(api, bd, yo.id);
check(marcas && marcas.filas.length >= 4 && marcas.filas.every((f) => f.antes && f.ahora) && marcas.desde === 4, `sus marcas de la semana 4 junto a lo mejor de sus dos últimas semanas (${marcas?.filas.length} ejercicios, ${marcas?.suben} suben)`);
check((await datos.semanasConMolestia(bd, yo.id)) === 0, 'sin molestias apuntadas en sus check-ins, cero semanas');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
