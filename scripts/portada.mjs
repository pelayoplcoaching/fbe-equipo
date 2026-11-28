// Portada de arranque (v0.29; estandarte ilustrado de la v0.31 a la v0.87; desde la tanda 11 de diseño, la marca limpia):
// el lobo de FBE en blanco sobre la noche morada, el nombre de la app, el lema y la firma con la letra de la app. Sin
// imagen: el lobo es el trazado vectorial que ya usa la app (web/src/ui/lobo-trazo.js), metido en el propio index.html
// para que se vea desde el primer instante, antes de que llegue el JavaScript; la quita la app (web/src/ui/portada.js)
// cuando ya hay algo que enseñar. El dorado, solo en el lema, el filo y la barra de carga. Si algo falla y no llega
// nunca, a los 8 s ofrece volver a cargar (la misma dirección, con su ?demo); sin JavaScript no se pinta. El marcado va
// en ASCII (tildes como entidades): la demo es un HTML sin charset.
// (diseño, tanda 44) Con la noche de la escena del final: estrellas que titilan (dos capas de fondo) y la luna, tenue,
// que sube detrás del lobo (blanco, delante). Nada de eso alarga la entrada: dura lo que tarde la app.
// (belleza 351-400, tanda G; v0.288) El primer fotograma: la portada ya no espera a los estilos de la app (web/arranque.js
// los pone sin frenar), así que lleva aquí todo lo suyo, también su letra (`fuente`). Cada app con su nombre (los dos van
// escritos y <html data-app="esencial"> elige: lo pone web/arranque.js antes de pintar). El lobo se dibuja con el trazado
// que va una sola vez en la página (<use>). La barra de carga avanza por tramos de verdad (--carga, que mueve
// web/src/ui/portada.js; antes de que llegue el código, sola y despacio hasta un tercio) y solo se ve si la carga pasa de
// medio segundo. El primer fotograma es la noche lisa (la misma del fondo de la raíz y de la imagen de arranque de iOS,
// scripts/arranque-ios.mjs) y la luz de detrás del lobo llega encima (.portada-halo): del icono a la portada, sin salto.
import { LOBO_CAJA, LOBO_D } from '../web/src/ui/lobo-trazo.js';

// (belleza 373, v0.289) Las estrellas de la portada dibujan la constelación del Lobo (Lupus): sus dieciséis estrellas más
// brillantes, cada una en su sitio (ascensión recta en horas, declinación en grados y magnitud; de la lista de estrellas de
// Lupus de Wikipedia, comprobada el 28/11/2026). El norte, arriba; el este, a la izquierda (como se ve en el cielo).
export const LUPUS = [
  ['alfa', 14.6988, -47.388, 2.30], ['beta', 14.9755, -43.134, 2.68], ['gamma', 15.5857, -41.167, 2.80], ['delta', 15.3562, -40.647, 3.22],
  ['epsilon', 15.3780, -44.690, 3.37], ['zeta', 15.2048, -52.099, 3.41], ['eta', 16.0020, -38.397, 3.42], ['iota', 14.3234, -46.058, 3.55],
  ['fi1', 15.3635, -36.261, 3.57], ['kappa1', 15.1989, -48.738, 3.88], ['pi', 15.0853, -47.051, 3.91], ['ji', 15.8493, -33.627, 3.97],
  ['ro', 14.6315, -49.426, 4.05], ['lambda', 15.1474, -45.280, 4.07], ['theta', 16.1099, -36.802, 4.22], ['mu', 15.3089, -47.875, 4.27],
];
// Cada estrella, en tanto por ciento de su caja (con un margen para que ninguna toque el borde) y con su tamaño en px
export function estrellasLupus(lista = LUPUS) {
  const medio = (lista.reduce((t, e) => t + e[2], 0) / lista.length) * Math.PI / 180;
  const pts = lista.map(([n, ar, dec, mag]) => ({ n, x: -ar * 15 * Math.cos(medio), y: -dec, mag }));
  const minX = Math.min(...pts.map((q) => q.x)), maxX = Math.max(...pts.map((q) => q.x)), minY = Math.min(...pts.map((q) => q.y)), maxY = Math.max(...pts.map((q) => q.y));
  const lado = Math.max(maxX - minX, maxY - minY);
  const pct = (v, min, max) => Math.round((6 + ((v - min + (lado - (max - min)) / 2) / lado) * 88) * 10) / 10;
  return pts.map((q) => ({ n: q.n, x: pct(q.x, minX, maxX), y: pct(q.y, minY, maxY), r: q.mag <= 2.8 ? 2.6 : q.mag <= 3.6 ? 2 : 1.5 }));
}
const estrella = ({ x, y, r }) => `radial-gradient(${r}px ${r}px at ${x}% ${y}%,#fff 60%,transparent 62%)`;

export const MORADO_PORTADA = '#5438D8';
export const FONDO_PORTADA = '#1E1548'; // la noche de la portada (y la barra del sistema mientras se ve)
const ORO = '#E9D49A';
// (belleza 377) el grano de la casa (el --grano de diseno.css): sin bandas en el degradado
const GRANO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;
const LETRA = `'Archivo Variable','Archivo',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`;

// El lobo mide 256 px de ancho (lo pidió Pelayo: el doble del primer boceto), menos en pantallas pequeñas o apaisadas.
// El texto entra un instante después que el lobo: para entonces la letra de la app (precargada) ya suele estar.
export const estiloPortada = ({ fuente = '' } = {}) => `<style>
${fuente}@property --portada-r{syntax:"<length>";inherits:false;initial-value:0px}
html.hay-portada{background:${FONDO_PORTADA}}
#portada{position:fixed;inset:0;z-index:2147483000;overflow:hidden;display:grid;grid-template-rows:1fr auto;justify-items:center;padding:calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 30px);background:${FONDO_PORTADA};color:#fff;font-family:${LETRA};text-align:center;transition:opacity .34s ease}
#portada .portada-centro{align-self:center;display:grid;justify-items:center;margin-top:-4vh;transition:transform .38s cubic-bezier(.3,0,.2,1)}
#portada .portada-lobo{display:block;width:min(256px,68vw,34vh);height:auto;fill:#fff;filter:drop-shadow(0 18px 40px rgba(10,6,40,.55));animation:portada-lobo .5s cubic-bezier(.2,.8,.2,1) both}
#portada .portada-lobo-trazo{stroke:#fff;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:portada-traza .8s cubic-bezier(.3,.1,.2,1) .05s both}
#portada .portada-lobo-relleno{animation:portada-rellena .5s ease-out .45s both}
#portada .portada-ojo{fill:${ORO};opacity:0;filter:blur(7px);animation:portada-ojo .7s ease-out 1s both}
#portada .portada-halo{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(64% 44% at 50% 40%,rgba(var(--portada-luz,96,68,228),.5),transparent 72%);animation:portada-halo .5s ease-out both}
html[data-cielo=amanecer] #portada .portada-halo{background:radial-gradient(150% 62% at 50% 118%,rgba(255,150,176,.44),rgba(255,150,176,.16) 45%,transparent 78%),radial-gradient(64% 44% at 50% 40%,rgba(var(--portada-luz,96,68,228),.5),transparent 72%)}
html[data-cielo=dia] #portada .portada-halo{background:radial-gradient(150% 60% at 50% -18%,rgba(150,176,255,.40),rgba(150,176,255,.14) 45%,transparent 78%),radial-gradient(64% 44% at 50% 40%,rgba(var(--portada-luz,96,68,228),.5),transparent 72%)}
html[data-cielo=atardecer] #portada .portada-halo{background:radial-gradient(120% 56% at 104% 108%,rgba(255,160,92,.46),rgba(255,160,92,.16) 45%,transparent 78%),radial-gradient(64% 44% at 50% 40%,rgba(var(--portada-luz,96,68,228),.5),transparent 72%)}
#portada .portada-grano{position:absolute;inset:0;z-index:-1;pointer-events:none;background:${GRANO}}
#portada .portada-cielo{position:absolute;inset:0;pointer-events:none}
#portada .portada-lupus{position:absolute;top:calc(env(safe-area-inset-top,0px) + 2.5vh);right:5vw;width:min(42vw,19vh,190px);aspect-ratio:1;background:${estrellasLupus().map(estrella).join(',')};animation:portada-estrellas 1.7s ease-in-out infinite alternate}
#portada::after{content:"";position:absolute;inset:0;pointer-events:none;animation:portada-estrellas 2.3s ease-in-out -1.1s infinite alternate;background:radial-gradient(2.3px 2.3px at 7% 9%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 22% 5%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 9% 18%,#fff 60%,transparent 62%),radial-gradient(1.8px 1.8px at 33% 12%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 10% 56%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 14% 39%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 90% 58%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 93% 44%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 6% 70%,#fff 60%,transparent 62%)}
html[data-cielo=dia] #portada .portada-lupus,html[data-cielo=dia] #portada::after{display:none}
html[data-cielo=amanecer] #portada .portada-lupus,html[data-cielo=amanecer] #portada::after,html[data-cielo=atardecer] #portada .portada-lupus,html[data-cielo=atardecer] #portada::after{animation:none;opacity:.34}
#portada .portada-fugaz{display:none;position:absolute;top:13%;left:18%;width:84px;height:1.5px;border-radius:1px;background:linear-gradient(90deg,transparent,#fff);transform:rotate(24deg) translateX(-60px);opacity:0}
html[data-fugaz][data-cielo=noche] #portada .portada-fugaz{display:block;animation:portada-fugaz .7s ease-out .7s both}
#portada .portada-e{display:none;position:absolute;top:0;left:var(--x);width:var(--t,4px);height:var(--t,4px);border-radius:50%;background:#fff;opacity:.7;transform:translateY(var(--y));animation:portada-cae 1.5s cubic-bezier(.2,.6,.3,1) var(--d,0s) both}
html[data-estacion=invierno] #portada .portada-e,html[data-estacion=navidad] #portada .portada-e{display:block}
html[data-estacion=otono] #portada .portada-e.hoja{display:block;width:11px;height:11px;border-radius:0 72% 0 72%;background:${ORO};opacity:.85;animation-name:portada-hoja}
#portada .portada-centro,#portada .portada-pie{position:relative;z-index:1}
#portada .portada-noche{position:relative;display:grid;place-items:center}
#portada .portada-luna{position:absolute;left:50%;top:50%;width:122%;aspect-ratio:1;margin:-61% 0 0 -61%;border-radius:50%;background:rgba(var(--portada-luz,140,116,244),.07);box-shadow:0 0 80px rgba(var(--portada-luz,150,128,255),.42);animation:portada-luna 1s cubic-bezier(.16,1,.3,1) both}
#portada .portada-luna b{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 36% 28%,rgba(222,214,255,.40),rgba(var(--portada-luz,140,116,244),.30) 58%,rgba(var(--portada-luz,104,78,232),.20));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.20)}
html[data-cielo=noche] #portada .portada-luna b{-webkit-mask-image:radial-gradient(ellipse 51% 51% at calc(50% + var(--luna-ilum,1)*var(--luna-lado,1)*104%) 50%,transparent 97%,#000 100%);mask-image:radial-gradient(ellipse 51% 51% at calc(50% + var(--luna-ilum,1)*var(--luna-lado,1)*104%) 50%,transparent 97%,#000 100%)}
html[data-luna=llena] #portada .portada-luna b{-webkit-mask-image:none;mask-image:none}
html[data-luna=llena] #portada .portada-luna{box-shadow:0 0 110px rgba(var(--portada-luz,170,150,255),.6)}
#portada .portada-lobo{position:relative}
@keyframes portada-estrellas{from{opacity:.25}to{opacity:.95}}
@keyframes portada-luna{from{opacity:0;transform:translateY(22%) scale(.9)}}
@keyframes portada-halo{from{opacity:0}}
@keyframes portada-ojo{0%{opacity:0}35%{opacity:.95}100%{opacity:0}}
@keyframes portada-fugaz{0%{opacity:0;transform:rotate(24deg) translateX(-60px)}25%{opacity:1}100%{opacity:0;transform:rotate(24deg) translateX(150px)}}
@keyframes portada-cae{from{transform:translateY(-12vh)}}
@keyframes portada-hoja{from{transform:translateY(-16vh) rotate(-150deg)}to{transform:translateY(var(--y)) rotate(var(--g,20deg))}}
#portada .portada-nombre{margin-top:26px;font-size:25px;line-height:1.1;font-weight:820;font-stretch:125%;letter-spacing:.01em;animation:portada-nombre .3s cubic-bezier(.2,.8,.2,1) .16s both}
#portada .portada-filo{width:34px;height:2px;border-radius:2px;background:${ORO};margin:18px 0 16px;animation:portada-filo .34s cubic-bezier(.2,.8,.2,1) .3s both}
#portada .portada-lema{font-size:11.5px;line-height:1.3;font-weight:650;letter-spacing:.24em;text-transform:uppercase;color:${ORO};white-space:nowrap}
#portada .portada-lema span{display:inline-block;animation:portada-palabra .36s cubic-bezier(.2,.8,.2,1) both}
#portada .portada-lema span:nth-child(1){animation-delay:.36s}#portada .portada-lema span:nth-child(2){animation-delay:.44s}#portada .portada-lema span:nth-child(3){animation-delay:.52s}
#portada .portada-pie{display:grid;justify-items:center;gap:5px}
#portada .portada-carga{width:120px;height:3px;border-radius:2px;background:rgba(255,255,255,.18);margin-bottom:20px;overflow:hidden;visibility:hidden;animation:portada-ver 0s .5s forwards}
#portada .portada-carga span{display:block;width:100%;height:100%;border-radius:2px;background:${ORO};transform-origin:0 50%;transform:scaleX(var(--carga,.3));transition:transform .45s cubic-bezier(.2,.7,.2,1);animation:portada-carga 2.6s cubic-bezier(.1,.6,.3,1) both}
#portada[data-carga] .portada-carga span{animation:none}
#portada .pn-esencial,html[data-app=esencial] #portada .pn-equipo{display:none}
html[data-app=esencial] #portada .pn-esencial{display:revert}
#portada .portada-firma{font-size:13px;line-height:1.3;font-weight:600;color:rgba(255,255,255,.82)}
#portada .portada-firma-2{font-size:10.5px;line-height:1.3;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.55)}
#portada .portada-firma,#portada .portada-firma-2{animation:portada-palabra .4s cubic-bezier(.2,.8,.2,1) .5s both}
html[data-portada=corta] #portada .portada-nombre,html[data-portada=corta] #portada .portada-filo,html[data-portada=corta] #portada .portada-lema,html[data-portada=corta] #portada .portada-firma,html[data-portada=corta] #portada .portada-firma-2,html[data-portada=corta] #portada .portada-ojo,html[data-portada=corta] #portada .portada-lobo-trazo,html[data-portada=corta] #portada .portada-e,html[data-portada=corta] #portada .portada-fugaz{display:none!important}
html[data-portada=corta] #portada .portada-lobo{width:min(112px,34vw,20vh);animation-duration:.26s}
html[data-portada=corta] #portada .portada-lobo-relleno{animation:none}
html[data-portada=corta] #portada .portada-luna{animation-duration:.4s}
#portada .portada-lento{position:absolute;left:0;right:0;bottom:calc(96px + env(safe-area-inset-bottom,0px));margin:0;padding:10px 24px;background:rgba(18,12,46,.86);text-align:center;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;visibility:hidden;animation:portada-lento 0s 8s forwards}
#portada .portada-lento a{color:#fff;font-weight:700}
#portada .solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#portada.fuera{opacity:0;pointer-events:none}
#portada.fuera .portada-centro{transform:scale(1.04)}
#portada.abre{pointer-events:none;-webkit-mask-image:radial-gradient(circle at var(--ox,50%) var(--oy,40%),transparent var(--portada-r),#000 calc(var(--portada-r) + 28px));mask-image:radial-gradient(circle at var(--ox,50%) var(--oy,40%),transparent var(--portada-r),#000 calc(var(--portada-r) + 28px));animation:portada-abre .3s cubic-bezier(.5,0,.3,1) forwards}
#portada.abre .portada-lobo,#portada.abre .portada-luna,#portada.abre .portada-lupus,#portada.abre::after,#portada.fuera .portada-lupus,#portada.fuera::after{animation:none}
#portada.abre .portada-ojo,#portada.fuera .portada-ojo{display:none}
@keyframes portada-abre{to{--portada-r:var(--portada-rmax,150vmax)}}
@keyframes portada-lobo{from{opacity:0;transform:scale(.94)}}
@keyframes portada-traza{to{stroke-dashoffset:0}}
@keyframes portada-rellena{from{opacity:0;clip-path:inset(0 0 100% 0)}35%{opacity:1}to{opacity:1;clip-path:inset(0 0 -2% 0)}}
@keyframes portada-nombre{from{font-stretch:62%;clip-path:inset(0 50%)}to{clip-path:inset(0 -10%)}}
@keyframes portada-filo{from{transform:scaleX(0)}}
@keyframes portada-palabra{from{transform:translateY(9px);clip-path:inset(0 0 100% 0)}to{clip-path:inset(-20% -20%)}}
@keyframes portada-carga{from{transform:scaleX(.04)}to{transform:scaleX(.3)}}
@keyframes portada-ver{to{visibility:visible}}
@keyframes portada-lento{to{visibility:visible}}
@media (max-width:380px){#portada .portada-lema{letter-spacing:.2em}}@media (max-width:340px){#portada .portada-lema{letter-spacing:.13em}}
@media (max-height:520px){#portada .portada-centro{margin-top:0}#portada .portada-nombre{margin-top:14px;font-size:21px}#portada .portada-filo{margin:10px 0 9px}#portada .portada-carga{margin-bottom:10px}#portada .portada-lupus{display:none}}
@media (prefers-reduced-motion:reduce){#portada,#portada .portada-centro{transition:none}#portada::after,#portada .portada-lupus,#portada .portada-luna,#portada .portada-halo,#portada .portada-e{animation:none}#portada .portada-lobo,#portada .portada-lobo-relleno,#portada .portada-nombre,#portada .portada-filo,#portada .portada-lema span,#portada .portada-firma,#portada .portada-firma-2{animation:none}#portada .portada-lobo-trazo,#portada .portada-ojo,#portada .portada-fugaz{display:none!important}#portada .portada-carga span{animation:none;transition:none}}
</style>`;

// (belleza 339, v0.285) El trazado del lobo, una vez y escondido, fuera de la portada (que se quita al abrir): la app lo
// lee de aquí (loboD() en web/src/ui/lobo-trazo.js) en vez de llevarlo en su código de arranque. (Escondido con su estilo:
// el atributo «hidden» no esconde un <svg>.)
// (belleza 367, v0.288) y la portada también lo toma de aquí (<use>): antes lo llevaba escrito otras dos veces. Su largo, a 1
// (pathLength), para poder dibujarlo con el trazo de la portada; a la app le da igual (solo lee su «d»).
export const spriteLobo = `<svg id="fbe-sprite" style="display:none" aria-hidden="true" focusable="false"><path id="fbe-lobo" pathLength="1" d="${LOBO_D}"/></svg>`;

// (belleza 369) Los ojos del lobo, en las medidas de su caja: se encienden un instante al acabar de dibujarse
export const OJOS_LOBO = [[497, 590], [757, 590]];
// (belleza 375) Lo que cae una vez y se queda quieto: copos en invierno; en otoño, dos hojas (las dos primeras piezas)
const PIEZAS = [[16, 31, 5, 0, 24], [81, 46, 4, 0.12, -32], [28, 12, 3, 0.2], [64, 8, 4, 0.05], [90, 22, 3, 0.3], [8, 52, 4, 0.16], [48, 5, 3, 0.26]];

export const marcadoPortada = `${spriteLobo}
<div id="portada" role="status">
<span class="portada-halo" aria-hidden="true"></span><span class="portada-grano" aria-hidden="true"></span>
<span class="portada-cielo" aria-hidden="true"><i class="portada-lupus"></i><i class="portada-fugaz"></i>${PIEZAS.map(([x, y, t, d, g], i) => `<i class="portada-e${i < 2 ? ' hoja' : ''}" style="--x:${x}%;--y:${y}vh;--t:${t}px;--d:${d}s${g ? `;--g:${g}deg` : ''}"></i>`).join('')}</span>
<div class="portada-centro" aria-hidden="true">
<div class="portada-noche"><span class="portada-luna"><b></b></span><svg class="portada-lobo" viewBox="${LOBO_CAJA}" focusable="false"><use class="portada-lobo-trazo" href="#fbe-lobo" fill="none"/><use class="portada-lobo-relleno" href="#fbe-lobo" fill-rule="evenodd"/>${OJOS_LOBO.map(([x, y]) => `<ellipse class="portada-ojo" cx="${x}" cy="${y}" rx="30" ry="15"/>`).join('')}</svg></div>
<div class="portada-nombre"><span class="pn-equipo">FBE Equipo</span><span class="pn-esencial">FBE Esencial</span></div>
<div class="portada-filo"></div>
<div class="portada-lema"><span>Confianza</span> &middot; <span>Esfuerzo</span> &middot; <span>Compromiso</span></div>
</div>
<div class="portada-pie" aria-hidden="true">
<div class="portada-carga"><span></span></div>
<div class="portada-firma">By Pelayo Fern&aacute;ndez Cid&oacute;n</div>
<div class="portada-firma-2">CEO de Fuerza Basada en Evidencia</div>
</div>
<p class="solo-lector pn-equipo">Abriendo FBE Equipo. Confianza, esfuerzo, compromiso. By Pelayo Fern&aacute;ndez Cid&oacute;n, CEO de Fuerza Basada en Evidencia.</p>
<p class="solo-lector pn-esencial">Abriendo FBE Esencial. Confianza, esfuerzo, compromiso. By Pelayo Fern&aacute;ndez Cid&oacute;n, CEO de Fuerza Basada en Evidencia.</p>
<p class="portada-lento">Est&aacute; tardando m&aacute;s de lo normal. <a href="">Volver a cargar</a></p>
</div>`;
