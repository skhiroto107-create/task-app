// Task の同期 API（Vercel の Upstash Redis / KV を使用）
// 同期コードを SHA-256 にした値をキーに、データを1つの JSON として保存します。
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX = 900 * 1024;

async function redis(path, body) {
  const r = await fetch(`${URL_}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body,
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'storage_not_configured' });
  const code = String(req.headers['x-sync-key'] || '');
  if (code.length < 8 || code.length > 200) return res.status(400).json({ error: 'bad_key' });
  const key = 'task:' + crypto.createHash('sha256').update(code).digest('hex');

  try {
    const raw = await redis(`get/${key}`);
    const cur = raw ? JSON.parse(raw) : null;

    if (req.method === 'GET') return res.status(200).json(cur || { v: 0, cats: null, tasks: null });

    if (req.method === 'PUT') {
      const d = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.cats) || typeof d.v !== 'number')
        return res.status(400).json({ error: 'bad_data' });
      // 新しい方を残す（古い端末からの上書きを防ぐ）
      if (cur && cur.v > d.v) return res.status(409).json(cur);
      const out = JSON.stringify({ v: d.v, cats: d.cats, tasks: d.tasks });
      if (out.length > MAX) return res.status(413).json({ error: 'too_large' });
      await redis(`set/${key}`, out);
      return res.status(200).json({ ok: true, v: d.v });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).end();
  } catch (e) {
    return res.status(502).json({ error: 'storage_error' });
  }
};
