import { useEffect, useState } from 'preact/hooks';
import { LOBO } from './marca-lobo.js';
import { useApp, Hoja, Icono, Cargando, descargar, P } from './comunes.jsx';
import { num } from '../logica/calculos.js';

// Tarjeta de la sesión para compartir (Instagram, WhatsApp…): 1080 × 1350, sin datos de salud.
// d: { nombre, subtitulo, fecha (ISO), series, tonelaje (kg), minutos, records: [{ nombre, texto }], mejores: [{ nombre, serie }] }
// Opcionales (para el informe del bloque): etiquetaFecha, cifras [[valor, etiqueta] × 3], tituloMejores

const W = 1080, H = 1350, M = 80;
const C = {
  fondo: '#13111C', disco: '#221D3F', discoBorde: '#2E2757', tinta: '#EDEBF7', tinta2: '#ADA8C4', tinta3: '#7D7996',
  morado: '#A08CFF', linea: '#2F2B43', rojo: '#F0495C', azul: '#5B8FF2', amarillo: '#F2C230', verde: '#3DC27B',
};
const FUENTE = '"Archivo Variable", "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]}, ${d} de ${MESES[m - 1]}`;
}

export async function dibujarTarjeta(d) {
  try {
    await Promise.all([document.fonts.load(`800 100px ${FUENTE}`), document.fonts.load(`600 36px ${FUENTE}`), document.fonts.load(`500 30px ${FUENTE}`)]);
  } catch { /* sin la fuente se usa la del sistema */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const letra = (peso, tam, ancho = 'normal') => {
    x.font = `${peso} ${tam}px ${FUENTE}`;
    try { x.fontStretch = ancho; } catch { /* navegadores sin fontStretch */ }
  };
  const cortar = (t, ancho) => {
    if (x.measureText(t).width <= ancho) return t;
    let s = t;
    while (s.length > 1 && x.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const lineas = (t, ancho, max) => {
    const palabras = t.split(/\s+/);
    const out = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (x.measureText(prueba).width <= ancho || !actual) actual = prueba;
      else { out.push(actual); actual = p; }
    }
    if (actual) out.push(actual);
    if (out.length > max) { out.length = max; out[max - 1] = cortar(`${out[max - 1]} …`, ancho); }
    return out;
  };
  const icono = (n, cx, cy, tam, color) => {
    x.save();
    x.translate(cx - tam / 2, cy - tam / 2);
    x.scale(tam / 24, tam / 24);
    x.strokeStyle = color; x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D(P[n]));
    x.restore();
  };

  // Fondo con un disco grande, como el de la marca
  x.fillStyle = C.fondo; x.fillRect(0, 0, W, H);
  const dx = W - 150, dy = H + 40;
  x.fillStyle = C.disco; x.beginPath(); x.arc(dx, dy, 520, 0, Math.PI * 2); x.fill();
  x.strokeStyle = C.discoBorde; x.lineWidth = 3;
  for (const r of [440, 330]) { x.beginPath(); x.arc(dx, dy, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = C.fondo; x.beginPath(); x.arc(dx, dy, 110, 0, Math.PI * 2); x.fill();
  x.fillStyle = C.disco; x.beginPath(); x.arc(dx, dy, 40, 0, Math.PI * 2); x.fill();

  // Marca y fecha
  // El lobo de la app (si la imagen no carga, el disco de siempre)
  const lobo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = LOBO; });
  if (lobo) x.drawImage(lobo, M, M, 56, 56);
  else {
    x.fillStyle = C.morado; x.beginPath(); x.arc(M + 28, M + 28, 28, 0, Math.PI * 2); x.fill();
    x.fillStyle = C.fondo; x.beginPath(); x.arc(M + 28, M + 28, 11, 0, Math.PI * 2); x.fill();
    x.fillStyle = C.morado; x.beginPath(); x.arc(M + 28, M + 28, 4, 0, Math.PI * 2); x.fill();
  }
  letra(800, 34, 'expanded'); x.fillStyle = C.tinta; x.textBaseline = 'alphabetic';
  x.fillText('FBE Equipo', M + 74, M + 40);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right';
  x.fillText(d.etiquetaFecha || fechaLarga(d.fecha), W - M, M + 40);
  x.textAlign = 'left';

  // Nombre de la sesión
  let y = 290;
  letra(800, 118, 'semi-expanded'); x.fillStyle = C.tinta;
  for (const l of lineas(d.nombre, W - 2 * M, 2)) { x.fillText(l, M - 4, y); y += 120; }
  y -= 54;
  if (d.subtitulo) { letra(650, 40); x.fillStyle = C.morado; x.fillText(d.subtitulo, M, y); }

  // Cifras
  y += 140;
  const cifras = d.cifras || [[String(d.series), d.series === 1 ? 'serie' : 'series'], [num(d.tonelaje / 1000, 1), 'toneladas'], [d.minutos ? String(d.minutos) : '—', 'minutos']];
  cifras.forEach(([v, k], i) => {
    const cx = M + i * ((W - 2 * M) / 3);
    letra(800, 104, 'semi-expanded'); x.fillStyle = C.tinta; x.fillText(v, cx, y);
    letra(500, 30); x.fillStyle = C.tinta2; x.fillText(k, cx + 2, y + 46);
  });
  y += 100;
  x.fillStyle = C.linea; x.fillRect(M, y, W - 2 * M, 2);
  y += 70;

  const limite = H - 190;
  // Récords
  if (d.records.length) {
    icono('trofeo', M + 18, y - 12, 36, C.morado);
    letra(700, 34); x.fillStyle = C.morado;
    x.fillText(d.records.length === 1 ? 'Récord' : `${d.records.length} récords`, M + 50, y);
    y += 64;
    for (const r of d.records.slice(0, 3)) {
      if (y + 40 > limite) break;
      letra(700, 40); x.fillStyle = C.tinta; x.fillText(cortar(r.nombre, W - 2 * M), M, y);
      letra(500, 31); x.fillStyle = C.tinta2; x.fillText(cortar(r.texto, W - 2 * M), M, y + 44);
      y += 104;
    }
    y += 6;
  }
  // Mejor serie de cada ejercicio
  const mejores = d.mejores.filter((m) => !d.records.some((r) => r.nombre === m.nombre));
  if (mejores.length && y + 110 < limite) {
    letra(700, 34); x.fillStyle = C.tinta2; x.fillText(d.tituloMejores || 'Mejores series', M, y);
    y += 62;
    let mostradas = 0;
    for (const m of mejores) {
      if (y > limite) break;
      letra(700, 38, 'semi-expanded'); x.textAlign = 'right'; x.fillStyle = C.tinta;
      x.fillText(m.serie, W - M, y);
      const anchoSerie = x.measureText(m.serie).width;
      x.textAlign = 'left';
      letra(500, 36); x.fillStyle = C.tinta; x.fillText(cortar(m.nombre, W - 2 * M - anchoSerie - 40), M, y);
      y += 58; mostradas++;
    }
    if (mostradas < mejores.length) { letra(500, 30); x.fillStyle = C.tinta3; x.fillText(`y ${mejores.length - mostradas} más`, M, y); }
  }

  // Pie: los colores de los discos y la firma
  const anchoBarra = (W - 2 * M - 3 * 14) / 4;
  [C.rojo, C.azul, C.amarillo, C.verde].forEach((c, i) => {
    x.fillStyle = c;
    x.beginPath();
    x.roundRect ? x.roundRect(M + i * (anchoBarra + 14), H - 130, anchoBarra, 14, 7) : x.rect(M + i * (anchoBarra + 14), H - 130, anchoBarra, 14);
    x.fill();
  });
  letra(500, 30); x.fillStyle = C.tinta3; x.fillText('Entrenado con FBE Coaching', M, H - 66);

  return new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen.'))), 'image/png'));
}

// Hoja con la vista previa y los botones para compartir o guardar la imagen
export function HojaCompartir({ datos, alCerrar, titulo = 'Compartir la sesión', nota = null, alt = null }) {
  const { aviso } = useApp();
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let url = null, vivo = true;
    dibujarTarjeta(datos).then((blob) => {
      if (!vivo) return;
      url = URL.createObjectURL(blob);
      setImg({ blob, url });
    }).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, []);
  const nombre = `fbe-${datos.fecha}-${datos.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  const archivo = img && (() => { try { return new File([img.blob], nombre, { type: 'image/png' }); } catch { return null; } })();
  const puedeCompartir = !!(archivo && navigator.canShare?.({ files: [archivo] }));
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      {error ? <div class="error" role="alert">{error}</div> : !img ? <Cargando texto="Preparando la imagen" /> : (
        <>
          <img class="tarjeta-img" src={img.url} alt={alt || `Tarjeta de ${datos.nombre}: ${datos.series} series, ${num(datos.tonelaje / 1000, 1)} toneladas`} />
          <div class="fila-envolver">
            {puedeCompartir && (
              <button class="btn btn-primario" onClick={async () => {
                try { await navigator.share({ files: [archivo], title: datos.nombre }); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: guarda la imagen y súbela tú.', 'error'); }
              }}><Icono n="compartir" /> Compartir</button>
            )}
            <button class={`btn ${puedeCompartir ? '' : 'btn-primario'}`} onClick={async () => { if (!(await descargar(nombre, img.blob, 'image/png'))) aviso('Mantén pulsada la imagen para guardarla.', 'error'); }}><Icono n="descargar" /> Guardar imagen</button>
          </div>
          <p class="mini terciario">{nota || 'Solo lleva el nombre de la sesión, las series, el tonelaje, los minutos y tus mejores series: nada de peso corporal ni datos de salud.'} En el móvil también puedes mantener pulsada la imagen para guardarla.</p>
        </>
      )}
    </Hoja>
  );
}
