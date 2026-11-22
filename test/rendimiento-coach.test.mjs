// (v0.207) Que las pantallas del coach no vuelvan a ser lentas: cuántas esperas seguidas a la base hace cada carga.
// En el móvil, cada consulta tarda lo que tarda la red (la mitad de las veces unos 170 ms; una de cada diez, más de
// 600 ms), así que lo que cuenta no es cuántas consultas se hacen, sino cuántas hay que esperar una detrás de otra.
// Aquí la demo responde por «ondas»: todas las consultas pedidas a la vez se contestan juntas, y la siguiente onda
// es la de las que solo se pudieron pedir con esas respuestas. Así la cuenta no depende de lo rápida que sea la
// máquina. Si una prueba falla, alguna carga ha pasado a esperar algo más una detrás de otra: lo normal es pedirlo
// a la vez que lo demás (Promise.all) o de pocos en pocos (deNEnN); si de verdad hace falta, se sube el tope.
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi, deNEnN } from '../web/src/datos/api.js';
import { fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });

// Una app recién abierta (sin nada recordado) sobre la demo, con lo que hace falta para llamar a cada carga
async function fresca() {
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const previa = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await previa.perfil();
  const d = { bandeja: await previa.bandeja(), resumenes: await previa.resumenes() };
  d.ana = d.resumenes.find((r) => r.nombre === 'Ana López').atleta_id;
  const bls = await previa.bloquesDe(d.ana);
  d.bloqueId = (bls.find((x) => x.estado === 'activo') || bls[0])?.id;
  // las dos últimas sesiones hechas de cada atleta con historial (Revisar con todo el equipo en la bandeja)
  d.sesiones = [];
  d.conHistorial = 0;
  for (const r of d.resumenes) {
    const h = await previa.historial(r.atleta_id).catch(() => []);
    const ids = [...new Set(h.map((x) => x.sesion_id).filter(Boolean))].slice(-2);
    if (ids.length) d.conHistorial++;
    for (const id of ids) d.sesiones.push({ id, atleta_id: r.atleta_id, fecha_realizada: h.find((x) => x.sesion_id === id)?.fecha || null });
  }
  // otra app sobre la misma base: sin nada recordado de lo de arriba
  const api = crearApi(b);
  await api.perfil();
  // Desde aquí, las lecturas esperan a su onda
  const cola = [];
  const original = {};
  for (const m of ['select', 'rpc']) { original[m] = b[m].bind(b); b[m] = (...a) => new Promise((res, rej) => cola.push({ m, a, res, rej })); }
  const calma = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
  async function ondas(fn) {
    let hecho = false, error = null;
    const p = Promise.resolve().then(fn).then(() => { hecho = true; }, (e) => { hecho = true; error = e; });
    let n = 0, consultas = 0;
    for (;;) {
      await calma();
      // (lo que se queda pidiendo por detrás cuando la carga ya ha acabado, como guardar el historial para la próxima
      // vez, no se espera: se contesta sin contarlo)
      const contar = !hecho;
      if (!cola.length) {
        if (hecho) break;
        await new Promise((r) => setTimeout(r, 5));   // (algo espera un temporizador de verdad)
        continue;
      }
      const lote = cola.splice(0);
      if (contar) { n++; consultas += lote.length; }
      await Promise.all(lote.map(async (x) => { try { x.res(await original[x.m](...x.a)); } catch (e) { x.rej(e); } }));
    }
    await p;
    if (error) throw error;
    return { ondas: n, consultas };
  }
  return { api, d, ondas };
}

// Cada carga, en una app recién abierta: [nombre, carga, tope de esperas seguidas]
const CARGAS = [
  ['el historial de un atleta (récords, gráficas, Revisar)', (api, d) => api.historial(d.ana), 3],
  ['Revisar: los récords de su bandeja', (api, d) => api.marcasSesiones(d.bandeja.sesiones), 3],
  ['la lista de atletas (y la cabecera de una ficha)', (api) => api.resumenes(), 6],
  ['la cabecera de la ficha de un atleta', (api, d) => api.resumenes(undefined, { soloAtleta: d.ana }), 6],
  ['la Revisión semanal', (api) => api.revisionSemanal(fechaMadrid()), 7],
  ['quién queda por programar (el editor)', (api) => api.porProgramar(), 3],
  ['un bloque en el editor', (api, d) => api.bloqueCompleto(d.bloqueId), 4],
];

console.log('Esperas seguidas a la base de cada carga del coach');
const medidas = {};
for (const [nombre, carga, tope] of CARGAS) {
  const { api, d, ondas } = await fresca();
  const m = await ondas(() => carga(api, d));
  medidas[nombre] = m.ondas;
  check(m.ondas <= tope, `${nombre}: ${m.ondas} esperas seguidas (como mucho ${tope}; ${m.consultas} consultas)`);
}

// Revisar con todo el equipo: los historiales se piden de cuatro en cuatro, no uno detrás de otro
{
  const { api, d, ondas } = await fresca();
  const m = await ondas(() => api.marcasSesiones(d.sesiones));
  const porAtleta = medidas[CARGAS[0][0]];
  const tope = Math.ceil(d.conHistorial / 4) * porAtleta;
  check(d.conHistorial >= 4 && m.ondas <= tope, `Revisar con ${d.conHistorial} atletas en la bandeja: ${m.ondas} esperas seguidas (de cuatro en cuatro, como mucho ${tope}; uno detrás de otro serían ${d.conHistorial * porAtleta})`);
  const r = await api.marcasSesiones(d.sesiones);
  check(d.sesiones.every((s) => r[s.id] && Array.isArray(r[s.id].records)), 'y trae los récords de todas sus sesiones');
}

// Dos partes de una pantalla que piden el historial de dos atletas a la vez: cada una se baja una sola vez
{
  const { api, d, ondas } = await fresca();
  const otro = d.resumenes.find((r) => r.atleta_id !== d.ana && d.sesiones.some((s) => s.atleta_id === r.atleta_id))?.atleta_id;
  const solo = await ondas(() => Promise.all([api.historial(d.ana), api.historial(otro)]));
  const doble = await ondas(() => Promise.all([api.historial(d.ana), api.historial(otro), api.historial(d.ana), api.historial(otro)]));
  check(doble.consultas === 0, `el historial de dos atletas pedido otra vez enseguida no se vuelve a bajar (${solo.consultas} consultas la primera vez, ${doble.consultas} la segunda)`);
}

// Con lo antiguo ya guardado en el dispositivo (la segunda vez que se mira a un atleta), la huella de lo guardado y lo
// nuevo desde el corte se piden a la vez (antes, primero la huella y luego lo demás: dos esperas más)
{
  const { api, d, ondas } = await fresca();
  await ondas(() => api.historial(d.ana));   // la primera vez: se baja todo y se guarda lo antiguo
  const m = await ondas(() => api.historialSinCompartir(d.ana));
  check(m.ondas <= 3 && m.consultas >= 2, `con lo antiguo guardado, el historial espera ${m.ondas} veces (como mucho 3; ${m.consultas} consultas, la huella entre ellas)`);
}

// deNEnN: como mucho n a la vez, todas hechas y en su orden
{
  let a = 0, max = 0;
  const r = await deNEnN([5, 1, 4, 2, 3, 6, 7], 3, async (x) => { a++; max = Math.max(max, a); await new Promise((res) => setTimeout(res, x * 2)); a--; return x * 10; });
  check(max === 3 && JSON.stringify(r) === JSON.stringify([50, 10, 40, 20, 30, 60, 70]), `deNEnN: como mucho 3 a la vez (${max}) y cada resultado en su sitio`);
  check(JSON.stringify(await deNEnN([], 4, async () => 1)) === '[]', 'deNEnN: sin nada, nada');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
