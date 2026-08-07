import { searchGmail } from "./gmailSearch.js";
import { countGmailSearch } from "./gmailCount.js";
import { searchGmailAll } from "./gmailSearchAll.js";
import { getGmailMessage } from "./gmailMessage.js";
import { getGmailProfile } from "./gmailProfile.js";
import { searchGmailSent } from "./gmailSent.js";
import { getGmailThread } from "./gmailThread.js";
import { exportGmailDiscovery } from "./gmailDiscoveryExport.js";
import { discoveryBatch } from "./gmailDiscoveryBatch.js";
import { observationProbe } from "./observationProbe.js";
import { getSetupProfile, saveSetupProfile } from "./setupProfile.js";
import { upsertPressureCards } from "./pressureCards.js";
import { listPressureCards, getPressureCard } from "./pressureCardsRead.js";

export const APP_ACTIONS = [
  "gmail.profile.get", "gmail.search", "gmail.search.count", "gmail.search.all",
  "gmail.sent.search", "gmail.discovery.export", "gmail.discovery.batch",
  "gmail.observation.probe", "gmail.message.get", "gmail.thread.get", "setup.profile.get",
  "setup.profile.save", "pressure.cards.upsert", "pressureboard.get", "workspace.open"
];

const questions = ["Dame 5 red flags.", "¿Qué se ve bien, pero va a explotar en un mes?",
  "¿Qué se ve bien, pero está bajando el rendimiento?",
  "Si tuviera que hacer una sola cosa mañana, ¿qué haría?"];

const handlers = {
  "gmail.profile.get": (userId) => getGmailProfile(userId),
  "gmail.search": (userId, params) => searchGmail(userId, params),
  "gmail.search.count": (userId, params) => countGmailSearch(userId, params),
  "gmail.search.all": (userId, params) => searchGmailAll(userId, params),
  "gmail.sent.search": (userId, params) => searchGmailSent(userId, params),
  "gmail.discovery.export": (userId, params) => exportGmailDiscovery(userId, params),
  "gmail.discovery.batch": (userId, params) => discoveryBatch(userId, params),
  "gmail.observation.probe": (userId, params) => observationProbe(userId, params),
  "gmail.message.get": (userId, params) => getGmailMessage(userId, params),
  "gmail.thread.get": (userId, params) => getGmailThread(userId, params),
  "setup.profile.get": (userId) => getSetupProfile(userId),
  "setup.profile.save": (userId, params) => saveSetupProfile(userId, params),
  "pressure.cards.upsert": (userId, params) => upsertPressureCards(userId, params),
  "pressureboard.get": (userId, params) => listPressureCards(userId, params),
  "workspace.open": (userId, params) => params.cardId
    ? getPressureCard(userId, params)
    : Promise.resolve({ ok: true, tenantId: params.tenantId || userId, card: null })
};

function paramsOf(input) {
  const { action, userId, params, ...flat } = input;
  return { ...flat, ...(params || {}) };
}

export async function routeAppAction(input) {
  const handler = handlers[input.action];
  if (!handler) return { ok: false, message: "Action no soportada" };
  const result = await handler(input.userId, paramsOf(input));
  if (!result.ok) return result;
  if (input.action === "pressureboard.get") {
    return { view: "pressureboard", userId: input.userId, ...result };
  }
  return { view: "workspace", userId: input.userId, questions,
    ...(input.action === "workspace.open" ? result : { card: null }), result };
}
