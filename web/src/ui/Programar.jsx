import { useState } from 'preact/hooks';
import { Hoja, Icono, useUnaVez } from './comunes.jsx';
import { instanteMadrid, partesMadrid, fmtProgramado, sumarDias, lunesDe, fechaMadrid } from '../logica/fechas.js';

// Programar un envío (v0.48): el día y la hora (de Madrid) a la que sale un mensaje o un aviso. Hasta entonces el
// atleta no lo ve ni le llega la notificación (lo impone la base). conTexto: para cambiar también el texto.
export function HojaProgramar({ titulo = 'Programar el envío', inicial = null, conTexto = false, texto: textoInicial = '', alCerrar, alGuardar, boton = 'Programar', alEnviarYa = null }) {
  const ahora = partesMadrid();
  const hoy = fechaMadrid();
  const p0 = inicial ? partesMadrid(inicial) : { fecha: sumarDias(hoy, 1), hora: '08:00' };
  const [fecha, setFecha] = useState(p0.fecha);
  const [hora, setHora] = useState(p0.hora);
  const [texto, setTexto] = useState(textoInicial);
  const [ocupado, una] = useUnaVez();
  const instante = instanteMadrid(fecha, hora);
  const futuro = !!instante && Date.parse(instante) > Date.now() + 60000;
  const lejos = !!instante && Date.parse(instante) > Date.now() + 90 * 864e5;
  const lunes = sumarDias(lunesDe(hoy), 7);
  const rapidos = [
    ...(ahora.hora < '17:30' ? [['Esta tarde, 18:00', hoy, '18:00']] : []),
    ['Mañana, 8:00', sumarDias(hoy, 1), '08:00'],
    ...(sumarDias(hoy, 1) !== lunes ? [['El lunes, 8:00', lunes, '08:00']] : []),
  ];
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); if (futuro && !lejos) una(() => alGuardar({ enviarEn: instante, texto })); }}>
        {conTexto && (
          <div class="campo"><label for="prog-texto">Mensaje</label>
            <textarea id="prog-texto" class="area" rows={3} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        )}
        <div class="selector-chips" role="group" aria-label="Cuándo, rápido">
          {rapidos.map(([t, f, h]) => <button type="button" key={t} aria-pressed={fecha === f && hora === h ? 'true' : 'false'} onClick={() => { setFecha(f); setHora(h); }}>{t}</button>)}
        </div>
        <div class="rejilla-campos">
          <div class="campo"><label for="prog-fecha">Día</label><input id="prog-fecha" class="entrada" type="date" required min={hoy} max={sumarDias(hoy, 89)} value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} /></div>
          <div class="campo"><label for="prog-hora">Hora</label><input id="prog-hora" class="entrada" type="time" required step="300" value={hora} onInput={(e) => setHora(e.currentTarget.value)} /></div>
        </div>
        <p class={`peq ${futuro && !lejos ? 'secundario' : 'error-campo'}`} role="status">
          {!instante ? 'Elige el día y la hora.' : lejos ? 'Como mucho a 90 días vista.' : !futuro ? 'Esa hora ya ha pasado: elige una más adelante.' : `Saldrá el ${fmtProgramado(instante)} (hora de Madrid). Hasta entonces no lo verá ni le llegará nada.`}
        </p>
        <button class="btn btn-primario btn-grande" disabled={ocupado || !futuro || lejos || (conTexto && !texto.trim())}><Icono n="reloj" /> {boton}</button>
        {alEnviarYa && <button type="button" class="btn" disabled={ocupado} onClick={() => una(() => alEnviarYa({ texto }))}><Icono n="enviar" /> Enviarlo ya</button>}
      </form>
    </Hoja>
  );
}
