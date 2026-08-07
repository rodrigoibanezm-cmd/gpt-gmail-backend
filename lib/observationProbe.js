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
  return String(value || "").split(",").map((raw) => ({ email: emailOf(raw) })).filter((x) => x.email);
}

function personId(email) {
  return `person_${createHash("sha256").update(String(email || "").toLowerCase()).digest("hex").slice(0, 16)}`;
}

function personRow(email) {
  return { person_id: personId(email), email };
}

function uniquePeople(items) {
  const map = new Map();
  for (const item of items) if (item?.email && !map.has(item.email)) map.set(item.email, personRow(item.email));
  return [...map.values()];
}

function uniqueIds(values) {
  return [...new Set(values.filter(Boolean))];
}

function minutesBetween(a, b) {
  const x = Date.parse(a || "");
  const y = Date.parse(b || "");
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < x) return null;
  return Math.round((y - x) / 60000);
}

function normalizeMessage(msg, ownerEmail, conversationId, position, messageCount, previous) {
  const headers = msg.payload?.headers || [];
  const fromEmail = emailOf(header(headers, "From"));
  const to = people(header(headers, "To"));
  const cc = people(header(headers, "Cc"));
  const date = header(headers, "Date");
  const references = header(headers, "References");
  const identities = uniquePeople([{ email: fromEmail }, ...to, ...cc]);

  return {
    event: {
      message_id: msg.id || null,
      source_message_id: header(headers, "Message-ID"),
      conversation_id: conversationId,
      is_single_message: messageCount === 1,
      position,
      timestamp: date,
      sender_id: personId(fromEmail),
      to_ids: to.map((p) => personId(p.email)),
      cc_ids: cc.map((p) => personId(p.email)),
      direction: fromEmail === ownerEmail ? "outbound" : "inbound",
      in_reply_to: header(headers, "In-Reply-To"),
      references: references ? references.split(/\s+/).filter(Boolean) : [],
      gap_from_previous_minutes: previous ? minutesBetween(previous.timestamp, date) : null,
      snippet: String(msg.snippet || "").slice(0, 500)
    },
    identities
  };
}

async function fetchThread(accessToken, threadId, ownerEmail) {
  const qs = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Cc", "Subject", "Date", "Message-ID", "In-Reply-To", "References"]) qs.append("metadataHeaders", h);
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { conversation_id: threadId, error: "thread_fetch_failed", identities: [], events: [] };

  const sourceMessages = Array.isArray(data.messages) ? data.messages : [];
  const conversationId = data.id || threadId;
  const events = [];
  const identities = [];

  for (let i = 0; i < sourceMessages.length; i += 1) {
    const normalized = normalizeMessage(
      sourceMessages[i],
      ownerEmail,
      conversationId,
      i + 1,
      sourceMessages.length,
      events[i - 1]
    );
    events.push(normalized.event);
    identities.push(...normalized.identities);
  }

  return {
    conversation_id: conversationId,
    subject: header(sourceMessages[0]?.payload?.headers || [], "Subject"),
    started_at: events[0]?.timestamp || null,
    last_activity_at: events[events.length - 1]?.timestamp || null,
    message_count: events.length,
    is_single_message: events.length === 1,
    participant_ids: uniqueIds(events.flatMap((event) => [event.sender_id, ...event.to_ids, ...event.cc_ids])),
    event_ids: events.map((event) => event.message_id),
    events,
    identities
  };
}

export async function observationProbe(userId, params = {}) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };

  const maxThreads = intParam(params.maxThreads, 15, 40);
  const requestedDays = intParam(params.days, 180, 180);
  const query = buildDiscoveryQuery({ ...params, days: requestedDays });
  const cursor = decodeCursor(params.cursor || params.pageToken || params.nextCursor);
  const profile = await getGmailProfile(userId);
  const ownerEmail = String(profile.email || "").toLowerCase();
  const found = await fetchThreadIds(accessToken, query, maxThreads, cursor);
  const conversations = [];
  const events = [];
  const peopleRows = [];
  let firstObserved = null;
  let lastObserved = null;
  let failed = 0;

  for (const threadId of found.threadIds) {
    const result = await fetchThread(accessToken, threadId, ownerEmail);
    peopleRows.push(...result.identities);
    if (result.error) {
      failed += 1;
      conversations.push({ conversation_id: threadId, error: result.error });
      continue;
    }

    events.push(...result.events);
    conversations.push({
      conversation_id: result.conversation_id,
      subject: result.subject,
      started_at: result.started_at,
      last_activity_at: result.last_activity_at,
      message_count: result.message_count,
      is_single_message: result.is_single_message,
      participant_ids: result.participant_ids,
      event_ids: result.event_ids
    });

    if (!firstObserved || Date.parse(result.started_at) < Date.parse(firstObserved)) firstObserved = result.started_at;
    if (!lastObserved || Date.parse(result.last_activity_at) > Date.parse(lastObserved)) lastObserved = result.last_activity_at;
  }

  const next = nextCursor(found.threadIds, found.threadIds.length, found.pending, found.gmailNext);
  const observedPeople = uniquePeople(peopleRows);

  return {
    ok: true,
    probe_version: "observation_probe.v0.2",
    tenant_id: params.tenant_id || params.tenantId || null,
    subject: { user_id: userId, person_id: personId(ownerEmail), email: ownerEmail },
    requested_window_days: requestedDays,
    observed_window: { from: firstObserved, to: lastObserved },
    coverage: {
      events_returned: events.length,
      single_message_events: events.filter((event) => event.is_single_message).length,
      conversations_returned: conversations.length - failed,
      conversations_failed: failed,
      people_observed: observedPeople.length,
      has_more: Boolean(next)
    },
    people: observedPeople,
    events,
    conversations,
    nextCursor: next,
    hasMore: Boolean(next)
  };
}
