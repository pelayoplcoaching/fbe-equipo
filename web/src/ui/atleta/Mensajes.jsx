import { useState } from 'preact/hooks';
import { useApp, useCarga, Avatar } from '../comunes.jsx';
import { LOBO } from '../marca-lobo.js';
import { Chat } from '../Chat.jsx';

// La pestaña Mensajes del atleta (v0.18): su chat con el coach. Lo que viene de una sesión, un check-in o un
// vídeo sale en el mismo hilo con su etiqueta; tocarla abre ese sitio. v0.54: la cabecera la pinta el chat (con
// «escribiendo…», «en línea» o «últ. vez», la búsqueda y el menú).
export function Mensajes({ abrirSesion, irA, releer }) {
  const { atleta, api } = useApp();
  // La foto de tu coach, si la ha puesto (si no, el lobo de FBE)
  const fotoCoach = useCarga(() => api.fotoCoach().catch(() => null), []);
  const [, setN] = useState(0);
  const irContexto = (ctx) => {
    if (ctx.tipo === 'sesion' && ctx.id) abrirSesion(ctx.id);
    else if (ctx.tipo === 'checkin') irA('checkin');
  };
  const avatar = fotoCoach.datos ? <Avatar nombre="Tu coach" foto={fotoCoach.datos} clase="avatar-coach" ampliable /> : <img class="avatar-coach" src={LOBO} alt="" width="40" height="40" aria-hidden="true" />;
  return (
    <div class="contenido chat-pagina">
      <Chat atletaId={atleta.id} nombreAtleta={atleta.nombre} nombreCoach="tu coach" fotoOtro={fotoCoach.datos} irContexto={irContexto} alLeer={() => { releer?.(); setN((x) => x + 1); }} alCambiar={() => releer?.()}
        cabecera={{ izquierda: avatar, titulo: 'Tu coach', sub: 'Te contesta aquí; también te llega al móvil' }} />
    </div>
  );
}
