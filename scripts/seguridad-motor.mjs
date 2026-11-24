// Revisión de seguridad de «Programar según FBE» sobre una copia completa de la app (la que se descarga en el panel).
// Recorre las mismas parejas de semanas que la prueba en sombra y mira cada serie que propone el motor frente a lo que
// hizo el atleta en ella. Pensada para «FBE por tu cuenta»: con --por-su-cuenta todos los atletas pasan por los frenos
// del 24/11/2026 (modelos.js) y la cifra que importa tiene que salir a cero.
//
//   node scripts/seguridad-motor.mjs <copia.json> [--por-su-cuenta] [--confirmar] [--json salida.json] [--ejemplos N]
//
//   --confirmar  simula que el atleta confirma todo lo que el motor le pregunta por posible errata y vuelve a proponer
//
// Qué cuenta (por serie hecha, comparada con la propuesta para esa misma serie):
//   masDeUnSalto        la propuesta sube más de un salto de carga sobre los kilos que movió
//   bajoSuelo           estaba dentro del rango y la propuesta baja del mínimo (sin contar el peaking)
//   atascadoDosSemanas  dos semanas seguidas por debajo de su mínimo y la propuesta ni suma repeticiones ni baja kilos (con kilos)
//   (informativo)       atascado una semana, sube más de un 10 %, más de 2 repeticiones, molestia y sube
// La copia lleva datos de salud: este script no escribe nombres de atletas (en el JSON, «Atleta N»).
import { readFileSync, writeFileSync } from 'node:fs';
import { proponerSemana } from '../web/src/logica/motor/proponer.js';
import { entradaDesdeBloque } from '../web/src/logica/motor/adaptador.js';
import { leerGuardadas } from '../web/src/logica/motor/guardadas.js';
import { seriesPautadas } from '../web/src/logica/motor/sombra.js';
import { tieneDetalle } from '../web/src/logica/calculos.js';
import { sumarDias } from '../web/src/logica/fechas.js';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const conValor = new Set(['--json', '--ejemplos'].map((n) => args.indexOf(n) + 1).filter((i) => i > 0));
const ruta = args.find((a, i) => !a.startsWith('--') && !conValor.has(i));
const porSuCuenta = args.includes('--por-su-cuenta'), confirmar = args.includes('--confirmar');
const salida = opcion('--json'), nEjemplos = Number(opcion('--ejemplos')) || 0;
if (!ruta) { console.error('Uso: node scripts/seguridad-motor.mjs <copia.json> [--por-su-cuenta] [--confirmar] [--json salida.json] [--ejemplos N]'); process.exit(1); }

const copia = JSON.parse(readFileSync(ruta, 'utf8'));
const agrupar = (lista, clave) => (lista || []).reduce((acc, x) => { (acc[x[clave]] ||= []).push(x); return acc; }, {});
const ejercicios = Object.fromEntries((copia.ejercicios || []).map((e) => [e.id, e]));
const idx = { semanas: agrupar(copia.semanas, 'bloque_id'), sesiones: agrupar(copia.sesiones, 'semana_id'), pautas: agrupar(copia.sesion_ejercicios, 'sesion_id'), series: agrupar(copia.series, 'sesion_ejercicio_id') };
const checkins = agrupar(copia.checkins, 'atleta_id'), molestias = agrupar(copia.molestias, 'atleta_id');
const valida = (s) => !s.sustituto_id && Number(s.reps) > 0;
const ids = new Map();
const anon = (id) => { if (!ids.has(id)) ids.set(id, `Atleta ${ids.size + 1}`); return ids.get(id); };

function bloqueDeCopia(bloque) {
  const semanas = (idx.semanas[bloque.id] || []).slice().sort((a, b) => a.numero - b.numero);
  const sesiones = {}, pautas = {}, series = {};
  for (const w of semanas) {
    sesiones[w.id] = idx.sesiones[w.id] || [];
    for (const s of sesiones[w.id]) { pautas[s.id] = idx.pautas[s.id] || []; for (const p of pautas[s.id]) series[p.id] = idx.series[p.id] || []; }
  }
  return { bloque, semanas, sesiones, pautas, series };
}
const tieneSeries = (d, w) => (d.sesiones[w.id] || []).some((s) => (d.pautas[s.id] || []).some((p) => (d.series[p.id] || []).some(valida)));
const tienePautas = (d, w) => (d.sesiones[w.id] || []).some((s) => (d.pautas[s.id] || []).length > 0);
// Las repeticiones pautadas en cada serie (como las lee el motor a RPE 10)
const pautadas = (p, k) => (tieneDetalle(p) ? p.series_detalle[k]?.reps : p.reps_min ?? p.reps_max) ?? null;

const c = { semanas: 0, filas: 0, preguntas: 0, seriesConKilos: 0, seriesConReps: 0, masDeUnSalto: [], bajoSuelo: [], bajoSueloPautado: 0, atascadoDosSemanas: [], atascadoSinCarga: 0, atascadoUnaSemana: 0,
  subeMas10: 0, masDe2Reps: 0, filasConMolestia: 0, subenConMolestia: 0, frenos: {},
  // Para estimar el trabajo del coach con «por su cuenta»: semanas de atleta con al menos un aviso de cada tipo
  semanasCon: { pregunta: 0, molestia: 0, sinCarga: 0, bajaRango: 0, alguno: 0 } };

for (const at of copia.atletas || []) {
  const g = leerGuardadas(at.reglas_motor);
  const reglas = { atleta: g.atleta, porEjercicio: g.porEjercicio };
  for (const bloque of (copia.bloques || []).filter((b) => b.atleta_id === at.id && !b.es_plantilla)) {
    const d = bloqueDeCopia(bloque);
    for (let i = 0; i + 1 < d.semanas.length; i++) {
      const base = d.semanas[i], destino = d.semanas[i + 1];
      if (destino.numero !== base.numero + 1 || !tieneSeries(d, base) || !tienePautas(d, destino)) continue;
      if (base.foco === 'descarga' || destino.foco === 'descarga') continue;
      const antes = { ...d, semanas: d.semanas.filter((w) => w.numero <= base.numero) };
      const hoy = destino.fecha_inicio || (base.fecha_inicio ? sumarDias(base.fecha_inicio, 7) : undefined);
      const atleta = { nivel: at.nivel ?? null, perfil: g.perfil, volumen_objetivo: at.volumen_objetivo ?? null, ...(porSuCuenta ? { modalidad: 'por_su_cuenta' } : {}) };
      const entrada = entradaDesdeBloque({ d: antes, base, destino, ejercicios, atleta, reglas, checkins: checkins[at.id] || [], molestias: molestias[at.id] || [], ...(hoy ? { hoy } : {}) });
      let r = proponerSemana(entrada);
      if (r.semana.tipo !== 'normal') continue;
      c.semanas++;
      const preguntas = r.filas.filter((f) => f.tipo === 'pregunta');
      c.preguntas += preguntas.length;
      const hay = { pregunta: preguntas.length > 0, molestia: r.filas.some((f) => (f.avisos || []).some((a) => a.tipo === 'molestia')) || (r.semana.avisos || []).length > 0,
        sinCarga: r.filas.some((f) => (f.avisos || []).some((a) => /sin carga que bajar/.test(a.texto))), bajaRango: r.filas.some((f) => (f.frenos || []).some((x) => x.id === 'baja_rango')) };
      for (const [k, v] of Object.entries(hay)) if (v) c.semanasCon[k]++;
      if (Object.values(hay).some(Boolean)) c.semanasCon.alguno++;
      if (confirmar && preguntas.length) {
        // El atleta dice que sí, que lo apuntado es correcto: esas series llegan con `confirmada` y se vuelve a proponer
        const series = { ...entrada.series };
        for (const f of preguntas) {
          const nums = (f.pregunta?.series || []).map((x) => x.numero);
          series[f.pauta_id] = (series[f.pauta_id] || []).map((s) => (nums.includes(Number(s.numero)) ? { ...s, confirmada: true } : s));
        }
        entrada.series = series;
        r = proponerSemana(entrada);
      }
      for (const fila of r.filas) {
        if (fila.tipo === 'pregunta') continue;   // sin propuesta hasta que el atleta conteste
        c.filas++;
        for (const fr of fila.frenos || []) c.frenos[fr.id] = (c.frenos[fr.id] || 0) + 1;
        const pauta = entrada.pautas.find((p) => p.id === fila.pauta_id) || {};
        const hechas = Object.fromEntries((entrada.series[fila.pauta_id] || []).filter(valida).map((s) => [Number(s.numero), s]));
        const hist = (entrada.historial[fila.pauta_id] || entrada.historial[fila.ejercicio_id] || []).filter((h) => h?.pauta && h.foco !== 'descarga');
        const previa = Object.fromEntries((hist[hist.length - 1]?.series || []).filter(valida).map((s) => [Number(s.numero), s]));
        const prop = seriesPautadas(fila.propuesta, fila.ejercicio);
        const salto = Number(fila.regla?.salto) || null;
        const [rmin] = fila.regla?.rango || [];
        const pico = fila.tipo === 'peaking' || fila.fase === 'peaking';
        const molesta = (fila.avisos || []).some((a) => a.tipo === 'molestia');
        const ejemplo = (k, h, p) => ({ atleta: anon(at.id), nivel: at.nivel || null, ejercicio: fila.ejercicio, serie: k + 1, hizo: `${Number(h.reps)}×${Number(h.kg) || '–'}`, propone: `${p.reps ?? '–'}×${p.kg ?? '–'}`, rango: fila.regla?.rango || null, tipo: fila.tipo, motivo: fila.motivo });
        let sube = false;
        prop.forEach((p, k) => {
          const h = hechas[k + 1];
          if (!h) return;
          const hkg = Number(h.kg) || 0, hreps = Number(h.reps) || 0;
          if (p.kg != null && hkg > 0) {
            c.seriesConKilos++;
            const dkg = p.kg - hkg;
            if (dkg > 0.01) sube = true;
            if (salto && dkg > salto + 0.01) c.masDeUnSalto.push(ejemplo(k, h, p));
            if (dkg / hkg > 0.1 + 1e-9) c.subeMas10++;
          }
          if (p.reps == null) return;
          c.seriesConReps++;
          if (hreps > 0 && p.reps > hreps) sube = sube || p.kg == null || Math.abs((p.kg ?? 0) - hkg) < 0.01;
          if (hreps > 0 && p.reps > hreps + 2) c.masDe2Reps++;
          if (rmin == null || pico) return;
          if (hreps >= rmin && p.reps < rmin) {
            const pt = pautadas(pauta, k);
            if (pt != null && Number(pt) < rmin && p.reps >= Number(pt)) c.bajoSueloPautado++;   // lo pautado ya iba por debajo a propósito
            else c.bajoSuelo.push(ejemplo(k, h, p));
          }
          const pt = pautadas(pauta, k);
          const minimo = pt != null && Number(pt) < rmin ? Number(pt) : rmin;
          const quieto = p.reps <= hreps && !(p.kg != null && hkg > 0 && p.kg < hkg - 0.01);
          if (hreps < rmin && quieto) c.atascadoUnaSemana++;
          const ant = previa[k + 1];
          // (sin kilos no hay carga que bajar: ahí el motor avisa al coach de que toca una variante más fácil)
          if (hreps < minimo && ant && Number(ant.reps) < minimo && quieto) { if (hkg > 0) c.atascadoDosSemanas.push(ejemplo(k, h, p)); else c.atascadoSinCarga++; }
        });
        if (molesta) { c.filasConMolestia++; if (sube) c.subenConMolestia++; }
      }
    }
  }
}

const res = { copia: copia.exportado_en || null, porSuCuenta, confirmar, ...c, masDeUnSaltoN: c.masDeUnSalto.length, bajoSueloN: c.bajoSuelo.length, atascadoDosSemanasN: c.atascadoDosSemanas.length };
if (salida) writeFileSync(salida, JSON.stringify(res, null, 2));
console.log(`SEGURIDAD${porSuCuenta ? ' · por su cuenta (con los frenos)' : ' · con seguimiento (motor de siempre)'}${confirmar ? ' · el atleta confirma las erratas' : ''}`);
console.log(`  Semanas: ${c.semanas} · propuestas (filas): ${c.filas} · series con kilos comparables: ${c.seriesConKilos} · con repeticiones: ${c.seriesConReps}`);
if (porSuCuenta) console.log(`  Ejercicios que esperan a que el atleta confirme una posible errata: ${c.preguntas}`);
console.log(`  Más de un salto de carga sobre lo hecho: ${c.masDeUnSalto.length}`);
console.log(`  Estaba dentro del rango y baja del mínimo: ${c.bajoSuelo.length} (más ${c.bajoSueloPautado} con lo pautado ya por debajo a propósito)`);
console.log(`  Dos semanas por debajo de su mínimo sin avanzar: ${c.atascadoDosSemanas.length} (más ${c.atascadoSinCarga} sin carga que bajar, con aviso al coach)`);
console.log(`  Informativo: atascado una semana ${c.atascadoUnaSemana} · sube más de un 10 % ${c.subeMas10} · más de 2 repeticiones ${c.masDe2Reps} · con molestia en la zona ${c.filasConMolestia}, de ellas suben ${c.subenConMolestia}`);
console.log(`  Semanas con aviso para el coach: ${c.semanasCon.alguno} de ${c.semanas} (pregunta por errata ${c.semanasCon.pregunta} · molestia ${c.semanasCon.molestia} · baja un salto ${c.semanasCon.bajaRango} · sin carga que bajar ${c.semanasCon.sinCarga})`);
console.log(`  Frenos que han actuado: ${Object.entries(c.frenos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ninguno'}`);
if (nEjemplos) for (const [t, lista] of [['Más de un salto', c.masDeUnSalto], ['Baja del mínimo', c.bajoSuelo], ['Dos semanas por debajo', c.atascadoDosSemanas]]) {
  if (!lista.length) continue;
  console.log(`  ${t}:`);
  for (const e of lista.slice(0, nEjemplos)) console.log(`    ${e.ejercicio}, serie ${e.serie}: ${e.hizo} → ${e.propone} (${e.tipo}) · ${e.motivo}`);
}
