// (v0.207, datos que crecen) Un atleta con dos años de entrenos (unas 8000 series: la historia de Ana en la demo, copiada
// hacia atrás) y lo que más pesa con tanta historia: su historial, Progreso, sus logros y su vitrina; y, en el coach, la
// lista de atletas, la cabecera de su ficha, Revisar, la Revisión semanal y su Actividad. Cada carga tiene que acabar en
// un tiempo razonable (aquí, sin red: lo que cuesta calcular) y traer todo. Sirve para cazar lo que crece mal con los
// años (algo que se recalcula entero por cada sesión, una copia de todo en cada vuelta…).
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { fechaMadrid } from '../web/src/logica/fechas.js';
import { eventosRecord } from '../web/src/logica/calculos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });
// (en milisegundos; muy por encima de lo de hoy en un ordenador normal, de 20 a 400 ms: salta si algo crece mal)
const TOPE_MS = 3000;

function semillaDosAnos(COPIAS = 40) {
  const d = semillaDemo();
  const ana = d.atletas.find((a) => a.nombre === 'Ana López');
  const bl = d.bloques.filter((b) => b.atleta_id === ana.id);
  const sem = d.semanas.filter((s) => bl.some((b) => b.id === s.bloque_id));
  const fechas = sem.map((s) => s.fecha_inicio).filter(Boolean).sort();
  const semanasSpan = Math.max(4, Math.round((Date.parse(fechas[fechas.length - 1]) - Date.parse(fechas[0])) / (7 * 864e5)) + 1);
  const ses = d.sesiones.filter((s) => sem.some((w) => w.id === s.semana_id));
  const pa = d.sesion_ejercicios.filter((p) => ses.some((s) => s.id === p.sesion_id));
  const sr = d.series.filter((x) => x.atleta_id === ana.id);
  const mueveF = (f, dias) => (f ? (f.length === 10 ? new Date(Date.parse(`${f}T12:00:00Z`) - dias * 864e5).toISOString().slice(0, 10) : new Date(Date.parse(f) - dias * 864e5).toISOString()) : f);
  let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  for (let k = 1; k <= COPIAS; k++) {
    const dias = k * semanasSpan * 7;
    const mb = new Map(), ms = new Map(), mses = new Map(), mp = new Map();
    for (const b of bl) { const x = { ...b, id: id(), numero: (b.numero || 1) - k * 10, estado: 'terminado' }; mb.set(b.id, x.id); d.bloques.push(x); }
    for (const s of sem) { const x = { ...s, id: id(), bloque_id: mb.get(s.bloque_id), fecha_inicio: mueveF(s.fecha_inicio, dias) }; ms.set(s.id, x.id); d.semanas.push(x); }
    for (const s of ses) { const x = { ...s, id: id(), semana_id: ms.get(s.semana_id), fecha_realizada: mueveF(s.fecha_realizada, dias), dia_previsto: mueveF(s.dia_previsto, dias) }; mses.set(s.id, x.id); d.sesiones.push(x); }
    for (const p of pa) { const x = { ...p, id: id(), sesion_id: mses.get(p.sesion_id) }; mp.set(p.id, x.id); d.sesion_ejercicios.push(x); }
    for (const s of sr) { if (!mp.has(s.sesion_ejercicio_id)) continue; d.series.push({ ...s, id: id(), sesion_ejercicio_id: mp.get(s.sesion_ejercicio_id), registrada_en: mueveF(s.registrada_en, dias) }); }
  }
  return d;
}

const d0 = semillaDosAnos(40);
const ana0 = d0.atletas.find((a) => a.nombre === 'Ana López');
const suyas = d0.series.filter((s) => s.atleta_id === ana0.id).length;
async function app(quien) {
  const b = crearBackendMemoria({ semilla: () => structuredClone(d0), persistir: false });
  await b.auth.entrar(quien, 'demo');
  const api = crearApi(b);
  await api.perfil();
  return api;
}
const medir = async (fn) => { const t0 = performance.now(); const r = await fn(); return { r, ms: Math.round(performance.now() - t0) }; };

console.log(`Dos años de entrenos (${suyas} series de Ana)`);
check(suyas > 7000, `la atleta de prueba tiene dos años de historial (${suyas} series)`);
{
  const api = await app('ana@fbe.demo');
  const yo = await api.miAtleta();
  const h = await medir(() => api.historial(yo.id));
  check(h.r.length === suyas && h.ms < TOPE_MS, `la atleta: su historial entero (${h.r.length} series) en ${h.ms} ms`);
  for (const [nombre, fn] of [['Progreso', () => api.progreso(yo.id)], ['sus logros', () => api.logros(yo.id)], ['su vitrina', () => api.vitrina(yo.id)], ['sus entrenos', () => api.entrenamientos(yo.id)]]) {
    const m = await medir(fn);
    check(m.r != null && m.ms < TOPE_MS, `la atleta: ${nombre} en ${m.ms} ms`);
  }
  const ev = eventosRecord(h.r);
  check(ev.eventos.length > 10 && Object.keys(ev.marcas).length > 5, `los récords de toda su historia, sesión a sesión (${ev.eventos.length} récords de ${Object.keys(ev.marcas).length} ejercicios)`);
}
{
  const api = await app('pelayo@fbe.demo');
  const ana = (await api.atletas()).find((a) => a.nombre === 'Ana López').id;
  const h = await medir(() => api.historial(ana));
  check(h.r.length === suyas && h.ms < TOPE_MS, `el coach: el historial de Ana (${h.r.length} series) en ${h.ms} ms`);
  const api2 = await app('pelayo@fbe.demo');
  const bandeja = await api2.bandeja();
  for (const [nombre, fn] of [['la lista de atletas', () => api2.resumenes()], ['la cabecera de su ficha', () => api2.resumenes(undefined, { soloAtleta: ana })], ['Revisar', () => api2.marcasSesiones(bandeja.sesiones || [])], ['la Revisión semanal', () => api2.revisionSemanal(fechaMadrid())], ['su Actividad', () => api2.actividad(ana)]]) {
    const m = await medir(fn);
    check(m.r != null && m.ms < TOPE_MS, `el coach: ${nombre} en ${m.ms} ms`);
  }
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
