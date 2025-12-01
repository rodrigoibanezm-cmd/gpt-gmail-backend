module.exports = async function (req, res) {
  const { action, userId } = req.query;

  if (!action) {
    return res.status(400).json({
      status: 'error',
      message: 'Falta action en la query'
    });
  }

  if (!userId) {
    return res.status(400).json({
      status: 'error',
      message: 'Falta userId en la query'
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
    // 1) Leer token una sola vez
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
      console.error('Error KV Drive:', kvResponse.status, txt);
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
      console.error('JSON inválido en KV Drive:', kvJson);
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

    // Router por acción
    if (action === 'listRoot') {
      return await handleListRoot(accessToken, res);
    }

    if (action === 'search') {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          status: 'error',
          message: 'Falta q (texto de búsqueda) en la query'
        });
      }
      return await handleSearch(accessToken, q, res);
    }

    if (action === 'readFile') {
      const { fileId } = req.query;
      if (!fileId) {
        return res.status(400).json({
          status: 'error',
          message: 'Falta fileId en la query'
        });
      }
      return await handleReadFile(accessToken, fileId, res);
    }

    if (action === 'listFolder') {
      const { folderId } = req.query;
      if (!folderId) {
        return res.status(400).json({
          status: 'error',
          message: 'Falta folderId en la query'
        });
      }
      return await handleListFolder(accessToken, folderId, res);
    }

    return res.status(400).json({
      status: 'error',
      message: 'Action no soportada'
    });
  } catch (err) {
    console.error('Error interno /api/drive:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno en /api/drive'
    });
  }
};

// === Handlers específicos ===

async function handleListRoot(accessToken, res) {
  const query = "'root' in parents and trashed = false";
  const params = new URLSearchParams({
    q: query,
    pageSize: '20',
    fields: 'files(id,name,mimeType,modifiedTime,owners(emailAddress,displayName))'
  });

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const driveData = await driveResponse.json();

  if (!driveResponse.ok) {
    console.error('Error Drive API listRoot:', driveResponse.status, driveData);
    return res.status(500).json({
      status: 'error',
      message: 'Error al llamar a Google Drive (listRoot)',
      details: driveData
    });
  }

  return res.status(200).json({
    status: 'success',
    files: driveData.files || []
  });
}

async function handleSearch(accessToken, q, res) {
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
      headers: { Authorization: `Bearer ${accessToken}` }
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
}

async function handleReadFile(accessToken, fileId, res) {
  // Metadata
  const metaResp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaResp.json();

  if (!metaResp.ok) {
    console.error('Error meta readFile:', metaResp.status, meta);
    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener metadata del archivo',
      details: meta
    });
  }

  const mime = meta.mimeType;
  let exportUrl;

  if (mime === 'application/vnd.google-apps.document') {
    exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else if (mime === 'application/vnd.google-apps.spreadsheet') {
    exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
  } else {
    exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const fileResp = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!fileResp.ok) {
    const errText = await fileResp.text();
    console.error('Error export/descarga readFile:', fileResp.status, errText);
    return res.status(500).json({
      status: 'error',
      message: 'Error al exportar/descargar archivo',
      details: errText
    });
  }

  const content = await fileResp.text();

  return res.status(200).json({
    status: 'success',
    name: meta.name,
    mimeType: meta.mimeType,
    content: content
  });
}

async function handleListFolder(accessToken, folderId, res) {
  const query = `'${folderId}' in parents and trashed = false`;

  const params = new URLSearchParams({
    q: query,
    pageSize: '50',
    orderBy: 'folder,name',
    fields: 'files(id,name,mimeType,modifiedTime,owners(emailAddress,displayName))'
  });

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const driveData = await driveResponse.json();

  if (!driveResponse.ok) {
    console.error('Error Drive API listFolder:', driveResponse.status, driveData);
    return res.status(500).json({
      status: 'error',
      message: 'Error al llamar a Google Drive (listFolder)',
      details: driveData
    });
  }

  return res.status(200).json({
    status: 'success',
    files: driveData.files || []
  });
}
