// Recuperar a un atleta desde la copia completa (Cuenta → Copia completa). Genera el SQL que lo devuelve a la base tal y como estaba en la copia,
// para pegarlo en el SQL Editor de Supabase. Lo usa scripts/restaurar-atleta.html (en el navegador, sin
// conexión) y las pruebas (test/api.test.mjs).
//
// Cómo es el SQL:
// - Una transacción: o entra todo o nada.
// - Inserta con «on conflict do nothing»: lo que siga en la base no se toca ni se duplica (se puede repetir);
//   lo que cuelga de algo que ya no puede entrar (una semana vuelta a crear con otro id) se queda fuera.
// - Desactiva los disparadores de la app solo mientras inserta (para que no salgan notificaciones de cosas
//   antiguas ni se recalculen fechas); las claves ajenas siguen comprobándose. Al final los vuelve a activar.
// - Si su cuenta ya no existe, el atleta vuelve sin cuenta (le das un código nuevo) y sus mensajes, sin autor.
// - Los vídeos y fotos no están en la copia (están en Storage): no vuelven. Sus mensajes del chat sí, sin el
//   adjunto; los comentarios sobre un vídeo pasan a la conversación general.
(function (raiz) {
  // En orden: cada tabla después de las que necesita
  const ORDEN = ['atletas', 'consentimientos', 'ejercicios', 'recetas', 'bloques', 'semanas', 'sesiones', 'sesion_ejercicios', 'series',
    'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos', 'notas_ejercicio', 'avisos', 'recursos',
    'habitos', 'registros_habito', 'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'preguntas_checkin', 'comentarios', 'cobros_atletas', 'pagos',
    'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'menu_dias'];
  // Sin «id» propio: van por atleta (una fila por atleta, o por atleta y día en menu_dias)
  const SIN_ID = ['cobros_atletas', 'comidas_atleta', 'menu_dias'];
  const CON_ATLETA = ['bloques', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos',
    'notas_ejercicio', 'avisos', 'recursos', 'habitos', 'registros_habito', 'planes_nutricion', 'registros_nutricion',
    'cuestionarios', 'preguntas_checkin', 'comentarios', 'cobros_atletas', 'pagos', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'menu_dias'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const COLUMNA = /^[a-z_][a-z0-9_]*$/;

  // Solo la copia completa del coach (Cuenta → Copia completa): la descarga de un atleta la puede haber hecho
  // (y cambiado) él mismo, y con los disparadores apagados la base no comprobaría lo que trae
  const esCopiaCompleta = (copia) => !!copia && Array.isArray(copia.perfiles) && Array.isArray(copia.atletas) && Number(copia.version) >= 2;

  // Los atletas que trae la copia
  function atletasDe(copia) {
    if (!esCopiaCompleta(copia)) throw new Error('Este archivo no es la copia completa de FBE Equipo (Cuenta → Descargar copia completa). La descarga de los datos de un solo atleta no sirve para recuperarlo.');
    const lista = copia.atletas;
    return lista.filter((a) => a && UUID.test(String(a.id || ''))).map((a) => ({ id: a.id, nombre: a.nombre || 'Sin nombre', estado: a.estado || null }));
  }

  // Lo de un atleta, tabla a tabla
  function filasDe(copia, atletaId) {
    const t = (n) => (Array.isArray(copia?.[n]) ? copia[n] : []);
    const atleta = t('atletas').find((a) => a.id === atletaId);
    if (!atleta) throw new Error('Ese atleta no está en la copia.');
    const out = { atletas: [atleta] };
    for (const n of CON_ATLETA) out[n] = t(n).filter((f) => f.atleta_id === atletaId);
    const bloques = new Set(out.bloques.map((x) => x.id));
    out.semanas = t('semanas').filter((w) => bloques.has(w.bloque_id));
    const semanas = new Set(out.semanas.map((x) => x.id));
    out.sesiones = t('sesiones').filter((s) => semanas.has(s.semana_id));
    const sesiones = new Set(out.sesiones.map((x) => x.id));
    out.sesion_ejercicios = t('sesion_ejercicios').filter((p) => sesiones.has(p.sesion_id));
    // Todo enganchado a lo suyo: series de sus pautas, días de sus hábitos, mensajes de sus sesiones y check-ins
    const pautas = new Set(out.sesion_ejercicios.map((x) => x.id));
    out.series = out.series.filter((x) => pautas.has(x.sesion_ejercicio_id));
    const habitos = new Set(out.habitos.map((x) => x.id));
    out.registros_habito = out.registros_habito.filter((x) => habitos.has(x.habito_id));
    const checkins = new Set(out.checkins.map((x) => x.id));
    out.comentarios = out.comentarios.filter((c) => (!c.sesion_id || sesiones.has(c.sesion_id)) && (!c.checkin_id || checkins.has(c.checkin_id)));
    // Los ejercicios a los que apunta (por si alguno se hubiera borrado de la biblioteca)
    const usados = new Set([...out.sesion_ejercicios.map((p) => p.ejercicio_id), ...out.series.map((s) => s.sustituto_id),
      ...out.objetivos.map((o) => o.ejercicio_id), ...out.marcas.map((m) => m.ejercicio_id), ...out.notas_ejercicio.map((n) => n.ejercicio_id)].filter(Boolean));
    out.ejercicios = t('ejercicios').filter((e) => usados.has(e.id));
    // Las recetas de su recetario y de su menú (v0.26), por si alguna se hubiera borrado de tu recetario
    const recetas = new Set([...out.recetas_atleta.map((a) => a.receta_id), ...out.menu_comidas.map((m) => m.receta_id)].filter(Boolean));
    out.recetas = t('recetas').filter((r) => recetas.has(r.id));
    out.consentimientos = atleta.perfil_id ? t('consentimientos').filter((c) => c.perfil_id === atleta.perfil_id) : [];
    // Los vídeos y fotos no vuelven: sus mensajes, sin el adjunto (ni el dibujo, que solo va sobre un vídeo)
    out.comentarios = out.comentarios.map((c) => (c.archivo_id ? { ...c, archivo_id: null, dibujo: null } : c));
    return out;
  }

  // Si algo ya está en la base con otro id (una semana borrada y vuelta a crear), lo de la copia no entra, y
  // tampoco lo que cuelga de ello: así nunca falla a medias
  const PADRES = {
    semanas: [['bloque_id', 'bloques']], sesiones: [['semana_id', 'semanas']],
    sesion_ejercicios: [['sesion_id', 'sesiones'], ['ejercicio_id', 'ejercicios']],
    series: [['sesion_ejercicio_id', 'sesion_ejercicios'], ['sustituto_id', 'ejercicios', true]],
    registros_habito: [['habito_id', 'habitos']], marcas: [['ejercicio_id', 'ejercicios']], objetivos: [['ejercicio_id', 'ejercicios', true]],
    notas_ejercicio: [['ejercicio_id', 'ejercicios']], comentarios: [['sesion_id', 'sesiones', true], ['checkin_id', 'checkins', true]],
    consentimientos: [['perfil_id', 'perfiles']],
    recetas_atleta: [['receta_id', 'recetas']], menu_comidas: [['receta_id', 'recetas', true]],
  };
  const condicion = (n) => {
    const c = [...(CON_ATLETA.includes(n) ? [['atleta_id', 'atletas']] : []), ...(PADRES[n] || [])]
      .map(([col, tabla, nulo]) => `${nulo ? `(r.${col} is null or ` : ''}exists (select 1 from public.${tabla} x where x.id = r.${col})${nulo ? ')' : ''}`);
    return c.length ? `\n  where ${c.join('\n    and ')}` : '';
  };

  const literal = (texto) => {
    let etiqueta = 'fbe';
    while (texto.includes(`$${etiqueta}$`)) etiqueta += 'x';
    return `$${etiqueta}$${texto}$${etiqueta}$`;
  };

  // El SQL para recuperarlo. resumen: cuántas filas de cada tabla
  function generarSql(copia, atletaId) {
    if (!UUID.test(String(atletaId || ''))) throw new Error('Elige un atleta.');
    const filas = filasDe(copia, atletaId);
    const atleta = filas.atletas[0];
    const perfil = atleta.perfil_id && UUID.test(atleta.perfil_id) ? atleta.perfil_id : null;
    const resumen = {};
    const partes = [
      `-- FBE Equipo: recuperar a «${String(atleta.nombre || '').replace(/[\r\n]+/g, ' ')}» desde la copia del ${String(copia.exportado_en || '').slice(0, 10) || 'día que se hizo'}`,
      '-- Pégalo entero en el SQL Editor de Supabase y ejecútalo una vez. Lo que ya esté en la base no se toca.',
      '-- Los vídeos y fotos no están en la copia: no vuelven.',
      'begin;',
    ];
    const tablas = ORDEN.filter((n) => filas[n]?.length);
    for (const n of tablas) partes.push(`alter table public.${n} disable trigger user;`);
    for (const n of tablas) {
      let lista = filas[n];
      if (n === 'atletas') lista = lista.map((a) => ({ ...a, perfil_id: null })); // su cuenta se le devuelve al final, si existe
      const columnas = [...new Set(lista.flatMap((f) => Object.keys(f)))].filter((c) => COLUMNA.test(c) && (c !== 'foto' || n === 'recetas') && !(SIN_ID.includes(n) && c === 'id'));
      resumen[n] = lista.length;
      const datos = JSON.stringify(lista.map((f) => Object.fromEntries(columnas.map((c) => [c, f[c] === undefined ? null : f[c]]))));
      partes.push(`insert into public.${n} (${columnas.join(', ')})\n  select ${columnas.map((c) => `r.${c}`).join(', ')}\n  from json_populate_recordset(null::public.${n}, ${literal(datos)}::json) r${condicion(n)}\n  on conflict do nothing;`);
    }
    if (perfil) {
      partes.push(`update public.atletas set perfil_id = '${perfil}'\n  where id = '${atleta.id}' and perfil_id is null\n    and exists (select 1 from public.perfiles p where p.id = '${perfil}')\n    and not exists (select 1 from public.atletas o where o.perfil_id = '${perfil}');`);
    }
    for (const n of tablas) partes.push(`alter table public.${n} enable trigger user;`);
    partes.push('commit;');
    // Comprobación: si está, si tiene su cuenta y cuántas filas de la copia están ahora en la base
    const total = tablas.reduce((t, n) => t + filas[n].length, 0);
    const clave = (n) => (SIN_ID.includes(n) ? 'atleta_id' : 'id'); // lo acordado y sus comidas del día van por atleta, sin id propio
    const FECHA = /^\d{4}-\d{2}-\d{2}$/;
    const presentes = tablas.map((n) => (n === 'menu_dias'
      // (sus días van por atleta y fecha: solo los de la copia, no los que se hayan marcado después)
      ? `(select count(*) from public.menu_dias where (atleta_id, fecha) in (${filas[n].filter((f) => UUID.test(String(f.atleta_id)) && FECHA.test(String(f.fecha))).map((f) => `('${f.atleta_id}'::uuid, '${f.fecha}'::date)`).join(', ') || `(null::uuid, null::date)`}))`
      : `(select count(*) from public.${n} where ${clave(n)} = any('{${filas[n].map((f) => f[clave(n)]).filter((x) => UUID.test(String(x))).join(',')}}'::uuid[]))`)).join('\n     + ');
    partes.push(`-- Comprobación: recuperado = 1; con_cuenta = true (si es false, dale un código nuevo desde su ficha);\n-- si filas_en_la_base es menor que filas_en_la_copia, algo ya estaba con otro id y se ha dejado como está\nselect (select count(*) from public.atletas where id = '${atleta.id}') as recuperado,\n  (select perfil_id is not null from public.atletas where id = '${atleta.id}') as con_cuenta,\n  ${total} as filas_en_la_copia,\n  ${presentes || '0'} as filas_en_la_base;`);
    return { sql: partes.join('\n'), resumen, nombre: atleta.nombre || '' };
  }

  const api = { atletasDe, filasDe, generarSql, esCopiaCompleta, ORDEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.FBERestaurar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
