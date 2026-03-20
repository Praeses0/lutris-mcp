#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGameTools } from "./tools/games.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerServiceGameTools } from "./tools/service-games.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerLauncherTools } from "./tools/launcher.js";
import { registerConfigTools } from "./tools/config.js";
import { registerSystemTools } from "./tools/system.js";
import { registerBulkTools } from "./tools/bulk.js";
import { registerExportTools } from "./tools/export.js";
import { registerDuplicateTools } from "./tools/duplicates.js";

const server = new McpServer({
  name: "lutris",
  version: "2.0.0",
});

registerGameTools(server);
registerCategoryTools(server);
registerServiceGameTools(server);
registerStatsTools(server);
registerLauncherTools(server);
registerConfigTools(server);
registerSystemTools(server);
registerBulkTools(server);
registerExportTools(server);
registerDuplicateTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
