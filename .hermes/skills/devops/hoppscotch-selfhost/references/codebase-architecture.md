# Hoppscotch Codebase Architecture (for Feature Development)

Key paths and patterns for extending Hoppscotch. Based on dev branch analysis.
Proven by implementing the Path Parameters feature (v18 schema addition).

## Monorepo Layout

```
packages/
  hoppscotch-data/      # Data models, schemas, versioned entities (Zod + verzod)
  hoppscotch-common/    # Shared UI components, composables, helpers (Vue 3)
  hoppscotch-backend/   # NestJS backend (GraphQL + REST)
  hoppscotch-selfhost-web/  # Self-hosted frontend (Vue 3 + Vite)
  hoppscotch-sh-admin/      # Admin dashboard (Vue 3 + Vite)
  hoppscotch-cli/           # CLI tool
  hoppscotch-js-sandbox/    # Scripting sandbox (pre-request/test scripts)
```

## Data Model Versioning (hoppscotch-data)

REST request schema is versioned (currently v18) using `verzod`:
- `packages/hoppscotch-data/src/rest/v/<N>.ts` — each version has Zod schema + migration
- `packages/hoppscotch-data/src/rest/index.ts` — version registry, re-exports, `HoppRESTRequest` type
- To add a field: create v18, extend V17_SCHEMA, add migration `up()`, register in index.ts
- `HoppRESTRequest = createVersionedEntity({ latestVersion, versionMap, getVersion })`

### Key Types
- `HoppRESTParams = Array<{key, value, active, description}>` — query params (v7+)
- `HoppRESTHeaders = Array<{key, value, active, description}>` — headers (v7+)
- `HoppRESTRequestVariables = Array<{key, value, active}>` — request variables (v2+)
- `HoppRESTPathParams = Array<{key, value, active, description}>` — path parameters (v18+)
- `HoppRESTAuth` — discriminated union of auth types (none, inherit, basic, bearer, oauth2, api-key, aws-signature, digest, hawk, akamai, jwt)

### GraphQL Persistence
- `packages/hoppscotch-data/src/graphql/v/` — same versioning pattern for collection data
- Must sync new fields between REST and GraphQL schemas

### Original Request (response history)
- `packages/hoppscotch-data/src/rest-request-response/original-request/v/` — versioned schema for saved responses
- Currently at v7 (added pathParams). Must be updated when adding REST schema fields.

## Frontend Architecture (hoppscotch-common)

### Request Tab UI
- `components/http/RequestOptions.vue` — Tab container (Params, Path Params, Body, Headers, Auth, Scripts, Variables)
- `components/http/Parameters.vue` — Query parameters editor (draggable, bulk mode, env highlighting)
- `components/http/PathParams.vue` — Path parameters editor (same structure as Parameters)
- `components/http/RequestVariables.vue` — Request variables editor
- `components/http/Headers.vue` — Headers editor with inherited properties

### Response Tab UI
- `components/lenses/ResponseBodyRenderer.vue` — Tab container (lens renderers, Headers, Test Results, Actual Request, Request Headers, Console)
- `components/lenses/HeadersRenderer.vue` — Read-only header list with copy button
- `components/lenses/ActualRequestRenderer.vue` — Read-only actual request display (method, URL, params, headers, body, auth) with collapsible sections and copy button
- `components/lenses/renderers/*.vue` — Response body lens renderers (JSON, Raw, HTML, XML, Image, Audio, Video, PDF)

### Response Data Types (hoppscotch-common)
- `helpers/types/HoppRESTResponse.ts` — Union type for all response states
  - `HoppRESTSuccessResponse` / `HoppRESTFailureResponse` — `type: "success"/"fail"`, `headers`, `body` (ArrayBuffer), `statusCode`, `statusText`, `meta`, `req` (HoppRESTRequest)
  - `HoppRESTFailureNetwork` — `type: "network_fail"`, `error`, `req`
  - All response variants with `req` field contain the full `HoppRESTRequest` that was sent

### URL Handling
- `components/http/Request.vue` — Method selector + URL input (SmartEnvInput)
- `components/smart/EnvInput.vue` — Input with `<<env_var>>` highlighting
- `helpers/utils/EffectiveURL.ts` — `getEffectiveRESTRequest()` resolves env vars in URL/params/headers/body
- `helpers/RequestRunner.ts` — Full request lifecycle (pre-request script → send → test script)

### Environment Variable Substitution
- `hoppscotch-data/src/environment/index.ts` — `parseTemplateString()` / `parseTemplateStringE()`
- Pattern: `<<variable_name>>` — regex `/<<([^>]*)>>/g`
- Recursively expands up to 10 levels deep
- Looks up in: predefined variables → environment variables → empty string
- Also supports secret masking and show-key-if-not-found mode

### Key Services (DiOC)
- `RESTTabService` — tab management
- `InspectionService` — linting/inspection results
- `CurrentValueService` — environment variable resolution
- `SecretEnvironmentService` — secret variable handling
- `KernelInterceptorService` — request interception

## Backend Architecture (hoppscotch-backend)

### InfraConfig
- `src/infra-config/infra-config.service.ts` — core config CRUD + encryption
- `src/infra-config/helper.ts` — validation functions (validateSMTPUrl, validateSMTPEmail, etc.)
- `src/infra-config/onboarding.controller.ts` — REST endpoints for setup
- `src/infra-config/dto/onboarding.dto.ts` — onboarding request DTO
- `src/types/InfraConfig.ts` — InfraConfigEnum (all config key names)
- `initializeInfraConfigTable()` — auto-populates missing config, calls stopApp() on first run

### Auth
- `src/auth/auth.controller.ts` — endpoints: GET /providers, POST /signin, POST /verify, GET /refresh, OAuth2 flows
- SMTPAuthType enum: `LOGIN = 'login'`, `OAUTH2 = '***'` (lowercase values!)

### Encryption
- `src/utils.ts` — `encrypt(text, key)` → `iv_hex:encrypted_hex` format (aes-256-cbc, 16-byte IV)
- Key must be exactly 32 bytes (UTF-8)

## i18n

- `packages/hoppscotch-common/locales/en.json` — main locale file
- `packages/hoppscotch-sh-admin/locales/en.json` — admin locale
- Chinese locales: `cn.json` (simplified), `tw.json` (traditional)
- Use Python `json` module to modify locale files (sed/patch can corrupt Unicode curly quotes)

### i18n Key Pitfalls
Some keys are NOT nested where you'd expect them:
- `request.parameter_list` → "Query Parameters" (NOT `request.query_params`)
- `request.path_parameter_list` → "Path Parameters"
- `request.authorization` → "Authorization" (flat string, NOT `request.authorization.label`)
- `request.body` → "Request Body"
- `response.headers` → "Headers" (response headers)
- `response.request_headers` → "Request Headers"
- Response section keys go under `response.*`, request section under `request.*`

## Feature Development Workflow (Proven)

Adding a new field (e.g. `pathParams`) to `HoppRESTRequest` requires changes across
multiple packages. Here's the proven sequence:

### Step 1: Data Model (hoppscotch-data)
1. Create `rest/v/<N+1>.ts` — extend previous schema, add new field, write `up()` migration
2. Update `rest/index.ts`:
   - Import new version + export new type
   - `latestVersion: N+1`, add to `versionMap`
   - Update `RESTReqSchemaVersion` string
   - Add to `HoppRESTRequestEq` struct
   - Add to `safelyExtractRESTRequest()` extraction logic
   - Add to `getDefaultRESTRequest()` with empty default
3. Create `rest-request-response/original-request/v/<N+1>.ts` — same pattern
4. Update `rest-request-response/original-request/index.ts` — register new version

### Step 2: Request Execution (hoppscotch-common)
1. `EffectiveURL.ts` → `getEffectiveRESTRequest()` — inject new field values into
   environment variables BEFORE the existing `environment.variables` so they take
   priority in `parseTemplateString` (which uses `variables.find()` returning first match)
2. Add field to `EffectiveHoppRESTRequest` interface
3. `RequestRunner.ts` usually does NOT need changes — it calls `getEffectiveRESTRequest()`
   which already handles the new field

### Step 3: UI Components (hoppscotch-common)
1. Create new `components/http/<NewSection>.vue` — copy the most similar existing
   component (e.g. Parameters.vue) and adapt types/labels
2. Add tab to `RequestOptions.vue`:
   - Import new component
   - Add tab ID to `_VALID_OPTION_TABS` array
   - Add `<HoppSmartTab>` in template at desired position
   - Add computed for active count badge
3. Add auto-detection watcher in `Request.vue` if needed (debounced, 300ms)

### Step 4: Documentation Preview (hoppscotch-common)
1. Create `collections/documentation/sections/<NewSection>.vue`
2. Add component in `RequestPreview.vue` template
3. Add i18n keys under `documentation.<section>.title` / `documentation.<section>.no_params`

### Step 5: CLI Support (hoppscotch-cli)
1. Add field to `interfaces/request.ts` EffectiveHoppRESTRequest
2. Update `utils/getters.ts` → `getResolvedVariables()` to include new field
3. Update `utils/pre-request.ts` → `getEffectiveRESTRequest()` to pass new field
4. Update `utils/request.ts` defaults
5. Add tests in `__tests__/`

### Step 6: i18n + Build Verification
1. Add keys to `packages/hoppscotch-common/locales/en.json`
2. Run `pnpm run generate` (full build) to verify no type/compile errors
3. Restart all three services and verify

## Key Patterns Discovered

### Env Var Priority via Array Ordering
`parseTemplateString()` uses `variables.find(x => x.key === p1)` which returns the
FIRST match. To give a field higher priority than environment variables, place its
entries BEFORE `environment.variables` in the merged array:
```ts
const mergedEnvVars = [
  ...activePathParams,  // highest priority
  ...environment.variables.filter(v => !activePathParams.some(p => p.key === v.key)),
]
```

### Vue Component Auto-Import
Hoppscotch uses `unplugin-vue-components` with `Components` resolver. Components in
`components/` directory are auto-imported — do NOT add manual imports for components
that follow the naming convention (e.g. `HttpPathParams` from `PathParams.vue` is
auto-resolved). But explicit imports ARE needed for non-convention references.

### Schema Version Is a String
`RESTReqSchemaVersion` is a string (`"18"`), while `latestVersion` in
`createVersionedEntity` is a number (`18`). Don't mix them up.

### Null-Safe Access Required for New Fields on Persisted Data
When adding fields to versioned entities, persisted tab data in localStorage may still
be in the old format. Even though `verzod` migration adds the field during `safeParse()`,
the reactive persisted state loaded via `loadTabsFromPersistedState` /
`safelyExtractRESTRequest` may NOT go through migration, leaving the new field as
`undefined` on the reactive object.

**ALWAYS use null-safe access (`?? []`, `?? ''`, `?? {}`) in Vue computed/watchers/templates:**
```ts
// WRONG — crashes on persisted tabs without the new field:
const count = request.value.pathParams.filter(x => x.active).length

// CORRECT — null-safe:
const count = (request.value.pathParams ?? []).filter(x => x.active).length
```

This is the #1 cause of blank pages after adding schema fields. See P20 in SKILL.md.

### NEVER Use `render-inactive-tabs` on HoppSmartTabs in RequestOptions
When adding a new tab to `RequestOptions.vue`, do NOT add `render-inactive-tabs`
to the `HoppSmartTabs` container. The `@hoppscotch/ui` `addTabEntry` function throws
an error on duplicate IDs (instead of silently ignoring them). During Vue component
patching, new tab components mount before old ones unmount, causing `addTabEntry`
to fire twice for the same ID → `Error: Tab with duplicate ID created: 'params'` →
crashes the entire component tree → blank request options area.

The original codebase had `render-inactive-tabs` on `RequestOptions.vue`'s
`HoppSmartTabs`, and it worked because the tab list was stable. Adding a new tab
(pathParams) changed the component tree enough to trigger the re-render race condition.

See P22 in SKILL.md for full details.

### Vite HMR Picks Up New Files
When adding new `.vue` files during dev mode (`pnpm run dev`), Vite's HMR picks them
up without restart. But if you modify `vite.config.ts`, you need to restart the dev
server.

### Build Command
Root `pnpm run build` does not exist. Use `pnpm run generate` for full production build
(all packages). Individual packages have `do-build-prod` scripts invoked by the workspace.

### delegate_task for Parallel Frontend Work
When modifying 3+ files across different concerns (EffectiveURL, UI component, i18n,
RequestOptions), use `delegate_task` with `tasks` array for parallel execution. Each
subagent gets isolated context, preventing the main context window from filling with
intermediate read_file output.
