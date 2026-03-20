# Getting Started

This guide walks you through setting up Skylark Router from scratch.

---

## Choose your deployment

### Desktop App (macOS, recommended for personal use)

See [`desktop-app.md`](desktop-app.md) for build and installation.

### Server binary

```bash
# 1. Download binary for your platform from the Releases page
# 2. Make it executable and run
chmod +x skylark-router-darwin-arm64
./skylark-router-darwin-arm64
```

The dashboard opens automatically at `http://localhost:16898`.

### Docker

```bash
git clone https://github.com/yourname/skylark-router
cd skylark-router
docker compose up -d
```

---

## Step 1 — Add a provider

Go to **Providers** → **+ Add Provider**.

Click one of the preset cards (OpenAI, Anthropic, DeepSeek, SiliconFlow, etc.) to pre-fill the URL and protocol. Enter your API key and save.

**What you need per provider:**

| Field | Example |
|-------|---------|
| Name | `openai` |
| Base URL | `https://api.openai.com/v1` |
| API Key | `sk-...` |
| Protocol | `OpenAI` or `Anthropic` |

> **Tip:** You can add multiple providers and later configure failover between them.

---

## Step 2 — Add model mappings

Go to **Models** → **+ Add Model**.

| Field | Description |
|-------|-------------|
| **Name** | External model name your apps use, e.g. `gpt-4o` |
| **Provider** | Which provider to route to |
| **Provider model** | Actual model name the provider expects, e.g. `gpt-4o-2024-08-06` |
| **Priority** | Higher number = preferred route (default 0) |
| **Weight** | Load-balancing ratio when multiple routes share the same priority |

To add **failover**: create a second mapping with the same Name but a different provider and lower Priority. If the primary fails, the router automatically tries the next.

To add **load balancing**: create two mappings with the same Name, same Priority, and different Weights.

---

## Step 3 — Test the connection

In the Providers list, click **Test** on your provider. A green result with latency means the connection works.

---

## Step 4 — Use the API

### Cursor / VS Code / any OpenAI-compatible tool

Set:
- **Base URL**: `http://localhost:16898/v1`
- **API Key**: any string (or a key from the API Keys tab)

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:16898/v1",
    api_key="sk-your-router-key",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

### cURL

```bash
curl http://localhost:16898/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Step 5 — (Optional) Create API keys

Go to **API Keys** → **+ Create Key** to issue per-app keys with optional rate limits and token quotas.

If no keys are configured, all proxy requests pass through without authentication.

---

## Next steps

- [`integrations.md`](integrations.md) — Cursor, Claude Code, Codex CLI, Trae, Cline, LobeChat, Python, Node.js …
- [`routing.md`](routing.md) — understand auto routing, load balancing, failover
- [`chat-ui.md`](chat-ui.md) — use the built-in Chat UI
- [`configuration.md`](configuration.md) — configure host, port, auth token
- [`api-reference.md`](api-reference.md) — full API endpoint reference
