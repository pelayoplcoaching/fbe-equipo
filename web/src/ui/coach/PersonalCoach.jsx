// La personalización vista por el coach (v0.104, migración 050):
//   · CumplesHoy: en Atletas, quién cumple años hoy (con un toque, su ficha)
//   · LoSuyo: en la ficha, cómo quiere que le llamemos, su porqué, su cumpleaños y su música
//   · MensajesAutomaticos: en su cuenta, lo que les sale a sus atletas en los momentos importantes
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { esCumple, MOMENTOS_COACH, LIMITES, mensajeDe, textoMensajeCoach, nombreMusica } from '../../logica/personal.js';
import { MESES_LARGOS } from '../../logica/mes.js';
import { hoyISO } from '../../logica/fechas.js';

const textoCumple = (p) => (p?.cumple_mes && p?.cumple_dia ? `${p.cumple_dia} de ${MESES_LARGOS[p.cumple_mes - 1]}` : null);

export function CumplesHoy({ lista = [], abrir }) {
  const { api } = useApp();
  const personal = useCarga(() => api.personalAtletas().catch(() => []), []);
  const hoy = hoyISO();
  const activos = new Map(lista.filter((r) => r.estado !== 'baja').map((r) => [r.atleta_id, r]));
  const cumplen = (personal.datos || []).filter((p) => activos.has(p.atleta_id) && esCumple(p, hoy)).map((p) => activos.get(p.atleta_id));
  if (!cumplen.length) return null;
  return (
    <div class="nota cumples-hoy" role="status">
      <Icono n="estrella" />
      <span>{cumplen.length === 1 ? 'Hoy cumple años ' : 'Hoy cumplen años '}
        {cumplen.map((r, i) => (
          <span key={r.atleta_id}>{i > 0 && (i === cumplen.length - 1 ? ' y ' : ', ')}<button class="btn-texto" onClick={() => abrir?.(r.atleta_id)}>{r.nombre}</button></span>
        ))}. La app ya le felicita; si quieres, escríbele.
      </span>
    </div>
  );
}

export function LoSuyo({ atletaId }) {
  const { api } = useApp();
  const personal = useCarga(() => api.personalAtletas().catch(() => []), [atletaId]);
  const p = (personal.datos || []).find((x) => x.atleta_id === atletaId);
  if (!p || (!p.apodo && !p.porque && !p.cumple_mes && !p.musica_url)) return null;
  return (
    <section class="seccion lo-suyo">
      <h2>Lo suyo</h2>
      <div class="panel panel-pad pila-s">
        {p.porque && <p class="lo-suyo-porque"><span class="t-sobre">Su porqué</span>«{p.porque}»</p>}
        <dl class="lo-suyo-datos">
          {p.apodo && <><dt>Quiere que le llamen</dt><dd>{p.apodo}</dd></>}
          {p.cumple_mes && <><dt>Cumpleaños</dt><dd>{textoCumple(p)}{esCumple(p, hoyISO()) ? ' (¡hoy!)' : ''}</dd></>}
          {p.musica_url && <><dt>Entrena con</dt><dd>{nombreMusica(p.musica_url)}</dd></>}
        </dl>
      </div>
    </section>
  );
}

export function MensajesAutomaticos() {
  const { api } = useApp();
  const lista = useCarga(() => api.mensajesCoach().catch(() => null), []);
  const [editar, setEditar] = useState(null);
  if (lista.datos === null && !lista.cargando) return null;
  return (
    <section class="seccion mensajes-automaticos">
      <h2>Mensajes automáticos</h2>
      <div class="panel">
        <ul class="lista">
          {MOMENTOS_COACH.map(([k, titulo]) => {
            const t = mensajeDe(lista.datos, k);
            return (
              <li key={k}>
                <button class="fila-ios fila-boton" onClick={() => setEditar(k)} aria-label={`${titulo}: ${t ? 'cambiar el mensaje' : 'escribir un mensaje'}`}>
                  <span class="fila-ios-texto">
                    <span class="fila-ios-titulo">{titulo}</span>
                    <span class="peq terciario">{t || 'Sin mensaje: no sale nada'}</span>
                  </span>
                  <Icono n="editar" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p class="mini terciario">Salen solos, con tu foto, en ese momento: en el resumen de una sesión con récord, al abrir el informe de un bloque terminado, en el hito de la racha y en la bienvenida del día (si vuelve tras una semana o más, o el día de su cumpleaños). Pon {'{nombre}'} y la app pone el suyo (o cómo quiere que le llamen); en el récord, {'{ejercicio}'}; en la racha, {'{semanas}'}.</p>
      {editar && <HojaMensaje momento={editar} actual={mensajeDe(lista.datos, editar) || ''} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); lista.recargar(true); }} />}
    </section>
  );
}

function HojaMensaje({ momento, actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [, titulo, ejemplo] = MOMENTOS_COACH.find(([k]) => k === momento);
  const [t, setT] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const muestra = textoMensajeCoach(t || '', { nombre: 'Ana', ejercicio: 'press banca', semanas: 8 });
  const guardar = async (texto) => {
    setGuardando(true);
    try { await api.guardarMensajeCoach(momento, texto); aviso(texto.trim() ? 'Mensaje guardado' : 'Mensaje quitado'); alGuardar(); } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); guardar(t); }}>
        <div class="campo">
          <label for="msg-coach">Tu mensaje</label>
          <textarea id="msg-coach" class="entrada" rows={4} maxLength={LIMITES.mensaje} value={t} onInput={(e) => setT(e.currentTarget.value)} placeholder={ejemplo} autoFocus />
          <span class="ayuda num">{t.trim().length} / {LIMITES.mensaje}</span>
        </div>
        {!t.trim() && <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => setT(ejemplo)}>Usar el de ejemplo</button>}
        {muestra && <figure class="cita-coach mensaje-coach muestra"><div><blockquote>{muestra}</blockquote><figcaption>Así lo verá Ana</figcaption></div></figure>}
        <button class="btn btn-primario btn-grande" disabled={guardando}><Icono n="hecho" /> Guardar</button>
        {actual && <button type="button" class="btn plano" disabled={guardando} onClick={() => guardar('')}>Quitar el mensaje</button>}
      </form>
    </Hoja>
  );
}
