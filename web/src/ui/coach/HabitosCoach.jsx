// Hábitos del atleta en su ficha (Seguimiento): cómo los lleva y ponerlos, cambiarlos o quitarlos.
// Como en Trainerize o TrueCoach: pocos hábitos, con objetivo y días a la semana, y su cumplimiento a 7 y 30 días.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Segmentos, Vacio } from '../comunes.jsx';
import { AnilloHabito, COLOR_HABITO } from '../atleta/Habitos.jsx';
import { PLANTILLAS_HABITO, ICONOS_HABITO, textoObjetivo, textoValor } from '../../logica/habitos.js';
import { LETRAS_DIA } from '../../logica/plan.js';
import { fmtConDia } from '../../logica/fechas.js';
import { num, leerNumero } from '../../logica/calculos.js';

const MAX_HABITOS = 6;

export function HabitosCoach({ atleta }) {
  const { api, aviso } = useApp();
  const res = useCarga(() => api.resumenHabitos(atleta.id), [atleta.id]);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | habito
  const [quitando, setQuitando] = useState(null);
  const [ocupado, una] = useUnaVez();
  const lista = res.datos || [];
  return (
    <section class="seccion">
      <div class="seccion-cab">
        <h2>Hábitos</h2>
        {lista.length < MAX_HABITOS && <button class="btn-texto" onClick={() => setEditando('nuevo')}><Icono n="mas" /> Añadir hábito</button>}
      </div>
      <div class="panel">
        {!lista.length ? (
          <Vacio icono="diana" titulo="Sin hábitos" accion={<button class="btn btn-peq" onClick={() => setEditando('nuevo')}><Icono n="mas" /> Añadir hábito</button>}>
            Pasos, proteína, agua, horas de sueño o uno de sí o no. El atleta los marca cada día en Hoy y tú ves cómo los lleva.
          </Vacio>
        ) : (
          <ul class="lista">
            {lista.map((r) => {
              const h = r.habito;
              return (
                <li key={h.id} class="habito-coach">
                  <AnilloHabito h={h} fraccion={r.pct7.pct / 100} cumple={r.pct7.pct >= 100} tam={44} />
                  <div class="pila-xs" style="min-width:0">
                    <strong>{h.nombre}</strong>
                    <span class="mini terciario">{textoObjetivo(h)}</span>
                    <span class="semana-mini" role="img" style={{ '--c': COLOR_HABITO[h.icono] }}
                      aria-label={`Esta semana: ${r.semana.cumplidos} de ${r.semana.pedidos} días`}>
                      {r.semana.dias.map((d, i) => (
                        <i key={d.iso} class={`${d.cumple ? 'si' : d.valor != null ? 'casi' : ''} ${d.futuro ? 'futuro' : ''}`} title={`${fmtConDia(d.iso)}${d.valor != null ? `: ${textoValor(h, d.valor)}` : ''}`}>{LETRAS_DIA[i]}</i>
                      ))}
                    </span>
                  </div>
                  <div class="habito-coach-cifras num">
                    <span><b>{r.pct7.pct} %</b> 7 días</span>
                    <span class="terciario">{r.pct30.pct} % 30 días</span>
                    {r.media7 != null && <span class="terciario">media {textoValor(h, Math.round(r.media7 * 10) / 10)}</span>}
                  </div>
                  <span class="fila" style="gap:2px">
                    <button class="btn btn-icono plano" aria-label={`Cambiar ${h.nombre}`} onClick={() => setEditando(h)}><Icono n="editar" /></button>
                    <button class="btn btn-icono plano btn-peligro" aria-label={`Quitar ${h.nombre}`} onClick={() => setQuitando(h)}><Icono n="basura" /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {lista.length > 0 && <p class="mini terciario">El % es de los días pedidos (por ejemplo, 5 de 6), contando solo desde que pusiste el hábito. La media es de los días apuntados.</p>}
      {editando && <HojaHabitoCoach habito={editando === 'nuevo' ? null : editando} alCerrar={() => setEditando(null)}
        alGuardar={async (fila) => {
          await api.guardarHabito(atleta.id, fila, editando === 'nuevo' ? null : editando.id);
          aviso(editando === 'nuevo' ? `Hábito «${fila.nombre}» añadido` : 'Hábito guardado');
          setEditando(null); res.recargar(true);
        }} />}
      {quitando && (
        <Hoja titulo={`Quitar «${quitando.nombre}»`} alCerrar={() => setQuitando(null)}>
          <p class="secundario">Deja de aparecerle en Hoy. Si ya tiene días apuntados, se guardan (el hábito queda archivado y sigue en su exportación).</p>
          <button class="btn btn-peligro btn-grande" disabled={ocupado} onClick={() => una(async () => {
            try {
              const r = await api.quitarHabito(quitando.id);
              aviso(r.archivado ? 'Hábito archivado: lo apuntado se conserva' : 'Hábito quitado');
              setQuitando(null); res.recargar(true);
            } catch (e) { aviso(e.message, 'error'); }
          })}><Icono n="basura" /> Quitar el hábito</button>
        </Hoja>
      )}
    </section>
  );
}

function HojaHabitoCoach({ habito, alCerrar, alGuardar }) {
  const [f, setF] = useState(() => habito ? { ...habito, objetivo: habito.objetivo == null ? '' : num(habito.objetivo, 2) } : { nombre: '', tipo: 'numero', objetivo: '', unidad: '', sentido: 'al_menos', dias_semana: 7, icono: 'libre' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (c) => setF({ ...f, ...c });
  const usarPlantilla = (p) => setF({ ...f, ...p, objetivo: p.objetivo == null ? '' : num(p.objetivo, 2), unidad: p.unidad || '', sentido: 'al_menos' });
  const guardar = (e) => {
    e.preventDefault();
    setError(null);
    // «8.000» y «8000» son ocho mil; «2,5» y «2.5», dos y medio (como al apuntar)
    const objetivo = f.tipo !== 'numero' ? null : leerNumero(f.objetivo);
    if (!f.nombre.trim()) { setError('Ponle un nombre.'); return; }
    if (f.tipo === 'numero' && !(objetivo > 0)) { setError('Escribe el objetivo (un número mayor que cero).'); return; }
    una(async () => {
      try {
        await alGuardar({ nombre: f.nombre.trim().slice(0, 60), tipo: f.tipo, objetivo, unidad: f.tipo === 'numero' ? (f.unidad || '').trim().slice(0, 12) || null : null,
          sentido: f.tipo === 'numero' ? f.sentido : 'al_menos', dias_semana: f.dias_semana, icono: f.icono });
      } catch (err) { setError(err.message); }
    });
  };
  return (
    <Hoja titulo={habito ? `Cambiar «${habito.nombre}»` : 'Nuevo hábito'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        {!habito && (
          <div class="pila-s">
            <span class="etq">Empieza por uno habitual</span>
            <div class="fila-envolver">
              {PLANTILLAS_HABITO.map((p) => <button type="button" key={p.nombre} class={`chip-plantilla ${f.nombre === p.nombre ? 'elegida' : ''}`} onClick={() => usarPlantilla(p)}><Icono n={p.icono} />{p.nombre}</button>)}
            </div>
          </div>
        )}
        <div class="campo"><label for="hab-nombre">Nombre</label><input id="hab-nombre" class="entrada" maxLength={60} value={f.nombre} onInput={(e) => cambiar({ nombre: e.currentTarget.value })} placeholder="Pasos, proteína, 10 min de movilidad…" /></div>
        {habito ? (
          // La base no deja cambiar el tipo si ya hay días apuntados (9000 pasos no son un «hecho»)
          <div class="campo"><span class="etq">Cómo se apunta</span><p class="peq secundario">{f.tipo === 'numero' ? 'Con un número' : 'Sí o no'}. Para cambiarlo, quita este hábito y crea otro.</p></div>
        ) : (
          <div class="campo"><span class="etq">Cómo se apunta</span><Segmentos etiqueta="Cómo se apunta" valor={f.tipo} opciones={[['numero', 'Con un número'], ['si_no', 'Sí o no']]} alCambiar={(v) => v && cambiar({ tipo: v })} /></div>
        )}
        {f.tipo === 'numero' && (
          <>
            <div class="fila-campos">
              <div class="campo"><label for="hab-obj">Objetivo</label><input id="hab-obj" class="entrada" inputMode="decimal" value={f.objetivo} onInput={(e) => cambiar({ objetivo: e.currentTarget.value })} placeholder="8000" /></div>
              <div class="campo"><label for="hab-uni">Unidad</label><input id="hab-uni" class="entrada" maxLength={12} list="hab-unidades" value={f.unidad || ''} onInput={(e) => cambiar({ unidad: e.currentTarget.value })} placeholder="pasos, g, l, h…" />
                <datalist id="hab-unidades">{['pasos', 'g', 'l', 'h', 'min', 'raciones', 'kcal', 'cafés'].map((u) => <option key={u} value={u} />)}</datalist></div>
            </div>
            <div class="campo"><span class="etq">Se cumple</span><Segmentos etiqueta="Se cumple" valor={f.sentido} opciones={[['al_menos', 'Llegando al objetivo'], ['como_mucho', 'Sin pasarse']]} alCambiar={(v) => v && cambiar({ sentido: v })} /></div>
          </>
        )}
        <div class="campo"><span class="etq">Días a la semana</span><Segmentos etiqueta="Días a la semana" clase="segmentos-dias" valor={f.dias_semana} opciones={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)])} alCambiar={(v) => v && cambiar({ dias_semana: v })} /></div>
        <div class="campo"><span class="etq">Icono</span>
          <div class="iconos-habito" role="group" aria-label="Icono">
            {ICONOS_HABITO.map(([id, t]) => <button type="button" key={id} aria-pressed={f.icono === id ? 'true' : 'false'} aria-label={`Icono: ${t.toLowerCase()}`} title={t} style={{ '--c': COLOR_HABITO[id] }} onClick={() => cambiar({ icono: id })}><Icono n={id} /></button>)}
          </div>
        </div>
        {error && <div class="error" role="alert">{error}</div>}
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{habito ? 'Guardar' : 'Añadir hábito'}</button>
      </form>
    </Hoja>
  );
}
