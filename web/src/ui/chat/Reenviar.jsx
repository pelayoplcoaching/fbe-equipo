import { useMemo, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, Avatar, useApp, useCarga, Cargando, Vacio } from '../comunes.jsx';
import { normalLetras, extractoCita } from '../../logica/mensajes.js';
import { textoSaltados } from '../../logica/chat.js';

// Elegir atletas (reenviar y las listas de difusión): con buscador; los de baja salen sin poder elegirse
export function ElegirAtletas({ atletas, elegidos, alCambiar, excluir = [], max = 256, etiqueta = 'Atletas' }) {
  const [q, setQ] = useState('');
  const nq = normalLetras(q.trim());
  const lista = atletas.filter((a) => !excluir.includes(a.id) && (!nq || normalLetras(a.nombre).includes(nq)));
  const cambiar = (id, si) => alCambiar(si ? [...new Set([...elegidos, id])].slice(0, max) : elegidos.filter((x) => x !== id));
  return (
    <div class="elegir-atletas">
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" placeholder="Buscar atleta" aria-label="Buscar atleta" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
      <div role="group" aria-label={etiqueta}><ul class="lista elegir-atletas-lista">
        {lista.map((a) => {
          const baja = a.estado === 'baja';
          const si = elegidos.includes(a.id);
          return (
            <li key={a.id}>
              <label class={`elegir-atleta ${baja ? 'baja' : ''}`}>
                <input type="checkbox" checked={si} disabled={baja || (!si && elegidos.length >= max)} onChange={(e) => cambiar(a.id, e.currentTarget.checked)} />
                <Avatar nombre={a.nombre} foto={a.foto} />
                <span class="pila-xs"><strong>{a.nombre}</strong>{baja && <span class="mini secundario">De baja: no le llega</span>}</span>
              </label>
            </li>
          );
        })}
        {!lista.length && <li class="panel-pad peq secundario">Ningún atleta con ese nombre.</li>}
      </ul></div>
    </div>
  );
}

// Reenviar (el coach) uno o varios mensajes suyos a otros atletas: cada uno lo recibe en su chat, con «↪ Reenviado»
export function HojaReenviar({ mensajes, alCerrar, alHecho }) {
  const { api, aviso } = useApp();
  const atletas = useCarga(() => api.atletas(), []);
  const [elegidos, setElegidos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  // Lo de cada mensaje en este «Reenviar» (sus ids y copias): al reintentar se reutiliza, y lo que ya entró no se repite
  const envios = useRef({});
  const lista = useMemo(() => [...(atletas.datos || [])].sort((a, b) => (a.estado === 'baja') - (b.estado === 'baja') || a.nombre.localeCompare(b.nombre)), [atletas.datos]);
  async function enviar() {
    if (!elegidos.length || enviando) return;
    setEnviando(true);
    let enviados = 0, saltados = 0, fallidos = 0;
    try {
      for (const [k, c] of mensajes.entries()) {
        if (mensajes.length > 1) setProgreso(`${k + 1} de ${mensajes.length}`);
        const r = await api.reenviar(c, elegidos, (envios.current[c.id] ||= {}));
        enviados += r.enviados; saltados = Math.max(saltados, r.saltados); fallidos += r.fallidos;
      }
      const n = elegidos.length;
      aviso([`Reenviado a ${n === 1 ? lista.find((a) => a.id === elegidos[0])?.nombre.split(' ')[0] || '1 atleta' : `${n} atletas`}`, textoSaltados(saltados), fallidos ? `${fallidos} sin el archivo (no se pudo copiar)` : ''].filter(Boolean).join('. '));
      alHecho?.({ enviados, saltados, fallidos, atletas: elegidos });
    } catch (e) { aviso(e.message, 'error'); } finally { setEnviando(false); setProgreso(null); }
  }
  return (
    <Hoja titulo="Reenviar a…" alCerrar={alCerrar} medio>
      <p class="peq secundario reenviar-que">{mensajes.length === 1 ? extractoCita(mensajes[0], 120) : `${mensajes.length} mensajes`}</p>
      {atletas.cargando && !atletas.datos ? <Cargando /> : !lista.length ? <Vacio icono="atletas" titulo="Sin atletas">Da de alta a un atleta para reenviarle mensajes.</Vacio> : (
        <ElegirAtletas atletas={lista} elegidos={elegidos} alCambiar={setElegidos} max={50} etiqueta="A quién reenviarlo" />
      )}
      <div class="hoja-pie-fijo">
        <button type="button" class="btn btn-primario" disabled={!elegidos.length || enviando} onClick={enviar}>
          <Icono n="reenviar" /> {enviando ? `Reenviando${progreso ? ` ${progreso}` : ''}…` : elegidos.length ? `Reenviar a ${elegidos.length}` : 'Elige a quién'}
        </button>
      </div>
    </Hoja>
  );
}
