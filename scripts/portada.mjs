// Portada de arranque (v0.29): el lobo de FBE sobre morado, en el propio index.html para que se vea desde el primer
// instante, antes de que llegue el JavaScript. La quita la app (web/src/ui/portada.js) cuando ya hay algo que enseñar.
// Si algo falla y no llega nunca, a los 8 s ofrece volver a cargar (la misma dirección, con su ?demo); sin JavaScript
// no se pinta. El marcado va en ASCII (tildes como entidades): la demo es un HTML sin charset.
import { LOBO_CAJA, LOBO_D } from '../web/src/ui/lobo-trazo.js';

export const MORADO_PORTADA = '#5438D8';

export const estiloPortada = `<style>
#portada{position:fixed;inset:0;z-index:2147483000;display:grid;place-content:center;justify-items:center;gap:22px;background:${MORADO_PORTADA};color:#fff;padding:env(safe-area-inset-top,0px) max(16px,env(safe-area-inset-right,0px)) env(safe-area-inset-bottom,0px) max(16px,env(safe-area-inset-left,0px));font-family:'Archivo Variable',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center;transition:opacity .34s ease}
#portada svg{width:min(40vw,34vh,176px);height:auto;fill:#fff;transition:transform .38s cubic-bezier(.3,0,.2,1)}
#portada .portada-nombre{font-size:22px;line-height:1.2;font-weight:800;font-stretch:110%;letter-spacing:.01em}
#portada .portada-barra{width:min(36vw,132px);height:3px;border-radius:2px;background:rgba(255,255,255,.28);overflow:hidden}
#portada .portada-barra span{display:block;width:40%;height:100%;border-radius:2px;background:#fff;animation:portada-barra 1.15s ease-in-out infinite}
#portada .portada-lento{position:absolute;left:0;right:0;bottom:calc(32px + env(safe-area-inset-bottom,0px));margin:0;padding:0 24px;font-size:15px;line-height:1.45;visibility:hidden;animation:portada-lento 0s 8s forwards}
#portada .portada-lento a{color:#fff;font-weight:700}
#portada.fuera{opacity:0;pointer-events:none}
#portada.fuera svg{transform:scale(1.08)}
@keyframes portada-barra{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes portada-lento{to{visibility:visible}}
@media (prefers-reduced-motion:reduce){#portada,#portada svg{transition:none}#portada .portada-barra span{animation:none;width:100%;opacity:.55}}
</style>`;

export const marcadoPortada = `<div id="portada" role="status" aria-label="Abriendo FBE Equipo">
<svg viewBox="${LOBO_CAJA}" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="${LOBO_D}"/></svg>
<div class="portada-nombre" aria-hidden="true">FBE Equipo</div>
<div class="portada-barra" aria-hidden="true"><span></span></div>
<p class="portada-lento">Est&aacute; tardando m&aacute;s de lo normal. <a href="">Volver a cargar</a></p>
</div>`;
