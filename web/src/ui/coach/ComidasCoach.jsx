// Comidas del coach (v0.26): tu recetario (Biblioteca → Recetas), el recetario de cada atleta y su menú
// (ficha → Nutrición). Una receta se escribe una vez y se asigna a quien quieras, en las comidas que quieras y
// con un factor (×1,5 = una vez y media las cantidades y los macros), en vez de copiar bases de datos en Notion.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Paso, Siluetas, ErrorCaja, Pestanas, usePreferencia, cuando, Segmentos } from '../comunes.jsx';
import { recortarImagen } from '../FotoPerfil.jsx';
import { NutricionCoach } from './NutricionCoach.jsx';
import { FotoReceta, VistaRecetario, HojaReceta, MenuSemana, HojaTusComidas } from '../ComidasComun.jsx';
import { TOMAS, NOMBRE_TOMA, ordenarTomas, ETIQUETAS_SUGERIDAS, leerIngredientes, ingredientesATexto, textoIngrediente, textoMacros, macrosDe, avisoMacros, limpiarReceta } from '../../logica/comidas.js';
import { kcalDeMacros } from '../../logica/nutricion.js';
import { conNutricion } from '../../logica/nivel.js';
import { num } from '../../logica/calculos.js';

const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Fotos de las recetas: la grande (800 × 600) y la miniatura de las listas (240 × 180), como las admite la base
const FOTO = { ancho: 800, alto: 600, max: 250000 };
const MINI = { ancho: 240, alto: 180, max: 40000 };

// Ficha → Nutrición: el plan (lo de siempre), su recetario y su menú
export function NutricionFicha({ atleta }) {
  const [vista, setVista] = usePreferencia('fbe-ficha-nutricion', 'plan');
  return (
    <div class="pila">
      <Pestanas opciones={[['plan', 'Plan'], ['recetario', 'Recetario'], ['menu', 'Su menú']]} valor={vista} alCambiar={setVista} etiqueta="Nutrición" idBase="nut" clase="pestanas-sub" />
      <div class="pestana-panel" role="tabpanel" id="nut-panel" aria-labelledby={`nut-${vista}`} key={vista}>
        {vista === 'plan' && <NutricionCoach atleta={atleta} />}
        {vista === 'recetario' && <RecetarioCoach atleta={atleta} />}
        {vista === 'menu' && <MenuCoach atleta={atleta} />}
      </div>
    </div>
  );
}

// Su recetario: lo que le has puesto en cada comida, las peticiones de cambio y añadir recetas de tu biblioteca
function RecetarioCoach({ atleta }) {
  const { api, aviso } = useApp();
  const recetario = useCarga(() => api.recetario(atleta.id), [atleta.id]);
  const [hoja, setHoja] = useState(null); // 'anadir' | 'comidas' | { editar } | { ver }
  const [ocupado, una] = useUnaVez();
  const r = recetario.datos;
  const recargar = () => recetario.recargar(true);
  if (recetario.error) return <ErrorCaja error={recetario.error} reintentar={recargar} />;
  if (!r) return <Siluetas forma="tarjetas" n={3} texto="Cargando su recetario" />;
  const pedidos = r.asignaciones.filter((a) => a.cambio_pedido_en).map((a) => ({ ...a, receta: r.recetas.find((x) => x.id === a.receta_id) })).filter((a) => a.receta);
  return (
    <div class="pila">
      <div class="panel panel-pad separa" style="flex-wrap:wrap">
        <span class="peq" style="flex:1;min-width:200px"><strong>{r.tomas.length} comidas al día:</strong> {r.tomas.map((t) => NOMBRE_TOMA[t]).join(', ')}{r.eligio ? '' : <span class="terciario"> (las de siempre: aún no las ha elegido)</span>}{r.opcional ? <span class="terciario">. Algunos días, sin {NOMBRE_TOMA[r.opcional].toLowerCase()}</span> : ''}</span>
        <span class="fila-envolver">
          <button class="btn btn-peq plano" onClick={() => setHoja('comidas')}>Cambiar</button>
          <button class="btn btn-peq btn-primario" onClick={() => setHoja('anadir')}><Icono n="mas" /> Añadir recetas</button>
        </span>
      </div>
      {pedidos.length > 0 && (
        <section class="panel" aria-labelledby="pedidos-cambio">
          <div class="panel-pad"><h2 id="pedidos-cambio" class="h-panel">Te pide cambiar {pedidos.length === 1 ? 'una receta' : `${pedidos.length} recetas`}</h2></div>
          <ul class="lista">
            {pedidos.map((a) => (
              <li key={a.id} class="panel-pad pila-xs">
                <span><strong>{a.receta.nombre}</strong> <span class="mini terciario">{NOMBRE_TOMA[a.toma]}, {cuando(a.cambio_pedido_en)}</span></span>
                {a.cambio_nota && <p class="cita">«{a.cambio_nota}»</p>}
                <span class="fila-envolver">
                  <button class="btn btn-peq" onClick={() => setHoja({ editar: a })}><Icono n="editar" /> Ajustar</button>
                  <button class="btn btn-peq plano" disabled={ocupado} onClick={() => una(async () => { try { await api.quitarReceta(a.id); aviso('Quitada de su recetario'); recargar(); } catch (e) { aviso(e.message, 'error'); } })}>Quitarla</button>
                  <button class="btn btn-peq revisar-hecho" disabled={ocupado} onClick={() => una(async () => { try { await api.resolverCambioReceta(a.id); aviso('Petición resuelta'); recargar(); } catch (e) { aviso(e.message, 'error'); } })}><Icono n="hecho" /> Resuelto</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <VistaRecetario recetario={r} esCoach alAbrir={(a) => setHoja({ editar: a })} vacio={(
        <div class="panel"><Vacio icono="receta" titulo="Sin recetas todavía" accion={<button class="btn btn-primario" onClick={() => setHoja('anadir')}><Icono n="mas" /> Añadir recetas</button>}>
          Elige de tu biblioteca las opciones para cada comida (las ve en su app, con sus cantidades). Si a él le tocan más o menos kcal, ajusta el factor.
        </Vacio></div>
      )} />
      {hoja === 'anadir' && <HojaAsignar atleta={atleta} recetario={r} alCerrar={() => setHoja(null)} alGuardado={recargar} />}
      {hoja === 'comidas' && <HojaTusComidas atletaId={atleta.id} tomas={r.tomas} opcional={r.opcional} esCoach alCerrar={() => setHoja(null)} alGuardado={recargar} />}
      {hoja?.editar && <HojaAsignacion a={hoja.editar} opcional={r.opcional} alCerrar={() => setHoja(null)} alCambiar={recargar} verReceta={() => setHoja({ ver: hoja.editar })} />}
      {hoja?.ver && <HojaReceta a={hoja.ver} esCoach opcional={r.opcional} alCerrar={() => setHoja(null)} />}
    </div>
  );
}

// Para qué días es una receta de su recetario, si algunos días no hace una comida (v0.27)
function SelectorVariante({ opcional, valor, alCambiar }) {
  const n = opcional ? NOMBRE_TOMA[opcional].toLowerCase() : 'la comida opcional';
  return (
    <div class="pila-xs"><span class="peq">Para qué días</span>
      <Segmentos etiqueta="Para qué días" clase="segmentos-dia" valor={valor || 'todos'} alCambiar={(v) => alCambiar(v && v !== 'todos' ? v : null)}
        opciones={[['todos', 'Todos'], ['con', `Con ${n}`], ['sin', `Sin ${n}`]]} />
      <span class="ayuda">{valor === 'sin' ? `Solo le sale los días que marca sin ${n} (suelen ser algo más grandes).` : valor === 'con' ? `Solo le sale los días con ${n}.` : 'Le sale todos los días.'}</span>
    </div>
  );
}

// Una receta en su recetario: el factor, tu nota, en qué comida va; quitarla
function HojaAsignacion({ a, opcional = null, alCerrar, alCambiar, verReceta }) {
  const { api, aviso } = useApp();
  const [factor, setFactor] = useState(Number(a.factor));
  const [variante, setVariante] = useState(a.variante || null);
  const [nota, setNota] = useState(a.nota || '');
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto) => una(async () => { try { await fn(); aviso(texto); alCambiar(); alCerrar(); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <Hoja titulo={a.receta.nombre} alCerrar={alCerrar}>
      <div class="separa"><FotoReceta receta={a.receta} /><span class="peq secundario" style="flex:1">{NOMBRE_TOMA[a.toma]}. Le salen <strong class="num">{textoMacros(macrosDe(a.receta, factor)) || 'sin macros'}</strong> por ración.</span></div>
      {a.cambio_pedido_en && <div class="nota-coach"><Icono n="intercambiar" /><div><strong>Te pide cambiarla</strong>{a.cambio_nota ? `: «${a.cambio_nota}»` : '.'}</div></div>}
      <div class="campo"><label for="asig-factor">Factor de las cantidades</label>
        <Paso id="asig-factor" valor={factor} paso={0.25} min={0.25} max={5} dec={2} etiqueta="factor" alCambiar={(v) => v && setFactor(v)} />
        <span class="ayuda">×1 es la receta tal cual; ×1,5, una vez y media los ingredientes y los macros.</span></div>
      <div class="campo"><label for="asig-nota">Nota para él <span class="terciario">(opcional)</span></label>
        <input id="asig-nota" class="entrada" maxLength={300} value={nota} onInput={(e) => setNota(e.currentTarget.value)} placeholder="Si no tienes pan, 40 g de avena" /></div>
      {(opcional || a.variante) && <SelectorVariante opcional={opcional} valor={variante} alCambiar={setVariante} />}
      {!opcional && a.variante && <p class="mini terciario">Ya no tiene comida opcional: déjala para «Todos» o quítala.</p>}
      <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={() => hacer(async () => { await api.cambiarAsignacion(a.id, opcional || a.variante ? { factor, nota, variante } : { factor, nota }); if (a.cambio_pedido_en) await api.resolverCambioReceta(a.id); }, a.cambio_pedido_en ? 'Ajustada y resuelta' : 'Guardado')}>Guardar{a.cambio_pedido_en ? ' y dar por resuelta' : ''}</button>
      <div class="fila-envolver">
        <button class="btn plano" onClick={verReceta}><Icono n="receta" /> Ver cómo la ve</button>
        <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.quitarReceta(a.id), 'Quitada de su recetario')}><Icono n="basura" /> Quitar de su recetario</button>
      </div>
    </Hoja>
  );
}

// Añadir recetas de la biblioteca a su recetario: buscar, marcar varias, en qué comida y con qué factor
function HojaAsignar({ atleta, recetario, alCerrar, alGuardado }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.recetas(), []);
  const [q, setQ] = useState('');
  const [elegidas, setElegidas] = useState([]);
  const [toma, setToma] = useState(null); // null = la primera toma de cada receta que encaje con sus comidas
  const [factor, setFactor] = useState(1);
  const [variante, setVariante] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [ocupado, una] = useUnaVez();
  const ya = new Set(recetario.asignaciones.map((a) => `${a.receta_id}|${a.toma}`));
  const todas = lista.datos || [];
  const vistas = todas.filter((r) => !q || normal(r.nombre).includes(normal(q)) || (r.etiquetas || []).some((e) => normal(e).includes(normal(q))));
  const tomaDe = (r) => toma || ordenarTomas(r.tomas).find((t) => recetario.tomas.includes(t)) || r.tomas[0] || recetario.tomas[0];
  const alternar = (id) => setElegidas(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  const guardar = () => una(async () => {
    try {
      let n = 0;
      for (const id of elegidas) n += (await api.asignarReceta(atleta.id, id, tomaDe(todas.find((r) => r.id === id)), { factor, variante: recetario.opcional ? variante : null })).length;
      aviso(!n ? 'Ya las tenía (no ha cambiado nada)' : n === 1 ? 'Receta añadida' : `${n} recetas añadidas`); alGuardado(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  if (nueva) return <EditarReceta receta={{}} alCerrar={(r) => { setNueva(false); if (r?.id) { lista.recargar(true); setElegidas([...elegidas, r.id]); } }} />;
  return (
    <Hoja titulo={`Recetas para ${atleta.nombre.split(' ')[0]}`} alCerrar={alCerrar} ancho>
      <div class="separa" style="flex-wrap:wrap">
        <input class="entrada" style="flex:1;min-width:180px" type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Buscar en tus recetas" aria-label="Buscar recetas" />
        <button class="btn btn-peq" onClick={() => setNueva(true)}><Icono n="mas" /> Nueva receta</button>
      </div>
      {lista.cargando && !lista.datos ? <Siluetas forma="lista" n={3} /> : !todas.length ? <p class="peq secundario">Aún no tienes recetas en tu biblioteca: crea la primera.</p> : (
        <div class="panel"><ul class="lista lista-alta">
          {vistas.map((r) => {
            const marcada = elegidas.includes(r.id);
            const esta = ya.has(`${r.id}|${tomaDe(r)}`);
            return (
              <li key={r.id}>
                <button type="button" class={`respuesta opcion-receta ${marcada ? 'elegida' : ''}`} aria-pressed={marcada ? 'true' : 'false'} onClick={() => alternar(r.id)}>
                  <FotoReceta receta={r} />
                  <span class="pila-xs" style="flex:1"><span class="nombre">{r.nombre}</span>
                    <span class="mini terciario num">{[r.tomas.map((t) => NOMBRE_TOMA[t]).join(', '), textoMacros(r, true)].filter(Boolean).join(' · ')}</span>
                    {esta && <span class="mini texto-ok">Ya la tiene en {NOMBRE_TOMA[tomaDe(r)].toLowerCase()}</span>}</span>
                  <span class={`casilla-redonda ${marcada ? 'marcada' : ''}`} aria-hidden="true">{marcada && <Icono n="hecho" />}</span>
                </button>
              </li>
            );
          })}
        </ul></div>
      )}
      {elegidas.length > 0 && (
        <div class="panel panel-pad pila-s sticky-abajo">
          <div class="campo"><label for="asig-toma">En qué comida</label>
            <select id="asig-toma" class="selector" value={toma || ''} onChange={(e) => setToma(e.currentTarget.value || null)}>
              <option value="">La de cada receta (entre sus comidas)</option>
              {TOMAS.map(([t, n]) => <option key={t} value={t}>{n}</option>)}
            </select></div>
          <div class="separa"><span class="peq">Factor</span><div style="max-width:150px"><Paso valor={factor} paso={0.25} min={0.25} max={5} dec={2} etiqueta="factor" alCambiar={(v) => v && setFactor(v)} /></div></div>
          {recetario.opcional && <SelectorVariante opcional={recetario.opcional} valor={variante} alCambiar={setVariante} />}
          <button class="btn btn-primario" disabled={ocupado} onClick={guardar}>Añadir {elegidas.length === 1 ? 'la receta' : `las ${elegidas.length} recetas`}</button>
        </div>
      )}
    </Hoja>
  );
}

// Su menú (lo organiza él; tú lo ves y lo puedes tocar)
function MenuCoach({ atleta }) {
  const { api } = useApp();
  const recetario = useCarga(() => api.recetario(atleta.id), [atleta.id]);
  const planes = useCarga(() => api.planesNutricion(atleta.id).catch(() => []), [atleta.id]);
  if (recetario.error) return <ErrorCaja error={recetario.error} reintentar={() => recetario.recargar(true)} />;
  if (!recetario.datos) return <Siluetas forma="tarjetas" n={2} texto="Cargando su menú" />;
  return (
    <div class="pila">
      <p class="peq secundario">Es su planificador: lo organiza él con las recetas de su recetario. Lo ves tal cual y lo puedes tocar (por ejemplo, para dejarle la primera semana hecha).</p>
      <MenuSemana atletaId={atleta.id} recetario={recetario.datos} planes={planes.datos || []} esCoach />
    </div>
  );
}

// ------------------------------------------------------------ Biblioteca → Recetas
export function RecetasBiblioteca() {
  const { api } = useApp();
  const lista = useCarga(() => api.recetas(), []);
  const [q, setQ] = useState('');
  const [toma, setToma] = useState(null);
  const [editar, setEditar] = useState(null);
  const todas = lista.datos || [];
  const vistas = todas.filter((r) => (!toma || r.tomas.includes(toma)) && (!q || normal(r.nombre).includes(normal(q)) || (r.etiquetas || []).some((e) => normal(e).includes(normal(q)))
    || (r.ingredientes || []).some((i) => normal(i.nombre).includes(normal(q)))));
  return (
    <>
      <div class="separa" style="flex-wrap:wrap">
        <p class="peq secundario" style="flex:1;min-width:220px">Escríbelas una vez y asígnalas a cada atleta desde su ficha (Nutrición → Recetario), con el factor que le toque. Sustituyen a las bases de datos de comidas de Notion.</p>
        <button class="btn btn-primario" onClick={() => setEditar({})}><Icono n="mas" /> Nueva receta</button>
      </div>
      <ErrorCaja error={lista.error} reintentar={() => lista.recargar(true)} />
      {todas.length > 0 && (
        <>
          <input class="entrada" type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Buscar por nombre, ingrediente o etiqueta" aria-label="Buscar recetas" />
          <div class="selector-chips" role="group" aria-label="Comida">
            <button aria-pressed={!toma ? 'true' : 'false'} onClick={() => setToma(null)}>Todas ({todas.length})</button>
            {TOMAS.map(([t, n]) => { const k = todas.filter((r) => r.tomas.includes(t)).length; return k > 0 && <button key={t} aria-pressed={toma === t ? 'true' : 'false'} onClick={() => setToma(toma === t ? null : t)}>{n} ({k})</button>; })}
          </div>
        </>
      )}
      {lista.cargando && !lista.datos ? <Siluetas forma="tarjetas" n={3} texto="Cargando tus recetas" /> : !todas.length ? (
        <div class="panel"><Vacio icono="receta" titulo="Sin recetas todavía" accion={<button class="btn btn-primario" onClick={() => setEditar({})}>Crear la primera</button>}>
          Nombre, foto, comidas en las que encaja, kcal y macros por ración, ingredientes (pégalos de Notion, uno por línea) y preparación.
        </Vacio></div>
      ) : !vistas.length ? <p class="peq secundario">Ninguna receta con eso.</p> : (
        <div class="rejilla-recetas">
          {vistas.map((r) => (
            <button type="button" class="tarjeta-receta" key={r.id} onClick={() => setEditar(r)}>
              <FotoReceta receta={r} />
              <span class="pila-xs tarjeta-receta-texto">
                <span class="nombre">{r.nombre}</span>
                <span class="mini secundario num">{textoMacros(r, true) || 'Sin macros'}</span>
                <span class="fila-chips">
                  {r.tomas.map((t) => <span class="chip" key={t}>{NOMBRE_TOMA[t]}</span>)}
                  {r.atletas > 0 && <span class="chip morado">{r.atletas === 1 ? '1 atleta' : `${r.atletas} atletas`}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {editar && <EditarReceta receta={editar} alCerrar={(cambio) => { setEditar(null); if (cambio) lista.recargar(true); }} />}
    </>
  );
}

// Crear o editar una receta (con su foto) y, al editarla, asignarla a varios atletas a la vez
export function EditarReceta({ receta, alCerrar }) {
  const { api, aviso } = useApp();
  const nueva = !receta.id;
  const completa = useCarga(() => (nueva ? Promise.resolve(null) : api.receta(receta.id)), [receta.id]);
  const base = completa.datos || receta;
  const [f, setF] = useState(() => formDe(receta));
  const [cargada, setCargada] = useState(nueva);
  useEffect(() => { if (!cargada && completa.datos) { setF(formDe(completa.datos)); setCargada(true); } }, [completa.datos]);
  const [etiqueta, setEtiqueta] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const input = useRef(null);
  const cambiar = (c) => setF((x) => ({ ...x, ...c }));
  const ingredientes = leerIngredientes(f.ingredientes);
  const aviso4 = avisoMacros(f);
  const elegirFoto = async (e) => {
    const a = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!a) return;
    try { cambiar({ foto: await recortarImagen(a, FOTO), foto_mini: await recortarImagen(a, MINI) }); } catch (err) { aviso(err.message, 'error'); }
  };
  const guardar = (ev) => {
    ev?.preventDefault();
    una(async () => {
      const { error } = limpiarReceta(f);
      if (error) { aviso(error, 'error'); return; }
      try { const r = await api.guardarReceta(f, nueva ? null : receta.id); aviso('Receta guardada'); alCerrar(r || true); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo={nueva ? 'Nueva receta' : 'Editar receta'} alCerrar={() => alCerrar(false)} ancho>
      {!nueva && !cargada ? (completa.error ? <ErrorCaja error={completa.error} reintentar={() => completa.recargar(true)} /> : <Siluetas forma="tarjetas" n={2} />) : (
        <form class="pila editar-receta" onSubmit={guardar}>
          <div class="foto-receta-editar">
            <FotoReceta receta={f} grande src={f.foto || null} />
            <span class="fila-envolver">
              <button type="button" class="btn btn-peq" onClick={() => input.current?.click()}><Icono n="camara" /> {f.foto ? 'Cambiar la foto' : 'Poner una foto'}</button>
              {f.foto && <button type="button" class="btn btn-peq plano" onClick={() => cambiar({ foto: null, foto_mini: null })}>Quitarla</button>}
            </span>
            <input ref={input} type="file" accept="image/*" hidden onChange={elegirFoto} />
          </div>
          <div class="campo"><label for="rec-nombre">Nombre</label><input id="rec-nombre" class="entrada" required maxLength={80} value={f.nombre} onInput={(e) => cambiar({ nombre: e.currentTarget.value })} placeholder="Tostadas con huevo y aguacate" /></div>
          <div class="pila-xs"><span class="peq">En qué comidas encaja</span>
            <div class="selector-chips" role="group" aria-label="Comidas">
              {TOMAS.map(([t, n]) => <button type="button" key={t} aria-pressed={f.tomas.includes(t) ? 'true' : 'false'} onClick={() => cambiar({ tomas: f.tomas.includes(t) ? f.tomas.filter((x) => x !== t) : ordenarTomas([...f.tomas, t]) })}>{n}</button>)}
            </div></div>
          <div class="rejilla-campos">
            <div class="campo"><label for="rec-kcal">Kcal por ración</label><Paso id="rec-kcal" valor={f.kcal} paso={10} min={0} max={5000} dec={0} etiqueta="kcal" alCambiar={(v) => cambiar({ kcal: v })} /></div>
            <div class="campo"><label for="rec-p">Proteína (g)</label><Paso id="rec-p" valor={f.proteina_g} paso={1} min={0} max={500} dec={1} etiqueta="gramos de proteína" alCambiar={(v) => cambiar({ proteina_g: v })} /></div>
            <div class="campo"><label for="rec-h">Hidratos (g)</label><Paso id="rec-h" valor={f.carbos_g} paso={1} min={0} max={800} dec={1} etiqueta="gramos de hidratos" alCambiar={(v) => cambiar({ carbos_g: v })} /></div>
            <div class="campo"><label for="rec-g">Grasa (g)</label><Paso id="rec-g" valor={f.grasa_g} paso={1} min={0} max={400} dec={1} etiqueta="gramos de grasa" alCambiar={(v) => cambiar({ grasa_g: v })} /></div>
          </div>
          {(aviso4 || (f.kcal == null && f.proteina_g != null && f.carbos_g != null && f.grasa_g != null)) && (
            <div class="nota-coach"><Icono n="calculadora" /><div>{aviso4 || 'Sin kcal: salen de los macros.'} <button type="button" class="btn-texto" onClick={() => cambiar({ kcal: kcalDeMacros(f.proteina_g, f.carbos_g, f.grasa_g) })}>Poner {kcalDeMacros(f.proteina_g, f.carbos_g, f.grasa_g)} kcal</button></div></div>
          )}
          <div class="rejilla-campos">
            <div class="campo"><label for="rec-rac">Los ingredientes son para</label><Paso id="rec-rac" valor={f.raciones} paso={1} min={1} max={20} dec={0} etiqueta="raciones" alCambiar={(v) => v && cambiar({ raciones: v })} /><span class="ayuda">{f.raciones === 1 ? 'Una ración' : `${f.raciones} raciones`}. Las kcal y los macros son por ración.</span></div>
            <div class="campo"><label for="rec-min">Minutos <span class="terciario">(opcional)</span></label><Paso id="rec-min" valor={f.minutos} paso={5} min={0} max={600} dec={0} etiqueta="minutos" alCambiar={(v) => cambiar({ minutos: v })} /></div>
          </div>
          <div class="campo"><label for="rec-ing">Ingredientes <span class="terciario">(uno por línea)</span></label>
            <textarea id="rec-ing" class="area" rows={6} value={f.ingredientes} onInput={(e) => cambiar({ ingredientes: e.currentTarget.value })} placeholder={'60 g de copos de avena\n200 ml de leche\n1 plátano\nCanela al gusto'} />
            {ingredientes.length > 0 && <span class="ayuda">{ingredientes.length === 1 ? 'Un ingrediente' : `${ingredientes.length} ingredientes`}: {ingredientes.map((i) => textoIngrediente(i)).join(' · ')}</span>}</div>
          <div class="campo"><label for="rec-prep">Preparación</label>
            <textarea id="rec-prep" class="area" rows={6} maxLength={4000} value={f.preparacion} onInput={(e) => cambiar({ preparacion: e.currentTarget.value })} placeholder="Un paso por línea" /></div>
          <div class="pila-xs"><span class="peq">Etiquetas</span>
            <div class="selector-chips" role="group" aria-label="Etiquetas">
              {[...new Set([...ETIQUETAS_SUGERIDAS, ...f.etiquetas])].map((e) => <button type="button" key={e} aria-pressed={f.etiquetas.includes(e) ? 'true' : 'false'} onClick={() => cambiar({ etiquetas: f.etiquetas.includes(e) ? f.etiquetas.filter((x) => x !== e) : [...f.etiquetas, e].slice(0, 8) })}>{e}</button>)}
            </div>
            <span class="fila-envolver"><input class="entrada" style="flex:1;min-width:140px" maxLength={24} value={etiqueta} onInput={(e) => setEtiqueta(e.currentTarget.value)} placeholder="Otra etiqueta" aria-label="Otra etiqueta" />
              <button type="button" class="btn btn-peq" disabled={!etiqueta.trim()} onClick={() => { cambiar({ etiquetas: [...new Set([...f.etiquetas, etiqueta.trim()])].slice(0, 8) }); setEtiqueta(''); }}>Añadir</button></span>
          </div>
          <button class="btn btn-primario btn-grande" disabled={ocupado}>Guardar</button>
          {!nueva && <AsignarVarios receta={base} />}
          {!nueva && (
            <div class="fila-envolver">
              <button type="button" class="btn plano" disabled={ocupado} onClick={() => una(async () => { try { await api.duplicarReceta(receta.id); aviso('Copia creada'); alCerrar(true); } catch (e) { aviso(e.message, 'error'); } })}><Icono n="duplicar" /> Duplicar</button>
              {!borrar ? <button type="button" class="btn btn-peligro" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar</button> : (
                <span class="fila-envolver"><span class="peq">{receta.atletas ? `La tienen ${receta.atletas === 1 ? 'un atleta' : `${receta.atletas} atletas`}: desaparecerá de su recetario (lo que ya tengan en el menú se queda). ` : ''}¿La borras?</span>
                  <button type="button" class="btn btn-peligro" disabled={ocupado} onClick={() => una(async () => { try { await api.borrarReceta(receta.id); aviso('Receta borrada'); alCerrar(true); } catch (e) { aviso(e.message, 'error'); } })}>Sí, borrarla</button>
                  <button type="button" class="btn plano" onClick={() => setBorrar(false)}>Cancelar</button></span>
              )}
            </div>
          )}
        </form>
      )}
    </Hoja>
  );
}

function formDe(r) {
  return {
    nombre: r.nombre || '', tomas: r.tomas || [], raciones: r.raciones || 1,
    kcal: r.kcal ?? null, proteina_g: r.proteina_g ?? null, carbos_g: r.carbos_g ?? null, grasa_g: r.grasa_g ?? null,
    minutos: r.minutos ?? null, ingredientes: ingredientesATexto(r.ingredientes || []), preparacion: r.preparacion || '',
    etiquetas: r.etiquetas || [], foto: r.foto || null, foto_mini: r.foto_mini || null,
  };
}

// Asignar esta receta a varios atletas a la vez (en una comida y con un factor)
function AsignarVarios({ receta }) {
  const { api, aviso } = useApp();
  const atletas = useCarga(() => api.atletas(), []);
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [toma, setToma] = useState(receta.tomas?.[0] || 'comida');
  const [factor, setFactor] = useState(1);
  const [ocupado, una] = useUnaVez();
  const posibles = (atletas.datos || []).filter((a) => a.estado !== 'baja' && conNutricion(a));
  if (!abierto) return <button type="button" class="btn" onClick={() => setAbierto(true)}><Icono n="atletas" /> Asignarla a atletas</button>;
  return (
    <section class="panel panel-pad pila-s">
      <h3 class="etq">Asignarla a…</h3>
      {!posibles.length ? <p class="peq secundario">Ningún atleta con nutrición.</p> : (
        <div class="pila-xs">{posibles.map((a) => (
          <label class="casilla" key={a.id}><input type="checkbox" checked={elegidos.includes(a.id)} onChange={() => setElegidos(elegidos.includes(a.id) ? elegidos.filter((x) => x !== a.id) : [...elegidos, a.id])} /><span>{a.nombre}</span></label>
        ))}</div>
      )}
      <div class="rejilla-campos">
        <div class="campo"><label for="av-toma">Comida</label><select id="av-toma" class="selector" value={toma} onChange={(e) => setToma(e.currentTarget.value)}>{TOMAS.map(([t, n]) => <option key={t} value={t}>{n}</option>)}</select></div>
        <div class="campo"><label for="av-factor">Factor</label><Paso id="av-factor" valor={factor} paso={0.25} min={0.25} max={5} dec={2} etiqueta="factor" alCambiar={(v) => v && setFactor(v)} /></div>
      </div>
      <button type="button" class="btn btn-primario" disabled={ocupado || !elegidos.length} onClick={() => una(async () => {
        try { for (const id of elegidos) await api.asignarReceta(id, receta.id, toma, { factor }); aviso(elegidos.length === 1 ? 'Asignada' : `Asignada a ${elegidos.length} atletas`); setElegidos([]); setAbierto(false); }
        catch (e) { aviso(e.message, 'error'); }
      })}>Asignar{elegidos.length ? ` a ${elegidos.length}` : ''}</button>
    </section>
  );
}
