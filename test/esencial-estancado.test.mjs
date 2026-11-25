// FBE Esencial, si se estanca (Pelayo, 25/11): en la demo y con un reloj que adelanta las semanas, Tomás hace desde su
// semana 5 siempre lo mínimo del rango con «te sobra 1». La app le repite la semana; a la tercera igual, la siguiente baja
// un 10 % (al salto del ejercicio) para volver a subir, y la nota lo cuenta. Y la plancha con 20 kg no sube más.
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
const { hoyISO, fechaMadrid } = await import('../web/src/logica/fechas.js');
const { estancado, kilosBajada, planchaBajada, planchaSiguiente, planchaEnTope, siguientePaso, PLANCHA } = await import('../web/src/logica/esencial-semana.js');

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las reglas');
const p = (kg, min = 10, max = 11, series = 3) => ({ carga_sugerida_kg: kg, reps_min: min, reps_max: max, series });
check(estancado([p(85), p(85), p(85)], p(85)) && !estancado([p(85), p(85)], p(85)) && !estancado([p(82.5), p(85), p(85)], p(85)) && !estancado([p(85), p(85), p(85)], p(87.5)),
  'estancado: tres semanas con la misma pauta y el motor vuelve a proponer lo mismo (con dos, o si algo cambió, no)');
check(kilosBajada(85) === 77.5 && kilosBajada(16) === 13.5 && kilosBajada(40) === 35 && kilosBajada(37.5) === 35 && kilosBajada(100, 5) === 90 && kilosBajada(2.5) === null,
  'la bajada: un 10 % al salto más cercano del ejercicio, como poco un salto y, en un empate, el menor (85 → 77,5; 16 → 13,5; 40 → 35; 37,5 → 35)');
check(JSON.stringify(planchaBajada({ reps_min: 40, reps_max: 50 })) === JSON.stringify({ reps_min: 35, reps_max: 45 }) && planchaBajada({ reps_min: 20, reps_max: 30 }) === null
  && planchaBajada({ reps_min: 35, reps_max: 45, carga_sugerida_kg: 7.5 }).carga_sugerida_kg === 5, 'en la plancha: 5 s menos (no por debajo de 20-30) o, con peso, 2,5 kg menos');
const hizo = (...ss) => ss.map(([reps, kg = null], i) => ({ numero: i + 1, reps, kg }));
check(planchaSiguiente({ series: 2, reps_min: 40, reps_max: 50, carga_sugerida_kg: 20 }, hizo([50, 20], [50, 20])) === null
  && planchaSiguiente({ series: 2, reps_min: 40, reps_max: 50, carga_sugerida_kg: 17.5 }, hizo([50, 17.5], [50, 17.5])).carga_sugerida_kg === 20 && PLANCHA.topePeso === 20,
  'la plancha, como mucho 20 kg: de 17,5 a 20 y, con 20, se queda');
check(planchaEnTope({ series: 2, reps_min: 40, reps_max: 50, carga_sugerida_kg: 20 }, hizo([50, 20], [52, 20])) && !planchaEnTope({ series: 2, reps_min: 40, reps_max: 50, carga_sugerida_kg: 20 }, hizo([50, 20], [45, 20])),
  'en el tope (20 kg y 50 s en todas), la nota le propone la versión difícil');
const bl = (nombre) => ({ id: 'b', nombre });
const sem = [{ id: 'w', bloque_id: 'b', numero: 3, fecha_inicio: '2027-02-08', programacion: 'programada' }];
const ses = { w: [{ completada: true }, { completada: true }] };
check(siguientePaso({ bloque: bl('Novato 2 días · FBE Esencial'), semanas: sem, sesiones: ses, hoy: '2027-02-12', dias: 3 })?.tipo === 'cambio'
  && siguientePaso({ bloque: bl('Novato 2 días · FBE Esencial'), semanas: sem, sesiones: ses, hoy: '2027-02-12', dias: 2 })?.tipo === 'siguiente'
  && siguientePaso({ bloque: bl('Novato 3 días · FBE Esencial'), semanas: sem, sesiones: ses, hoy: '2027-02-12', dias: 2 })?.plantilla === 'Novato 2 días · FBE Esencial',
  'pedir otros días: la semana siguiente, «cambio» a la otra plantilla de novato');

if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta la demo)');
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}

console.log('\nEn la demo: Tomás se estanca');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const yo = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
const semanas = [];
for (let k = 0; k < 7; k++) {
  const r = await api.prepararSemanaEsencial(yo.id);
  const pr = await api.programa(yo.id);
  const w = pr.actual;
  const fila = { prep: r?.tipo || null, nota: w?.nota_coach || '', ej: {} };
  for (const s of pr.sesiones[w.id] || []) {
    const d = await api.sesion(s.id, yo.id);
    for (const e of d.ejercicios) {
      const pl = !!e.ejercicio.por_tiempo;
      const kg = e.carga_sugerida_kg == null ? null : Number(e.carga_sugerida_kg);
      if (s.orden === 1) fila.ej[e.ejercicio.nombre] = { kg, min: e.reps_min, max: e.reps_max };
      for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg: pl ? kg : kg, reps: e.reps_min, rpe: pl ? null : 9 }, yo.id);
    }
    await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO() });
  }
  semanas.push(fila);
  desfase += 7 * 864e5;
}
const pre = semanas.map((f) => f.ej['Prensa de piernas']);
const i = pre.findIndex((x, k) => k > 0 && x.kg < pre[k - 1].kg);
check(i >= 4 && pre[i - 1].kg === pre[i - 2].kg && pre[i - 2].kg === pre[i - 3].kg, `la prensa se repite tres semanas y a la cuarta baja (${pre.map((x) => x.kg).join(' → ')} kg)`);
check(i > 0 && pre[i].kg === kilosBajada(pre[i - 1].kg), `un 10 % al salto: de ${pre[i - 1]?.kg} a ${pre[i]?.kg} kg`);
check(i > 0 && /bajas un poco el peso para volver a subir/.test(semanas[i].nota) && /prensa de piernas \(de/.test(semanas[i].nota), `y la nota lo cuenta («${(semanas[i]?.nota || '').slice(0, 160)}»)`);
check(i > 0 && pre.slice(i + 1, i + 3).every((x) => x.kg >= pre[i].kg), 'después no vuelve a bajar enseguida (hacen falta otras tres semanas igual)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
