import { getValidAccessToken } from "./gmailAuth.js";

function normalizeLimit(value, fallback, max) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function getHeader(headers, name) {
  const found = headers.find(
    (h) => String(h.name || "").toLowerCase() === name.toLowerCase()
  );
  return found?.value || null;
}

function hasAttachments(payload) {
  const stack = [payload];

  while (stack.length) {
    const part = stack.pop();
    if (!part) continue;
    if (part.filename && part.body?.attachmentId) return true;
    if (Array.isArray(part.parts)) stack.push(...part.parts);
  }

  return false;
}

async function getMessageMetadata(accessToken, msg) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msg.id)}` +
    "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await r.json();
  const headers = data?.payload?.headers || [];

  return {
    id: msg.id || null,
    threadId: msg.threadId || null,
    from: getHeader(headers, "From"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    snippet: data.snippet || "",
    hasAttachments: hasAttachments(data.payload)
  };
}

export async function searchGmailAll(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { ok: false, message: "No se pudo obtener un access token válido" };
  }

  const query = params.query;
  if (!query) return { ok: false, message: "Falta query" };

  const maxPages = normalizeLimit(params.maxPages, 5, 20);
  const maxMessages = normalizeLimit(params.maxMessages, 100, 500);
  const pageSize = Math.min(25, maxMessages);
  const messages = [];
  const seen = new Set();

  let pageToken = params.pageToken || null;
  let pagesScanned = 0;
  let hasMore = false;
  let nextPageToken = null;

  while (pagesScanned < maxPages && messages.length < maxMessages) {
    const remaining = maxMessages - messages.length;
    const qs = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(pageSize, remaining))
    });

    if (pageToken) qs.append("pageToken", pageToken);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${qs.toString()}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await r.json();

    if (!r.ok) {
      console.error("Gmail search all error", data);
      return { ok: false, message: "Error buscando correos en Gmail API" };
    }

    const pageMessages = Array.isArray(data.messages) ? data.messages : [];
    for (const msg of pageMessages) {
      if (!msg.id || seen.has(msg.id) || messages.length >= maxMessages) continue;
      seen.add(msg.id);
      messages.push(await getMessageMetadata(accessToken, msg));
    }

    pagesScanned += 1;
    nextPageToken = data.nextPageToken || null;
    hasMore = Boolean(nextPageToken);
    if (!hasMore || pageMessages.length === 0) break;
    pageToken = nextPageToken;
  }

  return {
    ok: true,
    query,
    messages_returned: messages.length,
    pages_scanned: pagesScanned,
    max_pages: maxPages,
    max_messages: maxMessages,
    complete: !hasMore,
    has_more: hasMore,
    next_page_token: nextPageToken,
    messages
  };
}
