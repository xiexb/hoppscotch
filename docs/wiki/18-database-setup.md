# Database Setup
Hoppscotch uses **PostgreSQL 15** as its primary database, managed through **Prisma ORM** (version 7.8.0). The database stores all persistent data including user accounts, API collections, team collaboration data, mock server configurations, and application settings.

## Overview
The database layer is a critical component of the Hoppscotch self-hosted deployment. It powers the backend service (`hoppscotch-backend`) which provides REST and GraphQL APIs for the web application, admin dashboard, and CLI tooling. The database setup is designed with the following principles:

- **PostgreSQL-native**: Uses PostgreSQL 15 with full use of JSONB for flexible schema storage, enum types for strict value constraints, and native connection pooling
- **Prisma ORM abstraction**: All database interactions go through Prisma, providing type-safe queries and automatic schema generation
- **Connection pooling**: Utilizes `pg.Pool` for efficient connection management with configurable pool sizes and timeouts
- **SSL flexibility**: Supports various SSL modes from no-encryption (local/Docker) to strict certificate validation (production)
- **Auto-migration**: Database schema migrations are automatically applied on deployment startup
- **Transaction support**: Pessimistic locking via `SELECT ... FOR UPDATE` for concurrent access to collections and requests

## Architecture
### Database Architecture Overview
The database layer is structured in a multi-tier architecture:

加载图表中...
### Data Model Entity Relationships
The Prisma schema defines 20+ models representing the core domain entities:

加载图表中...
### Database Connection Lifecycle
加载图表中...
## Prisma Configuration and Schema
### Prisma Configuration
The Prisma configuration is defined in `prisma.config.ts`:

>
Source: [prisma.config.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma.config.ts)

typescript1import 'dotenv/config';
2import { defineConfig, env } from 'prisma/config';
3
4export default defineConfig({
5  schema: 'prisma/schema.prisma',
6  migrations: {
7    path: 'prisma/migrations',
8  },
9  datasource: {
10    url: env('DATABASE_URL'),
11  },
12});
### Database Source Definition
The schema file specifies PostgreSQL as the database provider:

prisma1generator client {
2  provider = "prisma-client"
3  output   = "../src/generated/prisma"
4}
5
6datasource db {
7  provider = "postgresql"
8}
>
Source: [schema.prisma](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L1-L8)

### Data Models Overview
The database contains the following major model groups:

Model GroupModelsPurpose**User & Auth**`User`, `Account`, `VerificationToken`, `UserSettings`, `PersonalAccessToken`User accounts, authentication, and personal preferences**Personal Workspace**`UserCollection`, `UserRequest`, `UserEnvironment`, `UserHistory`, `Shortcode`Individual user API collections, requests, and history**Team Collaboration**`Team`, `TeamMember`, `TeamInvitation`, `TeamCollection`, `TeamRequest`, `TeamEnvironment`Team-based API collaboration**Mock Server**`MockServer`, `MockServerLog`, `MockServerActivity`API mock server functionality**Documentation**`PublishedDocs`Published API documentation**Infrastructure**`InfraConfig`, `InfraToken`Application configuration and infrastructure tokens
### Enums
The schema defines several PostgreSQL enums for type safety:

EnumValuesUsed By`WorkspaceType``USER`, `TEAM`MockServer, PublishedDocs`ReqType``REST`, `GQL`UserRequest, UserHistory, UserCollection`TeamAccessRole``OWNER`, `VIEWER`, `EDITOR`TeamMember, TeamInvitation`MockServerAction``CREATED`, `DELETED`, `ACTIVATED`, `DEACTIVATED`MockServerActivity
## Core Database Service
### PrismaService
The `PrismaService` is the core database access layer. It extends `PrismaClient` and manages the connection lifecycle, connection pooling, and SSL configuration:

>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts)

typescript1import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
2import { PrismaClient, Prisma } from 'src/generated/prisma/client';
3import { PrismaPg } from '@prisma/adapter-pg';
4import pg from 'pg';
5import { parseIntSafe } from 'src/utils';
6
7@Injectable()
8export class PrismaService
9  extends PrismaClient
10  implements OnModuleInit, OnModuleDestroy
11{
12  private readonly pool: pg.Pool;
13
14  constructor() {
15    const databaseUrl = process.env.DATABASE_URL;
16    if (!databaseUrl) {
17      throw new Error('DATABASE_URL environment variable is not set');
18    }
19
20    const parsed = PrismaService.parseDatabaseUrl(databaseUrl);
21
22    // Generic SSL configuration for all database environments
23    // Supports: AWS Aurora, Docker, local PostgreSQL, managed databases
24    const sslConfig = PrismaService.getSSLConfig(parsed.sslMode);
25
26    const pool = new pg.Pool({
27      connectionString: parsed.connectionString,
28      max: parsed.connectionLimit ?? 20,
29      idleTimeoutMillis: 30000,
30      connectionTimeoutMillis: parsed.connectTimeout ?? 10000,
31      ssl: sslConfig,
32    });
33
34    const adapter = new PrismaPg(pool, {
35      schema: parsed.schema,
36    });
37
38    super({
39      adapter,
40      transactionOptions: {
41        maxWait: 5000,
42        timeout: 10000,
43      },
44    });
45
46    this.pool = pool;
47  }
**Key Design Decisions:**

-
**Custom Connection Pooling**: Rather than relying solely on Prisma's built-in connection management, the service creates its own `pg.Pool` instance. This provides fine-grained control over pool size, timeouts, and SSL configuration.

-
**Adapter Pattern**: The `PrismaPg` adapter bridges the `pg.Pool` with Prisma's query engine, allowing direct control over the underlying database connection.

-
**SSL Mode Parsing**: The `DATABASE_URL` supports a custom `sslmode` query parameter that is stripped from the connection string and used to configure SSL behavior programmatically.

### SSL Configuration
The service provides flexible SSL handling for different deployment environments:

typescript1private static getSSLConfig(
2  sslMode?: string,
3): false | { rejectUnauthorized: boolean } {
4  if (!sslMode || sslMode === 'disable') {
5    // Local PostgreSQL, Docker containers - no SSL
6    return false;
7  }
8
9  if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'allow') {
10    // AWS Aurora, managed databases - SSL with relaxed validation
11    return { rejectUnauthorized: false };
12  }
13
14  if (sslMode === 'verify-ca' || sslMode === 'verify-full') {
15    // Strict certificate validation - requires proper CA certificates
16    return { rejectUnauthorized: true };
17  }
18
19  // Default to no SSL for unknown modes
20  return false;
21}
>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L56-L81)

**SSL Mode Quick Reference:**

SSL ModeEnvironmentBehavior`disable` or not setLocal Docker, developmentNo SSL encryption`require`, `prefer`, `allow`AWS Aurora, managed DBsSSL encryption, relaxed validation`verify-ca`, `verify-full`Production with strict securitySSL with certificate validation
### Connection Lifecycle
The service implements `OnModuleInit` and `OnModuleDestroy` to manage the connection lifecycle:

typescript1async onModuleInit() {
2  try {
3    // Verify pool connectivity
4    const client = await this.pool.connect();
5    client.release();
6
7    await this.$connect();
8  } catch (error) {
9    throw new Error(`Database connection failed: ${error.message}`);
10  }
11}
12
13async onModuleDestroy() {
14  await this.$disconnect();
15  await this.pool.end();
16}
>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L130-L145)

### Database URL Parser
The `DATABASE_URL` supports several custom query parameters:

typescript1private static parseDatabaseUrl(databaseUrl: string): {
2  connectionString: string;
3  schema: string;
4  connectionLimit?: number;
5  connectTimeout?: number;
6  sslMode?: string;
7} {
8  try {
9    const url = new URL(databaseUrl);
10    const schema = url.searchParams.get('schema') || 'public';
11    const connectionLimit = parseIntSafe(
12      url.searchParams.get('connection_limit'),
13    );
14    const connectTimeout = parseIntSafe(
15      url.searchParams.get('connect_timeout'),
16    );
17    const sslMode = url.searchParams.get('sslmode');
18
19    // Remove all custom parameters including sslmode
20    // We handle SSL configuration programmatically via the ssl option
21    url.searchParams.delete('schema');
22    url.searchParams.delete('connection_limit');
23    url.searchParams.delete('connect_timeout');
24    url.searchParams.delete('sslmode');
25
26    return {
27      connectionString: url.toString(),
28      schema,
29      connectionLimit,
30      connectTimeout,
31      sslMode: sslMode || undefined,
32    };
33  } catch (error) {
34    throw new Error(
35      `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
36    );
37  }
38}
>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L91-L128)

### PrismaModule
The `PrismaModule` is registered as a global module, making `PrismaService` available throughout the application without explicit imports:

>
Source: [prisma.module.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.module.ts)

typescript1import { Global, Module } from '@nestjs/common/decorators';
2import { PrismaService } from './prisma.service';
3
4@Global()
5@Module({
6  providers: [PrismaService],
7  exports: [PrismaService],
8})
9export class PrismaModule {}
### Prisma Error Codes
The application defines specific Prisma error codes for error handling:

>
Source: [prisma-error-codes.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma-error-codes.ts)

typescript1export enum PrismaError {
2  DATABASE_UNREACHABLE = 'P1001',
3  TABLE_DOES_NOT_EXIST = 'P2021',
4  UNIQUE_CONSTRAINT_VIOLATION = 'P2002',
5  RECORD_NOT_FOUND = 'P2025',
6  TRANSACTION_TIMEOUT = 'P2028',
7  TRANSACTION_DEADLOCK = 'P2034',
8}
## Deployment Setup
### Docker Compose with Built-in Database
The recommended way to set up the database is using Docker Compose, which includes a PostgreSQL 15 container:

>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)

yaml1# The preset DB service, you can delete/comment the below lines if
2# you are using an external postgres instance
3# This will be exposed at port 5432
4hoppscotch-db:
5  profiles:
6    [
7      "default",
8      "database",
9      "just-backend",
10      "backend",
11      "app",
12      "admin",
13      "deprecated",
14    ]
15  image: postgres:15
16  ports:
17    - "5432:5432"
18  user: postgres
19  environment:
20    # The default user defined by the docker image
21    POSTGRES_USER: postgres
22    # NOTE: Please UPDATE THIS PASSWORD!
23    POSTGRES_PASSWORD: testpass
24    POSTGRES_DB: hoppscotch
25  healthcheck:
26    test:
27      [
28        "CMD-SHELL",
29        "sh -c 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}'",
30      ]
31    interval: 5s
32    timeout: 5s
33    retries: 10
**Important**: The default password `testpass` should be changed for production deployments.

### Auto-Migration Service
The `hoppscotch-migrate` service automatically applies database migrations on startup:

yaml1# Auto-migration service - handles database migrations automatically
2hoppscotch-migrate:
3  profiles: ["default", "just-backend", "backend", "app", "admin"]
4  build:
5    dockerfile: prod.Dockerfile
6    context: .
7    target: backend
8  env_file:
9    - ./.env
10  depends_on:
11    hoppscotch-db:
12      condition: service_healthy
13  command: sh -c "pnpm exec prisma migrate deploy"
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L168-L180)

### Using an External Database
To use an external PostgreSQL instance instead of the Docker container:

- Set the `DATABASE_URL` environment variable in your `.env` file
- Use the `default-no-db` profile to skip the built-in database container:

bash`docker compose --profile default-no-db up`
The backend service connects to the external database using the connection string from the environment:

yaml1hoppscotch-backend:
2  # ...
3  environment:
4    - DATABASE_URL=postgresql://postgres:testpass@hoppscotch-db:5432/hoppscotch?connect_timeout=300
>
Source: [docker-compose.yml](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml#L44)

### Migration Flow
加载图表中...
## Configuration Options
### Environment Variables
VariableTypeDefaultDescription`DATABASE_URL`string*(required)*PostgreSQL connection string with optional custom query parameters
### DATABASE_URL Query Parameters
The `DATABASE_URL` supports the following custom query parameters in addition to standard PostgreSQL connection parameters:

ParameterTypeDefaultDescription`schema`string`"public"`Database schema to use for Prisma queries`connection_limit`number`20`Maximum number of connections in the pg.Pool`connect_timeout`number`10000`Connection timeout in milliseconds`sslmode`string`"disable"`SSL mode: `disable`, `prefer`, `require`, `allow`, `verify-ca`, `verify-full`
### Example DATABASE_URL values
text1# Local/Docker development (no SSL)
2DATABASE_URL=postgresql://postgres:testpass@localhost:5432/hoppscotch
3
4# Custom schema and connection limit
5DATABASE_URL=postgresql://postgres:testpass@localhost:5432/hoppscotch?schema=myschema&connection_limit=10
6
7# AWS Aurora with SSL
8DATABASE_URL=postgresql://user:password@aurora-cluster.us-east-1.rds.amazonaws.com:5432/hoppscotch?sslmode=require&connect_timeout=5000
9
10# Production with strict SSL verification
11DATABASE_URL=postgresql://user:password@db.example.com:5432/hoppscotch?sslmode=verify-full
## Database Health Check
The application provides a health check endpoint that verifies database connectivity:

>
Source: [health.controller.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/health/health.controller.ts)

typescript1import { Controller, Get, UseGuards } from '@nestjs/common';
2import {
3  HealthCheck,
4  HealthCheckService,
5  PrismaHealthIndicator,
6} from '@nestjs/terminus';
7import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
8import { PrismaService } from 'src/prisma/prisma.service';
9
10@Controller('health')
11@UseGuards(ThrottlerBehindProxyGuard)
12export class HealthController {
13  constructor(
14    private health: HealthCheckService,
15    private prismaHealth: PrismaHealthIndicator,
16    private prisma: PrismaService,
17  ) {}
18
19  @Get()
20  @HealthCheck()
21  check() {
22    return this.health.check([
23      async () => this.prismaHealth.pingCheck('database', this.prisma),
24    ]);
25  }
26}
The health endpoint is available at `GET /health` and returns a status object with a `database` key indicating connectivity.

## Database Migrations
### Migration History
The project has over 20 migration files tracking schema evolution from the initial setup (April 2023) to the latest changes. Key migrations include:

Migration DateDescription2023-04-06Initial schema with core entities2023-11-06Embed properties for shortcodes2023-11-24Infrastructure config table2023-12-05Collection headers support2024-02-26Full-text search additions2024-05-19User `lastLoggedOn` field2024-05-20Personal access tokens2024-06-21User `lastActiveOn` field2024-07-25InfraConfig encryption2024-07-26InfraToken table2024-11-18InfraConfig sync with env file2025-03-06TeamAccessRole enum2025-07-25Timestamp with timezone2025-10-16Mock server tables2025-11-10Published API documentation2026-02-09Published doc environment support
### Running Migrations Manually
To run migrations outside of Docker:

bash1# Set your database URL
2export DATABASE_URL=postgresql://user:password@localhost:5432/hoppscotch
3
4# Run pending migrations
5pnpm exec prisma migrate deploy
6
7# Or to create a new migration after schema changes
8pnpm exec prisma migrate dev --name <migration_name>
### Migration Lock File
The migration provider is locked to PostgreSQL:

toml# Please do not edit this file manually
# It should be added in your version-control system (e.g., Git)
provider = "postgresql"
>
Source: [migration_lock.toml](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/migrations/migration_lock.toml)

## Transaction Support
The `PrismaService` provides explicit row-level locking methods for handling concurrent access to collections and requests. These use `SELECT ... FOR UPDATE` to prevent race conditions:

typescript1/**
2 * Locks rows in TeamCollection for a specific teamId and parentID.
3 */
4async lockTeamCollectionByTeamAndParent(
5  tx: Prisma.TransactionClient,
6  teamId: string,
7  parentID: string | null,
8) {
9  const lockQuery = parentID
10    ? Prisma.sql`SELECT "orderIndex" FROM "TeamCollection" WHERE "teamID" = ${teamId} AND "parentID" = ${parentID} FOR UPDATE`
11    : Prisma.sql`SELECT "orderIndex" FROM "TeamCollection" WHERE "teamID" = ${teamId} AND "parentID" IS NULL FOR UPDATE`;
12  return tx.$executeRaw(lockQuery);
13}
14
15/**
16 * Locks rows in UserCollection for a specific userUid and parentID.
17 */
18async lockUserCollectionByParent(
19  tx: Prisma.TransactionClient,
20  userUid: string,
21  parentID: string | null,
22) {
23  const lockQuery = parentID
24    ? Prisma.sql`SELECT "orderIndex" FROM "UserCollection" WHERE "userUid" = ${userUid} AND "parentID" = ${parentID} FOR UPDATE`
25    : Prisma.sql`SELECT "orderIndex" FROM "UserCollection" WHERE "userUid" = ${userUid} AND "parentID" IS NULL FOR UPDATE`;
26  return tx.$executeRaw(lockQuery);
27}
>
Source: [prisma.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts#L150-L197)

Transaction options are configured with:

- **maxWait**: 5000ms (maximum time to wait for a transaction to become available)
- **timeout**: 10000ms (maximum time a transaction can run before being cancelled)

## Deployment Profiles
Docker Compose profiles allow flexible database deployment scenarios:

加载图表中...
## API Reference
### PrismaService
Extends `PrismaClient` and provides the database connection management and utility methods.

#### `constructor()`
Initializes the database connection pool, parses the `DATABASE_URL`, and sets up SSL configuration.

**Throws:**

- `Error`: If `DATABASE_URL` environment variable is not set
- `Error`: If `DATABASE_URL` has an invalid format

#### `onModuleInit(): Promise<void>`
Verifies database connectivity by establishing a pool connection and initializing the Prisma client.

**Throws:**

- `Error`: If database connection fails

#### `onModuleDestroy(): Promise<void>`
Gracefully disconnects the Prisma client and closes the connection pool.

#### `lockTeamCollectionByTeamAndParent(tx: Prisma.TransactionClient, teamId: string, parentID: string | null): Promise<number>`
Acquires a pessimistic lock on `TeamCollection` rows for the given team and parent.

#### `lockTeamRequestByCollections(tx: Prisma.TransactionClient, teamID: string, collectionIDs: string[]): Promise<number>`
Acquires a pessimistic lock on `TeamRequest` rows for the given team and collections.

#### `lockUserCollectionByParent(tx: Prisma.TransactionClient, userUid: string, parentID: string | null): Promise<number>`
Acquires a pessimistic lock on `UserCollection` rows for the given user and parent.

#### `lockUserRequestByCollections(tx: Prisma.TransactionClient, userUid: string, collectionIDs: string[]): Promise<number>`
Acquires a pessimistic lock on `UserRequest` rows for the given user and collections.

### PrismaModule
A global NestJS module that provides `PrismaService` to all modules.

### PrismaError (enum)
MemberValueDescription`DATABASE_UNREACHABLE``P1001`Cannot reach the database server`TABLE_DOES_NOT_EXIST``P2021`Database table does not exist`UNIQUE_CONSTRAINT_VIOLATION``P2002`Unique constraint violation`RECORD_NOT_FOUND``P2025`Record not found`TRANSACTION_TIMEOUT``P2028`Transaction timeout`TRANSACTION_DEADLOCK``P2034`Write conflict or deadlock
## Related Links

- [Deployment Overview](./18-deployment.1-overview)
- [Environment Configuration](./18-deployment.2-environment-configuration)
- [Docker Compose File](https://github.com/xiexb/hoppscotch/blob/main/docker-compose.yml)
- [Prisma Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma)
- [PrismaService Source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.service.ts)
- [PrismaModule Source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma.module.ts)
- [Health Controller Source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/health/health.controller.ts)
- [Prisma Error Codes](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/prisma/prisma-error-codes.ts)
- [Migrations Directory](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/migrations/)