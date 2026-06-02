#!/bin/bash
# Hoppscotch 端口检测 + Nginx 自动修复脚本
# 解决 Vite 重启后端口漂移导致 Nginx 502 的问题

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NGINX_CONFIG="/etc/nginx/sites-enabled/hoppscotch"

echo "=== 端口检测 + Nginx 修复 ==="
echo ""

# 读取当前 nginx 配置中的 proxy_pass 目标端口
get_nginx_port() {
    local label=$1
    # 按顺序取第 N 个 proxy_pass
    case $label in
        frontend) grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONFIG" | sed -n '1p' ;;
        admin)    grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONFIG" | sed -n '2p' ;;
        backend)  grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONFIG" | sed -n '3p' ;;
    esac
}

# 检测实际监听端口 (通过 ss + 关键词匹配)
detect_actual_port() {
    local service=$1
    local fallback=$2
    local port
    port=$(ss -tlnp 2>/dev/null | grep "$service" | grep -oP ':\K[0-9]+(?=\s)' | head -1) || true
    echo "${port:-$fallback}"
}

# ─── 检测各服务实际端口 ─────────────────────────────────
FRONTEND_ACTUAL=$(detect_actual_port "selfhost-web" "3003")
ADMIN_ACTUAL=$(detect_actual_port "sh-admin" "3101")
BACKEND_ACTUAL=$(detect_actual_port "hoppscotch-backend" "3170")

# 如果关键词匹配失败，用 curl 探测常见端口
if [ "$FRONTEND_ACTUAL" = "3003" ] && ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3003/ 2>/dev/null; then
    for p in 3004 3005 3006; do
        if curl -s -o /dev/null --max-time 2 http://127.0.0.1:$p/ 2>/dev/null; then
            FRONTEND_ACTUAL=$p
            break
        fi
    done
fi

if [ "$ADMIN_ACTUAL" = "3101" ] && ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3101/ 2>/dev/null; then
    for p in 3102 3103 3104; do
        if curl -s -o /dev/null --max-time 2 http://127.0.0.1:$p/ 2>/dev/null; then
            ADMIN_ACTUAL=$p
            break
        fi
    done
fi

echo "检测到实际端口:"
echo "  前端:   $FRONTEND_ACTUAL"
echo "  管理端: $ADMIN_ACTUAL"
echo "  后端:   $BACKEND_ACTUAL"
echo ""

# ─── 读取 Nginx 当前配置 ─────────────────────────────────
NGINX_FRONTEND=$(get_nginx_port frontend)
NGINX_ADMIN=$(get_nginx_port admin)
NGINX_BACKEND=$(get_nginx_port backend)

echo "Nginx 当前 proxy_pass:"
echo "  35051 → $NGINX_FRONTEND"
echo "  35050 → $NGINX_ADMIN"
echo "  35052 → $NGINX_BACKEND"
echo ""

# ─── 比对并修复 ─────────────────────────────────────────
NEEDS_FIX=false
FIXES=""

if [ "$NGINX_FRONTEND" != "$FRONTEND_ACTUAL" ]; then
    echo -e "${YELLOW}⚠ 前端端口漂移: Nginx=$NGINX_FRONTEND → 实际=$FRONTEND_ACTUAL${NC}"
    NEEDS_FIX=true
    FIXES="$FIXES s|proxy_pass http://127.0.0.1:$NGINX_FRONTEND;|proxy_pass http://127.0.0.1:$FRONTEND_ACTUAL;|;"
fi

if [ "$NGINX_ADMIN" != "$ADMIN_ACTUAL" ]; then
    echo -e "${YELLOW}⚠ 管理端端口漂移: Nginx=$NGINX_ADMIN → 实际=$ADMIN_ACTUAL${NC}"
    NEEDS_FIX=true
    FIXES="$FIXES s|proxy_pass http://127.0.0.1:$NGINX_ADMIN;|proxy_pass http://127.0.0.1:$ADMIN_ACTUAL;|;"
fi

if [ "$NGINX_BACKEND" != "$BACKEND_ACTUAL" ]; then
    echo -e "${YELLOW}⚠ 后端端口漂移: Nginx=$NGINX_BACKEND → 实际=$BACKEND_ACTUAL${NC}"
    NEEDS_FIX=true
    FIXES="$FIXES s|proxy_pass http://127.0.0.1:$NGINX_BACKEND;|proxy_pass http://127.0.0.1:$BACKEND_ACTUAL;|;"
fi

if [ "$NEEDS_FIX" = false ]; then
    echo -e "${GREEN}✓ 所有端口配置一致，无需修复${NC}"
else
    echo ""
    echo "修复 Nginx 配置..."
    sudo cp "$NGINX_CONFIG" "$NGINX_CONFIG.bak.$(date +%s)"
    echo "$FIXES" | tr ';' '\n' | while read -r fix; do
        [ -z "$fix" ] && continue
        sudo sed -i "$fix" "$NGINX_CONFIG"
    done

    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload 2>/dev/null
        echo -e "${GREEN}✓ Nginx 已修复并重新加载${NC}"
    else
        echo -e "${RED}✗ Nginx 配置测试失败，已回滚${NC}"
        sudo cp "$NGINX_CONFIG.bak."* "$NGINX_CONFIG" 2>/dev/null
        exit 1
    fi
fi

# ─── 最终健康检查 ─────────────────────────────────────────
echo ""
echo "=== 健康检查 ==="
ALL_OK=true
for port_pair in "3003:前端" "3101:管理端" "3170:后端" "35051:公网前端" "35050:公网管理端" "35052:公网后端"; do
    port="${port_pair%%:*}"
    label="${port_pair##*:}"
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null || true)
    status="${status:-000}"
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
        echo -e "  ${GREEN}✓${NC} $label :$port → HTTP $status"
    else
        echo -e "  ${RED}✗${NC} $label :$port → HTTP $status"
        ALL_OK=false
    fi
done

echo ""
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}=== 所有服务正常 ===${NC}"
else
    echo -e "${YELLOW}=== 部分服务异常，请检查 ===${NC}"
fi
