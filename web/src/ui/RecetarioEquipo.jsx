// El recetario del equipo (migración 055): las recetas que el coach deja a la vista de todos sus atletas, por
// capítulos, con buscador, filtros de un toque y las que cada uno se guarda. Quien solo entrena las consulta; quien
// lleva la nutrición puede además apuntarlas en su menú (alAnadir). El coach lo ve igual, sin guardar ni apuntar.
import { useState, useMemo } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Paso, Siluetas, ErrorCaja, usePreferencia, usePorTramos } from './comunes.jsx';
import { FotoReceta } from './ComidasComun.jsx';
import { COLOR_MACRO } from './NutricionComun.jsx';
import { textoMacros, macrosDe, ordenarTomas } from '../logica/comidas.js';
import { porCapitulos, capitulos, filtrarRecetas, FILTROS, textoTiempo, textoBatch, lineasIngredientes, pasosDe, resumenRecetario, capituloDe, bloqueDe } from '../logica/recetario-equipo.js';
import { recetarioEquipo, fotosRecetarioEquipo, guardarFavoritaEquipo } from '../datos/recetario-equipo.js';
import { num } from '../logica/calculos.js';

// Los datos del recetario, recordados entre visitas (y compartidos por Comidas y la pestaña Recetas)
export function useRecetarioEquipo(atletaId = null) {
  const { backend, api } = useApp();
  return useCarga(() => recetarioEquipo({ backend }, atletaId), [atletaId], { recuerdo: `recetario-equipo:${api.uid()}:${atletaId || 'coach'}` });
}

function TarjetaEquipo({ r, favorita, alAbrir }) {
  const tiempo = textoTiempo(r);
  return (
    <button type="button" class="tarjeta-receta tarjeta-equipo" onClick={() => alAbrir(r)}>
      <FotoReceta receta={r} toma={ordenarTomas(r.tomas || [])[0] || null} />
      <span class="pila-xs tarjeta-receta-texto">
        <span class="nombre">{favorita && <Icono n="estrella" class="favorita" titulo="Guardada" />}{r.nombre}</span>
        <span class="mini secundario num">{textoMacros(macrosDe(r, 1), true) || 'Sin macros'}</span>
        <span class="fila-chips">
          {tiempo && <span class="chip"><Icono n="reloj" />{tiempo}</span>}
          {r.libro?.dificultad && <span class="chip">{r.libro.dificultad}</span>}
        </span>
      </span>
    </button>
  );
}

function Bloque({ capitulo, bloque, recetas, favoritas, alAbrir, reinicio }) {
  const tramos = usePorTramos(recetas.length, { tramo: 12, reinicio, clave: `recetario-equipo-${capitulo}-${bloque}`, nombre: 'recetas más' });
  return (
    <div class="pila-s">
      {bloque && <h3 class="bloque-equipo">{bloque}</h3>}
      <div class="rejilla-recetas">{recetas.slice(0, tramos.hasta).map((r) => <TarjetaEquipo key={r.id} r={r} favorita={favoritas.has(r.id)} alAbrir={alAbrir} />)}</div>
      {tramos.mas}
    </div>
  );
}

export function RecetarioEquipo({ atletaId = null, alAnadir = null, esCoach = false }) {
  const { backend, api } = useApp();
  const datos = useRecetarioEquipo(atletaId);
  // Las miniaturas, aparte y solo aquí (al abrir el recetario); mientras llegan, cada receta sale con su dibujo
  const fotos = useCarga(() => fotosRecetarioEquipo({ backend }), [], { recuerdo: `fotos-recetario-equipo:${api.uid()}` });
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = usePreferencia('fbe-recetario-equipo-filtro', 'todas');
  const [capitulo, setCapitulo] = useState(null);
  const [abierta, setAbierta] = useState(null);
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
    return <div class="panel"><Vacio ilustracion="recetas" titulo="El recetario está vacío">{esCoach ? 'Marca una receta como «Para todo el equipo» y la verán aquí todos tus atletas.' : 'Cuando tu coach añada recetas para todo el equipo, las verás aquí.'}</Vacio></div>;
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
        <div class="panel"><Vacio icono={elFiltro === 'favoritas' && !texto ? 'estrella' : 'buscar'} titulo={elFiltro === 'favoritas' && !texto && !capitulo ? 'Aún no has guardado ninguna' : 'Nada con eso'}>
          {elFiltro === 'favoritas' && !texto && !capitulo ? 'Abre una receta y toca «Guardar» para tenerla aquí a mano.' : 'Prueba con otra palabra o quita algún filtro.'}
        </Vacio></div>
      ) : grupos.map((c) => (
        <section class="seccion" key={c.capitulo} aria-labelledby={`cap-${c.capitulo}`}>
          <div class="seccion-cab"><h2 id={`cap-${c.capitulo}`}>{c.capitulo}</h2><span class="mini terciario">{c.n === 1 ? '1 receta' : `${c.n} recetas`}</span></div>
          <div class="pila">
            {c.bloques.map((b) => <Bloque key={b.bloque} capitulo={c.capitulo} bloque={b.bloque} recetas={b.recetas} favoritas={favoritas} alAbrir={setAbierta} reinicio={reinicio} />)}
          </div>
        </section>
      ))}
      {abierta && <HojaRecetaEquipo r={abierta} favorita={favoritas.has(abierta.id)} esCoach={esCoach} alCerrar={() => setAbierta(null)}
        alMarcar={atletaId && !esCoach ? (si) => marcar(abierta, si) : null}
        alAnadir={alAnadir ? (raciones) => { const r = abierta; setAbierta(null); alAnadir(r, raciones); } : null} />}
    </div>
  );
}

// Una receta del recetario, entera: la entrada, sus etiquetas, los macros por ración, los ingredientes para las
// raciones que se cocinen (con sus medidas caseras), los pasos numerados y las notas.
export function HojaRecetaEquipo({ r: breve, favorita = false, esCoach = false, alCerrar, alMarcar = null, alAnadir = null }) {
  const { api, aviso } = useApp();
  // La foto grande (si la tiene) llega aparte; lo demás ya está
  const completa = useCarga(() => (breve.foto_mini ? api.receta(breve.id).catch(() => null) : Promise.resolve(null)), [breve.id]);
  const r = completa.datos ? { ...breve, foto: completa.datos.foto } : breve;
  const l = r.libro || {};
  const base = Number(r.raciones || 1);
  const [raciones, setRaciones] = useState(base);
  const [ocupado, una] = useUnaVez();
  const m = macrosDe(r, 1, 1);
  const tiempo = textoTiempo(r);
  const lineas = lineasIngredientes(r, raciones);
  const pasos = pasosDe(r);
  const marcar = () => una(async () => { try { await alMarcar(!favorita); aviso(favorita ? 'Ya no está guardada' : 'Guardada en tus favoritas'); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <Hoja titulo={r.nombre} alCerrar={alCerrar} ancho>
      <div class="pila receta-detalle receta-equipo">
        {(r.foto || r.foto_mini) && <FotoReceta receta={r} grande />}
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
        </div>
        {lineas.length > 0 && (
          <section class="pila-s">
            <h3 class="etq">Ingredientes</h3>
            <div class="separa">
              <span class="peq">{raciones === 1 ? 'Para una ración' : `Para ${num(raciones, 0)} raciones`}</span>
              <div style="max-width:150px"><Paso valor={raciones} paso={1} min={1} max={20} dec={0} etiqueta="raciones que cocinas" alCambiar={(v) => v && setRaciones(v)} /></div>
            </div>
            <ul class="ingredientes">{lineas.map((x, k) => <li key={k}>{x.texto}{x.medida && <span class="terciario"> ({x.medida})</span>}</li>)}</ul>
          </section>
        )}
        {pasos.length > 0 && (
          <section class="pila-s">
            <h3 class="etq">Preparación</h3>
            <ol class="pasos-receta">{pasos.map((p, k) => <li key={k}>{p}</li>)}</ol>
          </section>
        )}
        {l.encaje && <section class="pila-s"><h3 class="etq">Cómo encaja en tu día</h3><p class="peq">{l.encaje}</p></section>}
        {l.nota && <div class="nota-coach"><Icono n="mensaje" /><div><strong>{esCoach ? 'Tu nota: ' : 'Nota de tu coach: '}</strong>{l.nota}</div></div>}
        {!esCoach && (alAnadir || alMarcar) && (
          <div class="pila-s">
            {alAnadir && <button class="btn btn-primario btn-grande" onClick={() => alAnadir(1)}><Icono n="calendario" /> Añadir a tu menú</button>}
            {alMarcar && (
              <button class="btn" aria-pressed={favorita ? 'true' : 'false'} disabled={ocupado} onClick={marcar}>
                <Icono n="estrella" class={favorita ? 'favorita' : ''} /> {favorita ? 'Guardada' : 'Guardar'}
              </button>
            )}
          </div>
        )}
      </div>
    </Hoja>
  );
}
