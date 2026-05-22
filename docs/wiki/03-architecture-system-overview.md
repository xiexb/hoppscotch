# System Overview
Hoppscotch is an open-source API development ecosystem designed to help developers create, test, and document APIs faster. It provides a lightweight, PWA-first web application, a desktop client built with Tauri, a CLI for CI/CD testing, and a self-hostable backend infrastructure with team collaboration features.

## Overview
Hoppscotch is built as a modular monorepo using pnpm workspaces, with the core application logic shared across platform-specific shells (web and desktop). The architecture follows a **platform abstraction pattern** where platform-agnostic code resides in `@hoppscotch/common` and platform-specific implementations (web vs. desktop) are injected at build time.

### Key Design Principles

- **Platform Agnosticism**: Core business logic is decoupled from platform-specific APIs (browser vs. Tauri). The kernel abstraction layer provides cross-platform implementations for IO, HTTP relay, storage, and logging.
- **Real-time Sync**: Data synchronization across devices is achieved through GraphQL subscriptions and a reactive store architecture.
- **PWA-first**: The web application is a fully functional Progressive Web App with offline support, installable on devices.
- **Self-hostable**: The complete backend infrastructure can be self-hosted via Docker Compose, including PostgreSQL, auto-migrations, and an admin dashboard.
- **Extensible by Design**: The interceptor architecture allows plugging different networking backends (browser native, proxy, agent, desktop native, browser extension).
- **Collaboration-centric**: Team workspaces, collections, environments, and role-based access control are first-class citizens.

## Architecture
### High-level System Architecture
加载图表中...
**Architecture Layers Explained:**

- **Frontend Layer**: Two shells share the same codebase via `@hoppscotch/common`. The web shell runs in the browser as a PWA, while the desktop shell uses Tauri for native OS integration (file system, window management, native HTTP).
- **Shared Core (`@hoppscotch/common`)**: The heart of the application. Contains Vue composables, services (DI via `dioc`), platform definitions, reactive stores, and UI components. This package is consumed by both web and desktop shells.
- **Cross-Platform Kernel (`@hoppscotch/kernel`)**: An abstraction layer that provides platform-specific implementations for HTTP execution (Relay), file I/O (IO), persistent storage (Store), and diagnostics logging (Log). Each module has versioned APIs with separate web and desktop implementations.
- **Backend Layer (NestJS)**: A NestJS application serving both GraphQL (Apollo) and REST endpoints. Key modules include authentication (SSO via Google/GitHub/Microsoft, JWT, magic link), team management, collection/request CRUD, mock server, and a database-driven infrastructure configuration system.
- **Data Layer**: PostgreSQL database accessed via Prisma ORM with connection pooling and SSL support for cloud deployments.
- **Deployment & Tooling**: Docker Compose with multiple deployment profiles, a Go-based webapp server for serving frontend assets with content integrity verification, Caddy as a reverse proxy, and supporting tools like CLI and browser extensions.

### Package Architecture
加载图表中...
### Backend Module Architecture
加载图表中...
**Source**: [app.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts)

## Application Initialization Flow
The application bootstrapping follows a strict initialization sequence managed by the `InitializationService`. This design ensures proper dependency ordering before the Vue app mounts.

加载图表中...
**Source**: [initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts)

The initialization is split into three phases:

- **initPre()** (before app mount): Store, persistence, networking (desktop), backend GQL client, and tab state restoration. This ensures the app has working storage and the backend client before any UI renders.
- **initAuthAndSync()** (after app mount, async): Authentication initialization and data synchronization. This runs in the background while the user sees the app shell.
- **initPost()** (after everything): Late persistence setup and data format migrations.

## Core Flow: Request Execution
When a user sends an HTTP request, it flows through the interceptor pipeline and the kernel's relay module:

加载图表中...
**Source**: [main.ts platform config](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/main.ts#L42-L78)

The interceptor chain is configured per-platform:

- **Web**: Available interceptors are `browser` (default), `proxy`, `agent`, and `extension`. The browser interceptor uses the native `fetch` API but may be limited by CORS. The proxy interceptor routes through [Proxyscotch](https://github.com/hoppscotch/proxyscotch) to bypass CORS restrictions.
- **Desktop**: Available interceptors are `native` (default) and `proxy`. The native interceptor uses Tauri's Rust-based HTTP client, which has no CORS limitations and can handle cookies.

## Platform Definition System
The entire application is configured through a `PlatformDef` interface that defines how each platform capability is implemented:

>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)

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
18  platformFeatureFlags: {
19    exportAsGIST: boolean
20    hasTelemetry: boolean
21    cookiesEnabled?: boolean
22    promptAsUsingCookies?: boolean
23    workspaceSwitcherLogin?: Ref<boolean>
24    hasCookieBasedAuth?: boolean
25  }
26  limits?: LimitsPlatformDef
27  infra?: InfraPlatformDef
28  experiments?: ExperimentsPlatformDef
29  backend: BackendPlatformDef
30  organization?: OrganizationPlatformDef
31  additionalLinks?: AdditionalLinksPlatformDef
32}
The platform configuration is injected at the application entry point. For example, the web shell configures browser-based sync adapters while the desktop shell uses Tauri-based adapters:

>
Source: [selfhost-web/src/main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/main.ts#L42-L78)

typescript1const PLATFORM_CONFIG = {
2  web: {
3    auth: webAuth,
4    environments: webEnvironments,
5    collections: webCollections,
6    settings: webSettings,
7    history: webHistory,
8    instance: webInstance,
9    interceptors: [
10      BrowserKernelInterceptorService,
11      ProxyKernelInterceptorService,
12      AgentKernelInterceptorService,
13      ExtensionKernelInterceptorService,
14    ],
15    defaultInterceptor: "browser",
16    cookiesEnabled: false,
17  },
18
19  desktop: {
20    auth: desktopAuth,
21    environments: desktopEnvironments,
22    collections: desktopCollections,
23    settings: desktopSettings,
24    history: desktopHistory,
25    instance: desktopInstance,
26    interceptors: [
27      NativeKernelInterceptorService,
28      ProxyKernelInterceptorService,
29    ],
30    defaultInterceptor: "native",
31    cookiesEnabled: true,
32  },
33}
## Cross-Platform Kernel
The `@hoppscotch/kernel` package provides versioned, platform-specific implementations for core runtime capabilities. It is the bridge between web and desktop platform APIs.

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
9export function initKernel(mode?: KernelMode): KernelAPI {
10  if (mode === "desktop") {
11    const kernel: KernelAPI = {
12      info: {
13        name: "desktop-kernel",
14        version: { major: 1, minor: 0, patch: 0 },
15        capabilities: ["basic-io"],
16      },
17      io: DESKTOP_IO_IMPLS.v1.api,
18      relay: DESKTOP_RELAY_IMPLS.v1.api,
19      store: DESKTOP_STORE_IMPLS.v1.api,
20      log: DESKTOP_LOG_IMPLS.v1.api,
21    }
22    window.__KERNEL__ = kernel
23    return kernel
24  } else {
25    // Web kernel implementation
26    const kernel: KernelAPI = { ... web implementations ... }
27    window.__KERNEL__ = kernel
28    return kernel
29  }
30}
### Kernel Modules
ModuleDescriptionWeb ImplementationDesktop Implementation**Relay**HTTP request execution engineBrowser `fetch` APITauri Rust HTTP client**IO**File system operationsDownload/upload via browser APIsTauri file dialogs + fs**Store**Persistent key-value storage`localStorage` or IndexedDBTauri plugin-store**Log**Diagnostics logging`console.*` methodsFile-based logging with rotation
The kernel modules follow a versioned API pattern (`v/1.ts`) where each version defines a stable interface, and implementations can evolve independently.

## Infrastructure Configuration System
The backend uses a database-driven configuration system called "Infra Config" stored in the `infra_config` table. This approach allows runtime configuration changes without redeployment.

>
Source: [infra-config/helper.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/helper.ts)

typescript1export async function loadInfraConfiguration() {
2  const prisma = getSharedPrismaInstance()
3  try {
4    const infraConfigs = await prisma.infraConfig.findMany()
5    const environmentObject: Record<string, string> = {}
6    infraConfigs.forEach((infraConfig) => {
7      if (infraConfig.isEncrypted) {
8        environmentObject[infraConfig.name] = decrypt(infraConfig.value)
9      } else {
10        environmentObject[infraConfig.name] = infraConfig.value
11      }
12    })
13    return { INFRA: environmentObject }
14  } catch (error) {
15    console.error('Error from loadInfraConfiguration', error)
16    return { INFRA: {} }
17  }
18}
The configuration loading sequence:

- On application startup, `loadInfraConfiguration()` fetches all rows from the `infra_config` table.
- Encrypted values (like secrets, tokens) are decrypted using the `DATA_ENCRYPTION_KEY`.
- The loaded configuration is merged into NestJS's ConfigModule as the `INFRA` namespace.
- Configuration values can be managed through the Admin Dashboard at runtime.
- Derived environment variables (like callback URLs) are auto-reconciled via `buildDerivedEnv()`.

## Deployment Architecture
Hoppscotch supports multiple deployment scenarios through Docker Compose profiles:

加载图表中...
**Source**: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)

### Core Environment Variables
The application is configured primarily through a `.env` file. Key environment variables include:

VariableDescriptionRequired`DATABASE_URL`PostgreSQL connection stringYes`VITE_BASE_URL`Public base URL of the appYes`VITE_BACKEND_API_URL`Backend API URLYes`DATA_ENCRYPTION_KEY`32-byte hex key for encrypting stored secretsYes`PORT`Backend server port (default: 3170)No
## Data Synchronization Architecture
Data sync follows a **dispatch-based reactive pattern** using `DispatchingStore` from `@hoppscotch/common`. When local state changes, dispatches are observed and mapped to sync operations:

>
Source: [lib/sync/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/lib/sync/index.ts)

typescript1function startStoreSync() {
2  store.dispatches$.subscribe((actionParams) => {
3    if ((storeSyncDefinition as any)[actionParams.dispatcher]) {
4      const dispatcher = actionParams.dispatcher
5      const payload = actionParams.payload
6      const operationMapperFunction = (storeSyncDefinition as any)[dispatcher]
7      if (operationMapperFunction && shouldSyncValue()) {
8        operationMapperFunction(payload)
9      }
10    }
11  })
12}
This pattern ensures:

- Local changes are automatically synced to the backend (via GraphQL mutations)
- Incoming changes from other devices (via GraphQL subscriptions) update the local store
- Sync can be toggled on/off per user preference
- Changes made during sync-off periods are queued

## Configuration Options
### Backend Configuration (via Infra Config)
The infrastructure configuration system supports runtime management of these categories:

CategoryExample KeysDescription**Authentication**`GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `MICROSOFT_TENANT`SSO provider credentials**JWT & Sessions**`JWT_SECRET`, `SESSION_SECRET`, `ACCESS_TOKEN_VALIDITY`Token configuration**Rate Limiting**`RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`API rate limiting**Mailer**`MAILER_SMTP_URL`, `MAILER_ADDRESS_FROM`, `MAILER_SMTP_HOST`Email configuration**Feature Flags**`USER_HISTORY_STORE_ENABLED`, `ALLOW_ANALYTICS_COLLECTION`Feature toggles**Onboarding**`ONBOARDING_COMPLETED`, `VITE_ALLOWED_AUTH_PROVIDERS`Setup state
### Webapp Server Configuration
The Go-based webapp server serves the frontend assets with content integrity verification:

VariableDefaultDescription`WEBAPP_SERVER_PORT``3200`Server port`WEBAPP_SERVER_READ_TIMEOUT``15s`HTTP read timeout`WEBAPP_SERVER_WRITE_TIMEOUT``15s`HTTP write timeout`WEBAPP_SERVER_IDLE_TIMEOUT``60s`HTTP idle timeout`FRONTEND_PATH``/site/selfhost-web`Path to frontend assets`GO_ENV`(none)Set to `development` for dev mode
**Source**: [webapp-server/README.md](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/webapp-server/README.md)

## Usage Examples
### Creating the App Instance (Application Entry Point)
The following example shows how the self-host web application bootstraps itself:

>
Source: [selfhost-web/src/main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/main.ts#L147-L204)

typescript1async function initApp() {
2  const platform = getKernelMode()    // "web" or "desktop"
3  const config = PLATFORM_CONFIG[platform]
4
5  if (platform === "desktop") {
6    setupDesktopUI()
7  }
8
9  await createHoppApp("#app", {
10    ui: {
11      additionalFooterMenuItems: config.menuItems,
12      additionalSupportOptionsMenuItems: config.supportItems,
13      additionalSettingsSections:
14        platform === "desktop" ? [DesktopSettingsSection] : undefined,
15    },
16
17    auth: config.auth,
18    kernelIO,
19    instance: config.instance,
20    sync: {
21      environments: config.environments,
22      collections: config.collections,
23      settings: config.settings,
24      history: config.history,
25    },
26
27    kernelInterceptors: {
28      default: config.defaultInterceptor,
29      interceptors: config.interceptors.map((service) => ({
30        type: "service" as const,
31        service,
32      })),
33    },
34
35    platformFeatureFlags: {
36      exportAsGIST: false,
37      hasTelemetry: false,
38      cookiesEnabled: config.cookiesEnabled,
39      promptAsUsingCookies: false,
40      hasCookieBasedAuth: platform === "web",
41    },
42    limits: {
43      collectionImportSizeLimit: 50,
44    },
45    infra: InfraPlatform,
46    backend: stdBackendDef,
47    additionalLinks: [HeaderDownloadableLinksService],
48    addedServices: [],
49  })
50}
### Backend PrismaService with Connection Pooling
The backend's database service handles connection pooling, SSL configuration, and custom URL parsing:

>
Source: [prisma/prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L14-L47)

typescript1@Injectable()
2export class PrismaService
3  extends PrismaClient
4  implements OnModuleInit, OnModuleDestroy
5{
6  private readonly pool: pg.Pool;
7
8  constructor() {
9    const databaseUrl = process.env.DATABASE_URL;
10    if (!databaseUrl) {
11      throw new Error('DATABASE_URL environment variable is not set');
12    }
13
14    const parsed = PrismaService.parseDatabaseUrl(databaseUrl);
15    const sslConfig = PrismaService.getSSLConfig(parsed.sslMode);
16
17    const pool = new pg.Pool({
18      connectionString: parsed.connectionString,
19      max: parsed.connectionLimit ?? 20,
20      idleTimeoutMillis: 30000,
21      connectionTimeoutMillis: parsed.connectTimeout ?? 10000,
22      ssl: sslConfig,
23    });
24
25    const adapter = new PrismaPg(pool, { schema: parsed.schema });
26
27    super({
28      adapter,
29      transactionOptions: { maxWait: 5000, timeout: 10000 },
30    });
31
32    this.pool = pool;
33  }
34}
### Using the Kernel Relay for HTTP Requests
The Relay module from the kernel provides a unified HTTP execution interface:

>
Source: [selfhost-web/src/kernel/relay.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/kernel/relay.ts)

typescript1export const Relay = (() => {
2  const module = () => getModule("relay")
3
4  return {
5    capabilities: () => module().capabilities,
6    canHandle: (request: RelayRequest): E.Either<RelayError, true> =>
7      module().canHandle(request),
8    execute: (
9      request: RelayRequest
10    ): {
11      cancel: () => Promise<void>
12      emitter: RelayEventEmitter<RelayRequestEvents>
13      response: Promise<E.Either<RelayError, RelayResponse>>
14    } => module().execute(request),
15  } as const
16})()
## Feature Highlights
### Supported Protocols

- **REST**: Full HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, CONNECT, OPTIONS, TRACE, custom)
- **GraphQL**: Schema introspection, multi-column docs, subscriptions
- **WebSocket**: Full-duplex communication
- **Server-Sent Events (SSE)**: Stream updates over HTTP
- **Socket.IO**: Real-time bidirectional communication
- **MQTT**: Publish/Subscribe messaging

### Collaboration Features

- **Teams**: Role-based access control with unlimited members
- **Workspaces**: Organize personal and team collections
- **Shared Collections**: Collaborative API request management
- **Environments**: Share variables across team members
- **Real-time Sync**: GraphQL subscriptions for live updates

### Developer Experience

- **Pre-request Scripts**: JavaScript snippets executed before requests
- **Post-request Tests**: Assertions and validations on responses
- **Code Generation**: Export requests as code snippets in 10+ languages
- **Import/Export**: cURL, Postman collections, OpenAPI/Swagger
- **Keyboard Shortcuts**: Comprehensive keyboard navigation
- **Internationalization (i18n)**: Community-driven translations

## Related Links

- [Architecture: Frontend Application](./3-architecture.2-frontend-application) - Detailed frontend architecture
- [Architecture: Backend Services](./3-architecture.3-backend-services) - Backend service design
- [Architecture: Cross-Platform Kernel](./3-architecture.4-cross-platform-kernel) - Kernel architecture
- [Deployment Guide](../2-deployment/1-quick-start) - Docker Compose deployment
- [README](https://github.com/xiexb/hoppscotch/blob/main/README.md) - Project overview and features
- [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml) - Deployment configuration
- [Hoppscotch Documentation](https://docs.hoppscotch.io) - Official documentation