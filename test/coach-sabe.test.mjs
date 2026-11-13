// Personalización 3, tanda 9: lo que le hace volver (solo por lo que hace), su alerta temprana y los hitos que merecen
// algo de verdad. Lógica pura.
//   node test/coach-sabe.test.mjs
import * as S from '../web/src/logica/coach-sabe.js';
import { MOMENTOS_COACH } from '../web/src/logica/personal.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const hoy = '2026-11-13';
const dia = (n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// 17. lo que le hace volver
const ent = [], mensajes = [];
for (let k = 0; k < 10; k++) { const m = 10 + k * 10; mensajes.push(dia(m)); ent.push({ fecha: dia(m - 1), records: k < 4 ? 1 : 0 }); } // entrena al día siguiente de cada mensaje
for (let k = 0; k < 6; k++) ent.push({ fecha: dia(105 - k * 2) });
const r = S.loQueLeFunciona({ entrenos: ent, mensajes, hoy });
check(r && r.lineas[0].clave === 'mensajes' && r.lineas[0].tasa === 1 && r.lineas[0].sube && r.resumen === 'Le hace volver que le escribas.', 'tras los mensajes del coach vuelve mucho más que de normal: «le hace volver que le escribas»');
check(/de normal, el \d+ %/.test(r.lineas[0].texto), 'con su comparación (lo de siempre)');
check(S.loQueLeFunciona({ entrenos: ent.slice(0, 5), mensajes, hoy }) === null && S.loQueLeFunciona({ entrenos: ent, mensajes: mensajes.slice(0, 2), hoy })?.lineas.every((l) => l.clave !== 'mensajes') !== false, 'con pocos datos, nada (o sin la línea de mensajes)');

// 18. alerta temprana
const reg = []; for (let k = 0; k < 40; k++) reg.push({ fecha: dia(3 + k * 2) });
check(S.alertaTemprana({ entrenos: reg, hoy }) === null, 'entrenando como siempre, sin alerta');
check(S.alertaTemprana({ entrenos: reg.slice(6), hoy })?.nivel === 'parado' && /Lleva 15 días/.test(S.alertaTemprana({ entrenos: reg.slice(6), hoy }).texto), 'con 10 días o más parado, lo dice');
check(S.alertaTemprana({ entrenos: reg.slice(2), hoy })?.nivel === 'raro', 'más días de lo que suele aguantar sin entrenar: aviso suave');
// parones precedidos de semana floja, y ahora otra semana floja
const pat = [];
const semana = (lunesAtras, n) => { for (let i = 0; i < n; i++) pat.push({ fecha: dia(lunesAtras * 7 - i * 2) }); };
semana(1, 1); semana(2, 3); semana(3, 3); semana(4, 1); /* parón */ semana(7, 3); semana(8, 3); semana(9, 1); /* parón */ semana(12, 3); semana(13, 3);
const a = S.alertaTemprana({ entrenos: pat, hoy });
check(a?.nivel === 'patron' && /semana floja como esta/.test(a.texto), 'sus parones empiezan con una semana floja y esta lo es: aviso antes del bajón');
check(S.alertaTemprana({ entrenos: reg.slice(0, 5), hoy }) === null, 'con pocas sesiones, nada');

// 19. hitos que merecen algo
const atletas = [{ id: 'a', nombre: 'Ana', fecha_alta: '2025-11-01', estado: 'activo' }, { id: 'b', nombre: 'Bea', fecha_alta: '2026-01-01' }, { id: 'c', nombre: 'Cris', fecha_alta: '2025-11-10', estado: 'baja' }];
const personal = [{ atleta_id: 'b', meta_nombre: 'Su boda', meta_fecha: '2026-11-07' }];
const env = S.enviosPendientes({ atletas, personal, hoy });
check(env.length === 2 && env.some((x) => x.atletaId === 'a' && /un año/.test(x.que)) && env.some((x) => x.atletaId === 'b' && /Su boda/.test(x.que)), 'su primer año y el día de su meta (no los de baja)');
check(S.enviosPendientes({ atletas, personal, hoy, enviados: { [env[0].clave]: true } }).length === 1, 'lo ya hecho no vuelve a salir');
// 20. el momento de bienvenida
check(MOMENTOS_COACH.some(([k]) => k === 'bienvenida'), 'su primer mes: el mensaje de bienvenida del coach');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
