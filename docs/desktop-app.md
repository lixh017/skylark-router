# Desktop App

Skylark Router ships as a native macOS desktop application built with [Tauri](https://tauri.app). The app bundles the Go backend as a sidecar process — no terminal, no separate server, just open and use.

---

## Requirements

| Tool | Version |
|------|---------|
| macOS | 12 Monterey or later |
| Xcode Command Line Tools | `xcode-select --install` |
| Rust | 1.77+ — install via `rustup` |
| Node.js | 18+ |
| Go | 1.22+ |

Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## Dev mode (hot reload)

```bash
make tauri-dev
```

This:
1. Builds the Go backend as a platform sidecar binary
2. Starts the Vite dev server for the frontend
3. Opens the Tauri window pointing at the dev server

Changes to the frontend are reflected live. Backend changes require re-running `make tauri-sidecar`.

---

## Build for distribution

### Current architecture .dmg

```bash
make tauri-build-dmg
```

Output: `frontend/src-tauri/target/release/bundle/dmg/Skylark Router_*.dmg`

### Universal binary .dmg (arm64 + x86_64)

```bash
make tauri-build-universal-dmg
```

This builds Go sidecar binaries for both architectures, then tells Tauri to produce a universal bundle. The resulting `.dmg` runs natively on both Intel and Apple Silicon Macs without Rosetta.

---

## How it works

```
┌─────────────────────────────────┐
│     Skylark Router.app          │
│                                 │
│  ┌──────────────────────────┐  │
│  │   Tauri WebView (UI)     │  │
│  │   React + TypeScript     │  │
│  └──────────┬───────────────┘  │
│             │ http://127.0.0.1:PORT │
│  ┌──────────▼───────────────┐  │
│  │   Go sidecar (backend)   │  │
│  │   SQLite · REST API      │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

- The Go backend starts as a sidecar on a random available port.
- The Tauri frontend calls `get_backend_port` to discover the port, then routes all API calls to `http://127.0.0.1:PORT`.
- Data (config, database) is stored in the macOS Application Support directory: `~/Library/Application Support/com.skylarkrouter.desktop/`.

---

## Data location

| Item | Path |
|------|------|
| SQLite database | `~/Library/Application Support/com.skylarkrouter.desktop/skylark-router.db` |
| Config | Managed via the Settings panel in the UI |

---

## Troubleshooting

**App opens but shows a blank screen**

The sidecar may have failed to start. Check Console.app for logs from `skylark-router`.

**Port conflict on startup**

The backend picks a random available port automatically. No manual port configuration is needed in desktop mode.

**Rebuilding after backend changes**

```bash
make tauri-sidecar   # rebuild Go sidecar only
# Then restart tauri-dev
```

**Code signing / Gatekeeper**

For distribution outside the App Store, sign with your Apple Developer ID:
```bash
# Set env vars before building
export APPLE_CERTIFICATE="Developer ID Application: ..."
export APPLE_CERTIFICATE_PASSWORD="..."
make tauri-build-dmg
```

See [Tauri code signing docs](https://tauri.app/distribute/sign/macos/) for full details.
