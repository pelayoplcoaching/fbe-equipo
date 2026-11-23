// (v0.209, rendimiento) El modo ligero automático: mira si este móvil va lento al abrir la app (logica/ligero.js) y, si
// va, lo apunta en el propio móvil (30 días) y lo aplica en el momento (ui/ajustes.js pone data-ligero en <html>).
// Solo con «Automático» en Ajustes (de serie); con «Siempre» o «Nunca» no hace nada.
import { vaLento, memoriaBaja, lentoVigente, VENTANA_LIGERO } from '../logica/ligero.js';
import { hoyISO } from '../logica/fechas.js';
import { leerAjustes, leerLento, CLAVE_LENTO, aplicarTema } from './ajustes.js';

export function instalarLigero({ nav = typeof navigator !== 'undefined' ? navigator : null, Observador = globalThis.PerformanceObserver } = {}) {
  try {
    if (typeof window === 'undefined' || !nav) return;
    // (en las pruebas automáticas no se pone solo: la máquina de pruebas va lenta a ratos y cambiaría lo que se ve)
    if (nav.webdriver) return;
    const hoy = hoyISO();
    if (lentoVigente(leerLento(), hoy)) return;
    const apuntar = (por) => {
      try { localStorage.setItem(CLAVE_LENTO, JSON.stringify({ lento: true, desde: hoy, por })); } catch { /* sin almacenamiento: no se recuerda */ }
      if (leerAjustes().ligero === 'auto') aplicarTema();
    };
    if (memoriaBaja(Number(nav.deviceMemory))) { apuntar('memoria'); return; }
    if (typeof Observador !== 'function' || !(Observador.supportedEntryTypes || []).includes('longtask')) return;
    const bloqueos = [];
    let fin = null;
    const obs = new Observador((lista) => {
      for (const x of lista.getEntries()) bloqueos.push({ inicio: x.startTime, duracion: x.duration });
      if (vaLento(bloqueos)) { obs.disconnect(); clearTimeout(fin); apuntar('bloqueos'); }
    });
    obs.observe({ type: 'longtask', buffered: true });
    const ya = typeof performance !== 'undefined' ? performance.now() : 0;
    fin = setTimeout(() => obs.disconnect(), Math.max(0, VENTANA_LIGERO.hastaMs - ya) + 1000);
  } catch { /* medir nunca rompe nada */ }
}
