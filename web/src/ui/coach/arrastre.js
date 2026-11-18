// (v0.184) Reordenar arrastrando, con el dedo o con el raton: se coge por el asa (un boton con onPointerDown) y se
// suelta donde marca la raya. Sin librerias: eventos de puntero, y las clases se ponen a mano en las filas (no se
// repinta nada mientras se arrastra). Con teclado quedan las flechas de siempre.
//   asa(e, { contenedor, selector, indice, alSoltar })
//     contenedor: el elemento que tiene dentro todas las filas; selector: el de cada fila; indice: la que se coge;
//     alSoltar(de, a): se llama solo si cambia de sitio (a: su posicion final en la lista).
export function asa(e, { contenedor, selector, indice, alSoltar }) {
  if (e.button != null && e.button !== 0) return;
  const filas = contenedor ? [...contenedor.querySelectorAll(selector)] : [];
  const mia = filas[indice];
  if (!mia || filas.length < 2) return;
  e.preventDefault();
  const boton = e.currentTarget;
  try { boton.setPointerCapture(e.pointerId); } catch { /* sin captura, se sigue con los eventos del documento */ }
  let destino = indice;
  mia.classList.add('arrastrando');
  document.body.classList.add('arrastre-en-curso');
  const limpiar = () => filas.forEach((f) => f.classList.remove('soltar-antes', 'soltar-despues'));
  const mover = (ev) => {
    const y = ev.clientY;
    // El hueco donde caeria: antes de la primera fila cuyo centro queda por debajo del dedo
    let hueco = filas.length;
    for (let k = 0; k < filas.length; k++) { const r = filas[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { hueco = k; break; } }
    limpiar();
    destino = hueco > indice ? hueco - 1 : hueco;
    if (destino !== indice) {
      if (hueco < filas.length) filas[hueco].classList.add('soltar-antes'); else filas[filas.length - 1].classList.add('soltar-despues');
    }
    // Cerca del borde de la pantalla, la pagina acompana
    const alto = window.innerHeight;
    if (y < 80) window.scrollBy(0, -14); else if (y > alto - 80) window.scrollBy(0, 14);
  };
  const fin = (ev) => {
    boton.removeEventListener('pointermove', mover);
    boton.removeEventListener('pointerup', fin);
    boton.removeEventListener('pointercancel', fin);
    try { boton.releasePointerCapture(e.pointerId); } catch { /* ya suelto */ }
    limpiar();
    mia.classList.remove('arrastrando');
    document.body.classList.remove('arrastre-en-curso');
    if (ev.type === 'pointerup' && destino !== indice) alSoltar(indice, destino);
  };
  boton.addEventListener('pointermove', mover);
  boton.addEventListener('pointerup', fin);
  boton.addEventListener('pointercancel', fin);
}
