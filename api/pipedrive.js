import { pipedriveRequest } from "/../lib/pipedriveClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const { action, dealId, stageId, activityData, noteText } = req.body || {};

  try {
    switch (action) {
      /* ------------------------------------------- */
      /* 1) LISTAR DEALS                             */
      /* ------------------------------------------- */
      case "listDeals": {
        const r = await pipedriveRequest("GET", "/deals", {
          query: { status: "open" },
        });
        return res.status(200).json(r);
      }

      /* ------------------------------------------- */
      /* 2) MOVER DEAL DE ETAPA                      */
      /* ------------------------------------------- */
      case "moveDealStage": {
        if (!dealId || !stageId) {
          return res
            .status(400)
            .json({ status: "error", message: "dealId y stageId requeridos" });
        }
        const r = await pipedriveRequest("PUT", `/deals/${dealId}`, {
          body: { stage_id: stageId },
        });
        return res.status(200).json(r);
      }

      /* ------------------------------------------- */
      /* 3) CREAR ACTIVIDAD                          */
      /* ------------------------------------------- */
      case "createActivity": {
        if (!activityData) {
          return res.status(400).json({
            status: "error",
            message: "activityData requerido",
          });
        }
        const r = await pipedriveRequest("POST", "/activities", {
          body: activityData,
        });
        return res.status(200).json(r);
      }

      /* ------------------------------------------- */
      /* 4) MARCAR ACTIVIDAD COMO HECHA              */
      /* ------------------------------------------- */
      case "markActivityDone": {
        if (!activityData?.activityId) {
          return res.status(400).json({
            status: "error",
            message: "activityId requerido",
          });
        }
        const r = await pipedriveRequest(
          "PUT",
          `/activities/${activityData.activityId}`,
          { query: { done: 1 } }
        );
        return res.status(200).json(r);
      }

      /* ------------------------------------------- */
      /* 5) CREAR NOTA                               */
      /* ------------------------------------------- */
      case "addNote": {
        if (!dealId || !noteText) {
          return res.status(400).json({
            status: "error",
            message: "dealId y noteText requeridos",
          });
        }
        const r = await pipedriveRequest("POST", "/notes", {
          body: {
            deal_id: dealId,
            content: noteText,
          },
        });
        return res.status(200).json(r);
      }

      /* ------------------------------------------- */
      /* ACCIÓN NO RECONOCIDA                        */
      /* ------------------------------------------- */
      default:
        return res.status(400).json({
          status: "error",
          message: `Acción desconocida: ${action}`,
        });
    }
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Error interno en pipedrive.js",
    });
  }
}

