import { useState } from 'preact/hooks';
import { useApp, useCarga } from '../comunes.jsx';
import { InformeBloque, ListaInformes } from '../InformeBloque.jsx';
import { desdeISO } from '../../logica/fechas.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = (iso) => { const d = desdeISO(iso); return `${d.getDate()} ${MES[d.getMonth()]}`; };
const clase = (p) => (p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'medio' : 'bajo');

// Cumplimiento semana a semana (las 8 últimas acabadas o en curso, de todos sus bloques) y los informes de sus bloques
export function CumplimientoYBloques({ atletaId }) {
  const { api } = useApp();
  const res = useCarga(() => api.informes(atletaId, { salud: true }), [atletaId]);
  const [abierto, setAbierto] = useState(null);
  const informes = res.datos || [];
  const semanas = informes.flatMap((r) => r.semanas.map((w) => ({ ...w, bloque: r.bloque.numero })))
    .filter((w) => !w.futura).sort((a, b) => (a.lunes < b.lunes ? -1 : 1)).slice(-8);
  const ultimas = semanas.filter((w) => w.cumplimiento.sesiones.total > 0).slice(-4);
  const suma = (f) => ultimas.reduce((t, w) => t + f(w), 0);
  const sesH = suma((w) => w.cumplimiento.sesiones.hechas), sesT = suma((w) => w.cumplimiento.sesiones.total);
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
              <p class="peq">En las {ultimas.length === 1 ? 'última semana' : `${ultimas.length} últimas semanas`}: <b class="num">{pct(sesH, sesT)} %</b> de las sesiones, <b class="num">{pct(serH, serT) ?? '—'} %</b> de las series pautadas
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
                    <span class="mini num secundario">{c.sesiones.hechas}/{c.sesiones.total} ses.</span>
                    {c.esfuerzo.conEsfuerzo > 0 && <span class={`mini num ${c.esfuerzo.pctEncima >= 40 ? 'aviso-t' : 'terciario'}`} title="Series por encima del esfuerzo pautado">{c.esfuerzo.pctEncima} % ↑</span>}
                  </li>
                );
              })}
            </ol>
            <p class="mini terciario">Barras: series pautadas hechas de cada semana (como mucho, las pautadas de cada ejercicio). ↑: series con RPE más de medio punto por encima de lo pautado. La semana en curso solo cuenta las sesiones ya hechas.</p>
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
