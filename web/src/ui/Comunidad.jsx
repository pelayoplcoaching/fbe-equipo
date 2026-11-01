// La comunidad del equipo (v0.43): el muro, los retos y el ranking de constancia, para el atleta (pestaña Equipo)
// y para el coach. Voluntaria: el atleta entra aceptando lo que se comparte, y puede salir cuando quiera. Los
// permisos los pone la base (migraciones 027 a 029): lo de aquí solo enseña o esconde botones.
// v0.47: resumen de la semana, rachas, podio, perfil del equipo, retos de equipo, celebración de logros, menciones,
// filtros y novedades del muro, encuestas del coach y ánimos.
import { createContext, Fragment } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Avatar, Hoja, Siluetas, Vacio, ErrorCaja, Pestanas, Cargando, cuando } from './comunes.jsx';
import { Interruptor } from './Ajustes.jsx';
import { reducirFoto } from './FotoPerfil.jsx';
import {
  REACCIONES, MAX_POST, MAX_COMENTARIO, MAX_MOTIVO, MAX_PREGUNTA, MAX_OPCION, RETO_MAX, FILTROS_MURO, MEDALLAS, nombreEquipo, nombreValido, estadoReto, textoReto,
  ordenarRanking, posicionesRanking, quienes, textoRacha, mencionEnCurso, sugerenciasMencion, insertarMencion, mencionesDeTexto, trozosConMenciones, encuestaCerrada,
} from '../logica/comunidad.js';
import { fmtConDia, fmtCorta, hoyISO, sumarDias, lunesDe, aISO } from '../logica/fechas.js';
import { num } from '../logica/calculos.js';
import { VERSION_COMUNIDAD } from '../datos/api.js';
import { NORMAS_COMUNIDAD } from '../datos/normas-comunidad.js';

const VISTAS = [['muro', 'Muro'], ['retos', 'Retos'], ['ranking', 'Ranking']];

// ---------------------------------------------------------------- lo que recuerda este móvil (v0.47)
// La última vez que vio el muro (para «Nuevo» y la insignia de Equipo) y los logros ya celebrados. Si el navegador
// no deja guardar (sin almacenamiento o lleno), se recuerda mientras la app está abierta.
const claveVisto = (uid) => `fbe-equipo-visto:${uid || ''}`;
const claveCelebrados = (uid) => `fbe-equipo-celebrados:${uid || ''}`;
const enMemoria = new Map();
const leerLocal = (k) => { try { const v = localStorage.getItem(k); if (v != null) return v; } catch { /* */ } return enMemoria.get(k) ?? null; };
const guardarLocal = (k, v) => { enMemoria.set(k, v); try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: queda en memoria */ } };
export function leerVistoEquipo(uid) {
  return leerLocal(claveVisto(uid)) || null;
}
function guardarVistoEquipo(uid, iso) {
  guardarLocal(claveVisto(uid), iso);
  try { window.dispatchEvent(new Event('fbe-equipo-visto')); } catch { /* */ }
}
function leerCelebrados(uid) {
  try { const v = JSON.parse(leerLocal(claveCelebrados(uid)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function marcarCelebrado(uid, id) {
  guardarLocal(claveCelebrados(uid), JSON.stringify([...new Set([...leerCelebrados(uid), id])].slice(-200)));
}

// ---------------------------------------------------------------- el perfil en el equipo (v0.47)
// Tocar a alguien (su foto o su nombre en una publicación, un comentario, el ranking, un reto o una mención) abre su
// perfil en una hoja. Lo dan ConPerfiles (en Equipo, para el atleta y para el coach) y usePerfil.
const PerfilCtx = createContext(null);
const usePerfil = () => useContext(PerfilCtx) || (() => {});
export function ConPerfiles({ children }) {
  const [abierto, setAbierto] = useState(null);
  return (
    <PerfilCtx.Provider value={setAbierto}>
      {children}
      {abierto && <HojaPerfilEquipo perfilId={abierto} alCerrar={() => setAbierto(null)} />}
    </PerfilCtx.Provider>
  );
}
// Un nombre (con su foto, si se quiere) que abre el perfil
function BotonPersona({ perfilId, nombre, foto = null, clase = '', avatar = true, claseAvatar = 'peq', children }) {
  const abrir = usePerfil();
  return (
    <button type="button" class={`btn-persona ${clase}`} onClick={() => abrir(perfilId)}>
      {avatar && <Avatar nombre={nombre} foto={foto} clase={claseAvatar} />}
      <span class="sr">Ver el perfil de </span>
      {children || <span class="btn-persona-nombre">{nombre}</span>}
    </button>
  );
}

// La pestaña Equipo del atleta: la primera vez (o tras salir), la entrada; dentro, muro, retos y ranking
export function Equipo() {
  const { api } = useApp();
  const miembro = useCarga(() => api.miembroComunidad(), []);
  if (miembro.cargando && !miembro.datos) return <div class="contenido"><Siluetas forma="tarjetas" n={3} texto="Cargando el equipo" /></div>;
  const m = miembro.datos;
  if (m?.bloqueado) return <FueraDeLaComunidad />;
  // Sin haber entrado, tras salir o si ha cambiado lo que se comparte o las normas (hay que volver a aceptarlo)
  const dentroAntes = !!m && !m.salido_en;
  if (!m || m.salido_en || m.version !== VERSION_COMUNIDAD || api.faltanNormas(m)) {
    const cambio = !dentroAntes ? null : m.version !== VERSION_COMUNIDAD ? 'texto' : 'normas';
    return <EntrarComunidad antes={m} cambio={cambio} alEntrar={() => miembro.recargar(true)} />;
  }
  return <ConPerfiles><DentroDelEquipo m={m} alCambiar={() => miembro.recargar(true)} /></ConPerfiles>;
}

function DentroDelEquipo({ m, alCambiar }) {
  const { api } = useApp();
  const abrirPerfil = usePerfil();
  const yo = api.uid();
  const [vista, setVista] = useState('muro');
  const [ajustes, setAjustes] = useState(false);
  // Al compartir un logro, el muro, los retos y la racha se vuelven a leer
  const [cambios, setCambios] = useState(0);
  const racha = useCarga(() => api.rachasComunidad().then((r) => r[yo] || null).catch(() => null), [cambios]);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), []);
  // La celebración: un reto conseguido que este móvil aún no ha celebrado (y que no está compartido)
  const logros = useCarga(() => api.logrosComunidad().catch(() => []), [cambios]);
  const [celebrar, setCelebrar] = useState(null);
  useEffect(() => {
    if (celebrar || !logros.datos) return;
    const ya = leerCelebrados(yo);
    const r = logros.datos.find((x) => !ya.includes(x.id));
    if (r) setCelebrar({ reto: r, celebracion: true });
  }, [logros.datos]);
  const cerrarCelebracion = (compartido) => {
    if (celebrar) marcarCelebrado(yo, celebrar.reto.id);
    setCelebrar(null);
    if (compartido) setCambios((c) => c + 1);
  };
  const n = racha.datos?.racha || 0;
  const recibidos = animos.datos?.recibidos || [];
  return (
    <div class="contenido equipo">
      <header class="cabecera">
        <div class="titulo">
          <h1>Equipo</h1>
          <div class="sub fila-envolver cab-equipo">
            <span>Estás como <button type="button" class="btn-texto btn-yo" onClick={() => abrirPerfil(yo)}><span class="sr">Ver tu perfil en el equipo: </span>{m.nombre}</button></span>
            {n > 0 && <span class="racha-cab"><span aria-hidden="true">🔥</span> {textoRacha(n)}</span>}
          </div>
        </div>
        <button class="btn btn-icono plano" aria-label="Ajustes de la comunidad" onClick={() => setAjustes(true)}><Icono n="ajustes" /></button>
      </header>
      {recibidos.length > 0 && (
        <p class="animos-recibidos peq"><span class="animos-ico" aria-hidden="true">🙌</span><span>Te han animado esta semana: <strong>{quienes(recibidos.map((x) => x.nombre), 3)}</strong></span></p>
      )}
      <Pestanas opciones={VISTAS} valor={vista} alCambiar={setVista} etiqueta="Equipo" idBase="eq" />
      <div class="pestana-panel" role="tabpanel" id="eq-panel" aria-labelledby={`eq-${vista}`} key={vista}>
        {vista === 'muro' && <Muro cambios={cambios} />}
        {vista === 'retos' && <Retos miembro={m} cambios={cambios} alCompartirLogro={(r) => setCelebrar({ reto: r, celebracion: false })} />}
        {vista === 'ranking' && <Ranking miembro={m} />}
      </div>
      {ajustes && <HojaAjustesComunidad miembro={m} alCerrar={() => setAjustes(false)} alCambiar={alCambiar} />}
      {celebrar && <HojaCelebracion reto={celebrar.reto} celebracion={celebrar.celebracion} alCerrar={() => cerrarCelebracion(false)} alCompartir={() => cerrarCelebracion(true)} />}
    </div>
  );
}

// Qué se comparte y con quién (la entrada y los ajustes)
function QueSeComparte() {
  return (
    <>
      <div class="pila-s">
        <strong>Qué ven los demás</strong>
        <ul class="puntos secundario">
          <li>Tu nombre en el equipo y tu foto de perfil.</li>
          <li>Lo que publiques, comentes o compartas, tus reacciones, tus votos en las encuestas del coach, los ánimos que mandas y a quién mencionas.</li>
          <li>Cuántas sesiones llevas en los retos y en el ranking de la semana, y tu racha de semanas completas (puedes no salir).</li>
          <li>Tu perfil del equipo: desde cuándo estás, tu racha, cuántos retos has conseguido (y cuáles) y cuántos entrenos has compartido.</li>
        </ul>
      </div>
      <div class="pila-s">
        <strong>Lo que nunca se comparte</strong>
        <p class="secundario">Tu peso, tus medidas, la nutrición, los check-ins, las molestias, los vídeos de técnica ni lo que hablas con tu coach. Los kilos de un entreno, solo si tú lo eliges al compartirlo.</p>
      </div>
    </>
  );
}

// El coach le ha sacado de la comunidad: no ve nada ni puede volver a entrar hasta que le readmita
function FueraDeLaComunidad() {
  return (
    <div class="contenido">
      <header class="cabecera"><div class="titulo"><h1>Equipo</h1></div></header>
      <Vacio icono="equipo" titulo="No estás en la comunidad">Tu coach te ha sacado de la comunidad del equipo. Si quieres volver, habla con él.</Vacio>
    </div>
  );
}

// Las normas del equipo (v0.44), en una hoja. Con alLeer, abajo «He leído las normas» (la entrada); sin él, solo
// para leerlas (los ajustes)
export function HojaNormas({ alCerrar, alLeer = null }) {
  return (
    <Hoja titulo={NORMAS_COMUNIDAD.titulo} alCerrar={alCerrar}>
      <div class="pila">
        <ListaNormas />
        {alLeer && <button class="btn btn-primario btn-grande" onClick={alLeer}><Icono n="hecho" /> He leído las normas</button>}
      </div>
    </Hoja>
  );
}
export function ListaNormas() {
  return (
    <div class="pila normas">
      <p>{NORMAS_COMUNIDAD.intro}</p>
      <ol class="lista-normas">
        {NORMAS_COMUNIDAD.puntos.map(([principal, detalle]) => <li key={principal}><strong>{principal}</strong> {detalle}</li>)}
      </ol>
      <p class="peq secundario">{NORMAS_COMUNIDAD.cierre}</p>
    </div>
  );
}

function EntrarComunidad({ antes, cambio = null, alEntrar }) {
  const { api, atleta, aviso } = useApp();
  const [nombre, setNombre] = useState(antes?.nombre || nombreEquipo(atleta?.nombre));
  const [ocupado, una] = useUnaVez();
  const [error, setError] = useState(null);
  const [verNormas, setVerNormas] = useState(false);
  const [leidas, setLeidas] = useState(false);
  const entrar = (e) => {
    e.preventDefault();
    if (!leidas) { setError('Antes de entrar, lee las normas del equipo.'); return; }
    una(async () => {
      setError(null);
      try { await api.entrarComunidad(nombre); aviso('¡Ya estás en el equipo!'); alEntrar(); } catch (err) { setError(err.message); }
    });
  };
  return (
    <div class="contenido">
      <header class="cabecera"><div class="titulo"><h1>Equipo</h1><div class="sub">Para animaros entre los atletas de FBE</div></div></header>
      <section class="panel panel-pad pila entrar-equipo">
        <Icono n="equipo" class="entrar-equipo-ico" />
        <h2>{cambio === 'texto' ? 'Hemos cambiado lo que se comparte' : cambio === 'normas' ? 'Hemos actualizado las normas' : antes ? '¿Vuelves al equipo?' : 'Antes de entrar'}</h2>
        {cambio === 'texto' && <p class="nota peq">Para seguir en el equipo, lee lo que se comparte ahora (tu racha, tu perfil del equipo, tus votos, los ánimos y las menciones) y acéptalo. Mientras tanto, lo tuyo no se ve.</p>}
        {cambio === 'normas' && <p class="nota peq">Para seguir en el equipo, lee las normas y márcalas como leídas. Mientras tanto, lo tuyo no se ve.</p>}
        <p>Es voluntario. Dentro, los atletas de FBE que han entrado y tu coach os veis entre vosotros: os podéis animar, compartir un entreno y apuntaros a los retos.</p>
        <QueSeComparte />
        <p class="peq secundario">Puedes salir cuando quieras desde los ajustes del equipo: lo tuyo deja de verse para los demás.{antes ? ' Si vuelves, lo que dejaste vuelve a verse.' : ''}</p>
        <div class="panel-pad normas-entrada pila-s">
          <strong>{NORMAS_COMUNIDAD.titulo}</strong>
          <p class="peq secundario">Respeto, nada de comentarios sobre el cuerpo de nadie, ni consejos de salud, ni sacar fuera lo del equipo. Léelas antes de entrar.</p>
          <div class="separa">
            {leidas ? <span class="normas-leidas"><Icono n="hecho" /> Normas leídas</span> : <span class="peq terciario">Sin leer</span>}
            <button type="button" class="btn btn-peq" onClick={() => setVerNormas(true)}>{leidas ? 'Volver a leerlas' : 'Leer las normas'}</button>
          </div>
        </div>
        <form class="pila" onSubmit={entrar}>
          <div class="campo">
            <label for="eq-nombre">Tu nombre en el equipo</label>
            <input id="eq-nombre" class="entrada" maxLength={40} autoComplete="off" value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} />
            <span class="ayuda">Es el que verán los demás (de 2 a 40 letras).</span>
          </div>
          {error && <div class="error" role="alert">{error}</div>}
          {!leidas && <p class="peq terciario" id="eq-falta-normas">Para entrar, lee antes las normas del equipo.</p>}
          <button class="btn btn-primario btn-grande" disabled={ocupado || !leidas || !nombreValido(nombre)} aria-describedby={leidas ? undefined : 'eq-falta-normas'}>
            {cambio ? 'Sí, quiero seguir' : 'Sí, quiero entrar'}
          </button>
        </form>
      </section>
      {verNormas && <HojaNormas alCerrar={() => setVerNormas(false)} alLeer={() => { setLeidas(true); setError(null); setVerNormas(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- el muro
// v0.47: arriba, el resumen de la semana; filtros (en la propia consulta, así «Ver más» sigue funcionando); y, para
// el atleta, «Nuevo» en lo publicado por los demás desde su última visita (este móvil lo recuerda).
export function Muro({ coach = false, cambios = 0 }) {
  const { api } = useApp();
  const yo = api.uid();
  const [filtro, setFiltro] = useState('todo');
  const [paginas, setPaginas] = useState(1);
  const muro = useCarga(() => api.muro({ limite: 20 * paginas, filtro }), [paginas, filtro, cambios]);
  const visto = useRef(coach ? null : leerVistoEquipo(yo)); // la visita anterior (al abrir el muro)
  const d = muro.datos;
  useEffect(() => {
    if (coach || !d || filtro !== 'todo') return;
    const ultima = d.posts.filter((x) => !x.mio).map((x) => x.creado_en).sort().at(-1);
    const previo = leerVistoEquipo(yo);
    guardarVistoEquipo(yo, [previo, ultima].filter(Boolean).sort().at(-1) || new Date().toISOString());
  }, [d]);
  const recargar = () => muro.recargar(true);
  const posts = d?.posts || [];
  const esNueva = (p) => !!visto.current && !p.mio && !p.fijada && p.creado_en > visto.current;
  const primera = posts.findIndex(esNueva);
  const ultima = posts.map(esNueva).lastIndexOf(true);
  const cambiarFiltro = (f) => { setFiltro(f); setPaginas(1); };
  return (
    <div class="pila muro">
      <ResumenSemana cambios={cambios} />
      <Compositor coach={coach} personas={d?.personas || {}} alPublicar={recargar} />
      <div class="filtros-muro" role="group" aria-label="Qué ver en el muro">
        {FILTROS_MURO.map(([k, t]) => <button key={k} type="button" class="chip-filtro" aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => cambiarFiltro(k)}>{t}</button>)}
      </div>
      <ErrorCaja error={muro.error} reintentar={() => muro.recargar()} />
      {!d ? <Siluetas forma="tarjetas" n={3} texto="Cargando el muro" />
        : !posts.length ? (filtro === 'todo'
          ? <Vacio icono="equipo" titulo="Aún no hay nada en el muro">{coach ? 'Publica un aviso para darles la bienvenida.' : 'Sé el primero: cuenta qué tal tu semana o comparte tu próximo entreno.'}</Vacio>
          : <Vacio icono="equipo" titulo="Nada por aquí">No hay publicaciones con este filtro. Prueba con «Todo».</Vacio>
        ) : posts.map((p, i) => (
          <Fragment key={p.id}>
            {i === primera && <div class="muro-separa nuevo"><span>Nuevo<span class="sr"> desde tu última visita</span></span></div>}
            <TarjetaPost post={p} coach={coach} personas={d.personas} alCambiar={recargar} />
            {i === ultima && i < posts.length - 1 && <div class="muro-separa"><span>Ya lo habías visto</span></div>}
          </Fragment>
        ))}
      {d?.hayMas && <button class="btn" onClick={() => setPaginas(paginas + 1)}>Ver más</button>}
    </div>
  );
}

// Esta semana en el equipo (v0.47): solo recuentos, sin quien no sale en el ranking
function ResumenSemana({ cambios = 0 }) {
  const { api } = useApp();
  const r = useCarga(() => api.resumenSemanaComunidad(), [cambios]);
  const x = r.datos;
  if (!x) return null;
  const datos = [
    [x.sesiones, x.sesiones === 1 ? 'sesión hecha' : 'sesiones hechas'],
    [<>{x.semana_completa}<span class="de"> de {x.miembros}</span></>, 'con la semana completa'],
    [x.records, x.records === 1 ? 'récord compartido' : 'récords compartidos'],
    [x.retos, x.retos === 1 ? 'reto en marcha' : 'retos en marcha'],
  ];
  return (
    <section class="panel panel-pad resumen-equipo" aria-labelledby="eq-resumen-t">
      <h2 id="eq-resumen-t" class="resumen-equipo-t">Esta semana en el equipo</h2>
      <dl class="resumen-equipo-num">
        {datos.map(([v, k], i) => <div key={i}><dt>{k}</dt><dd class="num">{v}</dd></div>)}
      </dl>
    </section>
  );
}

// Un texto con menciones (v0.47): al escribir «@», propone a los del equipo (y al coach) por su nombre. alMencionar
// recibe a quien se elige; las menciones que se mandan son las que siguen en el texto (mencionesDeTexto).
function AreaConMenciones({ id, etiqueta, valor, alCambiar, personas = {}, alMencionar, maxLength, rows = 2, placeholder, claseEtiqueta = 'sr' }) {
  const { api } = useApp();
  const ref = useRef(null);
  const caja = useRef(null);
  const [en, setEn] = useState(null);
  const [activa, setActiva] = useState(0);
  const lista = useMemo(() => Object.entries(personas).map(([perfil_id, p]) => ({ perfil_id, ...p })), [personas]);
  const sug = en ? sugerenciasMencion(en.consulta, lista, api.uid()) : [];
  const mirar = (el) => { setEn(mencionEnCurso(el.value, el.selectionStart ?? el.value.length)); setActiva(0); };
  const elegir = (p) => {
    const r = insertarMencion(valor, en, p.nombre);
    alCambiar(r.texto);
    alMencionar?.(p);
    setEn(null);
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); try { el.setSelectionRange(r.cursor, r.cursor); } catch { /* */ } } });
  };
  const tecla = (e) => {
    if (!sug.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiva((activa + 1) % sug.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiva((activa - 1 + sug.length) % sug.length); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(sug[Math.min(activa, sug.length - 1)]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEn(null); }
  };
  // Al salir del cuadro (y de sus propuestas), se cierran; con un margen para que llegue el toque en una propuesta
  const salir = () => setTimeout(() => { if (caja.current && !caja.current.contains(document.activeElement)) setEn(null); }, 300);
  return (
    <div class="area-menciones" ref={caja} onFocusOut={salir}>
      <label class={claseEtiqueta} for={id}>{etiqueta}</label>
      <textarea id={id} ref={ref} class="area" maxLength={maxLength} rows={rows} placeholder={placeholder} value={valor} aria-describedby={`${id}-ayuda`}
        onInput={(e) => { alCambiar(e.currentTarget.value); mirar(e.currentTarget); }} onKeyDown={tecla}
        onKeyUp={(e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) mirar(e.currentTarget); }} onClick={(e) => mirar(e.currentTarget)} />
      <span id={`${id}-ayuda`} class="sr">Escribe @ para mencionar a alguien del equipo.</span>
      {sug.length > 0 && (
        <div class="menciones-sugeridas" role="group" aria-label="Mencionar a">
          {sug.map((p, i) => (
            <button key={p.perfil_id} type="button" class={i === activa ? 'activa' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
              <Avatar nombre={p.nombre} foto={p.foto} clase="peq" /><span class="ms-nombre">{p.nombre}</span>{p.coach && <span class="chip morado chip-mini">Coach</span>}
            </button>
          ))}
        </div>
      )}
      <span class="sr" aria-live="polite">{sug.length ? `${sug.length === 1 ? 'Una persona' : `${sug.length} personas`} para mencionar: con las flechas eliges y con Intro la mencionas.` : ''}</span>
    </div>
  );
}

// El texto de una publicación o un comentario, con «@Nombre» resaltado (y que abre su perfil) solo para quien está
// mencionado de verdad
function TextoConMenciones({ texto, mencionados = [], clase = 'post-texto', como = 'p' }) {
  const abrir = usePerfil();
  const trozos = trozosConMenciones(texto, mencionados);
  const Etiqueta = como;
  return (
    <Etiqueta class={clase}>
      {trozos.map((t, i) => (t.perfil_id ? <button key={i} type="button" class="mencion" onClick={() => abrir(t.perfil_id)}>{t.texto}</button> : <Fragment key={i}>{t.texto}</Fragment>))}
    </Etiqueta>
  );
}

function Compositor({ coach, personas = {}, alPublicar }) {
  const { api, aviso } = useApp();
  const [modo, setModo] = useState('aviso'); // el coach: aviso o encuesta (v0.47)
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState([]);
  const [foto, setFoto] = useState(null); // { blob, url }
  const [fijada, setFijada] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [cierre, setCierre] = useState('');
  const [ocupado, una] = useUnaVez();
  const input = useRef(null);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);
  const encuesta = coach && modo === 'encuesta';
  const elegir = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try { const blob = await reducirFoto(f); setFoto({ blob, url: URL.createObjectURL(blob) }); } catch (err) { aviso(err.message, 'error'); }
  };
  const publicar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        if (encuesta) {
          await api.publicarEnComunidad({ encuesta: { pregunta, opciones, cierre: cierre ? new Date(cierre).toISOString() : null }, fijada });
          setPregunta(''); setOpciones(['', '']); setCierre(''); setFijada(false);
          aviso('Encuesta publicada en el muro');
        } else {
          await api.publicarEnComunidad({ texto, foto: foto?.blob || null, fijada, menciones: mencionesDeTexto(texto, elegidas) });
          setTexto(''); setFoto(null); setFijada(false); setElegidas([]);
          aviso(coach ? 'Aviso publicado en el muro' : 'Publicado en el equipo');
        }
        alPublicar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const vacio = !texto.trim() && !foto;
  const encuestaLista = pregunta.trim() && opciones.filter((o) => o.trim()).length >= 2;
  const ahoraLocal = (() => { const d = new Date(Date.now() + 10 * 60000); return `${aISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })();
  return (
    <form class="panel panel-pad pila-s compositor" onSubmit={publicar}>
      {coach && (
        <div class="segmentos compositor-modo" role="group" aria-label="Qué publicas">
          {[['aviso', 'Aviso'], ['encuesta', 'Encuesta']].map(([k, t]) => <button key={k} type="button" aria-pressed={modo === k ? 'true' : 'false'} onClick={() => setModo(k)}>{t}</button>)}
        </div>
      )}
      {encuesta ? (
        <div class="pila-s">
          <div class="campo"><label for="eq-pregunta">Pregunta</label>
            <textarea id="eq-pregunta" class="area" rows={2} maxLength={MAX_PREGUNTA} placeholder="¿Qué día os viene mejor para…?" value={pregunta} onInput={(e) => setPregunta(e.currentTarget.value)} /></div>
          {opciones.map((o, i) => (
            <div class="campo encuesta-campo" key={i}>
              <label for={`eq-opcion-${i}`}>Opción {i + 1}</label>
              <span class="fila encuesta-campo-fila">
                <input id={`eq-opcion-${i}`} class="entrada" maxLength={MAX_OPCION} value={o} onInput={(e) => { const n = [...opciones]; n[i] = e.currentTarget.value; setOpciones(n); }} />
                {i >= 2 && <button type="button" class="btn btn-icono plano" aria-label={`Quitar la opción ${i + 1}`} onClick={() => setOpciones(opciones.filter((_, k) => k !== i))}><Icono n="cerrar" /></button>}
              </span>
            </div>
          ))}
          {opciones.length < 4 && <button type="button" class="btn btn-peq plano" style="justify-self:start" onClick={() => setOpciones([...opciones, ''])}><Icono n="mas" /> Otra opción</button>}
          <div class="campo"><label for="eq-cierre">Cierre (opcional)</label>
            <input id="eq-cierre" type="datetime-local" class="entrada" min={ahoraLocal} value={cierre} onInput={(e) => setCierre(e.currentTarget.value)} />
            <span class="ayuda">Hasta entonces, cada uno puede cambiar su voto. Sin cierre, siempre abierta.</span></div>
        </div>
      ) : (
        <AreaConMenciones id="eq-texto" etiqueta={coach ? 'Aviso para el equipo' : 'Tu publicación'} valor={texto} alCambiar={setTexto} personas={personas}
          alMencionar={(p) => setElegidas((l) => [...l.filter((x) => x.perfil_id !== p.perfil_id), p])} maxLength={MAX_POST} rows={2}
          placeholder={coach ? 'Un aviso para todo el equipo…' : '¿Qué tal tu semana? Anima al equipo… (@ para mencionar)'} />
      )}
      {!encuesta && foto && (
        <div class="compositor-foto">
          <img src={foto.url} alt="La foto que vas a publicar" />
          <button type="button" class="btn btn-peq" onClick={() => setFoto(null)}><Icono n="cerrar" /> Quitar la foto</button>
        </div>
      )}
      <div class="separa compositor-pie">
        <span class="fila-envolver">
          {!encuesta && <input ref={input} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Foto para la publicación" onChange={elegir} />}
          {!encuesta && !foto && <button type="button" class="btn btn-peq plano" onClick={() => input.current?.click()}><Icono n="imagen" /> Foto</button>}
          {coach && <label class="casilla casilla-peq"><input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.currentTarget.checked)} /><span>Fijar arriba</span></label>}
        </span>
        <button class="btn btn-peq btn-primario" disabled={ocupado || (encuesta ? !encuestaLista : coach ? !texto.trim() : vacio)}>
          {ocupado ? 'Publicando…' : encuesta ? 'Publicar encuesta' : coach ? 'Publicar aviso' : 'Publicar'}
        </button>
      </div>
      {!encuesta && texto.length > MAX_POST - 200 && <span class="mini terciario">{MAX_POST - texto.length} letras más como mucho</span>}
    </form>
  );
}

const TIPOS_POST = { aviso: 'Aviso del coach', entreno: 'Entreno compartido', logro: 'Logro', encuesta: 'Encuesta' };

function TarjetaPost({ post, coach, personas = {}, alCambiar }) {
  const { api, aviso } = useApp();
  const [hoja, setHoja] = useState(null); // 'comentarios' | 'opciones' | 'quien' | 'avisar' | 'votos'
  const [ocupado, una] = useUnaVez();
  // Doble toque en la publicación: 💪 (si aún no lo tiene), con un pequeño salto (v0.47)
  const [pop, setPop] = useState(0);
  const toque = useRef(0);
  useEffect(() => { if (!pop) return undefined; const t = setTimeout(() => setPop(0), 800); return () => clearTimeout(t); }, [pop]);
  const reaccionar = (k) => una(async () => {
    try { await api.reaccionar(post.id, k); await alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const tocar = (e) => {
    if (e.target.closest('button, a, input, textarea, select')) return;
    const t = Date.now();
    if (t - toque.current < 350) {
      toque.current = 0;
      setPop(t);
      if (post.miReaccion !== 'fuerza') reaccionar('fuerza');
    } else toque.current = t;
  };
  const todos = Object.values(post.reacciones).flat();
  const tipo = TIPOS_POST[post.tipo] || null;
  return (
    <article class={`panel panel-pad pila-s post post-${post.tipo} ${post.fijada ? 'fijada' : ''} ${post.oculta ? 'oculta' : ''}`} aria-label={`${tipo || 'Publicación'} de ${post.autor.nombre}`}>
      <header class="post-cab">
        <BotonPersona perfilId={post.autor_id} nombre={post.autor.nombre} foto={post.autor.foto} clase="post-autor" claseAvatar="">
          <span class="post-quien">
            <span class="fila-envolver"><strong>{post.autor.nombre}</strong>{post.autor.coach && <span class="chip morado">Coach</span>}</span>
            <span class="mini terciario">{tipo ? `${tipo} · ` : ''}{cuando(post.creado_en)}</span>
          </span>
        </BotonPersona>
        {post.fijada && <span class="chip post-fijado"><Icono n="chincheta" />Fijado</span>}
        {(coach || post.mio || !post.autor.coach) && <button class="btn btn-icono plano" aria-label="Opciones de la publicación" onClick={() => setHoja('opciones')}><Icono n="opciones" stroke-width="3" /></button>}
      </header>
      {post.oculta && <p class="nota peq">Oculta: los atletas no la ven.</p>}
      {post.tipo === 'encuesta' ? <EncuestaPost post={post} coach={coach} alCambiar={alCambiar} alVerVotos={() => setHoja('votos')} /> : (
        <div class="post-cuerpo" onClick={tocar}>
          {post.tipo === 'entreno' && <TarjetaEntreno r={post.resumen} />}
          {post.tipo === 'logro' && <TarjetaLogro r={post.resumen} />}
          {post.texto && <TextoConMenciones texto={post.texto} mencionados={post.mencionados} />}
          {post.foto_ruta && <FotoPost ruta={post.foto_ruta} autor={post.autor.nombre} />}
          {pop > 0 && <span class="pop-fuerza" key={pop} aria-hidden="true">💪</span>}
        </div>
      )}
      <div class="post-pie">
        <div class="reacciones" role="group" aria-label="Reacciones">
          {REACCIONES.map(([k, emoji, nombre]) => {
            const lista = post.reacciones[k] || [];
            return (
              <button key={k} type="button" class="reaccion" aria-pressed={post.miReaccion === k ? 'true' : 'false'} disabled={ocupado}
                aria-label={`${nombre}: ${lista.length}${lista.length ? ` (${lista.join(', ')})` : ''}`} onClick={() => reaccionar(k)}>
                <span aria-hidden="true">{emoji}</span>{lista.length > 0 && <span class="num" aria-hidden="true">{lista.length}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" class="btn btn-peq plano post-comentar" onClick={() => setHoja('comentarios')}>
          <Icono n="mensaje" /> {post.comentarios ? `${post.comentarios} ${post.comentarios === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}
        </button>
      </div>
      {todos.length > 0 && <button type="button" class="btn-texto mini quien-reacciona" onClick={() => setHoja('quien')}>{quienes(todos)}</button>}
      {hoja === 'comentarios' && <HojaComentarios post={post} coach={coach} personas={personas} alCerrar={() => setHoja(null)} alCambiar={alCambiar} />}
      {hoja === 'quien' && <HojaQuien post={post} alCerrar={() => setHoja(null)} />}
      {hoja === 'votos' && <HojaVotantes post={post} alCerrar={() => setHoja(null)} />}
      {hoja === 'opciones' && <HojaOpcionesPost post={post} coach={coach} alCerrar={() => setHoja(null)} alCambiar={alCambiar} alAvisar={() => setHoja('avisar')} />}
      {hoja === 'avisar' && <HojaAvisar postId={post.id} alCerrar={() => setHoja(null)} />}
    </article>
  );
}

// La tarjeta de un entreno (la de la base o, al compartir, la vista previa)
export function TarjetaEntreno({ r }) {
  if (!r) return null;
  const ejercicios = r.ejercicios || [];
  const records = ejercicios.filter((e) => e.record);
  const serie = (e) => (e.kg != null ? `${num(e.kg, 2)} kg × ${e.reps}` : e.reps != null ? `${e.reps} rep` : null);
  return (
    <div class="entreno-equipo">
      <div class="ee-cab">
        <span class="ee-ico"><Icono n="hoy" /></span>
        <div class="pila-xs"><strong>{r.nombre}</strong><span class="mini secundario">{r.fecha ? fmtConDia(r.fecha) : ''}</span></div>
      </div>
      <div class="ee-num">
        <div><span class="v num">{r.minutos ?? '—'}</span><span class="k">min</span></div>
        <div><span class="v num">{r.series ?? 0}</span><span class="k">series</span></div>
        <div><span class="v num">{ejercicios.length}</span><span class="k">{ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div>
      </div>
      {ejercicios.length > 0 && (
        <ul class="ee-ejercicios">
          {ejercicios.map((e, i) => (
            <li key={i}><span>{e.nombre}</span>{r.con_kilos && serie(e) && <span class="num secundario">{serie(e)}</span>}</li>
          ))}
        </ul>
      )}
      {records.map((e, i) => (
        <p class="ee-record" key={i}><Icono n="trofeo" /><span>Récord en {e.nombre}{r.con_kilos && e.e1rm ? ` · 1RM estimado ${num(e.e1rm)} kg` : ''}</span></p>
      ))}
    </div>
  );
}

// La tarjeta de un logro (v0.47): la hace la base al compartirlo (título, modo, objetivo, sesiones y fechas)
export function TarjetaLogro({ r }) {
  if (!r) return null;
  const equipo = r.modo === 'equipo';
  return (
    <div class="logro-equipo">
      <span class="le-ico" aria-hidden="true"><Icono n="trofeo" /></span>
      <div class="pila-xs">
        <span class="mini le-k">{equipo ? 'Reto de equipo conseguido' : 'Reto conseguido'}</span>
        <strong class="le-titulo">{r.titulo}</strong>
        <span class="mini secundario">
          {equipo ? `${r.hechas} sesiones entre todo el equipo (el objetivo era ${r.objetivo})` : `${r.hechas} de ${r.objetivo} ${r.objetivo === 1 ? 'sesión' : 'sesiones'}`}
          {r.desde && r.hasta ? ` · ${fmtCorta(r.desde)} – ${fmtCorta(r.hasta)}` : ''}
        </span>
      </div>
    </div>
  );
}

// Una encuesta del coach (v0.47): votar (y cambiar el voto) hasta el cierre; los resultados, al votar, al cerrarse
// o para el coach; quién ha votado, en una hoja
function EncuestaPost({ post, coach, alCambiar, alVerVotos }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const e = post.encuesta || { opciones: [] };
  const r = post.resultados || { conteos: [], porcentajes: [], total: 0, miVoto: null };
  const cerrada = encuestaCerrada(e);
  const puede = !coach && !cerrada;
  const verResultados = coach || cerrada || r.miVoto != null;
  const votar = (i) => una(async () => {
    if (r.miVoto === i) return;
    try { await api.votarEncuesta(post.id, i); aviso(r.miVoto == null ? 'Voto guardado' : 'Has cambiado tu voto'); await alCambiar(); } catch (err) { aviso(err.message, 'error'); }
  });
  const cierre = e.cierre ? new Date(e.cierre) : null;
  const textoCierre = cerrada ? 'Cerrada' : cierre ? `Cierra el ${fmtConDia(aISO(cierre))} a las ${cierre.getHours()}:${String(cierre.getMinutes()).padStart(2, '0')}` : 'Sin cierre';
  return (
    <div class="encuesta pila-s">
      <TextoConMenciones texto={post.texto} mencionados={post.mencionados} clase="post-texto encuesta-pregunta" />
      <div class="encuesta-opciones" role="group" aria-label="Opciones de la encuesta">
        {e.opciones.map((o, i) => {
          const pct = r.porcentajes[i] || 0;
          const etiqueta = verResultados ? `${o}: ${r.conteos[i] || 0} ${r.conteos[i] === 1 ? 'voto' : 'votos'} (${pct} %)${r.miVoto === i ? ', tu voto' : ''}` : o;
          const dentro = (
            <>
              {verResultados && <span class="eo-barra" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span class="eo-texto">{r.miVoto === i && <Icono n="hecho" />}{o}</span>
              {verResultados && <span class="eo-pct num" aria-hidden="true">{pct} %</span>}
            </>
          );
          return puede
            ? <button key={i} type="button" class={`encuesta-opcion ${r.miVoto === i ? 'mia' : ''}`} aria-pressed={r.miVoto === i ? 'true' : 'false'} aria-label={etiqueta} disabled={ocupado} onClick={() => votar(i)}>{dentro}</button>
            : <div key={i} class={`encuesta-opcion solo ${r.miVoto === i ? 'mia' : ''}`} role="img" aria-label={etiqueta}>{dentro}</div>;
        })}
      </div>
      <div class="separa encuesta-pie">
        <span class="mini terciario">{r.total} {r.total === 1 ? 'voto' : 'votos'} · {textoCierre}{puede && r.miVoto == null ? ' · Elige una opción' : ''}</span>
        {r.total > 0 && verResultados && <button type="button" class="btn-texto mini" onClick={alVerVotos}>Ver quién ha votado</button>}
      </div>
    </div>
  );
}

function HojaVotantes({ post, alCerrar }) {
  const r = post.resultados;
  return (
    <Hoja titulo="Quién ha votado" alCerrar={alCerrar}>
      <ul class="lista">
        {(post.encuesta?.opciones || []).map((o, i) => (
          <li key={i} class="panel-pad pila-xs">
            <span>{o} ({r.conteos[i] || 0})</span>
            <span class="peq secundario">{r.quien[i]?.length ? r.quien[i].join(', ') : 'Nadie todavía'}</span>
          </li>
        ))}
      </ul>
      <p class="mini terciario">Solo salen los votos de quien sigue en el equipo.</p>
    </Hoja>
  );
}

function FotoPost({ ruta, autor }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error) return <p class="mini terciario">La foto no está disponible.</p>;
  if (!url) return <div class="post-foto post-foto-cargando" aria-hidden="true" />;
  return <img class="post-foto" src={url} alt={`Foto de ${autor}`} loading="lazy" />;
}

function HojaQuien({ post, alCerrar }) {
  return (
    <Hoja titulo="Reacciones" alCerrar={alCerrar}>
      <ul class="lista">
        {REACCIONES.filter(([k]) => post.reacciones[k]?.length).map(([k, emoji, nombre]) => (
          <li key={k} class="panel-pad pila-xs"><span><span aria-hidden="true">{emoji}</span> {nombre} ({post.reacciones[k].length})</span><span class="peq secundario">{post.reacciones[k].join(', ')}</span></li>
        ))}
      </ul>
    </Hoja>
  );
}

function HojaOpcionesPost({ post, coach, alCerrar, alCambiar, alAvisar }) {
  const { api, aviso } = useApp();
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto) => una(async () => {
    try { await fn(); aviso(texto); alCerrar(); alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Publicación" alCerrar={alCerrar}>
      {borrar ? (
        <div class="pila">
          <p>¿Borrar esta publicación? Se borran también sus comentarios, reacciones{post.tipo === 'encuesta' ? ' y votos' : ''}.</p>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setBorrar(false)}>Cancelar</button>
            <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.borrarDeComunidad(post), 'Publicación borrada')}><Icono n="basura" /> Sí, borrar</button>
          </div>
        </div>
      ) : (
        <div class="pila-s opciones-post">
          {coach && ['aviso', 'encuesta'].includes(post.tipo) && <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.fijarEnComunidad(post.id, !post.fijada), post.fijada ? 'Ya no está fijado' : 'Fijado arriba')}><Icono n="chincheta" /> {post.fijada ? 'Quitar de arriba' : 'Fijar arriba'}</button>}
          {coach && !post.mio && <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.ocultarEnComunidad(post.id, !post.oculta), post.oculta ? 'Vuelve a verse' : 'Oculta para los atletas')}><Icono n="ojo" /> {post.oculta ? 'Volver a mostrarla' : 'Ocultarla'}</button>}
          {!coach && !post.mio && !post.autor.coach && <button class="btn" onClick={alAvisar}><Icono n="bandera" /> Avisar al coach</button>}
          {(coach || post.mio) && <button class="btn btn-peligro" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar</button>}
          {!coach && post.mio && <p class="mini terciario">Lo ven los del equipo y tu coach mientras sigas en la comunidad.</p>}
        </div>
      )}
    </Hoja>
  );
}

function HojaAvisar({ postId = null, comentarioId = null, alCerrar }) {
  const { api, aviso } = useApp();
  const [motivo, setMotivo] = useState('');
  const [ocupado, una] = useUnaVez();
  return (
    <Hoja titulo="Avisar al coach" alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try { await api.avisarAlCoach({ postId, comentarioId, motivo }); aviso('Hecho: tu coach lo mirará'); alCerrar(); } catch (err) { aviso(err.message, 'error'); }
        });
      }}>
        <p class="secundario">Tu coach lo verá en Revisar y decidirá. A quien lo ha escrito no se le dice quién ha avisado.</p>
        <div class="campo">
          <label for="eq-motivo">Por qué (si quieres)</label>
          <textarea id="eq-motivo" class="area" maxLength={MAX_MOTIVO} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />
        </div>
        <button class="btn btn-primario" disabled={ocupado}><Icono n="bandera" /> Avisar al coach</button>
      </form>
    </Hoja>
  );
}

function HojaComentarios({ post, coach, personas = {}, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const abrir = usePerfil();
  const lista = useCarga(() => api.comentariosComunidad(post.id), [post.id]);
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState([]);
  const [avisar, setAvisar] = useState(null);
  const [ocupado, una] = useUnaVez();
  const recargar = async () => { await lista.recargar(true); alCambiar(); };
  const enviar = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.comentarEnComunidad(post.id, texto, mencionesDeTexto(texto, elegidas)); setTexto(''); setElegidas([]); await recargar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const accion = (fn, texto2) => una(async () => { try { await fn(); aviso(texto2); await recargar(); } catch (err) { aviso(err.message, 'error'); } });
  return (
    <Hoja titulo="Comentarios" alCerrar={alCerrar}>
      <div class="pila">
        {lista.cargando && !lista.datos ? <Cargando texto="Cargando los comentarios" /> : !(lista.datos || []).length ? (
          <p class="secundario">Aún no hay comentarios. ¡Anímale!</p>
        ) : (
          <ul class="lista comentarios-equipo">
            {lista.datos.map((c) => (
              <li key={c.id} class="comentario-equipo">
                {/* (la foto también abre el perfil, con el dedo; con el teclado, el nombre) */}
                <button type="button" class="btn-persona comentario-avatar" tabIndex={-1} aria-hidden="true" title={`Ver el perfil de ${c.autor.nombre}`} onClick={() => abrir(c.autor_id)}><Avatar nombre={c.autor.nombre} foto={c.autor.foto} clase="peq" /></button>
                <div class="pila-xs">
                  <span class="peq"><BotonPersona perfilId={c.autor_id} nombre={c.autor.nombre} avatar={false} clase="comentario-nombre"><strong>{c.autor.nombre}</strong></BotonPersona>{c.autor.coach && <span class="chip morado chip-mini">Coach</span>} <span class="mini terciario">{cuando(c.creado_en)}</span></span>
                  <TextoConMenciones texto={c.texto} mencionados={c.mencionados} clase="post-texto peq" como="span" />
                  {c.oculto && <span class="mini terciario">Oculto: los atletas no lo ven.</span>}
                  <span class="fila-envolver comentario-acciones">
                    {(coach || c.mio) && <button class="btn-texto mini peligro" disabled={ocupado} onClick={() => accion(() => api.borrarComentarioComunidad(c.id), 'Comentario borrado')}>Borrar</button>}
                    {coach && !c.mio && <button class="btn-texto mini" disabled={ocupado} onClick={() => accion(() => api.ocultarComentarioComunidad(c.id, !c.oculto), c.oculto ? 'Vuelve a verse' : 'Comentario oculto')}>{c.oculto ? 'Mostrar' : 'Ocultar'}</button>}
                    {!coach && !c.mio && !c.autor.coach && <button class="btn-texto mini" onClick={() => setAvisar(c.id)}>Avisar al coach</button>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form class="pila-s" onSubmit={enviar}>
          <AreaConMenciones id="eq-comentario" etiqueta="Tu comentario" valor={texto} alCambiar={setTexto} personas={personas}
            alMencionar={(p) => setElegidas((l) => [...l.filter((x) => x.perfil_id !== p.perfil_id), p])} maxLength={MAX_COMENTARIO} rows={2} placeholder="Escribe un comentario… (@ para mencionar)" />
          <button class="btn btn-primario" disabled={ocupado || !texto.trim()}><Icono n="enviar" /> Comentar</button>
        </form>
      </div>
      {avisar && <HojaAvisar comentarioId={avisar} alCerrar={() => setAvisar(null)} />}
    </Hoja>
  );
}

// ---------------------------------------------------------------- retos
export function Retos({ coach = false, miembro = null, cambios = 0, alCompartirLogro = null }) {
  const { api } = useApp();
  const retos = useCarga(() => api.retosComunidad(), [cambios]);
  const [editar, setEditar] = useState(null); // {} nuevo · reto
  const hoy = hoyISO();
  const lista = retos.datos || [];
  const orden = { en_marcha: 0, proximo: 1, terminado: 2 };
  const ordenados = [...lista].sort((a, b) => orden[estadoReto(a, hoy)] - orden[estadoReto(b, hoy)]);
  return (
    <div class="pila retos">
      {coach && <button class="btn" style="justify-self:start" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo reto</button>}
      <ErrorCaja error={retos.error} reintentar={() => retos.recargar()} />
      {retos.cargando && !retos.datos ? <Siluetas forma="tarjetas" n={2} texto="Cargando los retos" />
        : !ordenados.length ? <Vacio icono="diana" titulo="Aún no hay retos">{coach ? 'Crea uno: un número de sesiones entre dos fechas, para cada uno o entre todo el equipo.' : 'Cuando tu coach proponga uno, lo verás aquí.'}</Vacio>
          : ordenados.map((r) => <TarjetaReto key={r.id} r={r} hoy={hoy} coach={coach} miembro={miembro} alEditar={() => setEditar(r)} alCompartirLogro={alCompartirLogro} />)}
      {editar && <HojaReto reto={editar.id ? editar : null} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); retos.recargar(true); }} />}
    </div>
  );
}

function TarjetaReto({ r, hoy, coach, miembro, alEditar, alCompartirLogro }) {
  const equipo = r.modo === 'equipo';
  const yo = r.progreso.find((x) => x.yo);
  const conseguido = r.progreso.filter((x) => x.hechas >= r.objetivo).length;
  const estado = estadoReto(r, hoy);
  // En un reto de equipo, mis sesiones no cuentan si no salgo en el ranking (como en la base)
  const fueraDelTotal = !!yo && !!miembro?.sin_ranking;
  const top = r.progreso.filter((x) => x.hechas > 0 && !(x.yo && fueraDelTotal)).slice(0, 3);
  const pct = r.objetivo ? Math.min(100, Math.round((r.total / r.objetivo) * 100)) : 0;
  return (
    <article class={`panel panel-pad pila-s reto ${equipo ? 'reto-de-equipo' : ''}`} aria-label={`Reto: ${r.titulo}`}>
      <div class="separa">
        <div class="pila-xs">
          <h2 class="reto-titulo">{r.titulo}</h2>
          <span class="mini terciario">{equipo ? 'De equipo · ' : ''}{fmtCorta(r.desde)} – {fmtCorta(r.hasta)} · {r.objetivo} {r.objetivo === 1 ? 'sesión' : 'sesiones'}{equipo ? ' entre todos' : ''}</span>
        </div>
        <span class={`chip ${estado === 'en_marcha' ? 'morado' : ''}`}>{textoReto(r, hoy)}</span>
      </div>
      {r.descripcion && <p class="peq secundario post-texto">{r.descripcion}</p>}
      {equipo ? (
        <div class="reto-equipo pila-s">
          <div class="separa re-cifra">
            <span><strong class="num re-total">{r.total}</strong> <span class="secundario">de {r.objetivo} sesiones entre todo el equipo</span></span>
            {r.total >= r.objetivo && <span class="chip ok"><Icono n="trofeo" /> ¡Conseguido!</span>}
          </div>
          <span class="barra-equipo barra-grande" role="progressbar" aria-valuemin="0" aria-valuemax={r.objetivo} aria-valuenow={Math.min(r.total, r.objetivo)} aria-label={`El equipo: ${r.total} de ${r.objetivo} sesiones`}>
            <span style={{ width: `${Math.max(pct ? 3 : 0, pct)}%` }} class={r.total >= r.objetivo ? 'lleno' : ''} />
          </span>
          {yo && <p class="peq reto-yo">{fueraDelTotal ? 'No sales en el ranking: tus sesiones no cuentan en el total del equipo.' : <>Tú has sumado <strong class="num">{yo.hechas}</strong></>}</p>}
          {top.length > 0 && (
            <div class="pila-xs">
              <span class="mini terciario">Los que más suman</span>
              <ol class="lista top-equipo">
                {top.map((x) => (
                  <li key={x.perfil_id} class={x.yo ? 'yo' : ''}>
                    <BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto}><span class="btn-persona-nombre">{x.nombre}{x.yo ? ' (tú)' : ''}</span></BotonPersona>
                    <span class="num peq">{x.hechas}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <>
          {yo && <p class="peq reto-yo">{yo.hechas >= r.objetivo ? <><Icono n="trofeo" /> ¡Conseguido! {yo.hechas} de {r.objetivo}</> : <>Llevas <strong class="num">{yo.hechas}</strong> de {r.objetivo}</>}</p>}
          {r.progreso.length > 0 && (
            <ul class="lista progreso-equipo">
              {r.progreso.map((x) => <FilaProgreso key={x.perfil_id} perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} yo={x.yo} hechas={x.hechas} total={r.objetivo} texto={`${Math.min(x.hechas, r.objetivo)}/${r.objetivo}`} />)}
            </ul>
          )}
        </>
      )}
      {!coach && r.conseguido && !r.compartido && alCompartirLogro && (
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => alCompartirLogro(r)}><Icono n="trofeo" /> Compartir el logro</button>
      )}
      <div class="separa">
        <span class="mini terciario">{equipo ? (miembro || coach ? 'Suman las sesiones terminadas de todos (menos de quien no sale en el ranking).' : '')
          : conseguido ? `${conseguido} ${conseguido === 1 ? 'lo ha conseguido' : 'lo han conseguido'}` : 'Cuentan las sesiones terminadas entre esas fechas.'}</span>
        {coach && <button class="btn btn-peq" onClick={alEditar}><Icono n="editar" /> Cambiar</button>}
      </div>
    </article>
  );
}

function FilaProgreso({ perfilId, nombre, foto, yo, hechas, total, texto }) {
  const pct = total ? Math.min(100, Math.round((hechas / total) * 100)) : 0;
  return (
    <li class={`fila-progreso ${yo ? 'yo' : ''}`}>
      <BotonPersona perfilId={perfilId} nombre={nombre} foto={foto}><span class="btn-persona-nombre nombre">{nombre}{yo ? ' (tú)' : ''}</span></BotonPersona>
      <span class="barra-equipo" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={Math.min(hechas, total)} aria-label={`${nombre}: ${hechas} de ${total}`}><span style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }} class={hechas >= total ? 'lleno' : ''} /></span>
      <span class="num peq">{texto}</span>
    </li>
  );
}

function HojaReto({ reto, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const lunes = lunesDe(hoyISO());
  const [f, setF] = useState(() => reto ? { titulo: reto.titulo, descripcion: reto.descripcion || '', desde: reto.desde, hasta: reto.hasta, objetivo: reto.objetivo, modo: reto.modo || 'individual' }
    : { titulo: '', descripcion: '', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 10, modo: 'individual' });
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const c = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const equipo = f.modo === 'equipo';
  const guardar = (e) => {
    e.preventDefault();
    una(async () => { try { await api.guardarReto({ ...f, objetivo: Number(f.objetivo) }, reto?.id || null); aviso(reto ? 'Reto guardado' : 'Reto creado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } });
  };
  return (
    <Hoja titulo={reto ? 'Cambiar el reto' : 'Nuevo reto'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="reto-titulo">Título</label><input id="reto-titulo" class="entrada" maxLength={80} required value={f.titulo} onInput={c('titulo')} placeholder={equipo ? 'Entre todos: 100 sesiones' : 'Noviembre constante'} /></div>
        <div class="campo">
          <span class="etiqueta" id="reto-modo-t">Cómo se consigue</span>
          <div class="segmentos" role="group" aria-labelledby="reto-modo-t">
            {[['individual', 'Cada uno'], ['equipo', 'Entre todos']].map(([k, t]) => <button key={k} type="button" aria-pressed={f.modo === k ? 'true' : 'false'} onClick={() => setF({ ...f, modo: k, objetivo: k === 'equipo' && Number(f.objetivo) <= RETO_MAX.individual && !reto ? 60 : f.objetivo })}>{t}</button>)}
          </div>
        </div>
        <div class="campo"><label for="reto-desc">Descripción (opcional)</label><textarea id="reto-desc" class="area" maxLength={500} value={f.descripcion} onInput={c('descripcion')} /></div>
        <div class="fila-envolver">
          <div class="campo"><label for="reto-desde">Desde</label><input id="reto-desde" type="date" class="entrada" required value={f.desde} onInput={c('desde')} /></div>
          <div class="campo"><label for="reto-hasta">Hasta</label><input id="reto-hasta" type="date" class="entrada" required value={f.hasta} onInput={c('hasta')} /></div>
        </div>
        <div class="campo"><label for="reto-obj">{equipo ? 'Sesiones terminadas entre todo el equipo' : 'Sesiones terminadas para conseguirlo'}</label>
          <input id="reto-obj" type="number" inputMode="numeric" min="1" max={RETO_MAX[f.modo]} class="entrada entrada-num" required value={f.objetivo} onInput={c('objetivo')} /></div>
        <p class="mini terciario">{equipo
          ? 'Una barra para todo el equipo: suman las sesiones de todos (menos de quien ha elegido no salir en el ranking). Salen por su nombre los que más suman.'
          : 'Lo puede conseguir todo el equipo. Cada uno ve cuántas lleva cada miembro (solo el número de sesiones), menos quien ha elegido no salir en el ranking.'}</p>
        <button class="btn btn-primario" disabled={ocupado}>{reto ? 'Guardar' : 'Crear el reto'}</button>
        {reto && (borrar ? (
          <div class="fila-envolver"><span class="peq">¿Borrar este reto?</span><button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>No</button>
            <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => una(async () => { try { await api.borrarReto(reto.id); aviso('Reto borrado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } })}>Sí, borrar</button></div>
        ) : <button type="button" class="btn-texto peligro" style="justify-self:start" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar el reto</button>)}
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- ranking de constancia
// v0.47: los tres primeros, en un podio (los empates, con la misma medalla; con alguna sesión hecha), la racha de
// cada uno, «Semana completa» y «Animar» 🙌
export function Ranking({ miembro = null }) {
  const { api, aviso } = useApp();
  const ranking = useCarga(() => api.rankingComunidad(), []);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), []);
  const [nuevos, setNuevos] = useState([]);
  const [ocupado, una] = useUnaVez();
  const filas = ranking.datos || [];
  const yo = filas.find((x) => x.yo);
  const fuera = !!miembro?.sin_ranking;
  const lista = ordenarRanking(filas.filter((x) => !(fuera && x.yo)));
  const pos = posicionesRanking(lista);
  let n = 0;
  while (n < Math.min(3, lista.length) && lista[n].hechas > 0) n++;
  const podio = lista.length >= 2 ? lista.slice(0, n) : [];
  const resto = lista.slice(podio.length);
  const animado = (id) => nuevos.includes(id) || !!animos.datos?.mandados?.has(id);
  const animar = (x) => una(async () => {
    try { await api.animar(x.perfil_id); setNuevos((l) => [...l, x.perfil_id]); aviso(`Le has mandado ánimo a ${x.nombre} 🙌`); } catch (e) { aviso(e.message, 'error'); }
  });
  const boton = (x) => (x.yo || !animos.datos ? null : <BotonAnimar nombre={x.nombre} animado={animado(x.perfil_id)} ocupado={ocupado} alAnimar={() => animar(x)} />);
  return (
    <div class="pila ranking">
      <p class="peq secundario">Sesiones hechas de las que tenéis esta semana. Solo cuenta la constancia: ni kilos ni peso.</p>
      <ErrorCaja error={ranking.error} reintentar={() => ranking.recargar()} />
      {fuera && <p class="nota peq">No sales en el ranking (lo cambias en los ajustes del equipo).{yo ? ` Tu semana: ${yo.hechas} de ${yo.previstas}.` : ''}{yo?.racha ? ` Tu racha: ${textoRacha(yo.racha)}.` : ''}</p>}
      {ranking.cargando && !ranking.datos ? <Siluetas forma="lista" n={4} texto="Cargando el ranking" />
        : !lista.length ? <Vacio icono="progreso" titulo="Aún no hay nadie en el ranking">Salen los del equipo con sesiones publicadas esta semana.</Vacio> : (
          <>
            {podio.length > 0 && (
              <ol class={`podio podio-${podio.length}`} aria-label="Podio de la semana">
                {podio.map((x, i) => (
                  <li key={x.perfil_id} class={`podio-sitio p${i + 1} m${pos[i]} ${x.yo ? 'yo' : ''}`}>
                    <span class="podio-medalla" role="img" aria-label={MEDALLAS[pos[i]][1]}>{MEDALLAS[pos[i]][0]}</span>
                    <BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} claseAvatar="grande" clase="podio-persona"><span class="podio-nombre">{x.nombre}{x.yo ? ' (tú)' : ''}</span></BotonPersona>
                    <span class="podio-num num">{x.hechas} de {x.previstas}</span>
                    <span class="podio-chips"><Distintivos x={x} /></span>
                    {boton(x)}
                    <span class="podio-peana" aria-hidden="true">{pos[i]}</span>
                  </li>
                ))}
              </ol>
            )}
            {resto.length > 0 && (
              <div class="panel">
                <ol class="lista ranking-lista" start={podio.length + 1}>
                  {resto.map((x, k) => <FilaRanking key={x.perfil_id} x={x} pos={pos[podio.length + k]} boton={boton(x)} />)}
                </ol>
              </div>
            )}
          </>
        )}
    </div>
  );
}
// 🔥 N y «Semana completa»
function Distintivos({ x }) {
  return (
    <>
      {x.racha > 0 && <span class="chip racha"><span aria-hidden="true">🔥</span> {x.racha}<span class="sr"> {x.racha === 1 ? 'semana seguida' : 'semanas seguidas'} con todo hecho</span></span>}
      {x.previstas > 0 && x.hechas >= x.previstas && <span class="chip ok chip-completa"><Icono n="hecho" />Semana completa</span>}
    </>
  );
}
function FilaRanking({ x, pos, boton }) {
  const pct = x.previstas ? Math.min(100, Math.round((x.hechas / x.previstas) * 100)) : 0;
  return (
    <li class={`fila-ranking ${x.yo ? 'yo' : ''}`}>
      <span class="pos num"><span class="sr">Puesto </span>{pos}</span>
      <BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} clase="fr-persona"><span class="btn-persona-nombre">{x.nombre}{x.yo ? ' (tú)' : ''}</span></BotonPersona>
      <span class="fr-animar">{boton}</span>
      <span class="fr-datos">
        <span class="barra-equipo" role="progressbar" aria-valuemin="0" aria-valuemax={x.previstas} aria-valuenow={Math.min(x.hechas, x.previstas)} aria-label={`${x.nombre}: ${x.hechas} de ${x.previstas}`}><span style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }} class={x.hechas >= x.previstas ? 'lleno' : ''} /></span>
        <span class="num peq">{x.hechas} de {x.previstas}</span>
        <Distintivos x={x} />
      </span>
    </li>
  );
}
function BotonAnimar({ nombre, animado, ocupado, alAnimar, grande = false }) {
  if (grande) {
    return (
      <button type="button" class="btn btn-primario btn-animar-grande" disabled={ocupado || animado} onClick={alAnimar}>
        <span aria-hidden="true">🙌</span> {animado ? `Ya has animado a ${nombre} esta semana` : `Animar a ${nombre}`}
      </button>
    );
  }
  return (
    <button type="button" class={`btn btn-peq btn-animar ${animado ? 'hecho' : ''}`} disabled={ocupado || animado} onClick={alAnimar}
      aria-label={animado ? `Ya has animado a ${nombre} esta semana` : `Animar a ${nombre}`} title={animado ? 'Ya le has animado esta semana' : 'Animar'}>
      <span aria-hidden="true">🙌</span>{animado && <Icono n="hecho" />}
    </button>
  );
}

// ---------------------------------------------------------------- el perfil en el equipo (v0.47)
function HojaPerfilEquipo({ perfilId, alCerrar }) {
  const { api, aviso } = useApp();
  const p = useCarga(() => api.perfilComunidad(perfilId), [perfilId]);
  const [animadoAhora, setAnimadoAhora] = useState(false);
  const [ocupado, una] = useUnaVez();
  const x = p.datos;
  const animar = () => una(async () => {
    try { await api.animar(perfilId); setAnimadoAhora(true); aviso(`Le has mandado ánimo a ${x.nombre} 🙌`); } catch (e) { aviso(e.message, 'error'); }
  });
  const resumen = (q) => q.texto || (q.tipo === 'entreno' ? q.resumen?.nombre : q.tipo === 'logro' ? q.resumen?.titulo : '') || (q.foto_ruta ? 'Una foto' : '');
  return (
    <Hoja titulo="Perfil en el equipo" alCerrar={alCerrar}>
      <ErrorCaja error={p.error} reintentar={() => p.recargar()} />
      {p.cargando && !x ? <Cargando texto="Cargando el perfil" /> : !x ? (!p.error && <p class="secundario">Esta persona ya no está en el equipo.</p>) : (
        <div class="pila perfil-equipo">
          <div class="perfil-equipo-cab">
            <Avatar nombre={x.nombre} foto={x.foto} clase="grande" ampliable />
            <div class="pila-xs">
              <span class="fila-envolver"><strong class="pe-nombre">{x.nombre}{x.yo ? ' (tú)' : ''}</strong>{x.coach && <span class="chip morado">Coach</span>}</span>
              {x.desde && <span class="peq secundario">En el equipo desde el {fmtCorta(aISO(new Date(x.desde)))}</span>}
            </div>
          </div>
          {/* (sin racha ni retos no sale nada: igual que de quien no sale en el ranking, así no se deduce) */}
          {!x.coach && (
            <dl class="perfil-equipo-num">
              {x.racha > 0 && <div><dt>Racha</dt><dd><span aria-hidden="true">🔥 </span>{textoRacha(x.racha)}</dd></div>}
              {x.retos > 0 && <div><dt>Retos conseguidos</dt><dd class="num">{x.retos}</dd></div>}
              <div><dt>Entrenos compartidos</dt><dd class="num">{x.entrenos}</dd></div>
            </dl>
          )}
          {x.retos_titulos?.length > 0 && (
            <ul class="pe-retos" aria-label="Retos conseguidos">
              {x.retos_titulos.map((t) => <li key={t} class="chip aviso"><Icono n="trofeo" />{t}</li>)}
            </ul>
          )}
          {!x.yo && !x.coach && <BotonAnimar grande nombre={x.nombre} animado={x.animado || animadoAhora} ocupado={ocupado} alAnimar={animar} />}
          <section class="pila-s">
            <h3 class="pe-sub">{x.yo ? 'Lo último que has publicado' : 'Lo último que ha publicado'}</h3>
            {!x.posts.length ? <p class="peq terciario">Nada todavía.</p> : (
              <ul class="lista pe-posts">
                {x.posts.map((q) => (
                  <li key={q.id} class="pila-xs">
                    <span class="mini terciario">{TIPOS_POST[q.tipo] || 'Publicación'} · {cuando(q.creado_en)}</span>
                    <span class="peq pe-post-texto">{String(resumen(q)).slice(0, 160)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Hoja>
  );
}

// ---------------------------------------------------------------- celebración de un logro (v0.47)
// Al entrar en Equipo con un reto conseguido que este móvil aún no ha celebrado (o desde el reto, «Compartir el
// logro»). Compartirlo publica la tarjeta que hace la base, una vez por reto.
function HojaCelebracion({ reto, celebracion = true, alCerrar, alCompartir }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const equipo = reto.modo === 'equipo';
  const yo = reto.progreso?.find((x) => x.yo);
  const compartir = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.compartirLogro(reto.id, texto); aviso('Logro compartido en el muro'); alCompartir(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo={celebracion ? '¡Reto conseguido!' : 'Compartir el logro'} alCerrar={alCerrar}>
      <form class="pila celebracion" onSubmit={compartir}>
        <div class="celebracion-medalla" aria-hidden="true">
          <span class="cm-rayos" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} class={`cm-confeti c${i}`} />)}
          <span class="cm-disco"><Icono n="trofeo" /></span>
        </div>
        <p class="celebracion-titulo">{reto.titulo}</p>
        <p class="secundario celebracion-texto">
          {equipo ? `Entre todo el equipo habéis hecho ${reto.total} sesiones (el objetivo era ${reto.objetivo}).` : `Has hecho ${yo?.hechas ?? reto.objetivo} de ${reto.objetivo} ${reto.objetivo === 1 ? 'sesión' : 'sesiones'}.`}
          {celebracion ? ' ¡Enhorabuena!' : ''}
        </p>
        <div class="campo"><label for="eq-logro-texto">Unas palabras (opcional)</label>
          <textarea id="eq-logro-texto" class="area" rows={2} maxLength={MAX_POST} placeholder="¿Cómo lo has vivido?" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        <p class="mini terciario">En el muro sale el reto, las sesiones y las fechas, con tu comentario. Nada más.</p>
        <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="trofeo" /> {ocupado ? 'Compartiendo…' : 'Compartirlo en el muro'}</button>
        <button type="button" class="btn" onClick={alCerrar}>Ahora no</button>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- ajustes del atleta
function HojaAjustesComunidad({ miembro, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [nombre, setNombre] = useState(miembro.nombre);
  const [salir, setSalir] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [normas, setNormas] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto, cerrar = false) => una(async () => {
    try { await fn(); aviso(texto); if (cerrar) alCerrar(); alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <>
    <Hoja titulo="Ajustes de la comunidad" alCerrar={alCerrar}>
      <div class="pila">
        <form class="pila-s" onSubmit={(e) => { e.preventDefault(); hacer(() => api.ajustesComunidad({ nombre }), 'Nombre guardado'); }}>
          <div class="campo"><label for="eq-nombre-aj">Tu nombre en el equipo</label><input id="eq-nombre-aj" class="entrada" maxLength={40} value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} /></div>
          <button class="btn btn-peq" style="justify-self:start" disabled={ocupado || !nombreValido(nombre) || nombre.trim() === miembro.nombre}>Guardar el nombre</button>
        </form>
        <div class="panel"><ul class="lista">
          <Interruptor id="eq-sin-ranking" texto="No salir en el ranking" ayuda="Ni en el ranking ni en su podio, ni en los retos de los demás (tus sesiones no suman en los de equipo), ni tu racha ni tus retos en tu perfil. Tú sigues viendo lo tuyo." valor={!!miembro.sin_ranking} desactivado={ocupado}
            alCambiar={(v) => hacer(() => api.ajustesComunidad({ sinRanking: v }), v ? 'Ya no sales en el ranking' : 'Vuelves a salir en el ranking')} />
        </ul></div>
        <details class="pila-s que-se-comparte"><summary>Qué se comparte y con quién</summary><QueSeComparte /></details>
        <button class="btn" style="justify-self:start" onClick={() => setNormas(true)}><Icono n="escudo" /> Normas del equipo</button>
        {!salir ? (
          <button class="btn btn-peligro" style="justify-self:start" onClick={() => setSalir(true)}><Icono n="salir" /> Salir de la comunidad</button>
        ) : (
          <div class="panel panel-pad pila-s">
            <p>Al salir, lo tuyo deja de verse para los demás (y vuelve a verse si entras otra vez). La pestaña sigue ahí para volver cuando quieras.</p>
            <label class="casilla"><input type="checkbox" checked={borrar} onChange={(e) => setBorrar(e.currentTarget.checked)} /><span>Borrar también lo que he publicado, comentado, reaccionado y votado, y los ánimos que he mandado</span></label>
            <div class="fila-envolver">
              <button class="btn" onClick={() => setSalir(false)}>Cancelar</button>
              <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.salirComunidad({ borrar }), 'Has salido de la comunidad', true)}>Salir</button>
            </div>
          </div>
        )}
      </div>
    </Hoja>
    {normas && <HojaNormas alCerrar={() => setNormas(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- compartir un entreno (Resumen de la sesión)
// datos: { sesionId, nombre, fecha, minutos, series, mejores: [{ ejercicio_id, nombre, kg, reps }] }. Los récords
// de la vista previa, con la misma regla que la base (recordsParaEquipo): así la tarjeta sale igual.
export function HojaCompartirEquipo({ datos, alCerrar, alCompartir }) {
  const { api, aviso, atleta } = useApp();
  const [texto, setTexto] = useState('');
  const [kilos, setKilos] = useState(false);
  const [ocupado, una] = useUnaVez();
  const records = useCarga(() => api.recordsParaEquipo(atleta.id, datos.sesionId).catch(() => new Set()), [datos.sesionId]);
  const previa = {
    nombre: datos.nombre, fecha: datos.fecha, minutos: datos.minutos, series: datos.series, con_kilos: kilos,
    ejercicios: datos.mejores.map((m) => ({ nombre: m.nombre, record: !!records.datos?.has(m.ejercicio_id), ...(kilos ? { kg: m.kg, reps: m.reps, e1rm: m.e1rm } : {}) })),
  };
  return (
    <Hoja titulo="Compartir con el equipo" alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try {
            await api.compartirEnEquipo(datos.sesionId, { texto, kilos });
            aviso('Compartido con el equipo');
            alCompartir();
          } catch (err) { aviso(err.message, 'error'); }
        });
      }}>
        <div class="campo"><label for="eq-entreno-texto">Un comentario (opcional)</label>
          <textarea id="eq-entreno-texto" class="area" maxLength={MAX_POST} rows={2} placeholder="¿Cómo ha ido?" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        <div class="panel"><ul class="lista">
          <Interruptor id="eq-kilos" texto="Enseñar los kilos" ayuda="Tu mejor serie de cada ejercicio y las cifras de tus récords" valor={kilos} alCambiar={setKilos} />
        </ul></div>
        <div class="pila-s">
          <span class="mini terciario">Así lo verá el equipo:</span>
          <div class="post post-entreno ee-previa"><TarjetaEntreno r={previa} /></div>
        </div>
        <p class="mini terciario">Lo ven los del equipo y tu coach. Nunca va tu peso corporal ni datos de salud.</p>
        <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="equipo" /> {ocupado ? 'Compartiendo…' : 'Compartir con el equipo'}</button>
      </form>
    </Hoja>
  );
}
