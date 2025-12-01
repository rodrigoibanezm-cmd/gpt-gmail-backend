module.exports = function (req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res
      .status(500)
      .send('Faltan GOOGLE_CLIENT_ID o GOOGLE_DRIVE_REDIRECT_URI en las env vars');
  }

  const { userId } = req.query;
  const state = userId ? encodeURIComponent(userId) : '';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent'
  });

  if (state) params.append('state', state);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
};
