# Introduction
Hoppscotch is an open-source API development ecosystem that helps developers create requests faster, saving precious time on development. It provides a lightweight, web-based interface for interacting with REST, GraphQL, WebSocket, Server-Sent Events (SSE), Socket.IO, and MQTT APIs, along with powerful features for team collaboration, testing, and automation.

## Overview
Hoppscotch (formerly known as Postwoman) is designed as a modern, open-source alternative to proprietary API client tools. Built with Vue.js and TypeScript, it runs as a Progressive Web App (PWA) and can be used directly in the browser, installed on desktops, or self-hosted on your own infrastructure.

The project follows a **modular architecture** built on a platform abstraction layer that allows Hoppscotch to run across multiple environments — from cloud-hosted web apps to self-hosted instances and desktop applications — while sharing a common codebase.

### Key Design Principles

- **Lightweight & Fast**: Minimalist UI design with real-time request/response capabilities
- **Cross-Platform**: Runs as a PWA in browsers, desktop app via Tauri, or self-hosted
- **Extensible**: Modular architecture with a platform definition system (`PlatformDef`) that allows different deployment targets
- **Offline-First**: Service Worker-based caching for offline support
- **Privacy-Focused**: Open-source with transparent data handling

## Architecture
Hoppscotch's architecture is built around a **core platform abstraction** that separates shared common code from platform-specific implementations.

加载图表中...
### Platform Abstraction Layer
The heart of Hoppscotch's architecture is the `PlatformDef` type, defined in the common package. This defines all platform-specific capabilities that must be implemented for each deployment target.

>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts#L23-L78)

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
### Module System
Hoppscotch uses a **HoppModule** system to organize cross-cutting concerns. Each module hooks into the application lifecycle at specific points:

>
Source: [modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts#L6-L59)

typescript1export type HoppModule = {
2  deprecated?: boolean
3  onVueAppInit?: (app: App) => void
4  onRouterInit?: (app: App, router: Router) => void
5  onRootSetup?: () => void
6  onBeforeRouteChange?: (
7    to: RouteLocationNormalized,
8    from: RouteLocationNormalized,
9    router: Router
10  ) => void | Promise<void>
11  onAfterRouteChange?: (to: RouteLocationNormalized, router: Router) => void
12}
13
14// Modules are auto-discovered from the filesystem
15export const HOPP_MODULES = pipe(
16  import.meta.glob("@modules/*.ts", { eager: true }),
17  Object.values,
18  A.map(({ default: defaultVal }) => defaultVal as HoppModule),
19  A.filter((module) => !module.deprecated)
20)
Built-in modules include:

- **dioc** — Dependency injection container
- **i18n** — Internationalization (30+ languages)
- **router** — Vue Router with page-based routing
- **theming** — Color mode and accent theme management
- **pwa** — Progressive Web App installation prompts
- **kernel-interceptors** — Request interceptor management
- **toast** — Notification system
- **loadingbar** — Navigation progress indicator

### Application Initialization
The application bootstrapping process follows a clear lifecycle:

加载图表中...
>
Source: [index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/index.ts#L24-L80)

typescript1export async function createHoppApp(
2  el: string | Element,
3  platformDef: PlatformDef
4) {
5  initKernel(getKernelMode())
6  Log.init()
7  setPlatformDef(platformDef)
8
9  const app = createApp(App)
10
11  // Initialize core services before app mounting
12  const initService = getService(InitializationService)
13  await initService.initPre()
14  await initService.initAuthAndSync()
15
16  HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app))
17  platformDef.addedHoppModules?.forEach((mod) => mod.onVueAppInit?.(app))
18
19  app.mount(el)
20  await initService.initPost()
21}
### App Initialization Flow
When the app boots, the `initializeApp()` function sets up all core subsystems:

>
Source: [helpers/app/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/app/index.ts#L5-L21)

typescript1export function initializeApp() {
2  if (!initialized) {
3    try {
4      platform.auth.performAuthInit()
5      platform.sync.settings.initSettingsSync()
6      platform.sync.collections.initCollectionsSync()
7      platform.sync.history.initHistorySync()
8      platform.sync.environments.initEnvironmentsSync()
9      platform.analytics?.initAnalytics()
10      initialized = true
11    } catch (_e) {
12      initialized = true
13    }
14  }
15}
## Core Features
Hoppscotch supports a wide range of API protocols and developer tools:

### Supported Protocols
加载图表中...
### Developer Tools
FeatureDescription**Authorization**None, Basic, Bearer Token, OAuth 2.0, OIDC Access Token/PKCE**Pre-Request Scripts**JavaScript snippets executed before each request**Post-Request Tests**JavaScript-based assertions on responses**Environments**Variable management with unlimited environments**Collections**Organize requests with nested folders and cloud sync**History**Automatic request history with search and favorites**Code Generation**Generate request snippets in 10+ languages**cURL Import**Import requests from cURL commands**Bulk Edit**Edit key-value pairs in bulk format**Theming**Customizable themes with multiple accent colors**i18n**Internationalized in 30+ languages**Keyboard Shortcuts**Optimized keyboard-driven workflow
### Environment Variables & Settings
The app exposes a reactive settings system via composables:

>
Source: [composables/settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/settings.ts#L6-L24)

typescript1export function useSetting<K extends keyof SettingsDef>(
2  settingKey: K
3): Ref<SettingsDef[K]> {
4  return useStream(
5    settingsStore.subject$.pipe(pluck(settingKey), distinctUntilChanged()),
6    settingsStore.value[settingKey],
7    (value: SettingsDef[K]) => {
8      settingsStore.dispatch({
9        dispatcher: "applySetting",
10        payload: { settingKey, value },
11      })
12    }
13  )
14}
### Backend GraphQL Client
Hoppscotch communicates with its backend via a GraphQL API. The client is built with URQL and supports authentication, subscriptions, and error handling:

>
Source: [helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts#L30-L33)

typescript1const BACKEND_GQL_URL =
2  import.meta.env.VITE_BACKEND_GQL_URL ?? "https://api.hoppscotch.io/graphql"
3const BACKEND_WS_URL =
4  import.meta.env.VITE_BACKEND_WS_URL ?? "wss://api.hoppscotch.io/graphql"
The GQL client supports queries, mutations, and subscriptions with proper error handling, auth exchange, and automatic retry on token expiry.

## Repository Structure
The monorepo is organized into the following package structure:

1packages/
2├── hoppscotch-common/          # Shared common code (core)
3│   ├── src/
4│   │   ├── components/         # Vue components
5│   │   ├── composables/        # Vue composables
6│   │   ├── helpers/            # Utility functions
7│   │   ├── modules/            # HoppModule system
8│   │   ├── platform/           # Platform abstraction layer
9│   │   ├── services/           # DIOC service classes
10│   │   └── pages/              # Page components
11│   ├── locales/                # i18n translations
12│   └── assets/                 # SCSS themes and assets
13│
14├── hoppscotch-selfhost-web/    # Self-hosted web deployment
15│   └── src/
16│       ├── api/                # GraphQL queries & mutations
17│       └── platform/           # Self-host platform definition
18│
19├── hoppscotch-sh-admin/        # Admin dashboard
20│   ├── locales/                # Admin i18n translations
21│   └── assets/                 # Admin SCSS themes
22│
23├── hoppscotch-agent/           # Desktop Tauri agent
24│   └── src-tauri/             # Rust backend for desktop
25│
26├── hoppscotch-kernel/          # Request execution engine
27├── hoppscotch-js-sandbox/      # JavaScript sandbox for scripts
28├── hoppscotch-data/            # Data models
29├── hoppscotch-cli/             # CLI tool
30└── codemirror-lang-graphql/    # GraphQL code editor language
### Platform Implementations
Different platform targets implement the common `PlatformDef` interface:

PlatformPackageDescription**Self-Host Web**`hoppscotch-selfhost-web`Docker-based self-hosted deployment with Caddy**Admin Dashboard**`hoppscotch-sh-admin`Admin interface for managing teams and users**Desktop Agent**`hoppscotch-agent`Tauri-based desktop application with Rust backend**Cloud**Hosted at hoppscotch.ioOfficial cloud-hosted version
## Configuration Options
### Environment Variables
VariableDefaultDescription`VITE_BACKEND_GQL_URL``https://api.hoppscotch.io/graphql`Backend GraphQL endpoint URL`VITE_BACKEND_WS_URL``wss://api.hoppscotch.io/graphql`Backend WebSocket endpoint for subscriptions`VITE_BASE_URL`—Base URL for asset paths and meta tags`VITE_PROXY_URL`—Custom proxy server URL`VITE_ADMIN_URL`—Admin dashboard URL
### App Meta Information
>
Source: [meta.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/meta.ts#L3-L18)

typescript1export const APP_INFO = {
2  name: "Hoppscotch",
3  shortDescription: "Open source API development ecosystem",
4  description:
5    "Helps you create requests faster, saving precious time on development.",
6  keywords:
7    "hoppscotch, hopp scotch, hoppscotch online, hoppscotch app, ...",
8  app: {
9    background: "#181818",
10    lightThemeColor: "#ffffff",
11    darkThemeColor: "#181818",
12  },
13  social: {
14    twitter: "@hoppscotch_io",
15  },
16} as const
## Deployments
Hoppscotch supports multiple deployment strategies:

加载图表中...
## Use Cases
Hoppscotch is designed for a variety of API development scenarios:

- **API Development & Testing** — Quickly test REST, GraphQL, WebSocket, SSE, Socket.IO, and MQTT endpoints
- **Team Collaboration** — Share collections, environments, and workspaces across teams
- **CI/CD Integration** — Use Hoppscotch CLI for automated API testing in pipelines
- **API Documentation** — Generate and publish API documentation from collections
- **Mock Servers** — Create mock API servers for frontend development
- **Offline Testing** — Use the PWA offline capabilities for testing without internet
- **Cross-Origin Testing** — Built-in proxy support to bypass CORS restrictions

## Related Links

- [Repository README](https://github.com/xiexb/hoppscotch/blob/main/README.md)
- [Hoppscotch Documentation](https://docs.hoppscotch.io)
- [Hoppscotch Website](https://hoppscotch.io)
- [Hoppscotch CLI](https://github.com/hoppscotch/hoppscotch/tree/main/packages/hoppscotch-cli)
- [Proxy Server (Proxyscotch)](https://github.com/hoppscotch/proxyscotch)
- [Browser Extensions](https://github.com/hoppscotch/hoppscotch-extension)
- [Contributing Guidelines](https://github.com/xiexb/hoppscotch/blob/main/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/xiexb/hoppscotch/blob/main/CODE_OF_CONDUCT.md)
- [Changelog](https://github.com/xiexb/hoppscotch/blob/main/CHANGELOG.md)