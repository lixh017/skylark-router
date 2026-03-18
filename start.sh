#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# Check dependencies
command -v go >/dev/null 2>&1 || { echo -e "${RED}Go is not installed${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is not installed${NC}"; exit 1; }

# Install frontend deps if needed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR" && npm install
fi

# Start backend
echo -e "${GREEN}Starting backend on :8080 ...${NC}"
cd "$BACKEND_DIR" && go run main.go &
BACKEND_PID=$!

# Wait for backend
for i in $(seq 1 30); do
    if curl -s http://localhost:8080/api/providers >/dev/null 2>&1; then
        echo -e "${GREEN}Backend ready.${NC}"
        break
    fi
    sleep 0.5
done

# Start frontend
echo -e "${GREEN}Starting frontend on :5173 ...${NC}"
cd "$FRONTEND_DIR" && npx vite --port 5173 &
FRONTEND_PID=$!

# Wait for frontend
for i in $(seq 1 30); do
    if curl -s http://localhost:5173/ >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Skylark Router is running!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Dashboard:   ${YELLOW}http://localhost:5173${NC}"
echo -e "  OpenAI API:  ${YELLOW}http://localhost:8080/v1/chat/completions${NC}"
echo -e "  Anthropic:   ${YELLOW}http://localhost:8080/v1/messages${NC}"
echo -e "  Models:      ${YELLOW}http://localhost:8080/v1/models${NC}"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop."
echo ""

wait
