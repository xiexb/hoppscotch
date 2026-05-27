# Hoppscotch Project — Agent Context

> 此文件供 Hermes multi-agent 系统（builder/researcher/reviewer）在任务启动时读取。

## 项目概况

- **项目**: Hoppscotch — 开源 API 开发生态系统 (REST, GraphQL, WebSocket, SSE, Socket.IO, MQTT)
- **仓库**: GitHub `xiexb/hoppscotch`, 分支 `dev`
- **技术栈**: Vue 3 + TypeScript, pnpm monorepo, NestJS (后端), Prisma ORM, PostgreSQL
- **项目路径**: `/home/jcwl/workspace/hoppscotch`

## 包结构

```
packages/
├── hoppscotch-common/       # 核心 UI + 业务逻辑 (Vue 组件, services, platform defs)
├── hoppscotch-data/         # 数据模型 (verzod 版本化 schemas)
├── hoppscotch-kernel/       # 跨平台请求引擎 (Relay, IO, Store, Log)
├── hoppscotch-backend/      # NestJS 后端 (GraphQL + REST, Prisma, PostgreSQL)
├── hoppscotch-selfhost-web/ # 自托管前端 shell (Vite, 端口 3003)
├── hoppscotch-sh-admin/     # 管理后台 shell (Vite, 端口 3101)
├── hoppscotch-relay/        # 代理中继服务
├── hoppscotch-agent/        # 桌面 agent (系统托盘, 原生拦截器)
├── hoppscotch-desktop/      # Tauri 桌面应用
├── hoppscotch-cli/          # CI/CD 测试 CLI
└── hoppscotch-js-sandbox/   # JS 沙箱 (pre-request/test scripts)
```

## 常用命令

```bash
cd /home/jcwl/workspace/hoppscotch

# 开发
pnpm install                          # 安装依赖
cd packages/hoppscotch-selfhost-web && pnpm run dev   # 前端 (端口 3003)
cd packages/hoppscotch-sh-admin && pnpm run dev       # 管理后台 (端口 3101)

# 构建/验证
pnpm run typecheck                    # 类型检查 (必须通过)
pnpm run lint                         # ESLint
pnpm run generate                     # 生产构建

# 后端
cd packages/hoppscotch-backend && pnpm run build      # 后端构建
export $(grep -v '^#' ../../.env | xargs) && node dist/src/main.js  # 启动后端 (端口 3170)

# 数据库
cd packages/hoppscotch-backend
pnpm run prisma:migrate:deploy        # 执行迁移
pnpm run prisma:generate              # 重新生成 Prisma client

# 启动前必须清理旧进程
pkill -f hoppscotch 2>/dev/null; pkill -f vite 2>/dev/null; sleep 2
lsof -i :3170 -i :3003 -i :3101 2>/dev/null | grep LISTEN  # 必须为空
```

## 核心架构

### Platform Abstraction (PlatformDef)
`@hoppscotch/common` 包含所有共享逻辑。平台特定代码通过 `PlatformDef` 在各 shell 的 `main.ts` 中注入。

### Request Pipeline
```
HoppRESTRequest → getEffectiveRESTRequest() → EffectiveHoppRESTRequest
  → RESTRequest.toRequest() → RelayRequest → Interceptor → Response
```

### Data Model Versioning (verzod)
所有核心数据模型使用 verzod 做 schema 版本化。**添加字段必须创建新版本**。
- HoppRESTRequest: v20 | HoppGQLRequest: v9 | HoppCollection: v12

### Dependency Injection (Dioc)
`@hoppscotch/dioc` (类 Angular DI)。关键 services: InitializationService, InterceptorService, SettingsService, AuthService。

## 项目 Skill 索引

项目本地 skill 位于 `.hermes/skills/devops/`，包含大量开发经验和陷阱记录：

| Skill | 描述 | 关键内容 |
|-------|------|----------|
| `hoppscotch-development` | 前端功能开发 | verzod 数据模型扩展、UI 组件模式、i18n、Tab/Document 模型、Design Mode 架构、20+ 陷阱 |
| `hoppscotch-selfhost` | 自托管部署 + 开发 | 部署流程、SMTP/onboarding、43 个已知陷阱 (P1-P43)、10 个 reference 文档 |

### Reference 文档 (hoppscotch-selfhost/references/)
- `codebase-architecture.md` — 代码库架构概览
- `request-pipeline.md` — REST 请求执行管道
- `schema-versioning.md` — verzod 数据模型版本化
- `blank-page-debug-2026-05.md` — 空白页排查
- `design-mode-architecture.md` — Design Mode 组件树和数据流
- `envvar-pathparam-separation-fix.md` — 环境变量 vs 路径参数分离修复
- `path-params-readonly-pattern.md` — 路径参数只读模式
- `actual-request-headers-investigation.md` — 实际请求 headers 调查
- `hopp-smart-tabs-modelvalue-bug.md` — HoppSmartTabs bug
- `env-reference.md` — 环境变量参考
- `vue-reactivity-pitfalls.md` — Vue 响应式陷阱

### Reference 文档 (hoppscotch-development/references/)
- `design-mode-architecture.md` — Design Mode 完整架构
- `request-mode-tabs.md` — 请求模式 Tab 实现
- `verzod-data-model.md` — verzod 数据模型指南

## 服务启动清单

Reviewer 审核完成后必须检查以下服务是否正常运行。如有服务未启动，按启动命令启动后再验证。

| 服务 | 端口 | 健康检查 URL | 启动命令 |
|------|------|-------------|----------|
| 前端 (selfhost-web) | 3003 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3003/` | `cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-selfhost-web && pnpm run dev` |
| 管理端 (sh-admin) | 3101 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3101/` | `cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-sh-admin && pnpm run dev` |
| 后端 (backend) | 3170 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3170/` | `cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-backend && export $(grep -v '^#' ../../.env \| xargs) && node dist/src/main.js` |

### 启动前清理

```bash
# 清理旧进程（必须先执行）
pkill -f hoppscotch 2>/dev/null; pkill -f vite 2>/dev/null; sleep 2

# 确认端口空闲
lsof -i :3170 -i :3003 -i :3101 2>/dev/null | grep LISTEN  # 必须为空
```

### 后端启动前置条件

```bash
# 需要先构建后端
cd /home/jcwl/workspace/hoppscotch/packages/hoppscotch-backend && pnpm run build

# 确保 .env 文件存在且配置正确
cat /home/jcwl/workspace/hoppscotch/.env | head -5
```

### 健康检查脚本（一次性检查所有服务）

```bash
for port in 3003 3101 3170; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ 2>/dev/null)
  echo "端口 $port: HTTP $status"
done
```

### Nginx 反向代理（公网访问）

| 公网端口 | 内网端口 | 用途 |
|----------|----------|------|
| 35051 | 3003 | 前端 |
| 35050 | 3101 | 管理端 |
| 35052 | 3170 | 后端 |

公网 IP: `121.41.26.6`，服务自检必须用 `127.0.0.1`（NAT loopback 限制）。

## Agent 开发指南

### Builder 须知
1. **先加载 skill**: 开始编码前必须 `skill_view("hoppscotch-development")` 和 `skill_view("hoppscotch-selfhost")`
2. **typecheck 必须通过**: `pnpm run typecheck` 是硬性要求
3. **commit 用 --no-verify**: 项目有 pre-existing lint errors，使用 `git commit --no-verify`
4. **git push 用 background**: GitHub push 可能超时，使用 `background=true, notify_on_complete=true`
5. **所有文件路径用绝对路径**: 项目根目录 `/home/jcwl/workspace/hoppscotch`
6. **Vite 配置必须保留**: `host: '0.0.0.0'` 在 selfhost-web 和 sh-admin 的 vite.config.ts 中
7. **验证完整链路**: 代码改完 → typecheck → 启动后端+前端 → curl 验证健康 → git commit

### 关键陷阱速查 (详见 skill)
- verzod 添加字段需要新版本 + 4 处 null-safe guard
- `<<variable>>` 是环境变量，`{variable}` 是路径参数，严格分离
- `filterActiveParams()` 返回 `[string, string][]` 不是 Record
- HoppSmartTabs 禁止使用 `render-inactive-tabs` prop
- `v-model` 不能直接绑定 prop，必须用 `useVModel`
- Vite HMR 有时不刷新，需要 kill + 重启 dev server
- `<icon-lucide>` 不是合法组件，必须用具体图标名 `<icon-lucide-plus>`

### Researcher 须知
- 项目 wiki 文档: `docs/wiki/` (38+ 页)
- 设计文档: `docs/API文档模式-布局与功能设计说明.md`
- CLAUDE.md 包含完整架构文档 (与 Claude Code 共享)

### Reviewer 须知
- 审查时检查 verzod 版本是否正确递增
- 检查所有新字段是否有 `?? defaultValue` 守卫
- 检查 i18n key 是否在 en.json 和 cn.json 中都有
- 检查是否使用了主题感知的语义化 CSS 类
- 检查 `v-model` 是否正确使用了 `useVModel` 桥接

## 文档索引

```
CLAUDE.md                                    # 完整项目指南 (Claude Code + Hermes 共用)
docs/wiki/                                   # OpenDeepWiki 文档 (38 页)
docs/verzod-migration-checklist.md           # 数据模型变更清单
docs/request-pipeline.md                     # REST 请求管道详情
docs/component-index.md                      # UI 组件目录
docs/API文档模式-布局与功能设计说明.md         # API 文档模式设计说明
.herms/skills/devops/hoppscotch-development/ # 开发经验 skill
.herms/skills/devops/hoppscotch-selfhost/    # 部署经验 skill
```
