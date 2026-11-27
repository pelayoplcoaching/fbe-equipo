// «Tus meses», en Progreso (y en la ficha, para el coach): los meses acabados, para volver a verlos. Va aparte de TuMes.jsx
// (que sale al abrir, por la tarjeta del mes en Hoy) para que sus estilos (belleza 180: el paisaje a sangre) vayan con su
// trozo y no pesen al abrir la app.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Cargando, PortadaHistoria } from '../comunes.jsx';
import { conNutricion, conEntrenamiento } from '../../logica/nivel.js';
import { mesConAnio } from '../../logica/mes.js';
import { imagenMes } from '../../logica/imagenes.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { CalendarioMes, HistoriaMes } from './TuMes.jsx';

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function TusMeses({ atletaId = null, atleta: deQuien = null, salud = true, esCoach = false }) {
  const { api, atleta: yo } = useApp();
  const a = deQuien || yo;
  const id = atletaId || a.id;
  const lista = useCarga(() => api.resumenesMensuales(id, { n: 6, salud, nutricion: conNutricion(a), entrenamiento: conEntrenamiento(a) }).catch(() => []), [id, salud]);
  const [abierto, setAbierto] = useState(null);
  if (lista.cargando && !lista.datos) return esCoach ? <section class="seccion"><h2>Sus meses</h2><div class="panel panel-pad"><Cargando /></div></section> : null;
  if (!lista.datos?.length) return null;
  return (
    <section class="seccion">
      <h2>{esCoach ? 'Sus meses' : 'Tus meses'}</h2>
      <div class="panel">
        <ul class="lista">
          {lista.datos.map((r) => (
            <li key={r.mes}>
              {/* (belleza 180) el paisaje del mes a sangre, con un velo a la izquierda, y sus días encima */}
              <button class={`fila-semana ${hayImagen(imagenMes(r.mes)) ? 'con-mini amb-mes' : ''}`} onClick={() => setAbierto(r)}>
                <Imagen id={imagenMes(r.mes)} clase="mes-mini" tamanos="(min-width: 640px) 560px, 92vw" />
                {hayImagen(imagenMes(r.mes)) && <i class="amb-mes-velo" aria-hidden="true" />}
                <span class="pila-xs">
                  <strong>{capital(mesConAnio(r.mes))}</strong>
                  <span class="peq secundario">{r.conEntreno ? `${r.sesiones.hechas} de ${r.sesiones.previstas || r.sesiones.hechas} sesiones, ${r.dias} días entrenando${r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}` : r.nutricion?.dias ? `${r.nutricion.dias} días de nutrición apuntados` : 'Hábitos del mes'}</span>
                  {/* (v0.204) el mes en miniatura: un punto por día entrenado */}
                  {r.conEntreno && r.diasEntrenados && <CalendarioMes mes={r.mes} dias={r.diasEntrenados} mini />}
                </span>
                <PortadaHistoria tono="mes peq" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {abierto && <HistoriaMes resumen={abierto} salud={salud} conCompartir={!esCoach} nombre={esCoach ? a.nombre.split(' ')[0] : null} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}
