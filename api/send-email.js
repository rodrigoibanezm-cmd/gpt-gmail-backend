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
  if (req.method !== "POST") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido, usa POST",
      data: null
    });
  }

  const { userId, to, subject, body } = req.body || {};

  if (!userId || !to || !subject || !body) {
    return res.status(200).json({
      status: "error",
      message: "Faltan campos requeridos: userId, to, subject, body",
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

    const msg =
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      body;

    const encoded = Buffer.from(msg)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: encoded })
      }
    );

    const gmailData = await gmailRes.json();

    if (!gmailRes.ok) {
      console.error("Gmail send error", gmailData);
      return res.status(200).json({
        status: "error",
        message: "Error enviando correo con Gmail API",
        data: null
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Correo enviado correctamente",
      data: { id: gmailData.id || null }
    });
  } catch (error) {
    console.error("send-email handler error", error);
    return res.status(200).json({
      status: "error",
      message: "Error interno enviando correo",
      data: null
    });
  }
}
