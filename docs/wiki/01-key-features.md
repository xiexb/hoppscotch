# Key Features
Hoppscotch is an open-source API development ecosystem that provides a comprehensive set of tools for designing, testing, documenting, and collaborating on APIs. This document details the key features that make Hoppscotch a powerful platform for API development.

## Overview
Hoppscotch is built as a multi-platform API development environment supporting REST, GraphQL, WebSocket, Server-Sent Events (SSE), Socket.IO, and MQTT protocols. It offers a lightweight, fast, and feature-rich interface for developers to create, test, and manage API requests. The application is designed as a Progressive Web App (PWA) with cloud synchronization, team collaboration, and comprehensive scripting capabilities.

The platform's architecture follows a modular design pattern with a platform abstraction layer, allowing it to run across web, desktop (Tauri-based), and self-hosted environments while sharing a common codebase.

## Architecture
The following diagram illustrates the high-level architecture of Hoppscotch and how its key feature modules relate to each other.

加载图表中...
The platform abstraction layer (`PlatformDef`) enables Hoppscotch to run consistently across different environments. Each platform (web, desktop, self-hosted) implements interfaces for auth, sync, collections, environments, history, and settings.

>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)

## Application Initialization Flow
Hoppscotch has a carefully orchestrated startup sequence managed by the `InitializationService`, which coordinates all feature subsystems to load in the correct order.

加载图表中...
>
Source: [initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts)

## Protocol Support
Hoppscotch supports multiple API protocols, each with a dedicated interface optimized for that protocol's specific interaction patterns.

加载图表中...
### REST API Client
The REST client supports the full range of HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, CONNECT, OPTIONS, TRACE, and custom methods). Requests can be configured with headers, query parameters, request body (with multiple content types including JSON, FormData, and binary), and authentication.

The default request configuration initializes with a convenient echo endpoint:

>
Source: [helpers/rest/default.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/default.ts)

typescript1export const getDefaultRESTRequest = (): HoppRESTRequest => ({
2  v: RESTReqSchemaVersion,
3  endpoint: "https://echo.hoppscotch.io",
4  name: "Untitled",
5  params: [],
6  headers: [],
7  method: "GET",
8  auth: {
9    authType: "inherit",
10    authActive: true,
11  },
12  preRequestScript: "",
13  testScript: "",
14  body: {
15    contentType: null,
16    body: null,
17  },
18  requestVariables: [],
19  responses: {},
20})
>
Source: [helpers/rest/default.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/default.ts#L3-L21)

### GraphQL Client
The GraphQL client provides a comprehensive interface for working with GraphQL APIs, including schema exploration, multi-column documentation viewer, and query building. It uses a dedicated tab service (`GQLTabService`) that manages GraphQL-specific request documents and persists query state across sessions.

>
Source: [services/tab/graphql.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/graphql.ts)

### Realtime Protocols
Hoppscotch supports WebSocket, SSE (Server-Sent Events), Socket.IO, and MQTT protocols through a unified realtime communication interface. The `Communication.vue` component provides message sending, event filtering, and connection management for all realtime protocols.

>
Source: [components/realtime/Communication.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/realtime/Communication.vue)

## Authentication & Authorization
Hoppscotch supports multiple authentication modes for both the application itself and for API requests.

### App Authentication
Users can sign in using multiple providers, managed through the platform's auth abstraction (`AuthPlatformDef`):

typescript1export type AuthPlatformDef = {
2  signInWithEmail: (email: string) => Promise<void>
3  signInUserWithGoogle: () => Promise<void>
4  signInUserWithGithub: () => Promise<GithubSignInResult> | Promise<undefined>
5  signInUserWithMicrosoft: () => Promise<void>
6  // ... plus methods for token management, session handling, etc.
7}
>
Source: [platform/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/auth.ts)

The auth system emits events that other subsystems can react to:

typescript1export type AuthEvent =
2  | { event: "probable_login"; user: HoppUser }
3  | { event: "login"; user: HoppUser }
4  | { event: "logout" }
5  | { event: "token_refresh"; user: HoppUser }
>
Source: [platform/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/auth.ts#L37-L41)

### Request Authentication
For API requests, Hoppscotch supports:

- **None** - No authentication
- **Basic Auth** - Username/password
- **Bearer Token** - Single token value
- **OAuth 2.0** - Authorization code, Client credentials, Implicit, and Password flows
- **OIDC Access Token/PKCE** - OpenID Connect
- **API Key** - Custom header/query parameter
- **AWS Signature** - AWS v4 signing
- **Digest Auth** - HTTP Digest authentication
- **Hawk** - Hawk authentication scheme
- **JWT Bearer** - JSON Web Token

OAuth 2.0 generates appropriate authorization headers:

>
Source: [helpers/auth/types/oauth2.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/oauth2.ts)

typescript1export async function generateOAuth2AuthHeaders(
2  auth: HoppRESTAuth & { authType: "oauth-2" },
3  envVars: Environment["variables"],
4  showKeyIfSecret = false
5): Promise<HoppRESTHeader[]> {
6  if (auth.addTo !== "HEADERS") return []
7  const token = parseTemplateString(auth.grantTypeInfo.token, envVars, false, showKeyIfSecret)
8  return [
9    {
10      active: true,
11      key: "Authorization",
12      value: `Bearer ${token}`,
13      description: "",
14    },
15  ]
16}
>
Source: [helpers/auth/types/oauth2.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/oauth2.ts#L9-L31)

## Collections & Workspaces
### Collections
Collections allow you to organize API requests hierarchically. The collection system supports:

- Nested folders for hierarchical organization
- Collection-level variables, headers, and authentication (with inheritance)
- Pre-request scripts and test scripts at both collection and request levels
- Import and export (including GitHub Gist integration)
- Team-shared collections with synchronization

The collection data structure includes rich metadata:

typescript1export type CollectionDataProps = {
2  auth: HoppRESTAuth
3  headers: HoppRESTHeaders
4  variables: HoppCollectionVariable[]
5  description: string | null
6  preRequestScript: string
7  testScript: string
8}
>
Source: [helpers/backend/helpers.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/helpers.ts#L38-L45)

### Workspaces
Workspaces enable you to organize collections and environments into separate contexts. The `WorkspaceService` manages two workspace types:

typescript1export type PersonalWorkspace = {
2  type: "personal"
3}
4
5export type TeamWorkspace = {
6  type: "team"
7  teamID: string
8  teamName: string
9  role: TeamAccessRole | null | undefined
10}
11
12export type Workspace = PersonalWorkspace | TeamWorkspace
>
Source: [services/workspace.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/workspace.service.ts#L16-L27)

## Scripting (Pre-Request & Test Scripts)
Hoppscotch supports JavaScript scripting at two lifecycle points:

加载图表中...
Scripts benefit from intelligent code completion through dedicated completers:

>
Source: [helpers/editor/completion/preRequest.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/completion/preRequest.ts)

>
Source: [helpers/editor/completion/testScript.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/completion/testScript.ts)

## Environment Variables
The environment system allows you to define variables that can be referenced in requests using template syntax. Variables support three levels of hierarchy:

Request Variables (highest priority) → Selected Environment → Global Environment

Template strings are parsed and resolved at request time:

>
Source: [helpers/auth/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/index.ts)

typescript1export const replaceTemplateStringsInObjectValues = <T extends Record<string, unknown>>(
2  obj: T,
3  source: "REST" | "GQL" = "REST"
4) => {
5  const envs = getCombinedEnvVariables()
6  // ... resolves variables in order of priority
7  const envVars = [...selectedEnvVars, ...globalEnvVars, ...requestVariables]
8  for (const key in obj) {
9    const val = obj[key]
10    if (typeof val === "string") {
11      const parseResult = parseTemplateStringE(val, envVars)
12      newObj[key] = E.isRight(parseResult)
13        ? (parseResult.right as T[typeof key])
14        : (val as T[typeof key])
15    }
16  }
17  return newObj as T
18}
>
Source: [helpers/auth/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/index.ts#L7-L58)

## Mock Servers
Hoppscotch provides mock server functionality that allows you to create simulated API endpoints from collections. The `useMockServerStatus` composable checks whether a collection has an associated mock server:

>
Source: [composables/mockServer.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/mockServer.ts)

typescript1export function useMockServerStatus() {
2  const mockServers = useReadonlyStream(mockServers$, [])
3
4  const getMockServerForCollection = (collectionId: string): MockServer | null => {
5    return (
6      mockServers.value.find(
7        (server) =>
8          server.collection?.id === collectionId ||
9          server.collectionID === collectionId
10      ) || null
11    )
12  }
13
14  const hasActiveMockServer = (collectionId: string): boolean => {
15    const mockServer = getMockServerForCollection(collectionId)
16    return mockServer?.isActive === true
17  }
18
19  const hasMockServer = (collectionId: string): boolean => {
20    return getMockServerForCollection(collectionId) !== null
21  }
22  // ...
23}
>
Source: [composables/mockServer.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/mockServer.ts#L9-L63)

## Real-time Data Synchronization
Hoppscotch synchronizes data across devices through the backend GraphQL API. The sync platform handles four data categories:

Sync CategoryDescriptionCollectionsTeam collections and personal collectionsEnvironmentsGlobal and selected environmentsHistoryRequest historySettingsApplication preferences
The sync initialization happens after authentication is confirmed:

>
Source: [services/initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts#L133-L147)

typescript1private async initSync() {
2  if (!this.initState.auth) {
3    throw new Error("Cannot initialize remaining services before auth")
4  }
5  await Promise.all([
6    platform.sync.settings.initSettingsSync(),
7    platform.sync.collections.initCollectionsSync(),
8    platform.sync.history.initHistorySync(),
9    platform.sync.environments.initEnvironmentsSync(),
10    platform.analytics?.initAnalytics(),
11  ])
12  this.emit({ type: "SYNC_READY" })
13}
>
Source: [services/initialization.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/initialization.service.ts#L133-L147)

## Progressive Web App (PWA)
Hoppscotch is designed as a Progressive Web App with full offline capabilities. The PWA features include:

- Instant loading through Service Workers
- Offline support for previously loaded resources
- Low memory and CPU footprint
- Add to Home Screen for native-like experience
- Desktop PWA support

The PWA update mechanism notifies users when a new version is available:

>
Source: [composables/pwa.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/pwa.ts)

typescript1export const usePwaPrompt = function () {
2  const toast = useToast()
3  const t = useI18n()
4
5  watch(pwaNeedsRefresh, (value) => {
6    if (value) showUpdateToast()
7  }, { immediate: true })
8
9  function showUpdateToast() {
10    toast.show(`${t("app.new_version_found")}`, {
11      position: "bottom-center",
12      duration: 0,
13      action: [
14        { text: `${t("action.dismiss")}`, onClick: (_, toastObject) => toastObject.goAway(0) },
15        { text: `${t("app.reload")}`, onClick: (_, toastObject) => {
16          toastObject.goAway(0)
17          refreshAppForPWAUpdate()
18        }},
19      ],
20    })
21  }
22}
>
Source: [composables/pwa.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/pwa.ts#L6-L42)

## Theming & Customization
Hoppscotch offers extensive UI customization through its theming system:

- **Color modes**: System preference, Light, Dark, and Black
- **Accent colors**: Green, Teal, Blue, Indigo, Purple, Yellow, Orange, Red, and Pink
- **Distraction-free Zen mode**
- Themes are synced with cloud/local session

## Proxy & CORS Support
Hoppscotch provides proxy functionality to overcome CORS restrictions when testing APIs from the browser. The proxy system integrates with the kernel interceptor architecture, allowing for:

- Browser extension-based interception
- Native/desktop interceptor (bypasses CORS entirely)
- Hoppscotch Agent for standalone proxy
- Custom proxy URL support

## Keyboard Shortcuts
The application is optimized for keyboard-driven workflows with comprehensive shortcuts managed by the keybinding system. Shortcuts are configurable and context-aware.

>
Source: [helpers/keybindings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/keybindings.ts)

## Internationalization (i18n)
Hoppscotch supports multiple languages through Vue I18n integration. The translation function is available throughout the app:

>
Source: [composables/i18n.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/i18n.ts)

typescript1import { useI18n as _useI18n } from "vue-i18n"
2
3export function useI18n() {
4  return _useI18n().t
5}
>
Source: [composables/i18n.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/i18n.ts#L1-L5)

## AI Experiments
Hoppscotch includes experimental AI features for enhancing developer productivity, such as automatic request name generation. These features are gated behind a settings flag and require an active user session.

>
Source: [composables/ai-experiments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/ai-experiments.ts)

## Add-ons & Ecosystem
Hoppscotch provides official add-ons that extend its capabilities:

- **[Hoppscotch CLI](https://github.com/hoppscotch/hoppscotch/tree/main/packages/hoppscotch-cli)** - Command-line interface for automated API testing
- **[Proxy](https://github.com/hoppscotch/proxyscotch)** - Proxy server for bypassing CORS
- **[Browser Extensions](https://github.com/hoppscotch/hoppscotch-extension)** - Chrome and Firefox extensions for enhanced CORS handling

## Configuration Options
The settings system uses a reactive store (`settingsStore`) that synchronizes with the persistence layer. Key configuration options include:

Setting KeyTypeDefaultDescription`theme`string`"system"`Color theme preference (system/light/dark/black)`accentColor`string`"green"`UI accent color`ENABLE_AI_EXPERIMENTS`boolean`false`Enable AI-powered features`AI_REQUEST_NAMING_STYLE`string`"CONCISE"`AI naming style preference`telemetry`boolean`true`Share anonymous usage dataProxy settingsobject—Proxy URL and mode configuration
Settings are accessed via the `useSetting` composable:

>
Source: [composables/settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/settings.ts)

typescript1export function useSetting<K extends keyof SettingsDef>(
2  settingKey: K
3): Ref<SettingsDef[K]> {
4  return useStream(
5    settingsStore.subject$.pipe(pluck(settingKey), distinctUntilChanged()),
6    settingsStore.value[settingKey],
7    (value: SettingsDef[K]) => {
8      settingsStore.dispatch({
9        dispatcher: "applySetting",
10        payload: { settingKey, value },
11      })
12    }
13  )
14}
>
Source: [composables/settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/settings.ts#L6-L24)

## Feature Summary
加载图表中...
## Related Links

- [Overview](./1-overview.1-overview) - Introduction to Hoppscotch
- [Getting Started](./2-getting-started.1-installation) - Installation and setup guide
- [REST API Client](../2-getting-started/2-rest-api-client) - Working with REST APIs
- [GraphQL Support](./2-getting-started/3-graphql-support) - GraphQL API testing
- [Collections & Workspaces](../3-core-concepts/1-collections) - Organizing your API requests
- [Environment Variables](../3-core-concepts/2-environments) - Managing variables
- [Authentication](../3-core-concepts/3-authentication) - Auth methods
- [Real-time APIs](../3-core-concepts/4-realtime) - WebSocket, SSE, MQTT, Socket.IO
- [Source Repository](https://github.com/xiexb/hoppscotch) - GitHub repository
- [Official Documentation](https://docs.hoppscotch.io) - Full Hoppscotch documentation