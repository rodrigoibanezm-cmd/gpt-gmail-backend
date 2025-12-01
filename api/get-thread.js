// /api/get-thread.js
//
// Unifica:
// - Obtener hilo completo (con metadata y adjuntos por mensaje)
// - Obtener contenido de un adjunto concreto
//
// Modo 1: hilo
//   GET /api/get-thread?userId=...&threadId=...
//
// Modo 2: adjunto
//   GET /api/get-thread?userId=...&messageId=...&attachmentId=...[&encoding=text|base64]

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

function extractHeaders(headersArray) {
  const list = Array.isArray(headersArray) ? headersArray : [];

  const getHeader = (name) => {
    const h = list.find(
      (h) =>
        typeof h.name === "string" &&
        h.name.toLowerCase() === name
    );
    return h && typeof h.value === "string" ? h.value : "";
  };

  return {
    subject: getHeader("subject"),
    from: getHeader("from"),
    to: getHeader("to"),
    date: getHeader("date")
  };
}

function extractAttachmentsFromPayload(payload, messageId) {
  const attachments = [];
  if (!payload) return attachments;

  const queue = [];
  if (Array.isArray(payload.parts)) {
    queue.push(...payload.parts);
  }

  while (queue.length > 0) {
    const part = queue.shift();
    if (!part) continue;

    if (Array.isArray(part.parts)) {
      queue.push(...part.parts);
    }

    if (
      part.filename &&
      part.body &&
      part.body.attachmentId
    ) {
      attachments.push({
        messageId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || null,
        attachmentId: part.body.attachmentId
      });
    }
  }

  return attachments;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido, use GET",
      data: null
    });
  }

  const { userId, threadId, messageId, attachmentId, encoding } = req.query || {};

  if (!userId) {
    return res.status(200).json({
      status: "error",
      message: "Falta parámetro requerido: userId",
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

    // MODO 2: obtener contenido de adjunto
    if (attachmentId) {
      if (!messageId) {
        return res.status(200).json({
          status: "error",
          message: "Para obtener un adjunto se requiere messageId y attachmentId",
          data: null
        });
      }

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
        return res.status(200).json({
          status: "error",
          message: "Error al parsear la respuesta de Gmail en get-thread (adjunto)",
          data: null
        });
      }

      if (!r.ok || !data || !data.data) {
        console.error("Gmail get-attachment error", data);
        return res.status(200).json({
          status: "error",
          message: "Error obteniendo adjunto en Gmail API",
          data: null
        });
      }

      const buffer = base64UrlToBuffer(data.data);
      const mode = (encoding || "text").toLowerCase();

      if (mode === "base64") {
        return res.status(200).json({
          status: "success",
          message: "Adjunto obtenido correctamente (base64url)",
          data: { base64url: data.data }
        });
      }

      let text = "";
      try {
        if (typeof Buffer !== "undefined" && buffer instanceof Buffer) {
          text = buffer.toString("utf8");
        } else if (buffer && buffer.length) {
          text = new TextDecoder("utf-8").decode(buffer);
        }
      } catch (e) {
        console.error("Error decodificando adjunto como texto", e);
      }

      return res.status(200).json({
        status: "success",
        message: "Adjunto obtenido correctamente",
        data: { text }
      });
    }

    // MODO 1: obtener hilo completo
    if (!threadId) {
      return res.status(200).json({
        status: "error",
        message: "Falta parámetro requerido: threadId",
        data: null
      });
    }

    const url =
      "https://gmail.googleapis.com/gmail/v1/users/me/threads/" +
      encodeURIComponent(threadId) +
      "?format=full";

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let data;
    try {
      data = await r.json();
    } catch (e) {
      return res.status(200).json({
        status: "error",
        message: "Error al parsear la respuesta de Gmail en get-thread",
        data: null
      });
    }

    if (!r.ok || !data) {
      console.error("Gmail get-thread error", data);
      return res.status(200).json({
        status: "error",
        message: "Error obteniendo hilo en Gmail API",
        data: null
      });
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];

    const mappedMessages = messages.map((msg) => {
      const headers = extractHeaders(msg.payload?.headers);
      const attachments = extractAttachmentsFromPayload(msg.payload, msg.id);

      return {
        id: msg.id || null,
        threadId: msg.threadId || null,
        snippet: msg.snippet || "",
        subject: headers.subject,
        from: headers.from,
        to: headers.to,
        date: headers.date,
        attachments
      };
    });

    const thread = {
      id: data.id || null,
      historyId: data.historyId || null,
      messages: mappedMessages
    };

    return res.status(200).json({
      status: "success",
      message: "Hilo obtenido correctamente",
      data: { thread }
    });
  } catch (error) {
    console.error("get-thread handler error", error);
    return res.status(200).json({
      status: "error",
      message: "Error interno obteniendo hilo",
      data: null
    });
  }
}
