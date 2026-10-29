// Portada de arranque (v0.29): el lobo sobre morado que pinta index.html antes de que llegue el JavaScript.
// Se quita cuando ya hay algo que enseñar: la pantalla de acceso, o la primera pantalla de la cuenta con sus datos
// (sin siluetas de carga a la vista). Un tope evita que se quede puesta si una carga se alarga.
const MINIMO_MS = 450; // desde que se abre la página: si todo llega antes, la portada no parpadea
const TOPE_MS = 3000; // con la sesión resuelta, como mucho esto esperando los datos de la primera pantalla

let quitada = false;
let esperando = false;

function quitarYa() {
  if (quitada) return;
  quitada = true;
  const el = typeof document !== 'undefined' && document.getElementById('portada');
  document.getElementById('tc-portada')?.remove();
  if (!el) return;
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.classList.add('fuera');
  setTimeout(() => el.remove(), quieto ? 0 : 380);
}

function cuandoToque(fn) {
  const falta = MINIMO_MS - (typeof performance !== 'undefined' ? performance.now() : MINIMO_MS);
  if (falta > 0) setTimeout(fn, falta); else fn();
}

// esperarDatos: la cuenta ya está resuelta y su primera pantalla está cargando datos; se espera a que acaben
export function quitarPortada({ esperarDatos = false } = {}) {
  if (quitada || typeof document === 'undefined' || !document.getElementById('portada')) { quitada = true; return; }
  if (!esperarDatos) { cuandoToque(quitarYa); return; }
  if (esperando) return;
  esperando = true;
  // Las siluetas avisan al irse; se mira en el siguiente fotograma, cuando ya está pintado lo que las sustituye
  const revisar = () => requestAnimationFrame(comprobar);
  const acabar = () => {
    clearTimeout(tope);
    window.removeEventListener('fbe-siluetas-fuera', revisar);
    cuandoToque(quitarYa);
  };
  const tope = setTimeout(acabar, TOPE_MS);
  function comprobar() { if (!document.querySelector('.siluetas')) acabar(); }
  window.addEventListener('fbe-siluetas-fuera', revisar);
  requestAnimationFrame(() => requestAnimationFrame(comprobar));
}
