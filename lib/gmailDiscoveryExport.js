import { getValidAccessToken } from "./gmailAuth.js";
import { getGmailProfile } from "./gmailProfile.js";

function n(value, fallback, max) {
  const x = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(x, max));
}

function h(headers, name) {
  const item = headers.find((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
  return item?.value || null;
}

function b64(value) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function clean(html) {
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

function parts(payload, fn) {
  const stack = [payload];
  while (stack.length) {
    const p = stack.pop();
    if (!p) continue;
    fn(p);
    if (Array.isArray(p.parts)) stack.push(...p.parts);
  }
}

function body(payload) {
  let plain = "";
  let html = "";
  parts(payload, (p) => {
    const data = p.body?.data;
    if (!data) return;
    if (p.mimeType === "text/plain" && !plain) plain = b64(data);
    if (p.mimeType === "text/html" && !html) html = clean(b64(data));
  });
  return (plain || html || "").trim();
}

function attachments(payload, messageId) {
  const out = [];
  parts(payload, (p) => {
    if (!p.filename || !p.body?.attachmentId) return;
    out.push({
      messageId,
      filename: p.filename,
      mimeType: p.mimeType || null,
      size: p.body.size || 0,
      attachmentId: p.body.attachmentId
    });
  });
  return out;
}

function message(msg, maxBodyChars) {
  const headers = msg.payload?.headers || [];
  const txt = body(msg.payload || {});
  return {
    id: msg.id || null,
    threadId: msg.threadId || null,
    labelIds: msg.labelIds || [],
    from: h(headers, "From"),
    to: h(headers, "To"),
    cc: h(headers, "Cc"),
    subject: h(headers, "Subject"),
    date: h(headers, "Date"),
    snippet: msg.snippet || "",
    body_text: txt.slice(0, maxBodyChars),
    body_truncated: txt.length > maxBodyChars,
    attachments: attachments(msg.payload || {}, msg.id)
  };
}

async function searchThreads(accessToken, query, maxThreads, pageToken) {
  const threadIds = [];
  let next = pageToken || null;
  while (threadIds.length < maxThreads) {
    const qs = new URLSearchParams({ q: query, maxResults: String(Math.min(50, maxThreads - threadIds.length)) });
    if (next) qs.append("pageToken", next);
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${qs.toString()}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("gmail_search_failed");
    for (const m of data.messages || []) if (m.threadId && !threadIds.includes(m.threadId)) threadIds.push(m.threadId);
    next = data.nextPageToken || null;
    if (!next || !(data.messages || []).length) break;
  }
  return { threadIds, nextPageToken: next };
}

async function getThread(accessToken, threadId, maxBodyChars) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { threadId, error: "thread_fetch_failed", messages: [] };
  const messages = (data.messages || []).map((m) => message(m, maxBodyChars));
  const subject = messages.find((m) => m.subject)?.subject || null;
  return { threadId: data.id || threadId, subject, messages_returned: messages.length, messages };
}

function buildQuery(params) {
  const q = String(params.query || "").trim();
  const days = n(params.days, 14, 30);
  const base = q || `newer_than:${days}d`;
  const inbox = params.includeInbox !== false;
  const sent = params.includeSent !== false;
  if (inbox && sent) return base;
  if (sent) return `in:sent ${base}`;
  return `in:anywhere -in:sent ${base}`;
}

export async function exportGmailDiscovery(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };
  const maxThreads = n(params.maxThreads, 20, 50);
  const maxBodyChars = n(params.maxBodyChars, 20000, 50000);
  const query = buildQuery(params);
  try {
    const profile = await getGmailProfile(userId);
    const found = await searchThreads(accessToken, query, maxThreads, params.pageToken);
    const threads = [];
    for (const id of found.threadIds) threads.push(await getThread(accessToken, id, maxBodyChars));
    return { ok: true, profile: profile.ok ? profile : null, window: { days: n(params.days, 14, 30), query }, limits: { max_threads: maxThreads, body_chars_per_message: maxBodyChars, threads_returned: threads.length, has_more: Boolean(found.nextPageToken), next_page_token: found.nextPageToken }, threads };
  } catch (e) {
    console.error("gmail discovery export error", e);
    return { ok: false, message: "Error exportando payload de discovery" };
  }
}
