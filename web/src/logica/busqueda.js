import { NOMBRE_GRUPO } from './calculos.js';
import { conEntrenamiento, conNutricion } from './nivel.js';

// Búsqueda rápida del coach: qué proponer para lo que escribe. Sin tildes ni mayúsculas, por principio
// de palabra (todas las escritas tienen que empezar alguna palabra: «ana» encuentra a Ana López, no «semana»). Si una palabra nombra una pestaña de la ficha («ana seguimiento»),
// se propone además ir directo a esa pestaña.

export const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const palabras = (t) => normal(t).split(/[^a-z0-9]+/).filter(Boolean);
const casaCon = (fichas, texto) => { const ws = palabras(texto); return fichas.every((f) => ws.some((w) => w.startsWith(f))); };
const PESTANAS = [['programa', 'Programa'], ['mensajes', 'Mensajes'], ['actividad', 'Actividad'], ['registro', 'Registro'], ['seguimiento', 'Seguimiento'], ['nutricion', 'Nutrición'], ['videos', 'Vídeos y fotos'], ['objetivos', 'Objetivos'], ['notas', 'Notas'], ['datos', 'Datos']];
// Las pestañas que tiene la ficha de cada atleta según lo que le llevas (a quien solo lleva la nutrición, nada de entrenamiento)
const DE_ENTRENAMIENTO = ['programa', 'actividad', 'registro', 'objetivos'];
export const pestanasDe = (a) => PESTANAS.filter(([k]) => (conNutricion(a) || k !== 'nutricion') && (conEntrenamiento(a) || !DE_ENTRENAMIENTO.includes(k)));
const ESTADO = { invitado: 'Pendiente de activar', activo: 'Activo', pausado: 'En pausa', baja: 'De baja' };

export function construirResultados(datos, q) {
  const fichas = q.trim() ? normal(q).split(/\s+/).filter(Boolean) : [];
  const casa = (texto) => casaCon(fichas, texto);
  const out = [];
  const poner = (grupo, items, max) => { for (const it of items.slice(0, max)) out.push({ grupo, ...it }); };
  const { atletas = [], plantillas = [], ejercicios = [] } = datos || {};

  // Atletas, y sus pestañas si la búsqueda nombra una («ana registro»)
  let pestanaPedida = PESTANAS.find(([, t]) => fichas.some((f) => f.length >= 3 && normal(t).startsWith(f)));
  let restoFichas = pestanaPedida ? fichas.filter((f) => !normal(pestanaPedida[1]).startsWith(f)) : fichas;
  if (pestanaPedida && !restoFichas.length) { pestanaPedida = null; restoFichas = fichas; } // «pro» a secas no es «todas las fichas en Programa»
  // Primero quien empieza por lo escrito («an» → Ana antes que Juan)
  const antes = (nombre) => (restoFichas[0] && normal(nombre).split(/\s+/).some((w) => w.startsWith(restoFichas[0])) ? 0 : 1);
  const deAtleta = atletas.filter((a) => casaCon(restoFichas, `${a.nombre} ${a.email || ''} ${a.objetivo || ''}`))
    .sort((x, y) => antes(x.nombre) - antes(y.nombre));
  const conPestana = [], fichasAtleta = [];
  for (const a of fichas.length ? deAtleta : atletas.filter((x) => x.estado !== 'baja')) {
    if (pestanaPedida && restoFichas.length && pestanasDe(a).some(([k]) => k === pestanaPedida[0])) conPestana.push({ id: `a-${a.id}-${pestanaPedida[0]}`, titulo: `${a.nombre}: ${pestanaPedida[1]}`, detalle: 'Abrir la pestaña', icono: 'atletas', destino: { tab: 'atletas', atletaId: a.id, pestana: pestanaPedida[0] } });
    fichasAtleta.push({ id: `a-${a.id}`, titulo: a.nombre, detalle: [ESTADO[a.estado], a.objetivo].filter(Boolean).join('. '), icono: 'atletas', destino: { tab: 'atletas', atletaId: a.id, pestana: conEntrenamiento(a) ? 'programa' : 'nutricion' } });
  }
  // Si se nombra una pestaña, primero los que la tienen
  const atletasItems = [...conPestana, ...fichasAtleta];
  poner('Atletas', atletasItems, fichas.length ? 8 : 5);

  const acciones = [
    { id: 'x-atleta', titulo: 'Añadir atleta', detalle: 'Alta y código de invitación', icono: 'mas', destino: { tab: 'atletas', nuevo: true }, claves: 'nuevo alta invitar codigo' },
    { id: 'x-plantilla', titulo: 'Nueva plantilla', detalle: 'Un bloque reutilizable', icono: 'mas', destino: { tab: 'plantillas', nueva: true }, claves: 'crear bloque' },
    { id: 'x-ejercicio', titulo: 'Nuevo ejercicio', detalle: 'En tu biblioteca', icono: 'mas', destino: { tab: 'biblioteca', ejercicioId: 'nuevo' }, claves: 'crear biblioteca' },
    { id: 'x-aviso', titulo: 'Nuevo aviso', detalle: 'Un mensaje fijado en Hoy para tus atletas', icono: 'altavoz', destino: { tab: 'atletas', avisos: true }, claves: 'anuncio comunicado vacaciones' },
  ];
  poner('Acciones', acciones.filter((x) => !fichas.length || casa(`${x.titulo} ${x.detalle} ${x.claves}`)), 4);

  const secciones = [
    { id: 's-atletas', titulo: 'Atletas', detalle: 'Tabla de todos tus atletas', icono: 'atletas', destino: { tab: 'atletas' }, claves: 'panel inicio' },
    { id: 's-revisar', titulo: 'Revisar', detalle: 'Lo que espera tu respuesta', icono: 'bandeja', destino: { tab: 'revisar' }, claves: 'bandeja pendiente videos checkins' },
    { id: 's-mensajes', titulo: 'Mensajes', detalle: 'Tus chats con cada atleta', icono: 'mensaje', destino: { tab: 'mensajes' }, claves: 'chat conversaciones whatsapp' },
    { id: 's-plantillas', titulo: 'Plantillas', detalle: 'Bloques reutilizables', icono: 'plantillas', destino: { tab: 'plantillas' }, claves: 'bloques' },
    { id: 's-biblioteca', titulo: 'Biblioteca', detalle: 'Ejercicios, técnica y alternativas', icono: 'biblioteca', destino: { tab: 'biblioteca' }, claves: 'ejercicios' },
    { id: 's-recursos', titulo: 'Recursos', detalle: 'Guías, enlaces y preguntas frecuentes', icono: 'biblioteca', destino: { tab: 'biblioteca', vista: 'recursos' }, claves: 'faq guias' },
    { id: 's-cuenta', titulo: 'Cuenta', detalle: 'Verificación en dos pasos y copia de seguridad', icono: 'perfil', destino: { tab: 'cuenta' }, claves: '2fa seguridad copia salir' },
  ];
  poner('Ir a', secciones.filter((x) => !fichas.length || casa(`${x.titulo} ${x.detalle} ${x.claves}`)), 6);

  if (fichas.length) {
    poner('Plantillas', plantillas.filter((p) => casa(`${p.nombre} ${p.foco || ''}`)).map((p) => ({ id: `p-${p.id}`, titulo: p.nombre, detalle: 'Plantilla', icono: 'plantillas', destino: { tab: 'plantillas', plantillaId: p.id } })), 5);
    const primero = (n) => (normal(n).startsWith(fichas[0]) ? 0 : 1);
    poner('Ejercicios', ejercicios.filter((e) => e.activo !== false && casa(`${e.nombre} ${(e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(' ')}`))
      .sort((x, y) => primero(x.nombre) - primero(y.nombre))
      .map((e) => ({ id: `e-${e.id}`, titulo: e.nombre, detalle: (e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', '), icono: 'biblioteca', destino: { tab: 'biblioteca', ejercicioId: e.id } })), 6);
  }
  return out;
}
