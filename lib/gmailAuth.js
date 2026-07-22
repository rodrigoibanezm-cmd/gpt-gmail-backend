async function getStoredToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken || !userId) return null;

  const key = `gmail:${userId}`;
  const r = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  if (!r.ok) {
    console.error("Gmail token store read failed", { userId, status: r.status });
    return null;
  }

  try {
    const body = await r.json();
    return body?.result ? JSON.parse(body.result) : null;
  } catch (error) {
    console.error("Gmail token store parse failed", { userId, message: error.message });
    return null;
  }
}

async function saveToken(userId, tokenObj) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken || !userId || !tokenObj) return;

  const key = `gmail:${userId}`;
  const r = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tokenObj)
  });

  if (!r.ok) console.error("Gmail token store write failed", { userId, status: r.status });
}

function logOAuthFailure(userId, status, data = {}) {
  console.error("Gmail OAuth refresh failed", {
    userId,
    status,
    error: data.error || "unknown_error",
    description: data.error_description || null
  });
}

export async function getValidAccessToken(userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Gmail OAuth configuration missing", {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret)
    });
    return null;
  }

  const stored = await getStoredToken(userId);
  if (!stored?.refresh_token) {
    console.error("Gmail refresh token missing", { userId });
    return null;
  }

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
  } catch (error) {
    console.error("Gmail OAuth response parse failed", {
      userId,
      status: r.status,
      message: error.message
    });
    return null;
  }

  if (!r.ok || !data.access_token) {
    logOAuthFailure(userId, r.status, data);
    return null;
  }

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
