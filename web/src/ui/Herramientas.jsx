import { useState } from 'preact/hooks';
import { Hoja, Paso, Segmentos } from './comunes.jsx';
import { e1rm, tablaRpe, RPE_TABLA, discosPorLado, aproximaciones, num } from '../logica/calculos.js';

const COLOR_PLACA = { 25: 'var(--disco-rojo)', 20: 'var(--disco-azul)', 15: 'var(--disco-amarillo)', 10: 'var(--disco-verde)' };

// Discos por lado, con los colores de los discos de competición
export function Placas({ kg, barra = 20, etiqueta = 'Por lado' }) {
  const lado = discosPorLado(kg, barra);
  if (!lado) return null;
  return (
    <span class="discos-ayuda" role="img" aria-label={lado.length ? `Por lado: ${lado.map((d) => num(d, 2)).join(' más ')} kilos, con barra de ${barra}` : `Solo la barra de ${barra} kilos`}>
      {etiqueta && <span class="terciario">{etiqueta}</span>}
      {lado.length ? lado.map((d, i) => (
        <span class="placa" key={i} style={{ '--c': COLOR_PLACA[d] || 'var(--tinta-3)', '--t': d === 15 || d === 10 ? 'var(--sobre-disco-claro)' : 'var(--sobre-disco)', '--h': `${12 + Math.min(d, 25) * 0.6}px` }}>{num(d, 2)}</span>
      )) : <span class="secundario">solo la barra</span>}
    </span>
  );
}

// Calculadora: 1RM estimado de una serie, tabla de cargas por repeticiones y RPE, y discos para una carga
export function Calculadora({ inicial = {}, alCerrar }) {
  const [kg, setKg] = useState(inicial.kg ?? 60);
  const [reps, setReps] = useState(inicial.reps ?? 5);
  const [rpe, setRpe] = useState(inicial.rpe ?? 8);
  const [carga, setCarga] = useState(inicial.kg ?? 60);
  const unoRM = e1rm({ kg, reps, rpe });
  const tabla = unoRM ? tablaRpe(unoRM) : [];
  return (
    <Hoja titulo="Calculadora" alCerrar={alCerrar} ancho={640}>
      <section class="pila">
        <h3 class="peq secundario">1RM estimado de una serie</h3>
        <div class="rejilla-3">
          <div class="campo"><label for="calc-kg">Kg</label><Paso id="calc-kg" valor={kg} paso={2.5} min={0} max={500} dec={2} etiqueta="kilos de la serie" alCambiar={(v) => setKg(v ?? 0)} /></div>
          <div class="campo"><label for="calc-reps">Repeticiones</label><Paso id="calc-reps" valor={reps} paso={1} min={1} max={12} dec={0} etiqueta="repeticiones" alCambiar={(v) => setReps(v ?? 1)} /></div>
        </div>
        <div class="campo"><span class="etq">RPE</span><Segmentos etiqueta="RPE de la serie" valor={rpe} alCambiar={(v) => setRpe(v ?? 10)} opciones={[[6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10']]} /></div>
        <div class="cifra"><span class="v num">{unoRM ? num(unoRM) : '—'}</span><span class="u">kg de 1RM estimado</span></div>
      </section>
      {unoRM && (
        <section class="pila-s">
          <h3 class="peq secundario">Cargas para ese 1RM</h3>
          <div class="tabla-env">
            <table class="tabla-simple tabla-rpe">
              <thead><tr><th>Reps</th>{RPE_TABLA.map((r) => <th key={r}>@{r}</th>)}</tr></thead>
              <tbody>{tabla.map((f) => (
                <tr key={f.reps} class={f.reps === reps ? 'actual' : ''}><th scope="row">{f.reps}</th>{f.cargas.map((c) => <td key={c.rpe} class="num">{num(c.kg, 2)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <p class="mini terciario">Epley contando las repeticiones en recámara (RPE 8 = 2 en recámara), redondeado a 2,5 kg. Es una estimación: el día manda.</p>
        </section>
      )}
      <section class="pila-s">
        <h3 class="peq secundario">Discos para una carga (barra de 20 kg)</h3>
        <Paso id="calc-carga" valor={carga} paso={2.5} min={20} max={500} dec={2} etiqueta="carga total en la barra" alCambiar={(v) => setCarga(v ?? 20)} />
        {discosPorLado(carga) ? <Placas kg={carga} /> : <p class="peq secundario">Con discos estándar no se puede cargar exacto: prueba con un múltiplo de 2,5 kg.</p>}
      </section>
    </Hoja>
  );
}

// Series de aproximación hasta la carga de trabajo, con sus discos
export function Aproximacion({ nombre, kg, reps, conBarra = true, alCerrar }) {
  const [hechas, setHechas] = useState(new Set());
  const lista = aproximaciones(kg, reps, conBarra ? {} : { barra: 0, paso: /mancuerna/i.test(nombre) ? 2 : 2.5 });
  return (
    <Hoja titulo="Series de aproximación" alCerrar={alCerrar}>
      <p class="peq secundario">{nombre}: hasta {num(kg, 2)} kg × {reps}. Descansa lo justo entre ellas (1–2 min) y no las registres.</p>
      {!lista.length ? <p class="secundario">Con esta carga no hacen falta: calienta con 1 o 2 series ligeras.</p> : (
        <ul class="lista aproximaciones">
          {lista.map((a, i) => (
            <li key={i}>
              <label class="casilla">
                <input type="checkbox" checked={hechas.has(i)} onChange={() => setHechas((h) => { const n = new Set(h); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
                <span><strong class="num">{num(a.kg, 2)} kg × {a.reps}</strong>{a.discos && <Placas kg={a.kg} etiqueta="" />}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}

// Historial de un ejercicio: mejor marca estimada, evolución, récords por repeticiones y sesiones
// La ficha completa del ejercicio (gráficas, récords, historial y técnica) está en FichaEjercicio.jsx
export { FichaEjercicio as HistorialEjercicio } from './FichaEjercicio.jsx';
