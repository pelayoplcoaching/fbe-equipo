// v0.224: carrera, mejora 13. El modo guiado de series: de las partes de una sesión, los tramos del cronómetro y lo que
// dice la voz (logica/carrera-guiada.js).
import { tramosGuiados, resumenGuiado, duracionVoz } from '../web/src/logica/carrera-guiada.js';
import { BIBLIOTECA_FBE } from '../web/src/logica/carrera-biblioteca.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

check(duracionVoz(900) === '15 minutos' && duracionVoz(90) === '1 minuto y 30 segundos' && duracionVoz(20) === '20 segundos' && duracionVoz(60) === '1 minuto', 'la duración, en palabras');
const series = BIBLIOTECA_FBE.find((x) => x.id === 'fbe-series-800').pauta;
const t = tramosGuiados(series);
check(t[0].k === 'calentar' && t.at(-1).k === 'enfriar' && t.filter((x) => x.k === 'rectas').length === 4 && t.filter((x) => x.k === 'trabajo').length === 6 && t.filter((x) => x.k === 'recupera').length === 3 + 5,
  `6 × 800 m: calentar, 4 rectas, las 6 series con 5 recuperaciones entre ellas y enfriar (${t.length} tramos)`);
const s1 = t.find((x) => x.k === 'trabajo');
check(s1.titulo === 'Serie 1 de 6' && s1.seg === null && /800 m/.test(s1.detalle) && /Serie 1 de 6: 800 metros en zona 5/.test(s1.voz), `las series por distancia se pasan con «Hecho» y la voz lo dice («${s1.voz}»)`);
const rec = t.find((x) => x.k === 'recupera');
check(rec.seg > 0 && /^Recupera \d/.test(rec.voz), `la recuperación, con su tiempo («${rec.voz}»)`);
const umbral = tramosGuiados(BIBLIOTECA_FBE.find((x) => x.id === 'fbe-umbral-3x8').pauta);
check(umbral.filter((x) => x.k === 'trabajo').every((x) => x.seg === 480 && x.detalle === '8 min · Z4') && /Serie 2 de 3: 8 minutos en zona 4\./.test(umbral.find((x) => x.titulo === 'Serie 2 de 3').voz), 'umbral 3 × 8 min: cada serie, 8 minutos en Z4, cronometrada');
const rectas = tramosGuiados(BIBLIOTECA_FBE.find((x) => x.id === 'fbe-rodaje-rectas').pauta);
check(rectas.filter((x) => x.k === 'rectas').length === 6 && rectas.find((x) => x.k === 'rectas').voz.includes('rápida y suelta'), 'el rodaje con rectas: 6 rectas, «rápida y suelta»');
const r = resumenGuiado(umbral);
check(r.seg === 900 + 4 * 20 + 3 * 60 + 3 * 480 + 2 * 120 + 600 && r.aMano === 0, `lo que dura lo cronometrado (${Math.round(r.seg / 60)} min)`);
check(tramosGuiados({ modalidad: 'carrera', minutos: 40 }).length === 0 && tramosGuiados(null).length === 0, 'sin partes, nada que guiar');
check(BIBLIOTECA_FBE.every((x) => tramosGuiados(x.pauta).every((y) => y.titulo && y.voz && (y.seg == null || y.seg > 0))), 'todas las sesiones de la biblioteca FBE se pueden guiar');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
