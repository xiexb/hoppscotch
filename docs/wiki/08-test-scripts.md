# Test Scripts
Test Scripts (post-request scripts) in Hoppscotch are JavaScript programs that execute after an API request completes, allowing you to validate responses, assert conditions, and programmatically interact with environment variables and cookies.

## Overview
Test scripts are a core feature of Hoppscotch's scripting and automation capabilities. They run after a request receives its response, giving you the ability to:

- **Assert response properties**: Validate status codes, headers, body content, and response times
- **Chain assertions**: Use a rich assertion library inspired by Chai.js for expressive test declarations
- **Manipulate environments**: Read, write, and delete environment variables programmatically
- **Compute derived data**: Extract values from responses and store them for subsequent requests
- **Support nested test suites**: Organize assertions into hierarchical test blocks with descriptive names
- **Maintain Postman compatibility**: Support both `pm.*` and `pw.*` namespaces for migration from Postman

The test scripts system is designed around three key design principles:

- **Isolation**: Scripts execute in a sandboxed environment (Faraday Cage on modern systems or Web Workers/isolated-vm as fallback) to prevent malicious or erroneous scripts from affecting the host application.
- **Expressiveness**: The assertion API provides both simple (`pw.expect(value).toBe(expected)`) and chained (`pw.expect(value).not.toBe(expected)`) assertion styles that read like natural language.
- **Inheritance**: Test scripts defined at the collection or folder level are inherited by child requests, following a cascading hierarchy that mirrors the collection structure.

## Architecture
The test scripts system is composed of multiple layers that work together to execute scripts in a secure sandbox, collect results, and present them to the user.

加载图表中...
### Component Overview
**UI Layer** — The user-facing components that provide the script editor, snippet library, and test result visualization. The `Tests.vue` component integrates the Monaco code editor with syntax highlighting, autocompletion, and linting specifically for Hoppscotch test scripts.

**Host Services Layer** — The orchestrating services that drive test execution. `TestRunnerService` manages collection-level test runs with recursive folder traversal, while `RequestRunner` handles per-request execution combining pre-request and post-request scripts with environment variable management.

**Sandbox Layer** — The secure execution environment provided by `@hoppscotch/js-sandbox`. This package contains the test runner entry points for both the web app and CLI, along with the execution engines (Faraday Cage, Web Workers, isolated-vm).

**Scripting Utilities** — Supporting utilities for script processing, including script combination (merging inherited scripts), snippet templates for common patterns, and editor integration for autocomplete and linting.

**CLI Layer** — The command-line test runner (`hopp test`) that enables running test scripts in CI/CD pipelines, with comprehensive metrics and reporting capabilities.

### Three Namespace API
Hoppscotch supports three distinct namespaces for writing test scripts, ensuring compatibility with existing workflows:

加载图表中...
## Test Script Execution
### Execution Flow
When a request with test scripts is executed, the following sequence occurs:

加载图表中...
### Script Combination and Inheritance
Hoppscotch supports hierarchical script inheritance where test scripts defined at the collection and folder levels are automatically inherited by requests within them. The `combineScriptsWithIIFE` function in the scripting utilities handles this merging.

>
Source: [packages/hoppscotch-js-sandbox/src/utils/scripting.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/scripting.ts#L176-L258)

The inheritance follows this order:

- **Collection-level scripts** (ancestor)
- **Folder-level scripts** (ancestor)
- **Request-level scripts** (runs first — closest to the request)

typescript1// Script combination logic
2const combinedScript = combineScriptsWithIIFE(
3  filterValidScripts([
4    request.testScript,
5    ...inheritedTestScripts.slice().reverse(),
6  ]),
7  experimentalScriptingSandbox ? "experimental" : "legacy"
8);
>
Sources:

- [packages/hoppscotch-cli/src/utils/test.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/test.ts#L64-L71)
- [packages/hoppscotch-common/src/services/test-runner/test-runner.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/test-runner/test-runner.service.ts#L148-L153)

For the **experimental** sandbox, the combination wraps each script in an `async function` and chains them with `await`. For the **legacy** sandbox, scripts are wrapped in synchronous function expressions.

## Usage Examples
### Basic Response Assertions
The following example demonstrates common test patterns using the `pw` (Hoppscotch native) namespace:

javascript1// Verify status code
2pw.test("Status code is 200", () => {
3    pw.expect(pw.response.status).toBe(200);
4});
5
6// Verify status code category
7pw.test("Status code is 2xx", () => {
8    pw.expect(pw.response.status).toBeLevel2xx();
9});
10
11// Verify JSON response body property
12pw.test("Response has correct method", () => {
13    pw.expect(pw.response.body.method).toBe("GET");
14});
15
16// Verify response time
17pw.test("Response is fast", () => {
18    pw.expect(pw.response.responseTime).toBeLessThan(500);
19});
>
Source: [packages/hoppscotch-common/src/helpers/testSnippets.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/testSnippets.ts#L1-L49)

### Environment Variable Manipulation
Test scripts can read and modify environment variables, enabling data to be passed between requests:

javascript1// Set an environment variable from a response value
2pw.test("Extract auth token", () => {
3    const token = pw.response.body.token;
4    pw.env.set("auth_token", token);
5    pw.expect(token).toBeDefined();
6});
7
8// Use the hopp namespace for env operations
9hopp.test("Store session ID", () => {
10    const sessionId = hopp.response.body.session.id;
11    hopp.env.set("session_id", sessionId);
12});
### Postman-Compatible Test Scripts
For users migrating from Postman, the `pm` namespace provides a familiar API:

javascript1pm.test("Status code is 200", function () {
2    pm.response.to.have.status(200);
3});
4
5pm.test("Response has required fields", function () {
6    const jsonData = pm.response.json();
7    pm.expect(jsonData.name).to.exist;
8    pm.expect(jsonData.email).to.be.a("string");
9});
10
11pm.test("JSON schema validation", function () {
12    const schema = {
13        type: "object",
14        required: ["name", "age"],
15        properties: {
16            name: { type: "string" },
17            age: { type: "number" },
18        },
19    };
20    pm.response.to.have.jsonSchema(schema);
21});
### Nested Test Suites
Tests can be nested to organize related assertions into descriptive groups:

javascript1pw.test("User API response validation", () => {
2    // Outer test creates a test suite
3
4    pw.test("Response structure", () => {
5        pw.expect(pw.response.body).toHaveProperty("id");
6        pw.expect(pw.response.body).toHaveProperty("name");
7        pw.expect(pw.response.body).toHaveProperty("email");
8    });
9
10    pw.test("Data types", () => {
11        pw.expect(typeof pw.response.body.id).toBe("number");
12        pw.expect(typeof pw.response.body.name).toBe("string");
13    });
14
15    pw.test("Business rules", () => {
16        pw.expect(pw.response.body.age).toBeGreaterThan(18);
17        pw.expect(pw.response.body.email).toInclude("@");
18    });
19});
### Async Test Functions
Test scripts support asynchronous operations using async/await:

javascript1pw.test("Async data verification", async () => {
2    // Perform additional async operations within a test
3    const result = await someAsyncFunction();
4    pw.expect(result).toBe(true);
5});
### Using the `not` Modifier
Assertions can be negated using the `.not` modifier:

javascript1pw.test("Negation assertions", () => {
2    pw.expect(pw.response.status).not.toBe(404);
3    pw.expect(pw.response.body.error).toBeUndefined();
4});
## Test Snippets
The editor includes a set of built-in test snippets for rapid development:

Snippet NameScript TemplateEnvironment: Set an environment variable`pw.env.set("variable", "value");`Response: Status code is 200`pw.expect(pw.response.status).toBe(200);`Response: Assert property from body`pw.expect(pw.response.body.method).toBe("GET");`Status code: Status code is 2xx`pw.expect(pw.response.status).toBeLevel2xx();`Status code: Status code is 3xx`pw.expect(pw.response.status).toBeLevel3xx();`Status code: Status code is 4xx`pw.expect(pw.response.status).toBeLevel4xx();`Status code: Status code is 5xx`pw.expect(pw.response.status).toBeLevel5xx();`
>
Source: [packages/hoppscotch-common/src/helpers/testSnippets.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/testSnippets.ts)

## Script Execution Modes
Hoppscotch supports two execution modes for test scripts, controlled by the `experimentalScriptingSandbox` flag:

ModeEngineTop-level `import`Top-level `await`Use Case**Experimental** (default)Faraday Cage (QuickJS)✅ Supported✅ SupportedModern environments with full ESM support**Legacy**Web Worker (browser) / isolated-vm (CLI)❌ Rejected❌ RejectedOlder environments or when ESM features are not needed
The choice of sandbox engine is determined by the runtime environment:

- **Browser (Web)**: Uses Faraday Cage by default, falls back to Web Workers for legacy mode
- **CLI (Node.js)**: Uses Faraday Cage by default, falls back to isolated-vm for legacy mode

>
Sources:

- [packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts#L227-L254)
- [packages/hoppscotch-js-sandbox/src/node/test-runner/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/test-runner/index.ts#L29-L69)

## API Reference
### `pw.test(name: string, fn: () => void | Promise<void>): void`
Defines a test block with a descriptive name and a function containing assertions.

**Parameters:**

- `name` (string): A descriptive name for the test block, displayed in test results
- `fn` (function): The test function containing assertions. Can be async.

### `pw.expect(value: any): Expectation`
Creates an assertion on the given value. Returns an `Expectation` object with chainable assertion methods.

**Returns:** An `Expectation` object supporting the following methods:

MethodDescription`.toBe(expected)`Assert value equals expected (strict equality)`.toBeLevel2xx()`Assert HTTP status is in 2xx range`.toBeLevel3xx()`Assert HTTP status is in 3xx range`.toBeLevel4xx()`Assert HTTP status is in 4xx range`.toBeLevel5xx()`Assert HTTP status is in 5xx range`.toBeType(type)`Assert value is of the specified JavaScript type`.toHaveLength(length)`Assert value has the specified length`.toInclude(needle)`Assert string contains the specified substring`.not`Negate the following assertion
>
Source: [packages/hoppscotch-js-sandbox/src/types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts#L179-L189)

### `pw.response`
An object providing access to the HTTP response:

PropertyTypeDescription`pw.response.status`numberHTTP status code (e.g., 200, 404)`pw.response.statusText`stringStatus text (e.g., "OK", "Not Found")`pw.response.body`string | objectResponse body — parsed as JSON if Content-Type is JSON, otherwise raw string`pw.response.headers`{ key, value }[]Array of response header objects`pw.response.responseTime`numberResponse duration in milliseconds
>
Source: [packages/hoppscotch-js-sandbox/src/types/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts#L47-L67)

### `pw.env`
Environment variable management:

MethodDescription`pw.env.set(key, value)`Set an environment variable`pw.env.get(key)`Get the current value of an environment variable`pw.env.getResolve(key)`Get the resolved value of an environment variable`pw.env.unset(key)`Delete an environment variable`pw.env.resolve(key)`Resolve a variable reference (e.g., `{{base_url}}`)
### `runTestScript(testScript, options): Promise<Either<string, SandboxTestResult>>`
**Web entry point** — The main function for executing test scripts in the browser environment.

**Parameters:**

- `testScript` (string): The JavaScript test script to execute
- `options` (RunPostRequestScriptOptions): Configuration including envs, request, response, cookies, and sandbox mode

**Returns:** Either an error string (left) or a `SandboxTestResult` (right) containing tests, envs, console entries, and updated cookies.

>
Source: [packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts#L209-L255)

### CLI: `testRunner(testScriptData): TaskEither<HoppCLIError, TestRunnerRes>`
**CLI entry point** — Executes test scripts in the Node.js environment (used by the Hoppscotch CLI).

**Parameters:**

- `testScriptData` (TestScriptParams): Request, response, envs, legacySandbox flag, and inherited test scripts

**Returns:** A `TaskEither` resolving to `TestRunnerRes` containing updated envs, test reports (descriptor, expected results, pass/fail counts), and execution duration.

>
Source: [packages/hoppscotch-cli/src/utils/test.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/test.ts#L30-L114)

## Test Result Data Model
The test results follow a hierarchical tree structure:

加载图表中...
### CLI Test Metrics
For the CLI test runner, metrics are aggregated into structured reports:

typescript1type TestMetrics = {
2  tests: { failed: number; passed: number }      // Individual test case counts
3  testSuites: { failed: number; passed: number }  // Test block (suite) counts
4  scripts: { failed: number; passed: number }     // Script execution success/failure
5  duration: number                                 // Total execution time in seconds
6}
>
Source: [packages/hoppscotch-cli/src/types/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/types/response.ts#L45-L65)

## Configuration Options
### Test Runner Configuration
OptionTypeDefaultDescription`stopRef``Ref<boolean>`—Reactive reference to signal test execution stop`keepVariableValues``boolean``true`Persist environment variable changes after test execution`delay``number``0`Delay (ms) between requests in collection runs`stopOnError``boolean``false`Stop test execution on first error`persistResponses``boolean``false`Keep response data in the result collection after execution
>
Source: [packages/hoppscotch-common/src/services/test-runner/test-runner.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/test-runner/test-runner.service.ts#L25-L27)

### CLI Test Command Options
OptionTypeDefaultDescription`delay``number``0`Delay (ms) between requests`env``string[]``[]`Environment files or inline variables`iterationCount``number`—Number of iteration runs`iterationData``string`—CSV file path for iteration data`reporterJunit``string`—Output path for JUnit XML report`legacySandbox``boolean``false`Use legacy sandbox (isolated-vm) instead of Faraday Cage
>
Source: [packages/hoppscotch-cli/src/commands/test.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/commands/test.ts#L21-L114)

## Related Links

-
**Source Files:**

[Test Runner Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/test-runner/test-runner.service.ts) — Collection-level test execution orchestration
- [Request Runner](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/RequestRunner.ts) — Per-request test execution with pre/post script handling
- [Web Test Runner](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/web/test-runner/index.ts) — Browser sandbox entry point
- [Node Test Runner](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/node/test-runner/index.ts) — CLI sandbox entry point
- [Script Combination Utilities](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/scripting.ts) — Script inheritance and combination logic
- [CLI Test Command](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/commands/test.ts) — CLI implementation for `hopp test`
- [CLI Test Utilities](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/test.ts) — CLI test runner, descriptor parser, and metrics
- [Test Snippets](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/testSnippets.ts) — Built-in test code snippets
- [Test Script Completion](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/completion/testScript.ts) — Editor autocomplete for test scripts
- [Types Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/types/index.ts) — All sandbox types and interfaces
- [Test Scripts UI Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Tests.vue) — Vue component for the test script editor

-
**Related Documentation:**

[Pre-Request Scripts](../8-scripting-and-automation.1-pre-request-scripts) — Scripts that execute before requests
- [Collections](../7-collections) — Organize requests with inherited scripts