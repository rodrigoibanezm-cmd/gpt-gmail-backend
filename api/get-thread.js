async function getValidAccessToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const key = `gmail:${encodeURIComponent(userId)}`;

  const kvRes = await fetch(`${kvUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  const tokens = JSON.parse(await kvRes.text());
  if (!tokens?.refresh_token) return null;

  const expired = !tokens.expiry_date || Date.now() > tokens.expiry_date;
  let accessToken = tokens.access_token;

  if (expired) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      })
    });

    const d = await r.json();
    if (d.error) return null;

    accessToken = d.access_token;

    await fetch(`${kvUrl}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
        access_token: accessToken,
        expiry_date: Date.now() + d.expires_in * 1000,
        scope: d.scope || tokens.scope,
        token_type: "Bearer",
        created_at: new Date().toISOString()
      })
    });
  }

  return accessToken;
}

export default async function handler(req, res) {
  const { userId, threadId } = req.query || {};

  if (!userId || !threadId)
    return res.status(400).json({ status: "error" });

  const access = await getValidAccessToken(userId);
  if (!access)
    return res.status(400).json({ status: "error" });

  const url =
    "https://gmail.googleapis.com/gmail/v1/users/me/threads/" +
    encodeURIComponent(threadId);

  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` }});
  const data = await r.json();

  if (!r.ok)
    return res.status(400).json({ status: "error", raw: data });

  return res.status(200).json({ status: "success", data });
}
