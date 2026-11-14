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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
