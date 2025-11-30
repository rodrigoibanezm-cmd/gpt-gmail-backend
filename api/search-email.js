async function getValidAccessToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const key = `gmail:${encodeURIComponent(userId)}`;

  if (!kvUrl || !kvToken) {
    return null;
  }

  try {
    const kvRes = await fetch(`${kvUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });

    const raw = await kvRes.text();
    if (!raw) return null;

    const tokens = JSON.parse(raw);

    if (!tokens?.refresh_token) return null;

    const expired = !tokens.expiry_date || Date.now() > tokens.expiry_date;
    if (!expired && tokens.access_token) return tokens.access_token;

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
    if (refreshData.error || !refreshData.access_token) {
      return null;
    }

    const newAccessToken = refreshData.access_token;

    await fetch(`${kvUrl}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
        access_token: newAccessToken,
        expiry_date: Date.now() + (refreshData.expires_in || 0) * 1000,
        scope: refreshData.scope || tokens.scope,
        token_type: "Bearer",
        created_at: new Date().toISOString()
      })
    });

    return newAccessToken;
  } catch (e) {
    console.error("getValidAccessToken error", e);
    return null;
  }
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

    const data = await r.json();

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
