const { pipedriveRequest } = require("../lib/pipedriveClient");

async function getStageMap() {
  try {
    const r = await pipedriveRequest("GET", "/stages", {});
    const stages = r.data || [];
    const stageMap = {};
    for (const s of stages) {
      stageMap[s.id] = s.name;
    }
    return stageMap;
  } catch (err) {
    console.error("Error obteniendo stages:", err.message);
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ status: "error", message: "Method not allowed" });
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
  } = req.body || {};
  let fields = req.body?.fields || ["id", "title"];

  try {
    switch (action) {
      case "listDeals": {
        const limitVal = limit || 50;
        const statusVal = status || "open";

        if (fields.includes("stage_name") && !fields.includes("stage_id")) {
          fields.push("stage_id");
        }

        const r = await pipedriveRequest("GET", "/deals", {
          query: { status: statusVal, limit: limitVal },
        });

        const stageMap = fields.includes("stage_id") ? await getStageMap() : {};

        const slimDeals = (r.data || []).map((deal) => {
          const clean = {};
          for (const k of fields) {
            clean[k] = deal[k] ?? null;
          }
          if ("stage_id" in clean) {
            clean["stage_name"] = stageMap[clean.stage_id] || "—";
          }
          return clean;
        });

        return res.status(200).json({ status: "success", data: slimDeals });
      }

      case "createDeal": {
        if (!dealData?.title) {
          return res
            .status(400)
            .json({ status: "error", message: "title requerido" });
        }

        const r = await pipedriveRequest("POST", "/deals", { body: dealData });
        return res.status(200).json({ status: "success", data: r?.data });
      }

      case "updateDeal": {
        if (!dealId || !dealData) {
          return res.status(400).json({
            status: "error",
            message: "dealId y dealData requeridos",
          });
        }

        const r = await pipedriveRequest("PUT", `/deals/${dealId}`, {
          body: dealData,
        });
        return res.status(200).json({ status: "success", data: r?.data });
      }

      case "getDealActivities": {
        if (!dealId) {
          return res
            .status(400)
            .json({ status: "error", message: "dealId requerido" });
        }

        const r = await pipedriveRequest("GET", "/activities", {
          query: {
            deal_id: dealId,
            start: 0,
            limit: 100,
            include_done: 1,
          },
        });

        const items = r?.data || [];
        const activities = items.map((a) => ({
          id: a.id,
          subject: a.subject,
          type: a.type,
          done: a.done,
          due_date: a.due_date,
          due_time: a.due_time,
          user_id: a.user_id?.id || null,
          user_name: a.user_id?.name || null,
        }));

        return res.status(200).json({ status: "success", data: activities });
      }

      case "searchDeals": {
        if (!term) {
          return res
            .status(400)
            .json({ status: "error", message: "term requerido" });
        }

        const r = await pipedriveRequest("GET", "/deals/search", {
          query: { term, fields: "title", exact_match: false, limit: 10 },
        });

        const items = r?.data?.items || [];
        const results = items.map((i) => ({
          id: i.item.id,
          title: i.item.title,
        }));

        return res
          .status(200)
          .json({ status: "success", message: "OK", data: results });
      }

      case "moveDealStage": {
        if (!dealId || !stageId) {
          return res.status(400).json({
            status: "error",
            message: "dealId y stageId requeridos",
          });
        }

        const r = await pipedriveRequest("PUT", `/deals/${dealId}`, {
          body: { stage_id: stageId },
        });

        return res.status(200).json(r);
      }

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
          body: { deal_id: dealId, content: noteText },
        });

        return res.status(200).json(r);
      }

      case "analyzePipeline": {
        const counts = {};

        for (const st of ["open", "won", "lost"]) {
          const r = await pipedriveRequest("GET", "/deals", {
            query: { status: st, limit: 1 },
          });

          counts[st] = r?.additional_data?.pagination?.more_items_in_collection
            ? r.additional_data.pagination.total_items
            : r.data?.length || 0;
        }

        return res.status(200).json({
          status: "success",
          message: "OK",
          data: {
            total_abiertos: counts.open,
            total_ganados: counts.won,
            total_perdidos: counts.lost,
          },
        });
      }

      default:
        return res.status(400).json({
          status: "error",
          message: `Accion desconocida: ${action}`,
        });
    }
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Error interno pipedrive.js",
    });
  }
};

