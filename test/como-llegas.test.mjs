// (v0.258, el día a día: D1 a D5) «¿Cómo llegas hoy?» de un toque en FBE Esencial: la cara que cuenta (con menos de 6
// horas, «bien» es «regular»), el nivel y si frena (solo con «Hacerlo así»), lo que propone la app según cómo llega (la
// sesión ajustada de un día regular, la mínima de un día malo y lo de las agujetas), cómo queda la sesión con ella (sin
// perder lo ya hecho), lo que ve el coach, el dial de Hoy y que todo va apagado hasta el visto bueno de Pelayo.
import { esUnToque, caraDe, consejoPreparacion, subeCarga, completa } from '../web/src/logica/preparacion.js';
import { textoPreparacion } from '../web/src/logica/preparacion-texto.js';
import { CARAS, HORAS, MINIMA, principalesDe, accesoriosDe, propuestaDelDia, aplicarPropuesta, calentamientoLargo } from '../web/src/logica/como-llegas.js';
import { textoConsejo } from '../web/src/logica/esencial-primera.js';
import { dialComoLlegas, prepDeHoy } from '../web/src/logica/tablero.js';
import { esMalDia } from '../web/src/logica/motor/semana.js';
import { APAGADO, encendido } from '../web/src/logica/esencial-respuestas.js';
import { REVISAR_POR } from '../web/src/logica/esencial-ajustes.js';
import { readFileSync } from 'node:fs';
import { comoLlegan, textoLlegan } from '../web/src/logica/radar/llegan.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La cara que cuenta (D1, D4)');
check(CARAS.map(([c]) => c).join() === 'bien,regular,mal' && HORAS.min === 2 && HORAS.max === 14 && HORAS.paso === 0.5, 'tres caras y las horas de 2 a 14, de media en media (como la 110)');
check(esUnToque({ cara: 'bien' }) && !esUnToque({ sueno: 3, energia: 3, molestias: 3 }) && !esUnToque(null) && !esUnToque({ cara: 'fatal' }), 'de un toque, solo con una de las tres caras (las tres preguntas siguen siendo las tres preguntas)');
check(caraDe({ cara: 'bien', horas: 5.5 }) === 'regular' && caraDe({ cara: 'bien', horas: 6 }) === 'bien' && caraDe({ cara: 'bien' }) === 'bien' && caraDe({ cara: 'bien', horas: null }) === 'bien'
  && caraDe({ cara: 'mal', horas: 4 }) === 'mal' && caraDe({ cara: 'regular', horas: 8 }) === 'regular', 'con menos de 6 horas, «bien» cuenta como «regular» (con 6 o sin horas, no); «mal» sigue siendo «mal»');

console.log('\nEl nivel y si frena');
const n = (p) => consejoPreparacion(p);
check(n({ cara: 'bien' }).nivel === 'bien' && n({ cara: 'regular' }).nivel === 'flojo' && n({ cara: 'mal' }).nivel === 'malo' && n({ cara: 'bien', horas: 5 }).nivel === 'flojo', 'el nivel de siempre (bien, flojo, malo): así lo leen el coach, el radar y el motor');
check(!n({ cara: 'regular' }).frenar && n({ cara: 'regular', asi: true }).frenar && !n({ cara: 'regular', asi: false }).frenar && n({ cara: 'bien', agujetas: true, asi: true }).frenar && !n({ cara: 'bien', asi: true }).frenar,
  'frena (los kilos de la última vez) solo si eligió «Hacerlo así»: lo del día es una propuesta (P2)');
check(subeCarga(n({ cara: 'mal' }), null) && !subeCarga(n({ cara: 'mal', asi: true }), null), 'y la sesión lo lee igual que siempre (subeCarga)');
check(esMalDia({ preparacion: { cara: 'mal' } }) && !esMalDia({ preparacion: { cara: 'regular' } }) && esMalDia({ preparacion: { sueno: 1, energia: 1, molestias: 1 } }), 'el motor de la semana cuenta «mal» como mal día, como «Día difícil» de las tres preguntas');
check(completa({ sueno: 2, energia: 2, molestias: 2 }) && !completa({ cara: 'bien' }), 'las tres preguntas, como estaban');

console.log('\nLo que propone (D2, D3, D5)');
const P = [
  { id: 'a', series: 3, prioridad: 'media', ejercicio: { nombre: 'Sentadilla con barra', tipo: ['basico', 'multiarticular'] } },
  { id: 'b', series: 3, prioridad: 'media', ejercicio: { nombre: 'Press de banca', tipo: ['multiarticular'] } },
  { id: 'c', series: 3, prioridad: 'media', ejercicio: { nombre: 'Curl femoral', tipo: ['aislamiento'] } },
  { id: 'd', series: 2, prioridad: 'media', ejercicio: { nombre: 'Remo con mancuerna', tipo: ['multiarticular'] }, series_detalle: [{ kg: 20 }, { kg: 20 }] },
  { id: 'e', series: 3, prioridad: 'baja', ejercicio: { nombre: 'Elevaciones laterales', tipo: ['aislamiento'] } },
  { id: 'f', series: 1, prioridad: 'muy_baja', ejercicio: { nombre: 'Curl de bíceps', tipo: ['aislamiento'] } },
];
check(principalesDe(P).map((e) => e.id).join() === 'a,b,d', 'lo principal: el básico y los multiarticulares, como mucho 3, en su orden');
check(principalesDe([{ ...P[0], prioridad: 'alta' }, P[2], P[4]]).map((e) => e.id).join() === 'a,c' && principalesDe([P[2], P[4]]).map((e) => e.id).join() === 'c,e',
  'al menos 2 (si no hay tantos, los siguientes de la sesión)');
check(accesoriosDe(P).map((e) => e.id).join() === 'c,e,f' && !accesoriosDe([{ ...P[2], prioridad: 'alta' }]).length, 'los accesorios: los de aislamiento y lo de prioridad baja (lo obligatorio, nunca)');
const reg = propuestaDelDia({ cara: 'regular' }, P);
check(reg.tipo === 'regular' && reg.ids.join() === 'c,e' && /Los kilos de la última vez y una serie menos en curl femoral, elevaciones laterales\./.test(reg.texto) && /igual de bien/.test(reg.porque),
  `regular: los kilos de la última vez y una serie menos en los accesorios con 2 o más series («${reg.texto}»)`);
check(propuestaDelDia({ cara: 'bien', horas: 5 }, P).tipo === 'regular', 'y lo mismo con «bien» y menos de 6 horas');
const min = propuestaDelDia({ cara: 'mal' }, P);
check(min.tipo === 'minima' && min.ids.join() === 'a,b,d' && /solo lo principal \(sentadilla con barra, press de banca, remo con mancuerna\), con 2 series/.test(min.texto) && /Una sola serie/.test(min.porque),
  `mal: la sesión mínima («${min.texto}»)`);
const ag = propuestaDelDia({ cara: 'bien', agujetas: true }, P);
check(ag.tipo === 'agujetas' && !ag.ids.length && propuestaDelDia({ cara: 'bien' }, P) === null && propuestaDelDia({ sueno: 1, energia: 1, molestias: 1 }, P) === null && propuestaDelDia({ cara: 'mal' }, []) === null,
  'con agujetas fuertes, el calentamiento largo y sin subir; con «bien», nada que proponer (ni con las tres preguntas ni sin ejercicios)');

console.log('\nLa sesión con la propuesta');
const s = (xs) => xs.map((e) => `${e.id}:${e.series}`).join(' ');
check(s(aplicarPropuesta(P, reg)) === 'a:3 b:3 c:2 d:2 e:2 f:1' && s(aplicarPropuesta(P, min)) === 'a:2 b:2 d:2' && aplicarPropuesta(P, null) === P && aplicarPropuesta(P, ag) === P,
  `regular, una serie menos en esos accesorios (${s(aplicarPropuesta(P, reg))}); mal, lo principal con 2 (${s(aplicarPropuesta(P, min))}); sin propuesta o con agujetas, como está`);
check(s(aplicarPropuesta(P, min, { c: { 1: {}, 2: {} }, a: { 1: {}, 2: {}, 3: {} } })) === 'a:3 b:2 c:2 d:2' && s(aplicarPropuesta(P, reg, { e: { 1: {}, 2: {}, 3: {} } })) === 'a:3 b:3 c:2 d:2 e:3 f:1',
  'lo ya hecho no desaparece: un ejercicio con series hechas se queda, con esas series como mínimo');
check(aplicarPropuesta(P, min).find((e) => e.id === 'd').series_detalle.length === 2 && aplicarPropuesta([{ ...P[3], series: 3, series_detalle: [{ kg: 20 }, { kg: 20 }, { kg: 20 }] }], { tipo: 'minima', ids: ['d'] })[0].series_detalle.length === 2,
  'las series pautadas una a una se recortan igual');
const largo = calentamientoLargo(['2 minutos de cardio suave (bici, remo o andar rápido)', 'Sentadilla sin peso, 10 lentas', 'Y en el primer ejercicio, tus series de aproximación']);
check(largo.length === 3 && /^5 minutos de cardio suave/.test(largo[0]) && largo[1] === 'Sentadilla sin peso, 10 lentas' && /aproximación más en cada ejercicio/.test(largo[2]), `el calentamiento largo (D5): ${largo.join(' / ')}`);

console.log('\nEl coach, el dial de Hoy y lo apagado');
check(textoPreparacion({ cara: 'bien', horas: 5.5, agujetas: true, asi: true }) === 'Bien · 5,5 h de sueño (cuenta como regular) · agujetas fuertes en lo de hoy · hizo lo que le propuso la app'
  && textoPreparacion({ cara: 'mal', asi: false }) === 'Mal · eligió entrenar normal' && textoPreparacion({ sueno: 1, energia: 2, molestias: 3 }).startsWith('Sueño: mal.'), 'lo que ve el coach con la sesión, en una línea');
const d = dialComoLlegas({ cara: 'regular' });
check(d.estado === 'flojo' && d.valor === 0.5 && d.etiqueta === 'Día flojo' && dialComoLlegas({ cara: 'bien' }).valor === 1 && dialComoLlegas(null).estado === 'sin_respuesta', 'el dial «Cómo llegas» de Hoy');
check(prepDeHoy({ id: 's1', completada: true, fecha_realizada: '2027-01-12', preparacion: { cara: 'mal' } }, '2027-01-12') && !prepDeHoy({ id: 's1', completada: false, preparacion: { cara: 'mal' } }, '2027-01-12'),
  'y cuenta como contestado hoy con la misma regla de siempre');
check(/En tu sesión, la app te propone una sesión mínima/.test(textoConsejo(n({ cara: 'mal' }), true)) && /los kilos de la última vez/.test(textoConsejo(n({ cara: 'bien', horas: 5 }), true))
  && textoConsejo(n({ cara: 'bien' }), true) === 'Sigue tu plan tal cual.' && /calentamiento más largo/.test(textoConsejo(n({ cara: 'bien', agujetas: true }), true)),
  'en el dial de Hoy, lo que le propondrá la app en su sesión (y no el consejo de las tres preguntas)');
check(!APAGADO.has('como_llegas') && encendido('como_llegas') && REVISAR_POR.como_llegas?.tipo === 'regla' && /migración 110/.test(REVISAR_POR.como_llegas.que),
  'encendido por Pelayo el 26/11 (sigue en «Por revisar», para sus textos)');
const css = readFileSync(new URL('../web/src/como-llegas.css', import.meta.url), 'utf8');
check(!/[^\x00-\x7F]/.test(css) && [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-z][a-z0-9-]*)/g)].every((m) => m[1].startsWith('cll-')), 'sus estilos: solo ASCII y solo clases cll-*');
check(MINIMA.series === 2 && MINIMA.ejercicios === 3, 'la sesión mínima: hasta 3 ejercicios, con 2 series');

console.log('\nEn «A quién escribir» (D11)');
const cl = comoLlegan({
  a: [{ fecha: '2027-01-12', preparacion: { sueno: 1, energia: 1, molestias: 1 } }, { fecha: '2027-01-14', preparacion: { sueno: 1, energia: 2, molestias: 1 } }, { fecha: '2027-01-10', preparacion: { sueno: 3, energia: 3, molestias: 3 } }],
  b: [{ fecha: '2027-01-13', preparacion: { sueno: 2, energia: 2, molestias: 2 } }, { fecha: '2027-01-14', preparacion: null }],
  c: [{ fecha: '2027-01-13', preparacion: { sueno: 1, energia: 1, molestias: 1 } }, { fecha: '2027-01-14', preparacion: { sueno: 3, energia: 3, molestias: 3 } }],
}, [{ atleta_id: 'a', nombre: 'Ana' }, { atleta_id: 'b', nombre: 'Bea' }, { atleta_id: 'c', nombre: 'Celia' }]);
check(cl.total === 6 && cl.malas === 3 && cl.flojas === 1 && cl.seguidas.length === 1 && cl.seguidas[0].nombre === 'Ana' && cl.seguidas[0].n === 2,
  'cuántas sesiones con respuesta, cuántas en día difícil o flojo y quién lleva dos o más seguidas en día difícil (las últimas)');
check(textoLlegan(cl) === 'De 6 sesiones con respuesta, 3 en día difícil y 1 en día flojo.' && textoLlegan(comoLlegan({}, [])) === null
  && textoLlegan({ total: 1, malas: 0, flojas: 0 }) === 'De 1 sesión con respuesta, ninguna en día flojo ni difícil.', 'y en una frase (sin respuestas, nada)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
