// FBE Esencial (tanda 7, v0.248): «La espera», de la reserva a su lunes. Lógica pura: lo de cada día, lo que le falta para
// estar listo, si entra tarde, las dos cosas de cada ejercicio, su punto de partida, su porqué de vuelta, sus kilos de
// partida (apagado), lo de su médico (apagado), «Listos para el lunes» del panel y los 27 días con el reloj (quien empieza
// de cero y quien ya entrena).
import { PASOS_ESPERA, PASOS_CORTA, pasoDeHoy, listaListo, tituloListo, esperaDe, dosCosas, primerDia, PRUEBA_AVISO, ARREGLAR_AVISOS, sistemaDe, textoCompaneros,
  validarPartida, antesYAhora, primeraFallada, textoPorque, limpiarKilos, textoKilosPartida, textoMedico, MIENTRAS_MEDICO, faltaDe, listosLunes, diasEntre } from '../web/src/logica/esencial-espera.js';
import { RESPUESTAS, CATEGORIAS, APAGADO, encendido, enTema, respuestas } from '../web/src/logica/esencial-respuestas.js';
import { trimestreDe } from '../web/src/logica/esencial-cerca.js';
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

console.log('Lo de cada día (61)');
{
  const ids = PASOS_ESPERA.map((x) => x.id);
  check(ids.join() === 'porque,gimnasio,ejercicio,partida,calendario,ensayo,companeros,avisos,primer_dia,vispera', 'diez cosas, en su orden: del porqué a la víspera');
  check(PASOS_ESPERA.every((x, i) => i === 0 || x.desde < PASOS_ESPERA[i - 1].hasta || (x.desde === 1 && PASOS_ESPERA[i - 1].hasta === 2)), 'los tramos no se pisan');
  check(PASOS_ESPERA.every((x) => x.titulo && x.texto && x.texto.length <= 160), 'cada una, con su título y un texto corto');
  const de = (f, extra = {}) => pasoDeHoy({ faltan: f, conPlan: true, ejercicios: 5, ...extra })?.id;
  check(de(27) === 'porque' && de(25) === 'porque', 'del día 27 al 25 (faltando), su porqué');
  check(de(24) === 'gimnasio' && de(22) === 'gimnasio', 'del 24 al 22, su gimnasio');
  check(de(21) === 'ejercicio' && de(17) === 'ejercicio', 'del 21 al 17, un ejercicio al día');
  check(de(16) === 'partida' && de(13) === 'calendario' && de(10) === 'ensayo' && de(7) === 'companeros' && de(4) === 'avisos' && de(2) === 'primer_dia', 'luego el punto de partida, el calendario, ensayar, los compañeros, el aviso de prueba y el primer día');
  check(de(1) === 'vispera' && de(1, { hechos: Object.fromEntries(PASOS_ESPERA.map((x) => [x.id, true])) }) === 'vispera', 'la víspera, siempre su primera sesión (aunque lo haya hecho todo)');
  check(pasoDeHoy({ faltan: 0, conPlan: true }) === null && pasoDeHoy({ faltan: -3, conPlan: true }) === null && pasoDeHoy({}) === null, 'su lunes o después, nada (Hoy de siempre)');
  // si ya está hecho, la primera práctica pendiente que ya ha llegado; si no queda, adelanta
  check(de(22, { hechos: { gimnasio: true } }) === 'ejercicio', 'con el gimnasio ya mirado, adelanta al ejercicio del día');
  check(de(12, { hechos: { calendario: true } }) === 'gimnasio', 'con el calendario puesto y el gimnasio sin mirar, el gimnasio (es de los que se recuperan)');
  check(de(26, { hechos: { porque: true } }) === 'gimnasio', 'con su porqué ya escrito el primer día, adelanta');
  check(de(9, { hechos: { porque: true, gimnasio: true, partida: true, calendario: true, ensayo: true, vistos: 5 } }) === 'companeros', 'quien lo lleva todo hecho adelanta lo siguiente');
  check(de(3, { hechos: { porque: true, gimnasio: true, partida: true, calendario: true, ensayo: true, companeros: true, avisos: true, primer_dia: true, vistos: 5 } }) === undefined, 'con todo hecho, nada más hasta la víspera («Todo listo por hoy»)');
  // sin plan: nada que dependa de él
  const sin = (f, h = {}) => pasoDeHoy({ faltan: f, conPlan: false, ejercicios: 0, hechos: h })?.id;
  check(sin(23) !== 'gimnasio' && sin(19) !== 'ejercicio' && sin(12) !== 'calendario' && sin(1) !== 'vispera', 'sin plan todavía: ni gimnasio, ni ejercicios, ni calendario, ni víspera');
  check(sin(1) === 'avisos', 'sin plan, la víspera, los avisos si siguen sin probar');
  // un ejercicio al día
  const e1 = pasoDeHoy({ faltan: 20, conPlan: true, ejercicios: 5, hechos: { vistos: 0 } });
  const e1b = pasoDeHoy({ faltan: 20, conPlan: true, ejercicios: 5, hechos: { vistos: 1 }, vistoHoy: true });
  const e2 = pasoDeHoy({ faltan: 19, conPlan: true, ejercicios: 5, hechos: { vistos: 1 } });
  check(e1.n === 0 && !e1.visto && e1b.id === 'ejercicio' && e1b.n === 0 && e1b.visto && e2.n === 1, 'el ejercicio del día: el primero; visto, sigue ese con «Mañana, el siguiente»; al día siguiente, el segundo');
  check(pasoDeHoy({ faltan: 18, conPlan: true, ejercicios: 0 })?.id !== 'ejercicio', 'sin ejercicios cargados, no sale el del día');
}

console.log('\nSi entra tarde (73)');
{
  const e = esperaDe({ hoy: '2027-01-08', inicio: '2027-01-11', alta: '2027-01-08' });
  check(e.faltan === 3 && e.corta && /lo imprescindible/.test(e.titulo), 'reserva a tres días de su lunes: «Faltan 3 días: lo imprescindible»');
  check(esperaDe({ hoy: '2027-01-09', inicio: '2027-01-11', alta: '2026-12-15' }).corta === false, 'quien reservó el 15/12 no pasa a la versión corta aunque falten dos días');
  check(esperaDe({ hoy: '2026-12-15', inicio: '2027-01-11', alta: '2026-12-15' }).titulo === 'Hasta tu lunes' && esperaDe({ hoy: '2027-01-10', inicio: '2027-01-11', alta: '2027-01-10' }).cuando === 'Mañana empiezas', 'los títulos: «Hasta tu lunes» y, la víspera, «Mañana empiezas»');
  check(esperaDe({ hoy: '2027-01-11', inicio: '2027-01-11' }) === null && esperaDe({ hoy: 'mal', inicio: '2027-01-11' }) === null, 'su lunes (o sin fecha), nada');
  const ids = new Set();
  for (let f = 4; f >= 1; f--) ids.add(pasoDeHoy({ faltan: f, conPlan: true, corta: true, ejercicios: 5 })?.id);
  check([...ids].every((x) => PASOS_CORTA.includes(x)) && ids.has('avisos') && ids.has('primer_dia') && ids.has('vispera'), 'en la corta, solo el aviso de prueba, el primer día y la víspera');
}

console.log('\nLo que le falta para estar listo (62)');
{
  const l0 = listaListo({ estado: 'cuestionario' });
  check(l0.quedan === 4 && l0.items.find((i) => i.id === 'dias').sinPlan, 'sin cuestionario: cuatro cosas (cuestionario, días, avisos y gimnasio; las de su plan, «cuando tengas tu plan»)');
  const l1 = listaListo({ estado: 'visto_bueno', pideVistoBueno: true, avisos: true });
  check(l1.items.some((i) => i.id === 'visto_bueno' && !i.hecho) && l1.quedan === 3, 'con el cribado que pide médico: el visto bueno en la lista');
  const l2 = listaListo({ estado: 'revision', pideVistoBueno: true });
  check(l2.items.find((i) => i.id === 'visto_bueno').espera === true, 'marcado y por confirmar: «Pelayo lo está revisando»');
  const l3 = listaListo({ estado: 'espera', conPlan: true, dias: true, avisos: true, gimnasio: true });
  check(l3.listo && l3.quedan === 0 && tituloListo(0) === 'Todo listo para tu lunes', 'con plan, días, avisos y gimnasio: «Todo listo para tu lunes»');
  check(tituloListo(1) === 'Te queda 1 cosa para estar listo' && tituloListo(3) === 'Te quedan 3 cosas para estar listo', 'el título cuenta lo que queda');
  check(listaListo({ estado: 'rutina' }).items[0].titulo === 'Elegir tu rutina', 'quien ya entrena y no ha elegido rutina: «Elegir tu rutina»');
}

console.log('\nUn ejercicio al día: dos cosas (65)');
{
  const a = dosCosas({ instrucciones: '1. Espalda pegada al respaldo.\n2. Baja hasta donde no se despegue la zona lumbar.\n3. Sube sin bloquear.' });
  check(a.length === 2 && a[0] === 'Espalda pegada al respaldo.' && /zona lumbar/.test(a[1]), 'de las notas de Pelayo: las dos primeras, sin el número delante');
  const b = dosCosas({ instrucciones: 'Pies a la anchura de la cadera. Rodillas hacia fuera' });
  check(b[0] === 'Pies a la anchura de la cadera.' && b[1] === 'Rodillas hacia fuera.', 'por frases, con su punto');
  const c = dosCosas({}, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.');
  check(c.length === 2 && /remo en máquina/.test(c[0]) && /vídeo/.test(c[1]), 'sin notas: la de la guía y mirar el vídeo (nada inventado)');
  check(dosCosas({ instrucciones: '• Codos a 45 grados.\n– Aprieta la escápula.' })[0] === 'Codos a 45 grados.' && dosCosas({ instrucciones: '3 segundos al bajar, uno al subir.' })[0].startsWith('3 segundos'), 'quita las viñetas, no las cifras');
}

console.log('\nEl primer día, los avisos, los compañeros (66, 67, 71)');
{
  const p = primerDia({ primeras: true });
  check(p.length === 5 && p.map((x) => x.id).join() === 'llevar,dura,llegar,peso,ocupada' && /media hora/.test(p[1].texto), 'el primer día, en cinco pasos (con «media hora y a casa» en la guía)');
  check(/portada de la sesión/.test(primerDia({ primeras: false })[1].texto), 'quien ya entrena: la duración, en la portada de la sesión');
  check(PRUEBA_AVISO.ok && PRUEBA_AVISO.sin_canal && PRUEBA_AVISO.espera, 'lo que dice a cada respuesta del aviso de prueba');
  check(sistemaDe('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)') === 'ios' && sistemaDe('Mozilla/5.0 (Linux; Android 14)') === 'android' && sistemaDe('Mozilla/5.0 (Windows NT 10.0)') === 'otro', 'según su móvil, iPhone, Android u otro');
  check(['ios', 'android', 'otro'].every((k) => ARREGLAR_AVISOS[k].length >= 2), 'y qué mirar en cada uno');
  check(textoCompaneros(32, '2027-01-11', (x) => `lunes ${x.slice(8)}`) === 'Empezáis 32 el lunes 11.' && textoCompaneros(2, '2027-01-11') === null && textoCompaneros(null, '2027-01-11') === null, '«Empezáis 32 el lunes 11»; con menos de tres, nada');
}

console.log('\nSu punto de partida (68) y su trimestre');
{
  check(validarPartida({ peso: '72,5', cintura: '' }).peso === 72.5 && validarPartida({ peso: '', cintura: '88' }).cintura === 88, 'uno de los dos basta (con coma o con punto)');
  check(!!validarPartida({ peso: '', cintura: '' }).error && !!validarPartida({ peso: '7', cintura: '' }).error && !!validarPartida({ peso: '70', cintura: '400' }).error, 'nada, o fuera de rango: lo dice');
  const r = antesYAhora([{ fecha: '2026-12-20', valor: 80 }, { fecha: '2027-01-08', valor: 79.5 }, { fecha: '2027-04-01', valor: 77 }], '2027-01-11');
  check(r && r.antes === 79.5 && r.ahora === 77, 'en su trimestre: lo primero desde una semana antes de su lunes, y lo último');
  check(antesYAhora([{ fecha: '2027-01-08', valor: 80 }], '2027-01-11') === null, 'con una sola medida, nada que comparar');
  const t = trimestreDe({ filas: [], sesiones: 20, semanas: 12, cuerpo: { peso: { antes: 79.5, ahora: 77 }, cintura: { antes: 90, ahora: 90 } } });
  check(t.cuerpo.length === 2 && t.cuerpo[0].texto === 'de 79,5 a 77 kg' && t.cuerpo[1].texto === '90 cm, como al empezar', '«Tu trimestre»: el peso y la cintura de antes y de ahora');
  check(trimestreDe({ filas: [], sesiones: 2, semanas: 2 }).cuerpo.length === 0, 'sin punto de partida, sin esas líneas');
}

console.log('\nSu porqué, de vuelta (69)');
{
  const w = (n, hechas, total, pausa = false) => ({ numero: n, fecha_inicio: sumar('2027-01-11', 7 * (n - 1)), hechas, total, pausa });
  check(primeraFallada([w(1, 2, 2), w(2, 1, 2)])?.numero === 2, 'la primera semana con sesiones sin hacer, si es la última terminada');
  check(primeraFallada([w(1, 2, 2), w(2, 1, 2), w(3, 2, 2)]) === null, 'si ya pasó (y la siguiente fue bien), no');
  check(primeraFallada([w(1, 2, 2), w(2, 0, 2, true)]) === null, 'una semana en pausa no es fallar');
  check(/«Por mis hijos»/.test(textoPorque('Por mis hijos')) && textoPorque('') === null, 'el texto, con su frase tal cual');
}

console.log('\nApagado hasta que Pelayo lo vea (70 y 74)');
{
  check(!APAGADO.has('kilos_partida') && !APAGADO.has('medico') && encendido('kilos_partida') && encendido('medico'), 'sus kilos de partida y lo de su médico, encendidos (Pelayo, 26/11)');
  check(JSON.stringify(limpiarKilos({ a: '40', b: '42,3', c: '0', d: 'x', e: '600' })) === JSON.stringify({ a: 40, b: 42.5 }), 'los kilos: de 1 a 500, de medio en medio');
  check(/40 kg/.test(textoKilosPartida(40)) && textoKilosPartida(null) === null, 'en la sesión, sus kilos como referencia');
  const m = textoMedico({ dias: 2, minutos: 45 });
  check(/2 días por semana/.test(m) && /45 minutos/.test(m) && /ACSM/.test(m) && MIENTRAS_MEDICO.length === 3, 'el texto para su médico, con sus días y sus minutos, y qué pasa mientras');
}

console.log('\nLas dudas de antes de empezar (75)');
{
  const antes = RESPUESTAS.filter((x) => enTema(x, 'antes'));
  check(CATEGORIAS[0][0] === 'antes' && antes.length === 7, '«Antes de empezar», el primer tema: cuatro suyas y tres de otros temas');
  check(['nunca', 'primer-no', 'antes-ya', 'llevar', 'maquina', 'cobro', 'baja'].every((id) => antes.some((x) => x.id === id)), 'nunca he entrenado, el día que empiezo no puedo, empezar antes, qué llevo y, también ahí, la máquina ocupada, el cobro y la baja');
  check(new Set(respuestas().map((x) => x.id)).size === respuestas().length, 'sin respuestas repetidas');
}

console.log('\nListos para el lunes (77)');
{
  const hoy = '2027-01-05';
  const base = { inicio: '2027-01-11', activado_en: 'x', cuestionario_en: 'x', resultado: 'sin_valoracion', plan_inicio: '2027-01-11', dias: true, gimnasio: true, push: true };
  check(faltaDe(base, hoy).length === 0, 'con todo, nada que falte');
  check(faltaDe({ ...base, activado_en: null, cuestionario_en: null, plan_inicio: null, push: false }, hoy).join() === 'cuenta,cuestionario,avisos', 'sin cuenta: la cuenta, el cuestionario y los avisos');
  check(faltaDe({ ...base, resultado: 'valorar_antes', visto_bueno_pedido_en: 'x' }, hoy).includes('confirmar visto bueno'), 'el visto bueno marcado y sin confirmar');
  check(faltaDe({ ...base, dias: false, gimnasio: false }, hoy).join() === 'días,gimnasio', 'sin días y sin mirar su gimnasio');
  check(faltaDe({ ...base, dias: undefined, gimnasio: undefined }, hoy).length === 0, 'sin la 102 (sin esos datos), no los cuenta');
  const vivos = new Map([['a', 'Ana'], ['b', 'Berta'], ['c', 'Carla']]);
  const l = listosLunes([{ ...base, atleta_id: 'a' }, { ...base, atleta_id: 'b', push: false }, { ...base, atleta_id: 'c', inicio: '2027-01-18', plan_inicio: '2027-01-18' }, { ...base, atleta_id: 'z' }], vivos, hoy);
  check(l.proximo === '2027-01-11' && l.total === 2 && l.listos === 1 && l.lista[0].nombre === 'Berta' && l.faltan === 6, 'los del próximo lunes (sin bajas): 1 de 2 listos, primero a quien le falta algo');
  check(listosLunes([{ ...base, atleta_id: 'a', inicio: '2027-03-01' }], vivos, hoy) === null, 'si nadie empieza en las próximas cuatro semanas, nada');
}

console.log('\nLos 27 días con el reloj (80)');
{
  for (const quien of ['de cero', 'ya entrena']) {
    const inicio = '2027-01-11', alta = '2026-12-15';
    const hechos = {};
    let vistos = 0;
    const dias = [];
    for (let d = 0; d < 27; d++) {
      const hoy = sumar(alta, d);
      const e = esperaDe({ hoy, inicio, alta });
      const conPlan = d >= 2;   // (rellena el cuestionario y tiene su plan el día 2)
      const nEj = quien === 'de cero' ? 5 : 7;
      const paso = pasoDeHoy({ faltan: e.faltan, hechos: { ...hechos, vistos }, conPlan, corta: e.corta, ejercicios: conPlan ? nEj : 0 });
      dias.push({ f: e.faltan, id: paso?.id || null, conPlan });
      // hace lo de hoy (el ejercicio, uno al día)
      if (paso?.id === 'ejercicio') vistos++;
      else if (paso && paso.id !== 'vispera') hechos[paso.id] = true;
    }
    check(dias.length === 27 && dias[0].f === 27 && dias[26].f === 1, `${quien}: del 15/12 (faltan 27) al 10/1 (la víspera)`);
    check(dias.every((x) => x.id !== null || x.f > 1), `${quien}: cada día, algo que hacer (o «Todo listo» si ya va adelantado)`);
    check(dias.filter((x) => !x.conPlan).every((x) => !['gimnasio', 'ejercicio', 'calendario', 'vispera'].includes(x.id)), `${quien}: antes de tener plan, nada que dependa de él`);
    check(dias[26].id === 'vispera', `${quien}: la víspera, su primera sesión`);
    const vistas = new Set(dias.map((x) => x.id).filter(Boolean));
    check(['porque', 'gimnasio', 'ejercicio', 'partida', 'calendario', 'ensayo', 'companeros', 'avisos', 'primer_dia', 'vispera'].every((id) => vistas.has(id)), `${quien}: en el mes, le sale todo (si lo va haciendo)`);
    check(dias.filter((x) => x.id === 'ejercicio').length >= 5, `${quien}: un ejercicio al día, varios días`);
  }
  // y si no hace nada en todo el mes
  const ids = [];
  for (let f = 27; f >= 1; f--) ids.push(pasoDeHoy({ faltan: f, conPlan: true, ejercicios: 5 })?.id);
  check(ids.every(Boolean) && ids.filter((x, i) => i === 0 || x !== ids[i - 1]).length === 10, 'sin hacer nada, cada cosa en su tramo: diez cambios en el mes, sin días vacíos');
}

console.log('\nEn el código');
{
  const espera = readFileSync(new URL('../web/src/ui/atleta/EsencialEspera.jsx', import.meta.url), 'utf8');
  const esencial = readFileSync(new URL('../web/src/ui/atleta/Esencial.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../web/src/espera.css', import.meta.url), 'utf8');
  check(/perezoso\(\(\) => import\('\.\/EsencialEspera\.jsx'\), 'EsperaArriba'/.test(esencial) && /<EsperaArriba p=\{p\}/.test(esencial) && /<PorqueVuelve p=\{p\} \/>/.test(esencial), 'Hoy de FBE Esencial monta la espera y el porqué (en su trozo)');
  check(/encendido\('kilos_partida', previa\)/.test(espera) && /encendido\('medico', previa\)/.test(espera), 'lo apagado, detrás de su interruptor');
  check(/^[\x00-\x7F]*$/.test(css) && !/margin|font-size|font-weight/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/^\.([a-z-]+)/gm) || []).every((c) => c.startsWith('.lun-')), 'espera.css: ASCII, sin márgenes ni tamaños de letra y solo clases lun-*');
  check(diasEntre('2026-12-15', '2027-01-11') === 27, 'del 15/12 al 11/1, 27 días');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
