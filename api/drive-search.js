module.exports = async function (req, res) {
  const { userId, q } = req.query;

  if (!userId) {
    return res.status(400).json({
      status: 'error',
      message: 'Falta userId en la query (ej: ?userId=tu_mail)'
    });
  }

  if (!q) {
    return res.status(400).json({
      status: 'error',
      message: 'Falta q (texto de búsqueda) en la query'
    });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({
      status: 'error',
      message: 'KV_REST_API_URL o KV_REST_API_TOKEN no configurados'
    });
  }

  const key = `drive:${userId}`;

  try {
    // 1) Leer token de Drive desde Upstash
    const kvResponse = await fetch(
      `${kvUrl}/get/${encodeURIComponent(key)}`,
      {
        headers: {
          Authorization: `Bearer ${kvToken}`
        }
      }
    );

    if (!kvResponse.ok) {
      const txt = await kvResponse.text();
      console.error('Error KV Drive search:', kvResponse.status, txt);
      return res.status(500).json({
        status: 'error',
        message: 'No se pudo leer el token de Drive desde KV'
      });
    }

    const kvJson = await kvResponse.json();
    let tokenData = {};
    try {
      tokenData = JSON.parse(kvJson.result || '{}');
    } catch (e) {
      console.error('JSON inválido en KV Drive search:', kvJson);
      return res.status(500).json({
        status: 'error',
        message: 'Formato de token de Drive inválido en KV'
      });
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({
        status: 'error',
        message: 'No hay access_token de Drive para este userId'
      });
    }

    // 2) Llamar a Google Drive: búsqueda por nombre
    const safeQ = q.replace(/'/g, "\\'");
    const query = `name contains '${safeQ}' and trashed = false`;

    const params = new URLSearchParams({
      q: query,
      pageSize: '20',
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,owners(emailAddress,displayName))'
    });

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const driveData = await driveResponse.json();

    if (!driveResponse.ok) {
      console.error('Error Drive API search:', driveResponse.status, driveData);
      return res.status(500).json({
        status: 'error',
        message: 'Error al llamar a Google Drive (search)',
        details: driveData
      });
    }

    return res.status(200).json({
      status: 'success',
      files: driveData.files || []
    });
  } catch (err) {
    console.error('Error interno drive-search:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno en drive-search'
    });
  }
};
