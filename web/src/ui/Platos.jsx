// La foto del plato y comer fuera (v0.174, migración 079).
//  - HojaFotoPlato: el atleta hace (o elige) la foto de lo que come; esa comida queda hecha. La ven su coach y él, 30 días.
//  - HojaFuera: come fuera de casa; le sale una pauta corta y la comida cuenta como hecha.
//  - FotoDeEntrada y PautaFuera: lo que se ve al abrir esa comida del menú.
//  - HojaPlatosSemana: las fotos de la semana de un atleta, para la revisión semanal del coach.
import { useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Icono, Segmentos } from './comunes.jsx';
import { NOMBRE_TOMA, ordenarTomas } from '../logica/comidas.js';
import { pautaFuera, proteinaPorComida, fotosPorDia, DIAS_FOTO, TEXTO_FOTO } from '../logica/platos.js';
import { objetivoDelDia } from '../logica/nutricion.js';
import { fmtConDia, sumarDias, hoyISO } from '../logica/fechas.js';
import { prepararPlato } from './plato-foto.js';

const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ¿Tiene la base la migración 079? (true | false | null: no se sabe; solo con false se esconde)
export function usePlatos() {
  const { api } = useApp();
  const r = useCarga(() => api.platosDisponibles(), [], { recuerdo: `platos-079:${api.uid()}` });
  return r.datos !== false;
}

// Los dos accesos, encima de las recetas al añadir una comida y en «Tu menú de hoy»
export function BotonesPlato({ alFoto = null, alFuera = null, clase = '' }) {
  if (!alFoto && !alFuera) return null;
  return (
    <div class={`platos-botones ${clase}`}>
      {alFoto && <button type="button" class="btn plato-boton" onClick={alFoto}><Icono n="camara" /> Foto del plato</button>}
      {alFuera && <button type="button" class="btn plato-boton" onClick={alFuera}><Icono n="ubicacion" /> Como fuera</button>}
    </div>
  );
}

// La foto de una comida: de una del menú (entrada) o de una nueva en esa fecha (y la comida que elija, si hay varias)
export function HojaFotoPlato({ atletaId, fecha, toma = null, tomas = [], entrada = null, alCerrar, alGuardado }) {
  const { api, aviso } = useApp();
  const camara = useRef(null), galeria = useRef(null);
  const [plato, setPlato] = useState(null);       // { foto, mini }
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState(null);
  const opciones = ordenarTomas(tomas.length ? tomas : [toma || 'comida']);
  const [laToma, setLaToma] = useState(entrada?.toma || (opciones.includes(toma) ? toma : opciones[0]));
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const elegida = async (ev) => {
    const archivo = ev.currentTarget.files?.[0];
    ev.currentTarget.value = '';
    if (!archivo) return;
    setError(null); setPreparando(true);
    try { setPlato(await prepararPlato(archivo)); } catch (e) { setPlato(null); setError(e.message); } finally { setPreparando(false); }
  };
  const guardar = () => una(async () => {
    try {
      await api.guardarFotoPlato(atletaId, { entrada, fecha, toma: laToma, texto, ...plato });
      aviso('Foto guardada: comida hecha', 'ok');
      alGuardado?.(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo={entrada ? `Foto de ${entrada.texto}` : 'Foto del plato'} alCerrar={alCerrar}>
      <div class="pila">
        <input ref={camara} type="file" accept="image/*" capture="environment" class="sr" tabIndex={-1} aria-label="Hacer la foto del plato" onChange={elegida} />
        <input ref={galeria} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Elegir la foto del plato" onChange={elegida} />
        {plato ? <img class="plato-vista" src={plato.foto} alt="La foto de tu plato" /> : (
          <div class="plato-hueco" aria-hidden="true"><Icono n="camara" /></div>
        )}
        {error && <p class="peq texto-aviso" role="alert">{error}</p>}
        <div class="fila-envolver">
          <button type="button" class={`btn ${plato ? '' : 'btn-primario'}`} disabled={preparando || ocupado} onClick={() => camara.current?.click()}><Icono n="camara" /> {plato ? 'Repetir la foto' : 'Hacer la foto'}</button>
          <button type="button" class="btn" disabled={preparando || ocupado} onClick={() => galeria.current?.click()}><Icono n="imagen" /> Elegir de la galería</button>
        </div>
        {preparando && <p class="peq secundario" role="status">Preparando la foto…</p>}
        {!entrada && (
          <>
            {opciones.length > 1 && <Segmentos etiqueta="Qué comida es" clase="plato-tomas" opciones={opciones.map((t) => [t, NOMBRE_TOMA[t]])} valor={laToma} alCambiar={(v) => v && setLaToma(v)} />}
            <label class="campo"><span class="etq">Qué es <span class="terciario">(si quieres)</span></span>
              <input class="entrada" maxLength={120} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Arroz con pollo, el menú del día…" /></label>
          </>
        )}
        <button type="button" class="btn btn-primario" disabled={!plato || preparando || ocupado} onClick={guardar}><Icono n="hecho" /> Guardar y marcar como hecha</button>
        <p class="mini terciario">La veis tu coach y tú. Se guarda {DIAS_FOTO} días y después se borra sola. Va sin la ubicación ni los datos de la cámara.</p>
      </div>
    </Hoja>
  );
}

// La pauta corta de comer fuera (en la hoja de apuntarla y al abrir esa comida)
export function PautaFuera({ toma, plan = null, tomas = [] }) {
  const p = pautaFuera({ toma, proteina: proteinaPorComida(objetivoDelDia(plan, true)?.proteina, tomas) });
  return (
    <section class="panel panel-pad pila-s pauta-fuera" aria-labelledby="pauta-fuera-t">
      <h3 id="pauta-fuera-t" class="h-panel">{p.titulo}</h3>
      <ol class="pauta-fuera-lista">{p.puntos.map((x) => <li key={x}>{x}</li>)}</ol>
    </section>
  );
}

// Comer fuera: la pauta y el botón de apuntarla (cuenta como hecha)
export function HojaFuera({ atletaId, fecha, toma = null, tomas = [], plan = null, alCerrar, alGuardado }) {
  const { api, aviso } = useApp();
  const opciones = ordenarTomas(tomas.length ? tomas : [toma || 'comida']);
  const [laToma, setLaToma] = useState(opciones.includes(toma) ? toma : opciones[0]);
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  // Un día que aún no ha llegado se apunta sin hacer (la marcará ese día)
  const futura = fecha > hoyISO();
  const guardar = () => una(async () => {
    try {
      await api.apuntarFuera(atletaId, { fecha, toma: laToma, texto, hecho: !futura });
      aviso(futura ? 'Apuntada en tu menú' : 'Apuntada: cuenta como hecha', 'ok');
      alGuardado?.(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Como fuera" alCerrar={alCerrar}>
      <div class="pila">
        {opciones.length > 1 && <Segmentos etiqueta="Qué comida es" clase="plato-tomas" opciones={opciones.map((t) => [t, NOMBRE_TOMA[t]])} valor={laToma} alCambiar={(v) => v && setLaToma(v)} />}
        <PautaFuera toma={laToma} plan={plan} tomas={tomas} />
        <label class="campo"><span class="etq">Dónde o qué <span class="terciario">(si quieres)</span></span>
          <input class="entrada" maxLength={120} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Cena con amigos, menú del día, boda…" /></label>
        <button type="button" class="btn btn-primario" disabled={ocupado} onClick={guardar}><Icono n="hecho" /> {futura ? 'Apuntarla en el menú' : 'Apuntarla como hecha'}</button>
        <p class="mini terciario">{futura ? 'Ese día la marcas y cuenta como una comida hecha.' : 'Cuenta como una comida hecha de tu día.'} Tu coach verá que es fuera de casa.</p>
      </div>
    </Hoja>
  );
}

// Al abrir una comida con foto: la foto entera (o que ya no se guarda)
export function FotoDeEntrada({ e }) {
  const { api } = useApp();
  const foto = useCarga(() => api.fotoPlato(e.id), [e.id]);
  if (foto.cargando && foto.datos === undefined) return <div class="plato-hueco cargando" role="status" aria-label="Cargando la foto" />;
  if (!foto.datos?.foto) return <p class="peq secundario">La foto ya no se guarda: pasados {DIAS_FOTO} días se borran solas.</p>;
  return <img class="plato-vista" src={foto.datos.foto} alt={`Foto de ${e.texto === TEXTO_FOTO ? 'el plato' : e.texto}`} />;
}

// La miniatura en la fila del menú
export function MiniPlato({ mini }) {
  return mini ? <img class="plato-mini" src={mini} alt="" loading="lazy" /> : <span class="plato-mini sin" aria-hidden="true"><Icono n="camara" /></span>;
}

// (coach) Las fotos de la semana de un atleta, por días; al tocar una, entera
export function HojaPlatosSemana({ atleta, lunes, alCerrar }) {
  const { api } = useApp();
  const fotos = useCarga(() => Promise.all([api.fotosPlatos(atleta.id, lunes, sumarDias(lunes, 6)), api.menuSemana(atleta.id, lunes).catch(() => [])]), [atleta.id, lunes]);
  const [abierta, setAbierta] = useState(null);
  const [lista, menu] = fotos.datos || [[], []];
  const porDia = fotosPorDia(lista);
  const entrada = (id) => menu.find((m) => m.id === id);
  if (abierta) {
    return (
      <Hoja titulo={`${NOMBRE_TOMA[abierta.toma] || 'Comida'}, ${fmtConDia(abierta.fecha)}`} alCerrar={() => setAbierta(null)}>
        <div class="pila"><FotoDeEntrada e={abierta} />{abierta.texto !== TEXTO_FOTO && <p class="peq">{abierta.texto}</p>}</div>
      </Hoja>
    );
  }
  return (
    <Hoja titulo={`Platos de ${atleta.nombre.split(' ')[0]}`} alCerrar={alCerrar} ancho={620}>
      <div class="pila">
        {fotos.cargando && !fotos.datos ? <p class="peq secundario" role="status">Cargando las fotos…</p> : !lista.length ? <p class="peq secundario">Esta semana no ha subido fotos de sus platos.</p> : (
          Object.keys(porDia).sort().map((d) => (
            <section key={d} class="pila-xs">
              <h3 class="etq">{mayus(fmtConDia(d))}</h3>
              <ul class="platos-tira">
                {porDia[d].map((f) => { const m = entrada(f.entrada_id) || { id: f.entrada_id, fecha: d, toma: null, texto: TEXTO_FOTO }; return (
                  <li key={f.entrada_id}><button type="button" class="plato-celda" onClick={() => setAbierta(m)} aria-label={`${NOMBRE_TOMA[m.toma] || 'Comida'}: ver la foto`}>
                    <img src={f.mini} alt="" loading="lazy" /><span class="mini">{NOMBRE_TOMA[m.toma] || 'Comida'}</span></button></li>
                ); })}
              </ul>
            </section>
          ))
        )}
        <p class="mini terciario">Las fotos se guardan {DIAS_FOTO} días.</p>
      </div>
    </Hoja>
  );
}
