# Module System
The Hoppscotch Module System provides a plugin-like architecture for organizing application initialization logic across distinct, independently manageable units called "modules." Each module implements lifecycle hooks that are automatically discovered and executed during app bootstrapping.

## Overview
The Module System is the backbone of Hoppscotch's application initialization pipeline. Rather than hardcoding startup logic in a monolithic bootstrap file, the system leverages **file-convention-based auto-discovery** — any `.ts` file placed in the `modules/` directory is automatically loaded and its default export (which must conform to the `HoppModule` interface) is registered.

This architecture offers several key benefits:

- **Separation of concerns** — Each module owns a specific responsibility (routing, i18n, theming, PWA, etc.)
- **Lifecycle-driven execution** — Modules declare *when* they need to run via typed lifecycle hooks
- **Platform extensibility** — Platform definitions (web, desktop, selfhost) can inject additional modules or services without modifying core code
- **Built-in deprecation** — Modules can be marked `deprecated` and are automatically filtered out
- **Framework-agnostic core** — The `HoppModule` interface depends only on Vue's `App` type and Vue Router's types, keeping module boundaries clean

## Architecture
### Core Module System Components
加载图表中...
### Module Lifecycle Flow
The diagram below illustrates the precise order in which lifecycle hooks are called during application startup and navigation:

加载图表中...
## The HoppModule Interface
Every module is an object conforming to the `HoppModule` type. All hooks are optional — a module only needs to define the hooks relevant to its purpose.

typescript1export type HoppModule = {
2  /**
3   * Optional flag to mark a module as deprecated.
4   * Deprecated modules will be filtered out during initialization.
5   */
6  deprecated?: boolean
7
8  /**
9   * Define this function to get access to Vue App instance and augment
10   * it (installing components, directives and plugins). Also useful for
11   * early generic initializations. This function should be called first
12   */
13  onVueAppInit?: (app: App) => void
14
15  /**
16   * Called when the router is done initializing.
17   * Used if a module requires access to the router instance
18   */
19  onRouterInit?: (app: App, router: Router) => void
20
21  /**
22   * Called when the root component (App.vue) is running setup.
23   * This function is generally called last in the lifecycle.
24   * This function executes with a component setup context, so you can
25   * run composables within this and it should just be scoped to the
26   * root component
27   */
28  onRootSetup?: () => void
29
30  /**
31   * Called by the router to tell all the modules before a route navigation
32   * is made.
33   */
34  onBeforeRouteChange?: (
35    to: RouteLocationNormalized,
36    from: RouteLocationNormalized,
37    router: Router
38  ) => void | Promise<void>
39
40  /**
41   * Called by the router to tell all the modules that a route navigation has completed
42   */
43  onAfterRouteChange?: (to: RouteLocationNormalized, router: Router) => void
44}
>
Source: [packages/hoppscotch-common/src/modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts#L6-L49)

### Hook Execution Order
OrderHookResponsibilityCalled From1`onVueAppInit`Install Vue plugins, directives, components; early init`createHoppApp()` before mount2`onBeforeRouteChange`Intercept route transitions (guards, analytics)Vue Router `beforeEach` guard3`onAfterRouteChange`Post-navigation tasks (progress completion, page views)Vue Router `afterEach` hook4`onRouterInit`Access the initialized router instanceRouter module after `app.use(router)`5`onRootSetup`Composables that need component setup contextRoot App.vue `setup()` lifecycle
## Module Discovery
Modules are auto-discovered using Vite's `import.meta.glob` feature with the `eager: true` option, which ensures synchronous loading. The pattern `@modules/*.ts` matches all TypeScript files in the `modules/` directory.

typescript1/**
2 * All the modules Hoppscotch loads into the app
3 */
4export const HOPP_MODULES = pipe(
5  import.meta.glob("@modules/*.ts", { eager: true }),
6  Object.values,
7  A.map(({ default: defaultVal }) => defaultVal as HoppModule),
8  A.filter((module) => !module.deprecated)
9)
>
Source: [packages/hoppscotch-common/src/modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts#L54-L59)

**Key design decisions:**

- **Eager loading** — Modules are loaded synchronously at bundle time, ensuring all hooks are available before app initialization
- **Default export convention** — Each module file must use `export default <HoppModule>{ ... }` as its default export
- **Deprecation filter** — Modules with `deprecated: true` are excluded, enabling gradual migration without breaking changes
- **fp-ts `pipe`** — Functional programming utilities from `fp-ts` provide a clean chain of transformations (extract → cast → filter)

## Built-in Modules
The `@hoppscotch/common` package ships with 14 modules, each handling a distinct concern:

ModuleFilePrimary Hook(s)Purpose**router**`router.ts``onVueAppInit`Creates Vue Router, sets up navigation guards, notifies other modules of route changes**dioc**`dioc.ts``onVueAppInit`Initializes the dependency injection container (`dioc`), registers services**i18n**`i18n.ts``onVueAppInit`, `onBeforeRouteChange`Initializes `vue-i18n`, resolves user locale, handles legacy path-based locale migration**theming**`theming.ts``onVueAppInit`Applies color mode (light/dark/system) and accent color to the DOM**toast**`toast.ts``onVueAppInit`Installs the Vue Toasted notification plugin**loadingbar**`loadingbar.ts``onVueAppInit`, `onBeforeRouteChange`, `onAfterRouteChange`Configures NProgress bar, shows/hides on route transitions**head**`head.ts``onVueAppInit`, `onRootSetup`Initializes `@unhead/vue`, sets document title template**tippy**`tippy.ts``onVueAppInit`Registers custom `v-tippy` tooltip directive with vue-tippy**ui**`ui.ts``onVueAppInit`Installs `@hoppscotch/ui` component library with i18n and keybinding support**pwa**`pwa.ts``onVueAppInit`, `onRootSetup`Registers service worker, handles PWA install prompts and update notifications**v-focus**`v-focus.ts``onVueAppInit`Declares a `v-focus` directive for auto-focusing elements on mount**whats-new**`whats-new.ts``onRootSetup`Shows "What's New" dialog on app launch**kernel-interceptors**`kernel-interceptors.ts``onVueAppInit`Registers and syncs kernel interceptors (request/response interceptors)**filter***(deprecated modules are filtered)*—Deprecated modules are automatically excluded
## Platform Extension Mechanism
The module system supports platform-specific extensions through `PlatformDef`. This allows different deployment targets (web, desktop, selfhost) to inject their own modules and services without modifying the core.

typescript1export type PlatformDef = {
2  // ...
3  addedHoppModules?: HoppModule[]       // Extra modules for this platform
4  addedServices?: Array<ServiceClassInstance<unknown>> // Services to register in DI
5  // ...
6}
>
Source: [packages/hoppscotch-common/src/platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts#L23-L78)

Platform-added modules are invoked alongside core modules at every lifecycle stage:

typescript1// Core modules
2HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app))
3
4// Platform extensions
5platformDef.addedHoppModules?.forEach((mod) => mod.onVueAppInit?.(app))
>
Source: [packages/hoppscotch-common/src/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/index.ts#L65-L66)

## Usage Examples
### Creating a Simple Module
Below is a minimal module that logs app initialization:

typescript1import { HoppModule } from "."
2
3export default <HoppModule>{
4  onVueAppInit(app) {
5    console.log("App initialized with version:", app.version)
6  },
7}
>
Source: Pattern derived from [packages/hoppscotch-common/src/modules/v-focus.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/v-focus.ts#L1-L15)

### Module with Route Change Tracking
This example demonstrates a module that responds to navigation events — tracking page visits and showing a progress bar:

typescript1import { HoppModule } from "."
2import NProgress from "nprogress"
3
4export default <HoppModule>{
5  onVueAppInit() {
6    NProgress.configure({ showSpinner: false })
7  },
8  onBeforeRouteChange(to, from) {
9    // Show progressbar on page change
10    if (to.path !== from.path) {
11      startPageProgress(500)
12    }
13  },
14  onAfterRouteChange() {
15    completePageProgress()
16  },
17}
>
Source: [packages/hoppscotch-common/src/modules/loadingbar.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/loadingbar.ts#L1-L56)

### Dependency Injection Module
The DI module demonstrates how to integrate a service container (using `dioc`) into the app:

typescript1import { HoppModule } from "."
2import { Container, ServiceClassInstance } from "dioc"
3import { diocPlugin } from "dioc/vue"
4import { platform } from "~/platform"
5
6const serviceContainer = new Container()
7
8/**
9 * Gets a service from the app service container.
10 */
11export function getService<T extends ServiceClassInstance<any>>(
12  service: T
13): InstanceType<T> {
14  return serviceContainer.bind(service)
15}
16
17export default <HoppModule>{
18  onVueAppInit(app) {
19    app.use(diocPlugin, {
20      container: serviceContainer,
21    })
22
23    for (const service of platform.addedServices ?? []) {
24      serviceContainer.bind(service)
25    }
26  },
27}
>
Source: [packages/hoppscotch-common/src/modules/dioc.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/dioc.ts#L1-L41)

### Internationalization Module (Complex Example)
The i18n module showcases a more complex module that handles async initialization, locale resolution, and legacy URL migration:

typescript1import { HoppModule } from "."
2import { createI18n, I18nOptions } from "vue-i18n"
3import { PersistenceService } from "~/services/persistence"
4import { getService } from "./dioc"
5import FALLBACK_LANG_MESSAGES from "../../locales/en.json"
6
7const LOCALES = import.meta.glob("../../locales/*.json")
8const persistenceService = getService(PersistenceService)
9
10const resolveCurrentLocale = async () => {
11  const savedLocale = await persistenceService.getLocalConfig("locale")
12  if (savedLocale) return savedLocale
13
14  const browserLang = navigator.language
15  const matched = APP_LANGUAGES.find(({ code }) =>
16    browserLang.startsWith(code)
17  )
18  return matched?.code ?? "en"
19}
20
21export default <HoppModule>{
22  async onVueAppInit(app) {
23    const i18n = createI18n({
24      locale: "en",
25      fallbackLocale: "en",
26      legacy: false,
27      allowComposition: true,
28      messages: { en: FALLBACK_LANG_MESSAGES },
29    })
30
31    app.use(i18n)
32
33    const currentLocale = await resolveCurrentLocale()
34    changeAppLanguage(currentLocale)
35  },
36  onBeforeRouteChange(to, _, router) {
37    // Convert old locale path format (/fr/...) to new format
38    const oldLocalePathLangCode = APP_LANG_CODES.find((langCode) =>
39      to.path.startsWith(`/${langCode}/`)
40    )
41    if (oldLocalePathLangCode) {
42      changeAppLanguage(oldLocalePathLangCode)
43      router.replace(to.path.substring(`/${oldLocalePathLangCode}`.length))
44    }
45  },
46}
>
Source: [packages/hoppscotch-common/src/modules/i18n.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/i18n.ts#L193-L231)

### Platform-Specific Modules (Admin Console)
The admin console (`hoppscotch-sh-admin`) demonstrates a separate application with its own module system, including a router guard module that handles authentication and onboarding:

typescript1import { auth } from '~/helpers/auth';
2import { UNAUTHORIZED } from '~/helpers/errors';
3import { HoppModule } from '.';
4
5export default <HoppModule>{
6  async onBeforeRouteChange(to, _from, next) {
7    const onboardingStatus = await auth.getOnboardingStatus();
8
9    if (
10      !onboardingStatus?.onboardingCompleted &&
11      to.name !== 'onboarding' &&
12      to.name === 'index'
13    ) {
14      return next({ name: 'onboarding' });
15    }
16
17    const res = await auth.getUserDetails();
18    const isAdmin = res.data?.me.isAdmin;
19
20    if (!isGuestRoute(to.name) && !isAdmin) {
21      return next({ name: 'index' });
22    }
23
24    next();
25  },
26};
>
Source: [packages/hoppscotch-sh-admin/src/modules/admin.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/src/modules/admin.ts#L1-L106)

## The Router Module — Coordination Hub
The router module is unique in that it acts as a **coordination hub** — it not only creates the Vue Router instance but also **invokes other modules' route hooks**. This creates a publish-subscribe pattern within the module system.

加载图表中...
The router module's `onVueAppInit` hook:

- Creates the Vue Router with auto-generated routes from file system (via `vite-plugin-pages`)
- Sets up a `beforeEach` guard that calls every module's `onBeforeRouteChange`
- Sets up an `afterEach` hook that calls every module's `onAfterRouteChange`
- Calls every module's `onRouterInit` after `app.use(router)`

## The Kernel System Integration
The module system works alongside the `@hoppscotch/kernel` system, which provides platform-abstracted APIs (I/O, relay, store, log) that modules can consume. The `kernel-interceptors` module bridges these two systems by syncing interceptor configuration between the kernel and the settings store.

typescript1function setupInterceptorSync(service: KernelInterceptorService): void {
2  // Watch service changes → apply to settings
3  watch(
4    () => service.current.value?.id,
5    (id) => {
6      applySetting("CURRENT_KERNEL_INTERCEPTOR_ID",
7        id ?? platform.kernelInterceptors.default)
8    }
9  )
10
11  // Watch settings changes → apply to service
12  const [setting] = useSettingStatic("CURRENT_KERNEL_INTERCEPTOR_ID")
13  watch(setting, () => {
14    service.setActive(setting.value ?? platform.kernelInterceptors.default)
15  }, { immediate: true })
16}
>
Source: [packages/hoppscotch-common/src/modules/kernel-interceptors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts#L1-L68)

## Related Links

- [Architecture Overview](../3-architecture.1-overview)
- [Kernel System](3-architecture.2-kernel-system)
- [Service Layer & DI (dioc)](3-architecture.4-service-layer)
- [Platform Definitions](3-architecture.5-platform-definitions)

### Source Files Reference
FileDescription[modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/index.ts)Core `HoppModule` type definition and module discovery[modules/router.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/router.ts)Router module (orchestrator for route hooks)[modules/dioc.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/dioc.ts)Dependency injection module[modules/i18n.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/i18n.ts)Internationalization module[modules/theming.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/theming.ts)Color mode & accent theming[modules/loadingbar.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/loadingbar.ts)Navigation progress bar[modules/head.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/head.ts)Document head management[modules/pwa.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/pwa.ts)PWA installation & update handling[modules/tippy.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/tippy.ts)Tooltip directive[modules/ui.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/ui.ts)Hoppscotch UI component library[modules/v-focus.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/v-focus.ts)Auto-focus directive[modules/whats-new.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/whats-new.ts)What's New dialog[modules/kernel-interceptors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/kernel-interceptors.ts)Kernel interceptor bridge[modules/toast.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/toast.ts)Toast notification plugin[platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)Platform definition type with module extensions[index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/index.ts)Application bootstrap with module initialization[hoppscotch-sh-admin/src/modules/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/src/modules/index.ts)Admin console module system (separate app instance)