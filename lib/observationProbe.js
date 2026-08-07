import { createHash } from "node:crypto";
import { getValidAccessToken } from "./gmailAuth.js";
import { getGmailProfile } from "./gmailProfile.js";
import { decodeCursor, nextCursor } from "./gmailDiscoveryCursor.js";
import { buildDiscoveryQuery, fetchThreadIds, intParam } from "./gmailDiscoveryQuery.js";

function header(headers, name) {
  return headers.find((h) => String(h.name || "").toLowerCase() === name.toLowerCase())?.value || null;
}

function emailOf(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value || "").trim().toLowerCase();
}

function people(value) {
  return String(value || "").split(",").map((raw) => ({ raw: raw.trim(), email: emailOf(raw) })).filter((x) => x.email);
}

function personId(email) {
  return `person_${createHash("sha256").update(String(email || "").toLowerCase()).digest("hex").slice(0, 16)}`;
}

function uniquePeople(items) {
  const map = new Map();
  for (const item of items) if (item?.email && !map.has(item.email)) map.set(item.email, item);
  return [...map.values()].map((p) => ({ person_id: personId(p.email), email: p.email, raw: p.raw }));
}

function minutesBetween(a, b) {
  const x = Date.parse(a || "");
  const y = Date.parse(b || "");
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < x) return null;
  return Math.round((y - x) / 60000);
}

function normalizeMessage(msg, ownerEmail, position, previous) {
  const headers = msg.payload?.headers || [];
  const fromRaw = header(headers, "From");
  const fromEmail = emailOf(fromRaw);
  const to = people(header(headers, "To"));
  const cc = people(header(headers, "Cc"));
  const date = header(headers, "Date");
  const messageIdHeader = header(headers, "Message-ID");
  const inReplyTo = header(headers, "In-Reply-To");
  const references = header(headers, "References");
  const present = uniquePeople([{ raw: fromRaw, email: fromEmail }, ...to, ...cc]);
  return {
    message_id: msg.id || null,
    source_message_id: messageIdHeader,
    conversation_id: msg.threadId || null,
    position,
    timestamp: date,
    sender: { person_id: personId(fromEmail), email: fromEmail, raw: fromRaw },
    to: to.map((p) => ({ person_id: personId(p.email), email: p.email, raw: p.raw })),
    cc: cc.map((p) => ({ person_id: personId(p.email), email: p.email, raw: p.raw })),
    direction: fromEmail === ownerEmail ? "outbound" : "inbound",
    in_reply_to: inReplyTo,
    references: references ? references.split(/\s+/).filter(Boolean) : [],
    gap_from_previous_minutes: previous ? minutesBetween(previous.timestamp, date) : null,
    participants_present: present.map((p) => p.person_id),
    snippet: String(msg.snippet || "").slice(0, 500)
  };
}

async function fetchThread(accessToken, threadId, ownerEmail) {
  const qs = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Cc", "Subject", "Date", "Message-ID", "In-Reply-To", "References"]) qs.append("metadataHeaders", h);
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { conversation_id: threadId, error: "thread_fetch_failed" };
  const sourceMessages = Array.isArray(data.messages) ? data.messages : [];
  const events = [];
  for (let i = 0; i < sourceMessages.length; i += 1) events.push(normalizeMessage(sourceMessages[i], ownerEmail, i + 1, events[i - 1]));
  const participantRows = [];
  for (const event of events) participantRows.push(event.sender, ...event.to, ...event.cc);
  return {
    conversation_id: data.id || threadId,
    subject: header(sourceMessages[0]?.payload?.headers || [], "Subject"),
    started_at: events[0]?.timestamp || null,
    last_activity_at: events[events.length - 1]?.timestamp || null,
    message_count: events.length,
    participants: uniquePeople(participantRows),
    events
  };
}

export async function observationProbe(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };
  const maxThreads = intParam(params.maxThreads, 15, 40);
  const query = buildDiscoveryQuery({ ...params, days: intParam(params.days, 180, 180) });
  const cursor = decodeCursor(params.cursor || params.pageToken || params.nextCursor);
  const profile = await getGmailProfile(userId);
  const ownerEmail = String(profile.email || "").toLowerCase();
  const found = await fetchThreadIds(accessToken, query, maxThreads, cursor);
  const conversations = [];
  const peopleRows = [];
  let eventsCount = 0;
  let firstObserved = null;
  let lastObserved = null;

  for (const threadId of found.threadIds) {
    const conversation = await fetchThread(accessToken, threadId, ownerEmail);
    conversations.push(conversation);
    if (conversation.error) continue;
    peopleRows.push(...conversation.participants);
    eventsCount += conversation.events.length;
    if (!firstObserved || Date.parse(conversation.started_at) < Date.parse(firstObserved)) firstObserved = conversation.started_at;
    if (!lastObserved || Date.parse(conversation.last_activity_at) > Date.parse(lastObserved)) lastObserved = conversation.last_activity_at;
  }

  const next = nextCursor(found.threadIds, found.threadIds.length, found.pending, found.gmailNext);
  return {
    ok: true,
    probe_version: "observation_probe.v0",
    tenant_id: params.tenant_id || params.tenantId || null,
    subject: { user_id: userId, email: ownerEmail, person_id: personId(ownerEmail) },
    requested_window_days: intParam(params.days, 180, 180),
    observed_window: { from: firstObserved, to: lastObserved },
    coverage: {
      conversations_returned: conversations.filter((x) => !x.error).length,
      conversations_failed: conversations.filter((x) => x.error).length,
      events_returned: eventsCount,
      people_observed: uniquePeople(peopleRows).length,
      has_more: Boolean(next)
    },
    people: uniquePeople(peopleRows),
    conversations,
    nextCursor: next,
    hasMore: Boolean(next)
  };
}
