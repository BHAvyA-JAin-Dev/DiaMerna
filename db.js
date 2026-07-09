/* SQLite compatibility layer — async init, returns db-like object */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

module.exports = async function createDB() {
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

  return {
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
  };
};
