/**
 * Monitor Tools — get-task-status, get-plan, get-overview
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentRegistry } from '../registry.js';

export function registerMonitorTools(
  server: McpServer,
  registry: AgentRegistry,
): void {
  // ── get-task-status ──────────────────────────────────────────
  server.tool(
    'get-task-status',
    'Get current task progress for a specific agent. Parses task.md to show TODO/in-progress/done items.',
    {
      agent: z.string().describe('Agent name or type'),
      conversation_id: z
        .string()
        .optional()
        .describe('Specific conversation ID; if omitted, uses the latest'),
    },
    async ({ agent, conversation_id }) => {
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

      const status = await connector.getTaskStatus(conversation_id);
      if (!status) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No task.md found for agent "${agent}".`,
            },
          ],
        };
      }

      // Format a friendly summary
      const progressBar = buildProgressBar(status.stats);
      const summary = [
        `📋 **${status.title}**`,
        `Conversation: \`${status.conversationId}\``,
        '',
        `${progressBar}`,
        `✅ Done: ${status.stats.done} | 🔄 In Progress: ${status.stats.inProgress} | ⬜ Todo: ${status.stats.todo} | Total: ${status.stats.total}`,
        '',
        '### Items:',
        ...status.items.map((item) => {
          const icon =
            item.status === 'done'
              ? '✅'
              : item.status === 'in_progress'
                ? '🔄'
                : '⬜';
          const line = `${icon} ${item.text}`;
          const children = (item.children ?? []).map((c) => {
            const cIcon =
              c.status === 'done'
                ? '  ✅'
                : c.status === 'in_progress'
                  ? '  🔄'
                  : '  ⬜';
            return `${cIcon} ${c.text}`;
          });
          return [line, ...children].join('\n');
        }),
      ].join('\n');

      return {
        content: [
          { type: 'text' as const, text: summary },
        ],
      };
    },
  );

  // ── get-plan ─────────────────────────────────────────────────
  server.tool(
    'get-plan',
    'Get the implementation plan (implementation_plan.md) for a specific agent.',
    {
      agent: z.string().describe('Agent name or type'),
      conversation_id: z.string().optional().describe('Specific conversation ID'),
    },
    async ({ agent, conversation_id }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            { type: 'text' as const, text: `Agent "${agent}" not found.` },
          ],
          isError: true,
        };
      }

      const plan = await connector.getPlan(conversation_id);
      if (!plan) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No implementation plan found for agent "${agent}".`,
            },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: plan },
        ],
      };
    },
  );

  // ── get-overview ─────────────────────────────────────────────
  server.tool(
    'get-overview',
    'Global dashboard: status summary of ALL registered agents.',
    {},
    async () => {
      const agents = registry.list();
      const entries = await Promise.all(
        agents.map(async (a) => {
          try {
            const status = await a.getStatus();
            const conversations = await a.listConversations(3);
            return {
              agent: a.name,
              type: a.type,
              state: status.state,
              version: status.version,
              recentConversations: conversations.length,
              lastActivity: conversations[0]?.updatedAt,
            };
          } catch {
            return {
              agent: a.name,
              type: a.type,
              state: 'error' as const,
            };
          }
        }),
      );

      const header = '🏠 **AgentHub Overview**\n';
      const lines = entries.map((e) => {
        const stateIcon =
          e.state === 'connected'
            ? '🟢'
            : e.state === 'disconnected'
              ? '🔴'
              : '🟡';
        return `${stateIcon} **${e.agent}** (${e.type}) — ${e.state}${e.version ? ` v${e.version}` : ''}`;
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: [header, ...lines].join('\n'),
          },
        ],
      };
    },
  );
}

// ── Helpers ──────────────────────────────────────────────────

function buildProgressBar(stats: {
  total: number;
  done: number;
  inProgress: number;
}): string {
  if (stats.total === 0) return '[  no tasks  ]';
  const width = 20;
  const donePct = Math.round((stats.done / stats.total) * width);
  const ipPct = Math.round((stats.inProgress / stats.total) * width);
  const todoPct = width - donePct - ipPct;

  return (
    '[' +
    '█'.repeat(donePct) +
    '▓'.repeat(ipPct) +
    '░'.repeat(Math.max(0, todoPct)) +
    `] ${Math.round((stats.done / stats.total) * 100)}%`
  );
}
