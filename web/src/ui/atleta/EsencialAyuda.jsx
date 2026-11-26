// FBE Esencial (acompañamiento, tanda 4, v0.245): «Respuestas: todo explicado». En su trozo (solo lo descarga quien va por
// su cuenta): «Tu revisión de la semana» y el «¿Por qué?» de cada ejercicio (lo que decide el motor, en palabras:
// logica/esencial-porque.js), «Tu sesión, en claro» y «¿Cómo ha ido?» al terminar, «Lo de hoy» antes de empezar, el centro
// de respuestas con buscador, «¿Qué necesitas?» en Hoy, «Tu plan, explicado» con su camino y la pregunta para el directo.
// (v0.251) El directo está oculto (FBE Esencial no tiene directos) salvo que Pelayo lo encienda en su panel (conDirecto):
// mientras, si la duda no está, se pregunta en Equipo (con la comunidad abierta).
// Estilos: ayuda.css (clases ayu-*, escritas tal cual en el elemento al que se aplican, para que vayan con este trozo).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { NOMBRE_PRIMERAS_4, WEB_FBE, CORREO_CONTACTO } from '../../logica/esencial.js';
import { hoyISO } from '../../logica/fechas.js';
import { fechaLarga, PORTAL_ESENCIAL } from '../../logica/esencial-alta.js';
import { semanaDelPlan } from '../../logica/esencial-lecciones.js';
import { nombreDias, diasDeSemana } from '../../logica/esencial-dias.js';
import { revisionDe, explicar, enClaro, resumenEnClaro, COMO_HA_IDO, respuestaComoHaIdo, loDeHoy, pesoEnContexto } from '../../logica/esencial-porque.js';
import { CATEGORIAS, MOTIVOS_BAJA, enTema, leccionMomento, respuestas, buscarRespuestas, PALABRAS, DUDAS_EJERCICIO, necesitasPara, DUDAS_PANTALLA, AVISO_ABRE, caminoDe, PLAN_EXPLICADO, LECCIONES_MOMENTO, momentoDe, encendido, checkinResponde, conDirecto } from '../../logica/esencial-respuestas.js';
import { hitoDe } from '../../logica/esencial-cerca.js';
import * as datos from '../../datos/api-esencial.js';
import { perezoso } from '../perezoso.jsx';
// (v0.253) sus ilustraciones (F3): «¿Qué necesitas?», Respuestas, «Tu plan, explicado» y «Tu suscripción»
import { Arte } from './EsencialArte.jsx';
// (v0.250, tanda 9) la comida: lo que necesita saber esta parte (si tiene plan de comida y si tiene antecedente de TCA)
import { conNutricion } from '../../logica/nivel.js';
import { planVigente } from '../../logica/nutricion.js';
import { necesitasComida, respuestasComida, checkinComida } from '../../logica/esencial-comida.js';

const HojaTusDias = perezoso(() => import('./Esencial.jsx'), 'HojaTusDias', { mientras: null });
const HojaRutinas = perezoso(() => import('./EsencialRutinas.jsx'), 'HojaRutinas', { mientras: null });
const ComidaRevision = perezoso(() => import('./EsencialComidaMas.jsx'), 'ComidaRevision', { mientras: null });
// (v0.260, C9) en «Tu suscripción», lo que puede hacer antes de irse (ui/atleta/EsencialConstancia.jsx)
const AntesDeLaBaja = perezoso(() => import('./EsencialConstancia.jsx'), 'AntesDeLaBaja', { mientras: null });
const HojaComida = perezoso(() => import('./EsencialComidaMas.jsx'), 'HojaComida', { mientras: null });

// Lo apagado hasta que Pelayo lo vea (logica/esencial-respuestas.js: APAGADO) se enseña en la demo con «?previa=1»
function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
// (v0.250) Quien lleva nutrición: si tiene plan de comida en marcha, su plan y si tiene antecedente de TCA (null: sin nutrición)
function useComidaEsencial() {
  const { api, atleta } = useApp();
  const con = conNutricion(atleta);
  const r = useCarga(() => (con ? Promise.all([api.planesNutricion(atleta.id).catch(() => []), api.esencialTca ? api.esencialTca(atleta.id).catch(() => null) : null])
    .then(([planes, tca]) => ({ plan: planVigente(planes || [], hoyISO()) || null, tca: tca === true })) : Promise.resolve(null)), [atleta.id, con], { recuerdo: `esencial-comida:${atleta.id}` });
  return r.datos;
}

// ---------- (8) Las palabras, explicadas al tocarlas ----------
export function Palabras({ claves = ['sobran', 'serie', 'rango', 'descarga', 'marcas', 'progresion'] }) {
  const [k, setK] = useState(null);
  return (
    <div class="ayu-palabras">
      <span class="mini terciario">Palabras que salen aquí (toca una):</span>
      <div class="ayu-palabras-f" role="group" aria-label="Palabras explicadas">
        {claves.filter((c) => PALABRAS[c]).map((c) => (
          <button type="button" key={c} class="ayu-palabra" aria-pressed={k === c ? 'true' : 'false'} onClick={() => setK(k === c ? null : c)}>{PALABRAS[c][0]}</button>
        ))}
      </div>
      {k && <p class="ayu-def peq" role="status"><strong>{PALABRAS[k][0]}. </strong>{PALABRAS[k][1]}</p>}
    </div>
  );
}

// ---------- (15, P: apagado) El check-in contesta a cada cosa que marca ----------
export function CheckinResponde({ f }) {
  const previa = usePrevia();
  const comida = useComidaEsencial();
  const xs = [...(encendido('checkin_responde', previa) ? checkinResponde(f || {}) : []),
    // (v0.250, 113, P) al hambre y a la energía, si lleva nutrición
    ...(comida?.plan && encendido('checkin_comida', previa) ? checkinComida(f || {}, { plan: comida.plan, tca: comida.tca }) : [])];
  if (!xs.length) return null;
  return <ul class="ayu-checkin">{xs.map((t) => <li key={t} class="ayu-checkin-f peq"><span class="ayu-checkin-i"><Icono n="mensaje" width="18" height="18" /></span><span>{t}</span></li>)}</ul>;
}

// ---------- (6) El centro de respuestas ----------
// (v0.249, 94) cada respuesta que se abre suma una consulta (solo el recuento; una vez por respuesta y por visita)
const contadas = new Set();
function Respuesta({ x, abierta, alAccion }) {
  const { backend } = useApp();
  const [baja, setBaja] = useState(false);
  const etiqueta = { directo: 'Preguntar para el directo', pausa: 'Ir a tu semana', dias: 'Cambiar mis días', revision: 'Ver mi revisión', rutina: 'Ver «Tu rutina»' }[x.ir];
  const contar = (ev) => {
    if (!ev.currentTarget.open || contadas.has(x.id) || x.directo) return;
    contadas.add(x.id);
    datos.contarConsulta(backend, x.id).catch(() => {});
  };
  return (
    <details class="ayu-p" open={abierta} data-id={x.id} onToggle={contar}>
      <summary class="ayu-p-q">{x.q}</summary>
      <div class="ayu-p-r">
        <p class="peq">{x.r}</p>
        {x.pendiente && <p class="mini ayu-pendiente">Pendiente del visto bueno de Pelayo: solo se ve en esta vista previa.</p>}
        {x.directo && <p class="mini terciario">Del directo del mes: lo contesta Pelayo.</p>}
        <div class="fila-envolver">
          {x.enlace && <a class="btn btn-peq" href={`${WEB_FBE}/${x.enlace[1]}`} target="_blank" rel="noopener"><Icono n="enlace" /> {x.enlace[0]}</a>}
          {x.portal && <button type="button" class="btn btn-peq" onClick={() => setBaja(true)}><Icono n="enlace" /> Tu suscripción</button>}
          {x.correo && <a class="btn btn-peq" href={`mailto:${CORREO_CONTACTO}`}><Icono n="mensaje" /> {CORREO_CONTACTO}</a>}
          {x.ir && etiqueta && alAccion && <button type="button" class="btn btn-peq" onClick={() => alAccion(x.ir)}>{etiqueta}</button>}
        </div>
      </div>
      {baja && <HojaBaja alCerrar={() => setBaja(false)} />}
    </details>
  );
}

export function CentroRespuestas({ inicial = null, alCerrar, alAccion = null }) {
  const { api, backend, atleta } = useApp();
  const previa = usePrevia();
  // (v0.251) las dudas del directo hechas públicas, solo con el directo encendido (oculto de serie)
  const directo = conDirecto();
  const publicas = useCarga(() => (directo ? datos.respuestasPublicas(backend).catch(() => []) : Promise.resolve([])), [directo], { recuerdo: directo ? `esencial-publicas:${atleta.id}` : null });
  const comida = useComidaEsencial();
  const todas = respuestas({ previa, publicas: publicas.datos || [], comida: comida?.plan ? respuestasComida({ tca: comida.tca }) : null });
  // (v0.251) sin el directo, si la duda no está: Equipo, la comunidad de la app (solo si Pelayo la tiene abierta)
  const equipo = useCarga(() => (directo ? Promise.resolve(false) : api.comunidad().then((c) => !!c?.activa).catch(() => false)), [directo], { recuerdo: directo ? null : 'esencial-equipo-abierto' });
  const aEquipo = () => { alCerrar?.(); try { location.hash = '#equipo'; } catch { /* */ } };
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(() => todas.find((x) => x.id === inicial)?.cat || null);
  const ref = useRef(null);
  useEffect(() => { if (inicial) ref.current?.querySelector('details[open]')?.scrollIntoView?.({ block: 'center' }); }, []);
  const buscando = q.trim().length >= 3;
  const lista = buscando ? buscarRespuestas(q, todas) : cat ? todas.filter((x) => enTema(x, cat)) : null;
  const cats = [...CATEGORIAS, ...(todas.some((x) => x.cat === 'comida') ? [['comida', 'La comida', 'nutricion']] : []), ...(todas.some((x) => x.directo) ? [['directo', 'Del directo del mes', 'mensaje']] : [])];
  return (
    <Hoja titulo="Respuestas" alCerrar={alCerrar}>
      <div class="pila ayu-centro" ref={ref}>
        <Arte id={inicial === 'poco-tiempo' ? 'esencial-poco-tiempo' : 'esencial-respuestas'} />
        <label class="ayu-buscar">
          <span class="ayu-buscar-t peq">Busca tu duda</span>
          <input type="search" class="ayu-buscar-c" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="agujetas, descanso, viaje…" enterkeyhint="search" autocomplete="off" />
        </label>
        {!lista && (
          <ul class="ayu-cats" aria-label="Temas">
            {cats.map(([id, nombre, icono]) => (
              <li key={id}>
                <button type="button" class="ayu-cat" onClick={() => setCat(id)}>
                  <span class="ayu-cat-i"><Icono n={icono} width="18" height="18" /></span>
                  <span class="ayu-cat-n">{nombre}</span>
                  <span class="ayu-cat-c mini">{todas.filter((x) => enTema(x, id)).length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {lista && !buscando && <button type="button" class="btn-texto ayu-volver" onClick={() => setCat(null)}><Icono n="atras" /> Todos los temas</button>}
        {lista && (lista.length
          ? <div class="ayu-lista" role="list" aria-label={buscando ? 'Resultados' : cats.find((c) => c[0] === cat)?.[1]}>{lista.map((x) => <Respuesta key={x.id} x={x} abierta={x.id === inicial || (buscando && lista.length === 1)} alAccion={alAccion} />)}</div>
          : <p class="peq secundario" role="status">{directo ? 'No hay ninguna respuesta con esas palabras. Prueba con otra o mándala para el directo del mes.' : 'No hay ninguna respuesta con esas palabras. Prueba con otras.'}</p>)}
        <p class="peq ayu-pie">
          <span class="ayu-pie-i"><Icono n="mensaje" width="18" height="18" /></span>
          <span>
            {directo
              ? <>{alAccion ? <>¿No está tu duda? <button type="button" class="btn-texto" onClick={() => alAccion('directo')}>Mándala para el directo del mes</button></> : '¿No está tu duda? Mándala para el directo del mes desde Hoy, en «¿Qué necesitas?».'}<br /></>
              : equipo.datos === true && <>¿No está tu duda? <button type="button" class="btn-texto" onClick={aEquipo}>Pregúntala en Equipo</button>, la comunidad de la app.<br /></>}
            Si algo falla en la app o en el cobro, escribe a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
          </span>
        </p>
      </div>
    </Hoja>
  );
}

// (19) Cada pantalla, con su «¿Dudas?»: abre el centro en su respuesta
export function Dudas({ de, texto = '¿Dudas?' }) {
  const [abierto, setAbierto] = useState(false);
  const id = DUDAS_PANTALLA[de] || null;
  return (
    <>
      <button type="button" class="btn-texto mini ayu-dudas" onClick={() => setAbierto(true)}><Icono n="pregunta" /> {texto}</button>
      {abierto && <CentroRespuestas inicial={id} alCerrar={() => setAbierto(false)} />}
    </>
  );
}

// El botón de Perfil (junto a las preguntas frecuentes de siempre): todas las respuestas
export function TodasLasRespuestas() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" class="btn ayu-todas" onClick={() => setAbierto(true)}><Icono n="buscar" /> Ver todas las respuestas</button>
      {abierto && <CentroRespuestas alCerrar={() => setAbierto(false)} />}
    </>
  );
}

// ---------- (17 y 18; migración 100) La pregunta para el directo del mes ----------
export function HojaDirecto({ alCerrar }) {
  const { backend, atleta, aviso } = useApp();
  const mias = useCarga(() => datos.notas(backend, atleta.id, 'pregunta_directo'), [atleta.id]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const sin100 = !mias.cargando && mias.datos === null;
  const enviar = () => una(async () => {
    setError(null);
    const t = texto.trim();
    if (t.length < 10) { setError('Cuéntalo con un poco más de detalle: así la respuesta te sirve.'); return; }
    try {
      const r = await datos.anotar(backend, atleta.id, 'pregunta_directo', { texto: t });
      if (r?.falta100) { setError('Aún no se pueden mandar preguntas desde aquí. Mientras tanto, escríbela al correo de contacto.'); return; }
      setTexto(''); aviso('Pregunta enviada para el directo del mes'); mias.recargar(true);
    } catch (e) { setError(/mes|tope|limite/i.test(e.message || '') ? 'Ya has mandado cinco preguntas este mes: las siguientes, el mes que viene.' : e.message); }
  });
  const quitar = (id) => una(async () => { try { await datos.quitarNota(backend, id); mias.recargar(true); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <Hoja titulo="Pregunta para el directo" alCerrar={alCerrar}>
      <div class="pila ayu-directo">
        <p class="secundario">Una vez al mes, Pelayo contesta en directo las dudas de quienes vais por vuestra cuenta. Deja aquí la tuya: las ve juntas antes del directo. No es un chat: no hay respuesta uno a uno.</p>
        {sin100 ? <p class="peq ayu-def">Aún no se pueden mandar preguntas desde aquí. Mientras tanto, escríbela a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.</p> : (
          <>
            <label class="pila-xs">
              <span class="peq"><strong>Tu pregunta</strong></span>
              <textarea class="ayu-area" rows="4" maxlength="600" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Por ejemplo: en el peso muerto rumano noto más la espalda que la pierna, ¿qué miro?" />
              <span class="mini terciario">{texto.length} de 600. Nada de datos de salud: para eso, tu médico o una Puesta a punto.</span>
            </label>
            {error && <p class="error" role="alert">{error}</p>}
            <button type="button" class="btn btn-primario btn-grande" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> Enviar</button>
          </>
        )}
        {(mias.datos || []).length > 0 && (
          <section class="pila-s" aria-labelledby="ayu-mias-t">
            <strong id="ayu-mias-t">Tus preguntas</strong>
            <ul class="ayu-mias">
              {mias.datos.map((n) => (
                <li key={n.id} class="ayu-mia">
                  <span class="peq">{n.texto}</span>
                  {n.respuesta ? <span class="peq ayu-mia-r"><strong>Pelayo: </strong>{n.respuesta}</span>
                    : <span class="mini terciario">Enviada el {fechaLarga(String(n.creada_en).slice(0, 10))}. <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => quitar(n.id)}>Quitar</button></span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Hoja>
  );
}

// ---------- (10 y 11) «Tu plan, explicado» y «Tu camino» ----------
export function HojaPlan({ p, alCerrar, alAccion = null }) {
  const { api, atleta } = useApp();
  const w = p?.actual || [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero)[0] || null;
  const ss = w ? [...(p.sesiones?.[w.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) : [];
  // Lo que dura cada sesión, de sus ejercicios (los de esta semana)
  const dur = useCarga(async () => {
    const out = {};
    for (const s of ss) {
      const d = await api.sesion(s.id, atleta.id).catch(() => null);
      const x = d ? loDeHoy({ ejercicios: d.ejercicios || [] }) : null;
      if (x) out[s.id] = x;
    }
    return out;
  }, [w?.id], { recuerdo: `plan-explicado:${atleta.id}:${w?.id}` });
  const primeras = (p?.bloques || []).some((b) => b?.nombre === NOMBRE_PRIMERAS_4);
  const n = semanaDelPlan(p?.bloques, w?.fecha_inicio) || w?.numero || null;
  const dias = diasDeSemana(ss);
  const camino = caminoDe({ n, primeras });
  return (
    <Hoja titulo="Tu plan, explicado" alCerrar={alCerrar}>
      <div class="pila ayu-plan">
        <Arte id="esencial-plan-explicado" />
        <section class="pila-s" aria-labelledby="ayu-plan-t">
          <strong id="ayu-plan-t">{p?.bloque?.nombre || 'Tu plan'}{n ? ` · semana ${n}` : ''}</strong>
          <p class="peq secundario">{ss.length === 1 ? 'Una sesión a la semana' : `${ss.length} sesiones a la semana`}{dias?.length ? `: ${nombreDias(dias)}` : ''}.</p>
          <ul class="ayu-sesiones">
            {ss.map((s) => (
              <li key={s.id} class="ayu-sesion">
                <span class="ayu-sesion-n">{s.nombre}</span>
                <span class="mini terciario">{dur.datos?.[s.id] ? `unos ${dur.datos[s.id].minutos} min · ${dur.datos[s.id].ejercicios} ejercicios` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
        <dl class="ayu-reglas">
          {PLAN_EXPLICADO.map(([t, x]) => <div key={t} class="ayu-regla"><dt class="ayu-regla-t">{t}</dt><dd class="ayu-regla-x peq">{x}</dd></div>)}
        </dl>
        <section class="pila-s" aria-labelledby="ayu-camino-t">
          <strong id="ayu-camino-t">Tu camino</strong>
          <ol class="ayu-camino">
            {camino.map((c) => (
              <li key={c.titulo} class="ayu-paso" data-estado={c.estado} aria-current={c.estado === 'ahora' ? 'step' : undefined}>
                <span class="ayu-paso-m" data-estado={c.estado} aria-hidden="true">{c.estado === 'hecho' ? <Icono n="hecho" width="18" height="18" /> : null}</span>
                <span class="ayu-paso-c">
                  <span class="mini terciario">{c.cuando}{c.estado === 'ahora' ? ' · estás aquí' : ''}</span>
                  <strong class="peq">{c.titulo}</strong>
                  <span class="peq secundario">{c.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <Palabras claves={['sobran', 'serie', 'rango', 'progresion', 'descarga', 'marcas']} />
        {alAccion && <button type="button" class="btn" onClick={() => alAccion('respuestas')}><Icono n="pregunta" /> Más respuestas</button>}
      </div>
    </Hoja>
  );
}

// ---------- (1, 9 y 13) «Tu revisión de la semana» ----------
const GRUPOS = [['sube', 'Lo que sube', 'arriba'], ['baja', 'Lo que baja, para volver a subir', 'abajo'], ['igual', 'Lo que se queda igual, y por qué', 'reiniciar'], ['otras', 'Lo demás', 'calendario']];
// (en la semana 5 todo sale de sus marcas; en una descarga o una vuelta, todo va con la semana)
const tituloOtras = (r) => (r.tipo === 'novato' ? 'Con qué empiezas' : r.semana === 'descarga' ? 'Esta semana, de descarga' : r.semana === 'vuelta' ? 'Esta semana, más suave' : 'Lo demás');
const claveLeida = (atletaId, semanaId) => `fbe-esencial-revision:${atletaId}:${semanaId}`;

export function HojaRevision({ semanaId = null, alCerrar }) {
  const { api, backend, atleta } = useApp();
  const previa = usePrevia();
  const [cual, setCual] = useState(semanaId);
  const d = useCarga(() => datos.revision(api, backend, atleta.id, cual ? { semanaId: cual } : {}), [atleta.id, cual]);
  const r = d.datos;
  // (16) su peso, en contexto (si lo apunta): la tendencia de las últimas semanas
  const pesos = useCarga(() => api.pesos(atleta.id, 45).catch(() => []), [atleta.id], { recuerdo: `pesos-revision:${atleta.id}` });
  const peso = pesoEnContexto(pesos.datos || [], hoyISO());
  useEffect(() => { if (r?.id) guardar(claveLeida(atleta.id, r.id), '1'); }, [r?.id]);
  const v = r ? revisionDe(r) : null;
  const momento = r && encendido('lecciones_momento', previa) ? leccionMomento(momentoDe(r)) : null;
  return (
    <Hoja titulo={r?.numero ? `Tu revisión · semana ${r.numero}` : 'Tu revisión de la semana'} alCerrar={alCerrar}>
      <div class="pila ayu-revision" aria-busy={d.cargando ? 'true' : 'false'}>
        <Arte id="esencial-revision-semana" />
        {d.cargando && !r && <p class="peq secundario" role="status">Repasando tu semana…</p>}
        {d.error && <p class="error" role="alert">No se ha podido preparar tu revisión: {String(d.error.message || d.error)}</p>}
        {!d.cargando && !d.error && !r && <p class="peq secundario">Aún no hay nada que revisar: en cuanto tengas tu primera semana hecha, aquí verás qué cambia y por qué.</p>}
        {v && (
          <>
            <header class="ayu-rev-cab">
              <span class="mini terciario">Semana del {fechaLarga(r.inicio).replace(/^lunes /, '')}</span>
              <h3 class="ayu-rev-t">{v.titulo}</h3>
              {v.hiciste && r.tipo !== 'primera' && <p class="peq secundario">La semana pasada: {v.hiciste.charAt(0).toLowerCase()}{v.hiciste.slice(1)}</p>}
            </header>
            {r.tipo === 'primera' && <p class="peq">Es tu primera semana con esta rutina, así que no hay semana anterior con la que comparar. Los kilos que veas puestos salen de lo último que hiciste en ese ejercicio; donde no haya, busca tu peso como el primer día. La semana que viene, aquí tendrás qué cambia y por qué.</p>}
            {momento && <aside class="ayu-momento"><strong class="peq">{momento[0]}</strong><span class="peq">{momento[1]}</span></aside>}
            {GRUPOS.map(([g, titulo, icono]) => v[g].length > 0 && (
              <section key={g} class="ayu-grupo" data-g={g} aria-label={g === 'otras' ? tituloOtras(r) : titulo}>
                <h4 class="ayu-grupo-t"><span class="ayu-grupo-i" data-g={g}><Icono n={icono} width="18" height="18" /></span>{g === 'otras' ? tituloOtras(r) : titulo}</h4>
                <ul class="ayu-filas">
                  {v[g].map((f) => (
                    <li key={`${f.nombre}:${f.dia || ''}`} class="ayu-fila">
                      <span class="ayu-fila-n">{f.nombre}{f.dia ? <span class="mini terciario"> · {f.dia}</span> : null}</span>
                      {f.queda && <span class="ayu-fila-q num peq">{f.queda}</span>}
                      <span class="ayu-fila-x peq secundario">{f.texto}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <aside class="ayu-foco" aria-label="Una sola cosa en la que fijarte">
              <span class="ayu-foco-i"><Icono n="diana" width="18" height="18" /></span>
              <span class="pila-xs"><strong class="peq">Esta semana, una sola cosa</strong><span class="peq">{v.foco}</span></span>
            </aside>
            {peso && <aside class="ayu-peso" aria-label="Tu peso, en contexto"><span class="ayu-peso-i"><Icono n="bascula" width="18" height="18" /></span><span class="pila-xs"><strong class="peq">Tu peso, en contexto</strong><span class="peq secundario">{peso.texto}</span></span></aside>}
            {conNutricion(atleta) && <ComidaRevision />}
            <p class="mini terciario">Esta revisión la escribe la app con lo que apuntaste y las reglas de progresión de Pelayo. No la ha leído nadie: FBE Esencial va sin seguimiento personal.</p>
            <Palabras claves={r.semana === 'descarga' ? ['descarga', 'sobran', 'serie', 'rango'] : ['sobran', 'serie', 'rango', 'progresion', 'descarga']} />
            {(r.anteriores || []).length > 1 && (
              <label class="ayu-otras peq">
                <span>Otras semanas: </span>
                <select class="ayu-otras-c" value={r.id} onChange={(e) => setCual(e.currentTarget.value)}>
                  {r.anteriores.map((w) => <option key={w.id} value={w.id}>Semana {w.numero}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        {/* (v0.250, 101) la comida de la semana: debajo de su peso o, sin revisión de entreno todavía, aquí */}
        {!v && conNutricion(atleta) && !d.cargando && <ComidaRevision />}
      </div>
    </Hoja>
  );
}

// La tarjeta de Hoy: desde la segunda semana de su plan (o la primera de su plan de novato), mientras no la haya leído;
// leída, queda en una línea. abrir: se abre sola (un aviso que lleva a ella).
export function TarjetaRevision({ p, abrir = false }) {
  const { atleta } = useApp();
  const w = p?.actual || null;
  const [hoja, setHoja] = useState(false);
  const [leida, setLeida] = useState(() => !!w && leer(claveLeida(atleta.id, w.id)) === '1');
  useEffect(() => { if (abrir && w) setHoja(true); }, [abrir, w?.id]);
  if (!w || !p?.bloque) return null;
  const hoy = hoyISO();
  const empezada = String(w.fecha_inicio || '').slice(0, 10) <= hoy;
  const previas = (p.semanas || []).some((x) => x.bloque_id === p.bloque.id && x.numero < w.numero) || (/^Novato \d/.test(p.bloque.nombre || '') && (p.bloques || []).some((b) => b.nombre === NOMBRE_PRIMERAS_4));
  if (!empezada || !previas) return hoja ? <HojaRevision semanaId={w.id} alCerrar={() => setHoja(false)} /> : null;
  const n = semanaDelPlan(p.bloques, String(w.fecha_inicio).slice(0, 10)) || w.numero;
  const cerrar = () => { setHoja(false); setLeida(true); };
  return (
    <>
      {leida ? <p class="ayu-rev-linea"><button type="button" class="btn-texto mini" onClick={() => setHoja(true)}><Icono n="documento" /> Tu revisión de la semana {n}</button></p> : (
        <section class="nota-coach ayu-rev-tarjeta" aria-label="Tu revisión de la semana">
          <Icono n="documento" />
          <div class="pila-s">
            <strong>Tu revisión de la semana {n}</strong>
            <span class="peq">Lo que hiciste la semana pasada, lo que cambia en esta y por qué, ejercicio a ejercicio. Y una sola cosa en la que fijarte.</span>
            <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" onClick={() => setHoja(true)}>Leer mi revisión</button>
          </div>
        </section>
      )}
      {hoja && <HojaRevision semanaId={w.id} alCerrar={cerrar} />}
    </>
  );
}

// ---------- (2 y 5) En cada ejercicio de la sesión: «¿Por qué?» y «Dudas» ----------
// pauta: la fila del ejercicio en la sesión ({ id, carga_sugerida_kg, … }); sesionId: la sesión
export function AyudaEjercicio({ pauta, sesionId }) {
  const { api, backend, atleta } = useApp();
  const [ver, setVer] = useState(null);   // 'porque' | 'dudas'
  const [duda, setDuda] = useState(null);
  const [centro, setCentro] = useState(null);
  const rev = useCarga(() => (ver === 'porque' && sesionId ? datos.revision(api, backend, atleta.id, { sesionId }) : Promise.resolve(null)), [ver === 'porque', sesionId]);
  const h = (rev.datos?.porque || []).find((x) => x.pauta_id === pauta?.id) || null;
  const x = h ? explicar(h) : null;
  const todas = respuestas();
  return (
    <div class="ayu-ej">
      <div class="ayu-ej-b">
        <button type="button" class="btn-texto mini" aria-expanded={ver === 'porque' ? 'true' : 'false'} onClick={() => setVer(ver === 'porque' ? null : 'porque')}><Icono n="pregunta" /> ¿Por qué esto?</button>
        <button type="button" class="btn-texto mini" aria-expanded={ver === 'dudas' ? 'true' : 'false'} onClick={() => setVer(ver === 'dudas' ? null : 'dudas')}><Icono n="mensaje" /> Dudas</button>
      </div>
      {ver === 'porque' && (
        <p class="ayu-ej-x peq" role="status">
          {rev.cargando && !rev.datos ? 'Un momento…'
            : x ? x.texto
              : rev.datos?.tipo === 'primera' ? 'Es tu primera semana con esta rutina: los kilos que veas puestos salen de lo último que hiciste en este ejercicio. Si no hay, busca tu peso como el primer día.'
                : 'Esta semana viene tal cual de tu plan: aún no hay una semana anterior con la que comparar.'}
        </p>
      )}
      {ver === 'dudas' && (
        <div class="ayu-ej-d">
          <div class="fila-envolver" role="group" aria-label="Dudas con este ejercicio">
            {DUDAS_EJERCICIO.map(([t, id]) => <button type="button" key={id} class="ayu-palabra" aria-pressed={duda === id ? 'true' : 'false'} onClick={() => setDuda(duda === id ? null : id)}>{t}</button>)}
          </div>
          {duda && <p class="ayu-ej-x peq" role="status">{todas.find((r) => r.id === duda)?.r} <button type="button" class="btn-texto mini" onClick={() => setCentro(duda)}>Más respuestas</button></p>}
        </div>
      )}
      {centro && <CentroRespuestas inicial={centro} alCerrar={() => setCentro(null)} />}
    </div>
  );
}

// ---------- (12) «Lo de hoy, en 20 segundos» (en la portada de la sesión, antes de empezar) ----------
export function LoDeHoy({ sesion, ejercicios = [] }) {
  const { api, backend, atleta } = useApp();
  const rev = useCarga(() => (sesion?.id ? datos.revision(api, backend, atleta.id, { sesionId: sesion.id }).catch(() => null) : Promise.resolve(null)), [sesion?.id]);
  const filas = rev.datos?.porque || [];
  // (lo que cambia, de lo que ya se sabe de su semana: cada ejercicio de hoy con su «hecho»)
  const cambia = ejercicios.map((e) => { const h = filas.find((f) => f.pauta_id === e.id); const x = h ? explicar(h) : null; return x && ['sube', 'reps', 'serie', 'baja'].includes(x.clase) ? `${e.ejercicio?.nombre}: ${x.corto.charAt(0).toLowerCase()}${x.corto.slice(1)}` : null; }).filter(Boolean);
  const d = loDeHoy({ ejercicios });
  if (!d) return null;
  return (
    <section class="ayu-hoy" aria-labelledby="ayu-hoy-t">
      <strong id="ayu-hoy-t" class="peq">Lo de hoy, en 20 segundos</strong>
      <ul class="ayu-hoy-l peq">
        <li class="ayu-hoy-f"><span class="ayu-hoy-i"><Icono n="reloj" width="18" height="18" /></span><span>Unos {d.minutos} minutos: {d.ejercicios} {d.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}, {d.series} series.</span></li>
        {d.importante && <li class="ayu-hoy-f"><span class="ayu-hoy-i"><Icono n="diana" width="18" height="18" /></span><span>Lo importante: {d.importante}. Si vas justo de tiempo, que no falte.</span></li>}
        {cambia.length > 0 && <li class="ayu-hoy-f"><span class="ayu-hoy-i"><Icono n="arriba" width="18" height="18" /></span><span>Cambia desde la última vez: {cambia.slice(0, 3).join('; ')}{cambia.length > 3 ? ` y ${cambia.length - 3} más` : ''}.</span></li>}
        {d.sinKilos > 0 && <li class="ayu-hoy-f"><span class="ayu-hoy-i"><Icono n="pregunta" width="18" height="18" /></span><span>{d.sinKilos === 1 ? 'Un ejercicio va' : `${d.sinKilos} ejercicios van`} sin kilos puestos: empieza con poco y busca el peso con el que te sobren las que marca.</span></li>}
      </ul>
    </section>
  );
}

// ---------- (3 y 4) Al terminar: «Tu sesión, en claro» y «¿Cómo ha ido?» ----------
export function TrasLaSesion({ sesion, enCola = false }) {
  const previaAlarma = usePrevia();
  const { api, backend, atleta } = useApp();
  const claro = useCarga(() => (enCola || !sesion?.id ? Promise.resolve(null) : datos.sesionEnClaro(api, backend, atleta.id, sesion.id).catch(() => null)), [sesion?.id, enCola]);
  // (v0.246, 28) sus hitos: la sesión 10, la 25, la 50 y la 100
  const cuantas = useCarga(() => (enCola || !sesion?.id ? Promise.resolve(null) : datos.hechas(backend, atleta.id).then((x) => x.length).catch(() => null)), [sesion?.id, enCola]);
  const hito = hitoDe(cuantas.datos);
  const k = `fbe-esencial-como:${sesion?.id}`;
  const [como, setComo] = useState(() => leer(k));
  const [centro, setCentro] = useState(null);
  const elegir = (id) => { setComo(id); guardar(k, id); };
  const filas = (claro.datos?.filas || []).map((h) => ({ h, x: enClaro(h) })).filter((f) => f.x);
  const guia = !!claro.datos?.guia;
  // (en las cuatro semanas de la guía, la app aún no mueve nada: se cuenta cómo fue, sin «la app hará…»)
  const texto = (x) => (guia ? x.hecho : x.texto);
  return (
    <section class="panel panel-pad pila-s ayu-tras" aria-labelledby="ayu-tras-t">
      {hito && <div class="ayu-hito" role="status"><span class="ayu-hito-i"><Icono n="trofeo" width="18" height="18" /></span><span class="peq">{hito}</span></div>}
      <strong id="ayu-tras-t">¿Cómo ha ido?</strong>
      <div class="fila-envolver" role="group" aria-label="Cómo ha ido la sesión">
        {COMO_HA_IDO.map(([id, t]) => <button type="button" key={id} class="ayu-palabra" aria-pressed={como === id ? 'true' : 'false'} onClick={() => elegir(id)}>{t}</button>)}
      </div>
      {como && <p class="ayu-def peq" role="status">{respuestaComoHaIdo(como)}{como === 'molestia' && <> <button type="button" class="btn-texto mini" onClick={() => setCentro('dolor')}>¿Y si me duele algo?</button></>}</p>}
      {/* (v0.247, apagado) la señal de alarma: «para y consulta» */}
      {encendido('alarma', previaAlarma) && <Alarma />}
      {filas.length > 0 && (
        <details class="ayu-claro">
          <summary class="ayu-claro-t"><strong class="peq">Tu sesión, en claro</strong><span class="peq secundario"> · {resumenEnClaro(filas.map((f) => f.x))}</span></summary>
          <ul class="ayu-claro-l">
            {filas.map(({ h, x }) => (
              <li key={`${h.ejercicio_id}:${h.sesion}`} class="ayu-claro-f" data-estado={x.estado}>
                <span class="ayu-claro-i" data-estado={x.estado}><Icono n={x.icono} width="18" height="18" /></span>
                <span class="pila-xs"><strong class="peq">{h.nombre}</strong><span class="peq secundario">{texto(x)}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {centro && <CentroRespuestas inicial={centro} alCerrar={() => setCentro(null)} />}
    </section>
  );
}

// (v0.247) Las hojas de la vida real (ui/atleta/EsencialVida.jsx), que se abren desde «¿Qué necesitas?»
const AbrirViaje = perezoso(() => import('./EsencialVida.jsx'), 'AbrirViaje', { mientras: null });
const AbrirObjetivo = perezoso(() => import('./EsencialVida.jsx'), 'AbrirObjetivo', { mientras: null });
const AbrirSuave = perezoso(() => import('./EsencialVida.jsx'), 'AbrirSuave', { mientras: null });
// (v0.256) «Me duele algo», con el motor de molestias: de 0 a 10 con el semáforo y las zonas del cuestionario de lesiones
const HojaMolestia = perezoso(() => import('./EsencialDolor.jsx'), 'HojaMolestia', { mientras: null });
const HojaSitio = perezoso(() => import('./EsencialVida.jsx'), 'HojaSitio', { mientras: null });
const HojaEjercicios = perezoso(() => import('./EsencialVida.jsx'), 'HojaEjercicios', { mientras: null });
const HojaEnfermo = perezoso(() => import('./EsencialVida.jsx'), 'HojaEnfermo', { mientras: null });
// (v0.254) «Más herramientas» (las de la web) y «Mi medicación y el ejercicio» (con los nombres de Pauta Activa)
const HojaHerramientas = perezoso(() => import('./EsencialHerramientas.jsx'), 'HojaHerramientas', { mientras: null });
const HojaMedicacion = perezoso(() => import('./EsencialHerramientas.jsx'), 'HojaMedicacion', { mientras: null });
// (v0.255) «Mis pruebas» (con la 108)
const HojaPruebas = perezoso(() => import('./EsencialPruebas.jsx'), 'HojaPruebas', { mientras: null });
const Alarma = perezoso(() => import('./EsencialVida.jsx'), 'Alarma', { mientras: null });

// ---------- (7 y 14) «¿Qué necesitas?» en Hoy, y lo que abre cada aviso ----------
// Y si la app se abre desde un aviso (#hoy/<clave>, migración 100), se abre lo que anuncia.
const claveAviso = () => { try { return /^#hoy\/([a-z_]{2,20})$/.exec(location.hash)?.[1] || null; } catch { return null; } };
// (v0.246) si la app se abrió en frío desde el aviso, la clave la guardó AtletaApp (la dirección ya es «#hoy»): se usa una vez
const avisoGuardado = () => { try { const k = sessionStorage.getItem('fbe-hoy-aviso'); sessionStorage.removeItem('fbe-hoy-aviso'); return /^[a-z_]{2,20}$/.test(k || '') ? k : null; } catch { return null; } };
export function QueNecesitas({ p, cuestionario = null, recargarPrograma }) {
  const { backend, atleta } = useApp();
  const [abrir, setAbrir] = useState(() => { const g = avisoGuardado(); return claveAviso() || g; });
  useEffect(() => {
    const oir = () => { const k = claveAviso(); if (k) setAbrir(k); };
    window.addEventListener('hashchange', oir);
    return () => window.removeEventListener('hashchange', oir);
  }, []);
  const previa = usePrevia();
  // { tipo: 'respuestas' | 'plan' | 'dias' | 'rutina' | 'directo' | 'revision' | (v0.247) 'viaje' | 'molestia' | 'sitio' | 'ejercicios' | 'objetivo' | 'enfermo' | 'suave'
  //   | (v0.254) 'herramientas' | 'medicacion' | (v0.255) 'pruebas', id? }
  const [hoja, setHoja] = useState(null);
  const hay100 = useCarga(() => datos.notas(backend, atleta.id, 'pregunta_directo').then((x) => x !== null).catch(() => false), [atleta.id], { recuerdo: `esencial-100:${atleta.id}` });
  const accion = (a) => {
    if (a === 'pausa' || a === 'cierre') { setHoja(null); try { document.querySelector('[data-cierre]')?.scrollIntoView({ block: 'center' }); } catch { /* */ } return; }
    // (v0.246) los avisos de las agujetas y de los días sin entrenar llevan a su tarjeta, arriba en Hoy
    // (v0.250) el aviso «¿Te pesas esta semana?» abre «¿Cuándo me peso?»
    if (a === 'pesarme') { setHoja({ tipo: 'comida', id: 'pesarme' }); return; }
    if (a === 'agujetas' || a === 'vuelta' || a === 'viajando') {
      setHoja(null);
      try { document.querySelector(a === 'agujetas' ? '[data-cerca="agujetas"]' : a === 'vuelta' ? '[data-cerca="vuelta"]' : '[data-vida="viaje"]')?.scrollIntoView({ block: 'center' }); } catch { /* */ }
      return;
    }
    setHoja({ tipo: a });
  };
  useEffect(() => {
    const a = abrir && AVISO_ABRE[abrir];
    if (!a || !(p?.bloque || a === 'rutina' || a === 'pesarme')) return;
    accion(a);
    setAbrir(null);
    try { history.replaceState(history.state, '', '#hoy'); } catch { /* */ }
  }, [abrir, !!p?.bloque]);
  const tocar = (que) => { const [tipo, id] = que.split(':'); if (tipo === 'respuesta') setHoja({ tipo: 'respuestas', id }); else accion(id); };
  const conPlan = !!p?.bloque;
  // (v0.254) «Mi medicación y el ejercicio», a quien dijo en sus preguntas de salud que toma medicación a diario
  const conMedicacion = Array.isArray(cuestionario?.otras) && cuestionario.otras.includes('medicacion');
  // (v0.255) «Mis pruebas», con la 108 (donde se guardan)
  const hay108 = useCarga(() => import('../../datos/api-pruebas.js').then((m) => m.hay108(backend)).catch(() => false), [atleta.id], { recuerdo: `esencial-108:${atleta.id}` });
  const opciones = necesitasPara({ con100: hay100.datos === true, conPlan, previa, conMedicacion, con108: hay108.datos === true });
  // (v0.250, 103) las de comida, a quien tiene su plan de comida (lo apagado, solo en la vista previa)
  const comida = useComidaEsencial();
  const deComida = necesitasComida({ conPlan: !!comida?.plan, tca: !!comida?.tca, encendido: (k) => encendido(k, previa) });
  const cerrar = () => setHoja(null);
  return (
    <section class="panel panel-pad pila-s ayu-necesitas" aria-labelledby="ayu-nec-t">
      <Arte id="esencial-necesitas" />
      <strong id="ayu-nec-t">¿Qué necesitas?</strong>
      <div class="ayu-nec-f">
        {opciones.map(([id, t, icono, que]) => <button type="button" key={id} class="ayu-nec" onClick={() => tocar(que)}><span class="ayu-nec-i"><Icono n={icono} width="18" height="18" /></span><span class="ayu-nec-t">{t}</span></button>)}
        {deComida.map(([id, t, icono]) => <button type="button" key={`c-${id}`} class="ayu-nec" data-comida={id} onClick={() => setHoja({ tipo: 'comida', id })}><span class="ayu-nec-i"><Icono n={icono} width="18" height="18" /></span><span class="ayu-nec-t">{t}</span></button>)}
        <button type="button" class="ayu-nec" onClick={() => setHoja({ tipo: 'respuestas' })}><span class="ayu-nec-i"><Icono n="buscar" width="18" height="18" /></span><span class="ayu-nec-t">Otra cosa</span></button>
      </div>
      {hoja?.tipo === 'respuestas' && <CentroRespuestas inicial={hoja.id || null} alCerrar={cerrar} alAccion={accion} />}
      {hoja?.tipo === 'plan' && <HojaPlan p={p} alCerrar={cerrar} alAccion={accion} />}
      {hoja?.tipo === 'dias' && <HojaTusDias p={p} cuestionario={cuestionario} alCerrar={cerrar} alGuardar={() => recargarPrograma?.()} />}
      {hoja?.tipo === 'rutina' && <HojaRutinas p={p} cuestionario={cuestionario} alCerrar={cerrar} alCambiar={() => recargarPrograma?.()} />}
      {hoja?.tipo === 'directo' && <HojaDirecto alCerrar={cerrar} />}
      {hoja?.tipo === 'revision' && <HojaRevision alCerrar={cerrar} />}
      {hoja?.tipo === 'viaje' && <AbrirViaje alCerrar={cerrar} />}
      {hoja?.tipo === 'molestia' && <HojaMolestia alCerrar={cerrar} alAccion={accion} />}
      {hoja?.tipo === 'sitio' && <HojaSitio alCerrar={cerrar} alAccion={accion} />}
      {hoja?.tipo === 'ejercicios' && <HojaEjercicios alCerrar={cerrar} alCambiar={() => recargarPrograma?.()} />}
      {hoja?.tipo === 'objetivo' && <AbrirObjetivo alCerrar={cerrar} />}
      {hoja?.tipo === 'enfermo' && <HojaEnfermo alCerrar={cerrar} alAccion={accion} />}
      {hoja?.tipo === 'suave' && <AbrirSuave alCerrar={cerrar} />}
      {hoja?.tipo === 'comida' && <HojaComida que={hoja.id} alCerrar={cerrar} />}
      {hoja?.tipo === 'herramientas' && <HojaHerramientas cuestionario={cuestionario} alCerrar={cerrar} alMedicacion={() => setHoja({ tipo: 'medicacion' })} />}
      {hoja?.tipo === 'medicacion' && <HojaMedicacion cuestionario={cuestionario} alCerrar={cerrar} />}
      {hoja?.tipo === 'pruebas' && <HojaPruebas p={p} alCerrar={cerrar} />}
    </section>
  );
}

// ---------- (v0.249, 92) «¿Por qué te vas?»: antes de ir a su suscripción, si quiere, el motivo (opcional) ----------
export function HojaBaja({ alCerrar }) {
  const { backend, atleta, aviso } = useApp();
  const previaBaja = usePrevia();
  const [motivo, setMotivo] = useState(null);
  const [texto, setTexto] = useState('');
  const [dicho, setDicho] = useState(false);
  const [ocupado, una] = useUnaVez();
  const decir = () => una(async () => {
    try { const r = await datos.apuntarBaja(backend, atleta.id, { motivo, texto: motivo === 'otro' ? texto : null }); if (r) { setDicho(true); aviso('Gracias: Pelayo lo leerá'); } }
    catch { setDicho(true); }
  });
  return (
    <Hoja titulo="Tu suscripción" alCerrar={alCerrar}>
      <div class="pila ayu-baja">
        <Arte id="esencial-suscripcion" />
        <p class="secundario">Desde tu suscripción puedes cambiar la tarjeta o darte de baja, con el correo con el que reservaste. Sigues dentro hasta el final del periodo pagado.</p>
        {/* (v0.260, C9) antes de irse: una pausa, el plan mínimo o una rutina que encaje mejor */}
        {encendido('antes_baja', previaBaja) && <AntesDeLaBaja alCerrar={alCerrar} />}
        {!dicho && (
          <>
            <strong class="peq">Si te vas, ¿nos dices por qué? Es opcional y ayuda a mejorar.</strong>
            <div class="ayu-baja-ops" role="group" aria-label="El motivo">
              {MOTIVOS_BAJA.map(([k, t]) => <button type="button" key={k} class={motivo === k ? 'ayu-baja-op ayu-baja-op-si' : 'ayu-baja-op'} aria-pressed={motivo === k ? 'true' : 'false'} onClick={() => setMotivo(k)}>{t}</button>)}
            </div>
            {motivo === 'otro' && <textarea class="ayu-baja-area" rows={3} maxLength={300} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Cuéntanoslo en una frase (sin datos de salud)" aria-label="El motivo, en una frase" />}
            {motivo && <div class="fila-envolver"><button type="button" class="btn btn-peq" disabled={ocupado} onClick={decir}>Enviarlo</button></div>}
          </>
        )}
        {dicho && <p class="peq" role="status">Gracias por decírnoslo.</p>}
        <a class="btn btn-primario" href={PORTAL_ESENCIAL} target="_blank" rel="noopener"><Icono n="enlace" /> Ir a mi suscripción</a>
      </div>
    </Hoja>
  );
}
