import { AyudaFicha } from '../Guias.jsx';
import { enlacesFichas, todasLasFichas } from '../../datos/guias.js';
import { lunesDe as lunesDeGuias, sumarDias as sumarDiasGuias, hoyISO as hoyGuias } from '../../logica/fechas.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Disco, Cargando, ErrorCaja, Hoja, Paso, Segmentos } from '../comunes.jsx';
import { FOCOS, INTENCIONES, PRIORIDADES, NOMBRE_GRUPO, GRUPOS, TIPOS_SESION, LETRAS_SUPERSERIE, etiquetasSuperserie, seriesPautadasPorGrupo, desglosePautadoPorGrupo, rangoVolumen, estadoVolumen, num, mmss, tieneDetalle, detalleDesdePauta, pauta as pautaAtleta, duracionEstimada } from '../../logica/calculos.js';
import { rangoSemana, lunesDe, fmtCorta, fmtConDia, sumarDias } from '../../logica/fechas.js';
import { sugerirCargas } from '../../logica/sugerencias.js';
import { leerTempo, explicarTempo } from '../../logica/tempo.js';
import { NOMBRE_NIVEL, AYUDA_NIVEL, modoCarga, columnasEditor } from '../../logica/nivel.js';
import { progresarPauta } from '../../logica/progresion.js';
import { revisarVariante, equivalentes } from '../../logica/variantes.js';
import { MODALIDADES, limpiarCardio, textoCardio, palabrasEsfuerzo } from '../../logica/cardio.js';
import { teclaEnRejilla } from '../rejilla.js';
import { ProgramarFBE, semanasParaProgramar } from './ProgramarFBE.jsx';
import { pautasDeSemana, emparejar, seriesEnFilas, textoSerieFBE, leerGuardadas, paraElMotor, resolverReglas } from '../../logica/motor/index.js';
import { CAMPOS_PAUTA, antesDe, etiquetaCambio, apilar, cambiarId, basePauta, comoLaAnterior, detalleDeHechas, pasoDe, saltoKg, igualarSeries, reordenar, resumenSesion,
  revisarSemana, cambiosDeSemana, parejasSiguientes, LLEVAR, cambiosParaPareja, ordenBuscador, conReciente, usosEnBloque, notasFrecuentes, conNota, historialParaEditor,
  comoLeFue, sesionPrevia, pctDeRm, conPendiente, sinPendiente, kilosDe } from '../../logica/editor.js';
import { asa } from './arrastre.js';
import { VideoDeSesionCoach } from '../YouTube.jsx';
import { CampoMusica } from './PersonalCoach.jsx';
import { PlanCarreraSemana, CamposCarreraPauta } from './CarreraCoach.jsx';
import { zonasFC } from '../../logica/carrera.js';
import { mapaEvitados, textoMotivo } from '../../logica/perfil-mas.js';

const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const ESTADOS_BLOQUE = [['planificado', 'Planificado'], ['activo', 'Activo'], ['ajustado', 'Ajustado'], ['finalizado', 'Finalizado'], ['cancelado', 'Cancelado']];
const ESTADO_SEMANA = { programada: 'Publicada', en_programacion: 'Borrador', no_iniciada: 'Sin empezar' };
const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nulo = (v) => (v === '' || v === undefined ? null : v);

// Editor de un bloque (de un atleta o plantilla): semanas, sesiones y prescripción, con guardado al salir de cada campo.
export function EditorBloque({ bloqueId, alBorrar, alCrearPlantilla, alCambiarBloque, volumenObjetivo = null, nivel = null, carreraDe = null }) {
  const { api, aviso } = useApp();
  const carga = useCarga(() => api.bloqueCompleto(bloqueId), [bloqueId]);
  // (v0.133) Con la carrera encendida: sus zonas (para las partes) y el plan de la semana que se edita
  const carrera = useCarga(() => (carreraDe ? api.carrera(carreraDe).catch(() => null) : Promise.resolve(null)), [carreraDe]);
  const zonasCarrera = useMemo(() => (carrera.datos?.perfil ? zonasFC(carrera.datos.perfil) : null), [carrera.datos]);
  const biblioteca = useCarga(() => api.biblioteca(), []);
  const [d, setD] = useState(null);
  const [semanaId, setSemanaId] = useState(null);
  const [estado, setEstado] = useState('');
  const [duplicar, setDuplicar] = useState(false);
  const [elegir, setElegir] = useState(null); // { sesionId, pautaId? }
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const [sugerir, setSugerir] = useState(false);
  const [version, setVersion] = useState(0); // cambia al aplicar cambios en bloque, para refrescar los campos
  const [publicarEn, setPublicarEn] = useState(null); // semana a publicar en un bloque que aún no es el activo
  const [fbe, setFbe] = useState(null); // «Programar según FBE»: { base, destino } (ids de semana)
  // (v0.184) deshacer: los últimos cambios, del más viejo al más nuevo ({ tipo, etiqueta, … }); se vacía al cambiar de bloque
  const [pila, setPila] = useState([]);
  useEffect(() => { setPila([]); }, [bloqueId]);
  // (v0.184) lo plegado: «s:<id>» una sesión, «p:<id>» lo de debajo de un ejercicio (se recuerda mientras dure la pestaña)
  const [plegado, setPlegado] = useState(() => { try { return new Set(JSON.parse(sessionStorage.getItem('fbe-editor-plegado') || '[]')); } catch { return new Set(); } });
  const plegar = (claves, si) => setPlegado((x) => {
    const n = new Set(x);
    for (const c of [].concat(claves)) { if (si ?? !x.has(c)) n.add(c); else n.delete(c); }
    try { sessionStorage.setItem('fbe-editor-plegado', JSON.stringify([...n].slice(-400))); } catch { /* sin almacenamiento, vale mientras esté abierta */ }
    return n;
  });
  const [vistaAtleta, setVistaAtleta] = useState(false); // «Como lo verá el atleta»
  // (v0.185) rehacer lo deshecho; y las hojas de la segunda tanda
  const [rehechos, setRehechos] = useState([]);
  useEffect(() => { setRehechos([]); }, [bloqueId]);
  const [revisar, setRevisar] = useState(null);     // { semana, avisos, activar }: lo que conviene mirar antes de publicar
  const [variosEn, setVariosEn] = useState(null);   // id de la sesión en la que se cambian varios ejercicios a la vez
  const [llevar, setLlevar] = useState(null);       // la pauta cuyo cambio se lleva a las semanas siguientes
  const [historialDe, setHistorialDe] = useState(null); // la pauta cuyo historial se mira
  const [guardadas, setGuardadas] = useState(false);    // «Añadir sesión guardada»
  const [notasMias, setNotasMias] = useState(() => { try { return JSON.parse(localStorage.getItem('fbe-editor-notas') || '[]'); } catch { return []; } });
  const dRef = useRef(null);
  // (v0.186) lo que no se pudo guardar por la conexión (se reintenta solo) y la hoja «Traer de otro atleta»
  const [pendientes, setPendientes] = useState([]);
  const pendRef = useRef([]);
  pendRef.current = pendientes;
  const [deOtro, setDeOtro] = useState(false);

  useEffect(() => {
    if (!carga.datos) return;
    setD(carga.datos);
    if (!semanaId || !carga.datos.semanas.some((s) => s.id === semanaId)) {
      const sem = carga.datos.semanas;
      const borrador = sem.find((s) => s.programacion !== 'programada');
      setSemanaId((borrador || sem[sem.length - 1] || {}).id || null);
    }
  }, [carga.datos]);

  const ejercicios = useMemo(() => Object.fromEntries((biblioteca.datos || []).map((e) => [e.id, e])), [biblioteca.datos]);
  // Lo que hizo el atleta la última vez en cada ejercicio de esta semana (antes de ella: en la semana anterior o en
  // otro bloque), para pautar la siguiente con sus kilos y RPE a la vista
  const atletaId = d && !d.bloque.es_plantilla ? d.bloque.atleta_id : null;
  const sesionesSemana = d && semanaId ? d.sesiones[semanaId] || [] : [];
  // Hasta el final de la semana que se mira (para no enseñar como «última vez» algo de semanas posteriores)
  const fechaSemana = d && semanaId ? d.semanas.find((w) => w.id === semanaId)?.fecha_inicio : null;
  const finSemana = fechaSemana ? `${sumarDias(fechaSemana, 7)}T00:00:00` : null;
  const idsSemana = [...new Set(sesionesSemana.flatMap((x) => (d.pautas[x.id] || []).map((p) => p.ejercicio_id)))].filter(Boolean).sort();
  const ultimas = useCarga(() => (atletaId && idsSemana.length ? api.ultimasPorEjercicio(atletaId, idsSemana, sesionesSemana.map((x) => x.id), finSemana).catch(() => ({})) : Promise.resolve({})),
    [atletaId, semanaId, idsSemana.join(',')]);
  // (057) al programar: las fichas de las guías (repeticiones por objetivo) y las molestias de sus dos últimas semanas
  const { backend } = useApp();
  const fichasFbe = useCarga(async () => {
    const [enlaces, todas] = await Promise.all([enlacesFichas({ backend }).catch(() => null), todasLasFichas({ backend }, { conFicha: true }).catch(() => [])]);
    if (!enlaces || !todas.length) return null;
    const molestias = atletaId ? await backend.select('molestias', { eq: { atleta_id: atletaId }, gte: { semana_inicio: sumarDiasGuias(lunesDeGuias(hoyGuias()), -7) } }).catch(() => []) : [];
    return { enlaces, fichas: Object.fromEntries(todas.map((f) => [f.id, f])), molestias };
  }, [atletaId]);
  // v0.48: las notas fijadas del atleta en cada ejercicio («asiento en el 4»), para verlas junto a su pauta
  const notasAtleta = useCarga(() => (atletaId ? api.notasEjercicio(atletaId).catch(() => ({})) : Promise.resolve({})), [atletaId]);
  // (perfil, tanda 4) lo que el atleta prefiere evitar: un aviso junto a la pauta y al elegir (no cambia nada)
  const evitadosAtleta = useCarga(() => (atletaId && api.personalAtletas ? api.personalAtletas().then((l) => mapaEvitados((l || []).find((x) => x.atleta_id === atletaId))).catch(() => ({})) : Promise.resolve({})), [atletaId]);

  // (v0.184) sus reglas guardadas: de ellas salen el salto de kilos de los botones + y − y el rango de un ejercicio nuevo
  const fichaReglas = useCarga(() => (atletaId ? api.ficha(atletaId).then((x) => x?.atleta?.reglas_motor ?? null).catch(() => null) : Promise.resolve(null)), [atletaId]);
  const reglasDe = useMemo(() => {
    const suyas = paraElMotor(leerGuardadas(fichaReglas.datos));
    const memo = {};
    return (ejercicioId) => (memo[ejercicioId] ||= resolverReglas({ fbe: suyas.reglas?.fbe, nivel, perfil: suyas.perfil, atleta: suyas.reglas?.atleta, bloque: suyas.reglas?.bloque, ejercicio: suyas.reglas?.porEjercicio?.[ejercicioId] }));
  }, [fichaReglas.datos, nivel]);
  dRef.current = d;
  // (v0.185) los minutos por sesión que dijo tener en su cuestionario, para avisar si una sesión se pasa
  const cuestionario = useCarga(() => (atletaId ? api.cuestionario(atletaId).catch(() => null) : Promise.resolve(null)), [atletaId]);
  const minutosSesion = Number(cuestionario.datos?.minutos_sesion) || null;
  // (v0.186) sus comentarios en las sesiones hechas de esta semana y de la anterior; su nota solo para el coach y el
  // candado de cada ejercicio; su mejor 1RM estimado; y quién queda por programar
  const numeroSemana = d && semanaId ? d.semanas.find((w) => w.id === semanaId)?.numero : null;
  const idsHechas = d && semanaId ? d.semanas.filter((w) => w.id === semanaId || w.numero === numeroSemana - 1).flatMap((w) => d.sesiones[w.id] || []).filter((x) => x.completada).map((x) => x.id).sort() : [];
  const comentarios = useCarga(() => (atletaId && idsHechas.length ? api.comentariosDeSesiones(idsHechas).catch(() => ({})) : Promise.resolve({})), [atletaId, idsHechas.join(',')]);
  const notasEj = useCarga(() => (atletaId ? api.notasDeEjercicio(atletaId).catch(() => ({})) : Promise.resolve({})), [atletaId]);
  const [mias, setMias] = useState({});  // lo que se acaba de cambiar en esas notas, sin esperar a recargar
  useEffect(() => { setMias({}); }, [atletaId]);
  const privadas = { ...(notasEj.datos || {}), ...mias };
  const rms = useCarga(() => (atletaId ? api.mejoresRm(atletaId).catch(() => ({})) : Promise.resolve({})), [atletaId]);
  const faltan = useCarga(() => (atletaId ? api.porProgramar().catch(() => []) : Promise.resolve([])), [atletaId]);
  // (v0.191) lo que apuntó en la revisión semanal de este atleta, delante al programarle
  const notaRevision = useCarga(() => (atletaId ? api.notaDeRevision(atletaId).catch(() => null) : Promise.resolve(null)), [atletaId]);
  // Lo pendiente de guardar: se reintenta al volver la conexión y cada 10 s; y avisa si se va a cerrar la pestaña
  useEffect(() => {
    if (!pendientes.length) return undefined;
    const otra = () => reintentarRef.current?.();
    const salir = (e) => { e.preventDefault(); e.returnValue = ''; };
    const t = setInterval(otra, 10000);
    window.addEventListener('online', otra);
    window.addEventListener('beforeunload', salir);
    return () => { clearInterval(t); window.removeEventListener('online', otra); window.removeEventListener('beforeunload', salir); };
  }, [pendientes.length > 0]);
  const reintentarRef = useRef(null);

  if (carga.cargando && !d) return <Siluetas forma="tarjetas" n={3} texto="Cargando el bloque" />;
  if (carga.error) return <ErrorCaja error={carga.error} reintentar={carga.recargar} />;
  if (!d) return null;
  const { bloque } = d;
  const semana = d.semanas.find((s) => s.id === semanaId);
  const sesiones = semana ? d.sesiones[semana.id] || [] : [];
  // La semana anterior del bloque y si tiene algo registrado (para las cargas sugeridas)
  const anterior = semana ? d.semanas.find((w) => w.numero === semana.numero - 1) : null;
  const sesionesAnt = anterior ? d.sesiones[anterior.id] || [] : [];
  // Con nivel, las cargas sugeridas son para lo que se pauta con kg (los de RPE los carga el atleta, salvo que les pongas kg)
  const conKg = (p) => bloque.es_plantilla || modoCarga(nivel, p.prioridad) !== 'rpe' || p.carga_sugerida_kg != null;
  const conDatos = !bloque.es_plantilla && sesionesAnt.some((x) => (d.pautas[x.id] || []).some((p) => (d.series[p.id] || []).length))
    && sesiones.some((x) => (d.pautas[x.id] || []).some(conKg));

  // (v0.181) cada pauta de esta semana con la suya de la semana anterior (misma sesion y ejercicio) y lo que hizo en
  // ella: para ver, junto a lo que se programa, lo pautado y lo hecho serie a serie
  const previas = {};
  if (anterior && !bloque.es_plantilla) {
    const A = pautasDeSemana(d, anterior), B = pautasDeSemana(d, semana);
    for (const [idA, b] of Object.entries(emparejar(A.pautas, A.sesiones, B.pautas, B.sesiones))) {
      const pa = A.pautas.find((x) => String(x.id) === String(idA));
      if (pa) previas[b.id] = { pauta: pa, hechas: d.series[pa.id] || [], semana: anterior.numero };
    }
  }

  // «Programar según FBE»: de qué semana se parte y cuál se programa (la siguiente se crea si aún no existe)
  const paraFbe = semanasParaProgramar(d, semana);

  // Guarda un campo y lo refleja en local sin recargar (los inputs no pierden el foco)
  const apilarNuevo = (paso) => { setPila((x) => apilar(x, paso)); setRehechos([]); };
  const nombreDe = (pautaId) => { const f = Object.values(dRef.current?.pautas || {}).flat().find((x) => x.id === pautaId); return ejercicios[f?.ejercicio_id]?.nombre || ''; };
  async function guardar(tabla, id, cambios, { sinPila = false } = {}) {
    setEstado('Guardando…');
    // (v0.184) lo que había, para poder deshacerlo (solo si de verdad cambia algo)
    const antes = sinPila ? null : antesDe(dRef.current, tabla, id, cambios);
    try {
      await api.actualizar(tabla, id, cambios);
      if (antes) apilarNuevo({ tipo: 'campo', tabla, id, antes, etiqueta: etiquetaCambio(tabla, cambios, tabla === 'sesion_ejercicios' ? nombreDe(id) : '') });
      // (v0.185) las notas que escribes se recuerdan en este dispositivo, para ofrecértelas después
      if (tabla === 'sesion_ejercicios' && cambios.notas_coach) setNotasMias((x) => { const n = conNota(x, cambios.notas_coach); try { localStorage.setItem('fbe-editor-notas', JSON.stringify(n)); } catch { /* sin almacenamiento */ } return n; });
      setD((x) => parchear(x, tabla, id, cambios));
      setEstado('Guardado');
      if (tabla === 'bloques') alCambiarBloque?.(); // el nombre o el estado salen en el selector de bloques
    } catch (e) {
      // (v0.186) Sin conexión: lo escrito se queda a la vista, marcado, y se guarda solo cuando vuelva
      if (e?.sinConexion) {
        setPendientes((x) => conPendiente(x, tabla, id, cambios));
        setD((x) => parchear(x, tabla, id, cambios));
        setEstado('Sin guardar');
        return;
      }
      // Si la base no lo acepta, los campos vuelven a lo que hay guardado (no se queda a la vista un valor que no vale)
      setEstado(''); aviso(e.message, 'error'); setVersion((v) => v + 1);
    }
  }
  // (v0.186) Vuelve a intentar lo que quedó sin guardar, en orden; lo que la base rechace se suelta y se dice
  const reintentando = useRef(false);
  async function reintentar(aMano = false) {
    if (reintentando.current || !pendRef.current.length) return;
    reintentando.current = true;
    let hechos = 0;
    try {
      for (const x of [...pendRef.current]) {
        try { await api.actualizar(x.tabla, x.id, x.cambios); hechos++; setPendientes((l) => sinPendiente(l, x.tabla, x.id)); }
        catch (e) {
          if (e?.sinConexion) { if (aMano) aviso('Sigue sin conexión: lo intento otra vez en unos segundos', 'error'); break; }
          setPendientes((l) => sinPendiente(l, x.tabla, x.id)); aviso(e.message, 'error'); await carga.recargar(true); setVersion((v) => v + 1);
        }
      }
      if (hechos) { setEstado('Guardado'); aviso(hechos === 1 ? 'Guardado el cambio que estaba pendiente' : `Guardados los ${hechos} cambios que estaban pendientes`); if (pendRef.current.some((x) => x.tabla === 'bloques')) alCambiarBloque?.(); }
    } finally { reintentando.current = false; }
  }
  reintentarRef.current = reintentar;
  // (v0.186) la nota solo para el coach y el candado de un ejercicio (por atleta: valen en todas sus semanas)
  async function guardarPrivada(ejercicioId, cambios) {
    const ahora = { nota: '', fijado: false, ...(privadas[ejercicioId] || {}), ...cambios };
    setEstado('Guardando…');
    try {
      await api.guardarNotaDeEjercicio(atletaId, ejercicioId, ahora);
      setMias((x) => ({ ...x, [ejercicioId]: ahora }));
      setEstado('Guardado');
      if ('fijado' in cambios) aviso(cambios.fijado ? 'Con candado: «Programar según FBE» y «Preparar las siguientes» lo dejan como está' : 'Candado quitado');
    } catch (e) { setEstado(''); aviso(e.message, 'error'); setVersion((v) => v + 1); }
  }
  const fijos = new Set(Object.entries(privadas).filter(([, x]) => x?.fijado).map(([id]) => id));
  // Pauta serie a serie: guarda el detalle (o lo quita) y el resumen que sale de él
  async function guardarDetalle(id, detalle) {
    setEstado('Guardando…');
    const antes = antesDe(dRef.current, 'sesion_ejercicios', id, CAMPOS_PAUTA);
    try {
      const cambios = await api.guardarDetalle(id, detalle);
      if (antes) apilarNuevo({ tipo: 'campo', tabla: 'sesion_ejercicios', id, antes, etiqueta: `Series de ${nombreDe(id) || 'un ejercicio'}` });
      setD((x) => parchear(x, 'sesion_ejercicios', id, cambios));
      setEstado('Guardado');
    } catch (e) { setEstado(''); aviso(e.message, 'error'); setVersion((v) => v + 1); }
  }
  // Cambios de estructura (semanas, sesiones, publicar…): uno cada vez; un doble toque no duplica nada
  const enCurso = useRef(false);
  async function estructura(fn, mensaje) {
    if (enCurso.current) return null;
    enCurso.current = true;
    setEstado('Guardando…');
    try { const r = await fn(); await carga.recargar(true); setEstado('Guardado'); if (mensaje) aviso(mensaje); alCambiarBloque?.(); return r; } catch (e) { setEstado(''); aviso(e.message, 'error'); return null; }
    finally { enCurso.current = false; }
  }

  // (v0.184) Toda la prescripción de un ejercicio de una vez («como la semana pasada», «lo que hizo»): un solo paso que deshacer
  async function aplicarPauta(id, cambios, etiqueta) {
    const antes = antesDe(dRef.current, 'sesion_ejercicios', id, CAMPOS_PAUTA);
    setEstado('Guardando…');
    try {
      let hechos = cambios;
      if (cambios.series_detalle) {
        // serie a serie: el resumen sale del detalle; el RIR, si venía, se guarda aparte
        hechos = await api.guardarDetalle(id, cambios.series_detalle);
        if ('rir_objetivo' in cambios) { await api.actualizar('sesion_ejercicios', id, { rir_objetivo: cambios.rir_objetivo }); hechos = { ...hechos, rir_objetivo: cambios.rir_objetivo }; }
      } else await api.actualizar('sesion_ejercicios', id, cambios);
      if (antes) apilarNuevo({ tipo: 'campo', tabla: 'sesion_ejercicios', id, antes, etiqueta });
      setD((x) => parchear(x, 'sesion_ejercicios', id, hechos));
      setEstado('Guardado'); setVersion((v) => v + 1);
    } catch (e) { setEstado(''); aviso(e.message, 'error'); setVersion((v) => v + 1); }
  }
  // Quitar un ejercicio se puede deshacer (vuelve con su prescripción; lo que el atleta hubiera registrado en él, no)
  async function quitarPauta(p) {
    const fila = { ...p };
    const ok = await estructura(async () => { await api.borrar('sesion_ejercicios', p.id); return true; });
    if (ok) apilarNuevo({ tipo: 'borrada', fila, etiqueta: `Quitar ${ejercicios[p.ejercicio_id]?.nombre || 'un ejercicio'}` });
  }
  // Reordenar (arrastrando o con las flechas): el orden nuevo de los ejercicios de una sesión, o de las sesiones de la semana
  async function ordenar(tipo, donde, ids, antes) {
    const ok = await estructura(async () => { await (tipo === 'pautas' ? api.ordenarPautas(donde, ids) : api.ordenarSesiones(donde, ids)); return true; });
    if (ok) apilarNuevo({ tipo: 'orden', que: tipo, donde, ids: antes, etiqueta: tipo === 'pautas' ? 'Mover un ejercicio' : 'Mover una sesión' });
  }
  // (v0.185) Varios ejercicios de una vez (cambiar varios, llevar a las semanas siguientes): un solo paso que deshacer
  async function aplicarVarios(lista, etiqueta, mensaje = null) {
    const antes = lista.map(({ id, cambios }) => ({ id, antes: antesDe(dRef.current, 'sesion_ejercicios', id, Object.keys(cambios)) })).filter((x) => x.antes);
    const ok = await estructura(async () => { for (const { id, cambios } of lista) await api.actualizar('sesion_ejercicios', id, cambios); return true; }, mensaje);
    if (ok && antes.length) apilarNuevo({ tipo: 'varios', lista: antes, etiqueta });
    setVersion((v) => v + 1);
    return !!ok;
  }
  // Aplica un paso de la pila y devuelve su contrario (lo que lo deshace), o null si no se pudo
  async function aplicarPaso(paso, verbo) {
    const dice = `${verbo}: ${paso.etiqueta.charAt(0).toLowerCase()}${paso.etiqueta.slice(1)}`;
    if (paso.tipo === 'campo') {
      const contrario = { ...paso, antes: antesDe(dRef.current, paso.tabla, paso.id, Object.keys(paso.antes)) || {} };
      setEstado('Guardando…');
      try {
        await api.actualizar(paso.tabla, paso.id, paso.antes);
        setD((x) => parchear(x, paso.tabla, paso.id, paso.antes));
        setEstado('Guardado'); setVersion((v) => v + 1);
        if (paso.tabla === 'bloques') alCambiarBloque?.();
        aviso(dice);
        return contrario;
      } catch (e) { setEstado(''); aviso(e.message, 'error'); return null; }
    }
    if (paso.tipo === 'varios') {
      const contrario = { ...paso, lista: paso.lista.map(({ id, antes }) => ({ id, antes: antesDe(dRef.current, 'sesion_ejercicios', id, Object.keys(antes)) || {} })) };
      const ok = await estructura(async () => { for (const { id, antes } of paso.lista) await api.actualizar('sesion_ejercicios', id, antes); return true; }, dice);
      setVersion((v) => v + 1);
      return ok ? contrario : null;
    }
    if (paso.tipo === 'borrada') {
      const viejo = paso.fila.id;
      const nueva = await estructura(() => api.restaurarPauta(paso.fila, (dRef.current?.pautas?.[paso.fila.sesion_id] || []).map((x) => x.id)), `${verbo}: el ejercicio vuelve a su sitio`);
      if (!nueva) return null;
      setPila((x) => cambiarId(x, viejo, nueva.id)); setRehechos((x) => cambiarId(x, viejo, nueva.id));
      setVersion((v) => v + 1);
      return { tipo: 'creada', id: nueva.id, etiqueta: paso.etiqueta };
    }
    if (paso.tipo === 'creada') {
      const fila = Object.values(dRef.current?.pautas || {}).flat().find((x) => x.id === paso.id);
      if (!fila) return null;
      const ok = await estructura(async () => { await api.borrar('sesion_ejercicios', paso.id); return true; }, dice);
      return ok ? { tipo: 'borrada', fila: { ...fila }, etiqueta: paso.etiqueta } : null;
    }
    if (paso.tipo === 'orden') {
      const ahora = paso.que === 'pautas' ? (dRef.current?.pautas?.[paso.donde] || []).map((x) => x.id) : (dRef.current?.sesiones?.[paso.donde] || []).map((x) => x.id);
      const ok = await estructura(async () => { await (paso.que === 'pautas' ? api.ordenarPautas(paso.donde, paso.ids) : api.ordenarSesiones(paso.donde, paso.ids)); return true; }, dice);
      return ok ? { ...paso, ids: ahora } : null;
    }
    return null;
  }
  async function deshacer() {
    const paso = pila[pila.length - 1];
    if (!paso) return;
    setPila((x) => x.slice(0, -1));
    const contrario = await aplicarPaso(paso, 'Deshecho');
    if (contrario) setRehechos((x) => apilar(x, contrario));
  }
  async function rehacer() {
    const paso = rehechos[rehechos.length - 1];
    if (!paso) return;
    setRehechos((x) => x.slice(0, -1));
    const contrario = await aplicarPaso(paso, 'Rehecho');
    if (contrario) setPila((x) => apilar(x, contrario));
  }
  // (v0.185) Publicar: antes, lo que parece un despiste (se puede publicar igual)
  function pedirPublicar(w, sesionesW, activar) {
    const avisos = revisarSemana({ sesiones: sesionesW, pautas: dRef.current.pautas, previas, nombres: Object.fromEntries(Object.values(ejercicios).map((e) => [e.id, e.nombre])), foco: w.foco,
      evitados: evitadosAtleta.datos || {}, grupos: Object.fromEntries(Object.values(ejercicios).map((e) => [e.id, (e.grupos_musculares || []).slice(0, 1)])), nombresGrupo: NOMBRE_GRUPO,
      anteriores: w.id === semana?.id && !bloque.es_plantilla ? sesionesAnt.flatMap((x) => dRef.current.pautas[x.id] || []) : [] });
    if (avisos.length) { setRevisar({ semana: w, avisos, activar }); return; }
    publicar(w, activar);
  }
  function publicar(w, activar) {
    // El atleta solo ve el bloque activo: si este no lo es, se pregunta
    if (activar) { setPublicarEn(w); return; }
    estructura(() => api.publicarSemana(w.id, true), `Semana ${w.numero} publicada`).then((ok) => { if (ok) faltan.recargar(true); });
  }
  const ultimo = pila[pila.length - 1];

  return (
    <div class="pila" onKeyDown={(e) => {
      // Ctrl+Z (o Cmd+Z) fuera de una casilla: deshace el último cambio guardado (dentro de una casilla, lo de siempre)
      if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey && ultimo) { e.preventDefault(); deshacer(); }
      else if (((k === 'z' && e.shiftKey) || k === 'y') && rehechos.length) { e.preventDefault(); rehacer(); }
    }}>
      <div class="panel panel-pad pila editor-bloque">
        <div class="separa">
          <strong>{bloque.es_plantilla ? 'Plantilla' : `Bloque ${bloque.numero ?? ''}`}</strong>
          <span class="fila" style="gap:var(--esp-10)">
            <span class={`guardado ${estado === 'Guardado' ? 'ok' : ''} ${pendientes.length ? 'pendiente' : ''}`} role="status">{estado === 'Guardado' && <Icono n="hecho" width="16" height="16" />}{estado}</span>
            <button class="btn btn-peq btn-deshacer" disabled={!ultimo} title={ultimo ? `Deshacer: ${ultimo.etiqueta}` : 'No hay nada que deshacer'} onClick={deshacer}><Icono n="deshacer" /> Deshacer</button>
            <button class="btn btn-peq btn-icono" disabled={!rehechos.length} aria-label="Rehacer" title={rehechos.length ? `Rehacer: ${rehechos[rehechos.length - 1].etiqueta}` : 'No hay nada que rehacer'} onClick={rehacer}><Icono n="rehacer" /></button>
          </span>
        </div>
        {pendientes.length > 0 && (
          <div class="nota sin-guardar-aviso" role="alert">
            <Icono n="alerta" />
            <span>{pendientes.length === 1 ? 'Hay 1 cambio sin guardar' : `Hay ${pendientes.length} cambios sin guardar`} por la conexión. Se guardan solos en cuanto vuelva; no cierres esta página.</span>
            <button class="btn btn-peq" onClick={() => reintentar(true)}>Reintentar ahora</button>
          </div>
        )}
        <div class="rejilla-campos">
          <div class="campo"><label for={`b-nombre-${bloque.id}`}>Nombre</label>
            <input id={`b-nombre-${bloque.id}`} class="entrada" defaultValue={bloque.nombre} onChange={(e) => guardar('bloques', bloque.id, { nombre: e.currentTarget.value.trim() || bloque.nombre })} /></div>
          <div class="campo"><label for={`b-foco-${bloque.id}`}>Foco</label>
            <select id={`b-foco-${bloque.id}`} class="selector" value={bloque.foco || ''} onChange={(e) => guardar('bloques', bloque.id, { foco: nulo(e.currentTarget.value) })}>
              <option value="">Sin foco</option>{FOCOS.filter(([f]) => !['evaluacion', 'peaking'].includes(f)).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></div>
          {!bloque.es_plantilla && (
            <>
              <div class="campo"><label for={`b-ini-${bloque.id}`}>Empieza el lunes</label>
                <input id={`b-ini-${bloque.id}`} class="entrada" type="date" key={bloque.fecha_inicio} defaultValue={bloque.fecha_inicio || ''} onChange={(e) => {
                  const v = nulo(e.currentTarget.value);
                  const lunes = v ? lunesDe(v) : null;
                  estructura(() => api.cambiarInicioBloque(bloque.id, v), lunes && lunes !== v ? `Las semanas van de lunes a domingo: empieza el lunes ${fmtCorta(lunes)} y sus semanas se han movido con él` : 'Fechas del bloque y de sus semanas actualizadas');
                }} /></div>
              <div class="campo"><label for={`b-est-${bloque.id}`}>Estado</label>
                <select id={`b-est-${bloque.id}`} class="selector" value={bloque.estado} onChange={async (e) => {
                  const v = e.currentTarget.value;
                  if (v === 'activo') await estructura(() => api.activarBloque(bloque.id, bloque.atleta_id), 'Bloque activo: es el que ve el atleta');
                  else guardar('bloques', bloque.id, { estado: v });
                }}>{ESTADOS_BLOQUE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            </>
          )}
        </div>
        <div class="campo"><label for={`b-obj-${bloque.id}`}>Objetivo del bloque</label>
          <input id={`b-obj-${bloque.id}`} class="entrada" defaultValue={bloque.objetivo || ''} placeholder="Lo verá el atleta en su programa" onChange={(e) => guardar('bloques', bloque.id, { objetivo: nulo(e.currentTarget.value.trim()) })} /></div>
        {/* (054) bloque terminado con objetivo escrito: ¿se logró? Queda en el informe del bloque */}
        {bloque.objetivo && ['finalizado', 'cancelado'].includes(bloque.estado) && !bloque.es_plantilla && (
          <div class="campo"><span class="etiqueta">¿Se logró el objetivo?</span>
            <Segmentos valor={bloque.objetivo_logrado == null ? '' : bloque.objetivo_logrado ? 'si' : 'no'} opciones={[['si', 'Sí'], ['no', 'No'], ['', 'Sin decidir']]} alCambiar={(v) => guardar('bloques', bloque.id, { objetivo_logrado: v == null || v === '' ? null : v === 'si' })} etiqueta="¿Se logró el objetivo del bloque?" /></div>
        )}
        {/* (v0.104) la música de todo el bloque (en las plantillas, no: se enlaza al bloque de cada atleta) */}
        {/* (música 3) también en las plantillas: al copiarlas, su música va con ellas */}
        <CampoMusica clave={`bloque:${bloque.id}`} etiqueta="Música del bloque" />
        <div class="fila-envolver">
          {!bloque.es_plantilla && <button class="btn btn-peq" onClick={async () => { const p = await estructura(() => api.copiarBloque(bloque.id, { nombre: bloque.nombre }), 'Guardado como plantilla'); if (p) alCrearPlantilla?.(p); }}><Icono n="plantillas" /> Guardar como plantilla</button>}
          <button class="btn btn-peq btn-peligro" onClick={() => setConfirmarBorrado({ tipo: 'bloque' })}><Icono n="basura" /> Borrar {bloque.es_plantilla ? 'plantilla' : 'bloque'}</button>
        </div>
      </div>

      <div class="separa">
        <div class="semanas-tabs" role="group" aria-label="Semanas">
          {d.semanas.map((s) => (
            <button key={s.id} data-est={s.programacion} class={s.programacion === 'programada' ? 'programada' : ''} aria-pressed={s.id === semanaId ? 'true' : 'false'} onClick={() => setSemanaId(s.id)}>
              S{s.numero}<span class="est">{bloque.es_plantilla ? `${(d.sesiones[s.id] || []).length} días` : ESTADO_SEMANA[s.programacion]}</span>
            </button>
          ))}
          <button onClick={async () => { const s = await estructura(() => api.nuevaSemana(bloque.id)); if (s) setSemanaId(s.id); }} aria-label="Añadir semana vacía"><Icono n="mas" width="18" height="18" /><span class="est">Vacía</span></button>
        </div>
      </div>
      {d.semanas.some((s, i) => s.numero !== i + 1) && (
        <div class="aviso-semanas separa">
          <span class="peq secundario">Las semanas no van seguidas (empiezan en la {d.semanas[0].numero} o falta alguna).</span>
          <button class="btn btn-peq" onClick={() => estructura(() => api.renumerarSemanas(bloque.id), bloque.fecha_inicio ? 'Semanas renumeradas desde la 1, una por semana desde el inicio del bloque' : 'Semanas renumeradas desde la 1')}>Renumerar desde la 1</button>
        </div>
      )}

      {semana && (
        <div class="panel panel-pad pila editor-semana" key={semana.id}>
          <div class="separa" style="flex-wrap:wrap">
            <div>
              <strong style="font-size:1.125rem">Semana {semana.numero}</strong>
              {semana.fecha_inicio && <span class="secundario peq">{'  '}{rangoSemana(semana.fecha_inicio)}</span>}
            </div>
            <div class="fila-envolver">
              {!bloque.es_plantilla && (semana.programacion === 'programada'
                ? <button class="btn btn-peq" onClick={() => {
                  // Con series ya registradas, retirarla le escondería al atleta esos entrenamientos (y su historial)
                  const conSeries = sesiones.some((x) => (d.pautas[x.id] || []).some((p) => (d.series[p.id] || []).length));
                  if (conSeries) { aviso('Esta semana ya tiene series registradas: si la retiras, el atleta dejaría de ver esos entrenamientos. Edítala sin retirarla.', 'error'); return; }
                  estructura(() => api.publicarSemana(semana.id, false), 'Semana retirada: el atleta ya no la ve');
                }}>Retirar</button>
                : <button class="btn btn-peq btn-primario" onClick={() => pedirPublicar(semana, sesiones, !['activo', 'ajustado'].includes(bloque.estado))}><Icono n="enviar" /> Publicar al atleta</button>)}
              <button class="btn btn-peq" onClick={() => setDuplicar(true)}><Icono n="duplicar" /> Preparar las siguientes</button>
              {!bloque.es_plantilla && sesiones.length > 0 && <button class="btn btn-peq" onClick={() => setVistaAtleta(true)}><Icono n="vista" /> Como lo verá el atleta</button>}
              {sesiones.length > 1 && (() => {
                const todas = sesiones.every((x) => plegado.has(`s:${x.id}`));
                return <button class="btn btn-peq" onClick={() => plegar(sesiones.map((x) => `s:${x.id}`), !todas)}><Icono n={todas ? 'abajo' : 'arriba'} /> {todas ? 'Desplegar todas' : 'Plegar todas'}</button>;
              })()}
              {sesiones.some((x) => (d.pautas[x.id] || []).length) && (() => {
                // (v0.186) toda la semana en compacto: solo las filas de cada tabla, sin lo de debajo de cada ejercicio
                const claves = sesiones.flatMap((x) => (d.pautas[x.id] || []).map((p) => `p:${p.id}`));
                const compacta = claves.every((c) => plegado.has(c));
                return <button class="btn btn-peq" aria-pressed={compacta ? 'true' : 'false'} title="Deja solo la fila de cada ejercicio (series, repeticiones, esfuerzo y kilos), para repasar la semana de un tirón" onClick={() => plegar(claves, !compacta)}><Icono n={compacta ? 'vista' : 'ojo'} /> {compacta ? 'Ver el detalle' : 'Vista compacta'}</button>;
              })()}
              {conDatos && <button class="btn btn-peq" onClick={() => setSugerir(true)}><Icono n="rayo" /> Cargas sugeridas</button>}
              {paraFbe && <button class="btn btn-peq" onClick={async () => {
                let destino = paraFbe.destino;
                if (!destino) {
                  // La semana siguiente aún no existe: se crea igual que esta, en borrador, y sobre ella va la propuesta
                  const nuevas = await estructura(() => api.prepararSemanas(paraFbe.base.id, { n: 1, kg: 'igual', rpe: 0, rir: 0, reps: 0 }));
                  destino = nuevas?.[0] || null;
                  if (!destino) return;
                  aviso(`Semana ${destino.numero} creada en borrador`);
                }
                setSemanaId(destino.id);
                setFbe({ base: paraFbe.base.id, destino: destino.id });
              }}><Icono n="diana" /> {paraFbe.base.id === semana.id ? 'Programar la siguiente según FBE' : 'Programar según FBE'}</button>}
              <button class="btn btn-peq btn-icono btn-peligro" aria-label={`Borrar semana ${semana.numero}`} onClick={() => setConfirmarBorrado({ tipo: 'semana', id: semana.id })}><Icono n="basura" /></button>
            </div>
          </div>
          {!bloque.es_plantilla && semana.programacion !== 'programada' && <p class="peq secundario">Borrador: el atleta no verá esta semana hasta que la publiques.</p>}
          {notaRevision.datos?.nota && <p class="peq nota-de-revision"><Icono n="historial" /> <span><strong>De tu revisión:</strong> {notaRevision.datos.nota}</span></p>}
          <div class="rejilla-campos">
            <div class="campo"><label for={`s-foco-${semana.id}`}>Foco semanal</label>
              <select id={`s-foco-${semana.id}`} class="selector" value={semana.foco || ''} onChange={(e) => guardar('semanas', semana.id, { foco: nulo(e.currentTarget.value) })}>
                <option value="">Sin foco</option>{FOCOS.filter(([f]) => f !== 'mixto').map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></div>
            {!bloque.es_plantilla && <div class="campo"><label for={`s-ini-${semana.id}`}>Empieza el lunes</label>
              <input id={`s-ini-${semana.id}`} class="entrada" type="date" key={semana.fecha_inicio} defaultValue={semana.fecha_inicio || ''} onChange={(e) => {
                const v = nulo(e.currentTarget.value);
                const lunes = v ? lunesDe(v) : null;
                if (lunes && lunes !== v) aviso(`Las semanas van de lunes a domingo: empieza el lunes ${fmtCorta(lunes)}`);
                guardar('semanas', semana.id, { fecha_inicio: lunes });
              }} /></div>}
          </div>
          <div class="campo"><label for={`s-nota-${semana.id}`}>Nota para el atleta</label>
            <textarea key={`s-nota-${semana.id}-${version}`} id={`s-nota-${semana.id}`} class="area" style="min-height:64px" defaultValue={semana.nota_coach || ''} placeholder="Aparece arriba en su pantalla de hoy" onChange={(e) => guardar('semanas', semana.id, { nota_coach: nulo(e.currentTarget.value.trim()) })} /></div>
        </div>
      )}

      {semana && carreraDe && !bloque.es_plantilla && <PlanCarreraSemana carrera={carrera.datos} semana={semana} sesiones={sesiones} estructura={estructura} />}
      {semana && <VolumenSemana pautas={sesiones.flatMap((s) => d.pautas[s.id] || [])} ejercicios={ejercicios} objetivo={bloque.es_plantilla ? null : volumenObjetivo} />}
      {semana && anterior && !bloque.es_plantilla && <CambiosSemana anterior={anterior} cambios={cambiosDeSemana({ actuales: sesiones.flatMap((x) => d.pautas[x.id] || []), previas, anteriores: sesionesAnt.flatMap((x) => d.pautas[x.id] || []), nombres: Object.fromEntries(Object.values(ejercicios).map((e) => [e.id, e.nombre])) })} />}
      {semana && nivel && !bloque.es_plantilla && (
        <p class="peq secundario aviso-nivel"><Icono n="diana" /><span><strong>Nivel {NOMBRE_NIVEL[nivel].toLowerCase()}:</strong> {AYUDA_NIVEL[nivel].charAt(0).toLowerCase() + AYUDA_NIVEL[nivel].slice(1)}.
          {nivel !== 'novato' && ' Donde no pongas kg, el atleta ve en cada serie su peso de la última vez.'} Lo cambias en Datos.</span></p>
      )}

      {semana && sesiones.map((s, iSesion) => (
        <EditorSesion key={`${s.id}-${version}`} sesion={s} indice={iSesion} total={sesiones.length} plegado={plegado} plegar={plegar}
          semanas={d.semanas} semanaId={semana.id} reglasDe={reglasDe} aplicarPauta={aplicarPauta} quitarPauta={quitarPauta}
          ordenarPautas={(ids, antes) => ordenar('pautas', s.id, ids, antes)}
          moverSesion={(a) => { const antes = sesiones.map((x) => x.id); ordenar('sesiones', semana.id, reordenar(antes, iSesion, a), antes); }}
          copiarSesion={async (destinoId) => {
            const w = d.semanas.find((x) => x.id === destinoId);
            await estructura(() => api.copiarSesion(s.id, destinoId), destinoId === semana.id ? `«${s.nombre}» duplicada al final de la semana` : `«${s.nombre}» copiada a la semana ${w?.numero ?? ''}`);
          }}
          duplicarPauta={(p) => estructura(() => api.duplicarPauta(p.id), 'Ejercicio duplicado justo debajo')}
          previaSesion={!bloque.es_plantilla ? sesionPrevia(s, d.pautas[s.id] || [], previas, sesionesAnt) : null} numeroAnterior={anterior?.numero ?? null} comentarios={comentarios.datos || {}}
          privadas={atletaId ? privadas : null} guardarPrivada={atletaId ? guardarPrivada : null} rms={rms.datos || {}} sinGuardar={pendientes}
          sesionesSemana={sesiones} haySiguientes={d.semanas.some((w) => w.numero > semana.numero)} conHistorial={!!atletaId} minutosSesion={minutosSesion} notasLista={`notas-frecuentes-${bloque.id}`}
          menuSesion={async (v) => {
            if (v === 'varios') setVariosEn(s.id);
            else if (v === 'guardar') await estructura(() => api.guardarSesion(s.id), `«${s.nombre}» guardada: la tienes en «Añadir sesión guardada» y se edita en Plantillas`);
          }}
          masEjercicio={async (p, v) => {
            const n = ejercicios[p.ejercicio_id]?.nombre || 'El ejercicio';
            if (v === 'llevar') setLlevar(p);
            else if (v === 'historial') setHistorialDe(p);
            else if (v.startsWith('m:')) await estructura(() => api.moverPautaA(p.id, v.slice(2)), `${n} pasa a «${sesiones.find((x) => x.id === v.slice(2))?.nombre || 'la otra sesión'}»`);
            else if (v.startsWith('c:')) await estructura(() => api.copiarPautaA(p.id, v.slice(2)), `${n} copiado a «${sesiones.find((x) => x.id === v.slice(2))?.nombre || 'la otra sesión'}»`);
          }}
          conCarrera={!!carreraDe && !bloque.es_plantilla} zonasCarrera={zonasCarrera} pautas={d.pautas[s.id] || []} series={d.series} ejercicios={ejercicios} nivel={bloque.es_plantilla ? null : nivel} ultimas={ultimas.datos || {}} previas={previas} numeroSemana={semana?.numero ?? null} notasAtleta={notasAtleta.datos || {}} evitados={evitadosAtleta.datos || {}} fbe={fichasFbe.datos || null}
          guardar={guardar} guardarDetalle={guardarDetalle} estructura={estructura} elegir={(pautaId) => setElegir({ sesionId: s.id, pautaId })}
          corregirVariante={['finalizado', 'cancelado'].includes(bloque.estado) ? null : async (p, nuevo) => {
            await estructura(() => api.corregirVariante({ bloqueId: bloque.id, ejercicioId: p.ejercicio_id, variante: p.variante, nuevoEjercicioId: nuevo?.id || null }),
              nuevo ? `Cambiado a ${nuevo.nombre} en todas las semanas del bloque` : 'Variante quitada en todas las semanas del bloque');
            setVersion((v) => v + 1); // los campos de texto (la variante) se vuelven a pintar con lo guardado
          }}
          borrar={() => setConfirmarBorrado({ tipo: 'sesion', id: s.id, nombre: s.nombre })} />
      ))}
      {semana && <div class="anadir-sesiones">
        <button class="btn btn-ancho" onClick={() => estructura(() => api.nuevaSesion(semana.id))}><Icono n="mas" /> Añadir sesión</button>
        <button class="btn" onClick={() => setGuardadas(true)}><Icono n="plantillas" /> Añadir sesión guardada</button>
        {atletaId && <button class="btn" onClick={() => setDeOtro(true)}><Icono n="atletas" /> Traer de otro atleta</button>}
      </div>}
      {semana && atletaId && (() => {
        // (v0.186) quién queda por programar, sin contar a este
        const otros = (faltan.datos || []).filter((x) => x.atleta_id !== atletaId);
        if (!otros.length) return null;
        const sig = otros[0];
        return (
          <div class="panel panel-pad siguiente-atleta">
            <span class="peq"><strong>Por programar: {otros.length}.</strong> <span class="secundario">Siguiente: {sig.nombre} ({sig.falta === 'esta' ? 'no tiene publicada esta semana' : 'le falta la semana que viene'}).</span></span>
            <button class="btn btn-peq btn-primario" onClick={() => window.dispatchEvent(new CustomEvent('fbe-abrir-atleta', { detail: { atletaId: sig.atleta_id, pestana: 'programa' } }))}>Ir a {sig.nombre.split(' ')[0]} <Icono n="derecha" /></button>
            {otros.length > 1 && (
              <select class="selector" aria-label="Otro atleta por programar" value="" onChange={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v) window.dispatchEvent(new CustomEvent('fbe-abrir-atleta', { detail: { atletaId: v, pestana: 'programa' } })); }}>
                <option value="">Elegir otro…</option>
                {otros.slice(1).map((x) => <option key={x.atleta_id} value={x.atleta_id}>{x.nombre}{x.falta === 'esta' ? ' (esta semana)' : ''}</option>)}
              </select>
            )}
          </div>
        );
      })()}
      {deOtro && semana && <SesionDeOtro atletaId={atletaId} alCerrar={() => setDeOtro(false)} alElegir={async (g, de) => { setDeOtro(false); await estructura(() => api.copiarSesion(g.id, semana.id), `«${g.nombre}» de ${de} añadida a la semana ${semana.numero}`); }} />}
      <datalist id={`notas-frecuentes-${bloque.id}`}>{notasFrecuentes(d, notasMias).map((t) => <option key={t} value={t} />)}</datalist>
      {revisar && (
        <Hoja titulo={`Antes de publicar la semana ${revisar.semana.numero}`} alCerrar={() => setRevisar(null)} ancho={560}>
          <p class="peq secundario">Esto me ha parecido un despiste. Si está bien así, publícala igual.</p>
          <ul class="lista-avisos">
            {revisar.avisos.map((a, k) => <li key={k}><Icono n="alerta" /><span>{a.sesion && <strong>{a.sesion}: </strong>}{a.texto}</span></li>)}
          </ul>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setRevisar(null)}>Volver al editor</button>
            <button class="btn btn-primario" onClick={() => { const r = revisar; setRevisar(null); publicar(r.semana, r.activar); }}><Icono n="enviar" /> Publicar igual</button>
          </div>
        </Hoja>
      )}
      {variosEn && sesiones.some((x) => x.id === variosEn) && <CambiarVarios sesion={sesiones.find((x) => x.id === variosEn)} pautas={d.pautas[variosEn] || []} ejercicios={ejercicios} alCerrar={() => setVariosEn(null)}
        alAplicar={async (lista, texto) => { setVariosEn(null); await aplicarVarios(lista, texto, `${lista.length} ${lista.length === 1 ? 'ejercicio cambiado' : 'ejercicios cambiados'}`); }} />}
      {llevar && semana && <LlevarSiguientes pauta={Object.values(d.pautas).flat().find((x) => x.id === llevar.id) || llevar} parejas={parejasSiguientes(d, Object.values(d.pautas).flat().find((x) => x.id === llevar.id) || llevar, semana)} ejercicios={ejercicios} alCerrar={() => setLlevar(null)}
        alAplicar={async (lista) => { const n = ejercicios[llevar.ejercicio_id]?.nombre || 'un ejercicio'; setLlevar(null); await aplicarVarios(lista, `Llevar ${n} a las semanas siguientes`, `Cambiado en ${lista.length} ${lista.length === 1 ? 'semana' : 'semanas'} más`); }} />}
      {historialDe && atletaId && <HistorialEjercicio atletaId={atletaId} pauta={historialDe} nombre={ejercicios[historialDe.ejercicio_id]?.nombre || 'Ejercicio'}
        pautadas={Object.fromEntries(Object.entries(d.pautas).flatMap(([sid, lista]) => lista.filter((x) => x.ejercicio_id === historialDe.ejercicio_id).map((x) => [sid, x])))} alCerrar={() => setHistorialDe(null)} />}
      {guardadas && semana && <SesionesGuardadas alCerrar={() => setGuardadas(false)} alElegir={async (g) => { setGuardadas(false); await estructura(() => api.copiarSesion(g.id, semana.id), `«${g.nombre}» añadida a la semana ${semana.numero}`); }} />}

      {sugerir && semana && anterior && (
        <CargasSugeridas filas={sugerirCargas({
          // Con nivel, solo los ejercicios que se pautan con kg (los de RPE los carga el atleta)
          // (las pautadas serie a serie llevan sus kilos en cada serie: no se proponen aquí)
          ahora: sesiones.flatMap((x) => d.pautas[x.id] || []).filter((p) => conKg(p) && !tieneDetalle(p) && !fijos.has(p.ejercicio_id)), antes: sesionesAnt.flatMap((x) => d.pautas[x.id] || []),
          series: d.series, sesionesAhora: sesiones, sesionesAntes: sesionesAnt,
          nombres: Object.fromEntries(Object.values(ejercicios).map((e) => [e.id, e.nombre])), foco: semana.foco,
        })} sesiones={sesiones} semana={semana} anterior={anterior} alCerrar={() => setSugerir(false)}
          alAplicar={async (cambios) => {
            setSugerir(false);
            await estructura(async () => { for (const [id, kg] of cambios) await api.actualizar('sesion_ejercicios', id, { carga_sugerida_kg: kg }); },
              `${cambios.length} ${cambios.length === 1 ? 'carga actualizada' : 'cargas actualizadas'}`);
            setVersion((v) => v + 1);
          }} />
      )}
      {fbe && d.semanas.some((w) => w.id === fbe.base) && d.semanas.some((w) => w.id === fbe.destino) && (
        <ProgramarFBE d={d} base={d.semanas.find((w) => w.id === fbe.base)} destino={d.semanas.find((w) => w.id === fbe.destino)} ejercicios={ejercicios}
          atleta={{ id: atletaId, nivel, volumen_objetivo: volumenObjetivo }} fijos={fijos} alCerrar={() => setFbe(null)}
          alAplicar={async (lista, extra = {}) => {
            const w = d.semanas.find((x) => x.id === fbe.destino);
            setFbe(null);
            // La hoja guarda ella misma la nota de la semana (extra.nota): aquí solo se dice y se recarga
            const hecho = [lista.length ? `${lista.length} ${lista.length === 1 ? 'ejercicio actualizado' : 'ejercicios actualizados'}` : null, extra.nota ? (lista.length ? 'nota guardada' : 'Nota guardada') : null].filter(Boolean).join(' y ');
            await estructura(async () => { for (const { id, cambios } of lista) await api.actualizar('sesion_ejercicios', id, cambios); },
              `${hecho} en la semana ${w.numero}${w.programacion === 'programada' ? '' : ', en borrador'}`);
            setVersion((v) => v + 1);
          }} />
      )}
      {duplicar && semana && <Duplicar semana={semana} pautas={sesiones.flatMap((x) => d.pautas[x.id] || [])} ejercicios={ejercicios} fijos={fijos} alCerrar={() => setDuplicar(false)} alHacer={async (prog) => {
        setDuplicar(false);
        const nuevas = await estructura(() => api.prepararSemanas(semana.id, { ...prog, fijos: [...fijos] }));
        if (nuevas?.length) {
          setSemanaId(nuevas[0].id);
          aviso(nuevas.length === 1 ? `Semana ${nuevas[0].numero} preparada, en borrador` : `Semanas ${nuevas.map((w) => w.numero).join(', ')} preparadas, en borrador: revísalas y publícalas`);
        }
      }} />}
      {elegir && <ElegirEjercicio biblioteca={biblioteca} conOrden usos={usosEnBloque(d)} evitados={evitadosAtleta.datos || {}} alCerrar={() => setElegir(null)} alElegir={async (ej) => {
        const { sesionId, pautaId } = elegir;
        setElegir(null);
        const ev = (evitadosAtleta.datos || {})[ej.id];
        if (ev) aviso(`Ojo: prefiere evitar ${ej.nombre} (${textoMotivo(ev).toLowerCase()}). Se pone igual; coméntaselo si hace falta.`);
        if (pautaId) await guardar('sesion_ejercicios', pautaId, { ejercicio_id: ej.id });
        else await estructura(() => api.nuevaPauta(sesionId, ej.id, basePauta(ej, reglasDe(ej.id))));
      }} varios={!elegir.pautaId} alElegirVarios={async (lista) => {
        const { sesionId } = elegir;
        setElegir(null);
        const ev = lista.filter((ej) => (evitadosAtleta.datos || {})[ej.id]);
        if (ev.length) aviso(`Ojo: prefiere evitar ${ev.map((ej) => ej.nombre).join(', ')}. Se ${ev.length === 1 ? 'pone' : 'ponen'} igual; coméntaselo si hace falta.`);
        await estructura(() => api.nuevasPautas(sesionId, lista.map((ej) => ({ ejercicio_id: ej.id, ...basePauta(ej, reglasDe(ej.id)) }))), `${lista.length} ejercicios añadidos`);
      }} />}
      {/* lejos de la cabecera del bloque, deshacer sigue a mano */}
      {/* (v0.186) en el móvil, además: saltar al ejercicio anterior o al siguiente sin tanto desplazamiento */}
      <div class={`barra-editor ${ultimo ? '' : 'sin-deshacer'}`}>
        {semana && sesiones.some((x) => (d.pautas[x.id] || []).length) && <>
          <button class="btn btn-icono solo-movil" aria-label="Ir al ejercicio anterior" onClick={() => irAFila(-1)}><Icono n="arriba" /></button>
          <button class="btn btn-icono solo-movil" aria-label="Ir al ejercicio siguiente" onClick={() => irAFila(1)}><Icono n="abajo" /></button>
        </>}
        {ultimo && <button class="btn deshacer-flotante" aria-label={`Deshacer el último cambio: ${ultimo.etiqueta}`} onClick={deshacer}><Icono n="deshacer" /> Deshacer</button>}
      </div>
      {vistaAtleta && semana && <VistaAtleta semana={semana} sesiones={sesiones} pautas={d.pautas} ejercicios={ejercicios} alCerrar={() => setVistaAtleta(false)} />}
      {publicarEn && (
        <Hoja titulo="Este bloque aún no es el activo" alCerrar={() => setPublicarEn(null)}>
          <p class="peq secundario">El atleta solo ve las semanas publicadas de su bloque activo. Si lo activas ahora, el bloque que tenía activo pasa a finalizado y en su programa verá este.</p>
          <div class="pila-s">
            <button class="btn btn-primario btn-grande" onClick={async () => {
              const w = publicarEn; setPublicarEn(null);
              await estructura(async () => { await api.publicarSemana(w.id, true); await api.activarBloque(bloque.id, bloque.atleta_id); }, `Semana ${w.numero} publicada y bloque activado`);
            }}><Icono n="enviar" /> Publicar y activar este bloque</button>
            <button class="btn" onClick={async () => {
              const w = publicarEn; setPublicarEn(null);
              await estructura(() => api.publicarSemana(w.id, true), `Semana ${w.numero} publicada (el atleta la verá cuando actives el bloque)`);
            }}>Solo publicar</button>
          </div>
        </Hoja>
      )}
      {confirmarBorrado && (
        <Hoja titulo="¿Seguro?" alCerrar={() => setConfirmarBorrado(null)}>
          <p>{confirmarBorrado.tipo === 'bloque' ? `Se borrará ${bloque.es_plantilla ? 'la plantilla' : 'el bloque'} entero con todas sus semanas${bloque.es_plantilla ? '' : ' y las series registradas'}.`
            : confirmarBorrado.tipo === 'semana' ? 'Se borrará la semana con sus sesiones y lo que se haya registrado en ella. Las siguientes suben un puesto (y una semana antes).'
              : `Se borrará la sesión «${confirmarBorrado.nombre}» y lo registrado en ella.`} No se puede deshacer.</p>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setConfirmarBorrado(null)}>Cancelar</button>
            <button class="btn btn-peligro" onClick={async () => {
              const c = confirmarBorrado; setConfirmarBorrado(null);
              if (c.tipo === 'bloque') { await api.borrar('bloques', bloque.id); aviso('Borrado'); alBorrar?.(); }
              else if (c.tipo === 'semana') await estructura(() => api.borrarSemana(c.id), 'Semana borrada: las siguientes suben un puesto');
              else await estructura(() => api.borrar('sesiones', c.id), 'Borrado');
            }}><Icono n="basura" /> Borrar</button>
          </div>
        </Hoja>
      )}
    </div>
  );
}

// (v0.185) Qué cambia respecto a la semana anterior: una línea por ejercicio que cambia, los nuevos y los que ya no están
function CambiosSemana({ anterior, cambios }) {
  return (
    <details class="panel panel-pad cambios-semana">
      <summary>Qué cambia respecto a la semana {anterior.numero}{cambios.length ? ` (${cambios.length})` : ': nada'}</summary>
      {cambios.length > 0 && <ul class="lista-cambios">
        {cambios.map((c, k) => <li key={k} class={`cambio-${c.tipo}`}><strong>{c.nombre}</strong><span class="num">{c.texto}</span></li>)}
      </ul>}
    </details>
  );
}

// (v0.185) Cambiar varios ejercicios de una sesión a la vez: se marcan y se elige qué cambia (lo demás no se toca)
function CambiarVarios({ sesion, pautas, ejercicios, alCerrar, alAplicar }) {
  const [marcados, setMarcados] = useState(() => new Set(pautas.map((p) => p.id)));
  const [f, setF] = useState({ descanso: '', prioridad: '', rpe: '', rir: '', series: '' });
  const pon = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const num1 = (t) => { const v = Number(String(t).replace(',', '.')); return String(t).trim() === '' || Number.isNaN(v) ? null : v; };
  const rpe = num1(f.rpe), rir = num1(f.rir);
  const malRpe = rpe != null && (rpe < 1 || rpe > 10), malRir = rir != null && (rir < 0 || rir > 10);
  const lista = pautas.filter((p) => marcados.has(p.id)).map((p) => {
    const c = {};
    if (f.descanso !== '') c.descanso_seg = Number(f.descanso);
    if (f.prioridad) c.prioridad = f.prioridad;
    if (rir != null && !malRir) c.rir_objetivo = rir;
    // serie a serie: sus series y su RPE van en cada serie, no se tocan desde aquí
    if (!tieneDetalle(p)) {
      if (rpe != null && !malRpe) c.rpe_objetivo = rpe;
      if (f.series) c.series = Math.max(p.backoff_pct != null ? 2 : 1, Math.min(20, (Number(p.series) || 1) + Number(f.series)));
    }
    for (const k of Object.keys(c)) if (c[k] === p[k]) delete c[k];
    return { id: p.id, cambios: c };
  }).filter((x) => Object.keys(x.cambios).length);
  const conDetalle = pautas.some((p) => marcados.has(p.id) && tieneDetalle(p)) && (f.series || rpe != null);
  return (
    <Hoja titulo={`Cambiar varios ejercicios de ${sesion.nombre}`} alCerrar={alCerrar} ancho={560}>
      <fieldset class="varios-lista"><legend class="etq">A cuáles</legend>
        {pautas.map((p) => (
          <label key={p.id} class="varios-fila"><input type="checkbox" checked={marcados.has(p.id)} onChange={() => setMarcados((m) => { const n = new Set(m); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
            <Disco prioridad={p.prioridad} /><span>{ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio'}</span></label>
        ))}
      </fieldset>
      <p class="etq">Qué cambia (lo que dejes sin tocar se queda como está)</p>
      <div class="rejilla-campos">
        <label class="campo"><span class="etq">Descanso</span><select class="selector" value={f.descanso} onChange={pon('descanso')}><option value="">Sin cambiar</option>{DESCANSOS.map((x) => <option key={x} value={x}>{x ? mmss(x) : 'Sin descanso'}</option>)}</select></label>
        <label class="campo"><span class="etq">Prioridad</span><select class="selector" value={f.prioridad} onChange={pon('prioridad')}><option value="">Sin cambiar</option>{PRIORIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label class="campo"><span class="etq">Series</span><select class="selector" value={f.series} onChange={pon('series')}><option value="">Sin cambiar</option><option value="1">Una más</option><option value="-1">Una menos</option></select></label>
        <label class="campo"><span class="etq">RPE objetivo</span><input class={`entrada ${malRpe ? 'invalido' : ''}`} inputMode="decimal" placeholder="Sin cambiar" value={f.rpe} onInput={pon('rpe')} /></label>
        <label class="campo"><span class="etq">RIR objetivo</span><input class={`entrada ${malRir ? 'invalido' : ''}`} inputMode="decimal" placeholder="Sin cambiar" value={f.rir} onInput={pon('rir')} /></label>
      </div>
      {(malRpe || malRir) && <p class="peq" style="color:var(--alerta)">El RPE va de 1 a 10 y el RIR de 0 a 10.</p>}
      {conDetalle && <p class="mini terciario">A los que van serie a serie no se les cambian las series ni el RPE desde aquí: van en cada serie.</p>}
      <div class="fila-envolver">
        <button class="btn" onClick={alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled={!lista.length || malRpe || malRir} onClick={() => alAplicar(lista, `Cambiar ${lista.length} ejercicios de ${sesion.nombre}`)}>{lista.length ? `Cambiar ${lista.length} ${lista.length === 1 ? 'ejercicio' : 'ejercicios'}` : 'Nada que cambiar'}</button>
      </div>
    </Hoja>
  );
}

// (v0.185) Llevar lo de un ejercicio a las semanas siguientes: qué se lleva y a cuáles
function LlevarSiguientes({ pauta, parejas, ejercicios, alCerrar, alAplicar }) {
  const difiere = (clave) => parejas.some((x) => cambiosParaPareja(pauta, x, [clave]));
  const [que, setQue] = useState(() => LLEVAR.map(([c]) => c).filter((c) => c !== 'pauta' && difiere(c)));
  const [a, setA] = useState(() => new Set(parejas.map((x) => x.semana.id)));
  const alternar = (c) => setQue((q) => (q.includes(c) ? q.filter((x) => x !== c) : [...q, c]));
  const lista = parejas.filter((x) => a.has(x.semana.id)).map((x) => ({ id: x.pauta.id, cambios: cambiosParaPareja(pauta, x, que) })).filter((x) => x.cambios);
  const nombre = ejercicios[pauta.ejercicio_id]?.nombre || 'este ejercicio';
  return (
    <Hoja titulo={`Llevar ${nombre} a las semanas siguientes`} alCerrar={alCerrar} ancho={560}>
      {!parejas.length ? <p class="secundario">En las semanas siguientes no hay un ejercicio en ese mismo sitio al que llevarlo.</p> : <>
        <fieldset class="varios-lista"><legend class="etq">Qué se lleva</legend>
          {LLEVAR.map(([c, t]) => <label key={c} class="varios-fila"><input type="checkbox" checked={que.includes(c)} onChange={() => alternar(c)} /><span>{t}{!difiere(c) && <span class="terciario"> (ya es igual)</span>}</span></label>)}
        </fieldset>
        <fieldset class="varios-lista"><legend class="etq">A qué semanas</legend>
          {parejas.map((x) => (
            <label key={x.semana.id} class="varios-fila"><input type="checkbox" checked={a.has(x.semana.id)} onChange={() => setA((m) => { const n = new Set(m); if (n.has(x.semana.id)) n.delete(x.semana.id); else n.add(x.semana.id); return n; })} />
              <span><strong>Semana {x.semana.numero}</strong>: {ejercicios[x.pauta.ejercicio_id]?.nombre || 'Ejercicio'}{x.pauta.ejercicio_id !== pauta.ejercicio_id && que.includes('ejercicio') && !x.conSeries ? ` → ${nombre}` : ''}
                {x.conSeries && <span class="terciario"> (ya tiene series hechas: no se le cambia el ejercicio)</span>}</span></label>
          ))}
        </fieldset>
        <div class="fila-envolver">
          <button class="btn" onClick={alCerrar}>Cancelar</button>
          <button class="btn btn-primario" disabled={!lista.length} onClick={() => alAplicar(lista)}>{lista.length ? `Cambiar en ${lista.length} ${lista.length === 1 ? 'semana' : 'semanas'}` : 'Nada que cambiar'}</button>
        </div>
      </>}
    </Hoja>
  );
}

// (v0.185) El historial de un ejercicio sin salir del editor: sus últimas seis sesiones, lo pautado (si es de este
// bloque), lo que hizo y su mejor serie
function HistorialEjercicio({ atletaId, pauta, nombre, pautadas, alCerrar }) {
  const { api } = useApp();
  const h = useCarga(() => api.historialEjercicio(atletaId, pauta.ejercicio_id), [atletaId, pauta.ejercicio_id]);
  const filas = historialParaEditor(h.datos?.sesiones || [], pautadas, 6);
  return (
    <Hoja titulo={`Historial de ${nombre}`} alCerrar={alCerrar} ancho={560}>
      {h.cargando ? <Cargando /> : h.error ? <ErrorCaja error={h.error} reintentar={h.recargar} /> : !filas.length ? <p class="secundario">Todavía no ha registrado ninguna serie de este ejercicio.</p> : (
        <ol class="historial-editor">
          {filas.map((x, k) => {
            const v = x.pauta ? pautaAtleta(x.pauta) : null;
            return (
              <li key={k}>
                <span class="historial-fecha"><strong>{x.fecha ? fmtConDia(x.fecha) : 'Sin fecha'}</strong>{x.record && <span class="mini marca-buscador">mejor marca</span>}</span>
                {v && <span class="mini secundario num">Pautado: {[v.series, v.esfuerzo, v.carga].filter(Boolean).join(' · ')}</span>}
                <span class="peq num">{x.series.map(textoSerieHecha).join('  ·  ')}</span>
                {x.mejor != null && <span class="mini secundario num">1RM estimado: {num(x.mejor, 1)} kg</span>}
              </li>
            );
          })}
        </ol>
      )}
      {h.datos?.mejor && <p class="mini terciario">Su mejor 1RM estimado: {num(h.datos.mejor.valor, 1)} kg ({fmtCorta(h.datos.mejor.fecha)}).</p>}
    </Hoja>
  );
}

// (v0.185) Las sesiones guardadas del coach (viven en la plantilla «Sesiones guardadas»): se añade una a la semana
function SesionesGuardadas({ alCerrar, alElegir }) {
  const { api } = useApp();
  const g = useCarga(() => api.sesionesGuardadas(), []);
  return (
    <Hoja titulo="Añadir sesión guardada" alCerrar={alCerrar} ancho={520}>
      {g.cargando ? <Cargando /> : g.error ? <ErrorCaja error={g.error} reintentar={g.recargar} /> : !(g.datos || []).length
        ? <p class="secundario">Aún no has guardado ninguna. En el menú «Copiar, mover…» de una sesión, elige «Guardar esta sesión para reutilizarla».</p>
        : <div class="lista-elegir">{g.datos.map((x) => (
          <div key={x.id} class="elegir-fila"><button onClick={() => alElegir(x)}>
            <span style="font-weight:600">{x.nombre}</span>
            <span class="mini terciario">{x.ejercicios ? `${x.ejercicios} ${x.ejercicios === 1 ? 'ejercicio' : 'ejercicios'} · ${x.series} series` : x.tipo === 'cardio' ? 'Cardio' : 'Sin ejercicios'}</span>
          </button></div>
        ))}</div>}
      <p class="mini terciario">Se añade al final de la semana, tal como la guardaste. Para cambiarlas o borrarlas: Plantillas → «Sesiones guardadas».</p>
    </Hoja>
  );
}

// (v0.186) Lleva la pantalla al ejercicio anterior o al siguiente (la barra del móvil): el primero cuya fila empieza por
// debajo de la cabecera, o el último que queda por encima
function irAFila(dir) {
  const filas = [...document.querySelectorAll('.tabla-pauta tbody > tr[data-fila]')];
  if (!filas.length) return;
  const tope = 96;
  const destino = dir > 0 ? filas.find((f) => f.getBoundingClientRect().top > tope + 8) : [...filas].reverse().find((f) => f.getBoundingClientRect().top < tope - 8);
  if (!destino) return;
  const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: window.scrollY + destino.getBoundingClientRect().top - tope, behavior: suave ? 'smooth' : 'auto' });
}

// (v0.186) «Traer de otro atleta»: una sesión del programa de otro atleta, copiada al final de esta semana (sus
// ejercicios con su prescripción; nada de lo que él haya registrado)
function SesionDeOtro({ atletaId, alCerrar, alElegir }) {
  const { api } = useApp();
  const atletas = useCarga(() => api.atletas().then((l) => l.filter((a) => a.id !== atletaId && a.estado !== 'baja' && a.entrenamiento !== false)), [atletaId]);
  const [de, setDe] = useState('');
  const suyas = useCarga(() => (de ? api.sesionesDeAtleta(de) : Promise.resolve(null)), [de]);
  const nombre = (atletas.datos || []).find((a) => a.id === de)?.nombre || '';
  return (
    <Hoja titulo="Traer una sesión de otro atleta" alCerrar={alCerrar} ancho={520}>
      {atletas.cargando ? <Cargando /> : atletas.error ? <ErrorCaja error={atletas.error} reintentar={atletas.recargar} /> : (
        <div class="campo"><label for="de-otro-atleta">¿De quién?</label>
          <select id="de-otro-atleta" class="selector" value={de} onChange={(e) => setDe(e.currentTarget.value)}>
            <option value="">Elige un atleta</option>
            {(atletas.datos || []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select></div>
      )}
      {de && (suyas.cargando ? <Cargando /> : suyas.error ? <ErrorCaja error={suyas.error} reintentar={suyas.recargar} /> : !(suyas.datos || []).length
        ? <p class="secundario">No tiene sesiones en su bloque actual.</p>
        : suyas.datos.map((w) => (
          <div key={w.numero} class="pila-xs">
            <strong class="peq">Semana {w.numero}</strong>
            <div class="lista-elegir">{w.sesiones.map((x) => (
              <div key={x.id} class="elegir-fila"><button onClick={() => alElegir(x, nombre.split(' ')[0])}>
                <span style="font-weight:600">{x.nombre}</span>
                <span class="mini terciario">{x.ejercicios ? `${x.ejercicios} ${x.ejercicios === 1 ? 'ejercicio' : 'ejercicios'} · ${x.series} series` : x.tipo === 'cardio' ? 'Cardio' : 'Sin ejercicios'}</span>
              </button></div>
            ))}</div>
          </div>
        )))}
      <p class="mini terciario">Se copia al final de esta semana con sus ejercicios, series, repeticiones, esfuerzo y kilos. Repasa los kilos: son los del otro atleta.</p>
    </Hoja>
  );
}

// (v0.184) «Como lo verá el atleta»: la semana tal como le sale en su programa (cada sesión con su dinámica, su cardio
// y sus ejercicios con series, repeticiones, esfuerzo, kilos, descanso y tu nota). Solo se mira: no cambia nada.
function VistaAtleta({ semana, sesiones, pautas, ejercicios, alCerrar }) {
  return (
    <Hoja titulo={`Semana ${semana.numero}, como la verá el atleta`} alCerrar={alCerrar} ancho={560}>
      {semana.programacion !== 'programada' && <p class="peq secundario">Está en borrador: no la verá hasta que la publiques.</p>}
      {semana.nota_coach && <p class="nota vista-nota"><strong>Tu nota de la semana: </strong>{semana.nota_coach}</p>}
      <div class="pila vista-atleta">
        {sesiones.map((s) => {
          const lista = pautas[s.id] || [];
          const letras = etiquetasSuperserie(lista);
          return (
            <div key={s.id} class="panel panel-pad pila-s vista-sesion">
              <div><strong>{s.nombre}</strong>{s.intencion && <span class="secundario peq"> · {(INTENCIONES.find(([v]) => v === s.intencion) || [])[1] || s.intencion}</span>}</div>
              {s.dinamica && <p class="peq secundario" style="white-space:pre-wrap">{s.dinamica}</p>}
              {s.cardio && textoCardio(s.cardio) && <p class="peq"><Icono n="intervalos" /> {textoCardio(s.cardio)}</p>}
              {lista.length > 0 && <ol class="vista-ejercicios">
                {lista.map((p) => {
                  const v = pautaAtleta(p);
                  return (
                    <li key={p.id}>
                      <span class="vista-nombre">{letras[p.id] && <span class="mini vista-letra">{letras[p.id]}</span>}<Disco prioridad={p.prioridad} /> <strong>{ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio'}</strong>{p.variante && <span class="secundario"> ({p.variante})</span>}</span>
                      <span class="peq num">{[v.series, v.esfuerzo, v.carga, p.tempo ? `tempo ${p.tempo}` : null, v.descanso ? `descanso ${v.descanso}` : null].filter(Boolean).join(' · ')}</span>
                      {tieneDetalle(p) && <span class="mini secundario num">{p.series_detalle.map((x, k) => `S${k + 1}: ${textoSerieFBE({ kg: x.kg, reps: x.reps, rpe: x.rpe }) || '–'}`).join('  ·  ')}</span>}
                      {p.notas_coach && <span class="mini secundario">Nota: {p.notas_coach}</span>}
                    </li>
                  );
                })}
              </ol>}
              {!lista.length && !s.cardio && <p class="peq secundario">Sin ejercicios todavía.</p>}
            </div>
          );
        })}
      </div>
    </Hoja>
  );
}

// Cargas sugeridas: la propuesta de cada ejercicio con su motivo; el coach marca cuáles aplicar
function CargasSugeridas({ filas, sesiones, semana, anterior, alCerrar, alAplicar }) {
  // Marcadas de entrada: las que suben, las de descarga y las que no tenían carga; rebajar lo pautado se decide a mano
  const [marcadas, setMarcadas] = useState(() => new Set(filas.filter((f) => f.propuesta != null && f.cambia && (f.tipo !== 'mantener' || f.actual == null)).map((f) => f.pauta_id)));
  const nombreSesion = Object.fromEntries(sesiones.map((x) => [x.id, x.nombre]));
  const conPropuesta = filas.filter((f) => f.propuesta != null);
  const alternar = (id) => setMarcadas((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Hoja titulo={`Cargas sugeridas para la semana ${semana.numero}`} alCerrar={alCerrar} ancho={720}>
      <p class="peq secundario">A partir de lo que registró en la semana {anterior.numero}. Marca las que quieras aplicar; las demás se quedan como están.</p>
      {!conPropuesta.length ? <p class="peq">No hay ejercicios con series de la semana anterior para proponer cargas.</p> : (
        <ul class="lista cargas-sug">
          {filas.map((f) => (
            <li key={f.pauta_id} class={`carga-sug ${f.propuesta == null ? 'sin' : ''}`}>
              {f.propuesta != null
                ? <input type="checkbox" checked={marcadas.has(f.pauta_id)} onChange={() => alternar(f.pauta_id)} aria-label={`Aplicar ${num(f.propuesta, 2)} kg en ${f.ejercicio}`} />
                : <span />}
              <span class="pila-xs">
                <strong>{f.ejercicio}</strong>
                <span class="mini terciario">{nombreSesion[f.sesion_id]}{f.antes ? `. Semana ${anterior.numero}: ${f.antes}` : ''}</span>
                <span class={`mini ${f.tipo === 'subir' ? 'ok-t' : f.tipo === 'bajar' ? 'secundario' : 'secundario'}`}>{f.motivo}</span>
              </span>
              <span class="carga-sug-kg num">
                {f.propuesta != null ? <>
                  <span class="terciario">{f.actual != null ? `${num(f.actual, 2)} →` : '— →'}</span>
                  <b class={f.tipo === 'subir' ? 'ok-t' : ''}>{num(f.propuesta, 2)} kg</b>
                </> : <span class="terciario">—</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled={!marcadas.size} onClick={() => alAplicar(filas.filter((f) => marcadas.has(f.pauta_id)).map((f) => [f.pauta_id, f.propuesta]))}>
          <Icono n="hecho" /> {marcadas.size ? `Aplicar ${marcadas.size} ${marcadas.size === 1 ? 'carga' : 'cargas'}` : 'Marca las que quieras aplicar'}
        </button>
      </div>
    </Hoja>
  );
}

// Nota del coach para un ejercicio: el campo aparece al pedirlo (o si ya hay nota), para no alargar la tabla
function NotaPauta({ valor, alGuardar, lista = null }) {
  const [abierta, setAbierta] = useState(!!valor);
  if (!abierta) return <button type="button" class="btn-texto mini nota-pauta" onClick={() => setAbierta(true)}><Icono n="mas" width="14" height="14" /> Nota para el atleta</button>;
  return (
    <input class="variante" aria-label="Nota para el atleta" placeholder="Nota para el atleta" list={lista || undefined} defaultValue={valor || ''} autoFocus={!valor}
      onChange={(e) => alGuardar(nulo(e.currentTarget.value.trim()))} onBlur={(e) => { if (!e.currentTarget.value.trim()) setAbierta(false); }} />
  );
}

// Tempo de la repetición (3-1-1, 31X0…): se guarda normalizado y el atleta lo tiene con metrónomo
const BACKOFFS = [5, 7.5, 10, 12.5, 15, 20, 25];

function CampoTempo({ valor, alGuardar }) {
  const { aviso } = useApp();
  const [mal, setMal] = useState(false);
  const t = leerTempo(valor);
  return (
    <input class={`tempo ${mal ? 'invalido' : ''}`} aria-label="Tempo (bajada, pausa, subida)" placeholder="Tempo" title={t ? explicarTempo(t) : 'Por ejemplo, 3-1-1: baja en 3 s, 1 s abajo y sube en 1 s (X = explosiva)'}
      aria-invalid={mal ? 'true' : 'false'} defaultValue={t?.texto || valor || ''} maxLength={9} inputMode="text" autoComplete="off" spellcheck={false}
      onInput={() => mal && setMal(false)}
      onChange={(e) => {
        const v = e.currentTarget.value.trim();
        if (!v) { setMal(false); alGuardar(null); return; }
        const l = leerTempo(v);
        if (!l) { setMal(true); aviso('Escribe el tempo con 3 o 4 cifras, por ejemplo 3-1-1 o 31X0 (X = explosiva)', 'error'); return; }
        setMal(false); e.currentTarget.value = l.texto; alGuardar(l.texto);
      }} />
  );
}

// Series pautadas por músculo en la semana que se edita, frente al rango objetivo del atleta
function VolumenSemana({ pautas, ejercicios, objetivo }) {
  const cuenta = seriesPautadasPorGrupo(pautas, ejercicios);
  const desglose = desglosePautadoPorGrupo(pautas, ejercicios);
  const grupos = GRUPOS.filter(([g]) => cuenta[g]);
  if (!grupos.length) return null;
  return (
    <div class="panel panel-pad pila-s">
      <span class="peq secundario">Series semanales pautadas por músculo{objetivo ? ' (frente al rango de este atleta)' : ' (frente al rango general, 10–20; antebrazo, aductores y lumbares, 0–20)'}</span>
      <div class="vol-chips">
        {grupos.map(([g, n]) => {
          const r = rangoVolumen(objetivo, g);
          const est = estadoVolumen(cuenta[g], r);
          return (
            <span key={g} data-g={g} class={`vol-chip vol-${est}`} title={est === 'bajo' ? 'Por debajo del rango' : est === 'alto' ? 'Por encima del rango' : 'Dentro del rango'}>
              {n} <strong>{num(cuenta[g])}</strong><span class="mini">{r[0]}–{r[1]}</span>
            </span>
          );
        })}
      </div>
      <details class="vol-desglose">
        <summary class="mini terciario">De dónde sale cada número</summary>
        <ul class="mini">
          {grupos.map(([g, n]) => (
            <li key={g}><strong>{n} {num(cuenta[g])}:</strong> {desglose[g].map((x) => (x.principal ? `${x.nombre} ${num(x.series)}` : `${x.nombre} ${num(x.series)} × ½`)).join(' · ')}</li>
          ))}
        </ul>
        <p class="mini terciario">Cada ejercicio cuenta entero en su músculo principal (el primero de sus grupos en la biblioteca) y a medias en los demás. Si uno cuenta donde no debe, cámbiale el principal en Biblioteca.</p>
      </details>
    </div>
  );
}

// La pauta de cardio de una sesión: modalidad, minutos u objetivo de km, esfuerzo objetivo y una nota. Se guarda al salir de cada campo.
// (v0.133) Con la carrera: el tipo, los rangos, la zona, si es opcional y sus partes (calentar, bloque, enfriar…)
const carreraDePauta = (x = {}) => ({ tipo: x.tipo || null, minutos_max: x.minutos_max ?? '', km_max: x.km_max ?? '', zona: x.zona ?? null, zona_hasta: x.zona_hasta ?? null, opcional: !!x.opcional, partes: x.partes || [] });
const tieneCarrera = (x) => !!x && ['tipo', 'minutos_max', 'km_max', 'zona', 'partes', 'opcional'].some((k) => k in x);
function PautaCardio({ sesion, guardar, conCarrera = false, zonas = null }) {
  const { api, aviso } = useApp();
  const c = sesion.cardio || {};
  const [f, setF] = useState({ modalidad: c.modalidad || 'carrera', minutos: c.minutos ?? '', km: c.km ?? '', esfuerzo: c.esfuerzo ?? '', nota: c.nota || '', carrera: carreraDePauta(c) });
  const [error, setError] = useState(null);
  const [aBiblioteca, setABiblioteca] = useState(null);  // el nombre con que se guarda en la biblioteca de carrera
  useEffect(() => { const x = sesion.cardio || {}; setF({ modalidad: x.modalidad || 'carrera', minutos: x.minutos ?? '', km: x.km ?? '', esfuerzo: x.esfuerzo ?? '', nota: x.nota || '', carrera: carreraDePauta(x) }); }, [sesion.id]);
  const verCarrera = f.modalidad === 'carrera' && (conCarrera || tieneCarrera(sesion.cardio));
  const fijar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const enviar = (nuevo = f) => {
    const { pauta, error: err } = limpiarCardio(nuevo);
    setError(err);
    if (err) return;
    if (JSON.stringify(pauta) !== JSON.stringify(sesion.cardio || null)) guardar('sesiones', sesion.id, { cardio: pauta });
  };
  const alCambiarSelect = (k) => (e) => { const nuevo = { ...f, [k]: e.currentTarget.value }; setF(nuevo); enviar(nuevo); };
  return (
    <div class="pauta-cardio" aria-label="Pauta de cardio">
      <div class="pauta-cardio-campos">
        <label class="campo"><span class="etq">Modalidad</span>
          <select class="selector" value={f.modalidad} onChange={alCambiarSelect('modalidad')}>{MODALIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label class="campo"><span class="etq">Minutos</span>
          <input class="entrada" inputMode="numeric" placeholder="30" value={f.minutos} onInput={fijar('minutos')} onBlur={() => enviar()} /></label>
        <label class="campo"><span class="etq">Kilómetros</span>
          <input class="entrada" inputMode="decimal" placeholder="—" value={f.km} onInput={fijar('km')} onBlur={() => enviar()} /></label>
        <label class="campo"><span class="etq">Esfuerzo (RPE)</span>
          <select class="selector" value={f.esfuerzo} onChange={alCambiarSelect('esfuerzo')}><option value="">—</option>{[3, 4, 5, 6, 7, 8, 9, 10].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <label class="campo"><span class="etq">Nota del cardio</span>
        <input class="entrada" placeholder="Llano, sin cuestas; si puedes, al aire libre" maxLength={300} value={f.nota} onInput={fijar('nota')} onBlur={() => enviar()} /></label>
      {verCarrera && <CamposCarreraPauta f={f} setF={setF} enviar={enviar} zonas={zonas} alGuardarReceta={sesion.cardio?.partes?.length ? () => setABiblioteca(sesion.nombre.slice(0, 80)) : null} />}
      {aBiblioteca != null && (
        <Hoja titulo="Guardar en tu biblioteca" alCerrar={() => setABiblioteca(null)}>
          <form class="pila" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.guardarCarreraReceta({ nombre: aBiblioteca, pauta: sesion.cardio }); aviso('Guardada en tu biblioteca de carrera'); setABiblioteca(null); } catch (err) { aviso(err.message, 'error'); }
          }}>
            <label class="campo"><span class="etq">Nombre</span><input class="entrada" required maxLength={80} value={aBiblioteca} onInput={(e) => setABiblioteca(e.currentTarget.value)} /></label>
            <p class="mini terciario">Se guarda la pauta tal cual (tipo, minutos, zona y partes), para usarla en otras sesiones con «Desde la biblioteca».</p>
            <button class="btn btn-primario">Guardar</button>
          </form>
        </Hoja>
      )}
      {error ? <span class="error-campo">{error}</span>
        : sesion.cardio ? <span class="mini terciario">El atleta verá: «{textoCardio(sesion.cardio)}»{sesion.cardio.esfuerzo ? ` (${palabrasEsfuerzo(sesion.cardio.esfuerzo)})` : ''}. Al terminar apuntará minutos, kilómetros y esfuerzo.</span>
        : <span class="mini terciario">Pon los minutos o los kilómetros: el atleta lo verá en su sesión y apuntará lo que haga.</span>}
    </div>
  );
}

function parchear(d, tabla, id, cambios) {
  if (tabla === 'bloques') return { ...d, bloque: { ...d.bloque, ...cambios } };
  if (tabla === 'semanas') return { ...d, semanas: d.semanas.map((s) => (s.id === id ? { ...s, ...cambios } : s)) };
  if (tabla === 'sesiones') return { ...d, sesiones: Object.fromEntries(Object.entries(d.sesiones).map(([k, v]) => [k, v.map((s) => (s.id === id ? { ...s, ...cambios } : s))])) };
  if (tabla === 'sesion_ejercicios') return { ...d, pautas: Object.fromEntries(Object.entries(d.pautas).map(([k, v]) => [k, v.map((p) => (p.id === id ? { ...p, ...cambios } : p))])) };
  return d;
}

// Pauta serie a serie: una fila por serie con sus reps, kilos y RPE (cada uno opcional); añadir o quitar series.
// Cada cambio se guarda al salir del campo; el resumen de la fila (series, reps, kg, RPE) sale de aquí.
// (v0.184) Una casilla con sus botones − y +: suben o bajan el número un paso (el salto de kilos del ejercicio, o una
// repetición) y lo guardan. No entran en el recorrido del tabulador: con teclado se escribe el número, como siempre.
function Pasos({ paso, menos, mas, alCambiar, decimales = 2, children }) {
  const mover = (dir) => (e) => {
    const inp = e.currentTarget.parentElement.querySelector('input');
    if (!inp) return;
    const v = pasoDe(inp.value, Number(typeof paso === 'function' ? paso(inp.value) : paso) || 1, dir);
    if (v == null) return;
    inp.value = num(v, decimales);
    alCambiar(v);
  };
  return (
    <span class="con-pasos">
      <button type="button" class="paso" tabIndex={-1} aria-label={menos} onClick={mover(-1)}><Icono n="menos" /></button>
      {children}
      <button type="button" class="paso" tabIndex={-1} aria-label={mas} onClick={mover(1)}><Icono n="mas" /></button>
    </span>
  );
}

function DetalleSeries({ pauta, hechas = [], alGuardar, salto = () => 2.5 }) {
  const d = pauta.series_detalle;
  const [rev, setRev] = useState(0); // al igualar las series, las casillas se vuelven a pintar
  // Lo último escrito, aunque aún no haya vuelto de guardarse (dos cambios seguidos no se pisan)
  const ultimo = useRef(d);
  const pendientes = useRef(0);
  useEffect(() => { if (!pendientes.current) ultimo.current = d; }, [d]);
  const leer = (t) => { const x = String(t).replace(',', '.').trim(); return x === '' ? null : Number(x); };
  const guardar = async (nuevo) => {
    ultimo.current = nuevo; pendientes.current += 1;
    // (si falla, el editor rehace la sesión y con ella esto, con lo que haya guardado)
    try { await alGuardar(nuevo); } finally { pendientes.current -= 1; }
  };
  const cambiar = (i, campo, t) => {
    const v = leer(t);
    if (v != null && Number.isNaN(v)) return;
    guardar(ultimo.current.map((x, k) => (k === i ? { ...x, [campo]: v } : x)));
  };
  const hecha = Object.fromEntries(hechas.map((x) => [x.numero, x]));
  return (
    <div class="detalle-series" role="group" aria-label="Series una a una">
      <div class="detalle-cab" aria-hidden="true"><span /><span>Reps</span><span>Kg</span><span>RPE</span><span /></div>
      {d.map((x, i) => (
        // La clave cambia al añadir o quitar series (las filas se rehacen), no al escribir (no se pierde el foco)
        <div class="detalle-fila" data-fila key={`${pauta.id}-${d.length}-${i}-${rev}`}>
          <span class="n mini">S{i + 1}</span>
          <Pasos paso={1} decimales={0} menos={`Una repetición menos en la serie ${i + 1}`} mas={`Una repetición más en la serie ${i + 1}`} alCambiar={(v) => cambiar(i, 'reps', String(v))}>
            <input class="n" data-celda="reps" enterKeyHint="next" inputMode="numeric" aria-label={`Repeticiones de la serie ${i + 1}`} defaultValue={x.reps ?? ''} onChange={(e) => cambiar(i, 'reps', e.currentTarget.value)} />
          </Pasos>
          <Pasos paso={salto} menos={`Menos kilos en la serie ${i + 1}`} mas={`Más kilos en la serie ${i + 1}`} alCambiar={(v) => cambiar(i, 'kg', String(v))}>
            <input class="n" data-celda="kg" enterKeyHint="next" inputMode="decimal" aria-label={`Kilos de la serie ${i + 1}`} defaultValue={x.kg == null ? '' : num(x.kg, 2)} onChange={(e) => cambiar(i, 'kg', e.currentTarget.value)} />
          </Pasos>
          <input class="n" data-celda="rpe" enterKeyHint="next" inputMode="decimal" aria-label={`RPE de la serie ${i + 1}`} defaultValue={x.rpe == null ? '' : num(x.rpe, 1)} onChange={(e) => cambiar(i, 'rpe', e.currentTarget.value)} />
          <button class="btn btn-icono plano" aria-label={`Quitar la serie ${i + 1}`} disabled={d.length <= 1} onClick={() => guardar(ultimo.current.filter((_, k) => k !== i))}><Icono n="cerrar" /></button>
          {hecha[i + 1] && <span class="mini hecho-semana detalle-hecha">Hecho: {textoSerieHecha(hecha[i + 1])}</span>}
        </div>
      ))}
      <div class="fila-envolver detalle-acciones">
        <button class="btn-texto mini" disabled={d.length >= 20} onClick={() => guardar([...ultimo.current, { ...ultimo.current[ultimo.current.length - 1] }])}><Icono n="mas" /> Serie</button>
        {d.length > 1 && <button class="btn-texto mini" title="Las demás series quedan con las repeticiones, los kilos y el RPE de la primera" onClick={async () => { await guardar(igualarSeries(ultimo.current)); setRev((v) => v + 1); }}><Icono n="copiar" /> Copiar la serie 1 a las demás</button>}
      </div>
    </div>
  );
}

// «25×10 @8», «12 reps @7» (sin kilos) o «25×10» (sin RPE)
// (v0.181) siempre con unidades: «60 kg × 8 reps @8»
const textoSerieHecha = (x) => textoSerieFBE({ kg: x.kg, reps: x.reps, rpe: x.rpe != null ? Number(x.rpe) : x.rir != null ? 10 - Number(x.rir) : null }) || '–';

// (v0.181) Junto a lo que se programa: lo pautado y lo que hizo la semana anterior, y lo programado ahora, serie a serie
function TablaSemanaAnterior({ previa, pauta, numero, nombre, aplicar = null }) {
  const filas = seriesEnFilas({ pautada: previa.pauta, hechas: previa.hechas, propuesta: pauta });
  const hecho = detalleDeHechas(previa.hechas);
  return (
    <>
    {aplicar && (
      <div class="fila-envolver atajos-previa">
        <button class="btn-texto mini" aria-label={`${nombre}: programar como la semana ${previa.semana}`} onClick={() => aplicar(comoLaAnterior(previa.pauta), `Como la semana pasada en ${nombre}`)}><Icono n="reiniciar" /> Como la semana pasada</button>
        {hecho && <button class="btn-texto mini" aria-label={`${nombre}: programar lo que hizo en la semana ${previa.semana}`} onClick={() => aplicar({ series_detalle: hecho }, `Lo que hizo en ${nombre}`)}><Icono n="hecho" /> Lo que hizo</button>}
      </div>
    )}
    <div class="fbe-series-caja en-editor" tabIndex={0} role="group" aria-label={`${nombre}: series de la semana ${previa.semana} y lo programado`}>
      <table class="fbe-series num" aria-label={`${nombre}: la semana ${previa.semana} y lo programado, serie a serie`}>
        <thead><tr><th scope="col">Serie</th><th scope="col">Pautado (sem. {previa.semana})</th><th scope="col">Hizo</th><th scope="col">Programado{numero != null ? ` (sem. ${numero})` : ''}</th></tr></thead>
        <tbody>
          {filas.map((x) => (
            <tr key={x.n}>
              <th scope="row">{x.n}</th>
              <td class="secundario">{x.pautado || '–'}</td>
              <td class="hizo">{x.hizo || 'sin hacer'}</td>
              <td class={x.cambia ? 'cambia' : ''}>{x.propuesta || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

function EditorSesion({ sesion, pautas, series, ejercicios, guardar, guardarDetalle, estructura, elegir, borrar, corregirVariante, nivel = null, ultimas = {}, previas = {}, numeroSemana = null, notasAtleta = {}, evitados = {}, fbe = null, conCarrera = false, zonasCarrera = null,
  indice = 0, total = 1, plegado = new Set(), plegar = () => {}, semanas = [], semanaId = null, reglasDe = () => undefined, aplicarPauta = null, quitarPauta = null, ordenarPautas = null, moverSesion = null, copiarSesion = null, duplicarPauta = null,
  sesionesSemana = [], haySiguientes = false, conHistorial = false, minutosSesion = null, notasLista = null, menuSesion = null, masEjercicio = null,
  previaSesion = null, numeroAnterior = null, comentarios = {}, privadas = null, guardarPrivada = null, rms = {}, sinGuardar = [] }) {
  const { api } = useApp();
  const cerrada = plegado.has(`s:${sesion.id}`);
  // (v0.185) lo que dura, a ojo: 40 s por serie más los descansos, y los minutos del cardio
  const minutos = (pautas.length ? duracionEstimada(pautas) : 0) + (Number(sesion.cardio?.minutos) || 0);
  const sePasa = minutosSesion && minutos > minutosSesion + 5;
  const saltoDePauta = (p) => (valor) => saltoKg(ejercicios[p.ejercicio_id]?.nombre, valor, reglasDe(p.ejercicio_id));
  const lista = useMemo(() => Object.values(ejercicios), [ejercicios]);
  const numero = (pautaId, campo, dec = false) => (e) => {
    const t = e.currentTarget.value.replace(',', '.').trim();
    const v = t === '' ? null : dec ? Number(t) : parseInt(t, 10);
    if (v !== null && Number.isNaN(v)) return;
    guardar('sesion_ejercicios', pautaId, { [campo]: v });
  };
  const hechas = pautas.reduce((t, p) => t + (series[p.id]?.length || 0), 0);
  // (v0.186) cómo le fue: esta, si ya la hizo, y la que le corresponde de la semana anterior
  const fue = comoLeFue(sesion, { series: hechas, comentarios: comentarios[sesion.id] || 0, fecha: fmtConDia });
  const fueAntes = previaSesion ? comoLeFue(previaSesion, { comentarios: comentarios[previaSesion.id] || 0, fecha: fmtConDia }) : null;
  const pendiente = (id) => sinGuardar.some((x) => x.tabla === 'sesion_ejercicios' && x.id === id);
  // Con nivel, solo las columnas que se usan; en cada fila, la que no toca por su prioridad queda atenuada
  const col = columnasEditor(nivel, pautas);
  const fuera = (p, campo) => {
    const m = modoCarga(nivel, p.prioridad);
    return m && p[campo] == null && (campo === 'carga_sugerida_kg' ? m === 'rpe' : m === 'kg');
  };
  const titulo = (p, campo) => (fuera(p, campo) ? (campo === 'carga_sugerida_kg' ? 'A RPE: la carga la elige el atleta (verá su peso anterior)' : 'Con kg pautados: el RPE lo rellena el atleta') : undefined);
  const [conCardio, setConCardio] = useState(false); // «Añadir cardio al final» en una sesión que no es de cardio
  const etiquetas = etiquetasSuperserie(pautas);
  const sueltas = pautas.filter((p) => p.superserie && !etiquetas[p.id]);
  return (
    <section class={`panel panel-pad editor-sesion ${cerrada ? 'plegada' : ''}`} aria-label={sesion.nombre} onKeyDown={teclaEnRejilla}>
      <div class="editor-sesion-barra">
        {total > 1 && moverSesion && <button type="button" class="btn btn-icono plano asa-mover" aria-label={`Arrastrar ${sesion.nombre} para cambiarla de sitio`} title="Arrastra para cambiarla de sitio"
          onPointerDown={(e) => asa(e, { contenedor: e.currentTarget.closest('section.editor-sesion')?.parentElement, selector: ':scope > section.editor-sesion', indice, alSoltar: (_, a) => moverSesion(a) })}><Icono n="agarre" /></button>}
        <button type="button" class="btn-texto plegar-sesion" aria-expanded={cerrada ? 'false' : 'true'} onClick={() => plegar(`s:${sesion.id}`)}>
          <Icono n={cerrada ? 'derecha' : 'abajo'} /><span>{cerrada ? <><strong>{sesion.nombre}</strong> <span class="secundario">· {resumenSesion(sesion, pautas)}{sesion.completada ? ' · hecha' : ''}</span></> : 'Plegar'}</span>
        </button>
        {minutos > 0 && <span class={`mini duracion-sesion ${sePasa ? 'se-pasa' : ''}`} title="Estimación: 40 s por serie más los descansos (y los minutos del cardio)">{sePasa && <Icono n="alerta" />}unos {minutos} min{sePasa ? ` (tiene ${minutosSesion})` : ''}</span>}
        <select class="selector menu-sesion" aria-label={`Más acciones de ${sesion.nombre}`} value="" onChange={(e) => {
          const v = e.currentTarget.value; e.currentTarget.value = '';
          if (v === 'subir') moverSesion?.(indice - 1); else if (v === 'bajar') moverSesion?.(indice + 1);
          else if (v === 'compacto') plegar(pautas.map((p) => `p:${p.id}`), !pautas.every((p) => plegado.has(`p:${p.id}`)));
          else if (v.startsWith('a:')) copiarSesion?.(v.slice(2));
          else menuSesion?.(v);
        }}>
          <option value="">Copiar, mover…</option>
          <option value={`a:${semanaId}`}>Duplicar en esta semana</option>
          {semanas.filter((w) => w.id !== semanaId).map((w) => <option key={w.id} value={`a:${w.id}`}>Copiar a la semana {w.numero}</option>)}
          {indice > 0 && <option value="subir">Subir un puesto</option>}
          {indice < total - 1 && <option value="bajar">Bajar un puesto</option>}
          {pautas.length > 1 && menuSesion && <option value="varios">Cambiar varios ejercicios a la vez…</option>}
          {menuSesion && <option value="guardar">Guardar esta sesión para reutilizarla</option>}
          {pautas.length > 0 && <option value="compacto">{pautas.every((p) => plegado.has(`p:${p.id}`)) ? 'Ver el detalle de los ejercicios' : 'Ver solo la tabla (sin el detalle)'}</option>}
        </select>
      </div>
      {!cerrada && <>
      <div class="editor-sesion-cab">
        <input class="entrada" aria-label="Nombre de la sesión" style="font-weight:700" defaultValue={sesion.nombre} onChange={(e) => guardar('sesiones', sesion.id, { nombre: e.currentTarget.value.trim() || sesion.nombre })} />
        <select class="selector" aria-label="Tipo de sesión" value={sesion.tipo || 'fuerza'} onChange={(e) => guardar('sesiones', sesion.id, { tipo: e.currentTarget.value })}>
          {TIPOS_SESION.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select class="selector" aria-label="Intención" value={sesion.intencion || ''} onChange={(e) => guardar('sesiones', sesion.id, { intencion: nulo(e.currentTarget.value) })}>
          <option value="">Intención</option>{INTENCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <button class="btn btn-icono plano btn-peligro" aria-label={`Borrar ${sesion.nombre}`} onClick={borrar}><Icono n="basura" /></button>
      </div>
      {fue && <p class="peq como-fue hecha"><Icono n="hecho" /><span><strong>{fue.texto.charAt(0).toUpperCase() + fue.texto.slice(1)}.</strong>{fue.nota && <> <span class="secundario">Su nota: «{fue.nota}»</span></>}</span></p>}
      {previaSesion && numeroAnterior != null && (fueAntes
        ? <p class="mini como-fue"><Icono n="reloj" /><span><span class="terciario">Semana {numeroAnterior}: </span>{fueAntes.texto}.{fueAntes.nota && <> Su nota: «{fueAntes.nota}»</>}</span></p>
        : <p class="mini como-fue terciario"><Icono n="reloj" /><span>Semana {numeroAnterior}: «{previaSesion.nombre}» no la hizo (o no la cerró).</span></p>)}
      {!sesion.completada && sesion.dia_previsto && <p class="mini terciario plan-coach"><Icono n="calendario" /> El atleta la tiene prevista el {fmtConDia(sesion.dia_previsto)}.</p>}
      <textarea class="area" style="min-height:56px" aria-label="Dinámica de la sesión" placeholder={sesion.tipo === 'cardio' ? 'Qué hacer: por ejemplo, 30 min en zona 2 (puedes hablar sin ahogarte) o 6 × 2 min fuerte con 2 min suave' : 'Dinámica: calentamiento, orden, indicaciones…'} defaultValue={sesion.dinamica || ''}
        onChange={(e) => guardar('sesiones', sesion.id, { dinamica: nulo(e.currentTarget.value.trim()) })} />
      {/* (v0.104) la música de esta sesión (una lista, un álbum o un episodio para el cardio largo) */}
      <CampoMusica clave={`sesion:${sesion.id}`} etiqueta="Música de la sesión" />
      {/* (YouTube, 059) «sigue este vídeo»: un vídeo de YouTube para esta sesión (calentamiento, movilidad, un cardio) */}
      <VideoDeSesionCoach sesion={sesion} guardar={guardar} />
      {(sesion.tipo === 'cardio' || sesion.cardio || conCardio) ? <PautaCardio sesion={sesion} guardar={guardar} conCarrera={conCarrera} zonas={zonasCarrera} />
        : <button class="btn-texto" style="justify-self:start" onClick={() => setConCardio(true)}><Icono n="intervalos" /> Añadir cardio al final</button>}
      {pautas.length > 0 && (
        <div class="tabla-pauta-env">
          <table class="tabla-pauta">
            <thead><tr>
              <th style="width:168px">Prioridad</th><th style="width:96px" title="Misma letra en ejercicios seguidos: se alternan y se descansa al acabar la ronda">Superserie</th><th class="col-ejercicio">Ejercicio</th><th style="width:64px">Series</th><th style="width:62px">Reps de</th><th style="width:62px">Reps a</th>
              {col.rir && <th style="width:58px">RIR</th>}{col.rpe && <th style="width:58px">RPE</th>}{col.kg && <th style="width:112px">Kilos</th>}<th style="width:88px">Descanso</th><th style="width:80px"><span class="sr">Acciones</span></th>
            </tr></thead>
            <tbody>
              {pautas.map((p, i) => (
                <tr key={p.id} data-fila class={`${plegado.has(`p:${p.id}`) ? 'sin-detalle' : ''} ${pendiente(p.id) ? 'sin-guardar' : ''}`} title={pendiente(p.id) ? 'Sin guardar: se guarda solo cuando vuelva la conexión' : undefined}>
                  <td data-col="Prioridad"><span class="sel-prioridad">
                    <Disco prioridad={p.prioridad} />
                    <select aria-label="Prioridad" value={p.prioridad} onChange={(e) => guardar('sesion_ejercicios', p.id, { prioridad: e.currentTarget.value })}>
                      {PRIORIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select></span></td>
                  <td data-col="Superserie"><select aria-label="Superserie" value={p.superserie || ''} class={etiquetas[p.id] ? 'ss-activa' : ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { superserie: nulo(e.currentTarget.value) })}>
                    <option value="">—</option>{LETRAS_SUPERSERIE.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select></td>
                  <td class="col-ejercicio"><button class="btn btn-peq btn-ejercicio" onClick={() => elegir(p.id)}>{ejercicios[p.ejercicio_id]?.nombre || 'Elegir ejercicio'}</button>
                    {privadas?.[p.ejercicio_id]?.fijado && <span class="chip chip-fijado" title="Con candado: «Programar según FBE», «Preparar las siguientes» y «Cargas sugeridas» lo dejan como está. Se quita en «Mover, llevar, historial…»"><Icono n="candado" /> Fijado</span>}
                    {!plegado.has(`p:${p.id}`) && <>
                    <Equivalentes ejercicio={ejercicios[p.ejercicio_id]} lista={lista} alCambiar={(ej) => guardar('sesion_ejercicios', p.id, { ejercicio_id: ej.id })} />
                    <div class="variante-tempo">
                      <input class="variante" aria-label="Variante" placeholder="Variante: pausa, agarre…" defaultValue={p.variante || ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { variante: nulo(e.currentTarget.value.trim()) })} />
                      <CampoTempo valor={p.tempo} alGuardar={(v) => guardar('sesion_ejercicios', p.id, { tempo: v })} />
                      <select class={`backoff ${p.backoff_pct != null ? 'activo' : ''}`} aria-label="Serie top y back-off" title="La primera serie es la top; las demás, un % por debajo de lo que el atleta haga en ella (la app calcula la carga)"
                        value={tieneDetalle(p) ? 'detalle' : p.backoff_pct == null ? '' : String(Number(p.backoff_pct))}
                        onChange={async (e) => {
                          const t = e.currentTarget.value;
                          if (t === 'detalle') { await guardarDetalle(p.id, detalleDesdePauta(p)); return; }
                          if (tieneDetalle(p)) await guardarDetalle(p.id, null);
                          const v = t === '' ? null : Number(t);
                          if (v != null || p.backoff_pct != null) guardar('sesion_ejercicios', p.id, v == null ? { backoff_pct: null } : { backoff_pct: v, series: Math.max(2, p.series || 0) });
                        }}>
                        <option value="">Series iguales</option>
                        <option value="detalle">Serie a serie</option>
                        {BACKOFFS.map((x) => <option key={x} value={String(x)}>Top + back-off −{num(x)} %</option>)}
                      </select>
                    </div>
                    {fbe && <AyudaFicha ejercicioId={p.ejercicio_id} fichas={fbe.fichas} enlaces={fbe.enlaces} molestias={fbe.molestias} />}
                    {masEjercicio && (sesionesSemana.length > 1 || haySiguientes || conHistorial || guardarPrivada) && (
                      <select class="equivalentes mas-ejercicio" aria-label={`Más acciones de ${ejercicios[p.ejercicio_id]?.nombre || 'este ejercicio'}`} value="" onChange={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v === 'candado') guardarPrivada(p.ejercicio_id, { fijado: !privadas?.[p.ejercicio_id]?.fijado }); else if (v) masEjercicio(p, v); }}>
                        <option value="">Mover, llevar, historial…</option>
                        {conHistorial && <option value="historial">Ver su historial</option>}
                        {guardarPrivada && p.ejercicio_id && <option value="candado">{privadas?.[p.ejercicio_id]?.fijado ? 'Quitar el candado' : 'Poner candado: que no lo cambien los automáticos'}</option>}
                        {haySiguientes && <option value="llevar">Llevar a las semanas siguientes…</option>}
                        {sesionesSemana.filter((x) => x.id !== sesion.id).map((x) => <option key={`m${x.id}`} value={`m:${x.id}`}>Mover a {x.nombre}</option>)}
                        {sesionesSemana.filter((x) => x.id !== sesion.id).map((x) => <option key={`c${x.id}`} value={`c:${x.id}`}>Copiar a {x.nombre}</option>)}
                      </select>
                    )}
                    <AvisoVariante pauta={p} ejercicio={ejercicios[p.ejercicio_id]} lista={lista} corregir={corregirVariante} />
                    <NotaPauta valor={p.notas_coach} lista={notasLista} alGuardar={(v) => guardar('sesion_ejercicios', p.id, { notas_coach: v })} />
                    {guardarPrivada && p.ejercicio_id && <label class="nota-solo-coach" title="Solo la ves tú. Va con el ejercicio: sale en todas las semanas en las que este atleta lo tenga">
                      <Icono n="candado" /><span class="sr">Nota solo para ti sobre {ejercicios[p.ejercicio_id]?.nombre || 'este ejercicio'}</span>
                      <input class="variante" key={`priv-${privadas?.[p.ejercicio_id]?.nota || ''}`} maxLength={300} placeholder="Solo para ti (el atleta no la ve)" defaultValue={privadas?.[p.ejercicio_id]?.nota || ''}
                        onChange={(e) => guardarPrivada(p.ejercicio_id, { nota: e.currentTarget.value.trim() })} />
                    </label>}
                    {(() => {
                      // (v0.186) en los básicos, qué parte de su mejor 1RM estimado son los kilos pautados
                      const r = (ejercicios[p.ejercicio_id]?.tipo || []).includes('basico') ? pctDeRm(kilosDe(p), rms[p.ejercicio_id]) : null;
                      return r ? <div class="mini pct-rm num" title="Su mejor 1RM estimado sale de todo su historial (kilos, repeticiones y esfuerzo de cada serie)"><span class="terciario">{num(kilosDe(p), 2)} kg son el </span><strong>{r.pct} %</strong><span class="terciario"> de su mejor 1RM estimado ({num(r.mejor, 1)} kg)</span></div> : null;
                    })()}
                    {tieneDetalle(p) && <DetalleSeries pauta={p} hechas={series[p.id] || []} alGuardar={(d) => guardarDetalle(p.id, d)} salto={saltoDePauta(p)} />}
                    {evitados[p.ejercicio_id] && <div class="mini aviso-evitado" role="note"><Icono n="alerta" /><span>Prefiere evitarlo: {textoMotivo(evitados[p.ejercicio_id]).toLowerCase()}. Es solo un aviso.</span></div>}
                    {notasAtleta[p.ejercicio_id] && <div class="mini nota-atleta-coach" title="Su nota fijada en este ejercicio (la escribe el atleta en su sesión)"><Icono n="chincheta" /><span><span class="terciario">Su nota: </span>{notasAtleta[p.ejercicio_id].texto}</span></div>}
                    {previas[p.id]?.hechas.length > 0 && <TablaSemanaAnterior previa={previas[p.id]} pauta={p} numero={numeroSemana} nombre={ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio'} aplicar={aplicarPauta ? (c, etiqueta) => aplicarPauta(p.id, c, etiqueta) : null} />}
                    {!(previas[p.id]?.hechas.length > 0) && ultimas[p.ejercicio_id]?.series.length > 0 && <div class="mini registro-serie ultima-vez-coach" title="Lo que hizo la última vez antes de esta semana">
                      <span class="terciario">Última vez{ultimas[p.ejercicio_id].fecha ? ` (${fmtCorta(ultimas[p.ejercicio_id].fecha)})` : ''}: </span>{ultimas[p.ejercicio_id].series.map(textoSerieHecha).join(' · ')}</div>}
                    {series[p.id]?.length > 0 && <div class="mini registro-serie hecho-semana" style="margin-top:3px"><span class="terciario">Esta semana: </span>{[...series[p.id]].sort((a, c) => a.numero - c.numero).map(textoSerieHecha).join(' · ')}</div>}
                    </>}</td>
                  {tieneDetalle(p) ? <>
                    <td class="resumen-detalle num" title="Serie a serie: cámbialo en las series de debajo">{p.series}</td>
                    <td class="resumen-detalle num" title="Serie a serie: cámbialo en las series de debajo">{p.reps_min ?? '–'}</td>
                    <td class="resumen-detalle num" title="Serie a serie: cámbialo en las series de debajo">{p.reps_max ?? '–'}</td>
                    {col.rir && <td data-col="RIR"><input class="n" data-celda="rir" enterKeyHint="next" inputMode="decimal" aria-label="RIR objetivo" defaultValue={p.rir_objetivo == null ? '' : num(p.rir_objetivo, 1)} onChange={numero(p.id, 'rir_objetivo', true)} /></td>}
                    {col.rpe && <td class="resumen-detalle num" title="El RPE de la última serie">{p.rpe_objetivo == null ? '–' : num(p.rpe_objetivo, 1)}</td>}
                    {col.kg && <td class="resumen-detalle num" title="Los kilos de la mayoría de las series">{p.carga_sugerida_kg == null ? '–' : num(p.carga_sugerida_kg, 2)}</td>}
                  </> : <>
                  <td data-col="Series"><input class="n" data-celda="series" enterKeyHint="next" inputMode="numeric" aria-label="Series" key={`series-${p.series}`} defaultValue={p.series} onChange={(e) => {
                    // Con top + back-off hacen falta al menos dos series: con una sola, deja de serlo.
                    // La «key» lo vuelve a pintar si las series cambian desde fuera (elegir back-off las sube a 2)
                    const v = parseInt(e.currentTarget.value, 10);
                    if (!Number.isNaN(v) && v < 2 && p.backoff_pct != null) guardar('sesion_ejercicios', p.id, { series: v, backoff_pct: null });
                    else numero(p.id, 'series')(e);
                  }} /></td>
                  <td data-col="Reps de"><input class="n" data-celda="reps_min" enterKeyHint="next" inputMode="numeric" aria-label="Repeticiones mínimas" defaultValue={p.reps_min ?? ''} onChange={numero(p.id, 'reps_min')} /></td>
                  <td data-col="Reps a"><input class="n" data-celda="reps_max" enterKeyHint="next" inputMode="numeric" aria-label="Repeticiones máximas" defaultValue={p.reps_max ?? ''} onChange={numero(p.id, 'reps_max')} /></td>
                  {col.rir && <td data-col="RIR"><input class="n" data-celda="rir" enterKeyHint="next" inputMode="decimal" aria-label="RIR objetivo" defaultValue={p.rir_objetivo == null ? '' : num(p.rir_objetivo, 1)} onChange={numero(p.id, 'rir_objetivo', true)} /></td>}
                  {col.rpe && <td data-col="RPE"><input class={`n ${fuera(p, 'rpe_objetivo') ? 'fuera-nivel' : ''}`} data-celda="rpe" enterKeyHint="next" inputMode="decimal" aria-label="RPE objetivo" title={titulo(p, 'rpe_objetivo')} placeholder={fuera(p, 'rpe_objetivo') ? '·' : ''} defaultValue={p.rpe_objetivo == null ? '' : num(p.rpe_objetivo, 1)} onChange={numero(p.id, 'rpe_objetivo', true)} /></td>}
                  {col.kg && <td data-col="Kilos"><Pasos paso={saltoDePauta(p)} menos={`Menos kilos en ${ejercicios[p.ejercicio_id]?.nombre || 'este ejercicio'}`} mas={`Más kilos en ${ejercicios[p.ejercicio_id]?.nombre || 'este ejercicio'}`} alCambiar={(v) => guardar('sesion_ejercicios', p.id, { carga_sugerida_kg: v })}>
                    <input class={`n ${fuera(p, 'carga_sugerida_kg') ? 'fuera-nivel' : ''}`} data-celda="kg" enterKeyHint="next" inputMode="decimal" aria-label="Carga sugerida en kg" title={titulo(p, 'carga_sugerida_kg')} placeholder={fuera(p, 'carga_sugerida_kg') ? '·' : ''} defaultValue={p.carga_sugerida_kg == null ? '' : num(p.carga_sugerida_kg, 2)} onChange={numero(p.id, 'carga_sugerida_kg', true)} />
                  </Pasos></td>}
                  </>}
                  <td data-col="Descanso"><select aria-label="Descanso" value={p.descanso_seg ?? ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { descanso_seg: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}>
                    <option value="">—</option>{DESCANSOS.map((s) => <option key={s} value={s}>{s ? mmss(s) : 'Sin descanso'}</option>)}
                  </select></td>
                  <td class="col-acciones"><span class="acciones-fila">
                    {pautas.length > 1 && ordenarPautas ? <button type="button" class="btn btn-icono plano asa-mover" aria-label={`Arrastrar ${ejercicios[p.ejercicio_id]?.nombre || 'el ejercicio'} para cambiarlo de sitio`} title="Arrastra para cambiarlo de sitio"
                      onPointerDown={(e) => asa(e, { contenedor: e.currentTarget.closest('tbody'), selector: ':scope > tr[data-fila]', indice: i, alSoltar: (de, a) => { const antes = pautas.map((x) => x.id); ordenarPautas(reordenar(antes, de, a), antes); } })}><Icono n="agarre" /></button> : <span />}
                    <button type="button" class="btn btn-icono plano" aria-expanded={plegado.has(`p:${p.id}`) ? 'false' : 'true'} title={plegado.has(`p:${p.id}`) ? 'Ver el detalle (variante, notas, semana anterior)' : 'Ocultar el detalle y dejar solo la fila'} aria-label={`${plegado.has(`p:${p.id}`) ? 'Ver' : 'Ocultar'} el detalle de ${ejercicios[p.ejercicio_id]?.nombre || 'este ejercicio'}`} onClick={() => plegar(`p:${p.id}`)}><Icono n={plegado.has(`p:${p.id}`) ? 'ojo' : 'vista'} /></button>
                    <button class="btn btn-icono plano" aria-label="Subir" disabled={i === 0} onClick={() => { const antes = pautas.map((x) => x.id); if (ordenarPautas) ordenarPautas(reordenar(antes, i, i - 1), antes); else estructura(() => api.moverPauta(sesion.id, p.id, -1)); }}><Icono n="arriba" /></button>
                    <button class="btn btn-icono plano" aria-label="Bajar" disabled={i === pautas.length - 1} onClick={() => { const antes = pautas.map((x) => x.id); if (ordenarPautas) ordenarPautas(reordenar(antes, i, i + 1), antes); else estructura(() => api.moverPauta(sesion.id, p.id, 1)); }}><Icono n="abajo" /></button>
                    {duplicarPauta && <button class="btn btn-icono plano" aria-label={`Duplicar ${ejercicios[p.ejercicio_id]?.nombre || 'el ejercicio'}`} title="Duplicar: el mismo ejercicio otra vez, justo debajo" onClick={() => duplicarPauta(p)}><Icono n="duplicar" /></button>}
                    <button class="btn btn-icono plano btn-peligro" aria-label="Quitar ejercicio" onClick={() => (quitarPauta ? quitarPauta(p) : estructura(() => api.borrar('sesion_ejercicios', p.id)))}><Icono n="cerrar" /></button>
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sueltas.length > 0 && <p class="mini terciario">La letra {sueltas[0].superserie} solo está en un ejercicio (o no van seguidos): para una superserie, pon la misma letra a dos o más ejercicios seguidos.</p>}
      <button class="btn-texto" onClick={() => elegir(null)}><Icono n="mas" /> Añadir ejercicio</button>
      </>}
    </section>
  );
}

// Preparar las semanas siguientes (una o el mes de golpe): cada una sale de la anterior con su progresión.
// Enseña solo los controles de lo que tiene la semana (kg, RPE, RIR) y cómo quedaría un ejercicio de cada tipo.
// Cambiar el ejercicio por uno equivalente (sus alternativas de la biblioteca, normalmente el mismo movimiento con
// otro material) sin abrir la biblioteca entera. Solo en esta semana, como «Elegir ejercicio».
function Equivalentes({ ejercicio, lista, alCambiar }) {
  const eqs = useMemo(() => equivalentes(ejercicio, lista), [ejercicio, lista]);
  if (!ejercicio || !eqs.length) return null;
  return (
    <select class="equivalentes" aria-label={`Cambiar ${ejercicio.nombre} por un equivalente`} value=""
      onChange={(e) => { const ej = eqs.find((x) => x.id === e.currentTarget.value); if (ej) alCambiar(ej); }}>
      <option value="">Cambiar por equivalente…</option>
      {eqs.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
    </select>
  );
}

// La variante nombra un material que no es el del ejercicio (v0.30): se propone el ejercicio que cuadra, en todo el bloque
function AvisoVariante({ pauta, ejercicio, lista, corregir }) {
  const r = useMemo(() => revisarVariante(ejercicio, pauta.variante, lista), [ejercicio, pauta.variante, lista]);
  if (!r || !corregir) return null; // en un bloque cerrado no se avisa (no se le cambia la historia)
  return (
    <div class="aviso-variante" role="note">
      <span>{r.texto} Cada material es un ejercicio aparte (sus kilos no se mezclan).</span>
      <div class="aviso-variante-botones">
        {r.propuestas.map((e) => <button key={e.id} type="button" class="btn btn-peq" onClick={() => corregir(pauta, e)}>Cambiar a {e.nombre}</button>)}
        <button type="button" class="btn btn-peq btn-texto" onClick={() => corregir(pauta, null)}>Quitar la variante</button>
      </div>
    </div>
  );
}

function Duplicar({ semana, pautas = [], ejercicios = {}, fijos = new Set(), alCerrar, alHacer }) {
  const nFijos = new Set(pautas.filter((p) => fijos.has(p.ejercicio_id)).map((p) => p.ejercicio_id)).size;
  const conKg = pautas.filter((p) => p.carga_sugerida_kg != null);
  const [n, setN] = useState(1);
  const cuantos = (k) => `${k} ${k === 1 ? 'ejercicio' : 'ejercicios'}`;
  const [modoKg, setModoKg] = useState('salto');
  const [kgFijo, setKgFijo] = useState(2.5);
  // El esfuerzo solo cambia en lo que no sube de kilos
  const subeKg = (p) => p.carga_sugerida_kg != null && (modoKg === 'salto' || (modoKg === 'fijo' && !!kgFijo));
  const conRpe = pautas.filter((p) => p.rpe_objetivo != null && !subeKg(p));
  const conRir = pautas.filter((p) => p.rir_objetivo != null && !subeKg(p));
  const [rpe, setRpe] = useState(pautas.some((p) => p.rpe_objetivo != null && p.carga_sugerida_kg == null) ? 0.5 : 0);
  const [rir, setRir] = useState(0);
  const [reps, setReps] = useState(0);
  const [descarga, setDescarga] = useState(false);
  const opciones = { kg: modoKg === 'fijo' ? kgFijo : modoKg, rpe, rir, reps };
  // Cómo quedaría, semana a semana, un ejercicio con kg y uno con RPE (o RIR)
  const ejemplo = (p, texto) => {
    if (!p) return null;
    const nombre = ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio';
    const pasos = [];
    let x = p;
    for (let i = 1; i <= n; i++) { x = progresarPauta(x, opciones, { nombre, descarga: descarga && i === n }); pasos.push(texto(x)); }
    return <li key={p.id}><strong>{nombre}</strong>: {texto(p)} → {pasos.join(' → ')}{descarga ? ' (descarga)' : ''}</li>;
  };
  const kgTxt = (x) => `${num(x.carga_sugerida_kg, 2)} kg${x.rpe_objetivo != null ? ` @${num(x.rpe_objetivo)}` : x.rir_objetivo != null ? ` RIR ${num(x.rir_objetivo)}` : ''}`;
  const esfTxt = (x) => (x.rpe_objetivo != null ? `RPE ${num(x.rpe_objetivo)}` : `RIR ${num(x.rir_objetivo)}`);
  const conEsfuerzo = conRpe.find((p) => p.carga_sugerida_kg == null) || conRpe[0] || conRir.find((p) => p.carga_sugerida_kg == null) || conRir[0];
  return (
    <Hoja titulo={`Preparar desde la semana ${semana.numero}`} alCerrar={alCerrar}>
      <p class="secundario">Crea las semanas siguientes en borrador, cada una a partir de la anterior con estos cambios. Rellena las semanas vacías que vienen detrás (una que ya sea de descarga se prepara como descarga); si la siguiente ya tiene sesiones, se añaden al final del bloque.</p>
      <div class="campo"><span class="etq">Cuántas semanas</span><Segmentos etiqueta="Cuántas semanas" valor={n} alCambiar={(v) => v && setN(v)} opciones={[[1, '1'], [2, '2'], [3, '3 (el mes)'], [4, '4']]} /></div>
      {conKg.length > 0 && (
        <div class="campo"><span class="etq">Kilos ({cuantos(conKg.length)} con carga)</span>
          <Segmentos etiqueta="Kilos" valor={modoKg} alCambiar={(v) => v && setModoKg(v)} opciones={[['salto', 'Un salto por semana', '2,5 kg en barra, 2 kg en mancuernas, 2,5 o 5 kg en máquinas'], ['igual', 'Igual'], ['fijo', 'Otra cantidad']]} />
          {modoKg === 'fijo' && <Paso id="dup-kg" valor={kgFijo} paso={0.5} min={-20} max={20} dec={2} etiqueta="kilos a sumar cada semana" alCambiar={(v) => setKgFijo(v ?? 0)} />}
          <span class="ayuda">{modoKg === 'salto' ? 'El salto de cada ejercicio: 2,5 kg en barra, 2 kg en mancuernas, 2,5 o 5 kg en máquinas y poleas. Su RPE o RIR se queda igual.' : modoKg === 'fijo' ? 'Los mismos kilos en todos, cada semana. Su RPE o RIR se queda igual.' : 'Los kilos se quedan como están.'}</span></div>
      )}
      {conRpe.length > 0 && (
        <div class="campo"><span class="etq">RPE objetivo ({cuantos(conRpe.length)} a RPE)</span>
          <Segmentos etiqueta="RPE objetivo" valor={rpe} alCambiar={(v) => setRpe(v ?? 0)} opciones={[[0, 'Igual'], [0.5, '+0,5 por semana'], [1, '+1 por semana']]} />
          <span class="ayuda">Nunca pasa de 10.</span></div>
      )}
      {conRir.length > 0 && (
        <div class="campo"><span class="etq">RIR objetivo ({cuantos(conRir.length)} a RIR)</span>
          <Segmentos etiqueta="RIR" valor={rir} alCambiar={(v) => setRir(v ?? 0)} opciones={[[-1, '−1 (más duro)'], [0, 'Igual'], [1, '+1 (más suave)']]} /></div>
      )}
      <div class="campo"><span class="etq">Repeticiones</span><Segmentos etiqueta="Repeticiones" valor={reps} alCambiar={(v) => setReps(v ?? 0)} opciones={[[-2, '−2'], [-1, '−1'], [0, 'Igual'], [1, '+1'], [2, '+2']]} /></div>
      <label class="casilla"><input type="checkbox" checked={descarga} onChange={(e) => setDescarga(e.currentTarget.checked)} />
        <span>{n === 1 ? 'Que sea de descarga' : `La última (la ${n}.ª), de descarga`}<br /><span class="peq terciario">Sobre la semana anterior: un 10 % menos de kilos, una serie menos por ejercicio, RPE objetivo 1 punto menos y RIR 1 más. Las repeticiones, igual.</span></span></label>
      {(conKg.length > 0 || conEsfuerzo) && (
        <div class="pila-xs">
          <span class="peq">Así quedaría</span>
          <ul class="lista-ejemplo peq secundario">{ejemplo(conKg[0], kgTxt)}{conEsfuerzo && conEsfuerzo !== conKg[0] && ejemplo(conEsfuerzo, esfTxt)}</ul>
        </div>
      )}
      {nFijos > 0 && <p class="mini terciario"><Icono n="candado" width="14" height="14" /> {nFijos === 1 ? '1 ejercicio con candado pasa' : `${nFijos} ejercicios con candado pasan`} tal cual, sin estos cambios.</p>}
      <button class="btn btn-primario btn-grande" onClick={() => alHacer({ n, ...opciones, descargaUltima: descarga })}><Icono n="duplicar" /> {n === 1 ? 'Preparar la semana siguiente' : `Preparar ${n} semanas`}</button>
    </Hoja>
  );
}

export function ElegirEjercicio({ biblioteca, alCerrar, alElegir, evitados = {}, varios = false, alElegirVarios = null, conOrden = false, usos = {} }) {
  const { api, aviso } = useApp();
  const [marcados, setMarcados] = useState([]); // (v0.184) varios de una vez: los marcados, en el orden en que se marcan
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState(null);
  const [creando, setCreando] = useState(false);
  // (v0.185) en el editor: arriba los últimos que has puesto (se recuerdan en este dispositivo) y los que ya salen en el bloque
  const [recientes] = useState(() => { if (!conOrden) return []; try { return JSON.parse(localStorage.getItem('fbe-editor-recientes') || '[]'); } catch { return []; } });
  const recordar = (lista) => { if (!conOrden) return; try { localStorage.setItem('fbe-editor-recientes', JSON.stringify(lista.reduceRight((r, e) => conReciente(r, e.id), recientes))); } catch { /* sin almacenamiento */ } };
  const filtrada = (biblioteca.datos || []).filter((e) => e.activo !== false)
    .filter((e) => !grupo || e.grupos_musculares?.[0] === grupo || (grupo && e.grupos_musculares?.includes(grupo)))
    .filter((e) => !q || normal(e.nombre).includes(normal(q)));
  const ordenada = conOrden ? ordenBuscador(filtrada, { recientes, usos }) : filtrada.map((e) => ({ ejercicio: e, marca: null }));
  const marcaDe = Object.fromEntries(ordenada.map((x) => [x.ejercicio.id, x.marca]));
  const lista = ordenada.map((x) => x.ejercicio);
  return (
    <Hoja titulo="Elegir ejercicio" alCerrar={alCerrar} ancho={640}>
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" aria-label="Buscar ejercicio" placeholder="Buscar en tu biblioteca" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
      <div class="selector-chips" role="group" aria-label="Grupo muscular">
        <button aria-pressed={!grupo ? 'true' : 'false'} onClick={() => setGrupo(null)}>Todos</button>
        {GRUPOS.map(([g, n]) => <button key={g} aria-pressed={grupo === g ? 'true' : 'false'} onClick={() => setGrupo(g)}>{n}</button>)}
      </div>
      {biblioteca.cargando ? <Cargando /> : (
        <div class="lista-elegir">
          {lista.slice(0, 80).map((e) => (
            <div key={e.id} class={`elegir-fila ${marcados.some((x) => x.id === e.id) ? 'marcado' : ''}`}>
            {varios && alElegirVarios && <input type="checkbox" class="elegir-marca" aria-label={`Marcar ${e.nombre} para añadir varios`} checked={marcados.some((x) => x.id === e.id)}
              onChange={() => setMarcados((m) => (m.some((x) => x.id === e.id) ? m.filter((x) => x.id !== e.id) : m.length >= 20 ? m : [...m, e]))} />}
            <button data-g={(e.grupos_musculares || [])[0] || undefined} onClick={() => { recordar([e]); alElegir(e); }}>
              <span style="font-weight:600">{e.nombre}{marcaDe[e.id] && <span class="mini marca-buscador">{marcaDe[e.id] === 'reciente' ? 'reciente' : 'en este bloque'}</span>}</span>
              <span class="mini terciario">{(e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ') || 'Sin grupo'}{(e.tipo || []).includes('basico') ? '; básico' : ''}{e.rango_reps ? `; ${e.rango_reps.toLowerCase()}` : ''}{e.video_url ? '; con vídeo' : ''}</span>
              {evitados[e.id] && <span class="mini aviso-evitado"><Icono n="alerta" />Lo prefiere evitar ({textoMotivo(evitados[e.id]).toLowerCase()})</span>}
            </button>
            </div>
          ))}
          {!lista.length && <div class="panel-pad secundario">Ningún ejercicio coincide.</div>}
        </div>
      )}
      {varios && alElegirVarios && (marcados.length > 0
        ? <div class="elegir-varios"><span class="peq">{marcados.map((x) => x.nombre).join(' · ')}</span>
          <button class="btn btn-primario" onClick={() => { recordar(marcados); alElegirVarios(marcados); }}><Icono n="mas" /> Añadir {marcados.length} {marcados.length === 1 ? 'ejercicio' : 'ejercicios'}</button></div>
        : <p class="mini terciario">Toca un ejercicio para añadirlo, o marca varias casillas para añadirlos de una vez.</p>)}
      {q.trim() && !creando && <button class="btn-texto" onClick={() => setCreando(true)}><Icono n="mas" /> Crear «{q.trim()}» en la biblioteca</button>}
      {creando && (
        <div class="nota pila-s">
          <span>Grupo principal de «{q.trim()}»:</span>
          <div class="selector-chips">{GRUPOS.map(([g, n]) => (
            <button key={g} onClick={async () => {
              try { const e = await api.crear('ejercicios', { nombre: q.trim(), grupos_musculares: [g] }); biblioteca.recargar(true); recordar([e]); alElegir(e); }
              catch (err) { aviso(err.message, 'error'); }
            }}>{n}</button>
          ))}</div>
        </div>
      )}
    </Hoja>
  );
}
