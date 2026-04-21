/**
 * Management Tools — register-agent
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentRegistry } from '../registry.js';
import type { AgentType } from '../types.js';

export function registerManagementTools(
  server: McpServer,
  registry: AgentRegistry,
): void {
  // ── register-agent ───────────────────────────────────────────
  server.tool(
    'register-agent',
    'Register a new AI agent instance at runtime.',
    {
      type: z
        .enum(['antigravity', 'claude-code', 'codex'])
        .describe('Agent type'),
      name: z
        .string()
        .describe('Unique name for this agent instance'),
      config: z
        .string()
        .describe('JSON configuration string for the agent connector'),
    },
    async ({ type, name, config }) => {
      let parsedConfig: Record<string, unknown>;
      try {
        parsedConfig = JSON.parse(config) as Record<string, unknown>;
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Invalid JSON in config parameter.`,
            },
          ],
          isError: true,
        };
      }

      const connector = registry.register({
        type: type as AgentType,
        name,
        config: parsedConfig,
      });

      if (!connector) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Failed to create connector for type "${type}".`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Agent "${name}" (${type}) registered successfully.`,
          },
        ],
      };
    },
  );
}
