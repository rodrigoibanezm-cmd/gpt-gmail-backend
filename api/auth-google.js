// /api/auth-google.js

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      status: "error",
      message:
        "Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI en las variables de entorno.",
      data: null
    });
  }

  const { userId } = req.query || {};
  const state = userId || "test_user@example.com";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent"
  });

  if (state) {
    // state SIN encodeURIComponent; URLSearchParams se encarga del encode
    params.append("state", state);
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.status(200).json({
    status: "success",
    message: "URL de autorización generada correctamente",
    data: {
      authUrl,
      userId: state
    }
  });
}
