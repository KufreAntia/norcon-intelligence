// /api/auth — validate login code and return project state + user rights
// POST { projectCode, memberCode }

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Redis not configured');
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['GET', key]]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis error');
  return data[0]?.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { projectCode, memberCode } = req.body || {};
    if (!projectCode || !memberCode) {
      return res.status(400).json({ error: 'projectCode and memberCode required' });
    }

    const code  = projectCode.toUpperCase().trim();
    const mCode = memberCode.toUpperCase().trim();

    // Load project state from Redis
    const raw = await redisGet(`project:${code}`);
    if (!raw) {
      return res.status(404).json({ error: 'Project not found. Check your project code.' });
    }

    const state = JSON.parse(raw);

    // Find the team member by login code
    const loginCodes = state.l2?.loginCodes || [];
    const member     = loginCodes.find(lc => lc.loginCode?.toUpperCase() === mCode);

    if (!member) {
      return res.status(401).json({ error: 'Invalid team member code. Check your login code.' });
    }

    // Determine rights
    const isPM   = member.role === 'Project Manager';
    const rights = {
      isPM,
      role:       member.role,
      name:       member.name,
      loginCode:  member.loginCode,
      // RACI-based element rights built from Sheet 04 data
      raciRights: buildRaciRights(member.loginCode, state),
    };

    return res.status(200).json({ ok: true, member: rights, state });

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function buildRaciRights(loginCode, state) {
  // Returns map of elementId -> 'R'|'A'|'C'|'I'
  const raciData   = state.l2?.sheets?.['04']?.data || {};
  const raciRows   = [...(raciData.raciRows || []), ...(raciData.customRows || [])];
  const rights     = {};
  raciRows.forEach(row => {
    const assignment = row.assignments?.[loginCode];
    if (assignment) rights[row.taskId] = assignment;
  });
  return rights;
}
