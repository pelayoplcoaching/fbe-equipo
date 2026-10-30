import { useEffect, useRef, useState } from 'preact/hooks';
import { useUnaVez, Pestanas, Siluetas, useApp, useCarga, Icono, Cargando, Hoja, Vacio, usePreferencia } from '../comunes.jsx';
import { BandaDemo } from '../App.jsx';
import { GRUPOS, NOMBRE_GRUPO, conPrincipal, TIPOS_EJERCICIO, CATEGORIAS_RECURSO, NOMBRE_CATEGORIA } from '../../logica/calculos.js';
import { FAQ } from '../../datos/faq.js';
import { RecetasBiblioteca } from './ComidasCoach.jsx';

const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function Biblioteca({ peticion = null } = {}) {
  const [vista, setVista] = useState(peticion?.vista || 'ejercicios');
  useEffect(() => { if (peticion) setVista(peticion.vista || 'ejercicios'); }, [peticion?.id]);
  return (
    <div class="contenido coach">
      <header class="cabecera">
        <div class="titulo"><h1>Biblioteca</h1><div class="sub">{vista === 'ejercicios' ? 'Ejercicios, técnica y alternativas' : vista === 'recetas' ? 'Tus recetas, con su foto, macros e ingredientes' : 'Guías, enlaces y preguntas frecuentes para tus atletas'}</div></div>
      </header>
      <BandaDemo />
      <Pestanas opciones={[['ejercicios', 'Ejercicios'], ['recetas', 'Recetas'], ['recursos', 'Recursos']]} valor={vista} alCambiar={setVista} etiqueta="Biblioteca" idBase="bib" />
      <div class="pestana-panel" role="tabpanel" id="bib-panel" aria-labelledby={`bib-${vista}`} key={vista}>
        {vista === 'ejercicios' ? <Ejercicios peticion={peticion} /> : vista === 'recetas' ? <RecetasBiblioteca /> : <Recursos />}
      </div>
    </div>
  );
}

function Ejercicios({ peticion = null }) {
  const { api } = useApp();
  const lista = useCarga(() => api.biblioteca(), []);
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState(null);
  const [editar, setEditar] = useState(null);
  const todos = lista.datos || [];
  const porId = Object.fromEntries(todos.map((e) => [e.id, e]));
  // La búsqueda rápida puede pedir abrir un ejercicio (o uno nuevo) en cuanto llegue la lista
  const atendida = useRef(null);
  useEffect(() => {
    if (!peticion?.ejercicioId || atendida.current === peticion.id || !lista.datos) return;
    atendida.current = peticion.id;
    if (peticion.ejercicioId === 'nuevo') setEditar({});
    else if (porId[peticion.ejercicioId]) setEditar(porId[peticion.ejercicioId]);
  }, [peticion?.id, lista.datos]);
  const vista = todos.filter((e) => (!grupo || e.grupos_musculares?.[0] === grupo) && (!q || normal(e.nombre).includes(normal(q))));
  return (
    <>
      <div class="separa">
        <div class="buscador" style="flex:1"><Icono n="buscar" /><input class="entrada" type="search" aria-label="Buscar ejercicio" placeholder={`Buscar en ${todos.length} ejercicios`} value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
        <button class="btn btn-primario" onClick={() => setEditar({})}><Icono n="mas" /><span class="solo-ancho">Nuevo ejercicio</span><span class="sr">Nuevo ejercicio</span></button>
      </div>
      <div class="selector-chips" role="group" aria-label="Grupo muscular principal">
        <button aria-pressed={!grupo ? 'true' : 'false'} onClick={() => setGrupo(null)}>Todos</button>
        {GRUPOS.map(([g, n]) => <button key={g} aria-pressed={grupo === g ? 'true' : 'false'} onClick={() => setGrupo(g)}>{n}</button>)}
      </div>
      {lista.cargando && !lista.datos ? <Siluetas forma="lista" n={8} texto="Cargando la biblioteca" /> : (
        <div class="panel"><ul class="lista">
          {vista.map((e) => (
            <li key={e.id}>
              <button class="dia" style="background:none;border-radius:0;grid-template-columns:1fr auto" onClick={() => setEditar(e)}>
                <span>
                  <span class="nombre" style={e.activo === false ? 'color:var(--tinta-3)' : ''}>{e.nombre}{e.activo === false ? ' (oculto)' : ''}</span><br />
                  <span class="detalle">{(e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ') || 'Sin grupo'}{(e.alternativas || []).length ? `; ${e.alternativas.length} alternativa${e.alternativas.length > 1 ? 's' : ''}` : ''}</span>
                </span>
                {e.video_url ? <Icono n="video" width="20" height="20" titulo="Tiene vídeo" /> : <span />}
              </button>
            </li>
          ))}
          {!vista.length && <li class="panel-pad secundario">Ningún ejercicio coincide.</li>}
        </ul></div>
      )}
      {editar && <EditarEjercicio ejercicio={editar} todos={todos} porId={porId} alCerrar={(cambio) => { setEditar(null); if (cambio) lista.recargar(true); }} />}
    </>
  );
}

function EditarEjercicio({ ejercicio, todos, porId, alCerrar }) {
  const { api, aviso } = useApp();
  const nuevo = !ejercicio.id;
  const [f, setF] = useState({
    nombre: ejercicio.nombre || '', grupos: ejercicio.grupos_musculares || [], tipo: ejercicio.tipo || [], rango_reps: ejercicio.rango_reps || '',
    video_url: ejercicio.video_url || '', instrucciones: ejercicio.instrucciones || '', errores: ejercicio.errores || '',
    alternativas: (ejercicio.alternativas || []).filter((id) => porId[id]), activo: ejercicio.activo !== false,
  });
  const [buscar, setBuscar] = useState('');
  const alternar = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const candidatos = buscar.trim() ? todos.filter((e) => e.id !== ejercicio.id && !f.alternativas.includes(e.id) && normal(e.nombre).includes(normal(buscar))).slice(0, 8) : [];
  const [ocupado, una] = useUnaVez();
  function guardar(e) { e.preventDefault(); una(guardarYa); }
  async function guardarYa() {
    const fila = {
      nombre: f.nombre.trim(), grupos_musculares: f.grupos, tipo: f.tipo, rango_reps: f.rango_reps.trim() || null,
      video_url: f.video_url.trim() || null, instrucciones: f.instrucciones.trim() || null, errores: f.errores.trim() || null,
      alternativas: f.alternativas, activo: f.activo,
    };
    try {
      if (nuevo) await api.crear('ejercicios', fila); else await api.actualizar('ejercicios', ejercicio.id, fila);
      aviso(nuevo ? 'Ejercicio creado' : 'Ejercicio guardado'); alCerrar(true);
    } catch (err) { aviso(err.message, 'error'); }
  }
  return (
    <Hoja titulo={nuevo ? 'Nuevo ejercicio' : 'Editar ejercicio'} alCerrar={() => alCerrar(false)} ancho={680}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="ej-nombre">Nombre</label><input id="ej-nombre" class="entrada" required value={f.nombre} onInput={(e) => setF({ ...f, nombre: e.currentTarget.value })} /></div>
        <div class="campo">
          <span class="etq">Grupos musculares</span>
          <span class="ayuda">El principal cuenta 1 serie; el resto, media. El primero que marques es el principal; lo cambias abajo.</span>
          <div class="fila-envolver">
            {GRUPOS.map(([g, n]) => {
              const i = f.grupos.indexOf(g);
              return <button type="button" key={g} class={`chip ${i === 0 ? 'morado' : ''}`} style="min-height:36px;cursor:pointer" aria-pressed={i >= 0 ? 'true' : 'false'} onClick={() => alternar('grupos', g)}>{i >= 0 && <Icono n="hecho" />}{n}</button>;
            })}
          </div>
          {f.grupos.length > 1 && (
            <label class="fila" style="gap:8px;align-items:center;margin-top:6px">
              <span class="peq">Principal:</span>
              <select class="selector" aria-label="Grupo muscular principal" value={f.grupos[0]} onChange={(e) => setF({ ...f, grupos: conPrincipal(f.grupos, e.currentTarget.value) })}>
                {f.grupos.map((g) => <option key={g} value={g}>{NOMBRE_GRUPO[g]}</option>)}
              </select>
              <span class="mini terciario">cuenta 1 serie; {f.grupos.slice(1).map((g) => NOMBRE_GRUPO[g]).join(', ')}, media</span>
            </label>
          )}
        </div>
        <div class="rejilla-campos">
          <div class="campo">
            <span class="etq">Tipo</span>
            <div class="fila-envolver">
              {TIPOS_EJERCICIO.map(([t, n]) => <button type="button" key={t} class="chip" style="min-height:36px;cursor:pointer" aria-pressed={f.tipo.includes(t) ? 'true' : 'false'} onClick={() => alternar('tipo', t)}>{f.tipo.includes(t) && <Icono n="hecho" />}{n}</button>)}
            </div>
            <span class="ayuda">En los básicos, el atleta ve las series de aproximación.</span>
          </div>
          <div class="campo"><label for="ej-rango">Rango recomendado</label><input id="ej-rango" class="entrada" value={f.rango_reps} placeholder="Fuerza 1–5, hipertrofia 6–12" onInput={(e) => setF({ ...f, rango_reps: e.currentTarget.value })} /></div>
        </div>
        <div class="campo">
          <span class="etq">Alternativas equivalentes</span>
          <span class="ayuda">Las que el atleta puede elegir con «Cambiar» si la máquina está ocupada.</span>
          {f.alternativas.length > 0 && (
            <div class="fila-envolver">
              {f.alternativas.map((id) => <button type="button" key={id} class="chip morado" style="min-height:34px;cursor:pointer" onClick={() => alternar('alternativas', id)} aria-label={`Quitar ${porId[id]?.nombre}`}>{porId[id]?.nombre}<Icono n="cerrar" /></button>)}
            </div>
          )}
          <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" aria-label="Buscar una alternativa" placeholder="Añadir alternativa" value={buscar} onInput={(e) => setBuscar(e.currentTarget.value)} /></div>
          {candidatos.length > 0 && (
            <div class="lista-elegir">
              {candidatos.map((e) => (
                <button type="button" key={e.id} onClick={() => { alternar('alternativas', e.id); setBuscar(''); }}>
                  <span style="font-weight:600">{e.nombre}</span><span class="mini terciario">{(e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div class="campo"><label for="ej-video">Vídeo</label><input id="ej-video" class="entrada" type="url" value={f.video_url} onInput={(e) => setF({ ...f, video_url: e.currentTarget.value })} placeholder="https://youtube.com/…" /></div>
        <div class="campo"><label for="ej-inst">Claves de la técnica</label><textarea id="ej-inst" class="area" style="min-height:140px" value={f.instrucciones} onInput={(e) => setF({ ...f, instrucciones: e.currentTarget.value })} /></div>
        <div class="campo"><label for="ej-err">Errores comunes</label><textarea id="ej-err" class="area" style="min-height:100px" value={f.errores} onInput={(e) => setF({ ...f, errores: e.currentTarget.value })} /></div>
        {!nuevo && <label class="casilla"><input type="checkbox" checked={!f.activo} onChange={(e) => setF({ ...f, activo: !e.currentTarget.checked })} /><span>Ocultar al elegir ejercicios (se mantiene en los programas que ya lo usan)</span></label>}
        <button class="btn btn-primario btn-grande" disabled={ocupado}>Guardar</button>
      </form>
    </Hoja>
  );
}

// Recursos para los atletas: guías, enlaces y preguntas frecuentes (para todos o para uno en concreto)
function Recursos() {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.recursos(), []);
  const atletas = useCarga(() => api.atletas(), []);
  const [editar, setEditar] = useState(null);
  const [cargando, setCargando] = useState(false);
  const todos = lista.datos || [];
  const nombreAtleta = (id) => (atletas.datos || []).find((a) => a.id === id)?.nombre;
  const hayFaq = todos.some((r) => r.categoria === 'faq');
  // Las de la app que aún no tiene (al actualizar la app llegan preguntas nuevas: se ofrecen sin tocar las suyas)
  const [descartadas, setDescartadas] = usePreferencia('fbe-faq-descartadas', []);
  const faltan = FAQ.map((x, i) => [...x, i]).filter(([t]) => !todos.some((r) => r.categoria === 'faq' && r.titulo === t) && !(hayFaq && descartadas.includes(t)));
  return (
    <>
      <div class="separa" style="flex-wrap:wrap">
        <p class="peq secundario" style="flex:1;min-width:220px">Tus atletas los ven en su Perfil, en «Guías y recursos». Sustituyen a las páginas de FAQ y recursos de Notion.</p>
        <button class="btn btn-primario" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo recurso</button>
      </div>
      {faltan.length > 0 && lista.datos && (
        <div class="panel panel-pad separa" style="flex-wrap:wrap">
          {!hayFaq
            ? <span class="peq" style="flex:1;min-width:220px"><strong>Preguntas frecuentes de la app.</strong> {FAQ.length} respuestas sobre cómo se usa: los colores de los discos, el RPE, cambiar un ejercicio, entrenar sin cobertura… Luego puedes editarlas.</span>
            : <span class="peq" style="flex:1;min-width:220px"><strong>{faltan.length === 1 ? 'Una pregunta frecuente nueva' : `${faltan.length} preguntas frecuentes nuevas`} de la app:</strong> {faltan.map(([t]) => `«${t}»`).join(', ')}. Las tuyas no cambian.</span>}
          <button class="btn btn-peq" disabled={cargando} onClick={async () => {
            setCargando(true);
            try { for (const [titulo, descripcion, i] of faltan) await api.crear('recursos', { titulo, descripcion, categoria: 'faq', orden: i + 1 }); lista.recargar(true); aviso(hayFaq ? 'Preguntas nuevas añadidas' : 'Preguntas frecuentes añadidas'); }
            catch (e) { aviso(e.message, 'error'); } finally { setCargando(false); }
          }}>{hayFaq ? 'Añadir' : 'Añadirlas'}</button>
          {hayFaq && <button class="btn btn-peq plano" onClick={() => setDescartadas([...descartadas, ...faltan.map(([t]) => t)])}>No, gracias</button>}
        </div>
      )}
      {lista.cargando && !lista.datos ? <Cargando /> : !todos.length ? <div class="panel"><Vacio icono="biblioteca" titulo="Sin recursos todavía">Una guía de alimentación, un enlace a un vídeo, cómo medir la cintura…</Vacio></div> : (
        CATEGORIAS_RECURSO.map(([c, t]) => [c, t, todos.filter((r) => r.categoria === c)]).filter(([, , xs]) => xs.length).map(([c, t, xs]) => (
          <section class="seccion" key={c}>
            <h2>{t}</h2>
            <div class="panel"><ul class="lista">
              {xs.map((r) => (
                <li key={r.id}>
                  <button class="respuesta" onClick={() => setEditar(r)}>
                    <span><span class="nombre">{r.titulo}</span>{r.atleta_id && <span class="chip morado">Solo {nombreAtleta(r.atleta_id)?.split(' ')[0] || 'un atleta'}</span>}<br /><span class="detalle">{r.url || (r.descripcion ? r.descripcion.slice(0, 110) + (r.descripcion.length > 110 ? '…' : '') : '')}</span></span>
                    <Icono n="editar" />
                  </button>
                </li>
              ))}
            </ul></div>
          </section>
        ))
      )}
      {editar && <EditarRecurso recurso={editar} atletas={atletas.datos || []} alCerrar={(cambio) => { setEditar(null); if (cambio) lista.recargar(true); }} />}
    </>
  );
}

function EditarRecurso({ recurso, atletas, alCerrar }) {
  const { api, aviso } = useApp();
  const nuevo = !recurso.id;
  const [f, setF] = useState({ titulo: recurso.titulo || '', categoria: recurso.categoria || 'general', descripcion: recurso.descripcion || '', url: recurso.url || '', atleta_id: recurso.atleta_id || '', orden: recurso.orden ?? 0 });
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const [ocupado, una] = useUnaVez();
  function guardar(e) { e.preventDefault(); una(guardarYa); }
  async function guardarYa() {
    const fila = { titulo: f.titulo.trim(), categoria: f.categoria, descripcion: f.descripcion.trim() || null, url: f.url.trim() || null, atleta_id: f.atleta_id || null, orden: Number(f.orden) || 0 };
    try { if (nuevo) await api.crear('recursos', fila); else await api.actualizar('recursos', recurso.id, fila); aviso('Recurso guardado'); alCerrar(true); }
    catch (err) { aviso(err.message, 'error'); }
  }
  return (
    <Hoja titulo={nuevo ? 'Nuevo recurso' : 'Editar recurso'} alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="rc-titulo">{f.categoria === 'faq' ? 'Pregunta' : 'Título'}</label><input id="rc-titulo" class="entrada" required value={f.titulo} onInput={cambiar('titulo')} /></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="rc-cat">Categoría</label>
            <select id="rc-cat" class="selector" value={f.categoria} onChange={cambiar('categoria')}>{CATEGORIAS_RECURSO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div class="campo"><label for="rc-at">Para</label>
            <select id="rc-at" class="selector" value={f.atleta_id} onChange={cambiar('atleta_id')}>
              <option value="">Todos los atletas</option>
              {atletas.filter((a) => a.estado !== 'baja').map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select></div>
        </div>
        <div class="campo"><label for="rc-desc">{f.categoria === 'faq' ? 'Respuesta' : 'Descripción'}</label><textarea id="rc-desc" class="area" value={f.descripcion} onInput={cambiar('descripcion')} /></div>
        <div class="campo"><label for="rc-url">Enlace (opcional)</label><input id="rc-url" class="entrada" type="url" value={f.url} onInput={cambiar('url')} placeholder="https://… (un PDF, un vídeo, tu página de Notion)" /></div>
        <div class="campo"><label for="rc-orden">Orden dentro de su categoría</label><input id="rc-orden" class="entrada" inputMode="numeric" value={f.orden} onInput={cambiar('orden')} /></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}>Guardar</button>
        {!nuevo && <button type="button" class="btn btn-peligro" onClick={async () => { await api.borrar('recursos', recurso.id); aviso('Recurso borrado'); alCerrar(true); }}><Icono n="basura" /> Borrar</button>}
      </form>
    </Hoja>
  );
}

export { NOMBRE_CATEGORIA };
