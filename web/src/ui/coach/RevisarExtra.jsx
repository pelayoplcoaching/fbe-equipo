// (v0.195) Piezas de la pestaña «Revisar»: la sesión serie a serie, sus récords, el check-in frente al anterior, lo que
// le dijiste la última vez de ese ejercicio, la nota de voz desde la tarjeta, tus frases y lo revisado hoy.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez, cuando, Avatar } from '../comunes.jsx';
import { lineasCheckin, pautadoFrenteAHecho, ajustesDeRevision } from '../../logica/revision.js';
import { cambiosCheckin, NOMBRE_REVISADO, volumenTarjeta, coincideNombre } from '../../logica/revisar.js';
import { rangoVolumen, NOMBRE_GRUPO, textoSerie, num } from '../../logica/calculos.js';
import { CompararVideos } from '../Archivos.jsx';
import { useGrabadora, PanelGrabando, PanelRevisar, AyudaMicro, ActivarMicro } from '../chat/NotaVoz.jsx';

const leer = (clave, defecto) => { try { const x = JSON.parse(localStorage.getItem(clave) || 'null'); return x ?? defecto; } catch { return defecto; } };
const nuevoId = (p) => globalThis.crypto?.randomUUID?.() || `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const TEXTO_VISTO = 'Visto 💪';

// Tus frases: las de la revisión semanal (de la base con la 082, o las de este aparato); si aún no tienes, unas de partida
export const FRASES_PARTIDA = ['¡Buen trabajo, {nombre}!', 'Muy bien, seguimos así', 'Perfecto, la semana que viene subimos un poco', 'Cuéntame cómo te notas en la siguiente'];
// (v0.196) también las de verdad (sin las de partida) y cómo cambiarlas (en la base con la 082 y en este aparato)
export function useFrasesRevisar() {
  const { api, aviso } = useApp();
  const r = useCarga(() => (api.revisionAjustes ? api.revisionAjustes().catch(() => undefined) : Promise.resolve(undefined)), []);
  const [propias, setPropias] = useState(null);
  const a = ajustesDeRevision(r.datos || null, { frases: leer('fbe-revision-frases', []) });
  const generales = propias || a.frases;
  const guardar = async (lista) => {
    setPropias(lista);
    try { localStorage.setItem('fbe-revision-frases', JSON.stringify(lista)); } catch { /* sin sitio */ }
    if (r.datos !== undefined && api.guardarRevisionAjustes) {
      try { await api.guardarRevisionAjustes({ ...a, frases: lista }); } catch (e) { aviso(e.message, 'error'); }
    }
  };
  return { frases: generales.length ? generales : FRASES_PARTIDA, generales, guardar };
}

// La sesión, ejercicio a ejercicio: lo pautado frente a lo hecho (kilos x repeticiones y, entre paréntesis, el RPE)
// (v0.197) con lo que hizo la vez anterior, ajustar la carga de su próxima sesión en un toque y su volumen de la semana
export function DetalleSesion({ s, m = null }) {
  const { api, aviso } = useApp();
  const d = useCarga(() => api.sesion(s.id, s.atleta.id), [s.id]);
  const [ocupado, una] = useUnaVez();
  const [ajustes, setAjustes] = useState({});
  if (d.cargando && !d.datos) return <p class="peq secundario" role="status">Cargando la sesión...</p>;
  if (d.error) return <p class="peq">No se ha podido cargar la sesión.</p>;
  const ejs = d.datos?.ejercicios || [];
  const filas = pautadoFrenteAHecho(ejs);
  if (!filas.length) return <p class="peq secundario">Sin ejercicios pautados.</p>;
  const ajustar = (p, delta) => una(async () => {
    try {
      const r = await api.ajustarProxima(s.atleta.id, p.ejercicio_id, delta);
      if (!r) { aviso(`No tiene ${p.ejercicio?.nombre || 'ese ejercicio'} en ninguna sesión por delante`); return; }
      setAjustes((x) => ({ ...x, [p.id]: r }));
      aviso(`${p.ejercicio?.nombre || 'Ejercicio'}: ${num(r.antes)} → ${num(r.despues)} kg en «${r.sesion}»${r.semana ? ` (semana ${r.semana})` : ''}`, 'ok');
    } catch (e) { aviso(e.message, 'error'); }
  });
  const vol = m?.volumen ? volumenTarjeta(m.volumen, (g) => rangoVolumen(s.atleta.volumen_objetivo, g)) : [];
  return (
    <div class="pila-s">
      <div class="rev-tabla-env revisar-detalle">
        <table class="rev-tabla">
          <caption class="sr">{s.nombre}: pautado frente a hecho y la vez anterior</caption>
          <thead><tr><th scope="col">Ejercicio</th><th scope="col">Pautado</th><th scope="col">Hecho</th><th scope="col">La vez anterior</th><th scope="col">Su próxima</th></tr></thead>
          <tbody>{filas.map((f, i) => {
            const p = ejs[i];
            const antes = (p?.ultimas?.series || []).filter((x) => Number(x.reps) > 0).map(textoSerie).join(', ');
            const conKilos = (p?.hechas || []).some((x) => Number(x.kg) > 0);
            const aj = ajustes[f.id];
            return (
              <tr key={f.id} class={f.falta > 0 ? 'corta' : ''}>
                <th scope="row">{f.nombre}</th><td class="num">{f.pautado}</td>
                <td class="num">{f.hecho}{f.falta > 0 && f.hecho !== 'Sin hacer' ? ` (faltan ${f.falta})` : ''}</td>
                <td class="num">{antes || '—'}</td>
                <td class="revisar-proxima">{conKilos ? (
                  <span class="fila-envolver">
                    <button type="button" class="btn btn-peq" disabled={ocupado} aria-label={`Bajar 2,5 kg a ${f.nombre} en su próxima sesión`} onClick={() => ajustar(p, -2.5)}>−2,5</button>
                    <button type="button" class="btn btn-peq" disabled={ocupado} aria-label={`Subir 2,5 kg a ${f.nombre} en su próxima sesión`} onClick={() => ajustar(p, 2.5)}>+2,5</button>
                    {aj && <span class="mini secundario num">{num(aj.despues)} kg</span>}
                  </span>
                ) : <span class="mini terciario">—</span>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {vol.length > 0 && (
        <div class="pila-xs revisar-volumen">
          <span class="mini secundario">Su semana por músculo (series):</span>
          <div class="fila-envolver">{vol.map((v) => <span key={v.grupo} class={`chip num vol-${v.estado}`}>{NOMBRE_GRUPO[v.grupo] || v.grupo} {num(v.n)} de {v.min}–{v.max}<span class="sr">, {v.estado === 'dentro' ? 'dentro de su rango' : v.estado === 'bajo' ? 'por debajo' : 'por encima'}</span></span>)}</div>
        </div>
      )}
    </div>
  );
}

// Récords de la sesión y lo que bajó frente a la última vez
export function MarcasSesion({ m }) {
  if (!m || (!m.records.length && !m.bajas.length)) return null;
  return (
    <div class="fila-envolver revisar-marcas">
      {m.records.map((r) => <span key={`r-${r.ejercicio_id}`} class="chip morado revisar-record"><Icono n="trofeo" />Récord en {r.ejercicio}: {r.marca}</span>)}
      {m.bajas.map((r) => <span key={`b-${r.ejercicio_id}`} class="chip aviso">Menos que la última vez en {r.ejercicio}: {r.marca} (antes {r.antes})</span>)}
    </div>
  );
}

// Lo que cambió en el check-in frente al anterior
export function CambiosCheckin({ c }) {
  if (!c?.anterior) return null;
  const xs = cambiosCheckin(lineasCheckin(c, c.anterior));
  if (!xs.length) return <p class="mini terciario revisar-cambios">Igual que en su check-in anterior.</p>;
  return (
    <p class="mini secundario revisar-cambios">
      <span>Frente al anterior: </span>
      {xs.map((l, i) => (
        <span key={l.clave} class={`revisar-cambio ${l.cambio || ''}`}>{i ? ', ' : ''}{l.etiqueta} {l.valor}
          {l.cambio && <span aria-hidden="true"> {l.cambio === 'sube' ? '↑' : '↓'}</span>}
          <span class="terciario"> (antes {l.antes})</span>{l.cambio && <span class="sr">, {l.cambio === 'sube' ? 'sube' : 'baja'}</span>}
        </span>
      ))}
    </p>
  );
}

// En un vídeo: lo que le dijiste de ese ejercicio la última vez y, si hay, comparar con su vídeo anterior
export function LoQueLeDijiste({ a }) {
  const { api, aviso } = useApp();
  const ej = a.ejercicio?.id || a.ejercicio_id || null;
  const d = useCarga(() => (ej ? api.dichoPorCoach(a.atleta.id, [ej], null, a.ejercicio ? { [ej]: a.ejercicio } : {}).then((x) => (x[ej]?.lista || []).slice(0, 2)).catch(() => []) : Promise.resolve([])), [a.id]);
  const [comparar, setComparar] = useState(null);
  const verAnterior = async () => {
    try {
      const o = await api.videoAnterior({ ...a, ejercicio_id: ej });
      if (!o) { aviso(`No hay un vídeo anterior de ${a.ejercicio?.nombre || 'ese ejercicio'}`); return; }
      setComparar([o, a]);
    } catch (e) { aviso(e.message, 'error'); }
  };
  if (!ej) return null;
  return (
    <div class="pila-xs revisar-dicho">
      {d.datos?.length > 0 && (
        <>
          <span class="mini secundario">La última vez le dijiste de {a.ejercicio?.nombre || 'este ejercicio'}:</span>
          {d.datos.map((x, i) => <p key={i} class="cita peq">«{x.texto.length > 220 ? `${x.texto.slice(0, 220)}…` : x.texto}»<span class="mini terciario"> {x.donde}</span></p>)}
        </>
      )}
      {!a.repite_de && <button type="button" class="btn-texto mini" onClick={verAnterior}><Icono n="duplicar" /> Comparar con su vídeo anterior</button>}
      {comparar && <CompararVideos videos={comparar} nombreDe={(v) => (v.id === a.id ? 'Este' : 'El anterior')} inicialA={a.id} inicialB={comparar[0].id} alCerrar={() => setComparar(null)} />}
    </div>
  );
}

// Nota de voz desde la tarjeta: le llega a su chat y, debajo, de qué hablas (si es de una sesión, un check-in o un vídeo)
export function HojaVoz({ atleta, cita = null, respondeA = null, alCerrar, alEnviado }) {
  const { api, aviso } = useApp();
  const primer = (atleta?.nombre || 'Atleta').split(' ')[0];
  const [limite, setLimite] = useState(60);
  useEffect(() => { let vivo = true; api.vozLimite?.().then((n) => { if (vivo && n) setLimite(n); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const [enviando, setEnviando] = useState(false);
  const [hoja, setHoja] = useState(null);
  const enviarRef = useRef(null);
  const g = useGrabadora({ alError: (m) => aviso(m, 'error'), alAviso: (m) => aviso(m), alAyuda: () => setHoja('micro'), alActivar: () => setHoja('activar'), alEnviar: (x) => enviarRef.current?.(x), limite, clave: null });
  enviarRef.current = async (x) => {
    if (enviando) return;
    setEnviando(true);
    try {
      const archivo = new File([x.blob], `nota-de-voz.${x.ext}`, { type: x.tipo });
      await api.enviarMensaje(atleta.id, { archivo, autor: 'coach', duracion_seg: x.seg, onda: x.onda, respondeA, clienteId: nuevoId('revisar-voz') });
      if (cita) await api.enviarMensaje(atleta.id, { texto: cita, autor: 'coach', clienteId: nuevoId('revisar-cita') }).catch(() => {});
      g.descartar();
      aviso(`Nota de voz enviada a ${primer}`, 'ok');
      alEnviado?.();
      alCerrar();
    } catch (e) { aviso(e?.message || 'No se ha podido enviar la nota de voz', 'error'); } finally { setEnviando(false); }
  };
  const grabando = g.estado === 'pidiendo' || g.estado === 'grabando' || g.estado === 'pausada';
  return (
    <Hoja titulo={`Nota de voz para ${primer}`} alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Le llega a su chat{cita ? <>, con esta frase debajo: «{cita}»</> : '.'}</p>
        {g.estado === 'revisar' ? <div class="rev-voz"><PanelRevisar g={g} alEnviar={(x) => enviarRef.current(x)} enviando={enviando} /></div>
          : grabando ? <div class="rev-voz"><PanelGrabando g={g} /></div>
            : <button type="button" class="btn btn-primario revisar-grabar" onClick={() => g.empezar({ manos: true })}><Icono n="micro" /> Grabar la nota</button>}
      </div>
      {hoja === 'micro' && <AyudaMicro alCerrar={() => setHoja(null)} />}
      {hoja === 'activar' && <ActivarMicro alCerrar={() => setHoja(null)} />}
    </Hoja>
  );
}

// Lo que has dado por revisado hoy, por si alguna fue sin querer: «Volver a pendiente»
export function HojaRevisadosHoy({ alCerrar, alCambio }) {
  const { api, aviso } = useApp();
  const [dias, setDias] = useState(1);
  const [buscar, setBuscar] = useState('');
  const lista = useCarga(() => api.revisadosHoy(undefined, dias), [dias]);
  const [ocupado, una] = useUnaVez();
  const volver = (x) => una(async () => {
    try { await api.marcarRevisado(x.tipo, x.id, false); aviso('Vuelve a «Revisar»', 'ok'); await lista.recargar(true); alCambio?.(); }
    catch (e) { aviso(e.message, 'error'); }
  });
  const xs = (lista.datos || []).filter((x) => !buscar.trim() || coincideNombre(`${x.atleta.nombre} ${x.titulo}`, buscar));
  return (
    <Hoja titulo={dias === 1 ? 'Lo que has revisado hoy' : `Lo que has revisado (${dias} días)`} alCerrar={alCerrar}>
      <div class="fila-envolver revisados-filtros">
        <div class="segmentos" role="group" aria-label="Desde cuándo">
          {[[1, 'Hoy'], [7, '7 días'], [30, '30 días']].map(([k, t]) => <button key={k} type="button" aria-pressed={dias === k ? 'true' : 'false'} onClick={() => setDias(k)}>{t}</button>)}
        </div>
        <input type="search" class="entrada" placeholder="Buscar" aria-label="Buscar en lo revisado" value={buscar} onInput={(e) => setBuscar(e.currentTarget.value)} />
      </div>
      {lista.cargando && !lista.datos ? <p class="peq secundario" role="status">Cargando...</p> : !xs.length ? <p class="peq secundario">{buscar.trim() ? 'Nada con esa búsqueda.' : dias === 1 ? 'Hoy aún no has dado nada por revisado.' : 'No has revisado nada en estos días.'}</p> : (
        <ul class="revisados-hoy">
          {xs.map((x) => (
            <li key={`${x.tipo}-${x.id}`} class="revisado-hoy">
              <Avatar nombre={x.atleta.nombre} foto={x.atleta.foto} clase="peq" />
              <span class="pila-xs"><span class="peq"><strong>{x.atleta.nombre}</strong>: {x.titulo}</span><span class="mini terciario">{NOMBRE_REVISADO[x.tipo]}, {cuando(x.revisado_en)}{x.leido === true ? <span class="revisado-leido">, ha leído tu respuesta <span aria-hidden="true">✓✓</span></span> : x.leido === false ? <span>, aún no ha leído tu respuesta <span aria-hidden="true">✓</span></span> : ''}</span></span>
              <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => volver(x)} aria-label={`Volver a pendiente: ${x.atleta.nombre}, ${x.titulo}`}>Volver a pendiente</button>
            </li>
          ))}
        </ul>
      )}
      <p class="mini terciario">Contestar algo también lo da por revisado. Al volver a pendiente, sale otra vez en «Revisar» (si es de las 4 últimas semanas).</p>
    </Hoja>
  );
}
