// «Programar según FBE» (fase 1b): los dos formularios de reglas que salen en la hoja de revisión. Las reglas de un
// atleta (perfil, hasta qué RPE suma repeticiones y rangos por tipo de ejercicio) y la regla de uno de sus ejercicios
// (cómo progresa, rango, salto de carga y RPE). Solo recogen y validan: guardar es cosa de la hoja.
// Usan clases que ya existen; no añaden estilos.
import { useState } from 'preact/hooks';
import { PERFILES, PERFILES_ELEGIBLES, perfilDeNivel, VALORES_RPE_SUBE, TIPOS_RANGO, DE_PARTIDA, MODELOS_DISPONIBLES, NOMBRE_MODELO,
  reglasDeAtleta, conReglasDeAtleta, reglaDeEjercicio, conReglaDeEjercicio, resumenGuardadas, hayGuardadas, tieneRegla } from '../../logica/motor/index.js';
import { num } from '../../logica/calculos.js';

const soloCifras = (v) => v.replace(/[^0-9]/g, '');
// Las filas de la hoja (.carga-sug) dejan todos sus <input> en 20 px, pensando en la casilla: a los de la regla se
// les devuelve su tamaño aquí, sin tocar la hoja de estilos
const ANCHO = 'width:100%;height:38px';
// Dos columnas si caben; en el móvil, una debajo de otra
const DOS = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:10px 12px';
const ETIQUETA_MODELO = { ...NOMBRE_MODELO, top_set: 'Top set + back-off', mantener: 'Mantener como está', a_mano: 'No tocar: lo llevo yo' };
const ayudaRango = `Vacío: el de siempre (básicos ${DE_PARTIDA.rangos.basico.join('–')}, multiarticulares ${DE_PARTIDA.rangos.multiarticular.join('–')}, aislamiento ${DE_PARTIDA.rangos.aislamiento.join('–')}).`;

function SelectorRpe({ id, valor, alCambiar }) {
  return (
    <select id={id} class="selector" value={valor} onChange={(e) => alCambiar(e.currentTarget.value)}>
      <option value="">De partida (RPE {num(DE_PARTIDA.rpeSube)})</option>
      {VALORES_RPE_SUBE.map((v) => <option key={v} value={String(v)}>RPE {num(v)}</option>)}
    </select>
  );
}

// Las reglas del atleta: plegadas, con su resumen; al abrirlas, el formulario
export function ReglasAtleta({ nombre, nivel, guardadas, ocupado, alGuardar }) {
  const inicial = () => {
    const a = reglasDeAtleta(guardadas);
    return { perfil: a.perfil || '', rpeSube: a.rpeSube == null ? '' : String(a.rpeSube), rangos: Object.fromEntries(TIPOS_RANGO.map(([t]) => [t, (a.rangos[t] || ['', '']).map(String)])) };
  };
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState([]);
  const dePartida = PERFILES[perfilDeNivel(nivel)].nombre;
  const propias = !!guardadas.perfil || Object.keys(guardadas.atleta || {}).length > 0;
  const enviar = async (valores) => {
    const r = conReglasDeAtleta(guardadas, valores);
    if (r.errores) { setErrores(r.errores); return; }
    setErrores([]);
    if (await alGuardar(r.guardadas)) setAbierto(false);
  };
  const rango = (t, i, v) => setF((x) => ({ ...x, rangos: { ...x.rangos, [t]: x.rangos[t].map((y, k) => (k === i ? soloCifras(v) : y)) } }));
  return (
    <section class="panel panel-pad pila-s" aria-label="Reglas de este atleta">
      <div class="seccion-cab">
        <strong class="peq">Reglas de {nombre || 'este atleta'}</strong>
        <button type="button" class="btn-texto" aria-expanded={abierto ? 'true' : 'false'} onClick={() => { setF(inicial()); setErrores([]); setAbierto(!abierto); }}>{abierto ? 'Cerrar' : 'Cambiar'}</button>
      </div>
      {!abierto ? <p class="mini secundario">{resumenGuardadas(guardadas)}{hayGuardadas(guardadas) ? '.' : ` (${dePartida.toLowerCase()}): progresión serie a serie.`}</p> : (
        <div class="pila">
          <div class="campo">
            <label for="fbe-perfil">Perfil</label>
            <select id="fbe-perfil" class="selector" value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.currentTarget.value })}>
              <option value="">De partida ({dePartida}): serie a serie</option>
              {PERFILES_ELEGIBLES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <span class="ayuda">{f.perfil ? PERFILES_ELEGIBLES.find(([id]) => id === f.perfil)[2] : 'Todos los ejercicios progresan serie a serie, con las reglas generales.'}</span>
          </div>
          <div class="campo">
            <label for="fbe-rpe">Suma una repetición hasta</label>
            <SelectorRpe id="fbe-rpe" valor={f.rpeSube} alCambiar={(v) => setF({ ...f, rpeSube: v })} />
            <span class="ayuda">Por encima de ese esfuerzo, la serie se queda igual. Vale para la progresión serie a serie y el top set.</span>
          </div>
          <div class="campo">
            <span class="etq">Rangos de repeticiones</span>
            <div class="rejilla-volumen">
              {TIPOS_RANGO.map(([t, n]) => (
                <div class="fila-vol" key={t}>
                  <span>{n}</span>
                  <input inputMode="numeric" aria-label={`${n}: mínimo de repeticiones`} placeholder={String(DE_PARTIDA.rangos[t][0])} value={f.rangos[t][0]} onInput={(e) => rango(t, 0, e.currentTarget.value)} />
                  <span class="terciario" aria-hidden="true">–</span>
                  <input inputMode="numeric" aria-label={`${n}: máximo de repeticiones`} placeholder={String(DE_PARTIDA.rangos[t][1])} value={f.rangos[t][1]} onInput={(e) => rango(t, 1, e.currentTarget.value)} />
                </div>
              ))}
            </div>
            <span class="ayuda">{ayudaRango} Si la pauta de un ejercicio ya trae su rango (por ejemplo 8–12), manda el de la pauta.</span>
          </div>
          {errores.length > 0 && <p class="error" role="alert">{errores.join('. ')}.</p>}
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" disabled={ocupado} onClick={() => enviar(f)}>Guardar reglas</button>
            {propias && <button type="button" class="btn" disabled={ocupado} onClick={() => enviar({})}>Volver a las de partida</button>}
          </div>
          <p class="mini terciario">Se guardan en la ficha del atleta y valen para todas sus semanas. Las reglas propias de un ejercicio se cambian en su fila, más abajo, y no se pierden al cambiar estas.</p>
        </div>
      )}
    </section>
  );
}

// La regla de un ejercicio, dentro de su fila
export function ReglaEjercicio({ clave, ejercicioId, nombre, guardadas, ocupado, alGuardar, alCerrar }) {
  const r = reglaDeEjercicio(guardadas, ejercicioId);
  const [f, setF] = useState({ modelo: r.modelo || '', rango: (r.rango || ['', '']).map(String), salto: r.salto == null ? '' : num(r.salto, 2), rpeSube: r.rpeSube == null ? '' : String(r.rpeSube) });
  const [errores, setErrores] = useState([]);
  const id = (x) => `fbe-regla-${clave}-${x}`;
  const enviar = async (valores) => {
    const res = conReglaDeEjercicio(guardadas, ejercicioId, valores);
    if (res.errores) { setErrores(res.errores); return; }
    setErrores([]);
    if (await alGuardar(res.guardadas)) alCerrar();
  };
  return (
    <div class="panel panel-pad pila-s" role="group" aria-label={`Regla propia de ${nombre}`}>
      <div style={DOS}>
        <div class="campo">
          <label for={id('modelo')}>Cómo progresa</label>
          <select id={id('modelo')} class="selector" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.currentTarget.value })}>
            <option value="">Como diga su perfil</option>
            {MODELOS_DISPONIBLES.map((m) => <option key={m} value={m}>{ETIQUETA_MODELO[m]}</option>)}
          </select>
        </div>
        <div class="campo">
          <label for={id('rpe')}>Suma una repetición hasta</label>
          <SelectorRpe id={id('rpe')} valor={f.rpeSube} alCambiar={(v) => setF({ ...f, rpeSube: v })} />
        </div>
      </div>
      <div style={DOS}>
        <div class="campo">
          <span class="etq">Rango de repeticiones</span>
          <div class="rejilla-volumen">
            <div class="fila-vol">
              <span class="mini secundario">De</span>
              <input inputMode="numeric" style={ANCHO} aria-label={`${nombre}: mínimo de repeticiones`} value={f.rango[0]} onInput={(e) => setF({ ...f, rango: [soloCifras(e.currentTarget.value), f.rango[1]] })} />
              <span class="terciario" aria-hidden="true">–</span>
              <input inputMode="numeric" style={ANCHO} aria-label={`${nombre}: máximo de repeticiones`} value={f.rango[1]} onInput={(e) => setF({ ...f, rango: [f.rango[0], soloCifras(e.currentTarget.value)] })} />
            </div>
          </div>
        </div>
        <div class="campo">
          <label for={id('salto')}>Salto de carga (kg)</label>
          <input id={id('salto')} class="entrada" style="width:100%;height:auto" inputMode="decimal" placeholder="El del ejercicio" value={f.salto} onInput={(e) => setF({ ...f, salto: e.currentTarget.value.replace(/[^0-9.,]/g, '') })} />
        </div>
      </div>
      <p class="mini terciario">Vacío: lo de siempre. Vale solo para este atleta y manda sobre sus reglas y sobre el rango de la pauta.</p>
      {errores.length > 0 && <p class="error" role="alert">{errores.join('. ')}.</p>}
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={() => enviar(f)}>Guardar regla</button>
        {tieneRegla(guardadas, ejercicioId) && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => enviar({})}>Quitar regla</button>}
        <button type="button" class="btn btn-peq" disabled={ocupado} onClick={alCerrar}>Cancelar</button>
      </div>
    </div>
  );
}
