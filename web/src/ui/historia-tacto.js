// (tacto 226-228, v0.271) Las historias (la sesión, tu semana, tu mes y tu año), con las manos: mantener pulsado las
// para (soltar sigue), deslizar hacia abajo las cierra y deslizar de lado pasa de tarjeta, siguiendo al dedo. Esto es lo
// poco que va con cada historia; lo que mueve las cosas (atleta/historia-gestos.js) llega al abrir la primera.
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from './comunes.jsx';

// La barra de la tarjeta de ahora: parada, o de nuevo desde el principio (al seguir, la tarjeta vuelve a tener su tiempo)
function barra(el, si) {
  const b = el?.querySelector('.historia-barras .corre i');
  if (!b) return;
  if (si) { b.style.animationPlayState = 'paused'; return; }
  b.style.animationPlayState = ''; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
}

// caja: la historia (.historia); o: { i, n, ir(d), alCerrar(), parada } (parada: hay otra cosa encima, p. ej. compartir).
// Devuelve [si está en pausa (la historia no avanza sola mientras tanto), alternar la pausa]
// (belleza 334) La pausa, también sin mantener pulsado: con el botón de arriba (BotonPausa) y con la barra espaciadora
export function useHistoriaTacto(caja, o) {
  const [pausa, setPausa] = useState(false);
  const vivo = useRef(null);
  vivo.current = { ...o, setPausa };
  const alternar = () => setPausa((p) => { barra(caja.current, !p); return !p; });
  useEffect(() => {
    let quitar = null, fuera = false;
    import('./atleta/historia-gestos.js').then((m) => { if (!fuera) quitar = m.instalarHistoria(caja.current, () => vivo.current); }).catch(() => { /* sin gestos: tocar sigue valiendo */ });
    // (solo la de encima: con la hoja de compartir abierta, las teclas son suyas)
    const tecla = (e) => {
      if (e.key !== ' ' || document.querySelectorAll('[aria-modal="true"]').length > 1 || e.target?.closest?.('button, a, input, select, textarea')) return;
      e.preventDefault();
      setPausa((p) => { barra(caja.current, !p); return !p; });
    };
    document.addEventListener('keydown', tecla);
    return () => { fuera = true; quitar?.(); document.removeEventListener('keydown', tecla); };
  }, []);
  return [pausa, alternar];
}

// El botón de pausa, arriba a la izquierda (no sale con «reducir movimiento»: entonces la historia no avanza sola). Su
// sitio, en línea: este archivo va en el arranque y sus estilos irían con él (y los del arranque van justos de peso)
export function BotonPausa({ pausa, alternar }) {
  return h('button', { type: 'button', class: 'btn btn-icono plano historia-cerrar', style: 'right:auto;left:max(var(--esp-12),env(safe-area-inset-left,0px))', 'aria-pressed': pausa ? 'true' : 'false', 'aria-label': pausa ? 'Seguir la historia' : 'Pausar la historia', onClick: alternar },
    h(Icono, { n: pausa ? 'play' : 'pausa' }));
}
