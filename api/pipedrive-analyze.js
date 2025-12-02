const { pipedriveRequest } = require("../lib/pipedriveClient");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    // ---------------------------------------------
    // 1) Traer TODOS los deals abiertos con paginacion
    // ---------------------------------------------
    let allDeals = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
      const r = await pipedriveRequest("GET", "/deals", {
        query: {
          status: "open",
          limit: pageSize,
          start
        }
      });

      if (r.status !== "success" || !Array.isArray(r.data)) break;

      allDeals = allDeals.concat(r.data);

      if (r.data.length < pageSize) break;  // ultima pagina
      start += pageSize;
    }

    // ---------------------------------------------
    // 2) Procesamiento ejecutivo
    // ---------------------------------------------

    const totalAbiertos = allDeals.length;

    // deals grandes → arbitrario: value >= 5M CLP
    const grandes = allDeals.filter(d => (d.value || 0) >= 5000000);

    // dias sin actividad → usa update_time
    const hoy = new Date();
    const calcDias = (fecha) => {
      if (!fecha) return null;
      const f = new Date(fecha);
      return Math.floor((hoy - f) / (1000 * 60 * 60 * 24));
    };

    const grandesEnRiesgo = grandes
      .map(d => {
        const dias = calcDias(d.update_time);
        return { id: d.id, titulo: d.title, valor: d.value, dias };
      })
      .filter(d => d.dias !== null && d.dias >= 10) // riesgo = sin movimiento >= 10 dias
      .sort((a, b) => b.valor - a.valor);

    // monto en riesgo
    const montoEnRiesgo = grandesEnRiesgo.reduce((acc, d) => acc + (d.valor || 0), 0);

    // top redflags (3 simples y claras)
    const redflags = [];
    if (grandesEnRiesgo.length > 0) redflags.push("Oportunidades grandes sin actividad reciente");
    if (totalAbiertos > 100) redflags.push("Pipeline muy grande sin segmentacion");
    if (grandes.length > 0 && grandesEnRiesgo.length / grandes.length >= 0.5)
      redflags.push("Mas del 50% de las oportunidades grandes estan en riesgo");

    // limitar a 3
    const topRedflags = redflags.slice(0, 3);

    // ---------------------------------------------
    // 3) Enviar resumen ejecutivo (respuesta liviana)
    // ---------------------------------------------
    return res.status(200).json({
      status: "success",
      message: "OK",
      data: {
        total_abiertos: totalAbiertos,
        total_grandes: grandes.length,
        grandes_en_riesgo: grandesEnRiesgo.length,
        monto_en_riesgo: montoEnRiesgo,
        oportunidades_criticas: grandesEnRiesgo.slice(0, 5), // top 5
        top_redflags: topRedflags
      }
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Error interno en pipedrive-analyze"
    });
  }
};
