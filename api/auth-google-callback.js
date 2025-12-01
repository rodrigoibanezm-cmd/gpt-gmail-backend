async function saveToken(userId, data) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token || !userId) return;

  // Clave única y estable para ese usuario
  const key = `gmail:${userId}`;

  await fetch(`${url}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: data.refresh_token || null,
      access_token: data.access_token || null,
      scope: data.scope || null,
      token_type: data.token_type || null,
      expiry_date: Date.now() + (data.expires_in || 0) * 1000,
      created_at: new Date().toISOString()
    })
  });
}

export default async function handler(req, res) {
  const { code, error, state } = req.query;

  if (error && !code) {
    return res.status(400).send("Error en la autorización de Google.");
  }

  if (!code || !state) {
    return res.status(400).send("Faltan parámetros en el callback OAuth2.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send("Faltan variables de entorno OAuth.");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok || data.error) {
    return res.status(400).send("Error OAuth al obtener tokens de Google.");
  }

  // state ahora es el userId original
  await saveToken(state, data);

  return res.status(200).send(`
    <html><body>
      <h1>Gmail conectado correctamente</h1>
      Puedes cerrar esta pestaña.
    </body></html>
  `);
}
