// /api/search-email.js

import { searchGmail } from "../lib/gmailSearch.js";

function normalizeMaxResults(value) {
  const parsed = Number.parseInt(value || "10", 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 25));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(200).json({
      status: "error",
      message: "Método no permitido, usa GET",
      data: null
    });
  }

  const { userId, query, pageToken } = req.query || {};
  const maxResults = normalizeMaxResults(req.query?.maxResults);

  if (!userId || !query) {
    return res.status(200).json({
      status: "error",
      message: "Faltan parámetros requeridos: userId, query",
      data: null
    });
  }

  try {
    const result = await searchGmail(userId, { query, pageToken, maxResults });

    if (!result.ok) {
      return res.status(200).json({
        status: "error",
        message: result.message,
        data: null
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Búsqueda de correos realizada correctamente",
      data: result
    });
  } catch (error) {
    console.error("search-email handler error", error);
    return res.status(200).json({
      status: "error",
      message: "Error interno buscando correos",
      data: null
    });
  }
}
