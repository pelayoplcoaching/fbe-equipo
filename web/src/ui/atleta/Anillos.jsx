// v0.51: los anillos de la semana en Progreso, como los de Apple: sesiones (las de la semana), hábitos (si tiene) y
// check-in (el de la semana). Al cerrarse uno, una sola celebración (el trazo se completa y brilla, y vibra si está
// activado), una vez por anillo y semana en este móvil. Con «reducir movimiento», quietos.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { anillosSemana, anillosPorCelebrar } from '../../logica/tablero.js';
import { hoyISO, lunesDe } from '../../logica/fechas.js';
import { vibrar } from '../hapticos.js';

const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento: celebra otra vez la próxima */ } };

export function AnillosSemana({ programa, salud, checkinSemana }) {
  const { api, atleta, propio } = useApp();
  const habitos = useCarga(() => (salud ? api.resumenHabitos(atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id, salud]);
  const p = programa?.datos;
  const sesiones = p?.actual ? p.sesiones[p.actual.id] || [] : [];
  const conCheckin = salud && !propio;
  const listo = !!p && habitos.datos != null && (!conCheckin || checkinSemana?.datos != null);
  const anillos = useMemo(() => (listo ? anillosSemana({ sesiones, habitos: habitos.datos, checkin: checkinSemana?.datos?.checkin || null, conCheckin }) : null),
    [listo, sesiones, habitos.datos, checkinSemana?.datos, conCheckin]);
  // Qué celebrar: lo cerrado esta semana que aún no se ha celebrado en este móvil (se apunta al momento)
  const clave = `fbe-anillos-${atleta.id}`;
  const [celebrar, setCelebrar] = useState([]);
  const hecho = useRef(false);
  useEffect(() => {
    if (!anillos || hecho.current) return;
    hecho.current = true;
    const r = anillosPorCelebrar(anillos, leer(clave), lunesDe(hoyISO()));
    if (!r.celebrar.length) return;
    guardar(clave, r.guardar);
    setCelebrar(r.celebrar);
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setTimeout(() => vibrar('anillo'), 700);
  }, [anillos]);
  if (!anillos || !sesiones.length) return null;
  const T = 136, G = 13, H = 3;
  const radio = (i) => T / 2 - G / 2 - i * (G + H);
  const cerrados = anillos.filter((a) => a.cerrado).length;
  return (
    <section class="seccion" aria-labelledby="anillos-t">
      <div class="seccion-cab"><h2 id="anillos-t">Tu semana</h2>{cerrados > 0 && <span class="peq secundario num">{cerrados} de {anillos.length} cerrados</span>}</div>
      <div class="panel anillos-semana">
        <svg class="anillos-svg" viewBox={`0 0 ${T} ${T}`} role="img" aria-label={`Anillos de la semana: ${anillos.map((a) => `${a.nombre}, ${a.texto}${a.cerrado ? ', cerrado' : ''}`).join('; ')}`}>
          {anillos.map((a, i) => {
            const r = radio(i), C = 2 * Math.PI * r;
            const resto = C * (1 - a.frac);
            const fiesta = celebrar.includes(a.id);
            return (
              <g key={a.id} data-anillo={a.id} class={fiesta ? 'celebra' : ''} transform={`rotate(-90 ${T / 2} ${T / 2})`} style={{ '--desde': `${C * 0.3}px` }}>
                <circle class="pista" cx={T / 2} cy={T / 2} r={r} stroke-width={G} />
                {a.frac > 0 && <circle class="brillo" cx={T / 2} cy={T / 2} r={r} stroke-width={G} stroke-dasharray={`${C} ${C}`} />}
                {a.frac > 0 && <circle class="lleno" cx={T / 2} cy={T / 2} r={r} stroke-width={G} stroke-dasharray={`${C} ${C}`} stroke-dashoffset={resto} />}
              </g>
            );
          })}
        </svg>
        <ul class="anillos-leyenda">
          {anillos.map((a) => (
            <li key={a.id} data-anillo={a.id}>
              <span class="punto" aria-hidden="true" />
              <span class="nombre">{a.nombre}</span>
              <span class="valor"><span class="num">{a.texto}</span>{a.cerrado && <span class="cerrado"><Icono n="hecho" />Cerrado</span>}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
