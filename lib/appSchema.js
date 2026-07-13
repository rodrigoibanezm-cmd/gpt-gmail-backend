import { z } from "zod";
import { APP_ACTIONS } from "./appRouter.js";

const evidenceSchema = z.object({
  source_type: z.enum(["gmail_thread", "gmail_message", "review", "metric", "manual"]),
  source_id: z.string().optional(),
  thread_id: z.string().optional(),
  message_id: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
}).strict();

const cardSchema = z.object({
  card_key: z.string(),
  dimension: z.enum(["sos", "atascados", "abiertos", "decidir", "vigilar",
    "operacion", "ejecutiva", "comercial", "financiera", "otra"]),
  bucket: z.enum(["sos", "atascados", "abiertos", "decidir", "vigilar",
    "urgente", "importante", "tarea"]),
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  why_it_matters: z.string().optional(),
  what_to_do: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "dismissed", "resolved"]).optional(),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  payload: z.record(z.unknown()).optional(),
  agent_context: z.record(z.unknown()).optional(),
  agent_prompt: z.string().optional(),
  evidence: z.array(evidenceSchema).optional()
}).strict();

const nullableString = z.string().nullable().optional();

export const appRouterInput = {
  action: z.enum(APP_ACTIONS),
  tool: z.string().optional(),
  userId: z.string().min(1),
  user_id: z.string().optional(),
  tenant_id: z.string().optional(),
  tenantId: z.string().optional(),
  query: z.string().optional(),
  days: z.number().int().min(1).max(180).optional(),
  includeInbox: z.boolean().optional(),
  includeSent: z.boolean().optional(),
  maxThreads: z.number().int().min(1).max(100).optional(),
  maxMessages: z.number().int().min(1).max(100).optional(),
  maxLatestMessages: z.number().int().min(1).max(10).optional(),
  maxPayloadChars: z.number().int().min(1000).max(160000).optional(),
  maxBodyChars: z.number().int().min(1000).max(50000).optional(),
  cursor: nullableString,
  pageToken: nullableString,
  nextCursor: nullableString,
  mode: z.string().optional(),
  summaryLevel: z.enum(["minimal", "compact", "full"]).optional(),
  threadId: z.string().optional(),
  messageId: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  cards: z.array(cardSchema).optional()
};
