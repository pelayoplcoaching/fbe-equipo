// FBE Esencial (v0.258, el día a día): «¿Cómo llegas hoy?» de un toque (D1: tres caras y, si quiere, las horas que ha
// dormido y si tiene agujetas fuertes en lo de hoy) y lo que propone la app con su porqué (D2 regular, D3 mal, D4 menos
// de 6 horas, D5 agujetas), con «Hacerlo así» o «Entrenar normal» (P2: nada cambia hasta que lo elige). Solo para quien
// va por su cuenta, con la 110 y la clave 'como_llegas' (apagada hasta el visto bueno de Pelayo; en la demo, ?previa=1).
// Lo guarda quien lo usa (la sesión, con su consentimiento de salud: la misma columna que las tres preguntas). En este
// móvil no se guarda nada. Estilos: como-llegas.css (cll-*, escritas tal cual).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono } from '../comunes.jsx';
import { caraDe, consejoPreparacion, esUnToque } from '../../logica/preparacion.js';
import { CARAS, HORAS, propuestaDelDia, calentamientoLargo } from '../../logica/como-llegas.js';
import { hoyISO, sumarDias } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';

const BOCA = { bien: 'M8 14c1.1 1.4 2.4 2 4 2s2.9-.6 4-2', regular: 'M8.5 15h7', mal: 'M8 16.2c1.1-1.4 2.4-2 4-2s2.9.6 4 2' };
function Cara({ c }) {
  return (
    <svg class={`cll-cara-ico amb-cara-${c}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <path d={BOCA[c]} />
    </svg>
  );
}
const horasTexto = (h) => `${String(h).replace('.', ',')} h`;

// La pregunta: tres caras y, si quiere, las horas y las agujetas. Al tocar una cara se guarda.
function Pregunta({ inicial, alGuardar, alSaltar, ocupado }) {
  const [horas, setHoras] = useState(inicial?.horas ?? null);
  const [agujetas, setAgujetas] = useState(!!inicial?.agujetas);
  const cara = inicial?.cara || null;
  const elegir = (c) => alGuardar({ cara: c, ...(horas != null ? { horas } : {}), ...(agujetas ? { agujetas: true } : {}) });
  const mover = (d) => setHoras((h) => Math.min(HORAS.max, Math.max(HORAS.min, (h ?? 7) + d)));
  return (
    <section class="panel panel-pad cll-caja" aria-labelledby="cll-t">
      <div class="separa">
        <div class="pila-xs">
          <strong id="cll-t">¿Cómo llegas hoy?</strong>
          <span class="mini secundario">Un toque. La app te propone cómo hacer la sesión de hoy.</span>
        </div>
        {alSaltar && <button type="button" class="btn-texto" onClick={alSaltar}>Ahora no</button>}
      </div>
      <div class="cll-caras" role="group" aria-label="Cómo llegas hoy">
        {CARAS.map(([c, nombre]) => (
          <button type="button" key={c} class={cara === c ? 'cll-cara cll-cara-si' : 'cll-cara'} aria-pressed={cara === c ? 'true' : 'false'} disabled={ocupado} onClick={() => elegir(c)}>
            <Cara c={c} />
            <span class="peq">{nombre}</span>
          </button>
        ))}
      </div>
      <div class="cll-extra">
        {horas == null ? (
          <button type="button" class="chip cll-chip" onClick={() => setHoras(7)}><Icono n="sueno" /> Añadir las horas que has dormido</button>
        ) : (
          <div class="cll-horas" role="group" aria-label="Horas que has dormido">
            <Icono n="sueno" />
            <button type="button" class="btn-icono cll-paso" aria-label="Media hora menos" disabled={horas <= HORAS.min} onClick={() => mover(-HORAS.paso)}><Icono n="menos" /></button>
            <span class="cll-horas-n" aria-live="polite">{horasTexto(horas)}</span>
            <button type="button" class="btn-icono cll-paso" aria-label="Media hora más" disabled={horas >= HORAS.max} onClick={() => mover(HORAS.paso)}><Icono n="mas" /></button>
            <button type="button" class="btn-texto mini" onClick={() => setHoras(null)}>Quitar</button>
          </div>
        )}
        <button type="button" class={agujetas ? 'chip cll-chip cll-chip-si' : 'chip cll-chip'} aria-pressed={agujetas ? 'true' : 'false'} onClick={() => setAgujetas((x) => !x)}>
          {agujetas && <Icono n="hecho" />} Agujetas fuertes en lo de hoy
        </button>
      </div>
      {horas != null && horas < 6 && <p class="mini secundario">Con menos de 6 horas, el día cuenta como regular aunque te notes bien.</p>}
    </section>
  );
}

// Lo que propone la app (o, ya elegido, una línea con cómo va hoy)
export function ComoLlegas({ prep = null, pautas = [], calent = [], sesion = null, alGuardar, alSaltar = null, alCerrar = null, editando = false, alEditar }) {
  const [ocupado, setOcupado] = useState(false);
  const [otro, setOtro] = useState(false);
  const guardar = async (p) => {
    if (ocupado) return;
    setOcupado(true);
    try { await alGuardar(p); } finally { setOcupado(false); }
  };
  if (!esUnToque(prep) || editando) {
    return <Pregunta inicial={esUnToque(prep) ? prep : null} ocupado={ocupado} alSaltar={editando ? () => alEditar?.(false) : alSaltar}
      alGuardar={(p) => guardar(p).then(() => alEditar?.(false))} />;
  }
  const consejo = consejoPreparacion(prep);
  const prop = propuestaDelDia(prep, pautas);
  const cara = caraDe(prep);
  const cambiar = <button type="button" class="btn-texto" onClick={() => alEditar?.(true)}>Cambiar cómo llego</button>;
  if (!prop) {
    return (
      <div class="cll-linea" role="status">
        <Icono n="hecho" />
        <div class="pila-xs"><strong>{consejo.titulo}</strong><span class="peq">{consejo.texto}</span><span class="fila">{cambiar}</span></div>
      </div>
    );
  }
  const largo = prop.tipo === 'agujetas' ? calentamientoLargo(calent) : [];
  if (prep.asi == null) {
    return (
      <section class={cara === 'mal' ? 'panel panel-pad cll-prop cll-prop-mal' : 'panel panel-pad cll-prop'} aria-labelledby="cll-prop-t" role="status">
        <div class="pila-xs">
          <strong id="cll-prop-t">{consejo.titulo}{cara === 'regular' && prep.cara === 'bien' ? ` (${horasTexto(prep.horas)} de sueño)` : ''}</strong>
          <span class="peq">{prop.texto}</span>
          {largo.length > 0 && <ul class="lista-puntos peq">{largo.map((x) => <li key={x}>{x}</li>)}</ul>}
          <span class="mini secundario">{prop.porque}</span>
        </div>
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario" disabled={ocupado} onClick={() => guardar({ ...prep, asi: true })}>{prop.tipo === 'minima' ? 'Hacer la sesión mínima' : 'Hacerlo así'}</button>
          <button type="button" class="btn" disabled={ocupado} onClick={() => guardar({ ...prep, asi: false })}>Entrenar normal</button>
          {prop.tipo === 'minima' && sesion && <button type="button" class="btn-texto" aria-expanded={otro ? 'true' : 'false'} onClick={() => setOtro((x) => !x)}>Pasarla a otro día</button>}
        </div>
        {otro && sesion && <OtroDia sesion={sesion} alHecho={alCerrar} />}
        <span class="fila">{cambiar}</span>
      </section>
    );
  }
  // ya elegido
  return (
    <div class={prep.asi ? 'cll-linea cll-linea-ajustada' : 'cll-linea'} role="status">
      <Icono n={prep.asi ? 'ajustes' : 'hecho'} />
      <div class="pila-xs">
        <strong>{prep.asi ? (prop.tipo === 'minima' ? 'Hoy, la sesión mínima' : 'Hoy, la sesión ajustada') : 'Hoy entrenas normal'}</strong>
        <span class="peq">{prep.asi ? prop.texto : `${consejo.titulo}, pero has elegido tu sesión de siempre.`}</span>
        {prep.asi && largo.length > 0 && <ul class="lista-puntos peq">{largo.map((x) => <li key={x}>{x}</li>)}</ul>}
        <span class="fila-envolver">
          <button type="button" class="btn-texto" disabled={ocupado} onClick={() => guardar({ ...prep, asi: !prep.asi })}>{prep.asi ? 'Entrenar normal' : (prop.tipo === 'minima' ? 'Hacer la sesión mínima' : 'Hacerlo así')}</button>
          {cambiar}
        </span>
      </div>
    </div>
  );
}

// (D3) «Pasarla a otro día»: a un día de esta semana sin otra sesión, desde mañana (como «Hoy no puedo» de Hoy)
function OtroDia({ sesion, alHecho }) {
  const { api, atleta, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const pr = useCarga(() => api.programa(atleta.id), [atleta.id]);
  if (pr.cargando) return null;
  const hoy = hoyISO();
  const w = pr.datos?.actual;
  const ss = w ? (pr.datos.sesiones?.[w.id] || []) : [];
  const ocupados = new Set(ss.filter((s) => s.id !== sesion.id && s.dia_previsto).map((s) => String(s.dia_previsto).slice(0, 10)));
  const libres = w?.fecha_inicio && ss.some((s) => s.id === sesion.id) ? Array.from({ length: 7 }, (_, i) => sumarDias(w.fecha_inicio, i)).filter((d) => d > hoy && !ocupados.has(d)) : [];
  if (!libres.length) return <p class="peq secundario">Esta semana no te quedan días libres para pasarla. Si hoy no puedes, déjala: la semana que viene sigues donde tocaba.</p>;
  const mover = (d) => una(async () => {
    try { await api.planificarSesion(sesion.id, d); aviso(`«${sesion.nombre}», el ${fechaLarga(d)}`); alHecho?.(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <div class="pila-xs">
      <span class="peq">¿A qué día? Mejor sin otra sesión el día de antes ni el de después.</span>
      <div class="fila-envolver">
        {libres.map((d) => <button type="button" key={d} class="btn btn-peq" disabled={ocupado} onClick={() => mover(d)}>{fechaLarga(d).split(' ')[0].replace(/^./, (c) => c.toUpperCase())}</button>)}
      </div>
    </div>
  );
}
