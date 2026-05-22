# Infrastructure Configuration
The Infrastructure Configuration system in Hoppscotch is a centralized, database-backed configuration management layer that stores, encrypts, validates, and serves all operational settings for the self-hosted Hoppscotch backend instance, including authentication providers, SMTP mailer settings, rate limiting, token validity, and onboarding flow control.

## Overview
The Infrastructure Configuration (InfraConfig) system is designed to replace traditional `.env` file management with a dynamic, runtime-configurable approach. Instead of requiring direct file edits or server restarts for configuration changes, the InfraConfig system stores configuration values in a dedicated PostgreSQL table (`infra_config`) and provides admin-only GraphQL mutations and REST APIs to query and update them.

**Why this approach?** The design intent is to provide a self-service administration experience for Hoppscotch instance operators. Key motivations include:

- **Runtime configurability**: Admins can update configuration (e.g., enabling/disabling SSO providers, toggling SMTP, changing rate limits) without editing environment files or rebuilding the application.
- **Secure storage**: Sensitive values like client secrets, SMTP passwords, OAuth2 tokens are automatically encrypted at rest using a `DATA_ENCRYPTION_KEY` from the `.env` file.
- **Onboarding workflow**: A guided initial setup process allows first-time administrators to configure authentication providers and mailer settings through a web UI.
- **Validation layer**: All configuration values are validated before persistence to prevent misconfiguration.
- **SSO self-healing**: Callback URLs for OAuth providers are automatically derived from the backend URL, reducing manual setup errors.

### Key Concepts
ConceptDescription**InfraConfig**A key-value pair stored in the database, representing a single configuration setting**InfraConfigEnum**A comprehensive TypeScript enum defining all possible configuration keys**Infra Token**A time-limited API token that allows external systems to manage users via REST APIs**Onboarding**The initial setup wizard that configures authentication and mailer settings**Service Status**An enum (`ENABLE`/`DISABLE`) used to toggle services like SMTP, analytics, SSO
## Architecture
### High-Level Architecture
加载图表中...
>
Source: [schema.prisma](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L215-L223)

The `infra_token` table:

prisma1model InfraToken {
2  id         String    @id @default(cuid())
3  creatorUid String
4  label      String
5  token      String    @unique @default(uuid())
6  expiresOn  DateTime? @db.Timestamptz(3)
7  createdOn  DateTime  @default(now()) @db.Timestamptz(3)
8  updatedOn  DateTime  @default(now()) @db.Timestamptz(3)
9}
>
Source: [schema.prisma](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L236-L244)

### Key Design Decisions
**Encryption Strategy**: Values marked as `isEncrypted: true` in the default config list are encrypted/decrypted transparently. This is done using a `DATA_ENCRYPTION_KEY` environment variable. If the key is changed after data has been encrypted, the system detects this via OpenSSL bad decrypt errors and throws a clear error message.

**Application Restart on Configuration Change**: When critical configuration values are updated (e.g., auth providers, SMTP settings), the application performs a graceful shutdown after 5 seconds. This is intentional — NestJS modules load their configuration at startup, so changes require a restart to take effect. The 5-second delay ensures the database write is committed before shutdown.

**Shared Prisma Instance**: The `loadInfraConfiguration()` function creates a separate shared PrismaService instance to read from the database during module initialization, before the NestJS application context is fully set up.

## Configuration Categories
The `InfraConfigEnum` defines 40+ configuration keys organized into functional categories:

typescript1export enum InfraConfigEnum {
2  // Onboarding
3  ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED',
4  ONBOARDING_RECOVERY_TOKEN = 'ONBOARDING_RECOVERY_TOKEN',
5
6  // Security & Tokens
7  JWT_SECRET = 'JWT_SECRET',
8  SESSION_SECRET = 'SESSION_SECRET',
9  SESSION_COOKIE_NAME = 'SESSION_COOKIE_NAME',
10  TOKEN_SALT_COMPLEXITY = 'TOKEN_SALT_COMPLEXITY',
11  MAGIC_LINK_TOKEN_VALIDITY = 'MAGIC_LINK_TOKEN_VALIDITY',
12  REFRESH_TOKEN_VALIDITY = 'REFRESH_TOKEN_VALIDITY',
13  ACCESS_TOKEN_VALIDITY = 'ACCESS_TOKEN_VALIDITY',
14  ALLOW_SECURE_COOKIES = 'ALLOW_SECURE_COOKIES',
15
16  // Rate Limiting
17  RATE_LIMIT_TTL = 'RATE_LIMIT_TTL',
18  RATE_LIMIT_MAX = 'RATE_LIMIT_MAX',
19
20  // SMTP / Mailer
21  MAILER_SMTP_ENABLE = 'MAILER_SMTP_ENABLE',
22  MAILER_USE_CUSTOM_CONFIGS = 'MAILER_USE_CUSTOM_CONFIGS',
23  MAILER_SMTP_URL = 'MAILER_SMTP_URL',
24  MAILER_ADDRESS_FROM = 'MAILER_ADDRESS_FROM',
25  MAILER_SMTP_HOST = 'MAILER_SMTP_HOST',
26  MAILER_SMTP_PORT = 'MAILER_SMTP_PORT',
27  MAILER_SMTP_SECURE = 'MAILER_SMTP_SECURE',
28  MAILER_SMTP_USER = 'MAILER_SMTP_USER',
29  MAILER_SMTP_PASSWORD = 'MAILER_SMTP_PASSWORD',
30  MAILER_TLS_REJECT_UNAUTHORIZED = 'MAILER_TLS_REJECT_UNAUTHORIZED',
31  MAILER_SMTP_IGNORE_TLS = 'MAILER_SMTP_IGNORE_TLS',
32  MAILER_SMTP_AUTH_TYPE = 'MAILER_SMTP_AUTH_TYPE',
33  MAILER_SMTP_OAUTH2_USER = 'MAILER_SMTP_OAUTH2_USER',
34  MAILER_SMTP_OAUTH2_CLIENT_ID = 'MAILER_SMTP_OAUTH2_CLIENT_ID',
35  MAILER_SMTP_OAUTH2_CLIENT_SECRET = 'MAILER_SMTP_OAUTH2_CLIENT_SECRET',
36  MAILER_SMTP_OAUTH2_REFRESH_TOKEN = 'MAILER_SMTP_OAUTH2_REFRESH_TOKEN',
37  MAILER_SMTP_OAUTH2_ACCESS_URL = 'MAILER_SMTP_OAUTH2_ACCESS_URL',
38
39  // Google SSO
40  GOOGLE_CLIENT_ID = 'GOOGLE_CLIENT_ID',
41  GOOGLE_CLIENT_SECRET = 'GOOGLE_CLIENT_SECRET',
42  GOOGLE_CALLBACK_URL = 'GOOGLE_CALLBACK_URL',
43  GOOGLE_SCOPE = 'GOOGLE_SCOPE',
44
45  // GitHub SSO
46  GITHUB_CLIENT_ID = 'GITHUB_CLIENT_ID',
47  GITHUB_CLIENT_SECRET = 'GITHUB_CLIENT_SECRET',
48  GITHUB_CALLBACK_URL = 'GITHUB_CALLBACK_URL',
49  GITHUB_SCOPE = 'GITHUB_SCOPE',
50
51  // Microsoft SSO
52  MICROSOFT_CLIENT_ID = 'MICROSOFT_CLIENT_ID',
53  MICROSOFT_CLIENT_SECRET = 'MICROSOFT_CLIENT_SECRET',
54  MICROSOFT_CALLBACK_URL = 'MICROSOFT_CALLBACK_URL',
55  MICROSOFT_SCOPE = 'MICROSOFT_SCOPE',
56  MICROSOFT_TENANT = 'MICROSOFT_TENANT',
57
58  // Auth Providers
59  VITE_ALLOWED_AUTH_PROVIDERS = 'VITE_ALLOWED_AUTH_PROVIDERS',
60
61  // Analytics
62  ALLOW_ANALYTICS_COLLECTION = 'ALLOW_ANALYTICS_COLLECTION',
63  ANALYTICS_USER_ID = 'ANALYTICS_USER_ID',
64
65  // Setup & Features
66  IS_FIRST_TIME_INFRA_SETUP = 'IS_FIRST_TIME_INFRA_SETUP',
67  USER_HISTORY_STORE_ENABLED = 'USER_HISTORY_STORE_ENABLED',
68  MOCK_SERVER_WILDCARD_DOMAIN = 'MOCK_SERVER_WILDCARD_DOMAIN',
69}
>
Source: [InfraConfig.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/InfraConfig.ts#L1-L62)

## Initialization Flow
When the application starts, the `InfraConfigService` initializes the `infra_config` table via the `OnModuleInit` lifecycle hook. This bootstrap process ensures the database has all required config entries.

加载图表中...
### Step-by-Step Initialization

- **Config loading**: `ConfigModule.forRoot()` calls `loadInfraConfiguration()` which reads all rows from the `infra_config` table and returns them as `{ INFRA: { ... } }`.
- **Module init**: `InfraConfigService.onModuleInit()` triggers the table population process.
- **Default generation**: `getDefaultInfraConfigs()` builds the complete list of expected config entries with their default values. Critically, `JWT_SECRET` and `SESSION_SECRET` are generated as random 32-byte hex strings on first run.
- **Missing entries**: `getMissingInfraConfigEntries()` compares the default list against existing DB rows and returns what's missing.
- **Encryption upgrade**: `getEncryptionRequiredInfraConfigEntries()` finds existing entries that should be encrypted but aren't yet.
- **Derived env**: `buildDerivedEnv()` auto-corrects callback URLs if the backend URL has changed, and syncs `ALLOW_SECURE_COOKIES` with the protocol of the base URL.
- **Restart**: If any changes were made, the application restarts to pick up the new configuration.

## Core Flow
### Configuration Update Flow
When an admin updates configuration values via the GraphQL API:

加载图表中...
### Onboarding Flow
The onboarding flow is the initial setup wizard:

加载图表中...
## Usage Examples
### Checking Setup Status via REST API
The `SiteController` provides endpoints to check and complete the initial setup:

typescript1@Get('setup')
2@UseGuards(JwtAuthGuard, RESTAdminGuard)
3async fetchSetupInfo() {
4  const status = await this.infraConfigService.get(
5    InfraConfigEnum.IS_FIRST_TIME_INFRA_SETUP,
6  );
7  if (E.isLeft(status))
8    throwHTTPErr(<RESTError>{
9      message: status.left,
10      statusCode: HttpStatus.NOT_FOUND,
11    });
12  return status.right;
13}
>
Source: [infra-config.controller.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/infra-config.controller.ts#L16-L29)

### Updating Configuration via GraphQL (Admin)
The `InfraResolver` provides the `updateInfraConfigs` mutation for batch updates:

typescript1@Mutation(() => [InfraConfig], {
2  description: 'Update Infra Configs',
3})
4@UseGuards(GqlAuthGuard, GqlAdminGuard)
5async updateInfraConfigs(
6  @Args({
7    name: 'infraConfigs',
8    type: () => [InfraConfigArgs],
9    description: 'InfraConfigs to update',
10  })
11  infraConfigs: InfraConfigArgs[],
12) {
13  const updatedRes = await this.infraConfigService.updateMany(infraConfigs);
14  if (E.isLeft(updatedRes)) throwErr(updatedRes.left);
15  return updatedRes.right;
16}
>
Source: [infra.resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L316-L331)

### Toggling Analytics Collection
typescript1@Mutation(() => Boolean, {
2  description: 'Enable or disable analytics collection',
3})
4@UseGuards(GqlAuthGuard, GqlAdminGuard)
5async toggleAnalyticsCollection(
6  @Args({
7    name: 'status',
8    type: () => ServiceStatus,
9    description: 'Toggle analytics collection',
10  })
11  analyticsCollectionStatus: ServiceStatus,
12) {
13  const res = await this.infraConfigService.toggleAnalyticsCollection(
14    analyticsCollectionStatus,
15  );
16  if (E.isLeft(res)) throwErr(res.left);
17  return res.right;
18}
>
Source: [infra.resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L333-L350)

### Creating an Infra Token for External Integrations
Infra tokens allow external systems to manage users via REST APIs:

typescript1async create(label: string, expiryInDays: number, admin: Admin) {
2  if (!isValidLength(label, this.TITLE_LENGTH)) {
3    return E.left(INFRA_TOKEN_LABEL_SHORT);
4  }
5  if (!this.validateExpirationDate(expiryInDays ?? null)) {
6    return E.left(INFRA_TOKEN_EXPIRY_INVALID);
7  }
8  const createdInfraToken = await this.prisma.infraToken.create({
9    data: {
10      creatorUid: admin.uid,
11      label,
12      expiresOn: calculateExpirationDate(expiryInDays ?? null) ?? undefined,
13    },
14  });
15  const res: CreateInfraTokenResponse = {
16    token: createdInfraToken.token,
17    info: this.cast(createdInfraToken),
18  };
19  return E.right(res);
20}
>
Source: [infra-token.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-token/infra-token.service.ts#L77-L100)

## Configuration Options
### Infrastructure Configuration Defaults
The following table lists the default values for each configuration key as defined in `getDefaultInfraConfigs()`:

Config KeyTypeDefaultDescription`ONBOARDING_COMPLETED`boolean`false`Whether initial onboarding has been completed`JWT_SECRET`string (encrypted)Random 32-byte hexSecret key used for JWT token signing`SESSION_SECRET`string (encrypted)Random 32-byte hexSecret key used for session encryption`SESSION_COOKIE_NAME`string`null`Custom session cookie name (alphanumeric, `_`, `-` only)`TOKEN_SALT_COMPLEXITY`integer`10`Bcrypt salt rounds for token hashing`MAGIC_LINK_TOKEN_VALIDITY`integer (hours)`24`Magic link token expiration time`REFRESH_TOKEN_VALIDITY`integer (ms)`604800000` (7 days)Refresh token validity in milliseconds`ACCESS_TOKEN_VALIDITY`integer (ms)`86400000` (1 day)Access token validity in milliseconds`ALLOW_SECURE_COOKIES`booleanDerived from `VITE_BASE_URL`Whether cookies require HTTPS`RATE_LIMIT_TTL`integer (ms)`10000` (10s)Rate limit time window`RATE_LIMIT_MAX`integer`100`Max requests per IP per TTL window`MAILER_SMTP_ENABLE`boolean`false`Enable/disable SMTP mailer`MAILER_SMTP_IGNORE_TLS`boolean`false`Ignore TLS for SMTP connections`MAILER_SMTP_AUTH_TYPE`enum`LOGIN`SMTP authentication type`ALLOW_ANALYTICS_COLLECTION`boolean`false`Allow PostHog analytics collection`USER_HISTORY_STORE_ENABLED`boolean`true`Enable storing user request history`IS_FIRST_TIME_INFRA_SETUP`boolean`true` (if table empty)First-time setup flag
### Valid Token Durations
Infra tokens support a fixed set of expiration durations:

Duration (Days)Description`7`One week`30`One month`60`Two months`90`Three months
## API Reference
### InfraConfigService
#### `get(name: InfraConfigEnum): Either<string, InfraConfig>`
Retrieve a single infrastructure configuration by name.

**Parameters:**

- `name` (InfraConfigEnum): The configuration key to retrieve

**Returns:** `Either<string, InfraConfig>` — Right with the config model, or Left with error string

**Throws:** `INFRA_CONFIG_NOT_FOUND` if the key does not exist in the database

#### `getMany(names: InfraConfigEnum[], checkDisallowedKeys?: boolean): Either<string, InfraConfig[]>`
Retrieve multiple infrastructure configurations by name.

**Parameters:**

- `names` (InfraConfigEnum[]): Array of configuration keys to retrieve
- `checkDisallowedKeys` (boolean, default: `true`): If true, rejects requests for sensitive keys like `VITE_ALLOWED_AUTH_PROVIDERS`, `ANALYTICS_USER_ID`, `IS_FIRST_TIME_INFRA_SETUP`

**Returns:** `Either<string, InfraConfig[]>` — Right with array of config models, or Left with error string

#### `update(name: InfraConfigEnum, value: string, restartEnabled?: boolean): Either<string, InfraConfig>`
Update a single infrastructure configuration.

**Parameters:**

- `name` (InfraConfigEnum): The configuration key to update
- `value` (string): The new value
- `restartEnabled` (boolean, default: `false`): If true, triggers application restart after update

**Returns:** `Either<string, InfraConfig>` — Right with updated config model, or Left with error string

#### `updateMany(infraConfigs: InfraConfigArgs[], checkDisallowedKeys?: boolean): Either<string, InfraConfigArgs[]>`
Batch update multiple infrastructure configurations in a database transaction.

**Parameters:**

- `infraConfigs` (InfraConfigArgs[]): Array of key-value pairs to update
- `checkDisallowedKeys` (boolean, default: `true`): If true, rejects updates to protected keys

**Returns:** `Either<string, InfraConfigArgs[]>` — Right with updated values, or Left with error string

**Side Effects:** Always triggers application restart after successful update

#### `reset(): Either<string, boolean>`
Reset all infrastructure configurations to their default values (from .env).

**Returns:** `Either<string, boolean>` — Right with `true` on success, or Left with error string

**Notes:** Excludes `IS_FIRST_TIME_INFRA_SETUP`, `ANALYTICS_USER_ID`, and `ALLOW_ANALYTICS_COLLECTION` from reset. Sets `ONBOARDING_COMPLETED` to `false`.

#### `toggleServiceStatus(configName: InfraConfigEnum, status: ServiceStatus, restartEnabled?: boolean): Either<string, boolean>`
Enable or disable a boolean service configuration (e.g., analytics, user history).

**Parameters:**

- `configName` (InfraConfigEnum): The config key to toggle
- `status` (ServiceStatus): `ENABLE` or `DISABLE`
- `restartEnabled` (boolean, default: `false`): Whether to restart app after change

**Returns:** `Either<string, boolean>` — Right with `true`, or Left with error string

**Side Effects:** Publishes event `infra_config/{configName}/updated` via PubSub

#### `enableAndDisableSSO(providerInfo: EnableAndDisableSSOArgs[]): Either<string, boolean>`
Enable or disable SSO authentication providers for login/signup.

**Parameters:**

- `providerInfo` (EnableAndDisableSSOArgs[]): Array of `{ provider: AuthProvider, status: ServiceStatus }` pairs

**Returns:** `Either<string, boolean>` — Right with `true`, or Left with error string

**Throws:** `AUTH_PROVIDER_NOT_SPECIFIED` if all providers are disabled; `INFRA_CONFIG_SERVICE_NOT_CONFIGURED` if required keys are missing

#### `isServiceConfigured(service: AuthProvider, configMap: Record<string, string>): boolean`
Check if a service (auth provider or mailer) is fully configured.

**Parameters:**

- `service` (AuthProvider): `GOOGLE`, `GITHUB`, `MICROSOFT`, or `EMAIL`
- `configMap` (Record<string, string>): Map of available config values

**Returns:** `boolean` — `true` if all required keys for the service are present and non-empty

### OnboardingController (REST)
#### `GET /v1/onboarding/status`
Get the current onboarding status.

**Response:**

json1{
2  "onboardingCompleted": false,
3  "canReRunOnboarding": true
4}
#### `POST /v1/onboarding/config`
Save the initial onboarding configuration (auth providers, mailer settings).

**Request Body:** `SaveOnboardingConfigRequest` — Contains all auth provider and mailer configuration fields.

**Response:**

json{
  "token": "<onboarding-recovery-token>"
}
#### `GET /v1/onboarding/config?token=<recovery-token>`
Retrieve the onboarding configuration. Requires the recovery token to decrypt sensitive values.

### InfraTokensController (REST)
Base path: `/v1/infra` — Requires `Authorization: Bearer <infra-token>` header.

EndpointMethodDescription`/v1/infra/user-invitations`POSTCreate a user invitation`/v1/infra/user-invitations`GETGet pending user invitations`/v1/infra/user-invitations`DELETEDelete a pending user invitation`/v1/infra/users`GETGet users list (with search)`/v1/infra/users/:uid`GETGet user details`/v1/infra/users/:uid`PATCHUpdate user display name`/v1/infra/users/:uid`DELETEDelete a user`/v1/infra/users/:uid/admin-status`PATCHUpdate user admin status`/v1/infra/users/:uid/workspaces`GETGet user workspaces
## Related Links
### Source Files

- [InfraConfigService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/infra-config.service.ts) — Core service implementation
- [Helper Functions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/helper.ts) — Default configs, loading, lifecycle utilities
- [InfraConfig Enum](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/InfraConfig.ts) — All configuration key definitions
- [InfraConfig Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/infra-config.model.ts) — GraphQL model definition
- [InfraConfig Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/infra-config.resolver.ts) — GraphQL queries and subscriptions
- [Infra Resolver (Admin)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/admin/infra.resolver.ts) — Admin GraphQL mutations
- [Onboarding Controller](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/onboarding.controller.ts) — REST endpoints for onboarding
- [Site Controller](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-config/infra-config.controller.ts) — REST endpoints for setup status
- [InfraToken Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-token/infra-token.service.ts) — Token management service
- [InfraToken Controller](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/infra-token/infra-token.controller.ts) — External user management API
- [Prisma Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma) — Database model definitions (lines 215-244)
- [App Module](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/app.module.ts) — Module registration and ConfigModule setup
- [Error Codes](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/errors.ts) — All infrastructure-related error constants

### Related Documentation

- [Authentication Configuration](./05-authentication-configuration) — Configuring SSO providers
- [Mailer Configuration](./06-mailer-configuration) — SMTP setup and email delivery
- [Admin Dashboard](./12-admin-dashboard) — Managing the instance via admin panel
- [Environment Variables](./03-environment-variables) — List of all supported `.env` variables