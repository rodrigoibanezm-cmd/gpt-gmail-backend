export default async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state || null;

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

    // OJO: aquí todavía solo probamos el flujo; luego guardamos el refresh_token en KV/DB
    console.log('OAuth token response:', data, 'state/userId:', state);

    if (data.error) {
      return res
        .status(400)
        .send('Error al obtener tokens: ' + JSON.stringify(data));
    }

    // Respuesta simple en HTML para que veas que funcionó
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
