# Docker Deployment
Comprehensive guide to deploying Hoppscotch using Docker, covering multi-service architecture, deployment profiles, and configuration options.

## Overview
Hoppscotch provides a flexible Docker-based deployment system that supports multiple deployment scenarios through Docker Compose profiles. The deployment architecture consists of several containerized components working together to provide the full Hoppscotch experience:

- **Backend API Server** (NestJS + Prisma) - Handles API requests, authentication, and database operations
- **Frontend Web Application** (Vue.js SPA) - The main Hoppscotch web interface
- **Self-Host Admin Dashboard** - Administration panel for managing the self-hosted instance
- **Webapp Server** (Go) - Serves the frontend application and API proxy
- **Caddy Server** - Reverse proxy and static file serving
- **PostgreSQL Database** - Data persistence

The deployment system is designed with a **profiles-based approach** that allows you to run all services together in a single container (All-In-One) or deploy individual services separately for better scalability and fault isolation.

## Architecture
### Multi-Profile Deployment Architecture
The diagram below illustrates the complete Docker deployment architecture, showing how Docker Compose profiles map to different service combinations:

加载图表中...
### Build Architecture (Multi-Stage Dockerfile)
The `prod.Dockerfile` uses a multi-stage build process to produce optimized containers for each target:

加载图表中...
>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)

## Deployment Profiles
Hoppscotch uses Docker Compose profiles to manage different deployment scenarios and avoid port conflicts. Each profile launches a specific combination of services.

### Available Profiles
ProfileLaunched ServicesUse Case`default`hoppscotch-aio + hoppscotch-db + hoppscotch-migrate**Recommended** - All-in-One with database`default-no-db`hoppscotch-aio-no-dbAll-in-One without database (external DB)`backend`hoppscotch-backend + hoppscotch-db + hoppscotch-migrateBackend API only`app`hoppscotch-app + hoppscotch-backend + hoppscotch-db + hoppscotch-migrateFrontend + Backend`admin`hoppscotch-sh-admin + hoppscotch-backend + hoppscotch-db + hoppscotch-migrateAdmin Dashboard only`database`hoppscotch-dbJust the PostgreSQL database`just-backend`hoppscotch-backend + hoppscotch-db + hoppscotch-migrateBackend for local development`deprecated`Old individual servicesLegacy deployments (not recommended)
### Quick Start Commands
bash1# Default deployment (recommended for most users)
2docker compose --profile default up
3
4# Default deployment without database (use with external PostgreSQL)
5docker compose --profile default-no-db up
6
7# Deploy specific components
8docker compose --profile backend up    # Backend only
9docker compose --profile app up        # Frontend + backend
10docker compose --profile admin up      # Admin dashboard only
11
12# Development - all services except webapp
13docker compose --profile just-backend up
14
15# Legacy deployment (not recommended for new deployments)
16docker compose --profile deprecated up
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L5-L28)

**Important:** The `default` and `default-no-db` profiles should not be mixed with individual service profiles as they would conflict on ports.

## Service Details
### 1. All-In-One Service (`hoppscotch-aio`)
The All-In-One (AIO) service runs all Hoppscotch components inside a single container. This is the simplest deployment option and is recommended for most users.

**Internal Architecture:**

加载图表中...
The AIO container uses `tini` as its init system (PID 1) to properly handle signals and reap zombie processes. The `aio_run.mjs` script:

- Processes runtime environment variables using `import-meta-env`
- Selects the appropriate Caddyfile based on `ENABLE_SUBPATH_BASED_ACCESS`
- Spawns three child processes: Caddy, Backend Server, and Webapp Server
- Manages graceful shutdown by forwarding SIGINT to all child processes

>
Source: [aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs)

### 2. Backend Service (`hoppscotch-backend`)
The backend service runs the NestJS API server with an embedded Caddy reverse proxy:

加载图表中...
The backend Caddyfile proxies all traffic to the NestJS backend on port 8080 and handles mock server routing via hostname-based matching:

>
Source: [backend.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/backend.Caddyfile)

### 3. Frontend App Service (`hoppscotch-app`)
The app service serves the main Hoppscotch SPA along with the webapp server:

>
Source: [selfhost-web.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/selfhost-web.Caddyfile)

### 4. Admin Dashboard Service (`hoppscotch-sh-admin`)
The admin dashboard service supports two access modes:

- **Multi-port setup** (default): Admin dashboard accessible on port 3100
- **Subpath-based access**: Admin dashboard accessible under `/admin/` path on the same port as the main app

>
Source: [sh-admin-multiport-setup.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/sh-admin-multiport-setup.Caddyfile)
Source: [sh-admin-subpath-access.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/sh-admin-subpath-access.Caddyfile)

### 5. Auto-Migration Service (`hoppscotch-migrate`)
This service runs Prisma database migrations automatically when the database becomes healthy. It uses the same image as the backend target and executes:

bash`pnpm exec prisma migrate deploy`
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L169-L180)

### 6. Database Service (`hoppscotch-db`)
A pre-configured PostgreSQL 15 service with health checks:

>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L137-L166)

## Core Flow
### Container Startup Sequence
The following sequence diagram shows how the All-In-One container starts up and initializes its services:

加载图表中...
### Internal Process Management in AIO Container
The `aio_run.mjs` script manages child processes with proper logging and lifecycle management:

javascript1// @ts-check
2import { execSync, spawn } from "child_process"
3import fs from "fs"
4import process from "process"
5
6function runChildProcessWithPrefix(command, args, prefix) {
7  const childProcess = spawn(command, args);
8
9  childProcess.stdout.on('data', (data) => {
10    const output = data.toString().trim().split('\n');
11    output.forEach((line) => {
12      console.log(`${prefix} | ${line}`);
13    });
14  });
15
16  childProcess.stderr.on('data', (data) => {
17    const error = data.toString().trim().split('\n');
18    error.forEach((line) => {
19      console.error(`${prefix} | ${line}`);
20    });
21  });
22
23  childProcess.on('close', (code) => {
24    console.log(`${prefix} Child process exited with code ${code}`);
25  });
26
27  childProcess.on('error', (stuff) => {
28    console.log("error")
29    console.log(stuff)
30  })
31
32  return childProcess
33}
>
Source: [aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs#L1-L35)

The script spawns three processes and implements an **exit-on-failure** pattern — if any process exits, the entire container stops:

javascript1const caddyFileName = process.env.ENABLE_SUBPATH_BASED_ACCESS === 'true'
2  ? 'aio-subpath-access.Caddyfile'
3  : 'aio-multiport-setup.Caddyfile'
4
5const caddyProcess = runChildProcessWithPrefix("caddy",
6  ["run", "--config", `/etc/caddy/${caddyFileName}`, "--adapter", "caddyfile"],
7  "App/Admin Dashboard Caddy")
8
9const backendProcess = runChildProcessWithPrefix("node",
10  ["/dist/backend/dist/src/main.js"],
11  "Backend Server")
12
13const webappProcess = runChildProcessWithPrefix("webapp-server",
14  [],
15  "Webapp Server")
16
17caddyProcess.on("exit", (code) => {
18  console.log(`Exiting process because Caddy Server exited with code ${code}`)
19  process.exit(code)
20})
21
22backendProcess.on("exit", (code) => {
23  console.log(`Exiting process because Backend Server exited with code ${code}`)
24  process.exit(code)
25})
26
27webappProcess.on("exit", (code) => {
28  console.log(`Exiting process because Webapp Server exited with code ${code}`)
29  process.exit(code)
30})
31
32process.on('SIGINT', () => {
33  console.log("SIGINT received, exiting...")
34  caddyProcess.kill("SIGINT")
35  backendProcess.kill("SIGINT")
36  webappProcess.kill("SIGINT")
37  process.exit(0)
38})
>
Source: [aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs#L53-L81)

## Access Modes
Hoppscotch supports two access modes controlled by the `ENABLE_SUBPATH_BASED_ACCESS` environment variable:

### Multi-Port Setup (Default)
Each service is accessible on its own port:

PortService3000Main Hoppscotch Web App3100Admin Dashboard3170Backend API3200Webapp Server80Caddy root (redirects)
### Subpath-Based Access
All services are accessible through a single port (default 80), with routing by URL path:

PathService`/`Main Hoppscotch Web App`/admin*`Admin Dashboard`/backend*`Backend API`/desktop-app-server*`Webapp Server
## Health Checks
The AIO container includes a comprehensive health check script that verifies all services are running:

bash1#!/bin/sh
2curlCheck() {
3  if ! curl -s --head "$1" | head -n 1 | grep -q "HTTP/1.[01] [23].."; then
4    echo "URL request failed!"
5    return 1
6  else
7    echo "URL request succeeded!"
8    return 0
9  fi
10}
11
12# Wait for initial startup period to avoid unnecessary error logs
13UPTIME=$(awk '{print int($1)}' /proc/uptime)
14if [ "$UPTIME" -lt 15 ]; then
15  echo "Container still starting up (uptime: ${UPTIME}s), skipping health check..."
16  exit 0
17fi
18
19if [ "$ENABLE_SUBPATH_BASED_ACCESS" = "true" ]; then
20  curlCheck "http://localhost:${HOPP_AIO_ALTERNATE_PORT:-80}/backend/ping" || exit 1
21else
22  curlCheck "http://localhost:3000" || exit 1
23  curlCheck "http://localhost:3100" || exit 1
24  curlCheck "http://localhost:3170/ping" || exit 1
25fi
>
Source: [healthcheck.sh](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh)

The health check runs every 2 seconds with a 15-second startup grace period and 30 retries.

## Configuration Options
### Environment Variables
The `.env` file in the project root is used to configure all services. Below are the key configuration variables:

#### Database
VariableTypeDefaultDescription`DATABASE_URL`string`postgresql://postgres:testpass@hoppscotch-db:5432/hoppscotch?connect_timeout=300`PostgreSQL connection URL
>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L15-L17)

#### Authentication & Security
VariableTypeRequiredDescription`JWT_SECRET`stringYesSecret key for JWT token signing`SESSION_SECRET`stringFor multi-instanceShared secret for OAuth state persistence across load-balanced instances`ALLOW_SECURE_COOKIES`booleanNoEnable secure cookies (recommended for HTTPS)`TOKEN_SALT_COMPLEXITY`numberNoSalt complexity for token generation`MAGIC_LINK_TOKEN_VALIDITY`numberNoMagic link token validity in ms`REFRESH_TOKEN_VALIDITY`numberNoRefresh token validity in ms`ACCESS_TOKEN_VALIDITY`numberNoAccess token validity in ms
>
Source: [InfraConfig.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/InfraConfig.ts)

#### OAuth Providers
VariableRequired for Provider`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `GOOGLE_SCOPE`Google`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_SCOPE`GitHub`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_CALLBACK_URL`, `MICROSOFT_SCOPE`, `MICROSOFT_TENANT`Microsoft
#### Email (SMTP)
VariableTypeDescription`MAILER_SMTP_ENABLE`booleanEnable SMTP mailer`MAILER_SMTP_HOST`stringSMTP server host`MAILER_SMTP_PORT`numberSMTP server port`MAILER_SMTP_SECURE`booleanUse TLS for SMTP`MAILER_SMTP_USER`stringSMTP username`MAILER_SMTP_PASSWORD`stringSMTP password`MAILER_ADDRESS_FROM`stringFrom email address`MAILER_SMTP_AUTH_TYPE`stringAuth type (e.g., `oauth2`)`MAILER_SMTP_OAUTH2_CLIENT_ID`stringOAuth2 client ID`MAILER_SMTP_OAUTH2_CLIENT_SECRET`stringOAuth2 client secret
#### Rate Limiting
VariableTypeDefaultDescription`RATE_LIMIT_TTL`number-Rate limit window in ms`RATE_LIMIT_MAX`number-Maximum requests per window
#### Deployment-Specific
VariableTypeDefaultDescription`ENABLE_SUBPATH_BASED_ACCESS`boolean`false`Enable single-port subpath-based access mode`HOPP_AIO_ALTERNATE_PORT`number`80`Custom port for subpath-based access mode`HOPP_ALLOW_RUNTIME_ENV`boolean`true`Allow runtime environment variable injection`ALLOW_ANALYTICS_COLLECTION`boolean-Enable analytics collection`MOCK_SERVER_WILDCARD_DOMAIN`string-Wildcard domain for mock server`USER_HISTORY_STORE_ENABLED`boolean-Enable user history storage`VITE_ALLOWED_AUTH_PROVIDERS`string-Comma-separated list of allowed auth providers
## Port Mapping
When using the default Docker Compose setup, the following host ports are mapped:

ServiceHost PortContainer PortProfileBackend API318080 (Caddy)backendBackend API31703170 (Caddy)backendFrontend App308080 (Caddy)appFrontend App30003000appFrontend App32003200appAdmin Dashboard328080 (Caddy)adminAdmin Dashboard31003100adminAIO (default)3000, 3100, 3170, 3200, 308080, 3000, 3100, 3170, 3200defaultPostgreSQL54325432database
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L53-L132)

## Deprecated Services
The following services are deprecated and kept only for backward compatibility. New deployments should use the modern profiles instead.

Old ServiceNew Equivalent`hoppscotch-old-backend``hoppscotch-backend` (or AIO)`hoppscotch-old-app``hoppscotch-app` (or AIO)`hoppscotch-old-sh-admin``hoppscotch-sh-admin` (or AIO)
The deprecated services use individual per-package Dockerfiles (`packages/hoppscotch-backend/Dockerfile`, `packages/hoppscotch-selfhost-web/Dockerfile`, `packages/hoppscotch-sh-admin/Dockerfile`) rather than the consolidated `prod.Dockerfile`.

## Related Links

- [Self-Hosting Documentation (Official)](https://docs.hoppscotch.io/documentation/self-host/getting-started)
- [Docker Compose Configuration](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)
- [Production Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)
- [AIO Run Script](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs)
- [Health Check Script](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh)
- [InfraConfig Types](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/InfraConfig.ts)
- [Hoppscotch Repository](https://github.com/xiexb/hoppscotch)