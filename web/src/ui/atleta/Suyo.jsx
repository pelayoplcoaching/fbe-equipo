// (personalización 2, tanda 4) Que sea suyo: su foto de motivación (se queda en este móvil: no se sube) y su retrato de
// atleta, «Tu ADN FBE» (solo de su entrenamiento).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { reducirFoto } from '../FotoPerfil.jsx';
import { useTrato } from '../trato.js';
import { adnFbe } from '../../logica/retrato.js';
import { vibrar } from '../hapticos.js';
import { Imagen, hayImagen } from '../Imagen.jsx';

// ---------- La foto de motivación ----------
const claveFoto = (atletaId) => `fbe-foto-motivacion:${atletaId}`;
export function leerFotoMotivacion(atletaId) {
  try { const v = localStorage.getItem(claveFoto(atletaId)); return v && v.startsWith('data:image/') ? v : null; } catch { return null; }
}
function guardarFotoMotivacion(atletaId, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(claveFoto(atletaId), dataUrl); else localStorage.removeItem(claveFoto(atletaId));
    globalThis.dispatchEvent?.(new Event('fbe-foto-motivacion'));
    return true;
  } catch { return false; }
}
const aDataUrl = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(new Error('No se ha podido leer la foto')); r.readAsDataURL(blob); });

export function HojaFotoMotivacion({ alCerrar }) {
  const { atleta, aviso } = useApp();
  const [foto, setFoto] = useState(() => leerFotoMotivacion(atleta.id));
  const [cargando, setCargando] = useState(false);
  const elegir = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    setCargando(true);
    try {
      const url = await aDataUrl(await reducirFoto(f, { lado: 1000, max: 220 * 1024 }));
      if (!guardarFotoMotivacion(atleta.id, url)) throw new Error('No cabe en este móvil: prueba con otra foto');
      setFoto(url); vibrar('hecho'); aviso('Guardada en este móvil');
    } catch (err) { aviso(err.message, 'error'); } finally { setCargando(false); }
  };
  return (
    <Hoja titulo="Tu foto de motivación" alCerrar={alCerrar}>
      <div class="pila foto-motivacion-hoja">
        <p class="peq secundario">Tu meta, tu gente, tu perro… La verás en la portada de cada sesión y al terminarla. <strong>Se queda en este móvil: no se sube</strong> (ni la ve tu coach).</p>
        {foto ? <img class="foto-motivacion-vista" src={foto} alt="Tu foto de motivación" />
          : <Imagen id="foto-motivacion-vacia" clase="foto-motivacion-vacia" tamanos="200px" />}
        <label class="btn btn-primario foto-motivacion-elegir">
          <Icono n="camara" /> {cargando ? 'Guardando…' : foto ? 'Cambiar la foto' : 'Elegir una foto'}
          <input type="file" accept="image/*" class="sr" aria-label="Elegir tu foto de motivación" onChange={elegir} disabled={cargando} />
        </label>
        {foto && <button type="button" class="btn-texto peligro" onClick={() => { guardarFotoMotivacion(atleta.id, null); setFoto(null); aviso('Foto quitada'); }}>Quitar la foto</button>}
      </div>
    </Hoja>
  );
}

// En la portada y en el resumen: la foto, con su porqué debajo (si lo tiene)
export function FotoMotivacion({ clase = '' }) {
  const { atleta, propio } = useApp();
  const { personal } = useTrato();
  if (propio || !atleta?.id) return null;
  const foto = leerFotoMotivacion(atleta.id);
  if (!foto) return null;
  return (
    <figure class={`foto-motivacion ${clase}`}>
      <img src={foto} alt="Tu foto de motivación" loading="lazy" />
      {personal?.porque && <figcaption>«{personal.porque}»</figcaption>}
    </figure>
  );
}

// ---------- «Tu ADN FBE» ----------
export function AdnFbe({ entrenos, progreso, hoy }) {
  const { atleta, aviso, propio } = useApp();
  const trato = useTrato();
  const r = adnFbe({ entrenos, progreso, fechaAlta: atleta?.fecha_alta, hoy, conMusica: !!trato.personal?.musica_url }, trato);
  if (!r || propio) return null;
  const compartir = async () => {
    try {
      if (navigator.share) await navigator.share({ title: r.titulo, text: r.compartir });
      else { await navigator.clipboard.writeText(r.compartir); aviso('Copiado: pégalo donde quieras'); }
    } catch { /* cancelado */ }
  };
  return (
    <section class={`panel panel-pad adn-fbe${hayImagen('adn-fbe') ? ' con-ilu' : ''}`} aria-labelledby="adn-fbe-t">
      {/* (imágenes de las 48 h) la doble hélice de discos y mancuernas, de fondo a la derecha */}
      <Imagen id="adn-fbe" clase="adn-fbe-fondo" tamanos="180px" />
      <span class="t-sobre">Tu retrato de atleta</span>
      <h2 id="adn-fbe-t" class="adn-fbe-t">{r.titulo}</h2>
      <p class="adn-fbe-frase">{r.frase}</p>
      <dl class="adn-fbe-rasgos">
        {r.rasgos.map((x) => <div key={x.clave} data-rasgo={x.clave}><dt>{x.titulo}</dt><dd>{x.texto}</dd></div>)}
      </dl>
      <button type="button" class="btn btn-peq" onClick={compartir}><Icono n="compartir" /> Compartir</button>
    </section>
  );
}
