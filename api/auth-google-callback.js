// /api/auth-google-callback.js

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
      code: code
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
      return res.status(400).send("No se pudo parsear la respuesta de tokens.");
    }

    if (!tokenRes.ok || !data.access_token) {
      return res.status(400).send("Error OAuth al obtener tokens de Google.");
    }

    const now = Date.now();
    const expiresIn =
      typeof data.expires_in === "number" ? data.expires_in : 3500;

    const tokenObj = {
      refresh_token: data.refresh_token || null,
      access_token: data.access_token,
      scope: data.scope || null,
      token_type: data.token_type || "Bearer",
      expiry_date: now + expiresIn * 1000,
      created_at: new Date().toISOString()
    };

    await saveToken(state, tokenObj);

    return res.status(200).send(`
      <html><body>
        <h1>Gmail conectado correctamente</h1>
        Puedes cerrar esta pestaña.
      </body></html>
    `);
  } catch (err) {
    return res.status(500).send("Error interno en el callback de Google.");
  }
}
