/**
 * Action Tools — ask-agent, approve, stop-agent
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentRegistry } from '../registry.js';

export function registerActionTools(
  server: McpServer,
  registry: AgentRegistry,
): void {
  // ── ask-agent ────────────────────────────────────────────────
  server.tool(
    'ask-agent',
    'Send a task prompt to a specific AI agent and get the response.',
    {
      agent: z.string().describe('Agent name or type'),
      prompt: z.string().describe('The task prompt to send'),
      mode: z
        .enum(['fast', 'plan'])
        .optional()
        .describe('Execution mode: "fast" for quick execution, "plan" for planning first'),
      workdir: z
        .string()
        .optional()
        .describe('Working directory for the agent'),
      timeout: z
        .number()
        .optional()
        .describe('Timeout in milliseconds (default: 120000)'),
    },
    async ({ agent, prompt, mode, workdir, timeout }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            { type: 'text' as const, text: `Agent "${agent}" not found.` },
          ],
          isError: true,
        };
      }

      const response = await connector.sendPrompt(prompt, {
        mode,
        workdir,
        timeout,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                agent: connector.name,
                type: connector.type,
                success: response.success,
                output: response.output,
                error: response.error,
                sessionId: response.sessionId,
              },
              null,
              2,
            ),
          },
        ],
        isError: !response.success,
      };
    },
  );

  // ── approve ──────────────────────────────────────────────────
  server.tool(
    'approve',
    'Approve/confirm a pending action or plan for a specific agent. Use for remote confirmation flows.',
    {
      agent: z.string().describe('Agent name or type'),
      conversation_id: z
        .string()
        .optional()
        .describe('Conversation ID to approve (required for Antigravity, optional for others)'),
      message: z
        .string()
        .optional()
        .describe('Optional message to include with the approval'),
    },
    async ({ agent, conversation_id, message }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            { type: 'text' as const, text: `Agent "${agent}" not found.` },
          ],
          isError: true,
        };
      }

      try {
        await connector.approve(
          conversation_id ?? 'latest',
          message,
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Approval sent to ${connector.name} (${connector.type}).`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Failed to approve: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── stop-agent ───────────────────────────────────────────────
  server.tool(
    'stop-agent',
    'Stop the current execution of a specific agent.',
    {
      agent: z.string().describe('Agent name or type'),
    },
    async ({ agent }) => {
      const connector = registry.resolve(agent);
      if (!connector) {
        return {
          content: [
            { type: 'text' as const, text: `Agent "${agent}" not found.` },
          ],
          isError: true,
        };
      }

      await connector.stop();
      return {
        content: [
          {
            type: 'text' as const,
            text: `🛑 Stop signal sent to ${connector.name} (${connector.type}).`,
          },
        ],
      };
    },
  );
}
