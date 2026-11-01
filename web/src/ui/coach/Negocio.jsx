import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Siluetas, ErrorCaja, useAncho, usePreferencia } from '../comunes.jsx';
import { Interruptor } from '../Ajustes.jsx';
import { euros, OCULTO } from '../../logica/negocio.js';
import { fmtConDia } from '../../logica/fechas.js';

const corto = (nombre) => nombre.slice(0, 3);

// Cuenta → Negocio (v0.48, solo tú): una línea y el panel entero en una hoja
export function SeccionNegocio({ abrirAtleta }) {
  const { api } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [oculto] = usePreferencia('fbe-negocio-oculto', false);
  const d = useCarga(() => api.panelNegocio().catch((e) => ({ error: e })), []);
  const x = d.datos;
  return (
    <section class="seccion" aria-labelledby="negocio">
      <h2 id="negocio">Negocio</h2>
      <div class="panel panel-pad pila-s">
        {!x ? <Siluetas forma="filas" n={1} texto="Cargando tu negocio" /> : x.error ? <p class="peq secundario">{x.error.message}</p> : (
          <>
            <p class="peq">{x.activos} {x.activos === 1 ? 'atleta activo' : 'atletas activos'} · {oculto ? OCULTO : euros(x.mrr)} al mes · {x.renovaciones.length} {x.renovaciones.length === 1 ? 'renovación' : 'renovaciones'} en 30 días</p>
            <button class="btn" style="justify-self:start" onClick={() => setAbierto(true)}><Icono n="progreso" /> Abrir el panel de negocio</button>
          </>
        )}
      </div>
      {abierto && x && !x.error && <PanelNegocio datos={x} alCerrar={() => setAbierto(false)} abrirAtleta={(id) => { setAbierto(false); abrirAtleta?.(id, 'cobros'); }} recargar={() => d.recargar(true)} />}
    </section>
  );
}

function PanelNegocio({ datos: x, alCerrar, abrirAtleta }) {
  const [oculto, setOculto] = usePreferencia('fbe-negocio-oculto', false);
  const e = (v) => euros(v, oculto);
  const maxServicio = Math.max(1, ...x.porServicio.map((s) => s.n));
  return (
    <Hoja titulo="Panel de negocio" alCerrar={alCerrar} ancho={900}>
      <div class="pila negocio">
        <ul class="lista panel"><Interruptor id="negocio-ocultar" texto="Ocultar importes" ayuda="Para enseñar esta pantalla a alguien: los euros salen como •••" valor={oculto} alCambiar={setOculto} /></ul>
        <dl class="cobros-cifras negocio-cifras">
          <div><dt>Atletas activos</dt><dd class="num">{x.activos}</dd></div>
          <div><dt>Al mes (lo acordado)</dt><dd class="num">{e(x.mrr)}</dd></div>
          <div><dt>Cobrado en 12 meses</dt><dd class="num">{e(x.cobrado12)}</dd></div>
          <div><dt>Constancia media</dt><dd class="num">{x.constanciaMedia == null ? '—' : `${x.constanciaMedia} %`}</dd></div>
        </dl>
        <section class="pila-s">
          <h3 class="sub-seccion">Cobrado y previsto, mes a mes</h3>
          <Barras meses={x.meses} series={[['previsto', 'Previsto', 'previsto'], ['cobrado', 'Cobrado', '']]} oculto={oculto} formato={e}
            etiqueta={`Últimos 12 meses: ${x.meses.map((m) => `${m.nombre}, cobrado ${e(m.cobrado)} de ${e(m.previsto)} previsto`).join('; ')}`} />
          <p class="mini terciario">Previsto: lo de los cobros apuntados cuyo periodo empieza ese mes. Cobrado: lo pagado ese mes (por fecha de pago).</p>
        </section>
        <section class="pila-s">
          <h3 class="sub-seccion">Altas y bajas</h3>
          <Barras meses={x.meses} series={[['altas', 'Altas', 'altas'], ['bajas', 'Bajas', 'bajas']]} formato={(v) => String(v)}
            etiqueta={`Últimos 12 meses: ${x.altas12} altas y ${x.bajas12} bajas. ${x.meses.filter((m) => m.altas || m.bajas).map((m) => `${m.nombre}: ${m.altas} altas, ${m.bajas} bajas`).join('; ')}`} />
          <p class="mini terciario">{x.altas12} {x.altas12 === 1 ? 'alta' : 'altas'} y {x.bajas12} {x.bajas12 === 1 ? 'baja' : 'bajas'} en 12 meses (las altas, por el día del alta; las bajas, por el día en que pasaron a «baja»){x.bajasSinFecha ? `. ${x.bajasSinFecha} de baja desde antes de la v0.48, sin fecha` : ''}.</p>
        </section>
        <div class="negocio-dos">
          <section class="pila-s">
            <h3 class="sub-seccion">Activos por servicio</h3>
            <div class="barras">
              {x.porServicio.map((s) => (
                <div class="barra-fila" key={s.nombre}>
                  <span>{s.nombre}</span>
                  <span class="pista" role="img" aria-label={`${s.nombre}: ${s.n}`}><span class="relleno" style={{ width: `${(s.n / maxServicio) * 100}%` }} /></span>
                  <span class="num peq">{s.n}</span>
                </div>
              ))}
            </div>
            <p class="mini terciario">{x.porTipo.map((t) => `${t.nombre}: ${t.n}`).join(' · ')}</p>
          </section>
          <section class="pila-s">
            <h3 class="sub-seccion">Renuevan en 30 días</h3>
            {!x.renovaciones.length ? <p class="peq secundario">Nadie acaba su periodo en los próximos 30 días.</p> : (
              <ul class="lista panel">
                {x.renovaciones.map((r) => (
                  <li key={r.atleta.id}>
                    <button class="fila-boton" onClick={() => abrirAtleta(r.atleta.id)}>
                      <span>{r.atleta.nombre}</span>
                      <span class="mini terciario">{r.apuntado ? 'Cobro apuntado' : 'Acaba su periodo'} el {fmtConDia(r.fecha)}{r.servicio ? ` · ${r.servicio}` : ''}</span>
                      <span class="num peq">{r.importe != null ? e(r.importe) : '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {x.renovaciones.length > 0 && <p class="mini terciario">En total, {e(x.renuevan30)}.</p>}
          </section>
        </div>
        <p class="mini terciario">Sale de los cobros que apuntas en cada ficha y solo lo ves tú: ningún atleta puede leer nada de esto. La constancia media es el % de sesiones hechas de lo pautado en las 4 últimas semanas, de {x.conConstancia} {x.conConstancia === 1 ? 'atleta' : 'atletas'} con entrenamiento.</p>
      </div>
    </Hoja>
  );
}

// Barras por mes (dos por mes), con el estilo de la carga de entrenamiento
function Barras({ meses, series, etiqueta, oculto = false, formato }) {
  const [W, ref] = useAncho();
  const H = 170, izq = 8, der = 8, arr = 18, abj = 22;
  const max = Math.max(1, ...meses.flatMap((m) => series.map(([k]) => m[k] || 0)));
  const ancho = (W - izq - der) / meses.length;
  const Y = (v) => arr + (1 - v / max) * (H - arr - abj);
  const bw = Math.max(3, (ancho * 0.72) / series.length);
  return (
    <div class="panel panel-pad">
      <svg class="grafica grafica-carga grafica-negocio" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etiqueta}>
        {meses.map((m, i) => {
          const x0 = izq + i * ancho + ancho * 0.14;
          return (
            <g key={m.mes}>
              {series.map(([k, , clase], j) => (m[k] > 0 ? <rect key={k} class={`barra ${clase}`} x={x0 + j * bw} y={Y(m[k])} width={bw - 1} height={H - abj - Y(m[k])} rx="2" /> : null))}
              {!oculto && i === meses.length - 1 && m[series[series.length - 1][0]] > 0 && <text class="valor-barra" x={x0 + bw * series.length / 2} y={Y(Math.max(...series.map(([k]) => m[k] || 0))) - 5} text-anchor="middle">{formato(m[series[series.length - 1][0]])}</text>}
              {(i % 3 === 2 || i === meses.length - 1) && <text x={x0 + (bw * series.length) / 2} y={H - 5} text-anchor="middle">{corto(m.nombre)}</text>}
            </g>
          );
        })}
      </svg>
      <span class="mini terciario leyenda-negocio">{series.map(([k, t, clase]) => <span key={k}><span class={`leyenda-caja ${clase}`} aria-hidden="true" />{t}</span>)}</span>
    </div>
  );
}
