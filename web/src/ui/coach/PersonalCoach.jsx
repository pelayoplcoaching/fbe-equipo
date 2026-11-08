// La personalización vista por el coach (v0.104, migración 050):
//   · CumplesHoy: en Atletas, quién cumple años hoy (con un toque, su ficha)
//   · LoSuyo: en la ficha, cómo quiere que le llamemos, su porqué, su cumpleaños y su música
//   · MensajesAutomaticos: en su cuenta, lo que les sale a sus atletas en los momentos importantes
//   · MusicaCoach y CampoMusica: las listas que enlaza (en su cuenta) y la de una sesión o un bloque (en el editor)
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { esCumple, MOMENTOS_COACH, LIMITES, mensajeDe, textoMensajeCoach, nombreMusica, urlMusica } from '../../logica/personal.js';
import { FAMILIAS_MUSICA } from '../../logica/musica.js';
import { MESES_LARGOS } from '../../logica/mes.js';
import { hoyISO } from '../../logica/fechas.js';
import { useContactos, BotonWhatsApp } from './Integraciones.jsx';

const textoCumple = (p) => (p?.cumple_mes && p?.cumple_dia ? `${p.cumple_dia} de ${MESES_LARGOS[p.cumple_mes - 1]}` : null);

export function CumplesHoy({ lista = [], abrir }) {
  const { api } = useApp();
  const personal = useCarga(() => api.personalAtletas().catch(() => []), []);
  const hoy = hoyISO();
  const activos = new Map(lista.filter((r) => r.estado !== 'baja').map((r) => [r.atleta_id, r]));
  const cumplen = (personal.datos || []).filter((p) => activos.has(p.atleta_id) && esCumple(p, hoy)).map((p) => activos.get(p.atleta_id));
  // (v0.105) con su teléfono, felicitarle por WhatsApp con un toque (con tu mensaje de cumpleaños, si lo escribiste)
  const contactos = useContactos([cumplen.length > 0]);
  const mensajes = useCarga(() => (cumplen.length ? api.mensajesCoach().catch(() => []) : Promise.resolve([])), [cumplen.length > 0]);
  if (!cumplen.length) return null;
  const felicitar = (r) => {
    const p = (personal.datos || []).find((x) => x.atleta_id === r.atleta_id);
    const nombre = p?.apodo || (r.nombre || '').split(' ')[0];
    return textoMensajeCoach(mensajeDe(mensajes.datos, 'cumple') || '¡Feliz cumpleaños, {nombre}!', { nombre });
  };
  const conTel = cumplen.filter((r) => contactos.datos?.[r.atleta_id]);
  return (
    <div class="nota cumples-hoy" role="status">
      <Icono n="estrella" />
      <span>{cumplen.length === 1 ? 'Hoy cumple años ' : 'Hoy cumplen años '}
        {cumplen.map((r, i) => (
          <span key={r.atleta_id}>{i > 0 && (i === cumplen.length - 1 ? ' y ' : ', ')}<button class="btn-texto" onClick={() => abrir?.(r.atleta_id)}>{r.nombre}</button></span>
        ))}. La app ya le felicita; si quieres, escríbele.
        {conTel.length > 0 && <span class="fila-envolver cumples-wa">{conTel.map((r) => <BotonWhatsApp key={r.atleta_id} telefono={contactos.datos[r.atleta_id]} texto={felicitar(r)} etiqueta={conTel.length > 1 ? `Felicitar a ${(r.nombre || '').split(' ')[0]}` : 'Felicitarle por WhatsApp'} />)}</span>}
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

// ---------- La música que enlaza el coach (en su cuenta) ----------
// Una lista por tipo de sesión (la app ofrece a cada atleta la que va con su sesión), la de las semanas de descarga,
// la colaborativa del equipo y una por cada cardio, a su ritmo. Lo de una sesión o un bloque, en el editor.
const GRUPOS_MUSICA = [
  ['Por tipo de sesión', FAMILIAS_MUSICA.map(([k, t]) => [`familia:${k}`, t])],
  ['Otras', [['descarga', 'Semanas de descarga'], ['equipo', 'La lista del equipo (colaborativa)']]],
  ['Al ritmo de cada cardio', [['ritmo:carrera', 'Carrera'], ['ritmo:andar', 'Andar'], ['ritmo:bici', 'Bici'], ['ritmo:eliptica', 'Elíptica'], ['ritmo:remo', 'Remo'], ['ritmo:cuerda', 'Comba']]],
];
export function MusicaCoach() {
  const { api } = useApp();
  const lista = useCarga(() => api.musicaCoach().catch(() => null), []);
  const [editar, setEditar] = useState(null);
  if (lista.datos === null && !lista.cargando) return null;
  const m = lista.datos || {};
  return (
    <section class="seccion musica-coach">
      <h2>Música</h2>
      {GRUPOS_MUSICA.map(([titulo, claves]) => (
        <div class="panel" key={titulo}>
          <div class="panel-pad peq secundario recursos-cab">{titulo}</div>
          <ul class="lista">
            {claves.map(([k, t]) => (
              <li key={k}>
                <button class="fila-ios fila-boton" onClick={() => setEditar([k, t])} aria-label={`${t}: ${m[k] ? 'cambiar la lista' : 'enlazar una lista'}`}>
                  <span class="fila-ios-texto"><span class="fila-ios-titulo">{t}</span><span class="peq terciario">{m[k] ? nombreMusica(m[k]) : 'Sin lista'}</span></span>
                  <Icono n={m[k] ? 'editar' : 'mas'} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p class="mini terciario">Crea las listas en tu Spotify (o Apple Music, YouTube Music…) y pega aquí su enlace. Cada atleta ve en la portada de su sesión la que le toca, después de la suya; la del equipo sale en Equipo. Para una sesión o un bloque concretos, en el editor del programa. Nadie tiene que iniciar sesión con Spotify en la app.</p>
      {editar && <HojaEnlaceMusica clave={editar[0]} titulo={editar[1]} actual={m[editar[0]] || ''} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); lista.recargar(true); }} />}
    </section>
  );
}

export function HojaEnlaceMusica({ clave, titulo, actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [u, setU] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const mal = u.trim() && !urlMusica(u);
  const guardar = async (url) => {
    setGuardando(true);
    try { await api.guardarMusicaCoach(clave, url); aviso(url.trim() ? 'Lista enlazada' : 'Lista quitada'); alGuardar(); } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); if (!mal) guardar(u); }}>
        <div class="campo">
          <label for="musica-enlace">Enlace</label>
          <input id="musica-enlace" class="entrada" type="url" inputMode="url" value={u} onInput={(e) => setU(e.currentTarget.value)} placeholder="https://open.spotify.com/playlist/…" autoFocus aria-invalid={mal ? 'true' : undefined} />
          <span class={mal ? 'error-campo' : 'ayuda'}>{mal ? 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.' : 'Una lista, un álbum o un episodio de podcast (para el cardio largo).'}</span>
        </div>
        <button class="btn btn-primario btn-grande" disabled={guardando || mal}><Icono n="hecho" /> Guardar</button>
        {actual && <button type="button" class="btn plano" disabled={guardando} onClick={() => guardar('')}>Quitar la lista</button>}
      </form>
    </Hoja>
  );
}

// En el editor del programa: la música de una sesión o de un bloque (clave sesion:<id> o bloque:<id>)
export function CampoMusica({ clave, etiqueta = 'Música' }) {
  const { api } = useApp();
  const lista = useCarga(() => api.musicaCoach().catch(() => null), []);
  const [editar, setEditar] = useState(false);
  if (!lista.datos) return null;
  const url = lista.datos[clave];
  return (
    <>
      <button type="button" class="btn-texto campo-musica" style="justify-self:start" onClick={() => setEditar(true)}>
        <Icono n="altavoz" /> {url ? `${etiqueta}: ${nombreMusica(url)}` : `Añadir ${etiqueta.toLowerCase()}`}
      </button>
      {editar && <HojaEnlaceMusica clave={clave} titulo={etiqueta} actual={url || ''} alCerrar={() => setEditar(false)} alGuardar={() => { setEditar(false); lista.recargar(true); }} />}
    </>
  );
}
