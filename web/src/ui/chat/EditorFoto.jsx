import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono } from '../comunes.jsx';
import { abrirImagen, lienzoABlob } from '../fotos.js';
import { girar, medidasGiradas, recorteValido, moverBorde, COLORES_EDITOR, medidaReducida, opcionesFoto, nombreJpg } from '../../logica/imagen.js';

// El editor de una foto antes de enviarla (v0.56), como WhatsApp: recortar, girar, dibujar y poner texto. Todo en el
// móvil, en un lienzo (sale en JPEG, sin los datos EXIF). Con el teclado: los bordes del recorte con sus deslizadores, el
// texto con su cuadro y las flechas para moverlo; dibujar es con el dedo, el lápiz o el ratón. A 360 px cabe entero.
// alListo(File) devuelve la foto editada; alCerrar, sin cambios.
const HERRAMIENTAS = [['recortar', 'recortar', 'Recortar'], ['dibujar', 'editar', 'Dibujar'], ['texto', 'texto', 'Texto']];

export function EditorFoto({ archivo, hd = false, alListo, alCerrar }) {
  const lienzo = useRef(null);
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  const [rot, setRot] = useState(0);
  const [recorte, setRecorte] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [trazos, setTrazos] = useState([]);       // [{ color, puntos: [[x, y]] }] en proporciones de la foto girada
  const [textos, setTextos] = useState([]);       // [{ t, x, y, color, tam }]
  const [herr, setHerr] = useState('recortar');
  const [color, setColor] = useState(COLORES_EDITOR[2][0]);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [elegido, setElegido] = useState(null);   // el texto que se mueve con las flechas
  const [guardando, setGuardando] = useState(false);
  const dibujo = useRef(null);
  const historial = useRef([]);
  useEffect(() => { let vivo = true; abrirImagen(archivo).then((i) => vivo && setImg(i)).catch(() => vivo && setError('Esta foto no se puede editar aquí: envíala tal cual.')); return () => { vivo = false; }; }, [archivo]);
  const dims = img ? medidasGiradas(img.width || img.naturalWidth, img.height || img.naturalHeight, rot) : { ancho: 4, alto: 3 };
  const apuntar = () => { historial.current.push({ rot, recorte, trazos, textos }); if (historial.current.length > 40) historial.current.shift(); };
  const deshacer = () => { const h = historial.current.pop(); if (!h) return; setRot(h.rot); setRecorte(h.recorte); setTrazos(h.trazos); setTextos(h.textos); };

  // Pinta la foto girada, lo dibujado, los textos y (al recortar) oscurece lo que se queda fuera
  function pintar(c, ancho, alto, { conRecorte = true } = {}) {
    const x = c.getContext('2d');
    x.save();
    x.clearRect(0, 0, ancho, alto);
    x.translate(ancho / 2, alto / 2);
    x.rotate((rot * Math.PI) / 180);
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    const k = rot % 180 === 0 ? ancho / w0 : ancho / h0;
    x.drawImage(img, (-w0 * k) / 2, (-h0 * k) / 2, w0 * k, h0 * k);
    x.restore();
    const lado = Math.max(ancho, alto);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const t of trazos) {
      x.strokeStyle = t.color; x.lineWidth = Math.max(2, lado * 0.008);
      x.beginPath();
      t.puntos.forEach(([px, py], i) => (i ? x.lineTo(px * ancho, py * alto) : x.moveTo(px * ancho, py * alto)));
      x.stroke();
    }
    for (const t of textos) {
      x.font = `700 ${Math.round(lado * t.tam)}px system-ui, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = Math.max(2, lado * t.tam * 0.12); x.strokeStyle = t.color === '#111111' ? '#FFFFFF' : '#000000';
      x.strokeText(t.t, t.x * ancho, t.y * alto);
      x.fillStyle = t.color;
      x.fillText(t.t, t.x * ancho, t.y * alto);
    }
    if (conRecorte && herr === 'recortar') {
      const r = recorteValido(recorte);
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.fillRect(0, 0, ancho, r.y * alto);
      x.fillRect(0, (r.y + r.h) * alto, ancho, (1 - r.y - r.h) * alto);
      x.fillRect(0, r.y * alto, r.x * ancho, r.h * alto);
      x.fillRect((r.x + r.w) * ancho, r.y * alto, (1 - r.x - r.w) * ancho, r.h * alto);
      x.strokeStyle = '#FFFFFF'; x.lineWidth = 2;
      x.strokeRect(r.x * ancho, r.y * alto, r.w * ancho, r.h * alto);
    }
  }
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img) return;
    const { ancho, alto } = medidaReducida(dims.ancho, dims.alto, 1200);
    c.width = ancho; c.height = alto;
    pintar(c, ancho, alto);
  }, [img, rot, recorte, trazos, textos, herr]);

  const punto = (e) => { const r = lienzo.current.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const abajo = (e) => {
    e.stopPropagation();
    if (herr === 'dibujar') { apuntar(); dibujo.current = { color, puntos: [punto(e)] }; setTrazos((t) => [...t, dibujo.current]); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } }
    else if (herr === 'texto' && elegido != null) { const [px, py] = punto(e); setTextos((ts) => ts.map((t, i) => (i === elegido ? { ...t, x: px, y: py } : t))); }
  };
  const mover = (e) => {
    if (!dibujo.current) return;
    dibujo.current.puntos.push(punto(e));
    setTrazos((t) => [...t.slice(0, -1), { ...dibujo.current }]);
  };
  const arriba = () => { dibujo.current = null; };
  const ponerTexto = () => {
    const t = nuevoTexto.trim().slice(0, 80);
    if (!t) return;
    apuntar();
    setTextos((ts) => [...ts, { t, x: 0.5, y: 0.5, color, tam: 0.06 }]);
    setElegido(textos.length);
    setNuevoTexto('');
  };
  const teclaTexto = (e) => {
    if (elegido == null) return;
    const paso = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!d) return;
    e.preventDefault();
    setTextos((ts) => ts.map((t, i) => (i === elegido ? { ...t, x: Math.max(0, Math.min(1, t.x + d[0])), y: Math.max(0, Math.min(1, t.y + d[1])) } : t)));
  };
  async function listo() {
    if (!img) return;
    setGuardando(true);
    try {
      const { lado, calidad } = opcionesFoto(hd);
      const { ancho, alto } = medidaReducida(dims.ancho, dims.alto, Math.round(lado / recorteValido(recorte).w));
      const todo = document.createElement('canvas');
      todo.width = ancho; todo.height = alto;
      pintar(todo, ancho, alto, { conRecorte: false });
      const r = recorteValido(recorte);
      const sal = document.createElement('canvas');
      const sw = Math.max(1, Math.round(r.w * ancho)), sh = Math.max(1, Math.round(r.h * alto));
      const fin = medidaReducida(sw, sh, lado);
      sal.width = fin.ancho; sal.height = fin.alto;
      const sx = sal.getContext('2d');
      sx.fillStyle = '#FFFFFF'; sx.fillRect(0, 0, fin.ancho, fin.alto);
      sx.drawImage(todo, Math.round(r.x * ancho), Math.round(r.y * alto), sw, sh, 0, 0, fin.ancho, fin.alto);
      const blob = await lienzoABlob(sal, 'image/jpeg', calidad);
      alListo(new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg' }));
    } catch { setError('No se ha podido guardar: envíala tal cual o vuelve a probar.'); } finally { setGuardando(false); }
  }
  const borde = (lado, valor) => {
    const r = recorteValido(recorte);
    const actual = { izq: r.x, der: r.x + r.w, arr: r.y, aba: r.y + r.h }[lado];
    setRecorte(moverBorde(r, lado, valor / 100 - actual));
  };
  const r = recorteValido(recorte);
  return (
    <Hoja titulo="Editar la foto" alCerrar={alCerrar} ancho={760} clase="hoja-editor">
      {error ? <p class="nota-coach" role="alert"><Icono n="alerta" /><span>{error}</span></p> : null}
      <div class="editor-foto">
        <div class="editor-lienzo" onPointerDown={(e) => e.stopPropagation()}>
          {img ? <canvas ref={lienzo} class={`editor-canvas herr-${herr}`} role="img" aria-label={`Vista previa de la foto${trazos.length ? `, con ${trazos.length} ${trazos.length === 1 ? 'trazo' : 'trazos'}` : ''}${textos.length ? `, con texto: ${textos.map((t) => t.t).join(', ')}` : ''}`}
            onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={arriba} style={{ touchAction: herr === 'dibujar' || (herr === 'texto' && elegido != null) ? 'none' : 'auto' }} />
            : !error && <p class="peq secundario">Abriendo la foto…</p>}
        </div>
        <div class="editor-barra" role="toolbar" aria-label="Herramientas del editor">
          {HERRAMIENTAS.map(([k, ico, t]) => (
            <button key={k} type="button" class={`btn btn-peq ${herr === k ? 'activo' : ''}`} aria-pressed={herr === k ? 'true' : 'false'} onClick={() => setHerr(k)}><Icono n={ico} /> {t}</button>
          ))}
          <button type="button" class="btn btn-peq" onClick={() => { apuntar(); setRot((x) => girar(x)); setRecorte({ x: 0, y: 0, w: 1, h: 1 }); }} aria-label="Girar 90 grados"><Icono n="girar" /> Girar</button>
          <button type="button" class="btn btn-peq" onClick={deshacer} disabled={!historial.current.length} aria-label="Deshacer"><Icono n="deshacer" /></button>
        </div>
        {herr === 'recortar' && (
          <fieldset class="editor-recorte">
            <legend class="peq">Recorte (en % de la foto)</legend>
            {[['izq', 'Borde izquierdo', r.x], ['der', 'Borde derecho', r.x + r.w], ['arr', 'Borde de arriba', r.y], ['aba', 'Borde de abajo', r.y + r.h]].map(([k, t, v]) => (
              <label key={k} class="editor-deslizador"><span class="mini">{t}</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(v * 100)} onInput={(e) => borde(k, Number(e.currentTarget.value))} onPointerDown={apuntar} onKeyDown={(e) => { if (!e.repeat) apuntar(); }} /></label>
            ))}
            <button type="button" class="btn btn-peq" onClick={() => { apuntar(); setRecorte({ x: 0, y: 0, w: 1, h: 1 }); }}>Sin recortar</button>
          </fieldset>
        )}
        {(herr === 'dibujar' || herr === 'texto') && (
          <div class="editor-colores" role="radiogroup" aria-label="Color">
            {COLORES_EDITOR.map(([hex, nombre]) => (
              <button key={hex} type="button" role="radio" aria-checked={color === hex ? 'true' : 'false'} aria-label={nombre} class="editor-color" style={{ background: hex }} onClick={() => setColor(hex)} />
            ))}
          </div>
        )}
        {herr === 'dibujar' && <p class="mini secundario">Dibuja con el dedo, el lápiz o el ratón sobre la foto.</p>}
        {herr === 'texto' && (
          <div class="pila-xs">
            <div class="fila editor-texto">
              <input class="entrada" maxLength={80} placeholder="Escribe el texto…" aria-label="Texto para la foto" value={nuevoTexto} onInput={(e) => setNuevoTexto(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ponerTexto(); } }} />
              <button type="button" class="btn btn-peq" onClick={ponerTexto} disabled={!nuevoTexto.trim()}><Icono n="mas" /> Poner</button>
            </div>
            {textos.length > 0 && (
              <div class="fila-envolver" role="group" aria-label="Textos de la foto">
                {textos.map((t, i) => (
                  <span key={i} class="fila editor-chip">
                    <button type="button" class={`btn btn-peq ${elegido === i ? 'activo' : ''}`} aria-pressed={elegido === i ? 'true' : 'false'} onClick={() => setElegido(elegido === i ? null : i)} onKeyDown={teclaTexto}
                      aria-label={`«${t.t}»: ${elegido === i ? 'muévelo con las flechas o tocando la foto' : 'elegir para moverlo'}`}>«{t.t.slice(0, 16)}»</button>
                    <button type="button" class="btn btn-icono plano" aria-label={`Quitar «${t.t}»`} onClick={() => { apuntar(); setTextos((ts) => ts.filter((_, j) => j !== i)); setElegido(null); }}><Icono n="cerrar" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div class="fila-envolver hoja-pie-fijo">
          <button type="button" class="btn btn-primario" disabled={!img || guardando} onClick={listo}><Icono n="hecho" /> {guardando ? 'Guardando…' : 'Listo'}</button>
          <button type="button" class="btn plano" onClick={alCerrar}>Cancelar</button>
        </div>
      </div>
    </Hoja>
  );
}
