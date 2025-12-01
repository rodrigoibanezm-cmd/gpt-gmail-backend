async function getValidAccessToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!kvUrl || !kvToken || !clientId || !clientSecret) {
    return null;
  }

  const key = `gmail:${userId}`;

  const kvRes = await fetch(`${kvUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  if (!kvRes.ok) return null;

  let tokens;
  try {
    const text = await kvRes.text();
    if (!text) return null;
    tokens = JSON.parse(text);
  } catch {
    return null;
  }

  if (!tokens?.refresh_token) return null;

  let accessToken = tokens.access_token || null;
  const expired = !tokens.expiry_date || Date.now() > tokens.expiry_date;

  if (!accessToken || expired) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || data.error || !data.access_token) {
      return null;
    }

    accessToken = data.access_token;
    tokens.access_token = data.access_token;
    tokens.expiry_date = Date.now() + (data.expires_in || 0) * 1000;

    await fetch(`${kvUrl}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(tokens)
    });
  }

  return accessToken;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido. Usa GET.",
      data: null
    });
  }

  const { userId, max } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(200).json({
      status: "error",
      message: "Falta parámetro userId.",
      data: null
    });
  }

  const limitRaw = Number(max) || 20;
  const limit = Math.min(Math.max(limitRaw, 1), 100);

  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    return res.status(200).json({
      status: "error",
      message: "No se pudo obtener un access token válido para este usuario",
      data: null
    });
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await r.json();

  if (!r.ok) {
    return res.status(200).json({
      status: "error",
      message: "Error al listar correos recientes desde Gmail.",
      data
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Correos recientes obtenidos correctamente.",
    data
  });
}
