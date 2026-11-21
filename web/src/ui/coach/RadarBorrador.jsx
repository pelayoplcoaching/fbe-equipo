// (v0.201) «A quién escribir»: lo que se abre al tocar «Escribirle». Cómo está el atleta, lo pendiente de hablar con
// él, los temas (varios a la vez, también cualquiera de la biblioteca), el mensaje en cuatro tonos, tus respuestas
// guardadas, y enviar, programar o dejarlo en su chat. Y la hoja de «Tu manera de escribir».
// (v0.202) Su objetivo de contacto y su tono, con qué tono te contesta más, enviarlo como comentario en su sesión o en
// su check-in, nota de voz con guion, programar a su hora, Ctrl+Intro, y el borrador de quien no está activo.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useUnaVez, Icono, Hoja, Segmentos, copiar } from '../comunes.jsx';
import { HojaVoz, DetalleSesion } from './RevisarExtra.jsx';
import { Invitacion } from './Panel.jsx';
import { leerBorrador, guardarBorrador, rellenarHuecos } from '../../logica/mensajes.js';
import { sumarDias, instanteMadrid, partesMadrid } from '../../logica/fechas.js';
import { borradorVarios, aplicarEstilo, varianteInicial, cuantasConDatos, yaEnviada, TONOS, NOMBRE_TONO, MAX_BORRADOR,
  cuandoFue, cuandoSale, resumenCheckin, SITUACIONES, NOMBRE_GRUPO, motivoDeSituacion, textoSeguimiento, NOMBRE_SITUACION,
  ESTILO_DEFECTO, EMOJIS_ESTILO, MAX_CIERRE, limpiarEstilo, MAX_PENDIENTE } from '../../logica/radar/index.js';
import { apuntarPendiente, pendienteHecho } from '../../datos/radar.js';
import { useContactos, BotonWhatsApp } from './Integraciones.jsx';

const almacen = () => { try { return window.localStorage; } catch { return null; } };
const uuid = () => globalThis.crypto?.randomUUID?.() || `radar-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
const CLAVE_TONO = 'fbe-radar-tono';
const tonoGuardado = () => { try { const t = almacen()?.getItem(CLAVE_TONO); return TONOS.includes(t) ? t : 'cercano'; } catch { return 'cercano'; } };
const num = (x) => String(x).replace('.', ',');

// Lo que se rellena solo en tus respuestas guardadas: su nombre, su apodo y el dato de los temas elegidos
function datosHuecos(f, motivos) {
  const d = { nombre: f.primerNombre, apodo: f.extra?.personal?.apodo || null };
  for (const m of motivos) {
    const x = m.datos || {};
    if (x.sesion && !d.sesion) d.sesion = x.sesion;
    if (x.ejercicio && !d.ejercicio) { d.ejercicio = x.ejercicio; d.marca = String(x.texto || '').replace(/\s*\(antes[^)]*\)\s*$/, '').trim() || null; }
    if (x.objetivo && !d.objetivo) d.objetivo = x.objetivo;
    if (x.dias != null && d.dias == null) d.dias = x.dias;
  }
  return d;
}

export function Borrador({ id, f, hoy, alEnviar, abrirAtleta, estilo = ESTILO_DEFECTO, abierto = null, alPendiente,
  objetivo = 2, alObjetivo = null, tono: suTono = null, alTono = null, tonoContesta = null, hora = null, historia = null, temaInicial = null }) {
  const { api, perfil, aviso } = useApp();
  const pendientes = f.pendientes;
  const otros = f.motivos.filter((m) => !m.pendiente);
  const [aMano, setAMano] = useState([]);          // situaciones elegidas de la biblioteca
  const todos = useMemo(() => [...f.motivos, ...aMano.filter((m) => !f.motivos.some((x) => x.clave === m.clave))], [f.motivos, aMano]);
  // (v0.202) en una ronda por tema, ese tema; en el cierre del domingo, el de su semana
  const [sel, setSel] = useState(() => {
    const t = temaInicial === 'cierre' ? f.motivos.find((m) => m.id === 'semana_completa' || m.id === 'semana_corta') : temaInicial ? f.motivos.find((m) => m.id === temaInicial) : null;
    return [(t || f.motivo)?.clave || 'saludo'];
  });
  const elegidos = todos.filter((m) => sel.includes(m.clave));
  const [tono, setTono] = useState(() => suTono || tonoGuardado());
  // (v0.202) Dónde le llega: su chat, el hilo de su última sesión o el de su check-in (cuentan igual como contacto)
  const ultima = f.motivos.find((m) => m.id === 'saludo')?.datos || {};
  // (su check-in, si es de los últimos 10 días)
  const ck = f.extra?.checkin?.id && f.extra.checkin.creado_en && Date.now() - Date.parse(f.extra.checkin.creado_en) <= 10 * 864e5 ? f.extra.checkin : null;
  const [donde, setDonde] = useState('chat');
  const [verVoz, setVerVoz] = useState(false);
  const [verSesion, setVerSesion] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const base = useMemo(() => varianteInicial(f.atleta_id, hoy), [f.atleta_id, hoy]);
  const evitar = abierto?.enviados || [];
  const quien = { nombre: f.primerNombre, apodo: f.extra?.personal?.apodo || '' };
  // (las propuestas solo cambian con lo elegido, no cada vez que la lista se recalcula: así no se pisa lo que escribes)
  const estiloClave = JSON.stringify(estilo || {});
  const claveSel = elegidos.map((m) => `${m.clave}:${JSON.stringify(m.datos || {})}`).join('|');
  const propuestas = useMemo(() => Object.fromEntries(TONOS.map((t) => [t,
    aplicarEstilo(borradorVarios(elegidos.length ? elegidos : [f.motivos[f.motivos.length - 1]], { hoy, variante: base, vuelta, tono: t, evitar }), estilo, quien)])),
  [claveSel, vuelta, evitar.length, estiloClave]);
  const [texto, setTexto] = useState(() => propuestas[tono]);
  const tocado = useRef(false);
  // Al cambiar de temas, de tono o de frase, el borrador se rehace con la propuesta en el mismo toque (lo escrito a mano
  // se cambia); cuando llega lo que ya le mandaste (para no repetir) o cambias tu manera de escribir, solo si aún no has
  // tocado el texto
  const propuestaDe = ({ sel: s2 = sel, aMano: a2 = aMano, tono: t2 = tono, vuelta: v2 = vuelta } = {}) => {
    const tod = [...f.motivos, ...a2.filter((m) => !f.motivos.some((x) => x.clave === m.clave))];
    const el = tod.filter((m) => s2.includes(m.clave));
    return aplicarEstilo(borradorVarios(el.length ? el : [f.motivos[f.motivos.length - 1]], { hoy, variante: base, vuelta: v2, tono: t2, evitar }), estilo, quien);
  };
  const rehacer = (c) => {
    if (c.sel) setSel(c.sel);
    if (c.aMano) setAMano(c.aMano);
    if (c.tono) setTono(c.tono);
    if (c.vuelta != null) setVuelta(c.vuelta);
    tocado.current = false;
    setTexto(propuestaDe(c));
  };
  const primera = useRef(true);
  useEffect(() => { if (primera.current) { primera.current = false; return; } if (!tocado.current) setTexto(propuestas[tono]); }, [evitar.length, estiloClave]);
  const [ocupado, una] = useUnaVez();
  const [recordar, setRecordar] = useState(0);
  const [verProgramar, setVerProgramar] = useState(false);
  const [verMas, setVerMas] = useState(false);
  const [verMias, setVerMias] = useState(false);
  const area = useRef(null);
  const contactos = useContactos([f.atleta_id]);   // (v0.105, 051) su teléfono, para escribirle por WhatsApp
  const enChat = useMemo(() => leerBorrador(almacen(), perfil?.id, f.atleta_id)?.texto || null, [perfil?.id, f.atleta_id]);
  useEffect(() => { area.current?.focus({ preventScroll: true }); }, []);

  const alternar = (clave) => rehacer({ sel: sel.includes(clave) ? (sel.length > 1 ? sel.filter((x) => x !== clave) : sel) : [...sel, clave] });
  const elegirTono = (t) => { rehacer({ tono: t }); try { almacen()?.setItem(CLAVE_TONO, t); } catch { /* */ } };
  const elegirSituacion = (sid) => {
    const m = motivoDeSituacion(sid, todos);
    rehacer({ aMano: todos.some((x) => x.clave === m.clave) ? aMano : [...aMano, m], sel: sel.includes(m.clave) ? sel : [...sel, m.clave] });
    setVerMas(false);
  };
  const limpio = texto.trim();
  const repetido = limpio && yaEnviada(limpio, evitar);
  const responder = elegidos.find((m) => m.id === 'responder' && m.datos?.mensajeId);

  // Después de enviar (o programar): tus pendientes elegidos quedan hechos y, si lo pediste, uno nuevo para preguntar
  async function despues() {
    for (const m of elegidos.filter((x) => x.id === 'pendiente_mio' && x.datos?.notaId)) {
      try { await pendienteHecho({ api }, { id: m.datos.notaId, texto: m.datos.texto, desde: m.desde }, { hoy }); alPendiente?.({ hecho: m.datos.notaId }); } catch { /* se queda abierto */ }
    }
    if (recordar > 0) {
      const tema = elegidos.find((m) => !['saludo', 'responder', 'pendiente_mio', 'recordatorio'].includes(m.id));
      const t = textoSeguimiento(tema?.etiqueta || '');
      const desde = sumarDias(hoy, recordar);
      try { const n = await apuntarPendiente({ api }, f.atleta_id, t, { desde }); alPendiente?.({ nuevo: { id: n?.id || uuid(), atleta_id: f.atleta_id, texto: t, desde, hecho: null } }); }
      catch (e) { aviso(e?.message || 'No se ha podido apuntar el recordatorio', 'error'); }
    }
  }
  const enviar = (enviarEn = null) => una(async () => {
    if (!limpio) return;
    try {
      if (donde === 'sesion' && ultima.sesionId && !enviarEn) await api.comentar({ atletaId: f.atleta_id, sesionId: ultima.sesionId, texto: limpio, autor: 'coach', clienteId: uuid() });
      else if (donde === 'checkin' && ck && !enviarEn) await api.comentar({ atletaId: f.atleta_id, checkinId: ck.id, texto: limpio, autor: 'coach', clienteId: uuid() });
      else await api.enviarMensaje(f.atleta_id, { texto: limpio, autor: 'coach', clienteId: uuid(), enviarEn, respondeA: responder?.datos?.mensajeId || null });
      await despues();
      aviso(enviarEn ? `Programado para ${cuandoSale(enviarEn, hoy)}` : donde === 'sesion' ? `Comentado en su sesión (${ultima.sesion})` : donde === 'checkin' ? 'Contestado en su check-in' : `Mensaje enviado a ${f.primerNombre}`, 'ok');
      alEnviar?.({ enviarEn, texto: limpio, tono });
    } catch (e) { aviso(e?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
  });
  const alChat = () => {
    if (limpio) guardarBorrador(almacen(), perfil?.id, f.atleta_id, limpio);
    abrirAtleta?.(f.atleta_id, 'mensajes', null);
  };
  const idArea = `${id}-texto`;
  const otras = TONOS.some((t) => elegidos.some((m) => cuantasConDatos(m, { hoy, tono: t }) > 1));
  // Los puntos de la nota de voz: cada tema elegido con su dato
  const guion = elegidos.filter((m) => m.id !== 'saludo').map((m) => m.etiqueta).slice(0, 3);
  if (!guion.length) guion.push(ultima.sesion ? `Qué tal ${ultima.sesion}` : 'Cómo va la semana');
  return (
    <div id={id} class="pila-s rad-borrador">
      <ComoEsta f={f} hoy={hoy} objetivo={objetivo} alObjetivo={alObjetivo} historia={historia} />
      <Pendientes f={f} hoy={hoy} lista={pendientes} sel={sel} alternar={alternar} alPendiente={alPendiente} />

      <div class="pila-xs">
        <span class="peq secundario" id={`${id}-temas`}>De qué hablarle (puedes elegir varios)</span>
        <div class="selector-chips rad-temas" role="group" aria-labelledby={`${id}-temas`}>
          {[...otros, ...aMano.filter((m) => !f.motivos.some((x) => x.clave === m.clave))].map((m) => (
            <button key={m.clave} aria-pressed={sel.includes(m.clave) ? 'true' : 'false'} onClick={() => alternar(m.clave)}>{m.etiqueta}</button>
          ))}
          <button class="rad-mas" aria-expanded={verMas ? 'true' : 'false'} onClick={() => setVerMas(!verMas)}><Icono n="mas" /> Más situaciones</button>
        </div>
        {verMas && (
          <div class="rad-situaciones" role="group" aria-label="Todas las situaciones">
            {SITUACIONES.map(([g, xs]) => (
              <div key={g} class="pila-xs">
                <span class="mini terciario">{NOMBRE_GRUPO[g]}</span>
                <div class="rad-situaciones-fila">
                  {xs.map(([sid, nombre]) => <button key={sid} class="btn btn-peq" onClick={() => elegirSituacion(sid)}>{nombre}</button>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="rad-tonos" role="radiogroup" aria-label="Tono del mensaje">
        {TONOS.map((t) => (
          <label key={t} class={`rad-tono ${tono === t ? 'elegido' : ''}`}>
            <input type="radio" class="sr" name={`${id}-tono`} value={t} checked={tono === t} onChange={() => elegirTono(t)} />
            <span class="rad-tono-nombre">{NOMBRE_TONO[t]}{suTono === t ? ' · su tono' : ''}</span>
            <span class="rad-tono-texto">{propuestas[t]}</span>
          </label>
        ))}
      </div>
      {/* (v0.202) su tono y con cuál te contesta más */}
      {(alTono || tonoContesta) && (
        <div class="fila-envolver rad-su-tono">
          {tonoContesta && <span class="peq secundario">Te contesta más con el tono {NOMBRE_TONO[tonoContesta.tono].toLowerCase()} ({tonoContesta.contestadas} de {tonoContesta.total}).</span>}
          {alTono && (suTono === tono
            ? <button class="btn-texto" onClick={() => alTono(null)}>Quitar «{NOMBRE_TONO[tono].toLowerCase()}» como su tono</button>
            : <button class="btn-texto" onClick={() => alTono(tono)}>Usar siempre «{NOMBRE_TONO[tono].toLowerCase()}» con {f.primerNombre}</button>)}
        </div>
      )}
      {(ultima.sesionId || ck) && (
        <div class="pila-xs rad-donde">
          <span class="peq secundario" id={`${id}-donde`}>Dónde le llega</span>
          <Segmentos etiqueta="Dónde le llega" valor={donde} alCambiar={(v) => setDonde(v || 'chat')}
            opciones={[['chat', 'En su chat'], ...(ultima.sesionId ? [['sesion', `En su sesión (${ultima.sesion})`]] : []), ...(ck ? [['checkin', 'En su check-in']] : [])]} />
          {ultima.sesionId && (
            <button class="btn-texto rad-ver-sesion" aria-expanded={verSesion ? 'true' : 'false'} onClick={() => setVerSesion(!verSesion)}>{verSesion ? 'Ocultar' : 'Ver'} su sesión: {ultima.sesion}{ultima.fecha ? `, ${cuandoFue(ultima.fecha, hoy)}` : ''}</button>
          )}
          {verSesion && ultima.sesionId && <div class="rad-sesion"><DetalleSesion s={{ id: ultima.sesionId, atleta: { id: f.atleta_id, nombre: f.nombre } }} /></div>}
        </div>
      )}

      <div class="pila-xs revision-nota">
        <label class="peq secundario" for={idArea}>Mensaje para {f.primerNombre} (edítalo a tu gusto)</label>
        <textarea id={idArea} ref={area} rows="3" maxLength={MAX_BORRADOR} value={texto} onInput={(e) => { tocado.current = true; setTexto(e.currentTarget.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } }} />
      </div>
      {repetido && <p class="mini rad-aviso" style={{ margin: 0 }}>Ya le mandaste este mismo mensaje hace poco. Cambia alguna frase para que no le llegue repetido.</p>}
      {responder && <p class="mini terciario" style={{ margin: 0 }}>Irá como respuesta a su mensaje.</p>}
      {enChat && enChat !== limpio && <p class="mini terciario" style={{ margin: 0 }}>En su chat tienes un borrador a medias: «Abrir en su chat» lo cambia por este.</p>}
      <div class="fila-envolver rad-recordar">
        <label class="peq secundario" for={`${id}-recordar`}>Recuérdamelo para preguntarle cómo sigue</label>
        <select id={`${id}-recordar`} value={String(recordar)} onChange={(e) => setRecordar(Number(e.currentTarget.value))}>
          <option value="0">No</option><option value="3">En 3 días</option><option value="7">En 7 días</option>
        </select>
      </div>
      <div class="revision-acciones rad-acciones">
        <button class="btn btn-peq btn-primario" onClick={() => enviar()} disabled={ocupado || !limpio}><Icono n="mensaje" /> {ocupado ? 'Enviando…' : 'Enviar'}</button>
        <button class="btn btn-peq" aria-expanded={verProgramar ? 'true' : 'false'} onClick={() => setVerProgramar(!verProgramar)} disabled={!limpio || donde !== 'chat'}><Icono n="reloj" /> Programar</button>
        <button class="btn btn-peq" onClick={() => setVerVoz(true)}><Icono n="micro" /> Nota de voz</button>
        <button class="btn btn-peq" onClick={() => rehacer({ vuelta: vuelta + 1 })} disabled={!otras}>Otras frases</button>
        <button class="btn btn-peq" aria-expanded={verMias ? 'true' : 'false'} onClick={() => setVerMias(!verMias)}><Icono n="guardar" /> Mis respuestas</button>
        <button class="btn btn-peq" onClick={alChat} disabled={!abrirAtleta}>Abrir en su chat</button>
        {contactos.datos && contactos.datos[f.atleta_id] && <BotonWhatsApp telefono={contactos.datos[f.atleta_id]} texto={limpio} />}
      </div>
      {verProgramar && <Programar hoy={hoy} ocupado={ocupado} hora={hora} nombre={f.primerNombre} alProgramar={(iso) => enviar(iso)} />}
      {verVoz && <HojaVoz atleta={{ id: f.atleta_id, nombre: f.nombre }} guion={guion} alCerrar={() => setVerVoz(false)} alEnviado={() => { despues(); alEnviar?.({}); }} />}
      {verMias && <MisRespuestas f={f} elegidos={elegidos} texto={limpio} alElegir={(t) => { tocado.current = true; setTexto(t); setVerMias(false); }} />}
    </div>
  );
}

// ---------- Cómo está: lo que sabes de él, en una tarjeta ----------
function ComoEsta({ f, hoy, objetivo = 2, alObjetivo = null, historia = null }) {
  const r = f.resumen || {};
  const e = f.extra || {};
  const filas = [];
  const entrena = r.servicio !== 'nutricion';
  if (entrena && r.semana) filas.push(['Bloque', `${r.bloque?.nombre ? `${r.bloque.nombre}, ` : ''}semana ${r.semana.numero} de ${r.semana.total}${r.semana.foco === 'descarga' ? ' (descarga)' : ''}`]);
  else if (entrena && !r.bloque) filas.push(['Bloque', 'Sin bloque activo']);
  const ult = (f.motivos.find((m) => m.id === 'saludo')?.datos) || {};
  if (entrena && r.sesiones?.total) filas.push(['Esta semana', `${r.sesiones.completadas} de ${r.sesiones.total} sesiones${ult.sesion && ult.fecha ? `; la última, ${ult.sesion}, ${cuandoFue(ult.fecha, hoy)}` : ''}`]);
  const ck = resumenCheckin(e.checkin);
  if (ck?.partes?.length) filas.push([`Check-in${ck.semana ? ` (semana del ${Number(ck.semana.slice(8, 10))}/${Number(ck.semana.slice(5, 7))})` : ''}`, ck.partes.join(' · ')]);
  if (ck?.nota) filas.push(['Su nota', `«${ck.nota}»`]);
  if (r.servicio !== 'entrenamiento' && r.peso?.kg) filas.push(['Peso', `${num(r.peso.kg)} kg${r.peso.cambio != null ? ` (${r.peso.cambio > 0 ? '+' : ''}${num(r.peso.cambio)} desde el anterior)` : ''}`]);
  const o = e.objetivo || null;
  if (o) filas.push(['Objetivo', `${o.titulo}${o.pct != null ? `: ${o.pct} %` : ''}${o.conseguido ? ', conseguido' : o.aTiempo === true ? ', va en fecha' : o.aTiempo === false ? ', a este ritmo no llega a la fecha' : ''}`]);
  const p = e.personal;
  if (p?.apodo) filas.push(['Su apodo', p.apodo]);
  if (p?.porque) filas.push(['Su porqué', `«${p.porque}»`]);
  if (p?.favoritos?.length) filas.push(['Sus favoritos', p.favoritos.filter(Boolean).join(', ')]);
  if (e.panel?.nota || e.panel?.etiquetas?.length) filas.push(['Tu nota', [e.panel?.nota, ...(e.panel?.etiquetas || [])].filter(Boolean).join(' · ')]);
  if (f.hito) filas.push(['Próximo', f.hito.texto]);
  if (e.conexion) {
    const d = Math.max(0, Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${String(e.conexion).slice(0, 10)}T12:00:00Z`)) / 864e5));
    filas.push(['La app', d === 0 ? 'La ha abierto hoy' : d === 1 ? 'La abrió ayer' : `La abrió hace ${d} días`]);
  }
  return (
    <section class="rad-como" aria-label={`Cómo está ${f.primerNombre}`}>
      <h2>Cómo está</h2>
      {filas.length ? (
        <dl class="rad-datos">
          {filas.map(([k, v]) => <div key={k} class="rad-dato"><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      ) : <p class="peq secundario" style={{ margin: 0 }}>Aún no hay datos suyos de estas semanas.</p>}
      {historia?.length > 0 && <p class="mini terciario" style={{ margin: 0 }}>Tus días de contacto, 8 últimas semanas: {historia.join(' · ')}</p>}
      {alObjetivo && (
        <div class="pila-xs rad-objetivo">
          <span class="peq secundario">Tu objetivo de contacto con {f.primerNombre}</span>
          <Segmentos etiqueta={`Objetivo de contacto con ${f.primerNombre}`} valor={objetivo} alCambiar={(v) => alObjetivo(v || objetivo)}
            opciones={[[1, '1 día por semana'], [2, '2 días'], [3, '3 días']]} />
        </div>
      )}
      {f.enfriando && (
        <div class="rad-enfria">
          <strong class="peq">Se está enfriando</strong>
          <ul>{f.enfriando.razones.map((x) => <li key={x.id} class="peq">{x.texto}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

// ---------- Pendiente de hablar: lo abierto (se tacha solo al escribirle) y tus temas ----------
function Pendientes({ f, hoy, lista, sel, alternar, alPendiente }) {
  const { api, aviso } = useApp();
  const [nuevo, setNuevo] = useState('');
  const [cuando, setCuando] = useState(0);
  const [ocupado, una] = useUnaVez();
  const idNuevo = `rad-pend-${f.atleta_id}`;
  const apuntar = (e) => {
    e.preventDefault();
    const t = nuevo.trim();
    if (!t) return;
    una(async () => {
      const desde = sumarDias(hoy, cuando);
      try {
        const n = await apuntarPendiente({ api }, f.atleta_id, t, { desde });
        alPendiente?.({ nuevo: { id: n?.id || uuid(), atleta_id: f.atleta_id, texto: t, desde, hecho: null } });
        setNuevo('');
        aviso(cuando ? `Apuntado: te saldrá ${cuando === 3 ? 'dentro de 3 días' : 'dentro de una semana'}` : 'Apuntado en sus pendientes', 'ok');
      } catch (err) { aviso(err?.message || 'No se ha podido apuntar', 'error'); }
    });
  };
  const hecho = (m) => una(async () => {
    try { await pendienteHecho({ api }, { id: m.datos.notaId, texto: m.datos.texto, desde: m.desde }, { hoy }); alPendiente?.({ hecho: m.datos.notaId }); aviso('Hecho: ya no saldrá como pendiente', 'ok'); }
    catch (err) { aviso(err?.message || 'No se ha podido marcar', 'error'); }
  });
  return (
    <section class="rad-pend" aria-label={`Pendiente de hablar con ${f.primerNombre}`}>
      <h2>Pendiente de hablar</h2>
      {lista.length ? (
        <ul class="rad-pend-lista">
          {lista.map((m) => (
            <li key={m.clave} class="rad-pend-fila">
              <label class="rad-pend-incluir">
                <input type="checkbox" checked={sel.includes(m.clave)} onChange={() => alternar(m.clave)} />
                <span>{m.etiqueta}{m.desde && m.desde < hoy ? <span class="mini terciario"> · desde {cuandoFue(m.desde, hoy)}</span> : null}</span>
              </label>
              {m.id === 'pendiente_mio' && <button class="btn btn-peq" disabled={ocupado} onClick={() => hecho(m)} aria-label={`Hecho: ${m.etiqueta}`}><Icono n="hecho" /> Hecho</button>}
            </li>
          ))}
        </ul>
      ) : <p class="peq secundario" style={{ margin: 0 }}>Nada pendiente con {f.primerNombre}.</p>}
      <form class="fila-envolver rad-pend-nuevo" onSubmit={apuntar}>
        <label class="sr" for={idNuevo}>Apuntar un tema pendiente con {f.primerNombre}</label>
        <input id={idNuevo} type="text" maxLength={MAX_PENDIENTE} placeholder="Apuntar un tema (solo lo ves tú)" value={nuevo} onInput={(e) => setNuevo(e.currentTarget.value)} />
        <label class="sr" for={`${idNuevo}-cuando`}>Cuándo te sale</label>
        <select id={`${idNuevo}-cuando`} value={String(cuando)} onChange={(e) => setCuando(Number(e.currentTarget.value))}>
          <option value="0">Desde hoy</option><option value="3">En 3 días</option><option value="7">En 7 días</option>
        </select>
        <button class="btn btn-peq" type="submit" disabled={ocupado || !nuevo.trim()}><Icono n="mas" /> Apuntar</button>
      </form>
    </section>
  );
}

// ---------- Programar el mensaje ----------
function Programar({ hoy, ocupado, alProgramar, hora: habitual = null, nombre = '' }) {
  const ahora = partesMadrid();
  // (v0.202) a la hora a la que suele escribirte: hoy si aún no ha pasado, si no mañana
  const suHora = habitual ? `${String(habitual.hora).padStart(2, '0')}:00` : null;
  const suDia = suHora && ahora.hora < suHora ? hoy : sumarDias(hoy, 1);
  const opciones = [
    ...(suHora ? [[`A su hora: ${suDia === hoy ? 'hoy' : 'mañana'} a las ${habitual.hora}:00`, instanteMadrid(suDia, suHora)]] : []),
    ...(ahora.hora < '17:30' ? [['Hoy a las 18:00', instanteMadrid(hoy, '18:00')]] : []),
    ['Mañana a las 9:00', instanteMadrid(sumarDias(hoy, 1), '09:00')],
    ['Mañana a las 19:00', instanteMadrid(sumarDias(hoy, 1), '19:00')],
  ];
  const [dia, setDia] = useState(sumarDias(hoy, 1));
  const [hora, setHora] = useState('09:00');
  const otra = instanteMadrid(dia, hora);
  return (
    <div class="rad-programar pila-xs" role="group" aria-label="Programar el mensaje">
      <div class="fila-envolver">
        {opciones.map(([t, iso]) => <button key={t} class="btn btn-peq" disabled={ocupado || !iso} onClick={() => alProgramar(iso)}>{t}</button>)}
      </div>
      {suHora && <p class="mini terciario" style={{ margin: 0 }}>{nombre ? `${nombre} suele` : 'Suele'} escribirte sobre las {habitual.hora}:00.</p>}
      <div class="fila-envolver">
        <label class="peq secundario" for="rad-prog-dia">Otro día</label>
        <input id="rad-prog-dia" type="date" min={hoy} max={sumarDias(hoy, 90)} value={dia} onInput={(e) => setDia(e.currentTarget.value)} />
        <label class="sr" for="rad-prog-hora">Hora</label>
        <input id="rad-prog-hora" type="time" value={hora} onInput={(e) => setHora(e.currentTarget.value)} />
        <button class="btn btn-peq" disabled={ocupado || !otra} onClick={() => alProgramar(otra)}>Programar</button>
      </div>
    </div>
  );
}

// ---------- Tus respuestas guardadas, según el tema, y guardar el borrador como tuyo ----------
function MisRespuestas({ f, elegidos, texto, alElegir }) {
  const { api, aviso } = useApp();
  const [lista, setLista] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [situacion, setSituacion] = useState(() => elegidos.find((m) => m.id !== 'saludo')?.id || '');
  const [ocupado, una] = useUnaVez();
  const cargar = () => api.respuestasGuardadas().then((l) => setLista(l || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);
  const temas = new Set(elegidos.map((m) => (m.id === 'molestia_fuerte' ? 'molestia' : m.id === 'dia_flojo' ? 'dia_malo' : m.id)));
  const ordenadas = (lista || []).map((r) => ({ ...r, encaja: !!r.situacion && temas.has(r.situacion) })).sort((a, b) => Number(b.encaja) - Number(a.encaja));
  const huecos = datosHuecos(f, elegidos);
  // El nombre del atleta (palabra entera) pasa a ser {nombre}, como en el chat
  const comoPlantilla = (t) => {
    const n = f.primerNombre;
    if (!n || n === 'tu atleta') return t;
    const seguro = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(`(^|[^\\p{L}])${seguro}(?!\\p{L})`, 'gu'), '$1{nombre}');
  };
  const guardar = (e) => {
    e.preventDefault();
    if (!titulo.trim() || !texto) return;
    una(async () => {
      try { await api.crearRespuesta({ titulo, texto: comoPlantilla(texto), situacion: situacion || null, orden: (lista?.length || 0) + 1 }); setTitulo(''); aviso('Guardada en tus respuestas', 'ok'); cargar(); }
      catch (err) { aviso(err?.message || 'No se ha podido guardar', 'error'); }
    });
  };
  return (
    <div class="rad-mias pila-s">
      {lista == null ? <p class="peq secundario" style={{ margin: 0 }}>Cargando tus respuestas…</p> : !ordenadas.length ? (
        <p class="peq secundario" style={{ margin: 0 }}>Aún no tienes respuestas guardadas. Guarda este borrador como tuyo y te saldrá aquí y con «/» en el chat.</p>
      ) : (
        <ul class="rad-mias-lista">
          {ordenadas.slice(0, 12).map((r) => (
            <li key={r.id}>
              <button class="rad-mia-btn" onClick={() => alElegir(rellenarHuecos(r.texto, huecos))}>
                <span class="rad-mias-titulo">{r.titulo}{r.encaja ? <span class="chip mini ok">Para este tema</span> : r.situacion ? <span class="mini terciario"> · {NOMBRE_SITUACION[r.situacion] || r.situacion}</span> : null}</span>
                <span class="mini terciario">{rellenarHuecos(r.texto, huecos).slice(0, 110)}{r.texto.length > 110 ? '…' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form class="fila-envolver rad-guardar" onSubmit={guardar}>
        <label class="sr" for={`rad-mia-${f.atleta_id}`}>Nombre de la respuesta</label>
        <input id={`rad-mia-${f.atleta_id}`} type="text" maxLength={80} placeholder="Guardar este borrador como…" value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
        <label class="sr" for={`rad-mia-sit-${f.atleta_id}`}>Para qué tema</label>
        <select id={`rad-mia-sit-${f.atleta_id}`} value={situacion} onChange={(e) => setSituacion(e.currentTarget.value)}>
          <option value="">Sin tema</option>
          {SITUACIONES.flatMap(([, xs]) => xs).map(([sid, nombre]) => <option key={sid} value={sid}>{nombre}</option>)}
        </select>
        <button class="btn btn-peq" type="submit" disabled={ocupado || !titulo.trim() || !texto}><Icono n="guardar" /> Guardar como mía</button>
      </form>
      <p class="mini terciario" style={{ margin: 0 }}>En tus respuestas, {'{nombre}'}, {'{apodo}'}, {'{sesion}'}, {'{ejercicio}'}, {'{marca}'}, {'{objetivo}'} y {'{dias}'} se rellenan solos con lo suyo.</p>
    </div>
  );
}

// ---------- Tu manera de escribir ----------
export function HojaEstilo({ estilo, enlace = '', enBase = false, alGuardar, alCerrar }) {
  const [e, setE] = useState(() => limpiarEstilo(estilo));
  const [link, setLink] = useState(enlace || '');
  const cambia = (k, v) => setE((x) => ({ ...x, [k]: v }));
  const ejemplo = aplicarEstilo(borradorVarios([{ id: 'record', datos: { ejercicio: 'sentadilla', texto: '100 kg × 5' } }, { id: 'sin_checkin', datos: {} }], { tono: 'cercano' }), e, { nombre: 'Ana', apodo: 'Anita' });
  return (
    <Hoja titulo="Tu manera de escribir" alCerrar={alCerrar}>
      <div class="pila rad-estilo">
        <p class="peq secundario" style={{ margin: 0 }}>Se aplica a todos los borradores de «A quién escribir». Siempre puedes editarlos antes de enviar.</p>
        <div class="pila-xs">
          <span class="peq" id="rad-est-saludo">Empezar con su nombre</span>
          <Segmentos etiqueta="Empezar con su nombre" valor={e.saludo} alCambiar={(v) => cambia('saludo', v || e.saludo)}
            opciones={[['no', 'No'], ['nombre', '«Ana, …»'], ['hola', '«Hola, Ana. …»']]} />
        </div>
        <label class="fila-envolver"><input type="checkbox" checked={e.apodo} onChange={(ev) => cambia('apodo', ev.currentTarget.checked)} /> <span class="peq">Con su apodo, si lo ha puesto en su perfil</span></label>
        <div class="pila-xs">
          <label class="peq" for="rad-est-cierre">Tu cierre habitual (opcional)</label>
          <input id="rad-est-cierre" type="text" maxLength={MAX_CIERRE} placeholder="Por ejemplo: ¡Vamos!" value={e.cierre} onInput={(ev) => cambia('cierre', ev.currentTarget.value)} />
        </div>
        <div class="pila-xs">
          <span class="peq">Un emoji al final</span>
          <Segmentos etiqueta="Un emoji al final" valor={e.emoji} alCambiar={(v) => cambia('emoji', v ?? '')}
            opciones={EMOJIS_ESTILO.map((x) => [x, x || 'Ninguno'])} />
        </div>
        <label class="fila-envolver"><input type="checkbox" checked={e.corto} onChange={(ev) => cambia('corto', ev.currentTarget.checked)} /> <span class="peq">Más corto: solo la primera frase de cada tema</span></label>
        <div class="pila-xs">
          <span class="peq secundario">Así quedaría</span>
          <p class="rad-ejemplo">{ejemplo}</p>
        </div>
        <div class="pila-xs">
          <label class="peq" for="rad-est-enlace">Tu enlace para reservar una llamada (opcional)</label>
          <input id="rad-est-enlace" type="url" inputMode="url" maxLength={300} placeholder="https://calendly.com/…" value={link} onInput={(ev) => setLink(ev.currentTarget.value)} />
          <span class="mini terciario">Sale en «Proponerle una llamada».{enBase ? '' : ' Para guardarlo hace falta la migración 086.'}</span>
        </div>
        <div class="revision-acciones">
          <button class="btn btn-primario" onClick={() => alGuardar({ estilo: e, enlace: link })}>Guardar</button>
          <button class="btn" onClick={() => setE({ ...ESTILO_DEFECTO })}>Como venía</button>
        </div>
      </div>
    </Hoja>
  );
}

// ---------- (v0.202) El borrador de quien no está activo: sin activar, en pausa o antiguo ----------
// En pausa le llega a su chat (sigue con la cuenta); a los demás, por WhatsApp o copiado (no entran en la app)
export function BorradorOtro({ id, f, hoy, estilo = ESTILO_DEFECTO, alEnviar, alYaEscrito }) {
  const { api, aviso } = useApp();
  const motivo = f.motivo;
  const [tono, setTono] = useState(tonoGuardado);
  const [vuelta, setVuelta] = useState(0);
  const quien = { nombre: f.primerNombre, apodo: '' };
  const propuestas = useMemo(() => Object.fromEntries(TONOS.map((t) => [t, aplicarEstilo(borradorVarios([motivo], { hoy, vuelta, tono: t }), estilo, quien)])), [vuelta, JSON.stringify(estilo || {})]);
  const [texto, setTexto] = useState(() => propuestas[tono]);
  useEffect(() => { setTexto(propuestas[tono]); }, [propuestas, tono]);
  const [ocupado, una] = useUnaVez();
  const [verInv, setVerInv] = useState(false);
  const contactos = useContactos([f.atleta_id]);
  const limpio = texto.trim();
  const chat = f.grupo === 'pausado';
  const enviar = () => una(async () => {
    try { await api.enviarMensaje(f.atleta_id, { texto: limpio, autor: 'coach', clienteId: uuid() }); aviso(`Mensaje enviado a ${f.primerNombre}`, 'ok'); alEnviar?.({ texto: limpio, tono }); }
    catch (e) { aviso(e?.message || 'No se ha podido enviar', 'error'); }
  });
  const idArea = `${id}-texto`;
  return (
    <div id={id} class="pila-s rad-borrador">
      <div class="rad-tonos" role="radiogroup" aria-label="Tono del mensaje">
        {TONOS.map((t) => (
          <label key={t} class={`rad-tono ${tono === t ? 'elegido' : ''}`}>
            <input type="radio" class="sr" name={`${id}-tono`} value={t} checked={tono === t} onChange={() => setTono(t)} />
            <span class="rad-tono-nombre">{NOMBRE_TONO[t]}</span>
            <span class="rad-tono-texto">{propuestas[t]}</span>
          </label>
        ))}
      </div>
      <div class="pila-xs revision-nota">
        <label class="peq secundario" for={idArea}>Mensaje para {f.primerNombre} (edítalo a tu gusto)</label>
        <textarea id={idArea} rows="3" maxLength={MAX_BORRADOR} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
      </div>
      {!chat && <p class="mini terciario" style={{ margin: 0 }}>{f.grupo === 'invitado' ? 'Aún no entra en la app: mándaselo por WhatsApp o cópialo.' : 'Ya no está en el equipo: mándaselo por WhatsApp o cópialo, y después «Ya le escribí».'}</p>}
      <div class="revision-acciones rad-acciones">
        {chat && <button class="btn btn-peq btn-primario" onClick={enviar} disabled={ocupado || !limpio}><Icono n="mensaje" /> Enviar</button>}
        <button class="btn btn-peq" onClick={async () => aviso((await copiar(limpio)) ? 'Mensaje copiado' : 'Selecciona el texto y cópialo')} disabled={!limpio}><Icono n="copiar" /> Copiar</button>
        {contactos.datos && contactos.datos[f.atleta_id] && <BotonWhatsApp telefono={contactos.datos[f.atleta_id]} texto={limpio} />}
        <button class="btn btn-peq" onClick={() => setVuelta((v) => v + 1)}>Otras frases</button>
        {f.grupo === 'invitado' && <button class="btn btn-peq" onClick={() => setVerInv(true)}>Nuevo código y mensaje</button>}
      </div>
      {verInv && <Invitacion atleta={{ id: f.atleta_id, nombre: f.nombre }} alCerrar={() => setVerInv(false)} />}
    </div>
  );
}
