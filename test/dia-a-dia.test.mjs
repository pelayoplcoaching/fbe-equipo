// (v0.259, el día a día: D6 y D9) La regla de la primera serie (con lo que le sobró en la primera serie, el resto sube un
// salto o baja un 2,5-5 %; con lo justo, como está) y la descarga por señales (dos semanas llegando regular o mal y las
// marcas cayendo). Las dos, apagadas hasta el visto bueno de Pelayo.
import { ajustePrimeraSerie, textoAjuste, PRIMERA_SERIE } from '../web/src/logica/ajuste-vivo.js';
import { descargaPorSenales, notaDescargaSenales } from '../web/src/logica/esencial-motor.js';
import { sesionCorta, aplicarCorta, textoCorta, CORTA_HASTA } from '../web/src/logica/sesion-corta.js';
import { APAGADO, encendido } from '../web/src/logica/esencial-respuestas.js';
import { REVISAR_POR } from '../web/src/logica/esencial-ajustes.js';
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La regla de la primera serie (D6)');
const a = (kg, rpe, objetivo = { rpe: 8 }, nombre = 'Sentadilla con barra') => ajustePrimeraSerie({ primera: { kg, reps: 8, rpe }, objetivo, reps: 8, nombre });
check(PRIMERA_SERIE.subeDesde === 2 && PRIMERA_SERIE.bajaMin === 0.025 && PRIMERA_SERIE.bajaMax === 0.05, 'sube con 2 o más de más; baja un 2,5-5 %');
check(a(60, 6)?.kg === 62.5 && a(60, 6).sentido === 'subir' && a(60, 5.5)?.kg === 62.5, 'con 2 o más repeticiones de más en reserva: un salto más (60 → 62,5 kg)');
check(a(60, 7) === null && a(60, 8) === null && a(60, 7.5) === null, 'con lo justo o una de más: como está');
check(a(60, 9)?.kg === 57.5 && a(60, 8.5)?.kg === 57.5 && a(100, 10)?.kg === 97.5 && a(200, 9)?.kg === 195, 'con menos de las pautadas: un 2,5 %, en saltos (60 → 57,5; 100 → 97,5; 200 → 195)');
check(a(20, 9)?.kg === 17.5, 'si un salto pasa del 5 %, uno solo (20 → 17,5)');
check(a(60, 9, { rir: 2 })?.kg === 57.5 && a(60, 6, { rir: 2 })?.kg === 62.5, 'igual con el esfuerzo pautado en RIR');
check(a(60, null) === null && a(0, 9) === null && ajustePrimeraSerie({ primera: { kg: 60, reps: 8, rpe: 9 }, objetivo: {} }) === null && a(60, 4) === null,
  'sin esfuerzo apuntado, sin kilos, sin esfuerzo pautado o con un RPE de menos de 5: nada');
check(textoAjuste(a(60, 6)) === 'En tu primera serie te sobraron 2 repeticiones más de las pautadas (RPE 8): sube a 62,5 kg el resto de series'
  && textoAjuste(a(60, 9, { rir: 2 })) === 'En tu primera serie te sobraron menos repeticiones de las pautadas (RIR 2): baja a 57,5 kg el resto de series', 'y lo dice así en la sesión');
const sc = readFileSync(new URL('../web/src/ui/atleta/sesion-comun.jsx', import.meta.url), 'utf8');
check(/PRIMERA && k === 2/.test(sc) && /a1\.sentido === 'bajar' \|\| progresionAuto/.test(sc), 'en la sesión, solo para la segunda serie y, en un día que no sube, solo para bajar');

console.log('\nLa descarga por señales (D9)');
const mal = { cara: 'mal' }, reg = { cara: 'regular' }, bien = { cara: 'bien' };
const d = (w1, w2) => ({
  semanas: [{ id: 'w1', fecha_inicio: '2027-02-01', numero: 4 }, { id: 'w2', fecha_inicio: '2027-02-08', numero: 5 }],
  sesiones: { w1: w1.map((p, i) => ({ id: `a${i}`, completada: true, preparacion: p })), w2: w2.map((p, i) => ({ id: `b${i}`, completada: true, preparacion: p })) },
});
const ejercicios = { sq: { nombre: 'Sentadilla', tipo: ['basico', 'multiarticular'] }, pb: { nombre: 'Press de banca', tipo: ['multiarticular'] }, cu: { nombre: 'Curl femoral', tipo: ['aislamiento'] } };
const filas = [{ ejercicio_id: 'sq', ejercicio: 'Sentadilla', tendencia: 'bajando' }, { ejercicio_id: 'pb', ejercicio: 'Press de banca', tendencia: 'bajando' }, { ejercicio_id: 'cu', ejercicio: 'Curl femoral', tendencia: 'subiendo' }];
const base = { id: 'w2', fecha_inicio: '2027-02-08', numero: 5 };
const ds = descargaPorSenales({ d: d([mal, reg, bien], [reg, bien]), base, filas, ejercicios });
check(ds && ds.bajan.join() === 'Sentadilla,Press de banca', 'dos semanas con la mitad o más en «regular» o «mal» y dos principales a la baja: descarga');
check(/^Llevas dos semanas llegando regular o mal a tus sesiones y tus marcas bajan \(sentadilla, press de banca\): esta semana toca descarga/.test(notaDescargaSenales(ds)), 'con su porqué en la nota');
check(descargaPorSenales({ d: d([mal, bien, bien], [reg, bien]), base, filas, ejercicios }) === null, 'si una de las dos semanas no llega a la mitad: no');
check(descargaPorSenales({ d: d([mal, reg], [reg, mal]), base, filas: [filas[0], { ...filas[1], tendencia: 'estable' }, { ...filas[2], tendencia: 'bajando' }], ejercicios }) === null,
  'con solo un principal a la baja (el curl femoral no cuenta): no');
check(descargaPorSenales({ d: d([mal], [mal]), base: { ...base, foco: 'descarga' }, filas, ejercicios }) === null && descargaPorSenales({ d: d([], [mal]), base, filas, ejercicios }) === null,
  'si la semana ya era de descarga, o sin respuestas la semana anterior: no');
check(descargaPorSenales({ d: d([{ sueno: 1, energia: 1, molestias: 1 }], [{ sueno: 1, energia: 2, molestias: 2 }]), base, filas, ejercicios }) !== null, 'también con las tres preguntas (día flojo o difícil)');
const em = readFileSync(new URL('../web/src/logica/esencial-motor.js', import.meta.url), 'utf8');
check(/extras\?\.descargaSenales && tipo !== 'novato'/.test(em) && /destino: \{ foco: 'descarga' \}/.test(em), 'en el motor: solo con la clave, fuera de las primeras semanas, en una semana normal y con la descarga de sus reglas de siempre');

console.log('\nLa sesión corta (D10)');
const S = [
  { id: 'a', series: 3, descanso_seg: 150, prioridad: 'media', ejercicio: { nombre: 'Sentadilla con barra', tipo: ['basico', 'multiarticular'], grupos_musculares: ['cuadriceps'] } },
  { id: 'c', series: 3, descanso_seg: 90, prioridad: 'media', ejercicio: { nombre: 'Curl femoral', tipo: ['aislamiento'], grupos_musculares: ['isquiotibiales'] } },
  { id: 'b', series: 3, descanso_seg: 120, prioridad: 'media', ejercicio: { nombre: 'Press de banca', tipo: ['multiarticular'], grupos_musculares: ['pectoral'] } },
  { id: 'e', series: 3, descanso_seg: 90, prioridad: 'media', ejercicio: { nombre: 'Extensión de cuádriceps', tipo: ['aislamiento'], grupos_musculares: ['cuadriceps'] } },
  { id: 'd', series: 3, descanso_seg: 90, prioridad: 'media', ejercicio: { nombre: 'Elevaciones laterales', tipo: ['aislamiento'], grupos_musculares: ['deltoides'] } },
];
const c = sesionCorta(S, 25);
check(CORTA_HASTA === 30 && c && c.orden.join() === 'a,b,c,d,e' && c.superserie.c === 'A' && c.superserie.d === 'A' && !c.superserie.e && !c.superserie.a,
  `con 25 minutos: los multiarticulares primero y el resto por parejas sin repetir zona (${c?.orden.join()}; el curl femoral con las laterales, no con la extensión de cuádriceps)`);
check(c.minutos <= c.antes && /^Con 25 minutos: primero sentadilla con barra, press de banca, con sus series de siempre; después, en superserie/.test(textoCorta(c, 25)), `y no dura más (de ${c.antes} a ${c.minutos} min, redondeado a 5), con su explicación`);
const ap = aplicarCorta(S, c);
check(ap.map((e) => `${e.id}${e.superserie || ''}`).join(' ') === 'a b cA dA e' && ap.every((e) => e._bloque === null) && aplicarCorta(S, null) === S, 'la sesión, colocada así (sin la corta, como está)');
check(sesionCorta(S, 40) === null && sesionCorta(S.slice(0, 2), 25) === null && sesionCorta([S[0], S[2], { ...S[1], tipo: undefined, ejercicio: { ...S[1].ejercicio, tipo: ['multiarticular'] } }], 25) === null,
  'con más de 30 minutos, con menos de 3 ejercicios o sin nada que juntar: nada');

console.log('\nApagado');
check(['primera_serie', 'descarga_senales', 'sesion_corta'].every((k) => APAGADO.has(k) && !encendido(k) && encendido(k, true) && REVISAR_POR[k]?.tipo === 'regla'), 'las tres, apagadas hasta el visto bueno de Pelayo (en «Por revisar»)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
