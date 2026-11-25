// (v0.208, rendimiento) La tarjeta del cuestionario en Hoy, aparte de la hoja (Cuestionario.jsx): la hoja, con todas sus
// preguntas, solo se carga al abrirla.
import { Icono, useSinCoach } from '../comunes.jsx';

// Tarjeta de Hoy: el coach lo pide (o pide que se actualice)
export function TarjetaCuestionario({ cuestionario, abrir }) {
  const actualizar = !!cuestionario?.completado_en;
  const sinCoach = useSinCoach();
  return (
    <section class="nota-coach tarjeta-cuestionario" aria-label="Cuestionario">
      <Icono n="pregunta" />
      <div class="pila-s">
        <strong>{sinCoach ? (actualizar ? 'Toca actualizar tu cuestionario' : 'Tu cuestionario inicial') : actualizar ? 'Tu coach te pide que actualices tu cuestionario' : 'Tu coach te pide tu cuestionario inicial'}</strong>
        <span class="peq">{actualizar ? 'Revisa si algo ha cambiado: objetivo, tiempo, lesiones o salud.' : 'Son unos minutos: tu objetivo, tu tiempo, tu material y tu salud.'}</span>
        <button class="btn btn-primario btn-peq" style="justify-self:start" onClick={abrir}>{actualizar ? 'Revisarlo' : 'Empezar'}</button>
      </div>
    </section>
  );
}
