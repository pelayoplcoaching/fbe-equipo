// «Aprende» (migración 057): las guías del coach por grupo muscular y la ficha de técnica de cada ejercicio. Aquí, lo
// que se pinta: el texto con su negrita, los bloques de una sección, la ficha (pasos, errores, niveles, cuándo sí y
// cuándo no, y la tabla por objetivo), el lector de una guía y la pantalla con todas. Todo es texto: nunca HTML.
import { useState, useMemo, useRef } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Vacio, Siluetas, ErrorCaja, CabeceraGrande } from './comunes.jsx';
import { Imagen, hayImagen } from './Imagen.jsx';
import { imagenGrupo } from '../logica/imagenes.js';
import { trozos, guiaParaLeer, fichaParaLeer, ordenarGuias, buscarFichas, cuantosEjercicios, fichasParecidas } from '../logica/guias.js';
import { listaGuias, guiaEntera, todasLasFichas, enlacesFichas, enlazarFicha, publicarGuia } from '../datos/guias.js';

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
            : b.t === 'ul' ? <ul key={i} class="guia-lista">{b.xs.map((x, k) => <li key={k}><Rico x={x} /></li>)}</ul>
              : b.t === 'ol' ? <ol key={i} class="guia-lista guia-num">{b.xs.map((x, k) => <li key={k}><Rico x={x} /></li>)}</ol>
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
export function LectorGuia({ clave }) {
  const { backend, api } = useApp();
  const d = useCarga(() => guiaEntera({ backend }, clave), [clave], { recuerdo: `guia:${api.uid()}:${clave}` });
  const [ficha, setFicha] = useState(null);
  const raiz = useRef(null);
  const g = useMemo(() => (d.datos ? guiaParaLeer(d.datos.guia, d.datos.fichas) : null), [d.datos]);
  if (!d.datos) return d.error ? <ErrorCaja error={d.error} reintentar={() => d.recargar(true)} /> : d.cargando ? <Siluetas forma="tarjetas" n={3} texto="Cargando la guía" /> : <div class="panel"><Vacio icono="biblioteca" titulo="Esa guía ya no está" /></div>;
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
export function HojaGuia({ guia, alCerrar }) {
  return <Hoja titulo={guia.titulo} alCerrar={alCerrar} ancho><LectorGuia clave={guia.clave} /></Hoja>;
}

// Todas las guías: sus tarjetas y un buscador de ejercicios. alAbrir(guia) abre una
export function ListaGuias({ alAbrir, esCoach = false }) {
  const { backend, api } = useApp();
  const guias = useCarga(() => listaGuias({ backend }), [], { recuerdo: `guias:${api.uid()}` });
  const fichas = useCarga(() => todasLasFichas({ backend }, { conFicha: true }).catch(() => []), [], { recuerdo: `fichas-guias:${api.uid()}` });
  const [q, setQ] = useState('');
  const [ficha, setFicha] = useState(null);
  const gs = ordenarGuias(guias.datos || []).filter((g) => esCoach || g.publicada);
  const halladas = q.trim() ? buscarFichas(fichas.datos || [], q) : [];
  if (!guias.datos) return guias.error ? <ErrorCaja error={guias.error} reintentar={() => guias.recargar(true)} /> : <Siluetas forma="tarjetas" n={4} texto="Cargando las guías" />;
  if (!gs.length) return <div class="panel"><Vacio icono="biblioteca" titulo="Aún no hay guías">{esCoach ? 'Cuando cargues tus guías, tus atletas las leerán en «Aprende» y cada ejercicio enlazado enseñará su ficha de técnica.' : 'Cuando tu coach publique sus guías, las leerás aquí.'}</Vacio></div>;
  return (
    <div class="pila aprende">
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" maxLength={60} value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Buscar un ejercicio" aria-label="Buscar un ejercicio en las guías" /></div>
      {q.trim() ? (
        halladas.length ? <div class="panel"><ul class="lista">{halladas.slice(0, 30).map((f) => <FilaFicha key={f.id} f={f} guia alAbrir={setFicha} />)}</ul></div>
          : <div class="panel"><Vacio icono="buscar" titulo="Ningún ejercicio con eso">Prueba con otra palabra.</Vacio></div>
      ) : (
        <div class="rejilla-guias">
          {gs.map((g) => (
            <button type="button" class="tarjeta-guia" key={g.id} onClick={() => alAbrir(g)}>
              {hayImagen(imagenGrupo(g.grupo)) ? <Imagen id={imagenGrupo(g.grupo)} clase="tarjeta-guia-img" tamanos="9rem" /> : <span class="tarjeta-guia-img vacia" aria-hidden="true"><Icono n="biblioteca" /></span>}
              <span class="pila-xs tarjeta-guia-texto"><strong>{g.titulo}</strong>{g.subtitulo && <span class="mini terciario">{g.subtitulo}</span>}
                <span class="fila-chips"><span class="chip">{cuantosEjercicios(g.fichas)}</span>{esCoach && !g.publicada && <span class="chip aviso">Sin publicar</span>}</span></span>
            </button>
          ))}
        </div>
      )}
      {ficha && <HojaFichaGuia ficha={ficha} alCerrar={() => setFicha(null)} />}
    </div>
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
      <p class="peq secundario">Tus guías por grupo muscular. Tus atletas las leen en «Aprende», y cada ejercicio de la biblioteca enlazado a una ficha la enseña en su pestaña «Técnica»{enlaces.datos ? ` (ahora, ${cuantos === 1 ? '1 ejercicio enlazado' : `${cuantos} ejercicios enlazados`}; se enlazan al editar cada ejercicio)` : ''}.</p>
      <ListaGuias key={n} alAbrir={setAbierta} esCoach />
      {abierta && (
        <Hoja titulo={abierta.titulo} alCerrar={() => setAbierta(null)} ancho>
          <label class="interruptor-fila panel panel-pad"><span class="pila-xs"><strong>Publicada</strong><span class="mini secundario">Sin publicar, tus atletas no la ven ni ven sus fichas en los ejercicios.</span></span>
            <input type="checkbox" role="switch" class="interruptor" checked={(guias.datos || []).find((g) => g.id === abierta.id)?.publicada ?? abierta.publicada} onChange={(e) => cambiar(abierta, e.currentTarget.checked)} /></label>
          <LectorGuia clave={abierta.clave} />
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
        ) : <div class="titulo"><h1>Aprende</h1><div class="sub">Las guías de tu coach, ejercicio a ejercicio</div></div>}
      </CabeceraGrande>
      {/* «volver», arriba y al final de la guía (la cabecera se encoge al bajar y una guía es larga) */}
      {abierta ? (
        <div class="pila">
          <button type="button" class="btn-texto volver-guias" onClick={volver}><Icono n="atras" /> Todas las guías</button>
          <LectorGuia key={abierta.clave} clave={abierta.clave} />
          <button type="button" class="btn" style="justify-self:start" onClick={volver}><Icono n="atras" /> Volver a las guías</button>
        </div>
      ) : <ListaGuias alAbrir={(g) => { setAbierta(g); window.scrollTo?.(0, 0); }} />}
    </div>
  );
}
