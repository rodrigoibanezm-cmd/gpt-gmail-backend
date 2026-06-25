function header(headers, name) {
  const found = headers.find((h) => String(h.name || "").toLowerCase() === name.toLowerCase());
  return found?.value || null;
}

function emailOf(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value || "").trim().toLowerCase();
}

function splitPeople(value) {
  return String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasAttachments(payload = {}) {
  const stack = [payload];
  while (stack.length) {
    const part = stack.pop();
    if (!part) continue;
    if (part.filename) return true;
    if (Array.isArray(part.parts)) stack.push(...part.parts);
  }
  return false;
}

function normalizeMessage(msg = {}, ownerEmail) {
  const headers = msg.payload?.headers || [];
  const from = header(headers, "From");
  const to = header(headers, "To");
  const cc = header(headers, "Cc");
  const date = header(headers, "Date");
  const subject = header(headers, "Subject");
  const labels = Array.isArray(msg.labelIds) ? msg.labelIds : [];
  return {
    id: msg.id || null,
    threadId: msg.threadId || null,
    from,
    to,
    cc,
    date,
    subject,
    labels,
    snippet: msg.snippet || "",
    from_owner: emailOf(from) === ownerEmail,
    hasAttachments: hasAttachments(msg.payload || {})
  };
}

function pickLatest(messages, maxLatest) {
  return messages.slice(-maxLatest).map((m) => ({
    id: m.id,
    from: m.from,
    date: m.date,
    snippet: m.snippet,
    from_owner: m.from_owner
  }));
}

function participants(messages) {
  const all = [];
  for (const msg of messages) all.push(msg.from, ...splitPeople(msg.to), ...splitPeople(msg.cc));
  return unique(all).slice(0, 30);
}

function minimalThread(data, messages, maxLatest) {
  const dates = messages.map((m) => m.date).filter(Boolean);
  const ownerMessages = messages.filter((m) => m.from_owner);
  const latest = messages[messages.length - 1] || null;
  return {
    threadId: data.id || messages[0]?.threadId || null,
    subject: messages.find((m) => m.subject)?.subject || null,
    participants: participants(messages),
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    messageCount: messages.length,
    ownerMessageCount: ownerMessages.length,
    ownerLatestMessages: ownerMessages.slice(-maxLatest).map((m) => ({ id: m.id, date: m.date, snippet: m.snippet })),
    latestMessage: latest ? {
      id: latest.id,
      from: latest.from,
      date: latest.date,
      snippet: latest.snippet,
      from_owner: latest.from_owner
    } : null,
    labels: unique(messages.flatMap((m) => m.labels)),
    hasAttachments: messages.some((m) => m.hasAttachments)
  };
}

export function compactThread(data = {}, ownerEmail, maxLatest = 4, summaryLevel = "compact") {
  const messages = (data.messages || []).map((m) => normalizeMessage(m, ownerEmail));
  if (summaryLevel === "minimal") return minimalThread(data, messages, maxLatest);

  const subject = messages.find((m) => m.subject)?.subject || null;
  const dates = messages.map((m) => m.date).filter(Boolean);
  const labels = unique(messages.flatMap((m) => m.labels));
  const ownerMessages = messages.filter((m) => m.from_owner).map((m) => ({ id: m.id, date: m.date, snippet: m.snippet }));

  return {
    threadId: data.id || messages[0]?.threadId || null,
    subject,
    participants: participants(messages),
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    messageCount: messages.length,
    carolinaMessages: ownerMessages,
    latestMessages: pickLatest(messages, maxLatest),
    snippets: messages.map((m) => m.snippet).filter(Boolean).slice(-8),
    labels,
    hasAttachments: messages.some((m) => m.hasAttachments)
  };
}
