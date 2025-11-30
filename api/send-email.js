async function getValidAccessToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const key = `gmail:${encodeURIComponent(userId)}`;

  const kvRes = await fetch(`${kvUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  const raw = await kvRes.text();
  let tokens = JSON.parse(raw);

  if (!tokens?.refresh_token) return null;

  const expired = !tokens.expiry_date || Date.now() > tokens.expiry_date;

  if (!expired) return tokens.access_token;

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token"
    })
  });

  const refreshData = await refreshRes.json();
  if (refreshData.error) return null;

  const newAccess = refreshData.access_token;

  await fetch(`${kvUrl}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: newAccess,
      expiry_date: Date.now() + refreshData.expires_in * 1000,
      scope: refreshData.scope || tokens.scope,
      token_type: "Bearer",
      created_at: new Date().toISOString()
    })
  });

  return newAccess;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ status: "error" });

  const { userId, to, subject, body } = req.body || {};
  if (!userId || !to || !subject || !body)
    return res.status(400).json({ status: "error" });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken)
    return res.status(400).json({ status: "error" });

  const msg =
    `To: ${to}\r\nSubject: ${subject}\r\n\r\n${body}`;

  const encoded = Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: encoded })
  });

  const data = await r.json();

  if (!r.ok)
    return res.status(400).json({ status: "error", raw:
