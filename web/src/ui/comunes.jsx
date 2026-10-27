import { createContext } from 'preact';
import { reportarError } from '../registro-errores.js';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { num, leerNumero } from '../logica/calculos.js';
import { LOBO } from './marca-lobo.js';
import { fmtCorta, aISO, diasEntre, hoyISO } from '../logica/fechas.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// ---------------------------------------------------------------- iconos (24×24, trazo)
export const P = {
  hoy: 'M3 10v4M6 7v10M9 12h6M18 7v10M21 10v4',
  semana: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  checkin: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M8.5 12.5l2.2 2.2 4.8-4.8',
  progreso: 'M4 19h16M5 15l4.5-4.5 3.5 3.5L19 8M15 8h4v4',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  atletas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5',
  plantillas: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  biblioteca: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
  hecho: 'M5 12.5l4.5 4.5L19 7.5',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  atras: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
  abajo: 'M5 9l7 7 7-7',
  arriba: 'M5 15l7-7 7 7',
  cerrar: 'M6 6l12 12M18 6 6 18',
  video: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h9A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5zM16 10.5l4-2.5v8l-4-2.5',
  mensaje: 'M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  alerta: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5v.5',
  sinred: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.5-2.6M19 13a10 10 0 0 0-2.3-1.6M2 9.5a15 15 0 0 1 4-2.6M12 20h.01M22 9.5A15 15 0 0 0 12 6c-.7 0-1.4 0-2 .1',
  copiar: 'M9 9h10v11H9zM5 15V4h10',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4h6v3',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  salir: 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10',
  descargar: 'M12 4v11M7 10.5l5 4.5 5-4.5M5 19h14',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trofeo: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
  compartir: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  chincheta: 'M9 3h6l-1 6 3 3H7l3-3zM12 12v9',
  enfoque: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bascula: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-2',
  rayo: 'M13 3 5 13h6l-1 8 8-10h-6z',
  reloj: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2.5h4',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  enviar: 'M4 12 20 4l-6 16-3-7z',
  candado: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V12a1.5 1.5 0 0 1 1.5-1.5zM8 10.5V8a4 4 0 0 1 8 0v2.5',
  duplicar: 'M8 8h11v11H8zM5 16V5h11M13.5 11v5M11 13.5h5',
  play: 'M8 5.5v13l10.5-6.5z',
  reiniciar: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5',
  intercambiar: 'M4 8h14l-3.5-3.5M20 16H6l3.5 3.5',
  historial: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2',
  calculadora: 'M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3zM8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h3.5',
  camara: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  llama: 'M12 3c.8 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2.3 1.2-3.6 2.3-4.6.1 1.9 1 3.1 2.2 3.3-.4-3 .3-5.4 0-7.7z',
  bandeja: 'M3.5 13H8l1.5 2.5h5L16 13h4.5M5.5 5h13l2 8v5.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V13z',
  escudo: 'M12 3l7 2.8v5.4c0 4.6-3 8.3-7 9.8-4-1.5-7-5.2-7-9.8V5.8zM9 12l2.2 2.2L15.5 10',
  diana: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  regla: 'M3.5 16.5 16.5 3.5l4 4-13 13zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2',
  imagen: 'M5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15 9h.01',
  movil: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3zM11 18h2',
  pregunta: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  altavoz: 'M4 10v4h3l5 4V6l-5 4zM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
  pausa: 'M8 5v14M16 5v14',
  disco: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 6.5v1M12 16.5v1',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  // v0.10: hábitos, plan, cámara e intervalos
  pasos: 'M8.5 3.5c1.6 0 2.5 1.7 2.5 4.2S10 12 8.5 12 6 10.2 6 7.7s.9-4.2 2.5-4.2zM6.5 14.5h4l-.4 2.7a1.6 1.6 0 0 1-3.2 0zM15.5 7.5c1.6 0 2.5 1.7 2.5 4.2S17 16 15.5 16 13 14.2 13 11.7s.9-4.2 2.5-4.2zM13.5 18.5h4l-.2 1a1.6 1.6 0 0 1-3.2 0z',
  proteina: 'M12 3c3.6 0 6.5 6.2 6.5 10.3a6.5 6.5 0 0 1-13 0C5.5 9.2 8.4 3 12 3zM9.5 14a2.5 2.5 0 0 0 2.5 2.5',
  agua: 'M12 3.5c3.2 4.2 6 7.4 6 10.7a6 6 0 0 1-12 0c0-3.3 2.8-6.5 6-10.7zM9 14.5a3 3 0 0 0 3 3',
  sueno: 'M19.5 14.8A8 8 0 1 1 9.2 4.5a6.5 6.5 0 0 0 10.3 10.3zM16 3.5h3l-3 3h3',
  movilidad: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 9.5l8 1.5 8-1.5M12 11v4.5l-4 5.5M12 15.5l4 5.5',
  verdura: 'M5 19.5C5 11 10 5 20 4.5 20 14 14 19.5 5.5 19.5zM5 19.5l8-8',
  libre: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  calendario: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4M12 12.5v5M9.5 15h5',
  girar: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM9 13a3 3 0 0 1 5.3-1.9M15 13a3 3 0 0 1-5.3 1.9M14.6 9.3v1.9h-1.9M9.4 16.7v-1.9h1.9',
  intervalos: 'M2.5 12h3.5l2-5.5 3.5 11 3-8 2 2.5h5',
  // v0.11: nutrición
  // v0.12: notificaciones
  campana: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0M12 3v2',
  nutricion: 'M13 18.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 4v4.5a1.5 1.5 0 0 0 3 0V4M4.5 9v11M21.5 4c-1.2.8-1.8 2.6-1.8 4.3V12h1.8v8',
};

// Anillo de la semana: un segmento por sesión programada; los hechos, en morado
export function Anillo({ hechas, total, tam = 68 }) {
  const n = Math.max(1, total), R = 26, C = 2 * Math.PI * R;
  const seg = C / n, hueco = n > 1 ? Math.min(5, seg * 0.18) : 0;
  return (
    <svg class="anillo" viewBox="0 0 64 64" width={tam} height={tam} role="img" aria-label={`${hechas} de ${total} sesiones hechas esta semana`}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx="32" cy="32" r={R} fill="none" stroke-width="8" class={i < hechas ? 'lleno' : 'vacio'}
          stroke-dasharray={`${seg - hueco} ${C - seg + hueco}`} stroke-dashoffset={-i * seg - hueco / 2} transform="rotate(-90 32 32)" />
      ))}
      <text x="32" y="37" text-anchor="middle" class="anillo-num">{hechas}/{total}</text>
    </svg>
  );
}

export function Icono({ n, titulo, ...resto }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden={titulo ? undefined : 'true'} role={titulo ? 'img' : undefined} {...resto}>
      {titulo && <title>{titulo}</title>}
      <path d={P[n]} />
    </svg>
  );
}

export function Marca() {
  return (
    <span class="marca">
      <img src={LOBO} alt="" width="28" height="28" aria-hidden="true" />
      FBE Equipo
    </span>
  );
}

// ---------------------------------------------------------------- piezas
// Avatar con iniciales: el color sale del nombre, así cada persona tiene siempre el mismo
export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
// Con foto de perfil (v0.19), la foto; sin ella, las iniciales en el color de su nombre
// ampliable: con foto, tocarla la abre en grande (v0.25). No usarlo dentro de otro botón.
export function Avatar({ nombre, clase = '', lleno = false, foto = null, ampliable = false }) {
  const [grande, setGrande] = useState(false);
  let h = 0;
  for (const ch of String(nombre || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = (h % 6) + 1;
  const conFoto = typeof foto === 'string' && foto.startsWith('data:image/');
  const circulo = (
    <span class={`avatar ${clase} ${lleno && !conFoto ? 'lleno' : ''} ${conFoto ? 'con-foto' : ''}`} style={{ '--av': `var(--av-${n})` }} aria-hidden="true">
      {conFoto ? <img src={foto} alt="" /> : iniciales(nombre)}
    </span>
  );
  if (!ampliable || !conFoto) return circulo;
  return (
    <>
      <button type="button" class="avatar-ampliable" onClick={() => setGrande(true)} aria-label={`Ver en grande la foto de ${nombre || 'perfil'}`}>{circulo}</button>
      {grande && (
        <Hoja titulo={nombre || 'Foto de perfil'} alCerrar={() => setGrande(false)}>
          <img class="foto-ampliada" src={foto} alt={`Foto de perfil de ${nombre || ''}`} />
        </Hoja>
      )}
    </>
  );
}

export function Disco({ prioridad, titulo }) {
  return <span class={`disco ${prioridad}`} title={titulo} aria-hidden={titulo ? undefined : 'true'} />;
}

export function Cargando({ texto = 'Cargando' }) {
  return <div class="cargando" role="status"><div class="rueda" /><span class="sr">{texto}</span></div>;
}

// Siluetas de carga: la forma de lo que va a aparecer, en gris, mientras llegan los datos.
// Aparecen con un pequeño retraso para no parpadear si los datos llegan enseguida.
const Linea = ({ w = '100%', h = 12, r }) => <span class="sil" style={{ width: w, height: `${h}px`, borderRadius: r }} />;
function FilaSilueta({ i = 0, icono = true, cola = true }) {
  const anchos = ['62%', '48%', '70%', '55%', '40%'];
  return (
    <div class={`sil-fila ${icono ? '' : 'sin-icono'}`}>
      {icono && <Linea w="34px" h={34} r="50%" />}
      <span class="sil-col"><Linea w={anchos[i % anchos.length]} h={14} /><Linea w={anchos[(i + 2) % anchos.length]} h={11} /></span>
      {cola && <Linea w="18px" h={18} r="6px" />}
    </div>
  );
}
function TarjetaSilueta({ i = 0, barra = false, filas = 2 }) {
  return (
    <div class="panel panel-pad sil-tarjeta">
      <Linea w={['58%', '44%', '66%'][i % 3]} h={16} />
      {Array.from({ length: filas }, (_, k) => <Linea key={k} w={k ? '72%' : '90%'} h={11} />)}
      {barra && <Linea w="100%" h={8} r="4px" />}
    </div>
  );
}
export function Siluetas({ forma = 'lista', n = 5, texto = 'Cargando' }) {
  let cuerpo;
  if (forma === 'hoy') {
    cuerpo = (
      <>
        <div class="sil-col"><Linea w="45%" h={12} /><Linea w="38%" h={34} r="8px" /></div>
        <div class="panel">{Array.from({ length: 5 }, (_, i) => <FilaSilueta key={i} i={i} cola={false} />)}</div>
        <Linea w="100%" h={54} r="14px" />
        <TarjetaSilueta i={1} />
      </>
    );
  } else if (forma === 'sesion') {
    cuerpo = (
      <>
        <div class="sil-col"><Linea w="42%" h={26} r="8px" /><Linea w="24%" h={12} /></div>
        {Array.from({ length: 3 }, (_, i) => <TarjetaSilueta key={i} i={i} filas={3} />)}
      </>
    );
  } else if (forma === 'tarjetas') {
    cuerpo = Array.from({ length: n }, (_, i) => <TarjetaSilueta key={i} i={i} barra={i % 2 === 0} />);
  } else if (forma === 'grafica') {
    cuerpo = (
      <>
        <Linea w="100%" h={36} r="12px" />
        <Linea w="100%" h={180} r="14px" />
        <div class="panel">{Array.from({ length: 3 }, (_, i) => <FilaSilueta key={i} i={i} icono={false} />)}</div>
      </>
    );
  } else if (forma === 'filas') {
    cuerpo = Array.from({ length: n }, (_, i) => <FilaSilueta key={i} i={i} />);
  } else if (forma === 'galeria') {
    cuerpo = <div class="galeria">{Array.from({ length: n }, (_, i) => <Linea key={i} w="100%" h={0} r="10px" />)}</div>;
  } else if (forma === 'formulario') {
    cuerpo = Array.from({ length: n }, (_, i) => <div key={i} class="sil-col"><Linea w={['30%', '42%', '26%'][i % 3]} h={12} /><Linea w="100%" h={46} r="12px" /></div>);
  } else {
    cuerpo = <div class="panel">{Array.from({ length: n }, (_, i) => <FilaSilueta key={i} i={i} />)}</div>;
  }
  return <div class={`siluetas sil-${forma}`} role="status" aria-live="polite"><span class="sr">{texto}</span><div class="sil-cuerpo" aria-hidden="true">{cuerpo}</div></div>;
}

export function Vacio({ icono = 'semana', titulo, children, accion }) {
  return (
    <div class="vacio">
      <Icono n={icono} />
      <p class="vacio-titulo">{titulo}</p>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export function ErrorCaja({ error, reintentar }) {
  if (!error) return null;
  return (
    <div class="error" role="alert">
      {error.message || String(error)}
      {reintentar && <> <button class="btn-texto" onClick={reintentar}>Reintentar</button></>}
    </div>
  );
}

// Número con − y +; acepta coma decimal y punto de miles al teclear («8.000» son ocho mil). Al salir del
// campo, lo escrito se ordena: «80,55» con un decimal queda «80,6», que es lo que se guarda.
export function Paso({ valor, alCambiar, paso = 1, min = 0, max = 9999, dec = 1, etiqueta, id }) {
  const [texto, setTexto] = useState(valor == null ? '' : num(valor, dec));
  // Solo cuando el valor cambia desde fuera (no al montar: si se escribe nada más abrir, se borraría lo escrito)
  const montado = useRef(false);
  // Mientras se teclea, el valor se va pasando (para que «Guardar» se active sin tener que salir del campo),
  // pero lo escrito no se reescribe hasta salir de él
  const tecleando = useRef(false);
  useEffect(() => { if (montado.current && !tecleando.current) setTexto(valor == null ? '' : num(valor, dec)); montado.current = true; }, [valor]);
  const fijar = (v) => {
    if (v === null || Number.isNaN(v)) { setTexto(''); alCambiar(null); return; }
    const f = 10 ** dec;
    const c = Math.min(max, Math.max(min, Math.round(v * f) / f));
    setTexto(num(c, dec));
    alCambiar(c);
  };
  const alTeclear = (t) => {
    setTexto(t);
    tecleando.current = true;
    const v = leerNumero(t);
    alCambiar(v !== null && v >= min && v <= max ? Math.round(v * 10 ** dec) / 10 ** dec : null);
  };
  return (
    <div class="paso">
      <button type="button" aria-label={`Restar ${num(paso)} a ${etiqueta}`} onClick={() => fijar((valor ?? 0) - paso)}>−</button>
      <input id={id} inputMode="decimal" aria-label={etiqueta} value={texto} enterKeyHint="done"
        onInput={(e) => alTeclear(e.currentTarget.value)}
        onBlur={() => { tecleando.current = false; fijar(leerNumero(texto)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onFocus={(e) => e.currentTarget.select()} />
      <button type="button" aria-label={`Sumar ${num(paso)} a ${etiqueta}`} onClick={() => fijar((valor ?? 0) + paso)}>+</button>
    </div>
  );
}

// Control segmentado: opciones [[valor, texto]]
export function Segmentos({ opciones, valor, alCambiar, etiqueta, clase = '' }) {
  return (
    <div class={`segmentos ${clase}`} role="group" aria-label={etiqueta}>
      {opciones.map(([v, t, ayuda]) => (
        <button type="button" key={String(v)} data-v={v} aria-pressed={valor === v ? 'true' : 'false'} title={ayuda}
          onClick={() => alCambiar(valor === v ? null : v)}>{t}</button>
      ))}
    </div>
  );
}

// Pestañas accesibles: una pestaña activa en el orden de tabulación y las flechas (Inicio y Fin) para moverse
export function Pestanas({ opciones, valor, alCambiar, etiqueta, clase = '', idBase = 'pest' }) {
  const tecla = (e) => {
    const i = opciones.findIndex(([id]) => id === valor);
    const n = opciones.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    const lista = e.currentTarget;
    alCambiar(opciones[j][0]);
    setTimeout(() => lista.querySelector(`#${idBase}-${opciones[j][0]}`)?.focus(), 0);
  };
  return (
    <div class={`pestanas ${clase}`} role="tablist" aria-label={etiqueta} onKeyDown={tecla}>
      {opciones.map(([id, t]) => (
        <button key={id} id={`${idBase}-${id}`} type="button" role="tab" aria-selected={valor === id ? 'true' : 'false'} aria-controls={`${idBase}-panel`}
          tabIndex={valor === id ? 0 : -1} onClick={() => alCambiar(id)}>{t}</button>
      ))}
    </div>
  );
}

// Diálogo como hoja inferior (en el móvil) o centrado (en pantallas anchas). Escape y velo lo cierran.
// Tab y Mayús+Tab no salen de la ventana de encima (como en un diálogo nativo): al pasar del último control
// se vuelve al primero. ref es el elemento con aria-modal; con varias abiertas, solo actúa la de encima.
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useAtraparFoco(ref) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      const lista = [...ref.current.querySelectorAll(ENFOCABLES)].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
      if (!lista.length) { e.preventDefault(); return; }
      const primero = lista[0], ultimo = lista[lista.length - 1], activo = document.activeElement;
      const dentro = ref.current.contains(activo);
      if (e.shiftKey && (activo === primero || !dentro)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (activo === ultimo || !dentro)) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}

export function Hoja({ titulo, alCerrar: alCerrarProp, children, ancho }) {
  const ref = useRef(null);
  useAtraparFoco(ref);
  const arrastre = useRef(null);
  // Siempre la versión actual de alCerrar (puede cambiar mientras está abierta: «no cerrar mientras sube el vídeo»)
  const cerrarRef = useRef(alCerrarProp);
  cerrarRef.current = alCerrarProp;
  const alCerrar = () => cerrarRef.current?.();
  // En cuanto se monta (no tras pintar), para que el foco y Escape funcionen desde el primer instante
  useLayoutEffect(() => {
    const previo = document.activeElement;
    // Con varias hojas abiertas, Escape cierra solo la de encima
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      // Solo la ventana de encima: la última abierta (otra hoja, la búsqueda rápida…) se cierra antes
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      alCerrar();
    };
    document.addEventListener('keydown', tecla);
    const foco = ref.current?.querySelector('input, select, textarea, button:not(.cerrar-hoja)');
    foco?.focus({ preventScroll: true });
    // La página de detrás no se desplaza mientras haya alguna hoja abierta (se cuentan, por si hay una encima de otra)
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1);
    cuerpo.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan);
      else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.();
    };
  }, []);

  // En el móvil, la hoja se cierra arrastrándola hacia abajo desde el asa o el título (como en iOS)
  const alBajar = (e) => {
    if (window.matchMedia('(min-width: 700px)').matches || e.button > 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    arrastre.current = { y0: e.clientY, t: performance.now(), yAnt: e.clientY, tAnt: performance.now(), dy: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    ref.current.style.transition = 'none';
  };
  const alMover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    a.yAnt = a.y; a.tAnt = a.t; a.y = e.clientY; a.t = performance.now();
    a.dy = Math.max(0, e.clientY - a.y0);
    ref.current.style.transform = a.dy ? `translateY(${a.dy}px)` : '';
    ref.current.parentElement.style.setProperty('--velo', String(Math.max(0, 1 - a.dy / 500)));
  };
  const alSoltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    const hoja = ref.current;
    if (!a || !hoja) return;
    const velocidad = a.y != null && a.t > a.tAnt ? (a.y - a.yAnt) / (a.t - a.tAnt) : 0; // px/ms al soltar
    if (a.dy > Math.min(140, hoja.offsetHeight * 0.3) || (velocidad > 0.6 && a.dy > 20)) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { alCerrar(); return; }
      hoja.style.transition = 'transform .18s ease-in';
      hoja.style.transform = `translateY(${hoja.offsetHeight + 40}px)`;
      hoja.parentElement.classList.add('cerrando');
      setTimeout(alCerrar, 170);
    } else {
      hoja.style.transition = 'transform .24s cubic-bezier(.2, .9, .3, 1.15)';
      hoja.style.transform = '';
      hoja.parentElement.style.removeProperty('--velo');
    }
  };
  return (
    <div class="velo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class="hoja-dialogo" role="dialog" aria-modal="true" aria-label={titulo} ref={ref} style={ancho ? { width: `min(${ancho}px, 100%)` } : undefined}>
        <div class="hoja-cab" onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
          <div class="asa" aria-hidden="true" />
          <div class="separa">
            <h2>{titulo}</h2>
            <button class="btn btn-icono plano cerrar-hoja" onClick={alCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Carga asíncrona con estado
export function useCarga(fn, deps = []) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const vivo = useRef(true);
  const ultima = useRef(0); // solo vale la respuesta de la última petición (si llegan desordenadas, las viejas se tiran)
  const cargar = useCallback(async (silencioso = false) => {
    const n = ++ultima.current;
    if (!silencioso) setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const datos = await fn();
      if (vivo.current && n === ultima.current) setEstado({ datos, error: null, cargando: false });
    } catch (error) {
      reportarError(error, 'carga');
      if (vivo.current && n === ultima.current) setEstado((e) => ({ ...e, error, cargando: false }));
    }
  }, deps);
  useEffect(() => { vivo.current = true; cargar(); return () => { vivo.current = false; }; }, [cargar]);
  return { ...estado, recargar: cargar };
}

// Evita el doble envío (dos toques seguidos en «Guardar» o «Crear»): mientras la acción está en marcha no se repite
export function useUnaVez() {
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const una = useCallback(async (fn) => {
    if (enCurso.current) return undefined;
    enCurso.current = true; setOcupado(true);
    try { return await fn(); } finally { enCurso.current = false; setOcupado(false); }
  }, []);
  return [ocupado, una];
}

// Avisa cuando cambia el día (la app abierta toda la noche, o al volver a ella por la mañana)
export function useCambioDeDia(alCambiar) {
  const dia = useRef(hoyISO());
  const fn = useRef(alCambiar);
  fn.current = alCambiar;
  useEffect(() => {
    const mirar = () => { const h = hoyISO(); if (h !== dia.current) { dia.current = h; fn.current(h); } };
    const visible = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', mirar);
    const t = setInterval(mirar, 60000);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', mirar); clearInterval(t); };
  }, []);
}

// Ancho real (en px) de un elemento: las gráficas dibujan a su tamaño para que los textos no crezcan en pantallas anchas
export function useAncho(inicial = 340) {
  const [ancho, setAncho] = useState(inicial);
  const obs = useRef(null);
  // Ref de función: se engancha cuando el elemento aparece (aunque sea después de cargar los datos)
  const ref = useCallback((el) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    const medir = (w) => { const x = Math.round(w); if (x >= 160) setAncho((a) => (Math.abs(a - x) > 1 ? x : a)); };
    medir(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    obs.current = new ResizeObserver(([e]) => medir(e.contentRect.width));
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [ancho, ref];
}

// ---------------------------------------------------------------- gráfica de línea
// puntos: [{x: 'YYYY-MM-DD', y: número}]
// rangoMin: el eje y abarca como poco esto (para que 2000 → 2080 kcal no parezca una montaña)
export function Grafica({ puntos, unidad = '', alto = 150, dec = 1, etiqueta, rangoMin = null }) {
  const [W, ref] = useAncho();
  if (!puntos?.length) return null;
  const H = Math.max(alto, Math.min(240, Math.round(W * 0.3))), izq = 34, der = 14, arr = 16, abj = 22; // más alta si hay mucho ancho
  const ys = puntos.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (rangoMin != null && hi - lo < rangoMin) { const m = (hi + lo) / 2; lo = m - rangoMin / 2; hi = m + rangoMin / 2; }
  else if (hi - lo < 1) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const X = (i) => izq + (puntos.length === 1 ? (W - izq - der) / 2 : (i * (W - izq - der)) / (puntos.length - 1));
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(puntos.length - 1).toFixed(1)} ${H - abj} L${X(0).toFixed(1)} ${H - abj}Z`;
  const paso = hi - lo > 200 ? 50 : hi - lo > 8 ? 1 : 0.5;
  const ticks = [...new Set([lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((t) => Math.round(t / paso) * paso))];
  const etiquetasX = puntos.length <= 2 ? puntos.map((_, i) => i) : [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];
  const ultimo = puntos[puntos.length - 1];
  return (
    <svg class="grafica" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etiqueta || `Evolución: último valor ${num(ultimo.y, dec)} ${unidad}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" />
          <text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(t, 1)}</text>
        </g>
      ))}
      <path class="area" d={area} />
      <path class="linea" d={d} />
      {puntos.map((p, i) => <circle key={i} class={`punto ${i === puntos.length - 1 ? 'ultimo' : ''}`} cx={X(i)} cy={Y(p.y)} r={i === puntos.length - 1 ? 4.5 : 3} />)}
      <text class="valor" x={Math.min(X(puntos.length - 1), W - der)} y={Y(ultimo.y) - 10} text-anchor="end">{num(ultimo.y, dec)}{unidad ? ` ${unidad}` : ''}</text>
      {etiquetasX.map((i) => (
        <text key={i} x={X(i)} y={H - 4} text-anchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'}>{fmtCorta(puntos[i].x)}</text>
      ))}
    </svg>
  );
}

// Peso: cada pesada como un punto y la tendencia como línea, con el eje x en días reales
export function GraficaPeso({ serie, alto = 170, etiqueta }) {
  const [W, ref] = useAncho();
  if (!serie?.length) return null;
  const H = Math.max(alto, Math.min(240, Math.round(W * 0.3))), izq = 34, der = 14, arr = 14, abj = 22;
  const ys = serie.flatMap((p) => [p.kg, p.tendencia]);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - 0.75; hi = m + 0.75; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const d0 = serie[0].fecha, dN = serie[serie.length - 1].fecha;
  const total = Math.max(1, diasEntre(d0, dN));
  const X = (f) => izq + (serie.length === 1 ? (W - izq - der) / 2 : (diasEntre(d0, f) / total) * (W - izq - der));
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const linea = serie.map((p, i) => `${i ? 'L' : 'M'}${X(p.fecha).toFixed(1)} ${Y(p.tendencia).toFixed(1)}`).join(' ');
  const paso = hi - lo > 6 ? 1 : 0.5;
  const ticks = [...new Set([lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((t) => Math.round(t / paso) * paso))];
  const ult = serie[serie.length - 1];
  const fechasX = total >= 14 ? [d0, aISO(new Date(Date.parse(`${d0}T12:00:00`) + (total / 2) * 864e5)), dN] : [d0, dN];
  return (
    <svg class="grafica grafica-peso" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etiqueta || `Peso: tendencia ${num(ult.tendencia)} kg`}>
      {ticks.map((t) => (
        <g key={t}><line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" /><text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(t, 1)}</text></g>
      ))}
      {serie.map((p) => <circle key={p.fecha} class="pesada" cx={X(p.fecha)} cy={Y(p.kg)} r="2.6" />)}
      <path class="linea" d={linea} />
      <circle class="punto ultimo" cx={X(ult.fecha)} cy={Y(ult.tendencia)} r="4.5" />
      {[...new Set(fechasX)].map((f, i, arr) => (
        <text key={f} x={X(f)} y={H - 4} text-anchor={i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle'}>{fmtCorta(f)}</text>
      ))}
    </svg>
  );
}

// Copiar al portapapeles con alternativa de selección
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

// Descarga un archivo generado en el navegador. Devuelve false si el navegador la bloquea.
// En la demo publicada como artefacto de claude.ai, las descargas pasan por su capacidad «downloads»
// (la persona ve una confirmación con el nombre y el tamaño); si no está, lo de siempre.
export async function descargar(nombre, contenido, tipo = 'application/json') {
  try {
    if (typeof window !== 'undefined' && typeof window.claude?.use === 'function') {
      const d = await window.claude.use('downloads').catch(() => null);
      if (d) {
        try { await d.save({ filename: nombre, data: contenido }); return true; } catch (e) { if (e?.code === 'declined') return true; if (e?.code !== 'rejected_extension' && e?.code !== 'extension_not_enabled') return false; }
      }
    }
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch { return false; }
}

// Hoja que descarga un archivo y, por si el navegador no deja, ofrece el texto para copiarlo
export function HojaExportar({ titulo, nombre, contenido, tipo, alCerrar }) {
  const { aviso } = useApp();
  useEffect(() => { descargar(nombre, contenido, tipo); }, []);
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <p class="peq secundario">Se ha descargado <strong>{nombre}</strong>. Si no ves la descarga, copia el contenido y guárdalo en un archivo con ese nombre.</p>
      <textarea class="area mono" style="min-height:200px" readOnly value={contenido.length > 200000 ? contenido.slice(0, 200000) + '\n…' : contenido} onFocus={(e) => e.currentTarget.select()} aria-label="Contenido exportado" />
      <div class="fila-envolver">
        <button class="btn" onClick={() => descargar(nombre, contenido, tipo)}><Icono n="descargar" /> Descargar otra vez</button>
        <button class="btn" onClick={async () => aviso((await copiar(contenido)) ? 'Copiado' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar</button>
      </div>
    </Hoja>
  );
}

// Una pista corta la primera vez que se ve una pantalla (se cierra con «Entendido» y no vuelve). Para que la app,
// con todo lo que hace, se entienda sola.
export function Pista({ id, children, icono = 'pregunta' }) {
  const [vista, setVista] = usePreferencia(`fbe-pista-${id}`, false);
  if (vista) return null;
  return (
    <div class="pista" role="note">
      <Icono n={icono} />
      <p>{children}</p>
      <button type="button" class="btn btn-peq" onClick={() => setVista(true)}>Entendido</button>
    </div>
  );
}

// Número pequeño sobre un icono o junto a un texto (pendientes, sin leer)
export function Insignia({ n, etiqueta }) {
  if (!n) return null;
  return <span class="insignia" role="img" aria-label={etiqueta || `${n} pendientes`}>{n > 99 ? '99+' : n}</span>;
}

// Guarda una preferencia del dispositivo (no datos: solo comodidades) sin romper si no hay almacenamiento
export function usePreferencia(clave, inicial) {
  const [v, setV] = useState(() => { try { const x = localStorage.getItem(clave); return x == null ? inicial : JSON.parse(x); } catch { return inicial; } });
  const fijar = (nuevo) => { setV(nuevo); try { localStorage.setItem(clave, JSON.stringify(nuevo)); } catch { /* */ } };
  return [v, fijar];
}

// Fecha y hora relativas de un comentario: «hace 5 min», «ayer, 18:30», «12 oct»
export function cuando(iso) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hh = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 864e5);
  if (dias === 0) return `hoy, ${hh}`;
  if (dias === 1) return `ayer, ${hh}`;
  return fmtCorta(aISO(d));
}
