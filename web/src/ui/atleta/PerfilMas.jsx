// (perfil, tanda 4) Las 20 mejoras del perfil del atleta (las cuentas, en logica/perfil-mas.js):
//   · DiaUnoYHoy: el día 1 y hoy en sus ejercicios (Resumen)
//   · MarcasPorReps: su mejor peso a 1, 3, 5, 8, 10 y 12 repeticiones (Logros)
//   · FilaCorrecciones: «Lo que te ha corregido tu coach», por ejercicio (Tu asesoría)
//   · CompletaPerfil: «Tu perfil al 70 %» y lo que falta, que abre su fila (arriba)
//   · IndicePerfil: Tú · Lo tuyo · Ajustes, y el buscador del perfil (arriba)
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, FilaIos } from '../comunes.jsx';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';
import { pesoNum, etiquetaPeso } from '../../logica/unidades.js';
import { textoManual } from '../../logica/respeto.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { diaUnoYHoy, marcasPorReps, ejerciciosConMarcas, correccionesPorEjercicio, completarPerfil } from '../../logica/perfil-mas.js';
import { usePersonal } from './Personal.jsx';

const kgTxt = (kg) => `${pesoNum(kg, 1)} ${etiquetaPeso()}`;
export function useHistorial() {
  const { api, atleta } = useApp();
  return useCarga(() => api.historial(atleta.id).catch(() => []), [atleta.id]);
}

// ---------- 1. El día 1 y hoy ----------
export function DiaUnoYHoy({ historial }) {
  const personal = usePersonal();
  const lista = useMemo(() => diaUnoYHoy(historial || [], { favoritos: personal.datos?.favoritos || [], hoy: hoyISO() }), [historial, personal.datos]);
  if (!lista.length) return null;
  return (
    <section class="seccion perfil-sec dia-uno" aria-labelledby="dia-uno-t">
      <h2 id="dia-uno-t">El día 1 y hoy</h2>
      <ul class="panel dia-uno-lista">
        {lista.map((x) => (
          <li key={x.id} class="dia-uno-fila">
            <span class="pila-xs dia-uno-texto">
              <strong>{x.nombre}</strong>
              <span class="mini terciario">El {fmtCorta(x.fecha)}: {kgTxt(x.kg)} × {x.reps} (1RM est. {kgTxt(x.antes)})</span>
            </span>
            <span class="dia-uno-hoy">
              <span class="num">{kgTxt(x.ahora)}</span>
              <span class={`mini num ${x.pct > 0 ? 'ok-texto' : 'terciario'}`}>{x.pct > 0 ? `+${x.pct} %` : x.pct === 0 ? 'igual' : `${x.pct} %`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p class="mini terciario">Tu mejor 1RM estimado de las últimas 6 semanas frente a tu primera sesión de cada ejercicio en la app.</p>
    </section>
  );
}

// ---------- 3. Tus marcas por repeticiones ----------
export function MarcasPorReps({ historial }) {
  const personal = usePersonal();
  const ejercicios = useMemo(() => ejerciciosConMarcas(historial || []), [historial]);
  const fav = (personal.datos?.favoritos || []).find((id) => ejercicios.some((e) => e.id === id));
  const [elegido, setElegido] = useState(null);
  const id = elegido || fav || ejercicios[0]?.id;
  const marcas = useMemo(() => (id ? marcasPorReps(historial || [], id) : []), [historial, id]);
  if (!ejercicios.length) return null;
  return (
    <section class="seccion perfil-sec marcas-reps" aria-labelledby="marcas-reps-t">
      <h2 id="marcas-reps-t">Tus marcas por repeticiones</h2>
      <div class="panel panel-pad pila-s">
        <select class="entrada" aria-label="Ejercicio" value={id} onChange={(e) => setElegido(e.currentTarget.value)}>
          {ejercicios.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <table class="marcas-reps-tabla">
          <thead><tr><th scope="col">Repeticiones</th><th scope="col">Tu mejor peso</th><th scope="col">Desde</th></tr></thead>
          <tbody>
            {marcas.map((m) => (
              <tr key={m.reps} class={m.kg == null ? 'sin' : ''}>
                <th scope="row" class="num">{m.reps === 1 ? '1 (RM)' : m.reps}</th>
                <td class="num">{m.kg == null ? '—' : kgTxt(m.kg)}</td>
                <td class="mini terciario">{m.fecha ? fmtCorta(m.fecha) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="mini terciario">El peso más alto con el que hiciste al menos esas repeticiones, sin contar el esfuerzo.</p>
      </div>
    </section>
  );
}

// ---------- 9. Lo que te ha corregido tu coach ----------
export function FilaCorrecciones() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <FilaIos icono="video" titulo="Lo que te ha corregido tu coach" detalle="Sus correcciones, por ejercicio" alTocar={() => setAbierta(true)} etiqueta="Ver lo que te ha corregido tu coach" />
      {abierta && <HojaCorrecciones alCerrar={() => setAbierta(false)} />}
    </>
  );
}
function HojaCorrecciones({ alCerrar }) {
  const { api, atleta } = useApp();
  const d = useCarga(async () => {
    const [videos, recordatorios, progreso] = await Promise.all([
      api.diario(atleta.id).catch(() => []), api.recordatoriosActivos(atleta.id).catch(() => []), api.progreso(atleta.id).catch(() => null),
    ]);
    const nombres = Object.fromEntries((progreso?.ejercicios || []).map((e) => [e.id, e.nombre]));
    return correccionesPorEjercicio({ videos, recordatorios, nombres });
  }, [atleta.id]);
  return (
    <Hoja titulo="Lo que te ha corregido tu coach" alCerrar={alCerrar}>
      <div class="pila correcciones-hoja">
        <p class="peq secundario">Lo que tu coach te ha fijado como recordatorio y lo que marcó a mejorar en tu último vídeo de cada ejercicio. Para repasarlo antes de entrenar.</p>
        {d.cargando && !d.datos ? <p class="peq terciario" role="status">Cargando…</p> : !d.datos?.length ? (
          <p class="peq terciario">Aún no hay correcciones. Cuando tu coach revise un vídeo tuyo, lo que te marque saldrá aquí.</p>
        ) : (
          <ul class="lista correcciones-lista">
            {d.datos.map((x) => (
              <li key={x.id} class="correccion-ej pila-xs">
                <span class="separa"><strong>{x.nombre}</strong>{x.fecha && <span class="mini terciario">{fmtCorta(x.fecha)}</span>}</span>
                {x.recordatorios.map((t, i) => <span key={`r${i}`} class="peq correccion-item fijado"><Icono n="bandera" />{t}</span>)}
                {x.fallos.map((t, i) => <span key={`f${i}`} class="peq correccion-item"><Icono n="alerta" />{t}</span>)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

// ---------- 15. Completa tu perfil ----------
const CLAVE_LUEGO = (id) => `fbe-completa-luego-${id}`;
export function abrirFilaPerfil(fila) {
  if (typeof document === 'undefined') return false;
  const el = fila === 'foto'
    ? [...document.querySelectorAll('#grupo-asesoria button')].find((b) => /Poner foto|Cambiar/.test(b.textContent || ''))
    : document.querySelector(`.perfil [aria-label="${fila}"]`);
  if (!el) return false;
  el.scrollIntoView?.({ block: 'center' });
  el.click();
  return true;
}
export function CompletaPerfil() {
  const { api, atleta, perfil, propio } = useApp();
  // (como «Lo tuyo»: undefined = sin la migración de lo personal, y entonces nada; null = aún sin rellenar nada)
  const personal = useCarga(() => api.personal().then((x) => (x === undefined ? undefined : x || {})).catch(() => undefined), [atleta.id]);
  const [luego, setLuego] = useState(() => { try { return Number(localStorage.getItem(CLAVE_LUEGO(atleta.id))) > Date.now(); } catch { return false; } });
  const [todos, setTodos] = useState(false);
  if (propio || luego || !personal.datos) return null;
  const p = personal.datos;
  const r = completarPerfil(p, { foto: perfil?.foto || perfil?.foto_grande || null, entrena: conEntrenamiento(atleta), manualEscrito: !!textoManual(p) });
  if (!r.faltan.length) return null;
  const ahoraNo = () => { try { localStorage.setItem(CLAVE_LUEGO(atleta.id), String(Date.now() + 14 * 864e5)); } catch { /* */ } setLuego(true); };
  const radio = 22, c = 2 * Math.PI * radio;
  return (
    <section class="panel panel-pad completa-perfil" aria-labelledby="completa-perfil-t">
      <div class="completa-cab">
        <svg class="completa-aro" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={radio} class="completa-carril" />
          <circle cx="26" cy="26" r={radio} class="completa-arco" stroke-dasharray={c} stroke-dashoffset={c * (1 - r.pct / 100)} transform="rotate(-90 26 26)" />
          <text x="26" y="30" text-anchor="middle" class="completa-pct">{r.pct}%</text>
        </svg>
        <span class="pila-xs">
          <strong id="completa-perfil-t">Tu perfil, al {r.pct} %</strong>
          <span class="peq secundario">Te {r.faltan.length === 1 ? 'falta' : 'faltan'} {r.faltan.length > 2 ? `${r.faltan.slice(0, 2).map((h) => h.titulo.toLocaleLowerCase('es')).join(', ')} y ${r.faltan.length - 2} ${r.faltan.length - 2 === 1 ? 'cosa' : 'cosas'} más` : r.faltan.map((h) => h.titulo.toLocaleLowerCase('es')).join(' y ')}.</span>
        </span>
      </div>
      <ul class="completa-lista">
        {(todos ? r.faltan : r.faltan.slice(0, 3)).map((h) => (
          <li key={h.clave}>
            <button type="button" class="completa-hueco" onClick={() => abrirFilaPerfil(h.fila)}>
              <span class="pila-xs"><span class="completa-titulo">{h.titulo}</span><span class="mini terciario">{h.para}</span></span>
              <Icono n="derecha" />
            </button>
          </li>
        ))}
      </ul>
      <span class="fila-envolver completa-pie">
        {!todos && r.faltan.length > 3 && <button type="button" class="btn-texto mini" onClick={() => setTodos(true)}>Ver {r.faltan.length - 3 === 1 ? 'la otra' : `las otras ${r.faltan.length - 3}`}</button>}
        <button type="button" class="btn-texto mini" onClick={ahoraNo}>Ahora no</button>
      </span>
    </section>
  );
}

// ---------- 14. Tú · Lo tuyo · Ajustes, y el buscador ----------
const SECCIONES = [['tu', 'Tú', '.perfil-cabeza'], ['tuyo', 'Lo tuyo', '#grupo-asesoria'], ['ajustes', 'Ajustes', '#grupo-conexiones, #grupo-este-movil']];
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function irA(sel) {
  const el = document.querySelector(sel.split(',').map((s) => `.perfil ${s.trim()}`).join(','));
  if (!el) return;
  (el.closest('section') || el).scrollIntoView({ behavior: 'smooth', block: 'start' });
}
export function IndicePerfil() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const caja = useRef(null);
  useEffect(() => {
    const t = sinTildes(q).trim();
    if (t.length < 2) { setRes([]); return; }
    const filas = [...document.querySelectorAll('.perfil .fila-ios-li, .perfil li.fila-ios, .perfil .seccion h2')];
    const vistos = new Set();
    const out = [];
    for (const el of filas) {
      const titulo = (el.matches('h2') ? el.textContent : el.querySelector('.fila-ios-titulo')?.textContent || '').trim();
      if (!titulo || vistos.has(titulo) || !sinTildes(`${titulo} ${el.textContent || ''}`).includes(t)) continue;
      vistos.add(titulo);
      const grupo = el.closest('section')?.querySelector('h2, .grupo-ios-titulo')?.textContent?.trim() || '';
      out.push({ titulo, grupo: grupo !== titulo ? grupo : '', el });
      if (out.length >= 6) break;
    }
    setRes(out);
  }, [q]);
  const ir = (x) => {
    x.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    x.el.classList.add('destello-busqueda');
    setTimeout(() => x.el.classList.remove('destello-busqueda'), 1800);
    setQ('');
  };
  return (
    <nav class="indice-perfil" aria-label="Ir a una parte de tu perfil" ref={caja}>
      <span class="indice-perfil-chips">
        {SECCIONES.map(([k, t, sel]) => <button key={k} type="button" class="chip indice-chip" onClick={() => irA(sel)}>{t}</button>)}
      </span>
      <span class="indice-buscar">
        <Icono n="buscar" />
        <input class="entrada" type="search" aria-label="Buscar en tu perfil" placeholder="Buscar: notificaciones, libras, música…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </span>
      {q.trim().length >= 2 && (
        <ul class="panel indice-resultados" role="list" aria-live="polite">
          {res.length ? res.map((x) => (
            <li key={x.titulo}><button type="button" class="indice-resultado" onClick={() => ir(x)}><span>{x.titulo}</span>{x.grupo && <span class="mini terciario">{x.grupo}</span>}</button></li>
          )) : <li class="peq terciario indice-nada">Nada con «{q.trim()}»</li>}
        </ul>
      )}
    </nav>
  );
}
