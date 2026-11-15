// Los suplementos de un atleta, en su ficha (migración 077): el coach le pauta los de la lista de FBE o uno con texto
// libre, ajusta la dosis y el momento, los quita y ve cuántos días los marca. El aviso al móvil lo elige el atleta.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, useUnaVez } from '../comunes.jsx';
import { detalleSuplemento, porAnadir, constanciaSuplemento, MOMENTOS, MAX_SUPLEMENTOS, MAX_NOMBRE, MAX_DOSIS } from '../../logica/suplementos.js';
import { fechaMadrid } from '../../logica/fechas.js';

export function SuplementosCoach({ atleta }) {
  const { api, aviso } = useApp();
  const estado = useCarga(() => api.suplementos(atleta.id).catch(() => null), [atleta.id]);
  const [f, setF] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const d = estado.datos;
  if (!d) return null;   // sin la 077, nada
  const hoy = fechaMadrid();
  const activos = (d.suplementos || []).filter((s) => s.activo !== false);
  const hacer = (fn, hecho) => una(async () => { setError(null); try { await fn(); await estado.recargar(true); if (hecho) aviso(hecho); return true; } catch (e) { setError(e.message); aviso(e.message, 'error'); return false; } });
  const guardar = (e) => { e.preventDefault(); hacer(() => api.guardarSuplemento(atleta.id, f), f.id ? 'Suplemento cambiado' : 'Suplemento pautado').then((bien) => { if (bien) setF(null); }); };
  return (
    <section class="seccion suplementos-coach" aria-label="Suplementos">
      <div class="separa"><h2>Suplementos</h2>
        {activos.length < MAX_SUPLEMENTOS && <button class="btn btn-peq" onClick={() => { setError(null); setF({ clave: null, nombre: '', dosis: '', momento: 'cuando' }); }}><Icono n="mas" /> Pautar</button>}</div>
      {!activos.length ? <p class="peq secundario">No toma ninguno. Páutale los que quieras: los marca en Hoy y, si quiere, se pone un aviso al móvil.</p> : (
        <div class="panel"><ul class="lista">
          {activos.map((s) => {
            const c = constanciaSuplemento(s, d.tomas, hoy);
            return (
              <li key={s.id}>
                <button class="respuesta suplemento-coach-fila" onClick={() => { setError(null); setF({ id: s.id, clave: s.clave, nombre: s.nombre, dosis: s.dosis || '', momento: s.momento, origen: s.origen }); }}>
                  <span><span class="nombre">{s.nombre}</span><br />
                    <span class="detalle">{[detalleSuplemento(s), s.origen === 'atleta' ? 'lo añadió él' : null, s.aviso_hora ? `aviso a las ${s.aviso_hora}` : null].filter(Boolean).join(', ') || 'Sin dosis'}</span></span>
                  <span class="suplemento-semana" aria-label={c.de ? `Lo ha marcado ${c.tomados} de los últimos ${c.de} días` : 'Aún sin días'}>
                    {c.dias.map((x) => <span key={x.fecha} class="punto-dia" data-hecho={x.tomado ? '' : undefined} aria-hidden="true" />)}
                    <span class="mini num">{c.de ? `${c.tomados}/${c.de}` : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul></div>
      )}
      {f && (
        <Hoja titulo={f.id ? 'Cambiar suplemento' : 'Pautar suplemento'} alCerrar={() => { setF(null); setError(null); }}>
          <form class="pila" onSubmit={guardar} noValidate>
            {!f.id && porAnadir(activos).length > 0 && (
              <div class="campo"><span class="etq" id="sc-lista">De la lista de FBE</span>
                <div class="selector-chips" role="group" aria-labelledby="sc-lista">
                  {porAnadir(activos).map((x) => <button type="button" key={x.clave} aria-pressed={f.clave === x.clave ? 'true' : 'false'} onClick={() => setF({ ...f, clave: x.clave, nombre: x.nombre, dosis: x.dosis, momento: x.momento })}>{x.nombre}</button>)}
                </div></div>
            )}
            <div class="campo"><label for="sc-nombre">Nombre</label><input id="sc-nombre" class="entrada" maxLength={MAX_NOMBRE} value={f.nombre} onInput={(e) => setF({ ...f, nombre: e.currentTarget.value, clave: null })} /></div>
            <div class="campo"><label for="sc-dosis">Dosis</label><input id="sc-dosis" class="entrada" maxLength={MAX_DOSIS} value={f.dosis || ''} onInput={(e) => setF({ ...f, dosis: e.currentTarget.value })} placeholder="5 g al día" /></div>
            <div class="campo"><label for="sc-momento">Cuándo</label>
              <select id="sc-momento" class="selector" value={f.momento} onChange={(e) => setF({ ...f, momento: e.currentTarget.value })}>{MOMENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
            <p class="mini terciario">La dosis de la lista es la habitual en adultos sanos: ajústala a este atleta. El aviso al móvil lo elige él.</p>
            {error && <div class="error" role="alert">{error}</div>}
            <button class="btn btn-primario btn-grande" disabled={ocupado || !f.nombre.trim()}>{f.id ? 'Guardar' : 'Pautar'}</button>
            {f.id && <button type="button" class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.quitarSuplemento(f.id), 'Suplemento quitado').then((bien) => { if (bien) setF(null); })}><Icono n="basura" /> Quitar</button>}
          </form>
        </Hoja>
      )}
    </section>
  );
}
