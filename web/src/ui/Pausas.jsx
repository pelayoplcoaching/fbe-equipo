// Pausar la asesoría (migración 078). Coach: en la ficha, la pausa de ahora (o la próxima), ponerla, cambiarla,
// terminarla hoy o quitarla. Atleta: en Hoy, que su asesoría está en pausa y cuándo vuelve.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, useUnaVez } from './comunes.jsx';
import { MOTIVOS_PAUSA, NOMBRE_MOTIVO, MAX_NOTA_PAUSA, pausaVigente, pausaProxima, textoPausaAtleta, textoPausaCoach, textoHasta, diasDePausa } from '../logica/pausas.js';
import { fechaMadrid, sumarDias, fmtCorta } from '../logica/fechas.js';

// Atleta, en Hoy
export function AvisoPausa() {
  const { api, atleta, propio } = useApp();
  const lista = useCarga(() => (propio ? Promise.resolve([]) : api.pausas(atleta.id).catch(() => [])), [atleta.id, propio], { recuerdo: `pausas:${atleta.id}` });
  const p = pausaVigente(lista.datos || [], fechaMadrid());
  if (!p || atleta.estado === 'baja') return null;
  const t = textoPausaAtleta(p);
  return (
    <section class="nota-coach aviso-pausa" aria-label="Asesoría en pausa">
      <Icono n="pausa" />
      <div class="pila-xs"><strong>{t.titulo}</strong><span class="peq">{t.detalle}</span>{p.nota && <span class="cita peq">«{p.nota}»</span>}</div>
    </section>
  );
}

// Coach, en la ficha (pestaña Datos)
export function PausaCoach({ atleta, alCambiar }) {
  const { api, aviso } = useApp();
  const con078 = useCarga(() => api.pausas078().catch(() => null), []);
  const lista = useCarga(() => api.pausas(atleta.id).catch(() => []), [atleta.id]);
  const [f, setF] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (con078.datos !== true || atleta.estado !== 'activo') return null;
  const hoy = fechaMadrid();
  const pausas = lista.datos || [];
  const ahora = pausaVigente(pausas, hoy), proxima = pausaProxima(pausas, hoy);
  const hacer = (fn, hecho) => una(async () => { setError(null); try { await fn(); await lista.recargar(true); aviso(hecho); setF(null); alCambiar?.(); } catch (e) { setError(e.message); aviso(e.message, 'error'); } });
  const editar = (p) => { setError(null); setF(p ? { id: p.id, desde: p.desde, hasta: p.hasta || '', motivo: p.motivo, nota: p.nota || '' } : { desde: hoy, hasta: '', motivo: 'vacaciones', nota: '' }); };
  const pasadas = pausas.filter((p) => p.hasta && p.hasta < hoy).slice(-3).reverse();
  return (
    <section class="panel panel-pad pila-s pausa-coach" aria-label="Pausa de la asesoría">
      <div class="separa"><strong>Pausa de la asesoría</strong>
        {!ahora && !proxima && <button type="button" class="btn btn-peq" onClick={() => editar(null)}><Icono n="pausa" /> Poner en pausa</button>}</div>
      {ahora ? (
        <div class="pila-s">
          <p class="peq"><span class="chip aviso">En pausa</span> {textoPausaCoach(ahora)}, desde el {fmtCorta(ahora.desde)} ({diasDePausa(ahora, hoy)} {diasDePausa(ahora, hoy) === 1 ? 'día' : 'días'}).</p>
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={() => editar(ahora)}><Icono n="editar" /> Cambiar</button>
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => hacer(() => (ahora.desde >= hoy ? api.quitarPausa(ahora.id) : api.guardarPausa(atleta.id, { ...ahora, hasta: sumarDias(hoy, -1) })), 'Pausa terminada: vuelve hoy')}>Terminar hoy</button>
          </div>
        </div>
      ) : proxima ? (
        <div class="pila-s">
          <p class="peq">Empieza el {fmtCorta(proxima.desde)}, {textoHasta(proxima)} ({NOMBRE_MOTIVO[proxima.motivo].toLowerCase()}).</p>
          <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => editar(proxima)}><Icono n="editar" /> Cambiar</button>
        </div>
      ) : <p class="peq secundario">Vacaciones, una temporada complicada, un parón… En pausa no recibe recordatorios (tus mensajes sí le llegan), no sale en tus alertas ni en «A quién escribir» y su racha no se rompe. Puede seguir entrando. Los cobros no cambian.</p>}
      {pasadas.length > 0 && <p class="mini terciario">Anteriores: {pasadas.map((p) => `${fmtCorta(p.desde)} a ${fmtCorta(p.hasta)} (${NOMBRE_MOTIVO[p.motivo].toLowerCase()})`).join('; ')}.</p>}
      {error && !f && <div class="error" role="alert">{error}</div>}
      {f && (
        <Hoja titulo={f.id ? 'Cambiar la pausa' : 'Poner en pausa'} alCerrar={() => setF(null)}>
          <form class="pila" onSubmit={(e) => { e.preventDefault(); hacer(() => api.guardarPausa(atleta.id, f), f.id ? 'Pausa cambiada' : 'En pausa'); }} noValidate>
            <div class="campo"><label for="pa-motivo">Motivo</label>
              <select id="pa-motivo" class="selector" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.currentTarget.value })}>{MOTIVOS_PAUSA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
            <div class="rejilla-campos">
              <div class="campo"><label for="pa-desde">Desde</label><input id="pa-desde" type="date" class="entrada" required value={f.desde} onInput={(e) => setF({ ...f, desde: e.currentTarget.value })} /></div>
              <div class="campo"><label for="pa-hasta">Último día de pausa</label><input id="pa-hasta" type="date" class="entrada" min={f.desde} value={f.hasta} onInput={(e) => setF({ ...f, hasta: e.currentTarget.value })} aria-describedby="pa-hasta-ayuda" /></div>
            </div>
            <span id="pa-hasta-ayuda" class="mini terciario">Vuelve solo al día siguiente. Sin fecha, sigue en pausa hasta que la termines tú.</span>
            <div class="campo"><label for="pa-nota">Mensaje para el atleta (opcional)</label>
              <input id="pa-nota" class="entrada" maxLength={MAX_NOTA_PAUSA} value={f.nota} onInput={(e) => setF({ ...f, nota: e.currentTarget.value })} placeholder="Recupérate bien, aquí seguimos" /></div>
            <p class="mini terciario">El atleta ve en Hoy que está en pausa, hasta cuándo y este mensaje.</p>
            {error && <div class="error" role="alert">{error}</div>}
            <button class="btn btn-primario btn-grande" disabled={ocupado}>{f.id ? 'Guardar' : 'Poner en pausa'}</button>
            {f.id && <button type="button" class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.quitarPausa(f.id), 'Pausa quitada')}><Icono n="basura" /> Quitar esta pausa</button>}
          </form>
        </Hoja>
      )}
    </section>
  );
}
