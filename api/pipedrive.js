const { pipedriveRequest } = require("../lib/pipedriveClient");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ status: "error", message: "Method not allowed" });
  }

  const { action, dealId, stageId, activityData, noteText } = req.body || {};

  try {
    switch (action) {
case "listDeals": {
  const limit =
    typeof req.body?.limit === "number" && req.body.limit > 0
      ? req.body.limit
      : 50;

  const status =
    typeof req.body?.status === "string" && req.body.status.length > 0
      ? req.body.status
      : "open";

  const r = await pipedriveRequest("GET", "/deals", {
    query: {
      status,
      limit
    },
  });

  return res.status(200).json(r);
}

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

      case "createActivity": {
        if (!activityData) {
          return res
            .status(400)
            .json({ status: "error", message: "activityData requerido" });
        }
        const r = await pipedriveRequest("POST", "/activities", {
          body: activityData,
        });
        return res.status(200).json(r);
      }

      case "markActivityDone": {
        if (!activityData || !activityData.activityId) {
          return res.status(400).json({
            status: "error",
            message: "activityId requerido",
          });
        }
        const r = await pipedriveRequest(
          "PUT",
          `/activities/${activityData.activityId}`,
          {
            query: { done: 1 },
            body: { done: 1 },
          }
        );
        return res.status(200).json(r);
      }

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

      default:
        return res.status(400).json({
          status: "error",
          message: `Accion desconocida:${action}`,
        });
    }
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Error interno en pipedrive.js",
    });
  }
};
