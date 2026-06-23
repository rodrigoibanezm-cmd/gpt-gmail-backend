import { getValidAccessToken } from "./gmailAuth.js";

function normalizeLimit(value, fallback, max) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

export async function countGmailSearch(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { ok: false, message: "No se pudo obtener un access token válido" };
  }

  const query = params.query;
  if (!query) return { ok: false, message: "Falta query" };

  const maxPages = normalizeLimit(params.maxPages, 10, 50);
  const maxMessages = normalizeLimit(params.maxMessages, 500, 2000);
  const pageSize = Math.min(100, maxMessages);

  let pageToken = params.pageToken || null;
  let counted = 0;
  let pagesScanned = 0;
  let hasMore = false;
  let nextPageToken = null;

  while (pagesScanned < maxPages && counted < maxMessages) {
    const remaining = maxMessages - counted;
    const qs = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(pageSize, remaining))
    });

    if (pageToken) qs.append("pageToken", pageToken);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${qs.toString()}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await r.json();

    if (!r.ok) {
      console.error("Gmail count error", data);
      return { ok: false, message: "Error contando correos en Gmail API" };
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    counted += messages.length;
    pagesScanned += 1;
    nextPageToken = data.nextPageToken || null;
    hasMore = Boolean(nextPageToken);

    if (!hasMore || messages.length === 0) break;
    pageToken = nextPageToken;
  }

  return {
    ok: true,
    query,
    counted,
    pages_scanned: pagesScanned,
    max_pages: maxPages,
    max_messages: maxMessages,
    complete: !hasMore,
    has_more: hasMore,
    next_page_token: nextPageToken
  };
}
