# Routing

This document explains how Skylark Router selects which provider to send a request to.

---

## Concepts

### Provider

A provider is a connection to an LLM API — OpenAI, Anthropic, DeepSeek, a local Ollama instance, etc. Each provider has:

- **Base URL** — the API endpoint
- **API Key** — credentials for that provider
- **Protocol** — `openai` (most providers) or `anthropic`
- **Enabled** flag — disable without deleting

### Model mapping (route)

A model mapping links an **external model name** (what your apps send) to a **provider + model name** (what the provider actually receives).

```
External name: "gpt-4o"
    → Provider: openai  (https://api.openai.com/v1)
    → Provider model: gpt-4o-2024-08-06
```

Multiple mappings can share the same external name. This is how failover and load balancing work.

---

## Route selection algorithm

When a request arrives for model `X`:

1. Collect all enabled mappings for model `X` from enabled providers.
2. Filter by **capability** — if the request contains images/audio/video, only routes with the matching `input_image` / `input_audio` / `input_video` flag are considered.
3. Group by **priority** — pick the group with the highest priority number.
4. Within that group, select a route by **weighted random** sampling (weight proportional to each route's weight field).
5. Send the request. On failure, retry with the next available route in the same group (failover). If all routes in the group fail, try the next priority group.

---

## Auto routing (`model: "auto"` or empty)

When the request model field is `"auto"` or empty, the router picks the **highest-priority enabled model** across all mappings. This is the default in the Chat UI.

To set a default model for API clients that always omit the field, configure `default_model` in Settings (or the `DEFAULT_MODEL` env var).

---

## Load balancing example

Three providers for `claude-3-7-sonnet`, all Priority 0:

| Route | Provider | Weight |
|-------|----------|--------|
| 1 | Anthropic direct | 3 |
| 2 | SiliconFlow proxy | 1 |

Traffic distribution: ~75% to Anthropic, ~25% to SiliconFlow.

---

## Failover example

Two providers for `gpt-4o`:

| Route | Provider | Priority |
|-------|----------|----------|
| Primary | OpenAI | 10 |
| Fallback | Azure OpenAI | 5 |

All requests go to OpenAI (Priority 10). If OpenAI returns an error, the router automatically retries with Azure OpenAI (Priority 5) within the same request — the client sees a single response with no interruption.

---

## Capability flags

Each model mapping has capability flags that tell the router what the route can handle:

| Flag | Meaning |
|------|---------|
| `input_image` | Accepts image attachments |
| `input_audio` | Accepts audio attachments |
| `input_video` | Accepts video attachments |
| `input_text` | Accepts text (default true) |
| `output_text` | Returns text |
| `function_call` | Supports tool/function calling |
| `reasoning` | Has extended reasoning / thinking |

The router uses these flags to filter routes when a request contains multimodal content.

---

## Protocol conversion

When a request arrives in **OpenAI format** but is routed to an **Anthropic** provider, the router automatically converts:

- Message format (`messages` array → Anthropic `messages` + `system`)
- Content parts (image_url → Anthropic image block, input_audio → document block, etc.)
- Parameters (`max_tokens` default: 4096 when not specified — Anthropic requires this field)
- Streaming events (Anthropic SSE → OpenAI SSE delta format)

Your app always talks OpenAI format; the router handles the translation.
