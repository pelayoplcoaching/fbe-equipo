// Los objetivos que propone el atleta (migración 076): la tarjeta de Hoy (la primera vez y al empezar cada bloque), el
// cuestionario de objetivos y, en Progreso, lo que ha propuesto y lo que le ha contestado su coach. Lo que escribe es
// una propuesta: solo sale como objetivo cuando el coach la acepta.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Paso, usePreferencia, useUnaVez } from '../comunes.jsx';
import { tiposPara, limpiarPropuesta, textoPropuesta, ritmoCarrera, tocaCuestionario, posponerHasta, propuestasVisibles, NOMBRE_TIPO_PROPUESTA, MAX_PROPUESTAS, MAX_TITULO, MAX_MOTIVO } from '../../logica/objetivos-atleta.js';
import { mejorReciente, REPS_MAX_OBJETIVO } from '../../logica/objetivos.js';
import { e1rm, num } from '../../logica/calculos.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { conCarrera, leerTiempo, fmtTiempo } from '../../logica/carrera.js';
import { hoyISO, sumarDias, fmtCorta } from '../../logica/fechas.js';
import { deVista, vista, enLibras, etiquetaPeso, nombrePeso, pesoTxt } from '../../logica/unidades.js';

const DISTANCIAS = [[5, '5 km'], [10, '10 km'], [21.1, 'Media'], [42.2, 'Maratón']];

// Sus propuestas y cuándo contestó (null sin la 076: la app no ofrece nada de esto)
export function useObjetivosPropuestos() {
  const { api, atleta, propio } = useApp();
  return useCarga(() => (propio ? Promise.resolve(null) : api.objetivosPropuestos().catch(() => null)), [atleta.id, propio], { recuerdo: `objetivos-propuestos:${atleta.id}` });
}

// El día en que empezó su bloque de ahora (el del bloque o, si no lo tiene, el de su primera semana)
export const inicioDelBloque = (p) => p?.bloque?.fecha_inicio || (p?.semanas || []).map((w) => w.fecha_inicio).filter(Boolean).sort()[0] || null;

// La tarjeta de Hoy: la primera vez y cuando su bloque de ahora empezó después de la última vez que contestó
export function TarjetaObjetivos({ estado, programa, salud }) {
  const { api, atleta } = useApp();
  const [pospuesto, setPospuesto] = usePreferencia(`fbe-objetivos-pospuesto:${api.uid()}`, null);
  const [abierta, setAbierta] = useState(false);
  const d = estado.datos;
  if (!d || atleta.estado === 'baja') return null;
  const hoy = hoyISO();
  const pendientes = (d.propuestas || []).filter((x) => x.estado === 'pendiente').length;
  const toca = tocaCuestionario({ contestadoEn: d.contestado_en, inicioBloque: inicioDelBloque(programa), pospuestoHasta: pospuesto, pendientes, hoy });
  if (!toca && !abierta) return null;
  const otraVez = !!d.contestado_en;
  return (
    <>
      {toca && (
        <section class="nota-coach tarjeta-cuestionario tarjeta-objetivos" aria-label="Tus objetivos">
          <Icono n="diana" />
          <div class="pila-s">
            <strong>{otraVez ? 'Empiezas bloque: ¿a por qué vas ahora?' : '¿Qué quieres conseguir?'}</strong>
            <span class="peq">{otraVez ? 'Dile a tu coach si sigues con los mismos objetivos o si quieres cambiar alguno.' : 'Cuéntale a tu coach a por qué vas: una marca, tu peso, una carrera o lo que tú quieras. Es un minuto.'}</span>
            <div class="fila-envolver">
              <button class="btn btn-primario btn-peq" onClick={() => setAbierta(true)}>{otraVez ? 'Revisarlos' : 'Contestar'}</button>
              <button class="btn btn-peq plano" onClick={() => setPospuesto(posponerHasta(hoy))}>Ahora no</button>
            </div>
          </div>
        </section>
      )}
      {abierta && <HojaObjetivos salud={salud} otraVez={otraVez} pendientes={pendientes} alCerrar={() => setAbierta(false)} alEnviar={() => estado.recargar(true)} />}
    </>
  );
}

const VACIA = { fuerza: { ejercicio_id: '', kg: null, reps: 1 }, peso: { peso_kg: null }, carrera: { distancia_km: null, tiempo: '' }, libre: { titulo: '' } };

// El cuestionario: qué quiere conseguir (uno o varios), un paso por cada uno y a su coach
export function HojaObjetivos({ salud, otraVez = false, pendientes = 0, alCerrar, alEnviar }) {
  const { api, atleta } = useApp();
  const tipos = tiposPara({ salud, carrera: conCarrera(atleta), entrena: conEntrenamiento(atleta) });
  const cabe = Math.max(0, MAX_PROPUESTAS - pendientes);
  const [elegidos, setElegidos] = useState([]);
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState(() => Object.fromEntries(Object.entries(VACIA).map(([k, v]) => [k, { ...v, fecha: '', motivo: '' }])));
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [ocupado, una] = useUnaVez();
  const actuales = useCarga(() => api.objetivos(atleta.id).then((l) => l.filter((o) => ['en_curso', 'no_iniciado'].includes(o.estado))).catch(() => []), [atleta.id]);
  const total = elegidos.length + 1;
  const tipo = paso > 0 ? elegidos[paso - 1] : null;
  const ultimo = paso === elegidos.length;
  const cambiar = (k, v) => setF((x) => ({ ...x, [tipo]: { ...x[tipo], [k]: v } }));
  const datosDe = (t) => {
    const x = f[t];
    return limpiarPropuesta({ tipo: t, ...x, kg: t === 'fuerza' && x.kg != null ? deVista(x.kg) : null, tiempo_seg: t === 'carrera' ? leerTiempo(x.tiempo) : null });
  };
  const enviar = (lista) => una(async () => {
    setError(null);
    try { await api.proponerObjetivos(lista); setEnviado(lista.length); alEnviar?.(); } catch (e) { setError(e.message); }
  });
  function siguiente(e) {
    e.preventDefault();
    setError(null);
    if (paso === 0) {
      if (!elegidos.length) { setError('Elige al menos una cosa, o dile a tu coach que sigues igual.'); return; }
      setPaso(1);
      return;
    }
    const r = datosDe(tipo);
    if (r.error) { setError(r.error); return; }
    if (!ultimo) { setPaso(paso + 1); return; }
    enviar(elegidos.map((t) => ({ tipo: t, ...f[t], kg: t === 'fuerza' && f[t].kg != null ? deVista(f[t].kg) : null, tiempo_seg: t === 'carrera' ? leerTiempo(f[t].tiempo) : null })));
  }

  if (enviado != null) {
    return (
      <Hoja titulo={enviado ? 'Enviado a tu coach' : 'Apuntado'} alCerrar={alCerrar}>
        <div class="pila">
          <div class="resultado-cribado ok" role="status"><Icono n="hecho" />
            <p>{enviado ? `Tu coach ya tiene ${enviado === 1 ? 'tu objetivo' : `tus ${enviado} objetivos`}. Lo revisará y, cuando lo acepte, lo verás en Progreso con su barra y su previsión.` : 'Tu coach sabe que sigues con los mismos objetivos.'}</p></div>
          {enviado > 0 && <p class="peq secundario">Puede que ajuste la cifra o la fecha para que encaje con tu programación. Mientras espera, puedes retirarlo desde Progreso.</p>}
          <button class="btn btn-primario btn-grande" onClick={alCerrar}>Hecho</button>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Tus objetivos" alCerrar={alCerrar}>
      <form class="pila cuestionario cuestionario-objetivos" onSubmit={siguiente} noValidate>
        <div class="pila-s">
          <div class="separa"><strong>{paso === 0 ? '¿Qué quieres conseguir?' : NOMBRE_PASO[tipo]}</strong><span class="peq secundario num">Paso {paso + 1} de {total}</span></div>
          <div class="progreso-barra" role="img" aria-label={`Paso ${paso + 1} de ${total}`}><span style={{ width: `${((paso + 1) / total) * 100}%` }} /></div>
        </div>

        {paso === 0 && (
          <>
            {(actuales.datos || []).length > 0 && (
              <div class="objetivos-actuales pila-xs">
                <span class="etq">Ahora mismo vas a por</span>
                <ul class="lista-simple">{actuales.datos.map((o) => <li key={o.id} class="peq"><Icono n="diana" /> {o.titulo}{o.fecha_limite ? `, para el ${fmtCorta(o.fecha_limite)}` : ''}</li>)}</ul>
              </div>
            )}
            <div class="campo"><span class="etq" id="ob-que">{otraVez ? 'Elige lo que quieras añadir o cambiar' : 'Elige una cosa o varias'}</span>
              {cabe === 0 ? <p class="peq secundario">Ya tienes {MAX_PROPUESTAS} objetivos esperando a tu coach. Cuando conteste podrás proponer más.</p> : (
                <div class="opciones opciones-objetivo" role="group" aria-labelledby="ob-que">
                  {tipos.map(([k, t, ayuda]) => {
                    const i = elegidos.indexOf(k);
                    return (
                      <button type="button" key={k} aria-pressed={i >= 0 ? 'true' : 'false'} disabled={i < 0 && elegidos.length >= cabe}
                        onClick={() => { setError(null); setElegidos(i >= 0 ? elegidos.filter((x) => x !== k) : tipos.map(([x]) => x).filter((x) => x === k || elegidos.includes(x))); }}>
                        <span class="pila-xs"><span>{t}</span><span class="mini secundario">{ayuda}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p class="mini terciario">Lo que propongas le llega a tu coach. Él lo acepta, lo ajusta contigo o te dice por qué mejor más adelante.</p>
          </>
        )}

        {tipo === 'fuerza' && <PasoFuerza f={f.fuerza} cambiar={cambiar} />}
        {tipo === 'peso' && <PasoPeso f={f.peso} cambiar={cambiar} />}
        {tipo === 'carrera' && <PasoCarrera f={f.carrera} cambiar={cambiar} />}
        {tipo === 'libre' && (
          <div class="campo"><label for="ob-libre">Tu objetivo, con tus palabras</label>
            <input id="ob-libre" class="entrada" maxLength={MAX_TITULO} value={f.libre.titulo} onInput={(e) => cambiar('titulo', e.currentTarget.value)} placeholder="Hacer mi primera dominada, entrenar 4 días por semana…" /></div>
        )}
        {tipo && (
          <>
            <div class="campo"><label for="ob-para">¿Para cuándo? (si tienes fecha)</label>
              <input id="ob-para" type="date" class="entrada" min={hoyISO()} max={sumarDias(hoyISO(), 730)} value={f[tipo].fecha} onInput={(e) => cambiar('fecha', e.currentTarget.value)} /></div>
            <div class="campo"><label for="ob-porque">¿Por qué te importa? (opcional)</label>
              <input id="ob-porque" class="entrada" maxLength={MAX_MOTIVO} value={f[tipo].motivo} onInput={(e) => cambiar('motivo', e.currentTarget.value)} placeholder="Le ayuda a tu coach a entenderte" /></div>
          </>
        )}

        {error && <div class="error" role="alert">{error}</div>}
        <div class="fila-botones">
          {paso > 0 && <button type="button" class="btn" onClick={() => { setError(null); setPaso(paso - 1); }}><Icono n="atras" /> Atrás</button>}
          {(paso > 0 || cabe > 0) && <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Enviando…' : paso > 0 && ultimo ? 'Enviar a tu coach' : 'Siguiente'}</button>}
        </div>
        {paso === 0 && <button type="button" class="btn plano" disabled={ocupado} onClick={() => enviar([])}>{(actuales.datos || []).length ? 'Sigo con los mismos' : 'Ahora mismo no tengo ninguno'}</button>}
      </form>
    </Hoja>
  );
}
const NOMBRE_PASO = { fuerza: 'Tu marca de fuerza', peso: 'Tu peso', carrera: 'Tu marca corriendo', libre: 'Tu objetivo' };

// Una marca: el ejercicio (de los que ha hecho; si aún no ha entrenado, de la biblioteca), los kilos y las repeticiones
function PasoFuerza({ f, cambiar }) {
  const { api, atleta } = useApp();
  const datos = useCarga(async () => {
    const series = await api.historial(atleta.id).catch(() => []);
    const porEj = new Map();
    for (const s of series) if (s.ejercicio_id && s.ejercicio) { const x = porEj.get(s.ejercicio_id) || { id: s.ejercicio_id, nombre: s.ejercicio, n: 0 }; x.n++; porEj.set(s.ejercicio_id, x); }
    const suyos = [...porEj.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
    const lista = suyos.length ? suyos : (await api.biblioteca().catch(() => [])).map((e) => ({ id: e.id, nombre: e.nombre }));
    return { series, lista };
  }, [atleta.id]);
  const lista = datos.datos?.lista || [];
  const id = f.ejercicio_id || '';
  const ahora = id && datos.datos ? mejorReciente(datos.datos.series.filter((s) => s.ejercicio_id === id), hoyISO()) : null;
  const meta = f.kg > 0 && f.reps >= 1 && f.reps <= REPS_MAX_OBJETIVO ? e1rm({ kg: deVista(f.kg), reps: f.reps, rir: 0 }) : null;
  return (
    <>
      <div class="campo"><label for="ob-ej">Ejercicio</label>
        <select id="ob-ej" class="selector" value={id} onChange={(e) => cambiar('ejercicio_id', e.currentTarget.value)}>
          <option value="">{datos.cargando && !lista.length ? 'Cargando tus ejercicios…' : 'Elige el ejercicio'}</option>
          {lista.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select></div>
      {ahora != null && <p class="peq secundario">Tu 1RM estimado ahora en este ejercicio: <strong class="num">{pesoTxt(ahora, 1)}</strong>.</p>}
      <div class="rejilla-campos">
        <div class="campo"><label for="ob-kg">{enLibras() ? 'Lb' : 'Kg'}</label><Paso id="ob-kg" valor={f.kg} paso={enLibras() ? 5 : 2.5} min={0} max={enLibras() ? 2200 : 1000} dec={2} etiqueta={`${nombrePeso()} de tu objetivo`} alCambiar={(v) => cambiar('kg', v)} /></div>
        <div class="campo"><label for="ob-reps">Repeticiones</label><Paso id="ob-reps" valor={f.reps} paso={1} min={1} max={REPS_MAX_OBJETIVO} dec={0} etiqueta="repeticiones de tu objetivo" alCambiar={(v) => cambiar('reps', v || 1)} /></div>
      </div>
      {meta != null && f.reps > 1 && <p class="mini terciario">Equivale a un 1RM estimado de {num(vista(meta), 1)} {etiquetaPeso()}.</p>}
    </>
  );
}

// El peso al que quiere llegar (solo con consentimiento de salud): con su tendencia de ahora al lado
function PasoPeso({ f, cambiar }) {
  const { api, atleta } = useApp();
  const ahora = useCarga(() => api.tendenciaPesoActual(atleta.id).catch(() => null), [atleta.id]);
  return (
    <>
      {ahora.datos != null && <p class="peq secundario">Tu tendencia de peso ahora: <strong class="num">{num(ahora.datos, 1)} kg</strong>.</p>}
      <div class="campo"><label for="ob-peso">¿A qué peso quieres llegar? (kg)</label>
        <Paso id="ob-peso" valor={f.peso_kg} paso={0.5} min={30} max={300} dec={1} etiqueta="kilos a los que quieres llegar" alCambiar={(v) => cambiar('peso_kg', v)} /></div>
      <p class="mini terciario">Tu coach te dirá si es un peso y un ritmo razonables para ti. El peso es solo una de las formas de medir tu progreso.</p>
    </>
  );
}

// Una distancia en un tiempo
function PasoCarrera({ f, cambiar }) {
  const seg = leerTiempo(f.tiempo);
  const ritmo = f.distancia_km > 0 && seg ? ritmoCarrera(f.distancia_km, seg) : '';
  return (
    <>
      <div class="campo"><span class="etq" id="ob-dist">Distancia</span>
        <div class="selector-chips" role="group" aria-labelledby="ob-dist">
          {DISTANCIAS.map(([km, t]) => <button type="button" key={km} aria-pressed={Number(f.distancia_km) === km ? 'true' : 'false'} onClick={() => cambiar('distancia_km', km)}>{t}</button>)}
        </div>
        <Paso id="ob-km" valor={f.distancia_km} paso={1} min={0.1} max={500} dec={2} etiqueta="kilómetros de tu objetivo" alCambiar={(v) => cambiar('distancia_km', v)} /></div>
      <div class="campo"><label for="ob-tiempo">Tiempo</label>
        <input id="ob-tiempo" class="entrada" inputMode="numeric" maxLength={8} value={f.tiempo} onInput={(e) => cambiar('tiempo', e.currentTarget.value)} placeholder="50:00 o 1:45:00" /></div>
      {ritmo && <p class="peq secundario">Son {fmtTiempo(seg)}, a <strong class="num">{ritmo}</strong>.</p>}
    </>
  );
}

// En Progreso: lo que ha propuesto (lo que espera y lo contestado hace poco) y el botón para proponer
export function PropuestasTuyas({ salud }) {
  const { api, aviso, atleta } = useApp();
  const estado = useObjetivosPropuestos();
  const [abierta, setAbierta] = useState(false);
  const [ocupado, una] = useUnaVez();
  const d = estado.datos;
  if (!d || atleta.estado === 'baja') return null;
  const { pendientes, recientes } = propuestasVisibles(d.propuestas || [], hoyISO());
  const retirar = (p) => una(async () => { try { await api.retirarPropuesta(p.id); aviso('Propuesta retirada'); estado.recargar(true); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <div class="propuestas-tuyas pila-s">
      {(pendientes.length > 0 || recientes.length > 0) && (
        <ul class="lista propuestas-lista">
          {pendientes.map((p) => (
            <li key={p.id} class="propuesta-fila">
              <span class="pila-xs"><strong>{textoPropuesta(p)}</strong>
                <span class="mini secundario">{NOMBRE_TIPO_PROPUESTA[p.tipo]}{p.fecha ? `, para el ${fmtCorta(p.fecha)}` : ''}. Esperando a tu coach.</span></span>
              <button class="btn btn-peq plano" disabled={ocupado} onClick={() => retirar(p)} aria-label={`Retirar la propuesta: ${textoPropuesta(p)}`}>Retirar</button>
            </li>
          ))}
          {recientes.map((p) => (
            <li key={p.id} class="propuesta-fila">
              <span class="pila-xs"><strong>{textoPropuesta(p)}</strong>
                <span class={`mini ${p.estado === 'aceptada' ? 'ok-t' : 'secundario'}`}>{p.estado === 'aceptada' ? 'Tu coach lo ha aceptado: ya está entre tus objetivos.' : 'Tu coach lo deja para más adelante.'}</span>
                {p.nota_coach && <span class="cita mini">«{p.nota_coach}»</span>}</span>
            </li>
          ))}
        </ul>
      )}
      <button class="btn btn-peq" style="justify-self:start" onClick={() => setAbierta(true)}><Icono n="mas" /> Proponer un objetivo</button>
      {abierta && <HojaObjetivos salud={salud} otraVez={!!d.contestado_en} pendientes={pendientes.length} alCerrar={() => setAbierta(false)} alEnviar={() => estado.recargar(true)} />}
    </div>
  );
}
