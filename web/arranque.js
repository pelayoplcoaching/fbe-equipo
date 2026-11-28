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
  var q = '';
  try {
    q = String(w.location.search || '');
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

  // (belleza 371 a 376, 380 y 388; v0.289) La noche de la portada, decidida antes de pintar: el cielo de esta hora (con el
  // sol de Madrid de cada mes, como logica/cielo.js), la luna en su fase de verdad, la estacion, una estrella fugaz una de
  // cada diez noches, la luz de detras del lobo con tu color de acento, y la portada corta (solo el lobo y la noche) si ya
  // has abierto hoy o vienes de un aviso o de un atajo. En el movil solo se apunta el dia («fbe-portada-dia»).
  // (en un navegador automatico, las pruebas pueden elegir: «fbe-probar-portada»)
  try {
    var ahora = new Date(), mes = ahora.getMonth(), dia = ahora.getDate(), hora = ahora.getHours() + ahora.getMinutes() / 60;
    var p = null;
    if (w.navigator && w.navigator.webdriver) { try { p = JSON.parse(leer('fbe-probar-portada') || 'null'); } catch (e) { p = null; } }
    p = p || {};
    var SOL = [[8.6, 18.1], [8.25, 18.7], [7.75, 19.6], [7.65, 21.0], [7.05, 21.45], [6.75, 21.75], [6.95, 21.7], [7.4, 21.25], [7.9, 20.45], [8.3, 19.5], [8.1, 18.0], [8.55, 17.85]];
    var sale = SOL[mes][0], pone = SOL[mes][1];
    var cielo = p.cielo || (hora >= sale - 0.5 && hora < sale + 1.5 ? 'amanecer' : hora >= sale + 1.5 && hora < pone - 1.5 ? 'dia' : hora >= pone - 1.5 && hora < pone + 0.5 ? 'atardecer' : 'noche');
    r.setAttribute('data-cielo', cielo);
    var SINODICO = 29.530588853;
    var edad = ((((ahora.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % SINODICO) + SINODICO) % SINODICO;
    var ilum = p.luna != null ? Number(p.luna) : (1 - Math.cos(2 * Math.PI * edad / SINODICO)) / 2;
    var creciente = p.mengua != null ? !p.mengua : edad < SINODICO / 2;
    r.style.setProperty('--luna-ilum', String(Math.round(ilum * 100) / 100));
    r.style.setProperty('--luna-lado', creciente ? '-1' : '1');
    if (ilum > 0.96) r.setAttribute('data-luna', 'llena');
    var estacion = p.estacion != null ? p.estacion : ((mes === 11 && dia >= 20) || (mes === 0 && dia <= 6)) ? 'navidad' : (mes === 11 || mes < 2) ? 'invierno' : (mes >= 8 && mes <= 10) ? 'otono' : '';
    if (estacion) r.setAttribute('data-estacion', estacion);
    var LUZ = { azul: '58,128,221', pino: '28,147,141', frambuesa: '215,71,141', cobre: '199,98,33', orquidea: '179,91,204', oceano: '48,154,184', lima: '126,164,47', abeto: '36,148,87', granada: '202,89,112', grafito: '141,140,152' };
    var ajustes = null;
    try { ajustes = JSON.parse(leer('fbe-ajustes') || 'null'); } catch (e) { ajustes = null; }
    if (ajustes && typeof ajustes.acento === 'string' && LUZ.hasOwnProperty(ajustes.acento)) r.style.setProperty('--portada-luz', LUZ[ajustes.acento]);
    var dos = function (n) { return (n < 10 ? '0' : '') + n; };
    var hoy = ahora.getFullYear() + '-' + dos(mes + 1) + '-' + dos(dia);
    var almohadilla = String(w.location.hash || '');
    var corta = leer('fbe-portada-dia') === hoy || /[?&]accion=/.test(q) || (almohadilla.length > 1 && almohadilla !== '#hoy');
    try { w.localStorage.setItem('fbe-portada-dia', hoy); } catch (e) { /* sin almacenamiento: la portada entera */ }
    if (p.corta != null) corta = !!p.corta;
    if (corta) r.setAttribute('data-portada', 'corta');
    else if (cielo === 'noche' && (p.fugaz != null ? p.fugaz : Math.random() < 0.1)) r.setAttribute('data-fugaz', '');
  } catch (e) { /* la portada de siempre */ }
})();
