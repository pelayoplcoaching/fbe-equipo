import { useState } from 'preact/hooks';
import { Hoja, Icono, useApp, useCarga, Cargando, useUnaVez } from '../comunes.jsx';
import { HojaNuevaTarea } from '../Tareas.jsx';
import { textoParaGuardar } from '../../logica/cierre.js';
import { normalLetras } from '../../logica/mensajes.js';

// (054) «Guardar como…»: lo que el atleta cuenta en el chat, a donde el coach lo busca luego. Los mensajes elegidos
// (en orden) se convierten en una nota de la ficha, en una tarea o en un recordatorio técnico de un ejercicio.
export function HojaConvertir({ mensajes, atleta, alCerrar, alHecho }) {
  const { api, aviso } = useApp();
  const [modo, setModo] = useState(null);   // null | 'nota' | 'tarea' | 'recordatorio'
  const [texto, setTexto] = useState(() => textoParaGuardar(mensajes));
  const [ocupado, una] = useUnaVez();
  const nombre = (atleta?.nombre || 'el atleta').split(' ')[0];

  if (modo === 'tarea') {
    const lineas = texto.split('\n').map((x) => x.trim()).filter(Boolean);
    const titulo = (lineas[0] || '').slice(0, 80);
    const detalle = lineas.length > 1 ? lineas.slice(1).join('\n') : '';
    return <HojaNuevaTarea atleta={atleta} inicial={{ tipo: 'texto', titulo, detalle }} alCerrar={(hecho) => (hecho ? alHecho?.('tarea') : setModo(null))} />;
  }
  if (modo === 'recordatorio') return <ElegirEjercicio atleta={atleta} texto={texto} alAtras={() => setModo(null)} alHecho={() => alHecho?.('recordatorio')} alCerrar={alCerrar} />;

  const guardarNota = () => una(async () => {
    try {
      await api.crearNota(atleta.id, texto.trim());
      aviso(`Guardado como nota en la ficha de ${nombre}`);
      alHecho?.('nota');
    } catch (e) { aviso(e.message, 'error'); }
  });

  return (
    <Hoja titulo="Guardar como…" alCerrar={alCerrar} ancho={560}>
      <div class="pila">
        <div class="campo">
          <label for="conv-texto">Lo que se guarda</label>
          <textarea id="conv-texto" class="area" rows={Math.min(8, Math.max(3, texto.split('\n').length + 1))} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
          <span class="ayuda">{mensajes.length === 1 ? 'El mensaje elegido' : `Los ${mensajes.length} mensajes elegidos, en orden`}. Puedes recortarlo antes de guardar.</span>
        </div>
        {modo === 'nota' ? (
          <div class="fila-envolver">
            <button type="button" class="btn" onClick={() => setModo(null)}><Icono n="atras" /> Atrás</button>
            <button type="button" class="btn btn-primario" disabled={ocupado || !texto.trim()} onClick={guardarNota}><Icono n="guardar" /> Guardar la nota</button>
          </div>
        ) : (
          <ul class="lista convertir-opciones" aria-label="Dónde guardarlo">
            <li><button type="button" class="convertir-opcion" disabled={!texto.trim()} onClick={() => setModo('nota')}>
              <Icono n="documento" /><span class="pila-xs"><strong>Nota en su ficha</strong><span class="peq secundario">Lo verás en Seguimiento, con la fecha de hoy.</span></span><Icono n="derecha" /></button></li>
            <li><button type="button" class="convertir-opcion" disabled={!texto.trim()} onClick={() => setModo('tarea')}>
              <Icono n="hecho" /><span class="pila-xs"><strong>Tarea para {nombre}</strong><span class="peq secundario">La primera línea como título; le sale en «Tu día».</span></span><Icono n="derecha" /></button></li>
            <li><button type="button" class="convertir-opcion" disabled={!texto.trim()} onClick={() => setModo('recordatorio')}>
              <Icono n="chincheta" /><span class="pila-xs"><strong>Recordatorio técnico</strong><span class="peq secundario">Pegado a un ejercicio: lo ve cada vez que lo entrena.</span></span><Icono n="derecha" /></button></li>
          </ul>
        )}
      </div>
    </Hoja>
  );
}

// El ejercicio al que va el recordatorio: primero los que tiene pautados estas semanas, luego toda la biblioteca
function ElegirEjercicio({ atleta, texto, alAtras, alHecho, alCerrar }) {
  const { api, aviso } = useApp();
  const biblioteca = useCarga(() => api.biblioteca().catch(() => []), []);
  const [q, setQ] = useState('');
  const [ocupado, una] = useUnaVez();
  const nq = normalLetras(q.trim());
  const lista = (biblioteca.datos || []).filter((e) => !nq || normalLetras(e.nombre).includes(nq)).slice(0, 40);
  const fijar = (e) => una(async () => {
    try {
      await api.fijarRecordatorio({ atletaId: atleta.id, ejercicioId: e.id, texto });
      aviso(`Recordatorio fijado en ${e.nombre}`);
      alHecho?.();
    } catch (err) { aviso(err.message, 'error'); }
  });
  return (
    <Hoja titulo="¿En qué ejercicio?" alCerrar={alCerrar} ancho={560}>
      <div class="pila">
        <p class="peq secundario">«{texto.length > 120 ? `${texto.slice(0, 118)}…` : texto}»</p>
        <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
        {biblioteca.cargando && !biblioteca.datos ? <Cargando texto="Cargando la biblioteca" /> : (
          <ul class="lista">
            {lista.map((e) => <li key={e.id}><button type="button" class="fila-boton" disabled={ocupado} onClick={() => fijar(e)}><span>{e.nombre}</span><Icono n="chincheta" /></button></li>)}
            {!lista.length && <li class="panel-pad peq secundario">Ningún ejercicio con ese nombre.</li>}
          </ul>
        )}
        <button type="button" class="btn" style="justify-self:start" onClick={alAtras}><Icono n="atras" /> Atrás</button>
      </div>
    </Hoja>
  );
}
