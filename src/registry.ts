/**
 * Agent Registry — Manages registered agent instances and their connectors.
 *
 * Reads configuration from ~/.config/agenthub-mcp/agents.json
 * or falls back to auto-detection.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { AgentConfig, AgentType } from './types.js';
import { AgentConnector } from './connectors/base.js';
import { AntigravityConnector } from './connectors/antigravity.js';
import { ClaudeCodeConnector } from './connectors/claude-code.js';
import { CodexConnector } from './connectors/codex.js';

const CONFIG_DIR = join(homedir(), '.config', 'agenthub-mcp');
const CONFIG_FILE = join(CONFIG_DIR, 'agents.json');

export class AgentRegistry {
  private agents = new Map<string, AgentConnector>();

  /** Load agent configs from disk, or create default if missing. */
  async load(): Promise<void> {
    let configs: AgentConfig[];

    if (existsSync(CONFIG_FILE)) {
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as { agents: AgentConfig[] };
      configs = parsed.agents ?? [];
    } else {
      configs = this.defaultConfigs();
      await this.saveDefaults(configs);
    }

    for (const cfg of configs) {
      const connector = this.createConnector(cfg);
      if (connector) {
        this.agents.set(cfg.name, connector);
      }
    }
  }

  /** Get a connector by agent name. */
  get(name: string): AgentConnector | undefined {
    return this.agents.get(name);
  }

  /** List all registered connectors. */
  list(): AgentConnector[] {
    return [...this.agents.values()];
  }

  /** Register a new agent at runtime. */
  register(config: AgentConfig): AgentConnector | null {
    const connector = this.createConnector(config);
    if (connector) {
      this.agents.set(config.name, connector);
    }
    return connector;
  }

  /** Resolve an agent name — supports partial matching and type-based lookup. */
  resolve(nameOrType: string): AgentConnector | undefined {
    // Exact match
    const exact = this.agents.get(nameOrType);
    if (exact) return exact;

    // Type-based lookup (return first of that type)
    for (const a of this.agents.values()) {
      if (a.type === nameOrType) return a;
    }

    // Prefix match
    for (const [key, a] of this.agents) {
      if (key.startsWith(nameOrType)) return a;
    }

    return undefined;
  }

  // ── Internal ─────────────────────────────────────────────────

  private createConnector(cfg: AgentConfig): AgentConnector | null {
    const type = cfg.type as AgentType;
    switch (type) {
      case 'antigravity':
        return new AntigravityConnector(cfg.name, cfg.config);
      case 'claude-code':
        return new ClaudeCodeConnector(cfg.name, cfg.config);
      case 'codex':
        return new CodexConnector(cfg.name, cfg.config);
      default:
        console.error(`[AgentHub] Unknown agent type: ${type}`);
        return null;
    }
  }

  private defaultConfigs(): AgentConfig[] {
    const isWindows = process.platform === 'win32';
    const homeDir = homedir();

    return [
      {
        type: 'antigravity',
        name: 'antigravity',
        config: {
          brainDir: isWindows
            ? join(homeDir, '.gemini', 'antigravity', 'brain')
            : join(homeDir, '.gemini', 'antigravity', 'brain'),
          autoDetect: true,
        },
      },
      {
        type: 'claude-code',
        name: 'claude',
        config: {
          executable: 'claude',
        },
      },
      {
        type: 'codex',
        name: 'codex',
        config: {
          executable: 'codex',
          approvalMode: 'suggest',
        },
      },
    ];
  }

  private async saveDefaults(configs: AgentConfig[]): Promise<void> {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });
      await writeFile(
        CONFIG_FILE,
        JSON.stringify({ agents: configs }, null, 2),
        'utf-8',
      );
    } catch {
      // Silent fail — config dir might be read-only
    }
  }
}
