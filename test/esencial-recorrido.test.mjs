// FBE Esencial, el recorrido entero en la demo (con un reloj que adelanta las semanas): Marina envía su cuestionario,
// la app le pone «Primeras 4 semanas», las hace todas (apuntando cada serie), saca sus marcas en la semana 4 y desde la
// 5 la app le prepara cada semana sola hasta la 12. Que nada se rompa por el camino y que todo tenga sentido.
const RealDate = Date;
let desfase = 0;
class Falsa extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfase); else super(...a); }
  static now() { return RealDate.now() + desfase; }
}
globalThis.Date = Falsa;
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const { hoyISO, sumarDias, fechaMadrid } = await import('../web/src/logica/fechas.js');
if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)');
  process.exit(0);
}

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
await bd.auth.entrar('marina@fbe.demo', 'demo');
const yo = (await bd.select('atletas', { eq: { email: 'marina@fbe.demo' } }))[0];
await api.guardarCuestionario(yo.id, { objetivos: ['salud'], experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, otros_deportes: null }, {});
await api.guardarCuestionario(yo.id, { lugar: 'gimnasio', material: ['maquinas'] }, {});
await api.guardarCuestionario(yo.id, { activo: false, enfermedad: false, enfermedad_detalle: null, sintomas: [], otras: [], medicacion_detalle: null }, {});
await api.guardarCuestionario(yo.id, { lesiones: [], alergias: null }, { completar: true });
const asig = await api.esencialAsignarPlan();
console.log('Las cuatro primeras semanas');
check(asig?.plantilla === 'Primeras 4 semanas', 'con el cuestionario, «Primeras 4 semanas»');

// Ella elige el peso las primeras semanas (y sube «un poco» en la 3); hace siempre lo de arriba del rango, con te sobran 2
const inicial = { 'Prensa de piernas': 40, 'Peso muerto rumano con mancuernas': 8, 'Press de pecho en máquina': 20, 'Jalón al pecho': 25 };
const usado = {};
const semanas = [];
let error = null, marcas = null;
for (let k = 0; k < 12 && !error; k++) {
  let r = null;
  try { r = await api.prepararSemanaEsencial(yo.id); } catch (e) { error = `semana ${k + 1}: ${e.message}`; break; }
  const p = await api.programa(yo.id);
  const w = p.actual;
  if (!w) { error = `semana ${k + 1}: sin semana (${hoyISO()})`; break; }
  const fila = { n: k + 1, bloque: p.bloque.nombre, numero: w.numero, inicio: w.fecha_inicio, prep: r?.tipo || null, nota: w.nota_coach || '', ej: {} };
  for (const s of p.sesiones[w.id] || []) {
    const d = await api.sesion(s.id, yo.id);
    for (const e of d.ejercicios) {
      const pl = !!e.ejercicio.por_tiempo;
      let kg = e.carga_sugerida_kg == null ? null : Number(e.carga_sugerida_kg);
      if (!pl && kg == null) kg = usado[e.ejercicio.nombre] ?? inicial[e.ejercicio.nombre] ?? 10;
      if (!pl && fila.bloque === 'Primeras 4 semanas' && w.numero === 3 && s.orden === 1) kg += 2.5;
      if (!pl) usado[e.ejercicio.nombre] = kg;
      if (s.orden === 1) fila.ej[e.ejercicio.nombre] = { series: e.series, min: e.reps_min, max: e.reps_max, kg, tiempo: pl };
      for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg: pl ? (kg || null) : kg, reps: e.reps_max, rpe: pl ? null : 8 }, yo.id);
    }
    await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO() });
  }
  semanas.push(fila);
  if (fila.bloque === 'Primeras 4 semanas' && w.numero === 4) marcas = (await api.marcasEsencial(yo.id))?.marcas || null;
  desfase += 7 * 864e5;
}
check(!error && semanas.length === 12, `doce semanas seguidas sin un solo error${error ? ` (${error})` : ''}`);
const plancha = (f) => f.ej['Plancha abdominal'];
check(semanas.slice(0, 4).map((f) => `${plancha(f).series}x${plancha(f).min}-${plancha(f).max}`).join(' ') === '1x20-30 2x25-35 2x30-40 2x35-45', 'la plancha de la guía: 20-30, 25-35, 30-40 y 35-45 s');
const txt = (m) => (m?.texto || '').replace(/\s/g, ' ');   // (con espacios que no parten)
check(marcas?.length === 5 && txt(marcas[0]) === '42,5 kg × 12' && txt(marcas[4]) === '45 s', `sus marcas de la semana 4 (${(marcas || []).map(txt).join(', ')})`);

console.log('\nDesde la semana 5, la app');
const s5 = semanas[4];
check(s5?.bloque === 'Novato 2 días · FBE Esencial' && s5.prep === 'novato' && s5.numero === 1 && s5.inicio === sumarDias(semanas[3].inicio, 7), 'la semana 5, «Novato 2 días · FBE Esencial», justo el lunes siguiente');
check(s5?.ej['Prensa de piernas']?.kg >= 42.5 && s5.ej['Prensa de piernas'].series === 3 && s5.ej['Prensa de piernas'].max === 12 && plancha(s5).min === 40 && plancha(s5).max === 50,
  'con los kilos de sus marcas (prensa desde 42,5) y la plantilla: 3 series de 10-12 y la plancha 40-50 s');
const resto = semanas.slice(5);
check(resto.length === 7 && resto.every((f) => f.bloque === 'Novato 2 días · FBE Esencial' && f.prep === 'siguiente' && f.nota), 'de la 6 a la 12, cada lunes la prepara la app, con su nota');
check(resto.every((f, i) => f.inicio === sumarDias(semanas[4 + i].inicio, 7)), 'sin huecos: una detrás de otra');
const prensa = semanas.slice(4).map((f) => f.ej['Prensa de piernas'].kg);
check(prensa.every((kg, i) => i === 0 || (kg >= prensa[i - 1] && kg - prensa[i - 1] <= 2.5)) && prensa[prensa.length - 1] > prensa[0], `la prensa sube poco a poco y nunca baja haciéndolo todo (${prensa.join(' → ')} kg)`);
const pl = semanas.slice(4).map(plancha);
check(pl.every((x) => x.max <= 50) && pl.some((x) => (x.kg || 0) >= 5), `la plancha nunca pasa de 50 s y, al llegar arriba, lleva peso (${pl.map((x) => `${x.min}-${x.max}${x.kg ? `+${x.kg}` : ''}`).join(' ')})`);
check(semanas.slice(4).every((f) => Object.values(f.ej).every((e) => e.series >= 2 && e.series <= 3)), 'siempre 2 o 3 series por ejercicio');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
