import { useState } from 'preact/hooks';
import { Icono, usePreferencia } from './comunes.jsx';
import { recordatorioCompartir, PREF_RECORDATORIO } from '../logica/compartir.js';
import { HojaCompartir } from './compartir-perezoso.jsx';

// (compartir) En Hoy: si la última sesión (de hace 3 días como mucho) tuvo récords y no se compartió nada, lo propone
// una vez. Se quita con la cruz o al compartir. Lo guarda el resumen de la sesión en este móvil (PREF_RECORDATORIO).
export function RecordatorioCompartir() {
  const [estado, setEstado] = usePreferencia(PREF_RECORDATORIO, null);
  const [abrir, setAbrir] = useState(false);
  const r = recordatorioCompartir(estado);
  if (!r || !estado?.tarjetas?.length) return null;
  return (
    <section class="panel panel-pad recordatorio-compartir" aria-label="Compartir tu récord">
      <span class="ico" aria-hidden="true"><Icono n="trofeo" /></span>
      <button type="button" class="pila-xs recordatorio-texto" onClick={() => setAbrir(true)}>
        <strong>{r.titulo}</strong>
        <span class="peq secundario">{r.texto}</span>
      </button>
      <button type="button" class="btn btn-icono plano" aria-label="Quitar" onClick={() => setEstado({ ...estado, quitado: true })}><Icono n="cerrar" /></button>
      {abrir && <HojaCompartir logro tipo="record" titulo="Compartir el récord" datos={estado.tarjetas[0]} equipo={{ tema: 'logros' }} alCerrar={() => { setAbrir(false); setEstado(null); }} />}
    </section>
  );
}
