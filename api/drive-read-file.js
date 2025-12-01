module.exports = async function (req, res) {
  const { userId, fileId } = req.query;

  if (!userId || !fileId) {
    return res.status(400).json({
      status: 'error',
      message: 'Falta userId o fileId'
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
    // 1) Leer token
    const kvResponse = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });

    const kvJson = await kvResponse.json();
    let tokenData = {};
    try {
      tokenData = JSON.parse(kvJson.result || '{}');
    } catch (e) {
      return res.status(500).json({
        status: 'error',
        message: 'Token KV inválido'
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(500).json({
        status: 'error',
        message: 'No hay access_token de Drive para este userId'
      });
    }

    // 2) Obtener metadata del archivo (para saber tipo)
    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaResp.json();

    if (!metaResp.ok) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al obtener metadata del archivo',
        details: meta
      });
    }

    const mime = meta.mimeType;

    // 3) Exportación según tipo Google
    let exportUrl = null;

    // Google Docs → text/plain
    if (mime === "application/vnd.google-apps.document") {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    }

    // Google Sheets → CSV
    else if (mime === "application/vnd.google-apps.spreadsheet") {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    }

    // Otros → descargar directo
    else {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const fileResp = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!fileResp.ok) {
      const err = await fileResp.text();
      return res.status(500).json({
        status: 'error',
        message: 'Error al exportar/descargar archivo',
        details: err
      });
    }

    const content = await fileResp.text();

    return res.status(200).json({
      status: 'success',
      name: meta.name,
      mimeType: meta.mimeType,
      content: content
    });

  } catch (err) {
    console.error('Error interno read-file:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno en drive-read-file'
    });
  }
};
