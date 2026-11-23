// (v0.211, estilos a dieta 2) Los estilos de cada pantalla que no sale al abrir van con su trozo de código
// (scripts/build.mjs): al cargarse el trozo, pide los suyos con globalThis.__fbeCss(ruta). Aquí se ponen en la página (una
// vez cada uno, detrás de los comunes y en el orden en que llegan) y ui/perezoso.jsx espera a que estén antes de pintar
// la pantalla, para que nunca se vea un momento sin estilo. Si uno no carga (sin conexión y sin guardar), la pantalla sale
// igual, con los estilos comunes.
const pedidos = new Map();   // ruta → promesa (se cumple al cargar, o al fallar)
let ultimo = null;

export function pedirEstilo(ruta) {
  if (typeof document === 'undefined' || !ruta) return Promise.resolve();
  if (pedidos.has(ruta)) return pedidos.get(ruta);
  const p = new Promise((listo) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = ruta; l.dataset.trozo = '';
    const fin = () => { clearTimeout(tope); listo(); };
    const tope = setTimeout(fin, 4000);
    l.onload = fin;
    l.onerror = () => { pedidos.delete(ruta); l.remove(); fin(); };
    const ancla = (ultimo?.isConnected && ultimo) || document.querySelector('link[rel="stylesheet"][href^="app.css"]');
    if (ancla) ancla.after(l); else document.head.appendChild(l);
    ultimo = l;
  });
  pedidos.set(ruta, p);
  return p;
}

// Los que se están pidiendo ahora (para esperarlos antes de pintar lo que los necesita). (Si uno no está en el servidor
// —un trozo guardado de antes, con estilos que ya no tiene—, la pantalla sale con los comunes: lo que era suyo y ahora es
// de varias pantallas está en ellos.)
export function estilosPendientes() {
  return pedidos.size ? Promise.all(pedidos.values()) : Promise.resolve();
}

if (typeof globalThis !== 'undefined') globalThis.__fbeCss = pedirEstilo;
