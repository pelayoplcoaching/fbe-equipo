// Piezas de nutrición que comparten el atleta y el coach: el plan en una tarjeta, las barras de macros y la
// gráfica de lo comido cada día frente a lo que tocaba.
import { useAncho, Icono } from './comunes.jsx';
import { fmtCorta, fmtConDia, diasEntre } from '../logica/fechas.js';
import { NOMBRE_FASE, fmtKcal, kcalMediaPlan } from '../logica/nutricion.js';
import { num } from '../logica/calculos.js';

export const COLOR_MACRO = { kcal: 'var(--morado)', proteina: 'var(--disco-rojo)', carbos: 'var(--disco-amarillo)', grasa: 'var(--disco-azul)' };
export const NOMBRE_ESTADO_DIA = { si: 'en objetivo', casi: 'cerca', no: 'lejos del objetivo', en_curso: 'en curso', incompleto: 'a medias (no cuenta)', dato: 'apuntado', sin_dato: 'sin apuntar' };

// «−0,5 % a la semana»
export const textoRitmoCorto = (r) => (r == null ? null : Number(r) === 0 ? 'mantener el peso' : `${Number(r) > 0 ? '+' : '−'}${num(Math.abs(Number(r)), 2)} % a la semana`);

// Resumen del plan en una línea: «1895 kcal (descanso 1695) · P 125 · H 225 · G 55»
export function textoPlan(plan) {
  if (!plan) return 'Sin plan';
  if (plan.modo === 'sin_contar') return 'Sin contar: con pautas';
  const partes = [`${fmtKcal(plan.kcal)} kcal${plan.kcal_descanso != null ? ` (descanso ${fmtKcal(plan.kcal_descanso)})` : ''}`, `proteína ${plan.proteina_g} g`];
  if (plan.modo === 'macros') partes.push(`hidratos ${plan.carbos_g}${plan.carbos_descanso_g != null && plan.carbos_descanso_g !== plan.carbos_g ? `/${plan.carbos_descanso_g}` : ''} g`, `grasa ${plan.grasa_g}${plan.grasa_descanso_g != null && plan.grasa_descanso_g !== plan.grasa_g ? `/${plan.grasa_descanso_g}` : ''} g`);
  return partes.join(', ');
}

// Barra de un macro: lo comido frente al objetivo
export function BarraMacro({ nombre, valor, objetivo, color, unidad = 'g' }) {
  const frac = objetivo ? Math.max(0, Math.min(1, (Number(valor) || 0) / objetivo)) : 0;
  return (
    <div class="barra-macro" style={{ '--c': color }}>
      <span class="separa"><span class="peq">{nombre}</span><span class="num peq"><b>{valor == null ? '—' : num(valor, 0)}</b><span class="terciario"> / {num(objetivo, 0)} {unidad}</span></span></span>
      <span class="barra" role="img" aria-label={`${nombre}: ${valor == null ? 'sin apuntar' : `${num(valor, 0)} de ${num(objetivo, 0)} ${unidad}`}`}><i style={{ width: `${frac * 100}%` }} /></span>
    </div>
  );
}

// El plan en una tarjeta (lo que ve el atleta y la cabecera del coach)
export function TarjetaPlan({ plan, siguiente = null, diasEntreno = 4, acciones = null }) {
  if (!plan && !siguiente) return null;
  const p = plan || siguiente;
  const cifras = p.modo !== 'sin_contar';
  return (
    <div class="panel panel-pad pila tarjeta-plan">
      <div class="separa">
        <span class="pila-xs">
          <strong>{NOMBRE_FASE[p.fase] || 'Plan'}{p.ritmo_pct != null ? `: ${textoRitmoCorto(p.ritmo_pct)}` : ''}</strong>
          <span class="mini terciario">{plan ? `Desde el ${fmtConDia(plan.desde)}` : `Empieza el ${fmtConDia(siguiente.desde)}`}</span>
        </span>
        {acciones}
      </div>
      {cifras && (
        <dl class="cifras-plan num">
          <div><dt>Kcal{p.kcal_descanso != null ? ', entreno' : ''}</dt><dd>{fmtKcal(p.kcal)}</dd></div>
          {p.kcal_descanso != null && <div><dt>Kcal, descanso</dt><dd>{fmtKcal(p.kcal_descanso)}</dd></div>}
          <div><dt>Proteína</dt><dd>{p.proteina_g} g</dd></div>
          {p.modo === 'macros' && <div><dt>Hidratos</dt><dd>{p.carbos_g}{p.carbos_descanso_g != null && p.carbos_descanso_g !== p.carbos_g ? ` / ${p.carbos_descanso_g}` : ''} g</dd></div>}
          {p.modo === 'macros' && <div><dt>Grasa</dt><dd>{p.grasa_g}{p.grasa_descanso_g != null && p.grasa_descanso_g !== p.grasa_g ? ` / ${p.grasa_descanso_g}` : ''} g</dd></div>}
          {p.fibra_g != null && <div><dt>Fibra</dt><dd>{p.fibra_g} g</dd></div>}
        </dl>
      )}
      {cifras && p.kcal_descanso != null && <p class="mini terciario">De media, unas {fmtKcal(kcalMediaPlan(p, diasEntreno))} kcal al día con {diasEntreno} {diasEntreno === 1 ? 'día' : 'días'} de entreno a la semana.</p>}
      {plan?.motivo && <p class="peq nota"><Icono n="mensaje" /> {plan.motivo}</p>}
      {siguiente && plan && <p class="peq aviso-plan"><Icono n="calendario" /> Desde el {fmtConDia(siguiente.desde)}: {textoPlan(siguiente)}{siguiente.motivo ? `. ${siguiente.motivo}` : ''}</p>}
    </div>
  );
}

// Lo comido cada día (barras, con el color de cómo fue) frente a lo que tocaba (raya). dias: [{ iso, kcal, objetivo, estado }]
export function GraficaIngesta({ dias, alto = 150, etiqueta }) {
  const [W, ref] = useAncho();
  if (!dias?.length) return null;
  const H = alto, izq = 34, der = 8, arr = 10, abj = 22;
  const valores = dias.flatMap((d) => [d.kcal, d.objetivo]).filter((v) => v != null);
  if (!valores.length) return null;
  const hi = Math.max(...valores) * 1.08, lo = 0;
  const ancho = (W - izq - der) / dias.length;
  const X = (i) => izq + i * ancho;
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const ticks = [Math.round(hi * 0.5 / 500) * 500, Math.round(hi * 0.9 / 500) * 500].filter((t, i, a) => t > 0 && a.indexOf(t) === i);
  // La media, de los días acabados y completos (como la de la tabla)
  const conDato = dias.filter((d) => d.kcal != null && d.estado !== 'en_curso' && d.estado !== 'incompleto');
  const media = conDato.length ? Math.round(conDato.reduce((t, d) => t + d.kcal, 0) / conDato.length) : null;
  const etiquetasX = [0, Math.floor((dias.length - 1) / 2), dias.length - 1];
  return (
    <svg class="grafica grafica-ingesta" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={etiqueta || `Kcal de cada día, ${diasEntre(dias[0].iso, dias[dias.length - 1].iso) + 1} días: ${dias.filter((d) => d.kcal != null).length} apuntados${media != null ? `, media de los completos ${fmtKcal(media)} kcal` : ''}`}>
      {ticks.map((t) => (
        <g key={t}><line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" /><text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(t / 1000, 1)}k</text></g>
      ))}
      {dias.map((d, i) => d.kcal != null && (
        <rect key={d.iso} class={`barra-dia ${d.estado}`} x={X(i) + ancho * 0.18} width={Math.max(2, ancho * 0.64)} y={Y(d.kcal)} height={Math.max(1, Y(lo) - Y(d.kcal))} rx="2">
          <title>{`${fmtConDia(d.iso)}: ${fmtKcal(d.kcal)} kcal${d.objetivo ? ` de ${fmtKcal(d.objetivo)}` : ''} (${NOMBRE_ESTADO_DIA[d.estado] || ''})`}</title>
        </rect>
      ))}
      {dias.map((d, i) => d.objetivo != null && <line key={`o${d.iso}`} class="objetivo-dia" x1={X(i) + 1} x2={X(i) + ancho - 1} y1={Y(d.objetivo)} y2={Y(d.objetivo)} />)}
      {etiquetasX.map((i, k) => (
        <text key={k} x={X(i) + ancho / 2} y={H - 4} text-anchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{fmtCorta(dias[i].iso)}</text>
      ))}
    </svg>
  );
}
