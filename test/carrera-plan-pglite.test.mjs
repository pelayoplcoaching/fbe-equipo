// v0.221: guardar el plan del asistente contra el esquema real (PGlite, con RLS): muchas semanas a la vez
// (api.guardarSemanasCarrera), las que ya tenía desde ese lunes y no están en el plan nuevo se quitan, y el perfil con
// las fases nuevas (limpiarPerfil las acepta tal cual las propone el asistente).
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { proponerPlan, rehacerDesde, planValido } from '../web/src/logica/carrera-plan.js';
import { hoyISO, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });

const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const hoy = hoyISO();
const L = lunesDe(hoy);
const q = (sql, p = []) => b.sql(sql, p);

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await q(`update perfiles set rol = 'coach' where id = $1`, [coachId]);
const ana = await api.crearAtleta({ nombre: 'Ana Pérez', email: 'ana@test' });
await api.actualizarAtleta(ana.id, { carrera: true });
await api.guardarCarreraPerfil(ana.id, { lthr: '172', umbral: '5:10-5:20', plan_nombre: 'Viejo', plan_inicio: sumarDias(L, -21), ventanas: '2', fases: [{ nombre: 'Base', semanas: '10' }] });
// Lo que tenía: tres semanas atrás, esta y dos más (la última, muy lejos)
for (const n of [-3, 0, 2, 30]) await api.guardarCarreraSemana(ana.id, { lunes: sumarDias(L, 7 * n), etiqueta: 'Vieja', km_min: '10', km_max: '12', sesiones: [{ tipo: 'facil', titulo: 'Viejo', km: 5 }] });

console.log('El asistente: una media dentro de 16 semanas, 4 días');
const ev = { nombre: 'Media de primavera', distancia_km: 21.0975, fecha: sumarDias(L, 7 * 15 + 6) };
const plan = proponerPlan({ evento: ev, dias: 4, kmAhora: 22, nivel: 'intermedio', hoy, inicio: L });
check(planValido(plan) && plan.semanas[0].lunes === L, `el plan propuesto es válido (${plan.semanas.length} semanas desde este lunes)`);
await api.guardarCarreraPerfil(ana.id, { lthr: '172', umbral: '5:10-5:20', plan_nombre: ev.nombre, plan_inicio: plan.inicio, ventanas: String(plan.dias), fases: plan.fases.map((f) => ({ ...f, semanas: String(f.semanas) })) });
await api.guardarSemanasCarrera(ana.id, plan.semanas.map(({ fase, ...s }) => s), { borrarDesde: L });
let d = await api.carrera(ana.id);
check(d.perfil.plan_nombre === 'Media de primavera' && d.perfil.ventanas === 4 && d.perfil.fases.map((f) => f.nombre).join() === plan.fases.map((f) => f.nombre).join() && d.perfil.lthr === 172,
  'el perfil, con el plan nuevo (nombre, días y fases) y sus zonas de antes');
const desde = d.semanas.filter((s) => s.lunes >= L);
check(desde.length === plan.semanas.length && desde.every((s, i) => s.lunes === plan.semanas[i].lunes && s.etiqueta !== 'Vieja'), 'desde este lunes, solo las semanas del plan nuevo (la vieja de esta semana y la de dentro de 2, cambiadas)');
check(!d.semanas.some((s) => s.lunes === sumarDias(L, 7 * 30)), 'la que tenía muy lejos, fuera del plan nuevo, se quita');
check(d.semanas.some((s) => s.lunes === sumarDias(L, -21) && s.etiqueta === 'Vieja'), 'las de antes de este lunes no se tocan');
const carrera = d.semanas.find((s) => s.lunes === lunesDe(ev.fecha));
check(carrera?.etiqueta === 'Carrera' && carrera.sesiones.some((x) => x.tipo === 'carrera' && x.km === 21.1), 'la de la carrera, con la carrera');

console.log('Rehacer desde la semana que viene, con la vuelta a correr');
const rh = rehacerDesde(d.perfil, { evento: ev, dias: 3, kmAhora: 15, nivel: 'intermedio', hoy, desde: sumarDias(L, 7), conVuelta: true });
await api.guardarCarreraPerfil(ana.id, { lthr: '172', umbral: '5:10-5:20', plan_nombre: ev.nombre, plan_inicio: rh.inicio, ventanas: '3', fases: rh.fases.map((f) => ({ ...f, semanas: String(f.semanas) })) });
await api.guardarSemanasCarrera(ana.id, rh.plan.semanas.map(({ fase, ...s }) => s), { borrarDesde: sumarDias(L, 7) });
d = await api.carrera(ana.id);
check(d.perfil.plan_inicio === L && d.perfil.fases[0].semanas === 1 && d.perfil.fases.some((f) => f.nombre === 'Vuelta a correr'), 'el macrociclo: la semana ya hecha y, después, la vuelta a correr y lo demás');
check(d.semanas.find((s) => s.lunes === L)?.etiqueta === plan.semanas[0].etiqueta && d.semanas.find((s) => s.lunes === sumarDias(L, 7))?.etiqueta === 'Vuelta a correr', 'esta semana se queda como estaba; la que viene empieza la vuelta a correr');

console.log('Lo que no vale, no se guarda');
let error = null;
try { await api.guardarSemanasCarrera(ana.id, [{ lunes: L, km_min: '30', km_max: '20', sesiones: [] }]); } catch (e) { error = e.message; }
check(/Semana del .*el mínimo, antes que el máximo/.test(error || ''), `una semana mal: no se guarda nada y dice cuál (${error})`);

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
