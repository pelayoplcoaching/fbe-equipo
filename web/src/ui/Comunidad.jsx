// La comunidad del equipo (v0.43): el muro, los retos y el ranking de constancia, para el atleta (pestaña Equipo)
// y para el coach. Voluntaria: el atleta entra aceptando lo que se comparte, y puede salir cuando quiera. Los
// permisos los pone la base (migraciones 027 a 029): lo de aquí solo enseña o esconde botones.
// v0.47: resumen de la semana, rachas, podio, perfil del equipo, retos de equipo, celebración de logros, menciones,
// filtros y novedades del muro, encuestas del coach y ánimos.
// v0.69 (migración 041): bienvenida a los nuevos, «Entrenando ahora», compartir los entrenos sin preguntar (en el móvil),
// responder a un comentario y 💪 a un comentario. Sin la 041, lo que la necesita no sale (o lo dice).
// v0.70 (migración 042): compañeros de racha, plantillas de retos, retos por equipos, retos de minutos de cardio y de semanas
// completas, e insignias. Sin la 042, lo del atleta no sale y el coach ve «Disponible tras la migración 042».
// v0.71 (migración 043): temas en el muro, preguntas al coach y «Preguntas del equipo», varias fotos con su galería, guardar
// y buscar en el muro, y la mejor respuesta. Sin la 043, el muro va como antes (y el coach ve «Disponible tras la migración 043»).
// v0.72 (migración 044, lo nuevo en ComunidadCoach.jsx): eventos y quedadas («Próximos» y su tarjeta en el muro), avisos
// programados y plantillas, el atleta de la semana arriba del muro y la moderación (silenciar, lo retenido y el modo lento).
// v0.73 (migración 045, lo nuevo en Celebracion.jsx): el aniversario en FBE (arriba y en el muro), «<Mes> en el equipo», los hitos del
// equipo, las reacciones nuevas y las pegatinas, y los momentos de 24 horas en una tira arriba de Equipo.
import { createContext, Fragment } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CabeceraGrande, useApp, useCarga, useUnaVez, Icono, Avatar, Hoja, Siluetas, Vacio, ErrorCaja, Pestanas, Cargando, cuando, Capa, useAtraparFoco } from './comunes.jsx';
import { Interruptor } from './Ajustes.jsx';
import { usePestanasDeslizables } from './deslizar.js';
import { sinMovimiento } from './transiciones.js';
import { tenirBarra } from './barra-color.js';
import { reducirFoto } from './FotoPerfil.jsx';
import { Ilustracion } from './Ilustraciones.jsx';
import {
  MAX_POST, MAX_COMENTARIO, MAX_MOTIVO, MAX_PREGUNTA, MAX_OPCION, RETO_MAX, FILTROS_MURO, MEDALLAS, nombreEquipo, nombreValido, estadoReto, textoReto,
  ordenarRanking, posicionesRanking, quienes, textoRacha, mencionEnCurso, sugerenciasMencion, insertarMencion, mencionesDeTexto, trozosConMenciones, encuestaCerrada,
  hilosComentarios, DIAS_BIENVENIDA,
  MAX_COMPANEROS, MEDIDAS_RETO, MODOS_RETO, retoMaximo, unidadReto, EQUIPOS_DE_ENTRADA, PLANTILLAS_RETO, plantillaReto, plantillaCon042, repartirEquipos, siguienteInsignia,
  nombreTema, temasPara, temaPorDefecto, FILTROS_MURO_043, MAX_FOTOS, busquedaValida, puedeElegirMejor, etiquetaMejor, mejorPrimero,
  mezclarEventos, silenciadoHasta,
} from '../logica/comunidad.js';
import { Proximos, TarjetaEvento, Programados, HojaPlantillas, TarjetaDestacado, HojaDestacar, HojaSilenciar, LineaSilencio } from './ComunidadCoach.jsx';
import { HojaProgramar } from './Programar.jsx';
import { TarjetaAniversario, TarjetaAniversarioPost, resumenAniversario, MesEnEquipo, HitosEquipo, CelebrarHito, ReaccionesPost, Pegatina, ElegirPegatina, TiraMomentos } from './Celebracion.jsx';
import { REACCIONES_TODAS } from '../logica/celebracion.js';
import { fmtConDia, fmtCorta, hoyISO, sumarDias, lunesDe, aISO, fmtProgramado } from '../logica/fechas.js';
import { num } from '../logica/calculos.js';
import { Pictograma } from './Pictograma.jsx';
import { patronEjercicio } from '../logica/diseno.js';
import { VERSION_COMUNIDAD, AVISO_041, AVISO_042, AVISO_043 } from '../datos/api.js';
import { leerVistoEquipo, guardarVistoEquipo, leerCelebrados, marcarCelebrado, leerAutoCompartir, guardarAutoCompartir } from './comunidad-local.js';
import { NORMAS_COMUNIDAD } from '../datos/normas-comunidad.js';
import { PlegableEquipo } from './PlegableEquipo.jsx';
import { Imagen } from './Imagen.jsx';
import { ListaEquipo } from './atleta/Musica.jsx';
import { pesoTxt } from '../logica/unidades.js';
import { HojaCompartir } from './Compartir.jsx';
import { datosDePost, datosEquipoSemana } from '../logica/compartir.js';

const VISTAS = [['muro', 'Muro'], ['retos', 'Retos'], ['ranking', 'Ranking']];
// v0.71: con la 043, también las preguntas del equipo
const VISTAS_043 = [...VISTAS, ['preguntas', 'Preguntas']];

// ---------------------------------------------------------------- lo que recuerda este móvil (v0.47)
// (pulido 2.10: en ui/comunidad-local.js, para que la app lo lea al arrancar sin cargar esta pantalla)
export { leerVistoEquipo, leerAutoCompartir };

// ---------------------------------------------------------------- el perfil en el equipo (v0.47)
// Tocar a alguien (su foto o su nombre en una publicación, un comentario, el ranking, un reto o una mención) abre su
// perfil en una hoja. Lo dan ConPerfiles (en Equipo, para el atleta y para el coach) y usePerfil.
const PerfilCtx = createContext(null);
const usePerfil = () => useContext(PerfilCtx) || (() => {});
// v0.72 (044): hasta cuándo está silenciado quien mira (null: puede publicar y comentar). Lo da el muro del atleta
const SilencioCtx = createContext(null);
// v0.51: quién ha compartido hoy un entreno en el muro (su foto lleva un aro, como en las historias). Solo con lo que
// ya se ve en el muro: no se comparte nada nuevo de nadie.
const HoyCtx = createContext(new Set());
export const useCompartioHoy = (perfilId) => useContext(HoyCtx).has(perfilId);
export function ConPerfiles({ children, cambios = 0 }) {
  const { api } = useApp();
  const [abierto, setAbierto] = useState(null);
  const hoy = useCarga(() => api.compartieronHoyComunidad().catch(() => new Set()), [cambios]);
  return (
    <PerfilCtx.Provider value={setAbierto}>
      <HoyCtx.Provider value={hoy.datos || new Set()}>
        {children}
        {abierto && <HojaPerfilEquipo perfilId={abierto} alCerrar={() => setAbierto(null)} />}
      </HoyCtx.Provider>
    </PerfilCtx.Provider>
  );
}
// La foto con su aro si ha compartido un entreno hoy. Lo que dice a los lectores de pantalla va después del nombre
// (NotaHoy), no antes
export function AvatarEquipo({ perfilId, nombre, foto = null, clase = '' }) {
  const hoy = useCompartioHoy(perfilId);
  const av = <Avatar nombre={nombre} foto={foto} clase={clase} />;
  return hoy ? <span class="aro-hoy">{av}</span> : av;
}
export function NotaHoy({ perfilId }) {
  return useCompartioHoy(perfilId) ? <span class="sr"> (ha compartido un entreno hoy)</span> : null;
}
// Un nombre (con su foto, si se quiere) que abre el perfil
function BotonPersona({ perfilId, nombre, foto = null, clase = '', avatar = true, claseAvatar = 'peq', children }) {
  const abrir = usePerfil();
  return (
    <button type="button" class={`btn-persona ${clase}`} onClick={() => abrir(perfilId)}>
      {avatar && <AvatarEquipo perfilId={perfilId} nombre={nombre} foto={foto} clase={claseAvatar} />}
      <span class="sr">Ver el perfil de </span>
      {children || <span class="btn-persona-nombre">{nombre}</span>}
      <NotaHoy perfilId={perfilId} />
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
  const con043 = useCarga(() => api.comunidad043().catch(() => null), []);
  const desliz = usePestanasDeslizables(con043.datos ? VISTAS_043 : VISTAS, vista, setVista);
  // Al compartir un logro, el muro, los retos y la racha se vuelven a leer
  const [cambios, setCambios] = useState(0);
  // v0.72: al apuntarse a un evento (en «Próximos» o en el muro), los dos se vuelven a leer
  const [eventos, setEventos] = useState(0);
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
  // v0.69: en su primera semana, quién le ha dado la bienvenida
  const nuevo = !!m.creado_en && Date.parse(m.creado_en) > Date.now() - DIAS_BIENVENIDA * 864e5;
  const bienvenidas = useCarga(() => (nuevo ? api.bienvenidasRecibidas().catch(() => []) : Promise.resolve([])), []);
  const n = racha.datos?.racha || 0;
  const recibidos = animos.datos?.recibidos || [];
  const deBienvenida = bienvenidas.datos || [];
  return (
    <div class="contenido equipo">
      <CabeceraGrande>
        <div class="titulo">
          <h1>Equipo</h1>
          <div class="sub fila-envolver cab-equipo">
            <span>Estás como <button type="button" class="btn-texto btn-yo" onClick={() => abrirPerfil(yo)}><span class="sr">Ver tu perfil en el equipo: </span>{m.nombre}</button></span>
            {n > 0 && <span class="racha-cab"><span aria-hidden="true">🔥</span> {textoRacha(n)}</span>}
          </div>
        </div>
        <button class="btn btn-icono plano" aria-label="Ajustes de la comunidad" onClick={() => setAjustes(true)}><Icono n="ajustes" /></button>
      </CabeceraGrande>
      <TarjetaAniversario />
      <TiraMomentos silencio={silenciadoHasta(m)} cambios={cambios} />
      {deBienvenida.length > 0 && (
        <p class="animos-recibidos peq"><span class="animos-ico" aria-hidden="true">👋</span><span>Te han dado la bienvenida: <strong>{quienes(deBienvenida.map((x) => x.nombre), 3)}</strong></span></p>
      )}
      {recibidos.length > 0 && (
        <p class="animos-recibidos peq"><span class="animos-ico" aria-hidden="true">🙌</span><span>Te han animado esta semana: <strong>{quienes(recibidos.map((x) => x.nombre), 3)}</strong></span></p>
      )}
      <EntrenandoAhora />
      {/* (v0.104) la lista colaborativa del equipo, si el coach la ha enlazado */}
      <ListaEquipo />
      {/* (diseño) plegados en pastillas, para que el muro empiece por las publicaciones */}
      <div class="equipo-filas">
        <PlegableEquipo id="proximos" titulo="Próximos" icono="calendario" cuenta=".pr-item"><Proximos cambios={eventos} alCambiar={() => setEventos((v) => v + 1)} /></PlegableEquipo>
        <PlegableEquipo id="companeros" titulo="Compañeros de racha" icono="equipo" cuenta=".cp-fila"><CompanerosRacha cambios={cambios} /></PlegableEquipo>
      </div>
      <Pestanas opciones={con043.datos ? VISTAS_043 : VISTAS} valor={vista} alCambiar={desliz.cambiar} etiqueta="Equipo" idBase="eq" clase={con043.datos ? 'pestanas-justas' : ''} />
      <div class="pestana-panel deslizable" role="tabpanel" id="eq-panel" aria-labelledby={`eq-${vista}`} key={vista} ref={desliz.panel} {...desliz.gesto}>
        {vista === 'muro' && <Muro cambios={cambios} miembro={m} eventos={eventos} alEventos={() => setEventos((v) => v + 1)} />}
        {vista === 'retos' && <Retos miembro={m} cambios={cambios} alCompartirLogro={(r) => setCelebrar({ reto: r, celebracion: false })} />}
        {vista === 'ranking' && <Ranking miembro={m} />}
        {vista === 'preguntas' && <PreguntasEquipo />}
      </div>
      {ajustes && <HojaAjustesComunidad miembro={m} alCerrar={() => setAjustes(false)} alCambiar={alCambiar} />}
      {celebrar && <HojaCelebracion reto={celebrar.reto} celebracion={celebrar.celebracion} alCerrar={() => cerrarCelebracion(false)} alCompartir={() => cerrarCelebracion(true)} />}
      {/* v0.73: los hitos del equipo, uno a la vez y nunca encima de la celebración de un logro */}
      <CelebrarHito pausado={!!celebrar || !logros.datos} alCompartir={() => setCambios((c) => c + 1)} />
    </div>
  );
}

// Qué se comparte y con quién (la entrada y los ajustes)
function QueSeComparte() {
  return (
    <>
      <div class="pila-s qsc qsc-ven">
        <strong><span class="qsc-ico" aria-hidden="true"><Icono n="equipo" /></span>Qué ven los demás</strong>
        <ul class="puntos secundario">
          <li>Tu nombre en el equipo y tu foto de perfil.</li>
          <li>Lo que publiques, comentes o compartas, tus reacciones, tus votos en las encuestas del coach, los ánimos que mandas y a quién mencionas.</li>
          <li>Cuántas sesiones llevas en los retos y en el ranking de la semana, y tu racha de semanas completas (puedes no salir).</li>
          <li>Tu perfil del equipo: desde cuándo estás, tu racha, cuántos retos has conseguido (y cuáles) y cuántos entrenos has compartido.</li>
        </ul>
      </div>
      <div class="pila-s qsc qsc-nunca">
        <strong><span class="qsc-ico" aria-hidden="true"><Icono n="candado" /></span>Lo que nunca se comparte</strong>
        <p class="secundario">Tu peso, tus medidas, la nutrición, los check-ins, las molestias, los vídeos de técnica ni lo que hablas con tu coach. Los kilos de un entreno, solo si tú lo eliges al compartirlo.</p>
      </div>
    </>
  );
}

// El coach le ha sacado de la comunidad: no ve nada ni puede volver a entrar hasta que le readmita
function FueraDeLaComunidad() {
  return (
    <div class="contenido">
      <CabeceraGrande><div class="titulo"><h1>Equipo</h1></div></CabeceraGrande>
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
      <CabeceraGrande><div class="titulo"><h1>Equipo</h1><div class="sub">Para animaros entre los atletas de FBE</div></div></CabeceraGrande>
      <section class="panel panel-pad pila entrar-equipo">
        {/* (imágenes) la manada en fila bajo la luna */}
        <Imagen id="equipo-manada" clase="franja-ilu franja-pegada franja-manada" tamanos="(min-width: 720px) 640px, 100vw" prioridad />
        <Ilustracion n="equipo" clase="entrar-equipo-ilu" />
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
export function Muro({ coach = false, cambios = 0, miembro = null, eventos = 0, alEventos = null }) {
  const { api, aviso } = useApp();
  const yo = api.uid();
  const abrirPerfil = usePerfil();
  // v0.72 (044): los eventos (como tarjetas, en su sitio) y el atleta de la semana arriba, en «Todo» y sin búsqueda
  const [vEv, setVEv] = useState(0);
  const listaEventos = useCarga(() => api.eventosComunidad().catch(() => null), [eventos, vEv, cambios]);
  const destacado = useCarga(() => api.destacadoComunidad().catch(() => null), [cambios]);
  const recargarEventos = () => { setVEv((v) => v + 1); alEventos?.(); };
  const silencio = coach ? null : silenciadoHasta(miembro);
  const [filtro, setFiltro] = useState('todo');
  const [paginas, setPaginas] = useState(1);
  // v0.71: la búsqueda que se ha lanzado (la del cuadro, al darle a Buscar o a Intro)
  const [buscar, setBuscar] = useState('');
  const [escrito, setEscrito] = useState('');
  const muro = useCarga(() => api.muro({ limite: 20 * paginas, filtro, buscar }), [paginas, filtro, cambios, buscar]);
  const visto = useRef(coach ? null : leerVistoEquipo(yo)); // la visita anterior (al abrir el muro)
  const d = muro.datos;
  useEffect(() => {
    if (coach || !d || filtro !== 'todo' || buscar) return;
    const ultima = d.posts.filter((x) => !x.mio).map((x) => x.creado_en).sort().at(-1);
    const previo = leerVistoEquipo(yo);
    guardarVistoEquipo(yo, [previo, ultima].filter(Boolean).sort().at(-1) || new Date().toISOString());
  }, [d]);
  // (v0.72: y lo programado, que sale en su lista)
  const [vProg, setVProg] = useState(0);
  const recargar = () => { setVProg((v) => v + 1); return muro.recargar(true); };
  const enTodo = filtro === 'todo' && !buscar;
  const posts = d ? (enTodo && listaEventos.datos?.length ? mezclarEventos(d.posts, listaEventos.datos, { hayMas: d.hayMas }) : d.posts) : [];
  const esNueva = (p) => !!visto.current && !p.mio && !p.fijada && p.creado_en > visto.current;
  const primera = posts.findIndex(esNueva);
  const ultima = posts.map(esNueva).lastIndexOf(true);
  const cambiarFiltro = (f) => { setFiltro(f); setPaginas(1); };
  const con043 = !!d?.con043;
  const filtros = con043 ? FILTROS_MURO_043 : FILTROS_MURO;
  const lanzarBusqueda = (e) => {
    e.preventDefault();
    const t = escrito.trim();
    if (t && !busquedaValida(t)) { aviso('Escribe al menos 2 letras para buscar.', 'error'); return; }
    setBuscar(t); setPaginas(1);
  };
  const quitarBusqueda = () => { setEscrito(''); setBuscar(''); setPaginas(1); };
  return (
    <SilencioCtx.Provider value={silencio}>
    <div class="pila muro">
      {enTodo && destacado.datos?.actual && <TarjetaDestacado d={destacado.datos.actual} alAbrirPerfil={abrirPerfil} />}
      {/* (diseño) los recuentos, plegados; los del mes (solo salen del 1 al 7) vienen abiertos hasta que se cierran */}
      <div class="equipo-filas">
        {enTodo && <PlegableEquipo id="mes" titulo="Resumen del mes" icono="trofeo" abiertaDeEntrada><MesEnEquipo cambios={cambios} /></PlegableEquipo>}
        <PlegableEquipo id="semana" titulo="Resumen de la semana" icono="progreso"><ResumenSemana cambios={cambios} /></PlegableEquipo>
      </div>
      {filtro === 'todo' && !buscar && <BienvenidaNuevos />}
      {silencio ? <LineaSilencio hasta={silencio} /> : <Compositor coach={coach} personas={d?.personas || {}} con043={con043} con044={!!d?.con044} alPublicar={recargar} />}
      {coach && d?.con044 && <Programados cambios={cambios + vProg} alCambiar={() => muro.recargar(true)} />}
      {con043 && (
        <form class="buscar-muro" role="search" aria-label="Buscar en el muro" onSubmit={lanzarBusqueda}>
          <label class="sr" for="eq-buscar">Buscar en el muro</label>
          <input id="eq-buscar" type="search" class="entrada" maxLength={100} placeholder="Buscar por texto o nombre" value={escrito}
            onInput={(e) => { setEscrito(e.currentTarget.value); if (!e.currentTarget.value && buscar) quitarBusqueda(); }} />
          <button class="btn btn-icono" aria-label="Buscar"><Icono n="buscar" /></button>
        </form>
      )}
      <div class="filtros-muro" role="group" aria-label="Qué ver en el muro">
        {filtros.map(([k, t]) => <button key={k} type="button" class="chip-filtro" aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => cambiarFiltro(k)}>{t}</button>)}
      </div>
      {buscar && (
        <p class="busqueda-activa peq" role="status"><span>Resultados de «<strong>{buscar}</strong>»</span>
          <button type="button" class="btn-texto mini" onClick={quitarBusqueda}>Quitar la búsqueda</button></p>
      )}
      <ErrorCaja error={muro.error} reintentar={() => muro.recargar()} />
      {!d ? <Siluetas forma="tarjetas" n={3} texto="Cargando el muro" />
        : !posts.length ? (buscar
          ? <Vacio icono="buscar" titulo="Nada por aquí">No hay publicaciones con «{buscar}»{filtro !== 'todo' ? ' en este filtro' : ''}. Prueba con otras palabras.</Vacio>
          : filtro === 'guardados'
            ? <Vacio icono="guardar" titulo="Aún no has guardado nada">Toca «Guardar» en una publicación para tenerla aquí (solo la ves tú, en todos tus móviles).</Vacio>
            : filtro === 'todo'
              ? <Vacio ilustracion="equipo" titulo="Aún no hay nada en el muro">{coach ? 'Publica un aviso para darles la bienvenida.' : 'Sé el primero: cuenta qué tal tu semana o comparte tu próximo entreno.'}</Vacio>
              : <Vacio icono="equipo" titulo="Nada por aquí">No hay publicaciones con este filtro. Prueba con «Todo».</Vacio>
        ) : posts.map((p, i) => (
          <Fragment key={p.id}>
            {i === primera && <div class="muro-separa nuevo"><span>Nuevo<span class="sr"> desde tu última visita</span></span></div>}
            {p.esEvento ? <TarjetaEvento e={p} coach={coach} alCambiar={recargarEventos} /> : <TarjetaPost post={p} coach={coach} personas={d.personas} alCambiar={recargar} />}
            {i === ultima && i < posts.length - 1 && <div class="muro-separa"><span>Ya lo habías visto</span></div>}
          </Fragment>
        ))}
      {d?.hayMas && <button class="btn" onClick={() => setPaginas(paginas + 1)}>Ver más</button>}
    </div>
    </SilencioCtx.Provider>
  );
}

// ---------------------------------------------------------------- v0.69: bienvenida y «Entrenando ahora»
// Quien ha entrado por primera vez en los últimos 7 días: «Ana L. se ha unido al equipo» con «Dar la bienvenida 👋» (una vez
// por persona; nunca a uno mismo). Sale de comunidad_nuevos() (041): sin ella, nada.
function BienvenidaNuevos() {
  const { api, aviso } = useApp();
  const nuevos = useCarga(() => api.nuevosComunidad().catch(() => []), []);
  const [dadas, setDadas] = useState([]);
  const [ocupado, una] = useUnaVez();
  const lista = nuevos.datos || [];
  if (!lista.length) return null;
  const dar = (x) => una(async () => {
    try { await api.darBienvenida(x.perfil_id); setDadas((l) => [...l, x.perfil_id]); aviso(`Le has dado la bienvenida a ${x.nombre} 👋`); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <div class="pila-s bienvenidas-nuevos">
      {lista.map((x) => {
        const dada = x.bienvenida || dadas.includes(x.perfil_id);
        return (
          <section key={x.perfil_id} class="panel panel-pad bienvenida-nuevo" aria-label={`${x.nombre} se ha unido al equipo`}>
            <span class="bn-ico" aria-hidden="true">👋</span>
            <div class="bn-texto pila-xs">
              <span><BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} avatar={false}><strong class="btn-persona-nombre">{x.nombre}</strong></BotonPersona> se ha unido al equipo</span>
              <span class="mini terciario">{cuando(x.desde)}</span>
            </div>
            <button type="button" class={`btn btn-peq ${dada ? 'hecho' : 'btn-primario'} bn-boton`} disabled={ocupado || dada} onClick={() => dar(x)}
              aria-label={dada ? `Ya le has dado la bienvenida a ${x.nombre}` : `Dar la bienvenida a ${x.nombre}`}>
              {dada ? <><Icono n="hecho" /> Bienvenida dada</> : <>Dar la bienvenida <span aria-hidden="true">👋</span></>}
            </button>
          </section>
        );
      })}
    </div>
  );
}

// Arriba en Equipo: quién está entrenando ahora (solo quien lo ha encendido; ni horas ni nada de su sesión) con «🙌», que
// manda el ánimo de siempre (uno por persona y semana). Se vuelve a mirar cada dos minutos con la pestaña delante.
export function EntrenandoAhora() {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const ahora = useCarga(() => api.entrenandoAhora(), [vuelta]);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), []);
  const [nuevos, setNuevos] = useState([]);
  const [ocupado, una] = useUnaVez();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setVuelta((v) => v + 1); }, 120000);
    return () => clearInterval(t);
  }, []);
  const lista = ahora.datos || [];
  if (!lista.length) return null;
  const animado = (id) => nuevos.includes(id) || !!animos.datos?.mandados?.has(id);
  const animar = (x) => una(async () => {
    try { await api.animar(x.perfil_id); setNuevos((l) => [...l, x.perfil_id]); aviso(`Le has mandado ánimo a ${x.nombre} 🙌`); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad entrenando-ahora" aria-labelledby="eq-entrenando-t">
      <h2 id="eq-entrenando-t" class="ea-t"><span class="ea-punto" aria-hidden="true" />Entrenando ahora</h2>
      <ul class="ea-lista">
        {lista.map((x) => (
          <li key={x.perfil_id} class="ea-persona">
            <BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} clase="ea-quien" claseAvatar="">
              <span class="btn-persona-nombre ea-nombre">{x.nombre}</span>
            </BotonPersona>
            <BotonAnimar nombre={x.nombre} animado={animado(x.perfil_id)} ocupado={ocupado} alAnimar={() => animar(x)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- v0.70: compañeros de racha e insignias
// Arriba en Equipo: tus parejas («Tú y Rubén M. · 🔥 4 semanas», con cómo va la semana de cada uno), las invitaciones que te
// llegan (Aceptar / Ahora no) y las que has mandado. Sin la 042, nada.
const estadoSemana = (v) => (v === true ? '✓ completa' : v === false ? 'aún no' : 'sin sesiones');
function CompanerosRacha({ cambios = 0 }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.companerosComunidad(), [vuelta, cambios]);
  const [invitar, setInvitar] = useState(false);
  const [terminar, setTerminar] = useState(null);
  const [ocupado, una] = useUnaVez();
  const filas = lista.datos;
  if (!filas) return null;
  const hacer = (fn, texto) => una(async () => {
    try { await fn(); if (texto) aviso(texto); setTerminar(null); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  const aceptadas = filas.filter((x) => x.estado === 'aceptada');
  const recibidas = filas.filter((x) => x.estado === 'pendiente' && !x.invito);
  const enviadas = filas.filter((x) => x.estado === 'pendiente' && x.invito);
  const libres = MAX_COMPANEROS - aceptadas.length - enviadas.length;
  const confirmar = (x, texto, fn) => (terminar === x.id ? (
    <span class="fila-envolver cp-confirmar">
      <span class="mini">{texto}</span>
      <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={fn}>Sí</button>
      <button type="button" class="btn btn-peq" onClick={() => setTerminar(null)}>No</button>
    </span>
  ) : null);
  return (
    <section class="panel panel-pad pila-s companeros" aria-labelledby="eq-companeros-t">
      <div class="separa">
        <h2 id="eq-companeros-t" class="cp-t"><span aria-hidden="true">🤝 </span>Compañeros de racha</h2>
        {libres > 0 && <button type="button" class="btn btn-peq" onClick={() => setInvitar(true)}><Icono n="mas" /> Invitar</button>}
      </div>
      {!filas.length && <p class="peq secundario">Invita a hasta {MAX_COMPANEROS} del equipo: cada semana que los dos completéis la vuestra, sumáis racha juntos.</p>}
      {recibidas.map((x) => (
        <div key={x.id} class="cp-invitacion pila-xs">
          <span class="peq"><BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} avatar={false}><strong class="btn-persona-nombre">{x.nombre}</strong></BotonPersona> te invita a ser compañeros de racha</span>
          <span class="fila-envolver">
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} aria-label={`Aceptar a ${x.nombre} como compañero de racha`}
              onClick={() => hacer(() => api.responderCompanero(x.id, true), `${x.nombre} y tú ya sois compañeros de racha`)}>Aceptar</button>
            <button type="button" class="btn btn-peq" disabled={ocupado} aria-label={`Rechazar la invitación de ${x.nombre}`}
              onClick={() => hacer(() => api.responderCompanero(x.id, false), 'Invitación rechazada')}>Ahora no</button>
          </span>
        </div>
      ))}
      {(aceptadas.length > 0 || enviadas.length > 0) && (
        <ul class="lista cp-lista">
          {aceptadas.map((x) => (
            <li key={x.id} class="cp-fila">
              <AvatarEquipo perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} clase="peq" />
              <span class="pila-xs cp-texto">
                <span class="cp-pareja">Tú y <BotonPersona perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} avatar={false}><strong class="btn-persona-nombre">{x.nombre}</strong></BotonPersona>
                  {x.racha > 0 && <> · <span aria-hidden="true">🔥</span> {x.racha} {x.racha === 1 ? 'semana' : 'semanas'}<span class="sr"> seguidas los dos</span></>}</span>
                <span class="mini terciario">Esta semana: tú {estadoSemana(x.mi_semana)} · {x.nombre} {estadoSemana(x.su_semana)}</span>
                {confirmar(x, `¿Dejar de ser compañeros con ${x.nombre}?`, () => hacer(() => api.dejarCompanero(x.id), 'Ya no sois compañeros de racha'))}
              </span>
              {terminar !== x.id && <button type="button" class="btn btn-icono plano" aria-label={`Dejar de ser compañeros de racha con ${x.nombre}`} onClick={() => setTerminar(x.id)}><Icono n="cerrar" /></button>}
            </li>
          ))}
          {enviadas.map((x) => (
            <li key={x.id} class="cp-fila cp-enviada">
              <AvatarEquipo perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} clase="peq" />
              <span class="pila-xs cp-texto">
                <span class="peq">Invitación enviada a <strong>{x.nombre}</strong></span>
                {confirmar(x, '¿Retirar la invitación?', () => hacer(() => api.dejarCompanero(x.id), 'Invitación retirada'))}
              </span>
              {terminar !== x.id && <button type="button" class="btn btn-icono plano" aria-label={`Retirar la invitación a ${x.nombre}`} onClick={() => setTerminar(x.id)}><Icono n="cerrar" /></button>}
            </li>
          ))}
        </ul>
      )}
      {invitar && <HojaInvitarCompanero ya={filas.map((x) => x.perfil_id)} alCerrar={() => setInvitar(false)} alInvitar={() => { setInvitar(false); setVuelta((v) => v + 1); }} />}
    </section>
  );
}

// Elegir a quién invitar: los del equipo (ni uno mismo, ni el coach, ni con quien ya hay pareja o invitación)
function HojaInvitarCompanero({ ya = [], alCerrar, alInvitar }) {
  const { api, aviso } = useApp();
  const personas = useCarga(() => api.personasComunidad(), []);
  const [ocupado, una] = useUnaVez();
  const lista = Object.entries(personas.datos || {}).map(([perfil_id, p]) => ({ perfil_id, ...p }))
    .filter((p) => !p.coach && p.perfil_id !== api.uid() && !ya.includes(p.perfil_id))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const invitar = (p) => una(async () => {
    try { await api.invitarCompanero(p.perfil_id); aviso(`Invitación enviada a ${p.nombre}`); alInvitar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Invitar a un compañero de racha" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Si acepta, cada semana que los dos completéis la vuestra sumáis racha juntos. La pareja la veis los dos, tu coach y el equipo (salvo si uno de los dos no sale en el ranking). Cualquiera la puede terminar.</p>
        {personas.cargando && !personas.datos ? <Cargando texto="Cargando el equipo" /> : !lista.length ? <p class="secundario">No hay nadie más a quien invitar ahora mismo.</p> : (
          <ul class="lista cp-invitar">
            {lista.map((p) => (
              <li key={p.perfil_id} class="cp-fila">
                <Avatar nombre={p.nombre} foto={p.foto} clase="peq" />
                <span class="cp-texto">{p.nombre}</span>
                <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} aria-label={`Invitar a ${p.nombre}`} onClick={() => invitar(p)}>Invitar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

// Las insignias conseguidas, en pequeño (junto al nombre en el ranking): emojis con su nombre para los lectores de pantalla
function InsigniasMini({ lista = [] }) {
  const ok = lista.filter((x) => x.conseguida);
  if (!ok.length) return null;
  return (
    <span class="insignias-mini" role="img" aria-label={`Insignias: ${ok.map((x) => x.nombre).join(', ')}`} title={ok.map((x) => x.nombre).join(' · ')}>
      {ok.map((x) => <span key={x.clave} aria-hidden="true">{x.emoji}</span>)}
    </span>
  );
}

// En el perfil: las conseguidas y, en el tuyo, la siguiente con su progreso
function InsigniasPerfil({ lista = [], yo = false }) {
  const ok = lista.filter((x) => x.conseguida);
  const sig = yo ? siguienteInsignia(lista) : null;
  if (!ok.length && !sig) return null;
  return (
    <section class="pila-s insignias-perfil" aria-labelledby="pe-insignias-t">
      <h3 id="pe-insignias-t" class="pe-sub">Insignias</h3>
      {ok.length > 0 ? (
        <ul class="pe-insignias">
          {ok.map((x) => <li key={x.clave} class="chip insignia"><span aria-hidden="true">{x.emoji}</span>{x.nombre}</li>)}
        </ul>
      ) : <p class="peq terciario">{yo ? 'Aún ninguna: la primera está cerca.' : 'Aún ninguna.'}</p>}
      {sig && (
        <div class="pila-xs insignia-siguiente">
          <span class="peq"><span aria-hidden="true">{sig.emoji} </span>Siguiente: <strong>{sig.nombre}</strong> · {sig.como.toLowerCase()}</span>
          <span class="barra-equipo" role="progressbar" aria-valuemin="0" aria-valuemax={sig.meta} aria-valuenow={sig.valor} aria-label={`${sig.nombre}: ${sig.valor} de ${sig.meta}`}>
            <span style={{ width: `${Math.max(sig.valor ? 4 : 0, Math.round((sig.valor / sig.meta) * 100))}%` }} />
          </span>
          <span class="mini terciario num">{sig.valor} de {sig.meta}</span>
        </div>
      )}
    </section>
  );
}

// Esta semana en el equipo (v0.47): solo recuentos, sin quien no sale en el ranking
function ResumenSemana({ cambios = 0 }) {
  const { api } = useApp();
  const r = useCarga(() => api.resumenSemanaComunidad(), [cambios]);
  // (compartir) la semana del equipo como tarjeta (solo recuentos, sin nombres): para el Instagram del coach o del equipo
  const [compartir, setCompartir] = useState(false);
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
      {x.sesiones > 0 && <button type="button" class="btn btn-peq resumen-equipo-compartir" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir la semana del equipo</button>}
      {compartir && <HojaCompartir logro tipo="equipo" titulo="Compartir la semana del equipo" datos={datosEquipoSemana(x)} nota="Solo lleva los recuentos del equipo: ningún nombre." alCerrar={() => setCompartir(false)} />}
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

// v0.71 (043): con un tema (el de entrada, charla; el del coach, avisos) y hasta 4 fotos, reducidas en el móvil. Sin la 043,
// sin tema y con una foto.
// v0.72 (044): el coach, «Publicar ahora» o «Programar» (día y hora de Madrid) y sus plantillas de avisos
function Compositor({ coach, personas = {}, con043 = false, con044 = false, alPublicar }) {
  const { api, aviso } = useApp();
  const [programar, setProgramar] = useState(false);
  const [plantillas, setPlantillas] = useState(false);
  const [modo, setModo] = useState('aviso'); // el coach: aviso o encuesta (v0.47)
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState([]);
  const [fotos, setFotos] = useState([]); // [{ blob, url }]
  const [tema, setTema] = useState(temaPorDefecto(coach));
  const [fijada, setFijada] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [cierre, setCierre] = useState('');
  const [ocupado, una] = useUnaVez();
  const input = useRef(null);
  const urls = useRef([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // (diseño) El del atleta empieza plegado en una línea; al tocarlo se abre y ya se queda abierto mientras siga en el muro
  const [abierto, setAbierto] = useState(coach);
  const encuesta = coach && modo === 'encuesta';
  const maxFotos = con043 ? MAX_FOTOS : 1;
  const elegir = async (e) => {
    const lista = [...(e.currentTarget.files || [])];
    e.currentTarget.value = '';
    if (!lista.length) return;
    const caben = Math.max(0, maxFotos - fotos.length);
    if (lista.length > caben) aviso(`Como mucho ${maxFotos} ${maxFotos === 1 ? 'foto' : 'fotos'} por publicación.`, 'error');
    const nuevas = [];
    for (const f of lista.slice(0, caben)) {
      try { const blob = await reducirFoto(f); const url = URL.createObjectURL(blob); urls.current.push(url); nuevas.push({ blob, url }); } catch (err) { aviso(err.message, 'error'); }
    }
    if (nuevas.length) setFotos((l) => [...l, ...nuevas].slice(0, maxFotos));
  };
  const quitarFoto = (i) => setFotos((l) => l.filter((_, k) => k !== i));
  const publicar = (e, publicarEn = null) => {
    e?.preventDefault();
    return una(async () => {
      try {
        const cuando = publicarEn ? ` para el ${fmtProgramado(publicarEn)}` : '';
        if (encuesta) {
          await api.publicarEnComunidad({ encuesta: { pregunta, opciones, cierre: cierre ? new Date(cierre).toISOString() : null }, fijada, publicarEn });
          setPregunta(''); setOpciones(['', '']); setCierre(''); setFijada(false);
          aviso(publicarEn ? `Encuesta programada${cuando}` : 'Encuesta publicada en el muro');
        } else {
          const post = await api.publicarEnComunidad({ texto, fotos: fotos.map((f) => f.blob), tema: con043 ? tema : null, fijada, menciones: mencionesDeTexto(texto, elegidas), publicarEn });
          setTexto(''); setFotos([]); setFijada(false); setElegidas([]);
          aviso(publicarEn ? `Aviso programado${cuando}` : post?.retenida ? 'Tu publicación está pendiente de revisión' : coach ? 'Aviso publicado en el muro' : tema === 'pregunta' && con043 ? 'Pregunta publicada: tu coach te contesta en los comentarios' : 'Publicado en el equipo');
          setTema(temaPorDefecto(coach));
        }
        setProgramar(false);
        alPublicar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const guardarPlantilla = () => una(async () => {
    try { await api.guardarPlantilla(texto); aviso('Guardado como plantilla'); } catch (err) { aviso(err.message, 'error'); }
  });
  const vacio = !texto.trim() && !fotos.length;
  const encuestaLista = pregunta.trim() && opciones.filter((o) => o.trim()).length >= 2;
  const ahoraLocal = (() => { const d = new Date(Date.now() + 10 * 60000); return `${aISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })();
  const esPregunta = con043 && !coach && tema === 'pregunta';
  const plegado = !coach && !abierto && vacio;
  return (
    <form class={`panel panel-pad pila-s compositor${plegado ? ' compositor-plegado' : ''}`} onSubmit={publicar} onFocusCapture={() => { if (!abierto) setAbierto(true); }} onClick={() => { if (!abierto) setAbierto(true); }}>
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
        <AreaConMenciones id="eq-texto" etiqueta={coach ? 'Aviso para el equipo' : esPregunta ? 'Tu pregunta para el coach' : 'Tu publicación'} valor={texto} alCambiar={setTexto} personas={personas}
          alMencionar={(p) => setElegidas((l) => [...l.filter((x) => x.perfil_id !== p.perfil_id), p])} maxLength={MAX_POST} rows={plegado ? 1 : 2}
          placeholder={coach ? 'Un aviso para todo el equipo…' : esPregunta ? '¿Qué le quieres preguntar a tu coach?' : plegado ? '¿Qué tal tu semana?' : '¿Qué tal tu semana? Anima al equipo… (@ para mencionar)'} />
      )}
      {coach && con044 && !encuesta && (
        <div class="fila-envolver compositor-plantillas">
          <button type="button" class="btn btn-peq plano" onClick={() => setPlantillas(true)}><Icono n="plantillas" /> Usar plantilla</button>
          <button type="button" class="btn btn-peq plano" disabled={ocupado || !texto.trim()} onClick={guardarPlantilla}><Icono n="guardar" /> Guardar como plantilla</button>
        </div>
      )}
      {!encuesta && con043 && (
        <div class="compositor-tema">
          <label for="eq-tema" class="peq">Tema</label>
          <select id="eq-tema" class="entrada entrada-peq" value={tema} onChange={(e) => setTema(e.currentTarget.value)}>
            {temasPara(coach).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
      )}
      {!encuesta && con043 && !coach && (
        <p class="mini terciario compositor-nota">{esPregunta
          ? 'Te contesta tu coach en los comentarios: aquí van las dudas de salud, lesiones, fármacos, suplementos o dieta.'
          : 'Dudas de salud, lesiones, fármacos, suplementos o dieta: al coach, con el tema «Pregunta para el coach».'}</p>
      )}
      {!encuesta && fotos.length > 0 && (
        <ul class="compositor-fotos" aria-label={fotos.length === 1 ? 'La foto que vas a publicar' : `Las ${fotos.length} fotos que vas a publicar`}>
          {fotos.map((f, i) => (
            <li key={f.url} class="compositor-foto">
              <img src={f.url} alt={`Foto ${i + 1} que vas a publicar`} />
              <button type="button" class="btn btn-icono btn-peq quitar-foto" aria-label={`Quitar la foto ${i + 1}`} onClick={() => quitarFoto(i)}><Icono n="cerrar" /></button>
            </li>
          ))}
        </ul>
      )}
      <div class="separa compositor-pie">
        <span class="fila-envolver">
          {!encuesta && <input ref={input} type="file" accept="image/*" multiple={maxFotos > 1} class="sr" tabIndex={-1} aria-label={maxFotos > 1 ? 'Fotos para la publicación' : 'Foto para la publicación'} onChange={elegir} />}
          {!encuesta && fotos.length < maxFotos && (
            <button type="button" class="btn btn-peq plano" onClick={() => input.current?.click()}>
              <Icono n="imagen" /> {maxFotos > 1 ? (fotos.length ? 'Otra foto' : 'Fotos') : 'Foto'}
            </button>
          )}
          {coach && <label class="casilla casilla-peq"><input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.currentTarget.checked)} /><span>Fijar arriba</span></label>}
        </span>
        <span class="fila compositor-enviar">
          {coach && con044 && (
            <button type="button" class="btn btn-peq" disabled={ocupado || (encuesta ? !encuestaLista : !texto.trim())} onClick={() => setProgramar(true)}><Icono n="reloj" /> Programar</button>
          )}
          <button class="btn btn-peq btn-primario" disabled={ocupado || (encuesta ? !encuestaLista : coach ? !texto.trim() : vacio)}>
            {ocupado ? 'Publicando…' : encuesta ? (con044 ? 'Publicar ahora' : 'Publicar encuesta') : coach ? (con044 ? 'Publicar ahora' : 'Publicar aviso') : esPregunta ? 'Preguntar' : 'Publicar'}
          </button>
        </span>
      </div>
      {!encuesta && texto.length > MAX_POST - 200 && <span class="mini terciario">{MAX_POST - texto.length} letras más como mucho</span>}
      {programar && <HojaProgramar titulo={encuesta ? 'Programar la encuesta' : 'Programar el aviso'} boton={encuesta ? 'Programar la encuesta' : 'Programar el aviso'}
        alCerrar={() => setProgramar(false)} alGuardar={({ enviarEn }) => publicar(null, enviarEn)} />}
      {plantillas && <HojaPlantillas alCerrar={() => setPlantillas(false)} alUsar={(t) => { setTexto(t); setPlantillas(false); aviso('Plantilla puesta: cámbiala si quieres antes de publicar'); }} />}
    </form>
  );
}

const TIPOS_POST = { aviso: 'Aviso del coach', entreno: 'Entreno compartido', logro: 'Logro', encuesta: 'Encuesta', aniversario: 'Aniversario en FBE' };

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
  // v0.71 (043): guardar (solo lo ve quien guarda)
  const [guardado, setGuardado] = useState(!!post.guardado);
  useEffect(() => setGuardado(!!post.guardado), [post.guardado]);
  const guardar = () => una(async () => {
    try {
      const v = await api.guardarPost(post.id, !guardado);
      setGuardado(!!v);
      aviso(v ? 'Guardada: la tienes en «Guardados»' : 'Ya no está en «Guardados»');
      alCambiar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  const todos = Object.values(post.reacciones).flat();
  const tipo = TIPOS_POST[post.tipo] || null;
  // El tema (v0.71): el de una publicación, o el de un aviso que no es «Avisos»
  const tema = post.tipo === 'post' || (post.tipo === 'aviso' && post.tema && post.tema !== 'avisos') ? nombreTema(post.tema) : null;
  const meta = [tipo, tema].filter(Boolean).join(' · ');
  return (
    <article class={`panel panel-pad pila-s post post-${post.tipo} ${post.fijada ? 'fijada' : ''} ${post.oculta ? 'oculta' : ''}`} aria-label={`${tipo || 'Publicación'} de ${post.autor.nombre}`}>
      <header class="post-cab">
        <BotonPersona perfilId={post.autor_id} nombre={post.autor.nombre} foto={post.autor.foto} clase="post-autor" claseAvatar="">
          <span class="post-quien">
            <span class="fila-envolver"><strong>{post.autor.nombre}</strong>{post.autor.coach && <span class="chip morado">Coach</span>}</span>
            <span class="mini terciario">{meta ? `${meta} · ` : ''}{cuando(post.creado_en)}</span>
          </span>
        </BotonPersona>
        {post.fijada && <span class="chip post-fijado"><Icono n="chincheta" />Fijado</span>}
        {(coach || post.mio || !post.autor.coach) && <button class="btn btn-icono plano" aria-label="Opciones de la publicación" onClick={() => setHoja('opciones')}><Icono n="opciones" stroke-width="3" /></button>}
      </header>
      {post.oculta && <p class="nota peq">Oculta: los atletas no la ven.</p>}
      {post.retenida && (coach
        ? <p class="nota peq fila-envolver retenida-linea"><span>Pendiente de revisión (lleva una palabra filtrada): los atletas no la ven.</span>
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => una(async () => { try { await api.aprobarComunidad({ postId: post.id }); aviso('Aprobada: ya se ve'); alCambiar(); } catch (e) { aviso(e.message, 'error'); } })}><Icono n="hecho" /> Aprobar</button></p>
        : post.mio && <p class="nota peq retenida-linea" role="status">Tu publicación está pendiente de revisión: la verá el equipo cuando tu coach la apruebe.</p>)}
      {post.tema === 'pregunta' && post.respondidaCoach && <p class="post-pregunta mini"><span class="chip chip-mini ok"><Icono n="hecho" />Respondida por el coach</span></p>}
      {post.tipo === 'encuesta' ? <EncuestaPost post={post} coach={coach} alCambiar={alCambiar} alVerVotos={() => setHoja('votos')} /> : (
        <div class="post-cuerpo" onClick={tocar}>
          {post.tipo === 'entreno' && <TarjetaEntreno r={post.resumen} />}
          {post.tipo === 'logro' && <TarjetaLogro r={post.resumen} />}
          {post.tipo === 'aniversario' && <TarjetaAniversarioPost post={post} />}
          {post.texto && <TextoConMenciones texto={post.texto} mencionados={post.mencionados} />}
          {(post.fotos || []).length > 0 ? <GaleriaPost rutas={post.fotos} autor={post.autor.nombre} /> : post.foto_ruta && <FotoPost ruta={post.foto_ruta} autor={post.autor.nombre} />}
          {pop > 0 && <span class="pop-fuerza" key={pop} aria-hidden="true">💪</span>}
        </div>
      )}
      <div class="post-pie">
        <ReaccionesPost post={post} con045={!!post.con045} ocupado={ocupado} alReaccionar={reaccionar} />
        <span class="post-pie-der">
          <button type="button" class="btn btn-peq plano post-comentar" onClick={() => setHoja('comentarios')}>
            <Icono n="mensaje" /> {post.comentarios ? `${post.comentarios} ${post.comentarios === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}
          </button>
          {post.con043 && (
            <button type="button" class={`btn btn-icono plano post-guardar ${guardado ? 'guardado' : ''}`} aria-label="Guardar" aria-pressed={guardado ? 'true' : 'false'}
              title={guardado ? 'Guardada (solo la ves tú)' : 'Guardar'} disabled={ocupado} onClick={guardar}><Icono n="guardar" /></button>
          )}
        </span>
      </div>
      {todos.length > 0 && <button type="button" class="btn-texto mini quien-reacciona" onClick={() => setHoja('quien')}>{quienes(todos)}</button>}
      {hoja === 'comentarios' && <HojaComentarios post={post} coach={coach} personas={personas} alCerrar={() => setHoja(null)} alCambiar={alCambiar} />}
      {hoja === 'quien' && <HojaQuien post={post} alCerrar={() => setHoja(null)} />}
      {hoja === 'votos' && <HojaVotantes post={post} alCerrar={() => setHoja(null)} />}
      {hoja === 'opciones' && <HojaOpcionesPost post={post} coach={coach} alCerrar={() => setHoja(null)} alCambiar={alCambiar} alAvisar={() => setHoja('avisar')} alSilenciar={() => setHoja('silenciar')} alFuera={() => setHoja('fuera')} />}
      {hoja === 'fuera' && (post.tipo === 'entreno'
        ? <HojaCompartir plantillas datos={datosDePost(post)} titulo="Compartir fuera del equipo" alCerrar={() => setHoja(null)} />
        : <HojaCompartir logro tipo="logro" datos={datosDePost(post)} titulo="Compartir fuera del equipo" alCerrar={() => setHoja(null)} />)}
      {hoja === 'avisar' && <HojaAvisar postId={post.id} alCerrar={() => setHoja(null)} />}
      {hoja === 'silenciar' && <HojaSilenciarDe perfilId={post.autor_id} nombre={post.autor.nombre} alCerrar={() => setHoja(null)} />}
    </article>
  );
}

// La tarjeta de un entreno (la de la base o, al compartir, la vista previa). v0.51: como en Strava: el nombre en
// grande, las cifras condensadas (minutos, series, ejercicios y récords), los ejercicios con su pictograma (sale del
// nombre, que ya se comparte) y los récords resaltados. El resumen no trae los músculos: no hay mapa muscular.
export function TarjetaEntreno({ r }) {
  if (!r) return null;
  const ejercicios = r.ejercicios || [];
  const records = ejercicios.filter((e) => e.record);
  const serie = (e) => (e.kg != null ? `${pesoTxt(e.kg, 2)} × ${e.reps}` : e.reps != null ? `${e.reps} rep` : null);
  const cifras = [
    ['min', r.minutos ?? '—', 'Minutos'],
    ['series', r.series ?? 0, 'Series'],
    ['ejercicios', ejercicios.length, ejercicios.length === 1 ? 'Ejercicio' : 'Ejercicios'],
    ...(records.length ? [['records', records.length, records.length === 1 ? 'Récord' : 'Récords']] : []),
  ];
  return (
    <div class="entreno-equipo">
      <div class="ee-cab">
        <div class="pila-xs"><strong class="t-titular">{r.nombre}</strong>{r.fecha && <span class="mini secundario">{fmtConDia(r.fecha)}</span>}</div>
      </div>
      <dl class="ee-num">
        {cifras.map(([k, v, t]) => <div key={k}><dt class="k">{t}</dt><dd class="v marcador" style="margin:0">{v}</dd></div>)}
      </dl>
      {ejercicios.length > 0 && (
        <ul class="ee-ejercicios">
          {ejercicios.map((e, i) => (
            <li key={i}><Pictograma patron={patronEjercicio(e.nombre || '')} /><span>{e.nombre}</span>{r.con_kilos && serie(e) ? <span class="num secundario">{serie(e)}</span> : <span />}</li>
          ))}
        </ul>
      )}
      {records.map((e, i) => (
        <p class="ee-record" key={i}><Icono n="trofeo" /><span>Récord en {e.nombre}{r.con_kilos && e.e1rm ? ` · 1RM estimado ${pesoTxt(e.e1rm, 1)}` : ''}</span></p>
      ))}
    </div>
  );
}

// La tarjeta de un logro (v0.47): la hace la base al compartirlo (título, modo, objetivo, sesiones y fechas)
export function TarjetaLogro({ r }) {
  if (!r) return null;
  const equipo = r.modo === 'equipo';
  const equipos = r.modo === 'equipos';
  const u = (n) => unidadReto(r.medida || 'sesiones', n);
  return (
    <div class="logro-equipo">
      <span class="le-ico" aria-hidden="true"><Icono n="trofeo" /></span>
      <div class="pila-xs">
        <span class="mini le-k">{equipos ? `Reto por equipos conseguido${r.equipo ? ` · ${r.equipo}` : ''}` : equipo ? 'Reto de equipo conseguido' : 'Reto conseguido'}</span>
        <strong class="le-titulo">{r.titulo}</strong>
        <span class="mini secundario">
          {equipo ? `${r.hechas} ${u(r.hechas)} entre todo el equipo (el objetivo era ${r.objetivo})`
            : equipos ? `${r.hechas} ${u(r.hechas)} su equipo (el objetivo era ${r.objetivo})`
              : `${r.hechas} de ${r.objetivo} ${u(r.objetivo)}`}
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

// v0.71 (043): de 2 a 4 fotos, una detrás de otra: se pasan con el dedo (con el teclado, o con «Anterior» y «Siguiente»)
function GaleriaPost({ rutas = [], autor }) {
  const pista = useRef(null);
  const [i, setI] = useState(0);
  if (rutas.length < 2) return rutas[0] ? <FotoPost ruta={rutas[0]} autor={autor} /> : null;
  const ir = (n) => {
    const el = pista.current;
    const j = Math.max(0, Math.min(rutas.length - 1, n));
    if (el) el.scrollTo({ left: j * el.clientWidth });
    setI(j);
  };
  // (solo cuando se queda en una foto: mientras se desliza hacia la que toca, no cambia)
  const alDeslizar = () => {
    const el = pista.current;
    if (!el || !el.clientWidth) return;
    const j = Math.round(el.scrollLeft / el.clientWidth);
    if (Math.abs(el.scrollLeft - j * el.clientWidth) < 2) setI(Math.max(0, Math.min(rutas.length - 1, j)));
  };
  const tecla = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
  };
  return (
    <div class="galeria-post">
      <div class="galeria-pista" ref={pista} role="group" aria-roledescription="galería" aria-label={`${rutas.length} fotos de ${autor}: desliza para verlas`}
        tabIndex={0} onScroll={alDeslizar} onKeyDown={tecla}>
        {rutas.map((r, k) => <div key={r} class="galeria-foto"><FotoPost ruta={r} autor={autor} n={k + 1} total={rutas.length} /></div>)}
      </div>
      <div class="galeria-pie">
        <button type="button" class="btn btn-icono plano btn-peq" aria-label="Foto anterior" disabled={i === 0} onClick={() => ir(i - 1)}><Icono n="atras" /></button>
        <span class="galeria-puntos" aria-hidden="true">{rutas.map((r, k) => <span key={r} class={k === i ? 'activo' : ''} />)}</span>
        <span class="sr" aria-live="polite">Foto {i + 1} de {rutas.length}</span>
        <button type="button" class="btn btn-icono plano btn-peq" aria-label="Foto siguiente" disabled={i === rutas.length - 1} onClick={() => ir(i + 1)}><Icono n="derecha" /></button>
      </div>
    </div>
  );
}

function FotoPost({ ruta, autor, n = 0, total = 0 }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const [grande, setGrande] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error) return <p class="mini terciario">La foto no está disponible.</p>;
  if (!url) return <div class="post-foto post-foto-cargando" aria-hidden="true" />;
  const alt = total > 1 ? `Foto ${n} de ${total} de ${autor}` : `Foto de ${autor}`;
  // (diseño, tanda 21) la foto se abre en grande desde su sitio (FotoGrande): la miniatura viaja hasta la pantalla
  return (
    <>
      <button type="button" class="post-foto-boton" aria-label={`Ver en grande: ${alt.toLowerCase()}`} onClick={(e) => abrirGrande(e.currentTarget.querySelector('img'), url, alt, setGrande)}>
        <img class="post-foto" src={url} alt={alt} loading="lazy" />
      </button>
      {grande && <FotoGrande src={url} alt={alt} alCerrar={() => cerrarGrande(setGrande)} />}
    </>
  );
}

// (diseño, tanda 21) Una foto del muro a pantalla completa, sobre la noche de la marca. Se abre con una transición de
// vista en la que la miniatura viaja hasta su sitio grande (vt-foto) y vuelve al cerrarse; sin soporte o con «reducir
// movimiento», aparece y se va sin más. Escape, el velo y el botón cierran; el foco vuelve a la miniatura.
let miniaturaGrande = null;
function conVista(cambio) {
  const r = typeof document !== 'undefined' ? document.documentElement : null;
  if (!r || typeof document.startViewTransition !== 'function' || sinMovimiento() || r.dataset.vt) { cambio(); return; }
  r.dataset.vt = 'foto';
  let vt;
  try { vt = document.startViewTransition(() => { cambio(); return new Promise((ok) => setTimeout(ok, 0)); }); } catch { delete r.dataset.vt; cambio(); return; }
  const fin = () => { if (r.dataset.vt === 'foto') delete r.dataset.vt; if (miniaturaGrande) { miniaturaGrande.style.viewTransitionName = ''; } };
  vt.finished.then(fin, fin);
}
// (el nombre compartido solo puede estar en un elemento a la vez: en la miniatura antes de abrir y después de cerrar,
// en la grande mientras está abierta)
function abrirGrande(img, url, alt, setGrande) {
  miniaturaGrande = img || null;
  if (img) img.style.viewTransitionName = 'vt-foto';
  conVista(() => { setGrande(true); if (img) img.style.viewTransitionName = ''; });
}
function cerrarGrande(setGrande) {
  const img = miniaturaGrande;
  conVista(() => { setGrande(false); if (img?.isConnected) img.style.viewTransitionName = 'vt-foto'; });
}
function FotoGrande({ src, alt, alCerrar }) {
  return <Capa><FotoGrandeDentro src={src} alt={alt} alCerrar={alCerrar} /></Capa>;
}
function FotoGrandeDentro({ src, alt, alCerrar }) {
  const ref = useRef(null);
  useAtraparFoco(ref);
  // (diseño, tanda 23) la barra del sistema, de la noche de la foto
  useEffect(() => tenirBarra('#0E0B1E'), []);
  useLayoutEffect(() => {
    const previo = document.activeElement;
    ref.current?.querySelector('.foto-grande-cerrar')?.focus({ preventScroll: true });
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1);
    cuerpo.style.overflow = 'hidden';
    return () => {
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const tecla = (e) => {
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      if (e.key === 'Escape') { e.preventDefault(); alCerrar(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  return (
    <div class="foto-grande" ref={ref} role="dialog" aria-modal="true" aria-label={alt} onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <button type="button" class="btn btn-icono foto-grande-cerrar" aria-label="Cerrar" onClick={alCerrar}><Icono n="cerrar" /></button>
      <img src={src} alt={alt} style={{ viewTransitionName: 'vt-foto' }} />
    </div>
  );
}

function HojaQuien({ post, alCerrar }) {
  return (
    <Hoja titulo="Reacciones" alCerrar={alCerrar}>
      <ul class="lista">
        {REACCIONES_TODAS.filter(([k]) => post.reacciones[k]?.length).map(([k, emoji, nombre]) => (
          <li key={k} class="panel-pad pila-xs"><span><span aria-hidden="true">{emoji}</span> {nombre} ({post.reacciones[k].length})</span><span class="peq secundario">{post.reacciones[k].join(', ')}</span></li>
        ))}
      </ul>
    </Hoja>
  );
}

// v0.72 (044): silenciar (el coach), sabiendo hasta cuándo lo está ya (la fila del miembro solo la ve el coach)
function HojaSilenciarDe({ perfilId, nombre, alCerrar, alCambiar = null }) {
  const { api } = useApp();
  const p = useCarga(() => api.perfilComunidad(perfilId).catch(() => null), [perfilId]);
  if (p.cargando && !p.datos) return null;
  return <HojaSilenciar perfilId={perfilId} nombre={nombre} hasta={silenciadoHasta(p.datos)} alCerrar={alCerrar} alCambiar={alCambiar} />;
}

function HojaOpcionesPost({ post, coach, alCerrar, alCambiar, alAvisar, alSilenciar = null, alFuera = null }) {
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
          {coach && post.con044 && !post.mio && !post.autor.coach && alSilenciar && <button class="btn" onClick={alSilenciar}><Icono n="silencio" /> Silenciar a {post.autor.nombre}</button>}
          {!coach && !post.mio && !post.autor.coach && <button class="btn" onClick={alAvisar}><Icono n="bandera" /> Avisar al coach</button>}
          {/* (compartir) lo mío (un entreno, un logro o un aniversario), como imagen para fuera del equipo */}
          {post.mio && ['entreno', 'logro', 'aniversario'].includes(post.tipo) && alFuera && <button class="btn" onClick={alFuera}><Icono n="compartir" /> Compartir fuera del equipo</button>}
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

// v0.69 (041): cada comentario con «Responder» y 💪 (uno por persona, con cuántos); las respuestas, debajo y sangradas (un
// nivel: responder a una respuesta cuelga del mismo comentario). Sin la 041, como antes.
function HojaComentarios({ post, coach, personas = {}, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.comentariosComunidad(post.id), [post.id]);
  const [texto, setTexto] = useState('');
  const [elegidas, setElegidas] = useState([]);
  const [avisar, setAvisar] = useState(null);
  const [respondiendo, setRespondiendo] = useState(null); // { id, nombre }
  // v0.71 (043): la mejor respuesta (primero, con su distintivo) y, en una pregunta, guardarla como pregunta frecuente
  const [mejor, setMejor] = useState(post.mejor_comentario || null);
  const [frecuente, setFrecuente] = useState(null); // el comentario del coach que se guarda
  const [silenciar, setSilenciar] = useState(null); // v0.72: { perfilId, nombre }
  const [pegatinas, setPegatinas] = useState(false); // v0.73: elegir una pegatina
  const silencio = useContext(SilencioCtx);
  const yo = api.uid();
  const [ocupado, una] = useUnaVez();
  const recargar = async () => { await lista.recargar(true); alCambiar(); };
  const enviar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        const c = await api.comentarEnComunidad(post.id, texto, mencionesDeTexto(texto, elegidas), respondiendo?.id || null);
        setTexto(''); setElegidas([]); setRespondiendo(null); await recargar();
        if (c?.retenido) aviso('Tu comentario está pendiente de revisión');
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const accion = (fn, texto2) => una(async () => { try { await fn(); if (texto2) aviso(texto2); await recargar(); } catch (err) { aviso(err.message, 'error'); } });
  const responder = (c) => {
    setRespondiendo({ id: c.responde_a || c.id, nombre: c.autor.nombre });
    requestAnimationFrame(() => document.getElementById('eq-comentario')?.focus());
  };
  const elegirMejor = (c) => una(async () => {
    const quitar = mejor === c.id;
    try {
      await api.mejorRespuesta(post.id, quitar ? null : c.id);
      setMejor(quitar ? null : c.id);
      aviso(quitar ? 'Ya no está marcada' : `Marcada como ${etiquetaMejor(post, c).toLowerCase()}`);
      await recargar();
    } catch (err) { aviso(err.message, 'error'); }
  });
  const hilos = mejorPrimero(hilosComentarios(lista.datos || []), mejor);
  const item = (c, respuesta = false) => (
    <li key={c.id} class={`comentario-equipo ${respuesta ? 'respuesta' : ''} ${c.id === mejor ? 'mejor' : ''}`}>
      {/* (la foto también abre el perfil, con el dedo; con el teclado, el nombre) */}
      <BotonFoto c={c} />
      <div class="pila-xs">
        <span class="peq"><BotonPersona perfilId={c.autor_id} nombre={c.autor.nombre} avatar={false} clase="comentario-nombre"><strong>{c.autor.nombre}</strong></BotonPersona>{c.autor.coach && <span class="chip morado chip-mini">Coach</span>} <span class="mini terciario">{cuando(c.creado_en)}</span></span>
        {c.id === mejor && <span class="chip chip-mini ok insignia-mejor"><Icono n="hecho" />{etiquetaMejor(post, c)}</span>}
        {c.pegatina ? <Pegatina k={c.pegatina} clase="pegatina-comentario" /> : <TextoConMenciones texto={c.texto} mencionados={c.mencionados} clase="post-texto peq" como="span" />}
        {c.oculto && <span class="mini terciario">Oculto: los atletas no lo ven.</span>}
        {c.retenido && (coach ? <span class="mini terciario">Pendiente de revisión: los atletas no lo ven.</span>
          : c.mio && <span class="mini terciario retenida-linea">Tu comentario está pendiente de revisión: lo verán cuando tu coach lo apruebe.</span>)}
        <span class="fila-envolver comentario-acciones">
          {c.con041 && !c.oculto && (
            <button type="button" class="btn-texto mini fuerza-comentario" aria-pressed={c.miFuerza ? 'true' : 'false'} disabled={ocupado}
              aria-label={`Fuerza: ${c.fuerza.length}${c.fuerza.length ? ` (${c.fuerza.join(', ')})` : ''}`} onClick={() => accion(() => api.reaccionarComentario(c.id))}>
              <span aria-hidden="true">💪</span>{c.fuerza.length > 0 && <span class="num" aria-hidden="true">{c.fuerza.length}</span>}
            </button>
          )}
          {c.con041 && !c.oculto && <button type="button" class="btn-texto mini" onClick={() => responder(c)} aria-label={`Responder a ${c.autor.nombre}`}>Responder</button>}
          {post.con043 && puedeElegirMejor({ post, comentario: c, coach, yo }) && (
            <button type="button" class="btn-texto mini" disabled={ocupado} aria-pressed={c.id === mejor ? 'true' : 'false'} onClick={() => elegirMejor(c)}
              aria-label={c.id === mejor ? `Quitar «${etiquetaMejor(post, c)}» al comentario de ${c.autor.nombre}` : `Marcar el comentario de ${c.autor.nombre} como ${etiquetaMejor(post, c).toLowerCase()}`}>
              {c.id === mejor ? 'Quitar la marca' : etiquetaMejor(post, c)}
            </button>
          )}
          {post.con043 && coach && post.tema === 'pregunta' && c.autor.coach && !c.oculto && (
            <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => setFrecuente(c)}>Guardar como pregunta frecuente</button>
          )}
          {(coach || c.mio) && <button class="btn-texto mini peligro" disabled={ocupado} onClick={() => accion(() => api.borrarComentarioComunidad(c.id), 'Comentario borrado')}>Borrar</button>}
          {coach && !c.mio && <button class="btn-texto mini" disabled={ocupado} onClick={() => accion(() => api.ocultarComentarioComunidad(c.id, !c.oculto), c.oculto ? 'Vuelve a verse' : 'Comentario oculto')}>{c.oculto ? 'Mostrar' : 'Ocultar'}</button>}
          {coach && c.retenido && <button class="btn-texto mini" disabled={ocupado} onClick={() => accion(() => api.aprobarComunidad({ comentarioId: c.id }), 'Aprobado: ya se ve')} aria-label={`Aprobar el comentario de ${c.autor.nombre}`}>Aprobar</button>}
          {coach && post.con044 && !c.mio && !c.autor.coach && <button class="btn-texto mini" onClick={() => setSilenciar({ perfilId: c.autor_id, nombre: c.autor.nombre })} aria-label={`Silenciar a ${c.autor.nombre}`}>Silenciar</button>}
          {!coach && !c.mio && !c.autor.coach && <button class="btn-texto mini" onClick={() => setAvisar(c.id)}>Avisar al coach</button>}
        </span>
        {c.respuestas?.length > 0 && <ul class="lista respuestas-equipo" aria-label={`Respuestas a ${c.autor.nombre}`}>{c.respuestas.map((r) => item(r, true))}</ul>}
      </div>
    </li>
  );
  return (
    <Hoja titulo="Comentarios" alCerrar={alCerrar}>
      <div class="pila">
        {lista.cargando && !lista.datos ? <Cargando texto="Cargando los comentarios" /> : !(lista.datos || []).length ? (
          <p class="secundario">Aún no hay comentarios. ¡Anímale!</p>
        ) : (
          <ul class="lista comentarios-equipo">{hilos.map((c) => item(c))}</ul>
        )}
        {silencio ? <LineaSilencio hasta={silencio} /> : (
        <form class="pila-s" onSubmit={enviar}>
          {respondiendo && (
            <p class="respondiendo peq"><span>Respondiendo a <strong>{respondiendo.nombre}</strong></span>
              <button type="button" class="btn-texto mini" onClick={() => setRespondiendo(null)}>Cancelar la respuesta</button></p>
          )}
          <AreaConMenciones id="eq-comentario" etiqueta={respondiendo ? `Tu respuesta a ${respondiendo.nombre}` : 'Tu comentario'} valor={texto} alCambiar={setTexto} personas={personas}
            alMencionar={(p) => setElegidas((l) => [...l.filter((x) => x.perfil_id !== p.perfil_id), p])} maxLength={MAX_COMENTARIO} rows={2}
            placeholder={respondiendo ? 'Escribe tu respuesta…' : 'Escribe un comentario… (@ para mencionar)'} />
          <span class="fila-envolver comentar-botones">
            <button class="btn btn-primario" disabled={ocupado || !texto.trim()}><Icono n="enviar" /> {respondiendo ? 'Responder' : 'Comentar'}</button>
            {post.con045 && (
              <button type="button" class="btn" aria-expanded={pegatinas ? 'true' : 'false'} onClick={() => setPegatinas(!pegatinas)}><span aria-hidden="true">✨</span> Pegatina</button>
            )}
          </span>
          {pegatinas && post.con045 && (
            <ElegirPegatina ocupado={ocupado} alElegir={(k) => una(async () => {
              try {
                const c = await api.pegatinaEnComunidad(post.id, k, respondiendo?.id || null);
                setPegatinas(false); setRespondiendo(null); await recargar();
                if (c?.retenido) aviso('Tu comentario está pendiente de revisión');
              } catch (err) { aviso(err.message, 'error'); }
            })} />
          )}
        </form>
        )}
      </div>
      {silenciar && <HojaSilenciarDe perfilId={silenciar.perfilId} nombre={silenciar.nombre} alCerrar={() => setSilenciar(null)} />}
      {avisar && <HojaAvisar comentarioId={avisar} alCerrar={() => setAvisar(null)} />}
      {frecuente && <HojaPreguntaFrecuente post={post} comentario={frecuente} alCerrar={() => setFrecuente(null)}
        alGuardar={async () => { setFrecuente(null); setMejor(frecuente.id); await recargar(); }} />}
    </Hoja>
  );
}

// v0.71 (043): el coach guarda una pregunta y su respuesta como pregunta frecuente (puede retocar los dos textos). Se guarda sin el
// nombre de quien preguntó y la ven todos los de dentro en «Preguntas».
function HojaPreguntaFrecuente({ post, comentario, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [pregunta, setPregunta] = useState(post.texto || '');
  const [respuesta, setRespuesta] = useState(comentario.texto || '');
  const [ocupado, una] = useUnaVez();
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        await api.guardarPreguntaFrecuente({ postId: post.id, comentarioId: comentario.id, pregunta, respuesta });
        aviso('Guardada en «Preguntas del equipo»');
        await alGuardar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo="Guardar como pregunta frecuente" alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <p class="peq secundario">La verán todos los del equipo en «Preguntas», sin el nombre de quien preguntó. Puedes retocar los textos (por ejemplo, quitar algo personal).</p>
        <div class="campo"><label for="eq-faq-pregunta">Pregunta</label>
          <textarea id="eq-faq-pregunta" class="area" rows={3} maxLength={MAX_POST} value={pregunta} onInput={(e) => setPregunta(e.currentTarget.value)} /></div>
        <div class="campo"><label for="eq-faq-respuesta">Respuesta</label>
          <textarea id="eq-faq-respuesta" class="area" rows={4} maxLength={MAX_POST} value={respuesta} onInput={(e) => setRespuesta(e.currentTarget.value)} /></div>
        <button class="btn btn-primario" disabled={ocupado || !pregunta.trim() || !respuesta.trim()}><Icono n="hecho" /> Guardar como pregunta frecuente</button>
      </form>
    </Hoja>
  );
}

// v0.71 (043): las preguntas del equipo, las que el coach ha contestado en el muro y ha guardado. El coach las puede quitar.
// Sin la 043, el coach ve «Disponible tras la migración 043» (al atleta no le sale la pestaña).
export function PreguntasEquipo({ coach = false }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.preguntasEquipo(), [vuelta]);
  const [ocupado, una] = useUnaVez();
  if (lista.datos === null && lista.cargando) return <Siluetas forma="tarjetas" n={2} texto="Cargando las preguntas" />;
  if (lista.datos === null) return <Vacio icono="pregunta" titulo="Preguntas del equipo">{AVISO_043}.</Vacio>;
  const filas = lista.datos || [];
  const quitar = (q) => una(async () => {
    try { await api.borrarPreguntaFrecuente(q.id); aviso('Pregunta quitada de la lista'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="pila preguntas-equipo" aria-labelledby="eq-preguntas-t">
      <div class="pila-xs">
        <h2 id="eq-preguntas-t" class="preguntas-t">Preguntas del equipo</h2>
        <p class="peq secundario">{coach
          ? 'Las preguntas del muro que has contestado y guardado. Las ven todos los del equipo, sin el nombre de quien preguntó.'
          : 'Lo que tu coach ha contestado en el muro, a mano para todos. ¿Tienes otra? Publícala en el muro con el tema «Pregunta para el coach».'}</p>
      </div>
      {!filas.length ? (
        <Vacio icono="pregunta" titulo="Aún no hay preguntas guardadas">{coach ? 'En una pregunta del muro, en tu respuesta: «Guardar como pregunta frecuente».' : 'Cuando tu coach conteste y guarde alguna, saldrá aquí.'}</Vacio>
      ) : (
        <ul class="lista preguntas-lista">
          {filas.map((q) => (
            <li key={q.id} class="panel pregunta-equipo">
              <details>
                <summary><span class="pe-pregunta">{q.pregunta}</span></summary>
                <div class="pila-xs pe-respuesta">
                  <span class="mini le-k">Respuesta del coach</span>
                  <p class="post-texto peq">{q.respuesta}</p>
                  <span class="mini terciario">{fmtConDia(aISO(new Date(q.actualizado_en || q.creado_en)))}</span>
                  {coach && <button type="button" class="btn btn-peq btn-peligro" style="justify-self:start" disabled={ocupado} onClick={() => quitar(q)}><Icono n="basura" /> Quitar de la lista</button>}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
// La foto de quien comenta, que abre su perfil (fuera del orden del teclado: con él, el nombre)
function BotonFoto({ c }) {
  const abrir = usePerfil();
  return (
    <button type="button" class="btn-persona comentario-avatar" tabIndex={-1} aria-hidden="true" title={`Ver el perfil de ${c.autor.nombre}`} onClick={() => abrir(c.autor_id)}>
      <Avatar nombre={c.autor.nombre} foto={c.autor.foto} clase="peq" />
    </button>
  );
}

// ---------------------------------------------------------------- retos
export function Retos({ coach = false, miembro = null, cambios = 0, alCompartirLogro = null }) {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const retos = useCarga(() => api.retosComunidad(), [cambios, vuelta]);
  const con042 = useCarga(() => api.comunidad042().catch(() => null), []);
  const [editar, setEditar] = useState(null); // {} nuevo · reto
  // (v0.70) al encender «Contar mis minutos» desde un reto, ya cuentan en todos (aunque el miembro aún no se haya vuelto a leer)
  const [cardioYa, setCardioYa] = useState(false);
  const hoy = hoyISO();
  const lista = retos.datos || [];
  const orden = { en_marcha: 0, proximo: 1, terminado: 2 };
  const ordenados = [...lista].sort((a, b) => orden[estadoReto(a, hoy)] - orden[estadoReto(b, hoy)]);
  return (
    <div class="pila retos">
      {coach && <button class="btn" style="justify-self:start" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo reto</button>}
      <ErrorCaja error={retos.error} reintentar={() => retos.recargar()} />
      {retos.cargando && !retos.datos ? <Siluetas forma="tarjetas" n={2} texto="Cargando los retos" />
        : !ordenados.length ? <Vacio icono="diana" titulo="Aún no hay retos">{coach ? 'Crea uno: sesiones, minutos de cardio o semanas completas entre dos fechas, para cada uno, entre todo el equipo o por equipos.' : 'Cuando tu coach proponga uno, lo verás aquí.'}</Vacio>
          : ordenados.map((r, i) => <TarjetaReto key={r.id} ilu={i === 0} r={r} hoy={hoy} coach={coach} miembro={miembro} alEditar={() => setEditar(r)} alCompartirLogro={alCompartirLogro} cardioYa={cardioYa} alContarCardio={() => { setCardioYa(true); setVuelta((v) => v + 1); }} />)}
      {editar && <HojaReto reto={editar.id ? editar : null} con042={con042.datos === true} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); retos.recargar(true); }} />}
    </div>
  );
}

function TarjetaReto({ ilu = false, r, hoy, coach, miembro, alEditar, alCompartirLogro, cardioYa = false, alContarCardio }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const medida = r.medida || 'sesiones';
  const u = (n) => unidadReto(medida, n);
  const equipo = r.modo === 'equipo';
  const equipos = r.modo === 'equipos';
  const yo = r.progreso.find((x) => x.yo);
  const conseguido = r.progreso.filter((x) => x.hechas >= r.objetivo).length;
  const estado = estadoReto(r, hoy);
  // En un reto «Entre todos», lo mío no cuenta si no salgo en el ranking (como en la base); por equipos, sí
  const fueraDelTotal = !!yo && !!miembro?.sin_ranking && (equipo || equipos);
  // En uno de cardio, mis minutos solo cuentan si lo he encendido (v0.70)
  const sinCardio = medida === 'cardio' && !!yo && !!miembro && !miembro.cardio_en_retos && !cardioYa;
  const top = r.progreso.filter((x) => x.hechas > 0 && !(x.yo && (fueraDelTotal || sinCardio))).slice(0, 3);
  const pct = r.objetivo ? Math.min(100, Math.round((r.total / r.objetivo) * 100)) : 0;
  const contarCardio = () => una(async () => {
    try { await api.cardioEnRetos(true); aviso('Tus minutos de cardio ya cuentan en los retos'); alContarCardio?.(); } catch (e) { aviso(e.message, 'error'); }
  });
  const modoTexto = equipos ? 'Por equipos · ' : equipo ? 'De equipo · ' : '';
  return (
    <article class={`panel panel-pad pila-s reto ${equipo || equipos ? 'reto-de-equipo' : ''} ${equipos ? 'reto-equipos' : ''}`} aria-label={`Reto: ${r.titulo}`}>
      {/* (imágenes) el primero de la lista (el que está en marcha), con la montaña y su camino */}
      {ilu && <Imagen id="equipo-reto" clase="franja-ilu franja-pegada franja-reto" tamanos="(min-width: 720px) 640px, 100vw" />}
      <div class="separa">
        <div class="pila-xs">
          <h2 class="reto-titulo">{r.titulo}</h2>
          <span class="mini terciario">{modoTexto}{fmtCorta(r.desde)} – {fmtCorta(r.hasta)} · {r.objetivo} {u(r.objetivo)}{equipo ? ' entre todos' : equipos ? ' por equipo' : ''}</span>
        </div>
        <span class={`chip ${estado === 'en_marcha' ? 'morado' : ''}`}>{textoReto(r, hoy)}</span>
      </div>
      {r.descripcion && <p class="peq secundario post-texto">{r.descripcion}</p>}
      {equipos ? <><MarcadorEquipos r={r} u={u} />{fueraDelTotal && <p class="peq reto-yo">No sales en el ranking: sigues en tu equipo, pero lo tuyo no suma a su total.</p>}</> : equipo ? (
        <div class="reto-equipo pila-s">
          <div class="separa re-cifra">
            <span><strong class="num re-total">{r.total}</strong> <span class="secundario">de {r.objetivo} {u(r.objetivo)} entre todo el equipo</span></span>
            {r.total >= r.objetivo && <span class="chip ok"><Icono n="trofeo" /> ¡Conseguido!</span>}
          </div>
          <span class="barra-equipo barra-grande" role="progressbar" aria-valuemin="0" aria-valuemax={r.objetivo} aria-valuenow={Math.min(r.total, r.objetivo)} aria-label={`El equipo: ${r.total} de ${r.objetivo} ${u(r.objetivo)}`}>
            <span style={{ width: `${Math.max(pct ? 3 : 0, pct)}%` }} class={r.total >= r.objetivo ? 'lleno' : ''} />
          </span>
          {yo && !sinCardio && <p class="peq reto-yo">{fueraDelTotal ? `No sales en el ranking: lo tuyo no cuenta en el total del equipo.` : <>Tú has sumado <strong class="num">{yo.hechas}</strong></>}</p>}
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
          {yo && !sinCardio && <p class="peq reto-yo">{yo.hechas >= r.objetivo ? <><Icono n="trofeo" /> ¡Conseguido! {yo.hechas} de {r.objetivo}</> : <>Llevas <strong class="num">{yo.hechas}</strong> de {r.objetivo}</>}</p>}
          {r.progreso.filter((x) => !(x.yo && sinCardio)).length > 0 && (
            <ul class="lista progreso-equipo">
              {r.progreso.filter((x) => !(x.yo && sinCardio)).map((x) => <FilaProgreso key={x.perfil_id} perfilId={x.perfil_id} nombre={x.nombre} foto={x.foto} yo={x.yo} hechas={x.hechas} total={r.objetivo} texto={`${Math.min(x.hechas, r.objetivo)}/${r.objetivo}`} unidad={u(r.objetivo)} />)}
            </ul>
          )}
        </>
      )}
      {sinCardio && (
        <div class="reto-cardio-optin pila-xs">
          <p class="peq">Tus minutos de cardio no cuentan en los retos. Si los cuentas, el equipo verá cuántos minutos llevas en los retos de cardio (nada más de tus sesiones).</p>
          <button type="button" class="btn btn-peq btn-primario" style="justify-self:start" disabled={ocupado} onClick={contarCardio}>Contar mis minutos</button>
        </div>
      )}
      {!coach && r.conseguido && !r.compartido && alCompartirLogro && (
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => alCompartirLogro(r)}><Icono n="trofeo" /> Compartir el logro</button>
      )}
      <div class="separa">
        <span class="mini terciario">{equipos ? 'Cada equipo suma lo de los suyos (menos de quien no sale en el ranking).'
          : equipo ? (miembro || coach ? `Suman ${medida === 'cardio' ? 'los minutos de cardio' : medida === 'semanas' ? 'las semanas completas' : 'las sesiones terminadas'} de todos (menos de quien no sale en el ranking).` : '')
          : conseguido ? `${conseguido} ${conseguido === 1 ? 'lo ha conseguido' : 'lo han conseguido'}`
            : medida === 'cardio' ? 'Cuentan los minutos de cardio de las sesiones terminadas entre esas fechas.' : medida === 'semanas' ? 'Cuentan las semanas con todas tus sesiones hechas.' : 'Cuentan las sesiones terminadas entre esas fechas.'}</span>
        {coach && <button class="btn btn-peq" onClick={alEditar}><Icono n="editar" /> Cambiar</button>}
      </div>
    </article>
  );
}

// v0.70: el marcador de un reto por equipos: el total de cada uno con su barra, quién suma más de cada equipo y el tuyo
function MarcadorEquipos({ r, u }) {
  const eqs = r.equiposReto || [];
  if (eqs.length < 2) return <p class="peq terciario">Los equipos aún no están hechos.</p>;
  const hechas = Object.fromEntries(r.progreso.map((x) => [x.perfil_id, x]));
  const max = Math.max(r.objetivo, ...eqs.map((e) => e.total)) || 1;
  const terminado = estadoReto(r, hoyISO()) === 'terminado';
  const gana = eqs[0].total === eqs[1].total ? null : eqs[0].total > eqs[1].total ? eqs[0] : eqs[1];
  return (
    <div class="marcador-equipos pila-s">
      {eqs.map((e) => {
        const quien = e.personas.map((id) => hechas[id]).filter((x) => x && x.hechas > 0).sort((a, b) => b.hechas - a.hechas)[0];
        const pct = Math.min(100, Math.round((e.total / max) * 100));
        return (
          <div key={e.equipo} class={`me-equipo me-${e.equipo} ${e.mio ? 'mio' : ''} pila-xs`}>
            <div class="separa">
              <strong class="me-nombre">{e.nombre}{e.mio ? ' (el tuyo)' : ''}</strong>
              <span><strong class="num">{e.total}</strong> <span class="mini secundario">{u(e.total)}</span>{e.total >= r.objetivo && <span class="sr"> (objetivo conseguido)</span>}</span>
            </div>
            <span class="barra-equipo barra-grande" role="progressbar" aria-valuemin="0" aria-valuemax={r.objetivo} aria-valuenow={Math.min(e.total, r.objetivo)} aria-label={`${e.nombre}: ${e.total} de ${r.objetivo} ${u(r.objetivo)}`}>
              <span style={{ width: `${Math.max(pct ? 3 : 0, pct)}%` }} class={e.total >= r.objetivo ? 'lleno' : ''} />
            </span>
            <span class="mini terciario">{quien ? <>Quien más suma: <BotonPersona perfilId={quien.perfil_id} nombre={quien.nombre} foto={quien.foto} avatar={false}><span class="btn-persona-nombre">{quien.nombre}{quien.yo ? ' (tú)' : ''}</span></BotonPersona> ({quien.hechas})</> : 'Aún nadie ha sumado'}</span>
          </div>
        );
      })}
      {terminado && <p class="peq reto-yo"><Icono n="trofeo" /> {gana ? `Gana ${gana.nombre}` : 'Empate'}</p>}
    </div>
  );
}

function FilaProgreso({ perfilId, nombre, foto, yo, hechas, total, texto, unidad = '' }) {
  const pct = total ? Math.min(100, Math.round((hechas / total) * 100)) : 0;
  return (
    <li class={`fila-progreso ${yo ? 'yo' : ''}`}>
      <BotonPersona perfilId={perfilId} nombre={nombre} foto={foto}><span class="btn-persona-nombre nombre">{nombre}{yo ? ' (tú)' : ''}</span></BotonPersona>
      <span class="barra-equipo" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={Math.min(hechas, total)} aria-label={`${nombre}: ${hechas} de ${total}${unidad ? ` ${unidad}` : ''}`}><span style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }} class={hechas >= total ? 'lleno' : ''} /></span>
      <span class="num peq">{texto}</span>
    </li>
  );
}

// El formulario del reto (el coach). v0.70: plantillas de un toque, qué cuenta (sesiones, minutos de cardio o semanas
// completas) y «Por equipos» con sus dos nombres y el reparto (igualado por las sesiones recientes, cambiable). Sin la 042,
// solo sesiones (y lo nuevo dice que falta la migración).
function HojaReto({ reto, con042 = false, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const lunes = lunesDe(hoyISO());
  const [f, setF] = useState(() => reto ? { titulo: reto.titulo, descripcion: reto.descripcion || '', desde: reto.desde, hasta: reto.hasta, objetivo: reto.objetivo, modo: reto.modo || 'individual', medida: reto.medida || 'sesiones', equipos: reto.equipos || [...EQUIPOS_DE_ENTRADA] }
    : { titulo: '', descripcion: '', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 10, modo: 'individual', medida: 'sesiones', equipos: [...EQUIPOS_DE_ENTRADA] });
  const [reparto, setReparto] = useState(null); // { a: [perfil_id], b: [perfil_id] }
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const equipos = f.modo === 'equipos';
  const recientes = useCarga(() => (con042 && equipos ? api.recientesComunidad().catch(() => []) : Promise.resolve(null)), [con042, equipos]);
  // El reparto: el guardado (al cambiar un reto por equipos) o, si no, uno igualado
  useEffect(() => {
    if (!equipos || reparto || !recientes.datos) return;
    if (reto?.id && reto.modo === 'equipos') api.equiposDeReto(reto.id).then((x) => setReparto(x.a.length || x.b.length ? x : repartirEquipos(recientes.datos))).catch(() => setReparto(repartirEquipos(recientes.datos)));
    else setReparto(repartirEquipos(recientes.datos));
  }, [equipos, recientes.datos]);
  const c = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const max = con042 ? retoMaximo(f.modo, f.medida) : RETO_MAX[f.modo] || 100;
  const cosa = { sesiones: 'Sesiones terminadas', cardio: 'Minutos de cardio', semanas: 'Semanas completas' }[f.medida] || 'Sesiones terminadas';
  const cambiarModo = (k) => setF({ ...f, modo: k, objetivo: k !== 'individual' && Number(f.objetivo) <= retoMaximo('individual', f.medida) && !reto ? (f.medida === 'cardio' ? 1000 : f.medida === 'semanas' ? 20 : 60) : f.objetivo });
  const usarPlantilla = (clave) => {
    const p = plantillaReto(clave, hoyISO());
    if (p) setF({ ...f, ...p, equipos: f.equipos });
  };
  const mover = (id, a) => setReparto((r) => ({ a: a === 'a' ? [...r.a.filter((x) => x !== id), id] : r.a.filter((x) => x !== id), b: a === 'b' ? [...r.b.filter((x) => x !== id), id] : r.b.filter((x) => x !== id) }));
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.guardarReto({ ...f, objetivo: Number(f.objetivo), reparto }, reto?.id || null); aviso(reto ? 'Reto guardado' : 'Reto creado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const plantillas = PLANTILLAS_RETO.filter(([k]) => con042 || !plantillaCon042(plantillaReto(k, hoyISO())));
  return (
    <Hoja titulo={reto ? 'Cambiar el reto' : 'Nuevo reto'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        {!reto && (
          <div class="campo">
            <span class="etiqueta" id="reto-plantillas-t">Plantillas de un toque</span>
            <div class="plantillas-reto" role="group" aria-labelledby="reto-plantillas-t">
              {plantillas.map(([k, t]) => <button key={k} type="button" class="chip-filtro" onClick={() => usarPlantilla(k)}>{t}</button>)}
            </div>
            <span class="ayuda">Rellenan el formulario: puedes cambiar las fechas y todo lo demás antes de crearlo.</span>
          </div>
        )}
        <div class="campo"><label for="reto-titulo">Título</label><input id="reto-titulo" class="entrada" maxLength={80} required value={f.titulo} onInput={c('titulo')} placeholder={f.modo === 'equipo' ? 'Entre todos: 100 sesiones' : 'Noviembre constante'} /></div>
        <div class="campo">
          <span class="etiqueta" id="reto-medida-t">Qué cuenta</span>
          <div class="segmentos" role="group" aria-labelledby="reto-medida-t">
            {MEDIDAS_RETO.map(([k, t]) => <button key={k} type="button" aria-pressed={f.medida === k ? 'true' : 'false'} disabled={!con042 && k !== 'sesiones'} onClick={() => setF({ ...f, medida: k, objetivo: Math.min(Number(f.objetivo) || 1, retoMaximo(f.modo, k)) })}>{t}</button>)}
          </div>
          {!con042 && <span class="ayuda">Minutos de cardio y semanas completas: {AVISO_042}.</span>}
        </div>
        <div class="campo">
          <span class="etiqueta" id="reto-modo-t">Cómo se consigue</span>
          <div class="segmentos" role="group" aria-labelledby="reto-modo-t">
            {MODOS_RETO.map(([k, t]) => <button key={k} type="button" aria-pressed={f.modo === k ? 'true' : 'false'} disabled={!con042 && k === 'equipos'} onClick={() => cambiarModo(k)}>{t}</button>)}
          </div>
          {!con042 && <span class="ayuda">Por equipos: {AVISO_042}.</span>}
        </div>
        <div class="campo"><label for="reto-desc">Descripción (opcional)</label><textarea id="reto-desc" class="area" maxLength={500} value={f.descripcion} onInput={c('descripcion')} /></div>
        <div class="fila-envolver">
          <div class="campo"><label for="reto-desde">Desde</label><input id="reto-desde" type="date" class="entrada" required value={f.desde} onInput={c('desde')} /></div>
          <div class="campo"><label for="reto-hasta">Hasta</label><input id="reto-hasta" type="date" class="entrada" required value={f.hasta} onInput={c('hasta')} /></div>
        </div>
        <div class="campo"><label for="reto-obj">{`${cosa} ${f.modo === 'equipo' ? 'entre todo el equipo' : equipos ? 'que tiene que sumar cada equipo' : 'para conseguirlo'}`}</label>
          <input id="reto-obj" type="number" inputMode="numeric" min="1" max={max} class="entrada entrada-num" required value={f.objetivo} onInput={c('objetivo')} /></div>
        {equipos && con042 && (
          <div class="pila-s reparto-equipos">
            <div class="fila-envolver">
              {[0, 1].map((i) => (
                <div class="campo" key={i}><label for={`reto-equipo-${i}`}>Nombre del equipo {i + 1}</label>
                  <input id={`reto-equipo-${i}`} class="entrada" maxLength={30} required value={f.equipos[i]} onInput={(e) => { const n = [...f.equipos]; n[i] = e.currentTarget.value; setF({ ...f, equipos: n }); }} /></div>
              ))}
            </div>
            <div class="separa">
              <span class="etiqueta">Quién va en cada uno</span>
              <button type="button" class="btn btn-peq" disabled={!recientes.datos} onClick={() => setReparto(repartirEquipos(recientes.datos || []))}>Repartir igualados</button>
            </div>
            {!recientes.datos || !reparto ? <Cargando texto="Cargando el equipo" /> : (
              <ul class="lista reparto-lista">
                {recientes.datos.map((p) => {
                  const en = reparto.a.includes(p.perfil_id) ? 'a' : reparto.b.includes(p.perfil_id) ? 'b' : null;
                  return (
                    <li key={p.perfil_id} class="reparto-fila">
                      <span class="pila-xs"><span>{p.nombre}</span><span class="mini terciario">{p.sesiones} {p.sesiones === 1 ? 'sesión' : 'sesiones'} en 4 semanas</span></span>
                      <span class="segmentos segmentos-peq" role="group" aria-label={`Equipo de ${p.nombre}`}>
                        {[['a', f.equipos[0] || 'Equipo 1'], ['b', f.equipos[1] || 'Equipo 2']].map(([k, t]) => <button key={k} type="button" aria-pressed={en === k ? 'true' : 'false'} onClick={() => mover(p.perfil_id, k)}>{t}</button>)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <p class="mini terciario">{equipos
          ? 'Dos barras, una por equipo: cada uno suma lo de los suyos. Quien ha elegido no salir en el ranking puede estar en un equipo, pero lo suyo no suma (ni sale por su nombre).'
          : f.modo === 'equipo'
            ? 'Una barra para todo el equipo: suma lo de todos (menos de quien ha elegido no salir en el ranking). Salen por su nombre los que más suman.'
            : `Lo puede conseguir todo el equipo. Cada uno ve cuánto lleva cada miembro (solo el número), menos quien ha elegido no salir en el ranking.`}
          {f.medida === 'cardio' ? ' Solo cuentan los minutos de cardio de quien los cuenta en los retos (cada atleta lo enciende).' : ''}</p>
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
  // v0.70 (042): las insignias conseguidas, junto al nombre (sin la 042, ninguna)
  const insignias = useCarga(() => api.insigniasComunidad().catch(() => ({})), []);
  const [nuevos, setNuevos] = useState([]);
  const [ocupado, una] = useUnaVez();
  const filas = (ranking.datos || []).map((x) => ({ ...x, insignias: insignias.datos?.[x.perfil_id] || [] }));
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
      <HitosEquipo />
    </div>
  );
}
// 🔥 N y «Semana completa»
function Distintivos({ x }) {
  return (
    <>
      {x.racha > 0 && <span class="chip racha"><span aria-hidden="true">🔥</span> {x.racha}<span class="sr"> {x.racha === 1 ? 'semana seguida' : 'semanas seguidas'} con todo hecho</span></span>}
      {x.previstas > 0 && x.hechas >= x.previstas && <span class="chip ok chip-completa"><Icono n="hecho" />Semana completa</span>}
      <InsigniasMini lista={x.insignias} />
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
  const { perfil } = useApp();
  const p = useCarga(() => api.perfilComunidad(perfilId), [perfilId]);
  // v0.70 (042): sus compañeros de racha, sus insignias y si le puedo invitar (sin la 042, nada)
  const [vuelta, setVuelta] = useState(0);
  const parejas = useCarga(() => api.companerosComunidad(perfilId).catch(() => null), [perfilId, vuelta]);
  const mias = useCarga(() => (perfil?.rol === 'coach' ? Promise.resolve(null) : api.companerosComunidad().catch(() => null)), [vuelta]);
  const insignias = useCarga(() => api.insigniasComunidad(perfilId).catch(() => ({})), [perfilId]);
  const [animadoAhora, setAnimadoAhora] = useState(false);
  const [hojaCoach, setHojaCoach] = useState(null); // v0.72: 'destacar' | 'silenciar'
  const [ocupado, una] = useUnaVez();
  const x = p.datos;
  const animar = () => una(async () => {
    try { await api.animar(perfilId); setAnimadoAhora(true); aviso(`Le has mandado ánimo a ${x.nombre} 🙌`); } catch (e) { aviso(e.message, 'error'); }
  });
  const invitar = () => una(async () => {
    try { await api.invitarCompanero(perfilId); aviso(`Invitación enviada a ${x.nombre}`); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  const conPareja = (parejas.datos || []).filter((c) => c.estado === 'aceptada');
  const yaConmigo = (mias.datos || []).some((c) => c.perfil_id === perfilId);
  const libres = mias.datos ? MAX_COMPANEROS - mias.datos.filter((c) => c.estado === 'aceptada' || c.invito).length : 0;
  const resumen = (q) => q.texto || (q.tipo === 'entreno' ? q.resumen?.nombre : q.tipo === 'logro' ? q.resumen?.titulo : resumenAniversario(q) || '') || (q.foto_ruta ? 'Una foto' : '');
  return (
    <Hoja titulo="Perfil en el equipo" alCerrar={alCerrar}>
      <ErrorCaja error={p.error} reintentar={() => p.recargar()} />
      {p.cargando && !x ? <Cargando texto="Cargando el perfil" /> : !x ? (!p.error && <p class="secundario">Esta persona ya no está en el equipo.</p>) : (
        <div class="pila perfil-equipo">
          <div class="perfil-equipo-cab">
            <Avatar nombre={x.nombre} foto={x.foto} clase="grande" ampliable perfilId={perfilId} />
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
          <InsigniasPerfil lista={insignias.datos?.[perfilId] || []} yo={x.yo} />
          {conPareja.length > 0 && (
            <div class="pila-s">
              <h3 class="pe-sub">Compañeros de racha</h3>
              <ul class="lista pe-parejas">
                {conPareja.map((c) => (
                  <li key={c.id} class="peq">{x.yo ? 'Tú y ' : 'Con '}<strong>{c.nombre}</strong>{c.racha > 0 ? <> · <span aria-hidden="true">🔥</span> {c.racha} {c.racha === 1 ? 'semana' : 'semanas'}</> : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {!x.yo && !x.coach && <BotonAnimar grande nombre={x.nombre} animado={x.animado || animadoAhora} ocupado={ocupado} alAnimar={animar} />}
          {/* v0.72 (044): el coach, el atleta de la semana y silenciar */}
          {perfil?.rol === 'coach' && !x.coach && !x.yo && (
            <div class="pila-s pe-coach">
              {x.silenciado_hasta && Date.parse(x.silenciado_hasta) > Date.now() && <p class="nota peq">Silenciado hasta el {fmtProgramado(x.silenciado_hasta)}.</p>}
              <div class="fila-envolver">
                <button type="button" class="btn" disabled={x.sin_ranking} onClick={() => setHojaCoach('destacar')} title={x.sin_ranking ? 'No sale en el ranking' : undefined}>🏅 Atleta de la semana</button>
                <button type="button" class="btn" onClick={() => setHojaCoach('silenciar')}><Icono n="silencio" /> Silenciar…</button>
              </div>
              {x.sin_ranking && <p class="mini terciario">Ha elegido no salir en el ranking: no se puede elegir atleta de la semana.</p>}
            </div>
          )}
          {hojaCoach === 'destacar' && <HojaDestacar perfilId={perfilId} alCerrar={() => setHojaCoach(null)} alGuardar={() => setHojaCoach(null)} />}
          {hojaCoach === 'silenciar' && <HojaSilenciar perfilId={perfilId} nombre={x.nombre} hasta={silenciadoHasta(x)} alCerrar={() => setHojaCoach(null)} alCambiar={() => p.recargar(true)} />}
          {!x.yo && !x.coach && mias.datos && !yaConmigo && libres > 0 && (
            <button type="button" class="btn" disabled={ocupado} onClick={invitar}><span aria-hidden="true">🤝</span> Invitar a ser compañeros de racha</button>
          )}
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
          {equipo ? `Entre todo el equipo lleváis ${reto.total} ${unidadReto(reto.medida, reto.total)} (el objetivo era ${reto.objetivo}).`
            : reto.modo === 'equipos' ? `Tu equipo ha llegado a ${reto.objetivo} ${unidadReto(reto.medida, reto.objetivo)}.`
              : `Llevas ${yo?.hechas ?? reto.objetivo} de ${reto.objetivo} ${unidadReto(reto.medida, reto.objetivo)}.`}
          {celebracion ? ' ¡Enhorabuena!' : ''}
        </p>
        <div class="campo"><label for="eq-logro-texto">Unas palabras (opcional)</label>
          <textarea id="eq-logro-texto" class="area" rows={2} maxLength={MAX_POST} placeholder="¿Cómo lo has vivido?" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        <p class="mini terciario">En el muro sale el reto, lo conseguido y las fechas, con tu comentario. Nada más.</p>
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
  const [auto, setAuto] = useState(() => leerAutoCompartir(api.uid()));
  // (la columna llega con la 041: sin ella, «Entrenando ahora» dice que falta)
  const con041 = 'ver_entrenando' in miembro;
  // (y v0.70: «Contar mis minutos de cardio en los retos», con la 042)
  const con042 = 'cardio_en_retos' in miembro;
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
          <Interruptor id="eq-sin-ranking" texto="No salir en el ranking" ayuda="Ni en el ranking ni en su podio, ni en los retos de los demás (lo tuyo no suma en los de «Entre todos» ni en los de «Por equipos»), ni tu racha, tus retos, tus insignias ni tus compañeros de racha en tu perfil. Tú sigues viendo lo tuyo." valor={!!miembro.sin_ranking} desactivado={ocupado}
            alCambiar={(v) => hacer(() => api.ajustesComunidad({ sinRanking: v }), v ? 'Ya no sales en el ranking' : 'Vuelves a salir en el ranking')} />
          {/* v0.69 (041): «Entrenando ahora», voluntario y apagado de entrada; sin la 041 en la base, lo dice */}
          <Interruptor id="eq-entrenando" texto="Que el equipo vea cuándo estoy entrenando"
            ayuda={con041 ? 'Sales en «Entrenando ahora» mientras apuntas una sesión (hasta 20 minutos después de tu última serie) y te pueden mandar ánimo. Solo tu nombre y tu foto: ni la hora ni lo que haces.' : AVISO_041}
            valor={!!miembro.ver_entrenando} desactivado={ocupado || !con041}
            alCambiar={(v) => hacer(() => api.verEntrenandoComunidad(v), v ? 'El equipo verá cuándo estás entrenando' : 'Ya no se ve cuándo estás entrenando')} />
          <Interruptor id="eq-autocompartir" texto="Compartir mis entrenos sin preguntar"
            ayuda="Al terminar una sesión, se comparte sola con el equipo, sin los kilos (con «Deshacer» por si acaso). Se guarda en este móvil."
            valor={auto} alCambiar={(v) => { guardarAutoCompartir(api.uid(), v); setAuto(v); aviso(v ? 'Tus entrenos se compartirán solos al terminarlos' : 'Te volveremos a preguntar al terminar'); }} />
          <Interruptor id="eq-cardio-retos" texto="Contar mis minutos de cardio en los retos"
            ayuda={con042 ? 'En los retos de cardio, el equipo ve cuántos minutos de cardio llevas entre sus fechas (solo el número). Apagado, no cuentan.' : AVISO_042}
            valor={!!miembro.cardio_en_retos} desactivado={ocupado || !con042}
            alCambiar={(v) => hacer(() => api.cardioEnRetos(v), v ? 'Tus minutos de cardio cuentan en los retos' : 'Tus minutos de cardio ya no cuentan en los retos')} />
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
