/**
 * Discovery Tools — list-agents, agent-status, ping
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentRegistry } from '../registry.js';

export function registerDiscoveryTools(
  server: McpServer,
  registry: AgentRegistry,
): void {
  // ── list-agents ──────────────────────────────────────────────
  server.tool(
    'list-agents',
    'List all registered AI agents and their connection status.',
    {},
    async () => {
      const agents = registry.list();
      const results = await Promise.all(
        agents.map(async (a) => {
          try {
            const status = await a.getStatus();
            return status;
          } catch {
            return {
              type: a.type,
              name: a.name,
              state: 'error' as const,
              error: 'Failed to get status',
            };
          }
        }),
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );

  // ── agent-status ─────────────────────────────────────────────
  server.tool(
    'agent-status',
    'Get detailed connection status and health information for a specific agent.',
    {
      agent: z.string().describe('Agent name or type (e.g. "antigravity", "claude", "codex")'),
    },
    async ({ agent }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Agent "${agent}" not found. Use list-agents to see available agents.`,
            },
          ],
          isError: true,
        };
      }

      const status = await connector.getStatus();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // ── ping ─────────────────────────────────────────────────────
  server.tool(
    'ping',
    'Test connectivity to a specific agent.',
    {
      agent: z.string().describe('Agent name or type'),
    },
    async ({ agent }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Agent "${agent}" not found.`,
            },
          ],
          isError: true,
        };
      }

      const alive = await connector.ping();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              agent: connector.name,
              type: connector.type,
              alive,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    },
  );
}
