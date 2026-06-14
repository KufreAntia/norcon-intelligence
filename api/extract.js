export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log("Key present:", !!apiKey, "Length:", apiKey?.length, "Starts:", apiKey?.slice(0,10))

  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.log("Anthropic error:", JSON.stringify(data))
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (err) {
    console.log("Fetch error:", err.message)
    return res.status(500).json({ error: err.message })
  }
}