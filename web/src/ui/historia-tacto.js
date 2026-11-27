// (tacto 226-228, v0.271) Las historias (la sesión, tu semana, tu mes y tu año), con las manos: mantener pulsado las
// para (soltar sigue), deslizar hacia abajo las cierra y deslizar de lado pasa de tarjeta, siguiendo al dedo. Esto es lo
// poco que va con cada historia; lo que mueve las cosas (atleta/historia-gestos.js) llega al abrir la primera.
import { useEffect, useRef, useState } from 'preact/hooks';

// caja: la historia (.historia); o: { i, n, ir(d), alCerrar(), parada } (parada: hay otra cosa encima, p. ej. compartir).
// Devuelve si está en pausa: la historia no avanza sola mientras tanto
export function useHistoriaTacto(caja, o) {
  const [pausa, setPausa] = useState(false);
  const vivo = useRef(null);
  vivo.current = { ...o, setPausa };
  useEffect(() => {
    let quitar = null, fuera = false;
    import('./atleta/historia-gestos.js').then((m) => { if (!fuera) quitar = m.instalarHistoria(caja.current, () => vivo.current); }).catch(() => { /* sin gestos: tocar sigue valiendo */ });
    return () => { fuera = true; quitar?.(); };
  }, []);
  return pausa;
}
