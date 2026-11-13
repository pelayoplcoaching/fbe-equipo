// La personalización vista por el coach (v0.104, migración 050):
//   · CumplesHoy: en Atletas, quién cumple años hoy (con un toque, su ficha)
//   · LoSuyo: en la ficha, cómo quiere que le llamemos, su porqué, su cumpleaños y su música
//   · MensajesAutomaticos: en su cuenta, lo que les sale a sus atletas en los momentos importantes
//   · MusicaCoach y CampoMusica: las listas que enlaza (en su cuenta) y la de una sesión o un bloque (en el editor)
//     (v0.129: con el nombre y la portada de cada lista, y su ficha al pegar el enlace)
import { useState } from 'preact/hooks';
import { Fragment } from 'preact';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { ZONAS_AVISO, NOMBRE_ZONA_TU, EJEMPLO_ZONA, momentoZona } from '../../logica/conocerte.js';
import { paraHablarle, cartaDelMes, mesDeLaCarta } from '../../logica/retrato.js';
import { SuVida } from '../atleta/Vida.jsx';
import { esCumple, MOMENTOS_COACH, LIMITES, mensajeDe, textoMensajeCoach, nombreMusica, urlMusica } from '../../logica/personal.js';
import { FAMILIAS_MUSICA, tipoMusica } from '../../logica/musica.js';
import { NombreLista, FichaPrevia, useFicha } from '../atleta/Musica.jsx';
import { MESES_LARGOS } from '../../logica/mes.js';
import { hoyISO } from '../../logica/fechas.js';
import { useContactos, BotonWhatsApp } from './Integraciones.jsx';

const textoCumple = (p) => (p?.cumple_mes && p?.cumple_dia ? `${p.cumple_dia} de ${MESES_LARGOS[p.cumple_mes - 1]}` : null);

export function CumplesHoy({ lista = [], abrir }) {
  const { api } = useApp();
  // (v0.117) recordado: al volver a Atletas, el aviso del cumpleaños sale con la lista y no la empuja al llegar
  const personal = useCarga(() => api.personalAtletas().catch(() => []), [], { recuerdo: `personal-atletas:${api.uid()}` });
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
  if (!p || (!p.apodo && !p.porque && !p.cumple_mes && !p.musica_url && !p.cancion_url)) return null;
  return (
    <section class="seccion lo-suyo">
      <h2>Lo suyo</h2>
      <div class="panel panel-pad pila-s">
        {p.porque && <p class="lo-suyo-porque"><span class="t-sobre">Su porqué</span>«{p.porque}»</p>}
        <dl class="lo-suyo-datos">
          {p.apodo && <><dt>Quiere que le llamen</dt><dd>{p.apodo}</dd></>}
          {p.cumple_mes && <><dt>Cumpleaños</dt><dd>{textoCumple(p)}{esCumple(p, hoyISO()) ? ' (¡hoy!)' : ''}</dd></>}
          {/* (v0.129) el nombre de su lista (y su canción de récord), y se abre con un toque */}
          {p.musica_url && <><dt>Entrena con</dt><dd><a href={p.musica_url} target="_blank" rel="noopener noreferrer" class="lo-suyo-musica"><NombreLista url={p.musica_url} /></a></dd></>}
          {p.cancion_url && <><dt>Su canción de récord</dt><dd><a href={p.cancion_url} target="_blank" rel="noopener noreferrer" class="lo-suyo-musica"><NombreLista url={p.cancion_url} /></a></dd></>}
        </dl>
      </div>
    </section>
  );
}

// (personalización 2, tanda 4) «Para hablarle»: todo lo que hace falta para escribirle de un vistazo (cómo le llamamos y
// le hablamos, su porqué, su meta, su último hito, cuándo le escribiste) y una idea; y la carta del mes, en borrador.
export function ParaHablarle({ atleta }) {
  const { api } = useApp();
  const d = useCarga(() => Promise.all([
    api.personalAtletas().catch(() => []), api.entrenamientos(atleta.id).catch(() => []), api.ultimoDelCoach(atleta.id).catch(() => null),
  ]), [atleta.id]);
  const [carta, setCarta] = useState(false);
  if (!d.datos) return null;
  const [lista, entrenos, ultimo] = d.datos;
  const personal = (lista || []).find((x) => x.atleta_id === atleta.id) || null;
  const hoy = hoyISO();
  const r = paraHablarle({ nombre: atleta.nombre, personal, entrenos, ultimoCoach: ultimo, hoy });
  const mes = mesDeLaCarta(hoy);
  return (
    <section class="seccion para-hablarle" aria-labelledby="para-hablarle-t">
      <h2 id="para-hablarle-t">Para hablarle</h2>
      <div class="panel panel-pad pila-s">
        <dl class="lo-suyo-datos">{r.filas.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        <SuVida atleta={atleta} />
        <p class="para-hablarle-idea"><Icono n="mensaje" /><span><strong>Idea: </strong>{r.idea}</span></p>
        <button type="button" class="btn btn-peq" onClick={() => setCarta(true)}><Icono n="editar" /> La carta de {nombreMesCarta(mes)}</button>
      </div>
      {carta && <HojaCarta atleta={atleta} personal={personal} entrenos={entrenos} mes={mes} alCerrar={() => setCarta(false)} />}
    </section>
  );
}
const MESES_CARTA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMesCarta = (mes) => MESES_CARTA[Number(String(mes).slice(5, 7)) - 1] || 'este mes';

function HojaCarta({ atleta, personal, entrenos, mes, alCerrar }) {
  const { api, aviso } = useApp();
  const [tono, setTono] = useState(personal?.tono || 'cercano');
  const borrador = (tn) => cartaDelMes({ nombre: atleta.nombre, personal, entrenos, mes, hoy: hoyISO(), tono: tn });
  const [texto, setTexto] = useState(() => borrador(personal?.tono || 'cercano'));
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const cambiarTono = (tn) => { setTono(tn); if (!tocado) setTexto(borrador(tn)); };
  const enviar = async () => {
    setEnviando(true);
    try { await api.enviarMensaje(atleta.id, { autor: 'coach', texto: texto.trim() }); aviso('Carta enviada'); alCerrar(); } catch (e) { aviso(e.message, 'error'); } finally { setEnviando(false); }
  };
  return (
    <Hoja titulo={`La carta de ${nombreMesCarta(mes)}`} alCerrar={alCerrar}>
      <div class="pila carta-hoja">
        <p class="peq secundario">Un borrador con sus datos del mes, su porqué y su meta. Léelo, tócalo y mándalo: le llega como un mensaje tuyo.</p>
        <div class="segmentos" role="group" aria-label="Tono">
          {[['cercano', 'Cercano'], ['directo', 'Directo'], ['tope', 'A tope']].map(([k, n]) => <button key={k} type="button" aria-pressed={tono === k ? 'true' : 'false'} onClick={() => cambiarTono(k)}>{n}</button>)}
        </div>
        <label class="sr" for="carta-texto">La carta</label>
        <textarea id="carta-texto" class="entrada" rows={12} value={texto} onInput={(e) => { setTexto(e.currentTarget.value); setTocado(true); }} />
        <button type="button" class="btn btn-primario btn-grande" disabled={enviando || !texto.trim()} onClick={enviar}><Icono n="enviar" /> Enviar a {personal?.apodo || atleta.nombre.split(' ')[0]}</button>
      </div>
    </Hoja>
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
                <button class="fila-ios fila-boton" data-m={k} onClick={() => setEditar(k)} aria-label={`${titulo}: ${t ? 'cambiar el mensaje' : 'escribir un mensaje'}`}>
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
      <p class="mini terciario">Salen solos, con tu foto, en ese momento: en el resumen de una sesión con récord, al abrir el informe de un bloque terminado, en el hito de la racha, en la bienvenida del día (si vuelve tras una semana o más, el día de su cumpleaños o a una semana de su meta), en la tarjeta de su aniversario, en un ejercicio que hace por primera vez y en la primera sesión en el gimnasio tras entrenar de viaje. Pon {'{nombre}'} y la app pone el suyo (o cómo quiere que le llamen); en el récord y la primera vez, {'{ejercicio}'}; en la racha, {'{semanas}'}; en el aniversario, {'{tiempo}'}; en la meta, {'{meta}'}.</p>
      {editar && <HojaMensaje momento={editar} actual={mensajeDe(lista.datos, editar) || ''} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); lista.recargar(true); }} />}
    </section>
  );
}

// (personalización 2, tanda 3; migración 066) El aviso de cada zona: al atleta que dijo en el cuestionario que le molesta
// (y con su consentimiento de salud), en los ejercicios que la cargan. Hasta que lo escribas o apruebes, no sale nada.
export function AvisosZona() {
  const { api } = useApp();
  const lista = useCarga(() => api.mensajesCoach().catch(() => null), []);
  const [editar, setEditar] = useState(null);
  if (lista.datos === null && !lista.cargando) return null;
  return (
    <section class="seccion avisos-zona">
      <h2>Avisos por zona</h2>
      <div class="panel">
        <ul class="lista">
          {ZONAS_AVISO.map((z) => {
            const t = mensajeDe(lista.datos, momentoZona(z));
            return (
              <li key={z}>
                <button class="fila-ios fila-boton" data-zona={z} onClick={() => setEditar(z)} aria-label={`${NOMBRE_ZONA_TU[z]}: ${t ? 'cambiar el aviso' : 'escribir el aviso'}`}>
                  <span class="fila-ios-texto">
                    <span class="fila-ios-titulo">{NOMBRE_ZONA_TU[z].replace(/^Tu /, '').replace(/^./, (c) => c.toLocaleUpperCase('es'))}</span>
                    <span class="peq terciario">{t || 'Sin aviso: no sale nada'}</span>
                  </span>
                  <Icono n="editar" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p class="mini terciario">Sale en la sesión, en los ejercicios que cargan esa zona, solo a quien dijo en el cuestionario que le molesta y ha dado el consentimiento de datos de salud. Es consejo: no cambia tu pauta.</p>
      {editar && <HojaMensaje momento={momentoZona(editar)} titulo={`Aviso: ${NOMBRE_ZONA_TU[editar].replace(/^Tu /, '').toLocaleLowerCase('es')}`} ejemplo={EJEMPLO_ZONA[editar]}
        prefijo={`${NOMBRE_ZONA_TU[editar]}: `} actual={mensajeDe(lista.datos, momentoZona(editar)) || ''} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); lista.recargar(true); }} />}
    </section>
  );
}

function HojaMensaje({ momento, actual, alCerrar, alGuardar, titulo: tituloDado = null, ejemplo: ejemploDado = null, prefijo = '' }) {
  const { api, aviso } = useApp();
  const [, tituloM, ejemploM] = MOMENTOS_COACH.find(([k]) => k === momento) || [];
  const titulo = tituloDado || tituloM, ejemplo = ejemploDado || ejemploM;
  const [t, setT] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  // (los avisos por zona van tal cual, detrás de «Tu hombro: »)
  const muestra = prefijo ? (t.trim() || null) : textoMensajeCoach(t || '', { nombre: 'Ana', ejercicio: 'press banca', semanas: 8, tiempo: '6 meses', meta: 'su competición' });
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
        {muestra && <figure class="cita-coach mensaje-coach muestra"><div><blockquote>{prefijo}{muestra}</blockquote><figcaption>Así lo verá Ana</figcaption></div></figure>}
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
                <button class="fila-ios fila-boton" data-m={k.split(':')[0]} onClick={() => setEditar([k, t])} aria-label={`${t}: ${m[k] ? 'cambiar la lista' : 'enlazar una lista'}`}>
                  {m[k] && <MiniPortada url={m[k]} />}
                  <span class="fila-ios-texto"><span class="fila-ios-titulo">{t}</span><span class="peq terciario musica-coach-nombre">{m[k] ? <NombreLista url={m[k]} /> : 'Sin lista'}</span></span>
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
          {!mal && <FichaPrevia url={u} />}
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
        <Icono n="altavoz" /> {url ? <>{etiqueta}: <NombreLista url={url} /></> : `Añadir ${etiqueta.toLowerCase()}`}
      </button>
      {editar && <HojaEnlaceMusica clave={clave} titulo={etiqueta} actual={url || ''} alCerrar={() => setEditar(false)} alGuardar={() => { setEditar(false); lista.recargar(true); }} />}
    </>
  );
}

// (v0.129) La portada pequeña de una lista enlazada (si Spotify la da)
function MiniPortada({ url }) {
  const f = useFicha(url);
  return f.datos?.thumb ? <img class="musica-coach-portada" src={f.datos.thumb} alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer" />
    : <span class="musica-coach-portada sin" aria-hidden="true" title={tipoMusica(url) || nombreMusica(url)}><Icono n="altavoz" /></span>;
}
