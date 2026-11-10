// Portada de arranque (v0.29; estandarte ilustrado de la v0.31 a la v0.87; desde la tanda 11 de diseño, la marca limpia):
// el lobo de FBE en blanco sobre la noche morada, el nombre de la app, el lema y la firma con la letra de la app. Sin
// imagen: el lobo es el trazado vectorial que ya usa la app (web/src/ui/lobo-trazo.js), metido en el propio index.html
// para que se vea desde el primer instante, antes de que llegue el JavaScript; la quita la app (web/src/ui/portada.js)
// cuando ya hay algo que enseñar. El dorado, solo en el lema, el filo y la barra de carga. Si algo falla y no llega
// nunca, a los 8 s ofrece volver a cargar (la misma dirección, con su ?demo); sin JavaScript no se pinta. El marcado va
// en ASCII (tildes como entidades): la demo es un HTML sin charset.
// (diseño, tanda 44) Con la noche de la escena del final: estrellas que titilan (dos capas de fondo) y la luna, tenue,
// que sube detrás del lobo (blanco, delante). Nada de eso alarga la entrada: dura lo que tarde la app.
import { LOBO_CAJA, LOBO_D } from '../web/src/ui/lobo-trazo.js';

export const MORADO_PORTADA = '#5438D8';
export const FONDO_PORTADA = '#1E1548'; // la noche de la portada (y la barra del sistema mientras se ve)
const ORO = '#E9D49A';
const LETRA = `'Archivo Variable','Archivo',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`;

// El lobo mide 256 px de ancho (lo pidió Pelayo: el doble del primer boceto), menos en pantallas pequeñas o apaisadas.
// El texto entra un instante después que el lobo: para entonces la letra de la app (precargada) ya suele estar.
export const estiloPortada = () => `<style>
#portada{position:fixed;inset:0;z-index:2147483000;overflow:hidden;display:grid;grid-template-rows:1fr auto;justify-items:center;padding:calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 30px);background:radial-gradient(64% 44% at 50% 40%,rgba(96,68,228,.5),transparent 72%) ${FONDO_PORTADA};color:#fff;font-family:${LETRA};text-align:center;transition:opacity .34s ease}
#portada .portada-centro{align-self:center;display:grid;justify-items:center;margin-top:-4vh;transition:transform .38s cubic-bezier(.3,0,.2,1)}
#portada .portada-lobo{display:block;width:min(256px,68vw,34vh);height:auto;fill:#fff;filter:drop-shadow(0 18px 40px rgba(10,6,40,.55));animation:portada-lobo .5s cubic-bezier(.2,.8,.2,1) both}
#portada .portada-lobo-trazo{stroke:#fff;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:portada-traza .8s cubic-bezier(.3,.1,.2,1) .05s both}
#portada .portada-lobo-relleno{animation:portada-rellena .5s ease-out .45s both}
#portada::before,#portada::after{content:"";position:absolute;inset:0;pointer-events:none;animation:portada-estrellas 1.7s ease-in-out infinite alternate}
#portada::before{background:radial-gradient(2.3px 2.3px at 44% 13%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 86% 7%,#fff 60%,transparent 62%),radial-gradient(1.8px 1.8px at 71% 10%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 77% 7%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 7% 9%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 56% 8%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 14% 39%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 10% 56%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 31% 44%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 76% 41%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 9% 18%,#fff 60%,transparent 62%)}
#portada::after{background:radial-gradient(1.5px 1.5px at 74% 58%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 40% 30%,#fff 60%,transparent 62%),radial-gradient(1.8px 1.8px at 72% 11%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 74% 56%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 16% 41%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 50% 10%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 75% 7%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 66% 47%,#fff 60%,transparent 62%),radial-gradient(2.3px 2.3px at 43% 33%,#fff 60%,transparent 62%),radial-gradient(1.5px 1.5px at 49% 23%,#fff 60%,transparent 62%);animation-delay:-1.1s;animation-duration:2.3s}
#portada .portada-centro,#portada .portada-pie{position:relative;z-index:1}
#portada .portada-noche{position:relative;display:grid;place-items:center}
#portada .portada-luna{position:absolute;left:50%;top:50%;width:122%;aspect-ratio:1;margin:-61% 0 0 -61%;border-radius:50%;background:radial-gradient(circle at 36% 28%,rgba(222,214,255,.40),rgba(140,116,244,.30) 58%,rgba(104,78,232,.20));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.20),0 0 80px rgba(150,128,255,.42);animation:portada-luna 1s cubic-bezier(.16,1,.3,1) both}
#portada .portada-lobo{position:relative}
@keyframes portada-estrellas{from{opacity:.25}to{opacity:.95}}
@keyframes portada-luna{from{opacity:0;transform:translateY(22%) scale(.9)}}
#portada .portada-nombre{margin-top:26px;font-size:25px;line-height:1.1;font-weight:820;font-stretch:125%;letter-spacing:.01em}
#portada .portada-filo{width:34px;height:2px;border-radius:2px;background:${ORO};margin:18px 0 16px}
#portada .portada-lema{font-size:11.5px;line-height:1.3;font-weight:650;letter-spacing:.24em;text-transform:uppercase;color:${ORO};white-space:nowrap}
#portada .portada-pie{display:grid;justify-items:center;gap:5px}
#portada .portada-carga{width:120px;height:3px;border-radius:2px;background:rgba(255,255,255,.18);margin-bottom:20px;overflow:hidden}
#portada .portada-carga span{display:block;width:40%;height:100%;border-radius:2px;background:${ORO};animation:portada-carga 1.15s ease-in-out infinite}
#portada .portada-firma{font-size:13px;line-height:1.3;font-weight:600;color:rgba(255,255,255,.82)}
#portada .portada-firma-2{font-size:10.5px;line-height:1.3;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.55)}
#portada .portada-nombre,#portada .portada-filo,#portada .portada-lema,#portada .portada-firma,#portada .portada-firma-2{animation:portada-texto .5s .16s cubic-bezier(.2,.8,.2,1) both}
#portada .portada-lento{position:absolute;left:0;right:0;bottom:calc(96px + env(safe-area-inset-bottom,0px));margin:0;padding:10px 24px;background:rgba(18,12,46,.86);text-align:center;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;visibility:hidden;animation:portada-lento 0s 8s forwards}
#portada .portada-lento a{color:#fff;font-weight:700}
#portada .solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#portada.fuera{opacity:0;pointer-events:none}
#portada.fuera .portada-centro{transform:scale(1.04)}
@keyframes portada-lobo{from{opacity:0;transform:scale(.94)}}
@keyframes portada-traza{to{stroke-dashoffset:0}}
@keyframes portada-rellena{from{opacity:0}}
@keyframes portada-texto{from{opacity:0;transform:translateY(8px)}}
@keyframes portada-carga{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes portada-lento{to{visibility:visible}}
@media (max-width:380px){#portada .portada-lema{letter-spacing:.2em}}@media (max-width:340px){#portada .portada-lema{letter-spacing:.13em}}
@media (max-height:520px){#portada .portada-centro{margin-top:0}#portada .portada-nombre{margin-top:14px;font-size:21px}#portada .portada-filo{margin:10px 0 9px}#portada .portada-carga{margin-bottom:10px}}
@media (prefers-reduced-motion:reduce){#portada,#portada .portada-centro{transition:none}#portada::before,#portada::after,#portada .portada-luna{animation:none}#portada .portada-lobo,#portada .portada-lobo-relleno,#portada .portada-nombre,#portada .portada-filo,#portada .portada-lema,#portada .portada-firma,#portada .portada-firma-2{animation:none}#portada .portada-lobo-trazo{display:none}#portada .portada-carga span{animation:none;width:100%;opacity:.55}}
</style>`;

export const marcadoPortada = `<div id="portada" role="status" aria-label="Abriendo FBE Equipo">
<div class="portada-centro" aria-hidden="true">
<div class="portada-noche"><span class="portada-luna"></span><svg class="portada-lobo" viewBox="${LOBO_CAJA}" focusable="false"><path class="portada-lobo-trazo" pathLength="1" fill="none" d="${LOBO_D}"/><path class="portada-lobo-relleno" fill-rule="evenodd" d="${LOBO_D}"/></svg></div>
<div class="portada-nombre">FBE Equipo</div>
<div class="portada-filo"></div>
<div class="portada-lema">Confianza &middot; Esfuerzo &middot; Compromiso</div>
</div>
<div class="portada-pie" aria-hidden="true">
<div class="portada-carga"><span></span></div>
<div class="portada-firma">By Pelayo Fern&aacute;ndez Cid&oacute;n</div>
<div class="portada-firma-2">CEO de Fuerza Basada en Evidencia</div>
</div>
<p class="solo-lector">FBE Equipo. Confianza, esfuerzo, compromiso. By Pelayo Fern&aacute;ndez Cid&oacute;n, CEO de Fuerza Basada en Evidencia.</p>
<p class="portada-lento">Est&aacute; tardando m&aacute;s de lo normal. <a href="">Volver a cargar</a></p>
</div>`;
