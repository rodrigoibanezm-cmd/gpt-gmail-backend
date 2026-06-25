import { searchGmail } from "../lib/gmailSearch.js";
import { countGmailSearch } from "../lib/gmailCount.js";
import { searchGmailAll } from "../lib/gmailSearchAll.js";
import { getGmailMessage } from "../lib/gmailMessage.js";
import { getGmailProfile } from "../lib/gmailProfile.js";
import { searchGmailSent } from "../lib/gmailSent.js";
import { getGmailThread } from "../lib/gmailThread.js";
import { exportGmailDiscovery } from "../lib/gmailDiscoveryExport.js";
import { discoveryBatch } from "../lib/gmailDiscoveryBatch.js";
import { getSetupProfile, saveSetupProfile } from "../lib/setupProfile.js";
import { upsertPressureCards } from "../lib/pressureCards.js";

function sendSuccess(res, tool, data) {
  return res.status(200).json({ status: "success", tool, data });
}

function sendError(res, tool, message) {
  return res.status(200).json({ status: "error", tool, message, data: null });
}

function getParams(body) {
  const params = body.params && typeof body.params === "object" ? body.params : {};
  return {
    ...params,
    tenant_id: body.tenant_id ?? params.tenant_id,
    tenantId: body.tenantId ?? params.tenantId,
    user_id: body.user_id ?? params.user_id,
    cards: body.cards ?? params.cards
  };
}

const handlers = {
  "gmail.profile.get": (userId) => getGmailProfile(userId),
  "gmail.search": (userId, params) => searchGmail(userId, params),
  "gmail.search.count": (userId, params) => countGmailSearch(userId, params),
  "gmail.search.all": (userId, params) => searchGmailAll(userId, params),
  "gmail.sent.search": (userId, params) => searchGmailSent(userId, params),
  "gmail.discovery.export": (userId, params) => exportGmailDiscovery(userId, params),
  "gmail.discovery.batch": (userId, params) => discoveryBatch(userId, params),
  "gmail.message.get": (userId, params) => getGmailMessage(userId, params),
  "gmail.thread.get": (userId, params) => getGmailThread(userId, params),
  "setup.profile.get": (userId) => getSetupProfile(userId),
  "setup.profile.save": (userId, params) => saveSetupProfile(userId, params),
  "pressure.cards.upsert": (userId, params) => upsertPressureCards(userId, params)
};

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, null, "Metodo no permitido. Usa POST.");

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const tool = body.tool || body.action;
  const userId = body.userId || body.user_id;
  const params = getParams(body);

  if (!tool) return sendError(res, null, "Falta tool.");
  if (!userId) return sendError(res, tool, "Falta userId.");
  if (!handlers[tool]) return sendError(res, tool, "Tool no soportada.");

  try {
    const result = await handlers[tool](userId, params);
    if (!result.ok) return sendError(res, tool, result.message);
    return sendSuccess(res, tool, result);
  } catch (error) {
    console.error("api router error", error);
    return sendError(res, tool, "Error interno.");
  }
}
