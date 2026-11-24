// v0.221: carrera, tanda 2. El asistente de plan (proponerPlan), las descargas y el afinado, «Rehacer desde aquí» con la
// vuelta a correr y copiar una semana con progresión (logica/carrera-plan.js), con las reglas aprobadas por Pelayo.
// v0.227: con la revisión del experto (R9, R11-R13, R15-R19, R42, R43): tope por salida, tirada larga y pico según los días,
// sin saltar a un mínimo («Empezar a correr»), las semanas que hacen falta y si llega, y el afinado sin contar la carrera.
import { proponerPlan, planValido, fasesPara, picoKm, tramoDistancia, kmRecientes, rehacerDesde, vueltaACorrer, semanasNecesarias,
  progresarSemana, huecosSemana, textoSemanaPlan, escalarSesion, PASOS_VUELTA, PASOS_EMPEZAR, SEMANAS_MIN, MAX_SEMANAS_PLAN, LARGA_PCT_MAX } from '../web/src/logica/carrera-plan.js';
import { sumarDias, lunesDe, desdeISO } from '../web/src/logica/fechas.js';
import { sesionDesdePlan } from '../web/src/logica/carrera.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Un lunes fijo para que no dependa del día en que se pase
const HOY = '2026-11-23'; // lunes
const diaSem = (iso) => ((desdeISO(iso).getDay() + 6) % 7) + 1;

console.log('Tramos, fases y pico');
check(tramoDistancia(5) === '5k' && tramoDistancia(10) === '10k' && tramoDistancia(21.0975) === 'media' && tramoDistancia(42.195) === 'maraton', 'los tramos: 5 km, 10 km, media y maratón');
const f16 = fasesPara(16, 21.0975);
check(f16.map((f) => `${f.nombre} ${f.semanas}`).join(', ') === 'Base 6, Construcción 5, Específico 3, Afinado 2', `media en 16 semanas: base ~40 %, construcción ~30 %, específico ~20 % y 2 de afinado (${f16.map((f) => `${f.nombre} ${f.semanas}`).join(', ')})`);
check(fasesPara(18, 42.195).at(-1).semanas === 3 && fasesPara(8, 10).at(-1).semanas === 1 && fasesPara(6, 5).at(-1).semanas === 1, 'el afinado: 3 semanas en maratón, 1 en 10 y 5 km');
check(fasesPara(2, 10).map((f) => f.nombre).join(',') === 'Específico,Afinado' && fasesPara(1, 10).map((f) => f.nombre).join(',') === 'Afinado', 'con muy pocas semanas, sin base');
check(picoKm(21.0975, 'empieza') === 40 && picoKm(21.0975, 'intermedio') === 50 && picoKm(21.0975, 'avanzado') === 60 && picoKm(5, 'intermedio', 45) === 45, 'el pico: 40, 50 o 60 km en la media según el nivel; si ya hace más, se queda en lo que hace');
check(picoKm(42.195, 'avanzado', 0, { dias: 3 }) === 60 && picoKm(21.0975, 'intermedio', 0, { dias: 3 }) === 45 && picoKm(10, 'avanzado', 0, { dias: 2 }) === 24 && picoKm(42.195, 'avanzado', 70, { dias: 3 }) === 70,
  '(R13) como mucho 20 km por día en maratón, 15 en la media y 12 en 5 y 10 km (si ya corre más, lo que corre)');
check(picoKm(42.195, 'avanzado', 0, { prudente: true }) === 50 && picoKm(21.0975, 'intermedio', 0, { pierna: true }) === 40, '(R13) con «más de 60 o lesión» o con pierna pesada 3 días o más, el valor bajo');

console.log('Los km de cada semana (de lo que sale de verdad cada semana)');
const mid = (w) => ((Number(w.km_min) || 0) + (Number(w.km_max) || 0)) / 2;
const evM = { nombre: 'Media', distancia_km: 21.0975, fecha: sumarDias(HOY, 7 * 15 + 6) };
const pk = proponerPlan({ evento: evM, dias: 4, kmAhora: 20, largaAhora: 10, nivel: 'intermedio', hoy: HOY });
const kms = pk.semanas.map(mid);
let subidasOk = true, treintaOk = true;
pk.semanas.forEach((w, i) => {
  if (!i || w.etiqueta) return;
  const normal = [...pk.semanas.slice(0, i)].reverse().find((x) => !x.etiqueta);
  if (normal && mid(w) > mid(normal) * 1.075 * 1.06 + 1) subidasOk = false;
  const media = (kms[i - 1] + (kms[i - 2] ?? kms[i - 1])) / 2;
  if (kms[i] > media * 1.3 * 1.06 + 1) treintaOk = false;
});
check(Math.abs(kms[0] - 20) <= 2 && subidasOk, `(R11) empieza en lo que hace (20 km), sin saltar a un mínimo, y sube como mucho un 7,5 % por semana (${kms.map((k) => Math.round(k)).join(', ')})`);
check(treintaOk, 'nunca más de un 30 % sobre la media de las dos semanas anteriores');
check(pk.semanas[3].etiqueta === 'Descarga' && pk.semanas[7].etiqueta === 'Descarga' && kms[3] < kms[2] && pk.semanas.filter((s) => s.etiqueta === 'Descarga').length === 3, 'una de cada cuatro, más suave');
const maxKm = Math.max(...kms);
check(pk.semanas.at(-2).etiqueta === 'Afinado' && kms.at(-2) <= maxKm * 0.75 && kms.at(-2) >= maxKm * 0.6 && kms.at(-1) <= maxKm * 0.55 && kms.at(-1) >= maxKm * 0.4,
  `(R18) el afinado de la media: un 30 % y un 50 % menos, sin contar la carrera (${Math.round(kms.at(-2))} y ${Math.round(kms.at(-1))} km de ${Math.round(maxKm)})`);
check(maxKm <= 50 * 1.06, 'sin pasar del pico (50 km en una media, intermedio, con 4 días)');

console.log('El plan entero: una media en 16 semanas, 4 días');
const ev = { nombre: 'Media de primavera', distancia_km: 21.0975, fecha: sumarDias(HOY, 7 * 15 + 6) }; // domingo de la semana 16
const p = proponerPlan({ evento: ev, dias: 4, kmAhora: 22, largaAhora: 12, nivel: 'intermedio', hoy: HOY });
check(!p.error && p.inicio === HOY && p.total === 16 && p.semanas.length === 16 && planValido(p), `16 semanas desde este lunes (${p.inicio}), todas válidas para guardar`);
check(p.semanas.every((s, i) => s.lunes === sumarDias(HOY, 7 * i)), 'una por lunes, seguidas');
const ult = p.semanas.at(-1);
const carrera = ult.sesiones.find((s) => s.tipo === 'carrera');
check(ult.etiqueta === 'Carrera' && carrera && carrera.dia === 7 && carrera.km === 21.1 && carrera.titulo === 'Media de primavera', 'la última semana, la de la carrera: la carrera el domingo, con su nombre y sus 21,1 km');
check(ult.sesiones.filter((s) => s.tipo !== 'carrera').every((s) => s.dia <= 5) && ult.sesiones.some((s) => s.titulo === 'Rodaje con rectas'), 'esa semana, rodajes suaves y el último con rectas, dos días antes como pronto');
const normales = p.semanas.filter((s) => !s.etiqueta);
check(normales.every((s) => s.sesiones.length === 4 && s.sesiones.filter((x) => x.tipo === 'calidad').length === (s.fase === 'Base' ? s.sesiones.filter((x) => x.dia === 2 && x.tipo === 'calidad').length : 1)
  && s.sesiones.filter((x) => x.tipo === 'larga').length === 1 && s.sesiones.filter((x) => x.tipo === 'facil').length >= 2),
  'con 4 días: dos rodajes, una de calidad (en la base, rectas o cuestas) y la tirada larga');
check(p.semanas.every((s) => s.sesiones.filter((x) => x.tipo === 'larga').every((x) => x.km <= 22 && x.km <= Math.max(3, s.km_max * LARGA_PCT_MAX[4] + 1)
  && s.sesiones.filter((y) => y.tipo === 'facil' && y.km).every((y) => y.km <= x.km))), '(R16) la tirada larga, la más larga de la semana: como mucho el 55 % con 4 días (y 22 km en la media)');
const calidadDe = (fase) => [...new Set(p.semanas.filter((s) => s.fase === fase && !s.etiqueta).flatMap((s) => s.sesiones.filter((x) => x.tipo === 'calidad').map((x) => x.titulo)))];
check(calidadDe('Base').every((t) => ['Rodaje con rectas', 'Cuestas cortas 8 × 15 s'].includes(t)), `en la base, rectas y cuestas cortas (${calidadDe('Base').join(', ')})`);
check(calidadDe('Construcción').every((t) => /Umbral|Cruceros|Tempo/.test(t)), `en la construcción, el umbral (${calidadDe('Construcción').join(', ')})`);
check(calidadDe('Específico').every((t) => /Ritmo de media|Cruceros|Umbral/.test(t)), `en el específico de una media, su ritmo (${calidadDe('Específico').join(', ')})`);
check(p.semanas.filter((s) => s.etiqueta === 'Afinado').every((s) => s.sesiones.some((x) => x.titulo === 'Ritmo de carrera, corto')), 'en el afinado, poca calidad y a ritmo de carrera');
check(p.semanas.filter((s) => s.etiqueta === 'Descarga').length === 3 && p.semanas.filter((s) => s.etiqueta === 'Descarga').every((s) => /más suave/.test(s.clave)), 'las semanas de descarga, con su frase para el atleta (por qué es más suave)');
check(p.semanas.every((s) => s.sesiones.every((x) => sesionDesdePlan(x) || x.tipo === 'descanso')), 'cada sesión del plan pasa tal cual a la semana de entreno');
check(textoSemanaPlan(p.semanas[0]).startsWith(`${p.semanas[0].km_min}-${p.semanas[0].km_max} km · `), `para enseñar: «${textoSemanaPlan(p.semanas[0])}»`);

console.log('Los días');
const p2 = proponerPlan({ evento: { ...ev, distancia_km: 10 }, dias: 2, kmAhora: 15, nivel: 'empieza', hoy: HOY });
const n2 = p2.semanas.filter((s) => !s.etiqueta);
check(n2.every((s) => s.sesiones.length === 2) && n2.some((s) => s.sesiones.some((x) => x.tipo === 'calidad')) && n2.some((s) => s.sesiones.some((x) => x.tipo === 'larga'))
  && n2.every((s) => !(s.sesiones.some((x) => x.tipo === 'calidad') && s.sesiones.some((x) => x.tipo === 'larga'))), 'con 2 días: un rodaje y la calidad o la tirada larga, alternando');
const p5 = proponerPlan({ evento: { ...ev, distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 17 + 6) }, dias: 5, kmAhora: 45, nivel: 'avanzado', hoy: HOY });
check(p5.semanas.filter((s) => !s.etiqueta && s.fase !== 'Base').every((s) => s.sesiones.filter((x) => x.tipo === 'calidad').length === 2), 'con 5 días y avanzado, dos de calidad');
check(p5.semanas.every((s) => s.sesiones.filter((x) => x.tipo === 'larga').every((x) => x.km <= 32)) && p5.semanas.some((s) => s.sesiones.some((x) => x.tipo === 'larga' && /ritmo de maratón/.test(x.nota || ''))), 'en maratón, la tirada larga hasta 32 km y, en el específico, alguna con el final a ritmo');
check(huecosSemana(3, 'intermedio', 1).map((h) => `${h.tipo}${h.dia}`).join(' ') === 'calidad2 facil4 larga7', 'con 3 días: calidad el martes, rodaje el jueves y tirada larga el domingo');

console.log('Pocas semanas, o la carrera muy lejos');
const pc = proponerPlan({ evento: { nombre: '10K', distancia_km: 10, fecha: sumarDias(HOY, 7 * 4 + 6) }, dias: 3, kmAhora: 20, hoy: HOY });
check(pc.total === 5 && pc.avisos.some((a) => a.includes(`harían falta ${SEMANAS_MIN['10k']}`)) && planValido(pc), `un 10 km en 5 semanas: avisa y lo comprime («${pc.avisos[0]}»)`);
const pl = proponerPlan({ evento: { nombre: 'Maratón', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 40) }, dias: 4, kmAhora: 30, hoy: HOY });
check(pl.total === MAX_SEMANAS_PLAN && pl.inicio === sumarDias(lunesDe(sumarDias(HOY, 7 * 40)), -7 * (MAX_SEMANAS_PLAN - 1)) && pl.avisos.some((a) => /está lejos/.test(a)), `la carrera muy lejos: el plan, de ${MAX_SEMANAS_PLAN} semanas, empieza más tarde`);
check(proponerPlan({ evento: { distancia_km: 10, fecha: HOY }, hoy: HOY }).error && proponerPlan({ hoy: HOY }).error, 'sin carrera, o con la carrera hoy, no propone nada (y lo dice)');
check(proponerPlan({ evento: ev, dias: 3, hoy: '2026-11-26' }).inicio === '2026-11-30', 'si hoy es jueves, empieza el lunes que viene');

console.log('Si corre poco ahora');
const poco = proponerPlan({ evento: ev, dias: 3, kmAhora: 2, nivel: 'intermedio', hoy: HOY });
const emp = poco.semanas.filter((s) => s.etiqueta === 'Empezar a correr');
check(emp.length === 3 && poco.fases[0].nombre === 'Empezar a correr' && poco.semanas[0].sesiones[0].titulo === PASOS_EMPEZAR[0].titulo && poco.semanas.length === 16 && planValido(poco)
  && poco.avisos.some((a) => /Empezar a correr/.test(a)), `(R11) si corre muy poco, primero «Empezar a correr» (${emp.length} semanas) y después el plan, sin saltar a un mínimo («${poco.avisos.find((a) => /Empezar/.test(a))}»)`);
const despues = poco.semanas.find((s) => s.fase === 'Base');
check(mid(despues) <= 3 * 3 * 1.4 + 2, `al acabar, empieza con poco (${despues.km_min}-${despues.km_max} km con 3 días)`);
check(proponerPlan({ evento: ev, dias: 3, kmAhora: 0, nivel: 'intermedio', hoy: HOY }).avisos.some((a) => /Sin km apuntados/.test(a)), 'sin km apuntados (y sin marcar «Empieza»), lo dice');
const cal1 = poco.semanas.find((s) => s.fase === 'Base' && !s.etiqueta).sesiones.find((x) => x.dia === 2);
check(cal1.minutos < 45 && cal1.minutos >= 20, `con pocos km, la sesión de la biblioteca, más corta (${cal1.titulo}: ${cal1.minutos} min en lugar de 45)`);
const esc = escalarSesion({ minutos: 50, partes: [{ fase: 'calentar', seg: 900 }, { fase: 'bloque', reps: 6, seg: 120, rec_seg: 90 }, { fase: 'enfriar', seg: 600 }] }, 0.5);
check(esc.minutos === 25 && esc.partes[0].seg === 480 && esc.partes[1].seg === 120 && esc.partes[1].reps === 6 && esc.partes[2].seg === 300, 'escalar: los minutos, calentar y enfriar en proporción (5 min como poco); las series se quedan');

console.log('Muchas combinaciones, todas válidas');
let validas = 0, total = 0;
for (const km of [5, 10, 21.0975, 42.195]) for (const dias of [2, 3, 4, 5, 6]) for (const nivel of ['empieza', 'intermedio', 'avanzado']) for (const sem of [1, 3, 8, 16, 30]) {
  total++;
  const x = proponerPlan({ evento: { nombre: 'X', distancia_km: km, fecha: sumarDias(HOY, 7 * (sem - 1) + 5) }, dias, kmAhora: nivel === 'empieza' ? 0 : 25, nivel, hoy: HOY });
  // (las de «Empezar a correr» van sin km, como las de la vuelta a correr)
  const sinNaN = JSON.stringify(x.semanas.filter((s) => s.etiqueta !== 'Empezar a correr')).indexOf('null,"km_max":null') < 0 && !/NaN/.test(JSON.stringify(x));
  if (planValido(x) && sinNaN && x.semanas.every((s) => s.sesiones.every((y) => y.tipo === 'carrera' || y.km == null || y.km >= 3))) validas++;
}
check(validas === total, `${validas} de ${total} planes (distancia × días × nivel × semanas) válidos, sin huecos ni sesiones de menos de 3 km`);

console.log('Lo que ha corrido de verdad');
const h = (f, km) => ({ fecha_realizada: f, completada: true, cardio_hecho: { modalidad: 'carrera', minutos: 40, km } });
const kr = kmRecientes([h(sumarDias(HOY, -3), 10), h(sumarDias(HOY, -10), 8), h(sumarDias(HOY, -12), 14), h(sumarDias(HOY, -30), 30), h(HOY, 9)], HOY);
check(kr && kr.media === 8 && kr.larga === 14 && kr.salidas === 3, `la media de las 4 semanas anteriores (32 km / 4 = ${kr?.media}) y su salida más larga (${kr?.larga}); ni las de esta semana ni las de hace más de 4`);
check(kmRecientes([], HOY) === null, 'sin nada apuntado, nada');

console.log('Rehacer desde aquí y la vuelta a correr');
const perfil = { plan_inicio: sumarDias(HOY, -56), fases: [{ nombre: 'Base', semanas: 6 }, { nombre: 'Construcción', semanas: 5 }, { nombre: 'Específico', semanas: 3 }, { nombre: 'Afinado', semanas: 2 }] };
const rh = rehacerDesde(perfil, { evento: ev, dias: 3, kmAhora: 18, nivel: 'intermedio', hoy: HOY, desde: HOY });
check(rh.inicio === perfil.plan_inicio && rh.fases[0].nombre === 'Base' && rh.fases[0].semanas === 6 && rh.fases[1].nombre === 'Construcción' && rh.fases[1].semanas === 2,
  `lo de antes se queda (Base 6 y 2 de construcción) y lo nuevo sigue desde este lunes (${rh.fases.map((f) => `${f.nombre} ${f.semanas}`).join(', ')})`);
check(rh.plan.semanas[0].lunes === HOY && rh.plan.semanas.at(-1).etiqueta === 'Carrera' && rh.fases.reduce((a, f) => a + f.semanas, 0) === 8 + rh.plan.semanas.length, 'las semanas nuevas, de este lunes a la de la carrera, y el macrociclo cuadra');
const rv = rehacerDesde(perfil, { evento: ev, dias: 3, kmAhora: 18, nivel: 'intermedio', hoy: HOY, desde: HOY, conVuelta: true });
const vueltas = rv.plan.semanas.filter((s) => s.etiqueta === 'Vuelta a correr');
const pasos = vueltas.flatMap((s) => s.sesiones.map((x) => x.titulo));
check(vueltas.length === 4 && pasos[0] === PASOS_VUELTA[0].titulo && pasos.at(-1) === PASOS_VUELTA[4].titulo && rv.fases.some((f) => f.nombre === 'Vuelta a correr' && f.semanas === 4),
  `con la vuelta a correr: 4 semanas de andar a correr seguido (${[...new Set(pasos)].join(' → ')})`);
check(rv.plan.semanas.length === 16 && rv.plan.semanas.at(-1).etiqueta === 'Carrera' && rv.plan.semanas.every((s) => s.lunes >= HOY) && rv.plan.semanas.every((s, i) => !i || s.lunes === sumarDias(rv.plan.semanas[i - 1].lunes, 7)), 'y después sigue el plan hasta la carrera, sin huecos');
const vv = vueltaACorrer({ dias: 2, desde: HOY });
check(vv.length === 5 && vv.every((s) => s.sesiones.length === 2) && vv.flatMap((s) => s.sesiones).every((x) => /3\/10|paso atrás|plan/.test(x.nota)), 'con 2 días, 5 semanas, cada paso con su aviso del dolor');

console.log('La revisión del experto: tope por salida, semanas que hacen falta y afinado');
// (R42) Ninguna salida más de un 10 % por encima de la más larga de las 4 semanas anteriores (al principio, la que ya hacía), y
// como mucho una por semana por encima de esa marca. Se mira en muchos planes (las de calidad, sin km, no cuentan).
let r42 = 0, r42mal = [];
for (const km of [10, 21.0975, 42.195]) for (const dias of [3, 4, 5]) for (const nivel of ['intermedio', 'avanzado']) {
  const x = proponerPlan({ evento: { nombre: 'X', distancia_km: km, fecha: sumarDias(HOY, 7 * 17 + 6) }, dias, kmAhora: 25, largaAhora: 8, nivel, hoy: HOY });
  const maxes = [];
  x.semanas.forEach((w, i) => {
    const ses = w.sesiones.filter((y) => y.tipo !== 'carrera' && y.km);
    const ref = Math.max(...maxes.slice(Math.max(0, i - 4), i), i < 4 ? 8 : 0);
    const encima = ses.filter((y) => y.km > ref + 0.5);
    if (ses.some((y) => y.km > ref * 1.1 + 0.6) || encima.length > 1) r42mal.push(`${km}/${dias}/${nivel} S${i + 1}`);
    maxes.push(Math.max(0, ...ses.map((y) => y.km)));
    r42++;
  });
}
check(!r42mal.length, `(R42) en ${r42} semanas de 18 planes, ninguna salida pasa en más de un 10 % la más larga de las 4 semanas anteriores, y solo una por semana bate esa marca${r42mal.length ? ` (${r42mal.slice(0, 3).join(', ')})` : ''}`);
// (R9/R43) Las semanas que hacen falta y si llega
const n16 = semanasNecesarias({ km: 42.195, largaAhora: 16, dias: 4 });
const n10 = semanasNecesarias({ km: 42.195, largaAhora: 10, dias: 3 });
check(n16.llegada === 27.7 && n16.necesarias === 14 && n10.necesarias === 17 && semanasNecesarias({ km: 42.195, largaAhora: 10, dias: 3, prudente: true }).necesarias > n10.necesarias + 1,
  `(R9) maratón: llegar a unos 28 km o 3 horas (${n16.llegada} km a su ritmo); desde 16 km, ${n16.necesarias} semanas; desde 10 km, ${n10.necesarias}; con «más de 60 o lesión», más`);
const corto = proponerPlan({ evento: { nombre: 'Maratón', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 13 + 6) }, dias: 3, kmAhora: 20, largaAhora: 10, nivel: 'intermedio', hoy: HOY });
check(corto.viable && !corto.viable.ok && /harían falta unas 17 semanas, y quedan 14/.test(corto.viable.texto) && corto.viable.opciones.length === 3,
  `(R43) un maratón en 14 semanas saliendo de 10 km: aviso rojo con tres salidas («${corto.viable.texto.slice(0, 80)}…»)`);
const largo = proponerPlan({ evento: { nombre: 'Maratón', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 17 + 6) }, dias: 4, kmAhora: 35, largaAhora: 16, nivel: 'intermedio', hoy: HOY });
check(largo.viable.ok && planValido(largo), 'en 18 semanas, saliendo de 16 km y 35 km por semana, llega');
const lw = largo.semanas.map(mid);
const pico = Math.max(...lw);
const largas = largo.semanas.map((w) => Math.max(0, ...w.sesiones.filter((y) => y.tipo === 'larga').map((y) => y.km)));
check(Math.max(...largas.slice(-6, -2)) >= 26 && Math.max(...largas) <= 32, `y su tirada larga llega a unos 28 km 3-5 semanas antes (la más larga, ${Math.max(...largas)} km)`);
check(Math.abs(lw.at(-3) / pico - 0.8) < 0.1 && Math.abs(lw.at(-2) / pico - 0.6) < 0.1 && Math.abs(lw.at(-1) / pico - 0.4) < 0.1 && largo.semanas.at(-1).km_max < 42,
  `(R18) el afinado del maratón: un 20, un 40 y un 60 % menos, y la semana de la carrera, sin contar la carrera (${lw.slice(-3).map(Math.round).join(', ')} km de ${Math.round(pico)})`);
check(largo.semanas.filter((w) => w.etiqueta === 'Descarga').every((w) => {
  const i = largo.semanas.indexOf(w);
  return largas[i] < largas[i - 1];
}), 'en las semanas de descarga, también la tirada larga, más corta');
// (R12, R15, R17) «Más de 60 o lesión»
const pru = proponerPlan({ evento: { nombre: '10K', distancia_km: 10, fecha: sumarDias(HOY, 7 * 15 + 6) }, dias: 5, kmAhora: 25, largaAhora: 8, nivel: 'avanzado', prudente: true, hoy: HOY });
check(pru.semanas[2].etiqueta === 'Descarga' && pru.semanas[5].etiqueta === 'Descarga' && pru.semanas.filter((w) => !w.etiqueta).every((w) => w.sesiones.filter((y) => y.tipo === 'calidad').length <= 1),
  '(R12, R15) con «más de 60 o lesión»: descarga una de cada 3 semanas y una sola calidad aunque sea avanzado');
check(pru.semanas.slice(0, 4).every((w) => w.sesiones.filter((y) => y.dia === 2).every((y) => /rectas/i.test(y.titulo))), '(R17) y las 4 primeras semanas, rectas (las cuestas, después)');
const m2 = proponerPlan({ evento: { nombre: 'M', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 19 + 6) }, dias: 2, kmAhora: 30, hoy: HOY });
const m3 = proponerPlan({ evento: { nombre: 'M', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 19 + 6) }, dias: 3, kmAhora: 30, largaAhora: 14, hoy: HOY });
check(!m2.viable.ok && /2 días por semana no se construye/.test(m2.viable.texto) && m2.viable.opciones[0] === 'Correr 3 días o más a la semana' && !m2.viable.opciones.includes('Buscar una carrera más adelante')
  && m3.viable.ok && proponerPlan({ evento: evM, dias: 2, kmAhora: 20, hoy: HOY }).avisos.some((a) => /media sale justa/.test(a)),
  `(R15) un maratón con 2 días no se propone (en rojo: «${m2.viable.opciones.join('», «')}»); con 3, sí; la media con 2, aviso`);
const pierna = proponerPlan({ evento: { nombre: 'M', distancia_km: 42.195, fecha: sumarDias(HOY, 7 * 19 + 6) }, dias: 3, kmAhora: 30, largaAhora: 14, nivel: 'avanzado', pierna: true, hoy: HOY });
check(Math.max(...pierna.semanas.map(mid)) <= 50 * 1.06, '(R13) con pierna pesada 3 días o más, el pico bajo (50 km en maratón)');
check(kmRecientes([h(sumarDias(HOY, -3), 10), { fecha_realizada: sumarDias(HOY, -5), completada: true, cardio: { tipo: 'carrera' }, cardio_hecho: { modalidad: 'carrera', minutos: 100, km: 21.1 } }], HOY).larga === 10,
  '(R19, R42) la salida más larga reciente, sin contar las carreras');

console.log('Copiar una semana con progresión');
const sem = { etiqueta: null, km_min: 20, km_max: 22, clave: 'Suave', sesiones: [{ tipo: 'facil', titulo: 'Rodaje', km: 10, zona: 2 }, { tipo: 'calidad', titulo: 'Umbral', minutos: 40, minutos_max: 45 }, { tipo: 'carrera', titulo: '10K', km: 10 }, { tipo: 'descanso', titulo: 'Descanso' }] };
const s10 = progresarSemana(sem, 10);
check(s10.km_min === 22 && s10.km_max === 24.2 && s10.sesiones[0].km === 11 && s10.sesiones[1].minutos === 44 && s10.sesiones[1].minutos_max === 50, 'un 10 % más: los km y los minutos de cada sesión y los de la semana');
check(s10.sesiones[2].km === 10 && s10.sesiones[3].tipo === 'descanso' && progresarSemana(sem, 5).sesiones[0].km === 10.5, 'la carrera y el descanso no cambian; con un 5 %, 10 → 10,5 km');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
