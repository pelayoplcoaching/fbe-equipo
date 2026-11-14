// (personalización 3, tanda 6) Que la app sepa de su vida, siempre como consejo (la programación del coach no se toca):
// lo que viene en su vida (y preguntarle después qué tal), las semanas difíciles, sus guardias y el seguimiento del
// check-in. La agenda va a la base (migración 069): la ven él y su coach.
import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { useTrato } from '../trato.js';
import { eventoDeHoy, preguntaPendiente, proximos, RESPUESTAS, semanaDificil, minimoDeSemana, mensajeSemanaDificil, choquesGuardia, guardiasProximas, seguimientoCheckin } from '../../logica/vida.js';
import { hoyISO, lunesDe, fmtCorta } from '../../logica/fechas.js';
import { vibrar } from '../hapticos.js';
import { Imagen } from '../Imagen.jsx';

// La agenda (la suya, o la de un atleta si es el coach); se vuelve a leer al cambiar (api avisa con «fbe-agenda»)
export function useAgenda(atletaId = null, { activa = true } = {}) {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const otra = () => setVuelta((n) => n + 1);
    globalThis.addEventListener?.('fbe-agenda', otra);
    return () => globalThis.removeEventListener?.('fbe-agenda', otra);
  }, []);
  // (recordada: al volver a Hoy enseguida no se pide otra vez; al cambiar algo, «fbe-agenda» la vuelve a leer)
  return useCarga(() => (activa ? api.agenda(atletaId).catch(() => null) : Promise.resolve(null)), [atletaId, activa, vuelta], { recuerdo: activa ? `agenda:${atletaId || api.uid() || ''}` : null });
}

// ---------- En Hoy: lo de su vida ----------
export function TarjetaVida({ sesiones = [] }) {
  const { api, atleta, propio, aviso } = useApp();
  const trato = useTrato();
  const agenda = useAgenda(null, { activa: !propio && atleta?.estado !== 'baja' });
  const hoy = hoyISO();
  const lista = agenda.datos || [];
  const evHoy = eventoDeHoy(lista, hoy, trato);
  const preg = preguntaPendiente(lista, hoy);
  const dificil = semanaDificil(lista, hoy);
  const choques = choquesGuardia(lista, sesiones, hoy);
  const pendientes = sesiones.filter((s) => !s.completada).map((s) => s.id).join();
  const obl = useCarga(() => (dificil && pendientes ? api.obligatoriosDe(pendientes.split(',')).catch(() => []) : Promise.resolve([])), [dificil?.id, pendientes]);
  const [nota, setNota] = useState('');
  const [eligiendo, setEligiendo] = useState(null);
  if (!agenda.datos || (!evHoy && !preg && !dificil && !choques.length)) return null;
  const minimo = dificil ? minimoDeSemana(sesiones.map((s) => ({ ...s, ejercicios: (obl.datos || []).filter((x) => x.sesion_id === s.id).map((x) => ({ nombre: x.nombre, prioridad: 'alta' })) }))) : [];
  const responder = async (r) => {
    try { await api.responderAgenda(preg.id, r, nota.trim() || null); vibrar('hecho'); aviso('Gracias: tu coach lo verá'); setEligiendo(null); setNota(''); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <section class="panel panel-pad tarjeta-vida pila-s" aria-label="Tu vida">
      {evHoy && <p class="vida-fila"><Icono n="calendario" /><strong>{evHoy.texto}</strong></p>}
      {preg && (
        <div class="vida-pregunta pila-xs" role="group" aria-label={preg.pregunta}>
          <p class="vida-fila"><Imagen id="vida-que-tal" clase="ico-ilu" tamanos="44px" alternativa={<Icono n="mensaje" />} /><strong>{preg.pregunta}</strong></p>
          <div class="segmentos" role="group" aria-label="Qué tal fue">
            {RESPUESTAS.map(([k, n]) => <button key={k} type="button" aria-pressed={eligiendo === k ? 'true' : 'false'} onClick={() => setEligiendo(k)}>{n}</button>)}
          </div>
          {eligiendo && (
            <>
              <label class="sr" for="vida-nota">Si quieres, cuéntalo</label>
              <input id="vida-nota" class="entrada" maxLength={300} placeholder="Si quieres, cuéntalo (lo verá tu coach)" value={nota} onInput={(e) => setNota(e.currentTarget.value)} />
              <button type="button" class="btn btn-primario btn-peq" onClick={() => responder(eligiendo)}>Contestar</button>
            </>
          )}
        </div>
      )}
      {dificil && (
        <div class="vida-dificil pila-xs">
          <p class="vida-fila"><Icono n="escudo" /><span><strong>Semana difícil.</strong> Si solo te da para lo obligatorio, con eso vale. Tu sesión no cambia: es un consejo.</span></p>
          {minimo.length > 0 && <ul class="vida-minimo">{minimo.map((s) => <li key={s.id}><strong>{s.nombre}</strong>: {s.obligatorios.join(', ')}</li>)}</ul>}
        </div>
      )}
      {choques.map((c) => <p key={`${c.id}-${c.que}`} class="vida-fila vida-guardia"><Icono n="alerta" /><span>{c.texto}</span></p>)}
    </section>
  );
}

// «Esta semana va a ser difícil» (al pie de Hoy): se apunta y, si quiere, se le avisa al coach con un mensaje
export function BotonSemanaDificil() {
  const { atleta, propio } = useApp();
  const agenda = useAgenda(null, { activa: !propio && atleta?.estado !== 'baja' });
  const [abierta, setAbierta] = useState(false);
  if (propio || atleta?.estado === 'baja' || !agenda.datos || semanaDificil(agenda.datos, hoyISO())) return null;
  return (
    <>
      <button type="button" class="btn-texto" onClick={() => setAbierta(true)}><Icono n="escudo" /> Esta semana va a ser difícil</button>
      {abierta && <HojaSemanaDificil alCerrar={() => setAbierta(false)} />}
    </>
  );
}
function HojaSemanaDificil({ alCerrar }) {
  const { api, atleta, aviso } = useApp();
  const [motivo, setMotivo] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarAgenda(null, { tipo: 'dificil', fecha: lunesDe(hoyISO()), nota: motivo.trim() || null });
      if (avisar) await api.enviarMensaje(atleta.id, { autor: 'atleta', texto: mensajeSemanaDificil(motivo) }).catch(() => {});
      vibrar('hecho'); aviso(avisar ? 'Apuntado, y avisado tu coach' : 'Apuntado'); alCerrar();
    } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Una semana difícil" alCerrar={alCerrar}>
      <div class="pila">
        <Imagen id="semana-dificil" clase="franja-ilu franja-hoja" tamanos="(min-width: 640px) 560px, 92vw" />
        <p class="peq secundario">Pasa. Esta semana, si solo te da para lo obligatorio de cada sesión, con eso vale: te lo dejamos a mano en Hoy. Tu programación no cambia.</p>
        <div class="campo"><label for="dificil-motivo">¿Por qué? <span class="secundario">(opcional)</span></label>
          <input id="dificil-motivo" class="entrada" maxLength={120} placeholder="Exámenes, guardias, un viaje…" value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} /></div>
        <label class="fila-s"><input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.currentTarget.checked)} /> Avisar a mi coach con un mensaje</label>
        <button type="button" class="btn btn-primario" disabled={guardando} onClick={guardar}>Apuntarlo</button>
      </div>
    </Hoja>
  );
}

// ---------- En «Lo tuyo»: lo que viene en tu vida ----------
export function HojaAgenda({ alCerrar }) {
  const { api, aviso } = useApp();
  const agenda = useAgenda();
  const hoy = hoyISO();
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const lista = proximos(agenda.datos || [], hoy, 730);
  const anadir = async () => {
    setGuardando(true);
    try { await api.guardarAgenda(null, { tipo: 'evento', fecha, titulo }); setTitulo(''); setFecha(''); vibrar('hecho'); } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Lo que viene en tu vida" alCerrar={alCerrar}>
      <div class="pila agenda-hoja">
        <Imagen id="vida-agenda" clase="franja-ilu franja-hoja" tamanos="(min-width: 640px) 560px, 92vw" />
        <p class="peq secundario">Exámenes, una boda, una mudanza, un viaje… La app lo tiene en cuenta (te anima ese día y luego te pregunta qué tal) y tu coach lo verá. Tu programación no cambia.</p>
        {lista.length > 0 ? (
          <ul class="lista agenda-lista">
            {lista.map((x) => (
              <li key={x.id} class="agenda-fila">
                <span class="pila-xs"><strong>{x.titulo}</strong><span class="mini secundario">{fmtCorta(x.fecha)}{x.autor === 'coach' ? ' · lo apuntó tu coach' : ''}</span></span>
                {x.autor === 'atleta' && <button type="button" class="btn btn-icono plano" aria-label={`Quitar ${x.titulo}`} onClick={() => api.borrarAgenda(x.id).catch((e) => aviso(e.message, 'error'))}><Icono n="basura" /></button>}
              </li>
            ))}
          </ul>
        ) : <p class="peq terciario">Nada apuntado todavía.</p>}
        <div class="campo"><label for="agenda-titulo">Qué</label>
          <input id="agenda-titulo" class="entrada" maxLength={80} placeholder="El examen de la oposición" value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} /></div>
        <div class="campo"><label for="agenda-fecha">Cuándo</label>
          <input id="agenda-fecha" class="entrada" type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} /></div>
        <button type="button" class="btn btn-primario" disabled={guardando || !titulo.trim() || !fecha} onClick={anadir}>Apuntarlo</button>
      </div>
    </Hoja>
  );
}

// ---------- En «Lo tuyo»: tus guardias (o turnos) ----------
export function HojaGuardias({ alCerrar }) {
  const { api, aviso } = useApp();
  const agenda = useAgenda();
  const hoy = hoyISO();
  const [fecha, setFecha] = useState('');
  const dias = guardiasProximas(agenda.datos || [], hoy, 120);
  const porFecha = Object.fromEntries((agenda.datos || []).filter((x) => x.tipo === 'guardia').map((x) => [x.fecha, x]));
  const anadir = async () => {
    try { await api.guardarAgenda(null, { tipo: 'guardia', fecha }); setFecha(''); vibrar('hecho'); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <Hoja titulo="Tus guardias o turnos" alCerrar={alCerrar}>
      <div class="pila">
        <Imagen id="guardias" clase="franja-ilu franja-hoja" tamanos="(min-width: 640px) 560px, 92vw" />
        <p class="peq secundario">Apunta tus guardias (o turnos de noche). Si te toca entrenar ese día o al salir de una, en Hoy te lo decimos para que, si quieres, cambies la sesión de día. Nunca la movemos solos.</p>
        {dias.length > 0 ? <div class="guardias-dias">{dias.map((d) => (
          <span key={d} class="chip-guardia">{fmtCorta(d)}<button type="button" class="btn btn-icono plano" aria-label={`Quitar la guardia del ${fmtCorta(d)}`} onClick={() => api.borrarAgenda(porFecha[d]?.id).catch((e) => aviso(e.message, 'error'))}><Icono n="cerrar" /></button></span>
        ))}</div> : <p class="peq terciario">Ninguna apuntada.</p>}
        <div class="campo"><label for="guardia-fecha">Añadir una guardia</label>
          <span class="fila-s"><input id="guardia-fecha" class="entrada" type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
            <button type="button" class="btn" disabled={!fecha} onClick={anadir}>Añadir</button></span></div>
      </div>
    </Hoja>
  );
}

// ---------- En el check-in: lo de la semana pasada ----------
export function SeguimientoCheckin({ id, anterior, molestias }) {
  const t = seguimientoCheckin(id, anterior, molestias);
  return t ? <p class="ck-seguimiento"><Icono n="historial" /><span>{t}</span></p> : null;
}

// ---------- En la ficha del coach: su vida ----------
export function SuVida({ atleta }) {
  const { api, aviso } = useApp();
  const agenda = useAgenda(atleta.id);
  const hoy = hoyISO();
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  if (!agenda.datos) return null;
  const lista = agenda.datos;
  const futuros = proximos(lista, hoy, 120);
  const contestados = lista.filter((x) => x.respuesta).slice(-3).reverse();
  const dificil = semanaDificil(lista, hoy);
  const guardias = guardiasProximas(lista, hoy, 30);
  const anadir = async () => {
    try { await api.guardarAgenda(atleta.id, { tipo: 'evento', fecha, titulo }); setTitulo(''); setFecha(''); aviso('Apuntado: la app se lo tendrá en cuenta'); } catch (e) { aviso(e.message, 'error'); }
  };
  const RESP = { bien: 'bien', regular: 'regular', mal: 'mal' };
  return (
    <div class="su-vida pila-s">
      <span class="t-sobre">Su vida</span>
      {dificil && <p class="vida-fila"><Icono n="escudo" /><span><strong>Esta semana, difícil</strong>{dificil.nota ? ` (${dificil.nota})` : ''}.</span></p>}
      {futuros.length > 0 && <ul class="vida-minimo">{futuros.map((x) => <li key={x.id}>{fmtCorta(x.fecha)}: {x.titulo}</li>)}</ul>}
      {contestados.map((x) => <p key={x.id} class="peq">«{x.titulo}»: fue {RESP[x.respuesta]}{x.respuesta_nota ? ` («${x.respuesta_nota}»)` : ''}.</p>)}
      {guardias.length > 0 && <p class="peq secundario">Guardias: {guardias.map((d) => fmtCorta(d)).join(', ')}.</p>}
      {!futuros.length && !contestados.length && !dificil && !guardias.length && <p class="peq terciario">Nada apuntado de su vida.</p>}
      <details class="su-vida-anadir">
        <summary class="btn-texto"><Icono n="mas" /> Apuntar algo de su vida</summary>
        <div class="pila-s">
          <input class="entrada" aria-label="Qué" maxLength={80} placeholder="Su boda" value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
          <input class="entrada" aria-label="Cuándo" type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
          <button type="button" class="btn btn-peq" disabled={!titulo.trim() || !fecha} onClick={anadir}>Apuntarlo</button>
        </div>
      </details>
    </div>
  );
}
