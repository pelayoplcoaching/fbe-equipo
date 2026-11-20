// (v0.198) Piezas de la lista de Atletas a tu gusto: lo tuyo de cada atleta (fijado, etiquetas, nota) y cómo ves la
// lista (columnas, orden, vistas), en la base con la 085 o en este aparato sin ella; lo que no trae el resumen
// (mensajes sin leer, la semana que viene, su teléfono); y las hojas: columnas, filtros, vistas, varios a la vez y teclas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, usePreferencia, Hoja, Icono, Segmentos, useUnaVez } from '../comunes.jsx';
import { lunesDe, hoyISO, fechaMadrid } from '../../logica/fechas.js';
import { mensajeParaAlerta } from '../../logica/cierre.js';
import { TIPOS_TAREA } from '../../logica/tareas.js';
import { ChatRapido } from './RevisionTodo.jsx';
import { HojaVoz } from './RevisarExtra.jsx';
import { NIVELES, SERVICIOS } from '../../logica/nivel.js';
import { NOMBRE_FOCO, num, signo, ESCALAS } from '../../logica/calculos.js';
import { hace, fmtCorta } from '../../logica/fechas.js';
import { enlaceWhatsApp } from '../../logica/integraciones.js';
import {
  COLUMNAS, TITULO_COLUMNA, moverColumna, limpiarColumnas, MARCAS, limpiarFiltros, FILTROS_VACIOS, limpiarPanelAtleta, limpiarAjustesPanel,
  AJUSTES_PANEL, etiquetasUsadas, colorEtiqueta, COLORES_ETIQUETA, limpiarEtiqueta, MAX_NOTA, MAX_ETIQUETAS, conNombre, guardarVista, quitarVista,
  proximaDe, TEXTO_PROXIMA_CORTO, checkinAlDia, diasSinEntrenar, MAX_VISTAS,
  proximoHito, textoHito, textoContacto, textoRecordatorio, MAX_RECORDATORIO, limpiarUmbrales, UMBRALES, CAMPOS_TARJETA, limpiarTarjeta, rellenarVarios, HUECOS_VARIOS,
} from '../../logica/panel-atletas.js';

// (v0.199) la fecha de Madrid de un instante
const fechaMadridDe = (iso) => { try { return fechaMadrid(new Date(iso)); } catch { return String(iso).slice(0, 10); } };

// ---------------------------------------------------------------- lo tuyo: en la base (085) o en este aparato
// Lo último que tocaste (por cuenta), para que al volver de una ficha la lista esté como la dejaste aunque la base aún
// no haya contestado (o aunque el guardado de los ajustes, que espera medio segundo, no hubiera salido todavía)
const memPanel = { uid: null, atl: null, aj: null };
export function usePanelCoach() {
  const { api, aviso } = useApp();
  if (memPanel.uid !== api.uid()) { memPanel.uid = api.uid(); memPanel.atl = null; memPanel.aj = null; }
  const [localAtl, setLocalAtl] = usePreferencia('fbe-panel-atletas', {});
  const [localAj, setLocalAj] = usePreferencia('fbe-panel-ajustes', null);
  const remoto = useCarga(() => api.panelAtletas().catch(() => null), [], { recuerdo: `panel085:${api.uid()}` });
  const enBase = !!remoto.datos && typeof remoto.datos === 'object';
  const [atl, setAtlE] = useState(memPanel.atl);
  const [aj, setAjE] = useState(memPanel.aj);
  const setAtl = (x) => { memPanel.atl = x; setAtlE(x); };
  const setAj = (x) => { memPanel.aj = x; setAjE(x); };
  // Lo que estaba en este aparato pasa a la base (una vez)
  const subido = useRef(false);
  useEffect(() => {
    if (!enBase || subido.current) return;
    subido.current = true;
    const nuevos = Object.entries(localAtl || {}).filter(([id]) => !remoto.datos.atletas[id]);
    if (nuevos.length) {
      setAtl({ ...Object.fromEntries(nuevos), ...remoto.datos.atletas });
      (async () => { for (const [id, v] of nuevos) await api.guardarPanelAtleta(id, v).catch(() => {}); })();
      setLocalAtl({});
    }
    if (localAj && !remoto.datos.ajustes?.vistas?.length && JSON.stringify(remoto.datos.ajustes) === JSON.stringify(limpiarAjustesPanel({}))) {
      setAj(limpiarAjustesPanel(localAj));
      api.guardarPanelAjustes(localAj).catch(() => {});
    }
  }, [remoto.datos]);
  const panel = atl || (enBase ? remoto.datos.atletas : localAtl || {});
  const ajustes = aj || (enBase ? remoto.datos.ajustes : limpiarAjustesPanel(localAj || AJUSTES_PANEL));
  const refP = useRef(panel); refP.current = panel;
  const refA = useRef(ajustes); refA.current = ajustes;
  // Varios a la vez: { id: fila o null }
  const guardarVarios = async (cambios) => {
    const nuevo = { ...refP.current };
    for (const [id, f] of Object.entries(cambios)) { const l = limpiarPanelAtleta(f); if (l) nuevo[id] = l; else delete nuevo[id]; }
    const antes = refP.current;
    setAtl(nuevo); refP.current = nuevo;
    if (!enBase) { setLocalAtl(nuevo); return true; }
    try { for (const [id, f] of Object.entries(cambios)) await api.guardarPanelAtleta(id, f); return true; }
    catch (e) { setAtl(antes); aviso(e?.message || 'No se ha podido guardar', 'error'); return false; }
  };
  const guardarAtleta = (id, f) => guardarVarios({ [id]: f });
  const tGuardar = useRef(null);
  const guardarAjustes = (nuevo) => {
    const l = limpiarAjustesPanel(nuevo);
    setAj(l); refA.current = l;
    if (!enBase) { setLocalAj(l); return; }
    // (lo que se toca seguido, como el orden, se guarda una vez)
    clearTimeout(tGuardar.current);
    tGuardar.current = setTimeout(() => { tGuardar.current = null; api.guardarPanelAjustes(refA.current).catch((e) => aviso(e?.message || 'No se han podido guardar tus ajustes de la lista', 'error')); }, 500);
  };
  // (al salir de la lista con un guardado pendiente, por ejemplo al abrir una ficha justo después de cambiar el orden, sale ya)
  useEffect(() => () => {
    if (!tGuardar.current) return;
    clearTimeout(tGuardar.current);
    tGuardar.current = null;
    api.guardarPanelAjustes(refA.current).catch(() => {});
  }, []);
  return { panel, ajustes, enBase, guardarAtleta, guardarVarios, guardarAjustes, listo: !remoto.cargando || !!remoto.datos };
}

// ---------------------------------------------------------------- lo que no trae el resumen
export function useExtrasPanel(lista, { conProgreso = false } = {}) {
  const { api } = useApp();
  const hoy = hoyISO();
  const conv = useCarga(() => api.conversaciones().catch(() => []), [], { recuerdo: `panel-conv:${api.uid()}` });
  // (v0.199) hoy toca, los hitos y, solo si lo miras (columna, filtro o tarjeta), el semáforo de progreso
  const claveSem = (lista || []).filter((r) => r.semana).map((r) => `${r.atleta_id}:${r.semana.id}`).join(',');
  const hoyT = useCarga(() => (claveSem ? api.hoyTocaEquipo((lista || []).filter((r) => r.semana).map((r) => ({ atleta_id: r.atleta_id, semana_id: r.semana.id })), hoy).catch(() => ({})) : Promise.resolve({})), [claveSem], { recuerdo: `panel-hoy:${api.uid()}:${hoy}:${claveSem}` });
  const ids = (lista || []).filter((r) => r.estado !== 'baja').map((r) => r.atleta_id);
  const hit = useCarga(() => (ids.length ? api.hitosEquipo(ids, hoy).catch(() => null) : Promise.resolve(null)), [ids.join(',')], { recuerdo: `panel-hitos:${api.uid()}:${hoy}:${ids.length}` });
  const activos = (lista || []).filter((r) => r.estado === 'activo');
  const claveProg = conProgreso ? activos.map((r) => r.atleta_id).join(',') : '';
  const prog = useCarga(() => (claveProg ? api.progresoEquipo(activos.map((r) => ({ atleta_id: r.atleta_id, bloque: r.bloque, servicio: r.servicio, nombre: r.nombre })), lunesDe(hoy), hoy).catch(() => ({})) : Promise.resolve(null)), [claveProg], { recuerdo: claveProg ? `panel-prog:${api.uid()}:${hoy}:${claveProg}` : null });
  const clave = (lista || []).filter((r) => r.bloque).map((r) => `${r.atleta_id}:${r.bloque.id}`).join(',');
  const prox = useCarga(() => (clave ? api.proximaSemanaDe((lista || []).filter((r) => r.bloque).map((r) => ({ atleta_id: r.atleta_id, bloque_id: r.bloque.id })), lunesDe(hoyISO())).catch(() => ({})) : Promise.resolve({})), [clave], { recuerdo: `panel-prox:${api.uid()}:${clave}` });
  const contactos = useCarga(() => api.contactos().catch(() => null), [], { recuerdo: `contactos:${api.uid()}:panel` });
  const sinLeer = {}, contacto = {};
  for (const c of conv.datos || []) {
    if (c.sinLeer) sinLeer[c.atleta.id] = c.sinLeer;
    if (c.ultimo?.creado_en) contacto[c.atleta.id] = { fecha: fechaMadridDe(c.ultimo.creado_en), instante: c.ultimo.creado_en, autor: c.ultimo.autor };
  }
  const hitos = {};
  if (hit.datos) for (const r of lista || []) { const h = proximoHito(r, { cumple: hit.datos.cumples[r.atleta_id] || null, carreras: hit.datos.carreras[r.atleta_id] || [] }, hoy); if (h) hitos[r.atleta_id] = h; }
  return { sinLeer, contacto, hitos, hoy: hoyT.datos || {}, progreso: prog.datos || {}, cargandoProgreso: conProgreso && prog.cargando && !prog.datos,
    proxima: prox.datos || {}, telefonos: contactos.datos || {}, cargando: conv.cargando && !conv.datos };
}

// ---------------------------------------------------------------- etiquetas
export function Etiquetas({ etiquetas = [], colores = {}, quitar = null }) {
  if (!etiquetas.length) return null;
  return (
    <span class="etiquetas-atleta">
      {etiquetas.map((e) => (
        <span key={e} class="chip-etiqueta" data-color={colorEtiqueta(e, colores)}>
          {e}
          {quitar && <button type="button" class="etq-quitar" onClick={(ev) => { ev.stopPropagation(); quitar(e); }} aria-label={`Quitar la etiqueta ${e}`}><Icono n="cerrar" width="12" height="12" /></button>}
        </span>
      ))}
    </span>
  );
}

// Poner una etiqueta: escribe o elige una de las que ya usas
function PonerEtiqueta({ usadas = [], tiene = [], alPoner, id }) {
  const [t, setT] = useState('');
  const sugeridas = usadas.filter((u) => !tiene.some((x) => x.toLowerCase() === u.toLowerCase())).slice(0, 8);
  const poner = (e) => { const l = limpiarEtiqueta(e); if (!l) return; alPoner(l); setT(''); };
  return (
    <div class="pila-xs">
      <form class="fila-envolver poner-etiqueta" onSubmit={(e) => { e.preventDefault(); poner(t); }}>
        <label class="sr" for={`etq-${id}`}>Etiqueta nueva</label>
        <input id={`etq-${id}`} class="entrada entrada-lista etq-entrada" maxLength={24} value={t} placeholder="Etiqueta nueva" onInput={(e) => setT(e.currentTarget.value)} disabled={tiene.length >= MAX_ETIQUETAS} />
        <button type="submit" class="btn btn-peq" disabled={!t.trim() || tiene.length >= MAX_ETIQUETAS}>Poner</button>
      </form>
      {sugeridas.length > 0 && (
        <div class="fila-envolver" role="group" aria-label="Las que ya usas">
          {sugeridas.map((s) => <button key={s} type="button" class="btn-texto mini" onClick={() => poner(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- desplegado: lo suyo de un vistazo y lo tuyo
const MOLESTIA = ['Sin dolor', 'Leve', 'Moderada', 'Grave'];
export function DetalleAtleta({ r, extra, fila, colores, usadas, alGuardar, hoy, id, acciones = null, telefono = null, recordatorio = null, alRecordatorio = null }) {
  const p = fila || { fijado: false, etiquetas: [], nota: null };
  const [nota, setNota] = useState(p.nota || '');
  useEffect(() => { setNota(p.nota || ''); }, [p.nota]);
  const [recF, setRecF] = useState(recordatorio?.fecha || hoy);
  const [recT, setRecT] = useState(recordatorio?.texto || '');
  useEffect(() => { setRecF(recordatorio?.fecha || hoy); setRecT(recordatorio?.texto || ''); }, [recordatorio?.fecha, recordatorio?.texto]);
  const [ocupado, una] = useUnaVez();
  const guardar = (cambio) => una(() => alGuardar({ ...p, ...cambio }));
  const prox = proximaDe(r, extra);
  const sinEntrenar = diasSinEntrenar(r, hoy);
  const h = extra.hoy?.[r.atleta_id];
  const prog = extra.progreso?.[r.atleta_id];
  const datos = [
    ['Último check-in', r.checkin ? `${checkinAlDia(r, hoy) ? 'Al día' : 'Atrasado'} (semana del ${fmtCorta(r.checkin.semana)})` : 'Ninguno'],
    ['Sueño, energía, motivación', r.checkin ? [r.checkin.horas_sueno ? `${r.checkin.horas_sueno.replace('-', '–')} h` : '—', r.checkin.energia ? ESCALAS.energia[r.checkin.energia - 1] : '—', r.checkin.motivacion ? ESCALAS.motivacion[r.checkin.motivacion - 1] : '—'].join(' · ') : '—'],
    ['Molestias', r.maxMolestia ? MOLESTIA[r.maxMolestia] : 'Sin dolor'],
    ['Último entreno', sinEntrenar == null ? 'Nunca' : sinEntrenar === 0 ? 'Hoy' : sinEntrenar === 1 ? 'Ayer' : `Hace ${sinEntrenar} días`],
    ['Hoy toca', h ? `${h.nombre}${h.hecha ? ' (hecha)' : ''}` : 'Nada previsto'],
    ['Peso', r.peso ? `${num(r.peso.kg)} kg${r.peso.ritmo ? ` (${signo(r.peso.ritmo.kgSemana, 2)}/sem)` : ''}` : '—'],
    ['Cumplido (4 semanas)', r.cumplimiento?.series?.pct != null ? `${r.cumplimiento.series.pct} % (${r.cumplimiento.series.hechas} de ${r.cumplimiento.series.pautadas} series)` : '—'],
    ['Hábitos', r.habitos?.pct != null ? `${r.habitos.pct} % la última semana` : '—'],
    ['Semana que viene', prox ? TEXTO_PROXIMA_CORTO[prox] : '—'],
    ['Último contacto', textoContacto(extra.contacto?.[r.atleta_id], hoy)],
    ['Próximo hito', textoHito(extra.hitos?.[r.atleta_id]) || 'Nada en dos semanas'],
    ...(prog ? [['Progreso', prog.frase || '—']] : []),
  ];
  const primer = r.nombre.split(' ')[0];
  return (
    <div class="detalle-atleta pila-s" id={id}>
      <dl class="detalle-datos">{datos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {acciones && (
        <div class="fila-envolver detalle-ir">
          {r.estado !== 'invitado' && <button type="button" class="btn btn-peq" onClick={() => acciones.chat(r)}><Icono n="mensaje" /> Chat</button>}
          {r.estado !== 'invitado' && <button type="button" class="btn btn-peq" onClick={() => acciones.voz(r)}><Icono n="micro" /> Nota de voz</button>}
          {r.servicio !== 'nutricion' && <button type="button" class="btn btn-peq" onClick={() => acciones.abrir(r.atleta_id, 'programa')}><Icono n="calendario" /> Su programa</button>}
          <button type="button" class="btn btn-peq" onClick={() => acciones.abrir(r.atleta_id, 'seguimiento')}><Icono n="checkin" /> Seguimiento</button>
          {telefono && <a class="btn btn-peq" href={enlaceWhatsApp(telefono, '')} target="_blank" rel="noopener"><Icono n="enviar" /> WhatsApp</a>}
          {r.estado === 'invitado' && <button type="button" class="btn btn-peq" onClick={() => acciones.codigo(r)}><Icono n="enviar" /> Reenviar su código</button>}
        </div>
      )}
      {r.alertas.length > 0 && <ul class="detalle-avisos mini">{r.alertas.map((a) => <li key={a.tipo} class={a.nivel}>{a.texto}</li>)}</ul>}
      <div class="detalle-tuyo pila-xs">
        <span class="mini terciario">Lo tuyo (solo lo ves tú)</span>
        <div class="fila-envolver">
          <button type="button" class="btn btn-peq" aria-pressed={p.fijado ? 'true' : 'false'} disabled={ocupado} onClick={() => guardar({ fijado: !p.fijado })}><Icono n="chincheta" /> {p.fijado ? 'Fijado arriba' : 'Fijar arriba'}</button>
        </div>
        <Etiquetas etiquetas={p.etiquetas} colores={colores} quitar={(e) => guardar({ etiquetas: p.etiquetas.filter((x) => x !== e) })} />
        <PonerEtiqueta id={`${r.atleta_id}`} usadas={usadas} tiene={p.etiquetas} alPoner={(e) => guardar({ etiquetas: [...p.etiquetas, e] })} />
        <form class="fila-envolver nota-panel" onSubmit={(e) => { e.preventDefault(); guardar({ nota }); }}>
          <label class="sr" for={`nota-${r.atleta_id}`}>Tu nota</label>
          <input id={`nota-${r.atleta_id}`} class="entrada entrada-lista nota-entrada" maxLength={MAX_NOTA} value={nota} placeholder="Una línea para ti: «Revisar rodilla»" onInput={(e) => setNota(e.currentTarget.value)} />
          <button type="submit" class="btn btn-peq" disabled={ocupado || (nota.trim() || null) === (p.nota || null)}>Guardar nota</button>
        </form>
        {alRecordatorio && (
          <form class="fila-envolver recordatorio-panel" onSubmit={(e) => { e.preventDefault(); alRecordatorio({ fecha: recF, texto: recT }); }}>
            <label class="peq secundario" for={`rec-f-${r.atleta_id}`}>Recuérdamelo el</label>
            <input id={`rec-f-${r.atleta_id}`} type="date" class="entrada entrada-lista rec-fecha" value={recF} onInput={(e) => setRecF(e.currentTarget.value)} />
            <label class="sr" for={`rec-t-${r.atleta_id}`}>Qué recordarte de {primer}</label>
            <input id={`rec-t-${r.atleta_id}`} class="entrada entrada-lista nota-entrada" maxLength={MAX_RECORDATORIO} value={recT} placeholder="Mirar su rodilla" onInput={(e) => setRecT(e.currentTarget.value)} />
            <button type="submit" class="btn btn-peq" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(recF)}>{recordatorio ? 'Cambiar recordatorio' : 'Guardar recordatorio'}</button>
            {recordatorio && <button type="button" class="btn btn-peq" onClick={() => alRecordatorio(null)}>Quitar recordatorio</button>}
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- botones rápidos
// acciones: { chat(r), voz(r), codigo(r), abrir(id, pestaña), mover(r, dir) | null }
export function AccionesRapidas({ r, acciones, telefono, abierto, alDesplegar, detalleId, clase = '', todas = true }) {
  const primer = r.nombre.split(' ')[0];
  const parar = (fn) => (e) => { e.stopPropagation(); fn(e); };
  return (
    <div class={`acciones-rapidas ${clase}`} role="group" aria-label={`Atajos de ${primer}`}>
      {r.estado !== 'invitado' && <button type="button" class="btn-icono-mini accion-chat" onClick={parar(() => acciones.chat(r))} aria-label={`Chat con ${primer}`} title="Chat"><Icono n="mensaje" /></button>}
      {todas && r.estado !== 'invitado' && <button type="button" class="btn-icono-mini accion-voz" onClick={parar(() => acciones.voz(r))} aria-label={`Nota de voz a ${primer}`} title="Nota de voz"><Icono n="micro" /></button>}
      {r.estado === 'invitado' && <button type="button" class="btn-icono-mini accion-codigo" onClick={parar(() => acciones.codigo(r))} aria-label={`Reenviar el código a ${primer}`} title="Reenviar su código"><Icono n="enviar" /></button>}
      {todas && r.servicio !== 'nutricion' && <button type="button" class="btn-icono-mini accion-programa" onClick={parar(() => acciones.abrir(r.atleta_id, 'programa'))} aria-label={`Abrir el programa de ${primer}`} title="Su programa"><Icono n="calendario" /></button>}
      {todas && <button type="button" class="btn-icono-mini accion-seguimiento" onClick={parar(() => acciones.abrir(r.atleta_id, 'seguimiento'))} aria-label={`Seguimiento de ${primer}`} title="Seguimiento"><Icono n="checkin" /></button>}
      {todas && telefono && r.estado !== 'invitado' && <a class="btn-icono-mini accion-whatsapp" href={enlaceWhatsApp(telefono, '')} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} aria-label={`WhatsApp a ${primer}`} title="WhatsApp"><Icono n="enviar" /></a>}
      {acciones.mover && <>
        <button type="button" class="btn-icono-mini accion-subir" onClick={parar(() => acciones.mover(r, -1))} aria-label={`Subir a ${primer} en tu orden`} title="Subir"><Icono n="arriba" /></button>
        <button type="button" class="btn-icono-mini accion-bajar" onClick={parar(() => acciones.mover(r, 1))} aria-label={`Bajar a ${primer} en tu orden`} title="Bajar"><Icono n="abajo" /></button>
      </>}
      <button type="button" class="btn-icono-mini accion-desplegar" aria-expanded={abierto ? 'true' : 'false'} aria-controls={detalleId} onClick={parar(alDesplegar)} aria-label={abierto ? `Plegar lo de ${primer}` : `Desplegar lo de ${primer}`} title={abierto ? 'Plegar' : 'Desplegar'}><Icono n={abierto ? 'menos' : 'mas'} /></button>
    </div>
  );
}

// ---------------------------------------------------------------- (v0.199) el chat rápido y la nota de voz, en una hoja
export function HojaChatRapido({ r, alCerrar, alChat, alEnviado }) {
  return (
    <Hoja titulo={`Chat con ${r.nombre.split(' ')[0]}`} alCerrar={alCerrar} ancho={620}>
      <ChatRapido f={{ atleta_id: r.atleta_id, nombre: r.nombre }} n={12} alChat={alChat} alEnviado={alEnviado} />
    </Hoja>
  );
}
export function HojaVozAtleta({ r, alCerrar, alEnviado }) {
  return <HojaVoz atleta={{ id: r.atleta_id, nombre: r.nombre }} alCerrar={alCerrar} alEnviado={alEnviado} />;
}

// ---------------------------------------------------------------- hojas
export function HojaColumnas({ columnas, conCobros, alCambiar, alCerrar }) {
  const visibles = columnas;
  const ocultas = COLUMNAS.filter((c) => !visibles.includes(c.id) && (conCobros || c.id !== 'pagos')).map((c) => c.id);
  return (
    <Hoja titulo="Columnas de la lista" alCerrar={alCerrar} ancho={520}>
      <div class="pila">
        <p class="peq secundario">La de «Atleta» va siempre la primera. Ordena las que ves con las flechas.</p>
        <ul class="lista-columnas">
          {visibles.filter((c) => conCobros || c !== 'pagos').map((c, i, xs) => (
            <li key={c} class="columna-fila">
              <label class="fila-check"><input type="checkbox" checked onChange={() => alCambiar(limpiarColumnas(columnas.filter((x) => x !== c)))} disabled={columnas.length <= 1} /> {TITULO_COLUMNA[c]}</label>
              <span class="fila">
                <button type="button" class="btn-icono-mini" disabled={i === 0} onClick={() => alCambiar(moverColumna(columnas, c, -1))} aria-label={`Subir ${TITULO_COLUMNA[c]}`}><Icono n="arriba" /></button>
                <button type="button" class="btn-icono-mini" disabled={i === xs.length - 1} onClick={() => alCambiar(moverColumna(columnas, c, 1))} aria-label={`Bajar ${TITULO_COLUMNA[c]}`}><Icono n="abajo" /></button>
              </span>
            </li>
          ))}
          {ocultas.map((c) => (
            <li key={c} class="columna-fila oculta">
              <label class="fila-check"><input type="checkbox" checked={false} onChange={() => alCambiar([...columnas, c])} /> {TITULO_COLUMNA[c]}</label>
            </li>
          ))}
        </ul>
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => alCambiar(limpiarColumnas([]))}>Volver a las de siempre</button>
      </div>
    </Hoja>
  );
}

export function HojaFiltros({ filtros, usadas, alCambiar, alCerrar }) {
  const f = limpiarFiltros(filtros);
  const marca = (k) => alCambiar({ ...f, marcas: f.marcas.includes(k) ? f.marcas.filter((x) => x !== k) : [...f.marcas, k] });
  return (
    <Hoja titulo="Filtrar la lista" alCerrar={alCerrar} ancho={560}>
      <div class="pila">
        <div class="campo"><span class="etq">Servicio</span>
          <Segmentos etiqueta="Servicio" clase="segmentos-servicio" valor={f.servicio} opciones={[[null, 'Todos'], ...SERVICIOS]} alCambiar={(v) => alCambiar({ ...f, servicio: v || null })} /></div>
        <div class="campo"><span class="etq">Nivel</span>
          <Segmentos etiqueta="Nivel" clase="segmentos-nivel" valor={f.nivel} opciones={[[null, 'Todos'], ...NIVELES.map(([k, t]) => [k, t]), ['sin', 'Sin nivel']]} alCambiar={(v) => alCambiar({ ...f, nivel: v || null })} /></div>
        {usadas.length > 0 && (
          <div class="campo"><label for="filtro-etiqueta">Etiqueta</label>
            <select id="filtro-etiqueta" class="entrada" value={f.etiqueta || ''} onChange={(e) => alCambiar({ ...f, etiqueta: e.currentTarget.value || null })}>
              <option value="">Todas</option>
              {usadas.map((u) => <option key={u} value={u}>{u}</option>)}
            </select></div>
        )}
        <fieldset class="campo filtros-rango"><legend class="etq">Por rango</legend>
          <label class="fila-check">Más de <input type="number" class="entrada entrada-lista entrada-cifra" min="1" max="365" value={f.minDias ?? ''} onInput={(e) => alCambiar({ ...f, minDias: e.currentTarget.value })} aria-label="Más de cuántos días sin entrenar" /> días sin entrenar</label>
          <label class="fila-check">Menos del <input type="number" class="entrada entrada-lista entrada-cifra" min="1" max="100" value={f.maxCumplido ?? ''} onInput={(e) => alCambiar({ ...f, maxCumplido: e.currentTarget.value })} aria-label="Menos de qué porcentaje cumplido" /> % cumplido (4 semanas)</label>
          <label class="fila-check">Con FBE desde hace más de <input type="number" class="entrada entrada-lista entrada-cifra" min="1" max="240" value={f.minMeses ?? ''} onInput={(e) => alCambiar({ ...f, minMeses: e.currentTarget.value })} aria-label="Con FBE desde hace más de cuántos meses" /> meses</label>
        </fieldset>
        <fieldset class="campo filtros-marcas"><legend class="etq">Solo los que…</legend>
          {MARCAS.map(([k, t]) => <label key={k} class="fila-check"><input type="checkbox" checked={f.marcas.includes(k)} onChange={() => marca(k)} /> {t}</label>)}
        </fieldset>
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario" onClick={alCerrar}>Ver la lista</button>
          <button type="button" class="btn" onClick={() => alCambiar({ ...FILTROS_VACIOS })}>Quitar los filtros</button>
        </div>
      </div>
    </Hoja>
  );
}

export function HojaVistas({ ajustes, actual, alCambiar, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const lleno = (ajustes.vistas || []).length >= MAX_VISTAS && !(ajustes.vistas || []).some((v) => v.nombre.toLowerCase() === nombre.trim().toLowerCase());
  return (
    <Hoja titulo="Tus vistas" alCerrar={alCerrar} ancho={520}>
      <div class="pila">
        <p class="peq secundario">Guarda cómo tienes ahora la lista (filtros, orden, columnas y grupos) con un nombre, para volver a ella con un toque.</p>
        <form class="fila-envolver" onSubmit={(e) => { e.preventDefault(); if (!nombre.trim() || lleno) return; alCambiar(guardarVista(ajustes, nombre, actual)); setNombre(''); }}>
          <label class="sr" for="vista-nombre">Nombre de la vista</label>
          <input id="vista-nombre" class="entrada" maxLength={40} value={nombre} placeholder="Lunes de programar" onInput={(e) => setNombre(e.currentTarget.value)} />
          <button type="submit" class="btn btn-primario" disabled={!nombre.trim() || lleno}><Icono n="guardar" /> Guardar esta vista</button>
        </form>
        {lleno && <p class="mini terciario">Tienes {MAX_VISTAS} vistas: quita alguna para guardar otra.</p>}
        {(ajustes.vistas || []).length > 0 && (
          <ul class="lista">
            {ajustes.vistas.map((v) => (
              <li key={v.id} class="fila-panel vista-fila">
                <span class="peq">{v.nombre}</span>
                <button type="button" class="btn btn-peq" onClick={() => alCambiar(quitarVista(ajustes, v.id))} aria-label={`Quitar la vista ${v.nombre}`}><Icono n="basura" /> Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

// Varios a la vez: un mensaje (con sus datos, ahora o más tarde), una etiqueta, una tarea, pedir el check-in, fijar o
// preparar su semana que viene en borrador
const pad2 = (n) => String(n).padStart(2, '0');
const mananaA = (hora = 8) => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(hora)}:00`; };
export function HojaVarios({ elegidos, usadas, colores, alEtiquetar, alFijar, alCerrar, alHecho, alCambio }) {
  const { api, aviso } = useApp();
  const [modo, setModo] = useState('mensaje');
  const [texto, setTexto] = useState('Hola, {nombre}. ');
  const [luego, setLuego] = useState(false);
  const [cuando, setCuando] = useState(mananaA(8));
  const [etq, setEtq] = useState('');
  const [tarea, setTarea] = useState({ tipo: 'foto', titulo: 'Foto de progreso', detalle: '', fecha: hoyISO() });
  const [prep, setPrep] = useState({ kg: 'salto', rpe: 0, reps: 0 });
  const [resultado, setResultado] = useState(null);
  const [hechos, setHechos] = useState(0);
  const [ocupado, una] = useUnaVez();
  const n = elegidos.length;
  const hoy = hoyISO();
  const mandar = (textoDe, enviarEn = null) => una(async () => {
    let ok = 0;
    for (const r of elegidos) {
      const t = textoDe(r).trim();
      if (!t) continue;
      try { await api.enviarMensaje(r.atleta_id, { texto: t, autor: 'coach', enviarEn, clienteId: globalThis.crypto?.randomUUID?.() || `varios-${Date.now()}-${r.atleta_id}` }); ok++; setHechos(ok); }
      catch (e) { aviso(`${r.nombre}: ${e?.message || 'no se ha podido enviar'}`, 'error'); }
    }
    if (ok) aviso(enviarEn ? (ok === 1 ? 'Mensaje programado' : `Mensaje programado a ${ok} atletas`) : ok === 1 ? 'Mensaje enviado' : `Mensaje enviado a ${ok} atletas`, 'ok');
    alHecho?.();
    alCerrar();
  });
  const enviar = () => {
    if (!texto.trim()) return;
    if (luego) {
      const t = new Date(cuando);
      if (Number.isNaN(t.getTime()) || t.getTime() < Date.now() + 60e3) { aviso('Elige un momento que no haya pasado', 'error'); return; }
      mandar((r) => rellenarVarios(texto, r, hoy), t.toISOString());
    } else mandar((r) => rellenarVarios(texto, r, hoy));
  };
  const etiquetar = (poner) => una(async () => {
    const e = limpiarEtiqueta(etq);
    if (!e) return;
    if (await alEtiquetar(e, poner)) { aviso(poner ? `«${e}» puesta a ${n}` : `«${e}» quitada a ${n}`, 'ok'); alHecho?.(); alCerrar(); }
  });
  const ponerTarea = () => una(async () => {
    let ok = 0;
    for (const r of elegidos) {
      try { await api.ponerTarea(r.atleta_id, { tipo: tarea.tipo, titulo: tarea.titulo, detalle: tarea.detalle || null, fecha: tarea.fecha }); ok++; setHechos(ok); }
      catch (e) { aviso(`${r.nombre}: ${e?.message || 'no se ha podido'}`, 'error'); }
    }
    if (ok) aviso(ok === 1 ? 'Tarea puesta' : `Tarea puesta a ${ok} atletas`, 'ok');
    alHecho?.();
    alCerrar();
  });
  const preparar = () => una(async () => {
    const res = await api.prepararSiguienteVarios(elegidos.map((r) => r.atleta_id), prep).catch((e) => { aviso(e?.message || 'No se ha podido', 'error'); return null; });
    if (!res) return;
    setResultado(res);
    const k = res.filter((x) => x.estado === 'hecha').length;
    if (k) aviso(k === 1 ? 'Semana preparada, en borrador' : `${k} semanas preparadas, en borrador`, 'ok');
    alCambio?.();
  });
  const nombreDe = Object.fromEntries(elegidos.map((r) => [r.atleta_id, r.nombre]));
  const TEXTO_RES = { hecha: (x) => `semana ${x.numero ?? ''} preparada, en borrador`, ya: () => 'ya tenía la semana que viene', sin_bloque: () => 'sin bloque en marcha', error: (x) => x.error || 'no se ha podido' };
  return (
    <Hoja titulo={n === 1 ? 'Con 1 atleta' : `Con ${n} atletas`} alCerrar={alCerrar} ancho={600}>
      <div class="pila">
        <p class="peq secundario">{elegidos.map((r) => r.nombre.split(' ')[0]).join(', ')}</p>
        <Segmentos etiqueta="Qué hacer" clase="segmentos-varios" valor={modo} opciones={[['mensaje', 'Mensaje'], ['checkin', 'Pedir el check-in'], ['tarea', 'Tarea'], ['etiqueta', 'Etiqueta'], ['fijar', 'Fijar'], ['semana', 'Semana que viene']]} alCambiar={(v) => { if (v) { setModo(v); setResultado(null); } }} />
        {modo === 'mensaje' && (
          <>
            <div class="pila-xs revision-nota">
              <label class="peq secundario" for="varios-texto">Mensaje (se rellena con lo de cada uno: {HUECOS_VARIOS.join(' ')})</label>
              <textarea id="varios-texto" rows="4" maxLength={1000} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
              <div class="fila-envolver" role="group" aria-label="Huecos">{HUECOS_VARIOS.map((h) => <button key={h} type="button" class="btn-texto mini" onClick={() => setTexto((t) => `${t}${t.endsWith(' ') || !t ? '' : ' '}${h}`)}>+ {h}</button>)}</div>
            </div>
            {elegidos[0] && <p class="mini terciario">Así le llega a {elegidos[0].nombre.split(' ')[0]}: «{rellenarVarios(texto.trim(), elegidos[0], hoy)}»</p>}
            <label class="fila-check"><input type="checkbox" checked={luego} onChange={(e) => setLuego(e.currentTarget.checked)} /> Mandarlo más tarde</label>
            {luego && <div class="campo"><label for="varios-cuando">Cuándo</label><input id="varios-cuando" type="datetime-local" class="entrada" value={cuando} onInput={(e) => setCuando(e.currentTarget.value)} /></div>}
            <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> {ocupado ? `Enviando ${hechos + 1} de ${n}…` : luego ? (n === 1 ? 'Programar' : `Programar a los ${n}`) : n === 1 ? 'Enviar' : `Enviar a los ${n}`}</button>
          </>
        )}
        {modo === 'checkin' && (
          <>
            <p class="peq secundario">A cada uno, con su nombre: «{mensajeParaAlerta({ tipo: 'sin_checkin' }, elegidos[0]?.nombre || '')}»</p>
            <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado} onClick={() => mandar((r) => mensajeParaAlerta({ tipo: 'sin_checkin' }, r.nombre) || '')}><Icono n="enviar" /> {n === 1 ? 'Pedírselo' : `Pedírselo a los ${n}`}</button>
          </>
        )}
        {modo === 'tarea' && (
          <>
            <Segmentos etiqueta="Tipo de tarea" valor={tarea.tipo} opciones={TIPOS_TAREA.filter(([t]) => t !== 'video').map(([t, nm]) => [t, nm])} alCambiar={(v) => v && setTarea({ ...tarea, tipo: v, titulo: (TIPOS_TAREA.find(([t]) => t === v) || [])[1] || tarea.titulo })} />
            <div class="campo"><label for="varios-tarea-t">Título</label><input id="varios-tarea-t" class="entrada" maxLength={80} value={tarea.titulo} onInput={(e) => setTarea({ ...tarea, titulo: e.currentTarget.value })} /></div>
            <div class="campo"><label for="varios-tarea-d">Detalle (si quieres)</label><textarea id="varios-tarea-d" rows="2" maxLength={500} value={tarea.detalle} onInput={(e) => setTarea({ ...tarea, detalle: e.currentTarget.value })} /></div>
            <div class="campo"><label for="varios-tarea-f">Para el día</label><input id="varios-tarea-f" type="date" class="entrada" value={tarea.fecha} onInput={(e) => setTarea({ ...tarea, fecha: e.currentTarget.value })} /></div>
            <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado || !tarea.titulo.trim()} onClick={ponerTarea}><Icono n="hecho" /> {n === 1 ? 'Ponérsela' : `Ponérsela a los ${n}`}</button>
          </>
        )}
        {modo === 'etiqueta' && (
          <>
            <div class="campo"><label for="varios-etq">Etiqueta</label>
              <input id="varios-etq" class="entrada" list="varios-etq-usadas" maxLength={24} value={etq} placeholder="Revisión domingo" onInput={(e) => setEtq(e.currentTarget.value)} />
              <datalist id="varios-etq-usadas">{usadas.map((u) => <option key={u} value={u} />)}</datalist></div>
            {limpiarEtiqueta(etq) && <p class="mini"><span class="chip-etiqueta" data-color={colorEtiqueta(etq, colores)}>{limpiarEtiqueta(etq)}</span></p>}
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario" disabled={ocupado || !limpiarEtiqueta(etq)} onClick={() => etiquetar(true)}>Ponérsela</button>
              <button type="button" class="btn" disabled={ocupado || !limpiarEtiqueta(etq)} onClick={() => etiquetar(false)}>Quitársela</button>
            </div>
          </>
        )}
        {modo === 'fijar' && (
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" disabled={ocupado} onClick={() => una(async () => { if (await alFijar(true)) { aviso('Fijados arriba', 'ok'); alHecho?.(); alCerrar(); } })}><Icono n="chincheta" /> Fijarlos arriba</button>
            <button type="button" class="btn" disabled={ocupado} onClick={() => una(async () => { if (await alFijar(false)) { aviso('Ya no están fijados', 'ok'); alHecho?.(); alCerrar(); } })}>Quitarles el fijado</button>
          </div>
        )}
        {modo === 'semana' && (
          <>
            <p class="peq secundario">Prepara la semana que viene de cada uno a partir de su última semana, como «Preparar las siguientes» del editor: queda <strong>en borrador</strong> (no se publica nada) y los ejercicios con candado pasan tal cual. Luego la revisas y la publicas atleta a atleta.</p>
            <div class="campo"><span class="etq">Kilos</span><Segmentos etiqueta="Kilos" valor={prep.kg} opciones={[['salto', 'Un salto'], ['igual', 'Igual']]} alCambiar={(v) => v && setPrep({ ...prep, kg: v })} /></div>
            <div class="campo"><span class="etq">RPE objetivo</span><Segmentos etiqueta="RPE objetivo" valor={prep.rpe} opciones={[[0, 'Igual'], [0.5, '+0,5']]} alCambiar={(v) => setPrep({ ...prep, rpe: v ?? 0 })} /></div>
            <div class="campo"><span class="etq">Repeticiones</span><Segmentos etiqueta="Repeticiones" valor={prep.reps} opciones={[[-1, '−1'], [0, 'Igual'], [1, '+1']]} alCambiar={(v) => setPrep({ ...prep, reps: v ?? 0 })} /></div>
            {resultado ? (
              <ul class="lista resultado-preparar">{resultado.map((x) => <li key={x.atleta_id} class={`peq ${x.estado}`}><strong>{(nombreDe[x.atleta_id] || '').split(' ')[0]}</strong>: {TEXTO_RES[x.estado](x)}</li>)}</ul>
            ) : <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado} onClick={preparar}><Icono n="duplicar" /> {ocupado ? 'Preparando…' : n === 1 ? 'Preparar su semana que viene' : `Preparar la de los ${n}`}</button>}
          </>
        )}
      </div>
    </Hoja>
  );
}

// (v0.199) Avisos a tu medida: qué cuenta como «Necesita atención»
export function HojaUmbrales({ umbrales, alCambiar, alCerrar }) {
  const u = limpiarUmbrales(umbrales);
  const [f, setF] = useState(u);
  return (
    <Hoja titulo="Tus avisos" alCerrar={alCerrar} ancho={520}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); alCambiar(limpiarUmbrales(f)); alCerrar(); }}>
        <p class="peq secundario">Decide qué te salta como aviso y cuenta en «Necesitan atención».</p>
        <label class="fila-check">Desde <input type="number" class="entrada entrada-lista entrada-cifra" min="2" max="60" value={f.dias} onInput={(e) => setF({ ...f, dias: e.currentTarget.value })} aria-label="Desde cuántos días sin registrar series" /> días sin registrar series</label>
        <label class="fila-check">Por debajo del <input type="number" class="entrada entrada-lista entrada-cifra" min="10" max="100" value={f.cumplido} onInput={(e) => setF({ ...f, cumplido: e.currentTarget.value })} aria-label="Por debajo de qué porcentaje de lo pautado" /> % de lo pautado (4 semanas)</label>
        <div class="campo"><span class="etq">Molestias</span><Segmentos etiqueta="Molestias" valor={Number(f.molestia)} opciones={[[2, 'Desde moderadas'], [3, 'Solo graves']]} alCambiar={(v) => v && setF({ ...f, molestia: v })} /></div>
        <label class="fila-check"><input type="checkbox" checked={!!f.checkin} onChange={(e) => setF({ ...f, checkin: e.currentTarget.checked })} /> Que la falta de check-in cuente como atención</label>
        <div class="fila-envolver">
          <button type="submit" class="btn btn-primario">Guardar mis avisos</button>
          <button type="button" class="btn" onClick={() => setF({ ...UMBRALES })}>Los de siempre</button>
        </div>
      </form>
    </Hoja>
  );
}

// (v0.199) Los tres datos de cada tarjeta del móvil
export function HojaTarjeta({ tarjeta, alCambiar, alCerrar }) {
  const t = limpiarTarjeta(tarjeta);
  const cambiar = (k) => alCambiar(limpiarTarjeta(t.includes(k) ? t.filter((x) => x !== k) : [...t, k].slice(-3)));
  return (
    <Hoja titulo="Datos de las tarjetas" alCerrar={alCerrar} ancho={480}>
      <div class="pila">
        <p class="peq secundario">Elige hasta tres. Salen en cada tarjeta, en este orden.</p>
        <div class="pila-xs">{CAMPOS_TARJETA.map(([k, nm]) => <label key={k} class="fila-check"><input type="checkbox" checked={t.includes(k)} onChange={() => cambiar(k)} /> {nm}{t.includes(k) ? <span class="mini terciario"> ({t.indexOf(k) + 1}.º)</span> : null}</label>)}</div>
      </div>
    </Hoja>
  );
}

// El color de cada etiqueta
export function HojaColores({ usadas, colores, alCambiar, alCerrar }) {
  const NOMBRE = { morado: 'Morado', azul: 'Azul', verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo', gris: 'Gris' };
  return (
    <Hoja titulo="Colores de tus etiquetas" alCerrar={alCerrar} ancho={520}>
      {!usadas.length ? <p class="peq secundario">Aún no has puesto ninguna etiqueta. Despliega un atleta (la flecha de su fila) y ponle una.</p> : (
        <ul class="lista">
          {usadas.map((u) => (
            <li key={u} class="fila-panel">
              <span class="chip-etiqueta" data-color={colorEtiqueta(u, colores)}>{u}</span>
              <label class="sr" for={`color-${u}`}>Color de {u}</label>
              <select id={`color-${u}`} class="entrada entrada-lista" value={colorEtiqueta(u, colores)} onChange={(e) => alCambiar({ ...colores, [u.toLowerCase()]: e.currentTarget.value })}>
                {COLORES_ETIQUETA.map((c) => <option key={c} value={c}>{NOMBRE[c]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}

export const TECLAS_PANEL = [
  ['j / k', 'Bajar y subir por la lista'], ['Intro', 'Abrir su ficha'], ['c', 'Chat rápido (C, el chat completo)'], ['v', 'Nota de voz'], ['p', 'Su programa'], ['s', 'Su seguimiento'],
  ['J / K', 'Bajarlo o subirlo en tu orden (con «A tu manera»)'],
  ['d', 'Desplegar o plegar'], ['f', 'Fijar arriba o quitarlo'], ['n', 'Escribir tu nota'], ['x', 'Elegirlo (varios a la vez)'], ['b', 'Ir al buscador de la lista'], ['?', 'Ver estas teclas'],
];
export function HojaTeclasPanel({ alCerrar }) {
  return (
    <Hoja titulo="Teclas de la lista" alCerrar={alCerrar} ancho={460}>
      <dl class="teclas-lista">{TECLAS_PANEL.map(([k, t]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{t}</dd></div>)}</dl>
    </Hoja>
  );
}
