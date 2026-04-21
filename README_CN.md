# AgentHub MCP

[English](./README.md) | **中文**

> 🌐 统一的 MCP Server，让你从**任何一个 AI 编程助手**监控和操控**所有其他 AI Agent**。

**AgentHub MCP** 让你可以用任意一个 AI 编程助手（Antigravity / Claude Code / Codex / Cursor 等）通过标准化接口编排你所有的 AI Agent —— 发送任务、监控进度、远程确认。

## ✨ 功能一览

| 分类 | 工具 | 说明 |
|------|------|------|
| 🔍 发现 | `list-agents` | 列出所有已注册 Agent 及其状态 |
| 🔍 发现 | `agent-status` | 获取特定 Agent 的详细健康信息 |
| 🔍 发现 | `ping` | 测试 Agent 连通性 |
| 📊 监控 | `get-task-status` | 解析 task.md 展示任务进度（TODO/进行中/已完成） |
| 📊 监控 | `get-plan` | 获取实施方案原文 |
| 📊 监控 | `get-overview` | 全局仪表盘，所有 Agent 状态汇总 |
| 🎮 操作 | `ask-agent` | 向任意 Agent 发送任务 prompt |
| 🎮 操作 | `approve` | 远程批准/确认待审操作 |
| 🎮 操作 | `stop-agent` | 停止当前 Agent 执行 |
| ⚙️ 管理 | `register-agent` | 运行时动态注册新的 Agent 实例 |

## 🏗️ 架构

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Antigravity │  │ Claude Code │  │   Codex     │
│  (MCP 客户端)│  │  (MCP 客户端)│  │  (MCP 客户端)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └────────────────┼────────────────┘
                        │ stdio
               ┌────────▼────────┐
               │  AgentHub MCP   │
               │   (统一中枢)     │
               └────────┬────────┘
          ┌─────────────┼─────────────┐
   ┌──────▼──────┐ ┌───▼───┐  ┌─────▼─────┐
   │ Antigravity │ │Claude │  │  Codex    │
   │  Connector  │ │Code   │  │ Connector │
   │  (CDP+文件)  │ │Conn.  │  │ (CLI/SDK) │
   └─────────────┘ └───────┘  └───────────┘
```

## 🚀 快速开始

### 安装

```bash
npm install -g agenthub-mcp
```

或直接运行：

```bash
npx agenthub-mcp
```

### 在你的 MCP 客户端中配置

**Antigravity** (`mcp_config.json`)：
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

**Claude Code**：
```bash
claude mcp add agenthub-mcp -- npx -y agenthub-mcp
```

**Codex** (`.codex/config.toml`)：
```toml
[mcp_servers.agenthub]
command = "npx"
args = ["-y", "agenthub-mcp"]
```

## ⚙️ 配置

Agent 配置文件位于 `~/.config/agenthub-mcp/agents.json`：

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

## 🔌 支持的 Agent

| Agent | 监控 | 发送任务 | 远程确认 | 接入方式 |
|-------|------|----------|----------|----------|
| **Antigravity** | ✅ brain 目录扫描 | ✅ CDP 注入 | ✅ inbox + CDP | 文件 + WebSocket |
| **Claude Code** | ✅ stream-json | ✅ CLI `-p` 模式 | ✅ `--resume` | CLI 子进程 |
| **Codex** | ✅ stdout | ✅ CLI `-q` 模式 | ⬜ 计划中 | CLI 子进程 |

## 📝 许可证

MIT — 详见 [LICENSE](./LICENSE)。
