# Configuration

Skylark Router is configured via `config.yaml` (created automatically on first run) and can be overridden by environment variables.

**Priority:** environment variables > config file > built-in defaults

---

## config.yaml

```yaml
# Bind address
# 0.0.0.0 = all network interfaces (accessible from other machines)
# 127.0.0.1 = localhost only (recommended for personal use)
host: "0.0.0.0"

# HTTP listen port
port: "16898"

# SQLite database path (relative to binary, or absolute)
db_path: "skylark-router.db"

# Admin token for the management dashboard
# Leave empty to disable authentication (fine for local-only use)
auth_token: ""

# Default model when a request omits the "model" field
# "auto" = select highest-priority enabled model automatically
# "" = return error if model is missing
default_model: ""

# Log full request and response bodies to the database
# Useful for debugging; disable in production to save space
log_requests: false

# Web search provider (optional)
# Supported: "searxng", "bing", "google"
search_provider: ""
search_api_key: ""
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `16898` | Listen port |
| `DB_PATH` | `skylark-router.db` | SQLite database path |
| `AUTH_TOKEN` | _(none)_ | Admin dashboard token |
| `DEFAULT_MODEL` | _(none)_ | Default model for requests without a model field |
| `LOG_REQUESTS` | `false` | Enable request body logging |

---

## Admin authentication

Set `auth_token` (or `AUTH_TOKEN`) to any secret string. The management dashboard (Providers, Models, API Keys, etc.) will require this token.

The token is sent as a `Bearer` token in the `Authorization` header. The UI stores it in localStorage after you log in.

**API proxy endpoints** (`/v1/...`) use a separate API key system — see [api-reference.md](api-reference.md).

---

## Desktop app

In desktop (Tauri) mode, the backend starts on a random available port. Configuration is managed entirely through the **Settings** panel in the UI. There is no `config.yaml` file to edit manually.

Data is stored in:
- **macOS**: `~/Library/Application Support/com.skylarkrouter.desktop/`

---

## Docker

```yaml
# docker-compose.yml (excerpt)
services:
  skylark-router:
    image: skylark-router
    ports:
      - "16898:16898"
    environment:
      AUTH_TOKEN: "your-secret-token"
      LOG_REQUESTS: "false"
    volumes:
      - ./data:/data
    command: ["./skylark-router", "-db", "/data/skylark-router.db"]
```

Run:
```bash
docker compose up -d
docker compose logs -f
```
