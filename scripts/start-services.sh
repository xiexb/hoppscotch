#!/bin/bash
# Hoppscotch 服务启动脚本
# 包含端口漂移检测和 Nginx 自动修复

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Hoppscotch 服务启动脚本 ==="
echo ""

# 检查 pnpm 是否在 PATH 中
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found, adding to PATH...${NC}"
    export PATH="/home/jcwl/.hermes/node/bin:$PATH"
fi

# 1. 清理旧进程
echo -e "${YELLOW}[1/6] 清理旧进程...${NC}"
pkill -f "hoppscotch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# 确认端口已释放
echo "确认端口已释放..."
if lsof -i :3170 -i :3003 -i :3101 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}错误: 端口仍被占用${NC}"
    lsof -i :3170 -i :3003 -i :3101 2>/dev/null | grep LISTEN
    exit 1
fi
echo -e "${GREEN}✓ 端口已释放${NC}"

# 2. 构建后端
echo ""
echo -e "${YELLOW}[2/6] 构建后端...${NC}"
cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-backend
pnpm run build > /dev/null 2>&1
echo -e "${GREEN}✓ 后端构建完成${NC}"

# 3. 启动服务
echo ""
echo -e "${YELLOW}[3/6] 启动服务...${NC}"

# 后端
cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-backend
export $(grep -v '^#' ../../.env | xargs)
nohup node dist/src/main.js > /tmp/hoppscotch-backend.log 2>&1 &
BACKEND_PID=$!
echo "后端启动中 (PID: $BACKEND_PID)..."

# 前端
cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-selfhost-web
nohup pnpm run dev > /tmp/hoppscotch-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端启动中 (PID: $FRONTEND_PID)..."

# 管理端
cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-sh-admin
nohup pnpm run dev > /tmp/hoppscotch-admin.log 2>&1 &
ADMIN_PID=$!
echo "管理端启动中 (PID: $ADMIN_PID)..."

# 4. 等待服务启动
echo ""
echo -e "${YELLOW}[4/6] 等待服务启动...${NC}"
sleep 15

# 5. 检测实际端口
echo ""
echo -e "${YELLOW}[5/6] 检测实际端口...${NC}"

detect_port() {
    local service_name=$1
    local default_port=$2
    
    # 使用 ss 获取实际监听端口
    actual_port=$(ss -tlnp 2>/dev/null | grep "node.*$service_name" | grep -oP ':\K[0-9]+' | head -1)
    
    if [ -z "$actual_port" ]; then
        # 如果 grep 没找到，尝试其他方式
        if curl -s -o /dev/null -w "" http://127.0.0.1:$default_port/ 2>/dev/null; then
            actual_port=$default_port
        fi
    fi
    
    echo "${actual_port:-$default_port}"
}

# 检测各服务实际端口
FRONTEND_PORT=$(ss -tlnp | grep "node.*selfhost" | grep -oP ':\K[0-9]+' | head -1 || echo "3003")
ADMIN_PORT=$(ss -tlnp | grep "node.*sh-admin" | grep -oP ':\K[0-9]+' | head -1 || echo "3101")
BACKEND_PORT=$(ss -tlnp | grep "node.*backend" | grep -oP ':\K[0-9]+' | head -1 || echo "3170")

# 如果检测失败，使用默认值
FRONTEND_PORT=${FRONTEND_PORT:-3003}
ADMIN_PORT=${ADMIN_PORT:-3101}
BACKEND_PORT=${BACKEND_PORT:-3170}

echo "前端实际端口: $FRONTEND_PORT"
echo "管理端实际端口: $ADMIN_PORT"
echo "后端实际端口: $BACKEND_PORT"

# 6. 检查并修复 Nginx
echo ""
echo -e "${YELLOW}[6/6] 检查 Nginx 配置...${NC}"

NGINX_CONFIG="/etc/nginx/sites-enabled/hoppscotch"
NEEDS_FIX=false

# 检查前端端口
if grep -q "proxy_pass http://127.0.0.1:$FRONTEND_PORT;" "$NGINX_CONFIG"; then
    echo -e "${GREEN}✓ 前端端口配置正确 (35051 → $FRONTEND_PORT)${NC}"
else
    echo -e "${YELLOW}⚠ 前端端口需要修复${NC}"
    NEEDS_FIX=true
fi

# 检查管理端端口
if grep -q "proxy_pass http://127.0.0.1:$ADMIN_PORT;" "$NGINX_CONFIG"; then
    echo -e "${GREEN}✓ 管理端端口配置正确 (35050 → $ADMIN_PORT)${NC}"
else
    echo -e "${YELLOW}⚠ 管理端端口需要修复${NC}"
    NEEDS_FIX=true
fi

# 检查后端端口
if grep -q "proxy_pass http://127.0.0.1:$BACKEND_PORT;" "$NGINX_CONFIG"; then
    echo -e "${GREEN}✓ 后端端口配置正确 (35052 → $BACKEND_PORT)${NC}"
else
    echo -e "${YELLOW}⚠ 后端端口需要修复${NC}"
    NEEDS_FIX=true
fi

# 修复 Nginx 配置
if [ "$NEEDS_FIX" = true ]; then
    echo ""
    echo "修复 Nginx 配置..."
    
    # 备份原配置
    sudo cp "$NGINX_CONFIG" "$NGINX_CONFIG.bak.$(date +%s)"
    
    # 更新端口
    sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;.*# Frontend|proxy_pass http://127.0.0.1:$FRONTEND_PORT; # Frontend|" "$NGINX_CONFIG"
    sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;.*# Admin|proxy_pass http://127.0.0.1:$ADMIN_PORT; # Admin|" "$NGINX_CONFIG"
    sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;.*# Backend|proxy_pass http://127.0.0.1:$BACKEND_PORT; # Backend|" "$NGINX_CONFIG"
    
    # 测试配置
    if sudo nginx -t > /dev/null 2>&1; then
        sudo nginx -s reload
        echo -e "${GREEN}✓ Nginx 已重新加载${NC}"
    else
        echo -e "${RED}✗ Nginx 配置测试失败${NC}"
        exit 1
    fi
fi

# 最终健康检查
echo ""
echo "=== 最终健康检查 ==="
for port in 3003 3101 3170; do
    status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
        echo -e "${GREEN}✓ 端口 $port: HTTP $status${NC}"
    else
        echo -e "${RED}✗ 端口 $port: HTTP $status${NC}"
    fi
done

# 公网访问检查
echo ""
echo "=== 公网访问检查 ==="
for port in 35051 35050 35052; do
    status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
        echo -e "${GREEN}✓ 公网端口 $port: HTTP $status${NC}"
    else
        echo -e "${RED}✗ 公网端口 $port: HTTP $status${NC}"
    fi
done

echo ""
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo "前端: http://127.0.0.1:3003/ 或 http://121.41.26.6:35051/"
echo "管理端: http://127.0.0.1:3101/ 或 http://121.41.26.6:35050/"
echo "后端: http://127.0.0.1:3170/ 或 http://121.41.26.6:35052/"
