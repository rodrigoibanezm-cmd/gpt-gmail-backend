export function encodeCursor(value) {
  if (!value) return null;
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value) {
  if (!value) return { pending: [], gmailNext: null };

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      gmailNext: parsed.gmailNext || null
    };
  } catch {
    return { pending: [], gmailNext: value };
  }
}

export function nextCursor(threadIds, index, pending, gmailNext) {
  const rest = [...threadIds.slice(index), ...(pending || [])];
  if (!rest.length && !gmailNext) return null;
  return encodeCursor({ pending: rest, gmailNext });
}
