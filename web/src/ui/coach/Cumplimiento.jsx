import { useState } from 'preact/hooks';
import { useApp, useCarga } from '../comunes.jsx';
import { InformeBloque, ListaInformes } from '../InformeBloque.jsx';
import { desdeISO, hoyISO, lunesDe } from '../../logica/fechas.js';
import { textoDiasSemana } from '../../logica/semana-natural.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = (iso) => { const d = desdeISO(iso); return `${d.getDate()} ${MES[d.getMonth()]}`; };
const clase = (p) => (p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'medio' : 'bajo');

// Cumplimiento semana a semana (las 8 últimas acabadas o en curso, de todos sus bloques) y los informes de sus bloques
// diasSemana (v0.53): con objetivo de días por semana (microciclos), las sesiones se miden por semanas de lunes a domingo
// frente a ese objetivo, y cada barra es un microciclo con lo que ya ha hecho de él
export function CumplimientoYBloques({ atletaId, diasSemana = null }) {
  const { api } = useApp();
  const res = useCarga(() => api.informes(atletaId, { salud: true }), [atletaId, diasSemana]);
  const nat = useCarga(() => (diasSemana ? api.constancia(atletaId).catch(() => null) : Promise.resolve(null)), [atletaId, diasSemana]);
  const [abierto, setAbierto] = useState(null);
  const informes = res.datos || [];
  const semanas = informes.flatMap((r) => r.semanas.map((w) => ({ ...w, bloque: r.bloque.numero })))
    .filter((w) => !w.futura).sort((a, b) => (a.lunes < b.lunes ? -1 : 1)).slice(-8);
  const ultimas = semanas.filter((w) => w.cumplimiento.sesiones.total > 0).slice(-4);
  const suma = (f) => ultimas.reduce((t, w) => t + f(w), 0);
  const cuatro = diasSemana && nat.datos ? (nat.datos.semanas || []).filter((w) => w.fecha_inicio < lunesDe(hoyISO())).slice(-4) : null;
  const sesH = cuatro ? cuatro.reduce((t, w) => t + Math.min(w.hechas, w.total), 0) : suma((w) => w.cumplimiento.sesiones.hechas);
  const sesT = cuatro ? cuatro.reduce((t, w) => t + w.total, 0) : suma((w) => w.cumplimiento.sesiones.total);
  const nSemanas = cuatro ? cuatro.length : ultimas.length;
  const serH = suma((w) => w.cumplimiento.series.hechas), serT = suma((w) => w.cumplimiento.series.pautadas);
  const conE = suma((w) => w.cumplimiento.esfuerzo.conEsfuerzo), enc = suma((w) => w.cumplimiento.esfuerzo.encima);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  if (res.cargando && !res.datos) return null;
  return (
    <>
      {semanas.length > 0 && (
        <section class="seccion">
          <h2>Cumplimiento</h2>
          <div class="panel panel-pad pila-s">
            {sesT > 0 && (
              <p class="peq">En las {nSemanas === 1 ? 'última semana' : `${nSemanas} últimas semanas`}{cuatro ? ` (de lunes a domingo, con su objetivo de ${textoDiasSemana(diasSemana)})` : ''}: <b class="num">{pct(sesH, sesT)} %</b> de las sesiones, <b class="num">{pct(serH, serT) ?? '—'} %</b> de las series pautadas{cuatro ? ' de las sesiones que hizo' : ''}
                {conE > 0 ? <>, y <b class="num">{pct(enc, conE)} %</b> de las series por encima del esfuerzo pautado</> : ''}.</p>
            )}
            <ol class="cumple-semanas" aria-label="Series pautadas hechas por semana">
              {semanas.map((w) => {
                const c = w.cumplimiento, p = c.series.pct;
                return (
                  <li key={w.lunes} class={clase(p)}>
                    <span class="num mini">{p != null ? `${p} %` : '—'}</span>
                    <span class="cumple-barra" aria-hidden="true"><i style={{ height: `${p ?? 0}%` }} /></span>
                    <strong class="mini">B{w.bloque} S{w.numero}</strong>
                    <span class="mini terciario">{corta(w.lunes)}</span>
                    <span class="mini num secundario">{diasSemana ? `${w.sesiones.hechas}/${w.sesiones.total}` : `${c.sesiones.hechas}/${c.sesiones.total}`} ses.</span>
                    {c.esfuerzo.conEsfuerzo > 0 && <span class={`mini num ${c.esfuerzo.pctEncima >= 40 ? 'aviso-t' : 'terciario'}`} title="Series por encima del esfuerzo pautado">{c.esfuerzo.pctEncima} % ↑</span>}
                  </li>
                );
              })}
            </ol>
            <p class="mini terciario">{diasSemana
              ? `Va por microciclos (${textoDiasSemana(diasSemana)}): cada barra es una semana de su programa, con las series pautadas hechas de las sesiones que ya ha hecho de ella (como mucho, las pautadas de cada ejercicio). ↑: series con RPE más de medio punto por encima de lo pautado.`
              : 'Barras: series pautadas hechas de cada semana (como mucho, las pautadas de cada ejercicio). ↑: series con RPE más de medio punto por encima de lo pautado. La semana en curso solo cuenta las sesiones ya hechas.'}</p>
          </div>
        </section>
      )}
      <section class="seccion">
        <h2>Informes de sus bloques</h2>
        <ListaInformes informes={informes} alAbrir={setAbierto} coach />
      </section>
      {abierto && <InformeBloque informe={abierto} salud coach alCerrar={() => setAbierto(null)} />}
    </>
  );
}
