// El recetario del equipo (migración 055): las recetas que el coach deja a la vista de todos sus atletas, por
// capítulos, con buscador, filtros de un toque y las que cada uno se guarda. Quien solo entrena las consulta; quien
// lleva la nutrición puede además apuntarlas en su menú (alAnadir) y, si su plan tiene kcal, las ve ajustadas a él
// (ajuste: receta → { factor, toma, kcalToma } | null). El coach lo ve igual, sin guardar ni apuntar.
import { Imagen } from './Imagen.jsx';
import { useEffect, useState, useMemo, useRef } from 'preact/hooks';
import { tomarBusqueda, EVENTO_BUSCA } from './busqueda-pedida.js';
import { IndiceLateral } from './IndiceLateral.jsx';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Paso, Siluetas, ErrorCaja, usePreferencia, usePorTramos } from './comunes.jsx';
import { FotoReceta } from './ComidasComun.jsx';
import { Ingredientes, PasoConTiempos, PastillaCocina, ModoCocina, FotoGuardable, estrellaSalta } from './Cocina.jsx';
import { vibrar } from './hapticos.js';
import { conTransicion } from './transiciones.js';
import { COLOR_MACRO } from './NutricionComun.jsx';
import { textoMacros, macrosDe, ordenarTomas, NOMBRE_TOMA } from '../logica/comidas.js';
import { porCapitulos, capitulos, filtrarRecetas, FILTROS, textoTiempo, textoBatch, lineasIngredientes, pasosDe, resumenRecetario, capituloDe, bloqueDe } from '../logica/recetario-equipo.js';
import { recetarioEquipo, fotosRecetarioEquipo, guardarFavoritaEquipo } from '../datos/recetario-equipo.js';
import { num } from '../logica/calculos.js';

// Los datos del recetario, recordados entre visitas (y compartidos por Comidas y la pestaña Recetas)
export function useRecetarioEquipo(atletaId = null) {
  const { backend, api } = useApp();
  return useCarga(() => recetarioEquipo({ backend }, atletaId), [atletaId], { recuerdo: `recetario-equipo:${api.uid()}:${atletaId || 'coach'}` });
}

function TarjetaEquipo({ r, favorita, alAbrir, ajuste = null }) {
  const tiempo = textoTiempo(r);
  const aj = ajuste ? ajuste(r) : null;
  // (belleza 186 y B99) la proteína, en su pastilla (y fuera de la línea de macros, para no decirla dos veces)
  const m = macrosDe(r, aj?.factor || 1);
  const conProt = m?.proteina_g != null;
  return (
    <button type="button" class="tarjeta-receta tarjeta-equipo" data-receta={r.id} onClick={(ev) => alAbrir(r, ev.currentTarget)}
      // (tacto 223) al mantenerla pulsada se asoma: su foto en grande, lo que es y sus macros
      data-asoma="suyo" ref={(el) => { if (el) el.__asoma = () => ({ titulo: r.nombre, foto: el.querySelector('img')?.currentSrc || null, sub: [tiempo, r.libro?.dificultad].filter(Boolean).join(' · '),
        lineas: [m && ['Por ración', textoMacros(m, true)], r.libro?.descripcion && [String(r.libro.descripcion).slice(0, 140), '']].filter(Boolean), mas: 0, pie: '' }); }}>
      <FotoReceta receta={r} toma={ordenarTomas(r.tomas || [])[0] || null} />
      <span class="pila-xs tarjeta-receta-texto">
        <span class="nombre">{favorita && <Icono n="estrella" class="favorita" titulo="Guardada" />}{r.nombre}</span>
        <span class="mini secundario num">{textoMacros(conProt ? { ...m, proteina_g: null } : m, true) || (conProt ? '' : 'Sin macros')}{aj && aj.factor !== 1 && <span class="terciario"> · para ti</span>}</span>
        <span class="fila-chips">
          {conProt && <span class="chip amb-prot num"><b>{num(m.proteina_g, 0)} g</b>prot.</span>}
          {tiempo && <span class="chip"><Icono n="reloj" />{tiempo}</span>}
          {r.libro?.dificultad && <span class="chip">{r.libro.dificultad}</span>}
        </span>
      </span>
    </button>
  );
}

function Bloque({ capitulo, bloque, recetas, favoritas, alAbrir, reinicio, ajuste }) {
  const tramos = usePorTramos(recetas.length, { tramo: 12, reinicio, clave: `recetario-equipo-${capitulo}-${bloque}`, nombre: 'recetas más' });
  return (
    <div class="pila-s">
      {bloque && <h3 class="bloque-equipo">{bloque}</h3>}
      <div class="rejilla-recetas">{recetas.slice(0, tramos.hasta).map((r) => <TarjetaEquipo key={r.id} r={r} favorita={favoritas.has(r.id)} alAbrir={alAbrir} ajuste={ajuste} />)}</div>
      {tramos.mas}
    </div>
  );
}

export function RecetarioEquipo({ atletaId = null, alAnadir = null, esCoach = false, ajuste = null }) {
  const { backend, api, atleta: yo } = useApp();
  const datos = useRecetarioEquipo(atletaId);
  // Las miniaturas, aparte y solo aquí (al abrir el recetario); mientras llegan, cada receta sale con su dibujo
  const fotos = useCarga(() => fotosRecetarioEquipo({ backend }), [], { recuerdo: `fotos-recetario-equipo:${api.uid()}` });
  // (tacto 243) si llega del buscador de «Más», con ese texto ya puesto
  const [texto, setTexto] = useState(() => tomarBusqueda('recetas'));
  useEffect(() => { const al = (e) => { if (e.detail === 'recetas') setTexto(tomarBusqueda('recetas')); }; window.addEventListener(EVENTO_BUSCA, al); return () => window.removeEventListener(EVENTO_BUSCA, al); }, []);
  const [filtro, setFiltro] = usePreferencia('fbe-recetario-equipo-filtro', 'todas');
  const [capitulo, setCapitulo] = useState(null);
  const [abierta, setAbierta] = useState(null);
  // (tacto 212) la foto de la tarjeta crece hasta ser la cabecera de la receta, y vuelve a su sitio al cerrar
  const abrir = (r, tarjeta) => conTransicion(() => setAbierta(r), 'morph', [{ nombre: 'vt-viaje', desde: tarjeta?.querySelector('.receta-foto'), hasta: '.receta-equipo .receta-foto.grande' }]);
  const cerrar = () => { const id = abierta?.id; conTransicion(() => setAbierta(null), 'morph', [{ nombre: 'vt-viaje', desde: document.querySelector('.receta-equipo .receta-foto.grande'), hasta: `[data-receta="${id}"] .receta-foto` }]); };
  const F = fotos.datos || null;
  const recetas = useMemo(() => { const xs = datos.datos?.recetas || []; return F ? xs.map((r) => (F[r.id] ? { ...r, foto_mini: F[r.id] } : r)) : xs; }, [datos.datos, F]);
  const favoritas = useMemo(() => new Set(datos.datos?.favoritas || []), [datos.datos]);
  const caps = useMemo(() => capitulos(recetas), [recetas]);
  const filtros = esCoach ? FILTROS.filter(([f]) => f !== 'favoritas') : FILTROS;
  const elFiltro = filtros.some(([f]) => f === filtro) ? filtro : 'todas';
  const vistas = useMemo(() => filtrarRecetas(recetas, { filtro: elFiltro, capitulo, texto, favoritas }), [recetas, elFiltro, capitulo, texto, favoritas]);
  const grupos = useMemo(() => porCapitulos(vistas), [vistas]);
  const reinicio = `${elFiltro}|${capitulo || ''}|${texto}`;
  if (!datos.datos) return datos.error ? <ErrorCaja error={datos.error} reintentar={() => datos.recargar(true)} /> : <Siluetas forma="tarjetas" n={4} texto="Cargando el recetario" />;
  if (!recetas.length) {
    return <div class="panel"><Vacio ilustracion="recetas" imagen="vacio-recetas" titulo="El recetario está vacío">{esCoach ? 'Marca una receta como «Para todo el equipo» y la verán aquí todos tus atletas.' : yo?.modalidad === 'por_su_cuenta' ? 'Cuando haya recetas para todo el equipo, las verás aquí.' : 'Cuando tu coach añada recetas para todo el equipo, las verás aquí.'}</Vacio></div>;
  }
  const marcar = (r, si) => datos.alMomento(
    (d) => ({ ...d, favoritas: si ? [...new Set([...d.favoritas, r.id])] : d.favoritas.filter((id) => id !== r.id) }),
    () => guardarFavoritaEquipo({ backend }, atletaId, r.id, si),
  );
  return (
    <div class="pila recetario-equipo">
      <ErrorCaja error={datos.error} reintentar={() => datos.recargar(true)} />
      <div class="pila-s">
        <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" maxLength={60} value={texto} onInput={(e) => setTexto(e.currentTarget.value)}
          placeholder="Buscar por nombre o ingrediente" aria-label="Buscar en el recetario" /></div>
        <div class="selector-chips" role="group" aria-label="Filtrar las recetas">
          {filtros.map(([f, t]) => <button type="button" key={f} aria-pressed={elFiltro === f ? 'true' : 'false'} onClick={() => setFiltro(f)}>{f === 'favoritas' ? `${t}${favoritas.size ? ` (${favoritas.size})` : ''}` : t}</button>)}
        </div>
        {caps.length > 1 && (
          <div class="selector-chips capitulos-equipo" role="group" aria-label="Capítulo">
            <button type="button" aria-pressed={!capitulo ? 'true' : 'false'} onClick={() => setCapitulo(null)}>Todo</button>
            {caps.map((c) => <button type="button" key={c.capitulo} aria-pressed={capitulo === c.capitulo ? 'true' : 'false'} onClick={() => setCapitulo(capitulo === c.capitulo ? null : c.capitulo)}>{c.capitulo} <span class="num terciario">{c.n}</span></button>)}
          </div>
        )}
        <p class="mini terciario" role="status">{vistas.length === recetas.length ? resumenRecetario(recetas) : vistas.length === 1 ? '1 receta' : `${vistas.length} recetas`}</p>
      </div>
      {!vistas.length ? (
        <div class="panel"><Vacio icono={elFiltro === 'favoritas' && !texto ? 'estrella' : 'buscar'} imagen={elFiltro === 'favoritas' && !texto ? 'vacio-favoritas' : 'vacio-buscar'} titulo={elFiltro === 'favoritas' && !texto && !capitulo ? 'Aún no has guardado ninguna' : 'Nada con eso'}>
          {elFiltro === 'favoritas' && !texto && !capitulo ? 'Abre una receta y toca «Guardar» para tenerla aquí a mano.' : 'Prueba con otra palabra o quita algún filtro.'}
        </Vacio></div>
      ) : grupos.map((c) => (
        <section class="seccion" key={c.capitulo} aria-labelledby={`cap-${c.capitulo}`}>
          <div class="seccion-cab"><h2 id={`cap-${c.capitulo}`}>{c.capitulo}</h2><span class="mini terciario">{c.n === 1 ? '1 receta' : `${c.n} recetas`}</span></div>
          <div class="pila">
            {c.bloques.map((b) => <Bloque key={b.bloque} capitulo={c.capitulo} bloque={b.bloque} recetas={b.recetas} favoritas={favoritas} alAbrir={abrir} reinicio={reinicio} ajuste={ajuste} />)}
          </div>
        </section>
      ))}
      {/* (tacto 242) con la lista entera a la vista, el índice lateral de sus capítulos */}
      {!esCoach && !abierta && grupos.length >= 3 && <IndiceLateral items={grupos.map((c) => ({ id: `cap-${c.capitulo}`, texto: c.capitulo }))} />}
      {abierta && <HojaRecetaEquipo r={abierta} favorita={favoritas.has(abierta.id)} esCoach={esCoach} alCerrar={cerrar} ajuste={ajuste ? ajuste(abierta) : null}
        alMarcar={atletaId && !esCoach ? (si) => marcar(abierta, si) : null}
        alAnadir={alAnadir ? (raciones, factor) => { const r = abierta; setAbierta(null); alAnadir(r, raciones, factor); } : null} />}
    </div>
  );
}

// Una receta del recetario, entera: la entrada, sus etiquetas, los macros por ración, los ingredientes para las
// raciones que se cocinen (con sus medidas caseras), los pasos numerados y las notas.
// ajuste ({ factor, toma, kcalToma } o, desde el menú, { factor, desdeMenu }): la ración a la medida del atleta, que
// puede ver también la original. alAnadir(raciones, factor).
export function HojaRecetaEquipo({ r: breve, favorita = false, esCoach = false, alCerrar, alMarcar = null, alAnadir = null, ajuste = null }) {
  const { api, aviso, atleta: yo } = useApp();
  // La foto grande (si la tiene) llega aparte; lo demás ya está
  const completa = useCarga(() => (breve.foto_mini ? api.receta(breve.id).catch(() => null) : Promise.resolve(null)), [breve.id]);
  const r = completa.datos ? { ...breve, foto: completa.datos.foto } : breve;
  const l = r.libro || {};
  const base = Number(r.raciones || 1);
  const [raciones, setRaciones] = useState(base);
  const [ocupado, una] = useUnaVez();
  const hayAjuste = !!ajuste && ajuste.factor !== 1;
  const [ajustada, setAjustada] = useState(true);
  const f = hayAjuste && ajustada ? ajuste.factor : 1;
  const m = macrosDe(r, f, 1);
  const tiempo = textoTiempo(r);
  const lineas = lineasIngredientes(r, raciones, f);
  const pasos = pasosDe(r);
  // (tacto 240) al guardarla, la estrella salta con tres chispas y su toque
  const estrella = useRef(null);
  const marcar = () => una(async () => {
    if (!favorita) { estrellaSalta(estrella.current); vibrar('hecho'); }
    try { await alMarcar(!favorita); aviso(favorita ? 'Ya no está guardada' : 'Guardada en tus favoritas'); } catch (e) { aviso(e.message, 'error'); }
  });
  // (tacto 238) el modo cocina: un paso por pantalla
  const [cocina, setCocina] = useState(false);
  return (
    <Hoja titulo={r.nombre} alCerrar={alCerrar} ancho>
      <div class="pila receta-detalle receta-equipo">
        {/* (tacto 240) dos toques en la foto también la guardan */}
        {(r.foto || r.foto_mini) && <FotoGuardable puede={!esCoach && !!alMarcar && !favorita && !ocupado} alGuardar={marcar}><FotoReceta receta={r} grande /></FotoGuardable>}
        <p class="mini terciario receta-equipo-donde">{[capituloDe(r), bloqueDe(r)].filter(Boolean).join(' · ')}</p>
        {l.descripcion && <p class="receta-equipo-entrada">{l.descripcion}</p>}
        <div class="fila-chips">
          {tiempo && <span class="chip"><Icono n="reloj" />{tiempo}</span>}
          {l.dificultad && <span class="chip">{l.dificultad}</span>}
          {textoBatch(r) && <span class="chip">{textoBatch(r)}</span>}
          {l.objetivo && l.objetivo !== 'Todos' && <span class="chip morado">{l.objetivo}</span>}
          {l.rendimiento && <span class="chip">Sale: {l.rendimiento}</span>}
        </div>
        <div class="panel panel-pad pila-s">
          <div class="cifras-receta num" aria-label={`Por ración: ${textoMacros(m)}`}>
            <span><b>{m.kcal == null ? '—' : num(m.kcal, 0)}</b><span class="mini terciario">kcal</span></span>
            <span style={{ '--c': COLOR_MACRO.proteina }}><b>{m.proteina_g == null ? '—' : num(m.proteina_g, 1)}</b><span class="mini terciario">g prot.</span></span>
            <span style={{ '--c': COLOR_MACRO.carbos }}><b>{m.carbos_g == null ? '—' : num(m.carbos_g, 1)}</b><span class="mini terciario">g hidr.</span></span>
            <span style={{ '--c': COLOR_MACRO.grasa }}><b>{m.grasa_g == null ? '—' : num(m.grasa_g, 1)}</b><span class="mini terciario">g grasa</span></span>
          </div>
          <p class="mini terciario">{l.porcion || (base > 1 ? `Por ración: la receta da para ${base} raciones.` : 'Por ración.')}</p>
          {hayAjuste && ajustada && (
            <p class="mini secundario ajuste-receta"><Icono n="nutricion" /> {ajuste.desdeMenu ? `Ajustada a tu plan, como la apuntaste: ×${num(ajuste.factor, 2)} de la receta.`
              : `Ajustada a tu plan: tu ${NOMBRE_TOMA[ajuste.toma].toLowerCase()} ronda las ${num(ajuste.kcalToma, 0)} kcal, así que la ración va ×${num(ajuste.factor, 2)}.`}</p>
          )}
          {hayAjuste && <button type="button" class="btn btn-peq plano" aria-pressed={ajustada ? 'false' : 'true'} onClick={() => setAjustada(!ajustada)}>{ajustada ? 'Ver la receta original' : 'Ajustarla a tu plan'}</button>}
        </div>
        {lineas.length > 0 && (
          <section class="pila-s">
            <h3 class="etq">Ingredientes{f !== 1 ? ', a tu medida' : ''}</h3>
            <div class="separa">
              <span class="peq">{raciones === 1 ? 'Para una ración' : `Para ${num(raciones, 0)} raciones`}</span>
              <div style="max-width:150px"><Paso valor={raciones} paso={1} min={1} max={20} dec={0} etiqueta="raciones que cocinas" alCambiar={(v) => v && setRaciones(v)} /></div>
            </div>
            {/* (tacto 237 y 241) se tachan al tocarlos (lo que ya tienes) y sus cantidades ruedan al cambiar las raciones */}
            <Ingredientes receta={r.id} lineas={lineas} />
            <p class="mini terciario coc-pista">Toca lo que ya tienes en casa para tacharlo.</p>
          </section>
        )}
        {pasos.length > 0 && (
          <section class="pila-s">
            <h3 class="etq">Preparación</h3>
            {/* (tacto 239) los tiempos se tocan: «10 minutos» arranca su temporizador */}
            <ol class="pasos-receta">{pasos.map((p, k) => <li key={k}><span class="coc-paso-t"><PasoConTiempos texto={p} receta={r.id} nombre={r.nombre} /></span></li>)}</ol>
            <button type="button" class="btn coc-cocinar" onClick={() => setCocina(true)}><Icono n="ampliar" /> Modo cocina</button>
          </section>
        )}
        {l.encaje && <section class="pila-s"><h3 class="etq etq-con-ilu"><Imagen id="receta-encaja" clase="ico-ilu" tamanos="44px" />Cómo encaja en tu día</h3><p class="peq">{l.encaje}</p></section>}
        {l.nota && <div class="nota-coach"><Icono n="mensaje" /><div><strong>{esCoach ? 'Tu nota: ' : yo?.modalidad === 'por_su_cuenta' ? 'Nota: ' : 'Nota de tu coach: '}</strong>{l.nota}</div></div>}
        {!esCoach && (alAnadir || alMarcar) && (
          <div class="pila-s">
            {alAnadir && <button class="btn btn-primario btn-grande" onClick={() => alAnadir(1, f)}><Icono n="calendario" /> Añadir a tu menú{f !== 1 ? ' (a tu medida)' : ''}</button>}
            {alMarcar && (
              <button ref={estrella} class="btn coc-guardar" aria-pressed={favorita ? 'true' : 'false'} disabled={ocupado} onClick={marcar}>
                <Icono n="estrella" class={favorita ? 'favorita' : ''} /> {favorita ? 'Guardada' : 'Guardar'}
              </button>
            )}
          </div>
        )}
        <PastillaCocina />
      </div>
      {cocina && <ModoCocina receta={r.id} nombre={r.nombre} pasos={pasos} lineas={lineas} alCerrar={() => setCocina(false)} />}
    </Hoja>
  );
}
