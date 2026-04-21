/**
 * AgentConnector — Abstract base class for all agent connectors.
 *
 * Each connector encapsulates the logic for communicating with a specific
 * AI coding agent (Antigravity, Claude Code, Codex).
 */
import type {
  AgentType,
  AgentStatus,
  AgentResponse,
  SendOptions,
  TaskStatus,
} from '../types.js';

export abstract class AgentConnector {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  // ── Connection lifecycle ────────────────────────────────────
  abstract ping(): Promise<boolean>;
  abstract getStatus(): Promise<AgentStatus>;

  // ── Task execution ─────────────────────────────────────────
  abstract sendPrompt(
    prompt: string,
    options?: SendOptions,
  ): Promise<AgentResponse>;
  abstract stop(): Promise<void>;

  // ── Monitoring (optional, override in subclass) ────────────
  async getTaskStatus(
    _conversationId?: string,
  ): Promise<TaskStatus | null> {
    return null;
  }

  async listConversations(
    _limit?: number,
  ): Promise<Array<{ id: string; summary?: string; updatedAt?: string }>> {
    return [];
  }

  async getPlan(_conversationId?: string): Promise<string | null> {
    return null;
  }

  async getWalkthrough(_conversationId?: string): Promise<string | null> {
    return null;
  }

  // ── Approval / confirmation ────────────────────────────────
  async approve(
    _conversationId: string,
    _message?: string,
  ): Promise<void> {
    throw new Error(`approve() not supported by ${this.type} connector`);
  }
}
