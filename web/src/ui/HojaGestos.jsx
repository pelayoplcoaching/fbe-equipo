// (belleza 343) La hoja «Gestos» de Ajustes, en su propio trozo: solo se carga al abrirla (no suma al arranque).
import { Hoja, GrupoIos, FilaIos } from './comunes.jsx';
import { Interruptor } from './Interruptor.jsx';

// (belleza 343) Los gestos: todo lo que se hace con el dedo y, detrás de «O», cómo se hace tocando. «Solo botones» los
// apaga todos (deslizar, arrastrar y mantener pulsado: lo miran los propios gestos con soloBotones, de ajustes.js);
// desplazar, ampliar una foto, leer una gráfica con un dedo y tirar hacia abajo para actualizar siguen igual
const GESTOS = [
  ['intercambiar', 'Deslizar a los lados', 'Cambia de pestaña y de semana. O toca la pestaña o la flecha.'],
  ['hecho', 'Deslizar una fila a la derecha', 'Marca la serie, el hábito o la tarea. O toca su casilla.'],
  ['ojo-abierto', 'Mantener pulsado', 'Asoma una sesión, un ejercicio, una receta o una medalla; en una serie, abre sus kilos. O tócala.'],
  ['hoy', 'La barra de abajo', 'Desliza el pulgar para cambiar de sección o mantén una pulsada para sus atajos. O toca cada sección.'],
  ['play', 'Las historias', 'Mantén pulsado para pararla, desliza hacia abajo para cerrarla y de lado para pasar. O la pausa, la ✕ y tocar los lados.'],
  ['abajo', 'Las hojas', 'Arrástralas hacia abajo para cerrarlas. O toca la ✕.'],
  ['ajustes', 'Interruptores y opciones', 'Arrastra la bola o la pastilla. O tócalos.'],
  ['regla', 'Las cifras y la regla', 'Arrastra sobre una cifra o desliza la regla. O el − y el +, o el teclado.'],
  ['reloj', 'El descanso', 'Desliza el dedo de lado sobre el reloj para sumar o quitar tiempo. O −15 s y +15 s.'],
  ['diana', 'Las escalas', 'Recorre los números con el dedo. O toca el tuyo.'],
  ['progreso', 'Las gráficas', 'Con dos dedos comparas un tramo; pellizcando cambias el rango. O los botones del rango.'],
  ['trofeo', 'La medalla', 'Gírala con el dedo. O tócala para darle la vuelta.'],
  ['receta', 'El modo cocina', 'Desliza para cambiar de paso. O «Anterior» y «Siguiente».'],
  ['estrella', 'Los apuntes', 'Desliza la ficha para contestar. O sus botones.'],
  ['mensaje', 'El chat', 'Desliza un mensaje para responder o mantenlo pulsado para su menú. O «Más opciones», que con solo botones se ve en cada mensaje.'],
  ['imagen', 'Las fotos', 'Desliza para pasar o para cerrar. O las flechas y la ✕.'],
  ['biblioteca', 'El índice de letras', 'Recórrelo con el dedo. O toca una letra.'],
];
export function HojaGestos({ a, cambiar, alCerrar }) {
  return (
    <Hoja titulo="Gestos" alCerrar={alCerrar}>
      <GrupoIos id="aj-gestos-modo" titulo="Cómo lo prefieres">
        <Interruptor id="aj-solo-botones" icono="gesto" texto="Solo botones" valor={a.soloBotones === true} alCambiar={(v) => cambiar('soloBotones', v)}
          ayuda="Los gestos de la lista no hacen nada: todo se hace tocando. Desplazar, ampliar una foto y tirar hacia abajo para actualizar siguen igual." />
      </GrupoIos>
      <GrupoIos id="aj-gestos-lista" titulo="Lo que puedes hacer con el dedo" pie="Cada gesto tiene su botón: lo que va detrás de «O».">
        {GESTOS.map(([ico, t, d]) => <FilaIos key={t} icono={ico} titulo={t} detalle={d} />)}
      </GrupoIos>
    </Hoja>
  );
}
