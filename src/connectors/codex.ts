/**
 * CodexConnector — Connects to OpenAI Codex CLI via:
 *   1. Non-interactive mode: `codex -q "prompt" --approval-mode full-auto`
 *   2. Status check: binary existence + `codex --version`
 */
import { spawn, type ChildProcess } from 'node:child_process';

import { AgentConnector } from './base.js';
import type {
  AgentStatus,
  AgentResponse,
  CodexConfig,
  SendOptions,
} from '../types.js';

export class CodexConnector extends AgentConnector {
  readonly type = 'codex' as const;
  readonly name: string;

  private executable: string;
  private defaultWorkdir: string;
  private approvalMode: string;
  private activeProcess: ChildProcess | null = null;
  private version: string | null = null;

  constructor(name: string, raw: Record<string, unknown>) {
    super();
    this.name = name;
    const cfg = raw as unknown as CodexConfig;
    this.executable = cfg.executable ?? 'codex';
    this.defaultWorkdir = cfg.defaultWorkdir ?? process.cwd();
    this.approvalMode = cfg.approvalMode ?? 'suggest';
  }

  // ── Ping ─────────────────────────────────────────────────────
  async ping(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.executable, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
        shell: true,
      });

      let output = '';
      proc.stdout?.on('data', (d) => (output += d.toString()));
      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          this.version = output.trim();
        }
        resolve(code === 0);
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
      version: this.version ?? undefined,
      lastSeen: alive ? new Date().toISOString() : undefined,
    };
  }

  // ── Send Prompt ──────────────────────────────────────────────
  async sendPrompt(
    prompt: string,
    options?: SendOptions,
  ): Promise<AgentResponse> {
    // Codex CLI: codex -q "prompt" --approval-mode <mode>
    const mode = options?.mode === 'fast' ? 'full-auto' : this.approvalMode;
    const args: string[] = ['-q', prompt, '--approval-mode', mode];

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
        resolve({
          success: code === 0,
          output: stdout.trim() || undefined,
          error: stderr.trim() || undefined,
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
}
