// Backend de pruebas: el mismo interfaz que Supabase, sobre PGlite con el esquema real y RLS activo.
// Cada operación se ejecuta con el rol 'authenticated' y el usuario de la sesión, como haría PostgREST.
import { PGlite, types } from '@electric-sql/pglite';
import { aplicarEsquema } from './esquema.mjs';

const ID = /^[a-z_][a-z0-9_]*$/;
const id = (x) => { if (!ID.test(x)) throw new Error('Identificador no válido: ' + x); return x; };

export async function crearPglite() {
  const db = new PGlite({
    parsers: {
      [types.DATE]: (v) => v,
      [types.TIMESTAMPTZ]: (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(),
      [types.NUMERIC]: (v) => Number(v),
      [types.INT8]: (v) => Number(v),
    },
  });
  await aplicarEsquema(db);
  return db;
}

export function crearBackendPglite(db) {
  const passwords = new Map();
  const ficheros = new Map();
  let sesion = null;
  let cola = Promise.resolve();
  const sqlSu = (q, p = []) => enCola(async () => { await db.exec('reset role;'); return (await db.query(q, p)).rows; });

  // Serializa las operaciones (PGlite es una sola conexión y el rol es estado de sesión).
  const enCola = (fn) => (cola = cola.then(fn, fn));

  async function como(fn) {
    return enCola(async () => {
      const sub = sesion?.user.id || '';
      const claims = sub ? JSON.stringify({ sub, aal: sesion.aal || 'aal1' }) : '';
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claims', '${claims}', false); set role ${sub ? 'authenticated' : 'anon'};`);
      try { return await fn(); } finally { await db.exec('reset role;'); }
    });
  }

  function where(f = {}, params) {
    const c = [];
    for (const [k, v] of Object.entries(f.eq || {})) {
      if (v === null) c.push(`${id(k)} is null`);
      else { params.push(v); c.push(`${id(k)} = $${params.length}`); }
    }
    for (const [k, v] of Object.entries(f.neq || {})) { params.push(v); c.push(`${id(k)} <> $${params.length}`); }
    for (const [k, v] of Object.entries(f.in || {})) {
      if (!v.length) { c.push('false'); continue; }
      const ph = v.map((x) => { params.push(x); return `$${params.length}`; });
      c.push(`${id(k)} in (${ph.join(',')})`);
    }
    for (const [k, v] of Object.entries(f.gte || {})) { params.push(v); c.push(`${id(k)} >= $${params.length}`); }
    for (const [k, v] of Object.entries(f.lte || {})) { params.push(v); c.push(`${id(k)} <= $${params.length}`); }
    for (const k of f.nulo || []) c.push(`${id(k)} is null`);
    for (const k of f.nonulo || []) c.push(`${id(k)} is not null`);
    return c.length ? ' where ' + c.join(' and ') : '';
  }

  // Las columnas jsonb que guardan listas (como en Supabase, que manda JSON) van en JSON; el resto de listas son text[]
  const JSONB = new Set(['lesiones']);
  const valor = (v, col) => (Array.isArray(v) ? (JSONB.has(col) ? JSON.stringify(v) : `{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}`) : v);

  async function insertarUna(t, fila, conflicto) {
    const cols = Object.keys(fila).map(id);
    const params = Object.keys(fila).map((c) => valor(fila[c], c));
    let sql = `insert into public.${id(t)} (${cols.join(',')}) values (${params.map((_, i) => `$${i + 1}`).join(',')})`;
    if (conflicto) {
      const conf = conflicto.split(',').map((x) => id(x.trim()));
      const set = cols.filter((c) => !conf.includes(c)).map((c) => `${c} = excluded.${c}`);
      sql += ` on conflict (${conf.join(',')}) do ${set.length ? 'update set ' + set.join(', ') : 'nothing'}`;
    }
    return (await db.query(sql + ' returning *', params)).rows[0];
  }

  return {
    modo: 'pglite',
    async iniciar() {},
    usuarios: passwords,
    auth: {
      sesion: () => sesion,
      async entrar(email, password) {
        const u = passwords.get(email);
        if (!u || u.password !== password) throw new Error('Email o contraseña incorrectos.');
        sesion = { user: { id: u.id, email }, aal: 'aal1' };
      },
      async registrar(email, password, nombre) {
        const r = await enCola(async () => {
          await db.exec('reset role;');
          return (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify({ nombre })])).rows[0];
        });
        passwords.set(email, { id: r.id, password });
        sesion = { user: { id: r.id, email }, aal: 'aal1' };
        return { confirmarEmail: false };
      },
      async salir() { sesion = null; },
      async recuperar() {},
      alCambiar() { return () => {}; },
      // Verificación en dos pasos imitada: el código válido es 123456
      mfa: {
        async nivel() {
          const r = await sqlSu(`select count(*)::int n from auth.mfa_factors where user_id = $1 and status = 'verified'`, [sesion.user.id]);
          return { actual: sesion.aal || 'aal1', siguiente: r[0].n ? 'aal2' : 'aal1' };
        },
        async factores() {
          return (await sqlSu(`select id, status as estado from auth.mfa_factors where user_id = $1`, [sesion.user.id])).map((f) => ({ ...f, nombre: 'App' }));
        },
        async inscribir() {
          const [f] = await sqlSu(`insert into auth.mfa_factors (user_id) values ($1) returning id`, [sesion.user.id]);
          return { id: f.id, qr: 'data:image/svg+xml,', secreto: 'PRUEBA' };
        },
        async verificar(factorId, codigo) {
          if (codigo !== '123456') throw new Error('Código incorrecto o caducado.');
          await sqlSu(`update auth.mfa_factors set status = 'verified' where id = $1 and user_id = $2`, [factorId, sesion.user.id]);
          sesion = { ...sesion, aal: 'aal2' };
        },
        async quitar(factorId) { await sqlSu(`delete from auth.mfa_factors where id = $1`, [factorId]); },
      },
    },
    // Storage imitado: los objetos se registran en storage.objects (con sus políticas) y el contenido queda en memoria
    storage: {
      ficheros,
      subir: (ruta, archivo) => como(async () => {
        await db.query(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [ruta]);
        ficheros.set(ruta, archivo);
      }),
      url: (ruta) => como(async () => {
        const r = await db.query(`select name from storage.objects where bucket_id = 'archivos' and name = $1`, [ruta]);
        if (!r.rows.length) throw new Error('No tienes permiso para ver ese archivo.');
        return `pglite://${ruta}`;
      }),
      borrar: (rutas) => como(async () => {
        await db.query(`delete from storage.objects where bucket_id = 'archivos' and name = any($1::text[])`, [valor(rutas)]);
      }),
      listar: (carpeta) => como(async () => {
        const r = await db.query(`select name from storage.objects where bucket_id = 'archivos' and name like $1 order by name`, [`${carpeta}/%`]);
        return r.rows.map((x) => x.name);
      }),
    },
    select: (t, f = {}) => como(async () => {
      const params = [];
      let sql = `select ${f.cols ? f.cols.split(',').map((c) => id(c.trim())).join(',') : '*'} from public.${id(t)}${where(f, params)}`;
      if (f.order?.length) sql += ' order by ' + f.order.map(([c, d]) => `${id(c)} ${d === 'desc' ? 'desc' : 'asc'} nulls last`).join(', ');
      if (f.limit) sql += ` limit ${Number(f.limit)}`;
      return (await db.query(sql, params)).rows;
    }),
    insert: (t, filas) => como(async () => {
      const res = [];
      for (const f of Array.isArray(filas) ? filas : [filas]) res.push(await insertarUna(t, f));
      return res;
    }),
    update: (t, cambios, f) => como(async () => {
      const params = [];
      const set = Object.entries(cambios).map(([k, v]) => { params.push(valor(v, k)); return `${id(k)} = $${params.length}`; });
      return (await db.query(`update public.${id(t)} set ${set.join(', ')}${where(f, params)} returning *`, params)).rows;
    }),
    upsert: (t, filas, onConflict) => como(async () => {
      const res = [];
      for (const f of Array.isArray(filas) ? filas : [filas]) res.push(await insertarUna(t, f, onConflict));
      return res;
    }),
    delete: (t, f) => como(async () => {
      const params = [];
      await db.query(`delete from public.${id(t)}${where(f, params)}`, params);
    }),
    rpc: (nombre, args = {}) => como(async () => {
      const params = Object.values(args);
      const named = Object.keys(args).map((k, i) => `${id(k)} => $${i + 1}`).join(', ');
      return (await db.query(`select public.${id(nombre)}(${named}) as r`, params)).rows[0].r;
    }),
    // Para preparar datos en las pruebas sin pasar por permisos
    async sql(q, p = []) { return enCola(async () => { await db.exec('reset role;'); return (await db.query(q, p)).rows; }); },
  };
}
