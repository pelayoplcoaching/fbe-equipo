// Portada de arranque (v0.29; estandarte desde la v0.31; a pantalla completa con la imagen de Pelayo desde la v0.38):
// el estandarte de FBE (lema arriba, lobo y firma) colgado de su asta y ondeando, a toda la pantalla: sus bordes se
// funden con un fondo de terciopelo del mismo morado, así no se nota dónde acaba la imagen sea cual sea la pantalla. Va en el propio index.html para que se vea desde el primer
// instante, antes de que llegue el JavaScript; la quita la app (web/src/ui/portada.js) cuando ya hay algo que
// enseñar. Si algo falla y no llega nunca, a los 8 s ofrece volver a cargar (la misma dirección, con su ?demo); sin
// JavaScript no se pinta. El marcado va en ASCII (tildes como entidades): la demo es un HTML sin charset.

export const MORADO_PORTADA = '#5438D8';
export const FONDO_PORTADA = '#1E1548'; // la noche detrás del estandarte (y la barra del sistema mientras se ve)
export const IMAGEN_PORTADA = 'web/iconos/estandarte.webp'; // 941 x 1672
const PROPORCION = 1672 / 941;

// imagen: dirección de la imagen (en producción, el archivo; en la demo, data:)
// Tamaño del estandarte: tan alto como la pantalla, pero sin pasar de un 8 % más ancho que ella (en un móvil
// alargado recorta solo las puntas del asta; en uno ancho o en el ordenador, se ve entero con el fondo a los lados)
export const estiloPortada = (imagen) => `<style>
#portada{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:radial-gradient(70% 60% at 50% 46%,#34209A 0%,#28176D 55%,#1A104E 85%,${FONDO_PORTADA} 100%) ${FONDO_PORTADA};color:#fff;transition:opacity .34s ease}
#portada .estandarte{position:absolute;left:50%;top:50%;height:min(100vh,${(100 * PROPORCION * 1.08).toFixed(1)}vw);height:min(100dvh,${(100 * PROPORCION * 1.08).toFixed(1)}vw);aspect-ratio:941/1672;transform:translate(-50%,-50%)}
#portada .estandarte-pano{width:100%;height:100%;background:url("${imagen}") center/100% 100% no-repeat;transform-origin:50% 6%;animation:estandarte-ondea 5s ease-in-out infinite;transition:transform .38s cubic-bezier(.3,0,.2,1);${['-webkit-', ''].map((v) => `${v}mask-image:linear-gradient(to bottom,transparent,#000 6%,#000 93%,transparent),linear-gradient(to right,transparent,#000 7%,#000 93%,transparent)`).join(';')};-webkit-mask-composite:source-in;mask-composite:intersect}
#portada .portada-barra{position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(36vw,132px);height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}
#portada .portada-barra span{display:block;width:40%;height:100%;border-radius:2px;background:#E9D49A;animation:portada-barra 1.15s ease-in-out infinite}
#portada .portada-lento{position:absolute;left:0;right:0;bottom:calc(40px + env(safe-area-inset-bottom,0px));margin:0;padding:10px 24px;background:rgba(18,12,46,.8);text-align:center;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;visibility:hidden;animation:portada-lento 0s 8s forwards}
#portada .portada-lento a{color:#fff;font-weight:700}
#portada .solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#portada.fuera{opacity:0;pointer-events:none}
#portada.fuera .estandarte-pano{animation:none;transform:scale(1.04)}
@keyframes estandarte-ondea{0%,100%{transform:rotate(-.7deg) skewX(.5deg)}25%{transform:rotate(-.1deg) skewX(-.2deg) scaleX(.995)}50%{transform:rotate(.7deg) skewX(-.5deg)}75%{transform:rotate(.1deg) skewX(.2deg) scaleX(.995)}}
@keyframes portada-barra{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes portada-lento{to{visibility:visible}}
@media (prefers-reduced-motion:reduce){#portada,#portada .estandarte-pano{transition:none;animation:none}#portada .portada-barra span{animation:none;width:100%;opacity:.55}}
</style>`;

export const marcadoPortada = `<div id="portada" role="status" aria-label="Abriendo FBE Equipo">
<div class="estandarte" aria-hidden="true"><div class="estandarte-pano"></div></div>
<p class="solo-lector">FBE Equipo. Confianza, esfuerzo, compromiso. By Pelayo Fern&aacute;ndez Cid&oacute;n, CEO de Fuerza Basada en Evidencia.</p>
<div class="portada-barra" aria-hidden="true"><span></span></div>
<p class="portada-lento">Est&aacute; tardando m&aacute;s de lo normal. <a href="">Volver a cargar</a></p>
</div>`;
