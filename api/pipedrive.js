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
      // ------------------------------------------------
      // LISTAR DEALS (para usos controlados)
      // ------------------------------------------------
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
            limit,
          },
        });

        return res.status(200).json(r);
      }

      // ------------------------------------------------
      // BUSCAR DEALS POR TEXTO (para usar nombres, incluso parciales)
      // ------------------------------------------------
      case "searchDeals": {
        const term = req.body?.term;
        if (!term) {
          return res.status(400).json({
            status: "error",
            message: "term requerido",
          });
        }

        const r = await pipedriveRequest("GET", "/deals", {
          query: {
            term,
            limit: 10,
          },
        });

        if (r.status !== "success" || !Array.isArray(r.data)) {
          return res.status(200).json({
            status: "success",
            message: "Sin resultados",
            data: [],
          });
        }

        const results = r.data.map((d) => ({
          id: d.id,
          title: d.title,
        }));

        return res.status(200).json({
          status: "success",
          message: "OK",
          data: results,
        });
      }

      // ------------------------------------------------
      // MOVER DEAL DE ETAPA
      // ------------------------------------------------
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

      // ------------------------------------------------
      // CREAR ACTIVIDAD (llamada, visita, tarea)
      // ------------------------------------------------
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

      // ------------------------------------------------
      // MARCAR ACTIVIDAD COMO HECHA
      // ------------------------------------------------
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

      // ------------------------------------------------
      // CREAR NOTA EN UN DEAL
      // ------------------------------------------------
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

      // ------------------------------------------------
      // ANALISIS EJECUTIVO DEL PIPELINE
      // ------------------------------------------------
      case "analyzePipeline": {
        let allDeals = [];
        let start = 0;
        const pageSize = 200;
        const maxLoops = 5; // hasta ~1000 deals

        for (let i = 0; i < maxLoops; i++) {
          const r = await pipedriveRequest("GET", "/deals", {
            query: {
              status: "open",
              limit: pageSize,
              start,
            },
          });

          if (r.status !== "success" || !Array.isArray(r.data)) {
            break;
          }

          allDeals = allDeals.concat(r.data);

          if (r.data.length < pageSize) {
            break; // ultima pagina
          }

          start += pageSize;
        }

        const totalAbiertos = allDeals.length;
        const grandes = allDeals.filter((d) => (d.value || 0) >= 5000000);

        const hoy = new Date();
        const calcDias = (fecha) => {
          if (!fecha) return null;
          const f = new Date(fecha);
          return Math.floor((hoy - f) / (1000 * 60 * 60 * 24));
        };

        const grandesEnRiesgo = grandes
          .map((d) => {
            const dias = calcDias(d.update_time);
            return { id: d.id, titulo: d.title, valor: d.value, dias };
          })
          .filter((d) => d.dias !== null && d.dias >= 10)
          .sort((a, b) => b.valor - a.valor);

        const montoEnRiesgo = grandesEnRiesgo.reduce(
          (acc, d) => acc + (d.valor || 0),
          0
        );

        const redflags = [];
        if (grandesEnRiesgo.length > 0)
          redflags.push("Oportunidades grandes sin actividad reciente");
        if (totalAbiertos > 100)
          redflags.push("Pipeline muy grande sin segmentacion");
        if (grandes.length > 0 && grandesEnRiesgo.length / grandes.length >= 0.5)
          redflags.push(
            "Mas del 50% de las oportunidades grandes estan en riesgo"
          );

        const topRedflags = redflags.slice(0, 3);

        return res.status(200).json({
          status: "success",
          message: "OK",
          data: {
            total_abiertos: totalAbiertos,
            total_grandes: grandes.length,
            grandes_en_riesgo: grandesEnRiesgo.length,
            monto_en_riesgo: montoEnRiesgo,
            oportunidades_criticas: grandesEnRiesgo.slice(0, 5),
            top_redflags: topRedflags,
          },
        });
      }

      // ------------------------------------------------
      // ACCION DESCONOCIDA
      // ------------------------------------------------
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
