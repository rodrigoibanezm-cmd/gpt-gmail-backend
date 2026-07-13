import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  return url ? neon(url) : null;
}

function normalized(row, evidence = []) {
  return { ...row, id: String(row.id), payload: row.payload || {},
    agent_context: row.agent_context || {}, evidence };
}

export async function listPressureCards(userId, params = {}) {
  const sql = db();
  if (!sql) return { ok: false, message: "Falta DATABASE_URL" };
  const tenantId = params.tenantId || userId;
  const limit = Math.max(1, Math.min(Number(params.limit) || 30, 50));
  const rows = await sql`
    select id, card_key, dimension, bucket, title, subtitle, summary,
      why_it_matters, what_to_do, severity, status, source, confidence,
      payload, agent_context, agent_prompt
    from pressure_cards where tenant_id = ${tenantId} and status = 'active'
    order by case severity when 'critical' then 1 when 'high' then 2
      when 'medium' then 3 else 4 end, id desc limit ${limit}`;
  return { ok: true, tenantId, cards: rows.map((row) => normalized(row)) };
}

export async function getPressureCard(userId, params = {}) {
  const sql = db();
  if (!sql) return { ok: false, message: "Falta DATABASE_URL" };
  const tenantId = params.tenantId || userId;
  const rows = await sql`
    select id, card_key, dimension, bucket, title, subtitle, summary,
      why_it_matters, what_to_do, severity, status, source, confidence,
      payload, agent_context, agent_prompt
    from pressure_cards where tenant_id = ${tenantId} and id = ${params.cardId} limit 1`;
  if (!rows.length) return { ok: false, message: "Card no encontrada" };
  const evidence = await sql`
    select source_type, source_id, thread_id, message_id, title, excerpt, metadata
    from pressure_card_evidence where card_id = ${rows[0].id} order by id desc limit 20`;
  return { ok: true, tenantId, card: normalized(rows[0], evidence) };
}
