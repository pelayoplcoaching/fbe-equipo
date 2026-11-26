// (v0.257, P: 'molestias_zona') El motor de molestias en la semana, en la demo: Tomás apunta la rodilla a 4 (ámbar) y,
// al prepararle la semana siguiente, lo que carga la rodilla (la prensa) no sube aunque le tocara; el resto, sí, y la nota
// lo cuenta. Con la clave apagada, todo sube como siempre. Con un reloj que adelanta las semanas.
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
const { APAGADO } = await import('../web/src/logica/esencial-respuestas.js');
const D = await import('../web/src/datos/api-dolor.js');

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta la demo)');
  process.exit(0);
}

// Una semana entera, cumpliendo de sobra (tope del rango con margen): al prepararle la siguiente, todo debería subir
async function semana(conClave, conRodilla) {
  desfase = 0;
  if (conClave) APAGADO.delete('molestias_zona'); else APAGADO.add('molestias_zona');
  const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
  const api = crearApi(bd);
  await bd.auth.entrar('tomas@fbe.demo', 'demo');
  const yo = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
  const kilos = async () => {
    const pr = await api.programa(yo.id);
    const out = {};
    for (const s of (pr.sesiones[pr.actual.id] || []).filter((x) => x.orden === 1)) {
      const d = await api.sesion(s.id, yo.id);
      for (const e of d.ejercicios) out[e.ejercicio.nombre] = { kg: e.carga_sugerida_kg == null ? null : Number(e.carga_sugerida_kg), max: e.reps_max, series: e.series };
    }
    return { out, nota: pr.actual.nota_coach || '', id: pr.actual.id };
  };
  const notas = [];
  let antes = null;
  for (let k = 0; k < 2; k++) {
    await api.prepararSemanaEsencial(yo.id);
    const ahora = await kilos();
    notas.push(ahora.nota);
    if (k === 1) return { antes, despues: ahora.out, nota: ahora.nota, cambio: antes && ahora.id };
    antes = ahora.out;
    const pr = await api.programa(yo.id);
    for (const s of pr.sesiones[pr.actual.id] || []) {
      const d = await api.sesion(s.id, yo.id);
      for (const e of d.ejercicios) {
        const pl = !!e.ejercicio.por_tiempo;
        const kg = e.carga_sugerida_kg == null ? null : Number(e.carga_sugerida_kg);
        for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg, reps: e.reps_max, rpe: pl ? null : 7 }, yo.id);
      }
      await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO() });
    }
    if (conRodilla) {
      const r = await D.apuntarDolor(bd, { zona: 'rodilla', valor: 4, momento: 'ahora' });
      check(r && !r.falta109 && r.valor === 4, 'Tomás apunta la rodilla a 4 en «Me duele algo»');
    }
    desfase += 7 * 864e5;
  }
  return null;
}

console.log('Con la clave encendida y la rodilla en ámbar');
const a = await semana(true, true);
const pre = (x) => x?.['Prensa de piernas'];
const otros = (x) => Object.entries(x || {}).filter(([n]) => n !== 'Prensa de piernas' && n !== 'Plancha abdominal');
check(!!a && pre(a.antes)?.kg != null && pre(a.despues)?.kg === pre(a.antes).kg, `la prensa (carga mucho la rodilla) no sube: ${pre(a?.antes)?.kg} → ${pre(a?.despues)?.kg} kg`);
check(!!a && otros(a.despues).some(([n, v]) => v.kg != null && a.antes[n]?.kg != null && v.kg > a.antes[n].kg), `lo que no carga la rodilla sí sube (${otros(a?.despues).map(([n, v]) => `${n}: ${a?.antes?.[n]?.kg} → ${v.kg}`).join('; ')})`);
check(!!a && /Como tu rodilla está en ámbar, esta semana no suben ni de carga ni de series los ejercicios que la cargan \(prensa de piernas\)\./.test(a.nota), `la nota lo cuenta («${(a?.nota || '').slice(0, 220)}»)`);

console.log('\nCon la clave apagada (como hasta que Pelayo dé el visto bueno)');
const b = await semana(false, true);
check(!!b && pre(b.despues)?.kg > pre(b.antes)?.kg && !/rodilla/.test(b.nota), `la prensa sube como siempre (${pre(b?.antes)?.kg} → ${pre(b?.despues)?.kg} kg) y la nota no dice nada de la rodilla`);

APAGADO.add('molestias_zona');
console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
