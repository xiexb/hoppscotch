# Building for Production
This guide covers how to build and deploy Hoppscotch for production use, including Docker-based deployment, environment configuration, and production considerations for the self-hosted stack.

## Overview
Hoppscotch can be deployed in multiple modes — as a cloud-hosted service at hoppscotch.io, as a desktop application, or as a self-hosted instance. This guide focuses on **self-hosted production deployments**, where you run the full Hoppscotch stack (backend, frontend, and admin dashboard) on your own infrastructure.

The production deployment is built around a **multi-stage Docker build** (`prod.Dockerfile`) that produces optimized container images for four deployment targets:

TargetPurposeComponents**`aio`** (All-in-One)Single container running all servicesBackend (NestJS), Frontend (Vue SPA), Admin Dashboard, Webapp Server (Go), Caddy reverse proxy**`backend`**Backend service onlyNestJS API server + Caddy reverse proxy**`app`**Frontend applicationVue SPA + Webapp Server (Go) + Caddy**`sh_admin`**Self-hosted admin dashboardVue admin dashboard + Caddy
>
**Recommendation**: For most users, the **`aio`** (All-in-One) target with Docker Compose is the simplest and most reliable approach.

## Architecture
### Production deployment architecture
加载图表中...
### Container build pipeline
加载图表中...
## Deployment Options
### 1. Docker Compose (Recommended for most users)
The repository provides a comprehensive [`docker-compose.yml`](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml) with multiple profiles for different deployment scenarios.

#### Default deployment (AIO + database)
bash1# Start everything - AIO container, PostgreSQL, and auto-migration
2docker compose --profile default up -d
3
4# Or without bundled database (for external PostgreSQL)
5docker compose --profile default-no-db up -d
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L5-L27)

#### Individual service deployment
bash1# Backend only
2docker compose --profile backend up -d
3
4# Frontend app only
5docker compose --profile app up -d
6
7# Admin dashboard only
8docker compose --profile admin up -d
9
10# Database only
11docker compose --profile database up -d
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L234-L254)

**Port mapping reference:**

ServiceDefault Port(s)PurposeAIO container`3000`, `3100`, `3170`, `3200`, `80`All servicesBackend`3170`, `3180`API + Caddy proxyFrontend app`3000`, `3200`, `3080`SPA + Webapp ServerAdmin dashboard`3100`, `3280`Admin panelPostgreSQL`5432`Database
### 2. Manual Docker Build
You can build individual targets from the production Dockerfile:

bash1# Build the All-in-One image
2docker build -f prod.Dockerfile --target aio -t hoppscotch-aio .
3
4# Build the Backend-only image
5docker build -f prod.Dockerfile --target backend -t hoppscotch-backend .
6
7# Build the Frontend App image
8docker build -f prod.Dockerfile --target app -t hoppscotch-app .
9
10# Build the Admin Dashboard image
11docker build -f prod.Dockerfile --target sh_admin -t hoppscotch-admin .
>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

### 3. Netlify Deployment (Hoppscotch Cloud)
The cloud version of Hoppscotch is configured for Netlify deployment via [`netlify.toml`](https://github.com/xiexb/hoppscotch/blob/main/netlify.toml):

bash# Build command (from netlify.toml)
npx pnpm i --store=node_modules/.pnpm-store && npx pnpm run generate
>
Source: [netlify.toml](https://github.com/xiexb/hoppscotch/blob/main/netlify.toml#L8)

### 4. Firebase Hosting
Hoppscotch can also be deployed to Firebase Hosting as configured in [`firebase.json`](https://github.com/xiexb/hoppscotch/blob/main/firebase.json):

json1{
2  "hosting": {
3    "predeploy": [
4      "mv .env.example .env && npm install -g pnpm && pnpm i && pnpm run generate"
5    ],
6    "public": "packages/hoppscotch-web/dist",
7    "rewrites": [
8      { "source": "**", "destination": "/index.html" }
9    ]
10  }
11}
>
Source: [firebase.json](https://github.com/xiexb/hoppscotch/blob/main/firebase.json#L1-L18)

## Startup Process
### All-in-One startup flow
加载图表中...
>
Sources:

- [aio_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs)
- [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile#L216-L260)

### Environment variable injection at runtime
The frontend (Vue SPA) is built at build time but can receive runtime configuration via `import-meta-env`. The [`prod_run.mjs`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/prod_run.mjs) script handles this:

javascript1#!/usr/local/bin/node
2import { execSync } from "child_process"
3import fs from "fs"
4
5const envFileContent = Object.entries(process.env)
6  .filter(([env]) => env.startsWith("VITE_"))
7  .sort(([envA], [envB]) => envA.localeCompare(envB))
8  .map(
9    ([env, val]) =>
10      `${env}=${val.startsWith('"') && val.endsWith('"') ? val : `"${val}"`}`
11  )
12  .join("\n")
13
14fs.writeFileSync("build.env", envFileContent)
15
16execSync(`npx import-meta-env -x build.env -e build.env -p "/site/**/*"`)
17
18fs.rmSync("build.env")
>
Source: [packages/hoppscotch-selfhost-web/prod_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/prod_run.mjs)

The key environment variable `HOPP_ALLOW_RUNTIME_ENV` controls whether runtime environment variable injection is enabled. In production Docker builds, it is set to `true`:

dockerfile`ENV HOPP_ALLOW_RUNTIME_ENV=true`
>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile#L125)

### Health checks
The AIO container includes a health check script at [`healthcheck.sh`](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh):

bash1if [ "$ENABLE_SUBPATH_BASED_ACCESS" = "true" ]; then
2  curlCheck "http://localhost:${HOPP_AIO_ALTERNATE_PORT:-80}/backend/ping" || exit 1
3else
4  curlCheck "http://localhost:3000" || exit 1
5  curlCheck "http://localhost:3100" || exit 1
6  curlCheck "http://localhost:3170/ping" || exit 1
7fi
>
Source: [healthcheck.sh](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh)

The health check verifies that:

- The frontend SPA is reachable
- The admin dashboard is reachable
- The backend API responds to `/ping`

## Access Modes
Hoppscotch supports two access modes, controlled by the `ENABLE_SUBPATH_BASED_ACCESS` environment variable:

### 1. Multi-port mode (default)
Each service listens on its own dedicated port:

加载图表中...
**Caddy configuration** ([`aio-multiport-setup.Caddyfile`](https://github.com/xiexb/hoppscotch/blob/main/aio-multiport-setup.Caddyfile)):

1:3000 {
2    try_files {path} /
3    root * /site/selfhost-web
4    file_server
5}
6
7:3100 {
8    try_files {path} /
9    root * /site/sh-admin-multiport-setup
10    file_server
11}
12
13:3170 {
14    @mock {
15        header_regexp host Host ^[^.]+\\.mock\\..*$
16    }
17    handle @mock {
18        rewrite * /mock{uri}
19        reverse_proxy localhost:8080
20    }
21    handle {
22        reverse_proxy localhost:8080
23    }
24}
### 2. Subpath-based mode
All services are accessible through a single port (default `80`), routed by path prefix:

加载图表中...
**Caddy configuration** ([`aio-subpath-access.Caddyfile`](https://github.com/xiexb/hoppscotch/blob/main/aio-subpath-access.Caddyfile)):

1:{$HOPP_AIO_ALTERNATE_PORT:80} {
2    # Serve the selfhost-web SPA by default
3    root * /site/selfhost-web
4    file_server
5
6    handle_path /admin* {
7        root * /site/sh-admin-subpath-access
8        file_server
9        try_files {path} /
10    }
11
12    handle_path /backend* {
13        @mock {
14            header_regexp host Host ^[^.]+\\.mock\\..*$
15        }
16        handle @mock {
17            rewrite * /mock{uri}
18            reverse_proxy localhost:8080
19        }
20        handle {
21            reverse_proxy localhost:8080
22        }
23    }
24
25    handle_path /desktop-app-server* {
26        reverse_proxy localhost:3200
27    }
28
29    handle {
30        root * /site/selfhost-web
31        file_server
32        try_files {path} /
33    }
34}
>
Source: [aio-subpath-access.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/aio-subpath-access.Caddyfile)

## Configuration Options
### Environment Variables
These are the key environment variables for production deployment:

VariableTypeDefaultDescription`DATABASE_URL`string—PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/hoppscotch?connect_timeout=300`)`PRODUCTION`string`"true"`Enables production mode (CORS, GraphQL playground disabled)`PORT`integer`8080`Backend NestJS server port`ENABLE_SUBPATH_BASED_ACCESS`bool`false`Use subpath routing instead of multi-port`HOPP_AIO_ALTERNATE_PORT`integer`80`Alternate port for subpath-based AIO access`HOPP_ALLOW_RUNTIME_ENV`bool`true` (in Docker)Enable runtime env injection into SPA`WHITELISTED_ORIGINS`string—Comma-separated allowed CORS origins (production only)`VITE_BASE_URL`string—Base URL of the deployment (used for secure cookie detection)`VITE_BACKEND_API_URL`string—Backend API URL for frontend GraphQL calls`TRUST_PROXY`bool`false`Enable trust proxy (set to `true` when behind a reverse proxy)
>
Sources:

- [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)
- [packages/hoppscotch-backend/src/main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/main.ts)

### Infrastructure Configuration (Database-backed)
The Hoppscotch backend uses a database table `infra_config` to store sensitive runtime configuration. These values can be managed through the Admin Dashboard or populated from a `.env` file. They include:

#### Authentication & Security
Config KeyDescriptionAuto-generated`JWT_SECRET`Secret for JWT token signing✅ Random 32-byte hex (encrypted)`SESSION_SECRET`Secret for session cookies✅ Random 32-byte hex (encrypted)`SESSION_COOKIE_NAME`Custom session cookie name❌ Null (uses default)`TOKEN_SALT_COMPLEXITY`Salt rounds for password hashing`10``MAGIC_LINK_TOKEN_VALIDITY`Magic link expiry (hours)`24``REFRESH_TOKEN_VALIDITY`Refresh token expiry (ms)`604800000` (7 days)`ACCESS_TOKEN_VALIDITY`Access token expiry (ms)`86400000` (1 day)`ALLOW_SECURE_COOKIES`Force Secure flag on cookies✅ Based on VITE_BASE_URL (https → true)
#### Rate Limiting
Config KeyDescriptionDefault`RATE_LIMIT_TTL`Rate limit window (ms)`10000` (10 seconds)`RATE_LIMIT_MAX`Max requests per window`100`
#### SMTP / Mailer
Config KeyDescription`MAILER_SMTP_ENABLE`Enable SMTP`MAILER_SMTP_URL`SMTP connection URL (simple config)`MAILER_SMTP_HOST` / `MAILER_SMTP_PORT`SMTP host/port (custom config)`MAILER_SMTP_USER` / `MAILER_SMTP_PASSWORD`SMTP credentials`MAILER_ADDRESS_FROM`From email address`MAILER_SMTP_AUTH_TYPE`Auth type (`LOGIN` or `OAUTH2`)
#### OAuth Providers
Config KeyProvidersDescription`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`GoogleOAuth credentials`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`GitHubOAuth credentials`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT`MicrosoftOAuth credentials`VITE_ALLOWED_AUTH_PROVIDERS`AllComma-separated enabled providers (e.g., `google,github`)
>
Source: [packages/hoppscotch-backend/src/types/InfraConfig.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/InfraConfig.ts)

### Webapp Server Configuration
The Go-based webapp server that serves signed static bundles has its own set of configuration variables:

VariableDefaultDescription`WEBAPP_SERVER_PORT``3200`Server port`WEBAPP_SERVER_READ_TIMEOUT``15s`HTTP read timeout`WEBAPP_SERVER_WRITE_TIMEOUT``15s`HTTP write timeout`WEBAPP_SERVER_IDLE_TIMEOUT``60s`HTTP idle timeout`FRONTEND_PATH``/site/selfhost-web`Path to frontend assets`WEBAPP_SERVER_SIGNING_SECRET`NoneSecret for key derivation (set for multi-replica deployments)`WEBAPP_SERVER_SIGNING_KEY`NoneBase64 64-byte private key`WEBAPP_SERVER_SIGNING_KEY_FILE``/data/webapp-server/signing.key`Key file path
>
Source: [packages/hoppscotch-selfhost-web/webapp-server/README.md](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/webapp-server/README.md)

**Important**: For multi-replica deployments (e.g., Kubernetes), you **must** set `WEBAPP_SERVER_SIGNING_SECRET` to the same value across all replicas. Otherwise, each replica generates a different signing key, causing "Invalid signature" errors for clients with cached bundles.

## Production Build Pipeline
### Multi-stage Docker build
The [`prod.Dockerfile`](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile) uses 11 stages to produce secure, optimized containers:

加载图表中...
Key security measures in the build pipeline:

- **Checksum verification**: All downloaded artifacts (Go, npm, Caddy source) have SHA256 checksums verified before use
- **CVE patching**: Multiple CVEs are patched during the Caddy build (gRPC, certificates, pgx, go-jose, OpenTelemetry)
- **Vulnerability fixes**: glob, serialize-javascript in `@import-meta-env/cli` are patched
- **`tini` as init**: The AIO container uses `tini` as its entrypoint for proper signal handling and zombie reaping
- **`HEALTHCHECK`**: The AIO image includes a Docker health check for container orchestration

>
Source: [prod.Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)

### Backend production startup
The backend is a NestJS application started via `prod_run.mjs`:

javascript1#!/usr/local/bin/node
2import { spawn } from 'child_process';
3import process from 'process';
4
5const caddyProcess = runChildProcessWithPrefix(
6  'caddy',
7  ['run', '--config', '/etc/caddy/backend.Caddyfile', '--adapter', 'caddyfile'],
8  'App/Admin Dashboard Caddy',
9);
10const backendProcess = runChildProcessWithPrefix(
11  'node',
12  ['/dist/backend/dist/src/main.js'],
13  'Backend Server',
14);
15
16// If either process exits, shut down the entire container
17caddyProcess.on('exit', (code) => {
18  console.log(`Exiting process because Caddy Server exited with code ${code}`);
19  process.exit(code);
20});
21
22backendProcess.on('exit', (code) => {
23  console.log(`Exiting process because Backend Server exited with code ${code}`);
24  process.exit(code);
25});
>
Source: [packages/hoppscotch-backend/prod_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prod_run.mjs)

The NestJS [`main.ts`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/main.ts) bootstrap function configures:

typescript1async function bootstrap() {
2  const app = await NestFactory.create<NestExpressApplication>(AppModule);
3
4  const configService = app.get(ConfigService);
5  const isProduction = configService.get('PRODUCTION') === 'true';
6
7  // Increase file upload limit to 100MB
8  app.use(json({ limit: '100mb' }));
9
10  if (isProduction) {
11    // Production CORS with whitelisted origins
12    app.enableCors({
13      origin: configService.get('WHITELISTED_ORIGINS').split(','),
14      credentials: true,
15    });
16  } else {
17    // Development CORS (allow all origins)
18    app.enableCors({ origin: true, credentials: true });
19  }
20
21  app.enableVersioning({ type: VersioningType.URI });
22  app.use(cookieParser());
23  app.useGlobalPipes(new ValidationPipe({ transform: true }));
24
25  // Enable trust proxy if behind a reverse proxy
26  if (configService.get('TRUST_PROXY') === 'true') {
27    app.set('trust proxy', true);
28  }
29
30  // Swagger documentation (production: only InfraToken endpoints)
31  await setupSwagger(app, isProduction);
32
33  await app.listen(configService.get('PORT') || 3170);
34
35  // Graceful shutdown on SIGTERM
36  process.on('SIGTERM', async () => {
37    await app.close();
38    process.exit(0);
39  });
40}
>
Source: [packages/hoppscotch-backend/src/main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/main.ts#L42-L106)

## Database Migrations
Database schema changes are managed via Prisma migrations. In production, migrations are run automatically before the application starts:

bash`pnpm exec prisma migrate deploy`
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L180)

The docker-compose file includes a dedicated `hoppscotch-migrate` service that runs the migration and exits:

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
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L169-L180)

## Caddy Reverse Proxy
Caddy is used as a reverse proxy throughout the Hoppscotch production stack. It handles:

- **Static file serving** for the Vue SPAs
- **Request routing** to the NestJS backend
- **Mock server routing** (requests to `*.mock.*` hosts are rewritten to `/mock{uri}`)
- **TLS termination** (when configured)

The backend Caddyfile ([`backend.Caddyfile`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/backend.Caddyfile)):

1{
2    admin off
3    persist_config off
4}
5
6:80 :3170 {
7    @mock {
8        header_regexp host Host ^[^.]+\\.mock\\..*$
9    }
10
11    handle @mock {
12        rewrite * /mock{uri}
13        reverse_proxy localhost:8080
14    }
15
16    handle {
17        reverse_proxy localhost:8080
18    }
19}
>
Source: [packages/hoppscotch-backend/backend.Caddyfile](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/backend.Caddyfile)

## Production Security Considerations
### Session secret configuration
Auto-generated session secrets (used when `INFRA.SESSION_SECRET` is not explicitly set) are **not suitable for production deployments**. Always set a fixed session secret via the Admin Dashboard or `.env` configuration:

INFRA.SESSION_SECRET=your-strong-secret-here

>
Source: [SECURITY.md](https://github.com/xiexb/hoppscotch/blob/main/SECURITY.md#L78)

### Data encryption
Sensitive configuration values (OAuth secrets, SMTP passwords, JWT secrets) are stored encrypted in the `infra_config` database table. The encryption key is derived from environment variables set at the infrastructure level.

### CORS in production
In production mode, CORS is restricted to whitelisted origins only. Set the `WHITELISTED_ORIGINS` environment variable to a comma-separated list of allowed origins:

WHITELISTED_ORIGINS=https://myapp.example.com,https://admin.example.com

### GraphQL playground
The GraphQL Playground is automatically disabled in production mode:

typescript`playground: configService.get('PRODUCTION') !== 'true',`
>
Source: [packages/hoppscotch-backend/src/app.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts#L56)

## Troubleshooting
### "Invalid signature" errors in the webapp
This occurs when the webapp server signing key changes (e.g., after a restart or when using multiple replicas).

**Solution**: Set `WEBAPP_SERVER_SIGNING_SECRET` to a consistent value across all instances.

### Health check failing
Check that all services are reachable:

- For multi-port mode: `curl http://localhost:3000`, `curl http://localhost:3100`, `curl http://localhost:3170/ping`
- For subpath mode: `curl http://localhost:80/backend/ping`

### Database connection failures
Ensure the `DATABASE_URL` connection string is correct and that the PostgreSQL instance is reachable. The connection includes a `connect_timeout=300` parameter for long-running migrations.

## Related Links

- [Docker Compose Configuration](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)
- [Production Dockerfile](https://github.com/xiexb/hoppscotch/blob/main/prod.Dockerfile)
- [Backend Main Entry Point](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/main.ts)
- [Backend App Module](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts)
- [AIO Startup Script](https://github.com/xiexb/hoppscotch/blob/main/aio_run.mjs)
- [Security Documentation](https://github.com/xiexb/hoppscotch/blob/main/SECURITY.md)
- [Webapp Server README](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/webapp-server/README.md)
- [Infra Config Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/helper.ts)
- [Self-host Web prod_run.mjs](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/prod_run.mjs)
- [Health Check Script](https://github.com/xiexb/hoppscotch/blob/main/healthcheck.sh)