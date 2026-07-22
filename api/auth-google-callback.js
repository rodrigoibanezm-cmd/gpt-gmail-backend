// /api/auth-google-callback.js

async function saveToken(userId, tokenObj) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken || !userId || !tokenObj) {
    return { ok: false, message: "Upstash no configurado." };
  }

  const key = `gmail:${userId}`;
  const response = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tokenObj)
  });

  if (!response.ok) {
    console.error("Gmail token store write failed", {
      userId,
      status: response.status
    });
    return { ok: false, message: "No se pudo guardar la conexión Gmail." };
  }

  const data = await response.json().catch(() => null);
  if (data?.result !== "OK") {
    console.error("Gmail token store invalid response", { userId, data });
    return { ok: false, message: "Upstash no confirmó el guardado." };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send("Faltan variables de entorno OAuth.");
    }

    const { code, state } = req.query || {};

    if (!code || !state) {
      return res.status(400).send("Faltan parámetros code o state en el callback.");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const data = await tokenRes.json().catch(() => null);

    if (!tokenRes.ok || !data?.access_token || !data?.refresh_token) {
      console.error("Google OAuth token exchange failed", {
        status: tokenRes.status,
        error: data?.error || null
      });
      return res.status(400).send("Error OAuth al obtener tokens de Google.");
    }

    const now = Date.now();
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3500;
    const tokenObj = {
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      scope: data.scope || null,
      token_type: data.token_type || "Bearer",
      expiry_date: now + expiresIn * 1000,
      created_at: new Date().toISOString()
    };

    const saved = await saveToken(state, tokenObj);
    if (!saved.ok) return res.status(500).send(saved.message);

    return res.status(200).send(`
      <html><body>
        <h1>Gmail conectado correctamente</h1>
        Puedes cerrar esta pestaña.
      </body></html>
    `);
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    return res.status(500).send("Error interno en el callback de Google.");
  }
}
