export default async function handler(req, res) {
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: "Redis not configured" });
  }

  const headers = {
    Authorization: `Bearer ${redisToken}`,
    "Content-Type": "application/json",
  };

  // GET — load project
  if (req.method === "GET") {
    const { projectCode, memberCode } = req.query;
    if (!projectCode) return res.status(400).json({ error: "projectCode required" });

    const key = `norcon_project_${projectCode.toUpperCase()}`;
    const r = await fetch(`${redisUrl}/get/${key}`, { headers });
    const data = await r.json();

    if (!data.result) return res.status(404).json({ error: "Project not found" });

    const project = JSON.parse(data.result);

    // Validate member code if provided
    if (memberCode) {
      const member = project.l2?.loginCodes?.find(
        lc => lc.loginCode === memberCode.toUpperCase()
      );
      if (!member) return res.status(401).json({ error: "Invalid member code" });
      return res.status(200).json({ project, member });
    }

    return res.status(200).json({ project });
  }

  // POST — save project
  if (req.method === "POST") {
    const { projectCode, state } = req.body;
    if (!projectCode || !state) return res.status(400).json({ error: "projectCode and state required" });

    const key = `norcon_project_${projectCode.toUpperCase()}`;
    const value = JSON.stringify(state);

    const r = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers,
      body: JSON.stringify([["SET", key, value]]),
    });

    const data = await r.json();
    return res.status(200).json({ ok: true, key });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
