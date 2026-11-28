// (belleza 361, v0.288) Los estilos de la app ya no frenan el primer pintado: web/arranque.js los pide sin bloquear para
// que la portada de arranque salga en cuanto llega la página (antes esperaba a que bajara y se leyera un megabyte de
// estilos). Aquí, la promesa que se cumple cuando están puestos: la app la espera antes de montar nada (main.jsx), así que
// nunca se ve una pantalla sin estilo (y debajo de la portada tampoco se mide nada sin ellos).
// Si el archivo de arranque no llegó (un fallo de red justo en él), los pone esta función. En la demo de un solo archivo y
// en una página guardada de antes, los estilos ya están en la página: no hay nada que esperar.
let promesa = null;

export function estilosApp() {
  if (promesa) return promesa;
  if (typeof document === 'undefined') { promesa = Promise.resolve(); return promesa; }
  if (globalThis.__fbeEstilos) { promesa = Promise.resolve(globalThis.__fbeEstilos).catch(() => {}); return promesa; }
  const pre = document.querySelector('link[rel="preload"][as="style"][href^="app.css"]');
  if (!pre || document.querySelector('link[rel="stylesheet"][href^="app.css"]')) { promesa = Promise.resolve(); return promesa; }
  promesa = new Promise((listo) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.setAttribute('href', pre.getAttribute('href'));
    let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; listo(); } };
    l.onload = fin; l.onerror = fin;
    setTimeout(fin, 10000);
    pre.after(l);
  });
  return promesa;
}
