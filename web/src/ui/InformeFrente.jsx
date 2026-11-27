// (belleza 177) El informe del bloque: este bloque y el anterior, en dos columnas (la de este, en tinta; la del anterior, en
// gris). Va en su trozo (lo carga InformeBloque.jsx con perezoso): el informe sale al abrir, porque Hoy lo usa, y así ni este
// código ni sus estilos (ambas-i.css, .amb-frente) pesan en el arranque. Sin el peso corporal ni nada de salud.
import { pesoTxt } from '../logica/unidades.js';
import { num } from '../logica/calculos.js';

const toneladas = (kg) => num(Math.round(kg / 100) / 10, 1);

// r: el informe del bloque (logica); ant: el del bloque anterior ({ numero, sesiones, pctSeries, tonelaje, records, e1rm })
export function FrenteBloques({ r, ant }) {
  const c = r.cumplimiento;
  return (
    <section class="pila-s">
      <h3>Este bloque y el anterior</h3>
      <table class="amb-frente">
        <thead><tr><td /><th scope="col">Este bloque</th><th scope="col">{ant.numero ? `Bloque ${ant.numero}` : 'El anterior'}</th></tr></thead>
        <tbody>
          <tr><th scope="row">Sesiones</th><td class="num">{r.sesiones.hechas}</td><td class="num">{ant.sesiones ?? '—'}</td></tr>
          {c.series.pct != null && ant.pctSeries != null && <tr><th scope="row">Series pautadas hechas</th><td class="num">{c.series.pct} %</td><td class="num">{ant.pctSeries} %</td></tr>}
          <tr><th scope="row">Toneladas</th><td class="num">{toneladas(r.tonelaje)}</td><td class="num">{ant.tonelaje != null ? toneladas(ant.tonelaje) : '—'}</td></tr>
          <tr><th scope="row">Récords</th><td class="num">{r.records.length}</td><td class="num">{ant.records ?? '—'}</td></tr>
          {r.principales.filter((x) => ant.e1rm?.[x.ejercicio_id] != null).map((x) => (
            <tr key={x.ejercicio_id}><th scope="row">{x.nombre} <span class="mini terciario">(1RM)</span></th><td class="num">{pesoTxt(x.fin.e1rm, 1)}</td><td class="num">{pesoTxt(ant.e1rm[x.ejercicio_id], 1)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
