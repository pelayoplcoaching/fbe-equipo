// Lo de carrera que ven el coach y el atleta (v0.133): la tabla de zonas, la barra del macrociclo y las partes de una sesión
import { fmtCorta, hoyISO } from '../logica/fechas.js';
import { textoRangoZona, textoRitmo, macrociclo, semanaDelPlan, textoParte, NOMBRE_FASE } from '../logica/carrera.js';

export function TablaZonas({ zonas, umbral = null }) {
  return (
    <div class="tabla-zonas-env">
      <table class="tabla-zonas">
        <caption class="sr">Zonas de frecuencia cardiaca</caption>
        <thead><tr><th scope="col">Zona y cómo se siente</th><th scope="col">FC</th></tr></thead>
        <tbody>
          {zonas.map((z) => (
            <tr key={z.z} data-zona={z.z}>
              <th scope="row"><span class="zona-pastilla" data-zona={z.z}>Z{z.z}</span> {z.nombre}<span class="zona-siente mini secundario">{z.siente}</span></th>
              <td class="num">{textoRangoZona(z)}{z.z === 4 && umbral ? <span class="zona-umbral mini secundario">{textoRitmo(umbral)}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// La barra del macrociclo: cada fase con su ancho por semanas, y la semana de hoy marcada
export function Macrociclo({ perfil, hoy = hoyISO() }) {
  const fases = macrociclo(perfil);
  if (!fases.length) return null;
  const total = fases.reduce((a, f) => a + f.semanas, 0);
  const n = semanaDelPlan(perfil, hoy);
  const dentro = n >= 1 && n <= total;
  return (
    <div class="macrociclo" role="img" aria-label={`Macrociclo de ${total} semanas: ${fases.map((f) => `${f.nombre}, ${f.semanas}`).join('; ')}${dentro ? `. Ahora, semana ${n}` : ''}`}>
      <div class="macro-barra">
        {fases.map((f, i) => <span key={i} class={`macro-fase${dentro && n >= f.primera && n <= f.ultima ? ' actual' : ''}`} data-i={i % 6} style={`flex-grow:${f.semanas}`}><span class="macro-nombre">{f.nombre}</span><span class="macro-sem num">{f.semanas} sem.</span></span>)}
        {dentro && <span class="macro-hoy" style={`left:${((n - 0.5) / total) * 100}%`} aria-hidden="true" />}
      </div>
      <div class="macro-fechas mini terciario num"><span>{fmtCorta(fases[0].desde)}</span><span>{fmtCorta(fases[fases.length - 1].hasta)}</span></div>
    </div>
  );
}


// Las partes de una sesión de carrera, en orden: la fase y lo que toca (con la FC de cada zona si se saben)
export function ListaPartes({ partes = [], zonas = null, ambar = false }) {
  if (!partes.length) return null;
  return (
    <ol class={`lista-partes${ambar ? ' en-ambar' : ''}`}>
      {partes.map((p, i) => (
        <li key={i} class="parte" data-fase={p.fase}>
          <span class="parte-fase">{NOMBRE_FASE[p.fase]}</span>
          <span class="pila-xs" style="min-width:0">
            <span class="parte-que num">{textoParte(p, zonas)}</span>
            {p.nota && <span class="mini secundario">{p.nota}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
