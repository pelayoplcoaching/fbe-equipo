// Hábitos diarios del atleta: anillos en Hoy (como los de Apple), apuntar en dos toques y el mes en Progreso.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Paso } from '../comunes.jsx';
import { textoObjetivo, textoValor, pasoHabito, cumpleHabito, fraccionHabito, decimalesHabito } from '../../logica/habitos.js';
import { hoyISO, fmtConDia } from '../../logica/fechas.js';
import { LETRAS_DIA } from '../../logica/plan.js';

export const COLOR_HABITO = {
  pasos: 'var(--disco-verde)', proteina: 'var(--disco-rojo)', agua: 'var(--disco-azul)', sueno: 'var(--morado)',
  movilidad: 'var(--disco-amarillo)', verdura: 'var(--disco-verde)', libre: 'var(--morado)',
};

// Anillo de un hábito: se llena con lo apuntado; con el objetivo cumplido, lleva su marca
export function AnilloHabito({ h, fraccion, cumple, tam = 58 }) {
  const R = 24, C = 2 * Math.PI * R;
  return (
    <span class={`anillo-habito ${cumple ? 'cumple' : ''}`} style={{ '--c': COLOR_HABITO[h.icono] || 'var(--morado)', width: `${tam}px`, height: `${tam}px` }} aria-hidden="true">
      <svg viewBox="0 0 60 60" width={tam} height={tam}>
        <circle cx="30" cy="30" r={R} class="pista" />
        <circle cx="30" cy="30" r={R} class="lleno" stroke-dasharray={C} stroke-dashoffset={C * (1 - Math.max(0, Math.min(1, fraccion)))} transform="rotate(-90 30 30)" />
      </svg>
      <Icono n={h.icono || 'libre'} />
      {cumple && <span class="marca-cumple"><Icono n="hecho" /></span>}
    </span>
  );
}

export function HabitosHoy() {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.resumenHabitos(atleta.id).catch(() => []), [atleta.id]);
  const [abierto, setAbierto] = useState(null);
  const lista = res.datos || [];
  if (!lista.length) return null;
  const hechos = lista.filter((r) => r.cumpleHoy).length;
  const abiertoAhora = abierto && lista.find((r) => r.habito.id === abierto);
  return (
    <section class="seccion seccion-habitos">
      <div class="seccion-cab">
        <h2>Tus hábitos</h2>
        <span class="peq secundario num">{hechos === lista.length ? 'Todos hechos hoy' : `${hechos} de ${lista.length} hoy`}</span>
      </div>
      <div class="panel panel-pad habitos-hoy">
        {lista.map((r) => {
          const h = r.habito;
          return (
            <button key={h.id} class="habito-tile" onClick={() => setAbierto(h.id)}
              aria-label={`${h.nombre}: ${r.hoy == null ? 'sin apuntar hoy' : `hoy ${textoValor(h, r.hoy)}`}${r.cumpleHoy ? ', cumplido' : ''}. ${textoObjetivo(h)}. Apuntar`}>
              <AnilloHabito h={h} fraccion={r.fraccionHoy} cumple={r.cumpleHoy} />
              <span class="habito-nombre">{h.nombre}</span>
              <span class="habito-valor num">
                {h.tipo === 'si_no' ? (r.hoy == null ? 'Sin marcar' : textoValor(h, r.hoy)) : <>{r.hoy == null ? '—' : textoValor(h, r.hoy, { conUnidad: false })}<span class="terciario"> / {textoValor(h, h.objetivo, { conUnidad: false })}</span></>}
              </span>
            </button>
          );
        })}
      </div>
      {abiertoAhora && <HojaHabito r={abiertoAhora} alCerrar={() => setAbierto(null)} alGuardar={() => res.recargar(true)} />}
    </section>
  );
}

// Apuntar un día (hoy o uno anterior de esta semana) y ver cómo va
function HojaHabito({ r, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const h = r.habito;
  const hoy = hoyISO();
  const [dia, setDia] = useState(hoy);
  const delDia = r.semana.dias.find((d) => d.iso === dia);
  const [valor, setValor] = useState(delDia?.valor ?? null);
  const [ocupado, setOcupado] = useState(false);
  const elegirDia = (iso) => { setDia(iso); setValor(r.semana.dias.find((d) => d.iso === iso)?.valor ?? null); };
  const guardar = async (v) => {
    setOcupado(true);
    try {
      await api.apuntarHabito(h.id, dia, v);
      aviso(v == null ? 'Borrado' : cumpleHabito(h, v) ? `${h.nombre}: ¡hecho!` : 'Apuntado');
      alGuardar();
      alCerrar();
    } catch (e) { aviso(e.message, 'error'); setOcupado(false); }
  };
  // Racha: en días si se pide a diario; si no, en semanas llegando a los días pedidos
  const racha = h.dias_semana === 7
    ? (r.rachaDias ? { t: 'Días seguidos', v: r.rachaDias } : null)
    : (r.rachaSemanas ? { t: 'Semanas llegando', v: r.rachaSemanas } : null);
  return (
    <Hoja titulo={h.nombre} alCerrar={alCerrar}>
      <p class="peq secundario">{textoObjetivo(h)}.</p>
      <div class="semana-habito" role="group" aria-label="Día que apuntas">
        {r.semana.dias.map((d, i) => (
          <button key={d.iso} type="button" disabled={d.futuro || ocupado} aria-pressed={d.iso === dia ? 'true' : 'false'} onClick={() => elegirDia(d.iso)}
            class={`${d.cumple ? 'cumple' : d.valor != null ? 'apuntado' : ''} ${d.hoy ? 'hoy' : ''}`} style={{ '--c': COLOR_HABITO[h.icono] }}
            aria-label={`${fmtConDia(d.iso)}${d.valor != null ? `: ${textoValor(h, d.valor)}` : ''}${d.cumple ? ', cumplido' : ''}`}>
            <span aria-hidden="true">{LETRAS_DIA[i]}</span>
            <span class="punto-dia" aria-hidden="true">{d.cumple ? <Icono n="hecho" /> : null}</span>
          </button>
        ))}
      </div>
      <div class="pila-s">
        <span class="etq">{dia === hoy ? 'Hoy' : fmtConDia(dia).replace(/^./, (c) => c.toUpperCase())}</span>
        {h.tipo === 'si_no' ? (
          <div class="si-no">
            <button class={`btn btn-grande ${Number(valor) === 1 ? 'btn-primario' : ''}`} disabled={ocupado} onClick={() => guardar(1)}><Icono n="hecho" /> Hecho</button>
            <button class={`btn btn-grande ${valor != null && Number(valor) === 0 ? 'activo' : ''}`} disabled={ocupado} onClick={() => guardar(0)}>No lo hice</button>
          </div>
        ) : (
          <>
            <Paso id="habito-valor" valor={valor} paso={pasoHabito(h)} min={0} max={999999} dec={decimalesHabito(h)} etiqueta={`${h.unidad || h.nombre.toLowerCase()} ${dia === hoy ? 'de hoy' : `del ${fmtConDia(dia)}`}`} alCambiar={setValor} />
            <div class="anillo-grande" aria-hidden="true">
              <AnilloHabito h={h} fraccion={fraccionHabito(h, valor)} cumple={cumpleHabito(h, valor)} tam={44} />
              <span class="peq secundario">{valor == null ? `Objetivo: ${textoValor(h, h.objetivo)}` : cumpleHabito(h, valor) ? 'Objetivo cumplido' : h.sentido === 'como_mucho' ? `Te pasas de ${textoValor(h, h.objetivo)}` : `Te faltan ${textoValor(h, Math.max(0, Number(h.objetivo) - Number(valor)))}`}</span>
            </div>
            <button class="btn btn-primario btn-grande" disabled={ocupado || valor == null} onClick={() => guardar(valor)}>Guardar</button>
          </>
        )}
        {delDia?.valor != null && <button class="btn plano" disabled={ocupado} onClick={() => guardar(null)}>Borrar lo de este día</button>}
      </div>
      <dl class="habito-cifras">
        <div><dt>Esta semana</dt><dd class="num">{r.semana.cumplidos} de {r.semana.pedidos} días</dd></div>
        {racha && <div><dt>{racha.t}</dt><dd class="num"><Icono n="llama" />{racha.v}</dd></div>}
        {r.media7 != null && <div><dt>Media, 7 días</dt><dd class="num">{textoValor(h, Math.round(r.media7 * 10) / 10)}</dd></div>}
      </dl>
    </Hoja>
  );
}

// En Progreso: los últimos 28 días de cada hábito
export function HabitosMes() {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.resumenHabitos(atleta.id).catch(() => []), [atleta.id]);
  const lista = res.datos || [];
  if (!lista.length) return null;
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Tus hábitos</h2><span class="peq secundario">Últimas 4 semanas</span></div>
      <div class="panel">
        <ul class="lista">
          {lista.map((r) => {
            const h = r.habito;
            return (
              <li key={h.id} class="habito-mes">
                <AnilloHabito h={h} fraccion={r.pct30.pct / 100} cumple={false} tam={40} />
                <div class="pila-xs" style="min-width:0">
                  <span class="separa"><strong>{h.nombre}</strong><span class="num peq">{r.pct30.pct} %</span></span>
                  <span class="mini terciario">{textoObjetivo(h)}{r.media7 != null ? `. Media de la última semana: ${textoValor(h, Math.round(r.media7 * 10) / 10)}` : ''}</span>
                  <span class="mes-habito" role="img" style={{ '--c': COLOR_HABITO[h.icono] }}
                    aria-label={`Cumplido ${r.ultimos28.filter((d) => d.cumple).length} de los últimos 28 días`}>
                    {r.ultimos28.map((d) => <i key={d.iso} class={d.antes ? 'antes' : d.cumple ? 'si' : d.valor != null ? 'casi' : ''} title={`${fmtConDia(d.iso)}${d.valor != null ? `: ${textoValor(h, d.valor)}` : ''}`} />)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

