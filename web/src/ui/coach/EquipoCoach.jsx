// El equipo, visto por el coach (v0.43): el muro (avisos, fijar, ocultar, borrar, comentar y reaccionar como
// «Coach»), los retos, el ranking de la semana y quién ha entrado. Se abre y se cierra en Cuenta → Comunidad.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Pestanas, Avatar, Cargando } from '../comunes.jsx';
import { BandaDemo } from '../App.jsx';
import { Muro, Retos, Ranking, ListaNormas } from '../Comunidad.jsx';
import { fmtCorta } from '../../logica/fechas.js';

const VISTAS = [['muro', 'Muro'], ['retos', 'Retos'], ['ranking', 'Ranking'], ['miembros', 'Quién está'], ['normas', 'Normas']];

export function EquipoCoach() {
  const [vista, setVista] = useState('muro');
  return (
    <div class="contenido coach equipo">
      <header class="cabecera"><div class="titulo"><h1>Equipo</h1><div class="sub">El muro de tus atletas: avisos, retos y constancia</div></div></header>
      <BandaDemo />
      <Pestanas opciones={VISTAS} valor={vista} alCambiar={setVista} etiqueta="Equipo" idBase="eqc" />
      <div class="pestana-panel" role="tabpanel" id="eqc-panel" aria-labelledby={`eqc-${vista}`} key={vista}>
        {vista === 'muro' && <Muro coach />}
        {vista === 'retos' && <Retos coach />}
        {vista === 'ranking' && <Ranking />}
        {vista === 'miembros' && <Miembros />}
        {vista === 'normas' && (
          <div class="panel panel-pad pila">
            <ListaNormas />
            <p class="mini terciario">Cada atleta las lee y las marca como leídas antes de entrar. Si cambian (web/src/datos/normas-comunidad.js y su versión en la base), todos tendrán que volver a leerlas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Quién ha entrado, con la fecha en que aceptó. El coach puede sacar a alguien (y no le deja volver) y
// volver a admitirle (entonces puede entrar él otra vez, aceptando lo que se comparte). Los demás atletas no ven
// nada de la comunidad.
function Miembros() {
  const { api, aviso } = useApp();
  const lista = useCarga(() => Promise.all([api.miembrosComunidad(), api.atletas()]), []);
  const [sacar, setSacar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (!lista.datos) return <Cargando texto="Cargando quién está" />;
  const [miembros, atletas] = lista.datos;
  const A = Object.fromEntries(atletas.map((a) => [a.id, a]));
  const dentro = miembros.filter((m) => !m.salido_en && A[m.atleta_id]?.estado !== 'baja');
  const sacados = miembros.filter((m) => m.bloqueado);
  const fuera = atletas.filter((a) => a.perfil_id && a.estado !== 'baja' && !miembros.some((m) => m.atleta_id === a.id && (!m.salido_en || m.bloqueado)));
  const hacer = async (atletaId, bloquear, texto) => {
    setOcupado(true);
    try { await api.expulsarDeComunidad(atletaId, bloquear); setSacar(null); aviso(texto); await lista.recargar(true); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <div class="pila">
      <p class="peq secundario">{dentro.length === 1 ? '1 atleta ha entrado' : `${dentro.length} atletas han entrado`}. Entrar es voluntario: los demás no ven nada de la comunidad.</p>
      {dentro.length > 0 && (
        <div class="panel"><ul class="lista">
          {dentro.map((m) => (
            <li key={m.atleta_id} class="panel-pad pila-s">
              <div class="separa">
                <span class="fila">
                  <Avatar nombre={m.nombre} foto={A[m.atleta_id]?.foto} clase="peq" />
                  <span class="pila-xs"><span>{m.nombre} {m.sin_ranking && <span class="chip">Sin ranking</span>}</span><span class="mini terciario">{A[m.atleta_id]?.nombre || ''} · entró el {fmtCorta(String(m.aceptado_en).slice(0, 10))}</span></span>
                </span>
                {sacar !== m.atleta_id && <button class="btn btn-peq plano btn-peligro" onClick={() => setSacar(m.atleta_id)}>Sacar del equipo</button>}
              </div>
              {sacar === m.atleta_id && (
                <div class="nota pila-s" role="group" aria-label={`Sacar a ${m.nombre} del equipo`}>
                  <span class="peq">¿Sacar a {m.nombre} del equipo? Lo suyo deja de verse y no podrá volver a entrar hasta que le readmitas.</span>
                  <span class="fila-envolver">
                    <button class="btn btn-peq" onClick={() => setSacar(null)}>Cancelar</button>
                    <button class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => hacer(m.atleta_id, true, `${m.nombre} ya no está en el equipo`)}>Sí, sacarle</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul></div>
      )}
      {sacados.length > 0 && (
        <section class="seccion">
          <h2>Sacados del equipo</h2>
          <div class="panel"><ul class="lista">
            {sacados.map((m) => (
              <li key={m.atleta_id} class="panel-pad separa">
                <span class="pila-xs"><span>{m.nombre}</span><span class="mini terciario">{A[m.atleta_id]?.nombre || ''}</span></span>
                <button class="btn btn-peq" disabled={ocupado} onClick={() => hacer(m.atleta_id, false, `${m.nombre} puede volver a entrar`)}>Volver a admitir</button>
              </li>
            ))}
          </ul></div>
        </section>
      )}
      {fuera.length > 0 && <p class="mini terciario">Sin entrar: {fuera.map((a) => a.nombre).join(', ')}.</p>}
    </div>
  );
}
