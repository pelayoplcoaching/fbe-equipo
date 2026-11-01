import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Cargando, ErrorCaja, Segmentos } from '../comunes.jsx';
import { useUrls } from '../CompararFotos.jsx';
import { rangoSemana, fmtCorta } from '../../logica/fechas.js';

const POSES = [['frente', 'Frente'], ['perfil', 'Perfil'], ['espalda', 'Espalda']];

// Comparar dos check-ins (v0.48, como la «Response Comparison» de Everfit): dos semanas lado a lado, con el peso y
// las medidas y su diferencia, cada respuesta y las fotos de progreso de esos días
export function CompararCheckins({ atleta, checkins, alCerrar }) {
  const { api } = useApp();
  const orden = [...checkins].sort((a, b) => (a.semana_inicio < b.semana_inicio ? 1 : -1));
  const [b, setB] = useState(orden[0]?.id);
  const [a, setA] = useState((orden[4] || orden[orden.length - 1])?.id);
  const d = useCarga(() => (a && b && a !== b ? api.compararCheckins(atleta.id, a, b) : Promise.resolve(null)), [a, b]);
  const c = d.datos;
  return (
    <Hoja titulo="Comparar check-ins" alCerrar={alCerrar} ancho={820}>
      <div class="pila">
        <div class="rejilla-campos comparar-elegir">
          <div class="campo"><label for="cmp-a">Antes</label>
            <select id="cmp-a" class="selector" value={a} onChange={(e) => setA(e.currentTarget.value)}>{orden.map((x) => <option key={x.id} value={x.id}>{rangoSemana(x.semana_inicio)}</option>)}</select></div>
          <div class="campo"><label for="cmp-b">Después</label>
            <select id="cmp-b" class="selector" value={b} onChange={(e) => setB(e.currentTarget.value)}>{orden.map((x) => <option key={x.id} value={x.id}>{rangoSemana(x.semana_inicio)}</option>)}</select></div>
        </div>
        {a === b ? <p class="peq secundario">Elige dos semanas distintas.</p> : <ErrorCaja error={d.error} reintentar={d.recargar} />}
        {a !== b && (d.cargando && !c ? <Cargando texto="Preparando la comparación" /> : c && (
          <>
            <div class="tabla-env">
              <table class="tabla-simple tabla-comparar" lang="es">
                <caption class="sr">{`Check-in de ${rangoSemana(c.antes.checkin.semana_inicio)} frente al de ${rangoSemana(c.despues.checkin.semana_inicio)}`}</caption>
                <thead><tr><th scope="col"><span class="sr">Dato</span></th><th scope="col">{rangoSemana(c.antes.checkin.semana_inicio)}</th><th scope="col">{rangoSemana(c.despues.checkin.semana_inicio)}</th></tr></thead>
                <tbody>
                  {c.filas.map((f) => (
                    <tr key={f.clave}>
                      <th scope="row">{f.nombre}</th>
                      <td class={typeof f.a === 'number' ? 'num' : ''}>{f.texto(f.a)}</td>
                      <td class={typeof f.b === 'number' ? 'num' : ''}>{f.texto(f.b)}{f.difTexto && <span class={`dif ${f.dif === 0 ? '' : 'cambia'}`}>{f.difTexto}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FotosLado antes={c.antes} despues={c.despues} />
            <p class="mini terciario">El peso y las medidas son los de esa semana (o los más cercanos, a 3 días). Las fotos, las de esos días.</p>
          </>
        ))}
      </div>
    </Hoja>
  );
}

function FotosLado({ antes, despues }) {
  const poses = POSES.filter(([p]) => antes.fotos.some((f) => f.pose === p) || despues.fotos.some((f) => f.pose === p));
  const [pose, setPose] = useState(poses[0]?.[0] || null);
  const fa = antes.fotos.find((f) => !pose || f.pose === pose) || antes.fotos[0] || null;
  const fd = despues.fotos.find((f) => !pose || f.pose === pose) || despues.fotos[0] || null;
  const urls = useUrls([fa, fd].filter(Boolean));
  if (!fa && !fd) return <p class="peq secundario">No hay fotos de progreso de esas semanas.</p>;
  return (
    <section class="pila-s">
      <h3 class="sub-seccion">Fotos de esas semanas</h3>
      {poses.length > 1 && <Segmentos opciones={poses} valor={pose} etiqueta="Pose" alCambiar={(v) => v && setPose(v)} />}
      <div class="comparar-lado">
        {[['Antes', fa], ['Después', fd]].map(([t, f]) => (
          <figure key={t}>
            {f ? (urls[f.id] ? <img src={urls[f.id]} alt={`${t}: foto del ${fmtCorta(f.fecha)}`} /> : <span class="tira-vacia" />) : <span class="sin-foto peq secundario">Sin foto</span>}
            <figcaption class="mini num">{t}{f ? `, ${fmtCorta(f.fecha)}` : ''}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
