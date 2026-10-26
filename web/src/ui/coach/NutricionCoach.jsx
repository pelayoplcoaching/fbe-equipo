// Nutrición del atleta en su ficha (pestaña «Nutrición»): el plan con sus versiones, el gasto energético
// adaptativo (como MacroFactor), el ajuste para el ritmo que buscas con «Revisar y aplicar», sus semanas y sus días.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Segmentos, Paso, Vacio, Siluetas, ErrorCaja, Grafica } from '../comunes.jsx';
import { TarjetaPlan, GraficaIngesta, textoPlan, textoRitmoCorto, NOMBRE_ESTADO_DIA } from '../NutricionComun.jsx';
import { MODOS_NUTRICION, FASES_NUTRICION, NIVELES_ACTIVIDAD, fmtKcal, kcalDeMacros, planInicial, proteinaPorKg, textoRitmo } from '../../logica/nutricion.js';
import { hoyISO, lunesDe, sumarDias, fmtConDia } from '../../logica/fechas.js';
import { num, signo } from '../../logica/calculos.js';

const RITMOS = {
  perder: [[-0.25, '−0,25'], [-0.5, '−0,5'], [-0.75, '−0,75'], [-1, '−1']],
  ganar: [[0.1, '+0,1'], [0.25, '+0,25'], [0.5, '+0,5']],
  mantener: [[0, 'Mantener']],
  recomposicion: [[0, 'Mantener'], [-0.25, '−0,25']],
};
const FIABILIDAD = { alta: 'Fiable', media: 'Orientativo', baja: 'Poco fiable' };

// El lunes que viene (o hoy, si es lunes): cuando empiezan los cambios
const proximoLunes = (hoy = hoyISO()) => (lunesDe(hoy) === hoy ? hoy : sumarDias(lunesDe(hoy), 7));

export function NutricionCoach({ atleta }) {
  const { api, aviso } = useApp();
  const res = useCarga(() => api.resumenNutricion(atleta.id), [atleta.id]);
  const [hoja, setHoja] = useState(null); // { base, desde, motivo }
  const [ocupado, una] = useUnaVez();
  const r = res.datos;
  if (res.error) return <ErrorCaja error={res.error} reintentar={res.recargar} />;
  if (!r) return <Siluetas forma="tarjetas" n={3} texto="Cargando la nutrición" />;
  const plan = r.plan;
  const actualOSiguiente = plan || r.siguiente;
  const conCifras = actualOSiguiente && actualOSiguiente.modo !== 'sin_contar';
  const semanas = [r.semana, ...r.anteriores];
  const dias = [...semanas].reverse().flatMap((w) => w.dias).filter((d) => !d.futuro).slice(-28)
    .map((d) => ({ iso: d.iso, kcal: d.reg?.kcal != null ? Number(d.reg.kcal) : null, objetivo: d.obj?.kcal ?? null, estado: d.estado }));
  // Cambiar: si ya hay una versión preparada para más adelante, se parte de esa (con su fecha y su motivo), para no
  // pisarla con las cifras de la vigente; si no, de la vigente, como versión nueva del lunes
  const abrir = (base = r.siguiente || plan, extra = {}) => {
    const futura = base?.desde > hoyISO();
    setHoja({ base, desde: futura ? base.desde : r.planes.length ? proximoLunes() : hoyISO(), motivo: futura ? base.motivo || '' : '', ...extra });
  };
  const guardado = () => { setHoja(null); res.recargar(true); };

  return (
    <div class="pila nutricion-coach">
      {!r.planes.length ? (
        <div class="panel">
          <Vacio icono="nutricion" titulo="Sin plan de nutrición" accion={<button class="btn btn-primario" onClick={() => abrir(null)}><Icono n="mas" /> Crear el plan</button>}>
            Kcal y macros (con días de descanso distintos, si quieres), solo kcal y proteína, o «sin contar» con tus pautas. Con la calculadora tienes un punto de partida en un minuto.
          </Vacio>
        </div>
      ) : (
        <TarjetaPlan plan={plan} siguiente={r.siguiente} diasEntreno={r.diasEntreno}
          acciones={<button class="btn btn-peq" onClick={() => abrir()}><Icono n="editar" /> Cambiar</button>} />
      )}

      {r.ajuste && <Ajuste r={r} alRevisar={() => { const b = r.siguiente || plan; abrir({ ...b, ...r.ajuste.nuevo }, { desde: b.desde > hoyISO() ? b.desde : proximoLunes(), motivo: motivoAjuste(r) }); }} />}
      {plan && conCifras && plan.ritmo_pct == null && <p class="mini terciario">Ponle un ritmo al plan (por ejemplo, −0,5 % a la semana) y la app te propondrá los ajustes con su gasto.</p>}

      {conCifras && (
        <section class="seccion">
          <div class="seccion-cab"><h2>Gasto energético</h2>{r.gasto.kcal != null && <span class={`chip ${r.gasto.fiabilidad === 'alta' ? 'ok' : r.gasto.fiabilidad === 'baja' ? 'aviso' : ''}`}>{FIABILIDAD[r.gasto.fiabilidad]}</span>}</div>
          <div class="panel panel-pad pila">
            {r.gasto.kcal != null ? (
              <>
                <p class="gasto-cifra"><b class="num">{fmtKcal(r.gasto.kcal)}</b> <span class="secundario">kcal al día</span> <span class="terciario num">±{r.gasto.margen}</span></p>
                <p class="peq secundario">Últimos 28 días: ha comido {fmtKcal(r.gasto.ingesta)} kcal de media ({r.gasto.diasConKcal} días completos{r.gasto.descartados ? `; ${r.gasto.descartados} a medias no cuentan` : ''}) y su peso ha ido a {signo(r.gasto.kgSemana, 2)} kg a la semana ({r.gasto.pesadas} pesadas).</p>
                {r.gastoSemanas.length >= 2 && <Grafica puntos={r.gastoSemanas} unidad="kcal" dec={0} rangoMin={400} etiqueta={`Gasto estimado al final de cada semana: de ${fmtKcal(r.gastoSemanas[0].y)} a ${fmtKcal(r.gastoSemanas[r.gastoSemanas.length - 1].y)} kcal`} />}
              </>
            ) : <p class="peq secundario">Para estimarlo necesita {r.gasto.falta} (en los últimos 28 días).</p>}
            {r.ritmo && <p class="mini terciario">Peso (tendencia): {signo(r.ritmo.kgSemana, 2)} kg a la semana ({signo(r.ritmo.pctSemana, 1)} %){plan?.ritmo_pct != null ? `; el plan busca ${textoRitmoCorto(plan.ritmo_pct)}` : ''}.</p>}
          </div>
        </section>
      )}

      {r.planes.length > 0 && (
        <section class="seccion">
          <div class="seccion-cab"><h2>Sus semanas</h2></div>
          <div class="panel panel-pad pila">
            {conCifras ? <GraficaIngesta dias={dias} /> : (
              <div class="tira-cumplido" role="img" aria-label={`Ha seguido el plan ${dias.filter((d) => d.estado === 'si').length} de los últimos ${dias.length} días`}>
                {dias.map((d) => <i key={d.iso} class={d.estado} title={`${fmtConDia(d.iso)}: ${NOMBRE_ESTADO_DIA[d.estado]}`} />)}
              </div>
            )}
            <div class="tabla-desliza" tabIndex={0} role="region" aria-label="Semanas de nutrición">
              <table class="tabla-nutricion num">
                <thead><tr><th scope="col">Semana</th><th scope="col">Días</th>{conCifras && <th scope="col">Kcal (obj.)</th>}{conCifras && <th scope="col">Prot. (obj.)</th>}<th scope="col">Bien</th></tr></thead>
                <tbody>
                  {semanas.map((w) => (
                    <tr key={w.lunes}>
                      <th scope="row">{fmtConDia(w.lunes).replace(/^\w+ /, '')}</th>
                      <td>{w.registrados}/{w.transcurridos}</td>
                      {conCifras && <td>{w.mediaKcal != null ? fmtKcal(w.mediaKcal) : '—'}{w.objetivoKcal ? <span class="terciario"> ({fmtKcal(w.objetivoKcal)})</span> : ''}</td>}
                      {conCifras && <td>{w.mediaProteina != null ? `${w.mediaProteina} g` : '—'}{w.objetivoProteina ? <span class="terciario"> ({w.objetivoProteina})</span> : ''}</td>}
                      <td>{w.enObjetivo}{w.casi ? <span class="terciario"> +{w.casi}</span> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="mini terciario">Medias de los días completos y ya acabados. «Bien»: kcal a ±10 % y proteína al 90 % o más (o «sí», si va sin contar); «+N», los que se quedaron cerca.</p>
          </div>
        </section>
      )}

      {r.planes.length > 0 && (
        <section class="seccion">
          <div class="seccion-cab"><h2>Versiones del plan</h2></div>
          <div class="panel">
            <ul class="lista">
              {[...r.planes].reverse().map((p) => (
                <li key={p.id} class="version-plan">
                  <div class="pila-xs" style="min-width:0">
                    <strong>{p.desde > hoyISO() ? 'Desde' : 'Desde el'} {fmtConDia(p.desde)}{p.id === plan?.id ? ' (vigente)' : p.desde > hoyISO() ? ' (próximo)' : ''}</strong>
                    <span class="mini terciario">{textoPlan(p)}{p.ritmo_pct != null ? `. ${textoRitmoCorto(p.ritmo_pct)}` : ''}</span>
                    {p.motivo && <span class="mini secundario">{p.motivo}</span>}
                  </div>
                  {p.desde > hoyISO() && <button class="btn btn-icono plano btn-peligro" aria-label={`Quitar el plan que empieza el ${fmtConDia(p.desde)}`} disabled={ocupado}
                    onClick={() => una(async () => { try { await api.borrarPlanNutricion(p.id); aviso('Plan quitado'); res.recargar(true); } catch (e) { aviso(e.message, 'error'); } })}><Icono n="basura" /></button>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {hoja && <HojaPlan atleta={atleta} r={r} base={hoja.base} desdeInicial={hoja.desde} motivoInicial={hoja.motivo} alCerrar={() => setHoja(null)} alGuardar={guardado} />}
    </div>
  );
}

const motivoAjuste = (r) => `Ajuste: gastas unas ${fmtKcal(r.gasto.kcal)} kcal al día y para ${textoRitmo((r.siguiente || r.plan).ritmo_pct)} hacen falta unas ${fmtKcal(r.ajuste.objetivo)}; ${r.ajuste.delta < 0 ? 'bajo' : 'subo'} ${fmtKcal(Math.abs(r.ajuste.delta))} kcal.`;

function Ajuste({ r, alRevisar }) {
  const a = r.ajuste;
  if (a.tipo === 'esperar' || a.tipo === 'revisar') return <div class="panel panel-pad ajuste-nutricion"><p class="peq secundario"><Icono n={a.tipo === 'esperar' ? 'reloj' : 'alerta'} /> {a.texto}</p></div>;
  if (a.tipo === 'mantener') return <div class="panel panel-pad ajuste-nutricion ok"><p class="peq"><Icono n="hecho" /> {a.texto}</p></div>;
  return (
    <div class={`panel panel-pad pila-s ajuste-nutricion ${a.tipo}`}>
      <span class="separa"><strong>Ajuste sugerido: {a.delta > 0 ? '+' : '−'}{fmtKcal(Math.abs(a.delta))} kcal</strong><span class="chip">{FIABILIDAD[r.gasto.fiabilidad]}</span></span>
      <p class="peq secundario">{a.texto}</p>
      <p class="peq">Quedaría: {textoPlan(a.nuevo)}.</p>
      <button class="btn btn-primario" onClick={alRevisar}><Icono n="calendario" /> Revisar y aplicar desde el {fmtConDia(r.siguiente?.desde > hoyISO() ? r.siguiente.desde : proximoLunes())}</button>
    </div>
  );
}

// Crear o cambiar el plan (cada cambio es una versión nueva desde una fecha; el mismo día, se corrige)
function HojaPlan({ atleta, r, base, desdeInicial, motivoInicial = '', alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const nuevo = !r.planes.length;
  const [f, setF] = useState(() => ({
    desde: desdeInicial, modo: base?.modo || 'macros', fase: base?.fase || 'perder', ritmo_pct: base ? base.ritmo_pct : -0.5,
    kcal: base?.kcal ?? null, proteina_g: base?.proteina_g ?? null, carbos_g: base?.carbos_g ?? null, grasa_g: base?.grasa_g ?? null, fibra_g: base?.fibra_g ?? null,
    descanso: base?.kcal_descanso != null, kcal_descanso: base?.kcal_descanso ?? null, carbos_descanso_g: base?.carbos_descanso_g ?? null, grasa_descanso_g: base?.grasa_descanso_g ?? null,
    pautas: base?.pautas || '', motivo: motivoInicial,
  }));
  const [verCalc, setVerCalc] = useState(nuevo);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (c) => setF((x) => ({ ...x, ...c }));
  const macros = f.modo === 'macros', cifras = f.modo !== 'sin_contar';
  const kcalEntreno = macros ? (f.proteina_g != null && f.carbos_g != null && f.grasa_g != null ? kcalDeMacros(f.proteina_g, f.carbos_g, f.grasa_g) : null) : f.kcal;
  const kcalDescanso = !f.descanso ? null : macros ? (f.proteina_g != null && f.carbos_descanso_g != null && f.grasa_descanso_g != null ? kcalDeMacros(f.proteina_g, f.carbos_descanso_g, f.grasa_descanso_g) : null) : f.kcal_descanso;
  const pesoKg = r.pesoKg;
  const yaHay = r.planes.find((p) => p.desde === f.desde);
  const ritmos = RITMOS[f.fase] || [];
  const elegirFase = (fase) => {
    const ops = RITMOS[fase];
    // Se respeta «sin ritmo» y un ritmo que valga para la nueva fase; si no, el habitual de esa fase
    cambiar({ fase, ritmo_pct: f.ritmo_pct == null || ops.some(([v]) => v === f.ritmo_pct) ? f.ritmo_pct : fase === 'perder' ? -0.5 : fase === 'ganar' ? 0.25 : 0 });
  };
  const guardar = (e) => {
    e.preventDefault();
    setError(null);
    if (!f.desde) { setError('Elige desde qué día vale.'); return; }
    if (cifras && (kcalEntreno == null || f.proteina_g == null)) { setError(macros ? 'Rellena la proteína, los hidratos y la grasa.' : 'Rellena las kcal y la proteína.'); return; }
    if (cifras && f.descanso && kcalDescanso == null) { setError(macros ? 'Rellena los hidratos y la grasa de los días de descanso.' : 'Rellena las kcal de los días de descanso.'); return; }
    const fila = {
      desde: f.desde, modo: f.modo, fase: f.fase, ritmo_pct: f.ritmo_pct,
      kcal: cifras ? kcalEntreno : null, proteina_g: cifras ? f.proteina_g : null, carbos_g: macros ? f.carbos_g : null, grasa_g: macros ? f.grasa_g : null,
      fibra_g: cifras ? f.fibra_g : null,
      kcal_descanso: cifras && f.descanso ? kcalDescanso : null, carbos_descanso_g: macros && f.descanso ? f.carbos_descanso_g : null, grasa_descanso_g: macros && f.descanso ? f.grasa_descanso_g : null,
      pautas: f.pautas, motivo: nuevo ? null : f.motivo,
    };
    una(async () => {
      try {
        await api.guardarPlanNutricion(atleta.id, fila);
        aviso(nuevo ? 'Plan de nutrición creado' : f.desde > hoyISO() ? `Plan guardado: empieza el ${fmtConDia(f.desde)}` : 'Plan guardado');
        alGuardar();
      } catch (err) { setError(err.message); }
    });
  };
  const gkg = (g) => (pesoKg && g != null ? `${num(g / pesoKg, 1)} g/kg` : null);
  return (
    <Hoja titulo={nuevo ? 'Plan de nutrición' : 'Cambiar el plan'} alCerrar={alCerrar} ancho={720}>
      <form class="pila" onSubmit={guardar}>
        <div class="fila-campos">
          <div class="campo"><label for="pn-desde">Desde</label><input id="pn-desde" class="entrada" type="date" value={f.desde} onInput={(e) => cambiar({ desde: e.currentTarget.value })} />
            {yaHay && <span class="ayuda">Ya hay una versión que empieza ese día: se sustituye.</span>}</div>
        </div>
        <div class="campo"><span class="etq">Cómo lo lleva</span><Segmentos etiqueta="Cómo lo lleva" valor={f.modo} opciones={MODOS_NUTRICION} alCambiar={(v) => v && cambiar({ modo: v, kcal: v === 'kcal_proteina' && f.modo === 'macros' && kcalEntreno != null ? kcalEntreno : f.kcal,
            kcal_descanso: v === 'kcal_proteina' && f.modo === 'macros' && kcalDescanso != null ? kcalDescanso : f.kcal_descanso })} />
          <span class="ayuda">{f.modo === 'macros' ? 'Apunta kcal, proteína, hidratos y grasa (los totales de su app).' : f.modo === 'kcal_proteina' ? 'Apunta solo kcal y proteína: más sencillo y suficiente para la mayoría.' : 'No cuenta: sigue tus pautas y marca cada día si lo ha cumplido.'}</span></div>
        <div class="campo"><span class="etq">Objetivo</span><Segmentos etiqueta="Objetivo" valor={f.fase} opciones={FASES_NUTRICION} alCambiar={(v) => v && elegirFase(v)} /></div>
        <div class="campo"><span class="etq">Ritmo (% del peso a la semana)</span>
          <Segmentos etiqueta="Ritmo" valor={f.ritmo_pct == null ? 'ninguno' : f.ritmo_pct} opciones={[...ritmos, ['ninguno', 'Sin ritmo']]}
            alCambiar={(v) => v != null && cambiar({ ritmo_pct: v === 'ninguno' ? null : v })} />
          <span class="ayuda">{f.ritmo_pct != null && pesoKg ? `Con ${num(pesoKg, 1)} kg, unos ${num(Math.abs(f.ritmo_pct) * pesoKg / 100, 2)} kg a la semana. ` : ''}En déficit, entre 0,5 y 1 % a la semana conserva mejor el músculo (Helms y cols., 2014).</span></div>

        {cifras && (
          <details class="calculadora-nutricion" open={verCalc} onToggle={(e) => setVerCalc(e.currentTarget.open)}>
            <summary><Icono n="calculadora" /> Calcular un punto de partida</summary>
            <Calculadora pesoKg={pesoKg} fase={f.fase} ritmo={f.ritmo_pct} modo={f.modo} alUsar={(c) => { cambiar({ kcal: c.kcal, proteina_g: c.proteina_g, carbos_g: c.carbos_g ?? null, grasa_g: c.grasa_g ?? null, descanso: false }); setVerCalc(false); }} />
          </details>
        )}

        {cifras && (
          <div class="pila-s">
            <span class="etq">{f.descanso ? 'Días de entreno' : 'Cada día'}</span>
            <div class="rejilla-campos">
              {!macros && <div class="campo"><label for="pn-kcal">Kcal</label><Paso id="pn-kcal" valor={f.kcal} paso={50} min={800} max={8000} dec={0} etiqueta="kcal" alCambiar={(v) => cambiar({ kcal: v })} /></div>}
              <div class="campo"><label for="pn-prot">Proteína (g)</label><Paso id="pn-prot" valor={f.proteina_g} paso={5} min={20} max={600} dec={0} etiqueta="gramos de proteína" alCambiar={(v) => cambiar({ proteina_g: v })} />{gkg(f.proteina_g) && <span class="ayuda">{gkg(f.proteina_g)} (1,6–2,2)</span>}</div>
              {macros && <div class="campo"><label for="pn-carb">Hidratos (g)</label><Paso id="pn-carb" valor={f.carbos_g} paso={5} min={0} max={1500} dec={0} etiqueta="gramos de hidratos" alCambiar={(v) => cambiar({ carbos_g: v })} />{gkg(f.carbos_g) && <span class="ayuda">{gkg(f.carbos_g)}</span>}</div>}
              {macros && <div class="campo"><label for="pn-grasa">Grasa (g)</label><Paso id="pn-grasa" valor={f.grasa_g} paso={5} min={10} max={500} dec={0} etiqueta="gramos de grasa" alCambiar={(v) => cambiar({ grasa_g: v })} />{gkg(f.grasa_g) && <span class="ayuda">{gkg(f.grasa_g)}</span>}</div>}
            </div>
            {macros && <p class="peq">Kcal: <b class="num">{kcalEntreno != null ? fmtKcal(kcalEntreno) : '—'}</b> <span class="terciario">(4 por gramo de proteína e hidratos, 9 de grasa)</span></p>}
            <label class="casilla">
              <input type="checkbox" checked={f.descanso} onChange={(e) => {
                const on = e.currentTarget.checked;
                cambiar(on ? { descanso: true, kcal_descanso: f.kcal_descanso ?? (kcalEntreno ? kcalEntreno - 200 : null), carbos_descanso_g: f.carbos_descanso_g ?? (f.carbos_g != null ? Math.max(0, f.carbos_g - 50) : null), grasa_descanso_g: f.grasa_descanso_g ?? f.grasa_g } : { descanso: false });
              }} />
              <span>Días de descanso distintos <span class="mini terciario">(menos hidratos los días sin entreno)</span></span>
            </label>
            {f.descanso && (
              <div class="rejilla-campos">
                {!macros && <div class="campo"><label for="pn-kcal-d">Kcal, descanso</label><Paso id="pn-kcal-d" valor={f.kcal_descanso} paso={50} min={800} max={8000} dec={0} etiqueta="kcal de los días de descanso" alCambiar={(v) => cambiar({ kcal_descanso: v })} /></div>}
                {macros && <div class="campo"><label for="pn-carb-d">Hidratos, descanso (g)</label><Paso id="pn-carb-d" valor={f.carbos_descanso_g} paso={5} min={0} max={1500} dec={0} etiqueta="gramos de hidratos de los días de descanso" alCambiar={(v) => cambiar({ carbos_descanso_g: v })} /></div>}
                {macros && <div class="campo"><label for="pn-grasa-d">Grasa, descanso (g)</label><Paso id="pn-grasa-d" valor={f.grasa_descanso_g} paso={5} min={10} max={500} dec={0} etiqueta="gramos de grasa de los días de descanso" alCambiar={(v) => cambiar({ grasa_descanso_g: v })} /></div>}
              </div>
            )}
            {macros && f.descanso && <p class="peq">Kcal, descanso: <b class="num">{kcalDescanso != null ? fmtKcal(kcalDescanso) : '—'}</b></p>}
            <div class="campo"><label for="pn-fibra">Fibra (g) <span class="terciario">(opcional)</span></label><Paso id="pn-fibra" valor={f.fibra_g} paso={1} min={5} max={150} dec={0} etiqueta="gramos de fibra" alCambiar={(v) => cambiar({ fibra_g: v })} /></div>
          </div>
        )}

        <div class="campo"><label for="pn-pautas">Pautas {cifras && <span class="terciario">(opcional)</span>}</label>
          <textarea id="pn-pautas" class="entrada" rows={5} maxLength={4000} value={f.pautas} onInput={(e) => cambiar({ pautas: e.currentTarget.value })}
            placeholder="Cómo repartir las comidas, raciones, qué hacer si come fuera… Una idea por línea." /></div>
        {!nuevo && <div class="campo"><label for="pn-motivo">Por qué cambia <span class="terciario">(lo verá el atleta)</span></label>
          <input id="pn-motivo" class="entrada" maxLength={280} value={f.motivo} onInput={(e) => cambiar({ motivo: e.currentTarget.value })} placeholder="Ajuste: dos semanas sin bajar" /></div>}
        {error && <div class="error" role="alert">{error}</div>}
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{nuevo ? 'Crear el plan' : f.desde > hoyISO() ? `Guardar (empieza el ${fmtConDia(f.desde)})` : 'Guardar el plan'}</button>
      </form>
    </Hoja>
  );
}

// Punto de partida: Mifflin-St Jeor × actividad, más o menos lo del ritmo; proteína y grasa por kg y el resto en
// hidratos. Lo que se escribe aquí no se guarda (solo las cifras que elijas para el plan).
function Calculadora({ pesoKg, fase, ritmo, modo, alUsar }) {
  const [c, setC] = useState({ sexo: 'mujer', edad: 30, altura: 165, peso: pesoKg ? Math.round(pesoKg * 10) / 10 : 65, actividad: 1.55, proteina: null });
  const cambiar = (x) => setC((y) => ({ ...y, ...x }));
  // Mientras no la toques, la proteína es la recomendada para la fase (2 g/kg en déficit, 1,8 si no)
  const proteina = c.proteina ?? proteinaPorKg(fase);
  const p = planInicial({ ...c, proteinaGkg: proteina, fase, ritmo: ritmo ?? 0, modo: modo === 'macros' ? 'macros' : 'kcal_proteina' });
  return (
    <div class="pila-s calculadora">
      <div class="campo"><span class="etq">Sexo</span><Segmentos etiqueta="Sexo" valor={c.sexo} opciones={[['mujer', 'Mujer'], ['hombre', 'Hombre']]} alCambiar={(v) => v && cambiar({ sexo: v })} /></div>
      <div class="rejilla-campos">
        <div class="campo"><label for="calc-edad">Edad</label><Paso id="calc-edad" valor={c.edad} paso={1} min={18} max={100} dec={0} etiqueta="años" alCambiar={(v) => cambiar({ edad: v })} /></div>
        <div class="campo"><label for="calc-altura">Altura (cm)</label><Paso id="calc-altura" valor={c.altura} paso={1} min={120} max={230} dec={0} etiqueta="centímetros" alCambiar={(v) => cambiar({ altura: v })} /></div>
        <div class="campo"><label for="calc-peso">Peso (kg)</label><Paso id="calc-peso" valor={c.peso} paso={0.5} min={30} max={300} dec={1} etiqueta="kilos" alCambiar={(v) => cambiar({ peso: v })} /></div>
        <div class="campo"><label for="calc-prot">Proteína (g/kg)</label><Paso id="calc-prot" valor={proteina} paso={0.1} min={1.2} max={3} dec={1} etiqueta="gramos de proteína por kilo" alCambiar={(v) => cambiar({ proteina: v })} /></div>
      </div>
      <div class="campo"><span class="etq">Actividad</span>
        <Segmentos etiqueta="Actividad" clase="segmentos-actividad" valor={c.actividad} opciones={NIVELES_ACTIVIDAD.map(([v, t, ayuda]) => [v, t, ayuda])} alCambiar={(v) => v && cambiar({ actividad: v })} />
        <span class="ayuda">{NIVELES_ACTIVIDAD.find(([v]) => v === c.actividad)?.[2]}</span></div>
      {p && (
        <div class="nota pila-xs">
          <span>Basal {fmtKcal(p.basal)} kcal × {num(c.actividad, 2)} = mantenimiento de unas <b>{fmtKcal(p.mantenimiento)} kcal</b>.</span>
          <span>Para {textoRitmo(ritmo ?? 0)}: <b>{fmtKcal(p.kcal)} kcal</b>, {p.proteina_g} g de proteína{p.carbos_g != null ? `, ${p.carbos_g} g de hidratos y ${p.grasa_g} g de grasa` : ''}.</span>
          {p.pesoReferencia && <span class="mini secundario">Proteína y grasa calculadas sobre {num(p.pesoReferencia, 1)} kg (el peso de un IMC de 25), para no disparar la proteína.</span>}
          <span class="mini terciario">Es un punto de partida (Mifflin-St Jeor, 1990, validada de 19 a 78 años): con 3–4 semanas de registro, el gasto real lo afina.</span>
        </div>
      )}
      <button type="button" class="btn" disabled={!p} onClick={() => alUsar(p)}><Icono n="hecho" /> Usar estas cifras</button>
    </div>
  );
}
