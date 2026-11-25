// FBE Esencial (acompañamiento, tanda 5, v0.246): «que no entrenen solos». En su trozo (solo lo descarga quien va por su
// cuenta). En Hoy, arriba: el saludo del día, las agujetas del día después, la vuelta tras unos días sin entrenar y si baja
// el ritmo; abajo: el reto de la semana, «¿Te vas?» antes de las vacaciones, «¿Cómo vamos?», «Tu trimestre» y «Lo que la app
// ha hecho por ti». Lo que va con la voz de Pelayo (su nota de los lunes, el día a día de las dos primeras semanas) está
// apagado hasta que lo vea. Estilos: cerca.css (clases cer-*, escritas tal cual en el elemento al que se aplican).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { NOMBRE_PRIMERAS_4, WEB_FBE } from '../../logica/esencial.js';
import { hoyISO } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { semanaDelPlan } from '../../logica/esencial-lecciones.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { saludoDe, AGUJETAS, agujetasDe, vueltaDe, ritmoDe, trimestreDe, TRIMESTRE_SIGUE, retoSemana, seVa, comoVamosToca, diarioDe, notaDelLunes, VOZ_PELAYO, DIA_A_DIA, diaDelPlan } from '../../logica/esencial-cerca.js';
import * as datos from '../../datos/api-esencial.js';
import { perezoso } from '../perezoso.jsx';

const CentroRespuestas = perezoso(() => import('./EsencialAyuda.jsx'), 'CentroRespuestas', { mientras: null });
const HojaRutinas = perezoso(() => import('./EsencialRutinas.jsx'), 'HojaRutinas', { mientras: null });
// (v0.247) «Me voy de viaje», con fechas, y sus marcas de antes y de ahora (ui/atleta/EsencialVida.jsx)
const AbrirViaje = perezoso(() => import('./EsencialVida.jsx'), 'AbrirViaje', { mientras: null });
const HojaMarcasAhora = perezoso(() => import('./EsencialVida.jsx'), 'HojaMarcasAhora', { mientras: null });

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
// Sus sesiones hechas de todos sus bloques (una vez por pantalla: lo comparten el saludo, las agujetas y la vuelta)
const useHechas = (p) => {
  const { backend, atleta } = useApp();
  const n = Object.values(p?.sesiones || {}).flat().filter((s) => s.completada).length;
  return useCarga(() => datos.hechas(backend, atleta.id).catch(() => []), [atleta.id, p?.bloque?.id, n], { recuerdo: `hechas-esencial:${atleta.id}` });
};

// ---------- Arriba, en Hoy: el saludo y lo que toca atender hoy ----------
export function CercaArriba({ p, cuestionario = null, recargar, abrirSesion }) {
  const { atleta } = useApp();
  const previa = usePrevia();
  const hoy = hoyISO();
  const hechas = useHechas(p);
  const [centro, setCentro] = useState(null);
  const [rutinas, setRutinas] = useState(false);
  const w = p?.actual || null;
  const ss = w ? (p.sesiones?.[w.id] || []) : [];
  // (23) las agujetas del día después: una vez por sesión, en este móvil
  const ag = hechas.datos ? agujetasDe({ hoy, hechas: hechas.datos }) : null;
  const kAg = `fbe-esencial-agujetas:${ag?.sesion}`;
  const [como, setComo] = useState(null);
  const [agFuera, setAgFuera] = useState(false);
  // (26) días sin entrenar y (27) si baja el ritmo («Sigo igual» lo quita cuatro semanas, en este móvil)
  const inicio = (p?.bloques || []).map((b) => b.fecha_inicio).filter(Boolean).sort()[0] || null;
  const vuelta = hechas.datos ? vueltaDe({ hoy, actual: w, ss, hechas: hechas.datos, inicio }) : null;
  const ritmo = !vuelta ? ritmoDe({ actual: w, semanas: p?.semanas || [], sesiones: p?.sesiones || {} }) : null;
  const kRitmo = `fbe-esencial-ritmo:${atleta.id}`;
  const [ritmoFuera, setRitmoFuera] = useState(() => (leer(kRitmo) || '') > hoy);
  const saludo = !vuelta ? saludoDe({ hoy, actual: w, semanas: p?.semanas || [], sesiones: p?.sesiones || {} }) : null;
  // (30 y 24, apagados) la nota de Pelayo de su semana y su día a día
  const n = semanaDelPlan(p?.bloques, w?.fecha_inicio);
  const nota = encendido('notas_lunes', previa) ? notaDelLunes(n) : null;
  const voz = nota ? VOZ_PELAYO[n] || null : null;
  const dia = encendido('dia_a_dia', previa) && (p?.bloques || []).some((b) => b.nombre === NOMBRE_PRIMERAS_4) ? DIA_A_DIA[diaDelPlan({ hoy, inicio })] || null : null;
  if (!w || !p?.bloque) return null;
  const verAg = ag && !agFuera && (como || leer(kAg) !== '1');
  return (
    <>
      {saludo && (
        <div class="cer-saludo" data-tipo={saludo.tipo} role="note" aria-label="Hoy">
          <strong class="cer-saludo-t">{saludo.texto}</strong>
          {saludo.extra && <span class="cer-saludo-x peq secundario">{saludo.extra}</span>}
        </div>
      )}
      {nota && (
        <div class="cer-nota" role="note" aria-label="Una nota de Pelayo">
          <span class="cer-nota-t">{nota}</span>
          <span class="mini terciario">Pelayo · semana {n}{previa ? ' · borrador, pendiente de su visto bueno' : ''}</span>
          {voz && <audio class="cer-nota-a" controls preload="none" src={voz} />}
        </div>
      )}
      {dia && <div class="cer-dia peq" role="note"><span class="cer-dia-i"><Icono n="calendario" width="18" height="18" /></span><span>{dia}{previa ? ' (borrador)' : ''}</span></div>}
      {verAg && (
        <section class="nota-coach cer-agujetas" data-cerca="agujetas" aria-label="¿Qué tal las agujetas?">
          <Icono n="pregunta" />
          <div class="pila-s">
            <strong>{ag.motivo === 'primera' ? 'Ayer, tu primera sesión. ¿Qué tal las agujetas?' : 'Ayer fue una sesión dura. ¿Qué tal las agujetas?'}</strong>
            <div class="fila-envolver" role="group" aria-label="Cómo estás hoy">
              {AGUJETAS.map(([id, t]) => <button type="button" key={id} class={como === id ? 'cer-op cer-op-si' : 'cer-op'} aria-pressed={como === id ? 'true' : 'false'} onClick={() => { setComo(id); guardar(kAg, '1'); }}>{t}</button>)}
            </div>
            {como && <span class="peq" role="status">{AGUJETAS.find((x) => x[0] === como)[2]}</span>}
            {como === 'muchas' && <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setCentro('dolor')}>¿Y si me duele algo?</button>}
            {como && <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setAgFuera(true)}>Vale</button>}
          </div>
        </section>
      )}
      {vuelta && (
        <section class="nota-coach cer-vuelta" data-cerca="vuelta" aria-label="Volvemos cuando quieras">
          <Icono n="reiniciar" />
          <div class="pila-s">
            <strong>{vuelta.nunca ? 'Tu plan te está esperando' : `Llevas ${vuelta.dias} días sin entrenar`}</strong>
            <span class="peq">{vuelta.nunca ? 'La primera sesión es la más difícil. No hace falta que salga bien: hace falta que salga. Poco peso, apuntar lo que hagas y a casa.'
              : 'No hay nada que recuperar ni que compensar: se sigue donde tocaba. Haz solo la siguiente, sin prisa; si llevas tiempo parado, la app te prepara la vuelta con algo menos de carga.'}</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" onClick={() => abrirSesion?.(vuelta.sesion.id)}><Icono n="play" /> Hacer «{vuelta.sesion.nombre}»</button>
              <button type="button" class="btn btn-peq" onClick={() => setCentro('pausa')}>Ahora no puedo</button>
            </div>
          </div>
        </section>
      )}
      {ritmo && !ritmoFuera && (
        <section class="nota-coach cer-ritmo" aria-label="¿Lo ajustamos?">
          <Icono n="calendario" />
          <div class="pila-s">
            <strong>¿Lo ajustamos para que encaje?</strong>
            <span class="peq">Estas dos semanas has hecho {ritmo.hechas} de {ritmo.total} sesiones. Muchas veces no es falta de ganas: es que el plan no cabe en la semana. Mejor un plan más corto que cumples que uno más largo que no.</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" onClick={() => setRutinas(true)}>Ver un plan más corto</button>
              <button type="button" class="btn btn-peq" onClick={() => { guardar(kRitmo, new Date(Date.parse(`${hoy}T12:00:00Z`) + 28 * 864e5).toISOString().slice(0, 10)); setRitmoFuera(true); }}>Sigo igual</button>
            </div>
            <span class="mini terciario">En «Tu rutina» tienes rutinas de dos días y una de mantenimiento mínimo para semanas complicadas.</span>
          </div>
        </section>
      )}
      {centro && <CentroRespuestas inicial={centro} alCerrar={() => setCentro(null)} />}
      {rutinas && <HojaRutinas p={p} cuestionario={cuestionario} alCerrar={() => setRutinas(false)} alCambiar={() => recargar?.()} />}
    </>
  );
}

// ---------- (39; migración 100) «¿Cómo vamos?» ----------
function ComoVamos({ momento, n, alEnviar }) {
  const { backend, atleta, aviso } = useApp();
  const [nota, setNota] = useState(null);
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const enviar = () => una(async () => {
    try {
      const r = await datos.anotar(backend, atleta.id, 'como_vamos', { texto: texto.trim() || null, datos: { nota, momento, semana: n } });
      if (r?.falta100) { aviso('Aún no se puede guardar: prueba dentro de unos días.', 'error'); return; }
      aviso('Gracias: lo lee Pelayo');
      alEnviar?.();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad pila-s cer-vamos" aria-labelledby="cer-vamos-t">
      <strong id="cer-vamos-t">{momento === 'mes' ? 'Un mes ya. ¿Cómo vamos?' : 'Tres meses. ¿Cómo vamos?'}</strong>
      <span class="peq secundario">Del 1 al 10, ¿qué nota le pones a FBE Esencial hasta ahora? Lo lee Pelayo, para mejorarlo.</span>
      <div class="cer-notas" role="group" aria-label="Tu nota, del 1 al 10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <button type="button" key={v} class={nota === v ? 'cer-n cer-n-si' : 'cer-n'} aria-pressed={nota === v ? 'true' : 'false'} onClick={() => setNota(v)}>{v}</button>)}
      </div>
      {nota != null && (
        <>
          <label class="pila-xs">
            <span class="peq">{nota >= 9 ? '¿Qué es lo que más te está sirviendo?' : '¿Qué echas de menos?'} <span class="terciario">(si quieres)</span></span>
            <textarea class="cer-area" rows="2" maxlength="600" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
          </label>
          <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" disabled={ocupado} onClick={enviar}>Enviar</button>
        </>
      )}
    </section>
  );
}

// ---------- (29) «Tu trimestre» ----------
function HojaTrimestre({ p, cuestionario, alCerrar, recargar }) {
  const { api, backend, atleta } = useApp();
  const d = useCarga(() => datos.trimestre(api, backend, atleta.id), [atleta.id]);
  const [rutinas, setRutinas] = useState(false);
  const t = d.datos ? trimestreDe(d.datos) : null;
  return (
    <Hoja titulo="Tu trimestre" alCerrar={alCerrar}>
      <div class="pila cer-trimestre" aria-busy={d.cargando ? 'true' : 'false'}>
        {d.cargando && !t && <p class="peq secundario" role="status">Sumando tus semanas…</p>}
        {!d.cargando && !t && <p class="peq secundario">Aún no hay bastante que comparar: vuelve cuando lleves un par de semanas con tu rutina.</p>}
        {t && (
          <>
            <header class="pila-xs">
              <strong class="cer-tri-t" role="heading" aria-level="3">{t.titulo}</strong>
              <span class="peq secundario">{t.resumen}</span>
            </header>
            <ul class="cer-tri-l" aria-label="Cada ejercicio, de cómo empezaste a cómo vas">
              {t.lineas.map((l) => (
                <li key={l.nombre} class="cer-tri-f">
                  <span class="cer-tri-n">{l.nombre}</span>
                  <span class={l.sube ? 'cer-tri-x cer-tri-sube num peq' : 'cer-tri-x num peq'}>{l.texto}</span>
                </li>
              ))}
            </ul>
            <p class="mini terciario">Los kilos, de tu primera semana con esta rutina a la de ahora.</p>
            <section class="pila-s" aria-labelledby="cer-sigue-t">
              <strong id="cer-sigue-t">Y ahora, ¿qué?</strong>
              {TRIMESTRE_SIGUE.map(([id, titulo, texto]) => (
                <div key={id} class="cer-sigue">
                  <span class="pila-xs"><strong class="peq">{titulo}</strong><span class="peq secundario">{texto}</span></span>
                  {id === 'seguir' && <button type="button" class="btn btn-peq" onClick={alCerrar}>Sigo</button>}
                  {id === 'cambiar' && <button type="button" class="btn btn-peq" onClick={() => setRutinas(true)}>Ver rutinas</button>}
                  {id === 'programa' && <a class="btn btn-peq" href={`${WEB_FBE}/programas.html`} target="_blank" rel="noopener">Verlos</a>}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      {rutinas && <HojaRutinas p={p} cuestionario={cuestionario} alCerrar={() => setRutinas(false)} alCambiar={() => recargar?.()} />}
    </Hoja>
  );
}

// ---------- (21) «Lo que la app ha hecho por ti» ----------
export function HojaDiario({ p, alCerrar }) {
  const filas = diarioDe({ bloques: p?.bloques || [], semanas: p?.semanas || [], sesiones: p?.sesiones || {}, hoy: hoyISO() });
  return (
    <Hoja titulo="Lo que la app ha hecho por ti" alCerrar={alCerrar}>
      <div class="pila cer-diario">
        <p class="secundario">Cada decisión que la app ha tomado con tu plan, y por qué. La más reciente, primero.</p>
        {filas.length ? (
          <ol class="cer-diario-l">
            {filas.map((f, i) => (
              <li key={`${f.fecha}:${i}`} class="cer-diario-f">
                <span class="cer-diario-i"><Icono n={f.icono} width="18" height="18" /></span>
                <span class="pila-xs">
                  <span class="mini terciario">{fechaLarga(f.fecha)}</span>
                  <strong class="peq">{f.titulo}</strong>
                  <span class="peq secundario">{f.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : <p class="peq secundario">Todavía no hay nada que contar: en cuanto la app te prepare tu primera semana, sale aquí.</p>}
        <p class="mini terciario">El porqué de cada ejercicio lo tienes en «Tu revisión de la semana».</p>
      </div>
    </Hoja>
  );
}

// ---------- Abajo, en Hoy: el reto de la semana, «¿Te vas?», «¿Cómo vamos?», su trimestre y el diario ----------
export function CercaAbajo({ p, cuestionario = null, recargar }) {
  const { backend, atleta } = useApp();
  const hoy = hoyISO();
  const w = p?.actual || null;
  const ss = w ? (p.sesiones?.[w.id] || []) : [];
  const empezada = !!w && String(w.fecha_inicio || '').slice(0, 10) <= hoy;
  const equipo = useCarga(() => (empezada ? datos.equipoSemana(backend).catch(() => null) : Promise.resolve(null)), [atleta.id, empezada, ss.filter((s) => s.completada).length], { recuerdo: `equipo-esencial:${atleta.id}` });
  const n = semanaDelPlan(p?.bloques, w?.fecha_inicio) || w?.numero || null;
  const notas = useCarga(() => (n >= 4 ? datos.notas(backend, atleta.id, 'como_vamos').catch(() => null) : Promise.resolve(null)), [atleta.id, n >= 4]);
  const [hoja, setHoja] = useState(null);   // 'trimestre' | 'diario' | 'viaje' | 'marcas'
  const va = seVa(hoy);
  const kVa = `fbe-esencial-va:${atleta.id}:${va?.id}`;
  const [vaFuera, setVaFuera] = useState(false);
  if (!w || !p?.bloque || !empezada) return null;
  const reto = retoSemana({ ss, equipo: equipo.datos });
  const toca = Array.isArray(notas.datos) ? comoVamosToca({ n, notas: notas.datos }) : null;
  const verVa = va && !vaFuera && leer(kVa) !== '1';
  const trimestre = n >= 12 && n <= 14;
  return (
    <>
      {reto && (
        <section class={reto.hecho ? 'cer-reto cer-reto-ok' : 'cer-reto'} aria-label="El reto de la semana">
          <span class="cer-reto-i"><Icono n={reto.hecho ? 'trofeo' : 'bandera'} width="18" height="18" /></span>
          <span class="pila-xs">
            <strong class="peq">{reto.texto}</strong>
            {reto.gente && <span class="peq secundario">{reto.gente}</span>}
          </span>
          <span class="cer-reto-n num" aria-hidden="true">{reto.hechas}/{reto.total}</span>
        </section>
      )}
      {verVa && (
        <section class="nota-coach cer-va" aria-label="¿Te vas?">
          <Icono n="calendario" />
          <div class="pila-s">
            <span class="peq"><strong>¿Te vas {va.cuando}?</strong> Mejor decidirlo ahora que improvisarlo: una semana en pausa, una rutina de viaje o seguir igual. Las tres valen.</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" onClick={() => setHoja('viaje')}>Sí: ver qué hago</button>
              <button type="button" class="btn btn-peq" onClick={() => { guardar(kVa, '1'); setVaFuera(true); }}>No, sigo igual</button>
            </div>
          </div>
        </section>
      )}
      {toca && <ComoVamos momento={toca} n={n} alEnviar={() => notas.recargar(true)} />}
      {trimestre && (
        <section class="nota-coach cer-tri" aria-label="Tu trimestre">
          <Icono n="progreso" />
          <div class="pila-s">
            <strong>{n} semanas: tu trimestre</strong>
            <span class="peq">Lo que movías al empezar y lo que mueves ahora, ejercicio a ejercicio. Y qué toca: seguir, cambiar de rutina o dar un paso más.</span>
            <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" onClick={() => setHoja('trimestre')}>Ver mi trimestre</button>
          </div>
        </section>
      )}
      <div class="cer-pie">
        <button type="button" class="btn-texto mini" onClick={() => setHoja('diario')}><Icono n="historial" /> Lo que la app ha hecho por ti</button>
        {!trimestre && n >= 3 && <button type="button" class="btn-texto mini" onClick={() => setHoja('trimestre')}><Icono n="progreso" /> Lo que llevas</button>}
        {n >= 6 && <button type="button" class="btn-texto mini" onClick={() => setHoja('marcas')}><Icono n="trofeo" /> Tus marcas, antes y ahora</button>}
      </div>
      {hoja === 'trimestre' && <HojaTrimestre p={p} cuestionario={cuestionario} recargar={recargar} alCerrar={() => setHoja(null)} />}
      {hoja === 'diario' && <HojaDiario p={p} alCerrar={() => setHoja(null)} />}
      {hoja === 'viaje' && <AbrirViaje alCerrar={() => setHoja(null)} alGuardar={() => { guardar(kVa, '1'); setVaFuera(true); }} />}
      {hoja === 'marcas' && <HojaMarcasAhora alCerrar={() => setHoja(null)} />}
    </>
  );
}
