// (música 3, tanda 3) La música con el equipo (migración 072). En Equipo:
//   · LoQueSuena: la canción que cada uno comparte (opcional; se quita cuando quiera y al salir de la comunidad), con
//     «La que más suena» si varios han puesto la misma
//   · RetoMusical: el reto del mes (el tema lo pone el coach): cada uno propone una canción y vota una de otro
//   · ListaPareja: la lista que comparten dos compañeros de racha (uno la pone; la ven los dos y les sale en la portada)
// Sin la 072, nada de esto sale.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { urlMusica, nombreMusica } from '../../logica/personal.js';
import { masRepetida } from '../../logica/musica.js';
import { FichaPrevia, useNombreLista, abrirMusica } from './Musica.jsx';

// Una fila de canción: su nombre (la ficha de Spotify) y de quién es, con «Abrir»
function FilaCancion({ url, quien, extra = null, destacada = false }) {
  const nombre = useNombreLista(url);
  return (
    <li class={`cancion-fila${destacada ? ' destacada' : ''}`}>
      <span class="cancion-ico" aria-hidden="true"><Icono n="altavoz" /></span>
      <span class="pila-xs cancion-texto"><strong>{nombre}</strong><span class="mini secundario">{quien}</span></span>
      {extra}
      <a class="btn btn-peq" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${nombre} en ${nombreMusica(url)}`} onClick={(e) => abrirMusica(url, e)}><Icono n="enlace" /></a>
    </li>
  );
}

// La hoja para poner un enlace (la usan las tres piezas)
function HojaEnlace({ titulo, texto, inicial = '', etiqueta = 'Enlace', soloCancion = false, alCerrar, alGuardar, alQuitar = null }) {
  const [u, setU] = useState(inicial || '');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const mal = u.trim() && urlMusica(u) === false;
  const guardar = (e) => { e.preventDefault(); if (!u.trim() || mal) return; una(async () => { try { await alGuardar(urlMusica(u)); } catch (err) { setError(err.message); } }); };
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <p class="peq secundario">{texto}</p>
        <div class="campo">
          <label for="hm-enlace">{etiqueta}</label>
          <input id="hm-enlace" class="entrada" type="url" inputMode="url" value={u} onInput={(e) => { setU(e.currentTarget.value); setError(null); }} placeholder={soloCancion ? 'https://open.spotify.com/track/…' : 'https://open.spotify.com/playlist/…'} aria-invalid={mal ? 'true' : undefined} />
          {mal ? <span class="error-campo">Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.</span> : <FichaPrevia url={u} cancion={soloCancion} />}
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primario btn-grande" disabled={ocupado || mal || !u.trim()}><Icono n="hecho" /> Guardar</button>
        {alQuitar && <button type="button" class="btn-texto peligro" disabled={ocupado} onClick={() => una(async () => { try { await alQuitar(); } catch (err) { setError(err.message); } })}>Quitarla</button>}
      </form>
    </Hoja>
  );
}

// ---------- Lo que suena en el equipo ----------
export function LoQueSuena({ cambios = 0 }) {
  const { api, aviso, perfil } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const [editar, setEditar] = useState(false);
  const l = useCarga(() => (api.cancionesEquipo ? api.cancionesEquipo().catch(() => null) : Promise.resolve(null)), [cambios, vuelta]);
  if (!l.datos) return null;
  const mia = l.datos.find((x) => x.yo);
  const top = masRepetida(l.datos.map((x) => x.url));
  const coach = perfil?.rol === 'coach';
  return (
    <section class="panel panel-pad pila-s lo-que-suena" aria-labelledby="lo-que-suena-t">
      <div class="separa">
        <h2 id="lo-que-suena-t" class="cp-t"><span aria-hidden="true">🎧 </span>Lo que suena en el equipo</h2>
        {!coach && <button type="button" class="btn btn-peq" onClick={() => setEditar(true)}>{mia ? 'Cambiar la mía' : <><Icono n="mas" /> Compartir la mía</>}</button>}
      </div>
      {l.datos.length ? (
        <ul class="lista canciones-lista">
          {l.datos.slice(0, 12).map((x) => <FilaCancion key={x.perfil_id} url={x.url} quien={x.yo ? 'Tú' : x.nombre} destacada={top && x.url === top.url}
            extra={top && x.url === top.url && top.n > 1 ? <span class="chip chip-peq cancion-top">La que más suena · {top.n}</span> : null} />)}
        </ul>
      ) : <p class="peq secundario">Nadie ha compartido la suya todavía. La canción que te hace levantar más: ¿cuál es?</p>}
      <p class="mini terciario">Solo la ve el equipo. Se quita cuando quieras (y al salir de la comunidad).</p>
      {editar && (
        <HojaEnlace titulo="Tu canción para el equipo" texto="La que te hace levantar más. La verán los del equipo con tu nombre de la comunidad." inicial={mia?.url} soloCancion
          alCerrar={() => setEditar(false)}
          alGuardar={async (url) => { await api.guardarCancionEquipo(url); aviso('Compartida con el equipo'); setEditar(false); setVuelta((v) => v + 1); }}
          alQuitar={mia ? async () => { await api.guardarCancionEquipo(null); aviso('Quitada'); setEditar(false); setVuelta((v) => v + 1); } : null} />
      )}
    </section>
  );
}

// ---------- El reto musical del mes ----------
export function RetoMusical({ cambios = 0 }) {
  const { api, aviso, perfil } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const [editar, setEditar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const r = useCarga(() => (api.retoMusical ? api.retoMusical().catch(() => null) : Promise.resolve(null)), [cambios, vuelta]);
  if (!r.datos) return null;
  const coach = perfil?.rol === 'coach';
  const mia = r.datos.canciones.find((x) => x.yo);
  const votar = (x) => una(async () => {
    try { await api.votarRetoMusical(r.datos.mi_voto === x.perfil_id ? null : x.perfil_id); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad pila-s reto-musical" aria-labelledby="reto-musical-t">
      <span class="t-sobre">El reto musical del mes</span>
      <h2 id="reto-musical-t" class="reto-musical-t">{r.datos.tema}</h2>
      {r.datos.canciones.length ? (
        <ul class="lista canciones-lista">
          {r.datos.canciones.map((x) => <FilaCancion key={x.perfil_id} url={x.url} quien={`${x.yo ? 'Tú' : x.nombre} · ${x.votos} ${x.votos === 1 ? 'voto' : 'votos'}`}
            extra={!x.yo && !coach ? <button type="button" class={`btn btn-peq ${r.datos.mi_voto === x.perfil_id ? 'btn-primario' : ''}`} disabled={ocupado} aria-pressed={r.datos.mi_voto === x.perfil_id ? 'true' : 'false'}
              aria-label={r.datos.mi_voto === x.perfil_id ? `Quitar tu voto a la canción de ${x.nombre}` : `Votar la canción de ${x.nombre}`} onClick={() => votar(x)}>{r.datos.mi_voto === x.perfil_id ? 'Tu voto' : 'Votar'}</button> : null} />)}
        </ul>
      ) : <p class="peq secundario">Aún no hay propuestas. ¿Abres tú?</p>}
      {!coach && <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => setEditar(true)}>{mia ? 'Cambiar mi propuesta' : <><Icono n="mas" /> Proponer una canción</>}</button>}
      <p class="mini terciario">Una propuesta y un voto por persona (no a la tuya). Se cierra al acabar el mes.</p>
      {editar && (
        <HojaEnlace titulo="Tu propuesta" texto={`Para «${r.datos.tema}»: una canción.`} inicial={mia?.url} soloCancion
          alCerrar={() => setEditar(false)}
          alGuardar={async (url) => { await api.cancionRetoMusical(url); aviso('Propuesta enviada'); setEditar(false); setVuelta((v) => v + 1); }}
          alQuitar={mia ? async () => { await api.cancionRetoMusical(null); aviso('Propuesta quitada'); setEditar(false); setVuelta((v) => v + 1); } : null} />
      )}
    </section>
  );
}

// ---------- La lista de una pareja de compañeros de racha ----------
// En cada pareja aceptada: su lista compartida (o «Poner vuestra lista»). listas: lo que devuelve api.listasCompaneros()
export function ListaPareja({ id, nombre, listas = [], alCambiar }) {
  const { api, aviso } = useApp();
  const [editar, setEditar] = useState(false);
  const url = listas.find((x) => x.id === id)?.url || null;
  const titulo = useNombreLista(url);
  return (
    <span class="cp-lista-musica">
      {url ? (
        <span class="mini">
          <Icono n="altavoz" /> Vuestra lista: <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => abrirMusica(url, e)}>{titulo}</a>
          {' · '}<button type="button" class="btn-texto" onClick={() => setEditar(true)}>Cambiar</button>
        </span>
      ) : <button type="button" class="btn-texto mini" onClick={() => setEditar(true)}><Icono n="altavoz" /> Poner vuestra lista</button>}
      {editar && (
        <HojaEnlace titulo={`Vuestra lista: tú y ${nombre}`} texto={`Una lista colaborativa para los dos: la veréis ${nombre} y tú, y os saldrá en la portada de cada sesión.`} inicial={url} etiqueta="Enlace a la lista"
          alCerrar={() => setEditar(false)}
          alGuardar={async (u) => { await api.guardarListaCompanero(id, u); aviso('Guardada para los dos'); setEditar(false); alCambiar?.(); }}
          alQuitar={url ? async () => { await api.guardarListaCompanero(id, null); aviso('Quitada'); setEditar(false); alCambiar?.(); } : null} />
      )}
    </span>
  );
}

// ---------- (coach) El tema del reto musical: este mes y el que viene ----------
const mesDe = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
const siguienteMes = (m) => { const [a, n] = m.split('-').map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`; };
const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function RetoMusicalCoach() {
  const { api, aviso } = useApp();
  const ahora = mesDe();
  const r = useCarga(() => (api.retoMusical ? api.retoMusical().catch(() => null) : Promise.resolve(null)), []);
  const [mes, setMes] = useState(ahora);
  const [tema, setTema] = useState('');
  const [ocupado, una] = useUnaVez();
  if (!api.retoMusical) return null;
  const guardar = (t) => una(async () => {
    try { await api.guardarRetoMusical(mes, t); aviso(t.trim() ? 'Reto puesto: sale en Equipo' : 'Reto quitado'); setTema(''); r.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <div class="panel panel-pad pila-s reto-musical-coach">
      <span class="peq secundario">El reto musical del mes</span>
      {r.datos ? <p class="peq">Este mes: <strong>«{r.datos.tema}»</strong> · {r.datos.canciones.length} {r.datos.canciones.length === 1 ? 'propuesta' : 'propuestas'}</p> : <p class="peq terciario">Este mes no hay reto.</p>}
      <div class="fila-envolver">
        <select class="entrada" aria-label="Mes del reto" value={mes} onChange={(e) => setMes(e.currentTarget.value)}>
          {[ahora, siguienteMes(ahora)].map((m) => <option key={m} value={m}>{NOMBRES_MES[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</option>)}
        </select>
        <input class="entrada" aria-label="Tema del reto" maxLength={80} placeholder="Los 80, bandas sonoras…" value={tema} onInput={(e) => setTema(e.currentTarget.value)} />
      </div>
      <span class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || tema.trim().length < 3} onClick={() => guardar(tema)}>Poner el reto</button>
        {mes === ahora && r.datos && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => guardar('')}>Quitar el de este mes</button>}
      </span>
      <p class="mini terciario">En Equipo, cada uno propone una canción y vota otra. Al acabar el mes se cierra.</p>
    </div>
  );
}
