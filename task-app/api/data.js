// Task の同期 API（Vercel + Neon Postgres）
// 同期コードを SHA-256 にした値をキーに、データを1行の JSON として保存します。
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const MAX = 900 * 1024;
let sql = null, ready = null;

function db() {
  if (!sql) sql = neon(DB_URL);
  if (!ready) ready = sql`CREATE TABLE IF NOT EXISTS task_sync (
      k TEXT PRIMARY KEY, v BIGINT NOT NULL, body JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`
    .catch(e => { ready = null; throw e; });
  return ready.then(() => sql);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!DB_URL) return res.status(500).json({ error: 'storage_not_configured' });
  const code = String(req.headers['x-sync-key'] || '');
  if (code.length < 8 || code.length > 200) return res.status(400).json({ error: 'bad_key' });
  const key = crypto.createHash('sha256').update(code).digest('hex');

  try {
    const q = await db();
    if (req.method === 'GET') {
      const rows = await q`SELECT v, body FROM task_sync WHERE k = ${key}`;
      if (!rows.length) return res.status(200).json({ v: 0, cats: null, tasks: null });
      return res.status(200).json({ v: Number(rows[0].v), cats: rows[0].body.cats, tasks: rows[0].body.tasks });
    }
    if (req.method === 'PUT') {
      const d = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.cats) || typeof d.v !== 'number')
        return res.status(400).json({ error: 'bad_data' });
      const body = JSON.stringify({ cats: d.cats, tasks: d.tasks });
      if (body.length > MAX) return res.status(413).json({ error: 'too_large' });
      // 新しい方だけを保存（古い端末からの上書きを防ぐ）
      const saved = await q`INSERT INTO task_sync (k, v, body) VALUES (${key}, ${d.v}, ${body}::jsonb)
        ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, body = EXCLUDED.body, updated_at = now()
        WHERE task_sync.v <= EXCLUDED.v RETURNING v`;
      if (!saved.length) {
        const cur = await q`SELECT v, body FROM task_sync WHERE k = ${key}`;
        return res.status(409).json({ v: Number(cur[0].v), cats: cur[0].body.cats, tasks: cur[0].body.tasks });
      }
      return res.status(200).json({ ok: true, v: d.v });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).end();
  } catch (e) {
    return res.status(502).json({ error: 'storage_error' });
  }
};
