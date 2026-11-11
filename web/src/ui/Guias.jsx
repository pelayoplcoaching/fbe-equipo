// «Aprende» (migración 057): las guías del coach por grupo muscular y la ficha de técnica de cada ejercicio. Aquí, lo
// que se pinta: el texto con su negrita, los bloques de una sección, la ficha (pasos, errores, niveles, cuándo sí y
// cuándo no, y la tabla por objetivo), el lector de una guía y la pantalla con todas. Todo es texto: nunca HTML.
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Vacio, Siluetas, ErrorCaja, CabeceraGrande } from './comunes.jsx';
import { hoyISO } from '../logica/fechas.js';
import { Imagen, hayImagen } from './Imagen.jsx';
import { imagenGuia } from '../logica/imagenes.js';
import { trozos, guiaParaLeer, fichaParaLeer, ordenarGuias, buscarFichas, cuantosEjercicios, fichasParecidas, erroresDeFicha, resumenTabla, avisosMolestia, NOMBRE_ZONA, tipoDeRutina, fichaConContenido, porEstantes, estanteDe, buscarEnGuias, mitosDeGuia, mitoDeLaSemana, numeroDeSemana, OCASIONES } from '../logica/guias.js';
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
        b.t === 'p' ? <p key={i}><Rico x={b.x} /></p>
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
      {/* (imágenes, tanda U) la estatua de su grupo o, si no tiene, la ilustración de su estantería; sin imagen, su icono */}
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
        <button type="button" class="panel panel-pad mito-semana" onClick={() => setAbierto(true)} aria-haspopup="dialog">
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
      ) : <ListaGuias alAbrir={(g, seccion = null) => { setAbierta({ ...g, seccion }); if (seccion == null) window.scrollTo?.(0, 0); }} />}
    </div>
  );
}
