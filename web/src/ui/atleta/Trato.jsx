// (personalización 2) En «Lo tuyo»: cómo te hablamos (en qué género y con qué tono) y qué celebrar y cómo. El género y
// el tono van a la base (los ve su coach); lo de celebrar, a este móvil.
import { useState } from 'preact/hooks';
import { Hoja, useApp } from '../comunes.jsx';
import { GENEROS, TONOS, MOMENTOS_CELEBRAR, MODOS_CELEBRAR, limpiarCelebrar, tratoDe, titularResumen } from '../../logica/trato.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { vibrar } from '../hapticos.js';
import { useTrato } from '../trato.js';
import { UNIDADES_META, cuentaMeta } from '../../logica/rumbo.js';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';

export function HojaTrato({ actual, alCerrar, alGuardar }) {
  const { api, aviso, atleta } = useApp();
  const [genero, setGenero] = useState(actual?.genero || 'n');
  const [tono, setTono] = useState(actual?.tono || 'cercano');
  const [guardando, setGuardando] = useState(false);
  const ejemplo = titularResumen(tratoDe({ ...actual, genero, tono }, atleta?.nombre), { records: 1 });
  const guardar = async () => {
    setGuardando(true);
    try { await api.guardarTrato({ genero, tono }); vibrar('hecho'); aviso('Guardado: a partir de ahora te hablamos así'); alGuardar?.(); }
    catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Cómo te hablamos" alCerrar={alCerrar}>
      <div class="pila trato-hoja">
        <fieldset class="campo"><legend>En qué género</legend>
          <div class="segmentos" role="group" aria-label="En qué género">
            {GENEROS.map(([k, n]) => <button type="button" key={k} aria-pressed={genero === k ? 'true' : 'false'} onClick={() => setGenero(k)}>{n}</button>)}
          </div>
          <span class="mini secundario">Solo para la gramática («¡Bienvenida!», «Estás listo»…). Sin marcar, la app busca formas que no lo marquen.</span>
        </fieldset>
        <fieldset class="campo"><legend>Con qué tono</legend>
          <div class="trato-tonos" role="radiogroup" aria-label="Con qué tono">
            {TONOS.map(([k, n, d]) => (
              <label key={k} class={`trato-tono${tono === k ? ' elegido' : ''}`}>
                <input type="radio" name="trato-tono" checked={tono === k} onChange={() => setTono(k)} />
                <span class="pila-xs"><strong>{n}</strong><span class="mini secundario">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <p class="trato-ejemplo" aria-live="polite"><span class="mini secundario">Así te lo diríamos tras un récord:</span><strong>{ejemplo.titulo}</strong>{ejemplo.sub ? <span> {ejemplo.sub}</span> : null}</p>
        <button type="button" class="btn btn-primario" disabled={guardando} onClick={guardar}>Guardar</button>
      </div>
    </Hoja>
  );
}

export function HojaCelebrar({ alCerrar }) {
  const [c, setC] = useState(() => limpiarCelebrar(leerAjustes().celebrar));
  const cambiar = (k, v) => { const n = { ...c, [k]: v }; setC(n); guardarAjustes({ ...leerAjustes(), celebrar: n }); vibrar('elegir'); };
  return (
    <Hoja titulo="Qué celebrar" alCerrar={alCerrar}>
      <div class="pila celebrar-hoja">
        <p class="peq secundario">Para cada momento, cómo quieres que lo celebremos. Se guarda en este móvil.</p>
        {MOMENTOS_CELEBRAR.map(([k, n]) => (
          <div class="celebrar-fila" key={k}>
            <strong>{n}</strong>
            <div class="segmentos" role="group" aria-label={n}>
              {MODOS_CELEBRAR.map(([m, nm]) => <button type="button" key={m} aria-pressed={c[k] === m ? 'true' : 'false'} onClick={() => cambiar(k, m)}>{nm}</button>)}
            </div>
          </div>
        ))}
      </div>
    </Hoja>
  );
}
export const textoCelebrar = (c) => {
  const v = Object.values(limpiarCelebrar(c));
  return v.every((x) => x === 'todo') ? 'Todo, con todo' : v.every((x) => x === 'nada') ? 'Nada' : 'A tu manera';
};

// ---------- (personalización 2, tanda 2) Su meta con fecha ----------
export function HojaMeta({ actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [nombre, setNombre] = useState(actual?.meta_nombre || '');
  const [fecha, setFecha] = useState(actual?.meta_fecha || '');
  const [cifra, setCifra] = useState(actual?.meta_cifra != null ? String(actual.meta_cifra).replace('.', ',') : '');
  const [unidad, setUnidad] = useState(actual?.meta_unidad || 'kg');
  const [guardando, setGuardando] = useState(false);
  const guardar = async (quitar = false) => {
    setGuardando(true);
    try {
      const c = cifra.trim() ? Number(cifra.replace(',', '.')) : null;
      await api.guardarTrato(quitar ? { meta_nombre: '' } : { meta_nombre: nombre.trim(), meta_fecha: fecha || null, meta_cifra: c, meta_unidad: c ? unidad : null });
      vibrar('hecho'); aviso(quitar ? 'Meta quitada' : 'Guardada: la verás en Hoy, con su cuenta atrás'); alGuardar?.();
    } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Tu meta" alCerrar={alCerrar}>
      <div class="pila meta-hoja">
        <p class="peq secundario">Algo con nombre y, si quieres, con día y con cifra: una competición, una carrera, tu primera dominada… Tu coach la verá. No pongas aquí datos de salud ni tu peso corporal: para eso está el check-in.</p>
        <div class="campo"><label for="meta-nombre">Tu meta</label>
          <input id="meta-nombre" class="entrada" maxLength={60} value={nombre} placeholder="Mi primera competición" onInput={(e) => setNombre(e.currentTarget.value)} /></div>
        <div class="campo"><label for="meta-fecha">El día <span class="secundario">(opcional)</span></label>
          <input id="meta-fecha" class="entrada" type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} /></div>
        <div class="campo"><label for="meta-cifra">La cifra <span class="secundario">(opcional)</span></label>
          <span class="fila-s"><input id="meta-cifra" class="entrada" inputMode="decimal" value={cifra} placeholder="100" onInput={(e) => setCifra(e.currentTarget.value)} />
            <select class="selector" aria-label="Unidad" value={unidad} onChange={(e) => setUnidad(e.currentTarget.value)}>{UNIDADES_META.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></span></div>
        <button type="button" class="btn btn-primario" disabled={guardando || !nombre.trim()} onClick={() => guardar(false)}>Guardar</button>
        {actual?.meta_nombre && <button type="button" class="btn-texto peligro" onClick={() => guardar(true)}>Quitar mi meta</button>}
      </div>
    </Hoja>
  );
}
// En Hoy: la cuenta atrás de su meta (o la invitación a ponerla si ya pasó)
export function CuentaMeta() {
  const { personal } = useTrato();
  const c = cuentaMeta(personal, hoyISO());
  if (!c) return null;
  return (
    <section class={`panel panel-pad cuenta-meta${c.cerca ? ' cerca' : ''}${c.pasada ? ' pasada' : ''}`} aria-label="Tu meta">
      <span class="cuenta-meta-ico" aria-hidden="true">{c.dias === 0 ? '🎯' : '⏳'}</span>
      <span class="pila-xs"><strong>{c.texto}</strong>{c.fecha && !c.pasada && <span class="mini secundario">{fmtCorta(c.fecha)}</span>}</span>
    </section>
  );
}
