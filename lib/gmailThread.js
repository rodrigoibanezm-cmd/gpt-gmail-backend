import { getValidAccessToken } from "./gmailAuth.js";

function header(headers, name) {
  const h = headers.find((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
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
  return (plain || html || "").trim();
}

function normalizeLimit(value, fallback, max) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function normalizeMessage(msg, maxBodyChars) {
  const headers = msg.payload?.headers || [];
  const bodyText = extractBody(msg.payload || {});
  return {
    id: msg.id || null,
    threadId: msg.threadId || null,
    labelIds: msg.labelIds || [],
    from: header(headers, "From"),
    to: header(headers, "To"),
    cc: header(headers, "Cc"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    snippet: msg.snippet || "",
    body_text: bodyText.slice(0, maxBodyChars),
    body_truncated: bodyText.length > maxBodyChars
  };
}

export async function getGmailThread(userId, params = {}) {
  const threadId = params.threadId || params.id;
  if (!threadId) return { ok: false, message: "Falta threadId" };

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, message: "Error obteniendo hilo en Gmail API" };

  const maxBodyChars = normalizeLimit(params.maxBodyChars, 12000, 50000);
  const messages = Array.isArray(data.messages)
    ? data.messages.map((msg) => normalizeMessage(msg, maxBodyChars))
    : [];

  return { ok: true, id: data.id || threadId, messages_returned: messages.length, messages };
}
