# Platform Abstraction Layer
The Platform Abstraction Layer provides a unified cross-platform runtime kernel (`@hoppscotch/kernel`) that abstracts platform-specific implementations behind a consistent API, enabling Hoppscotch to run seamlessly across web and desktop (Tauri) environments.

## Overview
The Platform Abstraction Layer is built around the **Hoppscotch Kernel** — a minimal, versioned abstraction layer that mediates between high-level application logic and low-level platform implementations. Similar to how operating system kernels abstract over hardware details, the Hoppscotch Kernel insulates the core application from platform-specific concerns such as file I/O, network requests, persistent storage, and logging.

This kernel is designed with the following principles:

- **Versioned APIs**: Each module defines a versioned interface contract, ensuring backwards compatibility and clear upgrade paths.
- **Capability-based feature detection**: Modules declare their capabilities, allowing the application to gracefully handle feature availability across platforms.
- **Default (no-op) implementations**: Every interface ships with a default implementation that safely handles unsupported operations, enabling graceful degradation.
- **Web ↔ Desktop parity**: Both environments implement the same interface, with desktop (Tauri) builds providing richer capabilities while web builds fall back to browser-native APIs.

## Architecture
The kernel architecture follows a layered modular design with four primary modules: IO, Relay, Store, and Log.

加载图表中...
The `initKernel(mode)` factory function selects the appropriate platform implementation based on the detected kernel mode ("web" or "desktop"), exposing a unified `KernelAPI` object on `window.__KERNEL__`.

## Modules
### IO Module — File System & External Resources
The IO module handles file system operations and external resource access.

**Interface:**

>
Source: [io/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/io/v/1.ts)

typescript1export interface IoV1 {
2  saveFileWithDialog(
3    opts: SaveFileWithDialogOptions
4  ): Promise<SaveFileResponse>
5
6  openExternalLink(
7    opts: OpenExternalLinkOptions
8  ): Promise<OpenExternalLinkResponse>
9
10  listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn>
11  once<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn>
12  emit(event: string, payload?: unknown): Promise<void>
13}
**Platform Comparison:**

OperationWeb (Browser)Desktop (Tauri)`saveFileWithDialog`Creates a Blob URL, triggers `<a>` download click. Cannot confirm success.Uses `@tauri-apps/plugin-dialog` `save()`, writes data via `@tauri-apps/plugin-fs`. Returns saved path.`openExternalLink``window.open(url, "_blank")`Uses `@tauri-apps/plugin-shell` `open(url)``listen` / `once` / `emit`Uses `window.location.hash` with `hashchange` eventUses `@tauri-apps/api/event` `listen()` / `emit()`
**Web Implementation Pattern:**

>
Source: [io/impl/web/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/io/impl/web/v/1.ts#L15-L55)

typescript1async saveFileWithDialog(opts: SaveFileWithDialogOptions) {
2  const file = new Blob([opts.data as BlobPart], { type: opts.contentType })
3  const a = document.createElement("a")
4  const url = URL.createObjectURL(file)
5  a.href = url
6  a.download = opts.suggestedFilename
7  document.body.appendChild(a)
8  a.click()
9  setTimeout(() => {
10    document.body.removeChild(a)
11    URL.revokeObjectURL(url)
12  }, 1000)
13  // Browsers provide no way to know if save was successful
14  return { type: "unknown" as const }
15}
**Desktop Implementation Pattern:**

>
Source: [io/impl/desktop/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/io/impl/desktop/v/1.ts#L20-L37)

typescript1async saveFileWithDialog(opts: SaveFileWithDialogOptions) {
2  const path = await save({
3    filters: opts.filters,
4    defaultPath: opts.suggestedFilename,
5  })
6  if (!path) return { type: "cancelled" as const }
7  if (typeof opts.data === "string") {
8    await writeTextFile(path, opts.data)
9  } else {
10    await writeFile(path, opts.data)
11  }
12  return { type: "saved" as const, path }
13}
### Relay Module — Network Operations
The Relay module provides cross-platform HTTP request execution with capability-based feature detection.

**Interface:**

>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts)

typescript1export interface RelayV1 {
2  readonly id: string
3  readonly capabilities: RelayCapabilities
4
5  canHandle(request: RelayRequest): Either<UnsupportedFeatureError, true>
6
7  execute(request: RelayRequest): {
8    cancel: () => Promise<void>
9    emitter: RelayEventEmitter<RelayRequestEvents>
10    response: Promise<Either<RelayError, RelayResponse>>
11  }
12}
**Capability System:**

The relay capability system allows the application to check whether a given platform supports specific features before attempting execution.

>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L250-L318)

typescript1export interface RelayCapabilities {
2  method: Set<MethodCapability>    // GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, CONNECT, TRACE
3  header: Set<HeaderCapability>   // stringvalue, arrayvalue, multivalue
4  content: Set<ContentCapability> // text, json, xml, form, binary, multipart, urlencoded, stream, compression
5  auth: Set<AuthCapability>       // none, basic, bearer, digest, oauth2, apikey, aws, mtls
6  security: Set<SecurityCapability> // clientcertificates, cacertificates, certificatevalidation, etc.
7  proxy: Set<ProxyCapability>     // http, https, socks, authentication, certificates
8  advanced: Set<AdvancedCapability> // retry, redirects, timeout, cookies, keepalive, http2, http3
9}
**Platform Capability Comparison:**

Capability CategoryWeb (Axios)Desktop (Tauri Plugin)HTTP MethodsGET, POST, PUT, DELETE, PATCH, HEAD, OPTIONSGET, POST, PUT, DELETE, PATCH, HEAD, OPTIONSContent Typestext, json, xml, form, urlencoded, compressiontext, json, xml, form, binary, multipart, urlencoded, stream, compressionAuthbasic, bearer, apikey, awsbasic, bearer, digest, oauth2, apikeySecurity❌ (none)✅ Client certs, CA certs, host/peer verificationProxy❌ (none)✅ HTTP, HTTPS, auth, certificatesAdvanced❌ (none)✅ retry, redirects, timeout, cookies, keepalive, tcpoptions, http2, http3
**Web Relay (Axios) - Request Execution:**

>
Source: [relay/impl/web/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/impl/web/v/1.ts#L113-L137)

typescript1execute(request: RelayRequest) {
2  const cancelTokenSource = axios.CancelToken.source()
3  // ...
4  const config: AxiosRequestConfig = {
5    url: request.url,
6    method: request.method,
7    headers: request.headers,
8    params: request.params,
9    data: request.content?.content,
10    maxRedirects: request.meta?.options?.maxRedirects,
11    timeout: request.meta?.options?.timeout,
12    decompress: request.meta?.options?.decompress ?? true,
13    validateStatus: null,
14    cancelToken: cancelTokenSource.token,
15    responseType: "arraybuffer",
16  }
17  const axiosResponse = await axios(config)
18  // ...build RelayResponse from axios response
19}
**Desktop Relay (Tauri Plugin) - Request Execution:**

>
Source: [relay/impl/desktop/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/impl/desktop/v/1.ts#L128-L144)

typescript1execute(request: RelayRequest) {
2  const responsePromise = relayRequestToNativeAdapter(request)
3    .then((request) => execute(pluginRequest))
4    .then((result: RequestResult): Either<RelayError, RelayResponse> => {
5      if (result.kind === "success") {
6        // Build RelayResponse from plugin response
7      }
8      return E.left(result.error)
9    })
10  return {
11    cancel: async () => { await cancel(request.id) },
12    emitter,
13    response: responsePromise,
14  }
15}
**Content Factory Functions:**

The kernel provides factory functions for creating typed HTTP request content, with the `kind` field determining how content is processed.

>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L557-L648)

typescript1export const content = {
2  text: (content: string, mediaType?: MediaType | string): ContentType => ({
3    kind: "text",
4    content,
5    mediaType: mediaType ?? MediaType.TEXT_PLAIN,
6  }),
7  json: <T>(content: T, mediaType?: MediaType | string): ContentType => ({
8    kind: "json",
9    content,
10    mediaType: mediaType ?? MediaType.APPLICATION_JSON,
11  }),
12  binary: (content: Uint8Array, mediaType?: MediaType | string, filename?: string): ContentType => ({
13    kind: "binary",
14    content,
15    mediaType: mediaType ?? MediaType.APPLICATION_OCTET,
16    filename,
17  }),
18  multipart: (content: FormData, mediaType?: MediaType | string): ContentType => ({
19    kind: "multipart",
20    content,
21    mediaType: mediaType ?? MediaType.MULTIPART_FORM,
22  }),
23  // ... urlencoded, form, xml, stream
24}
### Store Module — Persistent Storage
The Store module handles cross-platform persistence with structured data, namespacing, change watching, and optional encryption support.

**Interface:**

>
Source: [store/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/store/v/1.ts#L88-L129)

typescript1export interface StoreV1 {
2  readonly id: string
3  readonly capabilities: Set<StoreCapability>
4
5  init(storePath: string): Promise<Either<StoreError, void>>
6  set(storePath: string, namespace: string, key: string, value: unknown, options?: StorageOptions): Promise<Either<StoreError, void>>
7  get<T>(storePath: string, namespace: string, key: string): Promise<Either<StoreError, T | undefined>>
8  remove(storePath: string, namespace: string, key: string): Promise<Either<StoreError, boolean>>
9  clear(storePath: string, namespace?: string): Promise<Either<StoreError, void>>
10  has(storePath: string, namespace: string, key: string): Promise<Either<StoreError, boolean>>
11  listNamespaces(storePath: string): Promise<Either<StoreError, string[]>>
12  listKeys(storePath: string, namespace: string): Promise<Either<StoreError, string[]>>
13  watch(storePath: string, namespace: string, key: string): Promise<StoreEventEmitter<StoreEvents>>
14}
**Scoped Store Helper:**

>
Source: [store/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/store/v/1.ts#L138-L168)

typescript1export function extend(store: StoreV1, storePath: string, namespace: string): ScopedStore {
2  return {
3    async isAvailable() { return isRight(await store.init(storePath)) },
4    async set(key: string, value: unknown) {
5      const result = await store.set(storePath, namespace, key, value)
6      if (isLeft(result)) throw new Error(result.left.message)
7    },
8    async get<T>(key: string) {
9      const result = await store.get<T>(storePath, namespace, key)
10      if (isLeft(result)) return null
11      return result.right ?? null
12    },
13    async remove(key: string) {
14      const result = await store.remove(storePath, namespace, key)
15      if (isLeft(result)) throw new Error(result.left.message)
16    },
17  }
18}
**Platform Comparison:**

FeatureWeb (localStorage + superjson)Desktop (Tauri Plugin Store)Backend`localStorage` with superjson serializationTauri's `@tauri-apps/plugin-store`Data Format`StoredData` schema with metadataSame `StoredData` schemaCapabilitiespermanent, structured, watch, namespacepermanent, structured, watch, namespace, secureChange WatchingCustom in-memory listener mapTauri store's `onChange` callbackEncryptionDeclared but not implemented (options field)Declared and supported via TauriStore IsolationNot applicable (single origin)Multi-file stores via `storePath` parameter
### Log Module — Diagnostic Logging
The Log module provides structured logging across platforms with console output, in-memory buffering, and optional file-based persistence on desktop.

**Interface:**

>
Source: [log/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/log/v/1.ts#L18-L35)

typescript1export type LogLevel = "debug" | "info" | "warn" | "error"
2export type LogCapability = "console" | "file" | "buffer"
3
4export interface LogV1 {
5  readonly id: string
6  readonly capabilities: Set<LogCapability>
7  init(logPath: string): Promise<Either<LogError, void>>
8  log(logPath: string, level: LogLevel, tag: string, message: string, data?: unknown): Promise<void>
9}
**Platform Comparison:**

CapabilityWebDesktopconsole✅✅file❌✅ (batched Tauri `append_log` invoke)buffer✅ (5000 entry ring buffer)✅ (5000 entry ring buffer)
## Core Flow
### Kernel Initialization Flow
加载图表中...
### Request Execution Strategy
加载图表中...
## Usage Examples
### Basic Kernel Initialization
>
Source: [src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts#L42-L77)

typescript1import { initKernel, getKernelMode, KernelAPI } from "@hoppscotch/kernel"
2
3// Auto-detect platform and initialize kernel
4initKernel(getKernelMode())
5
6// The kernel is now available globally on window.__KERNEL__
7const kernel: KernelAPI | undefined = window.__KERNEL__
8
9// Access kernel info
10if (kernel) {
11  console.log(`Kernel: ${kernel.info.name} v${kernel.info.version.major}.${kernel.info.version.minor}.${kernel.info.version.patch}`)
12}
### Making an HTTP Request
>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L64-L70) and [relay/impl/web/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/impl/web/v/1.ts#L121-L137)

typescript1import { content, type RelayRequest } from "@hoppscotch/kernel"
2import { getModule } from "./kernel" // Internal kernel access helper
3
4const relay = getModule("relay")
5
6// Create a request
7const request: RelayRequest = {
8  id: Date.now(),
9  url: "https://api.example.com/users",
10  method: "POST",
11  version: "HTTP/1.1",
12  headers: { "Accept": "application/json" },
13  content: content.json({ name: "John", email: "john@example.com" }),
14  auth: { kind: "bearer", token: "your-token-here" },
15}
16
17// Check if the relay can handle the request
18const canHandle = relay.canHandle(request)
19if (canHandle._tag === "Right") {
20  const { response, cancel, emitter } = relay.execute(request)
21
22  // Handle the response
23  const result = await response
24  if (result._tag === "Right") {
25    console.log(`Status: ${result.right.status}`, result.right.body)
26  }
27}
### Using the Store with Scoped Access
>
Source: [store/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/store/v/1.ts#L138-L168)

typescript1import { extendStore } from "@hoppscotch/kernel"
2import { getModule } from "./kernel"
3
4const store = getModule("store")
5
6// Create a scoped store for a specific namespace
7const userPreferences = extendStore(store, "app-data.hoppscotch.json", "preferences")
8
9// Use the scoped store with simplified API
10await userPreferences.set("theme", "dark")
11const theme = await userPreferences.get<string>("theme") // "dark"
12await userPreferences.remove("theme")
### Structured Logging
>
Source: [log/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/log/v/1.ts#L28-L35)

typescript1import { getModule } from "./kernel"
2
3const log = getModule("log")
4
5// Initialize logger (creates log file on desktop, no-op on web)
6await log.init("io.hoppscotch.desktop.diag.log")
7
8// Log entries with different levels
9await log.log(logPath, "info", "app", "Application started")
10await log.log(logPath, "warn", "network", "Request slow", { url: "/api/data", duration: 5200 })
11await log.log(logPath, "error", "auth", "Token refresh failed", { status: 401 })
## Configuration Options
The kernel itself has minimal runtime configuration. The primary configuration is the kernel mode selection:

OptionTypeDefaultDescription`__KERNEL_MODE__``"web" | "desktop"``"web"`Global variable set before kernel initialization to select platform`getKernelMode()``() => KernelMode`Returns `"web"`Detects the kernel mode from `window.__KERNEL_MODE__`
The kernel modules (IO, Relay, Store, Log) each expose versioned default/fallback implementations:

ModuleDefault API BehaviorIOReturns `{ type: "unknown" }` for all operationsRelayReturns `Left({ kind: "version", message: "Not implemented" })` for all operationsStoreReturns `Left({ kind: "version", message: "Not implemented" })` for all operationsLogReturns `Left({ kind: "init", message: "Not implemented" })` for init, no-op for log
## API Reference
### KernelAPI
>
Source: [src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts#L25-L31)

typescript1export interface KernelAPI {
2  info: KernelInfo
3  io: typeof IO_VERSIONS.v1.api
4  relay: typeof RELAY_VERSIONS.v1.api
5  store: typeof STORE_VERSIONS.v1.api
6  log: typeof LOG_VERSIONS.v1.api
7}
8
9export interface KernelInfo {
10  name: string
11  version: Version
12  capabilities: string[]
13}
14
15export type Version = { major: number; minor: number; patch: number }
16export type KernelMode = "web" | "desktop"
### `initKernel(mode?: KernelMode): KernelAPI`
Initializes the kernel with platform-specific implementations.

**Parameters:**

- `mode` (KernelMode, optional): Force a specific platform mode. If omitted, defaults to "web".

**Returns:** `KernelAPI` — The initialized kernel with platform-specific module implementations.

**Side Effects:** Sets `window.__KERNEL__` to the initialized kernel instance.

### `getKernelMode(): KernelMode`
Detects the current kernel mode from the global environment.

**Returns:** `"web" | "desktop"` — The detected platform mode, defaulting to "web".

### `hasCapability<T>(capabilities: Set<T>, capability: T): boolean`
Checks if a capability set includes a specific capability.

>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L478-L481)

**Parameters:**

- `capabilities` (Set<T>): The set of available capabilities
- `capability` (T): The capability to check

**Returns:** `boolean`

### `findSuitableRelay(request: RelayRequest, relays: RelayV1[]): Either<UnsupportedFeatureError, RelayV1>`
Finds the first relay capable of handling a given request.

>
Source: [relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L483-L500)

**Parameters:**

- `request` (RelayRequest): The request to handle
- `relays` (RelayV1[]): Array of available relays

**Returns:** `Either<UnsupportedFeatureError, RelayV1>` — The first suitable relay, or an error if none can handle it.

### `checkCapability(required: Version, available: Version): boolean`
Checks if an available version meets minimum requirements.

>
Source: [util/capability.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/util/capability.ts#L3-L9)

**Parameters:**

- `required` (Version): The minimum required version
- `available` (Version): The available version

**Returns:** `boolean` — True if the available version meets or exceeds requirements.

### `extendStore(store: StoreV1, storePath: string, namespace: string): ScopedStore`
Creates a scoped store that automatically applies a namespace prefix.

>
Source: [store/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/store/v/1.ts#L138-L168)

**Parameters:**

- `store` (StoreV1): The underlying store implementation
- `storePath` (string): The store file path (used by desktop)
- `namespace` (string): The namespace to scope operations to

**Returns:** `ScopedStore` with simplified `set`, `get`, `remove`, and `isAvailable` methods.

## Capability Versioning
加载图表中...
## VersionedAPI Structure
>
Source: [type/versioning.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/type/versioning.ts)

typescript1export type Version = { major: number; minor: number; patch: number }
2
3export type VersionedAPI<T> = {
4  version: Version
5  api: T
6}
Every module defines:

- A versioned interface (`IoV1`, `RelayV1`, `StoreV1`, `LogV1`)
- A default implementation (no-op / "Not implemented")
- Platform-specific implementations (web & desktop)
- A `VERSIONS` registry and a `latest` export

## Related Links

- [Source: @hoppscotch/kernel package](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel)
- [Kernel README](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/README.md)
- [Kernel Entry Point (src/index.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/index.ts)
- [Common Platform Abstraction](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform)
- [Kernel Relay Module (relay/v/1.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts)
- [Kernel Store Module (store/v/1.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/store/v/1.ts)
- [Kernel IO Module (io/v/1.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/io/v/1.ts)
- [Kernel Log Module (log/v/1.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/log/v/1.ts)
- [Kernel Vite Configuration (vite.config.ts)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/vite.config.ts)