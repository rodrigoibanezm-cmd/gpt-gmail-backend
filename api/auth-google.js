// /api/auth-google.js
//
// Genera la URL de autorización OAuth de Google
// y la devuelve en JSON pequeño para que el GPT
// la muestre al usuario. NO hace redirect.

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(200).json({
      status: "error",
      message: "Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI en las env vars",
      data: null
    });
  }

  const { userId } = req.query || {};
  const state = userId ? encodeURIComponent(userId) : "";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.readonly"
    ].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent"
  });

  if (state) {
    params.append("state", state);
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.status(200).json({
    status: "success",
    message: "URL de autorización generada correctamente",
    data: {
      authUrl
    }
  });
}
