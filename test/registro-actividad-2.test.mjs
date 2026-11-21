// (v0.206) Registro y Actividad, segunda tanda: lo puro (por ejercicios, la semana, el desvío de esfuerzo, el rendimiento
// del día, la sesión como texto, el CSV del bloque, comparar sesiones, «Para mirar», lo que cuelga de cada sesión, la
// semana desplegada, el calendario, el ritmo y lo visto), la actividad en la demo (cada pesada con su tendencia y lo tuyo)
// y lo que tiene que estar en su sitio.
//   node test/registro-actividad-2.test.mjs
import { readFileSync } from 'node:fs';
import * as R from '../web/src/logica/registro-actividad.js';
import { seriesACsv } from '../web/src/logica/calculos.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

// Un bloque de juguete: dos semanas, una sesión por semana, sentadilla (con RPE pautado) y dominadas (sin kilos)
const completo = {
  semanas: [{ id: 'w2', numero: 2 }, { id: 'w1', numero: 1 }],
  sesiones: {
    w1: [{ id: 's1', nombre: 'Pierna', completada: true, revisada_en: '2026-11-10', fecha_realizada: '2026-11-09', semana: { numero: 1 } }],
    w2: [{ id: 's2', nombre: 'Pierna', completada: true, revisada_en: null, fecha_realizada: '2026-11-16', rpe_sesion: 8, semana: { numero: 2 } }, { id: 's3', nombre: 'Torso', completada: false, semana: { numero: 2 } }],
  },
  pautas: {
    s1: [{ id: 'p1', ejercicio_id: 'sen', series: 3, rpe_objetivo: 8 }, { id: 'p2', ejercicio_id: 'dom', series: 3 }],
    s2: [{ id: 'p3', ejercicio_id: 'sen', series: 3, rpe_objetivo: 8 }, { id: 'p4', ejercicio_id: 'dom', series: 3 }],
    s3: [{ id: 'p5', ejercicio_id: 'pre', series: 3 }],
  },
  series: {
    p1: [{ id: 'h1', numero: 1, kg: 100, reps: 5, rpe: 8 }, { id: 'h2', numero: 2, kg: 100, reps: 5, rpe: 8.5 }, { id: 'h3', numero: 3, kg: 100, reps: 5, rpe: 9 }],
    p2: [{ id: 'h4', numero: 1, kg: 0, reps: 8 }, { id: 'h5', numero: 2, kg: 0, reps: 7 }],
    p3: [{ id: 'h6', numero: 1, kg: 105, reps: 5, rpe: 9 }, { id: 'h7', numero: 2, kg: 105, reps: 5, rpe: 9.5, nota: 'pesada; = bien' }],
    p4: [{ id: 'h8', numero: 1, kg: 0, reps: 9 }, { id: 'h9', numero: 2, kg: 0, reps: 8, sustituto_id: 'jal' }],
    p5: [],
  },
};
const nombres = { sen: { nombre: 'Sentadilla' }, dom: { nombre: 'Dominadas' }, jal: { nombre: 'Jalón' }, pre: { nombre: 'Press' } };

console.log('Registro: el desvío de esfuerzo y el bloque por ejercicios');
{
  check(R.desvioEsfuerzo({ rpe_objetivo: 8 }, completo.series.p1) === 0.5 && R.desvioEsfuerzo({ rir_objetivo: 2 }, [{ reps: 5, rir: 1 }]) === 1, 'el desvío: la media de lo que se pasa del esfuerzo pautado (RPE o RIR)');
  check(R.desvioEsfuerzo({}, completo.series.p1) === null && R.desvioEsfuerzo({ rpe_objetivo: 8 }, [{ reps: 5 }]) === null, 'sin objetivo o sin RPE apuntado, no hay desvío');
  check(R.tonoDesvio(0.8) === 'pasado' && R.tonoDesvio(-0.8) === 'suave' && R.tonoDesvio(0.3) === 'justo' && R.tonoDesvio(null) === '', 'su color: por encima, por debajo o en su sitio');
  check(/^\+0,8 por encima de lo pautado$/.test(R.textoDesvio(0.8)) && /^−0,5 por debajo/.test(R.textoDesvio(-0.5)) && R.textoDesvio(0) === 'justo en lo pautado', `y su texto («${R.textoDesvio(0.8)}»)`);
  const pe = R.porEjercicios(completo, nombres);
  const sen = pe.find((e) => e.id === 'sen');
  check(pe[0].id === 'sen' && sen.cols.length === 2 && sen.cols[0].numero === 1 && sen.cols[1].numero === 2, 'por ejercicios: cada uno con sus semanas en orden (S1, S2), el que más series tiene primero');
  check(sen.cols[0].mejor.kg === 100 && sen.cols[1].mejor.kg === 105 && sen.cols[1].e1rm > sen.cols[0].e1rm && sen.linea.length === 2, 'la mejor serie de cada semana, su 1RM y la minilínea');
  check(sen.desvio === 0.8 && sen.cols[0].n === 3 && sen.cols[1].n === 2, `el desvío de todo el bloque (+${sen.desvio}) y cuántas series en cada semana`);
  const dom = pe.find((e) => e.id === 'dom');
  check(dom && dom.cols[0].mejor.reps === 8 && dom.cols[0].e1rm === null && dom.linea.length === 0, 'sin kilos: la serie con más repeticiones (y sin 1RM)');
  check(pe.some((e) => e.id === 'jal' && e.cols[1].n === 1), 'lo que hizo en lugar de lo pautado, por el ejercicio que hizo de verdad');
}

console.log('Registro: la semana arriba, el rendimiento del día y la sesión como texto');
{
  const w2 = R.resumenSemanaBloque(completo, 'w2');
  check(w2.sesiones.hechas === 1 && w2.sesiones.total === 2 && w2.series.pautadas === 9 && w2.series.hechas === 4, 'la semana: sesiones hechas de las previstas y series hechas de las pautadas');
  check(w2.toneladas === 1050 && w2.desvio === 1.3 && w2.porRevisar.join() === 's2', `sus toneladas, el esfuerzo medio frente al pautado (+${w2.desvio}) y las que quedan por revisar`);
  check(R.resumenSemanaBloque(completo, 'nada').sesiones.total === 0, 'una semana sin sesiones, en cero');
  const rd = R.rendimientoDia([{ hoy: 110, antes: 100 }, { hoy: 95, antes: 100 }, null, { hoy: 0, antes: 50 }]);
  check(rd.pct === 2.5 && rd.n === 2 && R.rendimientoDia([]) === null, 'su día frente a la vez anterior: la media del cambio de su 1RM (+2,5 %)');
  const t = R.textoSesion({ ...completo.sesiones.w2[0] }, completo.pautas.s2, completo.series, nombres, (f) => f.slice(5));
  check(/^S2: Pierna \(11-16\), esfuerzo 8\/10/.test(t) && /Sentadilla: 105×5 @9, 105×5 @9,5/.test(t) && /Jalón: 9 rep, 8 rep/.test(t), 'la sesión como texto, lista para pegar');
  check(/Press: sin hacer/.test(R.textoSesion(completo.sesiones.w2[1], completo.pautas.s3, completo.series, nombres)), 'y lo que no hizo, «sin hacer»');
}

console.log('Registro: el CSV del bloque y comparar dos sesiones');
{
  const filas = R.filasCsvBloque(completo, nombres);
  check(filas.length === 9 && filas[0].fecha === '2026-11-09' && filas[0].ejercicio === 'Sentadilla', 'una fila por serie, de la primera semana a la última');
  check(filas.some((f) => f.sustituto && f.ejercicio === 'Jalón' && f.pautado === 'Dominadas'), 'lo cambiado, con lo pautado y lo que hizo');
  const csv = seriesACsv(filas);
  check(csv.split('\r\n')[0].includes('Fecha;Ejercicio') && /"pesada; = bien"/.test(csv) && /;105;5;9;/.test(csv), 'y la hoja de cálculo (con las notas bien escapadas)');
  const em = R.emparejarSesiones({ pautas: completo.pautas.s2, series: completo.series }, { pautas: completo.pautas.s1, series: completo.series });
  const es = em.find((x) => x.id === 'sen');
  check(es.a.length === 2 && es.b.length === 3 && es.fr.dir === 'sube', 'comparar: cada ejercicio, lo de una y lo de otra, y cuál fue mejor');
  check(em.some((x) => x.id === 'jal' && x.b.length === 0) && em.some((x) => x.id === 'dom' && x.a.length === 0), 'con lo que solo está en una de las dos');
}

console.log('Actividad: «Para mirar», lo que cuelga de la sesión y la semana desplegada');
{
  const hoy = '2026-11-21';
  const ev = [
    { tipo: 'checkin', fecha: '2026-11-20', clave: 'c1', aviso: true, detalle: 'energía 2/5' },
    { tipo: 'checkin', fecha: '2026-11-13', clave: 'c0', aviso: true },
    { tipo: 'video', fecha: '2026-11-19', clave: 'v1', aviso: true },
    { tipo: 'saltada', fecha: '2026-11-16', clave: 'x1', titulo: 'No hizo Torso', aviso: true },
    { tipo: 'paron', fecha: '2026-11-18', clave: 'z1' },
    { tipo: 'sesion', fecha: '2026-11-19', clave: 's:a', sesionId: 'a' },
    { tipo: 'record', fecha: '2026-11-19', clave: 'r:a', sesionId: 'a' },
    { tipo: 'mensaje', fecha: '2026-11-19', clave: 'm1', hilo: { sesionId: 'a' } },
    { tipo: 'mensaje', fecha: '2026-11-19', clave: 'm2', hilo: { sesionId: null } },
    { tipo: 'record', fecha: '2026-11-19', clave: 'r:b', sesionId: 'b' },
    { tipo: 'mio', mio: true, fecha: '2026-11-20', clave: 't1', aviso: true },
    { tipo: 'peso', fecha: '2026-11-20', clave: 'p1', kg: 70.2, tendencia: 70.5, cambioSemana: -0.3 },
    { tipo: 'dia', fecha: '2026-11-18', clave: 'd1', detalle: '1.900 kcal y 120 g de proteína' },
    { tipo: 'dia', fecha: '2026-11-17', clave: 'd2', detalle: '3 de 4 hábitos' },
  ];
  const pm = R.paraMirar(ev, hoy);
  check(pm.map((e) => e.clave).join() === 'c1,v1,x1,z1', 'para mirar: lo de estos 7 días que pide atención (no lo de antes ni lo tuyo)');
  check(pm[0].motivo === 'Energía o motivación baja' && pm[1].motivo === 'Sin revisar' && pm[2].motivo === 'Sesión sin hacer' && pm[3].motivo === 'Días sin entrenar', 'cada cosa con su motivo');
  const col = R.colgarDeSesion(ev.filter((e) => e.fecha === '2026-11-19'));
  const s = col.find((e) => e.clave === 's:a');
  check(s.hijos.records.length === 1 && s.hijos.mensajes.length === 1 && !col.some((e) => e.clave === 'r:a' || e.clave === 'm1'), 'el récord y el comentario de una sesión, colgando de ella');
  check(col.some((e) => e.clave === 'm2') && col.some((e) => e.clave === 'r:b') && col.some((e) => e.clave === 'v1'), 'lo que no es de una sesión de la lista sigue suelto');
  check(R.colgarDeSesion([{ tipo: 'record', clave: 'r', sesionId: 'q' }]).length === 1, 'un récord sin su sesión en la lista (con el filtro «Récords»), suelto');
  const d = R.detalleSemana(ev, '2026-11-16', { '2026-11-16': 3 });
  check(d.sesiones === 1 && d.previstas === 3 && d.records === 2 && d.comidas === 1 && d.peso.kg === 70.2 && d.checkin === 'energía 2/5' && d.noHizo.join() === 'Torso', 'la semana desplegada: sesiones de las previstas, récords, comidas, peso, check-in y lo que no hizo');
  const txt = R.textoResumenSemana(d, 'Ana');
  check(/^Ana, semana del 16 nov:/.test(txt) && /Sesiones: 1 de 3 \(sin hacer: Torso\)/.test(txt) && /Peso: 70,2 kg \(tendencia 70,5, −0,3 en la semana\)/.test(txt) && /Check-in: energía 2\/5/.test(txt), 'y su resumen, listo para pegar');
  check(/Check-in: sin enviar/.test(R.textoResumenSemana(R.detalleSemana([], '2026-11-09'))), 'sin check-in, lo dice');
}

console.log('Actividad: el calendario, el ritmo, lo visto y «Lo mío también»');
{
  const ev = [{ tipo: 'sesion', fecha: '2026-11-03' }, { tipo: 'record', fecha: '2026-11-03' }, { tipo: 'peso', fecha: '2026-11-20' }, { tipo: 'mio', mio: true, fecha: '2026-11-05' }, { tipo: 'sesion', fecha: '2026-10-31' }];
  const cal = R.calendarioActividad(ev, '2026-11', '2026-11-21');
  const dias = cal.flat();
  check(cal.length === 6 && cal.every((w) => w.length === 7) && dias[0].fecha === '2026-10-26' && dias[0].fuera, 'el calendario: semanas de lunes a domingo (noviembre de 2026 empieza en domingo)');
  const d3 = dias.find((x) => x.fecha === '2026-11-03');
  check(d3.tipos.includes('sesion') && d3.tipos.includes('record') && !dias.find((x) => x.fecha === '2026-11-05').tipos.length && !dias.find((x) => x.fecha === '2026-10-31').tipos.length, 'cada día con lo que hubo (sin lo tuyo ni lo de otro mes)');
  check(dias.find((x) => x.fecha === '2026-11-22').futuro && !dias.find((x) => x.fecha === '2026-11-21').futuro, 'los días por venir, aparte');
  check(R.calendarioActividad([], '2026-12', '2026-12-01').flat().some((x) => x.fecha === '2026-12-31' && !x.fuera), 'diciembre, hasta el 31');
  const rt = R.ritmoEntrenos([{ fecha: '2026-11-20', duracion_min: 60 }, { fecha: '2026-11-10', duracion_min: 50 }, { fecha: '2026-11-01' }, { fecha: '2026-10-10', duracion_min: 70 }, { fecha: '2026-09-01', duracion_min: 99 }], '2026-11-21');
  check(rt.ahora.n === 3 && rt.ahora.minutos === 55 && rt.antes.n === 1 && rt.antes.minutos === 70, 'su ritmo: entrenos y duración media de estas 4 semanas frente a las 4 anteriores');
  check(R.ritmoEntrenos([], '2026-11-21').ahora.minutos === null, 'sin duración apuntada, sin media');
  const v = R.sumarVistos(['a', 'b'], ['b', 'c', null]);
  check(v.join() === 'a,b,c' && R.sumarVistos(Array.from({ length: 600 }, (_, i) => `k${i}`), ['z']).length === R.MAX_VISTOS, 'lo visto: sin repetir y con tope (lo más antiguo sale)');
  const conMio = [{ tipo: 'mensaje', titulo: 'Te escribió' }, { tipo: 'mio', mio: true, titulo: 'Le escribiste' }];
  check(R.filtrarActividad(conMio, 'mensaje').length === 2, 'el filtro «Mensajes» enseña también lo tuyo (cuando «Lo mío también» está puesto)');
}

console.log('En la demo: cada pesada con su tendencia, lo tuyo y su ritmo');
{
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const ats = await b.select('atletas', {});
  const ana = ats.find((a) => a.nombre === 'Ana López');
  const ses = await api.entrenamientos(ana.id);
  await api.comentar({ atletaId: ana.id, sesionId: ses[0].id, autor: 'coach', texto: '💪 ¡Bien hecho! He visto tu entreno.' });
  await api.enviarMensaje(ana.id, { texto: 'Mañana lo hablamos', autor: 'coach' });
  const ev = await api.actividad(ana.id, 30);
  const pesos = ev.filter((e) => e.tipo === 'peso');
  check(pesos.length >= 1 && pesos.every((e) => Array.isArray(e.semanaKg) && e.semanaKg.length >= 1), `cada pesada, con las de su semana (${pesos.map((e) => e.semanaKg.length).join(', ')})`);
  check(pesos.some((e) => e.tendencia != null && /tendencia/i.test(e.detalle)), `y su tendencia («${pesos[0]?.detalle || ''}»)`);
  const mios = ev.filter((e) => e.mio);
  check(mios.length >= 2 && mios.every((e) => e.tipo === 'mio' && e.clave.startsWith('t:')), `lo tuyo sale aparte (${mios.length}), para «Lo mío también»`);
  check(mios.some((e) => e.titulo === 'Le felicitaste' && e.icono === 'estrella') && mios.some((e) => e.titulo === 'Le escribiste' && e.pestana === 'mensajes'), 'con lo que fue: felicitarle o escribirle en su chat');
  check(ev.find((e) => e.tipo === 'sesion' && e.sesionId === ses[0].id)?.comentada === true, 'y la sesión felicitada se sabe');
  const vids = ev.filter((e) => e.tipo === 'video' || e.tipo === 'foto');
  check(vids.every((e) => e.archivo && e.archivo.id && e.archivo.ruta), `las fotos y los vídeos, con su archivo (para su miniatura) (${vids.length})`);
  const rt = await api.ritmoEntreno(ana.id);
  check(rt && Number.isInteger(rt.ahora.n) && rt.ahora.n >= 1 && Number.isInteger(rt.antes.n), `su ritmo (${rt?.ahora.n} entrenos estas 4 semanas, ${rt?.antes.n} las de antes)`);
}

console.log('Lo que tiene que estar en su sitio');
{
  const css = src('registro-actividad.css');
  check(/^[\x00-\x7F]*$/.test(css) && /v0\.206/.test(css), 'registro-actividad.css, con la v0.206 y solo ASCII');
  check(!/opacity/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'ningún texto entra con opacidad');
  const reg = src('ui/coach/RegistroCoach.jsx');
  check(/<PorEjercicios/.test(reg) && /<ResumenSemana/.test(reg) && /<MiniLinea/.test(reg) && /registro-desvio/.test(reg) && /<ComentarSerie/.test(reg) && /registro-cardio/.test(reg)
    && /rendimientoDia\(/.test(reg) && /<CompararSesiones/.test(reg) && /textoSesion\(/.test(reg) && /filasCsvBloque\(/.test(reg), 'Registro: las 10 mejoras enganchadas');
  const act = src('ui/coach/Actividad.jsx');
  check(/paraMirar\(/.test(act) && /colgarDeSesion\(/.test(act) && /detalleSemana\(/.test(act) && /<CalendarioActividad/.test(act) && /<MiniVideo/.test(act) && /semanaKg/.test(act)
    && /Lo mío también/.test(act) && /Todo visto/.test(act) && /textoResumenSemana\(/.test(act) && /ritmoEntreno/.test(act), 'Actividad: las 10 mejoras enganchadas');
  check(!/[^\x00-\x7F]/.test((act.match(/\/\^[^/]*\//g) || []).join('') + (reg.match(/\/\^[^/]*\//g) || []).join('')), 'sin letras con tilde dentro de una expresión regular (rompen la compilación)');
  check(!/preact\/compat/.test(act + reg), 'sin preact/compat');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
