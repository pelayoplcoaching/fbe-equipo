import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp, useCarga } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { guiasConTexto, fichaDeEjercicio } from '../../datos/guias.js';
import { FAQ } from '../../datos/faq.js';
import { apuntesDeFicha, apuntesDeGuias, apuntesDeNovedades, elegirApunte, apunteDelDia, paraRepasar,
  apuntesDeCorrecciones, apunteDeNumeros, apunteDeClip, apunteDeMusculo, preguntasDeFicha, apuntesDeDudas, apuntesDeGlosario, terminosDe, videoDeGuia,
  alternarGuardado, llevarReto, retoPendiente, cursosDe, cursoDeLaSemana, progresoCurso, elegirCurso, leccionesPendientes, examenDe, apuntarExamen, notaExamen } from '../../logica/apuntes.js';
import { leerApuntes, guardarVisto, sincronizarApuntes, guardarEstado } from '../apuntes.js';
import { imagenGrupo } from '../../logica/imagenes.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { VideoYoutube, abrirMini } from '../YouTube.jsx';
import { HojaGuia } from '../Guias.jsx';
import { hablar, callar, hayVoz } from '../voz.js';
import { leerAjustes } from '../ajustes.js';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { arteDe, palabraClave, trozosConTerminos, medallaNueva, deslizar, arrastre, aroDeNota, barraDescanso, puntosDeTanda } from '../../logica/apuntes-arte.js';
import { medallaApuntes } from '../../logica/apuntes.js';
import { Sello, Medalla, AroNota, Confeti, DibujoCuaderno, DibujoDiploma } from './apuntes-arte.jsx';

// «Apuntes»: algo que aprender en el descanso (o cuando se quiera). Una tarjeta cada vez, de lo que el coach tiene escrito:
// una clave o un error típico del ejercicio del que se descansa, una idea de sus guías o un mito. Las que tienen vuelta
// (error, mito) se destapan y el atleta dice si lo sabía: las que no, vuelven otro día.
//   · En un descanso (`fin`): arriba va la cuenta y, al acabar, se cierra sola: manda el descanso.
//   · modo 'dia': empieza por el apunte del día. modo 'repaso': los que no sabía y los de la semana. modo 'guardados'.
//   · (tanda 4) modo 'curso': las lecciones del curso de la semana (las ideas de una guía), seguidas y en orden; se puede
//     cambiar de curso. modo 'examen': ocho preguntas con lo visto; al acabar, la nota, y lo fallado vuelve a salir.
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
      ...apuntesDeNovedades(novedades.datos || [], { ejercicio: ejercicio?.id || null }),
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
  const cola = useRef(null);         // (repaso, guardados, curso, examen) los que quedan
  // (tanda 4) el curso que se sigue en esta tanda y la cuenta del examen
  const enCola = modo === 'repaso' || modo === 'guardados' || modo === 'curso' || modo === 'examen';
  const cursos = useMemo(() => cursosDe(todos), [todos]);
  const [curso, setCurso] = useState(null);          // { clave, titulo, lecciones }
  const [cambiando, setCambiando] = useState(false);
  const examen = useRef({ total: 0, aciertos: 0, apuntado: false });
  const idDe = (a) => a.origen || a.id;
  // (apuntes bellos) la tarjeta que se va (con su sello: «¡Lo sabías!», «Vuelve en unos días»…), lo que pasó con cada
  // apunte de este rato (sus puntos de arriba), el giro al destapar, el arrastre con el dedo y la medalla recién ganada
  const [saliente, setSaliente] = useState(null);
  const resultados = useRef([]);
  const [girando, setGirando] = useState(false);
  const [dedo, setDedo] = useState(null);           // { x0, y0, dx, dy, activo }
  const [medallaGrande, setMedallaGrande] = useState(0);
  const [hablando, setHablando] = useState(false);
  const quieto = sinMovimiento();
  const despedir = (marca, dir = 'izquierda') => {
    if (!actual || quieto) return;
    setSaliente({ a: actual, marca, dir, n: (saliente?.n || 0) + 1 });
  };
  useEffect(() => { if (!saliente) return undefined; const t = setTimeout(() => setSaliente(null), 650); return () => clearTimeout(t); }, [saliente?.n]);

  const siguiente = (est = estado) => {
    let a = null;
    if (modo === 'curso' && !cola.current) {
      const c = cursoDeLaSemana(cursos, est, hoy);
      setCurso(c);
      cola.current = c ? leccionesPendientes(c, todos, est) : [];
    }
    if (modo === 'examen' && !cola.current) { cola.current = examenDe(todos, est, { hoy }) || []; examen.current = { total: cola.current.length, aciertos: 0, apuntado: false }; }
    if (enCola) {
      cola.current ||= modo === 'repaso' ? paraRepasar(todos, est, hoy) : todos.filter((x) => (est.guardados || []).includes(x.id));
      a = cola.current.shift() || null;
    } else if (modo === 'dia' && !pasados.current.length) a = apunteDelDia(todos, hoy, est);
    // (tanda 2) lo primero de un descanso: el reto que se llevó a la serie («¿Lo has hecho?»)
    else if (modo === 'descanso' && !pasados.current.length) a = retoPendiente(est, hoy);
    a ||= enCola ? null : elegirApunte(todos, est, { hoy, salto: pasados.current.length, excluir: pasados.current, guias: ejercicio?.guias || [], principiante: ejercicio?.principiante ?? atleta?.nivel === 'principiante', curso: est.curso?.clave || null });
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
  const responder = (sabia, dir = null) => {
    despedir(sabia ? 'sabia' : 'no', dir || (sabia ? 'derecha' : 'izquierda'));
    resultados.current.push(sabia ? 'sabia' : 'no');
    vibrar(sabia ? 'hecho' : 'elegir');
    const e = guardarVisto(atletaId, actual.id, hoy, sabia, api); setEstado(e); siguiente(e);
  };
  const responderReto = (si, dir = null) => {
    despedir(si ? 'hecho' : 'pasa', dir || (si ? 'derecha' : 'izquierda'));
    resultados.current.push(si ? 'sabia' : 'no');
    if (si) vibrar('hecho');
    let e = guardarVisto(atletaId, actual.id, hoy, si, api); e = guardarEstado(atletaId, llevarReto(e, null)); setEstado(e); siguiente(e);
  };
  const elegir = (i) => { if (elegida != null) return; setElegida(i); resultados.current.push(i === actual.correcta ? 'sabia' : 'no'); vibrar(i === actual.correcta ? 'hecho' : 'aviso'); if (modo === 'examen' && i === actual.correcta) examen.current.aciertos += 1; setEstado(guardarVisto(atletaId, idDe(actual), hoy, i === actual.correcta, api)); };
  const otro = (dir = 'izquierda') => { if (actual && !(actual.tipo === 'test' && elegida != null)) resultados.current.push('visto'); despedir('otro', typeof dir === 'string' ? dir : 'izquierda'); let e = estado; if (actual && !actual.efimero && (actual.vuelta || (actual.tipo === 'test' && elegida == null))) { e = guardarVisto(atletaId, idDe(actual), hoy, modo === 'examen' ? false : null, api); setEstado(e); } siguiente(e); };
  const guardado = !!actual && (estado.guardados || []).includes(actual.id);
  const alternar = () => { const e = guardarEstado(atletaId, alternarGuardado(estado, actual.id)); setEstado(e); aviso?.(guardado ? 'Quitado de tus guardados' : 'Guardado: lo tienes en Semana, en «Tus apuntes»'); };
  const alaSerie = () => { const e = guardarEstado(atletaId, llevarReto(estado, actual, hoy)); setEstado(e); aviso?.('Hecho: en el siguiente descanso te pregunto'); alCerrar?.('fin'); };
  const noEntiendo = async () => {
    try {
      await api.enviarMensaje(atletaId, { autor: 'atleta', texto: `No entiendo este apunte${actual.de ? ` (${actual.de})` : ''}: «${[actual.titulo, actual.texto].filter(Boolean).join(' ').slice(0, 220)}». ¿Me lo explicas?` });
      aviso?.('Enviado a tu coach: te contestará en Mensajes');
    } catch (e) { aviso?.(e.message || 'No se ha podido enviar', 'error'); }
  };
  // (tanda 4) cambiar de curso: se queda con el elegido hasta acabarlo
  const cambiarCurso = (clave) => {
    const e = guardarEstado(atletaId, elegirCurso(estado, clave, hoy));
    setEstado(e); setCambiando(false); cola.current = null; pasados.current = [];
    siguiente(e);
  };
  // El examen, acabado: se apunta una vez
  const finExamen = modo === 'examen' && listo && !actual && examen.current.total > 0;
  useEffect(() => {
    if (!finExamen || examen.current.apuntado) return;
    examen.current.apuntado = true;
    setEstado(guardarEstado(atletaId, apuntarExamen(leerApuntes(atletaId), { dia: hoy, aciertos: examen.current.aciertos, total: examen.current.total })));
  }, [finExamen]);
  const estadoAntes = useRef(estado);
  useEffect(() => {
    const n = medallaNueva(estadoAntes.current, estado);
    estadoAntes.current = estado;
    if (n) { setMedallaGrande(n); vibrar('celebrar'); const t = setTimeout(() => setMedallaGrande(0), 2800); return () => clearTimeout(t); }
    return undefined;
  }, [estado]);
  const prCurso = curso ? progresoCurso(curso, estado) : null;
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
  const totalDescanso = useRef(null);
  if (conReloj && totalDescanso.current == null && quedan > 0) totalDescanso.current = Math.max(quedan, 20);
  const barra = conReloj ? barraDescanso(quedan, totalDescanso.current) : null;
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => { if (!acabado) return undefined; const t = setTimeout(() => cerrar.current?.('fin'), 4000); return () => clearTimeout(t); }, [acabado]);

  const caja = useRef(null);
  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);
  const escuchar = () => {
    if (!hablar([actual.titulo, actual.texto].filter(Boolean).join('. '), { forzar: true })) return;
    setHablando(true);
  };
  useEffect(() => {
    if (!hablando) return undefined;
    const t = setInterval(() => { try { if (!window.speechSynthesis.speaking) setHablando(false); } catch { setHablando(false); } }, 400);
    return () => clearInterval(t);
  }, [hablando]);
  useEffect(() => { setHablando(false); }, [actual?.id]);
  // Deslizar con el dedo: a un lado u otro pasa al siguiente; con la vuelta destapada, a la derecha «Lo sabía» y a la
  // izquierda «No lo sabía» (en el reto, «Sí, lo he hecho» / «Se me pasó»). Antes de destapar o de contestar la pregunta, no.
  const puedeDeslizar = !!actual && !finExamen && (actual.tipo === 'reto' || (actual.vuelta ? vuelta : actual.tipo !== 'test' || elegida != null));
  const queHara = (dir) => {
    if (!actual) return '';
    if (actual.tipo === 'reto') return dir === 'derecha' ? 'Hecho' : 'Se me pasó';
    if (actual.vuelta) return dir === 'derecha' ? 'Lo sabía' : 'No lo sabía';
    return 'Siguiente';
  };
  const dedoAbajo = (ev) => {
    if (!puedeDeslizar || quieto || ev.button > 0 || ev.target.closest('button, a, input, iframe, .apunte-terminos, [role="button"]')) return;
    setDedo({ x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, activo: false, id: ev.pointerId });
  };
  const dedoMueve = (ev) => {
    if (!dedo || ev.pointerId !== dedo.id) return;
    const dx = ev.clientX - dedo.x0, dy = ev.clientY - dedo.y0;
    if (!dedo.activo && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { setDedo(null); return; }   // (está desplazando el texto)
    if (!dedo.activo && Math.abs(dx) > 10) { ev.currentTarget.setPointerCapture?.(ev.pointerId); }
    setDedo({ ...dedo, dx, dy, activo: dedo.activo || Math.abs(dx) > 10 });
  };
  const dedoArriba = (ev) => {
    if (!dedo) return;
    const dir = dedo.activo ? deslizar(dedo.dx, dedo.dy, caja.current?.clientWidth || 390) : null;
    setDedo(null);
    if (!dir) return;
    if (actual.tipo === 'reto') responderReto(dir === 'derecha', dir);
    else if (actual.vuelta) responder(dir === 'derecha', dir);
    else otro(dir);
  };
  const tecla = (ev) => { if (ev.key === 'Escape' && !guiaAbierta) { ev.stopPropagation(); alCerrar?.('salir'); } };
  const titulo = modo === 'repaso' ? 'Repaso' : modo === 'guardados' ? 'Guardados' : modo === 'dia' ? 'El apunte de hoy' : modo === 'curso' ? 'Curso de la semana' : modo === 'examen' ? 'Examen' : 'Apuntes';
  const imagen = actual?.tipo === 'musculo' && hayImagen(imagenGrupo(actual.grupo)) ? imagenGrupo(actual.grupo) : null;

  return (
    <div ref={caja} class={`apuntes${acabado ? ' acabado' : ''} fondo-${actual ? arteDe(actual.tipo).tono : finExamen ? aroDeNota(examen.current.aciertos, examen.current.total).tono : 'morado'}`} role="dialog" aria-modal="true" aria-label={`${titulo}: algo que aprender${conReloj ? ' en el descanso' : ''}`} tabIndex={-1} onKeyDown={tecla}>
      <header class="apuntes-cab">
        <span class="apuntes-titulo"><Icono n="biblioteca" />{titulo}</span>
        {conReloj && <span class="apuntes-cuenta num" role="timer" aria-live="off" aria-label={acabado ? 'Descanso terminado' : `Descanso: quedan ${Math.ceil(quedan)} segundos`}>{acabado ? '¡Vamos!' : mmss(Math.ceil(quedan))}</span>}
        <button type="button" class="btn btn-icono plano" onClick={() => alCerrar?.('salir')} aria-label="Cerrar los apuntes"><Icono n="cerrar" /></button>
        {/* (apuntes bellos) un punto por apunte de este rato (verde si lo sabía) y la cuenta del descanso, como barra que se vacía */}
        {puntosDeTanda(resultados.current).length > 0 && (
          <span class="apuntes-puntos" aria-hidden="true">{puntosDeTanda(resultados.current).map((r, i) => <i key={i} class={r} />)}</span>
        )}
        {barra && <span class={`apuntes-barra${barra.final ? ' final' : ''}`} aria-hidden="true"><i style={{ transform: `scaleX(${barra.k})` }} /></span>}
      </header>
      <div class="apuntes-cuerpo">
        {!listo && <div class="apunte" aria-busy="true"><span class="sil" style="width:38%;height:14px" /><span class="sil" style="width:86%;height:26px" /><span class="sil" style="width:100%;height:64px" /></div>}
        {listo && modo === 'curso' && curso && (
          <div class="apuntes-curso">
            <span class="apuntes-curso-t"><strong>{curso.titulo}</strong><span class="peq secundario">{prCurso.hecho && !actual ? 'Curso terminado' : `Lección ${actual && curso.lecciones.includes(actual.id) ? curso.lecciones.indexOf(actual.id) + 1 : Math.min(prCurso.total, prCurso.hechas + 1)} de ${prCurso.total}`}</span></span>
            <span class="apuntes-curso-puntos" aria-hidden="true">{curso.lecciones.map((id) => <i key={id} class={estado.vistos[id] ? 'hecha' : actual?.id === id ? 'ahora' : ''} />)}</span>
            {cursos.length > 1 && <button type="button" class="btn-texto" aria-expanded={cambiando ? 'true' : 'false'} onClick={() => setCambiando(!cambiando)}>Cambiar de curso</button>}
            {cambiando && (
              <div class="apuntes-cursos" role="group" aria-label="Elige un curso">
                {cursos.map((c) => { const pr = progresoCurso(c, estado); return <button type="button" key={c.clave} class="chip apuntes-curso-otro" aria-pressed={c.clave === curso.clave ? 'true' : 'false'} onClick={() => cambiarCurso(c.clave)}>{c.titulo} · {pr.hecho ? 'hecho' : `${pr.hechas}/${pr.total}`}</button>; })}
              </div>
            )}
          </div>
        )}
        {finExamen && (
          <div class={`apunte examen-nota tono-${aroDeNota(examen.current.aciertos, examen.current.total).tono}`} role="status">
            {aroDeNota(examen.current.aciertos, examen.current.total).confeti && !quieto && <Confeti n={34} semilla={examen.current.aciertos + 3} />}
            <p class="apunte-etq"><Sello tipo="test" /><span class="chip">Examen</span></p>
            <span class="examen-centro"><AroNota aciertos={examen.current.aciertos} total={examen.current.total} /><b class="num examen-pct" aria-hidden="true">{Math.round((examen.current.aciertos / examen.current.total) * 100)}%</b></span>
            <h2><span class="num">{examen.current.aciertos} de {examen.current.total}</span> <span class="examen-sello">{notaExamen(examen.current.aciertos, examen.current.total)}</span></h2>
            <p class="apunte-texto">{examen.current.aciertos === examen.current.total ? 'Ni una: lo tienes.' : 'Lo que has fallado vuelve a salir en tus descansos y en «Repasar».'}</p>
          </div>
        )}
        {listo && !actual && !finExamen && (
          <div class={`apunte vacio-apuntes${modo === 'curso' && curso && prCurso?.hecho ? ' diploma' : ''}`}>
            {modo === 'curso' && curso && prCurso?.hecho ? <><DibujoDiploma /><span class="diploma-curso">{curso.titulo}</span></> : <DibujoCuaderno />}
            <strong>{modo === 'curso' ? (curso ? (prCurso?.hecho ? '¡Curso terminado!' : pasados.current.length ? 'Lección hecha' : 'Curso al día') : cursos.length ? 'Has terminado todos los cursos' : 'Aún no hay cursos') : modo === 'examen' ? 'Aún no hay examen' : modo === 'repaso' ? (pasados.current.length ? 'Repaso hecho' : 'Nada que repasar todavía') : modo === 'guardados' ? (pasados.current.length ? 'No hay más guardados' : 'Aún no has guardado ninguno') : pasados.current.length ? 'Has visto todos por ahora' : 'Aún no hay apuntes'}</strong>
            <p>{modo === 'curso' ? (curso ? (prCurso?.hecho ? 'Has acabado este curso. La semana que viene, otro (o cámbialo ahora).' : 'No quedan lecciones por leer hoy.') : cursos.length ? 'Cuando tu coach publique más guías, habrá más.' : 'Cuando tu coach publique sus guías, aquí tendrás un curso cada semana: una guía, lección a lección.')
              : modo === 'examen' ? 'Cuando hayas visto más apuntes en tus descansos, aquí tendrás tu examen.'
              : modo === 'repaso' ? (pasados.current.length ? 'Los que no sabías volverán a salir otro día.' : 'Cuando veas apuntes en tus descansos, aquí podrás repasarlos.')
              : modo === 'guardados' ? 'Toca «Guardar» en cualquier apunte para tenerlo aquí.'
              : pasados.current.length ? 'Mañana habrá más: los que no sabías vuelven a salir.' : 'Cuando tu coach publique sus guías y las fichas de técnica, saldrán aquí.'}</p>
          </div>
        )}
        {listo && actual && (
          <div class="apunte-mazo" data-mazo={enCola ? Math.min(2, cola.current?.length || 0) : 2}>
          {saliente && (
            <div class={`apunte-saliente tono-${arteDe(saliente.a.tipo).tono} va-${saliente.dir}`} key={`s${saliente.n}`} aria-hidden="true">
              <p class="saliente-etq"><Sello tipo={saliente.a.tipo} /><span>{saliente.a.etiqueta}</span></p>
              {saliente.a.titulo && <strong class="saliente-titulo">{saliente.a.titulo}</strong>}
              {saliente.marca !== 'otro' && <span class={`apunte-marca marca-${saliente.marca}`}>{{ sabia: '¡Lo sabías!', no: 'Vuelve en unos días', hecho: '¡Bien hecho!', pasa: 'La próxima' }[saliente.marca]}</span>}
            </div>
          )}
          <article class={`apunte tipo-${actual.tipo} tono-${arteDe(actual.tipo).tono}${girando ? ' girando' : ''}${dedo?.activo ? ' arrastrando' : ''}${saliente ? ` entra-${saliente.dir}` : ''}`} key={`${actual.tipo}:${actual.id}`} aria-live="polite"
            style={dedo?.activo ? { transform: `translateX(${dedo.dx}px) rotate(${arrastre(dedo.dx, caja.current?.clientWidth).giro}deg)` } : undefined}
            onPointerDown={dedoAbajo} onPointerMove={dedoMueve} onPointerUp={dedoArriba} onPointerCancel={() => setDedo(null)}>
            <span class="apunte-esquina" aria-hidden="true" />
            {guardado && <span class="apunte-marcapaginas" aria-hidden="true" />}
            {dedo?.activo && (
              <span class={`apunte-deslizar ${dedo.dx > 0 ? 'derecha' : 'izquierda'}${actual.vuelta || actual.tipo === 'reto' ? (dedo.dx > 0 ? ' si' : ' no') : ''}`} style={{ opacity: arrastre(dedo.dx, caja.current?.clientWidth).etiqueta }} aria-hidden="true">{queHara(dedo.dx > 0 ? 'derecha' : 'izquierda')}</span>
            )}
            <p class="apunte-etq"><Sello tipo={actual.tipo} /><span class="chip">{actual.etiqueta}</span>{modo === 'examen' ? <span class="apunte-de">Pregunta {pasados.current.length} de {examen.current.total}</span> : actual.de && <span class="apunte-de">{actual.de}</span>}</p>
            {imagen && <Imagen id={imagen} clase="apunte-img" tamanos="(min-width: 600px) 520px, 90vw" />}
            {actual.titulo && (() => { const k = palabraClave(actual.titulo); return <h2>{k ? <>{k.antes}<mark class="apunte-rotulador">{k.palabra}</mark>{k.despues}</> : actual.titulo}</h2>; })()}
            {actual.tipo === 'clip' && <VideoYoutube url={actual.video} titulo={`Vídeo de ${actual.de}`} compacto />}
            {actual.tipo === 'test' && (
              <div class="apunte-opciones" role="group" aria-label="Elige una respuesta">
                {actual.opciones.map((o, i) => (
                  <button type="button" key={o} class={`btn apunte-opcion${elegida != null && i === actual.correcta ? ' buena' : ''}${elegida === i && i !== actual.correcta ? ' mala' : ''}`} disabled={elegida != null} onClick={() => elegir(i)}>
                    {o}{elegida != null && i === actual.correcta && <svg class="apunte-marca-buena" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                  </button>
                ))}
              </div>
            )}
            {actual.tipo === 'test' && elegida != null && <p class="apunte-texto" role="status">{elegida === actual.correcta ? 'Eso es.' : `Era «${actual.opciones[actual.correcta]}».`} {actual.texto}</p>}
            {actual.tipo !== 'test' && (actual.vuelta && !vuelta
              ? <button type="button" class="btn apunte-destapar" onClick={() => { setVuelta(true); if (!quieto) { setGirando(true); setTimeout(() => setGirando(false), 520); } }}>{actual.tipo === 'mito' ? '¿Por qué es un mito?' : '¿Por qué, y cómo se corrige?'}</button>
              : actual.texto && <p class="apunte-texto">{trozosConTerminos(actual.texto, terminos).map((x, i) => (x.termino
                ? <span role="button" tabIndex={0} key={i} class="apunte-termino-en" aria-expanded={termino === x.termino ? 'true' : 'false'} aria-label={`${x.texto}: qué significa`}
                    onClick={() => setTermino(termino === x.termino ? null : x.termino)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setTermino(termino === x.termino ? null : x.termino); } }}>{x.texto}</span>
                : x.texto))}</p>)}
            {actual.tipo === 'novedad' && (actual.fuente || actual.enlace) && (
              <p class="apunte-fuente">{actual.fuente}{actual.fuente && actual.enlace ? ' · ' : ''}{actual.enlace && <a href={actual.enlace} target="_blank" rel="noopener noreferrer">Ver el estudio</a>}</p>
            )}
            {terminos.length > 0 && (
              <div class="apunte-terminos">
                {terminos.filter(([t]) => !(actual.tipo !== 'test' && trozosConTerminos(actual.texto, terminos).some((x) => x.termino === t))).map(([t]) => <button type="button" key={t} class="chip apunte-termino" aria-expanded={termino === t ? 'true' : 'false'} onClick={() => setTermino(termino === t ? null : t)}>{t}</button>)}
                {termino && <p class="apunte-definicion" role="status"><strong>{termino}:</strong> {terminos.find(([t]) => t === termino)?.[1]}</p>}
              </div>
            )}
            {destapado && actual.tipo !== 'reto' && (
              <div class="apunte-acciones">
                {hayVoz() && actual.tipo !== 'clip' && <button type="button" class={`btn-texto${hablando ? ' hablando' : ''}`} onClick={escuchar}>{hablando ? <span class="apunte-ondas" aria-hidden="true"><i /><i /><i /><i /></span> : <Icono n="altavoz" />}Escuchar</button>}
                {!actual.efimero && <button type="button" class="btn-texto" aria-pressed={guardado ? 'true' : 'false'} onClick={alternar}><Icono n="guardar" />{guardado ? 'Guardado' : 'Guardar'}</button>}
                {actual.guia && <button type="button" class="btn-texto" onClick={() => setGuiaAbierta({ clave: actual.guia, titulo: guiaDe?.titulo || actual.de || 'Guía' })}><Icono n="biblioteca" />Leer la guía</button>}
                {video && <button type="button" class="btn-texto" onClick={() => abrirMini({ url: video.url, titulo: video.titulo })}><Icono n="video" />Ver el vídeo</button>}
                {actual.tipo === 'clave' && modo === 'descanso' && !acabado && <button type="button" class="btn-texto" onClick={alaSerie}><Icono n="diana" />Lo pruebo en la siguiente serie</button>}
                {!propio && api.enviarMensaje && <button type="button" class="btn-texto" onClick={noEntiendo}><Icono n="pregunta" />No lo entiendo</button>}
              </div>
            )}
          </article>
          </div>
        )}
        {/* (apuntes bellos) la medalla recién ganada, en grande */}
        {medallaGrande > 0 && (
          <div class="apuntes-medalla-nueva" role="status">
            {!quieto && <Confeti n={26} semilla={medallaGrande * 7} />}
            <Medalla nivel={medallaGrande} clase="grande" />
            <strong>Nueva medalla</strong>
            <span>{medallaApuntes(estado).nombre}</span>
          </div>
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
          ) : <button type="button" class="btn btn-primario" onClick={() => otro('izquierda')}>{modo === 'examen' ? (cola.current?.length ? 'Siguiente' : 'Ver la nota') : modo === 'curso' ? 'Siguiente lección' : enCola ? 'Siguiente' : 'Otro apunte'}</button>}
        </footer>
      )}
      {guiaAbierta && <HojaGuia guia={guiaAbierta} alCerrar={() => setGuiaAbierta(null)} />}
    </div>
  );
}
