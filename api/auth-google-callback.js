async function saveToken(userId, data) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  const key = `gmail:${encodeURIComponent(userId)}`;

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
  const code = req.query.code;
  const state = req.query.state;

  if (!code) return res.status(400).send("Falta code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });

  const data = await tokenRes.json();

  if (data.error) {
    return res.status(400).send("Error OAuth");
  }

  await saveToken(state, data);

  return res.status(200).send(`
    <html><body>
    <h1>Gmail conectado correctamente</h1>
    Puedes cerrar esta pestaña.
    </body></html>
  `);
}
