# Hoppscotch Project Guide

> This file is read by Claude Code at startup. Keep it concise and factual.

## Project Overview

Hoppscotch is an open-source API development ecosystem (REST, GraphQL, WebSocket, SSE, Socket.IO, MQTT).
Built with Vue 3 + TypeScript, pnpm monorepo, platform abstraction pattern.

## Repository Structure

```
packages/
├── hoppscotch-common/     # Core UI + business logic (Vue components, services, platform defs)
├── hoppscotch-data/       # Data models with verzod versioned schemas (HoppRESTRequest etc.)
├── hoppscotch-kernel/     # Cross-platform request engine (Relay, IO, Store, Log)
├── hoppscotch-backend/    # NestJS backend (GraphQL + REST, Prisma ORM, PostgreSQL)
├── hoppscotch-selfhost-web/ # Self-hosted frontend shell (Vite, port 3003)
├── hoppscotch-sh-admin/   # Admin dashboard shell (Vite, port 3101)
├── hoppscotch-relay/      # Proxy relay service (Proxyscotch)
├── hoppscotch-agent/      # Desktop agent (system tray, native interceptor)
├── hoppscotch-desktop/    # Tauri desktop app
├── hoppscotch-cli/        # CLI for CI/CD testing
├── hoppscotch-js-sandbox/ # JavaScript sandbox for pre-request/test scripts
└── codemirror-lang-graphql/ # CodeMirror GraphQL language mode
```

## Development Commands

```bash
pnpm install                    # Install all dependencies
pnpm run dev                    # Start all packages in dev mode
pnpm run generate               # Production build (all packages)
pnpm run lint                   # Lint all packages
pnpm run lintfix                # Lint + auto-fix
pnpm run typecheck              # TypeScript type check all packages

# Single package dev
cd packages/hoppscotch-selfhost-web && pnpm run dev   # Frontend (port 3003)
cd packages/hoppscotch-sh-admin && pnpm run dev       # Admin (port 3101)
cd packages/hoppscotch-backend && pnpm run build      # Backend build

# Database
cd packages/hoppscotch-backend
pnpm run prisma:migrate:deploy   # Apply migrations
pnpm run prisma:generate         # Regenerate Prisma client
```

## Architecture

### Platform Abstraction (PlatformDef)

The core pattern: `@hoppscotch/common` contains all shared logic. Platform-specific code
(web vs desktop) is injected via `PlatformDef` at app startup in each shell's `main.ts`.

Key platform capabilities defined in `PlatformDef`:
- `auth` — Authentication strategy (GitHub/Google/Microsoft SSO, magic link, email)
- `kernelIO` — File I/O, HTTP relay, storage, logging implementations
- `kernelInterceptors` — Available HTTP interceptors (browser/proxy/agent/extension/native)
- `sync` — Collections, environments, settings, history sync backends
- `platformFeatureFlags` — Feature toggles per platform

### Request Pipeline

```
User edits request (HoppRESTRequest)
  → getEffectiveRESTRequest() — resolve env vars, auth, inherited props
  → EffectiveHoppRESTRequest
  → RESTRequest.toRequest() — convert to wire format
  → RelayRequest — kernel transport object
  → Interceptor (browser/proxy/agent/extension/native) — execute HTTP
  → Response
```

**Critical**: `RelayRequest.params` is an array `[string, string][]`, NOT `Record<string, string>`.
`RelayRequest.headers` contains application-level headers only; transport headers (User-Agent, etc.)
are added by the HTTP client after kernel dispatch.

### Data Model Versioning (verzod)

All core data models use `verzod` for schema versioning. **Adding a field requires a new version.**

Current versions:
| Entity | Latest Version | Package Path |
|--------|---------------|-------------|
| HoppRESTRequest | v20 | `@hoppscotch/data/rest` |
| HoppGQLRequest | v9 | `@hoppscotch/data/graphql` |
| HoppCollection | v12 | `@hoppscotch/data/collection` |
| Environment | v2 | `@hoppscotch/data/environment` |
| GlobalEnvironment | v2 | `@hoppscotch/data/global-environment` |

When adding a new field to HoppRESTRequest (e.g. pathParams):
1. Create `packages/hoppscotch-data/src/rest/v/18.ts` with new schema + migration from v17
2. Update `packages/hoppscotch-data/src/rest/index.ts` to reference v18 as latest
3. Update `getEffectiveRESTRequest()` in `hoppscotch-common` to handle new field
4. Update `RESTRequest.toRequest()` conversion to include new field
5. Add null-safe access (`?? defaultValue`) in ALL UI components that read the field
6. Run `pnpm run typecheck` to verify

See `docs/wiki/03-architecture-data-model-versioning.md` for full details.

### Dependency Injection (Dioc)

Services use `@hoppscotch/dioc` (inspired by Angular DI). Key services:
- `InitializationService` — 3-phase app bootstrap (initPre → initAuthAndSync → initPost)
- `InterceptorService` — Manages request interceptor selection
- `SettingsService` — App settings persistence
- `AuthService` — Authentication state management

### Kernel System

`@hoppscotch/kernel` provides cross-platform abstractions:
- `KernelIO` — File system operations
- `KernelStore` — Persistent key-value storage
- `KernelLog` — Structured logging
- `KernelRelay` — HTTP request execution (the core of request sending)

## Self-Hosted Deployment

| Service | Port | Package |
|---------|------|---------|
| Backend (NestJS) | 3170 | hoppscotch-backend |
| Frontend (selfhost-web) | 3003 | hoppscotch-selfhost-web |
| Admin (sh-admin) | 3101 | hoppscotch-sh-admin |

### Local Dev Setup

1. Kill stale processes first: `pkill -f hoppscotch; pkill -f vite; sleep 2`
2. Verify ports free: `lsof -i :3170 -i :3003 -i :3101 | grep LISTEN` (must be empty)
3. Start backend: `cd packages/hoppscotch-backend && export $(grep -v '^#' ../../.env | xargs) && node dist/src/main.js`
4. Start frontends: `cd packages/hoppscotch-selfhost-web && pnpm run dev` (separate terminal)
5. Health check: `curl http://localhost:3170/health`

### Vite Config (MUST preserve after git operations)

Both selfhost-web and sh-admin `vite.config.ts` MUST have:
```ts
server: { port: 3003, host: '0.0.0.0' },  // or 3101 for admin
preview: { port: 3003, host: '0.0.0.0' },
```

Without `host: '0.0.0.0'`, Vite listens on IPv6 only → nginx proxy to 127.0.0.1 fails.

## Critical Pitfalls

### UI/Component Issues
- **HoppSmartTabs**: NEVER use `render-inactive-tabs` prop — causes duplicate tab ID crash → blank page
- **Vue template interpolation**: Cannot span multiple lines. Use computed properties instead.
- **i18n**: Only `<<variable>>` syntax resolves. `{{variable}}` does NOT resolve. Keys with `{count}` require passing count param.
- **Styling**: Use Vben5 semantic classes (`bg-primary`, `text-secondaryLight`, `border-dividerLight`, etc.). No hardcoded colors.

### Data/Pipeline Issues
- **filterActiveParams()** returns `[string, string][]`, NOT Record. Always check `Array.isArray()` before iterating.
- **Query params** are NOT in `RelayRequest.url`. Compute: `fullURL = url + "?" + encodeParams(params)`.
- **Environment variable syntax**: Only `<<var>>` works. `{{var}}` does not. SmartEnvInput converts internally.
- **Null-safe access**: After adding new fields to versioned entities, localStorage tabs may have old-format data without the new field. ALWAYS use `?? defaultValue` when accessing new fields in components.

### Build/Deploy Issues
- **First startup calls stopApp()**: Normal on first launch. Just start again.
- **Encrypted InfraConfig**: Cannot set via raw SQL. Use onboarding API or encrypt-infraconfig.js tool.
- **.env values with #**: Must be quoted: `MAILER_SMTP_PASSWORD="Pass#123"`
- **MAILER_SMTP_AUTH_TYPE**: Must be `'login'` (lowercase), NOT `'LOGIN'`
- **Stale processes**: After git operations, always kill old node/vite processes before restarting

## Pre-Commit Checks

1. `pnpm run typecheck` — MUST pass
2. `pnpm run lint` — MUST pass
3. All three ports (3170, 3003, 3101) must be accessible
4. Browser must NOT show blank page

## Key File Paths (for quick navigation)

```
# Common UI components
packages/hoppscotch-common/src/components/http/         # REST request UI
packages/hoppscotch-common/src/components/http/design/  # Design mode (schema tree, response models)
packages/hoppscotch-common/src/components/graphql/      # GraphQL request UI
packages/hoppscotch-common/src/components/realtime/     # WebSocket/SSE/Socket.IO/MQTT
packages/hoppscotch-common/src/components/collections/documentation/  # Documentation mode preview

# Data models
packages/hoppscotch-data/src/rest/v/                    # REST request versioned schemas
packages/hoppscotch-data/src/graphql/v/                 # GraphQL request versioned schemas
packages/hoppscotch-data/src/collection/v/              # Collection versioned schemas

# Platform & initialization
packages/hoppscotch-common/src/platform/index.ts        # PlatformDef type definition
packages/hoppscotch-selfhost-web/src/main.ts            # Self-host platform config
packages/hoppscotch-common/src/services/initialization.service.ts  # App bootstrap

# Request pipeline
packages/hoppscotch-common/src/helpers/functional/      # getEffectiveRESTRequest, filterActiveParams
packages/hoppscotch-kernel/src/relay/                   # Kernel relay (HTTP execution)
packages/hoppscotch-common/src/services/interceptor.service.ts  # Interceptor selection

# Backend
packages/hoppscotch-backend/src/app.module.ts           # NestJS root module
packages/hoppscotch-backend/prisma/                     # Prisma schema & migrations
```

## Documentation

- `docs/wiki/` — OpenDeepWiki documentation (38 pages covering all subsystems)
- `docs/wiki/07-documentation-mode.md` — Documentation mode architecture, data model, component tree, edit/preview flow
- `docs/API文档模式-布局与功能设计说明.md` — API 文档模式 UI 布局与功能设计说明
- `docs/verzod-migration-checklist.md` — Step-by-step guide for data model changes
- `docs/request-pipeline.md` — REST request execution pipeline details
- `docs/component-index.md` — UI component directory
