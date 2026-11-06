import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Vacio, Siluetas, ErrorCaja, Avatar } from '../comunes.jsx';
import { NOMBRE_TOMA, ordenarTomas } from '../../logica/comidas.js';
import { fmtKcal } from '../../logica/nutricion.js';
import { hoyISO } from '../../logica/fechas.js';
import { comprobarRecetario, reescalar, textoComprobacion, textoMacrosDia, macrosCuadran, ordenRecetarios,
  NOMBRE_ESTADO_RECETARIO, NIVEL_ESTADO_RECETARIO } from '../../logica/recetario/index.js';
import { datosRecetario, corregirKcal, aplicarFactores, recetariosDelEquipo } from '../../datos/recetario.js';

const coma = (v) => String(v).replace('.', ',');
const conSigno = (v, sufijo = '') => (v == null ? '—' : v === 0 ? '=' : `${v > 0 ? '+' : '−'}${coma(Math.abs(v))}${sufijo}`);
const primer = (n) => String(n || '').trim().split(/\s+/)[0] || 'tu atleta';

// El recetario de un atleta frente a su plan (solo el coach): si cuadra en calorías y en cada macro, las recetas con las
// calorías mal puestas (y el botón que las corrige a partir de sus macros), las que se salen de lo normal en su comida y
// un factor para todo el recetario, o para las comidas que elijas, enseñando antes cómo quedan los macros.
// La lógica está en logica/recetario (LEEME.md).
export function HojaComprobarRecetario({ atleta, alCerrar, alCambiar }) {
  const { api, backend, aviso } = useApp();
  const hoy = hoyISO();
  const datos = useCarga(() => datosRecetario({ api }, atleta.id), [atleta.id]);
  const [ocupado, una] = useUnaVez();
  const [confirmar, setConfirmar] = useState(null); // 'kcal' | 'factor'
  const [fuera, setFuera] = useState([]);           // las comidas que NO se reescalan
  const d = datos.datos;
  const c = useMemo(() => (d ? comprobarRecetario({ recetario: d.recetario, planes: d.planes, hoy }) : null), [d, hoy]);
  const tomasDia = c?.dia ? ordenarTomas(Object.keys(c.dia.porToma)) : [];
  const elegidas = tomasDia.filter((t) => !fuera.includes(t));
  const r = useMemo(() => (d && c?.dif && !c.kcalMal.length ? reescalar({ recetario: d.recetario, planes: d.planes, hoy, tomas: elegidas }) : null), [d, c, fuera.join(',')]);
  const nombre = primer(atleta.nombre);

  const hecho = (texto) => { aviso(texto, 'ok'); setConfirmar(null); datos.recargar(true); alCambiar?.(); };
  const menu = (n) => (n ? `; ${n === 1 ? '1 comida ya apuntada en su menú, puesta al día' : `${n} comidas ya apuntadas en su menú, puestas al día`}` : '');
  const corregir = () => una(async () => {
    try { const x = await corregirKcal({ api, backend }, atleta.id, c.kcalMal, { hoy }); hecho(`Calorías corregidas en ${x.recetas === 1 ? '1 receta' : `${x.recetas} recetas`}${menu(x.menu)}`); } catch (e) { aviso(e?.message || 'No se ha podido corregir: vuelve a intentarlo', 'error'); datos.recargar(true); }
  });
  const aplicar = () => una(async () => {
    try { const x = await aplicarFactores({ api, backend }, atleta.id, r.cambios, { hoy }); hecho(`Factor ×${coma(r.factor)} aplicado a ${x.recetas === 1 ? '1 receta' : `${x.recetas} recetas`}${menu(x.menu)}`); } catch (e) { aviso(e?.message || 'No se ha podido aplicar: vuelve a intentarlo', 'error'); datos.recargar(true); }
  });

  return (
    <Hoja titulo={`El recetario de ${nombre} y su plan`} alCerrar={alCerrar}>
      <ErrorCaja error={datos.error} reintentar={() => datos.recargar(true)} />
      {!c ? (!datos.error && <Siluetas forma="lista" n={4} texto="Comprobando su recetario" />) : (
        <>
          <div class="pila-s">
            <span><span class={`chip ${NIVEL_ESTADO_RECETARIO[c.estado]}`}>{NOMBRE_ESTADO_RECETARIO[c.estado]}</span></span>
            <p class="peq" style={{ margin: 0 }}>{textoComprobacion(c)}</p>
          </div>
          {c.dif && (
            <table class="tabla-simple">
              <caption class="peq secundario" style={{ textAlign: 'left', paddingBottom: '4px' }}>Un día cualquiera con sus recetas (la media de las recetas de cada comida, con su factor), frente a su plan</caption>
              <thead><tr><th scope="col">Al día</th><th scope="col">Plan</th><th scope="col">Recetario</th><th scope="col">Diferencia</th></tr></thead>
              <tbody>
                <tr><th scope="row">Calorías</th><td class="num" style={{ whiteSpace: 'nowrap' }}>{fmtKcal(c.objetivo.kcal)}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{fmtKcal(c.dia.kcal)}</td><td class="num">{conSigno(c.dif.kcal)}{c.dif.kcal !== 0 ? ` (${conSigno(c.dif.pct, ' %')})` : ''}</td></tr>
                {[['Proteína', c.objetivo.proteina, c.dia.proteina_g, c.dif.proteina], ['Hidratos', c.objetivo.carbos, c.dia.carbos_g, c.dif.carbos], ['Grasa', c.objetivo.grasa, c.dia.grasa_g, c.dif.grasa]].map(([n, o, v, dif]) => (
                  <tr key={n}><th scope="row">{n}</th><td class="num" style={{ whiteSpace: 'nowrap' }}>{o == null ? '—' : `${Math.round(o)} g`}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{Math.round(v)} g</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{conSigno(dif)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {c.difSin && <p class="mini terciario" style={{ margin: 0 }}>Los días sin {NOMBRE_TOMA[d.recetario.opcional].toLowerCase()}: {fmtKcal(c.diaSin.kcal)} kcal ({conSigno(c.difSin.pct, ' %')}).</p>}
          {c.planKcal && <p class="mini terciario" style={{ margin: 0 }}>Las calorías de su plan ({fmtKcal(c.planKcal.kcal)}) no coinciden con las que dan sus macros ({fmtKcal(c.planKcal.calculadas)}): revísalo en Plan.</p>}

          {c.kcalMal.length > 0 && (
            <section class="panel panel-pad pila-s" aria-labelledby="rec-kcal">
              <h3 id="rec-kcal" class="h-panel" style={{ margin: 0 }}>{c.kcalMal.length === 1 ? '1 receta con las calorías mal puestas' : `${c.kcalMal.length} recetas con las calorías mal puestas`}</h3>
              <p class="peq secundario" style={{ margin: 0 }}>Sus calorías no coinciden con las que dan sus macros (4 kcal por gramo de proteína y de hidratos, 9 por gramo de grasa). Al corregirlas se quedan en las de sus macros; los macros y las cantidades no cambian.</p>
              <ul class="lista peq">
                {c.kcalMal.slice(0, 4).map((x) => <li key={x.receta.id} style={{ padding: '6px 0' }}>{x.receta.nombre}: <span class="num">{fmtKcal(x.receta.kcal)} → <strong>{fmtKcal(x.calculadas)}</strong> kcal</span></li>)}
              </ul>
              {c.kcalMal.length > 4 && (
                <details class="peq"><summary>Ver las otras {c.kcalMal.length - 4}</summary>
                  <ul class="lista">{c.kcalMal.slice(4).map((x) => <li key={x.receta.id} style={{ padding: '6px 0' }}>{x.receta.nombre}: <span class="num">{fmtKcal(x.receta.kcal)} → <strong>{fmtKcal(x.calculadas)}</strong> kcal</span></li>)}</ul>
                </details>
              )}
              {c.corregido && <p class="peq" style={{ margin: 0 }}>Corregidas, el día quedaría en {conSigno(c.corregido.pct, ' %')} frente al plan.</p>}
              {confirmar !== 'kcal' ? <button class="btn btn-primario" disabled={ocupado} onClick={() => setConfirmar('kcal')}>Corregir las calorías de {c.kcalMal.length === 1 ? '1 receta' : `${c.kcalMal.length} recetas`}</button> : (
                <div class="pila-s">
                  <p class="peq" style={{ margin: 0 }}>Las calorías de ahora se sustituyen por las de sus macros y no se pueden recuperar. ¿Seguimos?</p>
                  <span class="fila-envolver"><button class="btn btn-primario" disabled={ocupado} onClick={corregir}>{ocupado ? 'Corrigiendo…' : 'Sí, corregirlas'}</button><button class="btn plano" disabled={ocupado} onClick={() => setConfirmar(null)}>No</button></span>
                </div>
              )}
            </section>
          )}

          {c.fuera.length > 0 && (
            <section class="panel panel-pad pila-s" aria-labelledby="rec-fuera">
              <h3 id="rec-fuera" class="h-panel" style={{ margin: 0 }}>{c.fuera.length === 1 ? '1 receta se sale de lo normal en su comida' : `${c.fuera.length} recetas se salen de lo normal en su comida`}</h3>
              <ul class="lista peq">
                {c.fuera.slice(0, 6).map((x) => <li key={x.asignacion.id} style={{ padding: '6px 0' }}>{NOMBRE_TOMA[x.toma]}: {x.asignacion.receta.nombre}, <span class="num">{fmtKcal(x.kcal)} kcal</span> <span class="terciario">(lo normal ahí son unas {fmtKcal(x.mediana)})</span></li>)}
              </ul>
              {c.fuera.length > 6 && <p class="mini terciario" style={{ margin: 0 }}>Y {c.fuera.length - 6} más.</p>}
            </section>
          )}

          {c.dif && (
            <section class="panel panel-pad pila-s" aria-labelledby="rec-factor">
              <h3 id="rec-factor" class="h-panel" style={{ margin: 0 }}>Reescalar con un factor</h3>
              {c.kcalMal.length > 0 ? <p class="peq secundario" style={{ margin: 0 }}>Corrige antes las calorías de las recetas: el factor se calcula con ellas.</p> : (
                <>
                  <p class="peq secundario" style={{ margin: 0 }}>Multiplica las cantidades y los macros de sus recetas para que el día dé las calorías del plan. Elige qué comidas se tocan.</p>
                  <div class="selector-chips" role="group" aria-label="Comidas que se reescalan">
                    {tomasDia.map((t) => <button key={t} type="button" aria-pressed={fuera.includes(t) ? 'false' : 'true'} onClick={() => { setConfirmar(null); setFuera((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t])); }}>{NOMBRE_TOMA[t]}</button>)}
                  </div>
                  {!elegidas.length ? <p class="peq" style={{ margin: 0 }}>Elige al menos una comida.</p>
                    : !r ? null
                      : r.innecesario ? <p class="peq" style={{ margin: 0 }}>Las calorías ya cuadran con el plan: no hace falta ningún factor.</p>
                        : r.imposible ? <p class="peq" style={{ margin: 0 }}>Solo con {elegidas.length === 1 ? 'esa comida' : 'esas comidas'} no se llega a las calorías del plan: marca alguna más.</p> : (
                          <>
                            <p class="peq" style={{ margin: 0 }}><strong>Factor ×{coma(r.factor)}</strong> en {r.cambios.length === 1 ? '1 receta' : `${r.cambios.length} recetas`}. El día quedaría en <span class="num">{fmtKcal(r.dia.kcal)} kcal</span> (plan {fmtKcal(c.objetivo.kcal)}): {textoMacrosDia(r.dia, r.dif)}.</p>
                            {!macrosCuadran(r.dif, c.objetivo) && <p class="peq aviso-t" style={{ margin: 0 }}>El factor mueve todos los macros a la vez, así que alguno se aleja del plan. Si el cambio del plan fue solo de hidratos, cuadra mejor tocando el ingrediente de hidratos de las recetas.</p>}
                            {confirmar !== 'factor' ? <button class="btn" disabled={ocupado} onClick={() => setConfirmar('factor')}>Aplicar ×{coma(r.factor)} a {r.cambios.length === 1 ? '1 receta' : `${r.cambios.length} recetas`}</button> : (
                              <div class="pila-s">
                                <p class="peq" style={{ margin: 0 }}>Cambia el factor de {r.cambios.length === 1 ? 'esa receta' : `esas ${r.cambios.length} recetas`} en el recetario de {nombre}: verá las cantidades nuevas en su app. ¿Seguimos?</p>
                                <span class="fila-envolver"><button class="btn btn-primario" disabled={ocupado} onClick={aplicar}>{ocupado ? 'Aplicando…' : 'Sí, aplicarlo'}</button><button class="btn plano" disabled={ocupado} onClick={() => setConfirmar(null)}>No</button></span>
                              </div>
                            )}
                          </>
                        )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </Hoja>
  );
}

// Los recetarios de todo el equipo frente a su plan, de un vistazo: primero los que no cuadran. Al tocar uno, su comprobación.
export function HojaRecetariosEquipo({ alCerrar, alCambiar }) {
  const { api, backend } = useApp();
  const hoy = hoyISO();
  const equipo = useCarga(() => recetariosDelEquipo({ api, backend }), []);
  const [abierto, setAbierto] = useState(null);
  const lista = useMemo(() => ordenRecetarios((equipo.datos || []).map((x) => ({ ...x, comprobacion: comprobarRecetario({ recetario: x.recetario, planes: x.planes, hoy }) }))
    .filter((x) => x.comprobacion.estado !== 'sin_recetas')), [equipo.datos, hoy]);
  const bien = lista.filter((x) => x.comprobacion.estado === 'cuadra').length;
  if (abierto) return <HojaComprobarRecetario atleta={abierto} alCerrar={() => { setAbierto(null); equipo.recargar(true); }} alCambiar={alCambiar} />;
  return (
    <Hoja titulo="Los recetarios y sus planes" alCerrar={alCerrar}>
      <ErrorCaja error={equipo.error} reintentar={() => equipo.recargar(true)} />
      {equipo.cargando && !equipo.datos ? <Siluetas forma="lista" n={5} texto="Comprobando los recetarios" /> : !lista.length ? (
        !equipo.error && <Vacio icono="receta" titulo="Ningún atleta con recetario">Cuando le pongas recetas a alguien, aquí verás si cuadran con su plan.</Vacio>
      ) : (
        <>
          <p class="peq" style={{ margin: 0 }}><strong>{bien} de {lista.length} recetarios cuadran con su plan.</strong> Toca uno para ver el detalle y corregirlo.</p>
          <ul class="lista" aria-label="Recetarios">
            {lista.map(({ atleta, comprobacion: c }) => (
              <li key={atleta.id}>
                <button type="button" class="fila-recetario" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '12px', alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '10px 0', color: 'inherit', font: 'inherit', cursor: 'pointer' }} onClick={() => setAbierto(atleta)}>
                  <Avatar nombre={atleta.nombre} foto={atleta.foto} />
                  <span class="pila-xs">
                    <strong>{atleta.nombre}</strong>
                    <span><span class={`chip ${NIVEL_ESTADO_RECETARIO[c.estado]}`}>{NOMBRE_ESTADO_RECETARIO[c.estado]}</span></span>
                    <span class="mini terciario">{c.recetas} recetas{c.dif ? ` · ${conSigno(c.dif.pct, ' %')} de calorías` : ''}{c.kcalMal.length ? ` · ${c.kcalMal.length} con las calorías mal` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Hoja>
  );
}
