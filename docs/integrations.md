# Client Integrations

How to point popular AI tools at Skylark Router.

**Prerequisites:** Router is running at `http://localhost:16898` with at least one provider and model configured.

> **API Key**: If you have created API keys in the **API Keys** tab, use one of them below. If no keys exist, any non-empty string works.

---

## Cursor

1. Open **Cursor Settings** (`⌘,` or `Ctrl+,`) → **Models**
2. Scroll to the bottom → **Add Model** → enter your model name (e.g. `gpt-4o`, must match what you configured in the Router's Models tab)
3. Toggle **Override OpenAI Base URL** → set:
   ```
   http://localhost:16898/v1
   ```
4. Set **API Key** to your router key (or any string if no keys are configured)
5. Click **Verify** — you should see a green checkmark

> **Tip:** Add multiple model names matching your router's model mappings. Cursor will list them all in the model picker.

---

## Claude Code

Claude Code reads `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` from the environment.

### Option A — environment variables (per session)

```bash
export ANTHROPIC_BASE_URL=http://localhost:16898
export ANTHROPIC_API_KEY=sk-your-router-key
claude
```

### Option B — persistent config

```bash
claude config set --global apiUrl http://localhost:16898
```

Then set the API key when prompted, or:

```bash
ANTHROPIC_API_KEY=sk-your-router-key claude
```

### Option C — `.env` in project root

```bash
# .env
ANTHROPIC_BASE_URL=http://localhost:16898
ANTHROPIC_API_KEY=sk-your-router-key
```

> **Model routing:** Configure a model named `claude-sonnet-4-5` (or whichever Claude model Claude Code requests) in the Router's Models tab, pointing it at your Anthropic provider or any compatible backend.

---

## OpenAI Codex CLI

```bash
export OPENAI_API_KEY=sk-your-router-key
export OPENAI_BASE_URL=http://localhost:16898/v1
codex
```

Or inline:

```bash
OPENAI_API_KEY=sk-key OPENAI_BASE_URL=http://localhost:16898/v1 codex "refactor this function"
```

---

## Trae IDE

1. Open **Settings** (`⌘,`) → **AI** → **AI Service**
2. Select **Custom** (or OpenAI-compatible)
3. Fill in:
   | Field | Value |
   |-------|-------|
   | API Base URL | `http://localhost:16898/v1` |
   | API Key | your router key |
   | Model | model name from your router |
4. Click **Test Connection** to verify

---

## OpenClaw

[OpenClaw](https://docs.openclaw.ai/) is a self-hosted AI coding agent gateway. Configure a custom provider pointing at Skylark Router in `~/.openclaw/openclaw.json`:

```json5
{
  agents: {
    defaults: {
      // Reference format: "provider/model-name"
      model: { primary: "skylark/gpt-4o" },
      // Optional fallback chain
      // model: { primary: "skylark/gpt-4o", fallbacks: ["skylark/claude-sonnet-4-5"] },
      models: {
        "skylark/gpt-4o":          { alias: "GPT-4o via Skylark" },
        "skylark/claude-sonnet-4-5": { alias: "Claude via Skylark" },
      },
    },
  },
  models: {
    providers: {
      skylark: {
        baseUrl: "http://localhost:16898/v1",
        apiKey: "sk-your-router-key",
      },
    },
  },
}
```

> **Multi-model failover:** Skylark Router already handles failover internally, so a single model mapping is usually enough. Use OpenClaw's `fallbacks` only if you want application-level fallback across different external model names.

---

## Continue (VS Code / JetBrains extension)

Edit `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "Skylark Router — GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiBase": "http://localhost:16898/v1",
      "apiKey": "sk-your-router-key"
    },
    {
      "title": "Skylark Router — Claude",
      "provider": "anthropic",
      "model": "claude-sonnet-4-5",
      "apiBase": "http://localhost:16898",
      "apiKey": "sk-your-router-key"
    }
  ]
}
```

Restart VS Code after saving.

---

## OpenCat (macOS)

1. Open **Preferences** → **API**
2. Set **API Host** to `http://localhost:16898`
3. Set **API Key** to your router key
4. Under **Models**, add the model names you configured in the router

---

## LobeChat

1. **Settings** → **Language Model** → **OpenAI**
2. Set **API Endpoint** to `http://localhost:16898/v1`
3. Set **API Key** to your router key
4. Under **Model List**, click **+** and add your model names

For self-hosted LobeChat, set these environment variables:

```bash
OPENAI_API_KEY=sk-your-router-key
OPENAI_PROXY_URL=http://localhost:16898/v1
```

---

## Open WebUI

1. **Admin Panel** → **Settings** → **Connections**
2. Under **OpenAI API**:
   - **URL**: `http://localhost:16898/v1`
   - **Key**: your router key
3. Click **Save** → the router's model list will auto-populate

---

## Cline (VS Code extension)

1. Open Cline settings in the VS Code sidebar
2. **API Provider** → select **OpenAI Compatible**
3. Fill in:
   | Field | Value |
   |-------|-------|
   | Base URL | `http://localhost:16898/v1` |
   | API Key | your router key |
   | Model ID | model name from your router |

---

## Python (openai SDK)

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

Streaming:

```python
with client.chat.completions.stream(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a poem"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

---

## Node.js (openai SDK)

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:16898/v1",
  apiKey: "sk-your-router-key",
});

const stream = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

---

## LangChain (Python)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    openai_api_base="http://localhost:16898/v1",
    openai_api_key="sk-your-router-key",
)

result = llm.invoke("Explain quantum computing in one paragraph")
print(result.content)
```

---

## cURL

```bash
curl http://localhost:16898/v1/chat/completions \
  -H "Authorization: Bearer sk-your-router-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

---

## Remote access

If Skylark Router is running on a home server or NAS and you want to connect from another machine, replace `localhost` with the server's IP or hostname:

```
http://192.168.1.100:16898/v1
```

Make sure `host: "0.0.0.0"` is set in `config.yaml` (the default) and the port is accessible on your network.

For external (internet) access, use a reverse proxy (Nginx / Caddy) with HTTPS, and set a strong `auth_token`.
