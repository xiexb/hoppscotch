#!/usr/bin/env bash
# Restart all Hoppscotch services (backend + 2 frontends)
# Usage: bash restart-all.sh [project-dir]
# Prerequisites: pnpm and node in PATH

set -euo pipefail

PROJECT_DIR="${1:-/home/jcwl/workspace/hoppscotch}"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

export PATH="$HOME/.hermes/node/bin:$PATH"

echo "=== Killing old processes ==="
pkill -f 'hoppscotch-selfhost-web.*dev' 2>/dev/null || true
pkill -f 'hoppscotch-sh-admin.*dev' 2>/dev/null || true
# Kill backend by port
fuser -k 3170/tcp 2>/dev/null || true
sleep 2

# Verify ports are free
for port in 3003 3101 3170; do
  if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
    echo "ERROR: Port $port still occupied!"
    lsof -i :$port 2>/dev/null | grep LISTEN
    exit 1
  fi
done
echo "Ports 3003/3101/3170 are free."

echo "=== Starting backend ==="
cd "$PROJECT_DIR/packages/hoppscotch-backend"

# Build if needed (dist/src/main.js may not exist after clean checkout)
if [ ! -f dist/src/main.js ]; then
  echo "No build found, running pnpm run build..."
  pnpm run build
fi

# Backend needs all env vars exported (doesn't read .env)
set -a; source "$PROJECT_DIR/.env"; set +a
node dist/src/main.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend health (max 30s)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3170/health -o /dev/null 2>/dev/null; then
    echo "Backend healthy (attempt $i)"
    break
  fi
  sleep 1
done

# If backend exited (first-run stopApp), restart it
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "Backend exited (likely first-run stopApp), restarting..."
  node dist/src/main.js > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3170/health -o /dev/null 2>/dev/null; then
      echo "Backend healthy after restart (attempt $i)"
      break
    fi
    sleep 1
  done
fi

echo "=== Starting frontend (selfhost-web) ==="
cd "$PROJECT_DIR/packages/hoppscotch-selfhost-web"
pnpm run dev > "$LOG_DIR/selfhost-web.log" 2>&1 &

echo "=== Starting admin (sh-admin) ==="
cd "$PROJECT_DIR/packages/hoppscotch-sh-admin"
pnpm run dev > "$LOG_DIR/sh-admin.log" 2>&1 &

echo "=== Waiting for frontends ==="
sleep 15

echo "=== Verification ==="
for port in 3170 3003 3101; do
  STATUS=$(curl -sf "http://127.0.0.1:$port" -o /dev/null -w '%{http_code}' --max-time 5 2>/dev/null || echo "FAIL")
  echo "Port $port: $STATUS"
done

echo "=== Done ==="
