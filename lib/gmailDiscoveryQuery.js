export function intParam(value, fallback, max) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

export function buildDiscoveryQuery(params = {}) {
  const query = String(params.query || "").trim();
  const days = intParam(params.days, 30, 180);
  const base = query || `newer_than:${days}d`;
  const inbox = params.includeInbox !== false;
  const sent = params.includeSent !== false;

  if (inbox && sent) return base;
  if (sent) return `in:sent ${base}`;
  return `in:anywhere -in:sent ${base}`;
}

export async function fetchThreadIds(accessToken, query, maxThreads, cursor) {
  const seen = new Set();
  const threadIds = [];
  const pending = [...(cursor.pending || [])];
  let gmailNext = cursor.gmailNext || null;

  while (pending.length && threadIds.length < maxThreads) {
    const id = pending.shift();
    if (id && !seen.has(id)) {
      seen.add(id);
      threadIds.push(id);
    }
  }

  while (threadIds.length < maxThreads) {
    const maxResults = String(Math.min(50, maxThreads - threadIds.length));
    const qs = new URLSearchParams({ q: query, maxResults });
    if (gmailNext) qs.append("pageToken", gmailNext);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${qs}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("gmail_search_failed");

    for (const msg of data.messages || []) {
      if (msg.threadId && !seen.has(msg.threadId)) {
        seen.add(msg.threadId);
        threadIds.push(msg.threadId);
      }
    }

    gmailNext = data.nextPageToken || null;
    if (!gmailNext || !(data.messages || []).length) break;
  }

  return { threadIds, pending, gmailNext };
}
