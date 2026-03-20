# API Reference

Skylark Router exposes two sets of endpoints:

- **Proxy endpoints** (`/v1/...`) — the LLM API your apps call, protected by API Key auth
- **Admin endpoints** (`/api/...`) — management API, protected by admin token

---

## Authentication

### Proxy endpoints (`/v1/...`)

If API keys are configured, include one in the request:

```
Authorization: Bearer sk-your-api-key
```

Or use the `x-api-key` header (Anthropic style):

```
x-api-key: sk-your-api-key
```

If no API keys exist in the database, all proxy requests are allowed without auth.

### Admin endpoints (`/api/...`)

Include the admin token:

```
Authorization: Bearer your-admin-token
```

If `auth_token` is empty, no token is required.

---

## Proxy endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completion. Streaming supported.

**Request:**
```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048,
  "top_p": 1.0,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

**Special model values:**

| Value | Behavior |
|-------|----------|
| `"auto"` | Router selects highest-priority healthy route |
| `""` (empty) | Uses `default_model` from config, falls back to `auto` |
| `"gpt-4o"` | Routes to all mappings named `gpt-4o` with failover/LB |

**Multimodal content:**
```json
{
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "What's in this image?"},
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
    ]
  }]
}
```

---

### POST /v1/messages

Anthropic-compatible Messages API. Streaming supported.

```
anthropic-version: 2023-06-01
```

**Request:**
```json
{
  "model": "claude-3-7-sonnet-20250219",
  "max_tokens": 4096,
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "You are helpful.",
  "stream": true
}
```

Extended thinking:
```json
{
  "thinking": {"type": "enabled", "budget_tokens": 10000}
}
```

Disable thinking:
```json
{
  "thinking": {"type": "disabled"}
}
```

---

### POST /v1/images/generations

Image generation (passed through to provider).

---

### POST /v1/embeddings

Embeddings (passed through to provider).

---

### GET /v1/models

List all enabled model names.

```json
["gpt-4o", "claude-3-7-sonnet", "auto"]
```

---

### GET /api/version

Returns version info. Public endpoint, no auth required.

```json
{
  "version": "v1.0.0",
  "git_commit": "abc1234",
  "build_time": "2025-01-01T00:00:00Z"
}
```

---

## Admin endpoints

All require `Authorization: Bearer <admin-token>`.

### Providers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/providers` | List all providers |
| `GET` | `/api/providers/:id` | Get provider by ID |
| `POST` | `/api/providers` | Create provider |
| `PUT` | `/api/providers/:id` | Update provider |
| `DELETE` | `/api/providers/:id` | Delete provider |
| `POST` | `/api/providers/:id/test` | Test provider connectivity |

### Models

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/models` | List all model mappings |
| `GET` | `/api/models/:id` | Get model mapping by ID |
| `POST` | `/api/models` | Create model mapping |
| `PUT` | `/api/models/:id` | Update model mapping |
| `DELETE` | `/api/models/:id` | Delete model mapping |

### API Keys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/keys` | List all API keys (suffix only) |
| `POST` | `/api/keys` | Create key (returns full key once) |
| `GET` | `/api/keys/:id/reveal` | Get full key value |
| `PUT` | `/api/keys/:id` | Update name / rate limit / quota |
| `DELETE` | `/api/keys/:id` | Delete key |
| `POST` | `/api/keys/:id/reset-quota` | Reset used quota to 0 |

### Statistics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Aggregate stats (requests, cost, latency) |
| `GET` | `/api/stats/timeseries` | Time-series stats |

Query parameters: `since=2025-01-01T00:00:00Z`, `interval=1h`

### Request logs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/request-logs` | Paginated log list |
| `GET` | `/api/request-logs/:id` | Single log with request/response body |
| `DELETE` | `/api/request-logs` | Delete logs before a date (`?before=...`) |

Query parameters for list: `model`, `since`, `page`, `limit`

### Config

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Get current config |
| `PUT` | `/api/config` | Update config (may require restart) |

### Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search?q=...` | Proxy web search request |

---

## Rate limiting & quota errors

When a key exceeds its rate limit:
```json
HTTP 429
{"error": "rate limit exceeded"}
```

When a key exceeds its token quota:
```json
HTTP 429
{"error": "quota exceeded"}
```
