async function getStoredToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken || !userId) return null;

  const key = `gmail:${userId}`;
  const r = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  if (!r.ok) return null;

  try {
    const body = await r.json();
    return body?.result ? JSON.parse(body.result) : null;
  } catch (e) {
    return null;
  }
}

async function saveToken(userId, tokenObj) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken || !userId || !tokenObj) return;

  const key = `gmail:${userId}`;
  await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tokenObj)
  });
}

export async function getValidAccessToken(userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const stored = await getStoredToken(userId);
  if (!stored?.refresh_token) return null;

  const now = Date.now();
  if (
    stored.access_token &&
    typeof stored.expiry_date === "number" &&
    stored.expiry_date - 60_000 > now
  ) {
    return stored.access_token;
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token
    }).toString()
  });

  let data;
  try {
    data = await r.json();
  } catch (e) {
    return null;
  }

  if (!r.ok || !data.access_token) return null;

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3500;
  const updated = {
    ...stored,
    access_token: data.access_token,
    scope: data.scope || stored.scope || null,
    token_type: data.token_type || stored.token_type || "Bearer",
    expiry_date: now + expiresIn * 1000
  };

  await saveToken(userId, updated);
  return data.access_token;
}
