// Personalización 2, tanda 4: «Tu ADN FBE» (solo de su entrenamiento), la carta del mes, «Para hablarle» y los momentos
// nuevos de los mensajes del coach. Lógica pura.
//   node test/retrato.test.mjs
import * as R from '../web/src/logica/retrato.js';
import { MOMENTOS_COACH, textoMensajeCoach } from '../web/src/logica/personal.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const dia = (d) => new Date(Date.UTC(2026, 7, 3 + d)).toISOString().slice(0, 10); // 3 ago 2026, lunes
const sesion = (d, rec = 0, hora = '16:00') => ({ fecha: dia(d), inicio: `${dia(d)}T${hora}:00Z`, records: rec, nombre: 'Pierna A' });
const lunes = Array.from({ length: 14 }, (_, i) => sesion(i * 7, i % 4 === 0 ? 1 : 0));
const jueves = Array.from({ length: 14 }, (_, i) => sesion(i * 7 + 3));
const progreso = { ejercicios: [{ nombre: 'Sentadilla', grupos_musculares: ['cuadriceps'], series: 60 }, { nombre: 'Press banca', grupos_musculares: ['pectoral'], series: 40 }, { nombre: 'Prensa', grupos_musculares: ['cuadriceps'], series: 10 }] };
const hoy = '2026-11-13';

// 18. «Tu ADN FBE»
const a = R.adnFbe({ entrenos: [...lunes, ...jueves], progreso, fechaAlta: '2026-08-01', hoy, conMusica: true }, { genero: 'f' });
check(a && a.rasgos.find((r) => r.clave === 'fuerte').texto === 'Cuádriceps' && a.rasgos.find((r) => r.clave === 'suyo').texto === 'Sentadilla', 'su fuerte (el grupo con más series) y su ejercicio (el que más ha hecho)');
check(/1,9 sesiones por semana/.test(a.rasgos.find((r) => r.clave === 'constancia').texto) && a.rasgos.some((r) => r.clave === 'musica') && a.rasgos.find((r) => r.clave === 'cuando').texto === 'Los lunes y jueves, por la tarde', 'su constancia, cuándo entrena y su banda sonora');
check(/^Eres de las que/.test(a.frase) && /Cuándo: Los lunes y jueves/.test(a.compartir), 'la frase en su género y el texto para compartir');
const solo = R.adnFbe({ entrenos: [...lunes, ...lunes.map((x) => ({ ...x, fecha: x.fecha }))].slice(0, 14).concat(Array.from({ length: 6 }, (_, i) => sesion(i * 14 + 1))), progreso, fechaAlta: '2026-08-01', hoy }, { genero: 'm' });
check(solo && /^Eres de los que/.test(solo.frase), 'en masculino');
check(R.adnFbe({ entrenos: lunes.slice(0, 11), progreso, fechaAlta: '2026-08-01', hoy }) === null && R.adnFbe({ entrenos: [...lunes, ...jueves], progreso, fechaAlta: '2026-10-01', hoy }) === null, 'antes de 8 semanas o de 12 sesiones, todavía no');
check(!/salud|sueño|peso|personalidad/i.test(JSON.stringify(a)), 'solo de su entrenamiento (nada de salud)');

// 19. la carta del mes
check(R.mesDeLaCarta('2026-11-03') === '2026-10' && R.mesDeLaCarta('2026-11-25') === '2026-11' && R.mesDeLaCarta('2027-01-02') === '2026-12', 'del 1 al 7, la del mes pasado; luego, la de este');
const ent = [...lunes, ...jueves];
const carta = R.cartaDelMes({ nombre: 'Ana López', personal: { porque: 'Por mi espalda', meta_nombre: 'Mi boda', meta_fecha: '2026-12-01' }, entrenos: ent, mes: '2026-10', hoy: '2026-11-03' });
check(/^¡Hola, Ana!/.test(carta) && /Este octubre has hecho 9 sesiones y un récord/.test(carta), 'con su nombre, sus sesiones y sus récords del mes');
check(/«Por mi espalda»/.test(carta) && /Faltan 4 semanas para Mi boda: estamos en la recta final/.test(carta), 'su porqué y su meta (y cuánto falta)');
check(/^Ana:/.test(R.cartaDelMes({ nombre: 'Ana López', entrenos: ent, mes: '2026-10', hoy, tono: 'directo' })) && /qué mes!/.test(R.cartaDelMes({ nombre: 'Ana', entrenos: ent, mes: '2026-10', hoy, tono: 'tope' })), 'en el tono que elija el coach');
check(/ha costado entrenar/.test(R.cartaDelMes({ nombre: 'Ana', entrenos: [], mes: '2026-10', hoy })) && /^¡Hola, Anita!/.test(R.cartaDelMes({ nombre: 'Ana', personal: { apodo: 'Anita' }, entrenos: [], mes: '2026-10', hoy })), 'sin sesiones, sin reproches; y con su apodo');

// 20. «Para hablarle»
const ph = R.paraHablarle({ nombre: 'Ana López', personal: { apodo: 'Anita', genero: 'f', tono: 'tope', porque: 'Por mi espalda', meta_nombre: 'Mi boda', meta_fecha: '2026-11-20' }, entrenos: ent, ultimoCoach: '2026-11-01T10:00:00Z', hoy });
const fila = (k) => ph.filas.find(([x]) => x === k)?.[1];
check(fila('Cómo le llamamos') === 'Anita' && fila('Cómo le hablamos') === 'En femenino · A tope' && fila('Su porqué') === '«Por mi espalda»' && fila('Su meta') === 'Faltan 7 días para Mi boda', 'cómo le llamamos y le hablamos, su porqué y su meta');
check(/^Un récord el /.test(fila('Su último hito')) && fila('Le escribiste') === 'Hace 12 días', 'su último hito y cuándo le escribió');
check(/meta está cerca/.test(ph.idea), 'la idea: lo más oportuno (su meta cerca)');
check(/Lleva \d+ días sin entrenar/.test(R.paraHablarle({ nombre: 'Luis', entrenos: [sesion(0)], hoy }).idea) && R.paraHablarle({ nombre: 'Luis', entrenos: [], hoy }).filas.find(([k]) => k === 'Le escribiste')[1] === 'Nunca', 'sin entrenar hace tiempo, preguntarle cómo está; sin mensajes, «Nunca»');

// los momentos nuevos
check(MOMENTOS_COACH.some(([k]) => k === 'primera_vez') && MOMENTOS_COACH.some(([k]) => k === 'viaje')
  && textoMensajeCoach(MOMENTOS_COACH.find(([k]) => k === 'primera_vez')[2], { nombre: 'Ana', ejercicio: 'hip thrust' }) === 'Primera vez con hip thrust, Ana: sin prisa, la técnica primero. Luego me cuentas.', 'los mensajes del coach ganan la primera vez y la vuelta de un viaje');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
