#!/bin/bash
# Hoppscotch Dev Environment Check
# Usage: bash scripts/check-env.sh
# Run this before starting development or after git operations

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=== Hoppscotch Dev Environment Check ==="
echo ""

# 1. Check ports
echo "--- Port Check ---"
for port in 3170 3003 3101; do
  if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Port $port — running"
  else
    echo -e "${RED}✗${NC} Port $port — NOT running"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 2. Check backend health
echo "--- Backend Health ---"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3170/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}✓${NC} Backend health check: 200 OK"
else
  echo -e "${RED}✗${NC} Backend health check: HTTP $HEALTH (expected 200)"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Check frontend accessibility
echo "--- Frontend Check ---"
for port_name in "3003:selfhost-web" "3101:sh-admin"; do
  PORT="${port_name%%:*}"
  NAME="${port_name##*:}"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} $NAME (:$PORT): 200 OK"
  else
    echo -e "${RED}✗${NC} $NAME (:$PORT): HTTP $STATUS"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 4. Check .env file
echo "--- Config Check ---"
ENV_FILE="/home/jcwl/workspace/hoppscotch/.env"
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}✓${NC} .env file exists"
  
  # Check critical vars
  for var in DATABASE_URL DATA_ENCRYPTION_KEY VITE_BACKEND_GQL_URL VITE_BACKEND_API_URL; do
    if grep -q "^${var}=" "$ENV_FILE"; then
      echo -e "  ${GREEN}✓${NC} $var is set"
    else
      echo -e "  ${RED}✗${NC} $var is MISSING"
      ERRORS=$((ERRORS + 1))
    fi
  done
else
  echo -e "${RED}✗${NC} .env file not found at $ENV_FILE"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Check vite.config.ts ports
echo "--- Vite Config Check ---"
for pkg in hoppscotch-selfhost-web hoppscotch-sh-admin; do
  VITE_CONFIG="/home/jcwl/workspace/hoppscotch/packages/$pkg/vite.config.ts"
  if [ -f "$VITE_CONFIG" ]; then
    if grep -q "host:" "$VITE_CONFIG" && grep -q "0.0.0.0" "$VITE_CONFIG"; then
      echo -e "${GREEN}✓${NC} $pkg: host 0.0.0.0 configured"
    else
      echo -e "${YELLOW}⚠${NC} $pkg: missing host 0.0.0.0 (nginx proxy may fail)"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${YELLOW}⚠${NC} $pkg: vite.config.ts not found"
    WARNINGS=$((WARNINGS + 1))
  fi
done
echo ""

# 6. Check node_modules
echo "--- Dependencies Check ---"
if [ -d "/home/jcwl/workspace/hoppscotch/node_modules" ]; then
  echo -e "${GREEN}✓${NC} node_modules exists"
else
  echo -e "${RED}✗${NC} node_modules missing — run pnpm install"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. Check PostgreSQL
echo "--- Database Check ---"
if PGPASSWORD=postgres psql -U postgres -d hoppscotch -h 127.0.0.1 -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL hoppscotch database accessible"
else
  echo -e "${RED}✗${NC} Cannot connect to PostgreSQL hoppscotch database"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "=== Summary ==="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}All checks passed! Ready for development.${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}Passed with $WARNINGS warning(s). Review above.${NC}"
  exit 0
else
  echo -e "${RED}Failed with $ERRORS error(s) and $WARNINGS warning(s). Fix errors before proceeding.${NC}"
  exit 1
fi
