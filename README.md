# 灵雀 Skylark Router

A personal LLM routing gateway — manage multiple AI providers in one place, with a clean web UI and a single API endpoint for all your apps.

**English** | [中文](#中文说明)

---

## Features

- **Multi-provider routing** — OpenAI-compatible & Anthropic APIs
- **Weighted load balancing** — distribute traffic across providers by weight
- **Failover** — automatically retry with the next route on failure
- **Per-key rate limiting & quota** — control usage per API key
- **Request logs** — full request/response body logging (optional)
- **Multi-language UI** — English, 中文, 日本語, 한국어, Français, Deutsch, Español
- **Light / Dark / System theme**
- **Single binary** — frontend embedded, no separate web server needed
- **Cross-platform** — macOS, Linux, Windows (amd64 / arm64)
- **Docker support**

---

## Quick Start

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

The dashboard will open automatically at `http://localhost:8080`.

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
# Pull and run
docker compose up -d

# Or build locally
make docker-build
docker compose up -d
```

---

## Configuration

On first launch, `config.yaml` is created next to the binary:

```yaml
# Bind address (0.0.0.0 = all interfaces, 127.0.0.1 = localhost only)
host: "0.0.0.0"

# Port to listen on
port: "8080"

# SQLite database path (relative to binary directory)
db_path: "skylark-router.db"

# Admin token to protect the dashboard (leave empty to disable auth)
auth_token: ""

# Default model when request omits the model field
# Use "auto" to auto-select the highest-priority model across all mappings
default_model: ""

# Log full request/response bodies (for debugging)
log_requests: false
```

Environment variables override the config file:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for localhost only) |
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `skylark-router.db` | SQLite database path |
| `AUTH_TOKEN` | _(none)_ | Admin dashboard token |
| `DEFAULT_MODEL` | _(none)_ | Default model when request omits `model` field (`"auto"` = highest-priority) |
| `LOG_REQUESTS` | `false` | Enable request body logging |

---

## Usage

### 1. Add a provider

Go to **Providers** tab → **+ Add Provider**.

Use the quick-fill cards to pre-fill settings for popular providers:

| Provider | Protocol | Notes |
|----------|----------|-------|
| OpenAI | OpenAI | `https://api.openai.com/v1` |
| Anthropic | Anthropic | `https://api.anthropic.com` |
| DeepSeek | OpenAI | `https://api.deepseek.com/v1` |
| SiliconFlow | OpenAI | `https://api.siliconflow.cn/v1` |
| Groq | OpenAI | `https://api.groq.com/openai/v1` |
| Ollama | OpenAI | `http://localhost:11434/v1` |
| … | | Moonshot, 零一万物, 阿里百炼, Together AI |

### 2. Add model mappings

Go to **Models** tab → **+ Add Model**.

- **External name** — the name your apps will use (e.g. `gpt-4o`)
- **Provider model** — the actual model name the provider API expects (e.g. `gpt-4o-2024-08-06`)
- **Priority** — higher = preferred when multiple routes exist
- **Weight** — load-balancing ratio (e.g. weight 3:1 sends ~75% to the first route)

Multiple routes for the same external name enable **failover** and **load balancing** automatically.

### 3. Call the API

Point your existing OpenAI SDK or HTTP client to the router:

```bash
# Chat completion
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="sk-your-key",   # your router API key, or any string if auth disabled
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
```

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "sk-your-key",
  dangerouslyAllowBrowser: true,
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(response.choices[0].message.content);
```

### 4. Using with Cursor / other tools

In Cursor settings → Models → OpenAI API Key, set:
- **Base URL**: `http://localhost:8080/v1`
- **API Key**: your router API key (or any string if auth is disabled)

Same pattern applies to any tool that supports a custom OpenAI base URL.

---

## API Keys

Go to **API Keys** tab to create keys and control access.

| Field | Description |
|-------|-------------|
| **Rate Limit** | Max requests per minute (0 = unlimited) |
| **Quota** | Total token budget (0 = unlimited) |

When no API keys are configured, all proxy requests are allowed without authentication.

---

## Proxy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | Chat completions (streaming supported) |
| `POST` | `/v1/images/generations` | Image generation |
| `POST` | `/v1/embeddings` | Embeddings |
| `POST` | `/v1/messages` | Anthropic Messages API |
| `GET` | `/v1/models` | List available models |

---

## Development

```bash
# Run backend and frontend separately (hot reload)
cd backend && go run .          # API at :8080
cd frontend && npm run dev      # UI at :5173 (proxied to :8080)
```

Build release binaries for all platforms:

```bash
make release VERSION=v1.0.0
# Output: dist/skylark-router-{os}-{arch}[.exe]
```

---

## Architecture

```
┌─────────────────────────────────┐
│         Your App / Cursor       │
│    OpenAI SDK / HTTP client     │
└────────────┬────────────────────┘
             │ POST /v1/chat/completions
             ▼
┌─────────────────────────────────┐
│          灵雀 Skylark Router         │
│  ┌─────────────────────────┐    │
│  │  Auth  │  Rate Limit    │    │
│  ├─────────────────────────┤    │
│  │  Route Selection        │    │
│  │  (priority + weighted   │    │
│  │   random + failover)    │    │
│  └────────────┬────────────┘    │
└───────────────┼─────────────────┘
        ┌───────┴────────┐
        ▼                ▼
   Provider A       Provider B
  (OpenAI)        (DeepSeek)
```

---

## License

MIT — see [LICENSE](LICENSE)

---

## 中文说明

灵雀是一个个人 LLM 路由网关，将多个 AI 服务商聚合在一个统一的 API 端点下。

### 快速开始

```bash
# 下载对应平台的二进制文件后直接运行
./skylark-router-darwin-arm64   # macOS Apple Silicon
./skylark-router-linux-amd64    # Linux x86_64
```

启动后自动打开 `http://localhost:8080` 管理面板。

### 基本流程

1. **Providers（提供商）** — 添加 OpenAI、DeepSeek、SiliconFlow 等服务商
2. **Models（模型）** — 设置模型映射，同一个外部名可配置多个路由实现负载均衡和自动故障转移
3. **API Keys** — 可选，为不同应用创建独立密钥并设置限流/配额
4. 将你的应用 `base_url` 改为 `http://localhost:8080/v1` 即可

### 配置文件

首次运行会在二进制文件同目录自动生成 `config.yaml`：

```yaml
host: "0.0.0.0"       # 绑定地址（0.0.0.0=所有网卡，127.0.0.1=仅本机）
port: "8080"          # 监听端口
db_path: "skylark-router.db"  # 数据库路径
auth_token: ""        # 管理面板访问令牌（留空则不验证）
log_requests: false   # 是否记录完整请求/响应体
```

环境变量（`PORT`、`DB_PATH`、`AUTH_TOKEN`、`LOG_REQUESTS`）优先级高于配置文件。
