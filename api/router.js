import { searchGmail } from "../lib/gmailSearch.js";
import { countGmailSearch } from "../lib/gmailCount.js";
import { searchGmailAll } from "../lib/gmailSearchAll.js";
import { getGmailMessage } from "../lib/gmailMessage.js";
import { getGmailProfile } from "../lib/gmailProfile.js";
import { searchGmailSent } from "../lib/gmailSent.js";
import { getGmailThread } from "../lib/gmailThread.js";
import { exportGmailDiscovery } from "../lib/gmailDiscoveryExport.js";
import { getSetupProfile, saveSetupProfile } from "../lib/setupProfile.js";

function sendSuccess(res, tool, data) {
  return res.status(200).json({ status: "success", tool, data });
}

function sendError(res, tool, message) {
  return res.status(200).json({ status: "error", tool, message, data: null });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, null, "Metodo no permitido. Usa POST.");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const tool = body.tool || body.action;
  const userId = body.userId;
  const params = body.params || {};

  if (!tool) return sendError(res, null, "Falta tool.");
  if (!userId) return sendError(res, tool, "Falta userId.");

  try {
    if (tool === "gmail.profile.get") {
      const result = await getGmailProfile(userId);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.search") {
      const result = await searchGmail(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.search.count") {
      const result = await countGmailSearch(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.search.all") {
      const result = await searchGmailAll(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.sent.search") {
      const result = await searchGmailSent(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.discovery.export") {
      const result = await exportGmailDiscovery(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.message.get") {
      const result = await getGmailMessage(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "gmail.thread.get") {
      const result = await getGmailThread(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "setup.profile.get") {
      const result = await getSetupProfile(userId);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    if (tool === "setup.profile.save") {
      const result = await saveSetupProfile(userId, params);
      if (!result.ok) return sendError(res, tool, result.message);
      return sendSuccess(res, tool, result);
    }

    return sendError(res, tool, "Tool no soportada.");
  } catch (error) {
    console.error("api router error", error);
    return sendError(res, tool, "Error interno.");
  }
}
