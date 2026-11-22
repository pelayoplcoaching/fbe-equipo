// El botón «atrás» (web/src/ui/atras.js) con un historial de mentira, para las carreras que en el navegador solo salen a
// veces (con la máquina o el móvil lentos).
//
// La que se encontró (22/11/2026, e2e del lunes simulado y 1 de cada 6 veces suelta): al tocar «Ver mis logros» en la
// hoja de medallas, la hoja se cierra y la app pasa a Progreso. Si el cambio de pestaña tarda más de 250 ms, atras.js ya
// ha empezado a retirar la entrada de la hoja (history.go(-1)) cuando la pestaña nueva pone su dirección (#progreso).
// ponerRuta no apuntaba esa dirección mientras se retiraba la entrada, así que al llegar a la entrada de antes (#hoy) no
// se le ponía la de la pantalla que se ve y el cambio de # (de #progreso a #hoy) contaba como «ir a Hoy»: la app volvía a
// Hoy sola. Pasaba igual con cualquier botón de una hoja que lleva a otra pestaña, y al cerrar la sesión.
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Un navegador de mentira: historial con entradas, go() asíncrono, popstate y hashchange
const oyentes = {};
const avisar = (tipo, e) => { for (const f of [...(oyentes[tipo] || [])]) { if (e._parado) break; f(e); } };
const entradas = [{ state: null, url: 'http://app.test/#hoy' }];
let i = 0;
let retrasoHashchange = 1;   // ms entre popstate y hashchange al moverse por el historial
let retrasoGo = 20;          // ms hasta que el navegador hace el go()
const ventanas = [];         // las hojas abiertas (aria-modal)
let observador = null;
globalThis.window = {
  addEventListener: (t, f) => { (oyentes[t] ||= []).push(f); },
  removeEventListener: (t, f) => { oyentes[t] = (oyentes[t] || []).filter((g) => g !== f); },
  history: null,
};
const location = { get href() { return entradas[i].url; }, get hash() { return new URL(entradas[i].url).hash; } };
globalThis.location = location;
const history = {
  get state() { return entradas[i].state; },
  get length() { return entradas.length; },
  scrollRestoration: 'auto',
  pushState(state, _t, url) { entradas.splice(i + 1); entradas.push({ state, url: url ? new URL(url, location.href).href : location.href }); i++; },
  replaceState(state, _t, url) { entradas[i] = { state, url: url ? new URL(url, location.href).href : location.href }; },
  go(n) {
    setTimeout(() => {
      const antes = location.href;
      i = Math.max(0, Math.min(entradas.length - 1, i + n));
      const ahora = location.href;
      avisar('popstate', { state: entradas[i].state });
      if (new URL(antes).hash !== new URL(ahora).hash) {
        setTimeout(() => avisar('hashchange', { oldURL: antes, newURL: ahora, stopImmediatePropagation() { this._parado = true; } }), retrasoHashchange);
      }
    }, retrasoGo);
  },
};
globalThis.window.history = history;
globalThis.history = history;
globalThis.document = {
  querySelectorAll: (sel) => (sel === '[aria-modal="true"]' ? ventanas : []),
  body: {},
  activeElement: null,
};
globalThis.MutationObserver = class { constructor(f) { observador = f; } observe() {} };
const hoja = { nodeType: 1, matches: () => true, querySelector: () => null, contains: () => false, dispatchEvent: () => {} };
const abrirHoja = () => { ventanas.push(hoja); observador([{ addedNodes: [hoja], removedNodes: [] }]); };
const cerrarHoja = () => { ventanas.pop(); observador([{ addedNodes: [], removedNodes: [hoja] }]); };

const { instalarAtras, ponerRuta, estadoAtras } = await import('../web/src/ui/atras.js');
instalarAtras();
// La app: como AtletaApp, al cambiar el # va a esa pestaña (lee location.hash, no el evento)
let pestana = 'hoy';
const idas = [];
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); idas.push(h); pestana = h; });

console.log('\nCerrar una hoja con un botón que lleva a otra pestaña, si la pestaña tarda en pintarse');
for (const [retraso, nombre] of [[1, 'el # cambia enseguida (dentro de los 80 ms que se calla)'], [120, 'el # cambia tarde (fuera de esos 80 ms)']]) {
  retrasoHashchange = retraso;
  idas.length = 0;
  ponerRuta('#hoy'); pestana = 'hoy';
  abrirHoja();
  check(estadoAtras().nivel === 1 && history.length >= 2, `${nombre}: la hoja abierta tiene su entrada para «atrás»`);
  cerrarHoja();                       // «Ver mis logros»: la hoja se cierra…
  await espera(255);                  // …y la pestaña nueva tarda: atras.js ya ha empezado a retirar la entrada (go(-1))
  pestana = 'progreso';
  ponerRuta('#progreso');             // la pestaña nueva pone su dirección mientras el navegador vuelve atrás
  await espera(retrasoGo + retraso + 60);
  check(location.hash === '#progreso', `${nombre}: la dirección queda en la de la pantalla que se ve (${location.hash})`);
  check(pestana === 'progreso' && !idas.includes('hoy'), `${nombre}: la app sigue en Progreso, no vuelve sola a Hoy (${idas.join(', ') || 'sin cambios de #'})`);
  check(estadoAtras().nivel === 0, `${nombre}: sin entradas de sobra (nivel ${estadoAtras().nivel})`);
}

console.log('\nUn enlace de verdad (location.hash = …) sigue llevando a su sección');
retrasoHashchange = 1;
idas.length = 0;
history.pushState(null, '', '#ajustes');
avisar('hashchange', { oldURL: 'http://app.test/#progreso', newURL: location.href, stopImmediatePropagation() { this._parado = true; } });
check(pestana === 'ajustes' && idas.join() === 'ajustes', 'tocar una notificación con la app abierta (#ajustes) lleva a Ajustes');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
