// (vista 253, v0.274) Los avisos de Hoy, apilados (FBE Esencial). Las tarjetas las pinta cada parte de la app por su
// cuenta (la nota de Pelayo, tus marcas, tu revisión, lo de esta semana, el reto…): aquí solo se cuentan las que llevan
// data-aviso="info" entre las tarjetas de Hoy y, con tres o más, se deja una encima (la marcada con data-aviso-cima; si
// no hay, la primera) y el resto debajo, con «Ver los N». Las que piden algo no llevan esa marca: no se esconden nunca.
// Se quita en «Ordenar Hoy» («Apilar los avisos»). Va aparte: llega con Hoy ya pintado (Esencial.jsx lo pide).
import { render } from 'preact';
import { Icono } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { seApila, cimaDe, rotuloPila, debajoDe } from '../../logica/pila-avisos.js';
import { EVENTO_PILA, quiereApilar } from './pila-pref.js';

const nombreDe = (el) => (el.dataset.avisoNombre || el.getAttribute('aria-label') || document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent || '').trim();

// raiz: Hoy (la caja con sus tarjetas). El boton de la pila es un nodo propio, que se coloca justo debajo del aviso de
// encima (cerrada) o del ultimo (abierta): las tarjetas no se mueven de su sitio. Devuelve como quitarlo
export function instalarPila(raiz) {
  let abierta = false, antes = '';
  const pie = document.createElement('div');
  pie.className = 'pav-pie';
  const lista = () => [...raiz.querySelectorAll('[data-aviso="info"]')];
  const cambiar = () => {
    abierta = !abierta;
    vibrar('elegir');
    pintar();
    if (abierta && !sinMovimiento()) {
      lista().filter((el) => !('cima' in el.dataset)).forEach((el, k) => {
        try { el.animate([{ transform: 'translateY(-22px) scale(.97)' }, { transform: 'none' }], { duration: 260, delay: k * 40, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' }); } catch { /* sin animaciones */ }
      });
    }
    if (!abierta) { try { raiz.querySelector('[data-cima]')?.scrollIntoView({ block: 'nearest' }); } catch { /* */ } }
    pie.querySelector('button')?.focus?.({ preventScroll: true });
  };
  function pintar() {
    const infos = lista();
    const n = infos.length;
    const activa = seApila(n, quiereApilar());
    if (!activa) abierta = false;
    const i = activa ? cimaDe(infos.map((el) => ({ cima: el.hasAttribute('data-aviso-cima') }))) : -1;
    const nombres = infos.map(nombreDe);
    // (el boton, en su sitio: tras el de encima o tras el ultimo; si la app repinta y lo deja en otro lado, vuelve)
    const tras = activa ? (abierta ? infos[n - 1] : infos[i]) : null;
    if (tras ? pie.previousElementSibling !== tras : pie.isConnected) { if (tras) tras.after(pie); else pie.remove(); }
    const firma = `${activa ? (abierta ? 'a' : 'c') : ''}|${i}|${nombres.join('|')}`;
    if (firma === antes) return;
    antes = firma;
    infos.forEach((el, k) => {
      if (k === i) el.dataset.cima = ''; else delete el.dataset.cima;
      if (activa && !abierta && k !== i) el.dataset.bajo = ''; else delete el.dataset.bajo;
    });
    if (activa) pie.dataset.apila = abierta ? 'abierta' : 'cerrada';
    render(activa ? (
      <button type="button" class="pav-ver" aria-expanded={abierta ? 'true' : 'false'} onClick={cambiar}>
        <span class="pav-ver-t">{rotuloPila(n, abierta)}</span>
        {!abierta && <span class="pav-ver-s">{debajoDe(nombres, i)}</span>}
        <Icono n="abajo" class="pav-ver-f" />
      </button>
    ) : null, pie);
  }
  const mo = new MutationObserver(pintar);
  mo.observe(raiz, { childList: true, subtree: true });
  window.addEventListener(EVENTO_PILA, pintar);
  pintar();
  return () => {
    mo.disconnect(); window.removeEventListener(EVENTO_PILA, pintar); render(null, pie); pie.remove();
    for (const el of lista()) { delete el.dataset.cima; delete el.dataset.bajo; }
  };
}
