// FBE Esencial (v0.260, la constancia: C1, C3, C5, C7 y C9 de «claude/motores-siguientes-reglas.md»). En su trozo (solo lo
// descarga quien va por su cuenta). Arriba en Hoy: el aviso suave cuando se le pasan dos sesiones (nivel 1), el plan mínimo
// tras dos semanas flojas (nivel 2), «¿Te lo ponemos más fácil?» antes de la baja y la revisión de la semana 6. En «Antes
// de tu lunes», su plan B. En «Tu suscripción», lo que puede hacer antes de irse. Todo apagado hasta el visto bueno de
// Pelayo. Estilos: constancia.css (clases cns-*, escritas tal cual en el elemento al que se aplican).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { semanaDelPlan } from '../../logica/esencial-lecciones.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { nivelConstancia, textoNivel1, planMinimoDe, PLAN_MINIMO, revisionSemana6, riesgoBaja, OPCIONES_ANTES_BAJA, HORAS_PLAN, PLANES_B, textoPlanB } from '../../logica/constancia.js';
import * as datos from '../../datos/api-esencial.js';
import * as cdatos from '../../datos/api-constancia.js';
import { perezoso } from '../perezoso.jsx';

const HojaRutinas = perezoso(() => import('./EsencialRutinas.jsx'), 'HojaRutinas', { mientras: null });
const HojaTusDias = perezoso(() => import('./Esencial.jsx'), 'HojaTusDias', { mientras: null });

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const masDias = (hoy, n) => new Date(Date.parse(`${hoy}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const irAHoy = (que) => { try { location.hash = `#hoy/${que}`; } catch { /* */ } };
export const CLAVES_CONSTANCIA = ['constancia_aviso', 'plan_minimo', 'antes_baja', 'revision_6'];

// ---------- Arriba, en Hoy ----------
export function ConstanciaArriba({ p, cuestionario = null, recargar }) {
  const { backend, atleta, aviso } = useApp();
  const previa = usePrevia();
  const hoy = hoyISO();
  const on = (k) => encendido(k, previa);
  const alguna = CLAVES_CONSTANCIA.some(on);
  const n = Object.values(p?.sesiones || {}).flat().filter((s) => s.completada).length;
  const hechas = useCarga(() => (alguna ? datos.hechas(backend, atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id, p?.bloque?.id, n, alguna], { recuerdo: `hechas-esencial:${atleta.id}` });
  const notas = useCarga(() => (alguna ? cdatos.notasConstancia(backend, atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, alguna], { recuerdo: `constancia-notas:${atleta.id}` });
  const con111 = useCarga(() => (alguna ? cdatos.hay111(backend) : Promise.resolve(false)), [atleta.id, alguna], { recuerdo: `esencial-111:${atleta.id}` });
  const [ocupado, una] = useUnaVez();
  const [hoja, setHoja] = useState(null);   // 'rutina' | 'dias' | 'planb'
  const [, setVuelta] = useState(0);
  const w = p?.actual || null;
  if (!alguna || !w || !p?.bloque || !hechas.datos) return null;
  const k = (x) => `fbe-esencial-cns-${x}:${atleta.id}`;
  const fuera = (x) => (leer(k(x)) || '') >= hoy;
  const apartar = (x, dias) => { guardar(k(x), masDias(hoy, dias)); setVuelta((v) => v + 1); };
  const inicio = (p.bloques || []).map((b) => b.fecha_inicio).filter(Boolean).sort()[0] || null;
  const deViaje = (notas.datos?.viaje || []).some((v) => v.desde && v.hasta && String(v.desde) <= hoy && String(v.hasta) >= hoy);
  const nv = nivelConstancia({ hoy, actual: w, semanas: p.semanas || [], sesiones: p.sesiones || {}, hechas: hechas.datos, inicio, deViaje });
  const pm = on('plan_minimo') ? planMinimoDe({ notas: notas.datos?.planMinimo || [], hoy }) : null;
  const filaPm = pm ? (notas.datos?.planMinimo || []).find((x) => String(x.desde) === pm.desde) : null;
  const riesgo = on('antes_baja') ? riesgoBaja({ flojas: nv.flojas, comoVamos: notas.datos?.comoVamos || [] }) : null;
  const rev6 = on('revision_6') && !fuera('rev6') ? revisionSemana6({ n: semanaDelPlan(p.bloques, w.fecha_inicio), semanas: p.semanas || [], sesiones: p.sesiones || {}, actual: w }) : null;
  const guardable = con111.datos === true;
  const empezarMinimo = () => una(async () => {
    try {
      const r = await cdatos.empezarPlanMinimo(backend, atleta.id, { hoy });
      if (r?.falta111) { aviso('Aún no se puede guardar: prueba dentro de unos días.', 'error'); return; }
      aviso(`Hecho: dos semanas con tu plan mínimo, hasta el domingo ${String(r?.hasta || '').slice(8, 10)}/${String(r?.hasta || '').slice(5, 7)}`);
      notas.recargar(true);
    } catch (e) { aviso(e.message, 'error'); }
  });
  const dejarMinimo = () => una(async () => {
    try { await cdatos.dejarPlanMinimo(backend, atleta.id, filaPm, { hoy }); aviso('Vuelves a tu plan de siempre'); notas.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  });
  const elegir = (op) => {
    if (op === 'pausa') { irAHoy('domingo'); return; }
    if (op === 'minimo') { empezarMinimo(); return; }
    setHoja('rutina');
  };
  const t1 = nv.nivel === 1 ? textoNivel1({ faltadas: nv.faltadas, planB: notas.datos?.planB }) : null;
  return (
    <>
      {pm && (
        <section class="nota-coach cns-caja" data-cns="minimo-en-curso" aria-labelledby="cns-pm-t">
          <Icono n="pausa" />
          <div class="pila-s">
            <strong id="cns-pm-t">Tu plan mínimo · semana {pm.semana} de {PLAN_MINIMO.semanas}</strong>
            <span class="peq">{`${PLAN_MINIMO.dias} días de unos ${PLAN_MINIMO.minutos} minutos con lo principal, con 2 series. En tu sesión ya lo verás así; si un día te apetece, «Entrenar normal».`}</span>
            <div class="fila-envolver"><button type="button" class="btn btn-peq" disabled={ocupado} onClick={dejarMinimo}>Volver a mi plan</button></div>
          </div>
        </section>
      )}
      {!pm && riesgo && !fuera('baja') && (
        <section class="nota-coach cns-caja" data-cns="antes-baja" aria-labelledby="cns-baja-t">
          <Icono n="mensaje" />
          <div class="pila-s">
            <strong id="cns-baja-t">¿Te lo ponemos más fácil?</strong>
            <span class="peq">{riesgo.por === 'flojas' ? `Llevas ${riesgo.flojas} semanas en las que el plan no ha encajado. No es falta de ganas: es que hay épocas así. Elige lo que mejor te venga:` : 'Nos dijiste que esto no te está yendo como esperabas. Antes de dejarlo, prueba una de estas:'}</span>
            <div class="cns-ops" role="group" aria-label="Lo que puedes hacer">
              {OPCIONES_ANTES_BAJA.filter(([id]) => id !== 'minimo' || (on('plan_minimo') && guardable)).map(([id, t, x]) => (
                <button type="button" key={id} class="cns-op" disabled={ocupado} onClick={() => elegir(id)}><strong class="peq">{t}</strong><span class="mini secundario">{x}</span></button>
              ))}
            </div>
            <button type="button" class="btn-texto mini cns-sigo" onClick={() => apartar('baja', 14)}>Sigo como estoy</button>
          </div>
        </section>
      )}
      {!pm && !riesgo && nv.nivel === 2 && on('plan_minimo') && guardable && !fuera('minimo') && (
        <section class="nota-coach cns-caja" data-cns="minimo" aria-labelledby="cns-min-t">
          <Icono n="calendario" />
          <div class="pila-s">
            <strong id="cns-min-t">Dos semanas con el plan mínimo</strong>
            <span class="peq">{`Estas dos semanas el plan no ha cabido en tu semana. Probemos algo más pequeño: ${PLAN_MINIMO.dias} días de unos ${PLAN_MINIMO.minutos} minutos con lo principal, con 2 series. Una sola serie ya basta para mantener la fuerza. A las dos semanas, vuelves a tu plan.`}</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={empezarMinimo}><Icono n="play" /> Probarlo dos semanas</button>
              <button type="button" class="btn btn-peq" onClick={() => setHoja('rutina')}>Ver un plan más corto</button>
            </div>
            <button type="button" class="btn-texto mini cns-sigo" onClick={() => apartar('minimo', 28)}>Sigo igual</button>
          </div>
        </section>
      )}
      {/* (a partir de 7 días sin entrenar ya sale «Llevas N días sin entrenar»: el aviso suave no se suma) */}
      {!pm && nv.nivel === 1 && (nv.dias == null || nv.dias < 7) && on('constancia_aviso') && !fuera(`aviso-${nv.faltadas}`) && (
        <section class="nota-coach cns-caja" data-cns="aviso" aria-labelledby="cns-av-t">
          <Icono n="reiniciar" />
          <div class="pila-s">
            <strong id="cns-av-t">{t1.titulo}</strong>
            <span class="peq">{t1.texto}</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-peq" onClick={() => setHoja('dias')}><Icono n="calendario" /> Cambiar mis días</button>
              {on('plan_b') && guardable && !notas.datos?.planB && <button type="button" class="btn btn-peq" onClick={() => setHoja('planb')}>Ponerme un plan B</button>}
              <button type="button" class="btn-texto mini" onClick={() => apartar(`aviso-${nv.faltadas}`, 3)}>Vale</button>
            </div>
          </div>
        </section>
      )}
      {rev6 && (
        <section class="panel panel-pad pila-s cns-rev" data-cns="semana6" aria-labelledby="cns-rev-t">
          <strong id="cns-rev-t">Tus seis semanas</strong>
          <span class="peq secundario">Hoy empieza tu semana 6: es cuando un hábito empieza a ir solo. Así llevas tu plan:</span>
          <div class="cns-cifras" role="list">
            <span class="cns-cifra" role="listitem"><b class="num">{rev6.hechas}</b><span class="mini secundario">{`de ${rev6.total} sesiones`}</span></span>
            <span class="cns-cifra" role="listitem"><b class="num">{rev6.completas}</b><span class="mini secundario">{`de ${rev6.semanas} semanas completas`}</span></span>
          </div>
          <span class="peq">{rev6.total && rev6.hechas * 4 >= rev6.total * 3 ? 'Va muy bien: sigue igual. Lo que estás haciendo ya es un hábito.' : 'Si no te ha cabido todo, no lo aprietes: ajústalo para que quepa en tu semana.'}</span>
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={() => setHoja('dias')}><Icono n="calendario" /> Cambiar mis días</button>
            <button type="button" class="btn btn-peq" onClick={() => setHoja('rutina')}>Cambiar de rutina</button>
            <button type="button" class="btn-texto mini" onClick={() => apartar('rev6', 60)}>Todo bien</button>
          </div>
        </section>
      )}
      {hoja === 'rutina' && <HojaRutinas p={p} cuestionario={cuestionario} alCerrar={() => setHoja(null)} alCambiar={() => recargar?.()} />}
      {hoja === 'dias' && <HojaTusDias p={p} cuestionario={cuestionario} alCerrar={() => setHoja(null)} alGuardar={() => recargar?.()} />}
      {hoja === 'planb' && <HojaPlanB alCerrar={() => { setHoja(null); notas.recargar(true); }} />}
    </>
  );
}

// ---------- (C5) El plan B: «cuándo y qué hago si…» ----------
export function PlanB({ alGuardar = null, compacto = false }) {
  const { backend, atleta, aviso } = useApp();
  const notas = useCarga(() => cdatos.notasConstancia(backend, atleta.id).catch(() => null), [atleta.id], { recuerdo: `constancia-notas:${atleta.id}` });
  const con111 = useCarga(() => cdatos.hay111(backend), [atleta.id], { recuerdo: `esencial-111:${atleta.id}` });
  const ya = notas.datos?.planB || null;
  const [hora, setHora] = useState(null);
  const [b, setB] = useState(null);
  const [cambiar, setCambiar] = useState(false);
  const [ocupado, una] = useUnaVez();
  if (con111.datos !== true || notas.datos === undefined) return null;
  const h = hora ?? ya?.hora ?? null, pb = b ?? ya?.b ?? null;
  const enviar = () => una(async () => {
    try {
      const r = await cdatos.guardarPlanB(backend, atleta.id, { hora: h, b: pb });
      if (r?.falta111) { aviso('Aún no se puede guardar: prueba dentro de unos días.', 'error'); return; }
      aviso('Tu plan B, guardado');
      setCambiar(false);
      notas.recargar(true);
      alGuardar?.();
    } catch (e) { aviso(e.message, 'error'); }
  });
  if (ya && !cambiar) {
    return (
      <div class="cns-planb" data-cns="planb-hecho">
        <span class="peq"><strong>Tu plan B:</strong> {`${HORAS_PLAN.find(([x]) => x === ya.hora)?.[1] || ''}. ${textoPlanB(ya)}`}</span>
        <button type="button" class="btn-texto mini cns-sigo" onClick={() => setCambiar(true)}>Cambiarlo</button>
      </div>
    );
  }
  return (
    <div class={compacto ? 'pila-s' : 'cns-planb'} data-cns="planb">
      {!compacto && <strong class="peq">Tu plan para cuando se tuerza</strong>}
      <span class="peq secundario">Decidirlo ahora, en frío, hace mucho más fácil cumplirlo después.</span>
      <span class="peq" id="cns-hora">¿A qué hora sueles entrenar?</span>
      <div class="cns-ops" role="group" aria-labelledby="cns-hora">
        {HORAS_PLAN.map(([x, t]) => <button type="button" key={x} class={h === x ? 'cns-chip cns-chip-si' : 'cns-chip'} aria-pressed={h === x ? 'true' : 'false'} onClick={() => setHora(x)}>{t}</button>)}
      </div>
      <span class="peq" id="cns-b">Si un día no puedes…</span>
      <div class="cns-ops" role="group" aria-labelledby="cns-b">
        {PLANES_B.map(([x, t]) => <button type="button" key={x} class={pb === x ? 'cns-chip cns-chip-si' : 'cns-chip'} aria-pressed={pb === x ? 'true' : 'false'} onClick={() => setB(x)}>{t}</button>)}
      </div>
      <div class="fila-envolver"><button type="button" class="btn btn-primario btn-peq" disabled={ocupado || !h || !pb} onClick={enviar}>Guardar mi plan B</button></div>
    </div>
  );
}
function HojaPlanB({ alCerrar }) {
  return (
    <Hoja titulo="Tu plan B" alCerrar={alCerrar}>
      <div class="pila"><PlanB compacto alGuardar={alCerrar} /></div>
    </Hoja>
  );
}

// ---------- (C9) En «Tu suscripción», antes de irse ----------
export function AntesDeLaBaja({ alCerrar }) {
  const { backend, atleta, aviso } = useApp();
  const previa = usePrevia();
  const con111 = useCarga(() => cdatos.hay111(backend), [atleta.id], { recuerdo: `esencial-111:${atleta.id}` });
  const [ocupado, una] = useUnaVez();
  const [hecho, setHecho] = useState(null);
  const elegir = (op) => {
    if (op === 'pausa') { alCerrar?.(); irAHoy('domingo'); return; }
    if (op === 'rutina') { alCerrar?.(); irAHoy('rutina'); return; }
    una(async () => {
      try {
        const r = await cdatos.empezarPlanMinimo(backend, atleta.id, { hoy: hoyISO() });
        if (r?.falta111) { aviso('Aún no se puede guardar: prueba dentro de unos días.', 'error'); return; }
        setHecho('minimo');
        aviso('Hecho: dos semanas con tu plan mínimo');
      } catch (e) { aviso(e.message, 'error'); }
    });
  };
  const ops = OPCIONES_ANTES_BAJA.filter(([id]) => id !== 'minimo' || (encendido('plan_minimo', previa) && con111.datos === true));
  return (
    <div class="cns-planb" data-cns="antes-de-irte">
      <strong class="peq">Antes de irte: ¿te lo ponemos más fácil?</strong>
      {hecho === 'minimo' ? <span class="peq" role="status">{`Listo: estas dos semanas, ${PLAN_MINIMO.dias} días de unos ${PLAN_MINIMO.minutos} minutos con lo principal. Tu suscripción sigue igual.`}</span> : (
        <div class="cns-ops" role="group" aria-label="Lo que puedes hacer">
          {ops.map(([id, t, x]) => <button type="button" key={id} class="cns-op" disabled={ocupado} onClick={() => elegir(id)}><strong class="peq">{t}</strong><span class="mini secundario">{x}</span></button>)}
        </div>
      )}
    </div>
  );
}
