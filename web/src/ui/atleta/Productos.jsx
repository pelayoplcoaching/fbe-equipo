// Sumar un producto envasado a lo que se apunta del día (escáner): escanear su código de barras con la cámara,
// teclearlo o buscarlo por nombre; sus macros salen de Open Food Facts y se suman a los totales de la hoja con los
// gramos que se ha comido. No se guarda producto a producto: es una ayuda para apuntar el total, como la calculadora.
// Los últimos productos quedan en este móvil para volver a ponerlos sin escanear (y sin cobertura).
//   · SumarProducto: la vista dentro de «Apuntar la nutrición»
//   · Escaner: la cámara con su recuadro. Lee con el lector del navegador (BarcodeDetector, en Chrome y Android) y, si no
//     lo hay (Safari), con lector-codigos.js, que se carga aparte solo al abrirla. Sin cámara o sin permiso, se teclea.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono, Paso } from '../comunes.jsx';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { productoPorCodigo, buscarProductos } from '../../datos/productos.js';
import { codigoValido, limpiarCodigo, macrosDeCantidad, cantidadInicial, textoPor100, textoSumado, conReciente, recientesValidos, MAX_GRAMOS } from '../../logica/alimentos.js';

const claveRecientes = (id) => `fbe-productos-recientes:${id || 'yo'}`;

// alSumar({ nombre, gramos, unidad, m }): lo que suma (la hoja lo añade a los campos que se ven); alVolver: a los totales
export function SumarProducto({ alSumar, alVolver }) {
  const { backend, atleta } = useApp();
  const [vista, setVista] = useState('inicio'); // inicio | escanear | buscar | producto
  const [codigo, setCodigo] = useState('');
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [producto, setProducto] = useState(null);
  const [gramos, setGramos] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [recientes, setRecientes] = useState(() => recientesValidos(leerPreferencia(claveRecientes(atleta?.id), [])));

  const abrir = (p, g = null) => { setProducto(p); setGramos(g ?? cantidadInicial(p)); setVista('producto'); setError(null); };
  const porCodigo = async (c) => {
    const limpio = limpiarCodigo(c);
    setError(null);
    if (!codigoValido(limpio)) { setError('Ese código no es de un producto: revisa los números (8 o 13 cifras).'); return; }
    // (si ya lo ha usado, sin red)
    const ya = recientes.find((x) => x.codigo === limpio);
    if (ya) { abrir(ya, ya.ultima_g); return; }
    setOcupado(true);
    try {
      const p = await productoPorCodigo(backend, limpio);
      if (p) abrir(p);
      else { setVista('inicio'); setError(`El código ${limpio} no está en Open Food Facts (o no trae sus valores nutricionales). Prueba a buscarlo por nombre.`); }
    } catch (e) { setVista('inicio'); setError(e.message); }
    setOcupado(false);
  };
  const buscar = async (e) => {
    e?.preventDefault?.();
    if (texto.trim().length < 2) { setError('Escribe al menos dos letras.'); return; }
    setOcupado(true); setError(null);
    try { setResultados(await buscarProductos(backend, texto)); } catch (err) { setError(err.message); }
    setOcupado(false);
  };
  const m = producto ? macrosDeCantidad(producto, gramos) : null;
  const sumar = () => {
    if (!m) return;
    const lista = conReciente(recientes, producto, gramos);
    setRecientes(lista);
    guardarPreferencia(claveRecientes(atleta?.id), lista);
    alSumar({ nombre: producto.nombre, gramos, unidad: producto.unidad, m });
  };

  if (vista === 'escanear') {
    return <Escaner alLeer={(c) => { setCodigo(c); setVista('inicio'); porCodigo(c); }} alCancelar={(msg) => { setVista('inicio'); if (msg) setError(msg); }} />;
  }

  if (vista === 'producto' && producto) {
    const u = producto.unidad;
    const opciones = [
      producto.racion_g && [producto.racion_g, `1 ración (${producto.racion_g} ${u})`],
      [100, `100 ${u}`],
      producto.ultima_g && producto.ultima_g !== producto.racion_g && producto.ultima_g !== 100 && [producto.ultima_g, `Lo de la otra vez (${producto.ultima_g} ${u})`],
    ].filter(Boolean);
    return (
      <div class="producto-vista pila-s">
        <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setVista(resultados ? 'buscar' : 'inicio')}><Icono n="atras" /> Otro producto</button>
        <div class="producto-cab">
          {producto.imagen ? <img class="producto-foto" src={producto.imagen} alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer" /> : <span class="producto-foto producto-foto-vacia" aria-hidden="true"><Icono n="carrito" /></span>}
          <div class="pila-xs">
            <strong>{producto.nombre}</strong>
            {(producto.marca || producto.cantidad) && <span class="mini terciario">{[producto.marca, producto.cantidad].filter(Boolean).join(' · ')}</span>}
            <span class="mini secundario">{textoPor100(producto)}</span>
          </div>
        </div>
        <div class="campo">
          <label for="prod-gramos">¿Cuánto has tomado? ({u})</label>
          <Paso id="prod-gramos" valor={gramos} paso={u === 'ml' ? 25 : 10} min={1} max={MAX_GRAMOS} dec={0} etiqueta={u === 'ml' ? 'mililitros' : 'gramos'} alCambiar={setGramos} />
          <div class="fila-envolver producto-cantidades">
            {opciones.map(([g, t]) => <button key={t} type="button" class={`btn btn-peq ${Number(gramos) === g ? 'btn-primario' : 'plano'}`} aria-pressed={Number(gramos) === g ? 'true' : 'false'} onClick={() => setGramos(g)}>{t}</button>)}
          </div>
        </div>
        {m && <p class="peq" aria-live="polite">Suma <strong>{textoSumado(m, gramos, u)}</strong>{m.carbos_g != null ? ` · H ${String(m.carbos_g).replace('.', ',')} · G ${String(m.grasa_g ?? 0).replace('.', ',')}` : ''}</p>}
        <button type="button" class="btn btn-primario" disabled={!m} onClick={sumar}><Icono n="mas" /> Sumar a lo del día</button>
        <p class="mini terciario">Datos de <a href={`https://world.openfoodfacts.org/product/${producto.codigo}`} target="_blank" rel="noopener noreferrer">Open Food Facts</a>, una base abierta: revisa que cuadren con la etiqueta.</p>
      </div>
    );
  }

  if (vista === 'buscar') {
    return (
      <div class="pila-s">
        <button type="button" class="btn-texto" style="justify-self:start" onClick={() => { setVista('inicio'); setResultados(null); setError(null); }}><Icono n="atras" /> Volver</button>
        <form class="fila" onSubmit={buscar} role="search">
          <label class="sr" for="prod-buscar">Buscar un producto por su nombre</label>
          <input id="prod-buscar" class="entrada" type="search" enterkeyhint="search" maxLength={80} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Yogur griego, pan integral…" autoFocus />
          <button type="submit" class="btn" disabled={ocupado}><Icono n="buscar" /> Buscar</button>
        </form>
        {error && <div class="error" role="alert">{error}</div>}
        {ocupado && <p class="peq secundario" role="status">Buscando en Open Food Facts…</p>}
        {resultados && !ocupado && (resultados.length ? (
          <ul class="lista-productos" aria-label="Productos encontrados">
            {resultados.map((p, i) => <li key={p.codigo || i}><FilaProducto p={p} alTocar={() => abrir(p)} /></li>)}
          </ul>
        ) : <p class="peq secundario">No sale nada con ese nombre. Prueba con menos palabras o escanea el código.</p>)}
      </div>
    );
  }

  return (
    <div class="pila-s">
      <button type="button" class="btn-texto" style="justify-self:start" onClick={alVolver}><Icono n="atras" /> Volver a los totales</button>
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario" disabled={ocupado} onClick={() => { setError(null); setVista('escanear'); }}><Icono n="camara" /> Escanear el código</button>
        <button type="button" class="btn" disabled={ocupado} onClick={() => { setError(null); setVista('buscar'); }}><Icono n="buscar" /> Buscar por nombre</button>
      </div>
      <form class="fila" onSubmit={(e) => { e.preventDefault(); porCodigo(codigo); }}>
        <label class="sr" for="prod-codigo">Código de barras</label>
        <input id="prod-codigo" class="entrada" inputMode="numeric" autocomplete="off" maxLength={20} value={codigo} onInput={(e) => setCodigo(e.currentTarget.value)} placeholder="O escribe los números del código" />
        <button type="submit" class="btn" disabled={ocupado || limpiarCodigo(codigo).length < 8}>Ver</button>
      </form>
      {ocupado && <p class="peq secundario" role="status">Buscando el producto…</p>}
      {error && <div class="error" role="alert">{error}</div>}
      {recientes.length > 0 && (
        <section class="pila-xs" aria-labelledby="prod-recientes-t">
          <h3 class="etq" id="prod-recientes-t">Los últimos que has sumado</h3>
          <ul class="lista-productos">
            {recientes.map((p, i) => <li key={p.codigo || `${p.nombre}-${i}`}><FilaProducto p={p} alTocar={() => abrir(p, p.ultima_g)} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilaProducto({ p, alTocar }) {
  return (
    <button type="button" class="fila-producto" onClick={alTocar}>
      <span class="pila-xs">
        <span class="peq">{p.nombre}</span>
        <span class="mini terciario">{[p.marca, textoPor100(p)].filter(Boolean).join(' · ')}</span>
      </span>
      <Icono n="derecha" />
    </button>
  );
}

// ---------- La cámara ----------
const hayCamara = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
async function detectorNativo() {
  try {
    if (typeof globalThis.BarcodeDetector !== 'function') return null;
    const f = await globalThis.BarcodeDetector.getSupportedFormats?.();
    if (Array.isArray(f) && !f.includes('ean_13')) return null;
    return new globalThis.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
  } catch { return null; }
}

export function Escaner({ alLeer, alCancelar }) {
  const video = useRef(null);
  const [estado, setEstado] = useState('abriendo'); // abriendo | mirando
  useEffect(() => {
    if (!hayCamara()) { alCancelar('Este navegador no deja usar la cámara: escribe los números del código o búscalo por nombre.'); return undefined; }
    let flujo = null, vivo = true, temporizador = null, ocupado = false;
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    let leer = null;
    const parar = () => { vivo = false; clearTimeout(temporizador); flujo?.getTracks().forEach((t) => t.stop()); };
    const fin = (c) => { parar(); try { navigator.vibrate?.(40); } catch { /* sin vibración */ } alLeer(c); };
    const vuelta = async () => {
      if (!vivo) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !ocupado) {
        ocupado = true;
        try {
          const c = await leer(v);
          if (vivo && c && codigoValido(c)) { fin(c); return; }
        } catch { /* fotograma sin código */ }
        ocupado = false;
      }
      temporizador = setTimeout(vuelta, 160);
    };
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        if (!vivo) return;
        alCancelar(e?.name === 'NotAllowedError' ? 'Sin permiso para la cámara: escribe los números del código o búscalo por nombre. (Puedes darlo en los ajustes del móvil.)' : 'No se ha podido abrir la cámara: escribe los números del código o búscalo por nombre.');
        return;
      }
      if (!vivo) { flujo.getTracks().forEach((t) => t.stop()); return; }
      const nativo = await detectorNativo();
      if (nativo) {
        leer = async (v) => (await nativo.detect(v))?.[0]?.rawValue || null;
      } else {
        const { leerGris, grisDeRGBA } = await import('../../logica/lector-codigos.js');
        // la franja del centro (donde está el recuadro), a 800 px de ancho como mucho
        leer = (v) => {
          const vw = v.videoWidth, vh = v.videoHeight;
          if (!vw || !vh) return null;
          const sw = Math.round(vw * 0.86), sh = Math.round(vh * 0.4);
          const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
          const k = Math.min(1, 800 / sw);
          const w = Math.round(sw * k), h = Math.round(sh * k);
          if (lienzo.width !== w) lienzo.width = w;
          if (lienzo.height !== h) lienzo.height = h;
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
          return leerGris(grisDeRGBA(ctx.getImageData(0, 0, w, h).data, w, h), w, h);
        };
      }
      if (!vivo) return;
      const v = video.current;
      v.srcObject = flujo;
      try { await v.play(); } catch { /* el autoplay mudo suele bastar */ }
      setEstado('mirando');
      vuelta();
    })();
    return parar;
  }, []);
  return (
    <div class="escaner pila-s">
      <div class="escaner-visor">
        <video ref={video} playsInline muted autoPlay aria-label="Cámara para leer el código de barras" />
        <span class="escaner-recuadro" aria-hidden="true" />
      </div>
      <p class="peq secundario" role="status">{estado === 'abriendo' ? 'Abriendo la cámara…' : 'Pon el código de barras dentro del recuadro, en horizontal y con buena luz.'}</p>
      <button type="button" class="btn" onClick={() => alCancelar(null)}><Icono n="cerrar" /> Cancelar</button>
    </div>
  );
}
