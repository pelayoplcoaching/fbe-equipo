// La pauta de cardio del coach, en una tarjeta (la sesión, Hoy y la portada de la sesión). (v0.207) En su propio archivo:
// así Hoy no arrastra la sesión entera al abrir la app.
import { Icono } from '../comunes.jsx';
import { num } from '../../logica/calculos.js';
import { NOMBRE_MODALIDAD, cardioHechoValido, textoCardioHecho, textoSaludCardio, palabrasEsfuerzo } from '../../logica/cardio.js';
import { DetalleCarreraSesion, pautaDeCarrera } from './Carrera.jsx';
import { TiempoSesion } from './Tiempo.jsx';
import { deFuera } from '../../logica/tiempo.js';
import { Cadencia } from './Musica.jsx';
import { tramosDeCarrera } from '../../logica/musica.js';

// Qué toca, cuánto y a qué esfuerzo; y, hecha, lo que se hizo
export function TarjetaCardio({ pauta, hecho, completada, sesionId = null }) {
  const h = cardioHechoValido(hecho) ? hecho : null;
  const kmTxt = (k) => num(k, k % 1 ? 1 : 0);
  return (
    <div class="panel panel-pad tarjeta-cardio">
      <span class="ico" aria-hidden="true"><Icono n="intervalos" /></span>
      <div class="pila-s">
        <div>
          <div class="peq secundario">{NOMBRE_MODALIDAD[pauta.modalidad]}</div>
          <div class="cifra-cardio">
            {pauta.minutos ? <>{pauta.minutos}{pauta.minutos_max ? `–${pauta.minutos_max}` : ''}<small>min</small></> : null}
            {pauta.minutos && pauta.km ? <small> y </small> : null}
            {pauta.km ? <>{kmTxt(pauta.km)}{pauta.km_max ? `–${kmTxt(pauta.km_max)}` : ''}<small>km</small></> : null}
          </div>
        </div>
        {/* (v0.133) la carrera: tipo, zona con sus pulsaciones, las partes y el semáforo antes de salir */}
        {pautaDeCarrera(pauta) && sesionId && <DetalleCarreraSesion pauta={pauta} sesionId={sesionId} completada={completada} hecho={h} />}
        {pauta.esfuerzo && <p class="peq">Esfuerzo {num(pauta.esfuerzo)} de 10: {palabrasEsfuerzo(pauta.esfuerzo)}.</p>}
        {/* (v0.142) si sale fuera y eligió su zona en Hoy: el tiempo de ahora y sus avisos (calor, frío, lluvia, viento, aire) */}
        {!h && !completada && deFuera(pauta) && <TiempoSesion modalidad={pauta.modalidad} />}
        {pauta.nota && <p class="peq secundario">{pauta.nota}</p>}
        {h ? <span class="chip ok"><Icono n="hecho" />Hecho: {NOMBRE_MODALIDAD[h.modalidad].toLowerCase()}, {textoCardioHecho(h)}{textoSaludCardio(h) ? ` · ${textoSaludCardio(h)}` : ''}</span>
          : !completada && <p class="mini terciario">Al terminar, apunta los minutos, los kilómetros y cuánto te ha costado.</p>}
        {/* (v0.104) el metrónomo de cadencia: pasos, pedaladas, zancadas, paladas o saltos por minuto */}
        {!h && !completada && <Cadencia modalidad={pauta.modalidad} tramos={tramosDeCarrera(pauta)} />}
      </div>
    </div>
  );
}
