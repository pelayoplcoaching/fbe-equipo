import { useState } from 'preact/hooks';
import { Hoja, Icono, Avatar, Segmentos, useApp } from '../comunes.jsx';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { OPCIONES_SILENCIO, silenciado, textoSilencio } from '../../logica/chat.js';
import { LOBO } from '../marca-lobo.js';

// «Info del contacto» (v0.55), al tocar la cabecera del chat, como WhatsApp: la foto en grande y el nombre, «en línea»
// o la última vez (con las mismas reglas de privacidad), lo que os habéis mandado (fotos y vídeos, enlaces y
// documentos), los destacados, buscar, silenciar y el fondo del chat. El coach, además, «Ver ficha»; el atleta ve el
// nombre de su coach y «Tu coach».
export function InfoContacto({ yo, nombre, foto, estado, cuentas, silencio, alSilenciar, alArchivos, alDestacados, alBuscar, alVerFicha = null, alCerrar, alFondo }) {
  const [fondo, setFondo] = useState(leerAjustes().fondoChat);
  const [elegirSilencio, setElegirSilencio] = useState(false);
  const callado = silenciado(silencio);
  const cambiarFondo = (v) => { setFondo(v); guardarAjustes({ ...leerAjustes(), fondoChat: v }); alFondo?.(v); };
  return (
    <Hoja titulo="Info del contacto" alCerrar={alCerrar} clase="hoja-contacto">
      <div class="contacto-cabeza">
        {foto || yo === 'coach' ? <Avatar nombre={nombre} foto={foto} clase="enorme" /> : <img class="avatar enorme avatar-lobo" src={LOBO} alt="" width="112" height="112" />}
        <h3 class="contacto-nombre">{nombre}</h3>
        {yo === 'atleta' && <p class="peq secundario">Tu coach</p>}
        <p class="peq secundario contacto-estado" role="status">{estado || (yo === 'coach' ? 'Sin «en línea» ahora mismo' : '')}</p>
        {alVerFicha && <button type="button" class="btn btn-peq" onClick={alVerFicha}><Icono n="perfil" /> Ver ficha</button>}
      </div>
      <ul class="lista hoja-acciones">
        <li><button type="button" class="accion-fila" onClick={() => alArchivos('multimedia')}><span class="ico"><Icono n="imagen" /></span>
          <span class="pila-xs"><strong>Archivos, enlaces y documentos</strong><span class="peq secundario">{cuentas.medios} {cuentas.medios === 1 ? 'foto o vídeo' : 'fotos y vídeos'} · {cuentas.enlaces} {cuentas.enlaces === 1 ? 'enlace' : 'enlaces'} · {cuentas.docs} {cuentas.docs === 1 ? 'documento' : 'documentos'}</span></span><Icono n="derecha" class="cola" /></button></li>
        <li><button type="button" class="accion-fila" onClick={alDestacados}><span class="ico"><Icono n="estrella" /></span><span class="pila-xs"><strong>Mensajes destacados</strong></span><Icono n="derecha" class="cola" /></button></li>
        <li><button type="button" class="accion-fila" onClick={alBuscar}><span class="ico"><Icono n="buscar" /></span><span class="pila-xs"><strong>Buscar en el chat</strong></span><Icono n="derecha" class="cola" /></button></li>
        <li><button type="button" class="accion-fila" aria-haspopup="dialog" onClick={() => (callado ? alSilenciar(null) : setElegirSilencio(true))}>
          <span class="ico"><Icono n={callado ? 'campana' : 'silencio'} /></span>
          <span class="pila-xs"><strong>{callado ? 'Activar las notificaciones' : 'Silenciar notificaciones'}</strong><span class="peq secundario">{callado ? textoSilencio(silencio) : 'Los mensajes siguen llegando y contando; solo no suena'}</span></span><span /></button></li>
      </ul>
      <div class="pila-xs contacto-fondo">
        <strong class="peq">Fondo del chat</strong>
        <Segmentos opciones={[['dibujos', 'Con dibujos'], ['liso', 'Liso']]} valor={fondo} alCambiar={cambiarFondo} etiqueta="Fondo del chat" />
      </div>
      {elegirSilencio && <HojaSilenciar alCerrar={() => setElegirSilencio(false)} alElegir={(o) => { setElegirSilencio(false); alSilenciar(o); }} />}
    </Hoja>
  );
}

// 8 horas, 1 semana o siempre
export function HojaSilenciar({ alCerrar, alElegir }) {
  return (
    <Hoja titulo="Silenciar notificaciones" alCerrar={alCerrar}>
      <p class="peq secundario">No te sonará nada de esta conversación; los mensajes llegan igual y siguen contando como sin leer.</p>
      <ul class="lista hoja-acciones">
        {OPCIONES_SILENCIO.map(([k, t]) => (
          <li key={k}><button type="button" class="accion-fila" onClick={() => alElegir(k)}><span class="ico"><Icono n="silencio" /></span><span class="pila-xs"><strong>{t}</strong></span><span /></button></li>
        ))}
      </ul>
    </Hoja>
  );
}
