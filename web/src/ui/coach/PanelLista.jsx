// (v0.198) Piezas de la lista de Atletas a tu gusto: lo tuyo de cada atleta (fijado, etiquetas, nota) y cómo ves la
// lista (columnas, orden, vistas), en la base con la 085 o en este aparato sin ella; lo que no trae el resumen
// (mensajes sin leer, la semana que viene, su teléfono); y las hojas: columnas, filtros, vistas, varios a la vez y teclas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, usePreferencia, Hoja, Icono, Segmentos, useUnaVez } from '../comunes.jsx';
import { lunesDe, hoyISO } from '../../logica/fechas.js';
import { NIVELES, SERVICIOS } from '../../logica/nivel.js';
import { NOMBRE_FOCO, num, signo, ESCALAS } from '../../logica/calculos.js';
import { hace, fmtCorta } from '../../logica/fechas.js';
import { enlaceWhatsApp } from '../../logica/integraciones.js';
import {
  COLUMNAS, TITULO_COLUMNA, moverColumna, limpiarColumnas, MARCAS, limpiarFiltros, FILTROS_VACIOS, limpiarPanelAtleta, limpiarAjustesPanel,
  AJUSTES_PANEL, etiquetasUsadas, colorEtiqueta, COLORES_ETIQUETA, limpiarEtiqueta, MAX_NOTA, MAX_ETIQUETAS, conNombre, guardarVista, quitarVista,
  proximaDe, TEXTO_PROXIMA_CORTO, checkinAlDia, diasSinEntrenar, MAX_VISTAS,
} from '../../logica/panel-atletas.js';

// ---------------------------------------------------------------- lo tuyo: en la base (085) o en este aparato
export function usePanelCoach() {
  const { api, aviso } = useApp();
  const [localAtl, setLocalAtl] = usePreferencia('fbe-panel-atletas', {});
  const [localAj, setLocalAj] = usePreferencia('fbe-panel-ajustes', null);
  const remoto = useCarga(() => api.panelAtletas().catch(() => null), [], { recuerdo: `panel085:${api.uid()}` });
  const enBase = !!remoto.datos && typeof remoto.datos === 'object';
  const [atl, setAtl] = useState(null);
  const [aj, setAj] = useState(null);
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
    tGuardar.current = setTimeout(() => { api.guardarPanelAjustes(refA.current).catch((e) => aviso(e?.message || 'No se han podido guardar tus ajustes de la lista', 'error')); }, 500);
  };
  useEffect(() => () => clearTimeout(tGuardar.current), []);
  return { panel, ajustes, enBase, guardarAtleta, guardarVarios, guardarAjustes, listo: !remoto.cargando || !!remoto.datos };
}

// ---------------------------------------------------------------- lo que no trae el resumen
export function useExtrasPanel(lista) {
  const { api } = useApp();
  const conv = useCarga(() => api.conversaciones().catch(() => []), [], { recuerdo: `panel-conv:${api.uid()}` });
  const clave = (lista || []).filter((r) => r.bloque).map((r) => `${r.atleta_id}:${r.bloque.id}`).join(',');
  const prox = useCarga(() => (clave ? api.proximaSemanaDe((lista || []).filter((r) => r.bloque).map((r) => ({ atleta_id: r.atleta_id, bloque_id: r.bloque.id })), lunesDe(hoyISO())).catch(() => ({})) : Promise.resolve({})), [clave], { recuerdo: `panel-prox:${api.uid()}:${clave}` });
  const contactos = useCarga(() => api.contactos().catch(() => null), [], { recuerdo: `contactos:${api.uid()}:panel` });
  const sinLeer = {};
  for (const c of conv.datos || []) if (c.sinLeer) sinLeer[c.atleta.id] = c.sinLeer;
  return { sinLeer, proxima: prox.datos || {}, telefonos: contactos.datos || {}, cargando: conv.cargando && !conv.datos };
}

// ---------------------------------------------------------------- etiquetas
export function Etiquetas({ etiquetas = [], colores = {}, quitar = null }) {
  if (!etiquetas.length) return null;
  return (
    <span class="etiquetas-atleta">
      {etiquetas.map((e) => (
        <span key={e} class="etq" data-color={colorEtiqueta(e, colores)}>
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
        <input id={`etq-${id}`} class="entrada entrada-peq etq-entrada" maxLength={24} value={t} placeholder="Etiqueta nueva" onInput={(e) => setT(e.currentTarget.value)} disabled={tiene.length >= MAX_ETIQUETAS} />
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
export function DetalleAtleta({ r, extra, fila, colores, usadas, alGuardar, hoy, id, abrir = null, telefono = null }) {
  const p = fila || { fijado: false, etiquetas: [], nota: null };
  const [nota, setNota] = useState(p.nota || '');
  useEffect(() => { setNota(p.nota || ''); }, [p.nota]);
  const [ocupado, una] = useUnaVez();
  const guardar = (cambio) => una(() => alGuardar({ ...p, ...cambio }));
  const prox = proximaDe(r, extra);
  const sinEntrenar = diasSinEntrenar(r, hoy);
  const datos = [
    ['Último check-in', r.checkin ? `${checkinAlDia(r, hoy) ? 'Al día' : 'Atrasado'} (semana del ${fmtCorta(r.checkin.semana)})` : 'Ninguno'],
    ['Sueño, energía, motivación', r.checkin ? [r.checkin.horas_sueno ? `${r.checkin.horas_sueno.replace('-', '–')} h` : '—', r.checkin.energia ? ESCALAS.energia[r.checkin.energia - 1] : '—', r.checkin.motivacion ? ESCALAS.motivacion[r.checkin.motivacion - 1] : '—'].join(' · ') : '—'],
    ['Molestias', r.maxMolestia ? MOLESTIA[r.maxMolestia] : 'Sin dolor'],
    ['Último entreno', sinEntrenar == null ? 'Nunca' : sinEntrenar === 0 ? 'Hoy' : sinEntrenar === 1 ? 'Ayer' : `Hace ${sinEntrenar} días`],
    ['Peso', r.peso ? `${num(r.peso.kg)} kg${r.peso.ritmo ? ` (${signo(r.peso.ritmo.kgSemana, 2)}/sem)` : ''}` : '—'],
    ['Cumplido (4 semanas)', r.cumplimiento?.series?.pct != null ? `${r.cumplimiento.series.pct} % (${r.cumplimiento.series.hechas} de ${r.cumplimiento.series.pautadas} series)` : '—'],
    ['Hábitos', r.habitos?.pct != null ? `${r.habitos.pct} % la última semana` : '—'],
    ['Semana que viene', prox ? TEXTO_PROXIMA_CORTO[prox] : '—'],
  ];
  return (
    <div class="detalle-atleta pila-s" id={id}>
      <dl class="detalle-datos">{datos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {abrir && (
        <div class="fila-envolver detalle-ir">
          {r.estado !== 'invitado' && <button type="button" class="btn btn-peq" onClick={() => abrir(r.atleta_id, 'mensajes')}><Icono n="mensaje" /> Chat</button>}
          {r.servicio !== 'nutricion' && <button type="button" class="btn btn-peq" onClick={() => abrir(r.atleta_id, 'programa')}><Icono n="calendario" /> Su programa</button>}
          <button type="button" class="btn btn-peq" onClick={() => abrir(r.atleta_id, 'seguimiento')}><Icono n="checkin" /> Seguimiento</button>
          {telefono && <a class="btn btn-peq" href={enlaceWhatsApp(telefono, '')} target="_blank" rel="noopener"><Icono n="enviar" /> WhatsApp</a>}
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
          <input id={`nota-${r.atleta_id}`} class="entrada entrada-peq nota-entrada" maxLength={MAX_NOTA} value={nota} placeholder="Una línea para ti: «Revisar rodilla»" onInput={(e) => setNota(e.currentTarget.value)} />
          <button type="submit" class="btn btn-peq" disabled={ocupado || (nota.trim() || null) === (p.nota || null)}>Guardar nota</button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- botones rápidos
export function AccionesRapidas({ r, abrir, telefono, abierto, alDesplegar, detalleId, clase = '', todas = true }) {
  const primer = r.nombre.split(' ')[0];
  const parar = (fn) => (e) => { e.stopPropagation(); fn(e); };
  return (
    <div class={`acciones-rapidas ${clase}`} role="group" aria-label={`Atajos de ${primer}`}>
      {r.estado !== 'invitado' && <button type="button" class="btn-icono-mini accion-chat" onClick={parar(() => abrir(r.atleta_id, 'mensajes'))} aria-label={`Chat con ${primer}`} title="Chat"><Icono n="mensaje" /></button>}
      {todas && r.servicio !== 'nutricion' && <button type="button" class="btn-icono-mini accion-programa" onClick={parar(() => abrir(r.atleta_id, 'programa'))} aria-label={`Abrir el programa de ${primer}`} title="Su programa"><Icono n="calendario" /></button>}
      {todas && <button type="button" class="btn-icono-mini accion-seguimiento" onClick={parar(() => abrir(r.atleta_id, 'seguimiento'))} aria-label={`Seguimiento de ${primer}`} title="Seguimiento"><Icono n="checkin" /></button>}
      {todas && telefono && <a class="btn-icono-mini accion-whatsapp" href={enlaceWhatsApp(telefono, '')} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} aria-label={`WhatsApp a ${primer}`} title="WhatsApp"><Icono n="enviar" /></a>}
      <button type="button" class="btn-icono-mini accion-desplegar" aria-expanded={abierto ? 'true' : 'false'} aria-controls={detalleId} onClick={parar(alDesplegar)} aria-label={abierto ? `Plegar lo de ${primer}` : `Desplegar lo de ${primer}`} title={abierto ? 'Plegar' : 'Desplegar'}><Icono n={abierto ? 'arriba' : 'abajo'} /></button>
    </div>
  );
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
              <li key={v.id} class="fila-entre vista-fila">
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

// Varios a la vez: un mensaje (con su nombre) o una etiqueta
export function HojaVarios({ elegidos, usadas, colores, alEtiquetar, alCerrar, alHecho }) {
  const { api, aviso } = useApp();
  const [modo, setModo] = useState('mensaje');
  const [texto, setTexto] = useState('Hola, {nombre}. ');
  const [etq, setEtq] = useState('');
  const [hechos, setHechos] = useState(0);
  const [ocupado, una] = useUnaVez();
  const n = elegidos.length;
  const enviar = () => una(async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    let ok = 0;
    for (const r of elegidos) {
      try { await api.enviarMensaje(r.atleta_id, { texto: conNombre(limpio, r.nombre), autor: 'coach', clienteId: globalThis.crypto?.randomUUID?.() || `varios-${Date.now()}-${r.atleta_id}` }); ok++; setHechos(ok); }
      catch (e) { aviso(`${r.nombre}: ${e?.message || 'no se ha podido enviar'}`, 'error'); }
    }
    if (ok) aviso(ok === 1 ? 'Mensaje enviado' : `Mensaje enviado a ${ok} atletas`, 'ok');
    alHecho?.();
    alCerrar();
  });
  const etiquetar = (poner) => una(async () => {
    const e = limpiarEtiqueta(etq);
    if (!e) return;
    if (await alEtiquetar(e, poner)) { aviso(poner ? `«${e}» puesta a ${n}` : `«${e}» quitada a ${n}`, 'ok'); alHecho?.(); alCerrar(); }
  });
  return (
    <Hoja titulo={n === 1 ? 'Con 1 atleta' : `Con ${n} atletas`} alCerrar={alCerrar} ancho={560}>
      <div class="pila">
        <p class="peq secundario">{elegidos.map((r) => r.nombre.split(' ')[0]).join(', ')}</p>
        <Segmentos etiqueta="Qué hacer" valor={modo} opciones={[['mensaje', 'Mandar un mensaje'], ['etiqueta', 'Etiqueta']]} alCambiar={(v) => v && setModo(v)} />
        {modo === 'mensaje' ? (
          <>
            <div class="pila-xs revision-nota">
              <label class="peq secundario" for="varios-texto">Mensaje ({'{nombre}'} pone el nombre de cada uno)</label>
              <textarea id="varios-texto" rows="4" maxLength={1000} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
            </div>
            {elegidos[0] && <p class="mini terciario">Así le llega a {elegidos[0].nombre.split(' ')[0]}: «{conNombre(texto.trim(), elegidos[0].nombre)}»</p>}
            <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> {ocupado ? `Enviando ${hechos + 1} de ${n}…` : n === 1 ? 'Enviar' : `Enviar a los ${n}`}</button>
          </>
        ) : (
          <>
            <div class="campo"><label for="varios-etq">Etiqueta</label>
              <input id="varios-etq" class="entrada" list="varios-etq-usadas" maxLength={24} value={etq} placeholder="Revisión domingo" onInput={(e) => setEtq(e.currentTarget.value)} />
              <datalist id="varios-etq-usadas">{usadas.map((u) => <option key={u} value={u} />)}</datalist></div>
            {limpiarEtiqueta(etq) && <p class="mini"><span class="etq" data-color={colorEtiqueta(etq, colores)}>{limpiarEtiqueta(etq)}</span></p>}
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario" disabled={ocupado || !limpiarEtiqueta(etq)} onClick={() => etiquetar(true)}>Ponérsela</button>
              <button type="button" class="btn" disabled={ocupado || !limpiarEtiqueta(etq)} onClick={() => etiquetar(false)}>Quitársela</button>
            </div>
          </>
        )}
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
            <li key={u} class="fila-entre">
              <span class="etq" data-color={colorEtiqueta(u, colores)}>{u}</span>
              <label class="sr" for={`color-${u}`}>Color de {u}</label>
              <select id={`color-${u}`} class="entrada entrada-peq" value={colorEtiqueta(u, colores)} onChange={(e) => alCambiar({ ...colores, [u.toLowerCase()]: e.currentTarget.value })}>
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
  ['j / k', 'Bajar y subir por la lista'], ['Intro', 'Abrir su ficha'], ['c', 'Su chat'], ['p', 'Su programa'], ['s', 'Su seguimiento'],
  ['d', 'Desplegar o plegar'], ['f', 'Fijar arriba o quitarlo'], ['n', 'Escribir tu nota'], ['x', 'Elegirlo (varios a la vez)'], ['b', 'Ir al buscador de la lista'], ['?', 'Ver estas teclas'],
];
export function HojaTeclasPanel({ alCerrar }) {
  return (
    <Hoja titulo="Teclas de la lista" alCerrar={alCerrar} ancho={460}>
      <dl class="teclas-lista">{TECLAS_PANEL.map(([k, t]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{t}</dd></div>)}</dl>
    </Hoja>
  );
}
