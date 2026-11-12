// Modo reloj (migración 058): el entreno desde el Apple Watch con el atajo «FBE Reloj» del coach. Un grupo «Apple Watch»
// en el perfil: instalar el atajo, copiar la clave personal (se enseña una vez), ponerlo en la esfera y cómo se usa;
// kilos o libras; crear otra clave y quitarlo. Sin la 058 (o sin entrenamiento), no sale nada.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, GrupoIos, FilaIos, Segmentos, copiar } from '../comunes.jsx';
import { ATAJO_RELOJ, OPCION } from '../../logica/reloj.js';
import { haceDias } from '../../logica/integraciones.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { unidadPeso } from '../../logica/unidades.js';

export function GrupoReloj() {
  const { api, atleta, propio } = useApp();
  const datos = useCarga(() => (propio || !atleta?.id ? Promise.resolve(null) : api.reloj().catch(() => null)), [atleta?.id]);
  const [abrir, setAbrir] = useState(false);
  const r = datos.datos;
  if (!r || !conEntrenamiento(atleta)) return null;
  return (
    <GrupoIos titulo="Apple Watch" id="grupo-reloj" pie="Desde la muñeca: la serie que toca, marcarla y el descanso, sin sacar el móvil.">
      <FilaIos icono="reloj" tono={r.activo ? 'ok' : ''} titulo="Entrenar desde el reloj"
        detalle={r.activo ? (r.ultimo ? `Conectado · usado ${haceDias(r.ultimo)}` : 'Conectado · aún sin usar') : 'Con la app Atajos del iPhone y del reloj'}
        alTocar={() => setAbrir(true)} etiqueta="Entrenar desde el Apple Watch: conectar o ver" />
      {abrir && <HojaReloj estado={r} alCerrar={() => { setAbrir(false); datos.recargar(true); }} />}
    </GrupoIos>
  );
}

function Paso({ n, titulo, children, hecho = false }) {
  return (
    <li class={`conexion-paso ${hecho ? 'hecho' : ''}`}>
      <span class="conexion-num num" aria-hidden="true">{hecho ? <Icono n="hecho" /> : n}</span>
      <div class="pila-s"><strong>{titulo}</strong>{children}</div>
    </li>
  );
}

export function HojaReloj({ estado, alCerrar }) {
  const { api, aviso, modo } = useApp();
  const [clave, setClave] = useState(null);
  const [activo, setActivo] = useState(!!estado.activo);
  const [unidad, setUnidad] = useState(estado.activo ? estado.unidad : unidadPeso());
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);   // 'nueva' | 'quitar'

  async function crear() {
    setOcupado(true);
    try { setClave(await api.crearReloj(unidad)); setActivo(true); setConfirmar(null); aviso('Clave creada'); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  async function cambiarUnidad(u) {
    const v = u || 'kg';
    setUnidad(v);
    if (!activo) return;
    try { await api.unidadReloj(v); aviso(v === 'lb' ? 'El reloj, en libras' : 'El reloj, en kilos'); } catch (e) { aviso(e.message, 'error'); }
  }
  async function quitar() {
    setOcupado(true);
    try { await api.quitarReloj(); aviso('Quitado: borra también el atajo del reloj si ya no lo quieres'); alCerrar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  return (
    <Hoja titulo="Entrenar desde el Apple Watch" alCerrar={alCerrar}>
      <div class="pila conexiones">
        <p class="peq secundario">El Apple Watch no puede tener la app (Apple solo deja instalar apps de la App Store), pero sí atajos. Con «{ATAJO_RELOJ}», desde la muñeca ves la serie que toca, la marcas y empieza solo el descanso. Lo que apuntas se guarda en la app como si lo marcaras en el móvil.</p>
        <ol class="conexion-pasos">
          <Paso n={1} titulo={`Instala el atajo «${ATAJO_RELOJ}» en el iPhone`}>
            {estado.atajo ? <a class="btn" href={estado.atajo} target="_blank" rel="noopener"><Icono n="descargar" /> Instalar el atajo</a>
              : <span class="peq secundario">Tu coach aún no lo ha preparado. Pídeselo y vuelve aquí.</span>}
            <span class="mini terciario">Al instalarlo te pedirá tu clave personal (la del paso 2).</span>
          </Paso>
          <Paso n={2} titulo="Copia tu clave personal" hecho={activo && !clave}>
            {clave ? (
              <div class="pila-s">
                <div class="nota conexion-enlace num" style="user-select:all">{clave}</div>
                <button type="button" class="btn btn-primario" onClick={async () => aviso((await copiar(clave)) ? 'Clave copiada' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar la clave</button>
                {modo === 'demo' && <span class="mini terciario">En la demo, la clave no lleva a ninguna parte: en tu app, esta es la que pegarías en el atajo.</span>}
              </div>
            ) : activo ? (
              <span class="peq secundario">Ya tienes una. Solo se enseña al crearla: si la perdiste o cambias de iPhone, crea otra y pégala en el atajo.</span>
            ) : <button type="button" class="btn btn-primario" disabled={ocupado} onClick={crear}><Icono n="enlace" /> Crear mi clave</button>}
            {(clave || !activo) && <span class="mini terciario">Es como una llave: no la compartas. Si creas otra, esta deja de valer.</span>}
            {activo && !clave && confirmar !== 'nueva' && <button type="button" class="btn-texto" onClick={() => setConfirmar('nueva')}>Crear una clave nueva</button>}
            {confirmar === 'nueva' && (
              <div class="nota pila-s">
                <span class="peq">La que tienes en el atajo dejará de valer: tendrás que pegar la nueva.</span>
                <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={crear}>Crear otra</button></span>
              </div>
            )}
          </Paso>
          <Paso n={3} titulo="Ponlo en el reloj">
            <span class="peq secundario">En Atajos, mantén pulsado «{ATAJO_RELOJ}» → <strong>Detalles</strong> → activa <strong>Mostrar en el Apple Watch</strong>. Después, en la esfera del reloj, añade la complicación <strong>Atajos</strong> con «{ATAJO_RELOJ}» para abrirlo de un toque.</span>
          </Paso>
        </ol>
        <section class="pila-s">
          <h3 class="peq">Cómo se usa</h3>
          <ul class="reloj-uso peq secundario">
            <li>Tócalo y verás, por ejemplo, «Sentadilla · Serie 2 de 4 · 80 kg × 8 · RIR 2».</li>
            <li><strong>{OPCION.hecha}</strong>: la guarda tal cual y arranca el descanso en el reloj.</li>
            <li><strong>{OPCION.cambiar}</strong>: dicta o escribe lo que hiciste.</li>
            <li><strong>{OPCION.saltar}</strong>, <strong>{OPCION.terminar}</strong> (con tu esfuerzo) u <strong>{OPCION.otra}</strong> de la semana.</li>
            <li>Al acabar, abre la app cuando quieras para ver el resumen. Si abres la sesión en el móvil, lo apuntado desde el reloj ya está ahí.</li>
          </ul>
          <p class="mini terciario">En el reloj, el orden es el que pautó tu coach y el descanso, el suyo (o 2 minutos). Cada toque tarda unos segundos: va por internet, a través del iPhone o de la red del reloj.</p>
        </section>
        <div class="campo"><span class="etq">Cargas en el reloj</span><Segmentos etiqueta="Cargas en el reloj" valor={unidad} alCambiar={cambiarUnidad} opciones={[['kg', 'Kilos (kg)'], ['lb', 'Libras (lb)']]} /></div>
        {activo && (confirmar === 'quitar' ? (
          <div class="nota pila-s">
            <span class="peq">El atajo dejará de funcionar. Las series que apuntaste desde el reloj se quedan.</span>
            <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={quitar}>Quitar</button></span>
          </div>
        ) : <button type="button" class="btn btn-plano peligro" onClick={() => setConfirmar('quitar')}>Quitar el modo reloj</button>)}
      </div>
    </Hoja>
  );
}
