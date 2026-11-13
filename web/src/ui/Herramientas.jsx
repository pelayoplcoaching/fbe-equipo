import { sonarFBE } from './sonido.js';   // (sonido 2) las aproximaciones, más suaves que las efectivas
import { useState } from 'preact/hooks';
import { Hoja, Paso, Segmentos } from './comunes.jsx';
import { e1rm, tablaRpe, RPE_TABLA, discosPorLado, aproximaciones, num } from '../logica/calculos.js';
import { enLibras, etiquetaPeso, nombrePeso, barraVista, DISCOS_LB, vista, pesoTxt } from '../logica/unidades.js';

const COLOR_PLACA = { 25: 'var(--disco-rojo)', 20: 'var(--disco-azul)', 15: 'var(--disco-amarillo)', 10: 'var(--disco-verde)' };
// (v0.112) los de libras, con los colores de los de competición en libras: 55 rojo, 45 azul, 35 amarillo, 25 verde
const COLOR_PLACA_LB = { 45: 'var(--disco-azul)', 35: 'var(--disco-amarillo)', 25: 'var(--disco-verde)' };

// Discos por lado, con los colores de los discos de competición
// v0.63: discos, los que hay (con el disco más pequeño de ese gimnasio); de serie, los de siempre
// v0.112: kg es la carga en la unidad de la app: en libras, con discos de libras (45, 35, 25, 10, 5 y 2,5) y barra de 45
export function Placas({ kg, barra = undefined, etiqueta = 'Por lado', discos = undefined }) {
  const lb = enLibras();
  const b = barra ?? barraVista();
  const lado = discosPorLado(kg, b, lb ? DISCOS_LB : discos);
  if (!lado) return null;
  const colores = lb ? COLOR_PLACA_LB : COLOR_PLACA;
  const claro = (d) => (lb ? d === 35 || d === 25 : d === 15 || d === 10);
  return (
    <span class="discos-ayuda" role="img" aria-label={lado.length ? `Por lado: ${lado.map((d) => num(d, 2)).join(' más ')} ${nombrePeso()}, con barra de ${b}` : `Solo la barra de ${b} ${nombrePeso()}`}>
      {etiqueta && <span class="terciario">{etiqueta}</span>}
      {lado.length ? lado.map((d, i) => (
        <span class="placa" key={`${i}-${d}`} style={{ '--i': i, '--c': colores[d] || 'var(--tinta-3)', '--t': claro(d) ? 'var(--sobre-disco-claro)' : 'var(--sobre-disco)', '--h': `${12 + Math.min(lb ? d * 0.55 : d, 25) * 0.6}px` }}>{num(d, 2)}</span>
      )) : <span class="secundario">solo la barra</span>}
    </span>
  );
}

// Calculadora: 1RM estimado de una serie, tabla de cargas por repeticiones y RPE, y discos para una carga
// v0.112: en la unidad de la app (inicial.kg ya viene en ella): en libras, saltos de 5 y barra de 45
export function Calculadora({ inicial = {}, alCerrar, discos = undefined }) {
  const lb = enLibras();
  const u = etiquetaPeso();
  const salto = lb ? 5 : 2.5;
  const barra = barraVista();
  const [kg, setKg] = useState(inicial.kg ?? (lb ? 135 : 60));
  const [reps, setReps] = useState(inicial.reps ?? 5);
  const [rpe, setRpe] = useState(inicial.rpe ?? 8);
  const [carga, setCarga] = useState(inicial.kg ?? (lb ? 135 : 60));
  const unoRM = e1rm({ kg, reps, rpe });
  const tabla = unoRM ? tablaRpe(unoRM, { paso: salto }) : [];
  return (
    <Hoja titulo="Calculadora" alCerrar={alCerrar} ancho={640}>
      <section class="pila">
        <h3 class="peq secundario">1RM estimado de una serie</h3>
        <div class="rejilla-3">
          <div class="campo"><label for="calc-kg">{lb ? 'Lb' : 'Kg'}</label><Paso id="calc-kg" valor={kg} paso={salto} min={0} max={lb ? 1100 : 500} dec={2} etiqueta={`${nombrePeso()} de la serie`} alCambiar={(v) => setKg(v ?? 0)} /></div>
          <div class="campo"><label for="calc-reps">Repeticiones</label><Paso id="calc-reps" valor={reps} paso={1} min={1} max={12} dec={0} etiqueta="repeticiones" alCambiar={(v) => setReps(v ?? 1)} /></div>
        </div>
        <div class="campo"><span class="etq">RPE</span><Segmentos etiqueta="RPE de la serie" valor={rpe} alCambiar={(v) => setRpe(v ?? 10)} opciones={[[6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10']]} /></div>
        <div class="cifra calc-cifra"><span class="v num">{unoRM ? num(unoRM) : '—'}</span><span class="u">{u} de 1RM estimado</span></div>
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
          <p class="mini terciario">Epley contando las repeticiones en recámara (RPE 8 = 2 en recámara), redondeado a {num(salto, 1)} {u}. Es una estimación: el día manda.</p>
        </section>
      )}
      <section class="pila-s">
        <h3 class="peq secundario">Discos para una carga (barra de {barra} {u})</h3>
        <Paso id="calc-carga" valor={carga} paso={salto} min={barra} max={lb ? 1100 : 500} dec={2} etiqueta="carga total en la barra" alCambiar={(v) => setCarga(v ?? barra)} />
        {discosPorLado(carga, barra, lb ? DISCOS_LB : discos) ? <Placas kg={carga} discos={discos} /> : <p class="peq secundario">Con discos estándar no se puede cargar exacto: prueba con un múltiplo de {num(salto, 1)} {u}.</p>}
      </section>
    </Hoja>
  );
}

// Series de aproximación hasta la carga de trabajo, con sus discos
// v0.112: kg en kilos (la carga de trabajo); la lista se hace en la unidad de la app (en libras, de 5 en 5 y barra de 45)
export function Aproximacion({ nombre, kg, reps, conBarra = true, alCerrar }) {
  const [hechas, setHechas] = useState(new Set());
  const lb = enLibras();
  const lista = aproximaciones(vista(kg), reps, conBarra ? (lb ? { barra: 45, paso: 5 } : {}) : { barra: 0, paso: lb ? 5 : /mancuerna/i.test(nombre) ? 2 : 2.5 });
  return (
    <Hoja titulo="Series de aproximación" alCerrar={alCerrar}>
      <p class="peq secundario">{nombre}: hasta {pesoTxt(kg, 2)} × {reps}. Descansa lo justo entre ellas (1–2 min) y no las registres.</p>
      {!lista.length ? <p class="secundario">Con esta carga no hacen falta: calienta con 1 o 2 series ligeras.</p> : (
        <ul class="lista aproximaciones">
          {lista.map((a, i) => (
            <li key={i}>
              <label class="casilla">
                <input type="checkbox" checked={hechas.has(i)} onChange={() => setHechas((h) => { const n = new Set(h); if (n.has(i)) n.delete(i); else { n.add(i); sonarFBE('aproximacion', { n: i + 1 }); } return n; })} />
                <span><strong class="num">{num(a.kg, 2)} {etiquetaPeso()} × {a.reps}</strong>{conBarra && <Placas kg={a.kg} etiqueta="" />}</span>
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
