import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { APP_URI, appHtml } from "./appUi.js";
import { routeAppAction } from "./appRouter.js";
import { appRouterInput } from "./appSchema.js";

const content = (value) => [{ type: "text", text: JSON.stringify(value) }];

function registerViews(server) {
  registerAppResource(server, "nexusg-mail", APP_URI, {
    mimeType: RESOURCE_MIME_TYPE,
    _meta: { ui: {
      domain: "https://gpt-gmail-backend.vercel.app",
      csp: { connectDomains: [], resourceDomains: [] },
      prefersBorder: false
    } }
  }, async () => ({ contents: [{
    uri: APP_URI,
    mimeType: RESOURCE_MIME_TYPE,
    text: appHtml,
    _meta: {
      ui: {
        domain: "https://gpt-gmail-backend.vercel.app",
        csp: { connectDomains: [], resourceDomains: [] },
        prefersBorder: false
      },
      "openai/widgetDomain": "https://gpt-gmail-backend.vercel.app",
      "openai/widgetCSP": { connect_domains: [], resource_domains: [] },
      "openai/widgetPrefersBorder": false
    }
  }] }));
  registerAppTool(server, "nexusg_mail", {
    title: "NexusG Mail",
    description: "Enruta PressureBoard, Workspace y todas las operaciones Gmail disponibles.",
    inputSchema: appRouterInput,
    _meta: { ui: { resourceUri: APP_URI } }
  }, async (args) => {
    const result = await routeAppAction(args);
    if (!result.ok) return { content: content(result) };
    return { content: content(result.result || result), structuredContent: result };
  });
}

export function createNexusGServer() {
  const server = new McpServer({ name: "nexusg-mail", version: "0.1.0",
    instructions: "PressureBoard prioriza atención. Workspace investiga usando Gmail. Nunca inventes evidencia." });
  registerViews(server);
  return server;
}
