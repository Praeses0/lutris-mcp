#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGameTools } from "./tools/games.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerServiceGameTools } from "./tools/service-games.js";
import { registerStatsTools } from "./tools/stats.js";

const server = new McpServer({
  name: "lutris",
  version: "1.0.0",
});

registerGameTools(server);
registerCategoryTools(server);
registerServiceGameTools(server);
registerStatsTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
