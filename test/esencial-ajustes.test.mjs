// FBE Esencial (tanda 8, v0.249): «Tu panel: lo apagado, en tu mano». Lógica pura: lo apagado y sus textos, lo que el
// atleta lee del panel (encendido, textos, respuestas nuevas), el registro, «Tal cual», la curva, los candidatos, lo que ha
// hecho la app, la hoja de cálculo, Stripe frente a la app, el tope de avisos y el repaso de seguridad del motor.
import { REVISAR, AJUSTES, revisarCompleto, estadoDe, textoNuevo, respuestaNueva, textoRegistro, talCual, talCualDe, curvaPiloto, candidatos, loQueHizo, csvPiloto,
  leerStripe, stripeFrenteApp, MOTIVOS_BAJA, topeAlcanzado } from '../web/src/logica/esencial-ajustes.js';
import { APAGADO, encendido, fijarAjustes, textoAjuste, respuestas, respuestaDe, leccionMomento, LECCIONES_MOMENTO } from '../web/src/logica/esencial-respuestas.js';
import { notaDelLunes, diaADia, NOTAS_LUNES, DIA_A_DIA } from '../web/src/logica/esencial-cerca.js';
import { repasoSeguridad, fueraDeRegla } from '../web/src/logica/motor/seguridad.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { hoyISO } from '../web/src/logica/fechas.js';
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

console.log('Lo apagado, en el panel (81)');
check(revisarCompleto() && REVISAR.length === APAGADO.size, `cada cosa apagada tiene su ficha en el panel (${REVISAR.length})`);
check(REVISAR.every((x) => x.titulo && x.que && ['texto', 'regla', 'salud'].includes(x.tipo) && Array.isArray(x.ver) && x.ver.length === 2), 'con su título, qué hace, de qué tipo es y dónde verla en la demo');
check(['molestia_frena', 'suave', 'dos_duras', 'variante', 'kilos_partida'].every((k) => REVISAR.find((x) => x.clave === k).tipo === 'regla') && ['enfermo', 'alarma', 'medico', 'salud_nueva'].every((k) => REVISAR.find((x) => x.clave === k).tipo === 'salud'),
  'las reglas nuevas, como reglas; lo de salud, como salud');
const conTextos = REVISAR.filter((x) => x.textos?.length);
check(conTextos.map((x) => x.clave).sort().join() === 'dia_a_dia,lecciones_momento,notas_lunes,salud_nueva', 'con textos para corregir: las notas de los lunes, las respuestas de salud, las lecciones y el día a día');
check(REVISAR.find((x) => x.clave === 'notas_lunes').textos.length === Object.keys(NOTAS_LUNES).length && REVISAR.find((x) => x.clave === 'dia_a_dia').textos.length === Object.keys(DIA_A_DIA).length, 'una por cada nota y cada día');
check(AJUSTES.map((x) => x.clave).join() === 'tope_dia,tope_semana,resumen_lunes' && AJUSTES[1].numero.join() === '3,14,7', 'y los tres ajustes: un aviso al día, N a la semana (de 3 a 14, 7 de partida) y tu lunes');
const est = estadoDe([{ clave: 'enfermo', encendido: true }, { clave: 'medico', solo_atleta: 'x' }, { clave: 'nota_lunes:3', texto: { texto: 'Mía' } }]);
check(est.find((x) => x.clave === 'enfermo').estado === 'encendido' && est.find((x) => x.clave === 'medico').estado === 'probando' && est.find((x) => x.clave === 'alarma').estado === 'apagado' && est.find((x) => x.clave === 'notas_lunes').editados === 1,
  'el estado de cada una: encendida, probándose en una cuenta o apagada, y cuántos textos suyos');

console.log('\nSus textos (82, 85 y 86)');
check(textoNuevo({ texto: 'Hola' }, { texto: 'Hola' }) === null && textoNuevo({ texto: 'Hola' }, { texto: '  ' }) === null, 'si lo deja como el de la app (o vacío), no se guarda nada');
check(JSON.stringify(textoNuevo({ q: 'P', r: 'R' }, { q: 'P', r: 'Otra' })) === JSON.stringify({ r: 'Otra' }), 'solo se guarda lo que cambia');
check(!!textoNuevo({ texto: 'a' }, { texto: 'x'.repeat(1501) }).error, 'demasiado largo, lo dice');
const rn = respuestaNueva({ cat: 'antes', q: '¿Puedo ir con mi hijo?', r: 'Sí, si tu gimnasio le deja entrar.' });
check(rn.clave === 'respuesta_nueva:puedo-ir-con-mi-hijo' && rn.texto.cat === 'antes' && !!respuestaNueva({ q: 'x', r: 'y' }).error, 'una respuesta nueva: su clave sale de la pregunta (sin tildes); sin texto, lo dice');
check(respuestaNueva({ q: '¿Cuándo se me cobra?', r: 'El lunes en que empiezas.' }, []).clave === 'respuesta_nueva:cuando-se-me-cobra' && respuestaNueva({ q: '¿Plan???', r: 'Una respuesta larga.' }).clave === 'respuesta_nueva:plan-2', 'sin pisar las que ya existen');

console.log('\nLo que lee el atleta (81-83 y 86)');
fijarAjustes([]);
check(!encendido('enfermo') && encendido('enfermo', true) && encendido('una_cualquiera'), 'sin nada del panel: lo apagado, apagado (en la vista previa, encendido)');
fijarAjustes([{ clave: 'enfermo', encendido: true }, { clave: 'alarma', encendido: false }, { clave: 'nota_lunes:3', texto: { texto: 'Mi nota.' } }, { clave: 'respuesta:cobro', texto: { r: 'Otra respuesta.' } },
  { clave: 'respuesta_nueva:hijo', texto: { cat: 'antes', q: '¿Con mi hijo?', r: 'Sí.' } }, { clave: 'momento:descarga', texto: { titulo: 'Mi descarga' } }, { clave: 'dia:2', texto: { texto: 'Mi día 2.' } }]);
check(encendido('enfermo') && !encendido('alarma'), 'lo que Pelayo enciende, encendido; lo demás, igual');
check(notaDelLunes(3) === 'Mi nota.' && notaDelLunes(4) === NOTAS_LUNES[4] && diaADia(2) === 'Mi día 2.' && diaADia(3) === DIA_A_DIA[3], 'sus notas de los lunes y su día a día, con su texto donde lo ha escrito');
check(leccionMomento('descarga')[0] === 'Mi descarga' && leccionMomento('descarga')[1] === LECCIONES_MOMENTO.descarga[1] && leccionMomento('nada') === null, 'las lecciones de momento, con su título (y el texto de la app si no lo cambió)');
check(respuestaDe('cobro').r === 'Otra respuesta.' && respuestaDe('hijo')?.suya && respuestas().length === respuestas().filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).length, 'las respuestas, corregidas y la suya añadida (sin repetir)');
check(textoAjuste('nota_lunes:9', 'texto', 'por defecto') === 'por defecto', 'sin su texto, el de la app');
fijarAjustes(null);
check(!encendido('enfermo') && notaDelLunes(3) === NOTAS_LUNES[3], 'y sin la 103 (o vacío), todo como siempre');

console.log('\nEl registro (87)');
check(textoRegistro({ clave: 'enfermo', antes: null, despues: { clave: 'enfermo', encendido: true } }) === 'Encendiste «Estoy enfermo»', '«Encendiste «Estoy enfermo»»');
check(textoRegistro({ clave: 'enfermo', antes: { encendido: true }, despues: { encendido: false } }) === 'Apagaste «Estoy enfermo»', '«Apagaste…»');
check(/^Probaste Sus kilos de partida en una cuenta$/.test(textoRegistro({ clave: 'kilos_partida', antes: { solo_atleta: null }, despues: { solo_atleta: 'x' } })), '«Probaste … en una cuenta»');
check(textoRegistro({ clave: 'nota_lunes:3', antes: null, despues: { clave: 'nota_lunes:3', texto: { texto: 'x' } } }) === 'Escribiste Semana 3' && textoRegistro({ clave: 'nota_lunes:3', antes: { texto: { texto: 'x' } }, despues: null }) === 'Quitaste lo tuyo de Semana 3', '«Escribiste…» y «Quitaste lo tuyo de…»');
check(textoRegistro({ clave: 'tope_semana', antes: { valor: 7, encendido: true }, despues: { valor: 5, encendido: true } }) === 'Cambiaste Como mucho N avisos a la semana a 5', 'el número del tope');

console.log('\nEl piloto (88, 89, 93, 95 y 99)');
const hoy = '2027-03-03';   // (miércoles de la semana 8 de quien empezó el 11/1)
const w = (a, n, hechas, total = 2, extra = {}) => ({ atleta_id: a, inicio: sumar('2027-01-11', 7 * (n - 1)), numero: n, bloque: n <= 4 ? 'Primeras 4 semanas' : 'Novato 2 días', total, hechas, cambios: 0, sube: 0, cierre: null, ...extra });
const filas = [];
for (let n = 1; n <= 8; n++) filas.push(w('a', n, 2, 2, n === 6 ? { sube: 3 } : {}));
for (let n = 1; n <= 8; n++) filas.push(w('b', n, n <= 3 ? 2 : n === 4 ? 1 : 0, 2, n === 5 ? { cierre: 'pausa' } : n === 2 ? { cambios: 1 } : {}));
filas.push(w('c', 7, 2, 2, { inicio: '2027-02-22' }), w('c', 8, 0, 2, { inicio: '2027-03-01' }));
check(talCual(w('x', 1, 2)) && !talCual(w('x', 1, 1)) && !talCual(w('x', 1, 2, 2, { cambios: 1 })) && !talCual(w('x', 1, 2, 2, { cierre: 'repetir' })), '«Tal cual»: entera, sin cambiar ejercicios y sin repetirla ni pausarla');
const tc = talCualDe(filas, hoy);
const ta = tc.lista.find((x) => x.atleta_id === 'a'), tb = tc.lista.find((x) => x.atleta_id === 'b');
check(ta.semanas === 7 && ta.talCual === 7 && tb.talCual === 2 && tb.cambios === 1 && tb.pausa === 1 && tb.incompletas === 3, `por atleta: Ana, 7 de 7; Berta, 2 (una con cambios, una en pausa y tres a medias)`);
check(tc.semanas === 15 && tc.pct === Math.round((10 / 15) * 100), `y en total: ${tc.talCual} de ${tc.semanas} (${tc.pct} %), sin contar la semana en curso`);
const cu = curvaPiloto(filas, hoy);
check(cu.puntos.length === 7 && cu.puntos[0].total === 3 && cu.puntos[0].entrenaron === 3 && cu.puntos[4].entrenaron === 1 && cu.liston === 70, 'la curva: cada semana del plan de cada uno, cuántos entrenaron (y el listón, 70 de cada 100)');
const ca = candidatos([...filas, w('a', 9, 2, 2, { inicio: '2027-03-08' })], '2027-03-15', [{ atleta_id: 'b', creada_en: '2027-02-20T10:00:00Z' }]);
check(ca.length === 2 && ca.find((x) => x.atleta_id === 'a').motivo === 'ocho semanas seguidas con todo hecho' && /hablar con Pelayo/.test(ca.find((x) => x.atleta_id === 'b').motivo), 'candidatos: ocho semanas seguidas con todo hecho, o quien miró «hablar con Pelayo»');
const hizo = loQueHizo([...filas, w('a', 9, 0, 2, { inicio: '2027-03-01', sube: 2 })], hoy, [{ desde: '2027-03-02', hasta: '2027-03-09' }, { desde: '2027-01-01', hasta: '2027-01-05' }]);
check(hizo.preparadas === 4 && hizo.viajes === 1, `lo que ha hecho la app esta semana (${JSON.stringify(hizo)})`);
const csv = csvPiloto(filas, new Map([['a', 'Ana; la de «arriba»'], ['b', 'Berta'], ['c', 'Carla']]));
const lineas = csv.split('\r\n');
check(lineas.length === filas.length + 1 && lineas[0].startsWith('Atleta;Semana del plan;') && lineas[1].startsWith('"Ana; la de «arriba»";1;2027-01-11;Primeras 4 semanas;2;2;0;0;;sí'), 'la hoja de cálculo: una fila por atleta y semana, con punto y coma (y las comillas donde hacen falta)');
check(lineas.some((l) => l.startsWith('Carla;1;2027-02-22')), 'la semana del plan cuenta desde su primer lunes');

console.log('\nStripe frente a la app (91)');
const t = ['id,email,status', 'sub_1,ana@x.com,active', 'sub_2,berta@x.com,canceled', 'carla@x.com\tActiva', 'dani@x.com · past_due', 'sub_3,ana@x.com,incomplete_expired'].join('\n');
const leidas = leerStripe(t);
check(leidas.size === 4 && leidas.get('ana@x.com') === 'active' && leidas.get('carla@x.com') === 'active' && leidas.get('dani@x.com') === 'past_due', 'lee correos y estados (en inglés o en español; activa gana a caducada)');
const r = stripeFrenteApp(t, [{ email: 'ANA@x.com', estado: 'invitado', nombre: 'Ana' }, { email: 'berta@x.com', estado: 'activo', nombre: 'Berta' }, { email: 'dani@x.com', estado: 'activo', nombre: 'Dani' }, { email: 'eva@x.com', estado: 'activo', nombre: 'Eva' }]);
check(r.sinAcceso.length === 2 && r.sinAcceso[0].motivo === 'no ha activado su cuenta' && r.sinAcceso[1].motivo === 'no tiene ficha en la app', 'han pagado o reservado y no tienen acceso: Ana (sin activar) y Carla (sin ficha)');
check(r.deBajaYDentro.map((x) => x.nombre).join() === 'Berta' && r.impagados.map((x) => x.nombre).join() === 'Dani' && r.sinStripe.map((x) => x.nombre).join() === 'Eva', 'de baja y activa en la app: Berta; cobro pendiente: Dani; en la app y no en Stripe: Eva');

console.log('\n¿Por qué te vas? (92) y el tope de avisos (97)');
check(MOTIVOS_BAJA.map((x) => x[0]).join() === 'tiempo,precio,seguimiento,app,resultados,otro' && !MOTIVOS_BAJA.some((x) => /salud|lesi|dolor/i.test(x[1])), 'los motivos, de una lista (ninguno de salud), como en la base');
check(topeAlcanzado(['2027-03-03'], '2027-03-03', { dia: true }) === 'dia' && topeAlcanzado(['2027-03-02'], '2027-03-03', { dia: true }) === null, 'como mucho uno al día');
check(topeAlcanzado(['2027-03-01', '2027-03-02', '2027-03-03'], '2027-03-03', { semana: 3 }) === 'semana' && topeAlcanzado(['2027-02-28', '2027-03-01'], '2027-03-03', { semana: 2 }) === null && topeAlcanzado([], '2027-03-03', {}) === null, 'y N a la semana (de lunes a domingo); sin tope, nunca');

console.log('\nEl repaso de seguridad del motor (96)');
{
  const db = semillaDemo(hoyISO(), { esencial: true });
  const suyos = new Set(db.atletas.filter((a) => a.modalidad === 'por_su_cuenta').map((a) => a.id));
  const bloques = db.bloques.filter((b) => !b.es_plantilla && suyos.has(b.atleta_id));
  const copia = { atletas: db.atletas.filter((a) => suyos.has(a.id)), bloques, semanas: db.semanas, sesiones: db.sesiones, sesion_ejercicios: db.sesion_ejercicios, series: db.series, ejercicios: db.ejercicios, checkins: db.checkins || [], molestias: db.molestias || [] };
  const c = repasoSeguridad(copia, { porSuCuenta: true });
  check(c.semanas >= 1 && c.filas >= 5 && fueraDeRegla(c) === 0, `la demo de FBE Esencial: ${c.filas} propuestas en ${c.semanas} semanas, ninguna fuera de regla`);
  const todo = { ...copia, atletas: db.atletas, bloques: db.bloques.filter((b) => !b.es_plantilla) };
  const c2 = repasoSeguridad(todo, { porSuCuenta: true });
  check(c2.semanas > c.semanas && typeof fueraDeRegla(c2) === 'number', 'con todos los de la demo, lo mismo (y la cifra que importa)');
}

console.log('\nEn el código');
{
  const css = readFileSync(new URL('../web/src/panel-esencial.css', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../web/src/ui/coach/EsencialPanel.jsx', import.meta.url), 'utf8');
  const hoyE = readFileSync(new URL('../web/src/ui/atleta/Esencial.jsx', import.meta.url), 'utf8');
  check(/^[\x00-\x7F]*$/.test(css) && !/margin|font-size|font-weight/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/^\.([a-z-]+)/gm) || []).every((c) => /^\.(prv-|ayu-baja)/.test(c)), 'panel-esencial.css: ASCII, sin márgenes ni tamaños de letra y solo clases prv-* (y la hoja de la baja)');
  check(/perezoso\(\(\) => import\('\.\/EsencialRevisar\.jsx'\), 'PanelRevisar'/.test(panel) && /fijarAjustes\(ajustes\.datos\)/.test(hoyE), 'el panel, en su trozo; y Hoy lee lo que Pelayo enciende');
  const script = readFileSync(new URL('../scripts/seguridad-motor.mjs', import.meta.url), 'utf8');
  check(/import \{ repasoSeguridad \} from '\.\.\/web\/src\/logica\/motor\/seguridad\.js'/.test(script) && !/proponerSemana\(/.test(script), 'el guion del repaso usa el mismo cálculo que el panel');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
