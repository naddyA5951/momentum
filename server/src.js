import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usePostgres = Boolean(process.env.DATABASE_URL);
const sqlite = usePostgres ? null : new Database(path.join(__dirname, 'data', 'momentum.db'));
const pool = usePostgres ? new (await import('pg')).default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
if (sqlite) sqlite.pragma('journal_mode = WAL');

// $1-style placeholders keep PostgreSQL queries portable; SQLite is adapted locally.
const query = (statement, params = []) => usePostgres
  ? pool.query(statement, params).then(result => result.rows)
  : Promise.resolve(sqlite.prepare(statement.replace(/\$\d+/g, '?')).all(...params));
const execute = async (statement, params = []) => usePostgres
  ? (await pool.query(statement, params)).rows
  : sqlite.prepare(statement.replace(/\$\d+/g, '?')).run(...params).lastInsertRowid;

const schema = usePostgres ? `
CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', tags TEXT NOT NULL DEFAULT '[]', estimate INTEGER NOT NULL DEFAULT 25, status TEXT NOT NULL DEFAULT 'today', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS schedule_blocks (id SERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'work', start_time TEXT NOT NULL, end_time TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#8b5cf6');
CREATE TABLE IF NOT EXISTS focus_sessions (id SERIAL PRIMARY KEY, duration INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'focus', completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS learning_metrics (id INTEGER PRIMARY KEY, total_minutes INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, milestones INTEGER NOT NULL DEFAULT 0, last_studied TEXT);
` : `
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', tags TEXT NOT NULL DEFAULT '[]', estimate INTEGER NOT NULL DEFAULT 25, status TEXT NOT NULL DEFAULT 'today', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS schedule_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'work', start_time TEXT NOT NULL, end_time TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#8b5cf6');
CREATE TABLE IF NOT EXISTS focus_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, duration INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'focus', completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS learning_metrics (id INTEGER PRIMARY KEY CHECK(id = 1), total_minutes INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, milestones INTEGER NOT NULL DEFAULT 0, last_studied TEXT);
`;
if (usePostgres) await execute(schema); else sqlite.exec(schema);
await execute(usePostgres ? 'INSERT INTO learning_metrics(id) VALUES (1) ON CONFLICT (id) DO NOTHING' : 'INSERT OR IGNORE INTO learning_metrics(id) VALUES (1)');

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));
const allowed = (source, keys) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const format = row => row && ({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
const holders = count => Array.from({ length: count }, (_, index) => `$${index + 1}`).join(', ');

function crud(route, table, columns) {
  app.get(`/api/${route}`, async (_, res, next) => { try { res.json((await query(`SELECT * FROM ${table} ORDER BY id DESC`)).map(format)); } catch (error) { next(error); } });
  app.post(`/api/${route}`, async (req, res, next) => {
    try {
      const data = allowed(req.body, columns); if (data.tags) data.tags = JSON.stringify(data.tags);
      const keys = Object.keys(data); if (!keys.length) return res.status(400).json({ error: 'Request body is required' });
      const statement = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${holders(keys.length)})${usePostgres ? ' RETURNING *' : ''}`;
      const values = keys.map(key => data[key]);
      const row = usePostgres ? (await query(statement, values))[0] : (await query(`SELECT * FROM ${table} WHERE id = $1`, [await execute(statement, values)]))[0];
      res.status(201).json(format(row));
    } catch (error) { next(error); }
  });
  app.patch(`/api/${route}/:id`, async (req, res, next) => {
    try {
      const data = allowed(req.body, columns); if (data.tags) data.tags = JSON.stringify(data.tags);
      const keys = Object.keys(data); if (!keys.length) return res.status(400).json({ error: 'No changes supplied' });
      const values = [...keys.map(key => data[key]), req.params.id];
      const statement = `UPDATE ${table} SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}${usePostgres ? ' RETURNING *' : ''}`;
      const row = usePostgres ? (await query(statement, values))[0] : (await execute(statement, values), (await query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]))[0]);
      if (!row) return res.status(404).json({ error: 'Not found' }); res.json(format(row));
    } catch (error) { next(error); }
  });
  app.delete(`/api/${route}/:id`, async (req, res, next) => { try { await execute(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]); res.status(204).end(); } catch (error) { next(error); } });
}
crud('tasks', 'tasks', ['title', 'priority', 'tags', 'estimate', 'status']);
crud('blocks', 'schedule_blocks', ['title', 'category', 'start_time', 'end_time', 'color']);
crud('sessions', 'focus_sessions', ['duration', 'kind']);
app.get('/api/learning', async (_, res, next) => { try { res.json((await query('SELECT * FROM learning_metrics WHERE id = 1'))[0]); } catch (error) { next(error); } });
app.patch('/api/learning', async (req, res, next) => { try { const data = allowed(req.body, ['total_minutes', 'streak', 'milestones', 'last_studied']); const keys = Object.keys(data); if (!keys.length) return res.status(400).json({ error: 'No changes supplied' }); await execute(`UPDATE learning_metrics SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(', ')} WHERE id = 1`, keys.map(key => data[key])); res.json((await query('SELECT * FROM learning_metrics WHERE id = 1'))[0]); } catch (error) { next(error); } });
app.get('/api/health', (_, res) => res.json({ ok: true, database: usePostgres ? 'postgres' : 'sqlite' }));
if (process.env.NODE_ENV === 'production') { const dist = path.join(__dirname, '..', 'client', 'dist'); app.use(express.static(dist)); app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.use((error, _, res, __) => { console.error(error); res.status(500).json({ error: 'Unexpected server error' }); });
app.listen(process.env.PORT || 4000, () => console.log(`Momentum API on port ${process.env.PORT || 4000} (${usePostgres ? 'PostgreSQL' : 'SQLite'})`));
