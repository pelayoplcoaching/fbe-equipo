// (vista 274, v0.277) El calendario de la casa: un mes de la app, con el lunes primero y hoy marcado, en lugar del
// selector de fecha del navegador. Para un día («¿Para cuándo?») o para un tramo («Me voy el / Vuelvo el»: el viaje se
// pinta entero). Con el teclado: las flechas mueven el día, Inicio y Fin van al principio y al final de la semana, y
// AvPág y RePág cambian de mes. Las cuentas, en logica/calendario.js.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { mesDe, diasDelMes, sumarMeses, dentro, elegirEnTramo, nombreMes, nombreDia, INICIALES } from '../../logica/calendario.js';
import { hoyISO, sumarDias } from '../../logica/fechas.js';

// valor: 'AAAA-MM-DD' (un día) o { desde, hasta } (un tramo); alCambiar(nuevo); min y max: los límites; etiqueta: su nombre
export function CalendarioCasa({ valor, alCambiar, min = null, max = null, tramo = false, etiqueta = 'Elige el día' }) {
  const hoy = hoyISO();
  const primero = tramo ? valor?.desde || hoy : valor || hoy;
  const [mes, setMes] = useState(() => mesDe(dentro(primero, min, max) || primero));
  const [foco, setFoco] = useState(() => dentro(primero, min, max) || primero);
  const rejilla = useRef(null);
  const moverFoco = useRef(false);
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    rejilla.current?.querySelector(`[data-dia="${foco}"]`)?.focus({ preventScroll: true });
  }, [foco, mes]);
  const dias = diasDelMes(mes);
  const vale = (d) => (!min || d >= min) && (!max || d <= max);
  const desde = tramo ? valor?.desde || '' : '', hasta = tramo ? valor?.hasta || '' : '';
  const elegir = (d) => {
    if (!vale(d)) return;
    vibrar('elegir');
    setFoco(d);
    if (tramo) alCambiar(elegirEnTramo({ desde, hasta }, d));
    else alCambiar(d);
  };
  const ir = (d) => {
    const x = dentro(d, min, max);
    if (!x) return;
    moverFoco.current = true;
    setFoco(x);
    if (mesDe(x) !== mes) setMes(mesDe(x));
  };
  const tecla = (e) => {
    const d = e.currentTarget.dataset.dia;
    const salto = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (salto) { e.preventDefault(); ir(sumarDias(d, salto)); return; }
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); ir(sumarMeses(d, e.key === 'PageDown' ? 1 : -1)); return; }
    const dow = (new Date(`${d}T12:00:00`).getDay() + 6) % 7;
    if (e.key === 'Home') { e.preventDefault(); ir(sumarDias(d, -dow)); }
    if (e.key === 'End') { e.preventDefault(); ir(sumarDias(d, 6 - dow)); }
  };
  // (con las flechas de arriba se cambia de mes: el día que recibe el foco, el elegido si está en ese mes o el primero)
  const focoMes = mesDe(foco) === mes && vale(foco) ? foco : dias.find((d) => d && vale(d)) || null;
  const antes = sumarMeses(`${mes}-01`, -1).slice(0, 7), despues = sumarMeses(`${mes}-01`, 1).slice(0, 7);
  const puedeAntes = !min || `${antes}-31` >= min, puedeDespues = !max || `${despues}-01` <= max;
  const enTramo = (d) => tramo && desde && hasta && d >= desde && d <= hasta;
  return (
    <div class="clc-raiz" role="group" aria-label={etiqueta}>
      <div class="clc-cab">
        <button type="button" class="btn btn-icono plano clc-paso" disabled={!puedeAntes} onClick={() => { setMes(antes); }} aria-label={`Mes anterior: ${nombreMes(antes)}`}><Icono n="atras" /></button>
        <strong class="clc-mes" aria-live="polite">{nombreMes(mes)}</strong>
        <button type="button" class="btn btn-icono plano clc-paso" disabled={!puedeDespues} onClick={() => { setMes(despues); }} aria-label={`Mes siguiente: ${nombreMes(despues)}`}><Icono n="derecha" /></button>
      </div>
      <div class="clc-sem" aria-hidden="true">{INICIALES.map((x) => <span key={x}>{x}</span>)}</div>
      <div class="clc-dias" ref={rejilla}>
        {dias.map((d, i) => (d ? (
          <button type="button" key={d} data-dia={d} tabIndex={d === focoMes ? 0 : -1} disabled={!vale(d)} onClick={() => elegir(d)} onKeyDown={tecla}
            class={`clc-d${d === hoy ? ' clc-hoy' : ''}${enTramo(d) ? ' clc-en' : ''}${d === desde ? ' clc-ini' : ''}${d === hasta ? ' clc-fin' : ''}${!tramo && d === valor ? ' clc-elegido' : ''}`}
            aria-pressed={(tramo ? d === desde || d === hasta : d === valor) ? 'true' : 'false'}
            aria-label={`${nombreDia(d)}${d === hoy ? ', hoy' : ''}${d === desde ? ', te vas' : ''}${d === hasta ? ', vuelves' : ''}`}>
            <span class="num">{Number(d.slice(8))}</span>
          </button>
        ) : <span key={`h${i}`} class="clc-vacio" aria-hidden="true" />))}
      </div>
    </div>
  );
}
