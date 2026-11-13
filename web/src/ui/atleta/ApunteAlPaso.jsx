import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, useApp, useCarga } from '../comunes.jsx';
import { guiaPorClave } from '../../datos/guias.js';
import { apuntesDeGuias } from '../../logica/apuntes.js';
import { hoyISO } from '../../logica/fechas.js';
import { HojaGuia } from '../Guias.jsx';

// (tanda 2) Un apunte «al paso», fuera del gimnasio: una idea de la guía que viene a cuento donde se está (nutrición al
// mirar el menú, composición al pesarse, sueño en los hábitos). Una al día, la misma todo el día. No pide nada hasta que
// se ve en pantalla (dentro de una fila plegada no se ve), y entonces solo esa guía, que queda recordada.
export function ApunteAlPaso({ guia }) {
  const { backend, perfil } = useApp();
  const marca = useRef(null);
  const [visto, setVisto] = useState(false);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    const el = marca.current;
    if (!el || visto) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisto(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, [visto]);
  const pedir = visto && perfil?.rol !== 'coach';
  const g = useCarga(() => (pedir ? guiaPorClave({ backend }, guia).catch(() => null) : Promise.resolve(null)), [pedir, guia], { recuerdo: pedir ? `apunte-al-paso:${guia}` : null });
  const ideas = g.datos?.publicada ? apuntesDeGuias([g.datos]).filter((a) => a.tipo === 'idea') : [];
  const dia = Math.floor(Date.parse(`${hoyISO()}T00:00:00Z`) / 86400000);
  const a = ideas.length ? ideas[dia % ideas.length] : null;
  if (!a) return <span ref={marca} class="apunte-al-paso-marca" aria-hidden="true" />;
  return (
    <aside class="apunte-al-paso" aria-label="Un apunte de tu coach">
      <Icono n="biblioteca" />
      <p><strong>{a.titulo}</strong>{a.titulo && a.texto ? ' ' : ''}{a.texto}</p>
      <button type="button" class="btn-texto" onClick={() => setAbierta(true)}>Leer la guía</button>
      {abierta && <HojaGuia guia={{ clave: guia, titulo: g.datos.titulo }} alCerrar={() => setAbierta(false)} />}
    </aside>
  );
}
