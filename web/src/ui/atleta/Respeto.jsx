// (personalización 3, tanda 7) Que respete cómo es él: su manual de instrucciones (lo ve su coach), lo que no quiere
// ver (en el móvil), su ciclo (opcional, con el consentimiento de salud y solo en el móvil) y su informe para el médico
// o el fisio (se genera aquí y no sale hasta que lo comparte).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { FEEDBACK, MOTIVA, OCULTABLES, limpiarOcultar, patronCiclo, informeSalud } from '../../logica/respeto.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { hoyISO, sumarDias, fmtCorta, lunesDe } from '../../logica/fechas.js';
import { ZONAS } from '../../logica/calculos.js';
import { vibrar } from '../hapticos.js';

// ---------- Su manual ----------
export function HojaManual({ actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [fb, setFb] = useState(actual?.manual_feedback || null);
  const [mot, setMot] = useState(new Set(actual?.manual_motiva || []));
  const [evitar, setEvitar] = useState(actual?.manual_evitar || '');
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try { await api.guardarManual({ manual_feedback: fb, manual_motiva: [...mot], manual_evitar: evitar.trim() || null }); vibrar('hecho'); aviso('Guardado: tu coach lo verá'); alGuardar?.(); } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Cómo me gusta que me entrenen" alCerrar={alCerrar}>
      <div class="pila manual-hoja">
        <p class="peq secundario">Tu manual de instrucciones: lo lee tu coach para hablarte a tu manera.</p>
        <fieldset class="pila-xs"><legend>Cuando hay algo que mejorar, prefiero</legend>
          {FEEDBACK.map(([k, n, d]) => (
            <label key={k} class={`trato-tono ${fb === k ? 'elegido' : ''}`}><input type="radio" name="manual-fb" checked={fb === k} onChange={() => setFb(k)} /><span class="pila-xs"><strong>{n}</strong><span class="peq secundario">{d}</span></span></label>
          ))}
        </fieldset>
        <fieldset class="pila-xs"><legend>Me motiva</legend>
          {MOTIVA.map(([k, n]) => (
            <label key={k} class="fila-s"><input type="checkbox" checked={mot.has(k)} onChange={(e) => setMot((s) => { const x = new Set(s); e.currentTarget.checked ? x.add(k) : x.delete(k); return x; })} /> {n}</label>
          ))}
        </fieldset>
        <div class="campo"><label for="manual-evitar">Lo que no quiero oír <span class="secundario">(opcional)</span></label>
          <textarea id="manual-evitar" class="entrada" rows={2} maxLength={200} placeholder="Que me compares con otros…" value={evitar} onInput={(e) => setEvitar(e.currentTarget.value)} /></div>
        <button type="button" class="btn btn-primario" disabled={guardando} onClick={guardar}>Guardar</button>
      </div>
    </Hoja>
  );
}

// ---------- Lo que no quiere ver ----------
export function HojaOcultar({ alCerrar }) {
  const [o, setO] = useState(() => limpiarOcultar(leerAjustes().ocultar));
  const cambiar = (k, v) => { const n = { ...o, [k]: v }; setO(n); guardarAjustes({ ...leerAjustes(), ocultar: n }); vibrar('elegir'); };
  return (
    <Hoja titulo="Lo que no quieres ver" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Si una cifra te hace más mal que bien, la escondemos en este móvil. Tu coach sigue viendo lo que apuntes.</p>
        {OCULTABLES.map(([k, n, d]) => (
          <label key={k} class="fila-ocultar"><span class="pila-xs"><strong>{n}</strong><span class="peq secundario">{d}</span></span>
            <input type="checkbox" switch role="switch" aria-label={n} checked={o[k]} onChange={(e) => cambiar(k, e.currentTarget.checked)} /></label>
        ))}
      </div>
    </Hoja>
  );
}

// ---------- Su ciclo (solo en el móvil) ----------
const claveCiclo = (atletaId) => `fbe-ciclo:${atletaId}`;
export function leerCiclo(atletaId) {
  try { const v = JSON.parse(localStorage.getItem(claveCiclo(atletaId)) || '[]'); return Array.isArray(v) ? v.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort() : []; } catch { return []; }
}
function guardarCiclo(atletaId, lista) { try { localStorage.setItem(claveCiclo(atletaId), JSON.stringify([...new Set(lista)].sort())); } catch { /* */ } }
export function HojaCiclo({ alCerrar }) {
  const { atleta } = useApp();
  const [lista, setLista] = useState(() => leerCiclo(atleta.id));
  const [fecha, setFecha] = useState('');
  const poner = (l) => { guardarCiclo(atleta.id, l); setLista(leerCiclo(atleta.id)); };
  return (
    <Hoja titulo="Tu ciclo" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Opcional. Apunta el día en que empieza cada regla y, con unos meses, verás <strong>tu propio</strong> patrón de rendimiento por fase (sin generalidades: solo lo que dicen tus datos). <strong>Se queda en este móvil</strong>: no se sube ni lo ve tu coach.</p>
        {lista.length > 0 ? <div class="guardias-dias">{[...lista].reverse().map((d) => (
          <span key={d} class="chip-guardia">{fmtCorta(d)}<button type="button" class="btn btn-icono plano" aria-label={`Quitar el ${fmtCorta(d)}`} onClick={() => poner(lista.filter((x) => x !== d))}><Icono n="cerrar" /></button></span>
        ))}</div> : <p class="peq terciario">Nada apuntado.</p>}
        <div class="campo"><label for="ciclo-fecha">Empezó el</label>
          <span class="fila-s"><input id="ciclo-fecha" class="entrada" type="date" max={hoyISO()} value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
            <button type="button" class="btn" disabled={!fecha || fecha > hoyISO()} onClick={() => { poner([...lista, fecha]); setFecha(''); vibrar('hecho'); }}>Añadir</button></span></div>
        {lista.length > 0 && <button type="button" class="btn-texto peligro" onClick={() => poner([])}>Borrar todo</button>}
      </div>
    </Hoja>
  );
}
// En Perfil: su patrón (si ha apuntado su ciclo y tiene el consentimiento de salud)
export function PatronCiclo({ entrenos, salud }) {
  const { atleta, propio } = useApp();
  if (!salud || propio || !atleta?.id) return null;
  const inicios = leerCiclo(atleta.id);
  if (!inicios.length) return null;
  const r = patronCiclo(entrenos, inicios);
  return (
    <section class="panel panel-pad patron-ciclo" aria-label="Tu rendimiento en tu ciclo">
      <span class="t-sobre">Tu ciclo (solo en este móvil)</span>
      {!r.listo ? <p class="peq">{r.motivo}</p> : (
        <>
          <p class="peq"><strong>{r.texto}</strong></p>
          <dl class="adn-fbe-rasgos">{r.fases.map((f) => <div key={f.fase}><dt>{f.nombre}</dt><dd>{f.sesiones} {f.sesiones === 1 ? 'sesión' : 'sesiones'}{f.rpe != null ? ` · RPE ${String(Math.round(f.rpe * 10) / 10).replace('.', ',')}` : ''}</dd></div>)}</dl>
        </>
      )}
    </section>
  );
}

// ---------- Su informe para el médico o el fisio ----------
export function BotonInforme({ salud }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}><Icono n="documento" /> Informe para tu médico o fisio</button>
      {abierto && <HojaInforme salud={salud} alCerrar={() => setAbierto(false)} />}
    </>
  );
}
function HojaInforme({ salud, alCerrar }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const d = useCarga(() => Promise.all([
    api.entrenamientos(atleta.id).catch(() => []),
    salud ? api.molestiasAtleta(atleta.id).catch(() => []) : Promise.resolve([]),
    salud ? api.saludDiaria(atleta.id, sumarDias(lunesDe(hoy), -56), hoy).then((r) => r?.dias || []).catch(() => []) : Promise.resolve([]),
  ]), [atleta.id, salud]);
  if (!d.datos) return <Hoja titulo="Tu informe" alCerrar={alCerrar}><p class="peq secundario">Preparándolo…</p></Hoja>;
  const [entrenos, molestias, sueno] = d.datos;
  const r = informeSalud({ entrenos, molestias, sueno, hoy, nombre: atleta.nombre });
  const nombreZona = (z) => ZONAS.find(([k]) => k === z)?.[1] || z;
  const imprimir = () => {
    document.documentElement.setAttribute('data-imprimir-informe', '');
    const fin = () => { document.documentElement.removeAttribute('data-imprimir-informe'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
    setTimeout(fin, 60000);
  };
  return (
    <Hoja titulo="Tu informe" alCerrar={alCerrar}>
      <div class="pila">
        <article class="informe-salud" aria-label="Informe de entrenamiento">
          <h3>Informe de entrenamiento</h3>
          <p class="peq">{r.nombre} · del {fmtCorta(r.desde)} al {fmtCorta(r.hasta)} · FBE Equipo</p>
          <p class="peq"><strong>{r.totalSesiones}</strong> sesiones de fuerza en {r.semanas.length} semanas ({String(r.mediaSemanal).replace('.', ',')} por semana){r.suenoMedio ? ` · sueño medio ${Math.floor(r.suenoMedio / 60)} h ${String(r.suenoMedio % 60).padStart(2, '0')} min` : ''}.</p>
          <table class="informe-tabla">
            <thead><tr><th>Semana</th><th>Sesiones</th><th>Minutos</th><th>Esfuerzo (RPE)</th>{salud && <th>Molestias</th>}</tr></thead>
            <tbody>{r.semanas.map((s) => <tr key={s.lunes}><td>{fmtCorta(s.lunes)}</td><td>{s.sesiones}</td><td>{s.minutos || '—'}</td><td>{s.rpe != null ? String(s.rpe).replace('.', ',') : '—'}</td>{salud && <td>{s.molestias.length ? s.molestias.map((m) => `${nombreZona(m.zona)} (${['', 'leve', 'moderada', 'grave'][m.intensidad] || m.intensidad})`).join(', ') : '—'}</td>}</tr>)}</tbody>
          </table>
          <p class="mini secundario">Datos que ha apuntado el atleta en la app. No es un informe clínico.</p>
        </article>
        <p class="peq secundario">Se genera en tu móvil y no se manda a nadie: guárdalo en PDF o imprímelo para llevarlo a consulta.</p>
        <button type="button" class="btn btn-primario" onClick={imprimir}><Icono n="descargar" /> Guardar en PDF o imprimir</button>
      </div>
    </Hoja>
  );
}
