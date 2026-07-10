/* Database abstraction layer — Turso (libSQL) with sql.js fallback
   All methods return promises for consistent async usage. */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

module.exports = async function createDB() {
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_DB_AUTH_TOKEN;

  if (TURSO_URL && TURSO_TOKEN) {
    try {
      const { createClient } = require('@libsql/client');
      const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
      await turso.execute('SELECT 1');
      console.log('🟢 Turso connected');
      return makeAsync({
        exec(sql) { return turso.execute(sql) },
        prepare(sql) {
          return {
            run(...params) { return turso.execute({ sql, args: params.length ? params : undefined }) },
            async get(...params) { const r = await turso.execute({ sql, args: params.length ? params : undefined }); return r.rows[0] || null },
            async all(...params) { const r = await turso.execute({ sql, args: params.length ? params : undefined }); return r.rows }
          };
        },
        close() {}
      });
    } catch (e) {
      console.warn('Turso unavailable, falling back to sql.js:', e.message);
    }
  }

  /* sql.js fallback */
  const DB_PATH = process.env.VERCEL ? '/tmp/diamerna.db' : path.join(__dirname, 'diamerna.db');
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });
  let data = null;
  try { data = fs.readFileSync(DB_PATH) } catch {}
  const _db = new SQL.Database(data);

  function _save() {
    if (!process.env.VERCEL) {
      try { fs.writeFileSync(DB_PATH, Buffer.from(_db.export())) } catch {}
    }
  }

  return makeAsync({
    exec(sql) { _db.exec(sql); _save() },
    prepare(sql) {
      return {
        run(...params) { _db.run(sql, params.length ? params : undefined); _save() },
        get(...params) {
          const s = _db.prepare(sql);
          if (params.length) s.bind(params);
          let row; if (s.step()) row = s.getAsObject();
          s.free(); return row;
        },
        all(...params) {
          const s = _db.prepare(sql);
          if (params.length) s.bind(params);
          const rows = []; while (s.step()) rows.push(s.getAsObject());
          s.free(); return rows;
        }
      };
    },
    close() { _save(); _db.close() },
    pragma() {}
  });
};

function makeAsync(syncDb) {
  const wrap = (fn) => (...args) => Promise.resolve(fn(...args));
  return {
    exec: wrap(syncDb.exec),
    prepare(sql) {
      const stmt = syncDb.prepare(sql);
      return { run: wrap(stmt.run), get: wrap(stmt.get), all: wrap(stmt.all) };
    },
    close: wrap(syncDb.close)
  };
}
