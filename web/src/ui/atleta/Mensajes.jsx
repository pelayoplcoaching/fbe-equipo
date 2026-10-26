import { useState } from 'preact/hooks';
import { useApp } from '../comunes.jsx';
import { LOBO } from '../marca-lobo.js';
import { Chat } from '../Chat.jsx';

// La pestaña Mensajes del atleta (v0.18): su chat con el coach. Lo que viene de una sesión, un check-in o un
// vídeo sale en el mismo hilo con su etiqueta; tocarla abre ese sitio.
export function Mensajes({ abrirSesion, irA, releer }) {
  const { atleta } = useApp();
  const [, setN] = useState(0);
  const irContexto = (ctx) => {
    if (ctx.tipo === 'sesion' && ctx.id) abrirSesion(ctx.id);
    else if (ctx.tipo === 'checkin') irA('checkin');
  };
  return (
    <div class="contenido chat-pagina">
      <header class="cabecera cabecera-chat">
        <img class="avatar-coach" src={LOBO} alt="" width="40" height="40" aria-hidden="true" />
        <div class="titulo"><h1>Tu coach</h1><div class="sub">Te contesta aquí; también te llega al móvil</div></div>
      </header>
      <Chat atletaId={atleta.id} nombreAtleta={atleta.nombre} nombreCoach="tu coach" irContexto={irContexto} alLeer={() => { releer?.(); setN((x) => x + 1); }} alCambiar={() => releer?.()} />
    </div>
  );
}
