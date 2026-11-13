// «Aprende» (migración 057): las guías del coach por grupo muscular y la ficha de técnica de cada ejercicio. Aquí, lo
// que se pinta: el texto con su negrita, los bloques de una sección, la ficha (pasos, errores, niveles, cuándo sí y
// cuándo no, y la tabla por objetivo), el lector de una guía y la pantalla con todas. Todo es texto: nunca HTML.
import { Fragment } from 'preact';
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { VideoYoutube } from './YouTube.jsx';
import { videosDeTexto } from '../logica/youtube.js';
import { VideotecaAprende } from './Videos.jsx';
import { fmtCorta } from '../logica/fechas.js';
import { useApp, useCarga, Icono, Hoja, Vacio, Siluetas, ErrorCaja, CabeceraGrande } from './comunes.jsx';
import { hoyISO } from '../logica/fechas.js';
import { Imagen, hayImagen } from './Imagen.jsx';
import { imagenGuia, IMAGEN_MITO, imagenPortadaGuia } from '../logica/imagenes.js';
import { trozos, guiaParaLeer, fichaParaLeer, ordenarGuias, buscarFichas, cuantosEjercicios, fichasParecidas, erroresDeFicha, resumenTabla, avisosMolestia, NOMBRE_ZONA, tipoDeRutina, fichaConContenido, porEstantes, estanteDe, buscarEnGuias, mitosDeGuia, mitoDeLaSemana, numeroDeSemana, OCASIONES } from '../logica/guias.js';
import { apuntesDeGuias, apuntesDeGlosario, apuntesDeNovedades, apuntesDeFicha, preguntasDeFicha, masFallados, mensajeDeApunte } from '../logica/apuntes.js';
import { dominioEquipo, nombreTema } from '../logica/apuntes-camino.js';
import { FAQ } from '../datos/faq.js';
import { apuntesDeDudas } from '../logica/apuntes.js';
import { listaGuias, guiaEntera, todasLasFichas, enlacesFichas, enlazarFicha, publicarGuia, fichaDeEjercicio, guiasConTexto, guiaPorClave, guiasLigeras } from '../datos/guias.js';

// Un texto con su negrita
export function Rico({ x }) {
  return <>{trozos(x).map((t, i) => (t.n ? <strong key={i}>{t.t}</strong> : t.t))}</>;
}

const ICONO_TONO = { nota: 'pregunta', clave: 'hecho', aviso: 'alerta', ojo: 'ojo' };
export function Bloques({ bloques }) {
  return (
    <>
      {bloques.map((b, i) => (
        b.t === 'p' ? (videosDeTexto(b.x).length ? <Fragment key={i}><p><Rico x={b.x} /></p>{videosDeTexto(b.x).map((v) => <VideoYoutube key={v.id} url={v.url} titulo="Vídeo de la guía" />)}</Fragment> : <p key={i}><Rico x={b.x} /></p>)
          : b.t === 'video' ? <figure key={i} class="guia-video">{b.titulo && <figcaption class="peq"><strong>{b.titulo}</strong></figcaption>}<VideoYoutube url={b.url} titulo={b.titulo || 'Vídeo de la guía'} notas={b.x || ''} /></figure>
          : b.t === 'h' ? <h3 key={i} class="guia-h">{b.x}</h3>
            : b.t === 'cita' ? <blockquote key={i} class="guia-cita"><Rico x={b.x} /></blockquote>
            : b.t === 'ul' ? <ul key={i} class="guia-lista">{b.xs.map((x, k) => <li key={k}><Rico x={x} /></li>)}</ul>
              : b.t === 'ol' ? <ol key={i} class="guia-lista guia-num">{b.xs.map((x, k) => <li key={k}><Rico x={x} /></li>)}</ol>
                : b.t === 'tabla' ? (
                  <div key={i} class="tabla-desliza" tabIndex={0} role="group" aria-label="Tabla (se desliza a los lados)"><table class="tabla-simple tabla-guia tabla-guia-ancha">
                    <thead><tr>{b.cab.map((c, k) => <th key={k} scope="col">{c}</th>)}</tr></thead>
                    <tbody>{b.filas.map((f, k) => <tr key={k}>{f.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
                  </table></div>
                )
                : (
                  <div key={i} class={`guia-caja tono-${b.tono}`}>
                    {b.titulo && <p class="guia-caja-titulo"><Icono n={ICONO_TONO[b.tono]} />{b.titulo}</p>}
                    <Bloques bloques={b.bloques} />
                  </div>
                )
      ))}
    </>
  );
}

// La ficha de técnica de un ejercicio. ficha: la fila (o su «ficha»); guia: { clave, titulo } para el enlace a su guía
export function FichaFBE({ ficha, guia = null, alAbrirGuia = null }) {
  const f = fichaParaLeer(ficha);
  return (
    <div class="pila ficha-fbe">
      {f.descripcion && <p class="ficha-fbe-entrada">{f.descripcion}</p>}
      {(f.patron || f.principales || f.secundarios) && (
        <dl class="ficha-fbe-datos">
          {f.patron && <><dt>Patrón</dt><dd>{f.patron}</dd></>}
          {f.principales && <><dt>Músculos principales</dt><dd>{f.principales}</dd></>}
          {f.secundarios && <><dt>Secundarios</dt><dd>{f.secundarios}</dd></>}
        </dl>
      )}
      {f.pasos.length > 0 && (
        <section class="pila-s">
          <h3 class="etq">Cómo ejecutarlo</h3>
          <ol class="pasos-guia">{f.pasos.map((p, i) => <li key={i}><span><Rico x={p} /></span></li>)}</ol>
        </section>
      )}
      {f.errores.length > 0 && (
        <section class="pila-s">
          <h3 class="etq">Errores típicos</h3>
          <ul class="errores-guia">{f.errores.map((p, i) => <li key={i}><Icono n="alerta" /><span><Rico x={p} /></span></li>)}</ul>
        </section>
      )}
      {f.niveles.length > 0 && (
        <section class="pila-s">
          <h3 class="etq">Según tu nivel</h3>
          <dl class="niveles-guia">{f.niveles.map((n) => <div key={n.nivel}><dt>{n.nombre}</dt><dd><Rico x={n.x} /></dd></div>)}</dl>
        </section>
      )}
      {(f.si || f.no) && (
        <section class="pila-s">
          <h3 class="etq">Cuándo lo prescribe tu coach</h3>
          {f.si && <div class="guia-caja tono-clave"><p class="guia-caja-titulo"><Icono n="hecho" />Sí, cuando</p><p><Rico x={f.si} /></p></div>}
          {f.no && <div class="guia-caja tono-ojo"><p class="guia-caja-titulo"><Icono n="cerrar" />No, cuando</p><p><Rico x={f.no} /></p></div>}
        </section>
      )}
      {f.tabla.length > 0 && (
        <section class="pila-s">
          <h3 class="etq">Repeticiones, esfuerzo y descanso</h3>
          <div class="tabla-desliza"><table class="tabla-simple tabla-guia">
            <thead><tr><th scope="col">Objetivo</th><th scope="col">Reps</th><th scope="col">RPE</th><th scope="col">Descanso</th></tr></thead>
            <tbody>{f.tabla.map((r, i) => <tr key={i}><th scope="row">{r.objetivo}</th><td class="num">{r.reps}</td><td class="num">{r.rpe}</td><td class="num">{r.descanso}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
      {guia && alAbrirGuia && <button type="button" class="btn plano" style="justify-self:start" onClick={() => alAbrirGuia(guia)}><Icono n="biblioteca" /> Ver la guía de {guia.titulo}</button>}
    </div>
  );
}

// Una ficha, en su hoja (desde una guía o desde el buscador)
export function HojaFichaGuia({ ficha, alCerrar }) {
  return (
    <Hoja titulo={ficha.nombre} alCerrar={alCerrar} ancho>
      {fichaParaLeer(ficha).cabecera && <p class="mini terciario ficha-fbe-cab">{fichaParaLeer(ficha).cabecera}</p>}
      <FichaFBE ficha={ficha} />
    </Hoja>
  );
}

function FilaFicha({ f, alAbrir, guia = false }) {
  return (
    <li>
      <button type="button" class="accion-fila fila-ficha" onClick={() => alAbrir(f)}>
        <span class="num fila-ficha-n" aria-hidden="true">{String(f.orden).padStart(2, '0')}</span>
        <span class="pila-xs"><strong>{f.nombre}</strong>{(guia ? f.guia_titulo : f.ficha?.cabecera) && <span class="mini terciario">{guia ? f.guia_titulo : f.ficha.cabecera}</span>}</span>
        <Icono n="derecha" />
      </button>
    </li>
  );
}

// Una guía entera para leer: la entrada, un índice de un toque, las secciones con sus fichas y las ideas clave
// soloSeccion: la clave de una sección; con ella se enseña solo esa (y un botón para ver la guía entera)
// seccionInicial: el número de la sección a la que se baja al abrir (-1: las ideas clave), desde el buscador
export function LectorGuia({ clave, soloSeccion = null, seccionInicial = null }) {
  const { backend, api } = useApp();
  const d = useCarga(() => guiaEntera({ backend }, clave), [clave], { recuerdo: `guia:${api.uid()}:${clave}` });
  const [ficha, setFicha] = useState(null);
  const [entera, setEntera] = useState(false);
  const raiz = useRef(null);
  const g = useMemo(() => (d.datos ? guiaParaLeer(d.datos.guia, d.datos.fichas) : null), [d.datos]);
  useEffect(() => {
    if (seccionInicial == null || !g) return;
    raiz.current?.querySelector(`[data-seccion="${seccionInicial < 0 ? 'ideas' : seccionInicial}"]`)?.scrollIntoView({ block: 'start' });
  }, [seccionInicial, !!g]);
  if (!d.datos) return d.error ? <ErrorCaja error={d.error} reintentar={() => d.recargar(true)} /> : d.cargando ? <Siluetas forma="tarjetas" n={3} texto="Cargando la guía" /> : <div class="panel"><Vacio icono="biblioteca" titulo="Esa guía ya no está" /></div>;
  const una = soloSeccion && !entera ? g.secciones.find((x) => x.clave === soloSeccion) : null;
  if (una) {
    return (
      <div class="pila lector-guia">
        <section class="seccion guia-seccion">
          {una.subtitulo && <p class="peq terciario">{una.subtitulo}</p>}
          <Bloques bloques={una.bloques} />
        </section>
        <button type="button" class="btn" style="justify-self:start" onClick={() => setEntera(true)}><Icono n="biblioteca" /> Ver la guía entera</button>
      </div>
    );
  }
  const ir = (i) => raiz.current?.querySelector(`[data-seccion="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const partes = [...g.secciones.map((s, i) => [i, s.titulo]), ...(g.sueltas.length ? [['sueltas', 'Más ejercicios']] : []), ...(g.ideas.length ? [['ideas', 'Ideas clave']] : [])];
  return (
    <div class="pila lector-guia" ref={raiz}>
      {hayImagen(imagenPortadaGuia(clave)) && <Imagen id={imagenPortadaGuia(clave)} clase="franja-ilu portada-guia" tamanos="(min-width: 720px) 640px, 100vw" prioridad />}
      {g.entrada && <p class="secundario">{g.entrada}</p>}
      {g.cita && <blockquote class="guia-cita">{g.cita}</blockquote>}
      {partes.length > 1 && (
        <div class="selector-chips" role="group" aria-label="Partes de la guía">
          {partes.map(([i, t]) => <button type="button" key={i} onClick={() => ir(i)}>{t}</button>)}
        </div>
      )}
      {g.secciones.map((s, i) => (
        <section class="seccion guia-seccion" key={i} data-seccion={i}>
          <div class="pila-xs"><h2 class="guia-titulo">{s.titulo}</h2>{s.subtitulo && <p class="peq terciario">{s.subtitulo}</p>}</div>
          <Bloques bloques={s.bloques} />
          {s.fichas.length > 0 && <div class="panel"><ul class="lista">{s.fichas.map((f) => <FilaFicha key={f.id} f={f} alAbrir={setFicha} />)}</ul></div>}
        </section>
      ))}
      {g.sueltas.length > 0 && (
        <section class="seccion guia-seccion" data-seccion="sueltas">
          <h2 class="guia-titulo">Más ejercicios</h2>
          <div class="panel"><ul class="lista">{g.sueltas.map((f) => <FilaFicha key={f.id} f={f} alAbrir={setFicha} />)}</ul></div>
        </section>
      )}
      {g.ideas.length > 0 && (
        <section class="seccion guia-seccion" data-seccion="ideas">
          <div class="pila-xs"><h2 class="guia-titulo">Para llevarte a casa</h2><p class="peq terciario">Las ideas clave de esta guía</p></div>
          <ol class="ideas-guia">{g.ideas.map((x, i) => <li key={i}><span class="num ideas-guia-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><strong>{x.titulo}</strong><span class="peq secundario">{x.x}</span></li>)}</ol>
        </section>
      )}
      {ficha && <HojaFichaGuia ficha={ficha} alCerrar={() => setFicha(null)} />}
    </div>
  );
}

// Una guía en su hoja (desde la ficha de un ejercicio)
export function HojaGuia({ guia, alCerrar, soloSeccion = null, titulo = null }) {
  return <Hoja titulo={titulo || guia.titulo} alCerrar={alCerrar} ancho><LectorGuia clave={guia.clave} soloSeccion={soloSeccion} /></Hoja>;
}

// (2) Antes de enviar un vídeo de técnica: los errores típicos de ese ejercicio, para repasarse. Plegado; sin ficha, nada.
export function RepasoErrores({ ejercicioId }) {
  const { backend, perfil } = useApp();
  const fbe = useCarga(() => (perfil?.rol === 'coach' ? Promise.resolve(null) : fichaDeEjercicio({ backend }, ejercicioId).catch(() => null)), [ejercicioId], { recuerdo: `ficha-fbe:${ejercicioId}` });
  const [abierto, setAbierto] = useState(false);
  const errores = fbe.datos ? erroresDeFicha(fbe.datos.ficha) : [];
  if (!errores.length) return null;
  return (
    <div class="repaso-errores panel-pad">
      <button type="button" class="btn-texto" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}>
        <Icono n={abierto ? 'abajo' : 'derecha'} /> Antes de enviarlo: {errores.length === 1 ? 'el error típico' : `los ${errores.length} errores típicos`}
      </button>
      {abierto && (
        <>
          <ul class="errores-guia">{errores.map((e, i) => <li key={i}><Icono n="alerta" /><span><strong>{e.titulo}</strong>{e.x ? `${e.seguido ? ' ' : ': '}${e.x}` : ''}</span></li>)}</ul>
          <p class="mini terciario">Míralos en tu vídeo. Si ves alguno, cuéntaselo a tu coach en la nota o graba otra.</p>
        </>
      )}
    </div>
  );
}

// (4) En la semana del atleta: cómo está montada (por los nombres de sus sesiones) y por qué, de la guía de rutinas.
// Sin guía de rutinas, o si la distribución no se reconoce, no sale.
export function PorQueEntrenasAsi({ sesiones }) {
  const { backend, api } = useApp();
  const tipo = tipoDeRutina(sesiones);
  const guias = useCarga(() => (tipo ? listaGuias({ backend }).catch(() => []) : Promise.resolve([])), [!!tipo], { recuerdo: tipo ? `guias:${api.uid()}` : null });
  const [abierta, setAbierta] = useState(false);
  const guia = (guias.datos || []).find((g) => g.clave === 'rutinas' && g.publicada);
  if (!tipo || !guia) return null;
  return (
    <>
      <button type="button" class="panel panel-pad por-que" onClick={() => setAbierta(true)} aria-haspopup="dialog">
        <Icono n="biblioteca" />
        <span class="pila-xs"><span class="mini terciario">Cómo está montada tu semana</span><strong>{tipo.nombre}</strong><span class="peq secundario">Por qué entrenas así y cómo progresa</span></span>
        <Icono n="derecha" />
      </button>
      {abierta && <HojaGuia guia={guia} soloSeccion={tipo.clave} titulo={tipo.nombre} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

// (3) Las guías de unos grupos musculares, en botones (debajo del mapa muscular): tocar uno abre su guía
export function GuiasDeGrupos({ grupos = [] }) {
  const { backend, api, perfil } = useApp();
  const guias = useCarga(() => listaGuias({ backend }).catch(() => []), [], { recuerdo: `guias:${api.uid()}` });
  const [abierta, setAbierta] = useState(null);
  const suyas = ordenarGuias(guias.datos || []).filter((g) => g.grupo && grupos.includes(g.grupo) && (g.publicada || perfil?.rol === 'coach'));
  if (!suyas.length) return null;
  return (
    <div class="pila-xs guias-de-grupos">
      <span class="mini terciario">Las guías de estos músculos</span>
      <div class="selector-chips" role="group" aria-label="Guías por grupo muscular">
        {suyas.map((g) => <button type="button" key={g.id} onClick={() => setAbierta(g)} aria-haspopup="dialog">{g.titulo}</button>)}
      </div>
      {abierta && <HojaGuia guia={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  );
}

// (5) Al programar: lo que dice la ficha del ejercicio (repeticiones por objetivo) y, si el atleta apuntó una molestia
// que la ficha nombra en su «no lo prescribo cuando», un aviso. fichas: { [ficha_id]: fila }; enlaces: { [ejercicio_id]: ficha_id }
export function AyudaFicha({ ejercicioId, fichas, enlaces, molestias = [] }) {
  const [ver, setVer] = useState(false);
  const fila = ejercicioId && enlaces && fichas ? fichas[enlaces[ejercicioId]] : null;
  if (!fila || !fichaConContenido(fila)) return null;
  const avisos = avisosMolestia(fila, molestias);
  const resumen = resumenTabla(fila);
  return (
    <div class="mini ayuda-ficha">
      <button type="button" class="btn-texto mini" onClick={() => setVer(true)} aria-haspopup="dialog" title="Tu ficha de este ejercicio">
        <Icono n="biblioteca" /> {resumen || 'Tu ficha'}
      </button>
      {avisos.map((a) => (
        <button type="button" key={a.zona} class="chip aviso" onClick={() => setVer(true)} title="Míralo en «No, cuando» de tu ficha">
          <Icono n="alerta" /> Molestia en {NOMBRE_ZONA[a.zona]}{a.intensidad >= 2 ? (a.intensidad >= 3 ? ' (grave)' : ' (moderada)') : ''}: revisa cuándo no lo prescribes
        </button>
      ))}
      {ver && <HojaFichaGuia ficha={fila} alCerrar={() => setVer(false)} />}
    </div>
  );
}

function TarjetaGuia({ g, alAbrir, esCoach, icono = 'biblioteca' }) {
  return (
    <button type="button" class="tarjeta-guia" onClick={() => alAbrir(g)}>
      {/* la estatua de su grupo, su portada o, si no tiene, la ilustración de su estantería; sin imagen, su icono */}
      {hayImagen(imagenGuia(g, estanteDe(g))) ? <Imagen id={imagenGuia(g, estanteDe(g))} clase="tarjeta-guia-img" tamanos="72px" /> : <span class="tarjeta-guia-img vacia" aria-hidden="true"><Icono n={icono} /></span>}
      <span class="pila-xs tarjeta-guia-texto"><strong>{g.titulo}</strong>{g.subtitulo && <span class="mini terciario">{g.subtitulo}</span>}
        <span class="fila-chips">{g.fichas > 0 && <span class="chip">{cuantosEjercicios(g.fichas)}</span>}{esCoach && !g.publicada && <span class="chip aviso">Sin publicar</span>}</span></span>
    </button>
  );
}

// Todas las guías, por estanterías, y un buscador: de ejercicios (sus fichas) y dentro del texto de las guías.
// alAbrir(guia, seccion?) abre una (en esa sección, si viene del buscador)
export function ListaGuias({ alAbrir, esCoach = false }) {
  const { backend, api } = useApp();
  const guias = useCarga(() => listaGuias({ backend }), [], { recuerdo: `guias:${api.uid()}` });
  const fichas = useCarga(() => todasLasFichas({ backend }, { conFicha: true }).catch(() => []), [], { recuerdo: `fichas-guias:${api.uid()}` });
  const [q, setQ] = useState('');
  const buscando = q.trim().length >= 2;
  // el texto de las guías solo se pide al empezar a buscar
  const textos = useCarga(() => (buscando ? guiasConTexto({ backend }).catch(() => []) : Promise.resolve(null)), [buscando], { recuerdo: buscando ? `guias-texto:${api.uid()}` : null });
  const [ficha, setFicha] = useState(null);
  const gs = ordenarGuias(guias.datos || []).filter((g) => esCoach || g.publicada);
  const estantes = useMemo(() => porEstantes(gs), [guias.datos, esCoach]);
  const halladas = buscando ? buscarFichas(fichas.datos || [], q) : [];
  const enTexto = useMemo(() => (buscando && textos.datos ? buscarEnGuias(textos.datos.filter((g) => esCoach || g.publicada), q) : []), [buscando, q, textos.datos, esCoach]);
  if (!guias.datos) return guias.error ? <ErrorCaja error={guias.error} reintentar={() => guias.recargar(true)} /> : <Siluetas forma="tarjetas" n={4} texto="Cargando las guías" />;
  if (!gs.length) return <div class="panel"><Vacio icono="biblioteca" titulo="Aún no hay guías">{esCoach ? 'Cuando cargues tus guías, tus atletas las leerán en «Aprende» y cada ejercicio enlazado enseñará su ficha de técnica.' : 'Cuando tu coach publique sus guías, las leerás aquí.'}</Vacio></div>;
  const abrirHallazgo = (h) => alAbrir(gs.find((g) => g.id === h.guia.id) || h.guia, h.seccion);
  return (
    <div class="pila aprende">
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" maxLength={60} value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Buscar en las guías" aria-label="Buscar un ejercicio o un tema en las guías" /></div>
      {buscando ? (
        <div class="pila hallazgos-guias" aria-live="polite">
          {halladas.length > 0 && (
            <section class="pila-s"><h2 class="etq">Ejercicios</h2>
              <div class="panel"><ul class="lista">{halladas.slice(0, 12).map((f) => <FilaFicha key={f.id} f={f} guia alAbrir={setFicha} />)}</ul></div></section>
          )}
          {enTexto.length > 0 && (
            <section class="pila-s"><h2 class="etq">En las guías</h2>
              <div class="panel"><ul class="lista">{enTexto.map((h, i) => (
                <li key={i}>
                  <button type="button" class="accion-fila hallazgo-guia" onClick={() => abrirHallazgo(h)}>
                    <span class="pila-xs"><span class="mini terciario">{h.guia.titulo}</span><strong>{h.titulo || h.guia.titulo}</strong>
                      {h.hallado && <span class="peq secundario">{h.antes}<mark>{h.hallado}</mark>{h.despues}</span>}</span>
                    <Icono n="derecha" />
                  </button>
                </li>
              ))}</ul></div></section>
          )}
          {!halladas.length && !enTexto.length && (textos.datos ? <div class="panel"><Vacio icono="buscar" titulo="Nada con eso">Prueba con otra palabra.</Vacio></div> : <Siluetas forma="tarjetas" n={2} texto="Buscando en las guías" />)}
        </div>
      ) : estantes.length > 1 ? (
        estantes.map((e) => (
          <section class="pila-s estante" key={e.id} data-estante={e.id}>
            <div class="estante-cab"><h2>{e.nombre}</h2>{e.detalle && <span class="mini terciario">{e.detalle}</span>}</div>
            <div class="rejilla-guias">{e.guias.map((g) => <TarjetaGuia key={g.id} g={g} alAbrir={alAbrir} esCoach={esCoach} icono={e.icono} />)}</div>
          </section>
        ))
      ) : <div class="rejilla-guias">{gs.map((g) => <TarjetaGuia key={g.id} g={g} alAbrir={alAbrir} esCoach={esCoach} />)}</div>}
      {ficha && <HojaFichaGuia ficha={ficha} alCerrar={() => setFicha(null)} />}
    </div>
  );
}

// La guía que viene a cuento (logica/guias.js, OCASIONES): una fila que abre esa sección en su hoja. Solo sale si la
// guía está y está publicada. Es una propuesta de lectura: no guarda nada ni cuenta nada a nadie.
export function GuiaSugerida({ ocasion }) {
  const { backend, api, perfil } = useApp();
  const o = OCASIONES[ocasion];
  const guias = useCarga(() => (o && perfil?.rol !== 'coach' ? guiasLigeras({ backend }).catch(() => []) : Promise.resolve([])), [!!o], { recuerdo: o ? `guias-ligeras:${api.uid()}` : null });
  const [abierta, setAbierta] = useState(false);
  const guia = o && (guias.datos || []).find((g) => g.clave === o.clave && g.publicada);
  if (!guia) return null;
  return (
    <>
      <button type="button" class="panel panel-pad por-que guia-sugerida" data-ocasion={ocasion} onClick={() => setAbierta(true)} aria-haspopup="dialog">
        <Icono n="biblioteca" />
        <span class="pila-xs"><span class="mini terciario">{o.cuando}</span><strong>{o.titulo}</strong><span class="peq secundario">{o.detalle}</span></span>
        <Icono n="derecha" />
      </button>
      {abierta && <HojaGuia guia={guia} soloSeccion={o.seccion} titulo={o.titulo} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

// El mito de la semana (de la guía «mitos»): el mismo para todo el equipo, va rotando cada lunes. En Hoy, una tarjeta
// con el mito; al tocarla, lo que dice la evidencia. Una vez leído, se recoge hasta la semana siguiente (se apunta en
// este móvil, no en la base).
const claveMito = (uid) => `fbe-mito-visto:${uid}`;
const mitoVisto = (uid) => { try { return Number(localStorage.getItem(claveMito(uid))) || 0; } catch { return 0; } };
export function MitoDeLaSemana() {
  const { backend, api, perfil } = useApp();
  const hoy = hoyISO();
  const semana = numeroDeSemana(hoy);
  const [visto, setVisto] = useState(() => mitoVisto(api.uid()));
  const pedir = perfil?.rol !== 'coach' && visto !== semana;
  const guia = useCarga(() => (pedir ? guiaPorClave({ backend }, 'mitos').catch(() => null) : Promise.resolve(null)), [pedir], { recuerdo: pedir ? `guia-mitos:${api.uid()}` : null });
  const [abierto, setAbierto] = useState(false);
  const [entera, setEntera] = useState(false);
  const mito = useMemo(() => (guia.datos?.publicada ? mitoDeLaSemana(mitosDeGuia(guia.datos), hoy) : null), [guia.datos, hoy]);
  if (!mito || (visto === semana && !abierto && !entera)) return null;
  const cerrar = () => { setAbierto(false); try { localStorage.setItem(claveMito(api.uid()), String(semana)); } catch { /* sin sitio: saldrá otra vez */ } setVisto(semana); };
  return (
    <>
      {visto !== semana && (
        <button type="button" class={`panel panel-pad mito-semana${hayImagen(IMAGEN_MITO) ? ' con-ilu' : ''}`} onClick={() => setAbierto(true)} aria-haspopup="dialog">
          {hayImagen(IMAGEN_MITO) && <Imagen id={IMAGEN_MITO} clase="franja-ilu franja-pegada franja-mito" tamanos="(min-width: 720px) 640px, 100vw" />}
          <span class="mini mito-semana-k"><Icono n="pregunta" /> El mito de la semana</span>
          <strong class="mito-frase">«{mito.mito}»</strong>
          <span class="peq secundario mito-semana-pie">Qué dice la evidencia <Icono n="derecha" /></span>
        </button>
      )}
      {abierto && (
        <Hoja titulo="El mito de la semana" alCerrar={cerrar} ancho>
          <div class="pila lector-guia mito-hoja">
            <p class="mito-frase">«{mito.mito}»</p>
            {mito.tema && <p class="mini terciario">{mito.tema}</p>}
            <Bloques bloques={mito.bloques} />
            <button type="button" class="btn" style="justify-self:start" onClick={() => { cerrar(); setEntera(true); }}><Icono n="biblioteca" /> Ver todos los mitos</button>
          </div>
        </Hoja>
      )}
      {entera && <HojaGuia guia={guia.datos} alCerrar={() => setEntera(false)} />}
    </>
  );
}

// (coach) Biblioteca → Guías: las mismas guías que leen sus atletas, con cuántos ejercicios de la biblioteca llevan ficha
// y un interruptor para publicar o esconder cada una
// (coach, 060) «La novedad de la semana»: un estudio o una idea en tres líneas, que sale a los atletas como un apunte más
// (en el descanso, la primera; en Hoy, como «Novedad de la semana» hasta que la leen). El coach la escribe, la publica y
// la puede corregir o borrar. Sin la 060, la lista sale vacía y al guardar se avisa de que falta.
const NOVEDAD_VACIA = { id: null, titulo: '', texto: '', fuente: '', enlace: '', publicada: true, tipo: 'novedad', ejercicio_id: null, ejercicio: '', opciones: ['', '', ''], correcta: 0, explicaciones: ['', '', ''] };

// (tanda 4) Mandar un apunte a un atleta: le llega por Mensajes, como cualquier otro mensaje del coach
function HojaMandarApunte({ apunte, alCerrar }) {
  const { api, aviso } = useApp();
  const atletas = useCarga(() => api.atletas().catch(() => []), []);
  const [enviando, setEnviando] = useState(null);
  const texto = mensajeDeApunte(apunte);
  const mandar = async (a) => {
    setEnviando(a.id);
    try { await api.enviarMensaje(a.id, { autor: 'coach', texto }); aviso(`Enviado a ${a.nombre.split(' ')[0]}: lo verá en Mensajes`); alCerrar(); }
    catch (e) { aviso(e.message, 'error'); setEnviando(null); }
  };
  const activos = (atletas.datos || []).filter((a) => a.estado !== 'baja');
  return (
    <Hoja titulo="Mandar a un atleta" alCerrar={alCerrar}>
      <div class="pila-s mandar-apunte">
        <blockquote class="panel panel-pad peq">{texto}</blockquote>
        {atletas.cargando && <Siluetas forma="lista" n={3} texto="Cargando tus atletas" />}
        {!atletas.cargando && !activos.length && <p class="peq secundario">Aún no tienes atletas a los que mandárselo.</p>}
        {activos.length > 0 && (
          <div class="panel">
            {activos.map((a) => <button type="button" class="novedad-fila" key={a.id} disabled={!!enviando} onClick={() => mandar(a)}><strong>{a.nombre}</strong><span class="chip">{enviando === a.id ? 'Enviando…' : 'Mandar'}</span></button>)}
          </div>
        )}
      </div>
    </Hoja>
  );
}

// (tanda 4) «Lo que más se falla»: los apuntes que más atletas han dicho que no sabían (o han fallado en una pregunta).
// Solo cuentas: nunca quién. Desde aquí se le puede mandar ese apunte a un atleta.
export function FalladosCoach() {
  const { api, backend } = useApp();
  const [mandar, setMandar] = useState(null);
  const datos = useCarga(async () => {
    const filas = await api.apuntesFallados().catch(() => []);
    if (!filas.length) return [];
    const [guias, fichas, novedades] = await Promise.all([guiasConTexto({ backend }).catch(() => []), todasLasFichas({ backend }, { conFicha: true }).catch(() => []), api.novedades().catch(() => [])]);
    const apuntes = [...apuntesDeGuias(guias), ...apuntesDeGlosario(), ...apuntesDeNovedades(novedades), ...fichas.flatMap((f) => [...apuntesDeFicha(f), ...preguntasDeFicha(f)])];
    return masFallados(filas, apuntes, 5);
  }, []);
  const filas = datos.datos || [];
  if (!filas.length) return null;
  return (
    <section class="fallados-coach pila-s" aria-label="Lo que más se falla">
      <div class="novedades-cab"><h2>Lo que más se falla</h2></div>
      <p class="peq secundario">Los apuntes que más atletas no sabían al verlos en sus descansos. Buena pista para tu próxima novedad.</p>
      <div class="panel">
        {filas.map((x) => (
          <div class="fallado-fila" key={x.id}>
            <span class="pila-xs"><strong>{x.titulo || x.texto}</strong><span class="peq secundario">{x.etiqueta}{x.de ? ` · ${x.de}` : ''} · {x.atletas === 1 ? '1 atleta no lo sabía' : `${x.atletas} atletas no lo sabían`}</span></span>
            <button type="button" class="btn btn-peq" onClick={() => setMandar(x)}>Mandar a…</button>
          </div>
        ))}
      </div>
      {mandar && <HojaMandarApunte apunte={mandar} alCerrar={() => setMandar(null)} />}
    </section>
  );
}
export function NovedadesCoach() {
  const { api, aviso } = useApp();
  const [n, setN] = useState(0);
  const lista = useCarga(() => api.novedades().catch(() => []), [n]);
  const [f, setF] = useState(null);          // la que se está escribiendo
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [mandar, setMandar] = useState(null);
  // (tanda 4) los ejercicios de la biblioteca, para el apunte suelto de un ejercicio (solo se piden al escribir uno)
  const suelto = f?.tipo === 'apunte';
  // (apuntes, tanda A) o una pregunta tuya, de test: también puede ir a un ejercicio
  const pregunta = f?.tipo === 'pregunta';
  const conEjercicio = suelto || pregunta;
  const ejercicios = useCarga(() => (conEjercicio ? api.biblioteca().catch(() => []) : Promise.resolve(null)), [conEjercicio]);
  const nombreDe = (id) => (id ? (ejercicios.datos || []).find((e) => e.id === id)?.nombre || '' : '');
  const abrir = (x) => { setBorrar(false); setF(x ? { id: x.id, titulo: x.titulo || '', texto: x.texto || '', fuente: x.fuente || '', enlace: x.enlace || '', publicada: !!x.publicada, tipo: ['apunte', 'pregunta'].includes(x.tipo) ? x.tipo : 'novedad', ejercicio_id: x.ejercicio_id || null, ejercicio: null, audio: x.audio_ruta ? { ruta: x.audio_ruta, segundos: x.audio_segundos } : null, audioCambiado: false, opciones: x.opciones?.length ? [...x.opciones] : ['', '', ''], correcta: Number.isInteger(x.correcta) ? x.correcta : 0, explicaciones: x.explicaciones?.length ? [...x.explicaciones] : (x.opciones || ['', '', '']).map(() => '') } : { ...NOVEDAD_VACIA }); };
  const guardar = async (ev) => {
    ev.preventDefault();
    setGuardando(true);
    try {
      // (el ejercicio se escribe por su nombre: tiene que ser uno de la biblioteca)
      let ejercicio_id = null;
      if (conEjercicio) {
        const escrito = (f.ejercicio ?? nombreDe(f.ejercicio_id)).trim().toLocaleLowerCase('es');
        ejercicio_id = escrito ? (ejercicios.datos || []).find((e) => e.nombre.trim().toLocaleLowerCase('es') === escrito)?.id || null : null;
        if (escrito && !ejercicio_id) throw new Error('No encuentro ese ejercicio en tu biblioteca: elige uno de la lista o déjalo vacío');
      }
      let extra = {};
      if (pregunta) {
        const filas = f.opciones.map((o, i) => ({ o: o.trim(), x: (f.explicaciones[i] || '').trim(), buena: i === f.correcta })).filter((r) => r.o);
        if (filas.length < 2) throw new Error('Escribe al menos dos opciones');
        if (!filas.some((r) => r.buena)) throw new Error('Marca cuál es la buena (y que no esté vacía)');
        extra = { opciones: filas.map((r) => r.o), correcta: filas.findIndex((r) => r.buena), explicaciones: filas.map((r) => (r.buena ? '' : r.x)) };
      }
      // (apuntes, tanda D, 064) su audio-píldora: si es nueva, se sube antes; si la ha quitado, fuera
      let audio;
      if (f.audioCambiado) audio = f.audio?.blob ? { ruta: await api.subirAudioApunte(f.audio.blob, f.audio.blob.type || 'audio/webm'), segundos: f.audio.segundos } : null;
      await api.guardarNovedad({ id: f.id, titulo: f.titulo, texto: f.texto, fuente: f.fuente, enlace: f.enlace, publicada: f.publicada, tipo: f.tipo, ejercicio_id, ...extra, ...(audio !== undefined ? { audio } : {}) });
      aviso(f.publicada ? (pregunta ? 'Publicada: tus atletas la verán en sus apuntes, como un test' : suelto ? 'Publicado: tus atletas lo verán en sus apuntes' : 'Publicada: tus atletas la verán en sus apuntes') : 'Guardada sin publicar'); setF(null); setN(n + 1);
    }
    catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  const quitar = async () => {
    if (!borrar) { setBorrar(true); return; }
    try { await api.borrarNovedad(f.id); aviso('Novedad borrada'); setF(null); setN(n + 1); } catch (e) { aviso(e.message, 'error'); }
  };
  const filas = lista.datos || [];
  return (
    <section class="novedades-coach pila-s" aria-label="La novedad de la semana">
      <div class="novedades-cab">
        <h2>La novedad de la semana</h2>
        <button type="button" class="btn btn-peq" onClick={() => abrir(null)}><Icono n="mas" /> Nueva</button>
      </div>
      <p class="peq secundario">Un estudio o una idea en tres líneas. Tus atletas la ven la primera en sus apuntes del descanso y en Hoy, hasta que la leen.</p>
      {filas.length > 0 && (
        <div class="panel">
          {filas.map((x) => (
            <button type="button" class="novedad-fila" key={x.id} onClick={() => abrir(x)}>
              <strong>{x.titulo}</strong>
              {x.publicada ? <span class="chip">Publicada</span> : <span class="chip aviso">Sin publicar</span>}
              <span class="peq secundario">{x.tipo === 'apunte' ? 'Apunte suelto · ' : x.tipo === 'pregunta' ? 'Pregunta · ' : ''}{x.publicada_en ? fmtCorta(String(x.publicada_en).slice(0, 10)) : 'Borrador'}{x.fuente ? ` · ${x.fuente}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {f && (
        <Hoja titulo={f.id ? (pregunta ? 'Pregunta' : suelto ? 'Apunte suelto' : 'Novedad') : pregunta ? 'Nueva pregunta' : suelto ? 'Nuevo apunte' : 'Nueva novedad'} alCerrar={() => setF(null)}>
          <form class="novedad-form" onSubmit={guardar}>
            <div class="segmentos novedad-tipo" role="group" aria-label="Qué es">
              <button type="button" aria-pressed={!conEjercicio ? 'true' : 'false'} onClick={() => setF({ ...f, tipo: 'novedad' })}>Novedad</button>
              <button type="button" aria-pressed={suelto ? 'true' : 'false'} onClick={() => setF({ ...f, tipo: 'apunte' })}>Apunte suelto</button>
              <button type="button" aria-pressed={pregunta ? 'true' : 'false'} onClick={() => setF({ ...f, tipo: 'pregunta' })}>Pregunta</button>
            </div>
            <p class="mini secundario">{pregunta ? 'Una pregunta de test tuya: sale en los apuntes como «Pregunta de tu coach». Al fallarla, ven por qué no era esa. Si eliges un ejercicio, solo en los descansos de ese ejercicio.' : suelto ? 'Un apunte tuyo que no caduca: sale en los descansos como «De tu coach». Si eliges un ejercicio, solo en los descansos de ese ejercicio.' : 'La ven la primera, en el descanso y en Hoy, durante una semana o hasta que la leen.'}</p>
            {conEjercicio && (
              <div class="campo"><label for="nov-ejercicio">Ejercicio <span class="secundario">(opcional)</span></label>
                <input id="nov-ejercicio" class="entrada" list="nov-ejercicios" autocomplete="off" value={f.ejercicio ?? nombreDe(f.ejercicio_id)} placeholder="Escribe para buscar en tu biblioteca" onInput={(e) => setF({ ...f, ejercicio: e.currentTarget.value })} />
                <datalist id="nov-ejercicios">{(ejercicios.datos || []).map((e) => <option key={e.id} value={e.nombre} />)}</datalist></div>
            )}
            <div class="campo"><label for="nov-titulo">{pregunta ? 'La pregunta' : 'Título'}</label>
              <input id="nov-titulo" class="entrada" required maxLength={90} value={f.titulo} placeholder={pregunta ? '¿Qué pasa si…?' : 'La idea, en una frase'} onInput={(e) => setF({ ...f, titulo: e.currentTarget.value })} /></div>
            {pregunta && (
              <fieldset class="campo pregunta-opciones">
                <legend>Opciones <span class="secundario">(marca la buena; el «por qué no» de las malas es opcional)</span></legend>
                {f.opciones.map((o, i) => (
                  <div class="pregunta-opcion" key={i}>
                    <label class="pregunta-buena"><input type="radio" name="nov-correcta" checked={f.correcta === i} onChange={() => setF({ ...f, correcta: i })} aria-label={`La buena es la opción ${i + 1}`} /></label>
                    <input class="entrada" maxLength={120} value={o} aria-label={`Opción ${i + 1}`} placeholder={`Opción ${i + 1}`} onInput={(e) => { const opciones = [...f.opciones]; opciones[i] = e.currentTarget.value; setF({ ...f, opciones }); }} />
                    {f.correcta !== i && <input class="entrada entrada-peq" maxLength={200} value={f.explicaciones[i] || ''} aria-label={`Por qué no es la opción ${i + 1}`} placeholder="Por qué no es esta (opcional)" onInput={(e) => { const explicaciones = [...f.explicaciones]; explicaciones[i] = e.currentTarget.value; setF({ ...f, explicaciones }); }} />}
                  </div>
                ))}
                <div class="fila-s">
                  {f.opciones.length < 4 && <button type="button" class="btn-texto" onClick={() => setF({ ...f, opciones: [...f.opciones, ''], explicaciones: [...f.explicaciones, ''] })}><Icono n="mas" /> Otra opción</button>}
                  {f.opciones.length > 2 && <button type="button" class="btn-texto" onClick={() => setF({ ...f, opciones: f.opciones.slice(0, -1), explicaciones: f.explicaciones.slice(0, -1), correcta: Math.min(f.correcta, f.opciones.length - 2) })}><Icono n="menos" /> Quitar la última</button>}
                </div>
              </fieldset>
            )}
            <div class="campo"><label for="nov-texto">{pregunta ? 'La explicación' : 'Texto'}</label>
              <textarea id="nov-texto" class="entrada" required maxLength={500} value={f.texto} placeholder={pregunta ? 'Lo que leen al responder: por qué es la buena.' : 'Qué se hizo, qué salió y qué hacer con ello. Tres líneas.'} onInput={(e) => setF({ ...f, texto: e.currentTarget.value })} />
              <span class="cuenta-letras num">{[...f.texto].length}/500</span></div>
            <GrabarAudio valor={f.audio} alCambiar={(audio) => setF({ ...f, audio, audioCambiado: true })} />
            <div class="campo"><label for="nov-fuente">De dónde sale <span class="secundario">(opcional)</span></label>
              <input id="nov-fuente" class="entrada" maxLength={200} value={f.fuente} placeholder="Apellido et al., Revista, 2026" onInput={(e) => setF({ ...f, fuente: e.currentTarget.value })} /></div>
            <div class="campo"><label for="nov-enlace">Enlace <span class="secundario">(opcional)</span></label>
              <input id="nov-enlace" class="entrada" type="url" inputMode="url" maxLength={300} value={f.enlace} placeholder="https://pubmed.ncbi.nlm.nih.gov/…" onInput={(e) => setF({ ...f, enlace: e.currentTarget.value })} /></div>
            <label class="interruptor-fila panel panel-pad"><span class="pila-xs"><strong>Publicada</strong><span class="mini secundario">Sin publicar se queda como borrador: tus atletas no la ven.</span></span>
              <input type="checkbox" role="switch" class="interruptor" checked={f.publicada} onChange={(e) => setF({ ...f, publicada: e.currentTarget.checked })} /></label>
            <button type="submit" class="btn btn-primario" disabled={guardando}>{f.publicada ? 'Guardar y publicar' : 'Guardar borrador'}</button>
            {f.id && <button type="button" class="btn" onClick={() => setMandar({ titulo: f.titulo, texto: f.texto, de: '' })}><Icono n="enviar" /> Mandar a un atleta</button>}
            {f.id && <button type="button" class="btn-texto peligro" onClick={quitar}>{borrar ? '¿Seguro? Toca otra vez para borrarla' : pregunta ? 'Borrar esta pregunta' : suelto ? 'Borrar este apunte' : 'Borrar esta novedad'}</button>}
          </form>
        </Hoja>
      )}
      {mandar && <HojaMandarApunte apunte={mandar} alCerrar={() => setMandar(null)} />}
    </section>
  );
}

// (apuntes, tanda D) La audio-píldora de una novedad: grabarla (hasta 5 minutos) o subir un audio; se oye antes de guardar
export function GrabarAudio({ valor, alCambiar, max = 300, maxBytes = 5242880, etiqueta = 'Audio-píldora', ayuda = 'Tus atletas lo escuchan en el apunte, a 1× o 1,5×.' }) {
  const { aviso } = useApp();
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const rec = useRef(null);
  const url = useMemo(() => (valor?.blob ? URL.createObjectURL(valor.blob) : null), [valor?.blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { try { rec.current?.r.stop(); rec.current?.s.getTracks().forEach((t) => t.stop()); } catch { /* nada */ } }, []);
  const empezar = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s), trozos = [], t0 = Date.now();
      r.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data); };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        clearInterval(rec.current?.reloj);
        const blob = new Blob(trozos, { type: r.mimeType || 'audio/webm' });
        alCambiar({ blob, segundos: Math.max(1, Math.min(max, Math.round((Date.now() - t0) / 1000))) });
        setGrabando(false);
      };
      const reloj = setInterval(() => { const n = Math.round((Date.now() - t0) / 1000); setSeg(n); if (n >= max) r.stop(); }, 500);
      rec.current = { r, s, reloj };
      r.start(); setSeg(0); setGrabando(true);
    } catch { aviso('No se puede usar el micro: revisa el permiso del navegador', 'error'); }
  };
  const subir = (ev) => {
    const archivo = ev.currentTarget.files?.[0];
    if (!archivo) return;
    if (archivo.size > maxBytes) { aviso(`El audio no puede pasar de ${Math.round(maxBytes / 1048576)} MB`, 'error'); return; }
    const a = new Audio(URL.createObjectURL(archivo));
    a.onloadedmetadata = () => { const d = Math.round(a.duration || 0); if (!(d >= 1 && d <= max)) { aviso(`El audio tiene que durar entre 1 segundo y ${max >= 120 && max % 60 === 0 ? `${max / 60} minutos` : `${max} segundos`}`, 'error'); return; } alCambiar({ blob: archivo, segundos: d }); };
    a.onerror = () => aviso('Ese archivo no parece un audio', 'error');
  };
  const mmss = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return (
    <div class="campo audio-coach">
      <span class="etiqueta-campo">{etiqueta} <span class="secundario">(opcional, hasta {max % 60 === 0 ? `${max / 60} minutos` : `${max} segundos`})</span></span>
      {grabando ? (
        <div class="fila-s"><span class="audio-grabando num" role="status">● Grabando {mmss(seg)}</span><button type="button" class="btn btn-peq" onClick={() => rec.current?.r.stop()}>Parar</button></div>
      ) : valor ? (
        <div class="fila-s audio-coach-hay">
          {url ? <audio src={url} controls preload="metadata" /> : <span class="peq">Audio guardado ({mmss(valor.segundos || 0)})</span>}
          <button type="button" class="btn-texto peligro" onClick={() => alCambiar(null)}>Quitar</button>
        </div>
      ) : (
        <div class="fila-s">
          {typeof MediaRecorder !== 'undefined' && <button type="button" class="btn btn-peq" onClick={empezar}><Icono n="micro" />Grabar</button>}
          <label class="btn btn-peq audio-subir"><Icono n="arriba" />Subir un audio<input type="file" accept="audio/*" onChange={subir} /></label>
        </div>
      )}
      <span class="mini secundario">{ayuda}</span>
    </div>
  );
}

// (apuntes, tanda D, coach) Cómo va el equipo en apuntes: quién participa cada semana y el dominio por tema. Solo cuentas.
export function EquipoApuntesCoach() {
  const { api, backend } = useApp();
  const part = useCarga(() => (api.participacionApuntes ? api.participacionApuntes() : Promise.resolve(null)), []);
  const dom = useCarga(() => (api.dominioEquipoApuntes ? api.dominioEquipoApuntes() : Promise.resolve(null)), []);
  const guias = useCarga(() => guiasConTexto({ backend }).catch(() => []), [], { recuerdo: 'apuntes-guias' });
  const nov = useCarga(() => api.novedades().catch(() => []), []);
  const semanas = part.datos || [];
  const todos = useMemo(() => [...apuntesDeGuias(guias.datos || []), ...apuntesDeGlosario(), ...apuntesDeDudas(FAQ), ...apuntesDeNovedades(nov.datos || [])], [guias.datos, nov.datos]);
  const d = dom.datos ? dominioEquipo(dom.datos, todos) : null;
  if (!semanas.some((x) => x.atletas > 0) && !d?.temas.length) return null;
  const max = Math.max(1, ...semanas.map((x) => x.activos || x.atletas));
  return (
    <section class="equipo-apuntes pila-s" aria-label="El equipo en apuntes">
      <div class="novedades-cab"><h2>El equipo en apuntes</h2></div>
      <p class="peq secundario">Cuántos aprenden cada semana y cómo va cada tema. Solo cuentas: nunca quién.</p>
      {semanas.length > 0 && (
        <div class="panel panel-pad equipo-semanas" role="img" aria-label={`Esta semana, ${semanas[semanas.length - 1].atletas} de ${semanas[semanas.length - 1].activos} atletas`}>
          {semanas.map((x) => (
            <span key={x.semana} class="equipo-semana"><i style={{ height: `${Math.max(4, (x.atletas / max) * 100)}%` }} /><b class="num">{x.atletas}</b><small>{fmtCorta(x.semana)}</small></span>
          ))}
        </div>
      )}
      {d?.temas.length > 0 && (
        <div class="panel panel-pad pila-s">
          {d.temas.map((t) => (
            <div key={t.tema} class="equipo-tema">
              <span class="prog-tema-cab"><strong>{t.nombre}</strong><span class="mini secundario num">caja media {String(t.cajaMedia).replace('.', ',')} · {t.pctDominio} % dominado</span></span>
              <span class="prog-barra"><i class="d" style={{ width: `${t.pctDominio}%` }} /></span>
            </div>
          ))}
          {d.flojo && <p class="peq">Conviene publicar sobre <strong>{nombreTema(d.flojo.tema)}</strong>: es lo que menos se queda.</p>}
        </div>
      )}
    </section>
  );
}

export function GuiasCoach() {
  const { backend, aviso } = useApp();
  const [abierta, setAbierta] = useState(null);
  const [n, setN] = useState(0);
  const enlaces = useCarga(() => enlacesFichas({ backend }).catch(() => null), [n]);
  const guias = useCarga(() => listaGuias({ backend }), [n]);
  const cuantos = enlaces.datos ? Object.keys(enlaces.datos).length : 0;
  const cambiar = async (g, si) => { try { await publicarGuia({ backend }, g.id, si); aviso(si ? 'Publicada: ya la ven tus atletas' : 'Escondida: tus atletas ya no la ven'); setN(n + 1); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <div class="pila">
      <NovedadesCoach />
      <FalladosCoach />
      <EquipoApuntesCoach />
      <p class="peq secundario">Tus guías. Tus atletas las leen en «Aprende», y cada ejercicio de la biblioteca enlazado a una ficha la enseña en su pestaña «Técnica»{enlaces.datos ? ` (ahora, ${cuantos === 1 ? '1 ejercicio enlazado' : `${cuantos} ejercicios enlazados`}; se enlazan al editar cada ejercicio)` : ''}.</p>
      <ListaGuias key={n} alAbrir={(g, seccion = null) => setAbierta({ ...g, seccion })} esCoach />
      {abierta && (
        <Hoja titulo={abierta.titulo} alCerrar={() => setAbierta(null)} ancho>
          <label class="interruptor-fila panel panel-pad"><span class="pila-xs"><strong>Publicada</strong><span class="mini secundario">Sin publicar, tus atletas no la ven ni ven sus fichas en los ejercicios.</span></span>
            <input type="checkbox" role="switch" class="interruptor" checked={(guias.datos || []).find((g) => g.id === abierta.id)?.publicada ?? abierta.publicada} onChange={(e) => cambiar(abierta, e.currentTarget.checked)} /></label>
          <LectorGuia clave={abierta.clave} seccionInicial={abierta.seccion ?? null} />
        </Hoja>
      )}
    </div>
  );
}

// (coach) En el editor de un ejercicio: qué ficha de técnica lleva. Las que más se parecen a su nombre, primero.
export function ElegirFicha({ ejercicio }) {
  const { backend, aviso } = useApp();
  const fichas = useCarga(() => todasLasFichas({ backend }).catch(() => []), []);
  const enlaces = useCarga(() => enlacesFichas({ backend }).catch(() => null), []);
  const [ver, setVer] = useState(null);
  if (!fichas.datos?.length || !enlaces.datos) return null;   // sin guías (o sin la migración), no se ofrece
  const actual = enlaces.datos[ejercicio.id] || '';
  const parecidas = fichasParecidas(fichas.datos, ejercicio.nombre).slice(0, 5);
  const cambiar = async (id) => {
    try { await enlazarFicha({ backend }, ejercicio.id, id || null); aviso(id ? 'Ficha enlazada: sus atletas la ven en «Técnica»' : 'Ficha quitada'); enlaces.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  };
  const etiqueta = (f) => `${f.nombre} (${f.guia_titulo})`;
  return (
    <div class="campo">
      <label for="ej-ficha">Ficha de técnica <span class="terciario">(de tus guías)</span></label>
      <select id="ej-ficha" class="selector" value={actual} onChange={(e) => cambiar(e.currentTarget.value)}>
        <option value="">Sin ficha</option>
        <optgroup label="Las que más se parecen">{parecidas.map((f) => <option key={`p-${f.id}`} value={f.id}>{etiqueta(f)}</option>)}</optgroup>
        <optgroup label="Todas">{fichas.datos.filter((f) => !parecidas.includes(f)).map((f) => <option key={f.id} value={f.id}>{etiqueta(f)}</option>)}</optgroup>
      </select>
      <span class="ayuda">Con ficha, el atleta ve en la pestaña «Técnica» del ejercicio cómo ejecutarlo, los errores típicos, las variaciones y cuándo lo prescribes.
        {actual && <> <button type="button" class="btn-texto" onClick={async () => setVer((await backend.select('fichas_ejercicio', { eq: { id: actual } }).catch(() => []))[0] || null)}>Ver la ficha</button></>}</span>
      {ver && <HojaFichaGuia ficha={ver} alCerrar={() => setVer(null)} />}
    </div>
  );
}

// La pantalla «Aprende» del atleta: las guías y, al abrir una, su lector (con «volver»)
export function Aprende() {
  const [abierta, setAbierta] = useState(null);
  const volver = () => { setAbierta(null); window.scrollTo?.(0, 0); };
  return (
    <div class="contenido">
      <CabeceraGrande>
        {abierta ? (
          <div class="titulo"><h1>{abierta.titulo}</h1>{abierta.subtitulo && <div class="sub">{abierta.subtitulo}</div>}</div>
        ) : <div class="titulo"><h1>Aprende</h1><div class="sub">Las guías de tu coach, para leer y para buscar</div></div>}
      </CabeceraGrande>
      {/* «volver», arriba y al final de la guía (la cabecera se encoge al bajar y una guía es larga) */}
      {abierta ? (
        <div class="pila">
          <button type="button" class="btn-texto volver-guias" onClick={volver}><Icono n="atras" /> Todas las guías</button>
          <LectorGuia key={abierta.clave} clave={abierta.clave} seccionInicial={abierta.seccion ?? null} />
          <button type="button" class="btn" style="justify-self:start" onClick={volver}><Icono n="atras" /> Volver a las guías</button>
        </div>
      ) : (
        <div class="pila">
          <ListaGuias alAbrir={(g, seccion = null) => { setAbierta({ ...g, seccion }); if (seccion == null) window.scrollTo?.(0, 0); }} />
          {/* (YouTube) los vídeos de tu coach: lo último de su canal y sus vídeos por tema */}
          <VideotecaAprende />
        </div>
      )}
    </div>
  );
}
