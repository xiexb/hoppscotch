# Dependency Injection (Dioc)
Hoppscotch uses the [Dioc](https://github.com/hoppscotch/dioc) library (v3.0.2) as its dependency injection (DI) framework. Dioc provides a lightweight, TypeScript-native IoC (Inversion of Control) container that manages service lifecycles, resolves dependencies, and integrates seamlessly with Vue 3's composition API.

## Overview
Dioc is a custom DI framework purpose-built for Hoppscotch to manage the complex dependency graph of services in the application. Unlike traditional DI containers that rely on decorators or reflection, Dioc uses a simple, explicit binding pattern where services declare their dependencies by calling `this.bind()` within their constructor or initialization code.

### Key Concepts

- **Container**: The central registry that manages service instances. A single `Container` instance serves the entire application.
- **Service**: A class extending `Service` from the `dioc` package. Services are singleton-scoped within the container.
- **Service ID**: A unique string identifier (e.g., `"SCROLL_SERVICE"`, `"PERSISTENCE_SERVICE"`) used for debugging and cross-referencing.
- **Binding**: The process of registering a service class with the container. The first binding creates the singleton instance; subsequent bindings return the existing instance.
- **Event System**: Both the container and individual services emit events throughout their lifecycle, enabling debugging and monitoring.

### Service Lifecycle

- **Service Definition**: A class extends `Service` and defines a static `ID` property.
- **Service Registration**: The service class is passed to `container.bind()` or `this.bind()` from within another service.
- **Service Instantiation**: Dioc creates a singleton instance of the service the first time it is bound.
- **Service Initialization**: If defined, `onServiceInit()` is called after the service is fully constructed and all dependencies are available.
- **Service Resolution**: The same singleton instance is returned for all subsequent bind requests.

## Architecture
The Dioc framework is integrated into Hoppscotch through a dedicated module (`modules/dioc.ts`) that creates the container, registers core services, and installs the Vue plugin.

### Architecture Overview
加载图表中...
### The Dioc Module
The central Dioc configuration lives in `packages/hoppscotch-common/src/modules/dioc.ts`. It creates the application's single `Container` instance and registers it with Vue via the `diocPlugin`.

>
Source: [packages/hoppscotch-common/src/modules/dioc.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/dioc.ts#L1-L41)

typescript1import { HoppModule } from "."
2import { Container, ServiceClassInstance } from "dioc"
3import { diocPlugin } from "dioc/vue"
4import { DebugService } from "~/services/debug.service"
5import { platform } from "~/platform"
6
7const serviceContainer = new Container()
8
9if (import.meta.env.DEV) {
10  serviceContainer.bind(DebugService)
11}
12
13/**
14 * Gets a service from the app service container. You can use this function
15 * to get a service if you have no access to the container or if you are not
16 * in a component (if you are, you can use `useService`) or if you are not in a
17 * service.
18 *
19 * @deprecated This is a temporary escape hatch for legacy code to access
20 * services. Please use `useService` if within components or try to convert your
21 * legacy subsystem into a service if possible.
22 */
23export function getService<T extends ServiceClassInstance<any>>(
24  service: T
25): InstanceType<T> {
26  return serviceContainer.bind(service)
27}
28
29export default <HoppModule>{
30  onVueAppInit(app) {
31    app.use(diocPlugin, {
32      container: serviceContainer,
33    })
34
35    for (const service of platform.addedServices ?? []) {
36      serviceContainer.bind(service)
37    }
38  },
39}
### Module System Integration
The Dioc module is loaded as part of Hoppscotch's module system, defined in `packages/hoppscotch-common/src/modules/index.ts`. The `HOPP_MODULES` array collects all modules from the `@modules/*.ts` glob pattern and executes them during app initialization.

>
Source: [packages/hoppscotch-common/src/modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts#L51-L58)

typescript1/**
2 * All the modules Hoppscotch loads into the app
3 */
4export const HOPP_MODULES = pipe(
5  import.meta.glob("@modules/*.ts", { eager: true }),
6  Object.values,
7  A.map(({ default: defaultVal }) => defaultVal as HoppModule),
8  A.filter((module) => !module.deprecated)
9)
### Application Bootstrap Flow
The application bootstrapping in `packages/hoppscotch-common/src/index.ts` orchestrates initial service resolution and module loading.

>
Source: [packages/hoppscotch-common/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/index.ts#L24-L70)

typescript1export async function createHoppApp(
2  el: string | Element,
3  platformDef: PlatformDef
4) {
5  initKernel(getKernelMode())
6
7  // ...kernel log initialization...
8
9  setPlatformDef(platformDef)
10
11  const app = createApp(App)
12
13  // Initialize core services before app mounting
14  const initService = getService(InitializationService)
15
16  await initService.initPre()
17
18  // ...auth/sync initialization...
19
20  HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app))
21  platformDef.addedHoppModules?.forEach((mod) => mod.onVueAppInit?.(app))
22
23  app.mount(el)
24
25  await initService.initPost()
26}
## Service Resolution Patterns
Dioc provides three distinct ways to resolve services, each with a specific use case:

### 1. `this.bind()` — Within Services (Recommended)
When a service depends on another service, it uses `this.bind()` to declare the dependency. Dioc automatically resolves the dependency from the container and provides the singleton instance.

>
Source: [packages/hoppscotch-common/src/services/workspace.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/workspace.service.ts#L36-L51)

typescript1export class WorkspaceService extends Service<WorkspaceServiceEvent> {
2  public static readonly ID = "WORKSPACE_SERVICE"
3
4  private teamCollectionService = this.bind(TeamCollectionsService)
5  private documentationService = this.bind(DocumentationService)
6
7  // ...service implementation...
8}
### 2. `useService()` — In Vue Components (Recommended)
Vue components and composables use `useService()` (from `dioc/vue`) to inject services. This leverages Vue's composition API and works within the component setup context.

>
Source: [packages/hoppscotch-common/src/composables/useScrollerRef.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/useScrollerRef.ts#L14-L27)

typescript1import { useService } from "dioc/vue"
2import { ScrollService } from "~/services/scroll.service"
3
4export function useScrollerRef(
5  label: string = "Lens",
6  classSelector: string = ".cm-scroller",
7  initialScrollTop?: number,
8  scrollKey?: string
9) {
10  // Container element ref (typically the root of the scrollable section)
11  const containerRef = ref<HTMLElement | null>(null)
12  const scrollerRef = ref<HTMLElement | null>(null)
13
14  // Inject the ScrollService to access stored scroll positions
15  const scrollService = useService(ScrollService)
16
17  // ...composable implementation...
18}
### 3. `getService()` — Legacy Escape Hatch (Deprecated)
For code that exists outside of services or Vue components (e.g., plain utility functions, helpers), the `getService()` function provides a way to access the container. However, this is marked as **deprecated** — the recommended approach is to convert legacy subsystems into proper services or use `useService()` within components.

>
Source: [packages/hoppscotch-common/src/helpers/auth/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/index.ts#L1-L14)

typescript1import { getService } from "~/modules/dioc"
2import { RESTTabService } from "~/services/tab/rest"
3
4export const replaceTemplateStringsInObjectValues = <
5  T extends Record<string, unknown>,
6>(
7  obj: T,
8  source: "REST" | "GQL" = "REST"
9) => {
10  const envs = getCombinedEnvVariables()
11  const restTabsService = getService(RESTTabService)
12  // ...implementation...
13}
## Core Flow: Service Initialization Sequence
The initialization sequence is orchestrated by the `InitializationService`, which uses Dioc's event system to coordinate the startup of various subsystems in a specific order.

加载图表中...
## Service Implementation Patterns
### Basic Service Structure
Every service in Hoppscotch follows a consistent pattern. Here's a simple example:

>
Source: [packages/hoppscotch-common/src/services/scroll.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/scroll.service.ts#L1-L47)

typescript1import { Service } from "dioc"
2
3/**
4 * Suffix type for different views in the application.
5 */
6export type Suffix = "json" | "raw" | "html" | "xml" | "preview"
7
8/**
9 * This service is used to store and manage scroll positions for different tabs and views.
10 * The scroll data is maintained in-memory and not persisted anywhere.
11 */
12export class ScrollService extends Service {
13  public static readonly ID = "SCROLL_SERVICE"
14
15  private scrollMap = new Map<string, number>()
16
17  public setScroll(tabId: string, suffix: Suffix, position: number) {
18    const key = `${tabId}::${suffix}`
19    this.scrollMap.set(key, position)
20  }
21
22  public getScroll(tabId: string, suffix: Suffix): number | undefined {
23    const key = `${tabId}::${suffix}`
24    return this.scrollMap.get(key)
25  }
26}
### Service with Container Injection
Some services require access to the `Container` object itself, typically for passing it to sub-classes or for dynamic binding:

>
Source: [packages/hoppscotch-common/src/services/secret-environment.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/secret-environment.service.ts#L1-L30)

typescript1import { Container, Service } from "dioc"
2import { reactive, computed, watch, nextTick } from "vue"
3
4export class SecretEnvironmentService extends Service {
5  public static readonly ID = "SECRET_ENVIRONMENT_SERVICE"
6
7  constructor(c: Container) {
8    super(c)
9    // Initialize the secret environments map
10    this.watchSecretEnvironments()
11  }
12
13  public secretEnvironments = reactive(new Map<string, SecretVariable[]>())
14
15  public addSecretEnvironment(id: string, secretVars: SecretVariable[]) {
16    this.secretEnvironments.set(id, secretVars)
17  }
18  // ...more methods...
19}
### Service with Event System
Services can define typed event systems for inter-service communication:

>
Source: [packages/hoppscotch-common/src/services/initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts#L18-L56)

typescript1type InitEvent =
2  | { type: "STORE_READY" }
3  | { type: "PERSISTENCE_FIRST_READY" }
4  | { type: "PERSISTENCE_LATER_READY" }
5  | { type: "TABS_READY" }
6  | { type: "NATIVE_KERNEL_NETWORKING_READY" }
7  | { type: "AUTH_READY" }
8  | { type: "BACKEND_CLIENT_READY" }
9  | { type: "SYNC_READY" }
10  | { type: "ALL_READY" }
11
12/**
13 * Service responsible for coordinating the initialization sequence.
14 */
15export class InitializationService extends Service<InitEvent> {
16  public static readonly ID = "INITIALIZATION_SERVICE"
17
18  private initState = {
19    store: false,
20    persistenceFirst: false,
21    // ...
22  }
23
24  private async initStore() {
25    const persistenceService = getService(PersistenceService)
26    const result = await persistenceService.init()
27    // ...
28    this.initState.store = true
29    this.emit({ type: "STORE_READY" })
30  }
31}
### Service with Lifecycle Hook
Services can implement `onServiceInit()` to perform post-construction initialization:

>
Source: [packages/hoppscotch-common/src/services/debug.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/debug.service.ts#L17-L47)

typescript1export class DebugService extends Service {
2  public static readonly ID = "DEBUG_SERVICE"
3
4  override onServiceInit() {
5    console.debug("DebugService is initialized...")
6
7    const container = this.getContainer()
8
9    // Log container events
10    container.getEventStream().subscribe((event) => {
11      if (event.type === "SERVICE_BIND") {
12        console.debug(
13          "[CONTAINER] Service Bind:",
14          event.bounderID ?? "<CONTAINER>",
15          "->",
16          event.boundeeID
17        )
18      } else if (event.type === "SERVICE_INIT") {
19        console.debug("[CONTAINER] Service Init:", event.serviceID)
20
21        // Expose the service globally for debugging
22        const service = container.getBoundServiceWithID(event.serviceID)
23        ;(window as any)[event.serviceID] = service
24      }
25    })
26  }
27}
### Platform-Provided Services
Services can also be provided by the platform definition, allowing platform-specific (e.g., web vs. desktop vs. self-hosted) implementations:

>
Source: [packages/hoppscotch-common/src/platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts#L23-L27)

typescript1export type PlatformDef = {
2  ui?: UIPlatformDef
3  addedHoppModules?: HoppModule[]
4  addedServices?: Array<ServiceClassInstance<unknown>>
5  auth: AuthPlatformDef
6  // ...
7}
These platform services are bound to the container during the `onVueAppInit` phase:

typescript1onVueAppInit(app) {
2  app.use(diocPlugin, { container: serviceContainer })
3
4  for (const service of platform.addedServices ?? []) {
5    serviceContainer.bind(service)
6  }
7}
## All Services in the Application
The following is a comprehensive list of services registered in the Hoppscotch codebase, demonstrating the breadth of the Dioc DI system:

### Core Infrastructure Services
Service IDClassResponsibility`INITIALIZATION_SERVICE``InitializationService`Coordinates app startup sequence`PERSISTENCE_SERVICE``PersistenceService`Manages state persistence via kernel store`DEBUG_SERVICE``DebugService`Development-only debugging utilities (DEV only)
### Tab Management Services
Service IDClassResponsibility`REST_TAB_SERVICE``RESTTabService`Manages REST API tabs (extends `TabService`)`GQL_TAB_SERVICE``GQLTabService`Manages GraphQL API tabs (extends `TabService`)
### Environment Services
Service IDClassResponsibility`SECRET_ENVIRONMENT_SERVICE``SecretEnvironmentService`Manages secret environment variables`CURRENT_VALUE_SERVICE``CurrentValueService`Manages current values of environment variables
### Network & Interceptor Services
Service IDClassResponsibility`KERNEL_INTERCEPTOR_SERVICE``KernelInterceptorService`Manages kernel interceptors for network requests`COOKIE_JAR_SERVICE``CookieJarService`Manages HTTP cookies
### UI & Display Services
Service IDClassResponsibility`SCROLL_SERVICE``ScrollService`Stores and restores scroll positions`BANNER_SERVICE``BannerService`Manages application banners (info/warning/error)`SPOTLIGHT_SERVICE``SpotlightService`Powers the command palette / spotlight search`UI_EXTENSION_SERVICE``UIExtensionService`Manages UI extensions`CONTEXT_MENU_SERVICE``ContextMenuService`Manages context menus`HISTORY_UI_PROVIDER_SERVICE``HistoryUIProviderService`Provides custom UI items for history`ADDITIONAL_LINKS_SERVICE``AdditionalLinksService`Manages additional navigation links
### Inspection Services
Service IDClassResponsibility`INSPECTION_SERVICE``InspectionService`Coordinates request/response inspection`RESPONSE_INSPECTOR_SERVICE``ResponseInspectorService`Inspects response data`SCRIPTING_INTERCEPTOR_INSPECTOR_SERVICE``ScriptingInterceptorInspectorService`Inspects scripting interceptor state
### Workspace & Collections
Service IDClassResponsibility`WORKSPACE_SERVICE``WorkspaceService`Manages workspace data (personal/team)`TEAM_COLLECTIONS_SERVICE``TeamCollectionsService`Manages team collections`DOCUMENTATION_SERVICE``DocumentationService`Manages request documentation`CURRENT_SORT_VALUES_SERVICE``CurrentSortValuesService`Manages sort preferences`TEAM_SEARCH_SERVICE``TeamsSearchService`Searches team requests
### Test Runner
Service IDClassResponsibility`TEST_RUNNER_SERVICE``TestRunnerService`Coordinates test execution
### OAuth
Service IDClassResponsibility`OAUTH_AUTH_SERVICE``OauthAuthService`Manages OAuth authentication flow
## Dependency Graph (Service-to-Service Relationships)
The following diagram illustrates how services depend on each other through Dioc's `this.bind()` mechanism:

加载图表中...
## Platform Service Registration
Platforms (e.g., self-hosted web, desktop) can extend the application with their own services. These are bound to the Dioc container during initialization.

### Kernel Interceptors as Services
Interceptors can be registered either as standalone objects or as Dioc services:

>
Source: [packages/hoppscotch-common/src/platform/kernel-interceptors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/kernel-interceptors.ts#L1-L19)

typescript1import { Container, ServiceClassInstance } from "dioc"
2import { KernelInterceptor } from "~/services/kernel-interceptor.service"
3
4export type KernelInterceptorDef =
5  | {
6      type: "standalone"
7      interceptor: KernelInterceptor
8    }
9  | {
10      type: "service"
11      service: ServiceClassInstance<unknown> & {
12        new (container: Container): KernelInterceptor
13      }
14    }
### Inspectors as Services
Platform-specific inspectors are also registered as Dioc services:

>
Source: [packages/hoppscotch-common/src/platform/inspectors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/inspectors.ts#L1-L15)

typescript1import { Container, ServiceClassInstance } from "dioc"
2import { Inspector } from "~/services/inspection"
3
4export type PlatformInspectorsDef = {
5  type: "service"
6  service: ServiceClassInstance<unknown> & {
7    new (c: Container): Inspector
8  }
9}
## Configuration Options
The Dioc integration in Hoppscotch has minimal configuration. The key configuration points are:

OptionTypeDefaultDescription`dioc` (npm package)string`"3.0.2"`Dioc library version used across packages`container` (Vue plugin)`Container``new Container()`The shared Dioc container instance`DebugService` bindingconditionalDevelopment onlyBound only when `import.meta.env.DEV` is true
### Package Dependencies
Dioc is declared in both the main app and the self-hosted web package:

>
Source: [packages/hoppscotch-common/package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/package.json#L65)

json1{
2  "dependencies": {
3    "dioc": "3.0.2"
4  }
5}
## API Reference
### `Service` Class (from `dioc`)
The base class that all Hoppscotch services extend.

**Constructor:**

typescript`constructor(container: Container)`
**Methods:**

- `bind<T extends ServiceClassInstance<any>>(service: T): InstanceType<T>` — Binds and returns a dependency service singleton.
- `getContainer(): Container` — Returns the parent container instance.
- `getEventStream(): Observable<ServiceEvent>` — Returns the event stream for this service.
- `onServiceInit(): void` — Lifecycle hook called after service construction and all dependency bindings are complete.
- `emit(event: TEvent): void` — Emits an event through the service's event stream (available when extending `Service<TEvent>`).

### `Container` Class (from `dioc`)
The central dependency injection container.

**Methods:**

- `bind<T extends ServiceClassInstance<any>>(service: T): InstanceType<T>` — Resolves a service singleton. Creates if not yet bound, returns existing instance otherwise.
- `getBoundServiceWithID(id: string): Service | undefined` — Returns the service instance with the given ID.
- `getBoundServices(): Map<string, Service>` — Returns all currently bound services.
- `getEventStream(): Observable<ContainerEvent>` — Returns the container's event stream for monitoring service binding and initialization.

### `getService()` Function (from `~/modules/dioc`)
typescriptexport function getService<T extends ServiceClassInstance<any>>(
  service: T
): InstanceType<T>
**Note:** This is deprecated. Use `useService()` in Vue components or `this.bind()` within services instead.

### `useService()` Function (from `dioc/vue`)
typescriptfunction useService<T extends ServiceClassInstance<any>>(
  service: T
): InstanceType<T>
Vue composition API function that injects a service from the container. Must be called within a Vue component's `setup()` context.

## Related Links

- **Source: Dioc Module** — [packages/hoppscotch-common/src/modules/dioc.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/dioc.ts)
- **Source: Module System** — [packages/hoppscotch-common/src/modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts)
- **Source: Platform Definition** — [packages/hoppscotch-common/src/platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)
- **Source: App Bootstrap** — [packages/hoppscotch-common/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/index.ts)
- **Source: Initialization Service** — [packages/hoppscotch-common/src/services/initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts)
- **Source: Debug Service** — [packages/hoppscotch-common/src/services/debug.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/debug.service.ts)
- **Source: Scroll Service** — [packages/hoppscotch-common/src/services/scroll.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/scroll.service.ts)
- **Dioc Library** — [https://github.com/hoppscotch/dioc](https://github.com/hoppscotch/dioc)
- **Related: Architecture Overview** — [./3-architecture](./3-architecture)
- **Related: Module System** — [./3-architecture.1-module-system](./3-architecture.1-module-system)