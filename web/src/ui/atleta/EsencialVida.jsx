// FBE Esencial (acompañamiento, tanda 6, v0.247): «Automatizaciones: la vida real». En su trozo (solo lo descarga quien va
// por su cuenta). En Hoy: de viaje (antes, durante y a la vuelta), los días que de verdad entrena, pasar a tres días
// cuando toca, su objetivo con fecha, el final de «Primeras 4 semanas», cuando la app no basta y los avisos por correo.
// Desde «¿Qué necesitas?»: me voy de viaje, me duele algo, entreno en otro sitio, cambiar un ejercicio y ponerme un
// objetivo. Lo que toca salud o cambia cómo se progresa (estoy enfermo, el seguimiento de una molestia, la semana suave,
// repasar la salud, la señal de alarma, la variante de un ejercicio atascado) está apagado hasta que Pelayo lo vea.
// Estilos: vida.css (clases vid-*, escritas tal cual en el elemento al que se aplican).
import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { WEB_FBE } from '../../logica/esencial.js';
import { hoyISO } from '../../logica/fechas.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { leerDias, guardarDias, planDias, nombreDias } from '../../logica/esencial-dias.js';
import { MODOS_VIAJE, validarViaje, viajeDe, proximoViaje, textoViaje, fechaCorta, SITIOS, diasReales, subirNivel, validarObjetivo, objetivoDe, textoObjetivo, OBJETIVO_MAX, finPrimeras, noBasta, sinAvisos,
  ENFERMO, MOLESTIA_SIGUE, molestiaToca, SUAVE, suaveDe, saludAlDia, SALUD_AL_DIA, ALARMA } from '../../logica/esencial-vida.js';
import * as datos from '../../datos/api-esencial.js';
import { perezoso } from '../perezoso.jsx';
// (v0.253) sus ilustraciones (F3): una arriba de cada hoja de «¿Qué necesitas?»
import { Arte } from './EsencialArte.jsx';

const HojaRutinas = perezoso(() => import('./EsencialRutinas.jsx'), 'HojaRutinas', { mientras: null });
const PasoAvisos = perezoso(() => import('./Esencial.jsx'), 'PasoAvisos', { mientras: null });
const CentroRespuestas = perezoso(() => import('./EsencialAyuda.jsx'), 'CentroRespuestas', { mientras: null });
// (v0.257, P: 'molestias_zona') la mañana siguiente y el seguimiento de una molestia, con el motor de molestias
const DolorEnHoy = perezoso(() => import('./EsencialDolorSesion.jsx'), 'DolorEnHoy', { mientras: null });

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const quitar = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// «No ahora»: la tarjeta no vuelve a salir hasta dentro de `semanas` (en este móvil)
function useAparcar(clave, semanas) {
  const hoy = hoyISO();
  const [fuera, setFuera] = useState(() => (leer(clave) || '') > hoy);
  return [fuera, () => { guardar(clave, sumar(hoy, semanas * 7)); setFuera(true); }];
}
// Lo suyo de la vida real (sus viajes, su objetivo y sus semanas suaves): null sin la migración 100
// (lo comparten las tarjetas de Hoy y las hojas que se abren desde «¿Qué necesitas?»: quien guarda algo lo dice con «fbe-vida»)
export const useNotasVida = () => {
  const { backend, atleta } = useApp();
  const c = useCarga(() => datos.notasVida(backend, atleta.id).catch(() => null), [atleta.id], { recuerdo: `vida-esencial:${atleta.id}` });
  useEffect(() => {
    const oir = () => c.recargar(true);
    window.addEventListener('fbe-vida', oir);
    return () => window.removeEventListener('fbe-vida', oir);
  }, []);
  return c;
};
const avisarVida = () => { try { window.dispatchEvent(new Event('fbe-vida')); } catch { /* sin eventos */ } };
// (los pasos y las listas van con «role» y no con <ul>: así no traen el margen del navegador)
const Pasos = ({ lista }) => (
  <div class="vid-pasos" role="list">
    {lista.map((x) => <div key={x} role="listitem" class="vid-paso peq"><span aria-hidden="true">·</span><span>{x}</span></div>)}
  </div>
);
const Opcion = ({ id, valor, alElegir, titulo, texto }) => (
  <button type="button" class={valor === id ? 'vid-modo vid-modo-si' : 'vid-modo'} aria-pressed={valor === id ? 'true' : 'false'} onClick={() => alElegir(id)}>
    <strong class="peq">{titulo}</strong>
    {texto && <span class="peq vid-modo-x">{texto}</span>}
  </button>
);

// ---------- (41) «Me voy de viaje» ----------
export function HojaViaje({ viaje = null, alCerrar, alGuardar }) {
  const { backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [desde, setDesde] = useState(viaje?.desde || '');
  const [hasta, setHasta] = useState(viaje?.hasta || '');
  const [modo, setModo] = useState(viaje?.modo || 'pausa');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const enviar = () => una(async () => {
    const mal = validarViaje({ desde, hasta, hoy });
    setError(mal);
    if (mal) return;
    try {
      const r = await datos.apuntarViaje(backend, atleta.id, { desde, hasta, modo });
      if (r?.falta100) { setError('Aún no se puede guardar un viaje desde aquí. Mientras tanto, «Esta semana no puedo» pone tu semana en pausa.'); return; }
      aviso(`Viaje apuntado: del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`);
      alGuardar?.(); alCerrar();
    } catch (e) { setError(e.message); }
  });
  const borrar = () => una(async () => { try { await datos.quitarNota(backend, viaje.id); aviso('Viaje quitado: todo sigue como siempre'); alGuardar?.(); alCerrar(); } catch (e) { setError(e.message); } });
  return (
    <Hoja titulo="Me voy de viaje" alCerrar={alCerrar}>
      <div class="pila vid-viaje">
        <Arte id="esencial-viaje" />
        <p class="secundario">Dime cuándo te vas y qué vas a hacer: la app lo deja organizado y, esos días, no te manda avisos que no tocan.</p>
        <div class="vid-fechas">
          <div class="campo"><label for="vid-desde">Me voy el</label><input id="vid-desde" class="entrada" type="date" min={sumar(hoy, -30)} max={sumar(hoy, 180)} value={desde} onInput={(e) => setDesde(e.currentTarget.value)} /></div>
          <div class="campo"><label for="vid-hasta">Vuelvo el</label><input id="vid-hasta" class="entrada" type="date" min={desde || hoy} max={sumar(hoy, 240)} value={hasta} onInput={(e) => setHasta(e.currentTarget.value)} /></div>
        </div>
        <div class="vid-modos" role="group" aria-label="Qué vas a hacer esos días">
          {MODOS_VIAJE.map(([id, t, x]) => <Opcion key={id} id={id} valor={modo} alElegir={setModo} titulo={t} texto={x} />)}
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={enviar}>{viaje ? 'Guardar los cambios' : 'Apuntar el viaje'}</button>
        {viaje && <button type="button" class="btn-texto" disabled={ocupado} onClick={borrar}>Al final no me voy: quitarlo</button>}
        <p class="mini terciario">Solo se guardan las fechas y lo que has elegido. A dónde vas, no hace falta.</p>
      </div>
    </Hoja>
  );
}

// (43) «Me duele algo»: desde la v0.256, con el motor de molestias, en EsencialDolor.jsx

// ---------- (44 y 45) «Entreno en otro sitio» ----------
export function HojaSitio({ alCerrar, alAccion = null }) {
  const [cual, setCual] = useState(null);
  const elegido = SITIOS.find(([id]) => id === cual) || null;
  return (
    <Hoja titulo="Entreno en otro sitio" alCerrar={alCerrar}>
      <div class="pila vid-sitio">
        <Arte id="esencial-otro-sitio" />
        <div class="vid-modos" role="group" aria-label="Qué ha cambiado">
          {SITIOS.map(([id, t]) => <Opcion key={id} id={id} valor={cual} alElegir={setCual} titulo={t} />)}
        </div>
        {elegido && (
          <div class="vid-que" role="status">
            <span class="peq">{elegido[2]}</span>
            {elegido[3] && alAccion && <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" onClick={() => alAccion(elegido[3])}>{elegido[3] === 'rutina' ? 'Ver rutinas para casa' : 'Ver mis ejercicios'}</button>}
          </div>
        )}
      </div>
    </Hoja>
  );
}

// ---------- (48; 47 apagado) «Cambiar un ejercicio»: para siempre, por una de sus alternativas ----------
export function HojaEjercicios({ alCerrar, alCambiar }) {
  const { api, backend, atleta, aviso } = useApp();
  const previa = usePrevia();
  const lista = useCarga(() => datos.ejerciciosDeRutina(api, backend, atleta.id), [atleta.id]);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (e, alt) => una(async () => {
    setError(null);
    try {
      await api.esencialAlternativa(e.id, alt?.id || null);
      aviso(alt ? `Hecho: tus próximas sesiones ya llevan ${alt.nombre}` : `Vuelves a ${e.guia.nombre} en tus próximas sesiones`);
      setAbierto(null); lista.recargar(true); alCambiar?.();
    } catch (err) { setError(err.message); }
  });
  const filas = lista.datos || [];
  return (
    <Hoja titulo="Cambiar un ejercicio" alCerrar={alCerrar}>
      <div class="pila vid-ejercicios">
        <Arte id="esencial-cambiar-ejercicio" />
        <p class="secundario">Si en tu gimnasio no está, no te sienta bien o no te gusta, cámbialo por una de sus alternativas: tus próximas sesiones ya vendrán con ella. Como es otro ejercicio, empieza sin kilos puestos: busca tu peso como el primer día.</p>
        {lista.cargando && !lista.datos && <p class="peq secundario" role="status">Mirando tu rutina…</p>}
        {!lista.cargando && !filas.length && <p class="peq secundario">Cuando tengas tu semana en marcha, aquí salen sus ejercicios.</p>}
        {filas.length > 0 && (
          <div class="vid-lista" role="list" aria-label="Los ejercicios de tu semana">
            {filas.map((e) => (
              <div key={e.id} role="listitem" class="vid-fila">
                <div class="vid-fila-c">
                  <span class="pila-xs">
                    <strong class="peq">{e.nombre}</strong>
                    {e.guia && <span class="mini terciario">En lugar de {e.guia.nombre}</span>}
                    {e.estancado && encendido('variante', previa) && <span class="mini vid-atascado">Tres semanas igual: una variante puede desatascarlo{previa && !encendido('variante') ? ' (borrador)' : ''}</span>}
                  </span>
                  {(e.opciones.length > 0 || e.guia) && <button type="button" class="btn btn-peq" aria-expanded={abierto === e.id ? 'true' : 'false'} onClick={() => setAbierto(abierto === e.id ? null : e.id)}>Cambiar</button>}
                </div>
                {!e.opciones.length && !e.guia && <span class="mini terciario">{e.por_tiempo ? 'Va por tiempo: se cambia en cada sesión.' : 'No tiene alternativas marcadas.'}</span>}
                {abierto === e.id && (
                  <div class="vid-alts" role="group" aria-label={`Alternativas de ${e.nombre}`}>
                    {e.opciones.map((a) => <button type="button" key={a.id} class="vid-alt" disabled={ocupado} onClick={() => cambiar(e, a)}>{a.nombre}</button>)}
                    {e.guia && <button type="button" class="vid-alt" disabled={ocupado} onClick={() => cambiar(e, null)}><Icono n="reiniciar" width="18" height="18" /> Volver a {e.guia.nombre}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        <p class="mini terciario">Para cambiarlo solo un día (la máquina está ocupada), en la sesión: «Cambiar» en ese ejercicio.</p>
      </div>
    </Hoja>
  );
}

// ---------- (50) Un objetivo con fecha ----------
export function HojaObjetivo({ nota = null, alCerrar, alGuardar }) {
  const { backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [texto, setTexto] = useState(nota?.texto || '');
  const [fecha, setFecha] = useState(nota?.hasta ? String(nota.hasta).slice(0, 10) : '');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const enviar = () => una(async () => {
    const mal = validarObjetivo({ texto, fecha, hoy });
    setError(mal);
    if (mal) return;
    try {
      const r = await datos.apuntarObjetivo(backend, atleta.id, { texto: texto.trim(), fecha });
      if (r?.falta100) { setError('Aún no se puede guardar un objetivo desde aquí: prueba dentro de unos días.'); return; }
      quitar(`fbe-esencial-objetivo-mitad:${atleta.id}`);
      aviso('Objetivo apuntado');
      alGuardar?.(); alCerrar();
    } catch (e) { setError(e.message); }
  });
  const borrar = () => una(async () => { try { await datos.quitarNota(backend, nota.id); alGuardar?.(); alCerrar(); } catch (e) { setError(e.message); } });
  return (
    <Hoja titulo="Tu objetivo" alCerrar={alCerrar}>
      <div class="pila vid-objetivo-h">
        <Arte id="esencial-objetivo" />
        <p class="secundario">Una sola cosa, con fecha. La app te recuerda cuánto falta y, a mitad de camino, te pregunta cómo vas.</p>
        <label class="pila-xs">
          <span class="peq"><strong>¿Qué quieres conseguir?</strong></span>
          <textarea class="vid-area" rows="2" maxlength={OBJETIVO_MAX} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Por ejemplo: no faltar ninguna semana hasta el verano" />
          <span class="mini terciario">{texto.length} de {OBJETIVO_MAX}. Mejor algo que dependa de ti (venir, apuntar, no faltar) que una cifra.</span>
        </label>
        <div class="campo"><label for="vid-obj-f">¿Para cuándo?</label><input id="vid-obj-f" class="entrada" type="date" min={sumar(hoy, 14)} max={sumar(hoy, 371)} value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} /></div>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={enviar}>{nota ? 'Guardar los cambios' : 'Apuntar mi objetivo'}</button>
        {nota && <button type="button" class="btn-texto" disabled={ocupado} onClick={borrar}>Quitar mi objetivo</button>}
      </div>
    </Hoja>
  );
}

// ---------- (51) Sus marcas, antes y ahora ----------
export function HojaMarcasAhora({ alCerrar }) {
  const { api, backend, atleta } = useApp();
  const d = useCarga(() => datos.marcasAntesYAhora(api, backend, atleta.id).catch(() => null), [atleta.id]);
  const m = d.datos;
  return (
    <Hoja titulo="Tus marcas, antes y ahora" alCerrar={alCerrar}>
      <div class="pila vid-marcas">
        <Arte id="esencial-marcas-ahora" />
        {d.cargando && !m && <p class="peq secundario" role="status">Buscando tus marcas…</p>}
        {!d.cargando && !m && <p class="peq secundario">Todavía no hay con qué comparar: tus marcas salen en la cuarta semana, y aquí las verás junto a lo mejor de tus dos últimas semanas.</p>}
        {m && (
          <>
            <p class="secundario">Tu mejor serie de la semana {m.desde}, tus marcas, y la mejor de tus dos últimas semanas.{m.suben > 0 ? ` Has mejorado en ${m.suben} de ${m.filas.length}.` : ''}</p>
            <div class="vid-lista" role="list" aria-label="Cada ejercicio, de tus marcas a ahora">
              {m.filas.map((f) => (
                <div key={f.nombre} role="listitem" class="vid-marca">
                  <span class="peq vid-marca-n">{f.nombre}</span>
                  <span class="peq num vid-marca-a">{f.antes}</span>
                  <strong class={f.sube ? 'peq num vid-marca-s' : 'peq num'}>{f.ahora}</strong>
                </div>
              ))}
            </div>
            <p class="mini terciario">Lo que no ha subido no es un fallo: hay semanas de descarga, de vuelta y de ajustar el peso.</p>
          </>
        )}
        <button type="button" class="btn btn-primario" onClick={alCerrar}>Vale</button>
      </div>
    </Hoja>
  );
}

// ---------- (42, apagado) «Estoy enfermo» y (52, apagado) «Necesito una semana suave» ----------
export function HojaEnfermo({ alCerrar, alAccion = null }) {
  return (
    <Hoja titulo="Estoy enfermo" alCerrar={alCerrar}>
      <div class="pila vid-enfermo">
        <Arte id="esencial-enfermo" />
        <strong>{ENFERMO.titulo}</strong>
        <Pasos lista={ENFERMO.pasos} />
        {alAccion && <button type="button" class="btn btn-primario" onClick={() => alAccion('pausa')}>Poner mi semana en pausa</button>}
        <p class="mini terciario">La app no guarda que estás enfermo ni de qué.{encendido('enfermo') ? '' : ' Borrador, pendiente del visto bueno de Pelayo.'}</p>
      </div>
    </Hoja>
  );
}
export function HojaSuave({ notas = [], alCerrar, alGuardar }) {
  const { backend, atleta, aviso } = useApp();
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const s = suaveDe(notas, hoyISO());
  const pedir = () => una(async () => {
    try {
      const r = await datos.pedirSuave(backend, atleta.id);
      if (r?.falta100) { setError('Aún no se puede pedir desde aquí.'); return; }
      aviso('Esta semana, suave'); alGuardar?.(); alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Una semana suave" alCerrar={alCerrar}>
      <div class="pila vid-suave-h">
        <Arte id="esencial-suave" />
        <p class="secundario">{SUAVE.pedir}</p>
        <div class="vid-que"><strong>{SUAVE.titulo}</strong><span class="peq">{SUAVE.texto}</span></div>
        {error && <p class="error" role="alert">{error}</p>}
        {s.esta ? <p class="peq" role="status">Ya la tienes pedida para esta semana.</p>
          : s.puede ? <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={pedir}>Esta semana, suave</button>
            : <p class="peq" role="status">Ya has tenido una hace menos de cuatro semanas. Si lo necesitas otra vez tan pronto, puede que el plan sea demasiado: mira «Cambiar de rutina».</p>}
        {!encendido('suave') && <p class="mini terciario">Borrador, pendiente del visto bueno de Pelayo.</p>}
      </div>
    </Hoja>
  );
}

// ---------- Abiertas desde «¿Qué necesitas?» (o desde «¿Te vas?»): cada hoja, con lo que ya tuviera apuntado ----------
export function AbrirViaje({ alCerrar, alGuardar = null }) {
  const notas = useNotasVida();
  // (sin la migración 100, su respuesta de siempre)
  if (!notas.datos) return notas.cargando ? null : <CentroRespuestas inicial="viaje" alCerrar={alCerrar} />;
  return <HojaViaje viaje={proximoViaje(notas.datos.viaje || [], hoyISO())} alCerrar={alCerrar} alGuardar={() => { avisarVida(); alGuardar?.(); }} />;
}
export function AbrirObjetivo({ alCerrar }) {
  const notas = useNotasVida();
  if (!notas.datos) return null;
  return <HojaObjetivo nota={(notas.datos.objetivo || [])[0] || null} alCerrar={alCerrar} alGuardar={avisarVida} />;
}
export function AbrirSuave({ alCerrar }) {
  const notas = useNotasVida();
  if (!notas.datos) return null;
  return <HojaSuave notas={notas.datos.suave || []} alCerrar={alCerrar} alGuardar={avisarVida} />;
}

// ---------- En Hoy, arriba: lo que la app ha organizado por él ----------
export function VidaArriba({ p, cuestionario = null, recargar, irA = null }) {
  const { api, backend, atleta, aviso } = useApp();
  const previa = usePrevia();
  const hoy = hoyISO();
  const notas = useNotasVida();
  const [hoja, setHoja] = useState(null);   // 'viaje' | 'objetivo' | 'rutinas'
  const [ocupado, una] = useUnaVez();
  const w = p?.actual || null;
  const ss = w ? (p.sesiones?.[w.id] || []) : [];
  const inicio = (p?.bloques || []).map((b) => b.fecha_inicio).filter(Boolean).sort()[0] || null;
  const nPlan = inicio && inicio <= hoy ? Math.floor((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${String(inicio).slice(0, 10)}T12:00:00Z`)) / (7 * 864e5)) + 1 : 0;
  // (41) el viaje que cuenta hoy
  const viaje = viajeDe(notas.datos?.viaje || [], hoy);
  const tv = textoViaje(viaje);
  const kVuelta = `fbe-esencial-viaje-visto:${viaje?.id}`;
  const [vueltaVista, setVueltaVista] = useState(false);
  // …y, si dijo que no iba a entrenar y el viaje cubre lo que queda de semana sin nada hecho, su semana pasa a pausa (una vez)
  const domingo = sumar(hoy, 7 - (new Date(`${hoy}T12:00:00Z`).getUTCDay() || 7));
  const pausable = !!viaje && viaje.estado === 'durante' && viaje.modo === 'pausa' && viaje.hasta >= domingo && ss.length > 0 && !ss.some((s) => s.completada)
    && String(w?.fecha_inicio || '').slice(0, 10) <= hoy;
  useEffect(() => {
    if (!pausable) return;
    const k = `fbe-esencial-viaje-pausa:${atleta.id}:${String(w.fecha_inicio).slice(0, 10)}`;
    if (leer(k)) return;
    guardar(k, '1');
    Promise.resolve(api.esencialCerrarSemana?.('pausa')).then((r) => { if (r && !r.falta098) { aviso('De viaje: tu semana, en pausa'); recargar?.(); } }).catch(() => {});
  }, [pausable, w?.id]);
  // (46) los días que de verdad entrena (con lo hecho en todos sus bloques; solo se mira si eligió sus días)
  const elegidos = leerDias(atleta.id);
  const [realesFuera, aparcarReales] = useAparcar(`fbe-esencial-dias-reales:${atleta.id}`, 8);
  const mirarDias = !!elegidos && !realesFuera && !!p?.bloque;
  const nHechas = Object.values(p?.sesiones || {}).flat().filter((s) => s.completada).length;
  const hechas = useCarga(() => (mirarDias ? datos.hechas(backend, atleta.id).catch(() => []) : Promise.resolve(null)), [atleta.id, mirarDias, p?.bloque?.id, nHechas], { recuerdo: `hechas-esencial:${atleta.id}` });
  const reales = !viaje && mirarDias && hechas.datos ? diasReales({ hechas: hechas.datos, elegidos, n: ss.length, hoy }) : null;
  const cambiarDias = () => una(async () => {
    try {
      guardarDias(atleta.id, reales.dias);
      const cambios = planDias({ semanas: p.semanas, sesiones: p.sesiones, dias: reales.dias, hoy });
      for (const c of cambios) await api.planificarSesion(c.id, c.dia);
      aviso(`Tus días: ${nombreDias(reales.dias)}`);
      aparcarReales(); recargar?.();
    } catch (e) { aviso(e.message, 'error'); }
  });
  // (49) pasar a tres días cuando toca
  const [pedido, setPedido] = useState(atleta?.esencial_dias ?? null);
  const sube = subirNivel({ rutina: p?.bloque?.nombre || '', actual: w, semanas: p?.semanas || [], sesiones: p?.sesiones || {}, pedido });
  const [subeFuera, aparcarSube] = useAparcar(`fbe-esencial-tres-dias:${atleta.id}`, 8);
  const pasarATres = () => una(async () => {
    try {
      const r = await api.esencialCambiarDias(3);
      if (r?.falta096) { aviso('Para cambiar de días falta una actualización en la base.', 'error'); return; }
      setPedido(3); aviso('Desde la semana que viene, tres días');
    } catch (e) { aviso(e.message, 'error'); }
  });
  // (50) su objetivo
  const notaObj = (notas.datos?.objetivo || [])[0] || null;
  const kMitad = `fbe-esencial-objetivo-mitad:${atleta.id}`;
  const [mitadVista, setMitadVista] = useState(() => leer(kMitad) === '1');
  const obj = objetivoDe(notaObj ? { ...notaObj, datos: { ...(notaObj.datos || {}), mitad: mitadVista } } : null, hoy);
  const terminarObjetivo = () => una(async () => { try { await datos.quitarNota(backend, notaObj.id); quitar(kMitad); notas.recargar(true); } catch (e) { aviso(e.message, 'error'); } });
  // (56) el final de «Primeras 4 semanas»
  const fin = finPrimeras({ bloque: p?.bloque?.nombre || '', actual: w, semanas: p?.semanas || [], sesiones: p?.sesiones || {} });
  const [finFuera, aparcarFin] = useAparcar(`fbe-esencial-fin-primeras:${atleta.id}`, 52);
  // (57) cuando la app no basta: solo se mira con cuatro meses de plan o más
  const cambios = Math.max(0, (p?.bloques || []).filter((b) => b.estado !== 'cancelado' && b.nombre !== 'Primeras 4 semanas').length - 1);
  const [bastaFuera, aparcarBasta] = useAparcar(`fbe-esencial-no-basta:${atleta.id}`, 12);
  const mirar = nPlan >= 16 && !bastaFuera && !!p?.bloque;
  const senales = useCarga(() => (mirar
    ? Promise.all([datos.rutina(api, backend, atleta.id, { bloqueId: p.bloque.id, historia: true }).catch(() => null), datos.semanasConMolestia(backend, atleta.id)]).then(([r, m]) => ({ estancados: r?.estancados || 0, molestias: m }))
    : Promise.resolve(null)), [atleta.id, mirar, p?.bloque?.id], { recuerdo: `basta-esencial:${atleta.id}`, frescoMs: 6 * 3600e3 });
  const basta = senales.datos ? noBasta({ ...senales.datos, cambios, semanas: nPlan, objetivo: !!obj }) : null;
  // (58) sin avisos de ningún tipo
  // («Prefiero sin avisos» es una decisión: no se le vuelve a preguntar en este móvil)
  const [avisosFuera, aparcarAvisos] = useAparcar(`fbe-esencial-sin-avisos:${atleta.id}`, 520);
  const mirarAvisos = nPlan >= 2 && !avisosFuera && !!p?.bloque;
  const canales = useCarga(() => (mirarAvisos
    ? Promise.all([api.preferenciasNotificaciones(), api.suscripcionesPush().catch(() => [])]).then(([prefs, subs]) => ({ email: !!prefs?.email, suscripciones: (subs || []).length })).catch(() => null)
    : Promise.resolve(null)), [atleta.id, mirarAvisos], { recuerdo: `canales-esencial:${atleta.id}`, frescoMs: 600e3 });
  const mudo = canales.datos ? sinAvisos({ ...canales.datos, semana: nPlan }) : false;
  // (apagados) la semana suave en marcha, el seguimiento de una molestia y repasar la salud
  const suave = encendido('suave', previa) ? suaveDe(notas.datos?.suave || [], hoy) : null;
  const kMol = `fbe-esencial-molestia:${atleta.id}`;
  const [mol, setMol] = useState(() => { try { return JSON.parse(leer(kMol) || 'null'); } catch { return null; } });
  // (v0.257) con el motor de molestias encendido, el seguimiento va por zonas y con su lectura de 0 a 10 (DolorEnHoy)
  const conMotorDolor = encendido('molestias_zona', previa);
  const tocaMol = encendido('molestia_sigue', previa) && !conMotorDolor && mol ? molestiaToca({ ...mol, hoy }) : null;
  const [molDicho, setMolDicho] = useState(null);
  const responderMol = (id) => { setMolDicho(id); const nuevo = { ...mol, respondido: [...(mol.respondido || []), tocaMol] }; guardar(kMol, JSON.stringify(nuevo)); };
  const [saludFuera, aparcarSalud] = useAparcar(`fbe-esencial-salud:${atleta.id}`, 26);
  const salud = encendido('salud_al_dia', previa) && !saludFuera && saludAlDia({ fecha: cuestionario?.actualizado_en || cuestionario?.completado_en, hoy });
  // De las sugerencias (sus días de verdad, pasar a tres días, un paso más y los avisos), una cada vez
  const sugerencia = reales && !realesFuera ? 'dias' : sube && !subeFuera ? 'sube' : basta ? 'basta' : mudo ? 'mudo' : null;
  if (!p?.bloque && !viaje && !obj) return null;
  return (
    <>
      {viaje && tv && !(viaje.estado === 'vuelta' && (vueltaVista || leer(kVuelta))) && (
        <section class="nota-coach vid-viaje-t" data-vida="viaje" aria-label="Tu viaje">
          <Icono n="ubicacion" />
          <div class="pila-s">
            <strong>{tv.titulo}</strong>
            <span class="peq">{tv.texto}</span>
            <div class="fila-envolver">
              {viaje.estado === 'vuelta'
                ? <>
                  {viaje.modo === 'viaje' && <button type="button" class="btn btn-primario btn-peq" onClick={() => setHoja('rutinas')}>Ver «Tu rutina»</button>}
                  <button type="button" class="btn btn-peq" onClick={() => { guardar(kVuelta, '1'); setVueltaVista(true); }}>Vale</button>
                </>
                : <>
                  {viaje.estado === 'antes' && viaje.modo === 'viaje' && <button type="button" class="btn btn-primario btn-peq" onClick={() => setHoja('rutinas')}>Ver la rutina de viaje</button>}
                  <button type="button" class="btn btn-peq" onClick={() => setHoja('viaje')}>Cambiar</button>
                </>}
            </div>
          </div>
        </section>
      )}
      {suave?.esta && (
        <section class="nota-coach vid-suave" aria-label="Semana suave" data-aviso="info">
          <Icono n="pausa" />
          <div class="pila-s"><strong>{SUAVE.titulo}{previa && !encendido('suave') ? ' (borrador)' : ''}</strong><span class="peq">{SUAVE.texto}</span></div>
        </section>
      )}
      {conMotorDolor && <DolorEnHoy />}
      {tocaMol && (
        <section class="nota-coach vid-sigue" aria-label="¿Cómo va esa molestia?">
          <Icono n="pregunta" />
          <div class="pila-s">
            <strong>{tocaMol === 3 ? 'Hace unos días te molestaba algo. ¿Cómo va?' : 'Una semana después: ¿cómo va esa molestia?'}{previa ? ' (borrador)' : ''}</strong>
            <div class="fila-envolver" role="group" aria-label="Cómo va">
              {MOLESTIA_SIGUE.map(([id, t]) => <button type="button" key={id} class={molDicho === id ? 'vid-op vid-op-si' : 'vid-op'} aria-pressed={molDicho === id ? 'true' : 'false'} onClick={() => responderMol(id)}>{t}</button>)}
            </div>
            {molDicho && <span class="peq" role="status">{MOLESTIA_SIGUE.find((x) => x[0] === molDicho)[2]}</span>}
            {molDicho && <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => { if (molDicho === 'mejor' || tocaMol === 7) { quitar(kMol); setMol(null); } else setMol({ ...mol, respondido: [...(mol.respondido || []), tocaMol] }); setMolDicho(null); }}>Vale</button>}
          </div>
        </section>
      )}
      {salud && (
        <section class="nota-coach vid-salud" aria-label="Tu salud, al día">
          <Icono n="alerta" />
          <div class="pila-s">
            <span class="peq">{SALUD_AL_DIA}{previa && !encendido('salud_al_dia') ? ' (borrador)' : ''}</span>
            <div class="fila-envolver">
              {irA && <button type="button" class="btn btn-primario btn-peq" onClick={() => irA('perfil')}>Ir a mi perfil</button>}
              <button type="button" class="btn btn-peq" onClick={aparcarSalud}>Nada ha cambiado</button>
            </div>
          </div>
        </section>
      )}
      {fin && !finFuera && (
        <section class="nota-coach vid-fin" aria-label="Tus cuatro primeras semanas">
          <Icono n="trofeo" />
          <div class="pila-s">
            <strong>Tus cuatro primeras semanas, hechas</strong>
            <Pasos lista={fin.lineas} />
            <span class="peq secundario">{fin.sigue}</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" onClick={() => setHoja('rutinas')}>Ver «Tu rutina»</button>
              <button type="button" class="btn btn-peq" onClick={aparcarFin}>Vale</button>
            </div>
          </div>
        </section>
      )}
      {obj && (
        <section class="nota-coach vid-objetivo" aria-label="Tu objetivo">
          <Icono n="diana" />
          <div class="pila-s">
            <strong class="vid-objetivo-t">{obj.texto}</strong>
            <span class="vid-barra" role="img" aria-label={`Llevas el ${obj.pct} % del tiempo hasta el ${fechaCorta(obj.fecha)}`}><span class="vid-barra-v" style={`inline-size:${obj.pct}%`} /></span>
            <span class="peq">{textoObjetivo(obj)}</span>
            <div class="fila-envolver">
              {obj.momento === 'mitad' && <button type="button" class="btn btn-primario btn-peq" onClick={() => { guardar(kMitad, '1'); setMitadVista(true); }}>Voy bien</button>}
              {obj.momento === 'pasado' && <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={terminarObjetivo}>Cerrarlo</button>}
              <button type="button" class="btn btn-peq" onClick={() => setHoja('objetivo')}>{obj.momento === 'pasado' ? 'Ponerme otro' : 'Cambiar'}</button>
            </div>
          </div>
        </section>
      )}
      {sugerencia === 'dias' && (
        <section class="nota-coach vid-dias" aria-label="Tus días de verdad">
          <Icono n="calendario" />
          <div class="pila-s">
            <strong>Últimamente entrenas {nombreDias(reales.dias)}</strong>
            <span class="peq">Tenías puesto {nombreDias(elegidos || [])}. Si tus días de verdad son esos, los cambio: la app pone cada sesión en su día y te avisa cuando toca.</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={cambiarDias}>Sí, cámbialos</button>
              <button type="button" class="btn btn-peq" onClick={aparcarReales}>Déjalos como están</button>
            </div>
          </div>
        </section>
      )}
      {sugerencia === 'sube' && (
        <section class="nota-coach vid-sube" aria-label="¿Pasamos a tres días?">
          <Icono n="progreso" />
          <div class="pila-s">
            <strong>Cuatro semanas completas con dos días. ¿Pasamos a tres?</strong>
            <span class="peq">No hace falta: con dos se progresa. Antes de pedirlo, mira tu registro: si las series acaban con cuatro o cinco repeticiones de margen, no te faltan días, te falta apretar.</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={pasarATres}>Pasar a tres días</button>
              <button type="button" class="btn btn-peq" onClick={aparcarSube}>Sigo con dos</button>
            </div>
          </div>
        </section>
      )}
      {sugerencia === 'basta' && (
        <section class="nota-coach vid-basta" aria-label="Un paso más">
          <Icono n="mensaje" />
          <div class="pila-s">
            <span class="peq">{basta.texto}</span>
            <div class="fila-envolver">
              {/* (v0.249, 93) que lo ha mirado queda apuntado (una nota 'hablar', nada de salud): en el panel de Pelayo sale entre los candidatos */}
              <a class="btn btn-peq" href={`${WEB_FBE}/${basta.motivo === 'molestia' ? 'puesta-a-punto.html' : 'programas.html'}`} target="_blank" rel="noopener"
                onClick={() => { datos.anotar(backend, atleta.id, 'hablar', { datos: { motivo: basta.motivo } }).catch(() => {}); }}>{basta.motivo === 'molestia' ? 'Ver la Puesta a punto' : 'Ver los programas'}</a>
              <button type="button" class="btn-texto" onClick={aparcarBasta}>Ahora no</button>
            </div>
            <span class="mini terciario">Sin prisa: FBE Esencial sigue aquí.</span>
          </div>
        </section>
      )}
      {sugerencia === 'mudo' && (
        <section class="nota-coach vid-mudo" aria-label="Los avisos">
          <Icono n="campana" />
          <div class="pila-s">
            <strong>No te está llegando ningún aviso</strong>
            <span class="peq">Ni el de «Hoy toca» ni el de los lunes, cuando la app te prepara la semana. Si no los quieres en el móvil, te pueden llegar por correo.</span>
            <PasoAvisos />
            <button type="button" class="btn-texto mini" style="justify-self:start" onClick={aparcarAvisos}>Prefiero sin avisos</button>
          </div>
        </section>
      )}
      {hoja === 'viaje' && <HojaViaje viaje={viaje} alCerrar={() => setHoja(null)} alGuardar={() => notas.recargar(true)} />}
      {hoja === 'objetivo' && <HojaObjetivo nota={obj?.momento === 'pasado' ? null : notaObj} alCerrar={() => setHoja(null)} alGuardar={() => { setMitadVista(false); notas.recargar(true); }} />}
      {hoja === 'rutinas' && <HojaRutinas p={p} cuestionario={cuestionario} alCerrar={() => setHoja(null)} alCambiar={() => recargar?.()} />}
    </>
  );
}

// ---------- (55, apagado) La señal de alarma, al acabar una sesión ----------
export function Alarma() {
  const previa = usePrevia();
  const [abierta, setAbierta] = useState(false);
  if (!encendido('alarma', previa)) return null;
  return (
    <div class="vid-alarma">
      {!abierta ? <button type="button" class="btn-texto mini" onClick={() => setAbierta(true)}>¿Has notado algo raro (pecho, mareo, falta de aire)?</button> : (
        <div class="vid-que vid-alarma-c" role="alert">
          <strong>{ALARMA.titulo}</strong>
          <span class="peq">{ALARMA.texto}</span>
          <span class="mini terciario">{ALARMA.despues}{encendido('alarma') ? '' : ' Borrador, pendiente del visto bueno de Pelayo.'}</span>
        </div>
      )}
    </div>
  );
}
