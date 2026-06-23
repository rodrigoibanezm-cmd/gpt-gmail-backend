import { searchGmail } from "../lib/gmailSearch.js";
import { countGmailSearch } from "../lib/gmailCount.js";
import { searchGmailAll } from "../lib/gmailSearchAll.js";

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

    return sendError(res, tool, "Tool no soportada.");
  } catch (error) {
    console.error("api router error", error);
    return sendError(res, tool, "Error interno.");
  }
}
