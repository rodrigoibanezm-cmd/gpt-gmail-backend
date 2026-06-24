import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

function cleanText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanJson(value) {
  return value && typeof value === "object" ? value : {};
}

function cardKey(card) {
  return cleanText(card.card_key) || cleanText(card.key) || null;
}

function validateCard(card, tenantId) {
  if (!tenantId) return "Falta tenant_id";
  if (!card || typeof card !== "object") return "Card invalida";
  if (!cleanText(card.dimension)) return "Falta dimension";
  if (!cleanText(card.bucket)) return "Falta bucket";
  if (!cleanText(card.title)) return "Falta title";
  return null;
}

async function upsertCard(sql, tenantId, userId, card) {
  const rows = await sql`
    insert into pressure_cards (
      tenant_id, user_id, card_key, dimension, bucket, title, subtitle,
      summary, why_it_matters, what_to_do, severity, status, payload,
      agent_context, agent_prompt, source, confidence
    ) values (
      ${tenantId}, ${userId}, ${cardKey(card)}, ${cleanText(card.dimension)},
      ${cleanText(card.bucket)}, ${cleanText(card.title)}, ${cleanText(card.subtitle)},
      ${cleanText(card.summary)}, ${cleanText(card.why_it_matters)},
      ${cleanText(card.what_to_do)}, ${cleanText(card.severity) || "medium"},
      ${cleanText(card.status) || "active"}, ${JSON.stringify(cleanJson(card.payload))}::jsonb,
      ${JSON.stringify(cleanJson(card.agent_context))}::jsonb,
      ${cleanText(card.agent_prompt)}, ${cleanText(card.source) || "agent"},
      ${card.confidence ?? null}
    )
    on conflict (tenant_id, card_key) where card_key is not null
    do update set
      user_id = excluded.user_id,
      dimension = excluded.dimension,
      bucket = excluded.bucket,
      title = excluded.title,
      subtitle = excluded.subtitle,
      summary = excluded.summary,
      why_it_matters = excluded.why_it_matters,
      what_to_do = excluded.what_to_do,
      severity = excluded.severity,
      status = excluded.status,
      payload = excluded.payload,
      agent_context = excluded.agent_context,
      agent_prompt = excluded.agent_prompt,
      source = excluded.source,
      confidence = excluded.confidence
    returning id
  `;

  return rows[0].id;
}

async function insertEvidence(sql, cardId, evidence = []) {
  let inserted = 0;

  for (const item of evidence) {
    if (!item || typeof item !== "object") continue;

    await sql`
      insert into pressure_card_evidence (
        card_id, source_type, source_id, thread_id, message_id,
        title, excerpt, metadata
      ) values (
        ${cardId}, ${cleanText(item.source_type) || "gmail_thread"},
        ${cleanText(item.source_id)}, ${cleanText(item.thread_id)},
        ${cleanText(item.message_id)}, ${cleanText(item.title)},
        ${cleanText(item.excerpt)}, ${JSON.stringify(cleanJson(item.metadata))}::jsonb
      )
      on conflict (card_id, source_type, source_id) where source_id is not null
      do nothing
    `;

    inserted += 1;
  }

  return inserted;
}

export async function upsertPressureCards(userId, params = {}) {
  const sql = getSql();
  if (!sql) return { ok: false, message: "Falta DATABASE_URL" };

  const tenantId = cleanText(params.tenant_id) || cleanText(params.tenantId);
  const cards = Array.isArray(params.cards) ? params.cards : [];
  if (!cards.length) return { ok: false, message: "Faltan cards" };

  const saved = [];
  for (const card of cards) {
    const err = validateCard(card, tenantId);
    if (err) return { ok: false, message: err };

    const cardId = await upsertCard(sql, tenantId, cleanText(params.user_id) || userId, card);
    const evidence = card.evidence || card.evidences || [];
    const evidence_count = await insertEvidence(sql, cardId, evidence);
    saved.push({ card_id: cardId, card_key: cardKey(card), evidence_count });
  }

  return { ok: true, count: saved.length, cards: saved };
}
