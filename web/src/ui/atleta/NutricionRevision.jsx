// La revisión de cada 4 semanas (v0.253, N4, migración 106). En FBE Esencial la app la hace sola el día que toca (las reglas,
// en logica/nutricion-motor.js; lo que necesita, en logica/nutricion-revision.js), la base la guarda en el historial y, en
// Hoy, la cuenta con su porqué una semana (o hasta «Entendido»). Mientras no toca: cuándo es la siguiente, sus pesadas de
// esta semana y, cada 2 semanas, la cintura. En «Tu plan», «Tus revisiones». Sin la 106, nada. Con antecedente de TCA o el
// SCOFF positivo, tampoco (su plan es para mantener y no se le pide que se pese). En su propio trozo (lo cargan
// EsencialComida.jsx y NutricionHojas.jsx). Estilos: nutricion-motor.css (nm-rev*, nm-prox*, nm-hist*).
import { useState, useEffect } from 'preact/hooks';
import { useApp, useCarga, Icono, Paso } from '../comunes.jsx';
import { hoyISO, fmtConDia } from '../../logica/fechas.js';
import { fmtKcal } from '../../logica/nutricion.js';
import { datosParaRevision, revisionDeHoy, cuandoToca, sinRevision, textoRevision, lineaRevision, revisionReciente, pesadasSemana, tocaCintura, ordenRevisiones } from '../../logica/nutricion-revision.js';
import { WEB_FBE } from '../../logica/esencial.js';
import * as nut from '../../datos/api-nutricion.js';
import { Arte } from './EsencialArte.jsx';
import { ARTE_REVISION } from '../../logica/esencial-arte.js';
import { perezoso } from '../perezoso.jsx';
const HojaRehacerComida = perezoso(() => import('./EsencialComida.jsx'), 'HojaRehacerComida', { mientras: null });

const vistaClave = (id) => `fbe-nutri-revision-vista:${id}`;
const vista = (id) => { try { return localStorage.getItem(vistaClave(id)) === '1'; } catch { return false; } };
const ICONO = { ok: 'diana', cambio: 'progreso', aviso: 'alerta' };

// Lo suyo de la 106: sus revisiones, su cuestionario (TCA y SCOFF) y sus medidas (la cintura); null sin la 106
function useRevisiones(planId) {
  const { api, backend, atleta } = useApp();
  return useCarga(async () => {
    if (!(await nut.hay106(backend))) return null;
    const [revisiones, cuestionario, medidas] = await Promise.all([
      nut.revisiones(backend, atleta.id), api.cuestionario(atleta.id).catch(() => null), api.medidas(atleta.id).catch(() => []),
    ]);
    return { revisiones: revisiones || [], cuestionario, medidas: medidas || [] };
  }, [atleta.id, planId]);
}

// En Hoy, con un plan del motor (debajo del toque de cada día)
export function RevisionNutricion({ r, alCambiar }) {
  const { api, backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const d = useRevisiones(r?.plan?.id);
  const [, setCerrada] = useState(0);
  const [rehacer, setRehacer] = useState(false);
  const x = d.datos;
  const sin = !x || !r?.plan || r.plan.mantenimiento == null || sinRevision({ cuestionario: x.cuestionario });
  const toca = sin ? null : cuandoToca(r.plan, x.revisiones);
  // El día que toca (una vez al día como mucho): la calcula con todo lo que necesita y la manda; la base vuelve a mirar si
  // toca y sus topes. Si cambia el plan, se recarga lo de nutrición; si no, sus revisiones
  useEffect(() => {
    if (sin || !toca || hoy < toca) return;
    const clave = `fbe-nutri-revision:${atleta.id}:${hoy}`;
    try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch { /* sin almacenamiento: se intenta igual */ }
    let vivo = true;
    (async () => {
      const [perfil, series] = await Promise.all([
        nut.perfil(backend, atleta.id).catch(() => null),
        r.plan.fase === 'perder' ? api.historial(atleta.id).catch(() => []) : Promise.resolve([]),
      ]);
      const res = revisionDeHoy(datosParaRevision({ r, perfil, medidas: x.medidas, revisiones: x.revisiones, series, hoy }));
      if (!res || !vivo) return;
      const id = await nut.revision(backend, res).catch(() => null);
      if (!vivo || typeof id !== 'string') return;
      if (res.tipo === 'baja' || res.tipo === 'sube') { aviso(`Tu plan de comida ${res.tipo === 'baja' ? 'baja' : 'sube'} a ${fmtKcal(res.nuevo.kcal)} kcal`); alCambiar?.(); }
      d.recargar(true);
    })();
    return () => { vivo = false; };
  }, [x, r?.plan?.id]);
  if (sin) return null;
  const rev = revisionReciente(x.revisiones, hoy, vista);
  if (rev) {
    const t = textoRevision(rev, r.plan);
    return (
      <div class={`nm-rev nm-rev-${t.tono}`} role="status">
        <Arte id={ARTE_REVISION[rev.tipo]} />
        <div class="nm-rev-cab">
          <Icono n={ICONO[t.tono]} width="20" height="20" />
          <span class="nm-rev-tit"><span class="mini secundario">La revisión de tus 4 semanas</span><strong class="peq">{t.titulo}</strong></span>
        </div>
        {rev.porque && <p class="peq">{rev.porque}</p>}
        {t.cifras.length > 0 && <div class="nm-rev-cifras" role="list">{t.cifras.map((c) => <span key={c} class="mini nm-rev-cifra" role="listitem">{c}</span>)}</div>}
        {rev.tipo === 'simplificar' && <button class="btn btn-peq" onClick={() => setRehacer(true)}><Icono n="editar" /> Hacer mi plan más fácil</button>}
        {rev.tipo === 'profesional' && <a class="btn btn-peq" href={`${WEB_FBE}/puesta-a-punto.html`} target="_blank" rel="noopener">Ver la Puesta a punto</a>}
        <div class="nm-rev-pie">
          <span class="mini terciario">{t.siguiente ? `La siguiente revisión, el ${t.siguiente}.` : ''}</span>
          <button class="btn-texto" onClick={() => { try { localStorage.setItem(vistaClave(rev.id), '1'); } catch { /* sin almacenamiento */ } setCerrada((k) => k + 1); }}>Entendido</button>
        </div>
        {rehacer && <HojaRehacerComida pesoKg={r.pesoKg} actual={r.plan} alCerrar={() => setRehacer(false)} alGuardar={() => { setRehacer(false); alCambiar?.(); }} />}
      </div>
    );
  }
  // Mientras no toca (el día que toca, mientras la hace, nada)
  if (!toca || hoy >= toca) return null;
  return <ProximaRevision r={r} toca={toca} medidas={x.medidas} alMedir={() => d.recargar(true)} />;
}

// Cuándo es la siguiente, sus pesadas de esta semana y, si hace 2 semanas o más de la última, la cintura de hoy
function ProximaRevision({ r, toca, medidas, alMedir }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [cm, setCm] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const pesadas = pesadasSemana(r.pesos || [], hoy);
  const guardar = async (ev) => {
    ev.preventDefault();
    if (!(cm >= 45 && cm <= 200)) { aviso('Escribe tu cintura en centímetros (de 45 a 200)', 'error'); return; }
    setOcupado(true);
    try { await api.guardarMedidas(atleta.id, hoy, { cintura_cm: Math.round(cm * 10) / 10 }); aviso('Cintura guardada'); alMedir?.(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <div class="nm-prox">
      <span class="mini secundario">Tu próxima revisión, el {fmtConDia(toca)}. Esta semana te has pesado {pesadas === 1 ? 'una vez' : `${pesadas} veces`} (cuentan tres).</span>
      {tocaCintura(medidas, hoy) && (
        <form class="nm-prox-cint" onSubmit={guardar} noValidate>
          <label class="mini" for="nm-rev-cintura">Toca medirte la cintura (cada 2 semanas): por la mañana, en ayunas, a la altura del ombligo.</label>
          <div class="nm-prox-fila">
            <Paso id="nm-rev-cintura" valor={cm} paso={0.5} min={45} max={200} dec={1} etiqueta="cintura en centímetros" alCambiar={setCm} />
            <button class="btn btn-peq" disabled={ocupado || cm == null}>Guardar</button>
          </div>
        </form>
      )}
    </div>
  );
}

// En «Tu plan»: sus revisiones (la más reciente primero, con su porqué al abrirla)
export function HistorialRevisiones({ r }) {
  const d = useRevisiones(r?.plan?.id);
  const x = d.datos;
  if (!x || !r?.plan || r.plan.mantenimiento == null || sinRevision({ cuestionario: x.cuestionario })) return null;
  const revs = ordenRevisiones(x.revisiones).slice(0, 12);
  return (
    <section class="pila-s">
      <h3 class="etq">Tus revisiones</h3>
      {revs.length ? (
        <div class="nm-hist" role="list">
          {revs.map((v) => (
            <details key={v.id} class="nm-hist-i" role="listitem">
              <summary class="peq nm-hist-s">{lineaRevision(v)}</summary>
              {v.porque && <p class="mini secundario">{v.porque}</p>}
            </details>
          ))}
        </div>
      ) : <p class="mini secundario">Aún no hay ninguna: la primera, el {fmtConDia(cuandoToca(r.plan, []))}.</p>}
    </section>
  );
}
