.PHONY: build run docker-build docker-buildx docker-run docker-stop release clean \
        tauri-sidecar tauri-dev tauri-build tauri-build-dmg tauri-build-universal-dmg

VERSION  ?= dev
GIT_COMMIT = $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_TIME = $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS   = -X skylark-router/version.Version=$(VERSION) \
            -X skylark-router/version.GitCommit=$(GIT_COMMIT) \
            -X skylark-router/version.BuildTime=$(BUILD_TIME)

# Rust target triple for the current machine (used as sidecar binary suffix).
RUST_TARGET   = $(shell rustc -vV 2>/dev/null | grep '^host:' | cut -d' ' -f2)
SIDECAR_DIR   = frontend/src-tauri/binaries

build:
	cd frontend && npm ci && npm run build
	rm -rf backend/static/assets backend/static/index.html
	cp -r frontend/dist/* backend/static/
	cd backend && CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o ../skylark-router .

run: build
	./skylark-router

dev:
	@echo "Start backend and frontend dev servers separately:"
	@echo "  cd backend && go run ."
	@echo "  cd frontend && npm run dev"

docker-build:
	docker build --build-arg VERSION=$(VERSION) --build-arg GIT_COMMIT=$(GIT_COMMIT) --build-arg BUILD_TIME=$(BUILD_TIME) -t skylark-router .

docker-buildx:
	docker buildx build --platform linux/amd64,linux/arm64 \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		-t skylark-router --push .

docker-run:
	docker compose up -d

docker-stop:
	docker compose down

release: clean
	cd frontend && npm ci && npm run build
	rm -rf backend/static/assets backend/static/index.html
	cp -r frontend/dist/* backend/static/
	@mkdir -p dist
	cd backend && CGO_ENABLED=0 GOOS=darwin  GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-darwin-amd64 .
	cd backend && CGO_ENABLED=0 GOOS=darwin  GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-darwin-arm64 .
	cd backend && CGO_ENABLED=0 GOOS=linux   GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-linux-amd64 .
	cd backend && CGO_ENABLED=0 GOOS=linux   GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-linux-arm64 .
	cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-windows-amd64.exe .
	cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o ../dist/skylark-router-windows-arm64.exe .
	@echo "Release binaries in dist/ ($(VERSION) @ $(GIT_COMMIT))"
	@ls -lh dist/

clean:
	rm -rf skylark-router dist backend/static/assets backend/static/index.html frontend/dist \
	       frontend/src-tauri/binaries/skylark-router-*

# ---------------------------------------------------------------------------
# Tauri desktop build targets
# ---------------------------------------------------------------------------

# Build the Go backend as a Tauri sidecar binary for the current machine.
# We build both macOS architectures so the correct one is always available
# regardless of whether Tauri is running natively (arm64) or via Rosetta (x86_64).
tauri-sidecar:
	@echo "Building Go sidecar binaries for macOS (amd64 + arm64)…"
	@mkdir -p $(SIDECAR_DIR)
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" \
	    -o ../$(SIDECAR_DIR)/skylark-router-x86_64-apple-darwin .
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" \
	    -o ../$(SIDECAR_DIR)/skylark-router-aarch64-apple-darwin .
	@echo "  → $(SIDECAR_DIR)/skylark-router-x86_64-apple-darwin"
	@echo "  → $(SIDECAR_DIR)/skylark-router-aarch64-apple-darwin"

# Run Tauri in dev mode (hot-reload frontend + sidecar backend).
tauri-dev: tauri-sidecar
	cd frontend && npm install && npm run tauri:dev

# Build the desktop app bundle for the current platform.
tauri-build: tauri-sidecar
	cd frontend && npm install && npm run tauri:build

# macOS: build a .dmg for the current architecture.
tauri-build-dmg: tauri-sidecar
	cd frontend && npm install && npm run tauri:build:mac:dmg

# macOS: build a universal (arm64 + x86_64) .dmg.
tauri-build-universal-dmg:
	@echo "Building universal macOS sidecar binaries…"
	@mkdir -p $(SIDECAR_DIR)
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" \
	    -o ../$(SIDECAR_DIR)/skylark-router-x86_64-apple-darwin .
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" \
	    -o ../$(SIDECAR_DIR)/skylark-router-aarch64-apple-darwin .
	cd frontend && npm install && npm run tauri:build:mac:universal:dmg
