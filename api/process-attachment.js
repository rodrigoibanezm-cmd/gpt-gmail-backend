// /api/process-attachment.js
//
// Pipeline:
// 1) Descargar adjunto desde Gmail (messageId + attachmentId)
// 2) Subirlo a Drive convertido a Google Doc/Sheet cuando aplica
// 3) Exportar como texto (plain o CSV)
// 4) Devolver texto listo para que el GPT lo resuma / analice
//
// Soporta bien:
// - PDF  → texto
// - DOCX → texto
// - XLSX → CSV texto
// Otros formatos: intenta texto directo (fallback simple).

async function getStoredToken(userId) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken || !userId) {
    return null;
  }

  const key = `gmail:${userId}`;

  const kvRes = await fetch(
    `${kvUrl}/get/${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${kvToken}` }
    }
  );

  if (!kvRes.ok) {
    return null;
  }

  try {
    const kvData = await kvRes.json();
    if (!kvData || typeof kvData.result !== "string") {
      return null;
    }
    return JSON.parse(kvData.result);
  } catch (e) {
    console.error("Error parseando KV getStoredToken", e);
    return null;
  }
}

async function getValidAccessToken(userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const stored = await getStoredToken(userId);
  if (!stored || !stored.refresh_token) {
    return null;
  }

  const now = Date.now();
  const safetyMarginMs = 60_000;

  if (
    stored.access_token &&
    typeof stored.expiry_date === "number" &&
    stored.expiry_date - safetyMarginMs > now
  ) {
    return stored.access_token;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch (e) {
    console.error("Error parseando respuesta de token refresh", e);
    return null;
  }

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("Error renovando access token", tokenData);
    return null;
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    const key = `gmail:${userId}`;
    const toStore = {
      ...stored,
      access_token: tokenData.access_token,
      expiry_date: Date.now() + (tokenData.expires_in || 0) * 1000
    };

    try {
      await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toStore)
      });
    } catch (e) {
      console.error("Error actualizando token en KV", e);
    }
  }

  return tokenData.access_token;
}

function base64UrlToBuffer(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded =
    pad === 2 ? base64 + "==" : pad === 3 ? base64 + "=" : base64;

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64");
  }

  // Fallback simple; en Vercel Node siempre hay Buffer
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function detectFileKind(mimeType, fileName) {
  const mt = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (
    mt === "application/pdf" ||
    name.endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mt === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    return "docx";
  }

  if (
    mt === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mt === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return "xlsx";
  }

  return "other";
}

function buildMultipartBody(metadata, fileBuffer, contentType) {
  const boundary = "BOUNDARY_" + Date.now();

  const preamble =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n" +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType || "application/octet-stream"}\r\n\r\n`;

  const closing = `\r\n--${boundary}--`;

  const parts = [
    Buffer.from(preamble, "utf8"),
    fileBuffer,
    Buffer.from(closing, "utf8")
  ];

  const body = Buffer.concat(parts);

  return { body, boundary };
}

async function downloadAttachmentFromGmail(accessToken, messageId, attachmentId) {
  const url =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
    encodeURIComponent(messageId) +
    "/attachments/" +
    encodeURIComponent(attachmentId);

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  let data;
  try {
    data = await r.json();
  } catch (e) {
    console.error("Error parseando respuesta Gmail en downloadAttachment", e);
    return null;
  }

  if (!r.ok || !data || !data.data) {
    console.error("Gmail downloadAttachment error", data);
    return null;
  }

  const buffer = base64UrlToBuffer(data.data);
  return buffer;
}

async function uploadToDriveAsGoogleDocOrSheet(accessToken, buffer, fileName, originalMimeType, kind) {
  let targetMime;
  if (kind === "xlsx") {
    targetMime = "application/vnd.google-apps.spreadsheet";
  } else {
    targetMime = "application/vnd.google-apps.document";
  }

  const metadata = {
    name: fileName || "adjunto",
    mimeType: targetMime
  };

  const { body, boundary } = buildMultipartBody(
    metadata,
    buffer,
    originalMimeType || "application/octet-stream"
  );

  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const r = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  let data;
  try {
    data = await r.json();
  } catch (e) {
    console.error("Error parseando respuesta de Drive upload", e);
    return null;
  }

  if (!r.ok || !data || !data.id) {
    console.error("Error subiendo archivo a Drive", data);
    return null;
  }

  return data.id;
}

async function exportDriveFileToText(accessToken, fileId, kind) {
  let exportMime;

  if (kind === "xlsx") {
    exportMime = "text/csv";
  } else {
    exportMime = "text/plain";
  }

  const url =
    "https://www.googleapis.com/drive/v3/files/" +
    encodeURIComponent(fileId) +
    "/export?mimeType=" +
    encodeURIComponent(exportMime);

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const text = await r.text();

  if (!r.ok) {
    console.error("Error exportando archivo de Drive", text);
    return null;
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido, use GET",
      data: null
    });
  }

  const {
    userId,
    messageId,
    attachmentId,
    fileName,
    mimeType
  } = req.query || {};

  if (!userId || !messageId || !attachmentId) {
    return res.status(200).json({
      status: "error",
      message: "Faltan parámetros requeridos: userId, messageId, attachmentId",
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

    const buffer = await downloadAttachmentFromGmail(
      accessToken,
      messageId,
      attachmentId
    );

    if (!buffer) {
      return res.status(200).json({
        status: "error",
        message: "No se pudo descargar el adjunto desde Gmail",
        data: null
      });
    }

    const kind = detectFileKind(mimeType, fileName);

    if (kind === "pdf" || kind === "docx" || kind === "xlsx") {
      const fileId = await uploadToDriveAsGoogleDocOrSheet(
        accessToken,
        buffer,
        fileName,
        mimeType,
        kind
      );

      if (!fileId) {
        return res.status(200).json({
          status: "error",
          message: "No se pudo subir/convertir el adjunto en Drive",
          data: null
        });
      }

      const text = await exportDriveFileToText(accessToken, fileId, kind);
      if (text == null) {
        return res.status(200).json({
          status: "error",
          message: "No se pudo exportar el archivo de Drive a texto",
          data: null
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Adjunto procesado correctamente",
        data: {
          type: kind,
          fileId,
          text
        }
      });
    }

    // Fallback: intentar texto directo para otros formatos
    let textFallback = "";
    try {
      if (typeof Buffer !== "undefined" && buffer instanceof Buffer) {
        textFallback = buffer.toString("utf8");
      } else if (buffer && buffer.length) {
        textFallback = new TextDecoder("utf-8").decode(buffer);
      }
    } catch (e) {
      console.error("Error decodificando adjunto como texto (fallback)", e);
    }

    return res.status(200).json({
      status: "success",
      message: "Adjunto procesado (fallback texto directo)",
      data: {
        type: "other",
        text: textFallback
      }
    });
  } catch (error) {
    console.error("process-attachment handler error", error);
    return res.status(200).json({
      status: "error",
      message: "Error interno procesando adjunto",
      data: null
    });
  }
}
