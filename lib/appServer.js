import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { APP_URI, appHtml } from "./appUi.js";
import { routeAppAction } from "./appRouter.js";
import { appRouterInput } from "./appSchema.js";

const content = (value) => [{ type: "text", text: JSON.stringify(value) }];