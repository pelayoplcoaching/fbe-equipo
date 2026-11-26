// FBE Esencial (tanda 7, v0.248): «La espera», de la reserva a su lunes. En su trozo (solo lo descarga quien va por su
// cuenta). En Hoy, mientras no ha empezado: la cuenta atrás con lo que le falta para estar listo y UNA cosa pequeña cada
// día (su porqué, su gimnasio, un ejercicio al día, su punto de partida, el calendario, ensayar una serie, cuántos empiezan
// con él, el aviso de prueba, su primer día paso a paso y, la víspera, su primera sesión). Si entra tarde, solo lo
// imprescindible. Después de empezar: su porqué, de vuelta la primera semana que falla. Apagado hasta que Pelayo lo vea:
// sus kilos de partida (quien ya entrena) y la hoja para su médico (es de salud).
// Estilos: espera.css (clases lun-*, escritas tal cual en el elemento al que se aplican).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { estadoEsencial, fechaLarga, inicioEsencial } from '../../logica/esencial-alta.js';
import { NOMBRE_PRIMERAS_4 } from '../../logica/esencial.js';
import { nivelDe } from '../../logica/esencial-gustos.js';
import { leerDias } from '../../logica/esencial-dias.js';
import { esperaDe, pasoDeHoy, listaListo, tituloListo, dosCosas, primerDia, PRUEBA_AVISO, ARREGLAR_AVISOS, sistemaDe, textoCompaneros, validarPartida,
  primeraFallada, textoPorque, limpiarKilos, textoKilosPartida, textoMedico, MIENTRAS_MEDICO, diasEntre } from '../../logica/esencial-espera.js';
import { LIMITES } from '../../logica/personal.js';
import { suscripcionActual } from '../../datos/push.js';
import { useTrato } from '../trato.js';
import { useIntegraciones, HojaSuscripcion } from './Conexiones.jsx';
import * as datos from '../../datos/api-esencial.js';
import { loDeHoy } from '../../logica/esencial-porque.js';
import { perezoso } from '../perezoso.jsx';
// (v0.253) sus ilustraciones (F4): una arriba de cada hoja de antes de tu lunes
import { Arte } from './EsencialArte.jsx';

const HojaTusDias = perezoso(() => import('./Esencial.jsx'), 'HojaTusDias', { mientras: null });
const PasoAvisos = perezoso(() => import('./Esencial.jsx'), 'PasoAvisos', { mientras: null });
const FichaEjercicio = perezoso(() => import('../FichaEjercicio.jsx'), 'FichaEjercicio', { mientras: null });

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Lo que lleva hecho de la espera, en este móvil: { hechos: { id: 'AAAA-MM-DD' }, vistos: ['AAAA-MM-DD', …] }
const claveEspera = (id) => `fbe-esencial-espera:${id}`;
function useHechos(atletaId) {
  const [x, setX] = useState(() => { try { const v = JSON.parse(leer(claveEspera(atletaId)) || '{}'); return { hechos: v.hechos || {}, vistos: Array.isArray(v.vistos) ? v.vistos : [] }; } catch { return { hechos: {}, vistos: [] }; } });
  const poner = (f) => setX((ant) => { const nuevo = f(ant); guardar(claveEspera(atletaId), JSON.stringify(nuevo)); return nuevo; });
  return [x, (id, dia) => poner((a) => ({ ...a, hechos: { ...a.hechos, [id]: dia } })), (dia) => poner((a) => ({ ...a, vistos: [...a.vistos, dia] }))];
}

// ---------- En Hoy, mientras no ha empezado ----------
// (lo de dentro solo se monta antes de su lunes: después, ni lo pide a la base)
export function EsperaArriba(props) {
  const { atleta } = useApp();
  const p = props.p;
  const hoyReal = hoyISO();
  const inicio = (p?.bloques || []).map((b) => String(b.fecha_inicio || '').slice(0, 10)).filter(Boolean).sort()[0] || atleta?.esencial_inicio || inicioEsencial(hoyReal);
  if (!esperaDe({ hoy: hoyReal, inicio, alta: atleta?.fecha_alta || null })) return null;
  return <EsperaTarjeta {...props} inicio={inicio} />;
}
function EsperaTarjeta({ p, cuestionario = null, irA = null, inicio }) {
  const { api, backend, atleta, modo } = useApp();
  const previa = usePrevia();
  const hoyReal = hoyISO();
  const conPlan = !!p?.bloque;
  // (78) en la demo, la espera día a día: el día que se mira (los días que faltan)
  const [simulado, setSimulado] = useState(null);
  const hoy = simulado != null ? sumar(inicio, -simulado) : hoyReal;
  const e = esperaDe({ hoy, inicio, alta: atleta?.fecha_alta || null });
  const [x, hecho, visto] = useHechos(atleta.id);
  const [hoja, setHoja] = useState(null);
  const ficha = useCarga(() => api.estadoEsencial(atleta.id), [atleta.id, cuestionario?.completado_en, cuestionario?.resultado], { recuerdo: `estado-esencial:${atleta.id}` });
  const [vueltaAvisos, setVueltaAvisos] = useState(0);
  const avisos = useCarga(async () => {
    if (modo === 'demo') { const pr = await api.preferenciasNotificaciones().catch(() => null); return pr?.email ? 'correo' : null; }
    const s = await suscripcionActual().catch(() => null);
    if (s) return 'movil';
    const pr = await api.preferenciasNotificaciones().catch(() => null);
    return pr?.email ? 'correo' : null;
  }, [atleta.id, vueltaAvisos]);
  const [diasPuestos, setDiasPuestos] = useState(() => leerDias(atleta.id));
  const gim = useCarga(() => (conPlan ? datos.gimnasioMirado(backend, atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, conPlan, x.hechos.gimnasio], { recuerdo: `esencial-gimnasio:${atleta.id}` });
  const ejs = useCarga(() => (conPlan ? datos.ejerciciosSemana1(api, atleta.id, p).catch(() => []) : Promise.resolve([])), [conPlan ? p.bloque.id : 'sin'], { recuerdo: `esencial-espera-ej:${atleta.id}:${conPlan ? p.bloque.id : 'sin'}` });
  const comp = useCarga(() => datos.companeros(backend).catch(() => null), [atleta.id], { recuerdo: `esencial-companeros:${atleta.id}` });
  const tca = useCarga(() => (api.esencialTca ? api.esencialTca(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id]);
  const integ = useIntegraciones([hoja]);
  const { personal } = useTrato();
  if (!e || ficha.datos?.falta091) return null;
  const est = estadoEsencial({ bloque: p?.bloque || null, cuestionario, ficha: ficha.datos, hoy: hoyReal, rutina: atleta.esencial_plantilla ?? null, con099: 'esencial_plantilla' in atleta });
  const tipo = est?.tipo || (conPlan ? 'espera' : null);
  const w1 = [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero)[0] || null;
  const ss1 = w1 ? (p.sesiones?.[w1.id] || []) : [];
  const dias = !!diasPuestos || (ss1.length > 0 && ss1.every((s) => s.dia_previsto));
  const alternativas = Object.keys(atleta?.esencial_alternativas || {}).length > 0;
  const lista = listaListo({ estado: tipo, pideVistoBueno: !!cuestionario?.resultado && cuestionario.resultado !== 'sin_valoracion', conPlan, dias, avisos: !!avisos.datos, gimnasio: gim.datos === true || alternativas || !!x.hechos.gimnasio });
  const items = e.corta ? lista.items.filter((i) => i.id !== 'gimnasio') : lista.items;
  const quedan = items.filter((i) => !i.hecho).length;
  const lista1 = ejs.datos || [];
  const hechos = {
    porque: !!personal?.porque || !!x.hechos.porque,
    gimnasio: gim.datos === true || alternativas || !!x.hechos.gimnasio,
    partida: !!x.hechos.partida || tca.datos === true,
    calendario: !!integ.datos?.calendario?.activo || !!x.hechos.calendario || !!integ.datos?.sin,
    ensayo: !!x.hechos.ensayo,
    companeros: !!x.hechos.companeros || comp.datos == null,
    avisos: !!x.hechos.avisos,
    primer_dia: !!x.hechos.primer_dia,
    vistos: x.vistos.length,
  };
  const vistoHoy = x.vistos.includes(hoy);
  const paso = pasoDeHoy({ faltan: e.faltan, hechos, conPlan, corta: e.corta, ejercicios: lista1.length, vistoHoy });
  const experto = nivelDe(cuestionario?.experiencia) > 0;
  const primeras = p?.bloque?.nombre === NOMBRE_PRIMERAS_4 || (!conPlan && !experto);
  const abrir = (id) => setHoja(id);
  const accion = {
    dias: conPlan ? ['Elegir', () => abrir('dias')] : null,
    avisos: ['Activar', () => abrir('avisos')],
    gimnasio: conPlan ? ['Mirar', () => abrir('gimnasio')] : null,
  };
  return (
    <section class="panel panel-pad pila-s lun-tarjeta" aria-labelledby="lun-t" data-faltan={e.faltan}>
      <header class="lun-cab">
        <span class="lun-cuenta num" aria-hidden="true">{e.faltan}</span>
        <span class="pila-xs">
          <strong id="lun-t">{e.titulo}</strong>
          <span class="peq secundario">{e.corta ? `Empiezas el ${fechaLarga(inicio)}: esto es lo que no puede faltar.` : `${e.cuando}. Empiezas el ${fechaLarga(inicio)}.`}</span>
        </span>
      </header>
      {/* (62) lo que le falta para estar listo */}
      <div class="lun-lista" role="list" aria-label={tituloListo(quedan)}>
        <strong class="peq lun-lista-t">{tituloListo(quedan)}</strong>
        {items.map((i) => (
          <div key={i.id} role="listitem" class={i.hecho ? 'lun-item lun-item-si' : 'lun-item'}>
            <span class={i.hecho ? 'lun-marca lun-marca-si' : 'lun-marca'} aria-hidden="true">{i.hecho ? <Icono n="hecho" width="16" height="16" /> : null}</span>
            <span class="peq lun-item-t">{i.titulo}<span class="sr">{i.hecho ? ': hecho' : ': por hacer'}</span>
              {!i.hecho && i.sinPlan && <span class="mini terciario"> · cuando tengas tu plan</span>}
              {!i.hecho && i.espera && <span class="mini terciario"> · Pelayo lo está revisando</span>}
            </span>
            {!i.hecho && accion[i.id] && <button type="button" class="btn btn-peq" onClick={accion[i.id][1]}>{accion[i.id][0]}</button>}
          </div>
        ))}
      </div>
      {/* (61) una cosa pequeña cada día */}
      <div class="lun-hoy" aria-labelledby="lun-hoy-t">
        <span class="mini lun-hoy-et">Lo de hoy</span>
        {paso ? <PasoHoy paso={paso} lista={lista1} p={p} n={comp.datos} inicio={inicio} irA={irA}
          alAbrir={abrir} alHecho={(id) => hecho(id, hoy)} alVisto={() => visto(hoy)} />
          : <span class="pila-xs"><strong id="lun-hoy-t">Todo listo por hoy</strong><span class="peq secundario">Ya has hecho todo lo de estos días. Mañana, si toca algo, te lo decimos aquí.</span></span>}
      </div>
      {/* (70, apagado) sus kilos de partida, quien ya entrena */}
      {conPlan && experto && encendido('kilos_partida', previa) && (
        <div class="lun-extra">
          <span class="peq">¿Ya entrenas? Apunta con cuántos kilos vas ahora en tus ejercicios: la semana 1 te los recordará.{previa ? ' (borrador)' : ''}</span>
          <button type="button" class="btn btn-peq" onClick={() => abrir('kilos')}>Mis kilos</button>
        </div>
      )}
      {/* (74, apagado: es de salud) qué pedirle a su médico */}
      {['visto_bueno', 'revision'].includes(tipo) && encendido('medico', previa) && (
        <div class="lun-extra">
          <span class="peq">¿Qué le digo a mi médico? Un texto corto para enseñárselo, y qué pasa mientras.{previa ? ' (borrador)' : ''}</span>
          <button type="button" class="btn btn-peq" onClick={() => abrir('medico')}>Verlo</button>
        </div>
      )}
      {/* (78) solo en la demo: la espera, día a día */}
      {modo === 'demo' && (
        <div class="lun-demo">
          <label class="mini lun-demo-t" for="lun-dia">Solo en la demo: ver la espera {simulado != null ? `a ${simulado === 1 ? '1 día' : `${simulado} días`} de su lunes` : 'día a día'}</label>
          <input id="lun-dia" class="lun-rango" type="range" min="1" max="27" step="1" value={simulado ?? Math.min(27, Math.max(1, diasEntre(hoyReal, inicio)))}
            onInput={(ev) => setSimulado(Number(ev.currentTarget.value))} aria-valuetext={`Faltan ${simulado ?? diasEntre(hoyReal, inicio)} días`} />
          {simulado != null && <button type="button" class="btn-texto mini" onClick={() => setSimulado(null)}><Icono n="reiniciar" /> Volver a hoy</button>}
        </div>
      )}
      {hoja === 'dias' && <HojaTusDias p={p} cuestionario={cuestionario} alCerrar={() => setHoja(null)} alGuardar={(d) => setDiasPuestos(d)} />}
      {hoja === 'avisos' && <HojaAvisosPrueba alCerrar={() => { setHoja(null); setVueltaAvisos((n) => n + 1); }} alLlego={() => hecho('avisos', hoy)} />}
      {hoja === 'gimnasio' && <HojaGimnasio alCerrar={() => setHoja(null)} alListo={() => hecho('gimnasio', hoy)} />}
      {hoja === 'porque' && <HojaPorque alCerrar={() => setHoja(null)} alGuardar={() => hecho('porque', hoy)} />}
      {hoja === 'partida' && <HojaPartida alCerrar={() => setHoja(null)} alHecho={() => hecho('partida', hoy)} />}
      {hoja === 'calendario' && <HojaSuscripcion estado={integ.datos || {}} alCerrar={() => { setHoja(null); hecho('calendario', hoy); }} />}
      {hoja === 'ensayo' && <HojaEnsayo lista={lista1} primeras={primeras} alCerrar={() => setHoja(null)} alHecho={() => hecho('ensayo', hoy)} />}
      {hoja === 'primer_dia' && <HojaPrimerDia primeras={primeras} alCerrar={() => setHoja(null)} />}
      {hoja === 'kilos' && <HojaKilos lista={lista1} alCerrar={() => setHoja(null)} />}
      {hoja === 'medico' && <HojaMedico dias={ss1.length || 2} minutos={cuestionario?.minutos_sesion || 45} alCerrar={() => setHoja(null)} />}
    </section>
  );
}

// «Lo de hoy»: lo que toca, con su botón (o, en el ejercicio del día, los compañeros y la víspera, ahí mismo)
function PasoHoy({ paso, lista, p, n, inicio, irA, alAbrir, alHecho, alVisto }) {
  const { atleta } = useApp();
  const [ficha, setFicha] = useState(null);
  const cab = <strong id="lun-hoy-t">{paso.titulo}</strong>;
  if (paso.id === 'ejercicio') {
    const x = lista[paso.n] || null;
    if (!x) return null;
    const [a, b] = dosCosas(x.ejercicio, x.nota);
    return (
      <div class="pila-s">
        <span class="pila-xs">{cab}<span class="peq secundario">{`Hoy, ${x.ejercicio.nombre} (${paso.n + 1} de ${lista.length}).`}</span></span>
        <div class="lun-cosas" role="list" aria-label="Dos cosas en las que fijarte">
          <span role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true">1</span><span>{a}</span></span>
          <span role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true">2</span><span>{b}</span></span>
        </div>
        <span class="fila-envolver">
          {x.ejercicio.id && (x.ejercicio.video_url || x.ejercicio.instrucciones) && <button type="button" class="btn btn-peq" onClick={() => setFicha(x.ejercicio)}><Icono n="video" /> Ver cómo se hace</button>}
          {paso.visto ? <span class="peq lun-hecho" role="status"><Icono n="hecho" width="18" height="18" /> Visto. Mañana, el siguiente.</span>
            : <button type="button" class="btn btn-peq btn-primario" onClick={alVisto}>Visto</button>}
        </span>
        {ficha && <FichaEjercicio atletaId={atleta.id} ejercicio={ficha} inicial="tecnica" alCerrar={() => setFicha(null)} />}
      </div>
    );
  }
  if (paso.id === 'companeros') {
    const t = textoCompaneros(n, inicio, fechaLarga);
    return (
      <div class="pila-s">
        <span class="pila-xs">{cab}<span class="peq secundario">{t ? `${t} Si quieres, preséntate en Equipo: di quién eres y qué te ha traído.` : paso.texto}</span></span>
        <span class="fila-envolver">
          {irA && <button type="button" class="btn btn-peq btn-primario" onClick={() => { alHecho('companeros'); irA('equipo'); }}><Icono n="equipo" /> Ir a Equipo</button>}
          <button type="button" class="btn btn-peq" onClick={() => alHecho('companeros')}>Ahora no</button>
        </span>
      </div>
    );
  }
  if (paso.id === 'vispera') return <Vispera p={p} cab={cab} irA={irA} />;
  const boton = { porque: 'Escribirlo', gimnasio: 'Mirar mi gimnasio', partida: 'Apuntarlo', calendario: 'Ponerlo', ensayo: 'Ensayar', avisos: 'Probar', primer_dia: 'Verlo' }[paso.id];
  return (
    <div class="pila-s">
      <span class="pila-xs">{cab}<span class="peq secundario">{paso.texto}</span></span>
      <span class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" onClick={() => { if (paso.id === 'primer_dia') alHecho('primer_dia'); alAbrir(paso.id); }}>{boton}</button>
        {paso.id === 'partida' && <button type="button" class="btn btn-peq" onClick={() => alHecho('partida')}>Prefiero no</button>}
      </span>
    </div>
  );
}

// (76) La víspera: su primera sesión, ya a la vista
function Vispera({ p, cab, irA }) {
  const { api, atleta } = useApp();
  const w = [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero)[0] || null;
  const ss = w ? [...(p.sesiones?.[w.id] || [])].sort((a, b) => String(a.dia_previsto || '9').localeCompare(String(b.dia_previsto || '9')) || a.orden - b.orden) : [];
  const s = ss[0] || null;
  const d = useCarga(() => (s ? api.sesion(s.id, atleta.id).catch(() => null) : Promise.resolve(null)), [s?.id]);
  const r = d.datos?.ejercicios?.length ? loDeHoy({ ejercicios: d.datos.ejercicios }) : null;
  return (
    <div class="pila-s">
      <span class="pila-xs">{cab}<span class="peq secundario">{s ? `${s.nombre || 'Tu sesión 1'}${s.dia_previsto ? `, el ${fechaLarga(String(s.dia_previsto).slice(0, 10))}` : ''}. Se abre mañana en Hoy.` : 'Se abre mañana en Hoy.'}</span></span>
      {r && (
        <div class="lun-cosas" role="list" aria-label="Tu primera sesión, en dos líneas">
          <span role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true"><Icono n="reloj" width="14" height="14" /></span><span>{`Unos ${r.minutos} minutos: ${r.ejercicios} ${r.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}, ${r.series} series.`}</span></span>
          {r.importante && <span role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true"><Icono n="diana" width="14" height="14" /></span><span>{`Lo importante: ${r.importante}. Si vas justo de tiempo, que no falte.`}</span></span>}
        </div>
      )}
      {irA && <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => irA('semana')}><Icono n="semana" /> Ver tu semana 1</button>}
    </div>
  );
}

// ---------- (67) ¿Te llegan los avisos? ----------
export function HojaAvisosPrueba({ alCerrar, alLlego = null }) {
  const { api } = useApp();
  const [r, setR] = useState(null);   // 'ok' | 'sin_canal' | 'espera' | 'llego' | 'no'
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const probar = () => una(async () => {
    setError(null);
    try { setR(await api.probarNotificacion()); } catch (e) { setError(e.message); }
  });
  const sistema = sistemaDe(typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return (
    <Hoja titulo="¿Te llegan los avisos?" alCerrar={alCerrar}>
      <div class="pila lun-avisos">
        <Arte id="esencial-avisos-prueba" />
        <p class="secundario">Te avisamos la víspera y el día en que empiezas y el día que toca entrenar. Mándate uno de prueba para saber que te llegan.</p>
        {r !== 'llego' && <button type="button" class="btn btn-primario" disabled={ocupado} onClick={probar}><Icono n="campana" /> {r ? 'Probar otra vez' : 'Mandarme un aviso de prueba'}</button>}
        {r && PRUEBA_AVISO[r] && <p class="peq" role="status">{PRUEBA_AVISO[r]}</p>}
        {r === 'ok' && (
          <span class="fila-envolver">
            <button type="button" class="btn btn-peq btn-primario" onClick={() => { setR('llego'); alLlego?.(); }}>Sí, me ha llegado</button>
            <button type="button" class="btn btn-peq" onClick={() => setR('no')}>No me ha llegado</button>
          </span>
        )}
        {r === 'llego' && <p class="peq lun-hecho" role="status"><Icono n="hecho" width="18" height="18" /> Perfecto: así te llegarán.</p>}
        {r === 'no' && (
          <div class="pila-s">
            <strong class="peq">Mira esto en tu móvil</strong>
            <div class="lun-cosas" role="list">
              {ARREGLAR_AVISOS[sistema].map((t, i) => <span key={i} role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true">{i + 1}</span><span>{t}</span></span>)}
            </div>
          </div>
        )}
        {['sin_canal', 'no'].includes(r) && <PasoAvisos />}
        {error && <p class="error" role="alert">{error}</p>}
      </div>
    </Hoja>
  );
}

// ---------- (63) Prepara tu gimnasio ----------
export function HojaGimnasio({ alCerrar, alListo = null }) {
  const { api, backend, atleta, aviso } = useApp();
  const lista = useCarga(() => datos.ejerciciosDeRutina(api, backend, atleta.id), [atleta.id]);
  const [falta, setFalta] = useState(null);   // id del ejercicio que no está
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (e, alt) => una(async () => {
    setError(null);
    try {
      await api.esencialAlternativa(e.id, alt?.id || null);
      aviso(alt ? `Hecho: tus sesiones ya llevan ${alt.nombre}` : `Vuelves a ${e.guia.nombre}`);
      setFalta(null); lista.recargar(true);
    } catch (err) { setError(err.message); }
  });
  const listo = () => una(async () => {
    setError(null);
    try {
      const r = await datos.marcarGimnasio(backend, atleta.id, (lista.datos || []).filter((e) => e.guia).map((e) => e.guia.id));
      if (r?.falta100) { setError('Para guardarlo falta una actualización en la base: dísela a Pelayo.'); return; }
      alListo?.(); aviso('Tu gimnasio, listo'); alCerrar();
    } catch (err) { setError(err.message); }
  });
  const filas = lista.datos || [];
  return (
    <Hoja titulo="Prepara tu gimnasio" alCerrar={alCerrar}>
      <div class="pila lun-gimnasio">
        <Arte id="esencial-prepara-gimnasio" />
        <p class="secundario">Mira si en tu gimnasio está cada máquina de tu semana 1. Si falta alguna, elige su alternativa: tus sesiones ya vendrán con ella. Como es otro ejercicio, empieza sin kilos puestos.</p>
        {lista.cargando && !lista.datos && <p class="peq secundario" role="status">Mirando tu semana 1…</p>}
        {!lista.cargando && !filas.length && <p class="peq secundario">Cuando tengas tu plan, aquí salen sus ejercicios.</p>}
        {filas.length > 0 && (
          <div class="lun-filas" role="list" aria-label="Los ejercicios de tu semana 1">
            {filas.map((e) => (
              <div key={e.id} role="listitem" class="lun-fila">
                <div class="lun-fila-c">
                  <span class="pila-xs">
                    <strong class="peq">{e.nombre}</strong>
                    {e.guia && <span class="mini terciario">En lugar de {e.guia.nombre}</span>}
                  </span>
                  {(e.opciones.length > 0 || e.guia) && <button type="button" class="btn btn-peq" aria-expanded={falta === e.id ? 'true' : 'false'} onClick={() => setFalta(falta === e.id ? null : e.id)}>{e.guia ? 'Cambiar' : 'No está'}</button>}
                </div>
                {falta === e.id && (
                  <div class="lun-alts" role="group" aria-label={`Alternativas de ${e.nombre}`}>
                    {e.opciones.map((a) => <button type="button" key={a.id} class="lun-alt" disabled={ocupado} onClick={() => cambiar(e, a)}>{a.nombre}</button>)}
                    {e.guia && <button type="button" class="lun-alt" disabled={ocupado} onClick={() => cambiar(e, null)}><Icono n="reiniciar" width="18" height="18" /> Volver a {e.guia.nombre}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        {filas.length > 0 && <button type="button" class="btn btn-primario" disabled={ocupado} onClick={listo}><Icono n="hecho" /> Todo listo en mi gimnasio</button>}
      </div>
    </Hoja>
  );
}

// ---------- (69) Tu porqué ----------
export function HojaPorque({ alCerrar, alGuardar = null }) {
  const { api, aviso } = useApp();
  const { personal } = useTrato();
  const [t, setT] = useState(personal?.porque || '');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const guardarlo = () => una(async () => {
    setError(null);
    try {
      const actual = (await api.personal().catch(() => null)) || {};
      await api.guardarPersonal({ ...actual, porque: t.trim() });
      try { globalThis.dispatchEvent?.(new Event('fbe-personal')); } catch { /* sin eventos */ }
      alGuardar?.(); aviso('Tu porqué, guardado'); alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Tu porqué" alCerrar={alCerrar}>
      <div class="pila lun-porque">
        <Arte id="esencial-porque" />
        <p class="secundario">Una frase tuya para los días que cuestan: por qué empiezas. Te la devolvemos la primera semana que se te tuerza. También la tienes en tu perfil.</p>
        <label class="etq" for="lun-porque-t">Tu porqué</label>
        <textarea id="lun-porque-t" class="lun-area" rows={3} maxLength={LIMITES.porque} value={t} onInput={(ev) => setT(ev.currentTarget.value)} placeholder="Por mí, para llegar con fuerza a los 60…" />
        <span class="mini terciario num">{t.length}/{LIMITES.porque}</span>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario" disabled={ocupado || !t.trim()} onClick={guardarlo}><Icono n="guardar" /> Guardar</button>
      </div>
    </Hoja>
  );
}

// ---------- (68) Tu punto de partida ----------
export function HojaPartida({ alCerrar, alHecho = null }) {
  const { api, atleta, aviso } = useApp();
  const [f, setF] = useState({ peso: '', cintura: '' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const guardarlo = () => una(async () => {
    setError(null);
    const v = validarPartida(f);
    if (v.error) { setError(v.error); return; }
    try {
      const hoy = hoyISO();
      if (v.peso != null) await api.guardarPeso(atleta.id, hoy, v.peso);
      if (v.cintura != null) await api.guardarMedidas(atleta.id, hoy, { cintura_cm: v.cintura });
      alHecho?.(); aviso('Tu punto de partida, guardado'); alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Tu punto de partida" alCerrar={alCerrar}>
      <div class="pila lun-partida">
        <Arte id="esencial-partida" />
        <p class="secundario">Si quieres, apunta hoy tu peso y tu cintura (a la altura del ombligo, sin apretar). A las doce semanas, en «Tu trimestre», verás cómo han cambiado. Es opcional: puedes apuntar solo uno.</p>
        <div class="lun-dos">
          <label class="pila-xs"><span class="etq">Peso (kg)</span><input class="entrada num" inputMode="decimal" value={f.peso} onInput={(ev) => setF({ ...f, peso: ev.currentTarget.value })} placeholder="70" /></label>
          <label class="pila-xs"><span class="etq">Cintura (cm)</span><input class="entrada num" inputMode="decimal" value={f.cintura} onInput={(ev) => setF({ ...f, cintura: ev.currentTarget.value })} placeholder="85" /></label>
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <span class="fila-envolver">
          <button type="button" class="btn btn-primario" disabled={ocupado} onClick={guardarlo}><Icono n="bascula" /> Guardar</button>
          <button type="button" class="btn" onClick={() => { alHecho?.(); alCerrar(); }}>Prefiero no</button>
        </span>
      </div>
    </Hoja>
  );
}

// ---------- (64) Ensaya una serie: los botones, sin guardar nada ----------
const SOBRAN = [0, 1, 2, 3, 4, 5];
export function HojaEnsayo({ lista = [], primeras = true, alCerrar, alHecho = null }) {
  const nombre = lista.find((x) => !x.ejercicio?.por_tiempo)?.ejercicio?.nombre || 'Prensa de piernas';
  const [kg, setKg] = useState(20);
  const [reps, setReps] = useState(12);
  const [sobran, setSobran] = useState(null);
  const [hecha, setHecha] = useState(false);
  const paso = (v, d, min, max) => Math.min(max, Math.max(min, Math.round((v + d) * 2) / 2));
  return (
    <Hoja titulo="Ensaya una serie" alCerrar={alCerrar}>
      <div class="pila lun-ensayo">
        <Arte id="esencial-ensayo" />
        <p class="secundario">Así se apunta una serie. Prueba los botones: no se guarda nada.</p>
        <div class="lun-serie" aria-label="Una serie de mentira">
          <span class="pila-xs"><strong class="peq">{nombre}</strong><span class="mini terciario">{primeras ? 'Serie 1 · de 10 a 12 repeticiones · te sobran 4-5' : 'Serie 1'}</span></span>
          <div class="lun-dos">
            <div class="pila-xs">
              <span class="etq" id="lun-kg-t">Kilos</span>
              <span class="lun-paso" role="group" aria-labelledby="lun-kg-t">
                <button type="button" class="lun-tecla" aria-label="Menos peso" onClick={() => setKg(paso(kg, -2.5, 0, 300))}><Icono n="menos" width="18" height="18" /></button>
                <span class="num lun-valor" aria-live="polite">{String(kg).replace('.', ',')}</span>
                <button type="button" class="lun-tecla" aria-label="Más peso" onClick={() => setKg(paso(kg, 2.5, 0, 300))}><Icono n="mas" width="18" height="18" /></button>
              </span>
            </div>
            <div class="pila-xs">
              <span class="etq" id="lun-reps-t">Repeticiones</span>
              <span class="lun-paso" role="group" aria-labelledby="lun-reps-t">
                <button type="button" class="lun-tecla" aria-label="Una repetición menos" onClick={() => setReps(paso(reps, -1, 1, 50))}><Icono n="menos" width="18" height="18" /></button>
                <span class="num lun-valor" aria-live="polite">{reps}</span>
                <button type="button" class="lun-tecla" aria-label="Una repetición más" onClick={() => setReps(paso(reps, 1, 1, 50))}><Icono n="mas" width="18" height="18" /></button>
              </span>
            </div>
          </div>
          <span class="etq" id="lun-sobran-t">¿Cuántas más habrías podido hacer?</span>
          <span class="lun-sobran" role="group" aria-labelledby="lun-sobran-t">
            {SOBRAN.map((n) => <button type="button" key={n} class={sobran === n ? 'lun-op lun-op-si' : 'lun-op'} aria-pressed={sobran === n ? 'true' : 'false'} onClick={() => setSobran(n)}>{n === 5 ? '5 o más' : n}</button>)}
          </span>
          <button type="button" class="btn btn-primario" disabled={sobran == null} onClick={() => { setHecha(true); alHecho?.(); }}><Icono n="hecho" /> Apuntar la serie</button>
        </div>
        {hecha && <p class="peq lun-hecho" role="status"><Icono n="hecho" width="18" height="18" /> {`Apuntada: ${String(kg).replace('.', ',')} kg × ${reps}, te sobraban ${sobran === 5 ? '5 o más' : sobran}. En la sesión de verdad, si haces justo lo que te propone la app, basta con tocar ✓.`}</p>}
      </div>
    </Hoja>
  );
}

// ---------- (66) Tu primer día, paso a paso ----------
export function HojaPrimerDia({ primeras = true, alCerrar }) {
  const pasos = primerDia({ primeras });
  return (
    <Hoja titulo="Tu primer día" alCerrar={alCerrar}>
      <div class="pila lun-primero">
        <Arte id="esencial-primer-dia" />
        <div class="lun-pasos" role="list" aria-label="Tu primer día, paso a paso">
          {pasos.map((x, i) => (
            <div key={x.id} role="listitem" class="lun-p">
              <span class="lun-num num" aria-hidden="true">{i + 1}</span>
              <span class="pila-xs"><strong class="peq">{x.titulo}</strong><span class="peq secundario">{x.texto}</span></span>
            </div>
          ))}
        </div>
      </div>
    </Hoja>
  );
}

// ---------- (70, apagado) Sus kilos de partida ----------
export function HojaKilos({ lista = [], alCerrar }) {
  const { backend, atleta, aviso } = useApp();
  const guardados = useCarga(() => datos.kilosPartida(backend, atleta.id), [atleta.id]);
  const [k, setK] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const valores = k || Object.fromEntries(Object.entries(guardados.datos || {}).map(([id, v]) => [id, String(v).replace('.', ',')]));
  const filas = lista.filter((x) => x.ejercicio?.id && !x.ejercicio.por_tiempo);
  const guardarlo = () => una(async () => {
    setError(null);
    const limpio = limpiarKilos(valores);
    try {
      const r = await datos.apuntarKilosPartida(backend, atleta.id, limpio);
      if (r?.falta102 || r?.falta100) { setError('Para guardarlo falta una actualización en la base: dísela a Pelayo.'); return; }
      aviso('Tus kilos de partida, guardados'); alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Tus kilos de partida" alCerrar={alCerrar}>
      <div class="pila lun-kilos">
        <Arte id="esencial-kilos-partida" />
        <p class="secundario">Con cuántos kilos haces ahora cada ejercicio, para una serie de unas diez repeticiones. En la semana 1, «¿Qué peso pongo?» te lo recordará. Deja en blanco los que no hagas.</p>
        <div class="lun-filas" role="list">
          {filas.map((x) => (
            <label key={x.ejercicio.id} role="listitem" class="lun-fila lun-fila-c">
              <span class="peq">{x.ejercicio.nombre}</span>
              <input class="entrada num lun-kg" inputMode="decimal" aria-label={`Kilos en ${x.ejercicio.nombre}`} value={valores[x.ejercicio.id] || ''} onInput={(ev) => setK({ ...valores, [x.ejercicio.id]: ev.currentTarget.value })} placeholder="kg" />
            </label>
          ))}
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario" disabled={ocupado} onClick={guardarlo}><Icono n="guardar" /> Guardar</button>
      </div>
    </Hoja>
  );
}
// En la sesión, dentro de «¿Qué peso pongo?»: sus kilos de partida de ese ejercicio (apagado hasta que Pelayo lo vea)
export function KilosPartidaPista({ ejercicioId }) {
  const { backend, atleta } = useApp();
  const previa = usePrevia();
  const on = encendido('kilos_partida', previa);
  const k = useCarga(() => (on && ejercicioId ? datos.kilosPartida(backend, atleta.id) : Promise.resolve(null)), [ejercicioId, on], { recuerdo: on ? `esencial-kilos:${atleta.id}` : null });
  const t = textoKilosPartida(k.datos?.[ejercicioId]);
  return t ? <p class="peq secundario">{t}{previa ? ' (borrador)' : ''}</p> : null;
}

// ---------- (74, apagado: es de salud) Qué pedirle a tu médico ----------
export function HojaMedico({ dias = 2, minutos = 45, alCerrar }) {
  const { aviso } = useApp();
  const t = textoMedico({ dias, minutos });
  const copiar = async () => { try { await navigator.clipboard.writeText(t); aviso('Copiado'); } catch { aviso('No se ha podido copiar: selecciónalo y cópialo a mano', 'error'); } };
  return (
    <Hoja titulo="Qué pedirle a tu médico" alCerrar={alCerrar}>
      <div class="pila lun-medico">
        <Arte id="esencial-visto-bueno" />
        <p class="secundario">Enséñale esto en la consulta (o léeselo):</p>
        <blockquote class="peq lun-cita">{t}</blockquote>
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={copiar}><Icono n="copiar" /> Copiar</button>
        <strong class="peq">Mientras tanto</strong>
        <div class="lun-cosas" role="list">
          {MIENTRAS_MEDICO.map((x, i) => <span key={i} role="listitem" class="peq lun-cosa"><span class="lun-num num" aria-hidden="true">{i + 1}</span><span>{x}</span></span>)}
        </div>
      </div>
    </Hoja>
  );
}

// ---------- (69) Después de empezar: su porqué, de vuelta la primera semana que falla (una vez) ----------
export function PorqueVuelve({ p }) {
  const { atleta } = useApp();
  const { personal } = useTrato();
  const hoy = hoyISO();
  const k = `fbe-esencial-porque-vuelve:${atleta.id}`;
  const [fuera, setFuera] = useState(() => !!leer(k));
  if (fuera || !personal?.porque) return null;
  const semanas = [...(p?.semanas || [])].filter((w) => w.fecha_inicio && sumar(String(w.fecha_inicio).slice(0, 10), 6) < hoy)
    .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)))
    .map((w) => { const ss = p.sesiones?.[w.id] || []; return { numero: w.numero, fecha_inicio: w.fecha_inicio, total: ss.length, hechas: ss.filter((s) => s.completada).length, pausa: w.esencial_cierre === 'pausa' }; });
  const w = primeraFallada(semanas);
  if (!w || diasEntre(sumar(String(w.fecha_inicio).slice(0, 10), 6), hoy) > 7) return null;
  const quitarla = () => { guardar(k, hoy); setFuera(true); };
  return (
    <section class="nota-coach lun-vuelve" aria-label="Tu porqué">
      <Icono n="diana" />
      <div class="pila-s">
        <span class="peq">{textoPorque(personal.porque)}</span>
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={quitarla}>Vale</button>
      </div>
    </section>
  );
}
