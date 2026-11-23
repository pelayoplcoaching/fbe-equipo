// (v0.210, rendimiento) Abrir una sesión: cuántas esperas a la base hay una detrás de otra. Con un 4G regular cada espera son
// unos 170 ms, así que se notan. Se cuentan «rondas»: todo lo que la app pide a la vez va en una ronda; lo que solo se puede
// pedir cuando llega lo anterior, en la siguiente. Antes de la v0.210, abrir una sesión eran 7 rondas; ahora, 4 como mucho.
// Y lo que devuelve es lo mismo que pidiéndolo todo sin prisa.
//   node test/sesion-esperas.test.mjs
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const b0 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
await b0.auth.entrar('ana@fbe.demo', 'demo');
// Cada consulta espera a que se suelte su ronda
const cola = [];
const lento = Object.create(b0);
for (const m of ['select', 'rpc']) lento[m] = (...a) => new Promise((listo, mal) => { cola.push(() => b0[m](...a).then(listo, mal)); });
const quieto = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
async function rondas(fn) {
  let fin = false, n = 0;
  const p = fn().finally(() => { fin = true; });
  p.catch(() => {});
  for (let vueltas = 0; vueltas < 40 && !fin; vueltas++) {
    await quieto();
    if (fin) break;
    const lote = cola.splice(0);
    if (!lote.length) continue;
    n++;
    await Promise.all(lote.map((f) => f()));
  }
  return { n, valor: await p };
}

console.log('Abrir una sesión');
const directa = crearApi(b0, { cubrir: false });
const atleta = await directa.miAtleta();
const programa = await directa.programa(atleta.id);
const sesiones = Object.values(programa?.sesiones || {}).flat();
const conHechas = sesiones.find((s) => s.completada) || sesiones[0];
const sinHacer = sesiones.find((s) => !s.completada) || sesiones[0];
check(!!conHechas && !!sinHacer, `la demo tiene sesiones de Ana (${sesiones.length})`);
for (const [nombre, s] of [['una sesión ya hecha', conHechas], ['la siguiente, sin hacer', sinHacer]]) {
  const api = crearApi(lento, { cubrir: false });
  const { n, valor } = await rondas(() => api.sesion(s.id, atleta.id));
  const esperada = await directa.sesion(s.id, atleta.id);
  check(n <= 4, `${nombre}: ${n} esperas seguidas a la base (antes, 7)`);
  check(JSON.stringify(valor) === JSON.stringify(esperada), `${nombre}: lo mismo que pidiéndolo todo sin prisa (${valor.ejercicios.length} ejercicios, «la última vez» de ${Object.keys(valor.ultimas).length})`);
}
{
  const api = crearApi(lento, { cubrir: false });
  const sinRecoger = [];
  const apuntar = (e) => sinRecoger.push(String(e?.message || e));
  process.on('unhandledRejection', apuntar);
  const r = await rondas(() => api.sesion('00000000-0000-4000-8000-000000000000', atleta.id)).then(() => 'abrió', (e) => e.message);
  await quieto();
  check(r === 'No se encuentra la sesión.' && !sinRecoger.length, `una sesión que no existe: «${r}», sin errores sin recoger (${sinRecoger.length})`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
