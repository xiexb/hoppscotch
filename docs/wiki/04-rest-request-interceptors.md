# Request Interceptors
A request interceptor in Hoppscotch is a pluggable execution engine that handles the actual transmission of HTTP requests from the application to the target server. Interceptors provide a unified abstraction layer over different network backends, allowing users to choose how requests are sent depending on their environment (browser, desktop app, proxy, browser extension, or a local agent).

## Overview
The interceptor system is the core networking abstraction in Hoppscotch. Instead of directly calling `fetch()` or `XMLHttpRequest`, all REST, GraphQL, and script-based HTTP requests flow through the `KernelInterceptorService`, which dispatches them to the currently active interceptor. This design provides several key benefits:

- **Environment adaptability** — Different platforms (web, desktop) automatically use the most appropriate interceptor
- **Extended capabilities** — Some interceptors support features the browser's native fetch API cannot provide (e.g., client certificates, custom proxy, cookie jar management)
- **User choice** — Users can switch between interceptors at runtime based on their needs
- **Error localization** — Each interceptor provides human-readable error messages in the user's language
- **Cancellation support** — All interceptors support request cancellation

## Architecture
The interceptor system follows a layered architecture where the `KernelInterceptorService` acts as a registry and dispatcher, and individual interceptors implement the actual request execution logic.

加载图表中...
### Core Components
**KernelInterceptorService** — The central registry and request dispatcher defined in [`packages/hoppscotch-common/src/services/kernel-interceptor.service.ts`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts). It maintains a reactive map of registered interceptors and tracks the currently active one. All request execution flows through its `execute()` method.

**KernelInterceptor** (type) — The contract that every interceptor must implement. It defines:

- `id` — A unique string identifier (e.g., `"browser"`, `"proxy"`, `"native"`)
- `name` — A localized display name
- `selectable` — Whether the interceptor is currently available for selection
- `capabilities` — Declares what HTTP features the interceptor supports
- `settingsEntry` — Optional UI component for per-interceptor configuration
- `execute(request)` — The core method that sends the request and returns a response

**KernelInterceptorsModule** — The initialization module defined in [`packages/hoppscotch-common/src/modules/kernel-interceptors.ts`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts) that loads interceptors from the platform definition, registers them with the service, sets the default interceptor, and synchronizes the active interceptor with persisted user settings.

## Core Flow
When a REST API request is sent from the Hoppscotch UI, the following sequence of events occurs:

加载图表中...
The same interceptor flow is also used when scripts executed inside pre-request or post-response scripts call `fetch()`, `hopp.fetch()`, or `pm.sendRequest()`:

加载图表中...
## Interceptor Implementations
Hoppscotch ships with five built-in interceptors, each designed for a specific execution environment.

InterceptorID StringPrimary EnvironmentExecution BackendBrowser`"browser"`Web appRelay (browser fetch/XMLHttpRequest)Proxy`"proxy"`Web & DesktopRelay → ProxyScotch serverExtension`"extension"`Web appBrowser extension (POSTWOMAN)Native`"native"`Desktop (Tauri)Relay (desktop native HTTP)Agent`"agent"`Web & DesktopLocal agent via Axios
### Browser Interceptor
The simplest interceptor that sends requests directly via Hoppscotch's `Relay` kernel, which uses the browser's native networking capabilities (fetch/XMLHttpRequest).

- **Capabilities**: Supports all standard HTTP methods, text/json/xml/form/multipart/urlencoded content types, basic/bearer/apikey auth
- **Limitations**: No proxy support, no certificate handling, no cookie management
- **Best for**: Simple API testing where no special networking features are needed

>
Source: [BrowserKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/browser/index.ts)

### Proxy Interceptor
Routes requests through a proxy server (ProxyScotch), enabling request inspection and debugging at the proxy level.

- **Capabilities**: Works in environments where CORS or network policies restrict direct browser requests
- **Content handling**: Supports text, JSON, and multipart content. Binary data is base64-encoded for transport
- **Configuration**: Requires a proxy URL and access token, configurable via the settings UI

typescript1// Proxy interceptor constructs a RelayRequest to the proxy server,
2// wrapping the original request as JSON payload
3const proxyRelayRequest: RelayRequest = {
4  id: Date.now(),
5  url: proxyUrl,
6  method: "POST",
7  version: "HTTP/1.1",
8  headers: {
9    "content-type": content.mediaType,
10  },
11  content, // Contains the original request as JSON body
12}
13
14const relayExecution = Relay.execute(proxyRelayRequest)
>
Source: [ProxyKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/index.ts#L259-L275)

### Extension Interceptor
Communicates with a browser extension (Hoppscotch Browser Extension) via the global `__POSTWOMAN_EXTENSION_HOOK__` API, bypassing CORS restrictions.

- **Capabilities**: Full HTTP feature set including client/server certificates, custom proxy, local network access
- **Extension detection**: Polls for the extension hook on initialization, with a timeout of 1 second
- **Version compatibility**: Supports extension versions 0.24+ with fallback mechanisms for older versions

typescript1// Extension interceptor detects availability and sends request via extension hook
2public execute(request: RelayRequest): ExecutionResult<KernelInterceptorError> {
3  if (this._extensionStatus.value !== "available") {
4    return {
5      cancel: async () => {},
6      response: Promise.resolve(
7        E.left({
8          humanMessage: {
9            heading: (t) => t("error.extension.heading"),
10            description: (t) => t("error.extension.description"),
11          },
12          error: {
13            kind: "extension",
14            message: "Extension not available",
15          },
16        })
17      ),
18    }
19  }
20
21  return {
22    cancel: async () => {
23      window.__POSTWOMAN_EXTENSION_HOOK__?.cancelRequest()
24    },
25    response: this.executeExtensionRequest(preProcessRelayRequest(request)),
26  }
27}
>
Source: [ExtensionKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/extension/index.ts#L520-L553)

### Native Interceptor
Designed for the desktop application (Tauri), this interceptor uses the Relay kernel with platform-native HTTP support.

- **Capabilities**: Full HTTP method support, all content types, extensive auth schemes (basic, bearer, apikey, digest, AWS, Hawk), certificate management, proxy configuration, cookie jar
- **Domain-specific settings**: Configurable per-domain security, proxy, and redirect options
- **Cookie jar**: Automatically attaches relevant cookies from the `CookieJarService` to outgoing requests

typescript1// Native interceptor adds cookies and User-Agent, then processes via Relay
2private async executeRequest(
3  request: RelayRequest,
4  setRelayExecution: (execution: { cancel: () => Promise<void> }) => void
5): Promise<E.Either<any, RelayResponse>> {
6  const effectiveRequest = this.store.completeRequest(
7    preProcessRelayRequest(request)
8  )
9
10  // Attach cookies from cookie jar
11  const relevantCookies = this.cookieJar.getCookiesForURL(
12    new URL(effectiveRequest.url!)
13  )
14  if (relevantCookies.length > 0) {
15    effectiveRequest.headers!["Cookie"] = relevantCookies
16      .map((cookie) => `${cookie.name!}=${cookie.value!}`)
17      .join(";")
18  }
19
20  // Add User-Agent header
21  effectiveRequestWithUserAgent.headers["User-Agent"] = "HoppscotchKernel/0.2.0"
22
23  const nativeRequest = await relayRequestToNativeAdapter(effectiveRequestWithUserAgent)
24  const postProcessedRequest = postProcessRelayRequest(nativeRequest)
25  return await Relay.execute(postProcessedRequest).response
26}
>
Source: [NativeKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts#L179-L226)

### Agent Interceptor
Connects to a local Hoppscotch Agent process (running at `http://localhost:9119`) to execute HTTP requests. The agent provides full networking capabilities outside the browser sandbox.

- **Capabilities**: Full feature set including all HTTP methods, content types, auth schemes, certificates, proxy, redirects, and local network access
- **Security**: Requests are encrypted using a shared auth key before transmission to the agent
- **Cancellation**: Uses Axios `CancelToken` for request cancellation

typescript1// Agent interceptor encrypts the request and sends to local agent
2const [nonceB16, encryptedReq] = await this.store.encryptRequest(
3  postProcessedRequest,
4  reqID
5)
6
7const response = await axios.post(
8  "http://localhost:9119/execute",
9  encryptedReq,
10  {
11    headers: {
12      Authorization: `Bearer ${this.store.authKey.value}`,
13      "X-Hopp-Nonce": nonceB16,
14      "Content-Type": "application/octet-stream",
15    },
16    cancelToken: cancelToken.token,
17    responseType: "arraybuffer",
18  }
19)
20
21const responseNonceB16 = response.headers["x-hopp-nonce"]
22const decryptedResponse = await this.store.decryptResponse(
23  responseNonceB16,
24  response.data
25)
>
Source: [AgentKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts#L160-L183)

## Scripting Interceptor Inspector
The `ScriptingInterceptorInspectorService` ([source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/scripting-interceptor.inspector.ts)) provides real-time validation of interceptor compatibility with script-based HTTP requests. It runs as an inspector and produces warnings when:

-
**Unsupported interceptor detected**: The `extension` or `proxy` interceptors are not fully compatible with `fetch()`, `hopp.fetch()`, or `pm.sendRequest()` calls in pre-request or test scripts. The inspector recommends switching to the `Agent` (web) or `Native` (desktop) interceptor.

-
**CSRF risk with same-origin requests**: When using the `Browser` interceptor on platforms with cookie-based authentication (self-hosted web), same-origin fetch requests in scripts could include cookies automatically, creating a potential CSRF vulnerability. The inspector warns and recommends the `Agent` interceptor.

typescript1// Inspector logic for detecting unsupported interceptor + scripting API usage
2if (
3  currentInterceptorId === "extension" ||
4  currentInterceptorId === "proxy"
5) {
6  results.push({
7    id: "unsupported-interceptor",
8    icon: markRaw(IconAlertTriangle),
9    text: {
10      type: "text",
11      text: this.t("inspections.scripting_interceptor.unsupported_interceptor", {
12        scriptType, apiUsed, interceptor: currentInterceptorId,
13      }),
14    },
15    severity: 2,
16    isApplicable: true,
17    locations: { type: "response" },
18  })
19}
>
Source: [ScriptingInterceptorInspectorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/scripting-interceptor.inspector.ts#L183-L201)

## Configuration Options
### Per-Platform Default Interceptor
The default interceptor is configured per platform in the application bootstrap:

PlatformAvailable InterceptorsDefaultWeb (self-hosted)Browser, Proxy, Agent, Extension`"browser"`Desktop (Tauri)Native, Proxy`"native"`
### Proxy Interceptor Settings
Configured via `KernelInterceptorProxyStore` ([source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/store.ts)).

OptionTypeDefaultDescription`proxyUrl``string`Platform-specific default proxy URLThe proxy server endpoint`accessToken``string``VITE_PROXYSCOTCH_ACCESS_TOKEN` env varAuthentication token for the proxy server
### Native/Agent Interceptor Domain Settings
Configured via per-domain settings stored in `KernelInterceptorNativeStore` ([source](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/store.ts)).

OptionTypeDefaultDescription`security.verifyHost``boolean``true`Whether to verify the hostname against the certificate`security.verifyPeer``boolean``true`Whether to verify the peer certificate`proxy``object | undefined``undefined`Optional proxy configuration for the domain`options.followRedirects``boolean``true`Whether to follow HTTP redirects
### User Settings
The active interceptor ID is persisted and synchronized via the settings system:

Setting KeyTypeDescription`CURRENT_KERNEL_INTERCEPTOR_ID``string`The currently selected interceptor ID (e.g., `"browser"`, `"native"`, `"proxy"`)
## API Reference
### `KernelInterceptorService`
The central service that manages interceptor registration, selection, and request execution.

**`register(interceptor: KernelInterceptor): void`**

- Registers a new interceptor into the service's reactive registry
- If no interceptor is currently active, the registered interceptor becomes the active one
- Uses `markRaw()` to prevent Vue reactivity overhead on the interceptor object

**`setActive(id: string | null): void`**

- Sets the active interceptor by its string ID
- Logs a warning if attempting to set an unknown interceptor
- Setting to `null` is handled gracefully, keeping the current selection if interceptors exist

**`execute(req: RelayRequest): ExecutionResult`**

- Dispatches a request to the currently active interceptor
- Throws `"No active interceptor"` if no interceptor is selected
- Throws `"Active interceptor not found"` if the selected interceptor is missing from the registry
- Returns an `ExecutionResult` with `cancel()` and `response` promise

**`getCurrentId(): string | null`**

- Returns the ID string of the currently active interceptor, or `null` if none is set

**Computed Properties:**

- `current` — Reactive reference to the currently active interceptor object (or `null`)
- `available` — Reactive array of all registered interceptor objects

### `KernelInterceptor` (Type)
typescript1type KernelInterceptor<Err = KernelInterceptorError> = {
2  id: string
3  name: (t: ReturnType<typeof getI18n>) => string
4  settingsEntry?: {
5    title: (t: ReturnType<typeof getI18n>) => string
6    component: Component
7  }
8  subtitle?: Component
9  selectable: SelectableStatus
10  capabilities: RelayCapabilities
11  execute: (request: RelayRequest) => ExecutionResult<Err>
12}
>
Source: [KernelInterceptor type definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts#L56-L69)

### `ExecutionResult` (Type)
typescript1type ExecutionResult<Err = KernelInterceptorError> = {
2  cancel: () => Promise<void>
3  response: Promise<E.Either<Err, RelayResponse>>
4}
### `KernelInterceptorError` (Type)
typescript1type KernelInterceptorError =
2  | "cancellation"
3  | {
4      humanMessage: {
5        heading: (t: ReturnType<typeof getI18n>) => string
6        description: (t: ReturnType<typeof getI18n>) => string
7      }
8      error: RelayError
9      component?: Component<RelayError>
10    }
>
Source: [KernelInterceptorError type definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts#L38-L47)

## Error Handling
Interceptors provide structured, human-readable error messages for various failure scenarios:

Error KindDescriptionExample Heading`network`Network connectivity failure"Network Error"`timeout`Request exceeded timeout"Timeout Error"`certificate`SSL/TLS certificate validation error"Certificate Error"`auth`Authentication failure"Authentication Error"`proxy`Proxy connection failure"Proxy Error"`parse`Response parsing error"Parse Error"`version`HTTP version mismatch"Version Error"`abort`Request was aborted"Request Aborted"`extension`Browser extension not available or failed"Extension Error"
Errors can optionally include a Vue `component` to render a custom error UI (e.g., `InterceptorErrorPlaceholder`).

## Usage Examples
### Creating a Custom Interceptor
All interceptors extend `Service` from the `dioc` dependency injection container and implement the `KernelInterceptor` interface:

typescript1import { Service } from "dioc"
2import type { KernelInterceptor, ExecutionResult, RelayRequest } from "..."
3import { getI18n } from "~/modules/i18n"
4import * as E from "fp-ts/Either"
5
6export class CustomKernelInterceptorService
7  extends Service
8  implements KernelInterceptor
9{
10  public static readonly ID = "CUSTOM_INTERCEPTOR_SERVICE"
11
12  public readonly id = "custom"
13  public readonly name = (t: ReturnType<typeof getI18n>) => "Custom Interceptor"
14  public readonly selectable = { type: "selectable" as const }
15  public readonly capabilities = {
16    method: new Set(["GET", "POST"]),
17    header: new Set(["stringvalue"]),
18    content: new Set(["text", "json"]),
19    auth: new Set(["basic"]),
20    security: new Set([]),
21    proxy: new Set([]),
22    advanced: new Set([]),
23  }
24
25  public execute(request: RelayRequest): ExecutionResult {
26    // Implement custom request execution logic
27    // Return { cancel: () => Promise<void>, response: Promise<Either<...>> }
28  }
29}
### Switching Interceptors Programmatically
typescript1import { getService } from "~/modules/dioc"
2import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
3
4const interceptorService = getService(KernelInterceptorService)
5
6// Set the active interceptor
7interceptorService.setActive("native")
8
9// Get current interceptor ID
10const currentId = interceptorService.getCurrentId()
11
12// Execute a request through the active interceptor
13const execution = interceptorService.execute(relayRequest)
14const result = await execution.response
### Checking Interceptor Availability
The UI component `KernelInterceptor.vue` demonstrates how to list available interceptors and their selection state:

typescript1const kernelInterceptors = computed(() => kernelInterceptorService.available.value)
2const kernelInterceptorSelection = computed(() => kernelInterceptorService.current.value?.id ?? null)
3
4const setKernelInterceptor = (id: string) => {
5  if (!kernelInterceptors.value.some((ki) => ki.id === id)) {
6    console.warn("Attempted to set an unknown interceptor:", id)
7    return
8  }
9  kernelInterceptorService.setActive(id)
10}
>
Source: [KernelInterceptor.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/KernelInterceptor.vue)

## Related Links
### Source Files

- [KernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts) — Core service implementation
- [KernelInterceptorsModule](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts) — Initialization and settings sync
- [KernelInterceptor type definitions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/kernel-interceptors.ts) — Platform definition types
- [KernelInterceptor.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/KernelInterceptor.vue) — Interceptor selection UI component

### Interceptor Implementations

- [BrowserKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/browser/index.ts) — Browser interceptor
- [ProxyKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/index.ts) — Proxy interceptor
- [ExtensionKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/extension/index.ts) — Extension interceptor
- [NativeKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts) — Native (desktop) interceptor
- [AgentKernelInterceptorService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts) — Agent interceptor

### Interceptor Stores

- [KernelInterceptorProxyStore](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/store.ts) — Proxy settings store
- [KernelInterceptorNativeStore](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/store.ts) — Native/Agent domain settings store

### Integration Helpers

- [hopp-fetch.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/hopp-fetch.ts) — Script fetch() hook that routes through interceptors
- [network.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/network.ts) — REST API network request stream
- [ScriptingInterceptorInspector](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/scripting-interceptor.inspector.ts) — Scripting interceptor compatibility inspector
- [RequestRunner.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/RequestRunner.ts) — Pre-request and test script runner
- [process-request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/functional/process-request.ts) — Pre/post request processing pipeline

### Platform Configuration

- [Self-hosted Web main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/main.ts) — Platform interceptor registrations and defaults