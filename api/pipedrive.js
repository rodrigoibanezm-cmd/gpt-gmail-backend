const { pipedriveRequest } = require("../lib/pipedriveClient");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const { action, dealId, stageId, activityData, noteText, dealData } = req.body || {};

  try {
    switch (action) {

      case "listDeals": {
        const limit = req.body?.limit || 50;
        const status = req.body?.status || "open";

        const r = await pipedriveRequest("GET", "/deals", {
          query: { status, limit }
        });

        return res.status(200).json(r);
      }

      case "searchDeals": {
        const term = req.body?.term;
        if (!term) return res.status(400).json({ status: "error", message: "term requerido" });

        const r = await pipedriveRequest("GET", "/deals/search", {
          query: { term, fields: "title", exact_match: false, limit: 10 }
        });

        const items = r?.data?.items || [];
        const results = items.map(i => ({ id: i.item.id, title: i.item.title }));

        return res.status(200).json({
          status: "success",
          message: "OK",
          data: results
        });
      }

      case "moveDealStage": {
        if (!dealId || !stageId) {
          return res.status(400).json({ status: "error", message: "dealId y stageId requeridos" });
        }

        const r = await pipedriveRequest("PUT", `/deals/${dealId}`, {
          body: { stage_id: stageId }
        });

        return res.status(200).json(r);
      }

      case "createActivity": {
        if (!activityData) {
          return res.status(400).json({ status: "error", message: "activityData requerido" });
        }

        const r = await pipedriveRequest("POST", "/activities", {
          body: activityData
        });

        return res.status(200).json(r);
      }

      case "markActivityDone": {
        if (!activityData?.activityId) {
          return res.status(400).json({ status: "error", message: "activityId requerido" });
        }

        const r = await pipedriveRequest("PUT", `/activities/${activityData.activityId}`, {
          query: { done: 1 },
          body: { done: 1 }
        });

        return res.status(200).json(r);
      }

      case "addNote": {
        if (!dealId || !noteText) {
          return res.status(400).json({ status: "error", message: "dealId y noteText requeridos" });
        }

        const r = await pipedriveRequest("POST", "/notes", {
          body: { deal_id: dealId, content: noteText }
        });

        return res.status(200).json(r);
      }

      case "createDeal": {
        if (!dealData || !dealData.title) {
          return res.status(400).json({ status: "error", message: "dealData.title requerido" });
        }

        const body = {
          title: dealData.title,
          value: dealData.value,
          currency: dealData.currency,
          user_id: dealData.user_id,
          person_id: dealData.person_id,
          org_id: dealData.org_id
        };

        const r = await pipedriveRequest("POST", "/deals", {
          body
        });

        return res.status(200).json(r);
      }

      case "analyzePipeline": {
        let allDeals = [];
        let start = 0;
        const pageSize = 200;

        for (let i = 0; i < 5; i++) {
          const r = await pipedriveRequest("GET", "/deals", {
            query: { status: "open", limit: pageSize, start }
          });

          if (!r?.data?.length) break;

          allDeals = allDeals.concat(r.data);
          if (r.data.length < pageSize) break;
          start += pageSize;
        }

        const grandes = allDeals.filter(d => (d.value || 0) >= 5000000);
        const hoy = new Date();
        const dias = f =>
          f ? Math.floor((hoy - new Date(f)) / (1000 * 60 * 60 * 24)) : null;

        const grandesEnRiesgo = grandes
          .map(d => ({
            id: d.id,
            titulo: d.title,
            valor: d.value,
            dias: dias(d.update_time)
          }))
          .filter(d => d.dias >= 10)
          .sort((a, b) => b.valor - a.valor);

        return res.status(200).json({
          status: "success",
          message: "OK",
          data: {
            total_abiertos: allDeals.length,
            total_grandes: grandes.length,
            grandes_en_riesgo: grandesEnRiesgo.length,
            monto_en_riesgo: grandesEnRiesgo.reduce((a, b) => a + (b.valor || 0), 0),
            oportunidades_criticas: grandesEnRiesgo.slice(0, 5)
          }
        });
      }

      default:
        return res.status(400).json({ status: "error", message: `Accion desconocida: ${action}` });
    }

  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message || "Error interno pipedrive.js" });
  }
};
