# AgentHub MCP

**English** | [中文](./README_CN.md)

> 🌐 A unified MCP Server to **monitor and control multiple AI coding agents** — from any MCP-compatible client.

**AgentHub MCP** lets you use _any_ AI coding assistant (Antigravity, Claude Code, Codex, Cursor, etc.) to orchestrate _all_ your other AI agents through a single, standardized interface.

## ✨ Features

| Category | Tools | Description |
|----------|-------|-------------|
| 🔍 Discovery | `list-agents` | List all registered agents and their status |
| 🔍 Discovery | `agent-status` | Get detailed health info for a specific agent |
| 🔍 Discovery | `ping` | Test connectivity to an agent |
| 📊 Monitor | `get-task-status` | Parse task.md to show progress (TODO/in-progress/done) |
| 📊 Monitor | `get-plan` | Retrieve the implementation plan |
| 📊 Monitor | `get-overview` | Global dashboard of all agents |
| 🎮 Action | `ask-agent` | Send a task prompt to any agent |
| 🎮 Action | `approve` | Remote approve/confirm pending actions |
| 🎮 Action | `stop-agent` | Stop current agent execution |
| ⚙️ Manage | `register-agent` | Register a new agent instance at runtime |

## 🏗️ Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Antigravity │  │ Claude Code │  │   Codex     │
│  (MCP Client)│  │  (MCP Client)│  │  (MCP Client)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └────────────────┼────────────────┘
                        │ stdio
               ┌────────▼────────┐
               │  AgentHub MCP   │
               │  (Unified Hub)  │
               └────────┬────────┘
          ┌─────────────┼─────────────┐
   ┌──────▼──────┐ ┌───▼───┐  ┌─────▼─────┐
   │ Antigravity │ │Claude │  │  Codex    │
   │  Connector  │ │Code   │  │ Connector │
   │  (CDP+Files)│ │Conn.  │  │ (CLI/SDK) │
   └─────────────┘ └───────┘  └───────────┘
```

## 🚀 Quick Start

### Install

```bash
npm install -g agenthub-mcp
```

Or run directly:

```bash
npx agenthub-mcp
```

### Configure in Your MCP Client

**Antigravity** (`mcp_config.json`):
```json
{
  "mcpServers": {
    "agenthub": {
      "command": "npx",
      "args": ["-y", "agenthub-mcp"]
    }
  }
}
```

**Claude Code**:
```bash
claude mcp add agenthub-mcp -- npx -y agenthub-mcp
```

**Codex** (`.codex/config.toml`):
```toml
[mcp_servers.agenthub]
command = "npx"
args = ["-y", "agenthub-mcp"]
```

## ⚙️ Configuration

Agent configurations are stored at `~/.config/agenthub-mcp/agents.json`:

```json
{
  "agents": [
    {
      "type": "antigravity",
      "name": "antigravity",
      "config": {
        "brainDir": "~/.gemini/antigravity/brain",
        "cdpPort": 9222,
        "autoDetect": true
      }
    },
    {
      "type": "claude-code",
      "name": "claude",
      "config": {
        "executable": "claude"
      }
    },
    {
      "type": "codex",
      "name": "codex",
      "config": {
        "executable": "codex",
        "approvalMode": "suggest"
      }
    }
  ]
}
```

## 🔌 Supported Agents

| Agent | Monitor | Send Tasks | Approve | Method |
|-------|---------|------------|---------|--------|
| **Antigravity** | ✅ brain dir scan | ✅ CDP injection | ✅ inbox + CDP | File + WebSocket |
| **Claude Code** | ✅ stream-json | ✅ CLI `-p` mode | ✅ `--resume` | CLI subprocess |
| **Codex** | ✅ stdout | ✅ CLI `-q` mode | ⬜ planned | CLI subprocess |

## 📝 License

MIT — see [LICENSE](./LICENSE).
