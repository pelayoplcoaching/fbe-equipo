import { useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Vacio } from '../comunes.jsx';
import { hoyISO, sumarDias, desdeISO } from '../../logica/fechas.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dia(iso, hoy) {
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  const d = desdeISO(iso);
  return `${DIAS[d.getDay()].charAt(0).toUpperCase()}${DIAS[d.getDay()].slice(1)}, ${d.getDate()} ${MES[d.getMonth()]}`;
}
const FILTROS = [['todo', 'Todo'], ['sesion', 'Sesiones'], ['record', 'Récords'], ['checkin', 'Check-ins'], ['mensaje', 'Mensajes']];

// Lo que ha hecho el atleta, día a día (como el feed de actividad de Trainerize o TrueCoach)
export function Actividad({ atleta, irA }) {
  const { api } = useApp();
  const [dias, setDias] = useState(30);
  const [filtro, setFiltro] = useState('todo');
  const res = useCarga(() => api.actividad(atleta.id, dias), [atleta.id, dias]);
  const hoy = hoyISO();
  const lista = (res.datos || []).filter((e) => filtro === 'todo' || e.tipo === filtro || (filtro === 'mensaje' && ['video', 'foto'].includes(e.tipo)));
  const grupos = [];
  for (const e of lista) { const g = grupos[grupos.length - 1]; if (g && g.fecha === e.fecha) g.items.push(e); else grupos.push({ fecha: e.fecha, items: [e] }); }
  return (
    <div class="pila">
      <div class="selector-chips" role="group" aria-label="Qué ver">
        {FILTROS.map(([k, t]) => <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      {res.cargando && !res.datos ? <Siluetas forma="lista" n={6} texto="Cargando su actividad" /> : !lista.length ? (
        <div class="panel"><Vacio icono="historial" titulo={`Nada en los últimos ${dias} días`}>Cuando entrene, se pese, envíe su check-in o te escriba, aparecerá aquí.</Vacio></div>
      ) : (
        <ol class="actividad">
          {grupos.map((g) => (
            <li key={g.fecha} class="actividad-dia">
              <h2 class="mini">{dia(g.fecha, hoy)}</h2>
              <ul class="panel lista">
                {g.items.map((e, i) => (
                  <li key={i}>
                    <button class={`actividad-item act-${e.tipo}`} onClick={() => irA(e.pestana)}>
                      <span class="actividad-ico" aria-hidden="true"><Icono n={e.icono} /></span>
                      <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{e.aviso && <span class="chip aviso">{e.tipo === 'video' || e.tipo === 'foto' ? 'Por revisar' : 'Mírale'}</span>}</span>
                        {e.detalle && <span class="peq secundario">{e.detalle}</span>}</span>
                      <Icono n="derecha" />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {res.datos && <button class="btn btn-peq" style="justify-self:start" onClick={() => setDias(dias + 30)}>Ver 30 días más</button>}
    </div>
  );
}
