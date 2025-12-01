async function saveDriveToken(userId, data) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn('KV no configurado, no se puede guardar token de Drive');
    return;
  }

  const key = `drive:${userId || 'default'}`;

  await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

export default async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state ? decodeURIComponent(req.query.state) : '';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res
      .status(500)
      .send('Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_DRIVE_REDIRECT_URI');
  }

  if (!code) {
    return res.status(400).send('Falta el parámetro "code" de Google OAuth');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Error al obtener tokens de Drive:', data);
      return res
        .status(500)
        .send('Error al obtener tokens de Drive: ' + JSON.stringify(data));
    }

    await saveDriveToken(state, data);

    return res.status(200).send(`
      <html>
        <body>
          <h1>Drive conectado correctamente</h1>
          <p>Puedes cerrar esta pestaña.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error en callback OAuth de Drive:', err);
    return res.status(500).send('Error interno en callback OAuth de Drive');
  }
}
