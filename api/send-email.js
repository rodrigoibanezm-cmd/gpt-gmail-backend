export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Método no permitido" });
  }

  const { userId, to, subject, body } = req.body || {};

  if (!userId || !to || !subject || !body) {
    return res.status(400).json({ status: "error", message: "Faltan campos requeridos" });
  }

  // Obtener tokens desde KV
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const key = `gmail:${encodeURIComponent(userId)}`;

  const kvRes = await fetch(`${kvUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  const kvText = await kvRes.text();
  let tokens;
  try {
    tokens = JSON.parse(kvText);
  } catch {
    return res.status(500).json({ status: "error", message: "KV no retornó JSON válido" });
  }

  if (!tokens?.refresh_token) {
    return res.status(400).json({ status: "error", message: "No existe token para este usuario" });
  }

  // Verificar expiración
  let accessToken = tokens.access_token;
  const expired = !tokens.expiry_date || Date.now() > tokens.expiry_date;

  if (expired) {
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

    if (refreshData.error) {
      return res.status(400).json({
        status: "error",
        message: "Error refrescando token",
        raw: refreshData
      });
    }

    accessToken = refreshData.access_token;

    // Guardar nuevo access token en KV
    await fetch(`${kvUrl}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
        access_token: refreshData.access_token,
        expiry_date: Date.now() + refreshData.expires_in * 1000,
        scope: refreshData.scope || tokens.scope,
        token_type: "Bearer",
        created_at: new Date().toISOString()
      })
    });
  }

  // Construir mensaje MIME base64
  const message =
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    body;

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Enviar correo usando Gmail API
  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: encodedMessage })
    }
  );

  const gmailData = await gmailRes.json();

  if (!gmailRes.ok) {
    return res.status(400).json({
      status: "error",
      message: "Error enviando email",
      raw: gmailData
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Correo enviado",
    id: gmailData.id
  });
}
