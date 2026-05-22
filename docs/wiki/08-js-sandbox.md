# JS Sandbox System
A comprehensive JavaScript sandbox execution framework for running user-provided scripts (pre-request and test scripts) in isolated environments across web and Node.js platforms, built on top of [FaradayCage](https://www.npmjs.com/package/faraday-cage) (QuickJS-based) with legacy support via Web Workers and `isolated-vm`.

## Overview
The JS Sandbox System is a foundational component of Hoppscotch that provides **secure, isolated execution of untrusted user scripts**. It addresses two primary use cases:

- **Pre-request Scripts** — Scripts that run *before* an API request is sent, allowing users to modify request parameters, headers, body, and environment variables dynamically.
- **Test (Post-request) Scripts** — Scripts that run *after* a response is received, enabling validation of response data through assertions (powered by Chai.js) and custom test logic.

The system provides **three scripting namespaces** that mimic popular API testing tools for familiarity:

- **`pw` namespace** — Postman/Playwright-style environment variable and request property access
- **`hopp` namespace** — Hoppscotch-native API for environment management with `set`, `delete`, `reset` operations
- **`pm` namespace** — Postman-compatible API (`pm.response`, `pm.expect`, `pm.environment`) for migration compatibility

### Key Design Decisions
The system went through an architectural evolution from a legacy `isolated-vm`/Web Worker approach to the current **FaradayCage-based experimental sandbox**. Key motivations:

- **Security isolation** — QuickJS provides a fully isolated JavaScript VM that prevents host access
- **Cross-platform uniformity** — FaradayCage abstracts QuickJS, providing the same API for both web (WASM) and Node.js (native addon) runtimes
- **ESM module support** — The experimental sandbox supports top-level `import`/`export` and `await`, unlike the legacy script-mode only execution
- **Rich assertion library** — Full Chai.js assertion integration (BDD, TDD, plugins) exposed across the sandbox boundary

## Architecture
加载图表中...
### Component Responsibilities
ComponentRole**FaradayCage**QuickJS-based isolation runtime. Provides `FaradayCage.create()`, `cage.runCode()`, and module system for cross-boundary function calls**Cage Singleton**Manages a cached FaradayCage singleton. On bootstrap failure, resets and retries once. Test environments create fresh instances**Default Modules**URL polyfill, Blob polyfill, Console capture, Crypto (Web Crypto API), ESM module loader, Custom fetch, Text encoding, Timers**Scripting Modules**Registers sandbox functions for env/cookie/request manipulation, test management, and assertion via bootstrap code**Bootstrap Code**JavaScript code evaluated inside QuickJS that sets up the `pw`, `hopp`, `pm` namespaces and test execution chain
## Core Flow
### Pre-request Script Execution Flow
加载图表中...
### Test Script Execution Flow
加载图表中...
## Main Content
### Dual Runtime Architecture
The sandbox system supports **two execution backends** that share the same public API but use different isolation mechanisms:

#### Experimental Sandbox (FaradayCage + QuickJS)
This is the **primary and recommended** execution engine. It uses [FaradayCage](https://www.npmjs.com/package/faraday-cage), a higher-level abstraction over [QuickJS](https://bellard.org/quickjs/) — a small, embeddable JavaScript engine that runs as a sandboxed environment.

**Why FaradayCage?** Earlier versions used `quickjs-emscripten` directly, but the team moved to FaradayCage for its module system (`defineCageModule`, `defineSandboxFn`, `defineSandboxObject`) which provides a clean abstraction for cross-boundary function calls and handle management.

Key characteristics:

- **Cross-platform**: Uses WASM build on web, native addon on Node.js (via optional `isolated-vm` peer dep)
- **ESM support**: Supports top-level `import`/`export` and `await` via FaradayCage's `esmModuleLoader`
- **Singleton caching**: A single `FaradayCage` instance is created and reused for performance; on bootstrap failure, it's reset and retried once
- **Console capture**: Console entries are captured and returned as structured data

>
Source: [cage.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/cage.ts#L34-L54)

#### Legacy Sandbox (Web Worker / isolated-vm)
The fallback engine for environments where QuickJS/WASM is unavailable or when `experimentalScriptingSandbox` is set to `false`.

**Web (Web Worker):** The script is sent to a dedicated Web Worker which executes it using `new Function("pw", script)` — this provides basic script isolation without full VM sandboxing.

**Node (isolated-vm):** Uses the `isolated-vm` npm package (optional peer dependency) for V8-level isolation with its own `ivm.Reference` wrapping for host function exposure.

>
Source: [web/pre-request/worker.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/pre-request/worker.ts#L6-L30)

>
Source: [node](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/utils.ts#L1-L23)

### Script Combining & Inheritance
The system supports **inherited scripts** from parent collections/requests. Multiple scripts are combined into a single execution chain:

typescript1// Experimental: async IIFE chain with ESM support
2await (async function() { /* script 1 */ })();
3await (async function() { /* script 2 */ })();
4
5// Legacy: sync IIFE chain
6;(function() { /* script 1 */ }).call(this);
7;(function() { /* script 2 */ }).call(this);
**Key details:**

- Top-level `import` declarations are extracted and hoisted to module scope
- Identical imports across scripts are deduped
- Conflicting imports (same name, different sources) are rejected with a clear error
- Monaco editor prepends `export {};\n` to scripts — this prefix is stripped before execution

>
Source: [scripting.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/scripting.ts#L176-L258)

### Error Handling & Recovery
The system implements a sophisticated **retry-once** pattern for infrastructure failures:

加载图表中...
>
Source: [web/pre-request/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/pre-request/index.ts#L83-L108)

Error discrimination uses `instanceof Error`:

- **Infrastructure errors** (WASM init failure, marshal errors) are `Error` instances → trigger cage reset + retry
- **User script errors** (from QuickJS `dump()`) are plain objects → reported as script failures

### Namespace Architecture
The three scripting namespaces share a common foundation but expose different API surfaces:

加载图表中...
### Environment Variable Management
Environment variables are stored internally as `SandboxValue` (any type) during script execution to support Postman compatibility (arrays, objects). They are serialized to strings only when crossing the sandbox boundary via `getUpdatedEnvs()`.

The system uses **special marker constants** to preserve `null` and `undefined` across the serialization boundary:

typescriptexport const UNDEFINED_MARKER = "__HOPPSCOTCH_UNDEFINED__"
export const NULL_MARKER = "__HOPPSCOTCH_NULL__"
>
Source: [sandbox-markers.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/constants/sandbox-markers.ts#L10-L12)

### Assertion System (Chai.js Integration)
The experimental sandbox integrates **full Chai.js** assertion library running on the **host side** (outside the sandbox). Assertion functions cross the QuickJS boundary via `defineSandboxFn`:

- User script calls `pm.expect(value).to.equal(expected)`
- Bootstrap code delegates to a host-side `chaiExpect` function
- The host-side `chai.expect()` is called and the result (pass/fail) is recorded
- This avoids shipping Chai.js into the sandbox (reducing memory footprint)

**Pre-checking pattern**: For object types that lose their prototype during serialization (Set, Map, Date, RegExp), metadata is gathered inside the sandbox *before* serialization and passed alongside the serialized value to the host-side assertion handler.

## Usage Examples
### Basic Pre-request Script
typescript1import { runPreRequestScript } from "@hoppscotch/js-sandbox/node"
2
3const result = await runPreRequestScript(
4  `
5    // pw namespace - set environment variable
6    pw.env.set("baseUrl", "https://api.example.com")
7
8    // hopp namespace - get request property and set env
9    const endpoint = hopp.request.url
10    hopp.env.set("endpoint", endpoint)
11  `,
12  {
13    envs: {
14      global: [],
15      selected: [
16        { key: "baseUrl", currentValue: "", initialValue: "", secret: false },
17      ],
18    },
19    request: { /* HoppRESTRequest object */ },
20    cookies: null,
21    experimentalScriptingSandbox: true,
22  }
23)
>
Source: [node/pre-request/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/pre-request/index.ts#L7-L39)

### Basic Test Script
typescript1import { runTestScript } from "@hoppscotch/js-sandbox/node"
2import * as TE from "fp-ts/TaskEither"
3
4const result = await runTestScript(
5  `
6    pw.test("Status code is 200", () => {
7      pw.expect(pw.response.status).toBe(200)
8    })
9
10    pw.test("Response has data", () => {
11      const json = JSON.parse(pw.response.body)
12      pw.expect(json.id).toBeType("number")
13      pw.expect(json.name).toBeType("string")
14    })
15  `,
16  {
17    envs: {
18      global: [],
19      selected: [],
20    },
21    response: {
22      status: 200,
23      statusText: "OK",
24      responseTime: 234,
25      headers: [{ key: "content-type", value: "application/json" }],
26      body: JSON.stringify({ id: 1, name: "Alice" }),
27    },
28    request: { /* HoppRESTRequest object */ },
29    cookies: null,
30    experimentalScriptingSandbox: true,
31  }
32)()
>
Source: [node/test-runner/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/test-runner/index.ts#L12-L70)

### Postman Namespace Usage
typescript1// pm namespace for Postman users migrating to Hoppscotch
2pm.environment.set("token", responseBody.token)
3pm.collectionVariables.set("userId", jsonResponse.user.id)
4pm.response.to.have.status(200)
5pm.expect(jsonResponse.items).to.be.an("array").that.has.lengthOf(5)
### Combining Inherited Scripts
typescript1import { combineScriptsWithIIFE, filterValidScripts } from "@hoppscotch/js-sandbox/scripting"
2
3const parentScripts = [
4  `pw.env.set("authToken", "Bearer <token>")`,
5  `const baseUrl = pw.env.get("API_URL")`,
6]
7
8const requestScript = `pw.expect(pw.response.status).toBe(200)`
9
10// Combine into a single executable script
11const combined = combineScriptsWithIIFE(
12  filterValidScripts([...parentScripts, requestScript]),
13  "experimental" // or "legacy"
14)
>
Source: [scripting.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/scripting.ts#L176-L258)

### CLI Usage with Legacy Sandbox Flag
bash`hopp test --collection ./collection.json --legacy-sandbox`
typescript// In CLI command setup
.option("--legacy-sandbox", "Opt out from the experimental scripting sandbox")
>
Source: [CLI index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/index.ts#L81)

## Configuration Options
### Package Entry Points
Entry PointImport PathDescription`web``@hoppscotch/js-sandbox/web`Browser/Web Worker runtime (returns `Promise<E.Either<...>>`)`node``@hoppscotch/js-sandbox/node`Node.js runtime (returns `TE.TaskEither<...>`)`scripting``@hoppscotch/js-sandbox/scripting`String utility helpers (no sandbox dependency)default`@hoppscotch/js-sandbox`Type definitions only
>
Source: [package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/package.json#L10-L29)

### Run Options
typescript1type RunPreRequestScriptOptions = {
2  envs: { global: EnvironmentVariable[], selected: EnvironmentVariable[] }
3  experimentalScriptingSandbox?: boolean // default: true
4  request?: HoppRESTRequest          // required when experimental is true
5  cookies?: Cookie[] | null          // optional, Desktop App only
6  hoppFetchHook?: HoppFetchHook      // optional custom fetch implementation
7}
8
9type RunPostRequestScriptOptions = {
10  envs: { global: EnvironmentVariable[], selected: EnvironmentVariable[] }
11  response: TestResponse
12  experimentalScriptingSandbox?: boolean // default: true
13  request?: HoppRESTRequest          // required when experimental is true
14  cookies?: Cookie[] | null          // optional, Desktop App only
15  hoppFetchHook?: HoppFetchHook      // optional custom fetch implementation
16}
>
Source: [types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts#L191-L217)

### Environment Variable Serialization
Value TypeInternal StorageAfter Serialization (getUpdatedEnvs)`undefined``UNDEFINED_MARKER``"undefined"` string`null``NULL_MARKER``"null"` string`string`Stored as-isStored as-is`number`, `boolean`Stored as-isConverted to `String()``object`, `array`Stored as-is`JSON.stringify()` output
## API Reference
### `runPreRequestScript(script: string, options: RunPreRequestScriptOptions): Promise<Either<string, SandboxPreRequestResult>>`
Executes a pre-request script in an isolated sandbox. Returns either an error message or the updated environment, request, and cookies.

**Web version:** Returns `Promise<E.Either<string, SandboxPreRequestResult>>`
**Node version:** Returns `TE.TaskEither<string, SandboxPreRequestResult>`
**Parameters:**

- `script` (string): The JavaScript code to execute
- `options` (RunPreRequestScriptOptions): Configuration including `envs`, `request`, `cookies`, `experimentalScriptingSandbox`, and optional `hoppFetchHook`

**Returns:**

- `SandboxPreRequestResult`: `{ updatedEnvs, updatedRequest?, updatedCookies?, consoleEntries? }`

**Throws/Either.left:**

- `"Script execution failed: ..."` — Various error contexts including syntax errors, runtime errors, infrastructure failures, or persistent initialization errors

>
Source: [web/pre-request/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/pre-request/index.ts#L181-L203)

### `runTestScript(script: string, options: RunPostRequestScriptOptions): Either<string, TestResult>`
Executes a post-request test script in an isolated sandbox. Returns either an error message or test results with updated environment.

**Web version:** Returns `Promise<E.Either<string, SandboxTestResult>>`
**Node version:** Returns `TE.TaskEither<string, TestResult>`
**Parameters:**

- `script` (string): The test script JavaScript code
- `options` (RunPostRequestScriptOptions): Configuration including `envs`, `response`, `request`, `cookies`, `experimentalScriptingSandbox`

**Returns:**

- `TestResult`: `{ tests: TestDescriptor[], envs: { global, selected } }`
- `SandboxTestResult`: `{ tests: TestDescriptor, envs, consoleEntries?, updatedCookies? }`

**Pre-execution validation:**

- The response object is checked for cyclic references via `preventCyclicObjects()`
- The script is pre-parsed with Acorn before sandbox execution to surface syntax errors early

>
Source: [web/test-runner/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts#L209-L255)

### `combineScriptsWithIIFE(scripts: string[], target: CombineScriptsTarget): string`
Combines multiple scripts into a sequential IIFE chain for execution.

**Parameters:**

- `scripts` (string[]): Array of script source strings
- `target` (`"experimental"` | `"legacy"`): Execution target grammar

**Returns:**

- Combined script string with IIFE wrappers and import hoisting

### `filterValidScripts(scripts: (string | null | undefined)[]): string[]`
Filters out empty or whitespace-only scripts from an array.

### `hasActualScript(script: string | null | undefined): boolean`
Checks if a script contains actual code (after stripping Monaco's `export {};\n` prefix).

### Type Definitions
typescript1type TestResponse = {
2  status: number
3  statusText: string
4  responseTime: number
5  headers: { key: string; value: string }[]
6  body: string | object
7}
8
9type TestDescriptor = {
10  descriptor: string
11  expectResults: { status: "pass" | "fail" | "error"; message: string }[]
12  children: TestDescriptor[]
13}
14
15type EnvironmentVariable = {
16  key: string
17  currentValue: string
18  initialValue: string
19  secret: boolean
20}
21
22type Expectation = {
23  toBe(expectedVal: SandboxValue): void
24  toBeLevel2xx(): void
25  toBeLevel3xx(): void
26  toBeLevel4xx(): void
27  toBeLevel5xx(): void
28  toBeType(expectedType: SandboxValue): void
29  toHaveLength(expectedLength: SandboxValue): void
30  toInclude(needle: SandboxValue): void
31  readonly not: Expectation
32}
>
Source: [types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts#L50-L189)

## Related Links

- **Source Package:** [@hoppscotch/js-sandbox](https://github.com/xiexb/hoppscotch/tree/main/packages/hoppscotch-js-sandbox)
- **FaradayCage:** [faraday-cage on npm](https://www.npmjs.com/package/faraday-cage) — QuickJS abstraction layer
- **CLI Integration:** [hoppscotch-cli test command](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/test.ts) — How the CLI uses js-sandbox
- **Common Integration:** [experimental-sandbox-integration](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/experimental-sandbox-integration.ts) — Web app sandbox integration
- **Scripting Utilities:** [scripting.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/scripting.ts) — Script combining and validation
- **Cage Management:** [cage.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/cage.ts) — FaradayCage singleton lifecycle
- **Type Definitions:** [types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts) — Complete type definitions
- **Test Fixtures:** [test-scripting-sandbox-modes-coll.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/__tests__/e2e/fixtures/collections/test-scripting-sandbox-modes-coll.json) — E2E test fixture for sandbox modes