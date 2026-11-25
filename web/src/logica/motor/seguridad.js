// Repaso de seguridad de «Programar según FBE» sobre una copia de la app (la completa del panel o, para FBE Esencial, la de
// quienes van por su cuenta: api-esencial.js, copiaEsencial). Recorre las mismas parejas de semanas que la prueba en sombra
// y mira cada serie que propone el motor frente a lo que hizo el atleta en ella. Lo usan scripts/seguridad-motor.mjs (la
// línea de órdenes, sin cambios) y, desde la v0.249, el panel de FBE Esencial. Sin nombres: los ejemplos dicen «Atleta N».
//   repasoSeguridad(copia, { porSuCuenta, confirmar }) → los recuentos (ver scripts/seguridad-motor.mjs)
import { proponerSemana } from './proponer.js';
import { entradaDesdeBloque } from './adaptador.js';
import { leerGuardadas } from './guardadas.js';
import { seriesPautadas } from './sombra.js';
import { tieneDetalle } from '../calculos.js';
import { sumarDias } from '../fechas.js';

export function repasoSeguridad(copia = {}, { porSuCuenta = false, confirmar = false } = {}) {
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
  return c;
}
// Lo que importa, en una cifra: lo que se sale de las reglas (más de un salto, baja del mínimo estando en rango y dos
// semanas por debajo sin avanzar). Para FBE Esencial tiene que salir a cero.
export const fueraDeRegla = (c) => (c?.masDeUnSalto?.length || 0) + (c?.bajoSuelo?.length || 0) + (c?.atascadoDosSemanas?.length || 0);
