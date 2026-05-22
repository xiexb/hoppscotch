# Tech Stack
Hoppscotch is a modern, open-source API development ecosystem built with a polyglot architecture leveraging TypeScript, Vue.js, NestJS, Go, and Rust. This document provides a comprehensive overview of the technologies powering each layer of the application.

## Overview
Hoppscotch is organized as a **monorepo** with multiple interconnected packages, each serving a distinct purpose. The architecture spans frontend web applications to backend services, desktop clients, CLI tools, and infrastructure components. The project uses **pnpm** as its package manager and relies on **workspaces** to manage cross-package dependencies efficiently.

The tech stack is deliberately chosen for:

- **Performance**: Using Go for the webapp server and Rust (via Tauri) for the desktop client ensures native-level performance
- **Type Safety**: TypeScript is used consistently across all packages, with Zod and io-ts for runtime validation
- **Modularity**: The monorepo structure with well-defined package boundaries enables independent development and testing
- **Real-time capabilities**: WebSocket, SSE, Socket.IO, and MQTT protocols are natively supported through a combination of kernel and common packages

## Architecture Overview
加载图表中...
## Frontend Technologies
### Web Applications
The main web frontends are built with **Vue 3** (Composition API) and **TypeScript**. The project uses Vue 3.5.33 across all frontend packages.

TechnologyVersionPurposeVue 33.5.33UI framework (Composition API)TypeScript5.9.3Type-safe JavaScriptVite7.3.2Build tool and dev serverTailwind CSS3.4.16Utility-first CSS frameworkVue Router4.6.4Client-side routingVue I18n11.4.0InternationalizationPinia (via VueUse)14.2.1State managementVueUse Core14.2.1Composition utilitiesVue Tippy6.7.1Tooltip componentsSplitpanes3.1.5Resizable split panelstippy.js6.3.7Tooltip/popover enginenprogress0.2.0Page loading progress
>
Source: [packages/hoppscotch-common/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/package.json)

### Desktop Application
The desktop client is built with **Tauri 2** (Rust-based), providing a native shell for the Vue.js web app:

TechnologyVersionPurposeTauri2.xDesktop application framework (Rust)Tauri CLI2.9.3Build and dev tooling@tauri-apps/api2.1.1JavaScript API for TauriRustedition 2021Backend logic and native integrationsserde1.xSerialization frameworktokio1.43.0Async runtimeaxum0.8.1HTTP server for IPC
Tauri plugins used:

- `tauri-plugin-shell` - Execute shell commands
- `tauri-plugin-store` - Persistent key-value storage
- `tauri-plugin-fs` - Filesystem access
- `tauri-plugin-updater` - Auto-update mechanism
- `tauri-plugin-dialog` - Native file dialogs
- `tauri-plugin-process` - Process management
- `tauri-plugin-deep-link` - Deep link handling
- `tauri-plugin-http` - HTTP client with gzip support
- `tauri-plugin-opener` - Open files/URLs with system handler

>
Source: [packages/hoppscotch-desktop/src-tauri/Cargo.toml](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-desktop/src-tauri/Cargo.toml)

### Editor Technologies
The application features powerful code editors built on **CodeMirror 6** and **Monaco Editor**:

typescript1// From packages/hoppscotch-common/package.json
2"@codemirror/autocomplete": "6.20.0",
3"@codemirror/commands": "6.10.0",
4"@codemirror/lang-javascript": "6.2.4",
5"@codemirror/lang-json": "6.0.2",
6"@codemirror/lang-xml": "6.1.0",
7"@codemirror/language": "6.11.3",
8"@codemirror/legacy-modes": "6.5.2",
9"@codemirror/lint": "6.9.2",
10"@codemirror/merge": "6.11.2",
11"@codemirror/search": "6.5.11",
12"@codemirror/state": "6.5.2",
13"@codemirror/view": "6.38.8",
14"@guolao/vue-monaco-editor": "1.6.0",
15"monaco-editor": "0.55.1"
>
Source: [packages/hoppscotch-common/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/package.json#L24-L37)

## Backend Technologies
### NestJS Backend
The backend API server is built with **NestJS 11** using the Express platform, with a GraphQL API layer powered by Apollo Server:

TechnologyVersionPurposeNestJS11.1.19Node.js frameworkExpress5.2.1HTTP server platformApollo Server5.5.0GraphQL server@nestjs/graphql13.3.0NestJS GraphQL integrationPrisma7.8.0Database ORMPostgreSQL15Relational databasePassport0.7.0Authentication strategiesJWT (jsonwebtoken)via @nestjs/jwt 11.0.2Token-based authnodemailer8.0.7Email transportHandlebars4.7.9Email template engineSwagger11.4.2API documentationclass-validator0.15.1Request validationclass-transformer0.5.1Object transformationargon20.44.0Password hashingbcrypt6.0.0Password hashing (legacy)
>
Source: [packages/hoppscotch-backend/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/package.json)

The backend module configuration from the source code shows the full dependency graph:

typescript1// From packages/hoppscotch-backend/src/app.module.ts
2@Module({
3  imports: [
4    ConfigModule.forRoot({ isGlobal: true }),
5    GraphQLModule.forRootAsync<ApolloDriverConfig>({
6      driver: ApolloDriver,
7      // ...
8    }),
9    ThrottlerModule.forRootAsync({ /* ... */ }),
10    PrismaModule,
11    PubSubModule,
12    MailerModule,
13    UserModule,
14    AuthModule,
15    AdminModule,
16    TeamModule,
17    // ... more modules
18  ],
19  controllers: [AppController],
20})
21export class AppModule {}
>
Source: [packages/hoppscotch-backend/src/app.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts#L42-L137)

### Webapp Server (Go)
The static asset server for the self-hosted web app is written in **Go 1.24**, serving frontend builds as signed, compressed bundles:

TechnologyVersionPurposeGo1.26.2 (build) / 1.24.0 (module)Static web serverklauspost/compress1.18.0Zstd compression for bundleszeebo/blake30.2.4Cryptographic hashing (Ed25519 signing)
The server provides endpoints for bundle distribution:

go1// From webapp-server/internal/server/server.go
2func (s *Server) RegisterRoutes(mux *http.ServeMux) {
3    mux.HandleFunc("/health", s.HandleHealth)
4    mux.HandleFunc("/api/v1/manifest", s.HandleManifest)
5    mux.HandleFunc("/api/v1/bundle", s.HandleDownloadBundle)
6    mux.HandleFunc("/api/v1/key", s.HandleKey)
7}
>
Source: [packages/hoppscotch-selfhost-web/webapp-server/internal/server/server.go](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/webapp-server/internal/server/server.go#L136-L145)

### Database
prisma1// From packages/hoppscotch-backend/prisma/schema.prisma
2generator client {
3  provider = "prisma-client"
4  output   = "../src/generated/prisma"
5}
6
7datasource db {
8  provider = "postgresql"
9}
>
Source: [packages/hoppscotch-backend/prisma/schema.prisma](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L1-L8)

The database model includes entities for Teams, Users, Collections, Requests, Environments, History, Shortcodes, Access Tokens, and more.

## Shared Libraries & Packages
### @hoppscotch/data (Data Types & Validation)
Provides cross-package data structures with runtime validation:

TechnologyVersionPurposefp-ts2.16.11Functional programming utilitiesio-ts2.2.22Runtime type validationzod3.25.32Schema validationverzod0.4.0Zod-based validation helpersuuid13.0.0Unique ID generationjose6.2.2JOSE standards implementation
### @hoppscotch/js-sandbox (JavaScript Execution)
Provides isolated JavaScript execution for pre-request scripts and post-response tests:

TechnologyVersionPurposeacorn8.16.0JavaScript parserchai6.2.2Assertion library for testsfaraday-cage0.1.0Secure sandboxingisolated-vm6.1.2 (optional peer)V8 Isolate for Node.js
### @hoppscotch/kernel (Cross-platform Runtime)
Provides platform abstraction for the application kernel, bridging web, desktop, and agent environments:

TechnologyVersionPurposeaxios1.15.2HTTP clientaws4fetch1.0.20AWS signing for HTTP requestssuperjson2.2.6Super JSON serializationfp-ts2.16.11Functional programming
### @hoppscotch/cli (Command-line Tool)
The CLI tool for running Hoppscotch test scripts in CI/CD pipelines:

TechnologyVersionPurposecommander14.0.3CLI argument parsingaxios1.15.2HTTP clientisolated-vm6.1.2Sandboxed JS executionpapaparse5.5.3CSV parsingtough-cookie6.0.1Cookie managementchalk5.6.2Terminal styling
## Build & Development Tooling
### Core Build Infrastructure
加载图表中...
### Key Tool Versions
ToolVersionPurposepnpm10.33.2Package manager (monorepo)Node.js>=22Runtime requirementVite7.3.2Build tool across all web packagesTypeScript5.9.3Language compilerESBuildvia ViteJavaScript bundlerRollup4.60.2 (4.59.0 in some packages)Library bundlingESLint9.xLintingPrettier3.8.3Code formattingHusky9.1.7Git hooksVitest4.1.5Unit testing (frontend)Jest30.xUnit testing (backend)PostCSS8.5.10CSS processingSass1.99.0SCSS compilationTailwind CSS3.4.16Utility CSS framework
### Vite Plugins
The project uses a comprehensive set of Vite plugins for optimized builds:

typescript1// Key Vite plugins used in the project:
2"@vitejs/plugin-vue": "6.0.6",      // Vue SFC compilation
3"vite-plugin-pages": "0.33.3",       // File-based routing
4"vite-plugin-vue-layouts": "0.11.0", // Layout system
5"vite-plugin-pwa": "1.2.0",          // PWA support
6"vite-plugin-checker": "0.12.0",     // Type checking in dev
7"vite-plugin-html-config": "2.0.2",  // HTML meta injection
8"unplugin-icons": "22.5.0",          // Auto icon components
9"unplugin-vue-components": "30.0.0", // Auto component import
10"unplugin-fonts": "1.4.0",           // Font optimization
11"@intlify/unplugin-vue-i18n": "11.1.2" // i18n compilation
>
Sources:

- [packages/hoppscotch-common/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/package.json)
- [packages/hoppscotch-selfhost-web/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/package.json)

## GraphQL & API Layer
### GraphQL Infrastructure
The backend uses a sophisticated GraphQL setup with code generation:

ToolVersionPurpose@nestjs/graphql13.3.0GraphQL module for NestJS@apollo/server5.5.0Apollo GraphQL server@nestjs/apollo13.3.0Apollo driver for NestJSgraphql16.13.2GraphQL runtimegraphql-redis-subscriptions2.7.0Real-time subscriptions (Redis)graphql-subscriptions3.0.0Subscription infrastructuregraphql-query-complexity1.1.0Query complexity analysissubscriptions-transport-ws0.11.0WebSocket transport
### GraphQL Code Generation
json1{
2  "@graphql-codegen/cli": "6.3.1",
3  "@graphql-codegen/typescript": "5.0.10",
4  "@graphql-codegen/typescript-operations": "5.1.0",
5  "@graphql-codegen/typed-document-node": "6.1.8",
6  "@graphql-codegen/typescript-urql-graphcache": "3.1.1",
7  "@graphql-codegen/urql-introspection": "3.0.1"
8}
### Frontend GraphQL Client (urql)
typescript1// Dependencies from @hoppscotch/common
2"@urql/core": "6.0.1",
3"@urql/exchange-auth": "3.0.0",
4"@urql/devtools": "2.0.3",
5"wonka": "6.3.6"
>
Sources:

- [packages/hoppscotch-common/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/package.json#L55-L58)
- [packages/hoppscotch-backend/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/package.json)

## Authentication Stack
The authentication system supports multiple strategies:

加载图表中...
>
Source: [packages/hoppscotch-backend/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/package.json#L68-L78)

## Infrastructure & Deployment
### Docker Deployment
The application is containerized using Docker with multi-stage builds:

1prod.Dockerfile
2├── go_builder       →  caddy_builder (Caddy 2.11.2)
3│                    →  webapp_server_builder (Go webapp server)
4├── node_base        →  base_builder (Node.js + pnpm install)
5│   ├── backend_builder → backend (NestJS API)
6│   ├── fe_builder      → app (Web app + Caddy + webapp-server)
7│   └── sh_admin_builder → sh_admin (Admin dashboard + Caddy)
8└── aio (All-in-one container with all services)
Container ComponentTechnologyPortBackend APINestJS + Caddy3170, 80Web AppVue.js + Caddy + Go webapp-server3000, 3200, 80Admin DashboardVue.js + Caddy3100, 80DatabasePostgreSQL 155432MigrationPrisma CLI (ephemeral)-
### Reverse Proxy Configuration
**Caddy 2.11.2** is used as the primary reverse proxy and static file server, with custom-built binary from source with security patches.

>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

## Monorepo Package Architecture
加载图表中...
### Package Dependency Graph
PackageNameDependencies OnTypehoppscotch-common`@hoppscotch/common`data, kernel, js-sandboxShared Vue logichoppscotch-selfhost-web`@hoppscotch/selfhost-web`common, data, kernelWeb applicationhoppscotch-desktop`hoppscotch-desktop`common, kernelDesktop (Tauri)hoppscotch-sh-admin`hoppscotch-sh-admin`backendAdmin dashboardhoppscotch-backend`hoppscotch-backend`-API server (NestJS)hoppscotch-cli`@hoppscotch/cli`data, js-sandboxCLI toolhoppscotch-data`@hoppscotch/data`-Data types/validationhoppscotch-kernel`@hoppscotch/kernel`-Cross-platform runtimehoppscotch-js-sandbox`@hoppscotch/js-sandbox`dataScript executioncodemirror-lang-graphql`@hoppscotch/codemirror-lang-graphql`codemirrorGraphQL editor
## Related Links

- [Architecture Overview](./1-overview.1-architecture)
- [Getting Started](./1-overview.2-getting-started)
- [Source Code - Root package.json](https://github.com/xiexb/hoppscotch/blob/main/package.json)
- [Source Code - Docker Configuration](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)
- [Source Code - Backend App Module](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts)