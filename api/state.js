// /api/state — save and load project state via Upstash Redis
// GET  ?code=WF          → load project state
// POST { code, state }   → save project state

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('Upstash Redis not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to environment variables.');
  }
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis error');
  return data[0]?.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const code = (req.query.code || '').toUpperCase().trim();
      if (!code) return res.status(400).json({ error: 'Project code required' });

      const raw = await redis(['GET', `project:${code}`]);
      if (!raw) return res.status(404).json({ error: 'Project not found' });

      return res.status(200).json({ state: JSON.parse(raw) });
    }

    if (req.method === 'POST') {
      const { code, state } = req.body || {};
      if (!code || !state) return res.status(400).json({ error: 'code and state required' });

      const key = `project:${code.toUpperCase().trim()}`;
      await redis(['SET', key, JSON.stringify(state)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('State API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
