// El perfil del atleta, tanda 4 (rama perfil-4): lo puro de las 20 mejoras (logica/perfil-mas.js) y comprobaciones
// del código.
//   node test/perfil4.test.mjs
import { readFileSync } from 'node:fs';
const P = await import('../web/src/logica/perfil-mas.js');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (f) => readFileSync(new URL(`../web/${f}`, import.meta.url), 'utf8');
const s = (ejercicio_id, fecha, kg, reps, extra = {}) => ({ ejercicio_id, ejercicio: { a: 'Sentadilla', b: 'Press banca', c: 'Remo', d: 'Curl' }[ejercicio_id], fecha, kg, reps, ...extra });

console.log('\nTanda 1: el día 1 y hoy, marcas por repeticiones, correcciones y completa tu perfil');
const H = [
  s('a', '2026-06-01', 60, 8), s('a', '2026-06-01', 70, 5), s('a', '2026-11-02', 100, 5), s('a', '2026-11-09', 105, 3),
  s('b', '2026-06-03', 40, 10), s('b', '2026-11-10', 60, 8),
  s('c', '2026-11-01', 50, 10),
  s('d', '2026-05-01', 12, 12), s('d', '2026-05-01', 0, 10), s('d', '2026-07-01', 14, 10),
];
const d1 = P.diaUnoYHoy(H, { favoritos: ['b'], hoy: '2026-11-15' });
check(d1.map((x) => x.id).join() === 'b,a,d' && d1.length === 3, 'el día 1 y hoy: primero los suyos, luego los de más series; fuera los de menos de 4 semanas (remo)');
const a = d1.find((x) => x.id === 'a');
check(a.fecha === '2026-06-01' && a.kg === 70 && a.reps === 5 && a.antes === 81.7 && a.ahora === 116.7 && a.pct === 43, 'la mejor serie del primer día (70 × 5 → 81,7) frente al mejor de las 6 semanas (116,7): +43 %');
const d = d1.find((x) => x.id === 'd');
check(d.ahora === 18.7 && d.antes === 16.8, 'sin series recientes, el mejor de siempre');
check(P.diaUnoYHoy([], { hoy: '2026-11-15' }).length === 0 && P.diaUnoYHoy(H, {}).length === 0, 'sin series o sin hoy, nada');
const m = P.marcasPorReps(H, 'a');
check(m.map((x) => x.reps).join() === '1,3,5,8,10,12' && m[0].kg === 105 && m[1].kg === 105 && m[2].kg === 100 && m[2].fecha === '2026-11-02' && m[3].kg === 60 && m[4].kg === null, 'marcas por repeticiones: el mejor peso con al menos 1, 3, 5, 8… (sin ninguna, vacío)');
check(P.ejerciciosConMarcas(H).map((x) => x.id).join() === 'a,d,b,c', 'los ejercicios con marcas, los de más series primero (a igualdad, por nombre)');
const videos = [
  { id: 'v1', tipo: 'video_tecnica', ejercicio: { id: 'a', nombre: 'Sentadilla' }, revision: { corregido_el: '2026-10-01', checklist: { puntos: [{ t: 'Rodillas fuera', e: 'mal' }] } } },
  { id: 'v2', tipo: 'video_tecnica', ejercicio: { id: 'a', nombre: 'Sentadilla' }, revision: { corregido_el: '2026-11-01', checklist: { puntos: [{ t: 'Pecho  arriba', e: 'mal' }, { t: 'Profundidad', e: 'mal' }, { t: 'Pies', e: 'bien' }] } } },
  { id: 'v3', tipo: 'video_tecnica', ejercicio: { id: 'b', nombre: 'Press banca' }, revision: null },
  { id: 'v4', tipo: 'foto', ejercicio: { id: 'c' }, revision: { corregido_el: '2026-11-05', checklist: { puntos: [{ t: 'x', e: 'mal' }] } } },
];
const corr = P.correccionesPorEjercicio({ videos, recordatorios: [{ ejercicio_id: 'a', texto: 'profundidad', actualizado_el: '2026-10-20' }, { ejercicio_id: 'b', texto: 'Escápulas atrás' }], nombres: { b: 'Press banca' } });
check(corr.length === 2 && corr[0].id === 'a' && corr[0].fecha === '2026-11-01' && corr[0].videoId === 'v2' && corr[0].recordatorios.join() === 'profundidad' && corr[0].fallos.join() === 'Pecho arriba', 'correcciones: los ✗ de su último vídeo corregido, sin repetir los recordatorios (sin distinguir mayúsculas)');
check(corr[1].id === 'b' && corr[1].nombre === 'Press banca' && corr[1].fallos.length === 0 && corr[1].recordatorios[0] === 'Escápulas atrás', 'un ejercicio solo con recordatorios, con su nombre');
check(P.correccionesPorEjercicio({}).length === 0, 'sin nada, nada');
const c0 = P.completarPerfil({}, { entrena: true });
check(c0.pct === 0 && c0.faltan.length === 7 && c0.faltan[0].clave === 'foto', 'completa tu perfil: sin nada, 0 % y las 7 cosas');
const c1 = P.completarPerfil({ porque: 'Por mí', meta_nombre: 'Boda', favoritos: ['a'], musica_url: 'https://open.spotify.com/x', cumple_mes: 3, cumple_dia: 4 }, { foto: 'f.jpg', entrena: true, manualEscrito: true });
check(c1.pct === 100 && c1.faltan.length === 0, 'con todo, 100 % (y la tarjeta no sale)');
const c2 = P.completarPerfil({ porque: ' ' }, { entrena: false, manualEscrito: false });
check(c2.total === 5 && c2.faltan.length === 5 && !c2.faltan.some((h) => h.entreno), 'sin entrenamiento, sin lo de entrenar; un porqué en blanco no cuenta');
check(P.HUECOS_PERFIL.filter((h) => h.fila !== 'foto').every((h) => lee('src/ui/atleta/LoTuyo.jsx').includes(`etiqueta="${h.fila}"`)), 'cada hueco abre su fila de «Lo tuyo» (por su etiqueta, que existe)');
check(/<CompletaPerfil \/>\s*\n\s*<IndicePerfil \/>/.test(lee('src/ui/atleta/Perfil.jsx')) && /<FilaCorrecciones \/>/.test(lee('src/ui/atleta/Perfil.jsx')), 'en el perfil: lo que falta, el índice con buscador y las correcciones en Tu asesoría');
check(/<DiaUnoYHoy historial=/.test(lee('src/ui/atleta/PerfilSocial.jsx')) && /<MarcasPorReps historial=/.test(lee('src/ui/atleta/PerfilSocial.jsx')), 'el día 1 en Resumen y las marcas por repeticiones en Logros');

console.log('\nTanda 2: historia de bloques, palmarés, logros secretos, equivalencias y trimestre');
const inf = (id, numero, inicio, fin, extra = {}) => ({ bloque: { id, numero, nombre: `B${numero}`, objetivo: extra.objetivo || null, objetivo_logrado: extra.logrado ?? null }, inicio, fin, terminado: extra.terminado ?? true, sesiones: { hechas: 10, total: 12 }, records: extra.records || [], principales: extra.principales || [], vacio: !!extra.vacio });
const informes = [
  inf('1', 1, '2026-06-01', '2026-07-26', { objetivo: 'Técnica', logrado: true, records: [1, 2], principales: [{ nombre: 'Sentadilla', cambio: 8.5 }, { nombre: 'Press', cambio: 12 }] }),
  inf('2', 2, '2026-07-27', '2026-09-20', { records: [] }),
  inf('3', 3, '2026-09-21', '2026-12-13', { terminado: false }),
  inf('4', 4, '2026-01-01', '2026-02-01', { vacio: true }),
];
const hb = P.historiaBloques(informes);
check(hb.map((b) => b.id).join() === '2,1' && hb[1].records === 2 && hb[1].logrado === true && hb[1].mejor.nombre === 'Press' && hb[1].mejor.cambio === 12 && hb[0].mejor === null, 'historia de bloques: los terminados con algo hecho, del último al primero, con récords, objetivo y la mejor subida');
const pal = P.palmares({ informes, semanasCompletas: 9, records: 1, eventos: [{ nombre: '10K', fecha: '2026-05-01', resultado_seg: 3000 }, { nombre: 'Media', fecha: '2026-10-01', resultado_seg: 6000 }, { nombre: 'Futura', fecha: '2027-01-01', resultado_seg: null }], hoy: '2026-11-15' });
check(pal.map((x) => `${x.clave}:${x.n}`).join() === 'bloques:2,objetivos:1,semanas:9,records:1,carreras:2' && pal.find((x) => x.clave === 'carreras').detalle === 'Media' && pal.find((x) => x.clave === 'records').titulo === 'Récord', 'palmarés: bloques, objetivos logrados, semanas completas, récords y carreras (la última, con su nombre)');
check(P.palmares({}).length === 0, 'sin nada, la estantería no sale');
check(P.horaMadrid('2026-11-14T05:30:00Z') === 6 && P.horaMadrid('2026-07-14T05:30:00Z') === 7 && P.horaMadrid(null) === null, 'la hora, la de Madrid (en invierno +1, en verano +2)');
const ent = [];
for (let i = 0; i < 5; i++) ent.push({ fecha: `2026-03-0${i + 2}`, inicio: `2026-03-0${i + 2}T05:00:00Z`, records: 0 });
ent.push({ fecha: '2026-04-01', inicio: '2026-04-01T16:00:00Z', records: 5, duracion_min: 95 });
for (let d = 1; d <= 12; d++) ent.push({ fecha: `2026-05-${String(d).padStart(2, '0')}`, inicio: `2026-05-${String(d).padStart(2, '0')}T17:00:00Z` });
const ls = P.logrosSecretos(ent);
const c = Object.fromEntries(ls.conseguidos.map((x) => [x.clave, x.fecha]));
check(c.madrugador === '2026-03-06' && c.lluvia === '2026-04-01' && c.larga === '2026-04-01' && c.mes === '2026-05-12' && c.vuelta === '2026-04-01', 'logros secretos: madrugador (el quinto día), lluvia de récords, sin prisa, mes de doce y de vuelta (tras 3 semanas)');
check(!c.nocturno && c.cuatro === undefined && ls.quedan === ls.total - ls.conseguidos.length && ls.total === 8 && ls.conseguidos[0].fecha >= ls.conseguidos.at(-1).fecha, 'los que no, siguen ocultos (y cuántos quedan); los conseguidos, del último al primero');
const semanas = [];
for (const l of ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22']) for (let k = 0; k < 3; k++) { const d = new Date(`${l}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k); semanas.push({ fecha: d.toISOString().slice(0, 10) }); }
check(P.logrosSecretos(semanas).conseguidos.find((x) => x.clave === 'cuatro')?.fecha === '2026-06-24', 'cuatro semanas seguidas con 3 sesiones: el día de la tercera de la cuarta semana');
check(P.equivalencias({ kg: 160000 }).some((t) => t === 'Este año has levantado lo que pesa 1,1 ballenas azules') === false && P.equivalencias({ kg: 150000 })[0] === 'Este año has levantado lo que pesa 1 ballena azul' && P.equivalencias({ kg: 100 }).length === 0, 'equivalencias: en singular con 1, nada si no llega a 1 de lo más pequeño');
check(P.equivalencias({ km: 84.39 }).includes('Este año has recorrido 2 maratones') && P.equivalenciaDelDia({ kg: 30000 }, '2026-11-15') === P.equivalenciaDelDia({ kg: 30000 }, '2026-11-15') && P.equivalenciaDelDia({}, '2026-11-15') === null, 'con km, la de los maratones; la del día es siempre la misma ese día');
check(JSON.stringify(P.delAnio([{ fecha: '2026-02-01', tonelaje: 1000, cardio_hecho: { km: 5.25 } }, { fecha: '2025-12-31', tonelaje: 9999 }, { fecha: '2026-03-01', tonelaje: 500 }], '2026-11-15')) === '{"kg":1500,"km":5.3}', 'lo de este año: kilos y km');
const ent2 = [{ fecha: '2026-07-05', tonelaje: 1000 }, { fecha: '2026-08-05', tonelaje: 1000 }, { fecha: '2026-10-02', tonelaje: 4000, records: 2, duracion_min: 120 }, { fecha: '2026-11-03', tonelaje: 2600 }];
const ser2 = [s('a', '2026-08-01', 100, 5), s('a', '2026-10-02', 110, 5), s('b', '2026-10-02', 50, 5)];
const t1 = P.resumenTrimestre(ent2, ser2, '2026-11-15');
check(t1.titulo === 'oct–dic 2026' && !t1.completo && t1.sesiones === 2 && t1.records === 2 && t1.minutos === 120 && t1.toneladas === 6.6 && t1.antes === 2 && t1.mejora.nombre === 'Sentadilla' && t1.mejora.pct === 9.9, 'el trimestre en curso: sesiones, récords, horas, toneladas, frente al anterior, y lo que más ha subido (+9,9 %)');
const t2 = P.resumenTrimestre(ent2, ser2, '2026-10-10');
check(t2.titulo === 'jul–sep 2026' && t2.completo && t2.sesiones === 2, 'en sus 3 primeras semanas, el trimestre anterior entero');
check(P.resumenTrimestre([], [], '2026-11-15') === null && P.resumenTrimestre(ent2, ser2, null) === null, 'sin entrenos, nada');
check(/<PalmaresYBloques /.test(lee('src/ui/atleta/PerfilSocial.jsx')) && /<LogrosSecretos /.test(lee('src/ui/atleta/PerfilSocial.jsx')) && /<Equivalencia /.test(lee('src/ui/atleta/PerfilSocial.jsx')) && /<Trimestre /.test(lee('src/ui/atleta/PerfilSocial.jsx')), 'palmarés, bloques y secretos en Logros; equivalencias en Resumen; el trimestre en Datos');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
