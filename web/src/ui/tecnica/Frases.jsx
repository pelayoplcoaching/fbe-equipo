// v0.59 (4 y 6, migración 037): las frases de corrección del coach y la técnica de cada ejercicio en un solo sitio (sus
// puntos clave, sus frases y su vídeo modelo). En la corrección, cada frase es un botón: la pone en el comentario, con el
// momento del vídeo delante, y su dibujo (si lo lleva) en ese momento. Sin frases guardadas, salen unas sugeridas para
// los básicos (no están en la base hasta que las guardas: así las cambias o las borras como las tuyas).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Pestanas } from '../comunes.jsx';
import { frasesSugeridas, MAX_TEXTO_FRASE, limpiarTextoFrase } from '../../logica/correccion.js';
import { checklistSugerido, limpiarPlantilla, MAX_PUNTOS } from '../../logica/tecnica.js';
import { GestionModelos } from './Modelos.jsx';
import { fichaDeEjercicio } from '../../datos/guias.js';
import { frasesDeFicha } from '../../logica/guias.js';

// Los botones de las frases en el hilo del vídeo (el coach)
export function ChipsFrases({ ejercicio = null, alElegir }) {
  const { api, backend } = useApp();
  const con037 = useCarga(() => api.video037().catch(() => false), []);
  // (057) los errores típicos de su ficha, como frases de un toque (además de las suyas o de las sugeridas)
  const fbe = useCarga(() => (ejercicio?.id ? fichaDeEjercicio({ backend }, ejercicio.id).catch(() => null) : Promise.resolve(null)), [ejercicio?.id]);
  const lista = useCarga(() => (con037.datos ? api.frasesCorreccion(ejercicio?.id || null) : Promise.resolve([])), [ejercicio?.id, con037.datos]);
  const [gestionar, setGestionar] = useState(false);
  if (!con037.datos) return null;
  const guardadas = lista.datos || [];
  const sugeridas = !guardadas.length ? frasesSugeridas(ejercicio?.nombre || '', ejercicio?.grupos_musculares || [], ejercicio?.tipo || []).map((texto, i) => ({ id: `sug-${i}`, texto, dibujo: null, sugerida: true })) : [];
  const propias = guardadas.length ? guardadas : sugeridas;
  const deFicha = fbe.datos ? frasesDeFicha(fbe.datos.ficha, propias.map((f) => f.texto)).map((texto, i) => ({ id: `ficha-${i}`, texto, dibujo: null, deFicha: true })) : [];
  const frases = [...deFicha, ...propias];
  return (
    <div class="frases-chips" role="group" aria-label="Frases de corrección">
      {frases.map((f) => (
        <button key={f.id} type="button" class="chip-frase" onClick={() => alElegir(f)} aria-label={`Usar la frase: ${f.texto}${f.dibujo ? ' (con su dibujo)' : ''}${f.deFicha ? ' (error típico de tu ficha)' : ''}`} title={f.deFicha ? 'Error típico de tu ficha de este ejercicio' : undefined}>
          {f.dibujo && <Icono n="regla" />}{f.texto}
        </button>
      ))}
      {ejercicio?.id && <button type="button" class="btn-texto mini" onClick={() => setGestionar(true)} aria-haspopup="dialog"><Icono n="editar" /> {guardadas.length ? 'Tus frases' : 'Guardar y cambiar las frases'}</button>}
      {gestionar && <HojaTecnica ejercicio={ejercicio} inicial="frases" alCerrar={() => { setGestionar(false); lista.recargar(true); }} />}
    </div>
  );
}

// La técnica de un ejercicio: puntos clave (035), frases y vídeo modelo (037)
export function HojaTecnica({ ejercicio, inicial = 'puntos', puntos = null, alGuardarPuntos = null, alCerrar }) {
  const [vista, setVista] = useState(inicial);
  const pestanas = [['puntos', 'Puntos clave'], ['frases', 'Frases'], ['modelo', 'Vídeo modelo']];
  return (
    <Hoja titulo={`Técnica de ${ejercicio.nombre}`} alCerrar={alCerrar} ancho={720}>
      <Pestanas opciones={pestanas} valor={vista} alCambiar={setVista} etiqueta="Técnica del ejercicio" idBase="tec" />
      <div class="pestana-panel pila-s" role="tabpanel" id="tec-panel" aria-labelledby={`tec-${vista}`} key={vista}>
        {vista === 'puntos' ? <ListaPuntos ejercicio={ejercicio} puntos={puntos} alGuardar={alGuardarPuntos} />
          : vista === 'frases' ? <GestionFrases ejercicio={ejercicio} />
            : <GestionModelos ejercicio={ejercicio} />}
      </div>
    </Hoja>
  );
}

// La lista de puntos clave del coach para el ejercicio (como en la v0.57): una línea por punto, hasta 15
function ListaPuntos({ ejercicio, puntos = null, alGuardar }) {
  const { api, aviso } = useApp();
  const guardada = useCarga(() => (puntos ? Promise.resolve(puntos) : api.plantillaTecnica(ejercicio.id).catch(() => null)), [ejercicio.id]);
  const base = puntos || guardada.datos || checklistSugerido(ejercicio.nombre, ejercicio.grupos_musculares || [], ejercicio.tipo || []);
  const [texto, setTexto] = useState(null);
  const valor = texto ?? base.join('\n');
  const [ocupado, setOcupado] = useState(false);
  const lista = limpiarPlantilla(valor.split('\n'));
  return (
    <>
      <div class="campo">
        <label for="lista-puntos">Un punto por línea (hasta {MAX_PUNTOS})</label>
        <textarea id="lista-puntos" class="area" rows={8} value={valor} onInput={(e) => setTexto(e.currentTarget.value)} />
        <span class="ayuda">{lista.length} {lista.length === 1 ? 'punto' : 'puntos'}. Se usa en los vídeos de {ejercicio.nombre} de todos tus atletas (no la ven ellos: ven lo que marques en cada vídeo).</span>
      </div>
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario" disabled={ocupado || !lista.length} onClick={async () => {
          setOcupado(true);
          try { const ps = await api.guardarPlantillaTecnica(ejercicio.id, lista); aviso('Lista guardada'); alGuardar?.(ps); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
        }}>Guardar la lista</button>
        <button type="button" class="btn" onClick={() => setTexto(checklistSugerido(ejercicio.nombre, ejercicio.grupos_musculares || [], ejercicio.tipo || []).join('\n'))}>Usar los sugeridos</button>
      </div>
    </>
  );
}

// Las frases: las de este ejercicio y las de todos. Cambiar el texto, quitar el dibujo, borrar y añadir.
function GestionFrases({ ejercicio }) {
  const { api, aviso } = useApp();
  const con037 = useCarga(() => api.video037().catch(() => false), []);
  const lista = useCarga(() => (con037.datos ? api.frasesCorreccion(ejercicio.id) : Promise.resolve([])), [ejercicio.id, con037.datos]);
  const [nueva, setNueva] = useState('');
  const [paraTodos, setParaTodos] = useState(false);
  const [editando, setEditando] = useState({}); // id → texto
  const [ocupado, setOcupado] = useState(false);
  if (con037.cargando) return null;
  if (con037.datos === false) return <p class="peq secundario">Las frases de corrección: disponible tras la migración 037.</p>;
  const frases = lista.datos || [];
  const hacer = async (fn, ok) => {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); if (ok) aviso(ok); await lista.recargar(true); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const sugeridas = frasesSugeridas(ejercicio.nombre, ejercicio.grupos_musculares || [], ejercicio.tipo || []);
  return (
    <div class="pila-s gestion-frases">
      {!frases.length ? (
        <div class="pila-s">
          <p class="peq secundario">Aún no tienes frases para {ejercicio.nombre}. Estas son las sugeridas (salen como botones en la corrección hasta que guardes las tuyas):</p>
          <ul class="lista-frases-sugeridas">{sugeridas.map((t) => <li key={t} class="peq">{t}</li>)}</ul>
          <button type="button" class="btn" style="justify-self:start" disabled={ocupado} onClick={() => hacer(() => api.guardarFrasesSugeridas(ejercicio), 'Frases guardadas: cámbialas o bórralas a tu gusto')}><Icono n="mas" /> Guardarlas para cambiarlas</button>
        </div>
      ) : (
        <ul class="lista-frases">
          {frases.map((f) => (
            <li key={f.id} class="frase-fila">
              <input class="entrada" aria-label={`Frase: ${f.texto}`} maxLength={MAX_TEXTO_FRASE} value={editando[f.id] ?? f.texto} onInput={(e) => setEditando({ ...editando, [f.id]: e.currentTarget.value })} />
              <span class="fila-envolver">
                <span class="mini terciario">{f.ejercicio_id ? ejercicio.nombre : 'Todos los ejercicios'}{f.dibujo ? ' · con dibujo' : ''}</span>
                {editando[f.id] != null && editando[f.id] !== f.texto && <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || !editando[f.id].trim()} onClick={() => hacer(async () => { await api.guardarFrase({ id: f.id, ejercicioId: f.ejercicio_id, texto: editando[f.id], dibujo: f.dibujo, orden: f.orden }); setEditando({ ...editando, [f.id]: undefined }); }, 'Frase cambiada')}>Guardar</button>}
                {f.dibujo && <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => hacer(() => api.guardarFrase({ id: f.id, ejercicioId: f.ejercicio_id, texto: f.texto, dibujo: null, orden: f.orden }), 'Dibujo quitado de la frase')}>Quitar el dibujo</button>}
                <button type="button" class="btn btn-icono plano btn-peligro" aria-label={`Borrar «${f.texto}»`} disabled={ocupado} onClick={() => hacer(() => api.borrarFrase(f.id), 'Frase borrada')}><Icono n="basura" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div class="campo">
        <label for="frase-nueva">Nueva frase (hasta {MAX_TEXTO_FRASE} letras)</label>
        <div class="fila" style="gap:8px">
          <input id="frase-nueva" class="entrada" maxLength={MAX_TEXTO_FRASE} value={nueva} onInput={(e) => setNueva(e.currentTarget.value)} placeholder="Por ejemplo: aprieta el abdomen antes de bajar" />
          <button type="button" class="btn btn-primario" disabled={ocupado || !limpiarTextoFrase(nueva)} onClick={() => hacer(async () => { await api.guardarFrase({ ejercicioId: paraTodos ? null : ejercicio.id, texto: nueva, orden: frases.length }); setNueva(''); }, 'Frase añadida')}>Añadir</button>
        </div>
        <label class="casilla mini"><input type="checkbox" checked={paraTodos} onChange={(e) => setParaTodos(e.currentTarget.checked)} /><span>Para todos los ejercicios</span></label>
        <span class="ayuda">Para guardar una con dibujo: en la corrección, dibuja sobre el vídeo, escribe la frase y toca «Guardar como frase».</span>
      </div>
    </div>
  );
}
