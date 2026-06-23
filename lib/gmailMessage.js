import { getValidAccessToken } from "./gmailAuth.js";

function header(headers, name) {
  const h = headers.find(
    (x) => String(x.name || "").toLowerCase() === name.toLowerCase()
  );
  return h?.value || null;
}

function decodeBase64Url(value) {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function cleanHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function walkParts(payload, visitor) {
  const stack = [payload];
  while (stack.length) {
    const part = stack.pop();
    if (!part) continue;
    visitor(part);
    if (Array.isArray(part.parts)) stack.push(...part.parts);
  }
}

function extractBody(payload) {
  let plain = "";
  let html = "";

  walkParts(payload, (part) => {
    const mime = part.mimeType || "";
    const data = part.body?.data;
    if (!data) return;
    if (mime === "text/plain" && !plain) plain = decodeBase64Url(data);
    if (mime === "text/html" && !html) html = cleanHtml(decodeBase64Url(data));
  });

  return (plain || html || "").replace(/\s+\n/g, "\n").trim();
}

function extractAttachments(payload, messageId) {
  const attachments = [];

  walkParts(payload, (part) => {
    if (!part.filename || !part.body?.attachmentId) return;
    attachments.push({
      messageId,
      filename: part.filename,
      mimeType: part.mimeType || null,
      size: part.body.size || null,
      attachmentId: part.body.attachmentId
    });
  });

  return attachments;
}

function normalizeMaxBodyChars(value) {
  const parsed = Number.parseInt(value || "20000", 10);
  if (!Number.isFinite(parsed)) return 20000;
  return Math.max(1000, Math.min(parsed, 50000));
}

export async function getGmailMessage(userId, params = {}) {
  const messageId = params.messageId || params.id;
  if (!messageId) return { ok: false, message: "Falta messageId" };

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { ok: false, message: "No se pudo obtener un access token válido" };
  }

  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}` +
    "?format=full";

  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json();

  if (!r.ok) {
    console.error("Gmail message get error", data);
    return { ok: false, message: "Error obteniendo correo en Gmail API" };
  }

  const headers = data.payload?.headers || [];
  const bodyText = extractBody(data.payload || {});
  const maxBodyChars = normalizeMaxBodyChars(params.maxBodyChars);

  return {
    ok: true,
    id: data.id || messageId,
    threadId: data.threadId || null,
    labelIds: data.labelIds || [],
    from: header(headers, "From"),
    to: header(headers, "To"),
    cc: header(headers, "Cc"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    snippet: data.snippet || "",
    body_text: bodyText.slice(0, maxBodyChars),
    body_truncated: bodyText.length > maxBodyChars,
    attachments: extractAttachments(data.payload || {}, data.id || messageId)
  };
}
