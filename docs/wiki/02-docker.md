# Running with Docker
Hoppscotch provides a complete Docker-based deployment solution for self-hosting. The recommended setup uses Docker Compose with profile-based service selection, allowing you to run a full Hoppscotch instance — including the backend API, self-host web app, admin dashboard, and PostgreSQL database — with minimal configuration.

## Overview
The Docker deployment system is designed for teams and organizations that want to self-host Hoppscotch. It offers multiple deployment scenarios:

- **All-in-One (AIO)** — Run all services in a single container for simplicity
- **Separate Services** — Deploy backend, web app, and admin dashboard independently for scalability
- **Development Setup** — Run backend services without the webapp for local development

All Docker images are built from a single multi-stage `prod.Dockerfile` that compiles Caddy (reverse proxy), builds the webapp server (Go), compiles frontend assets, and packages the Node.js backend. The system uses **Caddy** as the HTTP server and reverse proxy, providing automatic routing, static file serving, and subpath-based access when configured.

## Architecture
The Docker deployment consists of several containerized services that work together:

加载图表中...
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

### Component Roles
ComponentContainerRole**Backend Server**`hoppscotch-backend`NestJS/Node.js API server. Handles all API requests, user authentication, team management, collection storage, and GraphQL queries. Runs on port `3170`.**Web App**`hoppscotch-app`Serves the main Hoppscotch web interface (`selfhost-web`) as a static SPA. Includes a Go-based webapp server that proxies GraphQL requests. Serves on port `3000` (SPA) and `3200` (webapp server).**Admin Dashboard**`hoppscotch-sh-admin`Serves the self-host admin panel as a static SPA. Built in two variants: multiport-setup and subpath-access. Serves on port `3100`.**All-in-One**`hoppscotch-aio`Combines backend, web app, admin dashboard, and Caddy into a single container. The entry point `aio_run.mjs` spawns all processes. The recommended deployment for most users.**Database**`hoppscotch-db`PostgreSQL 15 instance providing persistent storage for all data.**Migration**`hoppscotch-migrate`One-shot service that runs Prisma database migrations on startup. Ensures the database schema is up-to-date.
### Docker Compose Profiles
Hoppscotch uses Docker Compose profiles to manage different deployment scenarios and avoid port conflicts:

加载图表中...
>
Source: [docker-compose.yml - Profiles Section](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L5-L17)

## Docker Compose Configuration
### Deployment Scenarios
#### 1. Default Deployment (Recommended)
The simplest way to get started. This profile starts the AIO container, PostgreSQL database, and auto-migration service:

bash`docker compose --profile default up`
>
Source: [docker-compose.yml - Line 21](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L21)

This starts the following services:

- `hoppscotch-aio` — All-in-one container (exposed on ports 3000, 3100, 3170, 3200)
- `hoppscotch-db` — PostgreSQL 15
- `hoppscotch-migrate` — Auto-migration (runs `prisma migrate deploy`, then exits)

#### 2. Default Deployment Without Database
If you already have an external PostgreSQL instance, use this profile to skip the bundled database:

bash`docker compose --profile default-no-db up`
>
Source: [docker-compose.yml - Line 22](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L22)

You must set the `DATABASE_URL` environment variable in your `.env` file to point to your external database.

#### 3. Individual Service Deployment
For granular control, deploy specific services independently:

bash1# Backend service only
2docker compose --profile backend up
3
4# Web app only
5docker compose --profile app up
6
7# Admin dashboard only
8docker compose --profile admin up
9
10# Database only
11docker compose --profile database up
>
Source: [docker-compose.yml - Lines 243-247](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L243-L247)

>
**Note:** The `default` and `default-no-db` profiles should not be mixed with individual service profiles as they would conflict on ports.

### Port Mapping
ServiceHost PortContainer PortProtocolPurpose`hoppscotch-aio``3000``3000`HTTPSelf-host web SPA`hoppscotch-aio``3100``3100`HTTPAdmin dashboard SPA`hoppscotch-aio``3170``3170`HTTPBackend API`hoppscotch-aio``3200``3200`HTTPWebapp server (GraphQL proxy)`hoppscotch-aio``3080``80`HTTPInternal Caddy port`hoppscotch-backend``3170``3170`HTTPBackend API`hoppscotch-backend``3180``80`HTTPInternal Caddy port`hoppscotch-app``3000``3000`HTTPSelf-host web SPA`hoppscotch-app``3200``3200`HTTPWebapp server`hoppscotch-app``3080``80`HTTPInternal Caddy port`hoppscotch-sh-admin``3100``3100`HTTPAdmin dashboard`hoppscotch-sh-admin``3280``80`HTTPInternal Caddy port`hoppscotch-db``5432``5432`TCPPostgreSQL
## Core Flow
### AIO Container Startup Sequence
The All-in-One container uses a Node.js entry point (`aio_run.mjs`) to orchestrate all internal services:

加载图表中...
>
Source: [aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs)

### How the AIO Entry Point Works
The `aio_run.mjs` script at the root of the repository orchestrates three child processes:

- **Environment Processing** — Filters `VITE_*` environment variables and injects them into the static SPA files using `import-meta-env`. This allows runtime configuration of the frontend without rebuilding.
- **Caddy Reverse Proxy** — Selects the appropriate Caddyfile based on `ENABLE_SUBPATH_BASED_ACCESS` and starts Caddy to handle routing and static file serving.
- **Backend Server** — Starts the Node.js NestJS backend application on port 8080.
- **Webapp Server** — Starts the Go-based webapp server on port 3200.

All child processes are monitored. If any exits unexpectedly, the entire container exits to allow Docker to restart it.

javascript1// aio_run.mjs - Core process spawning logic
2const caddyFileName = process.env.ENABLE_SUBPATH_BASED_ACCESS === 'true'
3  ? 'aio-subpath-access.Caddyfile'
4  : 'aio-multiport-setup.Caddyfile'
5const caddyProcess = runChildProcessWithPrefix("caddy", ["run", "--config", `/etc/caddy/${caddyFileName}`, "--adapter", "caddyfile"], "App/Admin Dashboard Caddy")
6const backendProcess = runChildProcessWithPrefix("node", ["/dist/backend/dist/src/main.js"], "Backend Server")
7const webappProcess = runChildProcessWithPrefix("webapp-server", [], "Webapp Server")
>
Source: [aio_run.mjs - Lines 53-56](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs#L53-L56)

### Request Routing
Caddy handles all incoming HTTP requests and routes them to the appropriate service:

加载图表中...
## Build Process
The Docker image is built using a sophisticated multi-stage `prod.Dockerfile`. Each stage compiles only what is needed, resulting in optimized production images:

加载图表中...
>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

### Build Targets
When building the Docker image, you can specify a target to build specific components:

bash1# Build all-in-one image (recommended)
2docker build --target aio -t hoppscotch/aio .
3
4# Build backend-only image
5docker build --target backend -t hoppscotch/backend .
6
7# Build web app image
8docker build --target app -t hoppscotch/app .
9
10# Build admin dashboard image
11docker build --target sh_admin -t hoppscotch/admin .
>
Source: [prod.Dockerfile - Target Definitions](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

## Usage Examples
### Quick Start (Default Deployment)

-
**Clone the repository**:

bashgit clone https://github.com/xiexb/hoppscotch.git
cd hoppscotch

-
**Create a `.env` file** with your configuration:

env1# Database URL (default for built-in PostgreSQL)
2DATABASE_URL=postgresql://postgres:testpass@hoppscotch-db:5432/hoppscotch?connect_timeout=300
3
4# Optional: Enable subpath-based access instead of multi-port
5# ENABLE_SUBPATH_BASED_ACCESS=true

-
**Start the application**:

bash`docker compose --profile default up`

-
**Access the services**:

Main Web App: [http://localhost:3000](http://localhost:3000)
- Admin Dashboard: [http://localhost:3100](http://localhost:3100)
- Backend API: [http://localhost:3170](http://localhost:3170)

>
Source: [docker-compose.yml - Usage Comment](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L19-L24)

### Subpath-Based Access
For users who want all services on a single port (e.g., behind a reverse proxy), enable subpath-based access:

bash1# In your .env file
2ENABLE_SUBPATH_BASED_ACCESS=true
3
4# Then start
5docker compose --profile default up
This configuration routes traffic on a single port (80 or `HOPP_AIO_ALTERNATE_PORT`):

PathServes`/`Self-host web SPA`/admin/*`Admin dashboard`/backend/*`Backend API`/desktop-app-server/*`Webapp server
>
Source: [aio-subpath-access.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/aio-subpath-access.Caddyfile)

### Multi-Container Deployment
For production environments where you want to scale services independently:

bash1# Terminal 1: Start the database and migration
2docker compose --profile backend up -d hoppscotch-db
3
4# Terminal 2: Start the backend
5docker compose --profile backend up -d hoppscotch-backend
6
7# Terminal 3: Start the web app
8docker compose --profile app up -d hoppscotch-app
9
10# Terminal 4: Start the admin dashboard
11docker compose --profile admin up -d hoppscotch-sh-admin
### Using an External Database
If you have an existing PostgreSQL instance, update your `.env` file:

env`DATABASE_URL=postgresql://username:password@your-db-host:5432/hoppscotch?connect_timeout=300`
Then run without the bundled database:

bash`docker compose --profile default-no-db up`
Or use the deployment compose file:

bash`docker compose -f docker-compose.deploy.yml up -d`
>
Source: [docker-compose.deploy.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.deploy.yml)

>
**Note:** The deploy compose file uses the `ENABLE_SUBPATH_BASED_ACCESS=true` configuration by default and runs Prisma migrations as part of the container startup command.

## Configuration Options
### Environment Variables
The `DATABASE_URL` and `ENABLE_SUBPATH_BASED_ACCESS` are the primary configuration variables. Additional `VITE_*` environment variables can be set to configure the frontend at runtime.

OptionTypeDefaultDescription`DATABASE_URL`string`postgresql://postgres:testpass@hoppscotch-db:5432/hoppscotch?connect_timeout=300`PostgreSQL connection string for the backend. Required.`ENABLE_SUBPATH_BASED_ACCESS`boolean`false`When `true`, routes all services through a single port using subpaths (`/admin/`, `/backend/`) instead of separate ports.`HOPP_AIO_ALTERNATE_PORT`integer`80`Custom port for the AIO container when using subpath-based access.`HOPP_ALLOW_RUNTIME_ENV`boolean`true` (in Docker build)Enables runtime environment variable injection into frontend SPAs.`PORT`integer`8080` (backend)Internal port for the backend Node.js server.`POSTGRES_USER`string`postgres`PostgreSQL database username (for built-in DB).`POSTGRES_PASSWORD`string`testpass`PostgreSQL database password (for built-in DB). ⚠️ **Change this in production!**`POSTGRES_DB`string`hoppscotch`PostgreSQL database name (for built-in DB).`VITE_*`string—Frontend environment variables injected into SPAs at runtime. Any variable prefixed with `VITE_` is automatically available.
### Docker Compose Port Conflicts
The default configuration uses specific host ports that may conflict with existing services:

ProfilePotential Conflicts`default`Ports 3000, 3100, 3170, 3200, 3080`backend`Ports 3180, 3170`app`Ports 3080, 3000, 3200`admin`Ports 3280, 3100
To change host port mappings, edit the `ports:` section in `docker-compose.yml` before starting.

## Migration Handling
Database migrations are handled automatically in two ways:

### 1. Using the Migration Service (Recommended)
The `hoppscotch-migrate` service runs Prisma migrations as a separate container. It depends on the database being healthy, runs the migration, then exits:

yaml1hoppscotch-migrate:
2  profiles: ["default", "just-backend", "backend", "app", "admin"]
3  build:
4    dockerfile: prod.Dockerfile
5    context: .
6    target: backend
7  env_file:
8    - ./.env
9  depends_on:
10    hoppscotch-db:
11      condition: service_healthy
12  command: sh -c "pnpm exec prisma migrate deploy"
>
Source: [docker-compose.yml - Lines 169-180](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L169-L180)

### 2. Inline Migration (Deploy Configuration)
The `docker-compose.deploy.yml` runs migrations as part of the AIO container's startup command:

bash`"pnpm exec prisma migrate deploy && node /usr/src/app/aio_run.mjs"`
>
Source: [docker-compose.deploy.yml - Lines 39-42](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.deploy.yml#L39-L42)

This ensures the database schema is always up-to-date before the application starts.

## Health Checks
The AIO container includes a health check that verifies all services are responding:

bash1# healthcheck.sh - Checks service health
2if [ "$ENABLE_SUBPATH_BASED_ACCESS" = "true" ]; then
3  curlCheck "http://localhost:${HOPP_AIO_ALTERNATE_PORT:-80}/backend/ping" || exit 1
4else
5  curlCheck "http://localhost:3000" || exit 1
6  curlCheck "http://localhost:3100" || exit 1
7  curlCheck "http://localhost:3170/ping" || exit 1
8fi
>
Source: [healthcheck.sh](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh)

The Dockerfile configures the health check with:

- **Interval**: 2 seconds
- **Start Period**: 15 seconds (allows time for services to start)
- **Retries**: Up to 30 attempts

>
Source: [prod.Dockerfile - Line 250](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile#L250)

## Related Links

- [Getting Started Guide](./2-getting-started.1-overview)
- [Environment Configuration](./2-getting-started.2-environment-configuration)
- [Source: docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml) — Main Docker Compose configuration
- [Source: docker-compose.deploy.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.deploy.yml) — Deployment-specific Docker Compose configuration
- [Source: prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile) — Multi-stage production Dockerfile
- [Source: aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs) — All-in-One container entry point
- [Source: aio-multiport-setup.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/aio-multiport-setup.Caddyfile) — Caddy config for multi-port setup
- [Source: aio-subpath-access.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/aio-subpath-access.Caddyfile) — Caddy config for subpath-based access
- [Source: healthcheck.sh](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh) — Container health check script