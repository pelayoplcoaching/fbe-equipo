// Portada de arranque (v0.29; estandarte desde la v0.31): el lobo de FBE en un estandarte colgado de su asta, con el
// lema arriba («Confianza · Esfuerzo · Compromiso») y la firma abajo. Va en el propio index.html para que se vea desde
// el primer instante, antes de que llegue el JavaScript; la quita la app (web/src/ui/portada.js) cuando ya hay algo que
// enseñar. Si algo falla y no llega nunca, a los 8 s ofrece volver a cargar (la misma dirección, con su ?demo); sin
// JavaScript no se pinta. El marcado va en ASCII (tildes como entidades): la demo es un HTML sin charset.
import { LOBO_CAJA, LOBO_D } from '../web/src/ui/lobo-trazo.js';

export const MORADO_PORTADA = '#5438D8';
export const FONDO_PORTADA = '#1E1548'; // la noche detrás del estandarte (y la barra del sistema mientras se ve)

// fuente: URL de la Cinzel (letras de inscripción romana, para el lema y la firma)
export const estiloPortada = (fuente) => `<style>
@font-face{font-family:'Cinzel FBE';font-style:normal;font-display:swap;font-weight:400 900;src:url(${fuente}) format('woff2')}
#portada{position:fixed;inset:0;z-index:2147483000;display:grid;place-content:center;justify-items:center;gap:18px;background:radial-gradient(120% 80% at 50% 35%,#34268A 0%,${FONDO_PORTADA} 62%,#120C2E 100%);color:#fff;padding:env(safe-area-inset-top,0px) max(16px,env(safe-area-inset-right,0px)) env(safe-area-inset-bottom,0px) max(16px,env(safe-area-inset-left,0px));text-align:center;transition:opacity .34s ease}
#portada .estandarte{width:auto;height:min(74vh,560px);max-width:calc(100vw - 32px);overflow:visible;transform-origin:50% 3%;animation:estandarte-mece 5s ease-in-out infinite;transition:transform .38s cubic-bezier(.3,0,.2,1)}
#portada .estandarte text{font-family:'Cinzel FBE','Cinzel','Trajan Pro',Georgia,'Times New Roman',serif}
#portada .portada-barra{width:min(36vw,132px);height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}
#portada .portada-barra span{display:block;width:40%;height:100%;border-radius:2px;background:#E9D49A;animation:portada-barra 1.15s ease-in-out infinite}
#portada .portada-lento{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom,0px));margin:0;padding:0 24px;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;visibility:hidden;animation:portada-lento 0s 8s forwards}
#portada .portada-lento a{color:#fff;font-weight:700}
#portada.fuera{opacity:0;pointer-events:none}
#portada.fuera .estandarte{animation:none;transform:scale(1.06)}
@keyframes estandarte-mece{0%,100%{transform:rotate(-.7deg)}50%{transform:rotate(.7deg)}}
@keyframes portada-barra{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes portada-lento{to{visibility:visible}}
@media (prefers-reduced-motion:reduce){#portada,#portada .estandarte{transition:none;animation:none}#portada .portada-barra span{animation:none;width:100%;opacity:.55}}
</style>`;

// El estandarte, en un SVG de 300 x 446: asta con remates, paño morado con pliegues, ribete dorado, cola de golondrina
const [lx, ly, lw, lh] = LOBO_CAJA.split(' ').map(Number);
const loboAncho = 158, loboAlto = (loboAncho * lh) / lw;
const escala = loboAncho / lw;
const LOBO_Y = 102;
const loboX = 150 - loboAncho / 2 - lx * escala, loboY = LOBO_Y - ly * escala;
const bajo = LOBO_Y + loboAlto; // donde acaba el lobo
const pano = 'M40 34 H260 V436 L150 392 L40 436 Z';
const ribete = 'M50 44 H250 V421 L150 381 L50 421 Z';
const estandarte = `<svg class="estandarte" viewBox="0 0 300 446" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="pf-pliegues" x1="0" x2="1" y1="0" y2="0">
<stop offset="0" stop-color="#3E27B3"/><stop offset=".14" stop-color="#5A3FE0"/><stop offset=".3" stop-color="#4A31C6"/>
<stop offset=".5" stop-color="#5C42E4"/><stop offset=".7" stop-color="#4A31C6"/><stop offset=".86" stop-color="#5A3FE0"/><stop offset="1" stop-color="#3E27B3"/>
</linearGradient>
<linearGradient id="pf-luz" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="pf-oro" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F6E7B8"/><stop offset=".55" stop-color="#D8B65E"/><stop offset="1" stop-color="#A9853A"/></linearGradient>
</defs>
<g fill="url(#pf-oro)">
<rect x="12" y="20" width="276" height="9" rx="4.5"/>
<path d="M12 24.5 L2 18 L2 31 Z M288 24.5 L298 18 L298 31 Z"/>
<circle cx="14" cy="24.5" r="6"/><circle cx="286" cy="24.5" r="6"/>
</g>
<g fill="#C9A653"><rect x="56" y="26" width="10" height="14" rx="2"/><rect x="145" y="26" width="10" height="14" rx="2"/><rect x="234" y="26" width="10" height="14" rx="2"/></g>
<path d="${pano}" fill="url(#pf-pliegues)"/>
<path d="${pano}" fill="url(#pf-luz)"/>
<path d="${ribete}" fill="none" stroke="url(#pf-oro)" stroke-width="2.2"/>
<g>
<path d="M24 60 H4 L13 71 L4 82 H24 Z M276 60 H296 L287 71 L296 82 H276 Z" fill="#2A1C70" stroke="url(#pf-oro)" stroke-width="1"/>
<path d="M18 56 H24 V60 H18 Z M276 56 H282 V60 H276 Z" fill="#170F45"/>
<rect x="18" y="52" width="264" height="26" rx="2" fill="#2E2078" stroke="url(#pf-oro)" stroke-width="1.2"/>
<text x="150" y="69.5" font-size="10.4" font-weight="700" letter-spacing=".9" fill="#F3E3B0" text-anchor="middle">CONFIANZA &#183; ESFUERZO &#183; COMPROMISO</text>
</g>
<g transform="translate(${loboX.toFixed(2)} ${loboY.toFixed(2)}) scale(${escala.toFixed(5)})" fill="#fff"><path fill-rule="evenodd" d="${LOBO_D}"/></g>
<g fill="url(#pf-oro)"><path d="M78 ${(bajo + 16).toFixed(1)} H138 M162 ${(bajo + 16).toFixed(1)} H222" stroke="url(#pf-oro)" stroke-width="1"/><path d="M150 ${(bajo + 11).toFixed(1)} l5 5 -5 5 -5 -5 Z"/></g>
<text x="150" y="${(bajo + 40).toFixed(1)}" font-size="11.4" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing=".3">by Pelayo Fern&#225;ndez Cid&#243;n</text>
<text x="150" y="${(bajo + 57).toFixed(1)}" font-size="8.6" font-weight="500" fill="#E9D49A" text-anchor="middle" letter-spacing=".5">CEO de Fuerza Basada en Evidencia</text>
</svg>`;

export const marcadoPortada = `<div id="portada" role="status" aria-label="Abriendo FBE Equipo">
${estandarte}
<div class="portada-barra" aria-hidden="true"><span></span></div>
<p class="portada-lento">Est&aacute; tardando m&aacute;s de lo normal. <a href="">Volver a cargar</a></p>
</div>`;
