const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

module.exports = async function createDB() {
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_DB_AUTH_TOKEN;

  if (TURSO_URL && TURSO_TOKEN) {
    try {
      const httpUrl = TURSO_URL.replace(/^libsql:/, 'https:') + '/v2/pipeline';
      const auth = 'Bearer ' + TURSO_TOKEN;

      function toTursoArgs(params) {
        if (!params || !params.length) return undefined;
        return params.map(v => {
          if (v === null || v === undefined) return { type: 'null', value: null };
          if (typeof v === 'number') return { type: 'integer', value: String(v) };
          return { type: 'text', value: String(v) };
        });
      }

      async function query(sql, params) {
        const body = JSON.stringify({
          requests: [{ type: 'execute', stmt: { sql, args: toTursoArgs(params) } }]
        });
        return new Promise((resolve, reject) => {
          const u = new URL(httpUrl);
          const opts = {
            hostname: u.hostname, path: u.pathname, method: 'POST',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
          };
          const r = https.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
              try { resolve(JSON.parse(d)) } catch { reject(new Error('bad response')) }
            });
          });
          r.on('error', reject);
          r.write(body);
          r.end();
        });
      }

      await query('SELECT 1');
      console.log('🟢 Turso HTTP connected');

      return makeAsync({
        async exec(sql) { const r = await query(sql); const e = r.results?.[0]?.response?.result?.error || r.results?.[0]?.error; if (e) throw new Error(typeof e === 'string' ? e : e.message); },
        prepare(sql) {
          return {
            async run(...p) { const r = await query(sql, p.length ? p : undefined); const e = r.results?.[0]?.response?.result?.error || r.results?.[0]?.error; if (e) throw new Error(typeof e === 'string' ? e : e.message); },
            async get(...p) {
              const r = await query(sql, p.length ? p : undefined);
              const res = r.results?.[0];
              const resp = res?.response?.result || res?.result || {};
              if (res?.error) throw new Error(typeof res.error === 'string' ? res.error : res.error.message);
              const cols = (resp.cols || []).map(c => c.name || c);
              const row = resp.rows?.[0];
              if (!row) return null;
              const obj = {};
              cols.forEach((c, i) => obj[c] = row[i]?.value !== undefined ? row[i].value : row[i]);
              return obj;
            },
            async all(...p) {
              const r = await query(sql, p.length ? p : undefined);
              const res = r.results?.[0];
              const resp = res?.response?.result || res?.result || {};
              if (res?.error) throw new Error(typeof res.error === 'string' ? res.error : res.error.message);
              const cols = (resp.cols || []).map(c => c.name || c);
              return (resp.rows || []).map(row => {
                const obj = {};
                cols.forEach((c, i) => obj[c] = row[i]?.value !== undefined ? row[i].value : row[i]);
                return obj;
              });
            }
          };
        },
        close() {}
      });
    } catch (e) {
      console.warn('Turso unavailable, falling back to sql.js:', e.message);
    }
  }

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