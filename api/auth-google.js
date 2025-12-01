export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(200).json({
      status: "error",
      message: "Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI",
      data: { authUrl: null }
    });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(200).json({
      status: "error",
      message: "Falta parámetro userId",
      data: { authUrl: null }
    });
  }

  const scope = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly"
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    // OJO: ahora el state es el userId tal cual, sin encode manual
    state: userId
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.status(200).json({
    status: "success",
    message: "URL de autorización generada correctamente",
    data: { authUrl }
  });
}
