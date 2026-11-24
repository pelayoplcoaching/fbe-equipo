// v0.228: carrera, tanda 2 de la revisión del experto: la ficha de salud para correr (R44), la mañana siguiente (R45), la
// vuelta a correr según la lesión (R20) y el dolor de hueso (R22). Solo la lógica; la base, en carrera-089.test.mjs.
import * as C from '../web/src/logica/carrera.js';
import { mananaPendiente, limpiarManana, esHueso, textoManana, respuestaManana, avisosMananas } from '../web/src/logica/carrera-salud.js';
import { avisosCarrera, ajusteSiguiente } from '../web/src/logica/carrera-avisos.js';
import { proponerPlan, rehacerDesde, vueltaACorrer, AVISO_HUESO, TIPOS_VUELTA } from '../web/src/logica/carrera-plan.js';
import { revisionAuto } from '../web/src/logica/carrera-seguimiento.js';
import { sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const HOY = '2026-11-25'; // miércoles
const L = '2026-11-23';
const run = (f, km, extra = {}, tipo = 'facil') => ({ id: `s-${f}-${tipo}`, fecha_realizada: f, completada: true, cardio: { modalidad: 'carrera', tipo }, cardio_hecho: { modalidad: 'carrera', minutos: Math.round(km * 6), km, ...extra } });

console.log('La ficha de salud para correr (R44)');
const s0 = C.saludCarrera(null);
check(!s0.riesgo && !s0.bloqueado && !s0.farmaco && s0.pulsoValido && !s0.prudente, 'sin ficha, nada cambia');
check(C.saludCarrera({ salud_riesgo: true }).bloqueado && !C.saludCarrera({ salud_riesgo: true, salud_visto_bueno: '2026-11-10' }).bloqueado,
  'con enfermedad o síntomas, bloqueado (sin test, sin Z5 ni carreras) hasta el visto bueno médico');
const conF = { lthr: 170, fc_max: 185, fc_reposo: 55, umbral: [300, 310], test_fecha: '2026-10-01', test_tipo: 'friel30', farmaco_pulso: true, farmaco_cambio: '2026-11-01' };
const ze = C.zonasDe(conF);
check(ze.every((z) => z.sinFC && z.esfuerzo && z.ritmo === null) && C.textoZona(1, 2, ze) === 'Z1–Z2 (esfuerzo 2-4)' && C.textoZona(5, null, ze) === 'Z5 (esfuerzo 8-9)',
  `con un fármaco que cambia el pulso y el test de antes del cambio de dosis: zonas por esfuerzo, sin pulso ni ritmo (${C.textoZona(1, 2, ze)})`);
const zt = C.zonasDe({ ...conF, farmaco_cambio: '2026-09-01' });
check(!zt[1].sinFC && zt[1].min === 145 && zt[1].ritmo, 'con el test hecho ya con ese fármaco y dosis: sus zonas de pulso y de ritmo valen');
const zr = C.zonasDe({ fc_max: 170, fc_reposo: 60, farmaco_pulso: true });
check(zr.every((z) => z.sinFC && z.esfuerzo), 'con el fármaco, nunca las zonas por la FC máxima (R2 desactivada): por esfuerzo');
check(!C.zonasDe({ lthr: 181 })[0].esfuerzo && C.zonasDe({}) === null, 'sin fármaco, como siempre');
check(C.textoEsfuerzo([7, 7]) === '7' && C.textoEsfuerzo([2, 3]) === '2-3', 'el esfuerzo, como «7» o «2-3»');

console.log('\nLa mañana siguiente (R45)');
const ayer = sumarDias(HOY, -1);
check(mananaPendiente({ hechas: [run(ayer, 12, {}, 'larga')], mananas: [], hoy: HOY })?.cardio.tipo === 'larga', 'tras la tirada larga de ayer, se pregunta esta mañana');
check(mananaPendiente({ hechas: [run(ayer, 6, { dolor: 3 })], hoy: HOY }) && !mananaPendiente({ hechas: [run(ayer, 6, { dolor: 2 })], hoy: HOY }),
  'tras un rodaje con dolor de 3/10 o más, sí; con 2/10, no');
check(!mananaPendiente({ hechas: [run(ayer, 12, {}, 'larga')], mananas: [{ fecha: HOY, dolor: 0, como: 'igual' }], hoy: HOY })
  && !mananaPendiente({ hechas: [run(sumarDias(HOY, -2), 12, {}, 'larga')], hoy: HOY }), 'si ya contestó hoy, o la salida no fue ayer, no');
const lm = limpiarManana({ fecha: HOY, sesion_id: 'x', dolor: 4, como: 'peor', donde: 'tibia', hueso: true, salto: false });
check(!lm.error && lm.manana.hueso === true && lm.manana.salto === false && lm.manana.donde === 'tibia', 'lo que se guarda: dolor, cómo, dónde y, en la pierna, hueso y salto');
const le = limpiarManana({ fecha: HOY, dolor: 2, como: 'igual', donde: 'espalda', hueso: true });
check(le.manana.hueso === null && le.manana.salto === null && limpiarManana({ fecha: HOY, dolor: 0, como: 'igual', donde: 'tibia' }).manana.donde === null,
  'fuera de la pierna no se pregunta por el hueso; sin dolor, sin sitio');
check(limpiarManana({ fecha: HOY, dolor: 11, como: 'igual' }).error && limpiarManana({ fecha: HOY, dolor: 2, como: 'regular' }).error && limpiarManana({ dolor: 2, como: 'igual' }).error,
  'el dolor de 0 a 10, mejor/igual/peor y el día, obligatorios');
check(esHueso({ hueso: true }) && esHueso({ salto: true }) && esHueso({ donde: 'cadera' }) && !esHueso({ donde: 'rodilla' }), 'puede ser el hueso: un punto del hueso, al saltar o en la cadera o la ingle');
check(textoManana(lm.manana) === 'Peor que antes de salir · 4/10 (espinilla) · en un punto del hueso', `para enseñarla: «${textoManana(lm.manana)}»`);
check(respuestaManana(lm.manana).nivel === 'rojo' && respuestaManana({ dolor: 6, como: 'igual' }).nivel === 'rojo' && respuestaManana({ dolor: 2, como: 'peor' }, { como: 'peor' }).nivel === 'rojo'
  && respuestaManana({ dolor: 4, como: 'igual' }).nivel === 'ambar' && respuestaManana({ dolor: 1, como: 'mejor' }).nivel === 'verde',
  'lo que se le dice: hueso desde 3, 6 o más o dos mañanas peor, rojo; 3-5 o peor, ámbar; si no, verde');

console.log('\nLos avisos y el ajuste con las mañanas (R45, R22)');
const mh = [{ fecha: sumarDias(HOY, -1), dolor: 3, como: 'igual', donde: 'tibia', hueso: true, salto: false }];
const av = avisosMananas(mh, HOY);
check(av[0]?.id === 'manana-hueso' && av[0].nivel === 'rojo' && av[0].propuesta.tipo === 'parar', 'dolor de hueso de 3/10 a la mañana siguiente: rojo, parar y valorar');
check(avisosMananas([{ ...mh[0], dolor: 1 }], HOY)[0]?.nivel === 'ambar', 'con 1-2/10 en el hueso: vigilar (ámbar)');
const dos = [{ fecha: sumarDias(HOY, -1), dolor: 2, como: 'peor' }, { fecha: sumarDias(HOY, -3), dolor: 2, como: 'peor' }];
check(avisosMananas(dos, HOY)[0]?.nivel === 'rojo' && avisosMananas(dos.slice(0, 1), HOY)[0]?.nivel === 'ambar', 'dos mañanas seguidas peor: rojo; una, ámbar (sin subir)');
check(avisosMananas([{ fecha: sumarDias(HOY, -2), dolor: 7, como: 'igual' }], HOY)[0]?.id === 'manana-alto' && !avisosMananas([{ fecha: sumarDias(HOY, -9), dolor: 7, como: 'igual' }], HOY).length,
  '6/10 o más al levantarse: rojo; lo de hace más de una semana ya no avisa');
const normal = [];
for (let w = 1; w <= 3; w++) for (const d of [1, 3, 6]) normal.push(run(sumarDias(L, -7 * w + d), 6, { dolor: 1, semaforo: 'verde' }, d === 6 ? 'larga' : d === 3 ? 'calidad' : 'facil'));
const plan = [1, 2, 3].map((w) => ({ lunes: sumarDias(L, -7 * w), km_min: 17, km_max: 19, sesiones: [] })).concat([{ lunes: L, km_min: 18, km_max: 20, sesiones: [{ tipo: 'facil', km: 8 }, { tipo: 'larga', km: 10 }] }]);
const avC = avisosCarrera({ semanas: plan, hechas: normal, hoy: HOY, mananas: mh });
check(avC[0]?.id === 'manana-hueso' && avisosCarrera({ semanas: plan, hechas: normal, hoy: HOY }).length === 0, 'en los avisos del coach, la mañana va primero');
const ajNormal = ajusteSiguiente({ semanas: plan, hechas: normal, hoy: HOY });
const mPeor = [{ fecha: sumarDias(L, -4), dolor: 2, como: 'peor' }];
const ajPeor = ajusteSiguiente({ semanas: plan, hechas: normal, hoy: HOY, mananas: mPeor });
const ajHueso = ajusteSiguiente({ semanas: plan, hechas: normal, hoy: HOY, mananas: [{ fecha: sumarDias(L, -4), dolor: 4, como: 'igual', donde: 'pie', hueso: true }] });
check(ajNormal.decision === 'seguir' && ajPeor.decision === 'repetir' && /peor que antes de salir/.test(ajPeor.motivo) && ajHueso.decision === 'bajar' && /hueso/.test(ajHueso.motivo),
  `el ajuste: una mañana peor, sin subir («${ajPeor.motivo}»); dolor de hueso, bajar («${ajHueso.motivo}»)`);
const conDolor = normal.map((x) => (x.fecha_realizada >= sumarDias(L, -14) ? { ...x, cardio_hecho: { ...x.cardio_hecho, dolor: 4 } } : x));
const ajD = ajusteSiguiente({ semanas: plan, hechas: conDolor, hoy: HOY });
check(ajD.decision === 'repetir' && /4\/10/.test(ajD.motivo), `(escala del dolor) con 3-5/10 se acepta, pero sin subir («${ajD.motivo}»)`);

console.log('\nEl plan sin Z5 y la vuelta según la lesión (R44, R20)');
const ev5 = { nombre: '5K', distancia_km: 5, fecha: sumarDias(HOY, 7 * 12 + 6) };
const conZ5 = proponerPlan({ evento: ev5, dias: 4, kmAhora: 25, largaAhora: 8, nivel: 'intermedio', hoy: HOY });
const sinZ5 = proponerPlan({ evento: ev5, dias: 4, kmAhora: 25, largaAhora: 8, nivel: 'intermedio', hoy: HOY, sinZ5: true });
const zonaMax = (s) => Math.max(Number(s?.zona_hasta || s?.zona) || 0, ...(s?.partes || []).map((p) => Number(p.zona_hasta || p.zona) || 0));
const max = (pl) => Math.max(...pl.semanas.flatMap((w) => w.sesiones).filter((x) => x.tipo !== 'carrera').map(zonaMax));
check(max(conZ5) === 5 && max(sinZ5) <= 4 && sinZ5.semanas.length === conZ5.semanas.length && /visto bueno médico/.test(sinZ5.avisos[0]),
  `un 5K sin el visto bueno médico: las mismas semanas, sin nada en Z5 (con él, hasta Z${max(conZ5)}; sin él, hasta Z${max(sinZ5)}), y el aviso`);
const vh = vueltaACorrer({ dias: 5, desde: L, tipo: 'hueso' });
check(vh.every((w) => w.sesiones.length <= 3) && vh.flatMap((w) => w.sesiones).slice(1).every((x) => /0\/10/.test(x.nota) || /Sin dolor/.test(x.nota)) && /Sin dolor/.test(vh[0].clave),
  `la vuelta tras un hueso de bajo riesgo: en días alternos (como mucho 3 a la semana, ${vh.length} semanas) y sin ningún dolor`);
check(/5 días seguidos sin dolor/.test(vh[0].sesiones[0].nota) && vueltaACorrer({ dias: 5, desde: L }).some((w) => w.sesiones.length > 3), 'empieza tras 5 días sin dolor y con visto bueno; la de tendón, como antes');
const evM = { nombre: 'Media', distancia_km: 21.1, fecha: sumarDias(HOY, 7 * 16 + 6) };
const rh = rehacerDesde({}, { evento: evM, dias: 3, kmAhora: 20, nivel: 'intermedio', hoy: HOY, desde: HOY, conVuelta: 'hueso' });
const rt = rehacerDesde({}, { evento: evM, dias: 3, kmAhora: 20, nivel: 'intermedio', hoy: HOY, desde: HOY, conVuelta: true });
check(rh.plan.semanas[0].etiqueta === 'Vuelta a correr' && /sin ningún dolor/.test(rh.fases[0].nota) && /3\/10/.test(rt.fases[0].nota), 'rehacer con la vuelta: la de hueso, sin ningún dolor; la de siempre (true), la de tendón');
check(/la pauta su médico/.test(rehacerDesde({}, { evento: evM, dias: 3, kmAhora: 20, hoy: HOY, desde: HOY, conVuelta: 'hueso-alto' }).plan.error), 'hueso de alto riesgo: la app no propone la vuelta, la pauta su médico');
check(TIPOS_VUELTA.length === 3 && /vitamina D/.test(AVISO_HUESO) && /menstruación/.test(AVISO_HUESO), 'los tres tipos, y el recordatorio tras una fractura por estrés (energía, menstruación, vitamina D, hueso)');

console.log('\nLa revisión con un fármaco que cambia el pulso (R44: R29 desactivada)');
const r = (f, km, min, fc) => ({ fecha_realizada: f, completada: true, cardio: { modalidad: 'carrera', tipo: 'facil' }, cardio_hecho: { modalidad: 'carrera', minutos: min, km, fc_media: fc, semaforo: 'verde' } });
const antes = [-40, -36, -33, -30, -26, -22].map((d) => r(sumarDias(L, d), 8, 52, 152));
const ahora = [-13, -11, -8, -6].map((d) => r(sumarDias(L, d), 8, 48, 150));
const pl2 = [sumarDias(L, -14), sumarDias(L, -7)].map((lunes) => ({ lunes, km_min: 15, km_max: 17 }));
check(revisionAuto({ semanas: pl2, hechas: [...antes, ...ahora], hoy: HOY }).partes.some((p) => p.k === 'eficiencia')
  && !revisionAuto({ semanas: pl2, hechas: [...antes, ...ahora], hoy: HOY, perfil: { farmaco_pulso: true } }).partes.some((p) => p.k === 'eficiencia'),
  'con el fármaco, la revisión no mira la eficiencia (el pulso no sirve)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
