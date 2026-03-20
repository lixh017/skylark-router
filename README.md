# 灵雀 Skylark Router

A personal LLM routing gateway — manage multiple AI providers in one place, with a built-in Chat UI, a desktop app, and a single API endpoint for all your tools.

**English** | [中文](#中文说明)

---

## Two deployment modes

| Mode | Best for |
|------|----------|
| **Desktop App** (Tauri) | Personal use on macOS — native .app, no terminal needed |
| **Server binary / Docker** | Home server, NAS, team shared gateway |

---

## Features

- **Multi-provider routing** — OpenAI-compatible & Anthropic APIs
- **20+ provider presets** — OpenAI, Anthropic, DeepSeek, SiliconFlow, Moonshot, 智谱 AI, 阿里百炼, Groq, Ollama, and more
- **✦ Auto routing** — automatically selects the highest-priority healthy route
- **Weighted load balancing** — distribute traffic across providers by weight
- **Failover** — automatically retry with the next route on failure
- **Built-in Chat UI** — multi-column model comparison, streaming, file attachments, Markdown + code highlighting
- **File attachments** — images, audio, video, documents (PDF / Word / Excel / …)
- **Extended thinking** — collapsible think blocks, per-column "No thinking" toggle
- **Chat parameters** — Temperature, Top P, Max tokens, Frequency/Presence Penalty, Context limit, System prompt
- **Web search** — optional search injection before sending to the model
- **Per-key rate limiting & quota** — control usage per API key
- **Request logs** — full request/response body logging (optional)
- **Statistics & timeseries** — requests, cost, latency charts
- **Multi-language UI** — English, 中文, 日本語, 한국어, Français, Deutsch, Español
- **Light / Dark / System theme**
- **Single binary** — frontend embedded, no separate web server needed
- **Cross-platform** — macOS, Linux, Windows (amd64 / arm64)
- **Docker support**

---

## Desktop App (macOS)

### Requirements

- macOS 12+
- Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node.js 18+ and Go 1.22+

### Run in dev mode

```bash
make tauri-dev
```

### Build .dmg

```bash
# Current architecture
make tauri-build-dmg

# Universal binary (arm64 + x86_64)
make tauri-build-universal-dmg
```

The `.dmg` will be in `frontend/src-tauri/target/release/bundle/dmg/`.

See [`docs/desktop-app.md`](docs/desktop-app.md) for full details.

---

## Server / Binary

### Download binary

Download the latest release for your platform from the [Releases](../../releases) page.

```bash
# macOS (Apple Silicon)
chmod +x skylark-router-darwin-arm64
./skylark-router-darwin-arm64

# Linux (x86_64)
chmod +x skylark-router-linux-amd64
./skylark-router-linux-amd64
```

The dashboard opens automatically at `http://localhost:16898`.

### Build from source

```bash
# Prerequisites: Go 1.22+, Node.js 18+
git clone https://github.com/yourname/skylark-router
cd skylark-router
make build
./skylark-router
```

### Docker

```bash
docker compose up -d
```

---

## Quick start

1. **Add a provider** — Providers tab → **+ Add Provider** → pick a preset → enter your API key
2. **Add model mappings** — Models tab → **+ Add Model** → set external name, provider model, priority
3. **Call the API**

```bash
curl http://localhost:16898/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

Point any OpenAI-compatible client at `http://localhost:16898/v1`.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/getting-started.md`](docs/getting-started.md) | Full setup walkthrough |
| [`docs/integrations.md`](docs/integrations.md) | Cursor, Claude Code, Codex, Trae, OpenClaw, Cline, LobeChat, Open WebUI, Python, Node.js … |
| [`docs/desktop-app.md`](docs/desktop-app.md) | Desktop app build and usage |
| [`docs/routing.md`](docs/routing.md) | Providers, model routing, load balancing |
| [`docs/chat-ui.md`](docs/chat-ui.md) | Chat UI features and keyboard shortcuts |
| [`docs/configuration.md`](docs/configuration.md) | All config options (YAML / env vars) |
| [`docs/api-reference.md`](docs/api-reference.md) | API endpoints and authentication |

---

## Architecture

```
┌─────────────────────────────────┐
│    Your App / Cursor / Chat UI  │
│    OpenAI SDK / HTTP client     │
└────────────┬────────────────────┘
             │ POST /v1/chat/completions
             ▼
┌─────────────────────────────────┐
│        灵雀 Skylark Router       │
│  ┌─────────────────────────┐   │
│  │  Auth  │  Rate Limit    │   │
│  ├─────────────────────────┤   │
│  │  Route Selection        │   │
│  │  (priority + weighted   │   │
│  │   random + failover)    │   │
│  └────────────┬────────────┘   │
└───────────────┼─────────────────┘
        ┌───────┴────────┐
        ▼                ▼
   Provider A        Provider B
  (OpenAI)         (DeepSeek)
```

---

## License

MIT — see [LICENSE](LICENSE)

---

## 中文说明

灵雀是一个个人 LLM 路由网关，将多个 AI 服务商聚合在一个统一入口下，内置 Chat UI、桌面应用和完整管理面板。

### 两种部署方式

| 方式 | 适用场景 |
|------|----------|
| **桌面端 App**（Tauri） | macOS 个人使用，双击打开，无需命令行 |
| **服务器二进制 / Docker** | 家用服务器、NAS、团队共享网关 |

### 快速开始

```bash
# 下载对应平台的二进制文件后直接运行
./skylark-router-darwin-arm64   # macOS Apple Silicon
./skylark-router-linux-amd64    # Linux x86_64
```

启动后自动打开 `http://localhost:16898` 管理面板。

**基本流程：**

1. **Providers（提供商）** — 添加 OpenAI、DeepSeek、SiliconFlow 等服务商
2. **Models（模型）** — 设置模型映射，同一个外部名可配置多个路由实现负载均衡和故障转移
3. **API Keys（可选）** — 为不同应用创建独立密钥并设置限流/配额
4. 将你的应用 `base_url` 改为 `http://localhost:16898/v1`

详细文档见 [`docs/`](docs/) 目录。
