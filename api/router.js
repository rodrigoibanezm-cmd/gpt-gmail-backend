import { searchGmail } from "../lib/gmailSearch.js";
import { countGmailSearch } from "../lib/gmailCount.js";

function sendSuccess(res, tool, data) {
  return res.status(200).json({ status: "success", tool, data });
}

function sendError(res, tool, message) {
  return res.status(200).json({ status: "error", tool, message, data: null });
}

async function handleGmailSearch(res, userId, params) {
  const result = await searchGmail(userId, params);
  if (!result.ok) return sendError(res, "gmail.search", result.message);
  return sendSuccess(res, "gmail.search", result);
}

async function handleGmailSearchCount(res, userId, params) {
  const result = await countGmailSearch(userId, params);
  if (!result.ok) return sendError(res, "gmail.search.count", result.message);
  return sendSuccess(res, "gmail.search.count", result);
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
    if (tool === "gmail.search") {
      return handleGmailSearch(res, userId, params);
    }

    if (tool === "gmail.search.count") {
      return handleGmailSearchCount(res, userId, params);
    }

    return sendError(res, tool, "Tool no soportada.");
  } catch (error) {
    console.error("api router error", error);
    return sendError(res, tool, "Error interno.");
  }
}
