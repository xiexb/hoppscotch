# Kernel System
The Hoppscotch Kernel System is a cross-platform abstraction layer that provides a unified interface between application logic and platform-specific implementations, mediating network operations, file I/O, storage, and logging across web and desktop environments.

## Overview
The Kernel System is inspired by operating system kernels — it abstracts over hardware (platform) details, enabling the core Hoppscotch application to remain platform-agnostic while maintaining near-native performance. By defining clean, versioned interfaces for every subsystem, the kernel allows Hoppscotch to run identically in web browsers, as a desktop app (via Tauri), or through a dedicated agent — all without modifying application-level code.

The kernel is composed of four core modules:

- **Relay Module** — Network request/response execution with platform-specific transport backends
- **IO Module** — File system operations (saving files, opening external links)
- **Store Module** — Cross-platform persistence with encryption and compression support
- **Log Module** — Platform-aware logging infrastructure

On top of the kernel, Hoppscotch implements an **Interceptor System** that allows users to choose how requests are executed: via the browser (native fetch/axios), a browser extension, a desktop relay, a proxy server, or a Hoppscotch Agent running locally.

## Architecture
The following diagram illustrates the overall Kernel System architecture, showing how the application interacts with the kernel and how requests flow through interceptors to the underlying platform implementations.

加载图表中...
### Component Responsibilities
ComponentRole**KernelInterceptorService**Manages interceptor registration, activation, and request dispatching**Browser Interceptor**Executes requests via the web relay (Axios-based) — suitable for most use cases**Extension Interceptor**Routes requests through the Hoppscotch Browser Extension for CORS-free execution**Native Interceptor**Uses the Tauri plugin relay for desktop-native networking with advanced capabilities**Proxy Interceptor**Sends requests through a proxy server (Proxyscotch) for secure CORS-free execution**Agent Interceptor**Connects to a locally running Hoppscotch Agent daemon for advanced networking
## Core Modules
### Relay Module
The Relay module is the heart of the kernel's networking capability. It defines the `RelayV1` interface:

typescript1interface RelayV1 {
2  readonly id: string
3  readonly capabilities: RelayCapabilities
4
5  canHandle(request: RelayRequest): E.Either<UnsupportedFeatureError, true>
6
7  execute(request: RelayRequest): {
8    cancel: () => Promise<void>
9    emitter: RelayEventEmitter<RelayRequestEvents>
10    response: Promise<E.Either<RelayError, RelayResponse>>
11  }
12}
>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L465-L476)

Each relay implementation declares its capabilities (supported HTTP methods, content types, auth types, etc.) via the `RelayCapabilities` type. Before executing a request, interceptors can check if the relay can handle it using `canHandle()`.

#### Relay Request Model
The `RelayRequest` type is a standardized, platform-agnostic representation of an HTTP request:

typescript1interface RelayRequest {
2  id: number
3  url: string
4  method: Method
5  version: Version
6  headers?: Record<string, string>
7  params?: Record<string, string>
8  content?: ContentType
9  auth?: AuthType
10  security?: { ... }
11  proxy?: { ... }
12  meta?: { timing?, retry?, options?, http2?, http3? }
13}
>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L342-L401)

#### Relay Response Model
The `RelayResponse` type carries the full HTTP response with metadata:

typescript1interface RelayResponse {
2  id: number
3  status: StatusCode
4  statusText: string
5  version: Version
6  headers: Record<string, string>
7  cookies?: Array<{ name, value, domain?, path?, ... }>
8  body: RelayResponseBody
9  meta: {
10    timing: { start, end, phases? }
11    size: { headers, body, total }
12    tls?: { version, cipher, certificates? }
13    redirects?: Array<{ url, status, version, headers }>
14  }
15}
>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L403-L463)

#### Content Type Factories
The kernel provides factory functions for creating standardized request content:

typescript1import { content, MediaType } from "@hoppscotch/kernel"
2
3// JSON content (auto-serializes objects)
4const jsonContent = content.json({ name: "John" }, MediaType.APPLICATION_JSON)
5
6// Pre-stringified JSON (avoids double-encoding)
7const preStringified = content.text(
8  '{"message": "Hello \\"world\\""}',
9  MediaType.APPLICATION_JSON
10)
11
12// Binary content
13const binaryContent = content.binary(
14  new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
15  "image/png",
16  "image.png"
17)
18
19// Multipart form data
20const formData = new FormData()
21formData.append("field", "value")
22const multipart = content.multipart(formData)
23
24// URL-encoded form data
25const urlencoded = content.urlencoded("key1=value1&key2=value2")
>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L557-L655)

### IO Module
The IO module abstracts file system and external resource operations:

typescript1interface IoV1 {
2  saveFileWithDialog(opts: SaveFileWithDialogOptions): Promise<SaveFileResponse>
3  openExternalLink(opts: OpenExternalLinkOptions): Promise<OpenExternalLinkResponse>
4  listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn>
5  once<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn>
6  emit(event: string, payload?: unknown): Promise<void>
7}
>
Source: [io/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/io/v/1.ts#L36-L50)

### Store Module
The Store module provides cross-platform persistent storage with optional encryption and compression:

typescript1interface StoreV1 {
2  readonly capabilities: Set<StoreCapability>
3  set(namespace: string, key: string, value: unknown, options?: StorageOptions): Promise<Either<StoreError, void>>
4  get(namespace: string, key: string): Promise<Either<StoreError, unknown>>
5  delete(namespace: string, key: string): Promise<Either<StoreError, void>>
6  watch(namespace: string, key: string): Promise<StoreEventEmitter<StoreEvents>>
7}
### Log Module
The Log module provides platform-aware logging with configurable log levels.

## Request Execution Flow
The following sequence diagram illustrates the complete flow of an API request through the kernel system:

加载图表中...
## Request/Response Transformation
When Hoppscotch sends an API request, the application-level request object must be transformed into a `RelayRequest` that the kernel understands. Similarly, the kernel's `RelayResponse` must be transformed back into an application-level response.

### REST Request Transformation
The `RESTRequest.toRequest()` method converts an `EffectiveHoppRESTRequest` (the app's internal representation with resolved variables and environment) into a `RelayRequest`:

typescript1export const RESTRequest = {
2  async toRequest(request: EffectiveHoppRESTRequest): Promise<RelayRequest> {
3    const auth = await pipe(
4      transformAuth(request.auth),
5      TE.getOrElse(() => T.of<AuthType>(defaultAuth))
6    )()
7
8    const content = await pipe(
9      transformContent(request),
10      TE.getOrElse(() => T.of<O.Option<ContentType>>(O.none)),
11      T.map(O.toUndefined)
12    )()
13
14    const headers = filterActiveToRecord(request.effectiveFinalHeaders)
15    const params = filterActiveParams(request.effectiveFinalParams)
16
17    return {
18      id: Date.now(),
19      url: request.effectiveFinalURL,
20      method: request.method.toUpperCase() as Method,
21      version: "HTTP/1.1",
22      headers,
23      params,
24      auth,
25      content,
26    }
27  },
28}
>
Source: [helpers/kernel/rest/request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/request.ts#L16-L42)

### REST Response Transformation
The `RESTResponse.toResponse()` method converts a `RelayResponse` back into the application's response format, handling headers and metadata:

typescript1export const RESTResponse = {
2  async toResponse(
3    response: RelayResponse,
4    originalRequest: HoppRESTRequest
5  ): Promise<HoppRESTSuccessResponse | HoppRESTTransformError> {
6    if (!response.body.body || !(response.body.body instanceof Uint8Array)) {
7      return {
8        type: "fail",
9        error: { type: "transform_error", message: "Invalid response body format" },
10      }
11    }
12
13    return {
14      type: "success",
15      headers: processHeaders(response.headers),
16      body: response.body.body.buffer,
17      statusCode: response.status,
18      statusText: response.statusText ?? "",
19      meta: {
20        responseSize: extractSize(response),
21        responseDuration: extractTiming(response),
22      },
23      req: originalRequest,
24    }
25  },
26}
>
Source: [helpers/kernel/rest/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/response.ts#L72-L99)

### GraphQL Request Transformation
For GraphQL, the transformation wraps the query and variables into a JSON POST request:

typescript1export const GQLRequest = {
2  async toRequest(request: HoppGQLRequest) {
3    const headers = {
4      ...filterActiveToRecord(request.headers),
5      "content-type": "application/json",
6    }
7
8    const auth = await pipe(
9      transformAuth(request.auth),
10      TE.getOrElse(() => T.of<AuthType>(defaultAuth))
11    )()
12
13    const variables = await parseVariables(request.variables)
14
15    return {
16      id: Date.now(),
17      url: request.url,
18      method: "POST",
19      version: "HTTP/1.1",
20      headers,
21      auth,
22      content: content.json(
23        { query: request.query, variables },
24        MediaType.APPLICATION_JSON
25      ),
26    }
27  },
28}
>
Source: [helpers/kernel/gql/request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/request.ts#L21-L47)

### Authentication Transformation
The auth transformation system maps Hoppscotch's internal auth types to kernel `AuthType` discriminative unions. It supports **Basic**, **Bearer**, **API Key**, **AWS Signature**, **Digest**, and **OAuth2** (with 4 grant types):

typescript1const Processors = {
2  basic: flow(
3    Guards.basic,
4    O.map((a) => ({
5      kind: "basic" as const,
6      username: a.username,
7      password: a.password,
8    })),
9    E.fromOption(() => new Error("Invalid basic auth"))
10  ),
11
12  bearer: flow(
13    Guards.bearer,
14    O.map((a) => ({
15      kind: "bearer" as const,
16      token: a.token,
17    })),
18    E.fromOption(() => new Error("Invalid bearer auth"))
19  ),
20
21  // ...apiKey, aws, digest, oauth2
22}
23
24export const transformAuth = (auth: HoppAuth): TE.TaskEither<Error, AuthType> =>
25  pipe(
26    auth,
27    O.fromPredicate(isAuthActive),
28    O.chain(getProcessor),
29    O.map((processor) => processor(auth)),
30    O.getOrElse(() => E.right(defaultAuth)),
31    TE.fromEither
32  )
>
Source: [helpers/kernel/common/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/common/auth.ts#L94-L286)

## Interceptor System
The interceptor system allows users to choose how HTTP requests are executed. The `KernelInterceptorService` manages the lifecycle of all registered interceptors.

### Interceptor Interface
Every interceptor must implement the `KernelInterceptor` interface:

typescript1type KernelInterceptor<Err extends KernelInterceptorError = KernelInterceptorError> = {
2  id: string
3  name: (t: ReturnType<typeof getI18n>) => string
4  settingsEntry?: { title: (t) => string; component: Component }
5  subtitle?: Component
6  selectable: SelectableStatus
7  capabilities: RelayCapabilities
8  execute: (request: RelayRequest) => ExecutionResult<Err>
9}
>
Source: [services/kernel-interceptor.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts#L56-L69)

### Interceptor Capabilities Comparison
CapabilityBrowserExtensionNativeProxyAgent**Methods**GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS✅✅✅✅**Headers**String valueString/Array/MultiString/Array/MultiStringString/Array/Multi**Content Types**text, json, xml, form, urlencodedtext, json, xml, form, binary, multipart, urlencoded, compressiontext, json, xml, form, binary, multipart, urlencoded, compressiontexttext, json, xml, form, binary, multipart, urlencoded, compression**Auth Types**basic, bearer, apikeybasic, bearer, apikeybasic, bearer, apikey, digest, aws, hawkbasicbasic, bearer, apikey, digest, aws, hawk**Security**❌client CA, cert validationclient CA, cert validation❌client CA, cert validation**Proxy**❌HTTP, HTTPS, auth, certs❌❌HTTP, HTTPS, auth, certs**Advanced**❌localaccessredirects, cookies, localaccess❌redirects, cookies, localaccess
### Interceptor Registration
Interceptors are registered at application startup via platform definitions. The module system reads the platform configuration and registers interceptors accordingly:

typescript1function registerInterceptors(service: KernelInterceptorService): void {
2  platform.kernelInterceptors.interceptors.forEach((interceptorDef) => {
3    if (interceptorDef.type === "standalone") {
4      service.register(interceptorDef.interceptor)
5    } else {
6      const interceptorService = getService(interceptorDef.service)
7      service.register(interceptorService)
8    }
9  })
10}
11
12function initializeDefaultInterceptor(service: KernelInterceptorService): void {
13  service.setActive(platform.kernelInterceptors.default)
14}
>
Source: [modules/kernel-interceptors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts#L25-L38)

### Browser Interceptor (Web)
The browser interceptor uses the Axios-based web relay to execute requests. It handles errors with localized human-readable messages:

typescript1export class BrowserKernelInterceptorService
2  extends Service
3  implements KernelInterceptor
4{
5  public readonly id = "browser"
6  public readonly capabilities = {
7    method: new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
8    header: new Set(["stringvalue"]),
9    content: new Set(["text", "json", "xml", "form", "multipart", "urlencoded"]),
10    auth: new Set(["basic", "bearer", "apikey"]),
11    security: new Set([]),
12    proxy: new Set([]),
13    advanced: new Set([]),
14  } as const
15
16  public execute(request: RelayRequest): ExecutionResult<KernelInterceptorError> {
17    const processedRequest = preProcessRelayRequest(request)
18    const relayExecution = Relay.execute(processedRequest)
19    // ... error mapping with localized messages
20  }
21}
>
Source: [platform/std/kernel-interceptors/browser/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/browser/index.ts#L19-L149)

### Native Interceptor (Desktop)
The native interceptor is available in the desktop app (Tauri) and provides advanced networking capabilities, including full certificate management, proxy support, and cookie handling:

typescript1export class NativeKernelInterceptorService
2  extends Service
3  implements KernelInterceptor
4{
5  public readonly id = "native"
6  public readonly capabilities: RelayCapabilities = {
7    // ... full set of capabilities including
8    security: new Set(["clientcertificates", "cacertificates",
9      "certificatevalidation", "hostverification", "peerverification"]),
10    proxy: new Set(["http", "https", "authentication", "certificates"]),
11    advanced: new Set(["redirects", "cookies", "localaccess"]),
12  }
13
14  private async executeRequest(request, setRelayExecution) {
15    const effectiveRequest = this.store.completeRequest(preProcessRelayRequest(request))
16    const relevantCookies = this.cookieJar.getCookiesForURL(new URL(effectiveRequest.url!))
17    // ... attach cookies, user-agent, convert to native adapter
18    const nativeRequest = await relayRequestToNativeAdapter(effectiveRequestWithUserAgent)
19    const postProcessedRequest = postProcessRelayRequest(nativeRequest)
20    const relayExecution = Relay.execute(postProcessedRequest)
21    setRelayExecution(relayExecution)
22    return await relayExecution.response
23  }
24}
>
Source: [platform/std/kernel-interceptors/native/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts#L27-L227)

### Proxy Interceptor
The proxy interceptor wraps requests as JSON payloads and sends them to a proxy server (Proxyscotch) which forwards them, enabling CORS-free requests:

typescript1public execute(request: RelayRequest): ExecutionResult<KernelInterceptorError> {
2  const settings = this.store.getSettings()
3  const proxyUrl = settings.proxyUrl
4
5  const proxyRelayRequest: RelayRequest = {
6    id: Date.now(),
7    url: proxyUrl,
8    method: "POST",
9    version: "HTTP/1.1",
10    headers: { "content-type": content.mediaType },
11    content,
12  }
13
14  const relayExecution = Relay.execute(proxyRelayRequest)
15  // ... unwraps proxy response
16}
>
Source: [platform/std/kernel-interceptors/proxy/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/index.ts#L51-L444)

### Agent Interceptor
The agent interceptor connects to a locally running Hoppscotch Agent via HTTP, with encrypted request/response payloads using AES encryption:

typescript1private async executeRequest(request, reqID, cancelToken) {
2  await this.store.checkAgentStatus()
3  const effectiveRequest = this.store.completeRequest(preProcessRelayRequest(request))
4  // ... convert to native adapter
5  const nativeRequest = await relayRequestToNativeAdapter(effectiveRequestWithUserAgent)
6  const postProcessedRequest = postProcessRelayRequest(nativeRequest)
7
8  const [nonceB16, encryptedReq] = await this.store.encryptRequest(postProcessedRequest, reqID)
9  const response = await axios.post("http://localhost:9119/execute", encryptedReq, {
10    headers: {
11      Authorization: `Bearer ${this.store.authKey.value}`,
12      "X-Hopp-Nonce": nonceB16,
13      "Content-Type": "application/octet-stream",
14    },
15    responseType: "arraybuffer",
16  })
17  const decryptedResponse = await this.store.decryptResponse(nonceB16, response.data)
18  return E.right(decryptedResponse)
19}
>
Source: [platform/std/kernel-interceptors/agent/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts#L114-L223)

## Kernel Initialization
The kernel is initialized differently depending on the platform:

**Web platform** — Initialized automatically as "web-kernel" using Axios-based relay:

typescript1import { initKernel } from "@hoppscotch/kernel"
2
3// Web initialization (default)
4const kernel = initKernel("web")
5// kernel.info.name === "web-kernel"
**Desktop platform** — Set to "desktop" mode via a pre-load script in Tauri:

javascript// In Tauri desktop app, kernel.js sets the mode before any app code runs
window.__KERNEL_MODE__ = "desktop"
>
Source: [kernel/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts#L46-L78)

The `KernelAPI` interface provides access to all four subsystems:

typescript1interface KernelAPI {
2  info: KernelInfo
3  io: IoV1
4  relay: RelayV1
5  store: StoreV1
6  log: LogV1
7}
>
Source: [kernel/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts#L25-L31)

## Error Handling
Errors in the kernel system follow a structured pattern using functional programming (fp-ts `Either`). Every operation returns `Either<Error, Result>`, ensuring explicit error handling.

加载图表中...
Kernel errors are mapped to human-readable (i18n) messages by each interceptor, with optional Vue components for rich error display:

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
Source: [services/kernel-interceptor.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts#L38-L47)

## Configuration
### Interceptor Selection
The active interceptor is persisted in app settings and can be changed via the UI:

Setting KeyTypeDefaultDescription`CURRENT_KERNEL_INTERCEPTOR_ID``string`Platform defaultID of the active kernel interceptor
A bidirectional sync mechanism keeps the service and settings in sync:

typescript1function setupInterceptorSync(service: KernelInterceptorService): void {
2  // Sync service → settings
3  watch(
4    () => service.current.value?.id,
5    (id) => {
6      applySetting("CURRENT_KERNEL_INTERCEPTOR_ID", id ?? platform.kernelInterceptors.default)
7    }
8  )
9
10  // Sync settings → service
11  const [setting] = useSettingStatic("CURRENT_KERNEL_INTERCEPTOR_ID")
12  watch(setting, () => {
13    service.setActive(setting.value ?? platform.kernelInterceptors.default)
14  }, { immediate: true })
15}
>
Source: [modules/kernel-interceptors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts#L40-L68)

### KernelIO Platform Definition
The IO operations are also configurable per platform:

MethodDescription`saveFileWithDialog(opts)`Save file with platform save dialog`openExternalLink(opts)`Open URL in external browser/application
>
Source: [platform/kernel-io.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/kernel-io.ts#L112-L128)

## Usage Examples
### Sending a REST Request
typescript1import { RESTRequest } from "~/helpers/kernel/rest"
2import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
3
4// Inside a service
5const kernelInterceptorService = useService(KernelInterceptorService)
6
7// Transform app request to kernel RelayRequest
8const relayRequest = await RESTRequest.toRequest(effectiveRequest)
9
10// Execute via the active interceptor
11const execution = kernelInterceptorService.execute(relayRequest)
12
13// Await the response
14const either = await execution.response
15
16// Handle result (fp-ts Either pattern)
17if (either.type === "right") {
18  const relayResponse = either.value
19  // Transform back to app response
20  const result = await RESTResponse.toResponse(relayResponse, originalRequest)
21} else {
22  const error = either.value
23  // Show human-readable error
24  console.error(error.humanMessage)
25}
>
Source: [services/kernel-interceptor.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts#L156-L159)

### Registering a Custom Interceptor
typescript1import { KernelInterceptorService, KernelInterceptor } from "~/services/kernel-interceptor.service"
2
3const customInterceptor: KernelInterceptor = {
4  id: "custom",
5  name: (t) => "Custom Interceptor",
6  selectable: { type: "selectable" },
7  capabilities: {
8    method: new Set(["GET", "POST"]),
9    header: new Set(["stringvalue"]),
10    content: new Set(["text", "json"]),
11    auth: new Set(["basic"]),
12    security: new Set([]),
13    proxy: new Set([]),
14    advanced: new Set([]),
15  },
16  execute(request) {
17    // Custom execution logic
18    return {
19      cancel: async () => { /* cleanup */ },
20      response: Promise.resolve(E.right(/* RelayResponse */)),
21    }
22  },
23}
24
25const service = useService(KernelInterceptorService)
26service.register(customInterceptor)
## Related Links

- [Source: @hoppscotch/kernel Package](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts)
- [Source: Kernel Type Declarations](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/types/kernel.d.ts)
- [Source: Kernel Interceptor Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/kernel-interceptor.service.ts)
- [Source: Kernel Interceptor Module](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts)
- [Source: REST Request Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/request.ts)
- [Source: REST Response Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/response.ts)
- [Source: GQL Request Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/request.ts)
- [Source: GQL Response Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/response.ts)
- [Source: Auth Transformer](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/common/auth.ts)
- [Source: Content Transformer](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/common/content.ts)
- [Source: Interceptor Definitions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/kernel-interceptors.ts)
- [Source: IO Platform Def](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/kernel-io.ts)
- [Source: Relay v1 Types & Factories](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts)
- [Source: Web Relay Implementation](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/impl/web/v/1.ts)
- [Source: Browser Interceptor](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/browser/index.ts)
- [Source: Native Interceptor](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts)
- [Source: Extension Interceptor](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/extension/index.ts)
- [Source: Proxy Interceptor](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/proxy/index.ts)
- [Source: Agent Interceptor](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts)
- [Source: Request Process Helper](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/functional/process-request.ts)
- [Source: KernelInterceptor UI Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/app/KernelInterceptor.vue)
- [Source: Platform Def](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)
- [Source: Kernel Tests](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/__tests__/kernel.spec.ts)