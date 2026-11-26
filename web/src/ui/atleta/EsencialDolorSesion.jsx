// FBE Esencial (v0.257, P: 'molestias_zona'): el motor de molestias en la sesión y en Hoy, con la tabla de zonas de cada
// ejercicio (M8; logica/zonas-ejercicio.js y logica/dolor-sesion.js). Reglas de Pelayo del 26/11/2026 («claude/motores-
// siguientes-reglas.md»): con una molestia abierta, antes de cada sesión que carga esa zona, «¿Cómo está ahora?» (M3);
// durante, tras la primera serie de lo que la carga, la regla con lo que apunte (M4); al terminar, «¿Cómo ha quedado?»; a
// la mañana siguiente, «¿Cómo ha amanecido?» (M3) y, si está peor que antes de entrenar, la siguiente sesión que la carga
// va con una serie menos y un 10 % menos en esos ejercicios, ya puesto (M5); en rojo, lo que la carga mucho pasa a su
// alternativa que menos la carga, ya puesta y con «Volver al de tu plan» (M7); y a los 3 y 7 días, «¿Cómo va?» (M12).
// Solo para quien va por su cuenta, con la 109 y su consentimiento de salud (sin ella, nada). Estilos: dolor.css (dse-*).
import { useState, useEffect } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { Arte } from './EsencialArte.jsx';
import { useDolor } from './dolor-datos.js';
import { perezoso } from '../perezoso.jsx';
import * as D from '../../logica/dolor.js';
import * as S from '../../logica/dolor-sesion.js';
import { MOLESTIA_SIGUE } from '../../logica/esencial-vida.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { hoyISO, sumarDias } from '../../logica/fechas.js';

// (la escala y la leyenda, del trozo de «Me duele algo», perezosas: importarlas tal cual las sacaría a un trozo compartido
// y sus estilos irían al común)
const EscalaDolor = perezoso(() => import('./EsencialDolor.jsx'), 'EscalaDolor', { mientras: null });
const Leyenda = perezoso(() => import('./EsencialDolor.jsx'), 'Leyenda', { mientras: null });

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
// (en este móvil no se guarda ni la zona ni cuánto duele: lo de esta sesión sale de la base y de lo que tiene en pantalla;
// solo se guarda que ya se puso la alternativa en rojo, para no volver a ponerla si la quita)
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
// lo último que apuntó en esta sesión para esa zona y ese momento (de la base)
const deSesion = (registros, sesionId, zona, momento) => {
  const xs = (registros || []).filter((r) => r.sesion_id === sesionId && r.zona === zona && r.momento === momento);
  return xs.length ? Number(xs[xs.length - 1].valor) : null;
};
const may = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const d10 = (x) => String(x || '').slice(0, 10);
// La regla con su color (cada clase escrita entera en su class: así el reparto de estilos por trozos sabe con qué otras va)
function ReglaCaja({ regla }) {
  if (!regla) return null;
  const t = <span class="peq"><strong>{regla.titulo}.</strong> {regla.texto}</span>;
  if (regla.nivel === 'sigue') return <div class="dse-regla dse-regla-sigue" role="status">{t}</div>;
  if (regla.nivel === 'igual') return <div class="dse-regla dse-regla-igual" role="status">{t}</div>;
  return <div class="dse-regla dse-regla-baja" role="status">{t}</div>;
}

// Las pautas de la sesión, en la forma del motor: [{ id, ejercicio_id, … }] y { id: ejercicio }
function enMotor(pautas = []) {
  const ps = (pautas || []).map((e) => ({ id: e.id, ejercicio_id: e.ejercicio?.id || e.ejercicio_id, series: e.series, carga_sugerida_kg: e.carga_sugerida_kg, series_detalle: e.series_detalle ?? null, nombre: e.ejercicio?.nombre }));
  const ejs = Object.fromEntries((pautas || []).filter((e) => e.ejercicio?.id).map((e) => [e.ejercicio.id, e.ejercicio]));
  return { ps, ejs };
}
// Apuntar una lectura; devuelve un texto de error o null
async function apuntar(backend, lectura) {
  try {
    const A = await import('../../datos/api-dolor.js');
    const r = await A.apuntarDolor(backend, lectura);
    if (r?.falta109) return 'Para guardarlo falta una actualización en la base: dísela a Pelayo.';
    return null;
  } catch (e) {
    return /consentimiento/.test(e?.message || '') ? 'Para guardarlo hace falta tu consentimiento de datos de salud (en Perfil).' : e?.message || 'No se ha podido guardar.';
  }
}

// ---------- En la sesión: lo de antes de empezar, el ajuste de la mañana siguiente y el rojo ----------
// pautas: las de la sesión (sin ajustar); ejerciciosPorId: los suyos y sus alternativas; alEstado({ ajustes, zonas, antes })
// le dice a la sesión qué pautas ajustar (M5), tras qué ejercicios preguntar durante (M4) y cómo estaba cada zona al
// empezar; alCambiarVarios({ pauta: id | null }, ejercicios) pone o quita su alternativa (M7)
export function DolorEnSesion({ sesion, semana = null, pautas = [], ejerciciosPorId = {}, sustitutos = {}, hechas = {}, alEstado, alCambiarVarios }) {
  const previa = usePrevia();
  const { api, backend, aviso } = useApp();
  const on = encendido('molestias_zona', previa);
  const d = useDolor(0);
  const hoy = hoyISO();
  const { ps, ejs } = enMotor(pautas);
  const conTodos = { ...ejerciciosPorId, ...ejs };
  // (lo que apunte en esta sesión no cambia qué zonas carga: el estado sale de lo de antes)
  const registros = (d.datos?.registros || []).filter((r) => r.sesion_id !== sesion?.id);
  const estado = on && d.datos?.hay ? D.estadoZonas({ registros, checkins: d.datos.checkins || [], hoy }) : [];
  const zonas = S.zonasDeLaSesion({ pautas: ps, ejercicios: ejs, estado });
  const rojo = S.rojoEnSesion({ pautas: ps, ejercicios: conTodos, estado });
  // (M5) el ajuste solo se mira si hay una mañana peor reciente: entonces hacen falta sus sesiones hechas del bloque
  const hayManana = registros.some((r) => r.momento === 'manana' && r.sesion_id && d10(r.fecha) >= sumarDias(hoy, -14));
  const bloque = useCarga(async () => {
    if (!on || !hayManana || !semana?.bloque_id) return null;
    const b = await api.bloqueCompleto(semana.bloque_id);
    const sesiones = Object.values(b.sesiones || {}).flat().filter((s) => s.completada && s.fecha_realizada);
    const ids = [...new Set(sesiones.flatMap((s) => (b.pautas?.[s.id] || []).map((p) => p.ejercicio_id)))].filter((id) => !conTodos[id]);
    const mas = ids.length ? await api.ejerciciosPorIds(ids).catch(() => []) : [];
    return { hechas: sesiones.map((s) => ({ id: s.id, fecha: d10(s.fecha_realizada), pautas: b.pautas?.[s.id] || [] })), ejercicios: Object.fromEntries((mas || []).map((e) => [e.id, e])) };
  }, [on, hayManana, semana?.bloque_id]);
  const ajustes = bloque.datos ? S.ajusteManana({ registros, checkins: d.datos?.checkins || [], hechas: bloque.datos.hechas, sesion: { id: sesion.id, pautas: ps }, ejercicios: { ...conTodos, ...bloque.datos.ejercicios }, hoy }) : [];
  const [dichos, setDichos] = useState({});   // lo que apunta ahora (antes de que vuelva a leerse la base)
  const todos = d.datos?.registros || [];
  const antes = Object.fromEntries(zonas.map((z) => [z.zona, dichos[z.zona] ?? deSesion(todos, sesion?.id, z.zona, 'antes')]).filter(([, v]) => v != null));
  const [error, setError] = useState(null);

  // A la sesión: qué pautas van ajustadas (M5) y tras cuáles se pregunta durante (M4)
  const parches = {};
  for (const a of ajustes) for (const pid of a.pautas) { const p = ps.find((x) => x.id === pid); if (p && !parches[pid]) { const c = S.conAjuste(p); parches[pid] = { series: c.series, carga_sugerida_kg: c.carga_sugerida_kg, series_detalle: c.series_detalle }; } }
  const porPauta = {};
  for (const z of zonas) for (const pid of z.pautas) porPauta[pid] ||= z.zona;
  const clave = JSON.stringify([parches, porPauta, antes]);
  useEffect(() => { if (on) alEstado?.({ ajustes: parches, zonas: porPauta, antes }); }, [clave, on]);

  // (M7) En rojo, lo que la carga mucho pasa a su alternativa una vez por sesión (si no lo ha cambiado él ni lo ha empezado)
  const kRojo = `fbe-dolor-rojo:${sesion?.id}`;
  const claveRojo = rojo.map((x) => `${x.pauta_id}:${x.alternativa?.id || ''}`).join();
  useEffect(() => {
    if (!on || !rojo.length || leer(kRojo)) return;
    const mapa = {}, nuevos = [];
    for (const x of rojo) {
      if (!x.alternativa || sustitutos?.[x.pauta_id] || Object.keys(hechas?.[x.pauta_id] || {}).length) continue;
      mapa[x.pauta_id] = x.alternativa.id; nuevos.push(x.alternativa);
    }
    guardar(kRojo, '1');
    if (!Object.keys(mapa).length) return;
    alCambiarVarios?.(mapa, nuevos);
    aviso(`Por ${S.tuZona(rojo[0].zona)} en rojo, hoy cambias ${unir(rojo.filter((x) => mapa[x.pauta_id]).map((x) => x.nombre.toLowerCase()))} por su alternativa`);
  }, [claveRojo, on]);

  if (!on || !d.datos?.hay || (!zonas.length && !rojo.length && !ajustes.length)) return null;
  const elegir = async (zona, n) => {
    setDichos((x) => ({ ...x, [zona]: n }));
    setError(await apuntar(backend, { zona, valor: n, momento: 'antes', sesion_id: sesion.id }));
  };
  return (
    <section class="panel panel-pad pila-s dse-sesion" aria-labelledby="dse-sesion-t">
      <Arte id="esencial-dolor-momentos" />
      <strong id="dse-sesion-t">{zonas.length === 1 ? `Hoy cargas ${S.tuZona(zonas[0].zona)}` : zonas.length ? 'Hoy cargas tus molestias' : 'Tu molestia, hoy'}</strong>
      {zonas.map((z) => (
        <div class="dse-zona" key={z.zona}>
          <span class="peq">{`${may(S.tuZona(z.zona))} está en ${D.NOMBRE_SEMAFORO[z.semaforo].toLowerCase()} (${z.valor} de 10). Hoy la cargan: ${unir(z.nombres.map((n) => n.toLowerCase()))}.`}</span>
          <span class="peq secundario" id={`dse-antes-${z.zona}`}>¿Cómo está ahora, antes de empezar?</span>
          <EscalaDolor etiqueta={`${may(S.tuZona(z.zona))} antes de empezar, de 0 a 10`} valor={antes[z.zona] ?? null} alCambiar={(n) => elegir(z.zona, n)} />
          {antes[z.zona] != null && <span class="mini secundario" role="status">Apuntado. Te pregunto también tras la primera serie de lo que la carga, al terminar y mañana por la mañana.</span>}
        </div>
      ))}
      {zonas.length > 0 && <><Leyenda /><p class="mini terciario">{D.REGLA}</p></>}
      {ajustes.map((a) => (
        <div class="dse-ajuste" role="note" key={'ajuste' + a.zona}><Icono n="info" width="18" height="18" />
          <span class="peq">{`Tras tu última sesión, a la mañana siguiente ${S.tuZona(a.zona)} estaba peor que antes de entrenar (${a.manana} frente a ${a.antes}): hoy, en ${unir(a.nombres.map((n) => n.toLowerCase()))}, una serie menos y un 10 % menos de peso. Ya está puesto.`}</span>
        </div>
      ))}
      {rojo.length > 0 && (
        <div class="dse-rojo pila-xs">
          <strong class="peq">{`Con ${S.tuZona(rojo[0].zona)} en rojo`}</strong>
          <ul class="lista-puntos dse-lista">
            {rojo.map((x) => {
              const puesta = x.alternativa && sustitutos?.[x.pauta_id] === x.alternativa.id;
              return (
                <li key={x.pauta_id} class="peq">
                  {x.alternativa
                    ? <>{puesta ? `${x.nombre}: hoy, ${x.alternativa.nombre.toLowerCase()}, que la carga menos. Empieza ligero.` : `${x.nombre}: su alternativa que menos la carga es ${x.alternativa.nombre.toLowerCase()}.`}{' '}
                      <button type="button" class="btn-texto mini" onClick={() => alCambiarVarios?.({ [x.pauta_id]: puesta ? null : x.alternativa.id }, puesta ? [] : [x.alternativa])}>{puesta ? 'Volver al de tu plan' : 'Ponerla'}</button></>
                    : `${x.nombre}: ninguna de sus alternativas la carga menos. Hoy, sin subir; si pasa de 4, déjalo.`}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {error && <p class="peq error" role="alert">{error}</p>}
    </section>
  );
}

// ---------- Durante: tras la primera serie de un ejercicio que carga esa zona (M4) ----------
// inicio: cómo estaba esa zona al empezar la sesión (lo que apuntó antes; sin eso, no se mira si va subiendo)
export function DolorDurante({ zona, sesionId, pautaId, inicio = null }) {
  const { backend } = useApp();
  const [v, setV] = useState(null);
  const [error, setError] = useState(null);
  const regla = v != null ? S.reglaDurante({ valor: v, inicio, zona }) : null;
  const elegir = async (n) => {
    setV(n);
    setError(await apuntar(backend, { zona, valor: n, momento: 'durante', sesion_id: sesionId }));
  };
  return (
    <div class="dse-durante pila-xs" role="group" aria-labelledby={`dse-dur-${pautaId}`}>
      <span class="peq" id={`dse-dur-${pautaId}`}>{`¿Cómo va ${S.tuZona(zona)} con este ejercicio?`}</span>
      <EscalaDolor etiqueta={`${may(S.tuZona(zona))} con este ejercicio, de 0 a 10`} valor={v} alCambiar={elegir} />
      <ReglaCaja regla={regla} />
      {error && <p class="mini error" role="alert">{error}</p>}
    </div>
  );
}

// ---------- Al terminar: «¿Cómo ha quedado?» ----------
export function DolorDespues({ sesion, pautas = [] }) {
  const previa = usePrevia();
  const { backend } = useApp();
  const on = encendido('molestias_zona', previa);
  const d = useDolor(0);
  const hoy = hoyISO();
  const { ps, ejs } = enMotor(pautas);
  const registros = (d.datos?.registros || []).filter((r) => r.sesion_id !== sesion?.id);
  const estado = on && d.datos?.hay ? D.estadoZonas({ registros, checkins: d.datos.checkins || [], hoy }) : [];
  const zonas = S.zonasDeLaSesion({ pautas: ps, ejercicios: ejs, estado });
  const [dichos, setDichos] = useState({});
  const [error, setError] = useState(null);
  const todos = d.datos?.registros || [];
  if (!on || !d.datos?.hay || !zonas.length) return null;
  const elegir = async (zona, n) => {
    setDichos((x) => ({ ...x, [zona]: n }));
    setError(await apuntar(backend, { zona, valor: n, momento: 'despues', sesion_id: sesion.id }));
  };
  return (
    <section class="panel panel-pad pila-s dse-despues" aria-labelledby="dse-despues-t">
      <Arte id="esencial-dolor-escala" />
      <strong id="dse-despues-t">{zonas.length === 1 ? `¿Cómo ha quedado ${S.tuZona(zonas[0].zona)}?` : '¿Cómo han quedado tus molestias?'}</strong>
      {zonas.map((z) => {
        const v = dichos[z.zona] ?? deSesion(todos, sesion.id, z.zona, 'despues');
        const r = v != null ? S.reglaDurante({ valor: v, inicio: deSesion(todos, sesion.id, z.zona, 'antes'), zona: z.zona }) : null;
        return (
          <div class="dse-zona" key={z.zona}>
            {zonas.length > 1 && <span class="peq"><strong>{z.nombre}</strong></span>}
            <EscalaDolor etiqueta={`${may(S.tuZona(z.zona))} al terminar, de 0 a 10`} valor={v ?? null} alCambiar={(n) => elegir(z.zona, n)} />
            {r && <p class="peq secundario" role="status">{r.nivel === 'sigue'
              ? 'Bien: dentro del margen (hasta 3 y sin ir a más). Mañana por la mañana te pregunto cómo amanece.'
              : 'Por encima del margen: la app lo tiene en cuenta en tu semana (lo que carga esta zona no sube). Mañana por la mañana te pregunto cómo amanece y, si está peor que antes de entrenar, tu siguiente sesión irá más suave en esos ejercicios.'}</p>}
          </div>
        );
      })}
      {error && <p class="peq error" role="alert">{error}</p>}
    </section>
  );
}

// ---------- En Hoy: la mañana siguiente (M3 y M5) y el seguimiento a los 3 y 7 días (M12) ----------
const tocaSeguimiento = (z, registros, hoy) => {
  if (!z?.abierta || !z.desde || z.zona === 'otra') return null;
  const dias = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${d10(z.desde)}T12:00:00Z`)) / 864e5);
  const desde = (n) => sumarDias(d10(z.desde), n);
  const hecho = (n) => registros.some((r) => r.zona === z.zona && r.momento === 'seguimiento' && d10(r.fecha) >= desde(n));
  if (dias >= 7 && dias <= 13 && !hecho(7)) return 7;
  if (dias >= 3 && dias <= 6 && !hecho(3)) return 3;
  return null;
};
export function DolorEnHoy() {
  const previa = usePrevia();
  const { api, backend, atleta } = useApp();
  const on = encendido('molestias_zona', previa);
  const [vuelta, setVuelta] = useState(0);
  const d = useDolor(vuelta);
  const hoy = hoyISO();
  const registros = d.datos?.registros || [];
  const estado = on && d.datos?.hay ? D.estadoZonas({ registros, checkins: d.datos.checkins || [], hoy }) : [];
  const hayAbiertas = S.abiertas(estado).length > 0;
  // la sesión que hizo ayer (si la hay), con sus ejercicios
  const ayer = useCarga(async () => {
    if (!on || !hayAbiertas) return null;
    const p = await api.programa(atleta.id);
    const s = Object.values(p.sesiones || {}).flat().find((x) => x.completada && d10(x.fecha_realizada) === sumarDias(hoy, -1));
    if (!s) return null;
    const det = await api.sesion(s.id, atleta.id);
    return { id: s.id, fecha: d10(s.fecha_realizada), pautas: det?.ejercicios || [] };
  }, [on, hayAbiertas, atleta.id, hoy]);
  const [respuesta, setRespuesta] = useState(null);   // { tipo: 'manana' | 'seguimiento', zona, valor, texto }
  const [error, setError] = useState(null);
  if (!on || !d.datos?.hay) return null;
  const { ps, ejs } = enMotor(ayer.datos?.pautas || []);
  const manana = ayer.datos ? S.preguntaManana({ sesion: { id: ayer.datos.id, fecha: ayer.datos.fecha, pautas: ps }, ejercicios: ejs, estado, registros, checkins: d.datos.checkins || [], hoy }) : [];
  const seg = !manana.length ? estado.map((z) => ({ z, dia: tocaSeguimiento(z, registros, hoy) })).find((x) => x.dia) || null : null;
  if (!respuesta && !manana.length && !seg) return null;
  const m = manana[0];
  const elegirManana = async (n) => {
    const peor = S.peorQueAntes({ antes: m.antes, manana: n });
    const err = await apuntar(backend, { zona: m.zona, valor: n, momento: 'manana', sesion_id: m.sesionId });
    setError(err);
    if (err) return;
    setRespuesta({ tipo: 'manana', zona: m.zona, valor: n, texto: peor
      ? `Está peor que antes de entrenar (${n} frente a ${m.antes}): tu próxima sesión que carga ${S.tuZona(m.zona)} irá con una serie menos y un 10 % menos de peso en esos ejercicios. Ya lo pone la app.`
      : `Bien: ${m.antes != null ? 'como antes de entrenar, o mejor' : 'apuntado'}. Sigue con tu plan.` });
    setVuelta((x) => x + 1);
  };
  const elegirSeguimiento = async (n) => {
    const z = seg.z;
    const id = n < D.MARGEN || n <= z.valor - S.USO.peor ? 'mejor' : n >= z.valor + S.USO.peor ? 'peor' : 'igual';
    const err = await apuntar(backend, { zona: z.zona, valor: n, momento: 'seguimiento' });
    setError(err);
    if (err) return;
    setRespuesta({ tipo: 'seguimiento', zona: z.zona, valor: n, texto: (MOLESTIA_SIGUE.find((x) => x[0] === id) || MOLESTIA_SIGUE[1])[2] });
    setVuelta((x) => x + 1);
  };
  return (
    <section class="panel panel-pad pila-s dse-hoy" aria-labelledby="dse-hoy-t">
      <Arte id="esencial-semaforo-dolor" />
      {respuesta ? (
        <>
          <strong id="dse-hoy-t">{respuesta.tipo === 'manana' ? `${may(S.tuZona(respuesta.zona))}, esta mañana: ${respuesta.valor} de 10` : `${may(S.tuZona(respuesta.zona))}: ${respuesta.valor} de 10`}</strong>
          <p class="peq" role="status">{respuesta.texto}</p>
          <button type="button" class="btn btn-peq dse-vale" onClick={() => setRespuesta(null)}>Vale</button>
        </>
      ) : m ? (
        <>
          <strong id="dse-hoy-t">{`¿Cómo ha amanecido ${S.tuZona(m.zona)}?`}</strong>
          <span class="peq secundario">{`Ayer entrenaste y la cargaste${m.antes != null ? `; antes de empezar estaba en ${m.antes}` : ''}. De 0 a 10, ahora:`}</span>
          <EscalaDolor etiqueta={`${may(S.tuZona(m.zona))} esta mañana, de 0 a 10`} valor={null} alCambiar={elegirManana} />
          <Leyenda />
        </>
      ) : (
        <>
          <strong id="dse-hoy-t">{`¿Cómo va ${S.tuZona(seg.z.zona)}?`}</strong>
          <span class="peq secundario">{`Hace ${seg.dia} días que la apuntaste en ${D.NOMBRE_SEMAFORO[seg.z.semaforo].toLowerCase()} (la última vez, ${seg.z.valor} de 10). De 0 a 10, hoy:`}</span>
          <EscalaDolor etiqueta={`${may(S.tuZona(seg.z.zona))} hoy, de 0 a 10`} valor={null} alCambiar={elegirSeguimiento} />
          <Leyenda />
        </>
      )}
      {error && <p class="peq error" role="alert">{error}</p>}
    </section>
  );
}
