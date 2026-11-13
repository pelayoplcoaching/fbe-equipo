// «¿Se oye bien?» (sonido 2, tanda 4): una prueba de sonido de unos segundos. Suena la familia (una serie, la cuenta atrás y
// el aviso del final del descanso) y se ajusta: más alto o más bajo, dónde entrena (con música alrededor, los sonidos más
// brillantes; con pocos sonidos, «Solo lo justo»). Sale una vez, al empezar la primera sesión (una línea que se puede dejar
// para luego), y se puede repetir desde Sonido y vibración.
import { useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from './comunes.jsx';
import { leerAjustes, guardarAjustes } from './ajustes.js';
import { contexto, sonarTanda } from './sonido.js';
import { PERFILES } from '../logica/sonido.js';

const TANDA = [['serie', { n: 1, total: 3 }, 'Una serie'], ['serie', { n: 3, total: 3 }, 'La última serie'], ['cuenta', { segundo: 3 }, 'La cuenta atrás'], ['cuenta', { segundo: 2 }, 'La cuenta atrás'], ['cuenta', { segundo: 1 }, 'La cuenta atrás'], ['fin-descanso', {}, 'El final del descanso']];

export function PruebaSonido({ alCerrar }) {
  const { aviso } = useApp();
  const [paso, setPaso] = useState(0);
  const [suena, setSuena] = useState(null);
  const [a, setA] = useState(leerAjustes);
  const poner = (o) => { const n = { ...leerAjustes(), ...o }; guardarAjustes(n); setA(n); };
  const tocar = () => { contexto(); sonarTanda(TANDA.map(([k, d, n]) => [k, d, n]), { cada: 600, alSonar: setSuena }); };
  const volumen = Math.round((Number(a.volumen) || 1) * 100);
  const terminar = (o = {}) => { poner({ ...o, pruebaSonido: true }); aviso('Sonido listo. Puedes cambiarlo en Perfil → Sonido y vibración'); alCerrar(); };
  return (
    <Hoja titulo="¿Se oye bien?" alCerrar={() => { poner({ pruebaSonido: true }); alCerrar(); }}>
      {paso === 0 ? (
        <div class="pila prueba-sonido">
          <p>Sube el volumen del móvil a tu gusto y toca «Escuchar». Son unos segundos: una serie, la cuenta atrás y el final del descanso.</p>
          <button type="button" class="btn btn-primario" onClick={tocar}><Icono n="altavoz" /> Escuchar</button>
          {suena && <p class="peq secundario" role="status">Suena: {suena}</p>}
          <p class="peq terciario num">Volumen de la app: {volumen} %</p>
          <div class="fila-envolver">
            <button type="button" class="btn" onClick={() => { poner({ volumen: Math.min(1, (Number(a.volumen) || 1) + 0.2), ...(Number(a.volumen) >= 0.95 ? { sonidoBrillante: true } : {}) }); setTimeout(tocar, 50); }}>Muy bajo</button>
            <button type="button" class="btn btn-primario" onClick={() => setPaso(1)}>Se oye bien</button>
            <button type="button" class="btn" onClick={() => { poner({ volumen: Math.max(0.2, (Number(a.volumen) || 1) - 0.2) }); setTimeout(tocar, 50); }}>Muy alto</button>
          </div>
        </div>
      ) : (
        <div class="pila prueba-sonido">
          <p>¿Dónde entrenas normalmente?</p>
          <div class="pila-s">
            <button type="button" class="btn btn-ancho" onClick={() => terminar({ sonidoBrillante: true, ...PERFILES.equilibrado.ajustes })}>En un gimnasio con música</button>
            <button type="button" class="btn btn-ancho" onClick={() => terminar({ sonidoBrillante: false, ...PERFILES.equilibrado.ajustes })}>En casa o en un sitio tranquilo</button>
            <button type="button" class="btn btn-ancho" onClick={() => terminar({ ...PERFILES.justo.ajustes })}>Prefiero pocos sonidos</button>
          </div>
        </div>
      )}
    </Hoja>
  );
}

// La línea de la sesión: «¿Se oye bien? Prueba el sonido (10 s)» (una vez; «Ahora no» la quita)
export function AvisoPruebaSonido() {
  const [ver, setVer] = useState(() => !leerAjustes().pruebaSonido);
  const [abierta, setAbierta] = useState(false);
  if (!ver && !abierta) return null;
  return (
    <>
      {ver && (
        <p class="aviso-prueba-sonido peq">
          <Icono n="altavoz" /><span>¿Se oye bien el sonido?</span>
          <button type="button" class="btn-texto" onClick={() => { setAbierta(true); setVer(false); }}>Probar (10 s)</button>
          <button type="button" class="btn-texto mini" onClick={() => { guardarAjustes({ ...leerAjustes(), pruebaSonido: true }); setVer(false); }}>Ahora no</button>
        </p>
      )}
      {abierta && <PruebaSonido alCerrar={() => setAbierta(false)} />}
    </>
  );
}
