// Cuenta → Cómo va la app (pulido 4): cuánto tarda la app en los dispositivos de verdad (los de tus atletas y el
// tuyo), sin nombres. Lo apunta sola (rendimiento.js) y aquí se ve sumado: lo normal (la mitad de las veces tarda eso
// o menos) y lo lento (una de cada diez tarda eso o más). «Copiar» lo deja listo para pegárselo a Claude.
import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, copiar } from '../comunes.jsx';
import { enviarRendimiento } from '../../rendimiento.js';
import { resumenRendimiento, medidasDe, textoRendimiento, textoMs, percentil } from '../../logica/rendimiento.js';

const DIAS = 14;

function Medidas({ datos, corto = false }) {
  const lista = medidasDe(datos);
  const ver = corto ? lista.filter((x) => ['arranque', 'pantalla:hoy', 'pantalla:sesion', 'pantalla:atletas', 'pantalla:ficha', 'consulta', 'guardar'].includes(x.k)) : lista;
  if (!ver.length) return <p class="peq secundario">Aún sin medidas.</p>;
  return (
    <ul class="lista medidas-app">
      {ver.map((x) => (
        <li key={x.k} class="separa" style="gap:12px;padding:6px 0">
          <span class="peq" style="flex:1;min-width:0">{x.nombre} <span class="mini terciario num">({x.n})</span></span>
          <span class="peq num" style="flex:none;text-align:right;white-space:nowrap"><strong>{textoMs(x.normal)}</strong> <span class="mini terciario">normal ·</span> {textoMs(x.lento)} <span class="mini terciario">lento</span></span>
        </li>
      ))}
    </ul>
  );
}

export function RendimientoApp() {
  const { api, aviso } = useApp();
  const [abierto, setAbierto] = useState(false);
  // Lo de este dispositivo se manda antes de mirar (si no, lo de hoy aún no estaría)
  const filas = useCarga(async () => { await enviarRendimiento({ forzar: true }).catch(() => false); return api.rendimientoEquipo(DIAS); }, []);
  const r = filas.datos ? resumenRendimiento(filas.datos) : null;
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { if (!borrar) return undefined; const t = setTimeout(() => setBorrar(false), 4000); return () => clearTimeout(t); }, [borrar]);
  const clases = r ? r.porClase.map((g) => `${g.dispositivos} ${g.clave.toLowerCase()}`).join(', ') : '';
  return (
    <section class="seccion">
      <h2>Cómo va la app</h2>
      <div class="panel panel-pad pila-s">
        <div class="separa">
          <span class="peq secundario">
            {filas.cargando && !filas.datos ? 'Cargando…'
              : filas.error ? 'No se ha podido cargar.'
                : filas.datos === null ? 'Falta ejecutar la migración 049 en Supabase: hasta entonces no se apunta nada.'
                  : !r?.filas ? `Aún sin medidas en los últimos ${DIAS} días.`
                    : `${r.todo.dispositivos} ${r.todo.dispositivos === 1 ? 'dispositivo' : 'dispositivos'} en los últimos ${DIAS} días${clases ? ` (${clases})` : ''}`}
          </span>
          {r?.filas > 0 && <button class="btn btn-peq" onClick={() => setAbierto(!abierto)} aria-expanded={abierto ? 'true' : 'false'}>{abierto ? 'Ocultar' : 'Ver todo'}</button>}
        </div>
        {r?.filas > 0 && <Medidas datos={r.todo.datos} corto={!abierto} />}
        <p class="mini terciario">La app apunta sola cuánto tarda en abrir, en enseñar cada pantalla, en contestar la base y en guardar, en el móvil de cada uno. Solo tiempos y el tipo de dispositivo: ni nombres ni nada de lo que se hace. «Normal»: la mitad de las veces tarda eso o menos. «Lento»: una de cada diez tarda eso o más.</p>
        {abierto && r?.filas > 0 && (
          <>
            {r.porClase.length > 1 && r.porClase.map((g) => (
              <div class="pila-xs" key={g.clave}>
                <h3 class="etq">{g.clave} · {g.dispositivos} {g.dispositivos === 1 ? 'dispositivo' : 'dispositivos'}</h3>
                <Medidas datos={g.datos} corto />
              </div>
            ))}
            {r.porRol.length > 1 && r.porRol.map((g) => (
              <div class="pila-xs" key={g.clave}>
                <h3 class="etq">{g.clave === 'coach' ? 'Tu cuenta' : 'Atletas'} · {g.dispositivos} {g.dispositivos === 1 ? 'dispositivo' : 'dispositivos'}</h3>
                <Medidas datos={g.datos} corto />
              </div>
            ))}
            {r.dispositivos.filter((d) => d.arranque != null).length > 1 && (
              <div class="pila-xs">
                <h3 class="etq">Los que más tardan en abrir</h3>
                <ul class="lista">
                  {r.dispositivos.filter((d) => d.arranque != null).slice(0, 6).map((d) => (
                    <li key={d.clave} class="separa" style="gap:12px;padding:6px 0">
                      <span class="peq" style="flex:1;min-width:0">{d.clase}{d.entorno.instalada ? ', instalada' : ''}{d.entorno.red ? `, red ${d.entorno.red}` : ''} <span class="mini terciario">· {d.rol === 'coach' ? 'coach' : 'atleta'} · {d.dias} {d.dias === 1 ? 'día' : 'días'}</span></span>
                      <span class="peq num" style="flex:none;text-align:right;white-space:nowrap"><strong>{textoMs(d.arranque)}</strong> <span class="mini terciario">· consulta {textoMs(percentil(d.datos.consulta, 0.5))}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div class="fila-acciones" style="justify-content:flex-start">
              <button class="btn btn-peq" onClick={async () => aviso((await copiar(textoRendimiento(r))) ? 'Copiado: pégaselo a Claude' : 'No se ha podido copiar')}><Icono n="copiar" /> Copiar para Claude</button>
              <button class="btn btn-peq plano" onClick={async () => {
                if (!borrar) { setBorrar(true); return; }
                try { await api.borrarRendimiento(); setBorrar(false); filas.recargar(true); aviso('Medidas borradas'); } catch (err) { aviso(err.message, 'error'); }
              }}>{borrar ? 'Sí, borrar todas' : 'Borrar las medidas'}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
