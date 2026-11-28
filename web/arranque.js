// (belleza 361 y 362, v0.288) Lo que hace falta antes de pintar nada. Es lo primero que corre: un archivo pequeño y aparte
// (la página no admite guiones escritos dentro) que va en la cabecera, delante de la portada de arranque.
//   · Los estilos de la app (un megabyte) dejan de frenar el primer pintado: se piden ya (la página los precarga) y se
//     ponen sin bloquear; la portada sale con los suyos, que van escritos en la propia página. La app espera a
//     window.__fbeEstilos antes de montar nada (web/src/ui/estilos-app.js; si este archivo no llegara, los pone ella).
//   · Cada app con su nombre desde el primer instante: en <html data-app="esencial"> si la última cuenta de este móvil
//     fue de FBE Esencial (lo apunta la app al entrar: «fbe-app»), o si se viene por su demo o por su invitación. Con
//     eso, la portada, el título, el nombre al instalar, el icono y el manifiesto son los de FBE Esencial.
// Sin módulos ni sintaxis moderna: tiene que valer en cualquier navegador que abra la página. Nunca lanza nada.
(function () {
  var d = document, r = d.documentElement, w = window;
  var leer = function (k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } };

  // Los estilos, sin frenar: «print» mientras bajan (así ningún navegador espera por ellos) y «all» al llegar
  try {
    var pre = d.querySelector('link[rel="preload"][as="style"]');
    var href = pre && pre.getAttribute('href');
    if (href && w.Promise) {
      var l = d.createElement('link');
      l.rel = 'stylesheet'; l.setAttribute('href', href); l.media = 'print';
      w.__fbeEstilos = new Promise(function (listo) {
        var hecho = false;
        var fin = function () { if (hecho) return; hecho = true; try { l.media = 'all'; } catch (e) { /* */ } listo(); };
        l.onload = fin; l.onerror = fin;
        // (si no llegan, la app sigue: sin estilos, como pasaba antes cuando fallaban)
        w.setTimeout(fin, 10000);
      });
      pre.parentNode.insertBefore(l, pre.nextSibling);
    }
  } catch (e) { /* la app los pone al arrancar */ }

  // Qué app es
  try {
    var q = String(w.location.search || '');
    var app = /[?&]demo=esencial(&|$)/.test(q) || /[?&]plan=esencial(&|$)/.test(q) ? 'esencial' : /[?&]demo(=|&|$)/.test(q) ? 'equipo' : leer('fbe-app');
    if (app === 'esencial') {
      r.setAttribute('data-app', 'esencial');
      d.title = 'FBE Esencial';
      var poner = function (sel, attr, v) { var el = d.querySelector(sel); if (el) el.setAttribute(attr, v); };
      poner('meta[name="apple-mobile-web-app-title"]', 'content', 'FBE Esencial');
      poner('link[rel="manifest"]', 'href', 'manifest-esencial.webmanifest');
      poner('link[rel="apple-touch-icon"]', 'href', 'esencial-180.png');
      poner('link[rel="icon"]', 'href', 'esencial.svg');
    }
  } catch (e) { /* se queda con el nombre de siempre */ }
})();
