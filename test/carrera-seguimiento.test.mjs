// v0.223: carrera, tanda 5. La eficiencia aeróbica (metros por latido en los rodajes suaves), la revisión quincenal que
// se rellena sola y la carrera en el calendario del móvil (logica/carrera-seguimiento.js).
import { eficienciaDe, serieEficiencia, revisionAuto, eventosCalendarioCarrera } from '../web/src/logica/carrera-seguimiento.js';
import { calendarioICS } from '../web/src/logica/plan.js';
import { sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const L = '2026-11-23';
const HOY = '2026-11-25';
const run = (f, km, min, fc, extra = {}, tipo = 'facil') => ({ fecha_realizada: f, completada: true, cardio: { modalidad: 'carrera', tipo }, cardio_hecho: { modalidad: 'carrera', minutos: min, km, fc_media: fc, ...extra } });

console.log('Metros por latido');
check(eficienciaDe(run(L, 8, 48, 150)) === 1.11, '8 km en 48 min a 150 ppm: 166,7 m/min ÷ 150 = 1,11 m por latido');
check(eficienciaDe(run(L, 8, 48, 150, {}, 'calidad')) === null && eficienciaDe(run(L, 8, 48, null)) === null && eficienciaDe(run(L, 1, 5, 150)) === null, 'solo rodajes suaves, con pulso y de 10 min o más');
const serie = serieEficiencia([run(sumarDias(L, -2), 8, 48, 150), run(sumarDias(L, -9), 8, 50, 152), run(sumarDias(L, -1), 6, 40, 160, {}, 'calidad')]);
check(serie.length === 2 && serie[0].fecha < serie[1].fecha && serie[1].media === Math.round(((serie[0].ef + serie[1].ef) / 2) * 100) / 100 && serie[1].ritmo === 360, 'la serie: por fecha, con su media móvil y el ritmo (6:00 min/km)');

console.log('La revisión de las dos últimas semanas');
const plan = [sumarDias(L, -14), sumarDias(L, -7)].map((lunes) => ({ lunes, km_min: 18, km_max: 22 }));
// dos semanas antes: 8 km en 52 min a 152; las dos últimas, 8 km en 48 min a 150 (mejor)
const antes = [-26, -24, -21, -19].map((d) => run(sumarDias(L, d), 8, 52, 152, { semaforo: 'verde' }));
const ahora = [-13, -11, -8, -6, -4].map((d) => run(sumarDias(L, d), 8, 48, 150, { semaforo: 'verde', dolor: 1 }));
const rv = revisionAuto({ semanas: plan, hechas: [...antes, ...ahora], hoy: HOY });
const parte = (k) => rv.partes.find((p) => p.k === k);
check(parte('eficiencia').color === 'verde' && /^\+9,9 % .* 4 semanas anteriores: mejora$/.test(parte('eficiencia').texto), `(R29) la eficiencia, por la mediana frente a las 4 semanas anteriores, mejora un 5 % o más: verde («${parte('eficiencia').texto}»)`);
check(parte('cumplimiento').color === 'verde' && /^100 %/.test(parte('cumplimiento').texto), `40 km de 40 previstos: verde («${parte('cumplimiento').texto}»)`);
check(parte('semaforos').color === 'verde' && rv.estado === 'verde' && /Eficiencia aeróbica: .*\(verde\)\. Cumplimiento: .*\(verde\)\. Semáforos y dolor: 5 en verde; dolor hasta 1\/10 \(verde\)\./.test(rv.texto), 'todo en verde, y el texto para la decisión');
const peor = revisionAuto({ semanas: plan, hechas: [...antes, ...ahora.slice(0, 3).map((x) => ({ ...x, cardio_hecho: { ...x.cardio_hecho, minutos: 56 } })), run(sumarDias(L, -4), 3, 20, 150, { semaforo: 'ambar' }, 'calidad'), run(sumarDias(L, -2), 3, 20, 150, { semaforo: 'ambar' }, 'calidad')], hoy: HOY });
check(peor.estado === 'ambar' && peor.partes.find((p) => p.k === 'eficiencia').color === 'ambar' && /empeora$/.test(peor.partes.find((p) => p.k === 'eficiencia').texto), `(R29, R32) si la eficiencia empeora un 5 % o más, ámbar: por sí sola nunca pone la revisión en rojo («${peor.texto.slice(0, 120)}…»)`);
check(peor.partes.find((p) => p.k === 'cumplimiento').color === 'ambar' && peor.partes.find((p) => p.k === 'semaforos').color === 'ambar', `(R30) 30 km de 40 (75 %): ámbar entre el 70 y el 89 % («${peor.partes.find((p) => p.k === 'cumplimiento').texto}»); dos ámbar, ámbar`);
const estable = revisionAuto({ semanas: plan, hechas: [...antes, ...[-13, -11, -8, -6].map((d) => run(sumarDias(L, d), 8, 51, 152, { semaforo: 'verde' }))], hoy: HOY });
const pe = estable.partes.find((p) => p.k === 'eficiencia');
check(pe.color === 'verde' && /^\+2 % .*estable/.test(pe.texto), `un +2 % es ruido: estable, verde («${pe.texto}»)`);
const corto = (d) => run(sumarDias(L, d), 4, 25, 150, { semaforo: 'verde' });
const cortas = revisionAuto({ semanas: plan, hechas: [...antes, corto(-13), corto(-11), corto(-8), corto(-6)], hoy: HOY });
check(!cortas.partes.some((p) => p.k === 'eficiencia') && eficienciaDe(corto(-13)) != null && eficienciaDe(corto(-13), 30) === null, 'rodajes de 25 min: salen en la gráfica, pero no cuentan en la revisión (30 min o más)');
check(!revisionAuto({ semanas: plan, hechas: [...antes, ...ahora.slice(0, 2)], hoy: HOY }).partes.some((p) => p.k === 'eficiencia'), 'con solo 2 rodajes en las dos semanas, sin eficiencia (hacen falta 3)');
const cumple = (l) => revisionAuto({ semanas: plan, hechas: l, hoy: HOY }).partes.find((p) => p.k === 'cumplimiento');
const c90 = cumple([...ahora.slice(0, 4), run(sumarDias(L, -4), 4, 26, 150)]);
const c69 = cumple([run(sumarDias(L, -13), 9.2, 55, 150), run(sumarDias(L, -11), 9.2, 55, 150), run(sumarDias(L, -6), 9.2, 55, 150)]);
check(c90.color === 'verde' && /^90 %/.test(c90.texto) && c69.color === 'rojo' && /^69 %/.test(c69.texto), `(R30) 36 de 40: el 90 %, verde; 27,6 de 40: el 69 %, rojo («${c90.texto}», «${c69.texto}»)`);
const conCarrera = cumple([...ahora.slice(0, 3), run(sumarDias(L, -7), 21.1, 110, 165, {}, 'carrera')]);
check(conCarrera.color === 'rojo' && /^60 % de los km previstos \(24 de 40\)/.test(conCarrera.texto), `una media maratón no cuenta en los km: el plan va sin ella («${conCarrera.texto}»)`);
const planMin = [sumarDias(L, -14), sumarDias(L, -7)].map((lunes) => ({ lunes, km_min: null, km_max: null, sesiones: [{ tipo: 'facil', minutos: 40 }, { tipo: 'facil', minutos: 40 }, { tipo: 'larga', minutos: 40 }] }));
const soloMin = (d) => ({ fecha_realizada: sumarDias(L, d), completada: true, cardio: { modalidad: 'carrera', tipo: 'facil' }, cardio_hecho: { modalidad: 'carrera', minutos: 40, semaforo: 'verde' } });
const cMin = revisionAuto({ semanas: planMin, hechas: [-13, -11, -9, -6, -4].map(soloMin), hoy: HOY }).partes.find((p) => p.k === 'cumplimiento');
check(cMin && cMin.color === 'ambar' && /^83 % de los minutos previstos \(200 de 240\)/.test(cMin.texto), `plan en minutos y sin km apuntados: el cumplimiento, en minutos («${cMin?.texto}»)`);
check(revisionAuto({ semanas: [], hechas: [], hoy: HOY }) === null, 'sin nada, no propone nada');
check(revisionAuto({ semanas: plan, hechas: [run(sumarDias(L, -10), 6, 40, 150, { semaforo: 'rojo' })], hoy: HOY }).partes.find((p) => p.k === 'semaforos').color === 'rojo', 'un rojo: rojo');

console.log('Su carrera en el calendario');
const eventos = [{ id: 'e1', nombre: 'Media de primavera', fecha: sumarDias(HOY, 40), distancia_km: 21.1, decision: 'va' }, { id: 'e2', nombre: 'Vieja', fecha: sumarDias(HOY, -3), decision: 'va' }, { id: 'e3', nombre: 'No va', fecha: sumarDias(HOY, 10), decision: 'no' }];
const semanas = [{ lunes: L, sesiones: [{ tipo: 'calidad', titulo: 'Umbral 3 × 8 min', dia: 2, minutos: 50 }, { tipo: 'facil', dia: 4, km: 6 }, { tipo: 'larga', titulo: 'Tirada larga', dia: 7, km: 12 }] },
  { lunes: sumarDias(L, 7), sesiones: [{ tipo: 'calidad', titulo: 'Cruceros', dia: 2, minutos: 55 }] }, { lunes: sumarDias(L, 7 * 8), sesiones: [{ tipo: 'calidad', titulo: 'Lejos', dia: 2 }] }];
const ev = eventosCalendarioCarrera({ eventos, semanas, hoy: HOY });
check(ev.map((x) => x.titulo).join(' | ') === 'Carrera: Tirada larga | Carrera: Cruceros | Carrera: Media de primavera', `las sesiones clave que vienen (no las pasadas ni las de dentro de 2 meses) y sus carreras (no las pasadas ni a las que no va): ${ev.map((x) => x.titulo).join(', ')}`);
const media = ev.find((x) => /Media/.test(x.titulo));
check(media.avisoMin === 780 && media.hora === '09:00' && media.minutos === 150, 'la carrera, a las 9:00 con aviso la víspera a las 20:00 (13 h antes)');
const ics = calendarioICS(ev, { nombre: 'Mi carrera' });
check(/BEGIN:VCALENDAR/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length === 3 && /TRIGGER:-PT780M/.test(ics) && /SUMMARY:Carrera: Media de primavera/.test(ics), 'y el archivo de calendario, con sus avisos');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
