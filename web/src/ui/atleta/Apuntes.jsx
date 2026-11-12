import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp, useCarga } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { guiasConTexto, fichaDeEjercicio } from '../../datos/guias.js';
import { FAQ } from '../../datos/faq.js';
import { apuntesDeFicha, apuntesDeGuias, apuntesDeNovedades, elegirApunte, apunteDelDia, paraRepasar,
  apuntesDeCorrecciones, apunteDeNumeros, apunteDeClip, apunteDeMusculo, preguntasDeFicha, apuntesDeDudas, apuntesDeGlosario, terminosDe, videoDeGuia,
  alternarGuardado, llevarReto, retoPendiente } from '../../logica/apuntes.js';
import { leerApuntes, guardarVisto, sincronizarApuntes, guardarEstado } from '../apuntes.js';
import { imagenGrupo } from '../../logica/imagenes.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { VideoYoutube, abrirMini } from '../YouTube.jsx';
import { HojaGuia } from '../Guias.jsx';
import { hablar, callar, hayVoz } from '../voz.js';
import { leerAjustes } from '../ajustes.js';

// «Apuntes»: algo que aprender en el descanso (o cuando se quiera). Una tarjeta cada vez, de lo que el coach tiene escrito:
// una clave o un error típico del ejercicio del que se descansa, una idea de sus guías o un mito. Las que tienen vuelta
// (error, mito) se destapan y el atleta dice si lo sabía: las que no, vuelven otro día.
//   · En un descanso (`fin`): arriba va la cuenta y, al acabar, se cierra sola: manda el descanso.
//   · modo 'dia': empieza por el apunte del día. modo 'repaso': los que no sabía y los de la semana. modo 'guardados'.
//   · alCerrar(motivo): 'fin' (se acabó el descanso) o 'salir' (la cerró a mano).
// (tanda 2) Además: lo que le corrigió su coach y sus números en ese ejercicio, el vídeo del gesto, qué debería notar,
// preguntas de tres opciones, dudas frecuentes y glosario; y en cada apunte, escucharlo, guardarlo, leer la guía, ver su
// vídeo, llevarse la clave a la siguiente serie y «No lo entiendo» (le llega a su coach).
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export function Apuntes(props) { return <Capa><ApuntesDentro {...props} /></Capa>; }
function ApuntesDentro({ atletaId, ejercicio = null, fin = null, pausa = null, modo = 'descanso', alCerrar }) {
  const { backend, api, aviso, propio, atleta } = useApp();
  const hoy = hoyISO();
  const guias = useCarga(() => guiasConTexto({ backend }).catch(() => []), [], { recuerdo: 'apuntes-guias' });
  const ficha = useCarga(() => (ejercicio?.id ? fichaDeEjercicio({ backend }, ejercicio.id).catch(() => null) : Promise.resolve(null)), [ejercicio?.id], { recuerdo: ejercicio?.id ? `ficha-fbe:${ejercicio.id}` : null });
  // (060) la novedad de la semana (si el coach ha publicado alguna) y lo visto en otros móviles; sin la 060, nada
  const novedades = useCarga(() => (api.novedades ? api.novedades().catch(() => []) : Promise.resolve([])), [], { recuerdo: 'apuntes-novedades' });
  // (tanda 2) lo que le tiene corregido su coach (sus recordatorios de técnica activos), si descansa de un ejercicio
  const recordatorios = useCarga(() => (ejercicio?.id && api.recordatoriosActivos ? api.recordatoriosActivos(atletaId).catch(() => []) : Promise.resolve([])), [ejercicio?.id], { recuerdo: ejercicio?.id ? `apuntes-recordatorios:${atletaId}` : null });
  const [estado, setEstado] = useState(() => leerApuntes(atletaId));
  const [alDia, setAlDia] = useState(false);
  useEffect(() => {
    let vivo = true;
    // (como mucho 2,5 s: si la red va lenta, se empieza con lo del móvil)
    Promise.race([sincronizarApuntes(api, atletaId), new Promise((ok) => setTimeout(() => ok(null), 2500))]).then((e) => { if (vivo) { if (e) setEstado(e); setAlDia(true); } });
    return () => { vivo = false; };
  }, []);
  const listo = alDia && !guias.cargando && !novedades.cargando && !(ejercicio?.id && (ficha.cargando || recordatorios.cargando));
  const todos = useMemo(() => {
    const f = ficha.datos?.ficha || null, nombre = ejercicio?.nombre;
    return [
      ...apuntesDeNovedades(novedades.datos || []),
      ...apuntesDeCorrecciones(recordatorios.datos || [], ejercicio), apunteDeNumeros(ejercicio),
      ...(f ? apuntesDeFicha(f, nombre) : []), f ? apunteDeMusculo(f, nombre, ejercicio?.grupo) : null, apunteDeClip(ejercicio), ...(f ? preguntasDeFicha(f, nombre) : []),
      ...apuntesDeGuias(guias.datos || []), ...apuntesDeGlosario(), ...apuntesDeDudas(FAQ),
    ].filter(Boolean);
  }, [guias.datos, ficha.datos, novedades.datos, recordatorios.datos]);
  const [actual, setActual] = useState(null);
  const [vuelta, setVuelta] = useState(false);
  const [elegida, setElegida] = useState(null);      // (test) la opción que ha tocado
  const [termino, setTermino] = useState(null);      // la palabra del glosario abierta
  const [guiaAbierta, setGuiaAbierta] = useState(null);
  const pasados = useRef([]);        // los de esta tanda, para no repetir
  const cola = useRef(null);         // (repaso, guardados) los que quedan

  const siguiente = (est = estado) => {
    let a = null;
    if (modo === 'repaso' || modo === 'guardados') {
      cola.current ||= modo === 'repaso' ? paraRepasar(todos, est, hoy) : todos.filter((x) => (est.guardados || []).includes(x.id));
      a = cola.current.shift() || null;
    } else if (modo === 'dia' && !pasados.current.length) a = apunteDelDia(todos, hoy, est);
    // (tanda 2) lo primero de un descanso: el reto que se llevó a la serie («¿Lo has hecho?»)
    else if (modo === 'descanso' && !pasados.current.length) a = retoPendiente(est, hoy);
    a ||= modo === 'repaso' || modo === 'guardados' ? null : elegirApunte(todos, est, { hoy, salto: pasados.current.length, excluir: pasados.current, guias: ejercicio?.guias || [], principiante: ejercicio?.principiante ?? atleta?.nivel === 'principiante' });
    if (a) pasados.current.push(a.tipo === 'reto' ? `reto:${a.id}` : a.id);
    callar();
    setActual(a); setVuelta(false); setElegida(null); setTermino(null);
    // (los que no tienen vuelta ni pregunta quedan vistos al salir; los demás, al contestar o al pasar de largo; lo suyo
    // de este momento no se apunta)
    if (a && !a.efimero && !a.vuelta && a.tipo !== 'test') setEstado(guardarVisto(atletaId, a.id, hoy, null, api));
    // (con el entrenador por voz puesto, lo lee solo en el descanso)
    if (a && modo === 'descanso' && leerAjustes().voz && a.tipo !== 'clip' && !a.vuelta && a.tipo !== 'test') hablar([a.titulo, a.texto].filter(Boolean).join('. '));
  };
  useEffect(() => { if (listo && !actual) siguiente(); }, [listo]);
  useEffect(() => () => callar(), []);
  const responder = (sabia) => { const e = guardarVisto(atletaId, actual.id, hoy, sabia, api); setEstado(e); siguiente(e); };
  const responderReto = (si) => { let e = guardarVisto(atletaId, actual.id, hoy, si, api); e = guardarEstado(atletaId, llevarReto(e, null)); setEstado(e); siguiente(e); };
  const elegir = (i) => { if (elegida != null) return; setElegida(i); setEstado(guardarVisto(atletaId, actual.id, hoy, i === actual.correcta, api)); };
  const otro = () => { let e = estado; if (actual && !actual.efimero && (actual.vuelta || (actual.tipo === 'test' && elegida == null))) { e = guardarVisto(atletaId, actual.id, hoy, null, api); setEstado(e); } siguiente(e); };
  const guardado = !!actual && (estado.guardados || []).includes(actual.id);
  const alternar = () => { const e = guardarEstado(atletaId, alternarGuardado(estado, actual.id)); setEstado(e); aviso?.(guardado ? 'Quitado de tus guardados' : 'Guardado: lo tienes en Semana, en «Tus apuntes»'); };
  const alaSerie = () => { const e = guardarEstado(atletaId, llevarReto(estado, actual, hoy)); setEstado(e); aviso?.('Hecho: en el siguiente descanso te pregunto'); alCerrar?.('fin'); };
  const noEntiendo = async () => {
    try {
      await api.enviarMensaje(atletaId, { autor: 'atleta', texto: `No entiendo este apunte${actual.de ? ` (${actual.de})` : ''}: «${[actual.titulo, actual.texto].filter(Boolean).join(' ').slice(0, 220)}». ¿Me lo explicas?` });
      aviso?.('Enviado a tu coach: te contestará en Mensajes');
    } catch (e) { aviso?.(e.message || 'No se ha podido enviar', 'error'); }
  };
  const guiaDe = actual?.guia ? (guias.datos || []).find((g) => g.clave === actual.guia) || null : null;
  const video = guiaDe ? videoDeGuia(guiaDe) : null;
  const terminos = actual && actual.tipo !== 'glosario' && (!actual.vuelta || vuelta) ? terminosDe(`${actual.titulo} ${actual.texto}`) : [];
  const destapado = actual && (!actual.vuelta || vuelta) && !(actual.tipo === 'test' && elegida == null);

  // La cuenta del descanso (si lo hay) y el cierre al acabar
  const [ahora, setAhora] = useState(Date.now());
  const conReloj = Number.isFinite(fin);
  useEffect(() => { if (!conReloj) return undefined; const t = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(t); }, [conReloj]);
  const quedan = !conReloj ? null : Number.isFinite(pausa) ? pausa / 1000 : (fin - ahora) / 1000;
  const acabado = conReloj && quedan <= 0;
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => { if (!acabado) return undefined; const t = setTimeout(() => cerrar.current?.('fin'), 4000); return () => clearTimeout(t); }, [acabado]);

  const caja = useRef(null);
  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);
  const tecla = (ev) => { if (ev.key === 'Escape' && !guiaAbierta) { ev.stopPropagation(); alCerrar?.('salir'); } };
  const titulo = modo === 'repaso' ? 'Repaso' : modo === 'guardados' ? 'Guardados' : modo === 'dia' ? 'El apunte de hoy' : 'Apuntes';
  const imagen = actual?.tipo === 'musculo' && hayImagen(imagenGrupo(actual.grupo)) ? imagenGrupo(actual.grupo) : null;

  return (
    <div ref={caja} class={`apuntes${acabado ? ' acabado' : ''}`} role="dialog" aria-modal="true" aria-label={`${titulo}: algo que aprender${conReloj ? ' en el descanso' : ''}`} tabIndex={-1} onKeyDown={tecla}>
      <header class="apuntes-cab">
        <span class="apuntes-titulo"><Icono n="biblioteca" />{titulo}</span>
        {conReloj && <span class="apuntes-cuenta num" role="timer" aria-live="off" aria-label={acabado ? 'Descanso terminado' : `Descanso: quedan ${Math.ceil(quedan)} segundos`}>{acabado ? '¡Vamos!' : mmss(Math.ceil(quedan))}</span>}
        <button type="button" class="btn btn-icono plano" onClick={() => alCerrar?.('salir')} aria-label="Cerrar los apuntes"><Icono n="cerrar" /></button>
      </header>
      <div class="apuntes-cuerpo">
        {!listo && <div class="apunte" aria-busy="true"><span class="sil" style="width:38%;height:14px" /><span class="sil" style="width:86%;height:26px" /><span class="sil" style="width:100%;height:64px" /></div>}
        {listo && !actual && (
          <div class="apunte vacio-apuntes">
            <strong>{modo === 'repaso' ? (pasados.current.length ? 'Repaso hecho' : 'Nada que repasar todavía') : modo === 'guardados' ? (pasados.current.length ? 'No hay más guardados' : 'Aún no has guardado ninguno') : pasados.current.length ? 'Has visto todos por ahora' : 'Aún no hay apuntes'}</strong>
            <p>{modo === 'repaso' ? (pasados.current.length ? 'Los que no sabías volverán a salir otro día.' : 'Cuando veas apuntes en tus descansos, aquí podrás repasarlos.')
              : modo === 'guardados' ? 'Toca «Guardar» en cualquier apunte para tenerlo aquí.'
              : pasados.current.length ? 'Mañana habrá más: los que no sabías vuelven a salir.' : 'Cuando tu coach publique sus guías y las fichas de técnica, saldrán aquí.'}</p>
          </div>
        )}
        {listo && actual && (
          <article class={`apunte tipo-${actual.tipo}`} key={`${actual.tipo}:${actual.id}`} aria-live="polite">
            <p class="apunte-etq"><span class="chip">{actual.etiqueta}</span>{actual.de && <span class="apunte-de">{actual.de}</span>}</p>
            {imagen && <Imagen id={imagen} clase="apunte-img" tamanos="(min-width: 600px) 520px, 90vw" />}
            {actual.titulo && <h2>{actual.titulo}</h2>}
            {actual.tipo === 'clip' && <VideoYoutube url={actual.video} titulo={`Vídeo de ${actual.de}`} compacto />}
            {actual.tipo === 'test' && (
              <div class="apunte-opciones" role="group" aria-label="Elige una respuesta">
                {actual.opciones.map((o, i) => (
                  <button type="button" key={o} class={`btn apunte-opcion${elegida != null && i === actual.correcta ? ' buena' : ''}${elegida === i && i !== actual.correcta ? ' mala' : ''}`} disabled={elegida != null} onClick={() => elegir(i)}>
                    {o}{elegida != null && i === actual.correcta && <Icono n="hecho" />}
                  </button>
                ))}
              </div>
            )}
            {actual.tipo === 'test' && elegida != null && <p class="apunte-texto" role="status">{elegida === actual.correcta ? 'Eso es.' : `Era «${actual.opciones[actual.correcta]}».`} {actual.texto}</p>}
            {actual.tipo !== 'test' && (actual.vuelta && !vuelta
              ? <button type="button" class="btn apunte-destapar" onClick={() => setVuelta(true)}>{actual.tipo === 'mito' ? '¿Por qué es un mito?' : '¿Por qué, y cómo se corrige?'}</button>
              : actual.texto && <p class="apunte-texto">{actual.texto}</p>)}
            {actual.tipo === 'novedad' && (actual.fuente || actual.enlace) && (
              <p class="apunte-fuente">{actual.fuente}{actual.fuente && actual.enlace ? ' · ' : ''}{actual.enlace && <a href={actual.enlace} target="_blank" rel="noopener noreferrer">Ver el estudio</a>}</p>
            )}
            {terminos.length > 0 && (
              <div class="apunte-terminos">
                {terminos.map(([t]) => <button type="button" key={t} class="chip apunte-termino" aria-expanded={termino === t ? 'true' : 'false'} onClick={() => setTermino(termino === t ? null : t)}>{t}</button>)}
                {termino && <p class="apunte-definicion" role="status"><strong>{termino}:</strong> {terminos.find(([t]) => t === termino)?.[1]}</p>}
              </div>
            )}
            {destapado && actual.tipo !== 'reto' && (
              <div class="apunte-acciones">
                {hayVoz() && actual.tipo !== 'clip' && <button type="button" class="btn-texto" onClick={() => hablar([actual.titulo, actual.texto].filter(Boolean).join('. '), { forzar: true })}><Icono n="altavoz" />Escuchar</button>}
                {!actual.efimero && <button type="button" class="btn-texto" aria-pressed={guardado ? 'true' : 'false'} onClick={alternar}><Icono n="guardar" />{guardado ? 'Guardado' : 'Guardar'}</button>}
                {actual.guia && <button type="button" class="btn-texto" onClick={() => setGuiaAbierta({ clave: actual.guia, titulo: guiaDe?.titulo || actual.de || 'Guía' })}><Icono n="biblioteca" />Leer la guía</button>}
                {video && <button type="button" class="btn-texto" onClick={() => abrirMini({ url: video.url, titulo: video.titulo })}><Icono n="video" />Ver el vídeo</button>}
                {actual.tipo === 'clave' && modo === 'descanso' && !acabado && <button type="button" class="btn-texto" onClick={alaSerie}><Icono n="diana" />Lo pruebo en la siguiente serie</button>}
                {!propio && api.enviarMensaje && <button type="button" class="btn-texto" onClick={noEntiendo}><Icono n="pregunta" />No lo entiendo</button>}
              </div>
            )}
          </article>
        )}
      </div>
      {listo && actual && (
        <footer class="apuntes-pie">
          {actual.tipo === 'reto' ? (
            <>
              <button type="button" class="btn" onClick={() => responderReto(false)}>Se me pasó</button>
              <button type="button" class="btn btn-primario" onClick={() => responderReto(true)}>Sí, lo he hecho</button>
            </>
          ) : actual.vuelta && vuelta ? (
            <>
              <button type="button" class="btn" onClick={() => responder(false)}>No lo sabía</button>
              <button type="button" class="btn btn-primario" onClick={() => responder(true)}>Lo sabía</button>
            </>
          ) : <button type="button" class="btn btn-primario" onClick={otro}>{modo === 'repaso' || modo === 'guardados' ? 'Siguiente' : 'Otro apunte'}</button>}
        </footer>
      )}
      {guiaAbierta && <HojaGuia guia={guiaAbierta} alCerrar={() => setGuiaAbierta(null)} />}
    </div>
  );
}
