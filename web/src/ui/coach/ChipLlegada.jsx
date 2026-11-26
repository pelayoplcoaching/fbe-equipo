// Para el coach: cómo llegó el atleta a la sesión (antes en ui/atleta/Preparacion.jsx: aquí va con el panel del coach y no
// pesa al abrir la app del atleta)
import { consejoPreparacion } from '../../logica/preparacion.js';
import { textoPreparacion } from '../../logica/preparacion-texto.js';

export function ChipLlegada({ preparacion, soloAvisos = false }) {
  const c = consejoPreparacion(preparacion);
  if (!c || (soloAvisos && c.nivel === 'bien')) return null;
  return (
    <span class="llegada"><span class={`chip ${c.nivel}`}>Llegó: {c.nivel === 'bien' ? 'bien' : c.nivel === 'flojo' ? 'día flojo' : 'día difícil'}</span>
      <span class="mini secundario">{textoPreparacion(preparacion)}</span></span>
  );
}
