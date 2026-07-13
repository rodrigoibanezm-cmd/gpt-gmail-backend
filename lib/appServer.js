import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { APP_URI, appHtml } from "./appUi.js";
import { listPressureCards, getPressureCard } from "./pressureCardsRead.js";
import { discoveryBatch } from "./gmailDiscoveryBatch.js";
import { getGmailThread } from "./gmailThread.js";
import { getGmailMessage } from "./gmailMessage.js";

const identity = { userId: z.string().min(1), tenantId: z.string().optional() };
const questions = ["Dame 5 red flags.", "¿Qué se ve bien, pero va a explotar en un mes?",
  "¿Qué se ve bien, pero está bajando el rendimiento?",
  "Si tuviera que hacer una sola cosa mañana, ¿qué haría?"];
const content = (value) => [{ type: "text", text: JSON.stringify(value) }];

function registerViews(server) {
  registerAppResource(server, "nexusg-mail", APP_URI, {
    mimeType: RESOURCE_MIME_TYPE,
    _meta: { ui: {
      domain: "https://gpt-gmail-backend.vercel.app",
      csp: { connectDomains: [], resourceDomains: [] },
      prefersBorder: false
    } }
  },
    async () => ({ contents: [{ uri: APP_URI, mimeType: RESOURCE_MIME_TYPE, text: appHtml }] }));
  registerAppTool(server, "pressureboard_get", {
    title: "Abrir PressureBoard Mail",
    description: "Muestra las pocas presiones activas que merecen atención ejecutiva.",
    inputSchema: { ...identity, limit: z.number().int().min(1).max(50).optional() },
    _meta: { ui: { resourceUri: APP_URI } }
  }, async (args) => {
    const result = await listPressureCards(args.userId, args);
    if (!result.ok) return { content: content(result) };
    const output = { view: "pressureboard", userId: args.userId, ...result };
    return { content: content(output), structuredContent: output };
  });
  registerAppTool(server, "workspace_open", {
    title: "Abrir Workspace Mail",
    description: "Abre investigación libre o el contexto persistente de una tarjeta.",
    inputSchema: { ...identity, cardId: z.string().optional() },
    _meta: { ui: { resourceUri: APP_URI } }
  }, async (args) => {
    const result = args.cardId ? await getPressureCard(args.userId, args)
      : { ok: true, tenantId: args.tenantId || args.userId, card: null };
    if (!result.ok) return { content: content(result) };
    const output = { view: "workspace", userId: args.userId, questions, ...result };
    return { content: content(output), structuredContent: output };
  });
}

function registerResearch(server) {
  server.registerTool("gmail_discovery_batch", { title: "Explorar Gmail por lotes",
    description: "Lee hilos compactos para investigar patrones y preguntas amplias.",
    inputSchema: { ...identity, query: z.string().optional(), days: z.number().int().min(1).max(180).optional(),
      maxThreads: z.number().int().min(1).max(100).optional(), cursor: z.string().optional(),
      summaryLevel: z.enum(["minimal", "compact", "full"]).optional() }
  }, async (args) => ({ content: content(await discoveryBatch(args.userId, args)) }));
  server.registerTool("gmail_thread_get", { title: "Leer hilo Gmail",
    description: "Obtiene un hilo completo para revisar evidencia detallada.",
    inputSchema: { userId: z.string(), threadId: z.string(), maxBodyChars: z.number().optional() }
  }, async (args) => ({ content: content(await getGmailThread(args.userId, args)) }));
  server.registerTool("gmail_message_get", { title: "Leer mensaje Gmail",
    description: "Obtiene un mensaje completo y sus adjuntos.",
    inputSchema: { userId: z.string(), messageId: z.string(), maxBodyChars: z.number().optional() }
  }, async (args) => ({ content: content(await getGmailMessage(args.userId, args)) }));
}

export function createNexusGServer() {
  const server = new McpServer({ name: "nexusg-mail", version: "0.1.0",
    instructions: "PressureBoard prioriza atención. Workspace investiga usando Gmail. Nunca inventes evidencia." });
  registerViews(server);
  registerResearch(server);
  return server;
}
