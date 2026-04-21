/**
 * AntigravityConnector — Connects to Google Antigravity via:
 *   1. Brain directory scanning (read-only monitoring)
 *   2. CDP WebSocket injection (write operations)
 *   3. Inbox file-based messaging (approval flows)
 */
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import WebSocket from 'ws';

import { AgentConnector } from './base.js';
import type {
  AgentStatus,
  AgentResponse,
  AntigravityConfig,
  SendOptions,
  TaskStatus,
  TaskItem,
} from '../types.js';

export class AntigravityConnector extends AgentConnector {
  readonly type = 'antigravity' as const;
  readonly name: string;

  private brainDir: string;
  private cdpPort: number;
  private cdpHost: string;
  private ws: WebSocket | null = null;
  private cdpMsgId = 0;

  constructor(name: string, raw: Record<string, unknown>) {
    super();
    this.name = name;
    const cfg = raw as unknown as AntigravityConfig;
    this.brainDir = cfg.brainDir ?? '';
    this.cdpPort = cfg.cdpPort ?? 9222;
    this.cdpHost = cfg.cdpHost ?? 'localhost';
  }

  // ── Ping ─────────────────────────────────────────────────────
  async ping(): Promise<boolean> {
    // Check if brain dir exists
    if (this.brainDir && existsSync(this.brainDir)) {
      return true;
    }
    // Check CDP endpoint
    try {
      const res = await fetch(
        `http://${this.cdpHost}:${this.cdpPort}/json/version`,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Status ───────────────────────────────────────────────────
  async getStatus(): Promise<AgentStatus> {
    const hasBrain = this.brainDir && existsSync(this.brainDir);
    let cdpAlive = false;

    try {
      const res = await fetch(
        `http://${this.cdpHost}:${this.cdpPort}/json/version`,
      );
      cdpAlive = res.ok;
    } catch {
      // CDP not available
    }

    return {
      type: this.type,
      name: this.name,
      state: cdpAlive ? 'connected' : hasBrain ? 'disconnected' : 'unknown',
      lastSeen: hasBrain ? new Date().toISOString() : undefined,
    };
  }

  // ── Send Prompt (via CDP) ────────────────────────────────────
  async sendPrompt(
    prompt: string,
    _options?: SendOptions,
  ): Promise<AgentResponse> {
    try {
      await this.ensureCdp();
      // Use CDP Runtime.evaluate to send a message
      const result = await this.cdpEvaluate(`
        (function() {
          // Try to find the Antigravity chat input and inject prompt
          const inputs = document.querySelectorAll('textarea, [contenteditable]');
          for (const input of inputs) {
            if (input.closest('.chat-input, .message-input, [class*="input"]')) {
              input.focus();
              input.value = ${JSON.stringify(prompt)};
              input.dispatchEvent(new Event('input', { bubbles: true }));
              // Simulate Enter
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
              return 'sent';
            }
          }
          return 'no-input-found';
        })()
      `);
      return {
        success: result === 'sent',
        output: result as string,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Stop ─────────────────────────────────────────────────────
  async stop(): Promise<void> {
    this.disconnectCdp();
  }

  // ── List Conversations ───────────────────────────────────────
  async listConversations(
    limit = 20,
  ): Promise<Array<{ id: string; summary?: string; updatedAt?: string }>> {
    if (!this.brainDir || !existsSync(this.brainDir)) return [];

    const entries = await readdir(this.brainDir, { withFileTypes: true });
    const convos: Array<{
      id: string;
      summary?: string;
      updatedAt?: string;
    }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const convDir = join(this.brainDir, entry.name);
      const overviewPath = join(
        convDir,
        '.system_generated',
        'logs',
        'overview.txt',
      );

      let summary: string | undefined;
      let updatedAt: string | undefined;

      try {
        const st = await stat(convDir);
        updatedAt = st.mtime.toISOString();
      } catch {
        // skip
      }

      // Try reading first line of overview as summary
      try {
        if (existsSync(overviewPath)) {
          const text = await readFile(overviewPath, 'utf-8');
          const firstLine = text.split('\n').find((l) => l.trim().length > 0);
          summary = firstLine?.slice(0, 120);
        }
      } catch {
        // skip
      }

      convos.push({ id: entry.name, summary, updatedAt });
    }

    // Sort by most recent
    convos.sort((a, b) => {
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return convos.slice(0, limit);
  }

  // ── Task Status ──────────────────────────────────────────────
  async getTaskStatus(conversationId?: string): Promise<TaskStatus | null> {
    const convId = conversationId ?? (await this.findLatestConversation());
    if (!convId) return null;

    const taskPath = join(this.brainDir, convId, 'task.md');
    if (!existsSync(taskPath)) return null;

    const content = await readFile(taskPath, 'utf-8');
    return this.parseTaskMd(convId, content);
  }

  // ── Plan ─────────────────────────────────────────────────────
  async getPlan(conversationId?: string): Promise<string | null> {
    const convId = conversationId ?? (await this.findLatestConversation());
    if (!convId) return null;

    const planPath = join(this.brainDir, convId, 'implementation_plan.md');
    if (!existsSync(planPath)) return null;

    return readFile(planPath, 'utf-8');
  }

  // ── Walkthrough ──────────────────────────────────────────────
  async getWalkthrough(conversationId?: string): Promise<string | null> {
    const convId = conversationId ?? (await this.findLatestConversation());
    if (!convId) return null;

    const walkthroughPath = join(this.brainDir, convId, 'walkthrough.md');
    if (!existsSync(walkthroughPath)) return null;

    return readFile(walkthroughPath, 'utf-8');
  }

  // ── Approve (via inbox file) ─────────────────────────────────
  async approve(conversationId: string, message?: string): Promise<void> {
    const inboxDir = join(this.brainDir, conversationId, 'inbox');
    await mkdir(inboxDir, { recursive: true });

    const msg = {
      id: crypto.randomUUID(),
      type: 'approve',
      message: message ?? 'Approved via AgentHub MCP',
      timestamp: new Date().toISOString(),
      read: false,
    };

    const filePath = join(inboxDir, `${msg.id}.json`);
    await writeFile(filePath, JSON.stringify(msg, null, 2), 'utf-8');

    // Also try CDP injection as backup
    try {
      await this.ensureCdp();
      await this.cdpEvaluate(`
        (function() {
          // Try to click approve/continue buttons
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            const txt = btn.textContent?.toLowerCase() ?? '';
            if (txt.includes('approve') || txt.includes('continue') || txt.includes('confirm')) {
              btn.click();
              return 'clicked';
            }
          }
          return 'no-button-found';
        })()
      `);
    } catch {
      // CDP injection is best-effort
    }
  }

  // ── Internal Helpers ─────────────────────────────────────────

  private async findLatestConversation(): Promise<string | null> {
    if (!this.brainDir || !existsSync(this.brainDir)) return null;

    const entries = await readdir(this.brainDir, { withFileTypes: true });
    let latest: { name: string; mtime: number } | null = null;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const st = await stat(join(this.brainDir, entry.name));
        if (!latest || st.mtimeMs > latest.mtime) {
          latest = { name: entry.name, mtime: st.mtimeMs };
        }
      } catch {
        continue;
      }
    }

    return latest?.name ?? null;
  }

  private parseTaskMd(conversationId: string, content: string): TaskStatus {
    const lines = content.split('\n');
    const items: TaskItem[] = [];
    let title = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Extract title from first heading
      if (!title && trimmed.startsWith('# ')) {
        title = trimmed.replace(/^#+\s*/, '');
        continue;
      }

      // Parse checkbox items: - [ ] todo, - [x] done, - [/] in_progress
      const checkMatch = trimmed.match(
        /^-\s*\[([ xX\/])\]\s*(.+)$/,
      );
      if (checkMatch) {
        const mark = checkMatch[1];
        const text = checkMatch[2];
        let status: TaskItem['status'] = 'todo';
        if (mark === 'x' || mark === 'X') status = 'done';
        else if (mark === '/') status = 'in_progress';

        // Detect indentation for nesting (simplified — only 1 level)
        const indent = line.search(/\S/);
        if (indent >= 4 && items.length > 0) {
          const parent = items[items.length - 1];
          parent.children = parent.children ?? [];
          parent.children.push({ text, status });
        } else {
          items.push({ text, status });
        }
      }
    }

    const flatItems = items.flatMap((i) => [i, ...(i.children ?? [])]);
    const done = flatItems.filter((i) => i.status === 'done').length;
    const inProgress = flatItems.filter(
      (i) => i.status === 'in_progress',
    ).length;
    const todo = flatItems.filter((i) => i.status === 'todo').length;

    return {
      conversationId,
      title: title || basename(conversationId),
      items,
      stats: {
        total: flatItems.length,
        done,
        inProgress,
        todo,
      },
    };
  }

  // ── CDP Communication ────────────────────────────────────────

  private async ensureCdp(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // Discover WebSocket URL from CDP JSON endpoint
    const res = await fetch(
      `http://${this.cdpHost}:${this.cdpPort}/json`,
    );
    const targets = (await res.json()) as Array<{
      webSocketDebuggerUrl?: string;
      type?: string;
      title?: string;
    }>;

    const target = targets.find(
      (t) =>
        t.webSocketDebuggerUrl &&
        (t.title?.toLowerCase().includes('antigravity') ||
          t.type === 'page'),
    );

    if (!target?.webSocketDebuggerUrl) {
      throw new Error(
        `No suitable CDP target found on ${this.cdpHost}:${this.cdpPort}`,
      );
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(target.webSocketDebuggerUrl!);
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
      setTimeout(() => reject(new Error('CDP connection timeout')), 5000);
    });
  }

  private cdpEvaluate(expression: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('CDP not connected'));
      }

      const id = ++this.cdpMsgId;
      const handler = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            id: number;
            result?: { result?: { value?: unknown } };
            error?: { message?: string };
          };
          if (msg.id === id) {
            this.ws?.off('message', handler);
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result?.result?.value);
            }
          }
        } catch {
          // not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true },
        }),
      );

      setTimeout(() => {
        this.ws?.off('message', handler);
        reject(new Error('CDP evaluate timeout'));
      }, 10000);
    });
  }

  private disconnectCdp(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
