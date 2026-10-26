import { useEffect, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Cargando, Hoja, Vacio, Paso } from '../comunes.jsx';
import { EditorBloque } from './Editor.jsx';
import { BandaDemo } from '../App.jsx';
import { NOMBRE_FOCO } from '../../logica/calculos.js';
import { hoyISO, lunesDe, sumarDias, desdeISO } from '../../logica/fechas.js';

export function Plantillas({ peticion = null } = {}) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.plantillas(), []);
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [asignar, setAsignar] = useState(null); // plantilla que se asigna a varios atletas
  useEffect(() => { if (peticion?.nueva) { setAbierta(null); setNueva(true); } else if (peticion?.plantillaId) setAbierta(peticion.plantillaId); }, [peticion?.id]);

  if (abierta) {
    return (
      <div class="contenido coach">
        <header class="cabecera">
          <button class="btn btn-icono plano" onClick={() => { setAbierta(null); lista.recargar(true); }} aria-label="Volver a plantillas"><Icono n="atras" /></button>
          <div class="titulo"><h1>Plantilla</h1><div class="sub">Los cambios no afectan a los bloques ya creados desde ella</div></div>
          <button class="btn" onClick={() => setAsignar((lista.datos || []).find((p) => p.id === abierta) || { id: abierta, nombre: 'Plantilla' })}><Icono n="atletas" /><span class="solo-ancho">Asignar a atletas</span><span class="sr">Asignar a atletas</span></button>
        </header>
        <EditorBloque key={abierta} bloqueId={abierta} alBorrar={() => { setAbierta(null); lista.recargar(true); }} />
        {asignar && <AsignarPlantilla plantilla={asignar} alCerrar={() => setAsignar(null)} />}
      </div>
    );
  }
  return (
    <div class="contenido coach">
      <header class="cabecera">
        <div class="titulo"><h1>Plantillas</h1><div class="sub">Bloques reutilizables para empezar más rápido</div></div>
        <button class="btn btn-primario" onClick={() => setNueva(true)}><Icono n="mas" /><span class="solo-ancho">Nueva plantilla</span><span class="sr">Nueva plantilla</span></button>
      </header>
      <BandaDemo />
      {lista.cargando && !lista.datos ? <Siluetas forma="lista" n={3} texto="Cargando las plantillas" /> : !lista.datos?.length ? (
        <div class="panel"><Vacio icono="plantillas" titulo="Sin plantillas" accion={<button class="btn btn-primario" onClick={() => setNueva(true)}>Crear una</button>}>
          También puedes guardar como plantilla cualquier bloque desde la ficha de un atleta.
        </Vacio></div>
      ) : (
        <div class="panel"><ul class="lista">
          {lista.datos.map((p) => (
            <li key={p.id} class="fila-plantilla">
              <button class="dia" style="background:none;border-radius:0" onClick={() => setAbierta(p.id)}>
                <span class="marca-dia"><Icono n="plantillas" /></span>
                <span><span class="nombre">{p.nombre}</span><br /><span class="detalle">{p.foco ? NOMBRE_FOCO[p.foco] : 'Sin foco'}</span></span>
                <Icono n="derecha" width="20" height="20" />
              </button>
              <button class="btn btn-peq" onClick={() => setAsignar(p)} aria-label={`Asignar ${p.nombre} a atletas`}><Icono n="atletas" /><span class="oculto-estrecho">Asignar</span></button>
            </li>
          ))}
        </ul></div>
      )}
      {asignar && <AsignarPlantilla plantilla={asignar} alCerrar={() => setAsignar(null)} />}
      {nueva && <NuevaPlantilla alCerrar={async (datos) => {
        setNueva(false);
        if (!datos) return;
        try { const p = await api.nuevaPlantilla(datos); setAbierta(p.id); } catch (e) { aviso(e.message, 'error'); }
      }} />}
    </div>
  );
}

function NuevaPlantilla({ alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [semanas, setSemanas] = useState(4);
  const [sesiones, setSesiones] = useState(3);
  return (
    <Hoja titulo="Nueva plantilla" alCerrar={() => alCerrar(null)}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); alCerrar({ nombre: nombre.trim() || 'Plantilla', semanas, sesionesPorSemana: sesiones }); }}>
        <div class="campo"><label for="np-nombre">Nombre</label><input id="np-nombre" class="entrada" required value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} placeholder="Torso-pierna 4 días" /></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="np-sem">Semanas</label><Paso id="np-sem" valor={semanas} paso={1} min={1} max={16} dec={0} etiqueta="semanas" alCambiar={(v) => setSemanas(v || 1)} /></div>
          <div class="campo"><label for="np-ses">Sesiones por semana</label><Paso id="np-ses" valor={sesiones} paso={1} min={1} max={7} dec={0} etiqueta="sesiones" alCambiar={(v) => setSesiones(v || 1)} /></div>
        </div>
        <p class="peq secundario">Se crea la primera semana con sus sesiones vacías. Rellénala y usa «Duplicar con progresión» para el resto.</p>
        <button class="btn btn-primario btn-grande">Crear plantilla</button>
      </form>
    </Hoja>
  );
}

// Asignar una plantilla a varios atletas: un bloque en borrador para cada uno, empezando el mismo lunes
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function AsignarPlantilla({ plantilla, alCerrar }) {
  const { api, aviso } = useApp();
  const atletas = useCarga(() => api.atletas(), []);
  const [elegidos, setElegidos] = useState(() => new Set());
  const [fecha, setFecha] = useState(() => sumarDias(lunesDe(hoyISO()), 7));
  const [hechos, setHechos] = useState(null);   // nº creados mientras avanza
  const [resultado, setResultado] = useState(null);
  const lista = (atletas.datos || []).filter((a) => a.estado !== 'baja');
  const nombreDe = Object.fromEntries(lista.map((a) => [a.id, a.nombre]));
  const alternar = (id) => setElegidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const lunes = fecha && lunesDe(fecha) === fecha;
  const f = fecha ? desdeISO(fecha) : null;
  async function crear(e) {
    e.preventDefault();
    if (!elegidos.size || !lunes) return;
    setHechos(0);
    const r = await api.asignarPlantilla(plantilla.id, [...elegidos], fecha, setHechos);
    setResultado(r);
    const ok = r.filter((x) => x.ok).length;
    aviso(ok === r.length ? `${ok} ${ok === 1 ? 'bloque creado' : 'bloques creados'}` : `${ok} de ${r.length} creados`, ok === r.length ? undefined : 'error');
  }
  return (
    <Hoja titulo={`Asignar «${plantilla.nombre}»`} alCerrar={() => hechos === null || resultado ? alCerrar() : null}>
      {resultado ? (
        <div class="pila">
          <ul class="lista">
            {resultado.map((x) => (
              <li key={x.atleta_id} class={`panel-pad fila-resultado ${x.ok ? "" : "fallo"}`}>
                <Icono n={x.ok ? 'hecho' : 'alerta'} />
                <span class="pila-xs"><strong>{nombreDe[x.atleta_id] || 'Atleta'}</strong>
                  <span class="peq secundario">{x.ok ? `Bloque ${x.bloque.numero}: ${x.bloque.nombre}, en borrador` : x.error}</span></span>
              </li>
            ))}
          </ul>
          <p class="peq secundario">Cada bloque queda en borrador en la ficha de su atleta: ajústalo si hace falta y publica cada semana cuando esté lista.</p>
          <button class="btn btn-primario btn-grande" onClick={alCerrar}>Listo</button>
        </div>
      ) : (
        <form class="pila" onSubmit={crear}>
          {atletas.cargando && !atletas.datos ? <Cargando /> : (
            <fieldset class="pila-s elegir-atletas">
              <legend class="peq secundario">Atletas</legend>
              <div class="separa"><span class="mini terciario">{elegidos.size} de {lista.length}</span>
                <button type="button" class="btn-texto mini" onClick={() => setElegidos(elegidos.size === lista.length ? new Set() : new Set(lista.map((a) => a.id)))}>{elegidos.size === lista.length ? 'Ninguno' : 'Todos'}</button></div>
              <ul class="lista">
                {lista.map((a) => (
                  <li key={a.id}>
                    <label class="casilla fila-atleta-elegir">
                      <input type="checkbox" checked={elegidos.has(a.id)} onChange={() => alternar(a.id)} />
                      <span>{a.nombre}{a.estado === 'invitado' ? <span class="mini terciario"> (sin activar)</span> : a.estado === 'pausado' ? <span class="mini terciario"> (en pausa)</span> : ''}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <div class="campo">
            <label for="as-fecha">Empieza el lunes</label>
            <input id="as-fecha" class="entrada" type="date" required value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
            {fecha && !lunes && <span class="error-campo">Elige un lunes: las semanas van de lunes a domingo.</span>}
            {f && lunes && <span class="ayuda">Empieza el lunes {f.getDate()} de {MESES[f.getMonth()]}.</span>}
          </div>
          <button class="btn btn-primario btn-grande" disabled={!elegidos.size || !lunes || hechos !== null}>
            {hechos !== null ? `Creando ${hechos} de ${elegidos.size}…` : elegidos.size ? `Crear ${elegidos.size} ${elegidos.size === 1 ? 'bloque' : 'bloques'}` : 'Elige al menos un atleta'}
          </button>
        </form>
      )}
    </Hoja>
  );
}
