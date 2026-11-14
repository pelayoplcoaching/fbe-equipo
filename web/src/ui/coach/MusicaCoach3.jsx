// (música 3, tanda 4) La música del coach (migración 072):
//   · BibliotecaMusica: todas sus listas en un sitio, con etiquetas (energía, ritmo aproximado, minutos, género, nota) y
//     un buscador; DeTuBiblioteca la ofrece al enlazar música a una sesión o a un bloque (dos toques)
//   · UsoMusica: qué música funciona (solo sus listas, abiertas desde la app) y cuántas sesiones del equipo tuvieron música
// Sin la 072, nada de esto sale.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { urlMusica, nombreMusica } from '../../logica/personal.js';
import { filtrarBiblioteca, ENERGIAS, textoFicha, mesesAtras } from '../../logica/musica.js';
import { FichaPrevia, NombreLista, useFicha } from '../atleta/Musica.jsx';

function Portadita({ url }) {
  const f = useFicha(url);
  return f.datos?.thumb ? <img class="musica-coach-portada" src={f.datos.thumb} alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer" />
    : <span class="musica-coach-portada sin" aria-hidden="true"><Icono n="altavoz" /></span>;
}

// ---------- Su biblioteca ----------
export function BibliotecaMusica() {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const [editar, setEditar] = useState(null); // null | {} (nueva) | fila
  const [q, setQ] = useState('');
  const lista = useCarga(() => (api.bibliotecaMusica ? api.bibliotecaMusica().catch(() => null) : Promise.resolve(null)), [vuelta]);
  if (!lista.datos) return null;
  const vistas = filtrarBiblioteca(lista.datos, q);
  return (
    <div class="panel biblioteca-musica">
      <div class="panel-pad pila-s">
        <div class="separa"><span class="peq secundario">Tu biblioteca</span>
          <button type="button" class="btn btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Añadir</button></div>
        {lista.datos.length > 3 && <input class="entrada" type="search" aria-label="Buscar en tu biblioteca" placeholder="Buscar: pierna, 128, rock…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />}
        {!lista.datos.length && <p class="peq terciario">Guarda aquí tus listas con sus etiquetas (energía, ritmo, minutos…) y ponlas en una sesión o un bloque en dos toques.</p>}
      </div>
      {vistas.length > 0 && (
        <ul class="lista">
          {vistas.map((x) => (
            <li key={x.id}>
              <button class="fila-ios fila-boton biblioteca-fila" onClick={() => setEditar(x)} aria-label={`Editar ${x.etiquetas.join(', ') || 'esta lista'}`}>
                <Portadita url={x.url} />
                <span class="fila-ios-texto"><span class="fila-ios-titulo"><NombreLista url={x.url} /></span>
                  <span class="peq terciario">{textoFicha(x) || 'Sin etiquetas'}</span></span>
                <Icono n="editar" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && !vistas.length && <p class="panel-pad peq terciario">Nada con «{q}».</p>}
      {editar && <HojaBiblioteca fila={editar} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); setVuelta((v) => v + 1); }} />}
    </div>
  );
}

function HojaBiblioteca({ fila, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState(() => ({ url: fila.url || '', etiquetas: (fila.etiquetas || []).join(', '), energia: fila.energia ?? null, bpm: fila.bpm ?? '', minutos: fila.minutos ?? '', genero: fila.genero || '', nota: fila.nota || '' }));
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const mal = f.url.trim() && urlMusica(f.url) === false;
  const cambiar = (c) => { setF({ ...f, ...c }); setError(null); };
  const guardar = (e) => {
    e.preventDefault();
    if (!f.url.trim() || mal) return;
    una(async () => {
      try {
        await api.guardarBibliotecaMusica({ id: fila.id || null, url: f.url, etiquetas: f.etiquetas.split(',').map((t) => t.trim()).filter(Boolean), energia: f.energia, bpm: f.bpm === '' ? null : Number(f.bpm), minutos: f.minutos === '' ? null : Number(f.minutos), genero: f.genero, nota: f.nota });
        aviso('Guardada en tu biblioteca'); alGuardar();
      } catch (err) { setError(err.message); }
    });
  };
  const borrar = () => una(async () => { try { await api.borrarBibliotecaMusica(fila.id); aviso('Quitada de tu biblioteca'); alGuardar(); } catch (err) { setError(err.message); } });
  return (
    <Hoja titulo={fila.id ? 'Lista de tu biblioteca' : 'Añadir a tu biblioteca'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo">
          <label for="bib-url">Enlace</label>
          <input id="bib-url" class="entrada" type="url" inputMode="url" value={f.url} onInput={(e) => cambiar({ url: e.currentTarget.value })} placeholder="https://open.spotify.com/playlist/…" aria-invalid={mal ? 'true' : undefined} />
          {mal ? <span class="error-campo">Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.</span> : <FichaPrevia url={f.url} />}
        </div>
        <div class="campo"><label for="bib-etq">Etiquetas <span class="secundario">(separadas por comas)</span></label>
          <input id="bib-etq" class="entrada" maxLength={200} value={f.etiquetas} onInput={(e) => cambiar({ etiquetas: e.currentTarget.value })} placeholder="pierna, calentar, días flojos" /></div>
        <fieldset class="pila-xs"><legend>Energía</legend>
          <span class="segmentos" role="group" aria-label="Energía">
            {ENERGIAS.map(([v, n]) => <button key={v} type="button" aria-pressed={f.energia === v ? 'true' : 'false'} onClick={() => cambiar({ energia: f.energia === v ? null : v })}>{n}</button>)}
          </span>
        </fieldset>
        <div class="fila-envolver biblioteca-cifras">
          <div class="campo"><label for="bib-bpm">bpm aprox.</label><input id="bib-bpm" class="entrada" type="number" inputMode="numeric" min={40} max={220} value={f.bpm} onInput={(e) => cambiar({ bpm: e.currentTarget.value })} /></div>
          <div class="campo"><label for="bib-min">Minutos</label><input id="bib-min" class="entrada" type="number" inputMode="numeric" min={1} max={900} value={f.minutos} onInput={(e) => cambiar({ minutos: e.currentTarget.value })} /></div>
        </div>
        <div class="campo"><label for="bib-gen">Género</label><input id="bib-gen" class="entrada" maxLength={40} value={f.genero} onInput={(e) => cambiar({ genero: e.currentTarget.value })} placeholder="Rock, techno, rap…" /></div>
        <div class="campo"><label for="bib-nota">Nota</label><input id="bib-nota" class="entrada" maxLength={140} value={f.nota} onInput={(e) => cambiar({ nota: e.currentTarget.value })} placeholder="Para las series pesadas" /></div>
        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primario btn-grande" disabled={ocupado || mal || !f.url.trim()}><Icono n="hecho" /> Guardar</button>
        {fila.id && <button type="button" class="btn-texto peligro" disabled={ocupado} onClick={borrar}>Quitar de tu biblioteca</button>}
      </form>
    </Hoja>
  );
}

// Al enlazar música a una sesión o a un bloque: sus listas de la biblioteca, a un toque (con buscador si hay muchas)
export function DeTuBiblioteca({ alElegir, ocupado = false }) {
  const { api } = useApp();
  const [q, setQ] = useState('');
  const lista = useCarga(() => (api.bibliotecaMusica ? api.bibliotecaMusica().catch(() => null) : Promise.resolve(null)), []);
  if (!lista.datos?.length) return null;
  const vistas = filtrarBiblioteca(lista.datos, q).slice(0, 8);
  return (
    <div class="pila-xs de-tu-biblioteca">
      <span class="peq secundario">De tu biblioteca</span>
      {lista.datos.length > 4 && <input class="entrada" type="search" aria-label="Buscar en tu biblioteca" placeholder="Buscar…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />}
      <ul class="lista">
        {vistas.map((x) => (
          <li key={x.id}>
            <button type="button" class="fila-ios fila-boton" disabled={ocupado} onClick={() => alElegir(x.url)}>
              <Portadita url={x.url} />
              <span class="fila-ios-texto"><span class="fila-ios-titulo"><NombreLista url={x.url} /></span><span class="peq terciario">{textoFicha(x) || nombreMusica(x.url)}</span></span>
              <Icono n="mas" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Qué música funciona ----------
export function UsoMusica() {
  const { api } = useApp();
  const desde = mesesAtras(new Date(), 2);
  const u = useCarga(() => (api.usoMusicaCoach ? api.usoMusicaCoach(desde).catch(() => null) : Promise.resolve(null)), [desde]);
  if (!u.datos) return null;
  const { listas = [], sesiones = 0, con_musica: con = 0 } = u.datos;
  return (
    <div class="panel panel-pad pila-s uso-musica">
      <span class="peq secundario">Qué música funciona (los últimos 3 meses)</span>
      <p class="peq"><strong class="num">{con}</strong> de <span class="num">{sesiones}</span> {sesiones === 1 ? 'sesión hecha' : 'sesiones hechas'} del equipo con música abierta desde la app{sesiones ? <> (<span class="num">{Math.round((con / sesiones) * 100)} %</span>)</> : null}.</p>
      {listas.length ? (
        <ol class="uso-musica-lista">
          {listas.slice(0, 8).map((x) => (
            <li key={x.url}><span class="uso-musica-nombre"><NombreLista url={x.url} /></span>
              <span class="mini secundario num">{x.n} {x.n === 1 ? 'vez' : 'veces'} · {x.atletas} {x.atletas === 1 ? 'atleta' : 'atletas'}</span></li>
          ))}
        </ol>
      ) : <p class="peq terciario">Aún nadie ha abierto tus listas desde la app.</p>}
      <p class="mini terciario">Solo tus listas y lo que se abre desde la app: nada de lo que cada uno escucha fuera.</p>
    </div>
  );
}
