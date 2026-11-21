import { useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Vacio } from '../comunes.jsx';
import { hoyISO, sumarDias, desdeISO, lunesDe, fmtCorta } from '../../logica/fechas.js';
import { semanasActividad, textoSemanaActividad, agruparRecords } from '../../logica/progreso-visual-2.js';

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
  const { api, aviso } = useApp();
  const [dias, setDias] = useState(30);
  // v0.66: «Bien hecho» con un toque (un mensaje en el hilo de esa sesión; le llega el aviso)
  const [felicitadas, setFelicitadas] = useState(() => new Set());
  const [enviando, setEnviando] = useState(null);
  const felicitar = async (e) => {
    if (enviando) return;
    setEnviando(e.sesionId);
    try {
      await api.felicitar(atleta.id, e.sesionId, e.nombreSesion);
      setFelicitadas((f) => new Set([...f, e.sesionId]));
      aviso(`«Bien hecho» enviado a ${atleta.nombre?.split(' ')[0] || 'tu atleta'}`, 'ok');
    } catch (err) { aviso(err?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
    setEnviando(null);
  };
  const [filtro, setFiltro] = useState('todo');
  const res = useCarga(() => api.actividad(atleta.id, dias), [atleta.id, dias]);
  const hoy = hoyISO();
  const lista = (res.datos || []).filter((e) => filtro === 'todo' || e.tipo === filtro || (filtro === 'mensaje' && ['video', 'foto'].includes(e.tipo)));
  const grupos = [];
  for (const e of lista) { const g = grupos[grupos.length - 1]; if (g && g.fecha === e.fecha) g.items.push(e); else grupos.push({ fecha: e.fecha, items: [e] }); }
  // (v0.204) las cifras de cada semana (de todo, con el filtro que sea), para su banda entre semana y semana
  const porSemana = semanasActividad(res.datos || []);
  const [abiertos, setAbiertos] = useState(() => new Set());
  return (
    <div class="pila">
      <div class="selector-chips" role="group" aria-label="Qué ver">
        {FILTROS.map(([k, t]) => <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      {res.cargando && !res.datos ? <Siluetas forma="lista" n={6} texto="Cargando su actividad" /> : !lista.length ? (
        <div class="panel"><Vacio ilustracion="actividad" icono="historial" titulo={`Nada en los últimos ${dias} días`}>Cuando entrene, se pese, envíe su check-in o te escriba, aparecerá aquí.</Vacio></div>
      ) : (
        <ol class="actividad">
          {grupos.map((g, k) => {
            const w = lunesDe(g.fecha);
            const nuevaSemana = k === 0 || lunesDe(grupos[k - 1].fecha) !== w;
            return (
            <li key={g.fecha} class="actividad-dia">
              {nuevaSemana && porSemana[w] && (
                <p class="actividad-semana peq">
                  <strong>{w === lunesDe(hoy) ? 'Esta semana' : `Semana del ${fmtCorta(w)}`}</strong>
                  <span class="secundario">{textoSemanaActividad(porSemana[w])}</span>
                </p>
              )}
              <h2 class="mini">{dia(g.fecha, hoy)}</h2>
              <ul class="panel lista">
                {agruparRecords(g.items).map((e, i) => (e.tipo === 'records' ? (
                  <li key={i} class="actividad-records">
                    <button class="actividad-item act-record" aria-expanded={abiertos.has(g.fecha) ? 'true' : 'false'}
                      onClick={() => setAbiertos((a) => { const n = new Set(a); if (n.has(g.fecha)) n.delete(g.fecha); else n.add(g.fecha); return n; })}>
                      <span class="actividad-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                      <span class="pila-xs"><span class="actividad-titulo">{e.titulo}</span>
                        <span class="trofeos-fila" aria-hidden="true">{e.records.slice(0, 8).map((r, j) => <Icono key={j} n="trofeo" />)}</span>
                        <span class="peq secundario">{e.records.map((r) => r.titulo.replace(/^R\u00e9cord en /, '')).join(', ')}</span></span>
                      <Icono n="abajo" />
                    </button>
                    {abiertos.has(g.fecha) && (
                      <ul class="actividad-records-lista">
                        {e.records.map((r, j) => (
                          <li key={j}>
                            <button class="actividad-item act-record" onClick={() => irA(r.pestana)}>
                              <span class="pila-xs"><span class="actividad-titulo">{r.titulo}</span>{r.detalle && <span class="peq secundario">{r.detalle}</span>}</span>
                              <Icono n="derecha" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ) : (
                  <li key={i}>
                    <button class={`actividad-item act-${e.tipo}`} onClick={() => irA(e.pestana)}>
                      <span class="actividad-ico" aria-hidden="true"><Icono n={e.icono} /></span>
                      <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{e.aviso && <span class="chip aviso">{e.tipo === 'video' || e.tipo === 'foto' ? 'Por revisar' : 'Mírale'}</span>}</span>
                        {e.detalle && <span class="peq secundario">{e.detalle}</span>}</span>
                      <Icono n="derecha" />
                    </button>
                    {e.tipo === 'sesion' && e.sesionId && (e.comentada || felicitadas.has(e.sesionId)
                      ? <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> {felicitadas.has(e.sesionId) ? '«Bien hecho» enviado' : 'Ya le has escrito'}</span>
                      : <button class="btn btn-peq actividad-kudos" disabled={enviando === e.sesionId} onClick={() => felicitar(e)} aria-label={`Decirle «Bien hecho» por ${e.nombreSesion || 'este entreno'}`}>💪 Bien hecho</button>)}
                  </li>
                )))}
              </ul>
            </li>
            );
          })}
        </ol>
      )}
      {res.datos && <button class="btn btn-peq" style="justify-self:start" onClick={() => setDias(dias + 30)}>Ver 30 días más</button>}
    </div>
  );
}
