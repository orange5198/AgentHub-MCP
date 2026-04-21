#!/usr/bin/env node
/**
 * AgentHub MCP — Unified Multi-Agent Control Hub
 *
 * A centralized MCP server that allows you to monitor and control
 * multiple AI coding agents (Antigravity, Claude Code, Codex)
 * from any MCP-compatible client.
 *
 * @see https://github.com/your-username/agenthub-mcp
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { AgentRegistry } from './registry.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerMonitorTools } from './tools/monitor.js';
import { registerActionTools } from './tools/action.js';
import { registerManagementTools } from './tools/management.js';

async function main(): Promise<void> {
  // ── 1. Create MCP Server ─────────────────────────────────────
  const server = new McpServer({
    name: 'agenthub-mcp',
    version: '0.1.0',
  });

  // ── 2. Initialize Agent Registry ─────────────────────────────
  const registry = new AgentRegistry();
  await registry.load();

  const agentCount = registry.list().length;
  console.error(
    `[AgentHub] Loaded ${agentCount} agent(s): ${registry
      .list()
      .map((a) => `${a.name}(${a.type})`)
      .join(', ')}`,
  );

  // ── 3. Register MCP Tools ────────────────────────────────────
  registerDiscoveryTools(server, registry);
  registerMonitorTools(server, registry);
  registerActionTools(server, registry);
  registerManagementTools(server, registry);

  console.error('[AgentHub] 10 MCP tools registered.');

  // ── 4. Connect via stdio ─────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[AgentHub] Server running on stdio. Ready for connections.');
}

main().catch((err) => {
  console.error('[AgentHub] Fatal error:', err);
  process.exit(1);
});
