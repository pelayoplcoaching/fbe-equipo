// Nutrición del atleta (como MacroFactor o Carbon, pero con su coach detrás): en Hoy, lo que lleva del día
// frente a lo que toca; apuntar en segundos (los totales de la app con la que cuente, o «¿has seguido el
// plan?» si va sin contar); su plan con las pautas, y en Progreso, sus semanas y su gasto estimado.
import { Imagen } from '../Imagen.jsx';
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Paso, Segmentos, usePreferencia } from '../comunes.jsx';
import { TarjetaPlan, GraficaIngesta, GraficaProteina, NOMBRE_ESTADO_DIA, MacrosDia } from '../NutricionComun.jsx';
import { fmtKcal, kcalDeMacros, objetivoDelDia, planVigente, NOMBRE_CUMPLIDO } from '../../logica/nutricion.js';
import { hoyISO, sumarDias, fmtConDia, lunesDe, diasEntre } from '../../logica/fechas.js';
import { LETRAS_DIA } from '../../logica/plan.js';
import { num, signo } from '../../logica/calculos.js';
import { perezoso } from '../perezoso.jsx';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { conNutricion } from '../../logica/nivel.js';
// (v0.208, rendimiento) Las hojas de apuntar la nutrición y de tu plan (con el escáner de productos), al abrirlas
const HojaNutricion = perezoso(() => import('./NutricionHojas.jsx'), 'HojaNutricion', { mientras: null });
const HojaTuPlan = perezoso(() => import('./NutricionHojas.jsx'), 'HojaTuPlan', { mientras: null });
// (FBE Esencial, 093) quien va por su cuenta y lleva nutrición: su plan de comida lo calcula y lo ajusta la app (su trozo)
const PlanComidaEsencial = perezoso(() => import('./EsencialComida.jsx'), 'PlanComidaEsencial', { mientras: null });
const AjusteComidaEsencial = perezoso(() => import('./EsencialComida.jsx'), 'AjusteComidaEsencial', { mientras: null });

// Anillo de las kcal del día (se llena hasta el objetivo; pasado el 110 %, en aviso)
// En Hoy: la tarjeta del día. entrenaHoy: si hoy hay sesión (prevista o hecha), cuenta como día de entreno; con
// días de descanso distintos, el atleta lo puede cambiar (quien no planifica la semana entrena cuando puede).
export function NutricionHoy({ entrenaHoy = false }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [elegido, setElegido] = usePreferencia(`fbe-nut-dia-${hoy}`, null);
  const entrena = elegido ? elegido === 'entreno' : entrenaHoy;
  const res = useCarga(() => api.resumenNutricion(atleta.id, hoy, { entrenaHoy: entrena }).catch(() => null), [atleta.id, entrena], { recuerdo: `nutricion-hoy:${atleta.id}:${hoy}:${entrena}` });
  const [hoja, setHoja] = useState(null); // null | 'apuntar' | 'plan'
  const r = res.datos;
  // (FBE Esencial) sin plan, la tarjeta para prepararlo va arriba en Hoy (ComidaEsencialPendiente); aquí, nada
  const suyo = esPorSuCuenta(atleta) && conNutricion(atleta);
  if (!r || (!r.plan && !r.siguiente)) return null;
  const plan = r.plan;
  const obj = r.objetivoHoy;
  const reg = r.hoy;
  const sinContar = !plan || plan.modo === 'sin_contar';
  const recargar = () => res.recargar(true);
  return (
    <section class="seccion seccion-nutricion">
      <div class="seccion-cab">
        <h2>Nutrición de hoy</h2>
        <button class="btn-texto" aria-label="Tu plan de nutrición" onClick={() => setHoja('plan')}><Icono n="nutricion" /> Tu plan</button>
      </div>
      {!plan ? (
        <div class="panel panel-pad"><p class="peq secundario">{esPorSuCuenta(atleta) ? 'Tu plan empieza' : 'Tu coach te ha preparado un plan que empieza'} el {fmtConDia(r.siguiente.desde)}.</p></div>
      ) : sinContar ? (
        <div class="panel panel-pad pila-s">
          <p class="peq">¿Has seguido tu plan hoy?</p>
          <SiCasiNo valor={reg?.cumplido ?? null} alElegir={async (v) => {
            // (pulido 5) lo elegido se marca al momento y se guarda por detrás (si no se puede guardar, se desmarca y se avisa)
            try { await res.alMomento((x) => ({ ...x, hoy: { ...(x.hoy || {}), cumplido: v } }), () => api.apuntarNutricion(atleta.id, hoy, { cumplido: v })); aviso(v === 2 ? '¡Bien!' : 'Apuntado'); } catch (e) { aviso(e.message, 'error'); }
          }} />
          <span class="fila-envolver">
            <button class="btn-texto" onClick={() => setHoja('apuntar')}><Icono n="calendario" /> Otro día o una nota</button>
            <button class="btn-texto" onClick={() => setHoja('plan')}>Ver tus pautas</button>
          </span>
        </div>
      ) : (
        <div class="panel panel-pad pila-s">
          {plan.kcal_descanso != null && (
            <Segmentos etiqueta="Qué día es hoy" clase="segmentos-dia" valor={obj.descanso ? 'descanso' : 'entreno'}
              opciones={[['entreno', 'Hoy entreno'], ['descanso', 'Hoy descanso']]} alCambiar={(v) => v && setElegido(v)} />
          )}
          <button class="nutricion-hoy con-cifras" onClick={() => setHoja('apuntar')}
            aria-label={`Nutrición de hoy: ${reg?.kcal != null ? `${fmtKcal(reg.kcal)} de ${fmtKcal(obj.kcal)} kcal` : `sin apuntar, objetivo ${fmtKcal(obj.kcal)} kcal`}${reg?.proteina_g != null ? `, proteína ${num(reg.proteina_g, 0)} de ${obj.proteina} g` : ''}. Apuntar`}>
            {/* v0.50: la barra de kcal y los tres anillos de macros, con su valor y su objetivo */}
            <MacrosDia reg={reg} obj={obj} />
            <span class="mini terciario nutricion-hoy-pie"><Icono n="editar" />{reg ? 'Toca para corregir o completar' : 'Toca para apuntar lo de hoy'}</span>
          </button>
        </div>
      )}
      {suyo && plan && <AjusteComidaEsencial r={r} alCambiar={recargar} />}
      {hoja === 'apuntar' && <HojaNutricion r={r} alCerrar={() => setHoja(null)} alGuardar={recargar} />}
      {hoja === 'plan' && <HojaTuPlan r={r} alCerrar={() => setHoja(null)} alCambiar={recargar} />}
    </section>
  );
}

// (FBE Esencial, 093) En Hoy, arriba: quien va por su cuenta y lleva nutrición, mientras no tenga plan de comida, la tarjeta
// para prepararlo (al guardarlo, se recarga lo de Hoy y aparece «Nutrición de hoy»)
export function ComidaEsencialPendiente() {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const res = useCarga(() => api.resumenNutricion(atleta.id, hoy, { entrenaHoy: false }).catch(() => null), [atleta.id], { recuerdo: `nutricion-hoy:${atleta.id}:${hoy}:false` });
  const r = res.datos;
  if (!r || r.plan || r.siguiente) return null;
  const listo = () => { window.dispatchEvent(new CustomEvent('fbe-recargar', { detail: { esperas: [] } })); res.recargar(true); };
  return <PlanComidaEsencial pesoKg={r.pesoKg} alGuardar={listo} />;
}

export function SiCasiNo({ valor, alElegir, ocupado = false }) {
  return (
    <div class="si-casi-no" role="group" aria-label="¿Has seguido tu plan?">
      {[[2, 'Sí'], [1, 'Casi'], [0, 'No']].map(([v, t]) => (
        <button key={v} type="button" class={`btn ${Number(valor) === v && valor != null ? `elegido-${v}` : ''}`} aria-pressed={valor != null && Number(valor) === v ? 'true' : 'false'} disabled={ocupado} onClick={() => alElegir(v)}>{t}</button>
      ))}
    </div>
  );
}


// En Progreso: las 4 últimas semanas, cada día frente a lo que tocaba, y el gasto estimado
export function NutricionProgreso() {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.resumenNutricion(atleta.id).catch(() => null), [atleta.id]);
  const r = res.datos;
  if (!r || !r.planes.length) return null;
  const semanas = [r.semana, ...r.anteriores].reverse();
  const dias = semanas.flatMap((w) => w.dias).filter((d) => !d.futuro).slice(-28)
    .map((d) => ({ iso: d.iso, kcal: d.reg?.kcal != null ? Number(d.reg.kcal) : null, objetivo: d.obj?.kcal ?? null, estado: d.estado,
      // (v0.204) la proteína, para su barra junto a la de las calorías
      prot: d.reg?.proteina_g != null ? Number(d.reg.proteina_g) : null, objProt: d.obj?.proteina ?? null }));
  const conCifras = r.plan && r.plan.modo !== 'sin_contar';
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Tu nutrición</h2><span class="peq secundario">Últimas 4 semanas</span></div>
      <div class="panel panel-pad pila">
        {conCifras && <h3 class="sub-seccion">Calorías</h3>}
        {conCifras ? <GraficaIngesta dias={dias} /> : (
          <div class="tira-cumplido" role="img" aria-label={`Has seguido el plan ${dias.filter((d) => d.estado === 'si').length} de los últimos ${dias.length} días`}>
            {dias.map((d) => <i key={d.iso} class={d.estado} title={`${fmtConDia(d.iso)}: ${NOMBRE_ESTADO_DIA[d.estado]}`} />)}
          </div>
        )}
        {conCifras && dias.some((d) => d.prot != null) && (
          <>
            <h3 class="sub-seccion">Proteína</h3>
            <GraficaProteina dias={dias.map((d) => ({ iso: d.iso, prot: d.prot, objetivo: d.objProt, estado: d.estado }))} />
          </>
        )}
        <div class="tabla-desliza" tabIndex={0} role="region" aria-label="Semanas de nutrición">
        <table class="tabla-nutricion num">
          <thead><tr><th scope="col">Semana</th><th scope="col">Días</th>{conCifras && <th scope="col">Kcal (obj.)</th>}{conCifras && <th scope="col">Prot.</th>}<th scope="col">Bien</th></tr></thead>
          <tbody>
            {[r.semana, ...r.anteriores].map((w) => (
              <tr key={w.lunes}>
                <th scope="row">{fmtConDia(w.lunes).replace(/^\w+ /, '')}</th>
                <td>{w.registrados}/{w.transcurridos}</td>
                {conCifras && <td>{w.mediaKcal != null ? fmtKcal(w.mediaKcal) : '—'}{w.objetivoKcal ? <span class="terciario"> / {fmtKcal(w.objetivoKcal)}</span> : ''}</td>}
                {conCifras && <td>{w.mediaProteina != null ? `${w.mediaProteina} g` : '—'}</td>}
                <td>{w.enObjetivo}{w.casi ? <span class="terciario"> (+{w.casi} cerca)</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {conCifras && (r.gasto.kcal != null ? (
          <div class="gasto-atleta pila-xs">
            <span class="peq"><strong>Tu gasto estimado: unas {fmtKcal(r.gasto.kcal)} kcal al día</strong> <span class="terciario">(±{r.gasto.margen})</span></span>
            <span class="mini terciario">Sale de lo que has comido ({fmtKcal(r.gasto.ingesta)} kcal de media) y de cómo ha cambiado tu peso ({signo(r.gasto.kgSemana, 2)} kg a la semana) en 4 semanas. {esPorSuCuenta(atleta) ? 'La app ajusta tu plan con esto cada semana.' : 'Tu coach ajusta el plan con esto.'}</span>
          </div>
        ) : <p class="mini terciario">Tu gasto estimado aparecerá con unas semanas de registro: necesita {r.gasto.falta}.</p>)}
      </div>
    </section>
  );
}
