// (perfil, tanda 4) Las 20 mejoras del perfil del atleta (las cuentas, en logica/perfil-mas.js):
//   · DiaUnoYHoy: el día 1 y hoy en sus ejercicios (Resumen)
//   · MarcasPorReps: su mejor peso a 1, 3, 5, 8, 10 y 12 repeticiones (Logros)
//   · FilaCorrecciones: «Lo que te ha corregido tu coach», por ejercicio (Tu asesoría)
//   · CompletaPerfil: «Tu perfil al 70 %» y lo que falta, que abre su fila (arriba)
//   · IndicePerfil: Tú · Lo tuyo · Ajustes, y el buscador del perfil (arriba)
//   · (T4) DescansoPasos (Datos); AtajosPerfil (arriba); FilaPrivacidad, FilasCuentaSegura y FilaHojaCalculo (Cuenta)
//   · (T3) FilaEvitados, FilaMaterial y FilaGuardados (Perfil); RinconAnimo (Resumen); recortarPortada (la foto de portada)
//   · (T2) PalmaresYBloques: tu palmarés y tu historia de bloques; LogrosSecretos (Logros); Equivalencia (Resumen);
//     Trimestre (Datos)
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, FilaIos } from '../comunes.jsx';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';
import { pesoNum, etiquetaPeso } from '../../logica/unidades.js';
import { textoManual } from '../../logica/respeto.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { diaUnoYHoy, marcasPorReps, ejerciciosConMarcas, correccionesPorEjercicio, completarPerfil, historiaBloques, palmares, logrosSecretos, equivalenciaDelDia, delAnio, resumenTrimestre, MOTIVOS_EVITAR, textoMotivo, alternarEvitado, materialDe, TIPOS_GUARDADO, guardadosJuntos, descansoYPasos, textoHoras, ATAJOS_PERFIL, atajosValidos, alternarAtajo, privacidadDeUnVistazo, aCSV, CSV_SESIONES, CSV_SERIES, CSV_PESOS, CSV_MEDIDAS } from '../../logica/perfil-mas.js';
import { descargar } from '../comunes.jsx';
import { sumarDias } from '../../logica/fechas.js';
import { NOMBRE_MATERIAL } from '../../logica/material.js';
import { MATERIAL_PERFIL, PERFILES_DEFECTO } from '../../logica/material.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { leerApuntes } from '../apuntes.js';
import { InformeBloque, tituloBloque } from '../InformeBloque.jsx';
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
// (v0.167, con la vista «Tú / Ajustes» de la v0.166) el índice cambia de vista si hace falta, y el buscador busca en la
// vista que se ve; si lo buscado está en la otra, «Buscar en …» cambia de vista y sigue buscando allí
let pendiente = '';
export function IndicePerfil({ vista = 'tu', cambiarVista = null }) {
  const [q, setQ] = useState(() => { const t = pendiente; pendiente = ''; return t; });
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
        {SECCIONES.map(([k, t, sel]) => {
          const suya = k === 'ajustes' ? 'ajustes' : 'tu';
          const tocar = () => { if (cambiarVista && suya !== vista) { cambiarVista(suya); setTimeout(() => irA(sel), 80); } else irA(sel); };
          return <button key={k} type="button" class="chip indice-chip" aria-pressed={suya === vista && k !== 'tuyo' ? 'true' : 'false'} onClick={tocar}>{t}</button>;
        })}
      </span>
      <span class="indice-buscar">
        <Icono n="buscar" />
        <input class="entrada" type="search" aria-label="Buscar en tu perfil" placeholder="Buscar: notificaciones, libras, música…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </span>
      {q.trim().length >= 2 && (
        <ul class="panel indice-resultados" role="list" aria-live="polite">
          {res.length ? res.map((x) => (
            <li key={x.titulo}><button type="button" class="indice-resultado" onClick={() => ir(x)}><span>{x.titulo}</span>{x.grupo && <span class="mini terciario">{x.grupo}</span>}</button></li>
          )) : <li class="peq terciario indice-nada">Nada con «{q.trim()}» aquí</li>}
          {cambiarVista && <li><button type="button" class="indice-resultado indice-otra-vista" onClick={() => { pendiente = q; cambiarVista(vista === 'tu' ? 'ajustes' : 'tu'); }}>
            <span>Buscar «{q.trim()}» en {vista === 'tu' ? 'Ajustes' : 'Tú'}</span></button></li>}
        </ul>
      )}
    </nav>
  );
}

// ---------- (T2) 4. Tu palmarés y 2. tu historia de bloques ----------
export function PalmaresYBloques({ entrenos = [], semanasCompletas = 0, salud = false }) {
  const { api, atleta } = useApp();
  const d = useCarga(async () => {
    const [informes, carrera] = await Promise.all([api.informes(atleta.id, { salud }).catch(() => []), api.carrera ? api.carrera(atleta.id).catch(() => null) : null]);
    return { informes, eventos: carrera?.eventos || [] };
  }, [atleta.id, salud]);
  const [abierto, setAbierto] = useState(null);
  const records = entrenos.reduce((t, x) => t + (Number(x.records) || 0), 0);
  const estante = palmares({ informes: d.datos?.informes || [], semanasCompletas, records, eventos: d.datos?.eventos || [], hoy: hoyISO() });
  const bloques = historiaBloques(d.datos?.informes || []);
  return (
    <>
      {estante.length > 0 && (
        <section class="seccion perfil-sec palmares" aria-labelledby="palmares-t">
          <h2 id="palmares-t">Tu palmarés</h2>
          <ul class="palmares-estante">
            {estante.map((x) => (
              <li key={x.clave} class="palmares-pieza" data-clave={x.clave}>
                <span class="palmares-ico" aria-hidden="true"><Icono n={x.icono} /></span>
                <span class="num palmares-n">{x.n}</span>
                <span class="mini palmares-t">{x.titulo}</span>
                {x.detalle && <span class="mini terciario palmares-d">La última: {x.detalle}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {bloques.length > 0 && (
        <section class="seccion perfil-sec historia-bloques" aria-labelledby="historia-bloques-t">
          <h2 id="historia-bloques-t">Tu historia de bloques</h2>
          <ol class="historia-bloques-lista">
            {bloques.map((b) => (
              <li key={b.id} class="historia-bloque">
                <button type="button" class="historia-bloque-btn" onClick={() => setAbierto(b.informe)} aria-label={`Ver el informe de ${tituloBloque(b)}`}>
                  <span class="historia-bloque-punto" aria-hidden="true" />
                  <span class="pila-xs">
                    <strong>{tituloBloque(b)}</strong>
                    <span class="mini terciario">{fmtCorta(b.inicio)} – {fmtCorta(b.fin)} · {b.hechas} de {b.total} sesiones{b.records ? ` · ${b.records} ${b.records === 1 ? 'récord' : 'récords'}` : ''}</span>
                    {b.objetivo && <span class="mini">{b.logrado === true ? '✓ ' : ''}{b.objetivo}</span>}
                    {b.mejor && <span class="mini ok-texto">{b.mejor.nombre}: +{num1(b.mejor.cambio)} %</span>}
                  </span>
                  <Icono n="derecha" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {abierto && <InformeBloque informe={abierto} salud={salud} alCerrar={() => setAbierto(null)} />}
    </>
  );
}
const num1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// ---------- (T2) 5. Logros secretos ----------
export function LogrosSecretos({ entrenos = [] }) {
  const r = useMemo(() => logrosSecretos(entrenos), [entrenos]);
  if (!entrenos.length) return null;
  return (
    <section class="seccion perfil-sec logros-secretos" aria-labelledby="logros-secretos-t">
      <div class="seccion-cab"><h2 id="logros-secretos-t">Logros secretos</h2><span class="peq secundario">{r.conseguidos.length} de {r.total}</span></div>
      <ul class="panel secretos-lista">
        {r.conseguidos.map((x) => (
          <li key={x.clave} class="secreto conseguido">
            <span class="secreto-ico" aria-hidden="true"><Icono n="estrella" /></span>
            <span class="pila-xs"><strong>{x.titulo}</strong><span class="mini terciario">{x.texto} · {fmtCorta(x.fecha)}</span></span>
          </li>
        ))}
        {r.quedan > 0 && (
          <li class="secreto oculto">
            <span class="secreto-ico" aria-hidden="true"><Icono n="candado" /></span>
            <span class="pila-xs"><strong>{r.quedan === 1 ? 'Queda 1 por descubrir' : `Quedan ${r.quedan} por descubrir`}</strong><span class="mini terciario">No se ven hasta que los consigues. Entrena y aparecerán.</span></span>
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------- (T2) 6. Equivalencias ----------
export function Equivalencia({ entrenos = [] }) {
  const hoy = hoyISO();
  const frase = useMemo(() => equivalenciaDelDia(delAnio(entrenos, hoy), hoy), [entrenos, hoy]);
  if (!frase) return null;
  return <p class="peq equivalencia"><Icono n="estrella" />{frase}.</p>;
}

// ---------- (T2) 20. Tu resumen trimestral ----------
export function Trimestre({ entrenos = [], historial = [] }) {
  const r = useMemo(() => resumenTrimestre(entrenos, historial, hoyISO()), [entrenos, historial]);
  if (!r) return null;
  const dif = r.sesiones - r.antes;
  return (
    <section class="seccion perfil-sec trimestre" aria-labelledby="trimestre-t">
      <div class="seccion-cab"><h2 id="trimestre-t">Tu trimestre</h2><span class="peq secundario">{r.titulo}{r.completo ? '' : ', hasta hoy'}</span></div>
      <div class="panel panel-pad pila-s">
        <div class="trimestre-cifras">
          <span><b class="num">{r.sesiones}</b><span class="mini terciario">sesiones</span></span>
          <span><b class="num">{r.records}</b><span class="mini terciario">récords</span></span>
          <span><b class="num">{Math.round(r.minutos / 60)}</b><span class="mini terciario">horas</span></span>
          <span><b class="num">{String(r.toneladas).replace('.', ',')}</b><span class="mini terciario">toneladas</span></span>
        </div>
        {r.antes > 0 && <p class="peq">{dif > 0 ? `${dif} ${dif === 1 ? 'sesión más' : 'sesiones más'} que el trimestre anterior.` : dif === 0 ? 'Las mismas sesiones que el trimestre anterior.' : `${-dif} ${dif === -1 ? 'sesión menos' : 'sesiones menos'} que el trimestre anterior${r.completo ? '' : ' (aún queda trimestre)'}.`}</p>}
        {r.mejora && <p class="peq">Lo que más ha subido: <strong>{r.mejora.nombre}</strong>, <span class="ok-texto num">+{num1(r.mejora.pct)} %</span> de 1RM estimado.</p>}
      </div>
    </section>
  );
}

// =====================================================================
// (T3) 7. Lo que prefieres evitar
// =====================================================================
const normalT = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function FilaEvitados() {
  const personal = usePersonal();
  const [abierta, setAbierta] = useState(false);
  const n = (personal.datos?.evitados || []).length;
  return (
    <>
      <FilaIos icono="alerta" titulo="Lo que prefieres evitar" detalle={n ? `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}: tu coach lo ve` : 'Ejercicios que no te gustan o te molestan'} alTocar={() => setAbierta(true)} etiqueta="Lo que prefieres evitar" />
      {abierta && <HojaEvitados inicial={personal.datos?.evitados || []} alCerrar={() => setAbierta(false)} alGuardar={() => personal.recargar?.(true)} />}
    </>
  );
}
function HojaEvitados({ inicial, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const biblioteca = useCarga(() => api.biblioteca().catch(() => []), []);
  const [lista, setLista] = useState(inicial);
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const nombre = useMemo(() => Object.fromEntries((biblioteca.datos || []).map((e) => [e.id, e.nombre])), [biblioteca.datos]);
  const ya = new Set(lista.map((x) => x.ejercicio_id));
  const resultados = q.trim().length < 2 ? [] : (biblioteca.datos || []).filter((e) => e.activo !== false && !ya.has(e.id) && normalT(e.nombre).includes(normalT(q.trim()))).slice(0, 8);
  const guardar = async () => {
    setOcupado(true);
    try { await api.guardarPerfil4({ evitados: lista }); aviso('Guardado: tu coach lo verá'); alGuardar?.(); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
    setOcupado(false);
  };
  return (
    <Hoja titulo="Lo que prefieres evitar" alCerrar={alCerrar}>
      <div class="pila evitados-hoja">
        <p class="peq secundario">Tu coach lo verá en tu ficha y con un aviso si te lo pone. Tu programación no cambia; al cambiar un ejercicio en la sesión, estos no saldrán entre las alternativas.</p>
        {lista.length > 0 ? (
          <ul class="lista evitados-lista">
            {lista.map((x) => (
              <li key={x.ejercicio_id} class="evitado">
                <span class="pila-xs"><strong>{nombre[x.ejercicio_id] || 'Ejercicio'}</strong><span class={`chip chip-mini evitado-motivo m-${x.motivo}`}>{textoMotivo(x.motivo)}</span></span>
                <button type="button" class="btn-texto mini peligro" onClick={() => setLista(alternarEvitado(lista, x.ejercicio_id))} aria-label={`Quitar ${nombre[x.ejercicio_id] || 'este ejercicio'}`}>Quitar</button>
              </li>
            ))}
          </ul>
        ) : <p class="peq terciario">Aún no hay ninguno.</p>}
        {!elegido ? (
          <div class="pila-s">
            <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" aria-label="Buscar un ejercicio que evitar" placeholder="Busca un ejercicio" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
            {resultados.length > 0 && (
              <div class="lista-elegir">
                {resultados.map((e) => <button key={e.id} type="button" onClick={() => { setElegido(e); setQ(''); }}><span style="font-weight:600">{e.nombre}</span></button>)}
              </div>
            )}
            {q.trim().length >= 2 && !resultados.length && !biblioteca.cargando && <p class="mini terciario">Ninguno coincide.</p>}
          </div>
        ) : (
          <div class="panel panel-pad pila-s evitar-motivo">
            <strong>¿Por qué prefieres evitar {elegido.nombre}?</strong>
            <div class="fila-envolver" role="group" aria-label={`Motivo para evitar ${elegido.nombre}`}>
              {MOTIVOS_EVITAR.map(([k, t]) => <button key={k} type="button" class="btn btn-peq" onClick={() => { setLista(alternarEvitado(lista, elegido.id, k)); setElegido(null); }}>{t}</button>)}
            </div>
            <button type="button" class="btn-texto mini" onClick={() => setElegido(null)}>Cancelar</button>
          </div>
        )}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>Guardar</button>
      </div>
    </Hoja>
  );
}

// =====================================================================
// (T3) 8. Tu material (casa y viaje; lo ve tu coach)
// =====================================================================
export function FilaMaterial() {
  const { atleta } = useApp();
  const personal = usePersonal();
  const [abierta, setAbierta] = useState(false);
  const m = materialDe(personal.datos, leerPreferencia(`fbe-material-${atleta.id}`, PERFILES_DEFECTO));
  const n = new Set([...m.casa, ...m.viaje]).size;
  return (
    <>
      <FilaIos icono="disco" titulo="Tu material" detalle={m.deLaBase ? `${n} ${n === 1 ? 'cosa' : 'cosas'} en casa o de viaje${m.mancuernas_kg ? `; mancuernas hasta ${pesoNum(m.mancuernas_kg, 1)} ${etiquetaPeso()}` : ''}` : 'Lo que tienes en casa y de viaje'} alTocar={() => setAbierta(true)} etiqueta="Tu material" />
      {abierta && <HojaMaterial inicial={m} alCerrar={() => setAbierta(false)} alGuardar={() => personal.recargar?.(true)} />}
    </>
  );
}
function HojaMaterial({ inicial, alCerrar, alGuardar }) {
  const { api, atleta, aviso } = useApp();
  const [m, setM] = useState({ casa: [...inicial.casa], viaje: [...inicial.viaje] });
  const [kg, setKg] = useState(inicial.mancuernas_kg == null ? '' : String(inicial.mancuernas_kg).replace('.', ','));
  const [ocupado, setOcupado] = useState(false);
  const marcar = (l, k, si) => setM((x) => ({ ...x, [l]: si ? [...new Set([...x[l], k])] : x[l].filter((y) => y !== k) }));
  const guardar = async () => {
    const n = kg.trim() === '' ? null : Number(kg.replace(',', '.'));
    if (n != null && !(n >= 1 && n <= 100)) { aviso('Las mancuernas, entre 1 y 100 kg', 'error'); return; }
    setOcupado(true);
    try {
      await api.guardarPerfil4({ material: { ...m, mancuernas_kg: n } });
      // (lo de este móvil, igual: «¿Dónde entrenas hoy?» lo usa al momento)
      guardarPreferencia(`fbe-material-${atleta.id}`, { casa: m.casa, viaje: m.viaje });
      aviso('Guardado: tu coach lo verá'); alGuardar?.(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
    setOcupado(false);
  };
  return (
    <Hoja titulo="Tu material" alCerrar={alCerrar}>
      <div class="pila material-hoja">
        <p class="peq secundario">Con esto, «¿Dónde entrenas hoy?» cambia lo que no puedas hacer por las alternativas de tu coach. Tu coach lo ve, para tenerlo en cuenta.</p>
        {[['casa', 'En casa'], ['viaje', 'De viaje']].map(([l, t]) => (
          <fieldset key={l} class="pila-s material-perfil">
            <legend class="peq"><strong>{t}</strong></legend>
            {MATERIAL_PERFIL.map(([k, nombre]) => (
              <label class="casilla" key={k}><input type="checkbox" checked={m[l].includes(k)} onChange={(e) => marcar(l, k, e.currentTarget.checked)} /><span>{nombre}</span></label>
            ))}
          </fieldset>
        ))}
        <label class="campo"><span class="peq">Tus mancuernas llegan hasta (kg)</span><input class="entrada" inputmode="decimal" value={kg} onInput={(e) => setKg(e.currentTarget.value)} placeholder="Por ejemplo, 20" aria-describedby="mancuernas-ayuda" /></label>
        <span id="mancuernas-ayuda" class="mini terciario">Opcional. Si no tienes, déjalo en blanco.</span>
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>Guardar</button>
      </div>
    </Hoja>
  );
}

// =====================================================================
// (T3) 10. Tus guardados, en un sitio
// =====================================================================
export function FilaGuardados({ irA }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <FilaIos icono="estrella" titulo="Tus guardados" detalle="Ejercicios, recetas, publicaciones y apuntes" alTocar={() => setAbierta(true)} etiqueta="Tus guardados" />
      {abierta && <HojaGuardados irA={irA} alCerrar={() => setAbierta(false)} />}
    </>
  );
}
const IR_GUARDADO = { ejercicio: 'progreso', receta: 'comidas', publicacion: 'equipo' };
function HojaGuardados({ irA, alCerrar }) {
  const { api, atleta } = useApp();
  const [filtro, setFiltro] = useState('todo');
  const d = useCarga(async () => {
    const [personal, biblio, recetario, muro] = await Promise.all([
      api.personal().catch(() => null), api.biblioteca().catch(() => []),
      api.recetario ? api.recetario(atleta.id).catch(() => null) : null,
      api.muro ? api.muro({ filtro: 'guardados', limite: 30 }).catch(() => null) : null,
    ]);
    const nombres = Object.fromEntries((biblio || []).map((e) => [e.id, e.nombre]));
    const R = Object.fromEntries((recetario?.recetas || []).map((r) => [r.id, r]));
    const recetas = (recetario?.asignaciones || []).filter((a) => a.favorita && R[a.receta_id]).map((a) => ({ id: a.id, nombre: R[a.receta_id].nombre, toma: a.toma || null }));
    const publicaciones = muro?.con043 ? (muro.posts || []).map((x) => ({ ...x, autor: x.autor?.nombre || null })) : [];
    const ids = new Set(leerApuntes(atleta.id)?.guardados || []);
    return { items: guardadosJuntos({ favoritos: personal?.favoritos || [], nombres, recetas, publicaciones }), apuntes: ids.size };
  }, [atleta.id]);
  const items = (d.datos?.items || []).filter((x) => filtro === 'todo' || x.tipo === filtro);
  const verApuntes = (filtro === 'todo' || filtro === 'apunte') && d.datos?.apuntes > 0;
  return (
    <Hoja titulo="Tus guardados" alCerrar={alCerrar}>
      <div class="pila guardados-hoja">
        <div class="selector-chips" role="group" aria-label="Qué guardados ver">
          {TIPOS_GUARDADO.map(([k, t]) => <button key={k} type="button" aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>)}
        </div>
        {d.cargando && !d.datos ? <p class="peq terciario" role="status">Cargando…</p> : (
          <>
            {items.length > 0 && (
              <ul class="lista guardados-lista">
                {items.map((x) => (
                  <li key={x.id} class="guardado" data-tipo={x.tipo}>
                    <span class="guardado-ico" aria-hidden="true"><Icono n={x.tipo === 'receta' ? 'receta' : x.tipo === 'publicacion' ? 'equipo' : x.tipo === 'apunte' ? 'documento' : 'biblioteca'} /></span>
                    <span class="pila-xs"><strong>{x.titulo}</strong><span class="mini terciario">{x.detalle}</span></span>
                    {IR_GUARDADO[x.tipo] && irA && <button type="button" class="btn-texto mini" onClick={() => { alCerrar(); irA(IR_GUARDADO[x.tipo]); }} aria-label={`Ir a ${x.titulo}`}>Ir</button>}
                  </li>
                ))}
              </ul>
            )}
            {verApuntes && <p class="peq guardados-apuntes"><Icono n="documento" />{d.datos.apuntes === 1 ? '1 apunte guardado' : `${d.datos.apuntes} apuntes guardados`}: están en Apuntes, en Hoy («Guardados»).</p>}
            {!items.length && !verApuntes && <p class="peq terciario">Nada guardado aquí todavía. Lo que guardes (tus tres ejercicios, recetas favoritas, publicaciones o apuntes) saldrá en esta lista.</p>}
          </>
        )}
      </div>
    </Hoja>
  );
}

// =====================================================================
// (T3) 11. Tu rincón de ánimo (solo lo ves tú)
// =====================================================================
export function RinconAnimo() {
  const { api, aviso, propio } = useApp();
  const d = useCarga(() => (propio ? Promise.resolve(null) : api.animoMios ? api.animoMios().catch(() => null) : Promise.resolve(null)), []);
  const [todos, setTodos] = useState(false);
  if (!Array.isArray(d.datos)) return null;
  const lista = todos ? d.datos : d.datos.slice(0, 3);
  const soltar = async (x) => {
    try { await api.fijarAnimo(x.tipo, x.ref_id, false); aviso('Quitado de tu rincón'); d.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <section class="seccion perfil-sec rincon-animo" aria-labelledby="rincon-animo-t">
      <div class="seccion-cab"><h2 id="rincon-animo-t">Tu rincón de ánimo</h2><span class="peq secundario"><Icono n="candado" />Solo lo ves tú</span></div>
      {!d.datos.length ? (
        <p class="panel panel-pad peq terciario rincon-vacio">Para los días malos: guarda aquí mensajes de tu coach (en el chat, mantén pulsado uno y «A tu rincón de ánimo») o comentarios de tus compañeros en tus publicaciones.</p>
      ) : (
        <ul class="rincon-lista">
          {lista.map((x) => (
            <li key={x.id} class="rincon-nota">
              <blockquote class="peq">{x.texto}</blockquote>
              <span class="separa"><span class="mini terciario">{x.autor} · {fmtCorta(String(x.creado_en).slice(0, 10))}</span>
                <button type="button" class="btn-texto mini" onClick={() => soltar(x)} aria-label={`Quitar de tu rincón el mensaje de ${x.autor}`}>Quitar</button></span>
            </li>
          ))}
        </ul>
      )}
      {d.datos.length > 3 && <button type="button" class="btn-texto" aria-expanded={todos ? 'true' : 'false'} onClick={() => setTodos(!todos)}>{todos ? 'Ver menos' : `Ver los ${d.datos.length}`}</button>}
    </section>
  );
}

// =====================================================================
// (T3) 13. La foto de portada: se recorta a 4:1 (1200 × 300) y se comprime en JPEG
// =====================================================================
export async function recortarPortada(archivo, { ancho = 1200, alto = 300, calidad = 0.82 } = {}) {
  if (!archivo || !/^image\//.test(archivo.type || '')) throw new Error('Elige una foto (JPEG o PNG).');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se ha podido abrir esa foto.')); i.src = url; });
    const r = ancho / alto, w = img.naturalWidth, h = img.naturalHeight;
    const sw = w / h > r ? h * r : w, sh = w / h > r ? h : w / r;
    const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
    c.getContext('2d').drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, ancho, alto);
    for (const q of [calidad, 0.7, 0.55]) {
      const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
      if (b && b.size <= 600000) return b;
    }
    throw new Error('La foto pesa demasiado. Prueba con otra.');
  } finally { URL.revokeObjectURL(url); }
}

// =====================================================================
// (T4) 12. Tu descanso y tus pasos, de un vistazo (si tiene Salud conectada)
// =====================================================================
export function DescansoPasos({ salud = false }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const d = useCarga(() => (salud && api.saludDiaria ? api.saludDiaria(atleta.id, sumarDias(hoy, -55), hoy).catch(() => null) : Promise.resolve(null)), [atleta.id, salud, hoy]);
  const r = useMemo(() => (d.datos?.conectada ? descansoYPasos(d.datos.dias || [], hoy) : null), [d.datos, hoy]);
  if (!r) return null;
  const flecha = (t) => (t === 'sube' ? 'Más que las 4 semanas anteriores' : t === 'baja' ? 'Menos que las 4 semanas anteriores' : t === 'igual' ? 'Como las 4 semanas anteriores' : null);
  const Barras = ({ v, max }) => (
    <span class="dp-barras" aria-hidden="true">{v.map((x, i) => <span key={i} class="dp-barra" style={`--h:${x && max ? Math.max(8, Math.round((x / max) * 100)) : 4}%`} />)}</span>
  );
  return (
    <section class="seccion perfil-sec descanso-pasos" aria-labelledby="descanso-pasos-t">
      <div class="seccion-cab"><h2 id="descanso-pasos-t">Tu descanso y tus pasos</h2><span class="peq secundario">Últimas 4 semanas</span></div>
      <div class="panel panel-pad dp-rejilla">
        {r.sueno && (
          <div class="dp-dato">
            <span class="mini terciario"><Icono n="sueno" />Sueño, de media</span>
            <b class="num">{textoHoras(r.sueno.media)}</b>
            <Barras v={r.sueno.semanas} max={Math.max(...r.sueno.semanas.filter(Boolean))} />
            {flecha(r.sueno.tendencia) && <span class="mini terciario">{flecha(r.sueno.tendencia)}</span>}
          </div>
        )}
        {r.pasos && (
          <div class="dp-dato">
            <span class="mini terciario"><Icono n="pasos" />Pasos al día</span>
            <b class="num">{Math.round(r.pasos.media).toLocaleString('es-ES')}</b>
            <Barras v={r.pasos.semanas} max={Math.max(...r.pasos.semanas.filter(Boolean))} />
            {flecha(r.pasos.tendencia) && <span class="mini terciario">{flecha(r.pasos.tendencia)}</span>}
          </div>
        )}
      </div>
      <p class="mini terciario">De Salud del iPhone. Lo ves tú y tu coach, como siempre.</p>
    </section>
  );
}

// =====================================================================
// (T4) 16. Tus atajos: tres, arriba (en este móvil)
// =====================================================================
export function AtajosPerfil({ irA }) {
  const { atleta } = useApp();
  const [guardados, setGuardados] = useState(() => leerPreferencia(`fbe-atajos-perfil-${atleta.id}`, null));
  const [editar, setEditar] = useState(false);
  const lista = atajosValidos(guardados);
  const fijar = (l) => { setGuardados(l); guardarPreferencia(`fbe-atajos-perfil-${atleta.id}`, l); };
  const ir = (destino) => {
    if (destino === '#carne') { const c = document.querySelector('.carnet'); c?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (destino === '#datos') { const c = document.querySelector('[aria-labelledby="grupo-cuenta"]') || document.getElementById('grupo-cuenta'); c?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    irA?.(destino);
  };
  const D = Object.fromEntries(ATAJOS_PERFIL.map((x) => [x[0], x]));
  return (
    <nav class="atajos-perfil" aria-label="Tus atajos">
      {lista.map((k) => (
        <button key={k} type="button" class="atajo-perfil" onClick={() => ir(D[k][3])}><span class="atajo-ico" aria-hidden="true"><Icono n={D[k][2]} /></span><span class="mini">{D[k][1]}</span></button>
      ))}
      <button type="button" class="atajo-perfil atajo-editar" onClick={() => setEditar(true)} aria-label="Elegir tus atajos"><span class="atajo-ico" aria-hidden="true"><Icono n="editar" /></span><span class="mini">Cambiar</span></button>
      {editar && (
        <Hoja titulo="Tus atajos" alCerrar={() => setEditar(false)}>
          <div class="pila">
            <p class="peq secundario">Elige hasta tres. Se guardan en este móvil.</p>
            <div class="lista-elegir" role="group" aria-label="Tus atajos">
              {ATAJOS_PERFIL.map(([k, t, ico]) => {
                const si = lista.includes(k), lleno = !si && lista.length >= 3;
                return (
                  <button key={k} type="button" aria-pressed={si ? 'true' : 'false'} disabled={lleno} onClick={() => fijar(alternarAtajo(lista, k))} class={si ? 'elegida' : ''}>
                    <span class="separa"><span><Icono n={ico} /> {t}</span>{si && <Icono n="hecho" />}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" class="btn btn-primario btn-grande" onClick={() => setEditar(false)}>Listo</button>
          </div>
        </Hoja>
      )}
    </nav>
  );
}

// =====================================================================
// (T4) 17. Tu privacidad, de un vistazo (y «Así te ve tu coach»)
// =====================================================================
export function FilaPrivacidad({ salud = false }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <FilaIos icono="ojo" titulo="Tu privacidad, de un vistazo" detalle="Qué ve tu coach, qué ve el equipo y qué se queda en tu móvil" alTocar={() => setAbierta(true)} etiqueta="Tu privacidad, de un vistazo" />
      {abierta && <HojaPrivacidad salud={salud} alCerrar={() => setAbierta(false)} />}
    </>
  );
}
const irAGrupo = (id, alCerrar) => { alCerrar(); setTimeout(() => { const g = document.querySelector(`[aria-labelledby="${id}"]`) || document.getElementById(id); g?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); };
function HojaPrivacidad({ salud, alCerrar }) {
  const { api, atleta, perfil } = useApp();
  const [comoCoach, setComoCoach] = useState(false);
  const d = useCarga(async () => {
    const [personal, integ, miembro, portada] = await Promise.all([
      api.personal().catch(() => null),
      api.integraciones ? api.integraciones().catch(() => null) : null,
      api.miembroComunidad ? api.miembroComunidad().catch(() => null) : null,
      api.portadaFoto ? api.portadaFoto().catch(() => null) : null,
    ]);
    return { personal, conectada: !!integ?.salud, comunidad: !!(miembro && !miembro.salido_en), portada: !!portada };
  }, [atleta.id]);
  const p = d.datos?.personal;
  const v = privacidadDeUnVistazo({ salud, saludConectada: d.datos?.conectada, comunidad: d.datos?.comunidad, portada: d.datos?.portada, evitados: (p?.evitados || []).length, material: materialDe(p).deLaBase });
  const Lista = ({ l }) => <ul class="lista privacidad-lista">{l.map((t) => <li key={t} class="peq"><Icono n="hecho" />{t}</li>)}</ul>;
  return (
    <Hoja titulo="Tu privacidad" alCerrar={alCerrar}>
      <div class="pila privacidad-hoja">
        {d.cargando && !d.datos ? <p class="peq terciario" role="status">Cargando…</p> : (
          <>
            <section class="pila-s" aria-labelledby="priv-coach"><h3 id="priv-coach" class="peq"><Icono n="perfil" /> Lo que ve tu coach</h3><Lista l={v.coach} />
              <button type="button" class="btn btn-peq" onClick={() => setComoCoach(true)}><Icono n="ojo" /> Así te ve tu coach</button></section>
            <section class="pila-s" aria-labelledby="priv-equipo"><h3 id="priv-equipo" class="peq"><Icono n="equipo" /> Lo que ve el equipo</h3>
              {v.equipo.length ? <Lista l={v.equipo} /> : <p class="peq terciario">Nada: no estás en la comunidad del equipo.</p>}</section>
            <section class="pila-s" aria-labelledby="priv-movil"><h3 id="priv-movil" class="peq"><Icono n="movil" /> Lo que se queda en tu móvil</h3><Lista l={v.movil} /></section>
            <section class="pila-s" aria-labelledby="priv-ajustes"><h3 id="priv-ajustes" class="peq"><Icono n="ajustes" /> Dónde se cambia</h3>
              <div class="fila-envolver">
                <button type="button" class="btn btn-peq" onClick={() => irAGrupo('grupo-cuenta', alCerrar)}>Datos de salud</button>
                <button type="button" class="btn btn-peq" onClick={() => irAGrupo('grupo-conexiones', alCerrar)}>Salud del iPhone</button>
                <button type="button" class="btn btn-peq" onClick={() => irAGrupo('grupo-lo-tuyo', alCerrar)}>Lo tuyo</button>
                <button type="button" class="btn btn-peq" onClick={() => irAGrupo('grupo-este-movil', alCerrar)}>Este móvil</button>
              </div></section>
          </>
        )}
      </div>
      {comoCoach && (
        <Hoja titulo="Así te ve tu coach" alCerrar={() => setComoCoach(false)}>
          <div class="pila asi-coach">
            <p class="peq secundario">Lo suyo de ti, en su ficha (lo demás, tus sesiones y registros, lo ve en sus pantallas de siempre).</p>
            <div class="panel panel-pad pila-s">
              <strong>{atleta.nombre}</strong>
              {perfil?.foto ? <span class="mini terciario">Con tu foto de perfil</span> : <span class="mini terciario">Sin foto de perfil</span>}
              {p?.porque && <p class="peq">«{p.porque}»</p>}
              <dl class="lo-suyo-datos">
                {p?.apodo && <><dt>Quiere que le llamen</dt><dd>{p.apodo}</dd></>}
                {p?.meta_nombre && <><dt>Su meta</dt><dd>{p.meta_nombre}{p.meta_fecha ? ` (${fmtCorta(p.meta_fecha)})` : ''}</dd></>}
                {textoManual(p) && <><dt>Su manual</dt><dd>{textoManual(p)}</dd></>}
                {(p?.evitados || []).length > 0 && <><dt>Prefiere evitar</dt><dd>{p.evitados.length} {p.evitados.length === 1 ? 'ejercicio' : 'ejercicios'}, con su motivo</dd></>}
                {materialDe(p).deLaBase && <><dt>Su material</dt><dd>{[...new Set([...materialDe(p).casa, ...materialDe(p).viaje])].map((k) => NOMBRE_MATERIAL[k] || k).join(', ') || 'Nada marcado'}</dd></>}
              </dl>
              {!p?.porque && !p?.apodo && !p?.meta_nombre && <p class="mini terciario">Aún no has rellenado «Lo tuyo»: tu coach solo ve tu nombre y tus registros.</p>}
            </div>
            <p class="mini terciario">Tu rincón de ánimo no lo ve.</p>
          </div>
        </Hoja>
      )}
    </Hoja>
  );
}

// =====================================================================
// (T4) 18. Una cuenta más segura: tu correo, cerrar en todos y tu último acceso
// =====================================================================
export function FilasCuentaSegura({ correo = null }) {
  const { backend, aviso } = useApp();
  const ultimo = useCarga(() => (backend?.auth?.ultimoAcceso ? backend.auth.ultimoAcceso().catch(() => null) : Promise.resolve(null)), []);
  const [cambiar, setCambiar] = useState(false);
  const [todos, setTodos] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const fecha = ultimo.datos ? new Date(ultimo.datos) : null;
  const textoUltimo = fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : null;
  const enviar = async (e) => {
    e.preventDefault();
    setError(null); setOcupado(true);
    try {
      const r = await backend.auth.cambiarCorreo(nuevo);
      aviso(r?.confirmar ? 'Te hemos mandado un enlace para confirmarlo. Hasta entonces sigue el de antes.' : 'Correo cambiado');
      setCambiar(false); setNuevo('');
    } catch (err) { setError(err.message); }
    setOcupado(false);
  };
  return (
    <>
      {backend?.auth?.cambiarCorreo && <FilaIos icono="mensaje" titulo="Correo" detalle={correo || null} alTocar={() => setCambiar(true)} valor="Cambiar" etiqueta="Cambiar el correo" />}
      {backend?.auth?.salirEnTodos && <FilaIos icono="escudo" titulo="Cerrar sesión en todos tus dispositivos" detalle={textoUltimo ? `Tu último inicio de sesión: ${textoUltimo}` : 'Si has entrado en un móvil que no es tuyo'} alTocar={() => setTodos(true)} etiqueta="Cerrar sesión en todos tus dispositivos" />}
      {cambiar && (
        <Hoja titulo="Cambiar el correo" alCerrar={() => setCambiar(false)}>
          <form class="pila" onSubmit={enviar}>
            <p class="peq secundario">Te mandaremos un enlace para confirmarlo. Hasta que lo confirmes, sigues entrando con el de ahora{correo ? ` (${correo})` : ''}.</p>
            <label class="campo"><span class="peq">Correo nuevo</span><input class="entrada" type="email" autocomplete="email" required value={nuevo} onInput={(e) => setNuevo(e.currentTarget.value)} aria-describedby={error ? 'correo-error' : undefined} /></label>
            {error && <p id="correo-error" class="peq peligro-texto" role="alert">{error}</p>}
            <button class="btn btn-primario btn-grande" disabled={ocupado || !nuevo.trim()}>Cambiar el correo</button>
          </form>
        </Hoja>
      )}
      {todos && (
        <Hoja titulo="Cerrar sesión en todos" alCerrar={() => setTodos(false)}>
          <div class="pila">
            <p class="peq secundario">Se cerrará tu sesión en todos los móviles y ordenadores, también en este. Tendrás que volver a entrar con tu correo y tu contraseña. Lo que no se haya enviado sin cobertura se quedará en este móvil.</p>
            <button type="button" class="btn btn-peligro btn-grande" disabled={ocupado} onClick={async () => { setOcupado(true); try { await backend.auth.salirEnTodos(); } catch (err) { aviso(err.message, 'error'); setOcupado(false); } }}>Cerrar sesión en todos</button>
            <button type="button" class="btn btn-grande" onClick={() => setTodos(false)}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

// =====================================================================
// (T4) 19. Tus datos en una hoja de cálculo (CSV que se abre en Excel o Numbers)
// =====================================================================
export function FilaHojaCalculo() {
  const { api, atleta, aviso } = useApp();
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const bajar = async (que) => {
    setOcupado(que);
    try {
      let filas, cols;
      if (que === 'sesiones') { filas = await api.entrenamientos(atleta.id); cols = CSV_SESIONES; }
      else if (que === 'series') { filas = await api.historial(atleta.id); cols = CSV_SERIES; }
      else if (que === 'peso') { filas = await api.pesos(atleta.id, 3650); cols = CSV_PESOS; }
      else { filas = await api.medidas(atleta.id); cols = CSV_MEDIDAS; }
      const l = [...(filas || [])].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
      await descargar(`fbe-${que}-${hoyISO()}.csv`, aCSV(l, cols), 'text/csv;charset=utf-8');
      aviso(l.length ? `Descargado: ${l.length} ${l.length === 1 ? 'fila' : 'filas'}` : 'Descargado (aún sin datos)');
    } catch (e) { aviso(e.message || 'No se ha podido descargar', 'error'); }
    setOcupado(null);
  };
  return (
    <>
      <FilaIos icono="documento" titulo="Tus datos en una hoja de cálculo" detalle="Sesiones, series, peso y medidas, para Excel o Numbers" alTocar={() => setAbierta(true)} etiqueta="Tus datos en una hoja de cálculo" />
      {abierta && (
        <Hoja titulo="Tus datos en una hoja de cálculo" alCerrar={() => setAbierta(false)}>
          <div class="pila hoja-calculo">
            <p class="peq secundario">Cada cosa en su archivo (CSV). Se abren con Excel, Numbers o Google Sheets.</p>
            {[['sesiones', 'Tus sesiones'], ['series', 'Tus series'], ['peso', 'Tu peso'], ['medidas', 'Tus medidas']].map(([k, t]) => (
              <button key={k} type="button" class="btn btn-ancho" disabled={!!ocupado} onClick={() => bajar(k)}><Icono n="descargar" /> {ocupado === k ? 'Preparando…' : t}</button>
            ))}
          </div>
        </Hoja>
      )}
    </>
  );
}
