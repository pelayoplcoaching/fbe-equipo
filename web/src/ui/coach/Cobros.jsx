// Control de cobros (v0.24): en la ficha de cada atleta, solo para el coach. Lo acordado (servicio, precio al mes,
// cada cuánto paga) y sus cobros, que se apuntan a mano. En Cuenta, todos de un vistazo.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Segmentos, Siluetas, ErrorCaja, Vacio } from '../comunes.jsx';
import {
  CICLOS, NOMBRE_CICLO, ESTADOS_PAGO, NOMBRE_ESTADO_PAGO, METODOS, NOMBRE_METODO, SERVICIOS, finPeriodo, importePeriodo, siguientePeriodo,
  resumenCobros, TEXTO_ESTADO_COBRO, fmtEuros, leerEuros,
} from '../../logica/cobros.js';
import { hoyISO, fmtCorta, diasEntre } from '../../logica/fechas.js';
import { textoVisible } from '../../logica/texto.js';

const conAnio = (iso) => (iso ? `${fmtCorta(iso)} ${iso.slice(0, 4)}` : '');
const periodo = (p) => (p.periodo_desde.slice(0, 4) === p.periodo_hasta.slice(0, 4) ? `${fmtCorta(p.periodo_desde)} – ${conAnio(p.periodo_hasta)}` : `${conAnio(p.periodo_desde)} – ${conAnio(p.periodo_hasta)}`);
const CLASE_ESTADO = { pagado: 'ok', pendiente: 'aviso', retrasado: 'alerta' };
const CLASE_RESUMEN = { al_dia: 'ok', vence_pronto: 'aviso', pendiente: 'aviso', primer_cobro: 'aviso', vencido: 'aviso', retrasado: 'alerta', sin_datos: 'info' };

export function CobrosAtleta({ atleta }) {
  const { api, aviso } = useApp();
  const datos = useCarga(() => api.cobrosAtleta(atleta.id), [atleta.id]);
  const [hoja, setHoja] = useState(null); // null | { pago } (nuevo o para editar)
  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  if (!datos.datos) return <Siluetas forma="tarjetas" n={2} texto="Cargando sus cobros" />;
  const { acuerdo, pagos } = datos.datos;
  const r = resumenCobros(pagos);
  const recargar = () => datos.recargar(true);
  const ultimoMetodo = pagos.find((p) => p.metodo)?.metodo || 'transferencia';
  const nuevo = () => {
    const s = siguientePeriodo(pagos, acuerdo);
    setHoja({ pago: { atleta_id: atleta.id, periodo_desde: s.desde, periodo_hasta: s.hasta, importe: s.importe, estado: 'pagado', fecha_pago: hoyISO(), metodo: ultimoMetodo, nota: '' } });
  };
  return (
    <div class="pila cobros">
      <p class="peq secundario cobros-privado"><Icono n="candado" /> {atleta.nombre.split(' ')[0]} solo ve cómo va (hasta cuándo tiene pagado y si debe algo), en Hoy y en su perfil; nunca el precio, las notas ni esta lista.</p>
      <section class="panel panel-pad pila-s" aria-labelledby="cobros-resumen">
        <div class="separa">
          <h2 id="cobros-resumen" class="h-panel">Cómo va</h2>
          <span class={`chip ${CLASE_RESUMEN[r.estado]}`}>{TEXTO_ESTADO_COBRO[r.estado]}</span>
        </div>
        <dl class="cobros-cifras">
          <div><dt>Pagado hasta</dt><dd class="num">{r.pagadoHasta ? conAnio(r.pagadoHasta) : '—'}</dd></div>
          <div><dt>Debe</dt><dd class="num">{r.debe ? fmtEuros(r.debe) : '0 €'}</dd></div>
          <div><dt>Por periodo</dt><dd class="num">{importePeriodo(acuerdo) != null ? `${fmtEuros(importePeriodo(acuerdo))} (${NOMBRE_CICLO[acuerdo.ciclo].toLowerCase()})` : '—'}</dd></div>
        </dl>
        <button class="btn btn-primario" style="justify-self:start" onClick={nuevo}><Icono n="mas" /> Apuntar cobro</button>
      </section>
      <Acuerdo atleta={atleta} acuerdo={acuerdo} alGuardar={recargar} />
      <section class="seccion">
        <h2>Cobros</h2>
        {!pagos.length ? (
          <div class="panel"><Vacio icono="calendario" titulo="Sin cobros apuntados">Apunta el último que te pagó (y los pendientes) para saber hasta cuándo tiene pagado. Toca un cobro para corregirlo o borrarlo.</Vacio></div>
        ) : (
          <ul class="panel lista cobros-lista">
            {pagos.map((p) => (
              <li key={p.id} class="cobro">
                <button class="cobro-abrir panel-pad" onClick={() => setHoja({ pago: p })} aria-label={`${periodo(p)}, ${fmtEuros(p.importe)}, ${NOMBRE_ESTADO_PAGO[p.estado]}. Corregir`}>
                  <span class="cobro-cab">
                    <span class="cobro-periodo">{periodo(p)}</span>
                    <span class="num cobro-importe">{fmtEuros(p.importe)}</span>
                    <span class={`chip ${CLASE_ESTADO[p.estado]}`}>{NOMBRE_ESTADO_PAGO[p.estado]}</span>
                  </span>
                  {(p.fecha_pago || p.metodo || p.nota) && <span class="mini terciario">{[p.estado === 'pagado' && p.fecha_pago && `Pagado el ${conAnio(p.fecha_pago)}`, p.metodo && NOMBRE_METODO[p.metodo], p.nota].filter(Boolean).join(' · ')}</span>}
                </button>
                {p.estado !== 'pagado' && (
                  <div class="cobro-acciones">
                    <button class="btn btn-peq" onClick={async () => { try { await api.marcarPagado(p.id, { metodo: p.metodo || ultimoMetodo }); aviso('Marcado como pagado hoy'); recargar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar pagado hoy</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {hoja && <HojaPago inicial={hoja.pago} acuerdo={acuerdo} alCerrar={() => setHoja(null)} alGuardar={() => { setHoja(null); recargar(); }} />}
    </div>
  );
}

// Lo acordado con el atleta: servicio, precio al mes, cada cuánto paga y desde cuándo
function Acuerdo({ atleta, acuerdo, alGuardar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState(() => ({ servicio: acuerdo?.servicio || '', precio: acuerdo?.precio_mes != null ? String(acuerdo.precio_mes).replace('.', ',') : '', ciclo: acuerdo?.ciclo || 'mensual', desde: acuerdo?.desde || '', nota: acuerdo?.nota || '' }));
  const [ocupado, setOcupado] = useState(false);
  const precio = leerEuros(f.precio);
  const elegirServicio = (v) => {
    const s = SERVICIOS.find(([n]) => n === v);
    setF({ ...f, servicio: v, precio: f.precio === '' && s ? String(s[1]) : f.precio });
  };
  return (
    <form class="panel panel-pad pila" aria-labelledby="cobros-acuerdo" onSubmit={async (e) => {
      e.preventDefault();
      if (precio != null && (Number.isNaN(precio) || precio < 0 || precio > 10000)) { aviso('Escribe el precio al mes en euros (hasta 10.000), por ejemplo 75 o 74,50', 'error'); return; }
      setOcupado(true);
      try { await api.guardarAcuerdoCobro(atleta.id, { servicio: f.servicio, precio_mes: precio, ciclo: f.ciclo, desde: f.desde || null, nota: f.nota }); aviso('Guardado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } finally { setOcupado(false); }
    }}>
      <h2 id="cobros-acuerdo" class="h-panel">Lo acordado</h2>
      <div class="rejilla-campos">
        <div class="campo"><label for="co-servicio">Servicio</label>
          <input id="co-servicio" class="entrada" list="co-servicios" maxLength={60} value={f.servicio} onInput={(e) => elegirServicio(e.currentTarget.value)} placeholder="Performance" />
          <datalist id="co-servicios">{SERVICIOS.map(([n, p]) => <option key={n} value={n}>{`${p} €/mes de lista`}</option>)}</datalist></div>
        <div class="campo"><label for="co-precio">Precio al mes (€)</label>
          <input id="co-precio" class="entrada" inputMode="decimal" value={f.precio} onInput={(e) => setF({ ...f, precio: e.currentTarget.value })} placeholder="75" />
          <span class="ayuda">Lo que paga de verdad, con su descuento.</span></div>
        <div class="campo"><label for="co-desde">Paga desde</label>
          <input id="co-desde" class="entrada" type="date" value={f.desde} onInput={(e) => setF({ ...f, desde: e.currentTarget.value })} />
          <span class="ayuda">Sus periodos empiezan ese día del mes.</span></div>
      </div>
      <div class="campo"><span class="etq">Paga cada</span>
        <Segmentos etiqueta="Paga cada" valor={f.ciclo} alCambiar={(v) => v && setF({ ...f, ciclo: v })} opciones={CICLOS.map(([v, t]) => [v, t])} /></div>
      <div class="campo"><label for="co-nota">Nota</label>
        <input id="co-nota" class="entrada" maxLength={500} value={f.nota} onInput={(e) => setF({ ...f, nota: e.currentTarget.value })} placeholder="Paga junto con su pareja; −50 % mientras dure la lesión…" /></div>
      <button class="btn" style="justify-self:start" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar lo acordado'}</button>
    </form>
  );
}

// Apuntar o corregir un cobro
function HojaPago({ inicial, acuerdo, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState(() => ({ ...inicial, importe: inicial.importe != null ? String(inicial.importe).replace('.', ',') : '', nota: inicial.nota || '' }));
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  return (
    <Hoja titulo={inicial.id ? 'Corregir cobro' : 'Apuntar cobro'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={async (e) => {
        e.preventDefault();
        const importe = leerEuros(f.importe);
        if (importe == null || Number.isNaN(importe) || importe < 0 || importe > 100000) { aviso('Escribe el importe en euros, por ejemplo 225, 1.308 o 74,50', 'error'); return; }
        if (!f.periodo_desde || !f.periodo_hasta || f.periodo_hasta < f.periodo_desde) { aviso('El periodo tiene que acabar después de empezar', 'error'); return; }
        if (diasEntre(f.periodo_desde, f.periodo_hasta) > 400) { aviso('Un periodo no puede pasar de un año (revisa «Hasta»)', 'error'); return; }
        if (f.nota && !textoVisible(f.nota)) { aviso('La nota está vacía', 'error'); return; }
        setOcupado(true);
        try { await api.guardarPago({ ...f, importe }); aviso(inicial.id ? 'Cobro corregido' : 'Cobro apuntado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } finally { setOcupado(false); }
      }}>
        <div class="rejilla-campos">
          <div class="campo"><label for="pg-desde">Periodo desde</label>
            <input id="pg-desde" class="entrada" type="date" required value={f.periodo_desde} onInput={(e) => {
              const v = e.currentTarget.value;
              setF({ ...f, periodo_desde: v, periodo_hasta: v && !inicial.id ? finPeriodo(v, acuerdo?.ciclo || 'mensual') : f.periodo_hasta });
            }} /></div>
          <div class="campo"><label for="pg-hasta">Hasta</label>
            <input id="pg-hasta" class="entrada" type="date" required value={f.periodo_hasta} onInput={cambiar('periodo_hasta')} /></div>
          <div class="campo"><label for="pg-importe">Importe (€)</label>
            <input id="pg-importe" class="entrada" inputMode="decimal" required value={f.importe} onInput={cambiar('importe')} /></div>
        </div>
        <div class="campo"><span class="etq">Estado</span>
          <Segmentos etiqueta="Estado" valor={f.estado} alCambiar={(v) => v && setF({ ...f, estado: v, fecha_pago: v === 'pagado' ? f.fecha_pago || hoyISO() : f.fecha_pago })} opciones={ESTADOS_PAGO} /></div>
        {f.estado === 'pagado' && (
          <div class="campo"><label for="pg-fecha">Fecha de pago</label>
            <input id="pg-fecha" class="entrada" type="date" required value={f.fecha_pago || ''} onInput={cambiar('fecha_pago')} /></div>
        )}
        <div class="campo"><label for="pg-metodo">Método</label>
          <select id="pg-metodo" class="selector" value={f.metodo || ''} onChange={(e) => setF({ ...f, metodo: e.currentTarget.value || null })}>
            <option value="">Sin indicar</option>{METODOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></div>
        <div class="campo"><label for="pg-nota">Nota</label>
          <input id="pg-nota" class="entrada" maxLength={300} value={f.nota} onInput={cambiar('nota')} placeholder="Junto con…, no hizo este mes…" /></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Guardando…' : inicial.id ? 'Guardar cambios' : 'Apuntar cobro'}</button>
        {inicial.id && (borrar ? (
          <div class="fila-envolver">
            <span class="peq">¿Borrar este cobro? No se puede deshacer.</span>
            <button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>No</button>
            <button type="button" class="btn btn-peq btn-peligro" onClick={async () => { try { await api.borrarPago(inicial.id); aviso('Cobro borrado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } }}>Borrar</button>
          </div>
        ) : <button type="button" class="btn-texto btn-peligro" style="justify-self:start" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar este cobro</button>)}
      </form>
    </Hoja>
  );
}

// Cuenta → Cobros: todos de un vistazo (lo cobrado este mes y quién necesita algo)
export function CobrosTodos({ abrirAtleta }) {
  const { api } = useApp();
  const datos = useCarga(() => api.cobrosTodos().catch((e) => ({ error: e })), []);
  const d = datos.datos;
  if (!d) return null;
  if (d.error) return <section class="seccion"><h2>Cobros</h2><div class="panel panel-pad peq secundario">{d.error.message}</div></section>;
  const ORDEN = { retrasado: 0, pendiente: 1, vencido: 2, primer_cobro: 3, vence_pronto: 4, al_dia: 5, sin_datos: 6 };
  const atencion = d.filas.filter((x) => ['retrasado', 'pendiente', 'vencido', 'primer_cobro', 'vence_pronto'].includes(x.estado)).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);
  return (
    <section class="seccion" aria-labelledby="cobros-todos">
      <h2 id="cobros-todos">Cobros</h2>
      <div class="panel panel-pad pila-s">
        <dl class="cobros-cifras">
          <div><dt>Cobrado este mes</dt><dd class="num">{fmtEuros(d.cobradoMes)}</dd></div>
          <div><dt>El mes pasado</dt><dd class="num">{fmtEuros(d.cobradoMesAnterior)}</dd></div>
          <div><dt>Con cobros apuntados</dt><dd class="num">{d.filas.length}</dd></div>
        </dl>
        {!d.filas.length ? <p class="peq secundario">Aún no hay cobros: se apuntan en la ficha de cada atleta (pestaña Cobros). Solo los ves tú.</p>
          : !atencion.length ? <p class="peq secundario">Todos al día.</p> : (
            <ul class="lista cobros-atencion">
              {atencion.map((x) => (
                <li key={x.atleta.id}>
                  <button class="fila-boton" onClick={() => abrirAtleta?.(x.atleta.id, 'cobros')}>
                    <span>{x.atleta.nombre}</span>
                    <span class="mini terciario">{x.debe ? `Debe ${fmtEuros(x.debe)}` : x.pagadoHasta ? `Pagado hasta el ${conAnio(x.pagadoHasta)}` : ''}</span>
                    <span class={`chip ${CLASE_RESUMEN[x.estado]}`}>{TEXTO_ESTADO_COBRO[x.estado]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  );
}
