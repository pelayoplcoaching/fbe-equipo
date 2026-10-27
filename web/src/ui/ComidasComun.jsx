// Comidas (v0.26): lo que comparten el atleta y su coach. El recetario (sus recetas por toma, con su foto, sus
// macros ya ajustados a él, los ingredientes y la preparación) y el menú de la semana (lo que va a comer cada
// día, con los totales frente a su plan, copiar semanas y la lista de la compra). Sustituye a las bases de datos
// de Desayuno, Comida, Merienda y Cena y al «Planificador semanal» de Notion.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Paso, Siluetas, ErrorCaja, usePreferencia, copiar, Segmentos } from './comunes.jsx';
import { BarraMacro, COLOR_MACRO } from './NutricionComun.jsx';
import { NOMBRE_TOMA, TOMAS, CLAVES_TOMA, ordenarTomas, macrosDe, textoMacros, textoIngrediente, menuPorDia, totalesDia, diasDeSemana, listaCompra, textoListaCompra, valeParaDia, textoVariante, tomasDelDia, paraElDia } from '../logica/comidas.js';
import { planVigente, objetivoDelDia, fmtKcal } from '../logica/nutricion.js';
import { hoyISO, lunesDe, sumarDias, fmtConDia, rangoSemana } from '../logica/fechas.js';
import { LETRAS_DIA } from '../logica/plan.js';
import { num } from '../logica/calculos.js';

const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// La foto de una receta (o un hueco con el icono, si no tiene)
export function FotoReceta({ receta, grande = false, src = null }) {
  const foto = src || (grande ? receta?.foto || receta?.foto_mini : receta?.foto_mini);
  return foto
    ? <img class={`receta-foto ${grande ? 'grande' : ''}`} src={foto} alt="" loading="lazy" decoding="async" />
    : <span class={`receta-foto vacia ${grande ? 'grande' : ''}`} aria-hidden="true"><Icono n="receta" /></span>;
}

// Una receta del recetario, en tarjeta: foto, nombre y sus macros (ya con el factor del atleta)
export function TarjetaReceta({ a, alAbrir, mostrarFactor = false, opcional = null }) {
  const r = a.receta;
  const m = macrosDe(r, a.factor);
  return (
    <button type="button" class="tarjeta-receta" onClick={() => alAbrir(a)}>
      <FotoReceta receta={r} />
      <span class="pila-xs tarjeta-receta-texto">
        <span class="nombre">{a.favorita && <Icono n="estrella" class="favorita" titulo="Favorita" />}{r.nombre}</span>
        <span class="mini secundario num">{textoMacros(m, true) || 'Sin macros'}</span>
        <span class="fila-chips">
          {mostrarFactor && Number(a.factor) !== 1 && <span class="chip morado num">×{num(a.factor, 2)}</span>}
          {textoVariante(a.variante, opcional) && <span class="chip">{textoVariante(a.variante, opcional)}</span>}
          {r.minutos ? <span class="chip"><Icono n="reloj" />{r.minutos} min</span> : null}
          {a.cambio_pedido_en && <span class="chip aviso">Pide cambio</span>}
        </span>
      </span>
    </button>
  );
}

// El recetario de un atleta, por toma (sus comidas del día y las tomas en las que tenga recetas)
export function VistaRecetario({ recetario, alAbrir, esCoach = false, vacio = null }) {
  const op = recetario.opcional;
  // Con una comida opcional y recetas para cada tipo de día, se puede ver solo lo de un tipo de día (v0.27)
  const conVariantes = !!op && recetario.asignaciones.some((a) => a.variante);
  const [tipo, setTipo] = usePreferencia(`fbe-recetario-dia-${esCoach ? 'coach' : 'atleta'}`, 'todos');
  const filtro = conVariantes && tipo !== 'todos' ? tipo : null;
  const tomas = tomasDelDia(ordenarTomas([...recetario.tomas, ...recetario.conRecetas]), op, filtro === 'sin');
  if (!recetario.asignaciones.length) return vacio;
  return (
    <div class="pila">
      {conVariantes && (
        <Segmentos etiqueta="Qué días" clase="segmentos-dia" valor={filtro || 'todos'} alCambiar={(v) => setTipo(v || 'todos')}
          opciones={[['todos', 'Todas'], ['con', `Con ${NOMBRE_TOMA[op].toLowerCase()}`], ['sin', `Sin ${NOMBRE_TOMA[op].toLowerCase()}`]]} />
      )}
      {tomas.map((t) => {
        // (el atleta sin comida opcional no ve las versiones «sin» que hayan quedado; tú sí, para corregirlas)
        const xs = filtro ? paraElDia(recetario.porToma[t] || [], filtro === 'sin') : !op && !esCoach ? paraElDia(recetario.porToma[t] || [], false) : recetario.porToma[t] || [];
        return (
          <section class="seccion" key={t} aria-labelledby={`toma-${t}`}>
            <div class="seccion-cab"><h2 id={`toma-${t}`}>{NOMBRE_TOMA[t]}</h2><span class="mini terciario">{xs.length === 1 ? '1 opción' : `${xs.length} opciones`}{!recetario.tomas.includes(t) ? ' · no está entre sus comidas' : ''}</span></div>
            {xs.length ? (
              <div class="rejilla-recetas">{xs.map((a) => <TarjetaReceta key={a.id} a={a} alAbrir={alAbrir} mostrarFactor={esCoach} opcional={op} />)}</div>
            ) : <p class="peq terciario">{esCoach ? 'Sin recetas para esta comida.' : `Tu coach aún no te ha puesto opciones para ${NOMBRE_TOMA[t].toLowerCase()}.`}</p>}
          </section>
        );
      })}
    </div>
  );
}

// Una receta entera: foto, macros, ingredientes (para las raciones que elijas) y preparación. El atleta la puede
// añadir al menú, marcarla como favorita o pedir que se la cambien.
export function HojaReceta({ a, esCoach = false, opcional = null, alCerrar, alCambiar, alAnadir = null }) {
  const { api, aviso } = useApp();
  const completa = useCarga(() => api.receta(a.receta.id).catch(() => null), [a.receta.id]);
  const r = completa.datos || a.receta;
  const [raciones, setRaciones] = useState(1);
  const [pedir, setPedir] = useState(false);
  const [nota, setNota] = useState(a.cambio_nota || '');
  const [ocupado, una] = useUnaVez();
  const escala = Number(a.factor || 1) * Number(raciones || 1) / Number(r.raciones || 1);
  const m = macrosDe(r, a.factor, raciones);
  const hacer = (fn, texto) => una(async () => { try { await fn(); aviso(texto); alCambiar?.(); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <Hoja titulo={r.nombre} alCerrar={alCerrar} ancho>
      <div class="pila receta-detalle">
        <FotoReceta receta={r} grande />
        <div class="fila-chips">
          <span class="chip morado">{NOMBRE_TOMA[a.toma]}</span>
          {textoVariante(a.variante, opcional) && <span class="chip morado">{textoVariante(a.variante, opcional)}</span>}
          {r.minutos ? <span class="chip"><Icono n="reloj" />{r.minutos} min</span> : null}
          {(r.etiquetas || []).map((e) => <span class="chip" key={e}>{e}</span>)}
          {esCoach && Number(a.factor) !== 1 && <span class="chip morado num">×{num(a.factor, 2)} las cantidades</span>}
        </div>
        {a.nota && <div class="nota-coach"><Icono n="mensaje" /><div><strong>{esCoach ? 'Tu nota: ' : 'Tu coach: '}</strong>{a.nota}</div></div>}
        <div class="panel panel-pad pila-s">
          <div class="separa">
            <span class="peq">{raciones === 1 ? 'Una ración' : `${num(raciones, 2)} raciones`}</span>
            <div style="max-width:150px"><Paso valor={raciones} paso={0.5} min={0.5} max={10} dec={2} etiqueta="raciones" alCambiar={(v) => v && setRaciones(v)} /></div>
          </div>
          <div class="cifras-receta num" aria-label={textoMacros(m)}>
            <span><b>{m.kcal == null ? '—' : num(m.kcal, 0)}</b><span class="mini terciario">kcal</span></span>
            <span style={{ '--c': COLOR_MACRO.proteina }}><b>{m.proteina_g == null ? '—' : num(m.proteina_g, 0)}</b><span class="mini terciario">g prot.</span></span>
            <span style={{ '--c': COLOR_MACRO.carbos }}><b>{m.carbos_g == null ? '—' : num(m.carbos_g, 0)}</b><span class="mini terciario">g hidr.</span></span>
            <span style={{ '--c': COLOR_MACRO.grasa }}><b>{m.grasa_g == null ? '—' : num(m.grasa_g, 0)}</b><span class="mini terciario">g grasa</span></span>
          </div>
        </div>
        {(r.ingredientes || []).length > 0 && (
          <section class="pila-s">
            <h3 class="etq">Ingredientes</h3>
            <ul class="ingredientes">{r.ingredientes.map((i, k) => <li key={k}>{textoIngrediente(i, escala)}</li>)}</ul>
          </section>
        )}
        {r.preparacion && (
          <section class="pila-s">
            <h3 class="etq">Preparación</h3>
            <div class="pautas">{r.preparacion.split('\n').filter((l) => l.trim()).map((l, k) => <p key={k}>{l}</p>)}</div>
          </section>
        )}
        {!esCoach && (
          <div class="pila-s">
            {alAnadir && <button class="btn btn-primario btn-grande" onClick={() => alAnadir(a, raciones)}><Icono n="calendario" /> Añadir a tu menú</button>}
            <div class="fila-envolver">
              <button class="btn" aria-pressed={a.favorita ? 'true' : 'false'} disabled={ocupado} onClick={() => hacer(() => api.recetaFavorita(a.id, !a.favorita), a.favorita ? 'Ya no es favorita' : 'Favorita')}>
                <Icono n="estrella" class={a.favorita ? 'favorita' : ''} /> {a.favorita ? 'Favorita' : 'Marcar favorita'}
              </button>
              {a.cambio_pedido_en
                ? <button class="btn plano" disabled={ocupado} onClick={() => hacer(() => api.pedirCambioReceta(a.id, false), 'Petición retirada')}>Retirar la petición de cambio</button>
                : !pedir && <button class="btn plano" onClick={() => setPedir(true)}><Icono n="intercambiar" /> Pedir un cambio</button>}
            </div>
            {a.cambio_pedido_en && <p class="mini terciario">Has pedido a tu coach que te la cambie{a.cambio_nota ? `: «${a.cambio_nota}»` : ''}.</p>}
            {pedir && !a.cambio_pedido_en && (
              <form class="pila-s" onSubmit={(e) => { e.preventDefault(); hacer(() => api.pedirCambioReceta(a.id, nota), 'Se lo hemos dicho a tu coach').then(() => setPedir(false)); }}>
                <label class="peq" for="cambio-nota">¿Qué le cambiarías? <span class="terciario">(opcional)</span></label>
                <input id="cambio-nota" class="entrada" maxLength={300} value={nota} onInput={(e) => setNota(e.currentTarget.value)} placeholder="No me gusta el atún, me sobra cantidad…" />
                <span class="fila-envolver"><button class="btn btn-primario" disabled={ocupado}>Pedir el cambio</button><button type="button" class="btn plano" onClick={() => setPedir(false)}>Cancelar</button></span>
              </form>
            )}
          </div>
        )}
      </div>
    </Hoja>
  );
}

// Elegir un día de una semana y una toma (para añadir una receta al menú desde el recetario)
export function HojaElegirDia({ a, raciones = 1, tomas, alCerrar, alGuardado }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [dia, setDia] = useState(hoy);
  const [toma, setToma] = useState(tomas.includes(a.toma) ? a.toma : tomas[0]);
  const [ocupado, una] = useUnaVez();
  const guardar = () => una(async () => {
    try {
      await api.apuntarMenu(atleta.id, { fecha: dia, toma, asignacion: a, raciones });
      aviso(`Añadida al ${fmtConDia(dia)}`); alGuardado?.(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Añadir a tu menú" alCerrar={alCerrar}>
      <p class="peq"><strong>{a.receta.nombre}</strong>{raciones !== 1 ? `, ${num(raciones, 2)} raciones` : ''}</p>
      <NavSemana lunes={lunes} setLunes={(l) => { setLunes(l); setDia(l === lunesDe(hoy) ? hoy : l); }} />
      <DiasSemana lunes={lunes} dia={dia} setDia={setDia} />
      <div class="campo"><label for="elegir-toma">Comida</label>
        <select id="elegir-toma" class="selector" value={toma} onChange={(e) => setToma(e.currentTarget.value)}>
          {ordenarTomas([...tomas, a.toma]).map((t) => <option key={t} value={t}>{NOMBRE_TOMA[t]}</option>)}
        </select>
      </div>
      <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>Añadir el {fmtConDia(dia)}</button>
    </Hoja>
  );
}

function NavSemana({ lunes, setLunes }) {
  const actual = lunesDe(hoyISO());
  return (
    <div class="nav-semana">
      <button type="button" class="btn btn-icono plano" aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))}><Icono n="atras" /></button>
      <span class="peq"><strong>{lunes === actual ? 'Esta semana' : lunes === sumarDias(actual, 7) ? 'La semana que viene' : lunes === sumarDias(actual, -7) ? 'La semana pasada' : 'Semana'}</strong> <span class="terciario">{rangoSemana(lunes)}</span></span>
      <button type="button" class="btn btn-icono plano" aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))}><Icono n="derecha" /></button>
    </div>
  );
}

function DiasSemana({ lunes, dia, setDia, conDatos = null }) {
  const hoy = hoyISO();
  return (
    <div class="semana-habito dias-menu" role="group" aria-label="Día">
      {diasDeSemana(lunes).map((iso, i) => (
        <button key={iso} type="button" aria-pressed={iso === dia ? 'true' : 'false'} onClick={() => setDia(iso)} class={`${conDatos?.(iso) ? 'cumple' : ''} ${iso === hoy ? 'hoy' : ''}`} style={{ '--c': 'var(--morado)' }} aria-label={`${fmtConDia(iso)}${conDatos?.(iso) ? ', con comidas' : ''}`}>
          <span aria-hidden="true">{LETRAS_DIA[i]}</span>
          <span class="punto-dia num" aria-hidden="true">{iso.slice(8).replace(/^0/, '')}</span>
        </button>
      ))}
    </div>
  );
}

// Lo apuntado frente al objetivo del día (si su plan tiene cifras); sin plan, solo los totales
function TotalesDia({ entradas, plan }) {
  const t = totalesDia(entradas);
  const obj = objetivoDelDia(plan, true);
  if (!t.total) return null;
  if (!t.conDatos) return <p class="mini terciario">Sin kcal apuntadas en las comidas de este día.</p>;
  if (!obj) return <p class="peq secundario num">En el menú: {textoMacros(t)}</p>;
  return (
    <div class="pila-xs totales-menu">
      <BarraMacro nombre="Kcal" valor={t.kcal} objetivo={obj.kcal} color={COLOR_MACRO.kcal} unidad="kcal" />
      <BarraMacro nombre="Proteína" valor={t.proteina_g} objetivo={obj.proteina} color={COLOR_MACRO.proteina} />
      {obj.carbos != null && <BarraMacro nombre="Hidratos" valor={t.carbos_g} objetivo={obj.carbos} color={COLOR_MACRO.carbos} />}
      {obj.grasa != null && <BarraMacro nombre="Grasa" valor={t.grasa_g} objetivo={obj.grasa} color={COLOR_MACRO.grasa} />}
      {plan?.kcal_descanso != null && <span class="mini terciario">Objetivo de día de entreno; los de descanso, {fmtKcal(plan.kcal_descanso)} kcal.</span>}
      {t.conDatos < t.total && <span class="mini terciario">{t.total - t.conDatos === 1 ? 'Una comida' : `${t.total - t.conDatos} comidas`} sin kcal no cuentan.</span>}
    </div>
  );
}

// El menú de la semana: los días, cada toma con lo que va a comer, los totales frente a su plan, añadir desde su
// recetario o escribiendo, marcar lo comido, copiar semanas, vaciar y la lista de la compra.
export function MenuSemana({ atletaId, recetario, planes = [], esCoach = false, alCambiarComidas = null }) {
  const { api, aviso } = useApp();
  const hoy = hoyISO();
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [dia, setDia] = useState(hoy);
  const menu = useCarga(() => api.menuSemana(atletaId, lunes), [atletaId, lunes]);
  const op = recetario.opcional;
  const diasSin = useCarga(() => (op ? api.diasSin(atletaId, lunes) : Promise.resolve([])), [atletaId, lunes, op]);
  const [hoja, setHoja] = useState(null); // { tipo: 'anadir', toma } | { tipo: 'entrada', e } | 'compra' | 'copiar' | 'receta'
  const [ocupado, una] = useUnaVez();
  const entradas = menu.datos || [];
  const porDia = menuPorDia(entradas, lunes);
  const delDia = porDia[dia] || {};
  const sin = !!op && (diasSin.datos || []).includes(dia);
  const tomas = tomasDelDia(ordenarTomas([...recetario.tomas, ...Object.keys(delDia)]), op, sin, Object.keys(delDia));
  const plan = planVigente(planes, dia);
  const recargar = () => { menu.recargar(true); diasSin.recargar(true); };
  const cambiarSin = () => una(async () => { try { await api.marcarDiaSin(atletaId, dia, !sin); diasSin.recargar(true); } catch (err) { aviso(err.message, 'error'); } });
  const cambiarSemana = (l) => { setLunes(l); setDia(l === lunesDe(hoy) ? hoy : l); };
  const marcar = (e) => una(async () => { try { await api.cambiarMenu(e, { hecho: !e.hecho }); recargar(); } catch (err) { aviso(err.message, 'error'); } });
  return (
    <div class="pila menu-semana">
      <NavSemana lunes={lunes} setLunes={cambiarSemana} />
      <DiasSemana lunes={lunes} dia={dia} setDia={setDia} conDatos={(iso) => Object.keys(porDia[iso] || {}).length > 0} />
      <ErrorCaja error={menu.error} reintentar={recargar} />
      {menu.cargando && !menu.datos ? <Siluetas forma="lista" n={3} texto="Cargando el menú" /> : (
        <section class="panel" aria-labelledby="menu-dia">
          <div class="panel-pad pila-s">
            <div class="separa"><h2 id="menu-dia" class="h-panel">{dia === hoy ? 'Hoy' : mayus(fmtConDia(dia))}</h2>
              {!plan && Object.keys(delDia).length > 0 && <span class="mini terciario num">{totalesDia(Object.values(delDia).flat()).kcal ? `${fmtKcal(totalesDia(Object.values(delDia).flat()).kcal)} kcal` : ''}</span>}</div>
            <TotalesDia entradas={Object.values(delDia).flat()} plan={plan} />
            {op && (
              <label class="interruptor-fila interruptor-dia"><span class="peq">{dia === hoy ? 'Hoy' : 'Este día'} sin {NOMBRE_TOMA[op].toLowerCase()}</span>
                <input type="checkbox" role="switch" class="interruptor" checked={sin} disabled={ocupado || diasSin.cargando} onChange={cambiarSin} /></label>
            )}
            {sin && <span class="mini terciario">{(delDia[op] || []).length ? `Tienes algo apuntado en ${NOMBRE_TOMA[op].toLowerCase()}: quítalo si al final no la haces. ` : ''}Al añadir, te enseñamos las recetas para los días sin {NOMBRE_TOMA[op].toLowerCase()}.</span>}
          </div>
          <ul class="lista tomas-dia">
            {tomas.map((t) => (
              <li key={t} class="toma-dia">
                <div class="separa toma-cab"><span class="etq">{NOMBRE_TOMA[t]}</span>
                  <button type="button" class="btn-texto" onClick={() => setHoja({ tipo: 'anadir', toma: t })} aria-label={`Añadir a ${NOMBRE_TOMA[t].toLowerCase()}`}><Icono n="mas" /> Añadir</button>
                </div>
                {(delDia[t] || []).map((e) => (
                  <div class={`entrada-menu ${e.hecho ? 'hecha' : ''}`} key={e.id}>
                    <button type="button" class="casilla-redonda" aria-pressed={e.hecho ? 'true' : 'false'} aria-label={`${e.texto}: ${e.hecho ? 'comida' : 'sin comer'}`} disabled={ocupado} onClick={() => marcar(e)}>{e.hecho && <Icono n="hecho" />}</button>
                    <button type="button" class="entrada-texto" onClick={() => setHoja({ tipo: 'entrada', e })}>
                      <span class={e.hecho ? 'tachado' : ''}>{e.texto}{Number(e.raciones) !== 1 ? <span class="terciario num"> ×{num(e.raciones, 2)}</span> : ''}</span>
                      {(e.kcal != null || e.proteina_g != null) && <span class="mini terciario num">{textoMacros(e, true)}</span>}
                    </button>
                  </div>
                ))}
                {!(delDia[t] || []).length && <span class="mini terciario">Nada todavía</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={() => setHoja('compra')} disabled={!entradas.length}><Icono n="carrito" /> Lista de la compra</button>
        <button class="btn plano" onClick={() => setHoja('copiar')}><Icono n="copiar" /> Copiar o vaciar</button>
        {alCambiarComidas && <button class="btn plano" onClick={alCambiarComidas}><Icono n="ajustes" /> {recetario.tomas.length} comidas al día</button>}
      </div>
      {hoja?.tipo === 'anadir' && <HojaAnadir atletaId={atletaId} fecha={dia} toma={hoja.toma} recetario={recetario} sin={sin} alCerrar={() => setHoja(null)} alGuardado={recargar} />}
      {hoja?.tipo === 'entrada' && <HojaEntrada e={hoja.e} recetario={recetario} esCoach={esCoach} alCerrar={() => setHoja(null)} alCambiar={recargar} />}
      {hoja === 'compra' && <HojaCompra entradas={entradas} recetario={recetario} lunes={lunes} alCerrar={() => setHoja(null)} />}
      {hoja === 'copiar' && <HojaCopiar atletaId={atletaId} lunes={lunes} entradas={entradas} alCerrar={() => setHoja(null)} alCambiar={recargar} />}
    </div>
  );
}

// Añadir a una toma: una receta de su recetario (primero las de esa comida) o lo que escriba
function HojaAnadir({ atletaId, fecha, toma, recetario, sin = false, alCerrar, alGuardado }) {
  const { api, aviso } = useApp();
  // Solo las que valen para ese día (con o sin su comida opcional), si las hay de los dos tipos (v0.27)
  const delDia = (xs) => paraElDia(xs, !!recetario.opcional && sin);
  const propias = delDia(recetario.porToma[toma] || []);
  const vistas = new Set(propias.map((a) => a.receta_id));
  const otras = [];
  for (const t of CLAVES_TOMA) for (const a of delDia(recetario.porToma[t] || [])) if (!vistas.has(a.receta_id)) { vistas.add(a.receta_id); otras.push(a); }
  const [elegida, setElegida] = useState(null);
  const [raciones, setRaciones] = useState(1);
  const [texto, setTexto] = useState('');
  const [kcal, setKcal] = useState(null);
  const [prot, setProt] = useState(null);
  const [ocupado, una] = useUnaVez();
  const guardar = (datos) => una(async () => {
    try { await api.apuntarMenu(atletaId, { fecha, toma, ...datos }); aviso('Añadido al menú'); alGuardado(); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const fila = (a) => (
    <li key={a.id}>
      <button type="button" class={`respuesta opcion-receta ${elegida?.id === a.id ? 'elegida' : ''}`} aria-pressed={elegida?.id === a.id ? 'true' : 'false'} onClick={() => { setElegida(a); setRaciones(1); }}>
        <FotoReceta receta={a.receta} />
        <span class="pila-xs"><span class="nombre">{a.favorita && <Icono n="estrella" class="favorita" titulo="Favorita" />}{a.receta.nombre}</span><span class="mini terciario num">{textoMacros(macrosDe(a.receta, a.factor), true)}</span></span>
      </button>
    </li>
  );
  return (
    <Hoja titulo={`${NOMBRE_TOMA[toma]}, ${fmtConDia(fecha)}`} alCerrar={alCerrar}>
      {recetario.opcional && recetario.asignaciones.some((a) => a.variante) && <p class="mini terciario">{sin ? `Día sin ${NOMBRE_TOMA[recetario.opcional].toLowerCase()}: las opciones un poco más grandes.` : `Día con ${NOMBRE_TOMA[recetario.opcional].toLowerCase()}.`}</p>}
      {propias.length > 0 && <><h3 class="etq">De tu recetario para {NOMBRE_TOMA[toma].toLowerCase()}</h3><div class="panel"><ul class="lista">{propias.map(fila)}</ul></div></>}
      {otras.length > 0 && <><h3 class="etq">{propias.length ? 'Otras de tu recetario' : 'De tu recetario'}</h3><div class="panel"><ul class="lista">{otras.map(fila)}</ul></div></>}
      {elegida && (
        <div class="panel panel-pad pila-s sticky-abajo">
          <div class="separa"><span class="peq"><strong>{elegida.receta.nombre}</strong></span>
            <div style="max-width:150px"><Paso valor={raciones} paso={0.5} min={0.5} max={10} dec={2} etiqueta="raciones" alCambiar={(v) => v && setRaciones(v)} /></div></div>
          <span class="mini terciario num">{raciones === 1 ? 'Una ración' : `${num(raciones, 2)} raciones`}: {textoMacros(macrosDe(elegida.receta, elegida.factor, raciones), true)}</span>
          <button class="btn btn-primario" disabled={ocupado} onClick={() => guardar({ asignacion: elegida, raciones })}>Añadir</button>
        </div>
      )}
      <form class="pila-s" onSubmit={(e) => { e.preventDefault(); guardar({ texto, macros: { kcal, proteina_g: prot } }); }}>
        <h3 class="etq">O escríbelo</h3>
        <input class="entrada" maxLength={120} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Comida fuera, sobras del lunes, un bocadillo…" aria-label="Qué vas a comer" />
        <div class="rejilla-campos">
          <div class="campo"><label for="lib-kcal">Kcal <span class="terciario">(si lo sabes)</span></label><Paso id="lib-kcal" valor={kcal} paso={50} min={0} max={5000} dec={0} etiqueta="kcal" alCambiar={setKcal} /></div>
          <div class="campo"><label for="lib-prot">Proteína (g)</label><Paso id="lib-prot" valor={prot} paso={5} min={0} max={500} dec={0} etiqueta="gramos de proteína" alCambiar={setProt} /></div>
        </div>
        <button class="btn" disabled={ocupado || !texto.trim()}>Añadir lo escrito</button>
      </form>
      {!propias.length && !otras.length && <p class="mini terciario">Cuando tu coach te ponga recetas, las elegirás de aquí.</p>}
    </Hoja>
  );
}

// Algo del menú: cambiar las raciones, verlo, marcarlo y borrarlo
function HojaEntrada({ e, recetario, esCoach, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [raciones, setRaciones] = useState(Number(e.raciones));
  const [ver, setVer] = useState(false);
  const [ocupado, una] = useUnaVez();
  const asignacion = e.receta_id ? recetario.asignaciones.find((a) => a.receta_id === e.receta_id) : null;
  const a = asignacion ? { ...asignacion, receta: recetario.recetas.find((r) => r.id === e.receta_id) } : null;
  const hacer = (fn, texto) => una(async () => { try { await fn(); aviso(texto); alCambiar(); alCerrar(); } catch (err) { aviso(err.message, 'error'); } });
  if (ver && a?.receta) return <HojaReceta a={a} esCoach={esCoach} opcional={recetario.opcional} alCerrar={() => setVer(false)} />;
  return (
    <Hoja titulo={e.texto} alCerrar={alCerrar}>
      <p class="peq secundario">{NOMBRE_TOMA[e.toma]}, {fmtConDia(e.fecha)}{e.kcal != null ? ` · ${textoMacros(cambiarMacros(e, raciones), true)}` : ''}</p>
      <div class="separa"><span class="peq">Raciones</span><div style="max-width:150px"><Paso valor={raciones} paso={0.5} min={0.25} max={10} dec={2} etiqueta="raciones" alCambiar={(v) => v && setRaciones(v)} /></div></div>
      {raciones !== Number(e.raciones) && <button class="btn btn-primario" disabled={ocupado} onClick={() => hacer(() => api.cambiarMenu(e, { raciones }), 'Raciones cambiadas')}>Guardar las raciones</button>}
      <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.cambiarMenu(e, { hecho: !e.hecho }), e.hecho ? 'Marcada sin comer' : '¡Bien!')}><Icono n="hecho" /> {e.hecho ? 'Marcar como no comida' : 'Ya me la he comido'}</button>
      {a?.receta && <button class="btn plano" onClick={() => setVer(true)}><Icono n="receta" /> Ver la receta</button>}
      <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.borrarMenu(e.id), 'Quitado del menú')}><Icono n="basura" /> Quitar del menú</button>
    </Hoja>
  );
}
const cambiarMacros = (e, raciones) => {
  const k = Number(raciones) / Number(e.raciones || 1);
  return { kcal: e.kcal == null ? null : e.kcal * k, proteina_g: e.proteina_g == null ? null : e.proteina_g * k, carbos_g: e.carbos_g == null ? null : e.carbos_g * k, grasa_g: e.grasa_g == null ? null : e.grasa_g * k };
};

// La lista de la compra de la semana (o desde hoy): los ingredientes sumados, para ir tachando y copiarla
function HojaCompra({ entradas, recetario, lunes, alCerrar }) {
  const { aviso } = useApp();
  const hoy = hoyISO();
  const enCurso = lunes === lunesDe(hoy);
  const [desde, setDesde] = useState(enCurso ? 'hoy' : 'semana');
  const xs = desde === 'hoy' ? entradas.filter((e) => e.fecha >= hoy) : entradas;
  const lista = listaCompra(xs, recetario.recetas, recetario.asignaciones);
  const [tachados, setTachados] = usePreferencia(`fbe-compra-${lunes}`, []);
  const clave = (i) => `${i.nombre}|${i.unidad || ''}`;
  const alternar = (k) => setTachados(tachados.includes(k) ? tachados.filter((x) => x !== k) : [...tachados, k]);
  return (
    <Hoja titulo="Lista de la compra" alCerrar={alCerrar}>
      {enCurso && (
        <div class="segmentos" role="group" aria-label="Qué días">
          <button type="button" aria-pressed={desde === 'hoy' ? 'true' : 'false'} onClick={() => setDesde('hoy')}>Desde hoy</button>
          <button type="button" aria-pressed={desde === 'semana' ? 'true' : 'false'} onClick={() => setDesde('semana')}>Toda la semana</button>
        </div>
      )}
      {!lista.items.length && !lista.libres.length ? <p class="peq secundario">No hay comidas en el menú para esos días.</p> : (
        <>
          {lista.items.length > 0 && (
            <ul class="lista-compra">
              {lista.items.map((i) => {
                const k = clave(i);
                return (
                  <li key={k}><label class="casilla"><input type="checkbox" checked={tachados.includes(k)} onChange={() => alternar(k)} />
                    <span class={tachados.includes(k) ? 'tachado' : ''}>{i.cantidad == null ? i.nombre : textoIngrediente({ nombre: i.nombre, cantidad: i.cantidad, unidad: i.unidad })}<span class="mini terciario"> · {i.recetas.join(', ')}</span></span>
                  </label></li>
                );
              })}
            </ul>
          )}
          {lista.libres.length > 0 && <p class="mini terciario">Sin receta (no suman ingredientes): {lista.libres.join(', ')}.</p>}
          <button class="btn" onClick={async () => aviso((await copiar(textoListaCompra(lista, `Lista de la compra, ${rangoSemana(lunes)}`))) ? 'Lista copiada: pégala donde quieras' : 'No se ha podido copiar')}><Icono n="copiar" /> Copiar la lista</button>
          <p class="mini terciario">Las cantidades salen de tus recetas y de las raciones que has puesto en el menú, redondeadas para comprar.</p>
        </>
      )}
    </Hoja>
  );
}

// Copiar la semana pasada a esta, esta a la siguiente, o vaciarla
function HojaCopiar({ atletaId, lunes, entradas, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [vaciar, setVaciar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto) => una(async () => { try { const r = await fn(); aviso(typeof texto === 'function' ? texto(r) : texto); alCambiar(); alCerrar(); } catch (e) { aviso(e.message, 'error'); } });
  const n = (r) => (Array.isArray(r) ? r.length : 0);
  return (
    <Hoja titulo={`Semana del ${rangoSemana(lunes)}`} alCerrar={alCerrar}>
      <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.copiarMenuSemana(atletaId, sumarDias(lunes, -7), lunes), (r) => (n(r) ? `${n(r)} comidas copiadas de la semana anterior` : 'Nada que copiar: la semana anterior está vacía o ya estaba copiada'))}>
        <Icono n="copiar" /> Traer el menú de la semana anterior
      </button>
      <button class="btn" disabled={ocupado || !entradas.length} onClick={() => hacer(() => api.copiarMenuSemana(atletaId, lunes, sumarDias(lunes, 7)), (r) => (n(r) ? `${n(r)} comidas copiadas a la semana siguiente` : 'Ya estaban en la semana siguiente'))}>
        <Icono n="duplicar" /> Repetir este menú la semana siguiente
      </button>
      <p class="mini terciario">Lo que ya tengas en la semana de destino se queda; lo copiado llega sin marcar como comido.</p>
      {!vaciar ? <button class="btn plano" disabled={!entradas.length} onClick={() => setVaciar(true)}><Icono n="basura" /> Vaciar esta semana</button> : (
        <div class="panel panel-pad pila-s">
          <p class="peq">¿Quitas las {entradas.length} comidas de esta semana?</p>
          <span class="fila-envolver"><button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.vaciarMenuSemana(atletaId, lunes), 'Semana vaciada')}>Sí, vaciarla</button><button class="btn plano" onClick={() => setVaciar(false)}>Cancelar</button></span>
        </div>
      )}
    </Hoja>
  );
}

// Cuántas comidas hace al día (y cuáles)
export function HojaTusComidas({ atletaId, tomas, opcional = null, esCoach = false, alCerrar, alGuardado }) {
  const { api, aviso } = useApp();
  const [elegidas, setElegidas] = useState(tomas);
  const [op, setOp] = useState(opcional);
  const opValida = op && elegidas.includes(op) && elegidas.length >= 2 ? op : null;
  const [ocupado, una] = useUnaVez();
  const alternar = (t) => setElegidas(elegidas.includes(t) ? elegidas.filter((x) => x !== t) : ordenarTomas([...elegidas, t]));
  return (
    <Hoja titulo={esCoach ? 'Sus comidas del día' : 'Tus comidas del día'} alCerrar={alCerrar}>
      <p class="peq secundario">{esCoach ? 'Las que verá en su menú. Él también las puede cambiar.' : 'Las que verás cada día en tu menú. Tu coach te pone recetas para cada una.'}</p>
      <div class="pila-xs">
        {TOMAS.map(([t, nombre]) => (
          <label class="casilla" key={t}><input type="checkbox" checked={elegidas.includes(t)} onChange={() => alternar(t)} /><span>{nombre}</span></label>
        ))}
      </div>
      {esCoach && elegidas.length >= 2 && (
        <div class="campo"><label for="comida-opcional">Comida que algunos días no hace</label>
          <select id="comida-opcional" class="selector" value={opValida || ''} onChange={(e) => setOp(e.currentTarget.value || null)}>
            <option value="">Ninguna (hace todas cada día)</option>
            {elegidas.map((t) => <option key={t} value={t}>{NOMBRE_TOMA[t]}</option>)}
          </select>
          <span class="ayuda">Como los planes con y sin merienda: él marca en su semana los días que no la hace y, en cada receta de su recetario, eliges para qué días es.</span></div>
      )}
      <button class="btn btn-primario btn-grande" disabled={ocupado || !elegidas.length} onClick={() => una(async () => {
        try { await api.guardarComidas(atletaId, elegidas, esCoach && (opValida || opcional) ? opValida : undefined); aviso(`${elegidas.length} comidas al día`); alGuardado(); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
      })}>Guardar ({elegidas.length} al día)</button>
    </Hoja>
  );
}

export { mayus };
