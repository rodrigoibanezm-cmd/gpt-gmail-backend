async function saveToken(userId, data) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn('KV no configurado, no se puede guardar token');
    return;
  }

  const key = `gmail:${userId || 'default'}`;

  await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: data.refresh_token || null,
      access_token: data.access_token || null,
      scope: data.scope || null,
      token_type: data.token_type || null,
      expiry_date: Date.now() + (data.expires_in || 0) * 1000,
      created_at: new Date().toISOString(),
    }),
  });
}

export default async function handler(req, res) {
  const code = req.query.code;
  const error = req.query.error || null;
  const state = req.query.state || null; // acá mandamos userId desde /api/auth-google

  if (error && !code) {
    return res.status(400).send(`Google devolvió un error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Falta parámetro "code" en la URL');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res
      .status(500)
      .send('Faltan env vars GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await tokenRes.json();
    console.log('OAuth token response:', data, 'state/userId:', state);

    if (data.error) {
      return res
        .status(400)
        .send('Error al obtener tokens: ' + JSON.stringify(data));
    }

    // guardar tokens en KV (si hay refresh_token, mejor)
    await saveToken(state, data);

    return res.status(200).send(`
      <html>
        <body>
          <h1>Gmail conectado correctamente</h1>
          <p>Puedes cerrar esta pestaña.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error en callback OAuth:', err);
    return res.status(500).send('Error interno en callback OAuth');
  }
}
