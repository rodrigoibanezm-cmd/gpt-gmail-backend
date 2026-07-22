import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createNexusGServer } from "../lib/appServer.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

async function closeQuietly(resource, label) {
  try {
    await resource?.close?.();
  } catch (error) {
    console.error(`NexusG MCP ${label} close error`, error);
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["POST", "GET", "DELETE"].includes(req.method)) return res.status(405).end();

  const server = createNexusGServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("NexusG MCP error", error);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  } finally {
    await closeQuietly(transport, "transport");
    await closeQuietly(server, "server");
  }
}
