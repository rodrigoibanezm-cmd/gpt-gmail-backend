// /api/search-email.js

async function getStoredToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken || !userId) {
    return null;
  }

  const key = `gmail:${userId}`;

  const kvRes = await fetch(
    `${kvUrl}/get/${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${kvToken}` }
    }
  );

  if (!kvRes.ok) {
    return null;
  }

  let body;
  try {
    body = await kvRes.json();
  } catch (e) {
    return null;
  }

  const raw = body && body.result;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function saveToken(userId, tokenObj) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken || !userId || !tokenObj) return;

  const key = `gmail:${userId}`;

  await fetch(
    `${kvUrl}/set/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(tokenObj)
    }
  );
}

async function getValidAccessToken(userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const stored = await getStoredToken(userId);
  if (!stored || !stored.refresh_token) {
    return null;
  }

  const now = Date.now();
  const safetyMarginMs = 60_000;

  if (
    stored.access_token &&
    typeof stored.expiry_date === "number" &&
    stored.expiry_date - safetyMarginMs > now
  ) {
    return stored.access_token;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  let data;
  try {
    data = await tokenRes.json();
  } catch (e) {
    return null;
  }

  if (!tokenRes.ok || !data.access_token) {
    return null;
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3500;

  const updated = {
    refresh_token: stored.refresh_token,
    access_token: data.access_token,
    scope: data.scope || stored.scope || null,
    token_type: data.token_type || stored.token_type || "Bearer",
    expiry_date: now + expiresIn * 1000,
    created_at: stored.created_at || new Date().toISOString()
  };

  await saveToken(userId, updated);

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido, usa GET",
      data: null
    });
  }

  const { userId, query } = req.query || {};

  if (!userId || !query) {
    return res.status(200).json({
      status: "error",
      message: "Faltan parámetros requeridos: userId, query",
      data: null
    });
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return res.status(200).json({
        status: "error",
        message: "No se pudo obtener un access token válido para este usuario",
        data: null
      });
    }

    const searchUrl =
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=" +
      encodeURIComponent(query);

    const r = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let data;
    try {
      data = await r.json();
    } catch (e) {
      return res.status(200).json({
        status: "error",
        message: "Error al parsear la respuesta de Gmail en búsqueda",
        data: null
      });
    }

    if (!r.ok) {
      console.error("Gmail search error", data);
      return res.status(200).json({
        status: "error",
        message: "Error buscando correos en Gmail API",
        data: null
      });
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];

    const enriched = [];
    for (const msg of messages) {
      try {
        const msgRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
            encodeURIComponent(msg.id),
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        const msgData = await msgRes.json();
        enriched.push({
          id: msg.id || null,
          threadId: msg.threadId || null,
          snippet: msgData.snippet || ""
        });
      } catch (e) {
        console.error("Error enriqueciendo mensaje", e);
        enriched.push({
          id: msg.id || null,
          threadId: msg.threadId || null,
          snippet: ""
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Búsqueda de correos realizada correctamente",
      data: { messages: enriched }
    });
  } catch (error) {
    console.error("search-email handler error", error);
    return res.status(200).json({
      status: "error",
      message: "Error interno buscando correos",
      data: null
    });
  }
}

