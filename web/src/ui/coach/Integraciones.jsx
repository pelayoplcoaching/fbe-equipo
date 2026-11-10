// Las integraciones vistas por el coach (v0.105, migración 051):
//   · AtajosCoach: en su cuenta, los enlaces de iCloud de sus dos atajos del iPhone («FBE Salud» y «FBE a Salud»)
//   · SaludDelMovil: en la ficha (Seguimiento), lo que manda el iPhone de cada atleta: pasos, sueño, pulso, HRV y peso
//   · ContactoAtleta: en la ficha (Datos), su teléfono, para escribirle por WhatsApp con un toque
//   · BotonWhatsApp / useContactos: el botón (con su número si lo tiene; si no, WhatsApp pregunta a quién)
// Sin la 051, no sale nada.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { URL_ATAJO, ATAJO_SALUD, ATAJO_ENTRENO, enlaceWhatsApp, resumenSalud, textoSueno, haceDias, telefonoWa } from '../../logica/integraciones.js';
import { TablaSalud } from '../atleta/Conexiones.jsx';
import { pedirSubProgreso } from '../atleta/sub-progreso.js';
import { num } from '../../logica/calculos.js';

// Los teléfonos de todos ({ atleta_id: teléfono }; sin la 051, null). Se piden una vez por pantalla.
export function useContactos(deps = []) {
  const { api } = useApp();
  return useCarga(() => api.contactos().catch(() => null), deps, { recuerdo: `contactos:${api.uid()}:${deps.join(',')}` });
}

export function BotonWhatsApp({ telefono, texto = '', clase = 'btn btn-peq', etiqueta = 'WhatsApp' }) {
  return (
    <a class={clase} href={enlaceWhatsApp(telefono, texto)} target="_blank" rel="noopener"
      aria-label={telefono ? `${etiqueta} (se abre WhatsApp)` : `${etiqueta}: WhatsApp te pregunta a quién`}><Icono n="enviar" /> {etiqueta}</a>
  );
}

// ---------------------------------------------------------------- en la ficha: su teléfono
export function ContactoAtleta({ atleta }) {
  const { api, aviso } = useApp();
  const contactos = useContactos([atleta.id]);
  const [editar, setEditar] = useState(false);
  const [t, setT] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (contactos.datos === null || (contactos.cargando && !contactos.datos)) return null;
  const tel = contactos.datos?.[atleta.id] || null;
  const nombre = (atleta.nombre || '').split(' ')[0];
  const guardar = async (valor) => {
    setOcupado(true);
    try { await api.guardarContacto(atleta.id, valor); aviso(valor ? 'Teléfono guardado' : 'Teléfono quitado'); setEditar(false); contactos.recargar(true); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <section class="seccion contacto-atleta">
      <h2>WhatsApp</h2>
      <div class="panel panel-pad pila-s">
        {tel ? (
          <div class="fila-entre">
            <span><span class="peq secundario">Su teléfono</span><br /><strong class="num">{tel}</strong></span>
            <span class="fila"><BotonWhatsApp telefono={tel} texto={`Hola, ${nombre}.`} etiqueta="Escribirle" clase="btn btn-peq btn-primario" /><button class="btn btn-peq" onClick={() => { setT(tel); setEditar(true); }}>Cambiar</button></span>
          </div>
        ) : (
          <div class="fila-entre">
            <span class="peq secundario">Guarda su teléfono y le escribes por WhatsApp desde aquí, desde «A quién escribir» y el día de su cumpleaños.</span>
            <button class="btn btn-peq" onClick={() => { setT(''); setEditar(true); }}><Icono n="mas" /> Añadir</button>
          </div>
        )}
        <p class="mini terciario">Solo lo ves tú; tu atleta no lo ve en la app.</p>
      </div>
      {editar && (
        <Hoja titulo={`Teléfono de ${nombre}`} alCerrar={() => setEditar(false)}>
          <form class="pila" onSubmit={(e) => { e.preventDefault(); guardar(t); }}>
            <div class="campo">
              <label for="tel-atleta">Teléfono móvil</label>
              <input id="tel-atleta" class="entrada num" type="tel" inputMode="tel" autoComplete="off" value={t} onInput={(e) => setT(e.currentTarget.value)} placeholder="6XX XXX XXX" autoFocus />
              <span class="ayuda">{t.trim() && !telefonoWa(t) ? 'Si no es de España, ponle delante el prefijo (+33…).' : 'Si es de España, basta con las 9 cifras.'}</span>
            </div>
            <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="hecho" /> Guardar</button>
            {tel && <button type="button" class="btn plano" disabled={ocupado} onClick={() => guardar('')}>Quitar el teléfono</button>}
          </form>
        </Hoja>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- en la ficha: lo que manda su iPhone
export function SaludDelMovil({ atleta }) {
  const { api } = useApp();
  const datos = useCarga(() => api.saludDiaria(atleta.id).catch(() => null), [atleta.id]);
  const [ver, setVer] = useState(false);
  const d = datos.datos;
  if (!d || (!d.conectada && !d.dias?.length)) return null;
  const r = resumenSalud(d.dias || []);
  const u = r.ultimos, a = r.anteriores;
  const cifra = (k, texto, unidad, dec = 0) => (u[k] == null ? null : (
    <div class="salud-cifra" key={k} data-k={k} data-tend={a[k] == null || k === 'peso_kg' || Math.abs(u[k] - a[k]) < (dec ? 0.05 : 0.5) ? undefined : ((u[k] > a[k]) === (k !== 'fc_reposo') ? 'mejor' : 'peor')}>
      <dt>{texto}</dt>
      <dd><span class="num">{k === 'sueno_min' ? textoSueno(u[k]) : num(u[k], dec)}</span>{unidad && <span class="u"> {unidad}</span>}
        {a[k] != null && Math.abs(u[k] - a[k]) >= (dec ? 0.05 : 0.5) && <span class="salud-dif peq">{k === 'sueno_min' ? `${u[k] >= a[k] ? '+' : '−'}${Math.abs(Math.round(u[k] - a[k]))} min` : `${u[k] >= a[k] ? '+' : '−'}${num(Math.abs(u[k] - a[k]), dec)}`}</span>}
      </dd>
    </div>
  ));
  return (
    <section class="seccion salud-movil">
      <h2>Desde su iPhone</h2>
      <div class="panel panel-pad pila-s">
        <p class="peq secundario">{d.conectada ? `Salud del iPhone conectada · último envío ${haceDias(d.ultimo) || 'aún ninguno'}` : 'Ya no está conectada (se ve lo que llegó)'}. Media de los 7 últimos días; al lado, el cambio frente a los 7 anteriores.</p>
        {u.dias ? (
          <dl class="salud-cifras">
            {cifra('pasos', 'Pasos', '')}
            {cifra('sueno_min', 'Sueño', '')}
            {cifra('fc_reposo', 'Pulso en reposo', 'lpm')}
            {cifra('hrv', 'HRV', 'ms')}
            {cifra('peso_kg', 'Peso', 'kg', 1)}
          </dl>
        ) : <p class="peq">Esta semana no ha llegado nada.</p>}
        {d.dias?.length > 0 && <button class="btn-texto" aria-expanded={ver ? 'true' : 'false'} onClick={() => setVer(!ver)}><Icono n={ver ? 'arriba' : 'abajo'} /> {ver ? 'Ocultar' : 'Ver'} día a día</button>}
        {ver && <TablaSalud dias={d.dias} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- en su cuenta: los atajos del iPhone
const ATAJOS = [
  ['salud', `«${ATAJO_SALUD}»: de Salud a la app`, 'Cada mañana manda los pasos de ayer y el sueño, el pulso, la HRV y el peso de hoy.'],
  ['entreno', `«${ATAJO_ENTRENO}»: el entreno, a Salud`, 'Apunta en Salud la sesión que acaban de terminar (botón «Apuntar en Salud»).'],
];
export function AtajosCoach() {
  const { api } = useApp();
  const lista = useCarga(() => api.atajos().catch(() => null), []);
  const [editar, setEditar] = useState(null);
  if (lista.datos === null && !lista.cargando) return null;
  const m = lista.datos || {};
  return (
    <section class="seccion atajos-coach">
      <h2>Atajos del iPhone</h2>
      <div class="panel">
        <ul class="lista">
          {ATAJOS.map(([k, titulo, detalle]) => (
            <li key={k} class="atajo-fila" data-k={k} data-puesto={m[k] ? '1' : undefined}>
              <button class="fila-ios fila-boton" onClick={() => setEditar(k)} aria-label={`${titulo}: ${m[k] ? 'cambiar el enlace' : 'poner el enlace'}`}>
                <span class="fila-ios-texto"><span class="fila-ios-titulo">{titulo}</span><span class="peq terciario">{m[k] ? 'Enlace puesto' : detalle}</span></span>
                <Icono n={m[k] ? 'editar' : 'mas'} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p class="mini terciario">Créalos una vez en tu iPhone (los pasos están en la guía «Atajos del iPhone» del proyecto), compártelos con «Copiar enlace de iCloud» y pega aquí los enlaces. Tus atletas los instalan desde su perfil, en Conexiones. Lo de Salud solo llega con su consentimiento de datos de salud.</p>
      {/* (conexiones del coach) su propia clave, para usarlo él y probar el atajo antes de compartirlo */}
      <MiSalud />
      {editar && <HojaAtajo clave={editar} actual={m[editar] || ''} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); lista.recargar(true); }} />}
    </section>
  );
}

// Tu propia Salud del iPhone: en tu modo atleta (Progreso → Cuerpo → Conexiones) creas tu clave y conectas tu calendario
function MiSalud() {
  const { api, aviso, propioCoach, entrarModoAtleta } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const ir = async () => {
    setOcupado(true);
    try {
      // Sin ficha de atleta, se crea (con sus consentimientos de privacidad y de datos de salud: son sus propios datos)
      const propio = propioCoach || await api.crearAtletaPropio();
      try { history.replaceState(null, '', '#progreso'); } catch { /* */ }
      pedirSubProgreso('cuerpo');
      entrarModoAtleta(propioCoach ? null : propio);
      setTimeout(() => document.getElementById('prog-conexiones')?.scrollIntoView({ block: 'start' }), 700);
    } catch (e) { aviso(e.message, 'error'); setOcupado(false); }
  };
  return (
    <div class="panel panel-pad pila-s mi-salud">
      <strong>Tu Salud del iPhone y tu calendario</strong>
      <span class="peq secundario">{propioCoach
        ? 'En tu modo atleta, Progreso → Cuerpo → Conexiones: ahí creas tu clave personal (la que pegas en el atajo para probarlo) y conectas tu calendario.'
        : 'Para tener tu propia clave (usarlo tú y probar el atajo) hace falta tu ficha de atleta: se crea con tus consentimientos de privacidad y de datos de salud, que son tus propios datos.'}</span>
      <button type="button" class="btn btn-peq" style="justify-self:start" disabled={ocupado} onClick={ir}><Icono n="pasos" /> {propioCoach ? 'Ir a mis conexiones' : 'Crear mi ficha y conectar'}</button>
    </div>
  );
}

function HojaAtajo({ clave, actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [u, setU] = useState(actual);
  const [ocupado, setOcupado] = useState(false);
  const [, titulo, detalle] = ATAJOS.find(([k]) => k === clave);
  const mal = u.trim() && !URL_ATAJO.test(u.trim());
  const guardar = async (valor) => {
    setOcupado(true);
    try { await api.guardarAtajo(clave, valor); aviso(valor ? 'Enlace guardado' : 'Enlace quitado'); alGuardar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); if (!mal) guardar(u.trim()); }}>
        <p class="peq secundario">{detalle}</p>
        <div class="campo">
          <label for="atajo-url">Enlace de iCloud del atajo</label>
          <input id="atajo-url" class="entrada" type="url" inputMode="url" value={u} onInput={(e) => setU(e.currentTarget.value)} placeholder="https://www.icloud.com/shortcuts/…" autoFocus aria-invalid={mal ? 'true' : 'false'} />
          <span class="ayuda">{mal ? 'Tiene que empezar por https://www.icloud.com/shortcuts/' : 'En Atajos: mantén pulsado el atajo → Compartir → Copiar enlace de iCloud.'}</span>
        </div>
        <button class="btn btn-primario btn-grande" disabled={ocupado || mal}><Icono n="hecho" /> Guardar</button>
        {actual && <button type="button" class="btn plano" disabled={ocupado} onClick={() => guardar('')}>Quitar el enlace</button>}
      </form>
    </Hoja>
  );
}
