import { getValidAccessToken } from "./gmailAuth.js";

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

function normalizeMaxResults(value) {
  const parsed = Number.parseInt(value || "10", 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 25));
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

export async function searchGmail(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { ok: false, message: "No se pudo obtener un access token válido" };
  }

  const query = params.query;
  const maxResults = normalizeMaxResults(params.maxResults);
  if (!query) return { ok: false, message: "Falta query" };

  const qs = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (params.pageToken) qs.append("pageToken", params.pageToken);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${qs.toString()}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json();

  if (!r.ok) {
    console.error("Gmail search error", data);
    return { ok: false, message: "Error buscando correos en Gmail API" };
  }

  const baseMessages = Array.isArray(data.messages) ? data.messages : [];
  const messages = [];

  for (const msg of baseMessages) {
    try {
      messages.push(await getMessageMetadata(accessToken, msg));
    } catch (e) {
      console.error("Error enriqueciendo mensaje", e);
      messages.push({ id: msg.id, threadId: msg.threadId, error: "metadata_failed" });
    }
  }

  return {
    ok: true,
    query,
    estimated_total: data.resultSizeEstimate || 0,
    returned: messages.length,
    maxResults,
    has_more: Boolean(data.nextPageToken),
    next_page_token: data.nextPageToken || null,
    messages
  };
}
