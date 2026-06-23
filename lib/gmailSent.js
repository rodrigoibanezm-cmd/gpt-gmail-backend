import { searchGmailAll } from "./gmailSearchAll.js";

function buildSentQuery(query) {
  const q = String(query || "").trim();
  return q ? `in:sent ${q}` : "in:sent";
}

export async function searchGmailSent(userId, params = {}) {
  return searchGmailAll(userId, {
    ...params,
    query: buildSentQuery(params.query)
  });
}
