# Local Development Setup
This guide provides detailed instructions for setting up your local Hoppscotch development environment, including prerequisites, cloning the repository, configuring dependencies, and running the various packages in development mode.

## Overview
Hoppscotch is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces), containing multiple packages that together form the complete API development ecosystem. The project uses modern tooling throughout: **Vue 3 + Vite** for the frontend (self-hosted web app and admin dashboard), **NestJS** for the backend API (GraphQL + REST), **Go** for the static webapp server, and **Tauri** for the desktop application.

>
Source: [package.json](%7B%7Bfile_base_url%7D%7D/package.json#L1-L26)

The monorepo is organized into the following packages:

PackageDescription`@hoppscotch/common`Shared UI components, composables, and platform abstractions (Vue 3)`@hoppscotch/selfhost-web`The main self-hosted web application (frontend)`hoppscotch-backend`NestJS backend with GraphQL API (PostgreSQL + Prisma)`@hoppscotch/sh-admin`Self-hosted admin dashboard`hoppscotch-desktop`Tauri-based desktop application`@hoppscotch/cli`CLI for running test scripts in CI environments`@hoppscotch/data`Data models and types`@hoppscotch/kernel`Request execution kernel`@hoppscotch/js-sandbox`JavaScript sandbox for pre-request/response scripts`@hoppscotch/agent`Hoppscotch agent for proxy-based interceptions`@hoppscotch/relay`Relay service
## Architecture
The diagram below illustrates the architecture of the complete Hoppscotch development environment and how the various components interact.

加载图表中...
**Key relationships:**

- The **selfhost-web** and **sh-admin** packages share components from the **@hoppscotch/common** library and both communicate with the backend via GraphQL
- The **backend** (NestJS) provides a GraphQL API on port `3170` and uses **Prisma** for database access (PostgreSQL)
- The **webapp-server** (Go) serves the built frontend and admin static assets on ports `3000` and `3100` respectively
- **Caddy** acts as a reverse proxy routing traffic to the appropriate services
- The **desktop** (Tauri) application reuses the same `@hoppscotch/common` library but runs natively with additional platform features

## Prerequisites
Before setting up the development environment, ensure you have the following installed:

ToolVersionPurpose**Node.js**22.xJavaScript runtime**pnpm**10.xPackage manager (monorepo workspace)**Docker**LatestRunning PostgreSQL database and other services**Git**LatestVersion control
>
Source: [devenv.nix](%7B%7Bfile_base_url%7D%7D/devenv.nix#L33-L34)

### Installing pnpm
If you don't have pnpm installed, install it globally via npm:

bash`npm install -g pnpm@10.33.2`
## Getting Started
### Step 1: Clone the Repository
bashgit clone https://github.com/xiexb/hoppscotch.git
cd hoppscotch
### Step 2: Install Dependencies
The root workspace manages all packages via a single `pnpm-lock.yaml` file. Install all dependencies with:

bash`pnpm install`
>
Source: [package.json](%7B%7Bfile_base_url%7D%7D/package.json#L10-L12)

This will also trigger `postinstall` scripts that:

- Generate Prisma client code
- Generate GraphQL schema definition language (SDL) files from the backend
- Generate GraphQL code for the frontend packages

### Step 3: Set Up Environment Variables
The project uses environment variables stored in a `.env` file at the repository root. These are used by both the backend and frontend packages.

Copy the environment example template (referenced during Firebase deployment):

bash# Create a .env file from example template
cp .env.example .env
>
Note: The `.env.example` file template is referenced in the `firebase.json` predeploy script and referenced in the `@hoppscotch/sh-admin` docs. If it doesn't exist in your branch, create a `.env` file with the required variables listed below.

>
Source: [firebase.json](%7B%7Bfile_base_url%7D%7D/firebase.json#L8)

Here are the essential environment variables needed:

bash1# Database - Required for backend
2DATABASE_URL=postgresql://postgres:testpass@localhost:5432/hoppscotch?connect_timeout=300
3
4# Backend
5PORT=3170
6PRODUCTION=false
7WHITELISTED_ORIGINS=http://localhost:3000,http://localhost:3100
8
9# Frontend (prefixed with VITE_)
10VITE_BASE_URL=http://localhost:3000
11VITE_BACKEND_GQL_URL=http://localhost:3170/graphql
12VITE_BACKEND_GQL_SUB_URL=ws://localhost:3170/graphql
13VITE_ALLOWED_AUTH_PROVIDERS=email,google,github,microsoft
>
Source: [devenv.nix](%7B%7Bfile_base_url%7D%7D/devenv.nix#L41-L44) | [backend/src/main.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/main.ts#L46-L49)

### Step 4: Start the Database
The backend requires a PostgreSQL database. The easiest way is using Docker:

bash# Start just the PostgreSQL database
docker compose --profile database up -d
>
Source: [docker-compose.yml](%7B%7Bfile_base_url%7D%7D/docker-compose.yml#L137-L167)

This starts a PostgreSQL 15 instance on port `5432` with:

- **User:** `postgres`
- **Password:** `testpass`
- **Database:** `hoppscotch`

### Step 5: Run Database Migrations
After the database is running, apply the Prisma migrations:

bashcd packages/hoppscotch-backend
pnpm exec prisma migrate deploy
cd ../..
>
Source: [docker-compose.yml](%7B%7Bfile_base_url%7D%7D/docker-compose.yml#L169-L180)

The Prisma schema is located at:

>
Source: [prisma/schema.prisma](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/prisma/schema.prisma)

### Step 6: Start the Backend (Development Mode)
bashcd packages/hoppscotch-backend
pnpm run start:dev
This starts the NestJS backend in watch mode on port `3170` (or the port specified in your `.env` file). It provides:

- **GraphQL Playground:** Available at `http://localhost:3170/graphql` (disabled in production)
- **Swagger API Docs:** Available at `http://localhost:3170/api-docs`
- **Health Check:** `GET http://localhost:3170/ping` returns `"Success"`

>
Source: [backend/src/main.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/main.ts#L42-L91) | [backend/src/app.controller.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/app.controller.ts#L4-L10)

**Key backend features in dev mode:**

- CORS allows all origins (`origin: true`) for local development
- GraphQL Playground is enabled for interactive query testing
- Request logging via Morgan middleware
- Hot-reload via NestJS watch mode

### Step 7: Start the Web Application (Development Mode)
In a separate terminal, start the self-hosted web application:

bashcd packages/hoppscotch-selfhost-web
pnpm run dev
This starts the Vite dev server on port `3000` with hot module replacement (HMR). The app will automatically connect to the backend GraphQL API.

### Step 8: Start the Admin Dashboard (Optional)
For the admin dashboard (self-hosted management):

bashcd packages/hoppscotch-sh-admin
pnpm run dev
This starts the admin dashboard on port `3100`.

## Running Complete Stack with Docker
For a full local environment that includes all services, use Docker Compose with the appropriate profile:

bash1# Start all services (AIO + database + auto-migration)
2docker compose --profile default up
3
4# Start backend + database only (no frontend)
5docker compose --profile just-backend up
6
7# Start backend services + database
8docker compose --profile backend up
>
Source: [docker-compose.yml](%7B%7Bfile_base_url%7D%7D/docker-compose.yml#L234-L254)

## Core Flow
The following sequence diagram illustrates how a typical development workflow proceeds when a developer makes changes and tests them locally:

加载图表中...
## Usage Examples
### Running Tests
To run tests across the workspace:

bash1# Run all tests
2pnpm run test
3
4# Run backend tests only
5cd packages/hoppscotch-backend
6pnpm run test
7
8# Run frontend tests for common package
9cd packages/hoppscotch-common
10pnpm run test
### Linting and Type Checking
bash1# Lint all packages
2pnpm run lint
3
4# Type-check all packages
5pnpm run typecheck
6
7# Auto-fix lint issues
8pnpm run lintfix
>
Source: [package.json](%7B%7Bfile_base_url%7D%7D/package.json#L17-L20)

### Using the Webapp Server Standalone (Go)
For running the Go-based webapp server in development mode directly:

bashcd packages/hoppscotch-selfhost-web/webapp-server
GO_ENV=development go run .
This starts the webapp server on port `3200` (default).

>
Source: [webapp-server/README.md](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-selfhost-web/webapp-server/README.md#L5-L10)

### Testing the CLI Package
After building the CLI, test it locally using pnpm linking:

bash1# Link the package
2pnpm link @hoppscotch/cli
3
4# Run the CLI
5pnpm exec hopp
6
7# After testing, remove the link
8pnpm rm @hoppscotch/cli
>
Source: [hoppscotch-cli/CONTRIBUTING.md](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-cli/CONTRIBUTING.md#L21-L40)

## Development Environment with Devenv
For Nix users, the repository includes a `devenv.nix` configuration that automatically sets up a reproducible development environment with all required tools:

bash# Enter the devenv shell
devenv shell
This provides:

- **Node.js 22** and **pnpm** for JavaScript development
- **Go 1.25** for the webapp server
- **Rust nightly** (with Tauri toolchain) for desktop development
- **Docker/Colima/Lima** utilities for container management
- **Prisma engines** for database operations
- **Linux desktop libraries** (webkitgtk, libsoup) for Tauri builds on Linux

>
Source: [devenv.nix](%7B%7Bfile_base_url%7D%7D/devenv.nix#L24-L53) | [devenv.yaml](%7B%7Bfile_base_url%7D%7D/devenv.yaml)

## Key Development Packages
### `packages/hoppscotch-common`
The shared library used by the web app, desktop app, and admin dashboard. It contains:

- Vue components and composables
- Platform abstraction layers (auth, environments, collections, settings, history)
- Kernel interceptors (browser, proxy, agent, extension, native)
- GraphQL queries and mutations

### `packages/hoppscotch-backend`
The NestJS backend server providing a GraphQL API. Key modules include:

- **Auth** — Authentication with OAuth2 providers (Google, GitHub, Microsoft) and email
- **User** — User management, settings, environments, history, requests, collections
- **Team** — Team management, collections, environments, invitations, requests
- **Admin** — Admin panel and infrastructure configuration
- **Prisma** — Database access with PostgreSQL
- **Shortcode** — URL shortcode generation
- **Mock Server** — API mocking capabilities
- **Published Docs** — Documentation publishing

### `packages/hoppscotch-selfhost-web/webapp-server`
A Go-based static file server that:

- Serves the built frontend and admin assets
- Provides content bundling with zstd compression
- Implements bundle signing with ED25519 for integrity verification
- Exposes a manifest API for the desktop app to download updates

### `packages/hoppscotch-desktop`
A Tauri desktop application that wraps the web app with native capabilities:

- File system access via Tauri plugins
- Native system tray and window management
- Desktop-specific keyboard shortcuts
- Support for kernel interceptors (native, proxy)

## Troubleshooting
### Port Conflicts
If you encounter port conflicts, the default ports used are:

ServiceDefault PortFrontend (Vite dev)3000Admin Dashboard3100Backend (NestJS)3170Webapp Server3200PostgreSQL5432Caddy (HTTP)80Caddy (Backend)3080
### Common Issues
**"Cannot find module" errors:**
Ensure `pnpm install` was run from the repository root and all dependencies are installed. The workspace uses hoisted dependencies, so some packages may need their `node_modules` to be present in the root.
**Prisma errors connecting to database:**
Verify PostgreSQL is running and the `DATABASE_URL` in your `.env` file is correct. For Docker, ensure the container is healthy:
bash`docker ps --filter "name=hoppscotch-db"`
**GraphQL schema generation fails:**
The codegen requires a running backend instance for certain schema generation steps. For development, the `postinstall` script handles basic codegen. If you need to regenerate:
bashcd packages/hoppscotch-common
pnpm run gql-codegen
**Tauri build issues on Linux:**
Ensure system dependencies for WebKit are installed:
bash# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev libappindicator3-dev
## Related Links

- [Hoppscotch Documentation](https://docs.hoppscotch.io) — Official Hoppscotch documentation
- [README](%7B%7Bfile_base_url%7D%7D/README.md) — Project overview and features
- [Contributing Guide](%7B%7Bfile_base_url%7D%7D/CONTRIBUTING.md) — Pull request process and guidelines
- [Docker Compose Configuration](%7B%7Bfile_base_url%7D%7D/docker-compose.yml) — Docker deployment configurations
- [Backend AppModule](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/app.module.ts) — NestJS backend module layout
- [Webapp Server README](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-selfhost-web/webapp-server/README.md) — Go webapp server documentation
- [CLI Contributing Guide](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-cli/CONTRIBUTING.md) — CLI development setup
- [Admin Dashboard README](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/README.md) — Self-hosted admin setup