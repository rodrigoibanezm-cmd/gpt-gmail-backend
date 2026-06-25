import { getValidAccessToken } from "./gmailAuth.js";
import { getGmailProfile } from "./gmailProfile.js";
import { decodeCursor, nextCursor } from "./gmailDiscoveryCursor.js";
import { buildDiscoveryQuery, fetchThreadIds, intParam } from "./gmailDiscoveryQuery.js";
import { compactThread } from "./gmailDiscoveryThreadCompact.js";

async function fetchCompactThread(accessToken, threadId, ownerEmail, maxLatest) {
  const qs = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Cc", "Subject", "Date"]) qs.append("metadataHeaders", h);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?${qs}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { threadId, error: "thread_fetch_failed" };
  return compactThread(data, ownerEmail, maxLatest);
}

function normalizeParams(params = {}) {
  return {
    days: intParam(params.days, 60, 180),
    maxThreads: intParam(params.maxThreads, 25, 100),
    maxLatestMessages: intParam(params.maxLatestMessages, 4, 10),
    maxPayloadChars: intParam(params.maxPayloadChars, 60000, 160000),
    mode: params.mode || "thread_compact"
  };
}

export async function discoveryBatch(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };

  const cfg = normalizeParams(params);
  const query = buildDiscoveryQuery({ ...params, days: cfg.days });
  const cursor = decodeCursor(params.cursor || params.pageToken);

  try {
    const profile = await getGmailProfile(userId);
    const ownerEmail = String(profile.email || "").toLowerCase();
    const found = await fetchThreadIds(accessToken, query, cfg.maxThreads, cursor);
    const threads = [];
    let used = 0;
    let index = 0;

    for (; index < found.threadIds.length; index += 1) {
      const t = await fetchCompactThread(accessToken, found.threadIds[index], ownerEmail, cfg.maxLatestMessages);
      const size = JSON.stringify(t).length;
      if (threads.length && used + size > cfg.maxPayloadChars) break;
      threads.push(t);
      used += size;
    }

    const next = nextCursor(found.threadIds, index, found.pending, found.gmailNext);
    return {
      ok: true,
      mode: cfg.mode,
      query,
      profile: profile.ok ? profile : null,
      threads,
      nextCursor: next,
      hasMore: Boolean(next),
      limits: {
        maxThreads: cfg.maxThreads,
        maxPayloadChars: cfg.maxPayloadChars,
        payloadCharsReturned: used,
        threadsReturned: threads.length
      }
    };
  } catch (error) {
    console.error("gmail discovery batch error", error);
    return { ok: false, message: "Error exportando discovery batch" };
  }
}
