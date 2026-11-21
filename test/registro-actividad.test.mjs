// (v0.205) Registro y Actividad del atleta, en la ficha del coach: lo puro (la vez anterior, el 1RM del día, toneladas, lo
// saltado, el descanso de verdad, la hora de la sesión, los parones, su día, lo nuevo, los filtros y la cabecera), la
// actividad ampliada en la demo y lo que tiene que estar en su sitio (registro-actividad.css, ASCII y con tokens).
//   node test/registro-actividad.test.mjs
import { readFileSync } from 'node:fs';
import * as R from '../web/src/logica/registro-actividad.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('Registro: la vez anterior y el 1RM del día');
{
  const h = [
    { id: 'a1', ejercicio_id: 'e', sesion_id: 's1', fecha: '2026-11-04', registrada_en: '2026-11-04T18:00:00Z', kg: 60, reps: 5, rpe: 8 },
    { id: 'a2', ejercicio_id: 'e', sesion_id: 's1', fecha: '2026-11-04', registrada_en: '2026-11-04T18:03:00Z', kg: 60, reps: 5, rpe: 8.5 },
    { id: 'b1', ejercicio_id: 'e', sesion_id: 's2', fecha: '2026-11-11', registrada_en: '2026-11-11T18:00:00Z', kg: 62.5, reps: 5, rpe: 8 },
    { id: 'c1', ejercicio_id: 'e', sesion_id: 's3', fecha: '2026-11-18', registrada_en: '2026-11-18T18:00:00Z', kg: 65, reps: 5, rpe: 8 },
    { id: 'x1', ejercicio_id: 'otro', sesion_id: 's2', fecha: '2026-11-11', registrada_en: '2026-11-11T18:10:00Z', kg: 20, reps: 10 },
  ];
  const v = R.vezAnterior(h, 'e', 's3', '2026-11-18');
  check(v && v.sesionId === 's2' && v.series.length === 1 && v.fecha === '2026-11-11', 'la vez anterior: la última sesión de antes con ese ejercicio (sin contar la de hoy)');
  check(R.vezAnterior(h, 'e', 's1', '2026-11-04') === null, 'la primera vez, no hay vez anterior');
  const hoy = h.filter((s) => s.sesion_id === 's3');
  const fr = R.frenteAnterior(hoy, v.series);
  check(fr.dir === 'sube' && fr.tipo === 'kg', 'hoy frente a la vez anterior: sube (65 frente a 62,5 kg)');
  check(R.frenteAnterior([{ kg: 0, reps: 10 }], [{ kg: 0, reps: 12 }]).dir === 'baja' && R.frenteAnterior([{ kg: 60, reps: 5, rpe: 8 }], [{ kg: 60, reps: 5, rpe: 8 }]).dir === 'igual', 'sin carga, por repeticiones; y lo mismo, igual');
  const rm = R.e1rmDelDia(hoy, h, 'e', 's3', '2026-11-18', v.series);
  check(rm && rm.valor > 70 && rm.cambio > 0 && rm.record === true && rm.mejor > 0, 'su 1RM del día, lo que subió frente a la vez anterior y si es su mejor marca');
  check(R.e1rmDelDia([{ kg: 0, reps: 10 }], h, 'e', 's3') === null, 'sin carga, sin 1RM');
}

console.log('Registro: toneladas, lo saltado, el descanso y la hora');
{
  check(R.toneladas([{ kg: 60, reps: 5 }, { kg: 60, reps: 0 }, { kg: 50, reps: 10 }]) === 800, 'toneladas: carga × repeticiones (las de 0 repeticiones no cuentan)');
  check(R.faltan({ series: 4 }, [{ reps: 5 }, { reps: 5 }], true).n === 2 && !R.faltan({ series: 4 }, [{ reps: 5 }], true).saltado, 'faltan 2 de 4');
  check(R.faltan({ series: 3 }, [], true).saltado && R.faltan({ series: 3 }, [], false).n === 0, 'sin ninguna serie en una sesión terminada, saltado; en una en curso, nada');
  const s = ['18:00:00', '18:03:00', '18:06:30', '18:10:00'].map((t, i) => ({ registrada_en: `2026-11-18T${t}Z`, reps: 5, kg: 60, numero: i + 1 }));
  const d = R.descansoFrente({ descanso_seg: 120 }, s);
  check(d && d.real === 180 && d.pautado === 120 && d.dif === 60, `el descanso de verdad (la mediana menos lo que dura la serie): ${d && R.mmss(d.real)} frente a 2:00`);
  const hr = R.horarioSesion(s);
  check(hr && hr.inicio === '19:00' && hr.fin === '19:10' && hr.minutos === 10, 'la hora de la sesión, en hora de Madrid, y lo que duró');
  check(R.horarioSesion([s[0]]) === null, 'con una sola serie, no hay horario');
  check(JSON.stringify(R.notasDeSeries([{ numero: 1, nota: '' }, { numero: 2, nota: ' me dolió el hombro ' }])) === '[{"numero":2,"nota":"me dolió el hombro"}]', 'las notas de cada serie');
}

console.log('Actividad: lo que no hizo, su día y la hora');
{
  const p = R.paronesDe(['2026-11-01', '2026-11-03', '2026-11-09', '2026-11-12'], '2026-11-21');
  check(p.length === 2 && p[0].dias === 5 && p[0].desde === '2026-11-04' && p[0].hasta === '2026-11-08' && p[1].sigue && p[1].dias === 9, 'los días seguidos sin entrenar (4 o más), también hasta hoy');
  check(R.textoParon(p[1]) === '9 días sin entrenar (hasta hoy)' && /^del /.test(R.detalleParon(p[0])), 'y en una frase');
  const dias = R.diasDeAtleta({
    habitos: [{ id: 'h1', tipo: 'si_no', objetivo: 1 }, { id: 'h2', tipo: 'cantidad', objetivo: 8000 }],
    registrosHabito: [{ habito_id: 'h1', fecha: '2026-11-20', valor: 1 }, { habito_id: 'h2', fecha: '2026-11-20', valor: 5000 }],
    nutricion: [{ fecha: '2026-11-20', kcal: 1850, proteina_g: 140 }],
    fotos: [{ fecha: '2026-11-20' }, { fecha: '2026-11-20' }],
    tomas: [{ fecha: '2026-11-20', hecho: true }],
    salud: [{ fecha: '2026-11-20', pasos: 8200, sueno_min: 430 }],
  }, '2026-11-01');
  const t = R.textoDia(dias['2026-11-20']);
  check(dias['2026-11-20'].habitos.total === 2 && /1.850 kcal y 140 g de proteína/.test(t) && /2 fotos de plato/.test(t) && /1 suplemento/.test(t) && /8.200 pasos/.test(t) && /7 h 10 de sueño/.test(t), `su día en una línea («${t}»)`);
  check(R.horaDe('2026-11-18T17:04:00Z') === '18:04' && R.horaDe('2026-11-18T20:00') === null && R.horaDe(null) === null, 'la hora de verdad (en Madrid); una hora puesta a mano, no');
}

console.log('Actividad: lo nuevo, los filtros y la cabecera');
{
  const ev = [
    { tipo: 'sesion', fecha: '2026-11-20', cuando: '2026-11-20T17:00:00Z', clave: 's:1', titulo: 'Hizo Torso A', ejercicios: ['Press banca', 'Remo'] },
    { tipo: 'record', fecha: '2026-11-20', cuando: '2026-11-20T16:59:59Z', clave: 'r:1', titulo: 'Récord en Press banca', ejercicios: ['Press banca'] },
    { tipo: 'checkin', fecha: '2026-11-16', cuando: '2026-11-16T09:00:00Z', clave: 'c:1', titulo: 'Envió su check-in' },
    { tipo: 'video', fecha: '2026-11-15', cuando: '2026-11-15T19:00:00Z', clave: 'a:1', titulo: 'Envió un vídeo' },
    { tipo: 'paron', fecha: '2026-11-12', cuando: '2026-11-12T12:00', clave: 'z:1', titulo: '4 días sin entrenar' },
    { tipo: 'sesion', fecha: '2026-11-08', cuando: '2026-11-08T17:00:00Z', clave: 's:2', titulo: 'Hizo Pierna A', ejercicios: ['Sentadilla'] },
  ];
  const n = R.nuevosDesde(ev, Date.parse('2026-11-16T12:00:00Z'));
  check(n.has('s:1') && n.has('r:1') && !n.has('c:1') && n.size === 2, 'lo nuevo desde tu última visita (lo de después)');
  check(R.nuevosDesde(ev, null).size === 0, 'la primera vez, nada es «nuevo»');
  check(R.filtrarActividad(ev, 'media').length === 1 && R.filtrarActividad(ev, 'nohecho').length === 1 && R.filtrarActividad(ev, 'record').length === 1, 'los filtros nuevos: vídeos y fotos, lo que no hizo');
  check(R.filtrarActividad(ev, 'todo', 'press').map((e) => e.clave).join() === 's:1,r:1' && R.filtrarActividad(ev, 'sesion', 'sentadilla').length === 1, 'buscar por ejercicio');
  const c = R.cabeceraActividad(ev, '2026-11-21');
  check(c.ultimo.dias === 1 && c.estaSemana === 1 && c.checkin.dias === 5 && c.mapa.length === 30 && c.mapa[29].hoy && c.entrenos30 === 2 && c.mapa.find((d) => d.fecha === '2026-11-20').record, 'la cabecera: último entreno, esta semana, último check-in y los 30 días (con récords)');
  check(R.FRASES_KUDOS.length >= 3 && /Récord en Remo/.test(R.textoKudosRecord('Remo')) && /check-in/.test(R.TEXTO_KUDOS_CHECKIN), 'más formas de felicitar');
}

console.log('Actividad ampliada, en la demo');
{
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const ats = await b.select('atletas', {});
  const ana = ats.find((a) => a.nombre === 'Ana López');
  const ev = await api.actividad(ana.id, 30);
  const tipos = new Set(ev.map((e) => e.tipo));
  check(tipos.has('dia') && ev.find((e) => e.tipo === 'dia').detalle.length > 5, 'su día (hábitos, comidas, Salud…) sale en la actividad');
  check(ev.filter((e) => e.tipo === 'sesion').every((e) => e.clave && e.foco?.sesionId && e.foco?.bloqueId && Array.isArray(e.ejercicios)), 'cada sesión lleva su clave, a qué lleva (sesión y bloque) y sus ejercicios');
  check(ev.some((e) => e.tipo === 'sesion' && /^\d\d:\d\d$/.test(e.hora || '')), 'y su hora de verdad');
  check(ev.filter((e) => e.tipo === 'mensaje').every((e) => e.comentarioId && e.hilo && typeof e.texto === 'string'), 'cada mensaje, con su hilo (para contestarle ahí mismo)');
  check(ev.filter((e) => e.tipo === 'checkin').every((e) => e.foco?.checkinId), 'cada check-in lleva a ese check-in');
  const ivan = ats.find((a) => a.nombre.startsWith('Iván'));
  const evI = ivan ? await api.actividad(ivan.id, 30) : [];
  check(!ivan || evI.some((e) => e.tipo === 'paron' && /días sin entrenar/.test(e.titulo)), 'los días seguidos sin entrenar salen (Iván)');
  const ses = await api.entrenamientos(ana.id);
  check(ses.every((x) => !x.bloque || x.bloque.id), 'los entrenamientos dicen su bloque (para ir a él)');
  const ids = ses.slice(0, 3).map((x) => x.id);
  check((await api.sesionesConTuyo(ana.id, ids)) instanceof Set, 'las sesiones a las que ya le has escrito');
  check(hoyISO().length === 10, '(fecha de hoy)');
}

console.log('Lo que tiene que estar en su sitio');
{
  const css = src('registro-actividad.css');
  check(/^[\x00-\x7F]*$/.test(css), 'registro-actividad.css, solo ASCII');
  check(!/opacity/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'ningún texto entra con opacidad');
  check(src('main.jsx').indexOf("'./registro-actividad.css'") > src('main.jsx').indexOf("'./progreso-visual-2.css'"), 'se carga después de la tanda de progreso');
  const reg = src('ui/coach/RegistroCoach.jsx');
  check(/id="reg-bloque"/.test(reg) && /Qué semana ver/.test(reg) && /vezAnterior\(/.test(reg) && /e1rmDelDia\(/.test(reg) && /serie-hueco/.test(reg) && /registro-notas/.test(reg) && /<MiniVideo/.test(reg)
    && /descansoFrente\(/.test(reg) && /horarioSesion\(/.test(reg) && /ajustarProxima/.test(reg) && /HistorialEjercicio/.test(reg) && /api\.felicitar/.test(reg) && /Sin revisar/.test(reg), 'Registro: las 10 mejoras enganchadas');
  const act = src('ui/coach/Actividad.jsx');
  check(/cabeceraActividad/.test(act) && /FILTROS_ACTIVIDAD/.test(act) && /Buscar por ejercicio/.test(act) && /Hasta aquí lo viste/.test(act) && /actividad-hora/.test(act) && /irA\(e\.pestana, e\.foco/.test(act)
    && /<SeriesDeSesion/.test(act) && /<Respuesta/.test(act) && /FRASES_KUDOS/.test(act) && /TEXTO_KUDOS_CHECKIN/.test(act), 'Actividad: las 10 mejoras enganchadas');
  const fi = src('ui/coach/Ficha.jsx');
  check(/irA=\{irDesdeActividad\}/.test(fi) && /checkinInicial=/.test(fi) && /abrirInicial=/.test(fi) && !/function ListaRegistro/.test(fi), 'la ficha: Registro en su archivo y el foco desde Actividad');
  check(!/[^\x00-\x7F]/.test((act.match(/\/\^[^/]*\//g) || []).join('') + (reg.match(/\/\^[^/]*\//g) || []).join('')), 'sin letras con tilde dentro de una expresión regular (rompen la compilación)');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
