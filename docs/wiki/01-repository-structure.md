# Repository Structure
Hoppscotch is organized as a monorepo using **pnpm workspaces**, with a clear separation of concerns across multiple packages under the `packages/` directory. This structure enables code reuse across different deployment targets (web, desktop, self-hosted) while maintaining independent versioning and build pipelines for each package.

## Overview
The Hoppscotch repository is designed around a **modular monorepo architecture** that separates the codebase into distinct packages, each with a specific responsibility:

- **Frontend packages**: `hoppscotch-common`, `hoppscotch-selfhost-web`, `hoppscotch-desktop` — share the same core UI and logic via the `@hoppscotch/common` package
- **Backend package**: `hoppscotch-backend` — a NestJS GraphQL API server
- **Supporting libraries**: `@hoppscotch/data`, `@hoppscotch/kernel`, `@hoppscotch/js-sandbox`, `@hoppscotch/codemirror-lang-graphql`
- **CLI tool**: `@hoppscotch/cli` — for running test scripts in CI environments
- **Infrastructure**: `hoppscotch-relay` (Rust), `hoppscotch-agent` (Tauri-based desktop agent)

The monorepo approach allows developers to work on multiple packages simultaneously, share type definitions and utilities, and coordinate releases with a single version control workflow.

## Architecture
The overall architecture follows a **layered, cross-platform design** where the core application logic lives in `hoppscotch-common` and is consumed by different platform targets (web, self-hosted, desktop) that provide their own platform-specific implementations.

加载图表中...
**Design intent**: This architecture allows Hoppscotch to ship as multiple products (web app, desktop app, self-hosted instance, CLI) while maintaining a single source of truth for business logic, data types, and UI components in the shared packages. The kernel abstraction (`@hoppscotch/kernel`) decouples platform-specific IO operations (file system, relays, storage) from the application logic.

## Main Content
### Root-Level Configuration
The repository uses **pnpm workspaces** as its package manager, configured in `pnpm-workspace.yaml`. The workspace pattern `packages/**` includes all subdirectories under `packages/`.

>
Source: [pnpm-workspace.yaml](https://github.com/xiexb/hoppscotch/blob/main/pnpm-workspace.yaml)

yamlpackages:
  - 'packages/**'
Key root configuration files:

FilePurpose`package.json`Root workspace configuration, shared dev dependencies, workspace scripts`pnpm-workspace.yaml`Declares the monorepo workspace pattern`docker-compose.yml`Self-hosting deployment with PostgreSQL, multiple profiles`prod.Dockerfile`Multi-stage Docker build for production`tailwind.config.ts`Shared Tailwind CSS configuration for frontend packages`commitlint.config.js`Conventional commit validation`netlify.toml`Netlify deployment configuration`firebase.json`Firebase hosting configuration
Source: [package.json](https://github.com/xiexb/hoppscotch/blob/main/package.json)

### Package Details
#### 1. `@hoppscotch/common` (`packages/hoppscotch-common`)
The **core shared package** that contains the primary application logic, UI components, and routing. This is the largest package and is consumed by both `hoppscotch-selfhost-web` and `hoppscotch-desktop`.

**Internal structure:**

DirectoryPurpose`src/components/`Vue 3 UI components organized by feature (app, collections, graphql, http, etc.)`src/composables/`Vue composables for auth, GraphQL, theming, settings, OAuth2, etc.`src/helpers/`Utility functions for auth types (basic, bearer, digest, AWS, OAuth2), actions, scripting`src/pages/`Page-level Vue components for routing (index, graphql, realtime, profile, etc.)`src/platform/`**Platform abstraction layer** — defines interfaces for auth, collections, environments, settings, history, kernel IO, analytics, etc.`src/modules/`Hoppscotch module system (DIoC-based) — router, theming, i18n, PWA, toast, etc.`public/`Static assets (images, icons, banner)
>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)

The **PlatformDef** interface is the contract between the shared code and platform-specific implementations:

typescript1export type PlatformDef = {
2  ui?: UIPlatformDef
3  addedHoppModules?: HoppModule[]
4  addedServices?: Array<ServiceClassInstance<unknown>>
5  auth: AuthPlatformDef
6  analytics?: AnalyticsPlatformDef
7  kernelIO: KernelIO
8  instance: InstancePlatformDef
9  sync: {
10    environments: EnvironmentsPlatformDef
11    collections: CollectionsPlatformDef
12    settings: SettingsPlatformDef
13    history: HistoryPlatformDef
14  }
15  kernelInterceptors: KernelInterceptorsPlatformDef
16  additionalInspectors?: InspectorsPlatformDef
17  spotlight?: SpotlightPlatformDef
18  // ...
19}
>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts#L23-L76)

**Design intent**: The platform abstraction allows the same shared codebase to operate differently depending on the deployment target. For example, `hoppscotch-selfhost-web` provides a GraphQL backend implementation for sync services, while `hoppscotch-desktop` provides local file-based implementations.

#### 2. `@hoppscotch/selfhost-web` (`packages/hoppscotch-selfhost-web`)
The **self-hosted web application** that integrates with the Hoppscotch backend via GraphQL. This package provides the platform-specific implementations for the self-hosted environment.

**Internal structure:**

DirectoryPurpose`src/api/mutations/`GraphQL mutation operations (Create, Update, Delete collections, requests, environments, etc.)`src/api/queries/`GraphQL query operations (Get collections, environments, settings, history)`src/api/subscriptions/`GraphQL subscription operations for real-time updates`src/pages/`Platform-specific pages (e.g., `device-login.vue`)`webapp-server/`**Go-based webapp server** — serves the SPA and handles bundle management
The `webapp-server` is a Go application that acts as a reverse proxy/static file server for the SPA bundle:

>
Source: [webapp-server](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/webapp-server)

#### 3. `hoppscotch-backend` (`packages/hoppscotch-backend`)
A **NestJS** GraphQL API server with Prisma ORM for PostgreSQL. This is a feature-rich backend with modular architecture.

**Module structure** (from `app.module.ts`):

>
Source: [app.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts)

ModuleResponsibility`UserModule`User management, profiles, display names`AuthModule`Authentication (magic links, JWT, refresh tokens, SSO providers)`UserSettingsModule`Per-user settings persistence`UserEnvironmentsModule`User-scoped environment variables`UserCollectionModule`User-scoped request collections`UserRequestModule`User-scoped REST and GraphQL requests`UserHistoryModule`Request history tracking`TeamModule`Team management, roles (OWNER, VIEWER, EDITOR)`TeamCollectionModule`Team-scoped collections`TeamRequestModule`Team-scoped requests`TeamEnvironmentsModule`Team-scoped environment variables`TeamInvitationModule`Team invitation workflows`AdminModule`Admin dashboard, infrastructure management`InfraConfigModule`Instance configuration (SMTP, SSO, onboarding)`AccessTokenModule`Personal access tokens for API auth`InfraTokenModule`Infrastructure-level tokens`ShortcodeModule`URL shortcode generation`MockServerModule`Mock server functionality`PublishedDocsModule`Published collection documentation`HealthModule`Health check endpoints`MailerModule`Email sending (invitations, notifications)`PostHogModule`Product analytics/telemetry`SortModule`Collection/request sorting orchestration`PrismaModule`Database connection and querying`PubSubModule`Real-time event pub/sub for GraphQL subscriptions
**Design intent**: The backend follows NestJS's modular architecture where each domain has its own module with controllers, resolvers, services, models, and guards. This provides clear separation of concerns and enables independent testing of each domain.

The backend configuration is loaded from environment variables and the `InfraConfigModule`:

>
Source: [infra-config/helper.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/helper.ts)

#### 4. `@hoppscotch/data` (`packages/hoppscotch-data`)
A **standalone data types library** that defines the core data structures used across all Hoppscotch clients. It uses the `verzod` library for versioned entity schemas with Zod validation.

>
Source: [data/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/index.ts)

typescript1export * from "./rest"
2export * from "./graphql"
3export * from "./collection"
4export * from "./rawKeyValue"
5export * from "./environment"
6export * from "./global-environment"
7export * from "./predefinedVariables"
8export * from "./utils/collection"
9export * from "./utils/hawk"
10export * from "./utils/akamai-eg"
11export * from "./utils/jwt"
12export * from "./rest-request-response"
13export * from "./cookies"
**Design intent**: By extracting data types into a separate package, Hoppscotch ensures that the same data structures and validation logic are used consistently across all consumers (web app, CLI, backend). The versioned entity pattern allows backward-compatible data migrations.

The collection entity, for example, has 12 versions:

>
Source: [collection/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/collection/index.ts)

typescript1export const HoppCollection = createVersionedEntity({
2  latestVersion: 12,
3  versionMap: {
4    1: V1_VERSION,
5    2: V2_VERSION,
6    3: V3_VERSION,
7    // ... up to 12
8  },
9  getVersion(data) {
10    const versionCheck = versionedObject.safeParse(data)
11    if (versionCheck.success) return versionCheck.data.v
12    // fallback logic for legacy versions
13  },
14  // ...
15})
#### 5. `@hoppscotch/kernel` (`packages/hoppscotch-kernel`)
The **cross-platform runtime kernel** that abstracts platform-specific operations (IO, relay/network, storage, logging). It provides "web" and "desktop" implementations for each capability.

>
Source: [kernel/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts)

typescript1export interface KernelAPI {
2  info: KernelInfo
3  io: typeof IO_VERSIONS.v1.api
4  relay: typeof RELAY_VERSIONS.v1.api
5  store: typeof STORE_VERSIONS.v1.api
6  log: typeof LOG_VERSIONS.v1.api
7}
8
9export type KernelMode = "web" | "desktop"
10
11export function initKernel(mode?: KernelMode): KernelAPI {
12  if (mode === "desktop") {
13    const kernel: KernelAPI = {
14      info: { name: "desktop-kernel", version: { major: 1, minor: 0, patch: 0 }, capabilities: ["basic-io"] },
15      io: DESKTOP_IO_IMPLS.v1.api,
16      relay: DESKTOP_RELAY_IMPLS.v1.api,
17      store: DESKTOP_STORE_IMPLS.v1.api,
18      log: DESKTOP_LOG_IMPLS.v1.api,
19    }
20    window.__KERNEL__ = kernel
21    return kernel
22  } else {
23    // Web implementation
24    const kernel: KernelAPI = {
25      info: { name: "web-kernel", version: { major: 1, minor: 0, patch: 0 }, capabilities: ["basic-io"] },
26      io: WEB_IO_IMPLS.v1.api,
27      relay: WEB_RELAY_IMPLS.v1.api,
28      store: WEB_STORE_IMPLS.v1.api,
29      log: WEB_LOG_IMPLS.v1.api,
30    }
31    window.__KERNEL__ = kernel
32    return kernel
33  }
34}
>
Source: [kernel/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts#L42-L78)

**Kernel capabilities:**

CapabilityWebDesktop**IO**Browser IO (downloads, clipboard)Tauri file system, dialogs**Relay**Browser fetch/WebSocketNative HTTP clients via Tauri**Store**IndexedDB / localStorageSQLite via Tauri plugin**Log**Console loggingFile-based logging
#### 6. `@hoppscotch/js-sandbox` (`packages/hoppscotch-js-sandbox`)
A **JavaScript sandbox** for executing user-defined scripts (pre-request scripts, test scripts) in a secure, isolated environment. It exposes:

- A `hopp` namespace for environment variable operations (`hopp.env.set`, `hopp.env.get`, etc.)
- A `pw` (Postwoman-compatible) / `pm` namespace for assertions and test cases
- Fetch API for making HTTP requests from within scripts
- Crypto API (Web Crypto subset) for encryption operations
- Chai assertion library integration

The sandbox supports both web (iframe-based) and node (vm2/isolated-vm) execution environments.

>
Source: [js-sandbox](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox)

#### 7. `@hoppscotch/cli` (`packages/hoppscotch-cli`)
A **command-line interface** tool for running Hoppscotch collections in CI/CD environments. It supports:

- Running test scripts from collection files
- Environment variable injection
- Iteration with CSV data files
- Multiple authentication schemes (basic, bearer, OAuth2, digest, AWS, Hawk, JWT)
- JUnit XML test report export
- Legacy and revamped sandbox modes

>
Source: [cli/src/commands/test.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/commands/test.ts)

typescript1export const test = (pathOrId: string, options: TestCmdOptions) => async () => {
2  try {
3    const { delay, env, iterationCount, iterationData, reporterJunit, legacySandbox } = options
4
5    // Validate iteration count
6    if (iterationCount !== undefined && (iterationCount < 1 || !isSafeInteger(iterationCount))) {
7      throw error({ code: "INVALID_ARGUMENT", data: "The value must be a positive integer" })
8    }
9
10    const resolvedDelay = delay ? parseDelayOption(delay) : 0
11    const envs = env
12      ? await parseEnvsData(options as TestCmdEnvironmentOptions)
13      : <HoppEnvs>{ global: [], selected: [] }
14
15    const collections = await parseCollectionData(pathOrId, options)
16
17    // Parse CSV iteration data if provided
18    if (iterationData) {
19      if (!fs.existsSync(iterationData)) {
20        throw error({ code: "FILE_NOT_FOUND", path: iterationData })
21      }
22      // ...parse and transform CSV data
23    }
24
25    // Execute collections
26    const result = await collectionsRunner(collections, envs, { delay: resolvedDelay, iterationData: transformedIterationData, legacySandbox })
27    collectionsRunnerExit(result)
28  } catch (e) {
29    handleError(e)
30  }
31}
>
Source: [cli/src/commands/test.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/commands/test.ts#L21-L114)

#### 8. `hoppscotch-desktop` (`packages/hoppscotch-desktop`)
A **Tauri-based desktop application** that wraps the Hoppscotch web app into a native desktop experience. It uses:

- **Tauri** (Rust backend) for native OS operations
- **Tauri plugins** for file system access, dialogs, shell operations
- A Rust relay for native HTTP request execution

The desktop Rust backend (`src-tauri/src/`) contains:

FilePurpose`main.rs`Tauri application entry point`lib.rs`Core plugin registration and command handlers`server.rs`Built-in HTTP server for local development`config.rs`Desktop-specific configuration management`backup.rs`Backup and restore functionality`dialog.rs`Native file dialog integration`updater.rs`Application update mechanism`webview/mod.rs`Webview management and error handling
>
Source: [desktop/src-tauri/src](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-desktop/src-tauri/src)

#### 9. `hoppscotch-relay` (`packages/hoppscotch-relay`)
A **Rust library** that provides the native HTTP relay functionality used by the Tauri desktop app. It handles actual HTTP request execution at the system level, bypassing browser limitations.

>
Source: [relay/src](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-relay/src)

#### 10. `hoppscotch-agent` (`packages/hoppscotch-agent`)
A **Tauri-based desktop agent** for out-of-browser HTTP relay. It provides a way to send HTTP requests from the browser-based app through a native agent running on the desktop, enabling features that require system-level network access.

>
Source: [agent](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-agent)

#### 11. `hoppscotch-sh-admin` (`packages/hoppscotch-sh-admin`)
The **self-host admin dashboard** — a standalone Vue 3 application for managing self-hosted Hoppscotch instances. It includes admin-specific GraphQL operations for user management, infrastructure configuration, and analytics.

>
Source: [sh-admin](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin)

#### 12. `@hoppscotch/codemirror-lang-graphql` (`packages/codemirror-lang-graphql`)
A **CodeMirror 6 language extension** providing GraphQL syntax highlighting, autocompletion, and linting for the editor component used across Hoppscotch.

>
Source: [codemirror-lang-graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/codemirror-lang-graphql)

## Core Flow
The following sequence diagram illustrates the request flow when a user sends an HTTP request through the Hoppscotch web app:

加载图表中...
## Configuration Options
### Backend Configuration
The backend is configured via environment variables (loaded through the `InfraConfigModule`):

VariableTypeDefaultDescription`DATABASE_URL`string—PostgreSQL connection string`JWT_SECRET`string—JWT signing secret`PRODUCTION`string`"false"`Whether to disable GraphQL playground`INFRA.RATE_LIMIT_TTL`number`60`Rate limit time window (seconds)`INFRA.RATE_LIMIT_MAX`number`100`Max requests per time window`GQL_SCHEMA_EMIT_LOCATION`string—Path to emit GraphQL schema file
>
Source: [app.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts#L43-L104)

### Database Schema (Prisma ORM)
The backend uses **PostgreSQL** with Prisma ORM. Key tables include:

TableDescription`User`User accounts`Team`Teams for collaboration`TeamMember`Team membership with roles (OWNER, VIEWER, EDITOR)`TeamCollection` / `TeamRequest`Team-scoped collections and requests`UserCollection` / `UserRequest`User-scoped collections and requests`UserHistory`Request history`UserSettings`User preferences`UserEnvironment`Environment variables`Shortcode`URL shortcodes`InfraConfig`Infrastructure configuration`PersonalAccessToken`API tokens
>
Source: [prisma/migrations](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/migrations)

### Docker Compose Profiles
The `docker-compose.yml` supports multiple deployment profiles:

ProfileDescription`default`All-in-one (app + backend + database + auto-migration)`default-no-db`All-in-one without database (external DB)`backend`Backend service only`app`Web application + webapp server`admin`Admin dashboard only`database`PostgreSQL database only`just-backend`All services except webapp (local development)
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)

## Related Links

- [Getting Started](./1-overview.1-getting-started)
- [Architecture Overview](./1-overview.2-architecture-overview)
- [Technology Stack](./1-overview.3-technology-stack)
- [Development Setup](./2-contributing.1-development-setup)

### Source Files

- [Root package.json](https://github.com/xiexb/hoppscotch/blob/main/package.json)
- [pnpm-workspace.yaml](https://github.com/xiexb/hoppscotch/blob/main/pnpm-workspace.yaml)
- [Backend AppModule](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts)
- [Kernel Package](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts)
- [Data Package](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/index.ts)
- [Platform Definitions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)
- [CLI Test Command](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/commands/test.ts)
- [Docker Compose](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)
- [Desktop Rust Backend](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-desktop/src-tauri/src)