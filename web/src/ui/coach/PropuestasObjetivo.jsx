// Los objetivos que proponen los atletas (migración 076), en el lado del coach: la hoja para contestar una propuesta
// (aceptarla tal cual o ajustando la cifra y la fecha, o descartarla con una nota) y la lista de las que esperan en
// la ficha de un atleta. Al aceptar se crea el objetivo, con su punto de partida de hoy.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Paso, useUnaVez } from '../comunes.jsx';
import { textoPropuesta, ritmoCarrera, objetivoDePropuesta, NOMBRE_TIPO_PROPUESTA, MAX_TITULO, MAX_NOTA } from '../../logica/objetivos-atleta.js';
import { REPS_MAX_OBJETIVO, textoMarca } from '../../logica/objetivos.js';
import { leerTiempo, fmtTiempo } from '../../logica/carrera.js';
import { num } from '../../logica/calculos.js';
import { fmtCorta, hoyISO } from '../../logica/fechas.js';
import { pesoTxt } from '../../logica/unidades.js';
import { cuando } from '../comunes.jsx';

// Lo que cambia el coach respecto a lo propuesto (solo lo que toca a ese tipo), como fila del objetivo; o { error }
export function cambiosDe(p, f) {
  const base = { fecha_limite: f.fecha || null };
  if (p.tipo === 'fuerza') {
    if (!(f.kg >= 0.5 && f.kg <= 1000) || !(f.reps >= 1 && f.reps <= REPS_MAX_OBJETIVO)) return { error: 'Revisa los kilos y las repeticiones (de 1 a 12).' };
    return { cambios: { ...base, kg_objetivo: f.kg, reps_objetivo: f.reps, titulo: `${p.ejercicio || 'Ejercicio'} ${textoMarca(f.kg, f.reps)}` } };
  }
  if (p.tipo === 'peso') {
    if (!(f.peso_kg >= 30 && f.peso_kg <= 300)) return { error: 'El peso, entre 30 y 300 kg.' };
    return { cambios: { ...base, peso_objetivo: f.peso_kg, titulo: textoPropuesta({ tipo: 'peso', peso_kg: f.peso_kg }) } };
  }
  if (p.tipo === 'carrera') {
    const seg = leerTiempo(f.tiempo);
    if (!(f.distancia_km >= 0.1 && f.distancia_km <= 500) || !seg || seg < 30) return { error: 'Revisa la distancia y el tiempo (por ejemplo 50:00 o 1:45:00).' };
    return { cambios: { ...base, distancia_km: f.distancia_km, tiempo_seg: seg, titulo: textoPropuesta({ tipo: 'carrera', distancia_km: f.distancia_km, tiempo_seg: seg }) } };
  }
  const titulo = String(f.titulo || '').trim();
  if (!titulo) return { error: 'Escribe el objetivo.' };
  return { cambios: { ...base, titulo } };
}

export function HojaPropuesta({ p, alCerrar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState({ kg: p.kg != null ? Number(p.kg) : null, reps: p.reps ?? 1, peso_kg: p.peso_kg != null ? Number(p.peso_kg) : null,
    distancia_km: p.distancia_km != null ? Number(p.distancia_km) : null, tiempo: p.tiempo_seg ? fmtTiempo(p.tiempo_seg) : '', titulo: p.titulo || '', fecha: p.fecha || '', nota: '' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  // De dónde parte hoy: su 1RM estimado en ese ejercicio o su tendencia de peso
  const ahora = useCarga(() => (p.tipo === 'fuerza' && p.ejercicio_id ? api.e1rmActual(p.atleta_id, p.ejercicio_id) : p.tipo === 'peso' ? api.tendenciaPesoActual(p.atleta_id) : Promise.resolve(null)).catch(() => null), [p.id]);
  const nota = f.nota.trim() || null;
  const aceptar = () => una(async () => {
    setError(null);
    const r = cambiosDe(p, f);
    if (r.error) { setError(r.error); return; }
    try { await api.aceptarPropuesta(p, r.cambios, nota); aviso('Objetivo aceptado: ya lo ve en su Progreso'); alCerrar(true); } catch (e) { setError(e.message); }
  });
  const descartar = () => una(async () => {
    setError(null);
    try { await api.descartarPropuesta(p.id, nota); aviso('Propuesta descartada'); alCerrar(true); } catch (e) { setError(e.message); }
  });
  const seg = leerTiempo(f.tiempo);
  return (
    <Hoja titulo="Objetivo propuesto" alCerrar={() => alCerrar(false)}>
      <form class="pila propuesta-coach" onSubmit={(e) => { e.preventDefault(); aceptar(); }} noValidate>
        <div class="pila-xs">
          <span class="chip morado" style="justify-self:start">{NOMBRE_TIPO_PROPUESTA[p.tipo]}</span>
          <strong>{textoPropuesta(p)}</strong>
          <span class="mini secundario">Lo propuso {cuando(p.creado_en)}{p.fecha ? `, para el ${fmtCorta(p.fecha)}` : ', sin fecha'}.</span>
          {p.motivo && <p class="cita">«{p.motivo}»</p>}
        </div>
        {ahora.datos != null && <p class="peq secundario">{p.tipo === 'fuerza' ? <>Su 1RM estimado ahora: <strong class="num">{pesoTxt(ahora.datos, 1)}</strong>.</> : <>Su tendencia de peso ahora: <strong class="num">{num(ahora.datos, 1)} kg</strong>.</>}</p>}
        <div class="propuesta-campos">
          {p.tipo === 'fuerza' && (
            <div class="rejilla-campos">
              <div class="campo"><label for="pr-kg">Kilos</label><Paso id="pr-kg" valor={f.kg} paso={2.5} min={0.5} max={1000} dec={2} etiqueta="kilos del objetivo" alCambiar={set('kg')} /></div>
              <div class="campo"><label for="pr-reps">Repeticiones</label><Paso id="pr-reps" valor={f.reps} paso={1} min={1} max={REPS_MAX_OBJETIVO} dec={0} etiqueta="repeticiones del objetivo" alCambiar={(v) => set('reps')(v ?? 1)} /></div>
            </div>
          )}
          {p.tipo === 'peso' && <div class="campo"><label for="pr-peso">Peso (kg)</label><Paso id="pr-peso" valor={f.peso_kg} paso={0.5} min={30} max={300} dec={1} etiqueta="kilos del objetivo de peso" alCambiar={set('peso_kg')} /></div>}
          {p.tipo === 'carrera' && (
            <div class="rejilla-campos">
              <div class="campo"><label for="pr-km">Distancia (km)</label><Paso id="pr-km" valor={f.distancia_km} paso={1} min={0.1} max={500} dec={2} etiqueta="kilómetros del objetivo" alCambiar={set('distancia_km')} /></div>
              <div class="campo"><label for="pr-tiempo">Tiempo</label><input id="pr-tiempo" class="entrada" maxLength={8} value={f.tiempo} onInput={(e) => set('tiempo')(e.currentTarget.value)} placeholder="50:00" />
                {seg && f.distancia_km > 0 && <span class="mini terciario">A {ritmoCarrera(f.distancia_km, seg)}</span>}</div>
            </div>
          )}
          {p.tipo === 'libre' && <div class="campo"><label for="pr-titulo">Objetivo</label><input id="pr-titulo" class="entrada" maxLength={MAX_TITULO} value={f.titulo} onInput={(e) => set('titulo')(e.currentTarget.value)} /></div>}
          <div class="campo"><label for="pr-fecha">Para el</label><input id="pr-fecha" type="date" class="entrada" min={hoyISO()} value={f.fecha} onInput={(e) => set('fecha')(e.currentTarget.value)} /></div>
          <div class="campo"><label for="pr-nota">Nota para el atleta (opcional)</label>
            <input id="pr-nota" class="entrada" maxLength={MAX_NOTA} value={f.nota} onInput={(e) => set('nota')(e.currentTarget.value)} placeholder="Por qué lo ajustas o lo dejas para más adelante" /></div>
        </div>
        <p class="mini terciario">Al aceptar se crea el objetivo con lo que ves aquí (lo puedes cambiar después en su ficha). {p.tipo === 'fuerza' || p.tipo === 'peso' ? 'El progreso se mide desde hoy.' : 'El progreso de este lo marcas tú.'}</p>
        {error && <div class="error" role="alert">{error}</div>}
        <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="hecho" /> Aceptar</button>
        <button type="button" class="btn" disabled={ocupado} onClick={descartar}>Descartar</button>
      </form>
    </Hoja>
  );
}

// En la ficha del atleta, encima de sus objetivos: lo que ha propuesto y espera respuesta
export function PropuestasDe({ atleta, alCambiar }) {
  const { api } = useApp();
  const lista = useCarga(() => api.propuestasPendientes(atleta.id).catch(() => []), [atleta.id]);
  const [abierta, setAbierta] = useState(null);
  if (!(lista.datos || []).length) return null;
  return (
    <section class="pila-s propuestas-ficha" aria-label="Objetivos que propone">
      <h3 class="peq">Propone {lista.datos.length === 1 ? 'este objetivo' : `estos ${lista.datos.length} objetivos`}</h3>
      <div class="panel"><ul class="lista">
        {lista.datos.map((p) => (
          <li key={p.id}>
            <button class="respuesta propuesta-pendiente" onClick={() => setAbierta(p)}>
              <span><span class="nombre">{textoPropuesta(p)}</span><br /><span class="detalle">{NOMBRE_TIPO_PROPUESTA[p.tipo]}{p.fecha ? `, para el ${fmtCorta(p.fecha)}` : ''}{p.motivo ? `. «${p.motivo}»` : ''}</span></span>
              <Icono n="derecha" />
            </button>
          </li>
        ))}
      </ul></div>
      {abierta && <HojaPropuesta p={abierta} alCerrar={(cambio) => { setAbierta(null); if (cambio) { lista.recargar(true); alCambiar?.(); } }} />}
    </section>
  );
}
export { objetivoDePropuesta };
