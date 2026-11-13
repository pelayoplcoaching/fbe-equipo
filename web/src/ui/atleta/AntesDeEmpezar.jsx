import { useState } from 'preact/hooks';
import { Icono, useApp, useCarga } from '../comunes.jsx';
import { fichaDeEjercicio } from '../../datos/guias.js';
import { tresClaves, clavesDeFicha } from '../../logica/apuntes-practica.js';

// (apuntes, tanda B) La primera vez que le toca un ejercicio (sin series de otras veces), antes de la primera serie: sus
// tres claves (de su ficha de técnica o, sin ficha, de las instrucciones), con veinte segundos que se llenan. Se apunta
// en este móvil (`fbe-antes-<atletaId>`) para no volver a salir.
const clave = (id) => `fbe-antes-${id}`;
const leer = (id) => { try { const x = JSON.parse(localStorage.getItem(clave(id)) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
export function AntesDeEmpezar({ ej }) {
  const { atleta, backend } = useApp() || {};
  const [fuera, setFuera] = useState(() => !atleta?.id || leer(atleta.id).includes(ej.id));
  const ficha = useCarga(() => (!fuera && backend ? fichaDeEjercicio({ backend }, ej.id).catch(() => null) : Promise.resolve(null)), [ej.id, fuera], { recuerdo: !fuera ? `ficha-fbe:${ej.id}` : null });
  if (fuera || ficha.cargando) return null;
  const deFicha = clavesDeFicha(ficha.datos?.ficha);
  const claves = deFicha.length >= 2 ? deFicha : tresClaves(ej.instrucciones);
  if (claves.length < 2) return null;
  const listo = () => {
    try { localStorage.setItem(clave(atleta.id), JSON.stringify([...leer(atleta.id), ej.id].slice(-300))); } catch { /* sin almacenamiento: sale otra vez */ }
    setFuera(true);
  };
  return (
    <section class="antes-de-empezar" aria-label="Antes de la primera serie">
      <p class="antes-cab"><Icono n="diana" /><strong>Es nuevo para ti: tres claves antes de empezar</strong></p>
      <ol>{claves.map((c, i) => <li key={i}>{c}</li>)}</ol>
      <span class="antes-tiempo" aria-hidden="true"><i /></span>
      <button type="button" class="btn btn-peq" onClick={listo}>Vale, a por ello</button>
    </section>
  );
}
