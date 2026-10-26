import { useEffect, useState } from 'preact/hooks';
import { useApp, Hoja, Segmentos, Cargando } from './comunes.jsx';
import { fmtCorta, diasEntre } from '../logica/fechas.js';

// Antes y después: dos fotos de progreso lado a lado o una encima de otra con un deslizador.
// fotos: archivos de tipo foto_progreso (de más reciente a más antigua o al revés: se ordenan aquí)
function useUrls(fotos) {
  const { api } = useApp();
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let vivo = true;
    for (const f of fotos) {
      if (urls[f.id]) continue;
      api.urlArchivo(f.ruta).then((u) => vivo && setUrls((m) => ({ ...m, [f.id]: u }))).catch(() => {});
    }
    return () => { vivo = false; };
  }, [fotos.map((f) => f.id).join()]);
  return urls;
}

function Tira({ fotos, urls, elegida, alElegir, etiqueta }) {
  return (
    <div class="tira-fotos" role="radiogroup" aria-label={etiqueta}>
      {fotos.map((f) => (
        <button key={f.id} type="button" role="radio" aria-checked={elegida === f.id ? 'true' : 'false'} class={elegida === f.id ? 'elegida' : ''}
          onClick={() => alElegir(f.id)} aria-label={`${etiqueta}: foto del ${fmtCorta(f.fecha)}`}>
          {urls[f.id] ? <img src={urls[f.id]} alt="" loading="lazy" /> : <span class="tira-vacia" />}
          <span class="mini num">{fmtCorta(f.fecha)}</span>
        </button>
      ))}
    </div>
  );
}

const POSES = [['frente', 'Frente'], ['perfil', 'Perfil'], ['espalda', 'Espalda']];

export function CompararFotos({ fotos, alCerrar }) {
  // Se compara la misma pose: de entrada, la que tiene más fotos (si hay al menos dos)
  const poses = POSES.filter(([p]) => fotos.filter((f) => f.pose === p).length >= 2);
  const [pose, setPose] = useState(() => [...poses].sort((a, b) => fotos.filter((f) => f.pose === b[0]).length - fotos.filter((f) => f.pose === a[0]).length)[0]?.[0] || 'todas');
  const orden = [...fotos].filter((f) => pose === 'todas' || f.pose === pose).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const urls = useUrls(fotos);
  const [antes, setAntes] = useState(orden[0]?.id);
  const [despues, setDespues] = useState(orden[orden.length - 1]?.id);
  const elegirPose = (p) => {
    const o = [...fotos].filter((f) => p === 'todas' || f.pose === p).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    setPose(p); setAntes(o[0]?.id); setDespues(o[o.length - 1]?.id);
  };
  const [modo, setModo] = useState('deslizador');
  const [corte, setCorte] = useState(50);
  const fa = orden.find((f) => f.id === antes), fd = orden.find((f) => f.id === despues);
  const dias = fa && fd ? Math.abs(diasEntre(fa.fecha, fd.fecha)) : 0;
  const listas = fa && fd && urls[fa.id] && urls[fd.id];
  return (
    <Hoja titulo="Antes y después" alCerrar={alCerrar} ancho={720}>
      <div class="pila">
        <Segmentos opciones={[['deslizador', 'Deslizador'], ['lado', 'Lado a lado']]} valor={modo} etiqueta="Cómo compararlas" alCambiar={(v) => v && setModo(v)} />
        {poses.length > 0 && (poses.length > 1 || fotos.some((f) => !f.pose || f.pose !== poses[0][0])) && (
          <Segmentos opciones={[...poses, ['todas', 'Todas']]} valor={pose} etiqueta="Pose" alCambiar={(v) => v && elegirPose(v)} />
        )}
        {!listas ? <div class="comparar-cargando"><Cargando texto="Cargando las fotos" /></div> : modo === 'lado' ? (
          <div class="comparar-lado">
            <figure><img src={urls[fa.id]} alt={`Antes: foto del ${fmtCorta(fa.fecha)}`} /><figcaption class="mini num">Antes, {fmtCorta(fa.fecha)}</figcaption></figure>
            <figure><img src={urls[fd.id]} alt={`Después: foto del ${fmtCorta(fd.fecha)}`} /><figcaption class="mini num">Después, {fmtCorta(fd.fecha)}</figcaption></figure>
          </div>
        ) : (
          <div class="comparar-deslizador">
            <div class="comparar-marco">
              <img src={urls[fd.id]} alt={`Después: foto del ${fmtCorta(fd.fecha)}`} />
              <img src={urls[fa.id]} alt={`Antes: foto del ${fmtCorta(fa.fecha)}`} class="comparar-antes" style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }} />
              <span class="comparar-linea" style={{ left: `${corte}%` }} aria-hidden="true"><i /></span>
              <span class="comparar-etq izq mini">Antes</span><span class="comparar-etq der mini">Después</span>
            </div>
            <input type="range" min="0" max="100" step="1" value={corte} class="rep-tiempo" aria-label="Cuánto se ve de la foto de antes" aria-valuetext={`${corte} % de la foto de antes`}
              onInput={(e) => setCorte(Number(e.currentTarget.value))} />
          </div>
        )}
        {fa && fd && <p class="peq secundario num">{fa.id === fd.id ? 'Es la misma foto: elige otra abajo.' : `${dias} días entre una y otra (${Math.round(dias / 7)} semanas).`}</p>}
        <div class="pila-s"><span class="peq secundario">Antes</span><Tira fotos={orden} urls={urls} elegida={antes} alElegir={setAntes} etiqueta="Antes" /></div>
        <div class="pila-s"><span class="peq secundario">Después</span><Tira fotos={orden} urls={urls} elegida={despues} alElegir={setDespues} etiqueta="Después" /></div>
        <p class="mini terciario">Compáralas con la misma luz, ropa y postura. Las fotos no salen de vuestra carpeta privada.</p>
      </div>
    </Hoja>
  );
}
