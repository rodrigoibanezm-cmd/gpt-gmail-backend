const { pipedriveRequest } = require("../lib/pipedriveClient");

async function getStageMap() {
  try {
    const r = await pipedriveRequest("GET", "/stages", {});
    const stages = r.data || [];
    const stageMap = {};
    for (const s of stages) {
      stageMap[s.id] = {
        name: s.name,
        pipeline_name: s.pipeline_name || "(Sin nombre)"
      };
    }
    return stageMap;
  } catch (err) {
    console.error("Error obteniendo stages:", err.message);
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const {
    action,
    dealId,
    stageId,
    activityData,
    noteText,
    limit,
    status,
    term,
    dealData,
    pipeline_id
  } = req.body || {};
  let fields = req.body?.fields || ["id", "title"];

  try {
    switch (action) {
      case "listDeals": {
        const limitVal = limit || 50;
        const statusVal = status || "open";

        const query = { status: statusVal, limit: limitVal };
        if (pipeline_id) query.pipeline_id = pipeline_id;
        if (Array.isArray(fields) && fields.includes("stage_name") && !fields.includes("stage_id")) {
          fields.push("stage_id");
        }

        const r = await pipedriveRequest("GET", "/deals", { query });
        const stageMap = fields.includes("stage_id") ? await getStageMap() : {};

        const slimDeals = (r.data || []).map((deal) => {
          const clean = {};
          for (const k of fields) clean[k] = deal[k] ?? null;
          if ("stage_id" in clean) {
            clean["stage_name"] = stageMap[clean.stage_id]?.name || "—";
            clean["pipeline_name"] = stageMap[clean.stage_id]?.pipeline_name || null;
          }
          return clean;
        });

        return res.status(200).json({ status: "success", data: slimDeals });
      }

      case "listPipelines": {
        const r = await pipedriveRequest("GET", "/pipelines", {});
        const pipelines = r.data?.map((p) => ({ id: p.id, name: p.name, active: p.active })) || [];
        return res.status(200).json({ status: "success", data: pipelines });
      }

      default:
        return res.status(400).json({ status: "error", message: `Accion desconocida: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message || "Error interno pipedrive.js" });
  }
};
