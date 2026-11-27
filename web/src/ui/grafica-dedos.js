// (tacto 233-235, v0.272) Las gráficas, con los dedos. Con un dedo, el titular de la tarjeta (la cifra grande) pasa a
// ser la del punto que se toca, con su fecha, y vuelve al soltar. Con dos, se marca un tramo y dice cuánto ha cambiado
// («+7,5 kg en 5 semanas»); si los dedos se separan o se juntan, cambia el rango (los botones siguen ahí). Llega con
// los demás gestos, con la app ya abierta, y lee de cada gráfica lo que ella deja en su caja (__graf, ui/comunes.jsx).
import { vibrar } from './hapticos.js';
import { partesPunto, puntoEn, cambioTramo, rangoAlPellizcar, PELLIZCO_MS } from '../logica/grafica-dedos.js';

export function instalarGraficaDedos() {
  let g = null;
  const datos = () => g?.caja?.__graf || null;
  const indice = (clientX) => {
    const d = datos(), svg = g.tactil.querySelector('svg');
    if (!d || !svg) return null;
    const r = svg.getBoundingClientRect();
    return puntoEn(d.xs, ((clientX - r.left) / Math.max(1, r.width)) * (svg.viewBox.baseVal?.width || r.width));
  };
  // ---- el titular (234)
  const titular = (i) => {
    const d = datos(), c = g.cifra;
    if (!c || !d || i == null) return;
    const p = partesPunto(d.textoPunto(i));
    if (!p) return;
    if (!g.tit) {
      g.tit = document.createElement('span');
      g.tit.className = 'gdd-titular';
      g.tit.setAttribute('aria-hidden', 'true');
      g.tit.innerHTML = '<span class="v num"></span><span class="u"></span>';
      // (lo demás del titular se esconde mientras; con su clase, no con una regla sobre «.cifra»: así los estilos viajan con este trozo)
      for (const x of c.children) x.classList.add('gdd-oculto');
      c.style.position = 'relative';
      c.appendChild(g.tit);
    }
    g.tit.firstChild.textContent = p.cifra;
    g.tit.lastChild.textContent = p.pie;
  };
  const sinTitular = () => { if (g?.tit) { g.tit.remove(); g.tit = null; for (const x of g.cifra?.children || []) x.classList.remove('gdd-oculto'); if (g.cifra) g.cifra.style.position = ''; } };
  // ---- el tramo (235)
  const tramo = () => {
    const d = datos();
    const xs = [...g.dedos.values()];
    if (!d || xs.length < 2) return;
    let [a, b] = [indice(xs[0]), indice(xs[1])];
    if (a == null || b == null) return;
    if (a > b) [a, b] = [b, a];
    if (!g.banda) {
      g.banda = document.createElement('span'); g.banda.className = 'gdd-tramo'; g.banda.setAttribute('aria-hidden', 'true');
      g.rotulo = document.createElement('span'); g.rotulo.className = 'gdd-cambio'; g.rotulo.setAttribute('aria-hidden', 'true');
      g.tactil.append(g.banda, g.rotulo);
      g.tactil.classList.add('gdd-dos');
    }
    const x1 = (d.xs[a] / d.W) * 100, x2 = (d.xs[b] / d.W) * 100;
    g.banda.style.left = `${x1.toFixed(2)}%`; g.banda.style.width = `${Math.max(0, x2 - x1).toFixed(2)}%`;
    const texto = a === b ? '' : cambioTramo(partesPunto(d.textoPunto(a)), partesPunto(d.textoPunto(b)), d.fechas?.[a], d.fechas?.[b]);
    g.rotulo.textContent = texto;
    g.rotulo.hidden = !texto;
    g.rotulo.style.left = `${Math.max(22, Math.min(78, (x1 + x2) / 2)).toFixed(2)}%`;
    const clave = `${a}-${b}`;
    if (clave !== g.clave) { g.clave = clave; vibrar('toque'); }
  };
  const sinTramo = () => { if (g?.banda) { g.banda.remove(); g.rotulo.remove(); g.banda = null; g.rotulo = null; g.tactil.classList.remove('gdd-dos'); g.clave = null; } };
  // ---- pellizcar (233): el botón de rango de al lado
  const pellizco = (ahora) => {
    const xs = [...g.dedos.values()];
    const sep = Math.abs(xs[0] - xs[1]);
    if (!(g.sep0 > 24)) { g.sep0 = sep; return; }
    if (ahora - (g.cambio || 0) < PELLIZCO_MS) return;
    const grupo = g.caja.parentElement?.querySelector('[role="group"][aria-label^="Rango"]');
    const bs = grupo ? [...grupo.querySelectorAll('button')] : [];
    const sig = rangoAlPellizcar(bs.length, bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true'), sep / g.sep0);
    if (sig == null) return;
    g.cambio = ahora; g.sep0 = sep;
    sinTramo();
    vibrar('elegir');
    bs[sig].click();
  };

  const baja = (e) => {
    if (e.pointerType === 'mouse') return;
    const tactil = e.target.closest?.('.grafica-tactil');
    if (!tactil) return;
    if (g && g.tactil !== tactil) fin();
    if (!g) { const caja = tactil.parentElement; g = { tactil, caja, cifra: caja.closest('.panel')?.querySelector('.cifra') || null, dedos: new Map() }; }
    g.dedos.set(e.pointerId, e.clientX);
    if (g.dedos.size === 1) titular(indice(e.clientX));
    else { sinTitular(); g.sep0 = 0; tramo(); }
  };
  const mueve = (e) => {
    if (!g || !g.dedos.has(e.pointerId)) return;
    g.dedos.set(e.pointerId, e.clientX);
    if (g.dedos.size === 1) titular(indice(e.clientX));
    else { pellizco(e.timeStamp); if (g && e.timeStamp - (g.cambio || 0) > PELLIZCO_MS) tramo(); }
  };
  function fin() { sinTitular(); sinTramo(); g = null; }
  const sube = (e) => {
    if (!g || !g.dedos.has(e.pointerId)) return;
    g.dedos.delete(e.pointerId);
    if (!g.dedos.size) fin(); else { sinTramo(); titular(indice([...g.dedos.values()][0])); }
  };
  document.addEventListener('pointerdown', baja, true); document.addEventListener('pointermove', mueve, true); document.addEventListener('pointerup', sube, true); document.addEventListener('pointercancel', sube, true);
  return () => {
    if (g) fin();
    document.removeEventListener('pointerdown', baja, true); document.removeEventListener('pointermove', mueve, true); document.removeEventListener('pointerup', sube, true); document.removeEventListener('pointercancel', sube, true);
  };
}
