import { getValidAccessToken } from "./gmailAuth.js";

async function fetchJson(url, accessToken) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

function normalizeSendAs(item = {}) {
  return {
    email: item.sendAsEmail || null,
    name: item.displayName || null,
    is_default: Boolean(item.isDefault),
    is_primary: Boolean(item.isPrimary),
    reply_to: item.replyToAddress || null
  };
}

export async function getGmailProfile(userId) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, message: "No se pudo obtener un access token válido" };

  const profile = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", accessToken);
  if (!profile.ok) return { ok: false, message: "Error obteniendo perfil Gmail" };

  const sendAs = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", accessToken);
  const aliases = sendAs.ok && Array.isArray(sendAs.data.sendAs)
    ? sendAs.data.sendAs.map(normalizeSendAs)
    : [];
  const primary = aliases.find((x) => x.is_primary) || aliases.find((x) => x.is_default) || null;

  return {
    ok: true,
    email: profile.data.emailAddress || null,
    name: primary?.name || null,
    aliases,
    messages_total: profile.data.messagesTotal || null,
    threads_total: profile.data.threadsTotal || null,
    history_id: profile.data.historyId || null,
    aliases_available: sendAs.ok
  };
}
