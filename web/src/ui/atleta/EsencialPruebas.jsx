// (v0.255) «Tus pruebas» de FBE Esencial: levantarte de la silla en 30 segundos, 10 segundos sobre una pierna, cintura y
// altura, la prensión (si tiene dinamómetro) y, desde los 65, el SPPB. En su punto de partida y cada 12 semanas, con «Tu
// trimestre»; siempre a mano en «¿Qué necesitas?» → «Mis pruebas». Decisiones de Pelayo del 26/11/2026 (preguntas 5b a 9a
// y 24a de «claude/esencial-herramientas-integracion.md»). Los cortes, los textos y cómo se hace cada una son los de las
// herramientas de la web (logica/esencial-pruebas.js); un resultado bajo dice «coméntalo con tu médico» y no cambia su plan.
// Se guardan con la migración 108 (datos/api-pruebas.js), con su consentimiento de salud. Sin la 108, nada de esto sale.
// Aquí: la hoja (la lista, cada prueba con su cronómetro y su resultado, y el informe para su médico), la tarjeta de Hoy
// cuando toca y su trozo en «Tu trimestre». Estilos: pruebas.css (clases prb-*, escritas tal cual en el elemento).
import { useState, useEffect, useRef } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Icono, GrupoIos, FilaIos, Segmentos } from '../comunes.jsx';
import { BotonMantener } from '../Mantener.jsx';
import { Arte } from './EsencialArte.jsx';
import * as P from '../../logica/esencial-pruebas.js';
import { hoyISO, sumarDias, fmtCorta } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { WEB_FBE } from '../../logica/esencial.js';
import { prepararAudio, tono, vibrarCorto, vibrarAviso, usePantallaEncendida } from './sesion-audio.js';
import { CasillaCasa } from './CasillaCasa.jsx';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const numero = (t) => { const x = Number(String(t ?? '').replace(',', '.').trim()); return String(t ?? '').trim() === '' || !Number.isFinite(x) ? null : x; };
const COMPARA = { mejor: 'mejor que entonces', igual: 'igual que entonces', peor: 'peor que entonces' };
const QUE_ES = 'Unas pruebas sencillas para ver cómo estás de fuerza, de equilibrio y de cintura. Hazlas ahora y cada 12 semanas: en «Tu trimestre» verás el antes y el ahora. Los resultados no cambian tu plan.';
const claveDina = (id) => `fbe-pruebas-dina:${id}`;
const claveLuego = (id) => `fbe-pruebas-luego:${id}`;

// Lo que tiene guardado (y si está la 108), para la hoja, la tarjeta y el trimestre
function usePruebas(vuelta = 0) {
  const { backend, atleta } = useApp();
  return useCarga(async () => {
    const m = await import('../../datos/api-pruebas.js');
    const hay = await m.hay108(backend).catch(() => false);
    return { m, hay, filas: hay ? await m.pruebas(backend, atleta.id).catch(() => []) : [] };
  }, [atleta.id, vuelta]);
}

// 3, 2, 1 y, después, cada 100 ms, los segundos que lleva (alTic devuelve true para parar)
function useCuenta() {
  const t = useRef(null);
  useEffect(() => () => clearInterval(t.current), []);
  const parar = () => { clearInterval(t.current); t.current = null; };
  const arrancar = ({ alPrep, alEmpezar, alTic }) => {
    parar();
    try { prepararAudio(); } catch { /* sin audio */ }
    let c = 3;
    alPrep(c); tono(660, 0.12);
    t.current = setInterval(() => {
      c--;
      if (c > 0) { alPrep(c); tono(660, 0.12); return; }
      clearInterval(t.current);
      const ini = performance.now();
      alEmpezar(); tono(1100, 0.2);
      t.current = setInterval(() => { if (alTic((performance.now() - ini) / 1000)) parar(); }, 100);
    }, 1000);
  };
  return { arrancar, parar };
}

// ---------- La hoja: la lista, cada prueba y el informe ----------
export function HojaPruebas({ p = null, alCerrar, inicial = null, alGuardada = null }) {
  const { api, backend, atleta, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const d = usePruebas(vuelta);
  const nut = useCarga(() => import('../../datos/api-nutricion.js').then((n) => n.perfil(backend, atleta.id)).catch(() => null), [atleta.id]);
  // (Pelayo, 26/11/2026: en FBE Esencial la cintura se mide siempre como NICE) la que apuntó hoy, ya puesta en la prueba
  const med = useCarga(() => (api.medidas ? api.medidas(atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id]);
  const [vista, setVista] = useState(inicial);
  const [yo, setYo] = useState({});
  const [dina, setDina] = useState(() => leer(claveDina(atleta.id)) === '1');
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  usePantallaEncendida();
  const hoy = hoyISO();
  const filas = d.datos?.filas || [];
  const ult = filas[0] || null;
  const n = nut.datos;
  const edadIni = ult?.edad ?? (n?.anio_nacimiento ? Number(hoy.slice(0, 4)) - Number(n.anio_nacimiento) : null);
  const edadT = yo.edad ?? (edadIni != null ? String(edadIni) : '');
  const edad = numero(edadT);
  const edadOk = Number.isInteger(edad) && edad >= 18 && edad <= 110;
  const sexo = yo.sexo !== undefined ? yo.sexo : (ult?.sexo || n?.sexo || null);
  const listo = edadOk && !!sexo;
  const altura = filas.find((f) => f.prueba === 'cintura')?.detalle?.altura ?? n?.altura ?? null;
  const cinturaHoy = (med.datos || []).find((m) => String(m.fecha).slice(0, 10) === hoy && Number(m.cintura_cm) > 0)?.cintura_cm ?? null;
  const conDina = dina || filas.some((f) => f.prueba === 'prension');
  const lista = P.pruebasDe({ edad: edadOk ? edad : null, dinamometro: conDina });
  const u = P.ultimasPruebas(filas);
  const toca = filas.length ? P.tocaPruebas(filas, hoy) : null;
  const volver = () => { setVista(null); setError(null); };
  const guardar = (fila) => una(async () => {
    setError(null);
    if (fila?.error) { setError(fila.error); return; }
    if (!d.datos?.m) return;
    try {
      const r = await d.datos.m.guardarPrueba(backend, fila, { edad: edadOk ? edad : null, sexo });
      if (r?.falta108) { setError('Para guardarla falta una actualización en la base: dísela a Pelayo.'); return; }
      aviso('Tu prueba, guardada');
      setVuelta((x) => x + 1);
      alGuardada?.();
      volver();
    } catch (e) {
      setError(/consentimiento/.test(e?.message || '') ? 'Para guardarla hace falta tu consentimiento de datos de salud (en Perfil). Tu resultado de hoy no se ha guardado.' : e.message);
    }
  });
  const borrarTodas = () => una(async () => {
    setError(null);
    if (!d.datos?.m) return;
    try { await d.datos.m.borrarPruebas(backend, atleta.id); setBorrar(false); setVuelta((x) => x + 1); aviso('Tus pruebas, borradas'); } catch (e) { setError(e.message); }
  });
  const comun = { edad: edadOk ? edad : null, sexo, ocupado, error, alGuardar: guardar };
  const titulo = vista === 'informe' ? 'Informe para tu médico' : vista ? P.NOMBRE_PRUEBA[vista] : 'Tus pruebas';
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <div class="pila prb-hoja" aria-busy={d.cargando ? 'true' : 'false'}>
        {vista && <button type="button" class="btn-texto peq prb-volver" onClick={volver}><Icono n="atras" /> Tus pruebas</button>}
        {vista === 'silla' && <PruebaSilla {...comun} anterior={u.silla?.ultima || null} />}
        {vista === 'equilibrio' && <PruebaEquilibrio {...comun} anterior={u.equilibrio?.ultima || null} />}
        {vista === 'cintura' && <PruebaCintura {...comun} altura={altura} cintura={cinturaHoy} anterior={u.cintura?.ultima || null} />}
        {vista === 'prension' && <PruebaPrension {...comun} anterior={u.prension?.ultima || null} />}
        {vista === 'sppb' && <PruebaSPPB {...comun} anterior={u.sppb?.ultima || null} />}
        {vista === 'informe' && <InformeMedico filas={filas} p={p} />}
        {!vista && (
          <>
            <Arte id="esencial-pruebas" />
            <p class="secundario">{QUE_ES}</p>
            {d.datos && !d.datos.hay && <p class="peq secundario" role="status">Para guardar tus pruebas falta una actualización en la base: dísela a Pelayo.</p>}
            <section class="prb-yo" aria-labelledby="prb-yo-t">
              <strong class="peq" id="prb-yo-t">Para compararte con los valores de referencia: tu edad y tu sexo</strong>
              <div class="prb-yo-f">
                <label class="pila-xs"><span class="etq">Tu edad</span>
                  <input class="entrada num prb-edad" inputMode="numeric" value={edadT} placeholder="años" onInput={(ev) => setYo({ ...yo, edad: ev.currentTarget.value })} /></label>
                <span class="pila-xs"><span class="etq" id="prb-sexo-t">Sexo</span>
                  <Segmentos etiqueta="Sexo" opciones={[['mujer', 'Mujer'], ['hombre', 'Hombre']]} valor={sexo} alCambiar={(v) => setYo({ ...yo, sexo: v })} /></span>
              </div>
              {edadT !== '' && !edadOk && <span class="mini error">Tu edad, de 18 a 110 años.</span>}
              <label class="prb-check peq"><CasillaCasa checked={conDina} disabled={filas.some((f) => f.prueba === 'prension')}
                onChange={(ev) => { setDina(ev.currentTarget.checked); guardarLocal(claveDina(atleta.id), ev.currentTarget.checked ? '1' : null); }} /> Tengo un dinamómetro de mano (para la prensión)</label>
            </section>
            <GrupoIos titulo="Tus pruebas" id="prb-lista-t" pie={edadOk && edad >= P.EDAD_SPPB ? 'El SPPB es opcional: tres pruebas en una, desde los 65 años.' : null}>
              {lista.map((k) => {
                const x = u[k]?.ultima || null;
                const detalle = x ? `${P.valorTexto(k, x.valor)}, el ${fechaLarga(String(x.fecha).slice(0, 10))}` : 'Sin hacer';
                return listo
                  ? <FilaIos key={k} icono={P.ICONO_PRUEBA[k]} titulo={P.NOMBRE_PRUEBA[k]} detalle={detalle} alTocar={() => { setError(null); setVista(k); }} etiqueta={`${P.NOMBRE_PRUEBA[k]}: ${detalle}`} />
                  : <FilaIos key={k} icono={P.ICONO_PRUEBA[k]} titulo={P.NOMBRE_PRUEBA[k]} detalle={x ? detalle : 'Antes, tu edad y tu sexo'} />;
              })}
            </GrupoIos>
            {toca && <p class="peq secundario" role="status">{toca.toca ? `Toca repetirlas: tus últimas pruebas son del ${fechaLarga(toca.desde)}.` : `La próxima vez, el ${fechaLarga(sumarDias(toca.desde, P.CADA_DIAS))}: a las 12 semanas.`}</p>}
            {error && <p class="error" role="alert">{error}</p>}
            {filas.length > 0 && (
              <span class="fila-envolver">
                <button type="button" class="btn" onClick={() => setVista('informe')}><Icono n="documento" /> Informe para tu médico</button>
                {/* (tacto 206) manteniéndolo pulsado un segundo, las borra sin preguntar; con un toque, la pregunta de siempre */}
                {!borrar && <BotonMantener clase="btn-texto peq" deshabilitado={ocupado} alConfirmar={borrarTodas} alPreguntar={() => setBorrar(true)}><Icono n="basura" /> Borrar mis pruebas</BotonMantener>}
              </span>
            )}
            {borrar && (
              <div class="prb-borrar" role="group" aria-label="Borrar tus pruebas">
                <span class="peq">¿Borrar todas tus pruebas? No se puede deshacer.</span>
                <span class="fila-envolver">
                  <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={borrarTodas}>Borrar</button>
                  <button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>Cancelar</button>
                </span>
              </div>
            )}
            <details class="prb-fuentes">
              <summary class="peq">De dónde salen los números</summary>
              <ul class="pila-xs">{P.PRUEBAS.map((k) => <li key={k} class="mini terciario"><strong>{P.NOMBRE_CORTO[k]}</strong>: {P.FUENTES_PRUEBA[k].join(' ')}</li>)}</ul>
              <a class="btn-texto mini" href={`${WEB_FBE}/fuentes.html`} target="_blank" rel="noopener">Todas las fuentes, en la web</a>
            </details>
          </>
        )}
      </div>
    </Hoja>
  );
}

// Cómo se hace (los pasos de la web) y su aviso
function Como({ prueba, abierto = true }) {
  const pasos = P.COMO_PRUEBA[prueba] || [];
  return (
    <details class="prb-como" open={abierto}>
      <summary class="peq">Cómo se hace</summary>
      {pasos.length > 1 ? <ol class="prb-pasos">{pasos.map((x) => <li key={x} class="peq">{x}</li>)}</ol> : <p class="peq">{pasos[0]}</p>}
      {P.AVISO_PRUEBA[prueba] && <p class="peq prb-aviso">{P.AVISO_PRUEBA[prueba]}</p>}
    </details>
  );
}

// El resultado: la cifra, lo que dice la web, la vez anterior y «Guardar»
function Resultado({ prueba, r, valor, anterior, fila, ocupado, error, alGuardar, rotulo = null }) {
  if (!r) return null;
  const c = anterior ? P.comparar(prueba, { valor }, anterior) : null;
  return (
    <section class={`prb-res prb-tono-${r.zona || 'sin'}`} aria-labelledby="prb-res-t">
      <Arte id={r.zona === 'bajo' ? 'esencial-pruebas-consulta' : c === 'mejor' ? 'esencial-pruebas-mejora' : 'esencial-pruebas-resultado'} />
      <span class="record-valor num prb-cifra">{P.valorTexto(prueba, valor)}</span>
      {rotulo && <span class="peq secundario">{rotulo}</span>}
      <strong id="prb-res-t" role="status">{r.titulo}</strong>
      <p class="peq">{r.texto}</p>
      {/* (belleza B97, v0.286) el antes y el hoy, en dos columnas con su flecha (la frase entera, para el lector de pantalla) */}
      {anterior && (
        <div class="prb-antes prb-ab">
          <span class="sr">La vez anterior, el {fechaLarga(String(anterior.fecha).slice(0, 10))}: {P.valorTexto(prueba, anterior.valor)}{c ? `, ${COMPARA[c]}` : ''}.</span>
          <span class="prb-ab-col" aria-hidden="true"><span class="mini secundario">Antes · {fmtCorta(String(anterior.fecha).slice(0, 10))}</span><strong class="num">{P.valorTexto(prueba, anterior.valor)}</strong></span>
          <span class="prb-ab-flecha" aria-hidden="true"><Icono n="derecha" class="prb-ab-ico" /></span>
          <span class="prb-ab-col" aria-hidden="true"><span class="mini secundario">Hoy</span><strong class="num">{P.valorTexto(prueba, valor)}</strong></span>
          {c && <strong class={`mini prb-ab-${c}`} aria-hidden="true">{COMPARA[c]}</strong>}
        </div>
      )}
      {error && <p class="error" role="alert">{error}</p>}
      <button type="button" class="btn btn-primario prb-guardar" disabled={ocupado} onClick={() => alGuardar(fila)}><Icono n="guardar" /> Guardar</button>
    </section>
  );
}

// ---------- La silla en 30 segundos: cuenta atrás de 3, 30 segundos y «+1 de pie» ----------
function PruebaSilla({ edad, sexo, anterior, ...g }) {
  const [fase, setFase] = useState('listo');   // listo · prep · corre · fin
  const [num, setNum] = useState(30);
  const [veces, setVeces] = useState('');
  const [ver, setVer] = useState(false);
  const { arrancar, parar } = useCuenta();
  const empezar = () => {
    setVer(false); setVeces('0');
    arrancar({
      alPrep: (c) => { setFase('prep'); setNum(c); },
      alEmpezar: () => { setFase('corre'); setNum(30); },
      alTic: (s) => {
        const q = Math.max(0, Math.ceil(30 - s));
        setNum(q);
        if (q > 0) return false;
        setFase('fin'); setVer(true); tono(1320, 0.6); vibrarAviso();
        return true;
      },
    });
  };
  const mas = () => { setVeces((v) => String(Math.min(60, (Number(v) || 0) + 1))); vibrarCorto(20); tono(880, 0.05); };
  const nV = numero(veces);
  const r = ver && Number.isInteger(nV) ? P.resultadoSilla({ veces: nV, edad, sexo }) : null;
  return (
    <div class="pila">
      <Arte id="esencial-prueba-silla" />
      <Como prueba="silla" abierto={fase === 'listo' && !ver} />
      <div class={`prb-reloj prb-fase-${fase}`} role="timer" aria-live="off" aria-label={fase === 'corre' ? `Quedan ${num} segundos` : 'Cronómetro de 30 segundos'}>
        <span class="tiempo-grados num prb-reloj-n">{fase === 'listo' ? 30 : num}</span>
        <span class="mini terciario">{fase === 'prep' ? 'prepárate' : fase === 'fin' ? 'tiempo' : 'segundos'}</span>
      </div>
      <span class="fila-envolver prb-botones">
        {(fase === 'listo' || fase === 'fin') && <button type="button" class="btn" onClick={empezar}><Icono n="play" /> {fase === 'fin' ? 'Otra vez' : 'Empezar (cuenta atrás de 3)'}</button>}
        {(fase === 'prep' || fase === 'corre') && <button type="button" class="btn-texto peq" onClick={() => { parar(); setFase('listo'); }}><Icono n="parar" /> Parar</button>}
      </span>
      <button type="button" class="prb-mas" disabled={fase !== 'corre'} onClick={mas} aria-label={`Más uno de pie: llevas ${Number(veces) || 0}`}>
        <span class="peq">+1 de pie</span><span class="record-valor num">{Number(veces) || 0}</span>
      </button>
      <label class="pila-xs"><span class="etq">Veces que te levantas</span>
        <input class="entrada num prb-campo" inputMode="numeric" value={veces} placeholder="0" onInput={(ev) => { setVeces(ev.currentTarget.value); setVer(false); }} /></label>
      <span class="mini terciario">Lo rellena el contador; también puedes escribirlo o corregirlo.</span>
      {!ver && veces !== '' && fase !== 'corre' && fase !== 'prep' && <button type="button" class="btn btn-primario" style="justify-self:start" disabled={!Number.isInteger(nV) || nV < 0 || nV > 60} onClick={() => setVer(true)}>Ver el resultado</button>}
      <Resultado prueba="silla" r={r} valor={nV} anterior={anterior} fila={r ? P.filaPrueba('silla', { veces: nV, edad, sexo }) : null} {...g} />
    </div>
  );
}

// ---------- 10 segundos sobre una pierna: tres intentos, «He apoyado el pie» ----------
function PruebaEquilibrio({ edad, anterior, ...g }) {
  const [intentos, setIntentos] = useState([]);
  const [fase, setFase] = useState('listo');   // listo · prep · corre
  const [num, setNum] = useState(10);
  const [aMano, setAMano] = useState(false);
  const [mano, setMano] = useState(['', '', '']);
  const lleva = useRef(0);
  const { arrancar, parar } = useCuenta();
  const xs = aMano ? mano.map(numero).filter((x) => x != null) : intentos;
  const r = P.resultadoEquilibrio({ intentos: xs, edad });
  const empezar = () => arrancar({
    alPrep: (c) => { setFase('prep'); setNum(c); },
    alEmpezar: () => { setFase('corre'); setNum(10); lleva.current = 0; },
    alTic: (s) => {
      lleva.current = s;
      setNum(Math.max(0, Math.ceil(10 - s)));
      if (s < 10) return false;
      setFase('listo'); setIntentos((a) => [...a, 10]); tono(1320, 0.6); vibrarAviso();
      return true;
    },
  });
  const apoyado = () => { if (fase !== 'corre') return; parar(); setFase('listo'); setIntentos((a) => [...a, Math.round(lleva.current * 10) / 10]); tono(440, 0.2); vibrarCorto(40); };
  const quedan = !r && !aMano;
  return (
    <div class="pila">
      <Arte id="esencial-prueba-equilibrio" />
      <Como prueba="equilibrio" abierto={!intentos.length && fase === 'listo'} />
      {!aMano && (
        <>
          <div class={`prb-reloj prb-fase-${fase}`} role="timer" aria-live="off" aria-label={fase === 'corre' ? `Quedan ${num} segundos` : 'Cronómetro de 10 segundos'}>
            <span class="tiempo-grados num prb-reloj-n">{fase === 'listo' ? 10 : num}</span>
            <span class="mini terciario">{fase === 'prep' ? 'prepárate' : 'segundos'}</span>
          </div>
          <span class="prb-dots" aria-label={`Intento ${Math.min(3, intentos.length + 1)} de 3`} role="img">
            {[0, 1, 2].map((i) => <i key={i} class={intentos[i] == null ? (i === intentos.length && !r ? 'prb-dot prb-dot-ya' : 'prb-dot') : intentos[i] >= 10 ? 'prb-dot prb-dot-ok' : 'prb-dot prb-dot-mal'} />)}
          </span>
          {intentos.length > 0 && !r && <p class="peq secundario" role="status">{`Intento ${intentos.length + 1} de 3 · has aguantado ${String(intentos[intentos.length - 1]).replace('.', ',')} s. Descansa un momento y prueba otra vez.`}</p>}
          <span class="fila-envolver prb-botones">
            {quedan && fase === 'listo' && <button type="button" class="btn" onClick={empezar}><Icono n="play" /> {intentos.length ? 'Otro intento (cuenta atrás de 3)' : 'Empezar (cuenta atrás de 3)'}</button>}
            {fase === 'corre' && <button type="button" class="btn btn-primario prb-apoyo" onClick={apoyado}>He apoyado el pie</button>}
            {fase === 'prep' && <button type="button" class="btn-texto peq" onClick={() => { parar(); setFase('listo'); }}><Icono n="parar" /> Parar</button>}
            {r && <button type="button" class="btn-texto peq" onClick={() => { setIntentos([]); setFase('listo'); }}><Icono n="reiniciar" /> Otra vez, desde el principio</button>}
          </span>
        </>
      )}
      {aMano && (
        <div class="prb-tres" role="group" aria-label="Los segundos de cada intento">
          {[0, 1, 2].map((i) => (
            <label key={i} class="pila-xs"><span class="etq">Intento {i + 1}</span>
              <input class="entrada num prb-campo" inputMode="decimal" value={mano[i]} placeholder="s" aria-label={`Intento ${i + 1}, en segundos`}
                onInput={(ev) => { const m = [...mano]; m[i] = ev.currentTarget.value; setMano(m); }} /></label>
          ))}
        </div>
      )}
      {aMano && <span class="mini terciario">Los segundos que aguantaste en cada uno (10 = conseguido).</span>}
      {fase === 'listo' && <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setAMano(!aMano)}>{aMano ? 'Con el cronómetro' : 'Ya lo he hecho: apuntar los segundos'}</button>}
      <Resultado prueba="equilibrio" r={r} valor={r?.valor} rotulo={r?.categoria} anterior={anterior} fila={r ? P.filaPrueba('equilibrio', { intentos: xs, edad }) : null} {...g} />
    </div>
  );
}

// ---------- Cintura y altura ----------
function PruebaCintura({ altura = null, cintura = null, anterior, ...g }) {
  const [f, setF] = useState({ cintura: cintura != null ? String(cintura).replace('.', ',') : '', altura: altura != null ? String(altura).replace('.', ',') : '' });
  const c = numero(f.cintura), h = numero(f.altura);
  const r = c != null && h != null ? P.resultadoCintura({ cintura: c, altura: h }) : null;
  return (
    <div class="pila">
      <Arte id="esencial-prueba-cintura" />
      <Como prueba="cintura" />
      <div class="prb-dos">
        <label class="pila-xs"><span class="etq">Cintura (cm)</span><input class="entrada num prb-campo" inputMode="decimal" value={f.cintura} placeholder="85" onInput={(ev) => setF({ ...f, cintura: ev.currentTarget.value })} /></label>
        <label class="pila-xs"><span class="etq">Altura (cm)</span><input class="entrada num prb-campo" inputMode="decimal" value={f.altura} placeholder="170" onInput={(ev) => setF({ ...f, altura: ev.currentTarget.value })} /></label>
      </div>
      {c != null && h != null && !r && <p class="mini error">Revisa tu cintura y tu altura.</p>}
      <Resultado prueba="cintura" r={r} valor={r?.valor} rotulo={r?.categoria} anterior={anterior} fila={r ? P.filaPrueba('cintura', { cintura: c, altura: h }) : null} {...g} />
    </div>
  );
}

// ---------- La prensión, con dinamómetro: hasta tres intentos, cuenta el mejor ----------
function PruebaPrension({ sexo, anterior, ...g }) {
  const [xs, setXs] = useState(['', '', '']);
  const ns = xs.map(numero).filter((x) => x != null && x > 0 && x < 200);
  const r = P.resultadoPrension({ intentos: ns, sexo });
  return (
    <div class="pila">
      <Arte id="esencial-prueba-prension" />
      <Como prueba="prension" />
      <div class="prb-tres" role="group" aria-label="Tus intentos, en kilos">
        {[0, 1, 2].map((i) => (
          <label key={i} class="pila-xs"><span class="etq">Intento {i + 1} (kg)</span>
            <input class="entrada num prb-campo" inputMode="decimal" value={xs[i]} placeholder="kg" onInput={(ev) => { const m = [...xs]; m[i] = ev.currentTarget.value; setXs(m); }} /></label>
        ))}
      </div>
      <span class="mini terciario">Apunta los intentos de las dos manos; cuenta el mejor.</span>
      <Resultado prueba="prension" r={r} valor={r?.valor} anterior={anterior} fila={r ? P.filaPrueba('prension', { intentos: ns, sexo }) : null} {...g} />
    </div>
  );
}

// Un cronómetro que escribe sus segundos en un campo (la marcha y las cinco levantadas del SPPB)
function Cronometro({ etiqueta, alParar }) {
  const [va, setVa] = useState(false);
  const [s, setS] = useState(0);
  const t = useRef(null), ini = useRef(0);
  useEffect(() => () => clearInterval(t.current), []);
  const tocar = () => {
    if (va) { clearInterval(t.current); setVa(false); alParar(Math.round(((performance.now() - ini.current) / 1000) * 100) / 100); return; }
    try { prepararAudio(); } catch { /* */ }
    ini.current = performance.now(); setS(0); setVa(true); tono(1100, 0.15);
    t.current = setInterval(() => setS((performance.now() - ini.current) / 1000), 50);
  };
  return <button type="button" class={va ? 'btn btn-peq btn-primario' : 'btn btn-peq'} onClick={tocar} aria-label={va ? `Parar el cronómetro de ${etiqueta}` : `Cronometrar ${etiqueta}`}>
    <Icono n={va ? 'parar' : 'reloj'} /> {va ? `${s.toFixed(2).replace('.', ',')} s · parar` : 'Cronometrar'}</button>;
}

// ---------- El SPPB (desde los 65, opcional): equilibrio, marcha de 4 metros y cinco levantadas ----------
function PruebaSPPB({ anterior, ...g }) {
  const [x, setX] = useState({ lado: null, semi: null, tandem: null, m1: '', m2: '', mNo: false, s1: null, s5: '', sNo: false });
  const [diez, setDiez] = useState(0);
  const t = useRef(null);
  useEffect(() => () => clearInterval(t.current), []);
  const pon = (k, v) => setX((a) => ({ ...a, [k]: v }));
  const contar = () => {
    try { prepararAudio(); } catch { /* */ }
    clearInterval(t.current);
    const fin = performance.now() + 10000;
    setDiez(10);
    t.current = setInterval(() => { const q = Math.ceil((fin - performance.now()) / 1000); if (q <= 0) { clearInterval(t.current); setDiez(-1); tono(1320, 0.5); vibrarAviso(); } else setDiez(q); }, 100);
  };
  const seg = (v) => (v === '10' ? 10 : v === '0' ? 0 : null);
  const d = {
    lado: seg(x.lado),
    semi: x.lado === '10' ? seg(x.semi) : null,
    tandem: x.lado === '10' && x.semi === '10' ? (x.tandem === '2' ? 10 : x.tandem === '1' ? 5 : x.tandem === '0' ? 0 : null) : null,
    marcha: x.mNo ? null : [numero(x.m1), numero(x.m2)].filter((v) => v != null && v > 0),
    silla: x.s1 === 'no' ? 0 : x.s1 === 'si' ? (x.sNo ? 0 : numero(x.s5) > 0 ? numero(x.s5) : null) : null,
  };
  const r = P.puntuarSPPB(d);
  const SI_NO = [['10', 'Aguantas 10 s'], ['0', 'Menos de 10 s']];
  const pos = P.SPPB_PARTES.posturas;
  return (
    <div class="pila">
      <Arte id="esencial-prueba-sppb" />
      <p class="peq prb-aviso">{P.AVISO_PRUEBA.sppb}</p>
      <section class="prb-paso" aria-labelledby="prb-sppb-1">
        <span class="pila-xs"><strong class="peq" id="prb-sppb-1">1. {P.SPPB_PARTES.equilibrio[0]}</strong><span class="mini terciario">{P.SPPB_PARTES.equilibrio[1]}</span></span>
        <Arte id="esencial-prueba-tandem" />
        <button type="button" class="btn btn-peq" style="justify-self:start" onClick={contar}><Icono n="reloj" /> {diez > 0 ? `${diez} s…` : diez < 0 ? '¡10 segundos! Contar otra vez' : 'Contar 10 segundos'}</button>
        <span class="pila-xs"><span class="peq">{pos[0][1]}</span><Segmentos etiqueta={pos[0][1]} opciones={SI_NO} valor={x.lado} alCambiar={(v) => pon('lado', v)} /></span>
        {x.lado === '10' && <span class="pila-xs"><span class="peq">{pos[1][1]}</span><Segmentos etiqueta={pos[1][1]} opciones={SI_NO} valor={x.semi} alCambiar={(v) => pon('semi', v)} /></span>}
        {x.lado === '10' && x.semi === '10' && <span class="pila-xs"><span class="peq">{pos[2][1]}</span>
          <Segmentos etiqueta={pos[2][1]} opciones={[['2', '10 s'], ['1', 'De 3 a 9 s'], ['0', 'Menos de 3 s']]} valor={x.tandem} alCambiar={(v) => pon('tandem', v)} /></span>}
      </section>
      <section class="prb-paso" aria-labelledby="prb-sppb-2">
        <span class="pila-xs"><strong class="peq" id="prb-sppb-2">2. {P.SPPB_PARTES.marcha[0]}</strong><span class="mini terciario">{P.SPPB_PARTES.marcha[1]}</span></span>
        <Arte id="esencial-prueba-marcha" />
        {!x.mNo && (
          <div class="prb-dos">
            {['m1', 'm2'].map((k, i) => (
              <span key={k} class="pila-xs">
                <label class="pila-xs"><span class="etq">Intento {i + 1} (s)</span><input class="entrada num prb-campo" inputMode="decimal" value={x[k]} placeholder="s" onInput={(ev) => pon(k, ev.currentTarget.value)} /></label>
                <Cronometro etiqueta={`el intento ${i + 1} de la marcha`} alParar={(v) => pon(k, String(v).replace('.', ','))} />
              </span>
            ))}
          </div>
        )}
        <label class="prb-check peq"><CasillaCasa checked={x.mNo} onChange={(ev) => pon('mNo', ev.currentTarget.checked)} /> No puedo hacerlo</label>
      </section>
      <section class="prb-paso" aria-labelledby="prb-sppb-3">
        <span class="pila-xs"><strong class="peq" id="prb-sppb-3">3. {P.SPPB_PARTES.silla[0]}</strong><span class="mini terciario">{P.SPPB_PARTES.silla[1]}</span></span>
        <span class="pila-xs"><span class="peq">Primero, una vez: ¿te levantas sin usar los brazos?</span>
          <Segmentos etiqueta="¿Te levantas sin usar los brazos?" opciones={[['si', 'Sí'], ['no', 'No, necesito los brazos']]} valor={x.s1} alCambiar={(v) => pon('s1', v)} /></span>
        {x.s1 === 'si' && (
          <>
            {!x.sNo && (
              <span class="pila-xs">
                <label class="pila-xs"><span class="etq">Tiempo para levantarte 5 veces, lo más rápido posible (s)</span>
                  <input class="entrada num prb-campo" inputMode="decimal" value={x.s5} placeholder="s" onInput={(ev) => pon('s5', ev.currentTarget.value)} /></label>
                <span class="mini terciario">Del «ya» hasta que quedas de pie la quinta vez.</span>
                <Cronometro etiqueta="las 5 levantadas" alParar={(v) => pon('s5', String(v).replace('.', ','))} />
              </span>
            )}
            <label class="prb-check peq"><CasillaCasa checked={x.sNo} onChange={(ev) => pon('sNo', ev.currentTarget.checked)} /> No completo las 5 o tardo más de 60 segundos</label>
          </>
        )}
      </section>
      <div class="prb-partes" role="list" aria-label="Lo que llevas">
        {[['equilibrio', 'Equilibrio'], ['marcha', 'Marcha'], ['silla', 'Levantarse']].map(([k, t]) => (
          <span key={k} role="listitem" class={r.partes[k] == null ? 'prb-parte' : 'prb-parte prb-parte-ya'}><span class="mini">{t}</span><span class="peq num">{r.partes[k] == null ? '–' : `${r.partes[k]}/4`}</span></span>
        ))}
      </div>
      {r.total == null && <span class="mini terciario">Equilibrio, marcha y levantarse de la silla: cada una puntúa de 0 a 4.</span>}
      <Resultado prueba="sppb" r={r.total != null ? r : null} valor={r.total} rotulo={r.categoria} anterior={anterior} fila={r.total != null ? P.filaPrueba('sppb', d) : null} {...g} />
    </div>
  );
}

// ---------- El informe para su médico: un texto para compartir o copiar (sin el nombre de Pelayo, como en la web) ----------
function InformeMedico({ filas = [], p = null }) {
  const { api, atleta, aviso } = useApp();
  const [nombre, setNombre] = useState('');
  const hoy = hoyISO();
  const inicio = atleta?.esencial_inicio || (p?.bloques || []).map((b) => String(b.fecha_inicio || '').slice(0, 10)).filter(Boolean).sort()[0] || null;
  const ses = useCarga(() => (api.sesionesHechas ? api.sesionesHechas(atleta.id, { desde: sumarDias(hoy, -27) }).catch(() => null) : Promise.resolve(null)), [atleta.id]);
  const entreno = Array.isArray(ses.datos) ? P.textoEntreno({ inicio, fechas: ses.datos.map((x) => x.fecha), hoy }) : null;
  const texto = P.informeMedico({ filas, hoy, nombre, entreno }) || '';
  const puede = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const compartir = async () => { try { await navigator.share({ title: 'Resultados de mis pruebas físicas', text: texto }); } catch { /* cancelado */ } };
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); aviso('Copiado'); } catch { aviso('No se ha podido copiar: selecciónalo y cópialo a mano', 'error'); } };
  return (
    <div class="pila">
      <Arte id="esencial-informe-medico" />
      <p class="secundario">Una hoja con tus pruebas, la vez anterior, tu entreno y de dónde salen los números, para enseñársela a tu médico. Tu nombre solo sale en el texto y no se guarda.</p>
      <label class="pila-xs"><span class="etq">Nombre (opcional)</span>
        <input class="entrada" type="text" autocomplete="name" maxLength={80} value={nombre} onInput={(ev) => setNombre(ev.currentTarget.value)} /></label>
      <pre class="prb-inf mini" aria-label="Tu informe">{texto}</pre>
      <span class="fila-envolver">
        {puede && <button type="button" class="btn btn-primario" onClick={compartir}><Icono n="compartir" /> Compartir</button>}
        <button type="button" class={puede ? 'btn' : 'btn btn-primario'} onClick={copiar}><Icono n="copiar" /> Copiar</button>
      </span>
    </div>
  );
}

// ---------- En Hoy: cuando toca (cada 12 semanas) o, sin ninguna, las dos primeras semanas y en su trimestre ----------
export function TarjetaPruebas({ p = null, n = null }) {
  const { atleta } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const d = usePruebas(vuelta);
  const [abierta, setAbierta] = useState(false);
  const [luego, setLuego] = useState(() => leer(claveLuego(atleta.id)));
  const hoy = hoyISO();
  if (!d.datos?.hay) return null;
  const filas = d.datos.filas;
  const toca = P.tocaPruebas(filas, hoy);
  const primera = !filas.length && n != null && (n <= 2 || (n >= 12 && n <= 14));
  const sale = filas.length ? toca.toca : primera;
  const fuera = luego && /^\d{4}-\d{2}-\d{2}$/.test(luego) && sumarDias(luego, 7) > hoy;
  if (!sale || fuera) {
    return abierta ? <HojaPruebas p={p} alCerrar={() => setAbierta(false)} alGuardada={() => setVuelta((x) => x + 1)} /> : null;
  }
  return (
    <section class="nota-coach prb-tarjeta" aria-labelledby="prb-tar-t" data-pruebas={filas.length ? 'repetir' : 'partida'}>
      <Arte id={filas.length ? 'esencial-pruebas-otra-vez' : 'esencial-pruebas'} />
      <Icono n="progreso" />
      <div class="pila-s">
        <strong id="prb-tar-t">{filas.length ? 'Toca repetir tus pruebas' : 'Tus pruebas de partida'}</strong>
        <span class="peq">{filas.length
          ? `Tus últimas pruebas son del ${fechaLarga(toca.desde)}: repítelas y verás el antes y el ahora en «Tu trimestre».`
          : 'Levantarte de la silla, el equilibrio y tu cintura: hazlas ahora y, cada 12 semanas, verás cuánto has cambiado.'}</span>
        <span class="fila-envolver">
          <button type="button" class="btn btn-primario btn-peq" onClick={() => setAbierta(true)}>Hacer mis pruebas</button>
          <button type="button" class="btn btn-peq" onClick={() => { guardarLocal(claveLuego(atleta.id), hoy); setLuego(hoy); }}>Ahora no</button>
        </span>
      </div>
      {abierta && <HojaPruebas p={p} alCerrar={() => setAbierta(false)} alGuardada={() => setVuelta((x) => x + 1)} />}
    </section>
  );
}

// ---------- En «Tu trimestre»: el antes y el ahora de sus pruebas ----------
export function PruebasTrimestre({ p = null }) {
  const [vuelta, setVuelta] = useState(0);
  const d = usePruebas(vuelta);
  const [abierta, setAbierta] = useState(false);
  if (!d.datos?.hay) return null;
  const filas = d.datos.filas;
  const lineas = P.antesYAhora(filas);
  const toca = filas.length ? P.tocaPruebas(filas, hoyISO()).toca : true;
  return (
    <section class="pila-s" aria-labelledby="prb-tri-t">
      <strong id="prb-tri-t">Tus pruebas</strong>
      {lineas.length > 0 ? (
        <ul class="prb-tri-l" aria-label="Tus pruebas, la vez anterior y ahora">
          {lineas.map((l) => (
            <li key={l.prueba} class="prb-tri-f">
              <span class="prb-tri-n">{l.nombre}</span>
              <span class={l.mejor ? 'prb-tri-sube num peq' : 'prb-tri-x num peq'}>{l.texto}</span>
            </li>
          ))}
        </ul>
      ) : <span class="peq secundario">{filas.length ? 'Cuando las repitas, aquí verás la vez anterior y la de ahora.' : 'Hazlas ahora: la próxima vez verás cuánto has cambiado.'}</span>}
      <button type="button" class={toca ? 'btn btn-primario btn-peq' : 'btn btn-peq'} style="justify-self:start" onClick={() => setAbierta(true)}>{toca ? 'Hacer mis pruebas' : 'Mis pruebas'}</button>
      {abierta && <HojaPruebas p={p} alCerrar={() => setAbierta(false)} alGuardada={() => setVuelta((x) => x + 1)} />}
    </section>
  );
}
