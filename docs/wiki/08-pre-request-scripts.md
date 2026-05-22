# Pre-Request Scripts
Pre-request scripts are JavaScript code snippets associated with an HTTP request that execute automatically before the request is sent, allowing you to set environment variables, modify request parameters, headers, body, or authentication at runtime.

## Overview
Pre-request scripts in Hoppscotch provide a powerful mechanism to programmatically prepare and mutate HTTP requests before they are dispatched. They are executed in a sandboxed JavaScript environment — isolating the script from the host system for security. The scripts have access to three namespaces (`pw`, `hopp`, and `pm`) that expose environment variables, request properties, and cookie management APIs.

**Key use cases include:**

- Setting dynamic environment variables (timestamps, random values, tokens)
- Mutating request URL, method, headers, query parameters, body, or authentication
- Computing and injecting authentication tokens or signatures
- Managing cookies programmatically before request execution
- Accessing and resolving environment variables with fallback behavior
- Making auxiliary HTTP requests via `hopp.fetch()` or `pm.sendRequest()`
- Preparing request variables scoped to the current request only

The pre-request scripting system supports **script inheritance** from parent collections — scripts defined at the collection level are automatically inherited by child requests, with the execution order being root-level collection scripts first, followed by the request's own script.

## Architecture
### Pre-Request Script Execution Architecture
The following diagram illustrates the layered architecture of the pre-request script system, showing how scripts flow from the UI through the sandbox to modify the request:

加载图表中...
### Component Roles
ComponentLocationRole`PreRequestScript.vue``packages/hoppscotch-common/src/components/http/`UI component with Monaco/CodeMirror editor, snippet panel, and inherited script indicator`RequestRunner.ts``packages/hoppscotch-common/src/helpers/`Orchestrates pre-request and post-request script execution during the request lifecycle`runPreRequestScript``packages/hoppscotch-js-sandbox/src/webnode/pre-request/``pre-request.js``packages/hoppscotch-js-sandbox/src/bootstrap-code/`Bootstrap code that runs inside the sandbox, defining `pw`, `hopp`, and `pm` namespaces`getRequestSetterMethods``packages/hoppscotch-js-sandbox/src/utils/pre-request.ts`Factory function returning mutation methods for request properties`preRequestScriptSnippets.ts``packages/hoppscotch-common/src/helpers/`Predefined code snippets for common tasks`preRequest.ts` (completion)`packages/hoppscotch-common/src/helpers/editor/completion/`Editor autocomplete for pre-request script APIs`preRequest.ts` (linting)`packages/hoppscotch-common/src/helpers/editor/linting/`Editor syntax and semantic linting for pre-request scripts`pre-request.d.ts``packages/hoppscotch-common/src/types/`TypeScript type definitions for `pw`, `hopp`, and `pm` namespaces
## Execution Flow
### Pre-Request Script Execution Lifecycle
The sequence diagram below shows the complete lifecycle of a pre-request script from the moment the user sends a request to the final dispatch:

加载图表中...
## JavaScript Namespaces
Pre-request scripts execute in a sandboxed environment with three distinct namespaces exposed as global objects.

### `pw` Namespace — Primary Workflow API
The `pw` namespace provides a simple, streamlined API for common pre-request scripting tasks.

typescript1pw.env.get(key: string): string
2pw.env.getResolve(key: string): string
3pw.env.set(key: string, value: string): void
4pw.env.unset(key: string): void
5pw.env.resolve(key: string): string
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L229-L237)

### `hopp` Namespace — Full API with Scoped Access
The `hopp` namespace is the primary Hoppscotch API with full environmental control and request mutation capabilities.

**Environment API:**

typescript1hopp.env.get(key: string): string | null           // Resolve variable (active then global)
2hopp.env.getRaw(key: string): string | null         // Get raw value without resolution
3hopp.env.set(key: string, value: string): void      // Set in active environment
4hopp.env.delete(key: string): void                  // Delete from active environment
5hopp.env.reset(key: string): void                   // Reset to initial value
6hopp.env.getInitialRaw(key: string): string | null  // Get initial raw value
7hopp.env.setInitial(key: string, value: string): void
8
9// Scoped sub-namespaces
10hopp.env.active.get / set / delete / reset / ...    // Active environment scope
11hopp.env.global.get / set / delete / reset / ...    // Global environment scope
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L239-L266)

**Request API:**

typescript1// Read-only properties
2hopp.request.url: string
3hopp.request.method: string
4hopp.request.params: HoppRESTParam[]
5hopp.request.headers: HoppRESTHeader[]
6hopp.request.body: HoppRESTReqBody
7hopp.request.auth: HoppRESTAuth
8
9// Mutation methods
10hopp.request.setUrl(url: string): void
11hopp.request.setMethod(method: string): void
12hopp.request.setHeader(name: string, value: string): void
13hopp.request.setHeaders(headers: HoppRESTHeaders): void
14hopp.request.removeHeader(key: string): void
15hopp.request.setParam(name: string, value: string): void
16hopp.request.setParams(params: HoppRESTParams): void
17hopp.request.removeParam(key: string): void
18hopp.request.setBody(body: Partial<HoppRESTReqBody>): void
19hopp.request.setAuth(auth: Partial<HoppRESTAuth>): void
20
21// Request variables (scoped to current request only)
22hopp.request.variables.get(key: string): string | null
23hopp.request.variables.set(key: string, value: string): void
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L268-L337)

**Cookies API:**

typescript1hopp.cookies.get(domain: string, name: string): Cookie | null
2hopp.cookies.set(domain: string, cookie: Cookie): void
3hopp.cookies.has(domain: string, name: string): boolean
4hopp.cookies.getAll(domain: string): Cookie[]
5hopp.cookies.delete(domain: string, name: string): void
6hopp.cookies.clear(domain: string): void
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L339-L346)

**Fetch API:**

typescript`hopp.fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>`
The global `fetch()` function is also aliased to `hopp.fetch()` which respects interceptor settings. This means network requests made from scripts go through the same interceptor pipeline as regular requests.

>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L348-L370)

### `pm` Namespace — Postman Compatibility
The `pm` namespace provides Postman-compatible APIs for migrating existing collections. It wraps the underlying `hopp` namespace methods to match Postman's API surface.

**Key `pm` sub-namespaces available in pre-request scripts:**

Sub-namespacePurpose`pm.environment`Active environment variables (get/set/unset/has/clear/toObject)`pm.globals`Global variables (get/set/unset/has/clear/toObject)`pm.variables`Combined variable resolution (get/set/has/replaceIn)`pm.request`Full request manipulation with Postman-compatible URL object`pm.info`Script context (eventName, requestName, requestId)`pm.sendRequest()`Make auxiliary HTTP requests
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L372-L949)

The `pm.request.url` object provides rich URL manipulation:

typescript1pm.request.url.getHost(): string
2pm.request.url.getPath(unresolved?: boolean): string
3pm.request.url.getPathWithQuery(): string
4pm.request.url.getQueryString(options?: Record<string, unknown>): string
5pm.request.url.getRemote(forcePort?: boolean): string
6pm.request.url.update(url: string | { toString(): string }): void
7pm.request.url.addQueryParams(params: Array<{ key: string; value?: string }>): void
8pm.request.url.removeQueryParams(params: string | string[]): void
9pm.request.url.query.get(key: string): string | null
10pm.request.url.query.add / remove / upsert / clear / each / map / filter / ...
>
Source: [pre-request.js bootstrap code](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/bootstrap-code/pre-request.js#L322-L843)

## Request Mutation
The `getRequestSetterMethods` function in `packages/hoppscotch-js-sandbox/src/utils/pre-request.ts` creates a cloned request object and provides safe mutation methods. All mutations operate on a deep clone of the request, allowing the sandbox to modify it without affecting the original until the final merge.

>
Source: [pre-request.ts (utils)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/pre-request.ts#L10-L159)

The following methods are available for request mutation:

MethodDescriptionInput Validation`setUrl(url)`Update request endpoint URLNone`setMethod(method)`Change HTTP method (preserves case)None`setHeader(name, value)`Add or update a header (case-insensitive key)None`setHeaders(headers)`Replace all headersUses Zod schema validation`removeHeader(key)`Remove a header by key (case-insensitive)None`setParam(name, value)`Add or update a query parameter (case-insensitive key)None`setParams(params)`Replace all query parametersUses Zod schema validation`removeParam(key)`Remove a parameter by keyNone`setBody(newBody)`Merge partial body configValidates via Zod, rejects invalid objects`setAuth(newAuth)`Merge partial auth configValidates via Zod, rejects invalid objects`setRequestVariable(key, value)`Set a request-scoped variableNone
>
Source: [pre-request.ts (utils)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/pre-request.ts#L15-L141)

## Script Inheritance
Pre-request scripts can be defined at both the collection and request levels. When executing a request, the system collects all inherited scripts from parent collections and combines them into a single execution unit.

The inheritance order is:

- **Root collection scripts** — executed first
- **Child collection scripts** — executed in nesting order
- **Request-level script** — executed last

1Collection (root)
2  ├── preRequestScript: "root collection script"
3  ├── Collection (child)
4  │     ├── preRequestScript: "child collection script"
5  │     ├── Request A (no own script)
6  │     └── Request B
7  │           └── preRequestScript: "request B script"
8  └── Request C
9        └── preRequestScript: "request C script"
10
11Request B execution: root → child → requestB
12Request C execution: root → requestC
13Request A execution: root → child
>
Source: [pre-request.ts (CLI)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts#L65-L72)

The `combineScriptsWithIIFE` function wraps each script in an IIFE and concatenates them, using a `try/catch` wrapper when targeting the experimental sandbox:

typescript1// Pre-request order: root → request.
2const combinedScript = combineScriptsWithIIFE(
3  filterValidScripts([
4    ...inheritedPreRequestScripts,
5    request.preRequestScript,
6  ]),
7  experimentalScriptingSandbox ? "experimental" : "legacy"
8)
>
Source: [pre-request.ts (CLI)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts#L65-L72)

## Sandbox Security
Scripts are executed in isolated environments depending on the platform:

PlatformDefault ModeLegacy Mode**Web (Browser)**QuickJS WASM (faraday-cage)Web Worker with `Function` constructor**Desktop (Tauri)**QuickJS WASM (faraday-cage)Web Worker with `Function` constructor**CLI**QuickJS WASM (faraday-cage)`isolated-vm` V8 isolate
The experimental scripting sandbox (QuickJS) provides strong isolation guarantees:

- Scripts run in a WebAssembly sandbox, isolated from browser/DOM, Tauri IPC, and the host OS
- Network access is mediated through a controlled `hoppFetchHook` that respects interceptor settings
- Scripts receive controlled access via the `pw`, `hopp`, and `pm` namespaces only
- Request mutation is limited to the documented pre-request APIs
- No arbitrary system calls, filesystem access, or browser API access
- The bootstrap code is locked down using `Object.defineProperty` with `configurable: false` and `writable: false`

>
Source: [SECURITY.md](https://github.com/xiexb/hoppscotch/blob/main/SECURITY.md#L86)

The `pre-request.js` bootstrap code also reports script execution errors via a locked-down `__hoppReportScriptExecutionError` function, ensuring errors are captured even across async boundaries:

>
Source: [pre-request.js bootstrap code](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/bootstrap-code/pre-request.js#L12-L25)

## Usage Examples
### Basic Usage: Setting Environment Variables
typescript1// Set a static environment variable
2pw.env.set("api_version", "v2")
3
4// Set a dynamically computed timestamp
5const currentTime = Date.now()
6pw.env.set("timestamp", currentTime.toString())
>
Source: [preRequestScriptSnippets.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/preRequestScriptSnippets.ts#L1-L11)

### Environment: Set Random Number Variable
typescript1const min = 1
2const max = 1000
3const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min
4pw.env.set("randomNumber", randomNumber.toString())
>
Source: [preRequestScriptSnippets.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/preRequestScriptSnippets.ts#L14-L20)

### Modifying Request Headers and URL
javascript1// Update the request URL dynamically
2hopp.request.setUrl("https://api.example.com/v2/users")
3
4// Add an authorization header
5hopp.request.setHeader("Authorization", "Bearer " + pw.env.get("access_token"))
6
7// Remove a header that might conflict
8hopp.request.removeHeader("X-Deprecated-Header")
9
10// Set multiple headers at once
11hopp.request.setHeaders([
12  { key: "X-Custom-Header", value: "custom-value", active: true, description: "" },
13  { key: "Accept", value: "application/json", active: true, description: "" },
14])
### Modifying Query Parameters
javascript1// Add or update a query parameter
2hopp.request.setParam("page", "1")
3hopp.request.setParam("limit", "50")
4
5// Remove a parameter
6hopp.request.removeParam("deprecated_param")
7
8// Replace all parameters at once
9hopp.request.setParams([
10  { key: "search", value: "users", active: true, description: "" },
11  { key: "sort", value: "name", active: true, description: "" },
12])
### Modifying Request Body
javascript1// Set the body to JSON
2hopp.request.setBody({
3  contentType: "application/json",
4  body: JSON.stringify({
5    name: "John Doe",
6    email: "john@example.com",
7    timestamp: Date.now(),
8  }),
9})
10
11// Partial update — only change content type
12hopp.request.setBody({ contentType: "application/xml" })
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L283-L304)

### Setting Authentication
javascript1// Set Bearer token auth
2hopp.request.setAuth({
3  authType: "bearer",
4  authActive: true,
5  token: pw.env.get("token"),
6})
7
8// Set Basic auth
9hopp.request.setAuth({
10  authType: "basic",
11  authActive: true,
12  username: "admin",
13  password: pw.env.get("admin_password"),
14})
>
Source: [pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts#L307-L331)

### Using Request Variables
javascript1// Request variables are scoped to the current request and not persisted
2hopp.request.variables.set("requestId", crypto.randomUUID())
3hopp.request.variables.set("startTime", Date.now().toString())
4
5// Later in the same request flow:
6const requestId = hopp.request.variables.get("requestId")
### Making Auxiliary HTTP Requests
javascript1// Using hopp.fetch() (respects interceptor settings)
2const response = await hopp.fetch("https://api.example.com/auth", {
3  method: "POST",
4  headers: { "Content-Type": "application/json" },
5  body: JSON.stringify({ username: "admin", password: "secret" }),
6})
7
8const data = await response.json()
9pw.env.set("auth_token", data.token)
### Postman-Compatible Approach (for migrating collections)
javascript1// Using pm namespace (Postman compatible)
2pm.environment.set("base_url", "https://api.example.com")
3
4// Check if a variable exists
5if (pm.variables.has("auth_token")) {
6  pm.request.headers.add({
7    key: "Authorization",
8    value: "Bearer " + pm.environment.get("auth_token"),
9  })
10}
11
12// Get request metadata
13console.log("Request ID:", pm.info.requestId)
14console.log("Request Name:", pm.info.requestName)
15
16// Manipulate URL with Postman-compatible object
17pm.request.url.protocol = "https"
18pm.request.url.host = ["api", "example", "com"]
19pm.request.url.path = ["v2", "users"]
20pm.request.url.query.add({ key: "limit", value: "100" })
21
22// Send an auxiliary request
23pm.sendRequest({
24  url: "https://auth.example.com/token",
25  method: "POST",
26  header: [{ key: "Content-Type", value: "application/json" }],
27  body: {
28    mode: "raw",
29    raw: JSON.stringify({ client_id: "abc", client_secret: "xyz" }),
30  },
31}, (err, response) => {
32  if (!err) {
33    const data = response.json()
34    pm.environment.set("token", data.access_token)
35  }
36})
### Advanced: Authentication Token Refresh Pattern
javascript1// Check if the current token has expired
2const expiresAt = parseInt(pw.env.get("token_expires_at") || "0", 10)
3
4if (Date.now() >= expiresAt) {
5  // Token expired — fetch a new one
6  const response = await fetch("https://auth.example.com/refresh", {
7    method: "POST",
8    headers: { "Content-Type": "application/json" },
9    body: JSON.stringify({
10      refresh_token: pw.env.get("refresh_token"),
11    }),
12  })
13
14  if (response.ok) {
15    const data = await response.json()
16
17    // Store new token and expiry
18    pw.env.set("access_token", data.access_token)
19    pw.env.set("token_expires_at", String(Date.now() + data.expires_in * 1000))
20
21    // Set the new token on the outgoing request
22    hopp.request.setHeader("Authorization", "Bearer " + data.access_token)
23  }
24} else {
25  // Token still valid — set it on the request
26  hopp.request.setHeader("Authorization", "Bearer " + pw.env.get("access_token"))
27}
## CLI Integration
The CLI pre-request runner (`packages/hoppscotch-cli/src/utils/pre-request.ts`) follows the same architecture but uses platform-specific sandboxing:

- **Experimental mode**: QuickJS WASM via `runPreRequestScript` from `@hoppscotch/js-sandbox/node`
- **Legacy mode**: `isolated-vm` V8 isolate for stronger isolation than the browser Web Worker path

The CLI also supports the `--legacy-sandbox` flag to opt out of the QuickJS sandbox.

>
Source: [CLI pre-request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts#L52-L134)

## Configuration Options
OptionTypeDefaultPlatformDescription`EXPERIMENTAL_SCRIPTING_SANDBOX``boolean``true`Web, DesktopToggle QuickJS WASM sandbox vs legacy Web Worker mode`--legacy-sandbox``boolean``false`CLIUse `isolated-vm` instead of QuickJS WASM
>
Source: [SECURITY.md](https://github.com/xiexb/hoppscotch/blob/main/SECURITY.md#L86)

## API Reference
### `runPreRequestScript`
typescript1runPreRequestScript(
2  preRequestScript: string,
3  options: RunPreRequestScriptOptions
4): Promise<E.Either<string, SandboxPreRequestResult>>
**Parameters:**

ParameterTypeDescription`preRequestScript``string`The combined pre-request script (user script wrapped in IIFE)`options.envs``{ global: EnvVar[], selected: EnvVar[] }`Current environment variables`options.experimentalScriptingSandbox``boolean`Whether to use QuickJS (true) or legacy sandbox (false)`options.request``HoppRESTRequest`(Experimental only) The request object to mutate`options.cookies``Cookie[] | null`(Experimental only) Current cookies`options.hoppFetchHook``HoppFetchHook`(Experimental only) Custom fetch hook for network requests
**Returns:**

- `E.Right<SandboxPreRequestResult>` on success with:

`updatedEnvs` — Modified environment variables
- `updatedRequest` — The mutated request object
- `updatedCookies` — Modified cookies (if applicable)
- `consoleEntries` — Any console output from the script

- `E.Left<string>` on failure with an error message

>
Source: [types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts#L191-L202)

### `getRequestSetterMethods`
typescript1getRequestSetterMethods(
2  request: HoppRESTRequest
3): {
4  methods: {
5    setUrl(url: string): void
6    setMethod(method: string): void
7    setHeader(name: string, value: string): void
8    setHeaders(headers: HoppRESTHeaders): void
9    removeHeader(key: string): void
10    setParam(name: string, value: string): void
11    setParams(params: HoppRESTParams): void
12    removeParam(key: string): void
13    setBody(newBody: Partial<HoppRESTReqBody>): void
14    setAuth(newAuth: HoppRESTAuth): void
15    setRequestVariable(key: string, value: string): void
16  }
17  updatedRequest: HoppRESTRequest
18}
**Parameters:**

- `request` (`HoppRESTRequest`): The original request to create mutation methods for

**Returns:** An object with `methods` (setter functions) and `updatedRequest` (the cloned, mutated copy)

>
Source: [pre-request.ts (utils)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/pre-request.ts#L10-L159)

### `preRequestScriptRunner` (CLI)
typescript1preRequestScriptRunner(
2  request: HoppRESTRequest,
3  envs: HoppEnvs,
4  legacySandbox: boolean,
5  collectionVariables?: HoppCollectionVariable[],
6  inheritedPreRequestScripts?: string[]
7): TE.TaskEither<
8  HoppCLIError,
9  { effectiveRequest: EffectiveHoppRESTRequest } & { updatedEnvs: HoppEnvs }
10>
**Parameters:**

ParameterTypeDescription`request``HoppRESTRequest`The original request`envs``HoppEnvs`Current environments (global + selected)`legacySandbox``boolean`Whether to use legacy isolated-vm sandbox`collectionVariables``HoppCollectionVariable[]`Variables from collection context`inheritedPreRequestScripts``string[]`Scripts inherited from parent collections
**Returns:** A TaskEither that resolves to either a `HoppCLIError` or an object containing the effective (fully resolved) request and updated environments.

>
Source: [CLI pre-request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts#L52-L134)

### `getPreRequestMetrics` (CLI)
typescript1getPreRequestMetrics(
2  errors: HoppCLIError[],
3  duration: number
4): PreRequestMetrics
Returns metrics about pre-request script execution, including pass/fail counts and duration.

>
Source: [CLI pre-request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts#L675-L685)

## Related Links

- [Post-Request Scripts](./8-scripting-and-automation.2-post-request-scripts) — Execute scripts after receiving the response
- [Environment Variables](../6-environment-management.1-environment-variables) — Manage environment and global variables
- [Scripting Sandbox Security Model](https://github.com/xiexb/hoppscotch/blob/main/SECURITY.md) — Detailed security documentation

**Key Source Files:**

FileDescription[pre-request.js Bootstrap](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/bootstrap-code/pre-request.js)Sandbox bootstrap code defining pw/hopp/pm namespaces[getRequestSetterMethods](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/pre-request.ts)Request mutation method factory[pre-request.d.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/pre-request.d.ts)TypeScript type definitions[PreRequestScript.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/PreRequestScript.vue)UI component[RequestRunner.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/RequestRunner.ts)Request execution orchestration[CLI pre-request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/pre-request.ts)CLI pre-request runner[Web pre-request/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/pre-request/index.ts)Web sandbox pre-request execution[Node pre-request/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/pre-request/index.ts)Node sandbox pre-request execution[preRequestScriptSnippets.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/preRequestScriptSnippets.ts)Built-in code snippets[Editor Completions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/completion/preRequest.ts)Autocomplete for pre-request API[Editor Linting](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/linting/preRequest.ts)Syntax and semantic linting