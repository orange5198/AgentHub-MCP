/**
 * AgentHub MCP — Unified type definitions
 */

// ─── Agent Types ─────────────────────────────────────────────
export type AgentType = 'antigravity' | 'claude-code' | 'codex';

export interface AgentConfig {
  type: AgentType;
  name: string;
  config: Record<string, unknown>;
}

export interface AntigravityConfig {
  brainDir: string;
  cdpPort?: number;
  cdpHost?: string;
  autoDetect?: boolean;
  executable?: string;
}

export interface ClaudeCodeConfig {
  executable?: string; // defaults to 'claude'
  defaultWorkdir?: string;
}

export interface CodexConfig {
  executable?: string; // defaults to 'codex'
  defaultWorkdir?: string;
  approvalMode?: 'suggest' | 'auto-edit' | 'full-auto';
}

// ─── Status ──────────────────────────────────────────────────
export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'launching'
  | 'error'
  | 'unknown';

export interface AgentStatus {
  type: AgentType;
  name: string;
  state: ConnectionState;
  version?: string;
  lastSeen?: string;
  error?: string;
}

// ─── Task Tracking ───────────────────────────────────────────
export interface TaskItem {
  text: string;
  status: 'todo' | 'in_progress' | 'done';
  children?: TaskItem[];
}

export interface TaskStatus {
  conversationId: string;
  title: string;
  summary?: string;
  updatedAt?: string;
  items: TaskItem[];
  stats: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
}

// ─── Action ──────────────────────────────────────────────────
export interface SendOptions {
  mode?: 'fast' | 'plan';
  model?: string;
  workdir?: string;
  timeout?: number;
}

export interface AgentResponse {
  success: boolean;
  output?: string;
  error?: string;
  sessionId?: string;
}

// ─── Inbox (file-based messaging for Antigravity) ────────────
export interface InboxMessage {
  id: string;
  type: 'approve' | 'reply' | 'instruction';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface InboxFile {
  messages: InboxMessage[];
}

// ─── Overview ────────────────────────────────────────────────
export interface AgentOverviewEntry {
  agent: string;
  type: AgentType;
  state: ConnectionState;
  activeConversations?: number;
  pendingApprovals?: number;
  lastActivity?: string;
}
