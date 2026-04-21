/**
 * ClaudeCodeConnector — Connects to Claude Code CLI via:
 *   1. Non-interactive mode: `claude -p "prompt" --output-format stream-json`
 *   2. Session resume: `claude --resume <session> -p "prompt"`
 *   3. Status check: `claude auth status`
 */
import { spawn, type ChildProcess } from 'node:child_process';

import { AgentConnector } from './base.js';
import type {
  AgentStatus,
  AgentResponse,
  ClaudeCodeConfig,
  SendOptions,
} from '../types.js';

export class ClaudeCodeConnector extends AgentConnector {
  readonly type = 'claude-code' as const;
  readonly name: string;

  private executable: string;
  private defaultWorkdir: string;
  private activeProcess: ChildProcess | null = null;
  private lastSessionId: string | null = null;

  constructor(name: string, raw: Record<string, unknown>) {
    super();
    this.name = name;
    const cfg = raw as unknown as ClaudeCodeConfig;
    this.executable = cfg.executable ?? 'claude';
    this.defaultWorkdir = cfg.defaultWorkdir ?? process.cwd();
  }

  // ── Ping ─────────────────────────────────────────────────────
  async ping(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.executable, ['auth', 'status', '--text'], {
        cwd: this.defaultWorkdir,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
        shell: true,
      });

      let output = '';
      proc.stdout?.on('data', (d) => (output += d.toString()));
      proc.on('close', (code) => {
        resolve(
          code === 0 ||
            output.toLowerCase().includes('authenticated') ||
            output.toLowerCase().includes('logged in'),
        );
      });
      proc.on('error', () => resolve(false));
    });
  }

  // ── Status ───────────────────────────────────────────────────
  async getStatus(): Promise<AgentStatus> {
    const alive = await this.ping();
    return {
      type: this.type,
      name: this.name,
      state: alive ? 'connected' : 'disconnected',
      lastSeen: alive ? new Date().toISOString() : undefined,
    };
  }

  // ── Send Prompt ──────────────────────────────────────────────
  async sendPrompt(
    prompt: string,
    options?: SendOptions,
  ): Promise<AgentResponse> {
    const args: string[] = ['-p', prompt, '--output-format', 'json'];

    if (options?.workdir) {
      args.unshift('--add-dir', options.workdir);
    }

    // Resume previous session if available
    if (this.lastSessionId) {
      args.unshift('-c');
    }

    const workdir = options?.workdir ?? this.defaultWorkdir;
    const timeout = options?.timeout ?? 120_000;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      this.activeProcess = spawn(this.executable, args, {
        cwd: workdir,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
        shell: true,
      });

      this.activeProcess.stdout?.on('data', (d) => (stdout += d.toString()));
      this.activeProcess.stderr?.on('data', (d) => (stderr += d.toString()));

      this.activeProcess.on('close', (code) => {
        this.activeProcess = null;

        // Try to extract session ID from output
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.session_id) {
            this.lastSessionId = parsed.session_id;
          }
        } catch {
          // Not JSON, use raw output
        }

        resolve({
          success: code === 0,
          output: stdout.trim() || undefined,
          error: stderr.trim() || undefined,
          sessionId: this.lastSessionId ?? undefined,
        });
      });

      this.activeProcess.on('error', (err) => {
        this.activeProcess = null;
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  }

  // ── Stop ─────────────────────────────────────────────────────
  async stop(): Promise<void> {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
  }

  // ── Approve (send continue message to same session) ──────────
  async approve(
    _conversationId: string,
    message?: string,
  ): Promise<void> {
    const prompt = message ?? 'Approved. Please continue.';
    await this.sendPrompt(prompt);
  }
}
