import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez } from '../comunes.jsx';
import { borradorRevision } from '../../logica/cierre.js';
import { sumarDias, fmtConDia } from '../../logica/fechas.js';
import { num, NOMBRE_ZONA } from '../../logica/calculos.js';
import { lineasCheckin, pautadoFrenteAHecho, extraParaBorrador, conFrase, sinFrase, insertarFrase, conNombre } from '../../logica/revision.js';
import { useGrabadora, PanelGrabando, PanelRevisar, AyudaMicro, ActivarMicro } from '../chat/NotaVoz.jsx';

// v0.191: lo de cada atleta en la semana, sin salir de la revisión (se pide al abrirlo y se recuerda un rato)
const recordado = new Map();   // `${atleta}:${lunes}` -> { t, p }
export function pedirDetalle(api, atletaId, lunes) {
  const k = `${atletaId}:${lunes}`, ya = recordado.get(k);
  if (ya && Date.now() - ya.t < 120000) return ya.p;
  const p = api.detalleRevision(atletaId, lunes);
  recordado.set(k, { t: Date.now(), p });
  p.catch(() => { if (recordado.get(k)?.p === p) recordado.delete(k); });
  return p;
}
export const olvidarDetalle = (atletaId = null) => { for (const k of [...recordado.keys()]) if (!atletaId || k.startsWith(`${atletaId}:`)) recordado.delete(k); };

const leer = (clave, defecto) => { try { const x = JSON.parse(localStorage.getItem(clave) || 'null'); return x ?? defecto; } catch { return defecto; } };
const guardarLocal = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin sitio: no pasa nada */ } };
export const prefRevision = () => ({ orden: 'urgencia', mio: [], marcarAlEnviar: true, ...leer('fbe-revision-pref', {}) });
export const guardarPref = (p) => guardarLocal('fbe-revision-pref', p);

const SIGNO = { sube: 'Sube', baja: 'Baja' };

export function DetalleRevision({ f, lunes, abrirAtleta }) {
  const { api } = useApp();
  const d = useCarga(() => pedirDetalle(api, f.atleta_id, lunes), [f.atleta_id, lunes]);
  if (d.cargando && !d.datos) return <p class="peq secundario rev-detalle-espera" role="status">Cargando su semana...</p>;
  if (d.error || !d.datos) return <p class="peq rev-detalle-espera">No se ha podido cargar su semana. <button type="button" class="btn-texto mini" onClick={() => { olvidarDetalle(f.atleta_id); d.recargar(); }}>Reintentar</button></p>;
  const x = d.datos;
  const lineas = lineasCheckin(x.checkin, x.anterior);
  const molestias = (x.molestias || []).filter((m) => Number(m.intensidad) > 0);
  const peso = x.resumen?.peso;
  return (
    <div class="rev-detalle">
      <section class="rev-bloque" aria-label="Sus sesiones de la semana">
        <h2>Sesiones</h2>
        {!x.sesiones.length ? <p class="peq secundario">Sin sesiones esta semana.</p> : (
          <ul class="rev-sesiones">{x.sesiones.map((s) => <SesionRevision key={s.id} s={s} atletaId={f.atleta_id} />)}</ul>
        )}
      </section>

      <section class="rev-bloque" aria-label="Su check-in">
        <h2>Check-in{x.checkin && !x.checkinDeEstaSemana ? ' (el de la semana pasada)' : ''}</h2>
        {!x.checkin ? <p class="peq secundario">No ha enviado el check-in.</p> : (
          <div class="pila-xs">
            <dl class="rev-checkin">
              {lineas.map((l) => (
                <div key={l.clave} class={l.cambio ? `cambia ${l.cambio}` : ''}>
                  <dt>{l.etiqueta}</dt>
                  <dd><strong class="num">{l.valor}</strong>{l.antes && l.antes !== l.valor && <span class="peq secundario"> antes {l.antes}{l.cambio ? ` (${SIGNO[l.cambio].toLowerCase()})` : ''}</span>}</dd>
                </div>
              ))}
            </dl>
            {molestias.length > 0 && <p class="peq rev-molestias"><strong>Molestias:</strong> {molestias.map((m) => `${NOMBRE_ZONA[m.zona] || m.zona} ${m.intensidad}/3${m.notas ? ` (${m.notas})` : ''}`).join(' · ')}</p>}
            {String(x.checkin.notas || '').trim() && <p class="cita">«{String(x.checkin.notas).trim()}»</p>}
          </div>
        )}
      </section>

      {(x.progreso.records.length > 0 || x.progreso.parados.length > 0) && (
        <section class="rev-bloque" aria-label="Récords y parones">
          <h2>Récords y parones</h2>
          <ul class="rev-progreso">
            {x.progreso.records.map((r) => <li key={r.ejercicio_id} class="chip ok"><Icono n="trofeo" /> {r.ejercicio}: {r.marca}</li>)}
            {x.progreso.parados.map((r) => <li key={r.ejercicio_id} class={`chip ${r.estado === 'baja' ? 'aviso' : 'info'}`}>{r.ejercicio}: {r.estado === 'baja' ? 'dos semanas bajando' : 'dos semanas parado'}</li>)}
          </ul>
        </section>
      )}

      {(peso?.kg != null || f.diasNutricion != null || f.habitos != null) && (
        <section class="rev-bloque" aria-label="Peso, comida y hábitos">
          <h2>Peso, comida y hábitos</h2>
          <ul class="rev-progreso">
            {peso?.kg != null && <li class="chip num">Peso {num(peso.kg)} kg{peso.cambio_4s != null ? ` (${peso.cambio_4s > 0 ? '+' : ''}${num(peso.cambio_4s)} en 4 semanas)` : ''}</li>}
            {f.diasNutricion != null && <li class="chip num">Comidas apuntadas: {f.diasNutricion} de 7 días</li>}
            {f.habitos != null && <li class="chip num">Hábitos: {f.habitos} %</li>}
            {x.resumen?.sesiones?.minutos > 0 && <li class="chip num">{x.resumen.sesiones.minutos} min entrenando</li>}
          </ul>
        </section>
      )}

      {x.comentarios.length > 0 && (
        <section class="rev-bloque" aria-label="Lo que ha escrito esta semana">
          <h2>Lo que ha escrito</h2>
          <ul class="rev-comentarios">{x.comentarios.map((c, i) => <li key={i}><span class="peq secundario">{c.donde}</span><span>«{c.texto}»</span></li>)}</ul>
        </section>
      )}

      {(f.historial || []).some((h) => h.nota && h.lunes !== lunes) && (
        <section class="rev-bloque" aria-label="Tus notas anteriores">
          <h2>Tus notas anteriores</h2>
          <ul class="rev-comentarios">{f.historial.filter((h) => h.nota && h.lunes !== lunes).slice(0, 6).map((h) => <li key={h.lunes}><span class="peq secundario">Semana del {fmtConDia(h.lunes)}{h.hecha ? '' : ' (sin dar por revisado)'}</span><span>{h.nota}</span></li>)}</ul>
        </section>
      )}
      <button type="button" class="btn-texto mini" onClick={() => abrirAtleta(f.atleta_id, 'registro', null)}>Ver todo en su ficha</button>
    </div>
  );
}

function SesionRevision({ s, atletaId }) {
  const { api } = useApp();
  const [abierta, setAbierta] = useState(false);
  const d = useCarga(() => (abierta ? api.sesion(s.id, atletaId) : Promise.resolve(null)), [abierta, s.id]);
  const filas = d.datos ? pautadoFrenteAHecho(d.datos.ejercicios) : [];
  return (
    <li class={`rev-sesion ${s.completada ? 'hecha' : 'pendiente'}`}>
      <button type="button" class="rev-sesion-cab" aria-expanded={abierta ? 'true' : 'false'} onClick={() => setAbierta((v) => !v)}>
        <span class="rev-sesion-nombre"><strong>{s.nombre}</strong><span class="peq secundario">{s.completada ? fmtConDia(s.fecha) : 'Sin hacer'}</span></span>
        <span class="rev-sesion-cifras">
          {s.completada && s.duracion_min != null && <span class="chip num">{s.duracion_min} min</span>}
          {s.completada && s.rpe_sesion != null && <span class={`chip num ${s.rpe_sesion >= 9 ? 'aviso' : ''}`}>Esfuerzo {num(s.rpe_sesion)}</span>}
          {s.completada && s.series > 0 && <span class="chip num">{s.series} series</span>}
          <Icono n={abierta ? 'arriba' : 'abajo'} />
        </span>
      </button>
      {s.nota_atleta && <p class="cita">«{s.nota_atleta}»</p>}
      {abierta && (d.cargando && !d.datos ? <p class="peq secundario" role="status">Cargando la sesión...</p> : d.error ? <p class="peq">No se ha podido cargar.</p> : !filas.length ? <p class="peq secundario">Sin ejercicios pautados.</p> : (
        <div class="rev-tabla-env">
          <table class="rev-tabla">
            <thead><tr><th scope="col">Ejercicio</th><th scope="col">Pautado</th><th scope="col">Hecho</th></tr></thead>
            <tbody>{filas.map((p) => <tr key={p.id} class={p.falta > 0 && s.completada ? 'corta' : ''}><th scope="row">{p.nombre}</th><td class="num">{p.pautado}</td><td class="num">{p.hecho}{p.falta > 0 && s.completada && p.hecho !== 'Sin hacer' ? ` (faltan ${p.falta})` : ''}</td></tr>)}</tbody>
          </table>
        </div>
      ))}
    </li>
  );
}

// El mensaje de repaso de la semana: redactado con sus datos (ahora también récords, lo que no hizo y el check-in), con
// tus frases frecuentes a un toque, la opción de mandarlo de voz y de darlo por revisado al enviar
export function HojaBorrador({ f, lunes, alCerrar, alEnviado }) {
  const { api, aviso } = useApp();
  const resumen = useCarga(() => api.resumenSemanaAtleta(f.atleta_id).catch(() => null), [f.atleta_id]);
  const detalle = useCarga(() => pedirDetalle(api, f.atleta_id, lunes).catch(() => null), [f.atleta_id, lunes]);
  const [texto, setTexto] = useState(() => borradorRevision(f, null));
  const [tocado, setTocado] = useState(false);
  const [ocupado, una] = useUnaVez();
  const [frases, setFrases] = useState(() => leer('fbe-revision-frases', []));
  const [marcar, setMarcar] = useState(() => prefRevision().marcarAlEnviar !== false);
  const [hoja, setHoja] = useState(null);
  const area = useRef(null);
  const cursor = useRef(null);
  const rehacer = () => borradorRevision(f, resumen.datos || null, extraParaBorrador(detalle.datos));
  // Cuando llegan el resumen y el detalle, el borrador se rehace (salvo que ya lo esté editando)
  useEffect(() => { if (!tocado && (resumen.datos !== undefined || detalle.datos)) setTexto(rehacer()); }, [resumen.datos, detalle.datos]);
  const primer = f.nombre.split(' ')[0];
  const hecho = (que) => { aviso(`${que} a ${primer}`, 'ok'); alEnviado?.(marcar && !f.hecha); alCerrar(); };
  const enviar = () => una(async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    try {
      await api.enviarMensaje(f.atleta_id, { texto: limpio, autor: 'coach', clienteId: globalThis.crypto?.randomUUID?.() || `rev-${Date.now()}` });
      hecho('Mensaje enviado');
    } catch (e) { aviso(e?.message || 'No se ha podido enviar', 'error'); }
  });
  // La nota de voz, desde aquí: las mismas piezas del chat (hasta 2 minutos, se escucha antes de enviar)
  const [limite, setLimite] = useState(60);
  useEffect(() => { let vivo = true; api.vozLimite?.().then((n) => { if (vivo && n) setLimite(n); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const [enviandoVoz, setEnviandoVoz] = useState(false);
  const enviarVozRef = useRef(null);
  const g = useGrabadora({ alError: (m) => aviso(m, 'error'), alAviso: (m) => aviso(m), alAyuda: () => setHoja('micro'), alActivar: () => setHoja('activar'), alEnviar: (x) => enviarVozRef.current?.(x), limite, clave: null });
  enviarVozRef.current = async (x) => {
    if (enviandoVoz) return;
    setEnviandoVoz(true);
    try {
      const archivo = new File([x.blob], `nota-de-voz.${x.ext}`, { type: x.tipo });
      await api.enviarMensaje(f.atleta_id, { archivo, autor: 'coach', duracion_seg: x.seg, onda: x.onda, clienteId: globalThis.crypto?.randomUUID?.() || `rev-voz-${Date.now()}` });
      g.descartar();
      hecho('Nota de voz enviada');
    } catch (e) { aviso(e?.message || 'No se ha podido enviar la nota de voz', 'error'); } finally { setEnviandoVoz(false); }
  };
  const grabando = g.estado === 'pidiendo' || g.estado === 'grabando' || g.estado === 'pausada';
  const ponerFrases = (l) => { setFrases(l); guardarLocal('fbe-revision-frases', l); };
  const insertar = (fr) => {
    const r = insertarFrase(texto, conNombre(fr, f.nombre), cursor.current);
    setTocado(true); setTexto(r.texto); cursor.current = r.cursor;
    requestAnimationFrame(() => { const a = area.current; if (a) { a.focus(); try { a.setSelectionRange(r.cursor, r.cursor); } catch { /* */ } } });
  };
  const guardarFrase = () => {
    const a = area.current;
    const sel = a && a.selectionEnd > a.selectionStart ? texto.slice(a.selectionStart, a.selectionEnd) : '';
    const t = (sel || '').trim();
    if (!t) { aviso('Selecciona en el mensaje el trozo que quieres guardar como frase'); return; }
    ponerFrases(conFrase(frases, t.replaceAll(primer, '{nombre}')));
    aviso('Frase guardada', 'ok');
  };
  const recordar = (e) => { cursor.current = e.currentTarget.selectionStart; };
  return (
    <Hoja titulo={`Repaso de la semana para ${primer}`} alCerrar={alCerrar} ancho={620}>
      <div class="pila">
        <div class="pila-xs revision-nota">
          <label class="peq secundario" for={`rev-msg-${f.atleta_id}`}>Redactado con sus datos de la semana{resumen.cargando || detalle.cargando ? ' (completándolo…)' : ''}. Edítalo a tu gusto.</label>
          <textarea id={`rev-msg-${f.atleta_id}`} ref={area} rows="9" maxLength={2000} value={texto} onInput={(e) => { setTocado(true); setTexto(e.currentTarget.value); recordar(e); }} onSelect={recordar} onKeyUp={recordar} onClick={recordar} />
        </div>
        <div class="pila-xs rev-frases">
          <div class="fila-entre"><span class="peq secundario">Tus frases (un toque y entran donde está el cursor)</span><button type="button" class="btn-texto mini" onClick={guardarFrase}>Guardar lo seleccionado</button></div>
          {frases.length ? (
            <ul class="rev-frases-lista">{frases.map((fr) => (
              <li key={fr}><button type="button" class="chip rev-frase" onClick={() => insertar(fr)}>{conNombre(fr, f.nombre)}</button><button type="button" class="btn-icono plano rev-frase-quitar" aria-label={`Quitar la frase: ${fr.slice(0, 40)}`} onClick={() => ponerFrases(sinFrase(frases, fr))}><Icono n="cerrar" /></button></li>
            ))}</ul>
          ) : <p class="peq secundario">Aún no tienes ninguna: selecciona un trozo del mensaje y pulsa «Guardar lo seleccionado». Se quedan en este aparato.</p>}
        </div>
        <label class="rev-marcar"><input type="checkbox" checked={marcar} onChange={(e) => { const v = e.currentTarget.checked; setMarcar(v); guardarPref({ ...prefRevision(), marcarAlEnviar: v }); }} /> <span>Al enviar, darlo por revisado</span></label>
        {g.estado === 'revisar' ? <div class="rev-voz"><PanelRevisar g={g} alEnviar={(x) => enviarVozRef.current(x)} enviando={enviandoVoz} /></div>
          : grabando ? <div class="rev-voz"><PanelGrabando g={g} /></div> : (
            <div class="fila-envolver">
              <button type="button" class="btn" onClick={() => { setTocado(false); setTexto(rehacer()); area.current?.focus(); }}><Icono n="reiniciar" /> Volver al redactado</button>
              <button type="button" class="btn" onClick={() => g.empezar({ manos: true })}><Icono n="micro" /> Mejor una nota de voz</button>
              <button type="button" class="btn btn-primario" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> Enviar</button>
            </div>
          )}
      </div>
      {hoja === 'micro' && <AyudaMicro alCerrar={() => setHoja(null)} />}
      {hoja === 'activar' && <ActivarMicro alCerrar={() => setHoja(null)} />}
    </Hoja>
  );
}

// Pedir lo que falta a varios a la vez: la lista (se puede quitar a quien no toque) y el mensaje, que lleva el nombre de cada uno
export function HojaLote({ titulo, destinatarios, alCerrar }) {
  const { api, aviso } = useApp();
  const [fuera, setFuera] = useState(() => new Set());
  const [plantilla, setPlantilla] = useState(() => (destinatarios[0] ? destinatarios[0].texto.replace(`Hola, ${destinatarios[0].nombre.split(' ')[0]}.`, 'Hola, {nombre}.') : ''));
  const [ocupado, una] = useUnaVez();
  const [hechos, setHechos] = useState(0);
  const elegidos = destinatarios.filter((x) => !fuera.has(x.atleta_id));
  const enviar = () => una(async () => {
    const t = plantilla.trim();
    if (!t || !elegidos.length) return;
    let bien = 0; const mal = [];
    for (const x of elegidos) {
      try {
        await api.enviarMensaje(x.atleta_id, { texto: conNombre(t, x.nombre), autor: 'coach', clienteId: globalThis.crypto?.randomUUID?.() || `lote-${Date.now()}-${bien}` });
        bien += 1; setHechos(bien);
      } catch { mal.push(x.nombre.split(' ')[0]); }
    }
    if (mal.length) aviso(`Enviado a ${bien}. No ha salido a: ${mal.join(', ')}`, 'error'); else aviso(bien === 1 ? 'Mensaje enviado' : `Mensaje enviado a ${bien}`, 'ok');
    alCerrar(bien > 0);
  });
  return (
    <Hoja titulo={titulo} alCerrar={() => alCerrar(false)} ancho={560}>
      <div class="pila">
        <div class="pila-xs revision-nota">
          <label class="peq secundario" for="rev-lote-texto">El mensaje. «{'{nombre}'}» se cambia por el nombre de cada uno.</label>
          <textarea id="rev-lote-texto" rows="4" maxLength={1000} value={plantilla} onInput={(e) => setPlantilla(e.currentTarget.value)} />
        </div>
        <fieldset class="rev-lote">
          <legend class="peq secundario">A quién ({elegidos.length} de {destinatarios.length})</legend>
          <ul>{destinatarios.map((x) => (
            <li key={x.atleta_id}><label><input type="checkbox" checked={!fuera.has(x.atleta_id)} onChange={(e) => { const on = e.currentTarget.checked; setFuera((s) => { const n = new Set(s); if (on) n.delete(x.atleta_id); else n.add(x.atleta_id); return n; }); }} /> <span>{x.nombre}</span></label></li>
          ))}</ul>
        </fieldset>
        <button type="button" class="btn btn-primario" disabled={ocupado || !plantilla.trim() || !elegidos.length} onClick={enviar}><Icono n="enviar" /> {ocupado ? `Enviando (${hechos} de ${elegidos.length})` : elegidos.length === 1 ? 'Enviar a 1 atleta' : `Enviar a ${elegidos.length} atletas`}</button>
      </div>
    </Hoja>
  );
}

// Una semana pasada, solo para verla
export function SemanaPasada({ lunes, abrirAtleta }) {
  const { api } = useApp();
  const d = useCarga(() => api.revisionDeSemana(lunes), [lunes]);
  if (d.cargando && !d.datos) return <p class="peq secundario panel panel-pad" role="status">Cargando esa semana...</p>;
  if (d.error) return <p class="peq panel panel-pad">No se ha podido cargar esa semana.</p>;
  const filas = d.datos.filas;
  const hechas = filas.filter((x) => x.hecha).length;
  return (
    <div class="pila">
      <div class="panel panel-pad"><strong>{hechas} de {filas.length} revisados</strong><p class="peq secundario">Semana del {fmtConDia(lunes)} al {fmtConDia(sumarDias(lunes, 6))}. Solo se puede ver.</p></div>
      <ul class="revision-lista">{filas.map((x) => (
        <li key={x.atleta_id} class={`panel rev-pasada ${x.hecha ? 'hecha' : ''}`}>
          <button type="button" class="btn-texto" onClick={() => abrirAtleta(x.atleta_id, 'seguimiento', null)}><strong>{x.nombre}</strong></button>
          <span class={`chip ${x.hecha ? 'ok' : 'info'}`}>{x.hecha ? 'Revisado' : 'Sin revisar'}</span>
          {x.nota && <p class="peq">{x.nota}</p>}
        </li>
      ))}</ul>
    </div>
  );
}
