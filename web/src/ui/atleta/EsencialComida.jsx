// FBE Esencial con nutrición (tanda 4, migración 093): el plan de comida de partida, con sus datos, y el ajuste de cada
// semana, solos. En su propio trozo (Nutricion.jsx lo carga solo para quien va por su cuenta y lleva nutrición).
import { useState, useEffect } from 'preact/hooks';
import { useApp, Icono, Hoja, Paso, Segmentos } from '../comunes.jsx';
import { planComidaEsencial, datosComidaValidos, ajusteComidaEsencial, NIVELES_ACTIVIDAD, OBJETIVOS_COMIDA } from '../../logica/esencial-nutricion.js';
import { fmtKcal } from '../../logica/nutricion.js';
import { hoyISO } from '../../logica/fechas.js';
// (v0.250, tanda 9) el ajuste con sus dos reglas nuevas (apagadas: viaje y celebraciones) y qué cambia al cambiar de objetivo
import { ajusteConReglas, momentoViaje, cambioDeObjetivo } from '../../logica/esencial-comida.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import * as datosEsencial from '../../datos/api-esencial.js';
// (102 y 109) lo de Hoy debajo de «Nutrición de hoy» (su propio trozo)
import { perezoso } from '../perezoso.jsx';
const ComidaHoyEsencial = perezoso(() => import('./EsencialComidaMas.jsx'), 'ComidaHoyEsencial', { mientras: null });
const previaDemo = (modo) => { try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; } };

// Lo que es el ritmo en gramos a la semana (de 10 en 10): 68,4 kg al −0,5 % → unos 340 g
const gramosSemana = (peso, ritmo) => Math.round((Number(String(peso).replace(',', '.')) * Math.abs(Number(ritmo)) * 10) / 10) * 10;

// En Hoy, sin plan: la tarjeta para prepararlo
export function PlanComidaEsencial({ pesoKg = null, alGuardar }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <section class="seccion seccion-nutricion">
      <div class="seccion-cab"><h2>Tu plan de comida</h2></div>
      <div class="panel panel-pad pila-s">
        <p class="peq">Contesta unas preguntas y la app te calcula tus calorías, tu proteína, tus hidratos y tu grasa. Cada semana los ajusta con lo que apuntas que comes y con tu peso.</p>
        <button class="btn btn-primario" onClick={() => setAbierta(true)}><Icono n="nutricion" /> Preparar mi plan</button>
      </div>
      {abierta && <HojaPlanComida pesoKg={pesoKg} alCerrar={() => setAbierta(false)} alGuardar={() => { setAbierta(false); alGuardar?.(); }} />}
    </section>
  );
}

// Las preguntas, lo que sale y «Guardar mi plan» (la base lo vuelve a calcular igual). También para rehacerlo.
export function HojaPlanComida({ pesoKg = null, actual = null, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [d, setD] = useState({ sexo: null, edad: null, altura: null, peso: pesoKg ? Math.round(Number(pesoKg) * 10) / 10 : null, actividad: 1.4, objetivo: null, tca: null });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const cambiar = (x) => { setD((y) => ({ ...y, ...x })); setError(null); };
  const falta = datosComidaValidos(d);
  const plan = falta ? null : planComidaEsencial(d);
  const guardar = async (ev) => {
    ev.preventDefault();
    if (falta) { setError(falta); return; }
    setOcupado(true);
    try {
      await api.esencialPlanComida(d);
      aviso('Tu plan de comida está listo');
      alGuardar?.();
    } catch (e) { setError(e.message); } finally { setOcupado(false); }
  };
  return (
    <Hoja titulo="Tu plan de comida" alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar} noValidate>
        <div class="campo"><span class="etq">Sexo</span><Segmentos etiqueta="Sexo" valor={d.sexo} opciones={[['mujer', 'Mujer'], ['hombre', 'Hombre']]} alCambiar={(v) => v && cambiar({ sexo: v })} />
          <span class="ayuda">Lo usa la fórmula del gasto (Mifflin-St Jeor).</span></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="ec-edad">Edad</label><Paso id="ec-edad" valor={d.edad} paso={1} min={18} max={90} dec={0} etiqueta="años" alCambiar={(v) => cambiar({ edad: v })} /></div>
          <div class="campo"><label for="ec-altura">Altura (cm)</label><Paso id="ec-altura" valor={d.altura} paso={1} min={130} max={220} dec={0} etiqueta="centímetros" alCambiar={(v) => cambiar({ altura: v })} /></div>
          <div class="campo"><label for="ec-peso">Peso (kg)</label><Paso id="ec-peso" valor={d.peso} paso={0.5} min={35} max={250} dec={1} etiqueta="kilos" alCambiar={(v) => cambiar({ peso: v })} /></div>
        </div>
        <div class="campo"><span class="etq">Cuánto te mueves</span>
          <Segmentos etiqueta="Cuánto te mueves" clase="segmentos-actividad" valor={d.actividad} opciones={NIVELES_ACTIVIDAD.map(([v, t, ayuda]) => [v, t, ayuda])} alCambiar={(v) => v && cambiar({ actividad: v })} />
          <span class="ayuda">{NIVELES_ACTIVIDAD.find(([v]) => v === d.actividad)?.[2]}</span></div>
        <div class="campo"><span class="etq">Tu objetivo</span><Segmentos etiqueta="Tu objetivo" valor={d.objetivo} opciones={OBJETIVOS_COMIDA} alCambiar={(v) => v && cambiar({ objetivo: v })} /></div>
        <div class="campo"><span class="etq">¿Tienes o has tenido un trastorno de la conducta alimentaria?</span>
          <Segmentos etiqueta="Trastorno de la conducta alimentaria" valor={d.tca == null ? null : d.tca ? 'si' : 'no'} opciones={[['no', 'No'], ['si', 'Sí']]} alCambiar={(v) => v && cambiar({ tca: v === 'si' })} />
          <span class="ayuda">Anorexia, bulimia, atracones u otro. Si es que sí, tu plan será para mantener tu peso y nunca bajará solo: háblalo con tu médico. Es un dato de salud: solo lo veis tú y Pelayo.</span></div>
        {plan && (
          <div class="nota pila-xs" aria-live="polite">
            <span>Tu plan: <b class="num">{fmtKcal(plan.kcal)} kcal</b> al día, con <b class="num">{plan.proteina_g} g</b> de proteína, <b class="num">{plan.carbos_g} g</b> de hidratos y <b class="num">{plan.grasa_g} g</b> de grasa.</span>
            {actual && cambioDeObjetivo(actual, plan) && <span class="mini">{cambioDeObjetivo(actual, plan)}</span>}
            <span class="mini secundario">{plan.fase === 'mantener' ? 'Para mantener tu peso' : `Para ${plan.fase === 'perder' ? 'bajar un 0,5' : 'subir un 0,25'} % de tu peso a la semana (unos ${gramosSemana(d.peso, plan.ritmo_pct)} g)`}; tu gasto de partida, unas {fmtKcal(plan.mantenimiento)} kcal. Con unas semanas apuntando lo que comes y tu peso, la app lo afina sola.</span>
          </div>
        )}
        {error && <div class="error" role="alert">{error}</div>}
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar mi plan'}</button>
      </form>
    </Hoja>
  );
}

// Con plan: el ajuste de la semana, una vez al día como mucho (si toca y cabe en los topes, lo guarda y lo cuenta)
export function AjusteComidaEsencial({ r, alCambiar }) {
  const { api, backend, atleta, aviso, modo } = useApp();
  const hoy = hoyISO();
  useEffect(() => {
    if (!r?.plan || !atleta?.id) return;
    const previa = previaDemo(modo);
    const clave = `fbe-esencial-comida:${atleta.id}:${hoy}`;
    try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch { /* sin almacenamiento: se intenta igual */ }
    let vivo = true;
    (async () => {
      const tca = await api.esencialTca(atleta.id).catch(() => null);
      // (v0.250, P) de viaje y la semana de la vuelta, no ajusta; y el peso de una celebración y de los dos días siguientes
      // no cuenta. Las dos reglas, apagadas hasta que Pelayo las vea (sin ellas, el ajuste de siempre)
      const viaje = encendido('comida_viaje', previa) ? ((await datosEsencial.notas(backend, atleta.id, 'viaje').catch(() => null)) || []).map((n) => momentoViaje(n, hoy)).find(Boolean) || null : null;
      const celebraciones = encendido('celebracion', previa) ? ((await datosEsencial.notas(backend, atleta.id, 'celebracion').catch(() => null)) || []).map((n) => n.desde).filter(Boolean) : [];
      const a = viaje || celebraciones.length ? ajusteConReglas(r, { hoy, tca: tca === true, viaje, celebraciones })
        : ajusteComidaEsencial({ plan: r.plan, gasto: r.gasto, pesoKg: r.pesoKg, diasEntreno: r.diasEntreno ?? 2, tca: tca === true, hoy });
      if (!a || !vivo) return;
      const id = await api.esencialAjusteComida(a).catch(() => null);
      if (id && typeof id === 'string' && vivo) {
        aviso(`Tu plan de comida cambia: ${a.delta > 0 ? 'sube' : 'baja'} a ${fmtKcal(a.kcal)} kcal`);
        alCambiar?.();
      }
    })();
    return () => { vivo = false; };
  }, [r?.plan?.id, atleta?.id]);
  // (v0.250) y, debajo, por qué no cambia su plan y la comida de viaje
  return <ComidaHoyEsencial r={r} />;
}
