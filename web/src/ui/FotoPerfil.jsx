// Foto de perfil (v0.19): la elige cada uno (atleta o coach) desde su Perfil o Cuenta. El móvil la recorta en
// cuadrado, la reduce a 384 px (256 hasta la v0.25) y la comprime (JPEG) antes de guardarla en su perfil: pesa unos 15-30 KB.
import { useRef, useState } from 'preact/hooks';
import { useApp, Icono, Avatar } from './comunes.jsx';
import { FOTO_MAX } from '../datos/api.js';

const LADO = 384; // v0.25: más grande para poder ampliarla (antes 256; cabe igual en el límite de la base)

// Lee una imagen (JPEG, PNG, HEIC convertido por el móvil, WebP…) y la deja en un cuadrado de 256 px, centrado
export async function recortarFoto(archivo, { lado = LADO, max = FOTO_MAX } = {}) {
  if (!archivo || !/^image\//.test(archivo.type || '')) throw new Error('Elige una imagen (una foto de tu galería o de la cámara).');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se ha podido abrir esa imagen. Prueba con otra.'));
      i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('No se ha podido abrir esa imagen. Prueba con otra.');
    const c = Math.min(w, h);
    const lienzo = document.createElement('canvas');
    lienzo.width = lado; lienzo.height = lado;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lado, lado);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - c) / 2, (h - c) / 2, c, c, 0, 0, lado, lado);
    for (const q of [0.85, 0.78, 0.7, 0.6, 0.5, 0.4]) {
      const datos = lienzo.toDataURL('image/jpeg', q);
      if (datos.startsWith('data:image/jpeg;base64,') && datos.length <= max) return datos;
    }
    throw new Error('La foto pesa demasiado incluso comprimida. Prueba con otra.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// La fila de Perfil (atleta) y Cuenta (coach): la foto actual y «Cambiar» / «Quitar»
export function FilaFoto({ nombre, coach = false }) {
  const { api, perfil, fijarPerfil, aviso } = useApp();
  const input = useRef(null);
  const [guardando, setGuardando] = useState(false);
  const foto = perfil?.foto || null;

  async function guardar(nueva) {
    setGuardando(true);
    try {
      const p = await api.cambiarFoto(nueva);
      fijarPerfil?.({ ...perfil, ...(p || {}), foto: nueva });
      aviso(nueva ? 'Foto de perfil guardada' : 'Foto de perfil quitada');
    } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  }

  async function elegida(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try { await guardar(await recortarFoto(f)); } catch (err) { aviso(err.message, 'error'); }
  }

  return (
    <li class="panel-pad separa fila-foto">
      <div class="fila-foto-izq">
        <Avatar nombre={nombre} foto={foto} ampliable />
        <div><div>Foto de perfil</div><div class="peq terciario">{foto ? (coach ? 'La ven tus atletas' : 'La ve tu coach') : 'Ahora, tus iniciales'}</div></div>
      </div>
      <div class="fila-acciones">
        <input ref={input} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Foto de perfil nueva" onChange={elegida} />
        {foto && <button class="btn btn-peq plano" disabled={guardando} onClick={() => guardar(null)}>Quitar</button>}
        <button class="btn btn-peq" disabled={guardando} onClick={() => input.current?.click()}><Icono n="camara" /> {guardando ? 'Guardando…' : foto ? 'Cambiar' : 'Poner foto'}</button>
      </div>
    </li>
  );
}

// El nombre del coach: es el que ven los atletas en el chat y en las notificaciones («Pelayo te ha escrito»)
export function FilaNombre() {
  const { api, perfil, fijarPerfil, aviso } = useApp();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(perfil?.nombre || '');
  async function guardar(e) {
    e.preventDefault();
    try {
      const p = await api.cambiarNombre(valor);
      fijarPerfil?.({ ...perfil, ...(p || {}), nombre: valor.trim() });
      setEditando(false);
      aviso('Nombre guardado');
    } catch (err) { aviso(err.message, 'error'); }
  }
  if (editando) {
    return (
      <li class="panel-pad">
        <form class="pila-s" onSubmit={guardar}>
          <label class="campo"><span>Tu nombre</span>
            <input class="entrada" maxLength={60} required value={valor} onInput={(e) => setValor(e.currentTarget.value)} autoFocus />
          </label>
          <span class="peq terciario">Es el que ven tus atletas: «{(valor.trim().split(/\s+/)[0] || 'Pelayo')} te ha escrito».</span>
          <div class="fila-acciones"><button type="button" class="btn btn-peq plano" onClick={() => setEditando(false)}>Cancelar</button><button class="btn btn-peq btn-primario">Guardar</button></div>
        </form>
      </li>
    );
  }
  return (
    <li class="panel-pad separa">
      <div><div>{perfil?.nombre || 'Coach'} <span class="chip morado">Coach</span></div><div class="peq terciario">El nombre que ven tus atletas</div></div>
      <button class="btn btn-peq" onClick={() => { setValor(perfil?.nombre || ''); setEditando(true); }}>Cambiar</button>
    </li>
  );
}
