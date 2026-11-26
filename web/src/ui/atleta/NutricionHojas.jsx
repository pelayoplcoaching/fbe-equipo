// (v0.208, rendimiento) Las hojas de la nutrición de Hoy (apuntar el día y tu plan), aparte de la tarjeta: solo se cargan al
// abrirlas.
import { Imagen } from '../Imagen.jsx';
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Paso, Segmentos, usePreferencia } from '../comunes.jsx';
import { TarjetaPlan, GraficaIngesta, GraficaProteina, NOMBRE_ESTADO_DIA, MacrosDia } from '../NutricionComun.jsx';
import { fmtKcal, kcalDeMacros, objetivoDelDia, planVigente, NOMBRE_CUMPLIDO } from '../../logica/nutricion.js';
import { hoyISO, sumarDias, fmtConDia, lunesDe, diasEntre } from '../../logica/fechas.js';
import { LETRAS_DIA } from '../../logica/plan.js';
import { num, signo } from '../../logica/calculos.js';
import { SumarProducto } from './Productos.jsx';
import { sumarAlDia, totalSumado, textoSumado } from '../../logica/alimentos.js';
import { SiCasiNo } from './Nutricion.jsx';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { perezoso } from '../perezoso.jsx';
// (FBE Esencial, 093) rehacer el plan de comida (su trozo)
// (v0.252) rehacerlo: con la 105, el cuestionario de nutrición; sin ella, la hoja de la 093 (EsencialComida.jsx decide)
const HojaRehacerComida = perezoso(() => import('./EsencialComida.jsx'), 'HojaRehacerComida', { mientras: null });

// Apuntar un día (hoy o uno de esta semana): los totales, o sí/casi/no si va sin contar
export function HojaNutricion({ r, alCerrar, alGuardar, diaInicial = null }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [dia, setDia] = useState(diaInicial || hoy);
  const delDia = (iso) => r.registros.find((x) => x.fecha === iso) || null;
  const vacio = (x) => ({ kcal: x?.kcal ?? null, proteina_g: x?.proteina_g ?? null, carbos_g: x?.carbos_g ?? null, grasa_g: x?.grasa_g ?? null, fibra_g: x?.fibra_g ?? null, completo: x ? x.completo !== false : true, cumplido: x?.cumplido ?? null, nota: x?.nota ?? '' });
  const [f, setF] = useState(() => vacio(delDia(dia)));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const plan = planVigente(r.planes, dia);
  const obj = objetivoDelDia(plan, r.entrenos.has(dia));
  const macros = plan?.modo === 'macros';
  const sinContar = !plan || plan.modo === 'sin_contar';
  // (escáner) lo sumado con productos en esta hoja: se puede quitar; al quitar el último, vuelve lo que había antes
  const [producto, setProducto] = useState(false);
  const [sumados, setSumados] = useState([]);
  const [antes, setAntes] = useState(null);
  const camposVisibles = ['kcal', 'proteina_g', ...(macros ? ['carbos_g', 'grasa_g'] : []), ...(plan?.fibra_g != null ? ['fibra_g'] : [])];
  const elegirDia = (iso) => { setDia(iso); setF(vacio(delDia(iso))); setError(null); setSumados([]); setAntes(null); setProducto(false); };
  const alSumar = (x) => {
    if (!sumados.length) setAntes(f);
    setF((y) => sumarAlDia(y, x.m, camposVisibles, 1));
    setSumados((l) => [...l, { ...x, id: `${Date.now()}-${l.length}` }]);
    setProducto(false);
    aviso(`Sumado: ${x.nombre} (${x.m.kcal ?? 0} kcal)`);
  };
  const quitarSumado = (x) => {
    const resto = sumados.filter((y) => y.id !== x.id);
    setSumados(resto);
    if (!resto.length && antes) { setF(antes); setAntes(null); } else setF((y) => sumarAlDia(y, x.m, camposVisibles, -1));
  };
  // Los 7 últimos días (el lunes se puede apuntar aún el domingo); sin plan ese día, nada que apuntar
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
  const ayer = delDia(sumarDias(dia, -1));
  const kcalMacros = f.proteina_g != null && f.carbos_g != null && f.grasa_g != null ? kcalDeMacros(f.proteina_g, f.carbos_g, f.grasa_g) : null;
  const cambiar = (c) => setF((x) => ({ ...x, ...c }));
  const guardar = async (datos) => {
    setError(null);
    const d = { ...datos };
    // Sin kcal pero con los tres macros: las kcal salen de ellos
    if (!sinContar && d.kcal == null && kcalMacros != null) d.kcal = kcalMacros;
    if (!sinContar && d.kcal == null && d.proteina_g == null) { setError('Apunta al menos las kcal o la proteína.'); return; }
    setOcupado(true);
    try {
      await api.apuntarNutricion(atleta.id, dia, d);
      aviso(dia === hoy ? 'Apuntado' : `Apuntado el ${fmtConDia(dia)}`);
      alGuardar(); alCerrar();
    } catch (e) { setError(e.message); setOcupado(false); }
  };
  const borrar = async () => {
    setOcupado(true);
    try { await api.apuntarNutricion(atleta.id, dia, null); aviso('Borrado'); alGuardar(); alCerrar(); } catch (e) { setError(e.message); setOcupado(false); }
  };
  return (
    <Hoja titulo="Apuntar la nutrición" alCerrar={alCerrar}>
      <div class="semana-habito" role="group" aria-label="Día que apuntas">
        {dias.map((iso) => {
          const x = delDia(iso);
          return (
            <button key={iso} type="button" disabled={ocupado || !planVigente(r.planes, iso)} aria-pressed={iso === dia ? 'true' : 'false'} onClick={() => elegirDia(iso)}
              class={`${x ? 'cumple' : ''} ${iso === hoy ? 'hoy' : ''}`} style={{ '--c': 'var(--morado)' }}
              aria-label={`${fmtConDia(iso)}${x ? (x.kcal != null ? `: ${fmtKcal(x.kcal)} kcal` : `: ${NOMBRE_CUMPLIDO[x.cumplido] || 'apuntado'}`) : ''}`}>
              <span aria-hidden="true">{LETRAS_DIA[diasEntre(lunesDe(iso), iso)]}</span>
              <span class="punto-dia" aria-hidden="true">{x ? <Icono n="hecho" /> : null}</span>
            </button>
          );
        })}
      </div>
      <p class="etq">{dia === hoy ? 'Hoy' : fmtConDia(dia).replace(/^./, (c) => c.toUpperCase())}{obj ? `: ${obj.descanso ? 'día de descanso' : plan.kcal_descanso != null ? 'día de entreno' : 'objetivo'}, ${fmtKcal(obj.kcal)} kcal y ${obj.proteina} g de proteína` : ''}</p>
      {sinContar ? (
        <>
          <SiCasiNo valor={f.cumplido} ocupado={ocupado} alElegir={(v) => guardar({ cumplido: v, nota: f.nota })} />
        </>
      ) : producto ? (
        <SumarProducto alSumar={alSumar} alVolver={() => setProducto(false)} />
      ) : (
        <>
          {ayer && !delDia(dia) && ayer.kcal != null && !sumados.length && (
            <button class="btn btn-peq plano" onClick={() => setF(vacio({ ...ayer, nota: '' }))}><Icono n="copiar" /> Copiar lo del día anterior ({fmtKcal(ayer.kcal)} kcal)</button>
          )}
          <div class="rejilla-campos">
            <div class="campo"><label for="nut-kcal">Kcal</label>
              <Paso id="nut-kcal" valor={f.kcal} paso={50} min={0} max={15000} dec={0} etiqueta="kcal" alCambiar={(v) => cambiar({ kcal: v })} />
              {f.kcal == null && kcalMacros != null && <span class="ayuda">Con tus macros salen {fmtKcal(kcalMacros)}.</span>}
            </div>
            <div class="campo"><label for="nut-prot">Proteína (g)</label><Paso id="nut-prot" valor={f.proteina_g} paso={5} min={0} max={1500} dec={0} etiqueta="gramos de proteína" alCambiar={(v) => cambiar({ proteina_g: v })} /></div>
            {macros && <div class="campo"><label for="nut-carb">Hidratos (g)</label><Paso id="nut-carb" valor={f.carbos_g} paso={5} min={0} max={2500} dec={0} etiqueta="gramos de hidratos" alCambiar={(v) => cambiar({ carbos_g: v })} /></div>}
            {macros && <div class="campo"><label for="nut-grasa">Grasa (g)</label><Paso id="nut-grasa" valor={f.grasa_g} paso={5} min={0} max={1000} dec={0} etiqueta="gramos de grasa" alCambiar={(v) => cambiar({ grasa_g: v })} /></div>}
            {plan?.fibra_g != null && <div class="campo"><label for="nut-fibra">Fibra (g)</label><Paso id="nut-fibra" valor={f.fibra_g} paso={1} min={0} max={300} dec={0} etiqueta="gramos de fibra" alCambiar={(v) => cambiar({ fibra_g: v })} /></div>}
          </div>
          {/* (escáner) para quien no cuenta con otra app: el código de barras de lo que ha comido suma a los totales */}
          <button type="button" class="btn btn-peq plano sumar-producto-btn" disabled={ocupado} onClick={() => setProducto(true)}><Icono n="camara" /> Sumar un producto (código de barras)</button>
          {sumados.length > 0 && (
            <section class="pila-xs" aria-labelledby="nut-sumados-t">
              <h3 class="etq" id="nut-sumados-t">Sumado con productos: {totalSumado(sumados).kcal} kcal</h3>
              <ul class="sumados">
                {sumados.map((x) => (
                  <li key={x.id}>
                    <span class="peq">{x.nombre} <span class="terciario">· {textoSumado(x.m, x.gramos, x.unidad)}</span></span>
                    <button type="button" class="btn btn-icono plano" aria-label={`Quitar ${x.nombre}`} onClick={() => quitarSumado(x)}><Icono n="cerrar" /></button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <label class="casilla">
            <input type="checkbox" checked={!f.completo} onChange={(e) => cambiar({ completo: !e.currentTarget.checked })} />
            <span>Me dejé algo sin apuntar <span class="mini terciario">(ese día no cuenta para calcular tu gasto)</span></span>
          </label>
        </>
      )}
      {!(producto && !sinContar) && (
        <>
          <div class="campo"><label for="nut-nota">Nota <span class="terciario">(opcional)</span></label>
            <input id="nut-nota" class="entrada" maxLength={280} value={f.nota} onInput={(e) => cambiar({ nota: e.currentTarget.value })} placeholder="Comida fuera, cumpleaños, mucha hambre…" />
          </div>
          {error && <div class="error" role="alert">{error}</div>}
          {!sinContar && <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={() => guardar(f)}>Guardar</button>}
          {sinContar && f.cumplido != null && <button class="btn btn-grande" disabled={ocupado} onClick={() => guardar({ cumplido: f.cumplido, nota: f.nota })}>Guardar la nota</button>}
          {delDia(dia) && <button class="btn plano" disabled={ocupado} onClick={borrar}>Borrar lo de este día</button>}
        </>
      )}
    </Hoja>
  );
}

// Su plan: cifras, pautas y por qué cambió. (FBE Esencial, 093) quien va por su cuenta lo puede rehacer (otro objetivo o
// sus datos corregidos): la app lo vuelve a calcular.
export function HojaTuPlan({ r, alCerrar, alCambiar = null }) {
  const { atleta } = useApp();
  const suyo = esPorSuCuenta(atleta);
  const [rehacer, setRehacer] = useState(false);
  const plan = r.plan || r.siguiente;
  if (rehacer) return <HojaRehacerComida pesoKg={r.pesoKg} actual={r.plan} alCerrar={() => setRehacer(false)} alGuardar={() => { setRehacer(false); alCambiar?.(); alCerrar(); }} />;
  return (
    <Hoja titulo="Tu plan de nutrición" alCerrar={alCerrar}>
      <TarjetaPlan plan={r.plan} siguiente={r.siguiente} diasEntreno={r.diasEntreno} />
      {plan?.pautas && (
        <section class="pila-s">
          <Imagen id="nutricion-pautas" clase="franja-ilu franja-hoja franja-pautas" tamanos="(min-width: 640px) 560px, 92vw" />
          <h3 class="etq">{suyo ? 'Pautas' : 'Pautas de tu coach'}</h3>
          <div class="pautas">{plan.pautas.split('\n').filter((l) => l.trim()).map((l, i) => <p key={i}>{l}</p>)}</div>
        </section>
      )}
      {plan && plan.modo !== 'sin_contar' && <p class="mini terciario">Apunta los totales del día de la app que uses (MyFitnessPal, Fitia, Yazio…) o suma lo que comas escaneando su código de barras. Si un día se te olvida algo, márcalo: así {suyo ? 'la app calcula' : 'tu coach calcula'} bien tu gasto.</p>}
      {suyo && r.plan && <button class="btn plano" onClick={() => setRehacer(true)}><Icono n="editar" /> Cambiar mi objetivo o mis datos</button>}
    </Hoja>
  );
}
