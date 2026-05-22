# Request Builder
The Request Builder is the core interface in Hoppscotch for constructing, configuring, and sending HTTP API requests. It provides a comprehensive tab-based UI for managing request parameters, headers, body content, authorization, scripts, and variables.

## Overview
The Request Builder serves as the primary workspace for making HTTP requests in Hoppscotch. It is built around two key concepts:

- **Tab Document System**: Each open request is represented as a `HoppTabDocument` managed by the `RESTTabService`, enabling multi-tab workflows with persistence and state management.
- **Versioned Data Model**: The `HoppRESTRequest` type uses a versioned schema system (v0 to v17) with Zod validation, ensuring backward compatibility as the data model evolves.

The Request Builder supports both REST API and GraphQL API interactions. This documentation focuses on the REST Request Builder, which provides the most comprehensive set of features.

### Key Capabilities

- **HTTP Method & URL**: Select from standard HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.) or enter custom methods, with URL auto-complete from history
- **Request Parameters**: Add query parameters with key-value pairs, supporting bulk editing mode and drag-and-drop reordering
- **Request Headers**: Manage HTTP headers with auto-complete for common headers, bulk editing, and drag-and-drop support
- **Request Body**: Support for multiple content types — none, JSON, XML, form-data (multipart), URL-encoded, binary (octet-stream), HTML, and plain text
- **Authorization**: Built-in support for 10+ authentication types including None, Inherit, Basic Auth, Bearer Token, API Key, OAuth 2.0, Digest, Hawk, AWS Signature, JWT, Akamai EdgeGrid, NTLM, and ASAP
- **Pre-request Scripts**: Execute JavaScript before request sending for dynamic request transformations
- **Post-request Tests**: Write JavaScript tests that run after receiving responses for API validation
- **Request Variables**: Define scoped variables for use within the request
- **Inherited Properties**: Support for inheriting authentication, headers, variables, and scripts from parent collections

## Architecture
The Request Builder architecture follows a layered component model with clear separation between data models, state management, and UI components.

加载图表中...
### Component Responsibilities
LayerComponentResponsibility**Data**`HoppRESTRequest`Versioned schema defining the complete request structure (endpoint, method, headers, body, auth, scripts, variables)**Data**`HoppRESTReqBody`Union type supporting 6 content type variants (null, multipart, binary, URL-encoded, JSON, XML, HTML, plain text)**Data**`HoppRESTAuth`Discriminated union supporting 11+ authentication types with `authActive` flag**State**`RESTTabService`Manages tab lifecycle — creation, ordering, MRU tracking, persistence loading/saving**State**`HoppRequestDocument`Runtime wrapper around `HoppRESTRequest` with dirty tracking, save context, and response data**UI**`Request.vue`Top-level URL bar with method selector dropdown, URL input with environment variable auto-complete, and send button**UI**`RequestOptions.vue`Tabbed interface hosting all request configuration panels (params, body, headers, auth, scripts, variables)
## Data Model
The `HoppRESTRequest` is the central data structure representing an HTTP request configuration. It uses a versioned schema system powered by `verzod` and `zod` for validation and migration.

### Core Schema (Latest Version 17)
>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L80-L113)

typescript1export const HoppRESTRequest = createVersionedEntity({
2  latestVersion: 17,
3  versionMap: {
4    0: V0_VERSION,
5    1: V1_VERSION,
6    2: V2_VERSION,
7    // ... intermediate versions ...
8    17: V17_VERSION,
9  },
10  getVersion(data) {
11    const versionCheck = versionedObject.safeParse(data)
12    if (versionCheck.success) return versionCheck.data.v
13    const result = V0_VERSION.schema.safeParse(data)
14    return result.success ? 0 : null
15  },
16})
### Request Structure (Default)
>
Source: [default.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/default.ts#L3-L22)

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
### Body Content Types
>
Source: [v/10/body.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/10/body.ts#L4-L38)

typescript1export const HoppRESTReqBody = z.union([
2  z.object({
3    contentType: z.literal(null),
4    body: z.literal(null).catch(null),
5  }),
6  z.object({
7    contentType: z.literal("multipart/form-data"),
8    body: z.array(FormDataKeyValue).catch([]),
9    showIndividualContentType: z.boolean().optional().catch(false),
10    isBulkEditing: z.boolean().optional().catch(false),
11  }),
12  z.object({
13    contentType: z.literal("application/octet-stream"),
14    body: z.instanceof(File).nullable().catch(null),
15  }),
16  z.object({
17    contentType: z.literal("application/x-www-form-urlencoded"),
18    body: z.string().catch(""),
19    isBulkEditing: z.boolean().optional().catch(false),
20  }),
21  z.object({
22    contentType: z.union([
23      z.literal("application/json"),
24      z.literal("application/ld+json"),
25      z.literal("application/hal+json"),
26      z.literal("application/vnd.api+json"),
27      z.literal("application/xml"),
28      z.literal("text/xml"),
29      z.literal("binary"),
30      z.literal("text/html"),
31      z.literal("text/plain"),
32    ]),
33    body: z.string().catch(""),
34  }),
35])
### Version Migration Mechanism
Each version is defined as a separate module with an `up()` function that migrates data from the previous version. For example, version 17 adds the `description` field:

>
Source: [rest/v/17.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/17.ts#L1-L20)

typescript1export const V17_SCHEMA = V16_SCHEMA.extend({
2  v: z.literal("17"),
3  description: z.string().nullable().catch(null),
4})
5
6const V17_VERSION = defineVersion({
7  schema: V17_SCHEMA,
8  initial: false,
9  up(old: z.infer<typeof V16_SCHEMA>) {
10    return {
11      ...old,
12      v: "17" as const,
13      description: null,
14    }
15  },
16})
### Authorization Types
The auth system uses a discriminated union pattern supporting multiple auth mechanisms:

>
Source: [rest/v/15/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/15/auth.ts#L72-L90)

typescript1export const HoppRESTAuth = z
2  .discriminatedUnion("authType", [
3    HoppRESTAuthNone,
4    HoppRESTAuthInherit,
5    HoppRESTAuthBasic,
6    HoppRESTAuthBearer,
7    HoppRESTAuthOAuth2,
8    HoppRESTAuthAPIKey,
9    HoppRESTAuthAWSSignature,
10    HoppRESTAuthDigest,
11    HoppRESTAuthHAWK,
12    HoppRESTAuthAkamaiEdgeGrid,
13    HoppRESTAuthJWT,
14  ])
15  .and(
16    z.object({
17      authActive: z.boolean(),
18    })
19  )
## Core Flow
The following sequence diagram illustrates the request lifecycle from UI interaction to execution:

加载图表中...
## Tab Document System
The tab system is the backbone of the request builder's multi-tab workflow.

### HoppRequestDocument
>
Source: [helpers/rest/document.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/document.ts#L191-L246)

typescript1export type HoppRequestDocument = {
2  type: "request"
3  request: HoppRESTRequest
4  isDirty: boolean
5  saveContext?: HoppRESTSaveContext
6  response?: HoppRESTResponse | null
7  testResults?: HoppTestResult | null
8  responseTabPreference?: string
9  optionTabPreference?: RESTOptionTabs
10  inheritedProperties?: HoppInheritedProperty
11  cancelFunction?: () => void
12}
### RESTTabService
>
Source: [services/tab/rest.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/rest.ts#L10-L111)

typescript1export class RESTTabService extends TabService<HoppTabDocument> {
2  public static readonly ID = "REST_TAB_SERVICE"
3
4  constructor(c: Container) {
5    super(c)
6    // Initialize with a default test tab
7    this.tabMap.set("test", {
8      id: "test",
9      document: {
10        type: "request",
11        request: getDefaultRESTRequest(),
12        isDirty: false,
13        optionTabPreference: "params",
14      },
15    })
16    this.watchCurrentTabID()
17  }
18
19  // Strip response data from persisted state
20  public override persistableTabState = computed(() => ({
21    lastActiveTabID: this.currentTabID.value,
22    orderedDocs: this.tabOrdering.value.map((tabID) => {
23      const tab = this.tabMap.get(tabID)!
24      if (tab.document.type === "example-response") {
25        return { tabID: tab.id, doc: tab.document }
26      }
27      return {
28        tabID: tab.id,
29        doc: { ...tab.document, response: null },
30      }
31    }),
32  }))
33}
## UI Components
### Request Tab Layout (RequestTab.vue)
The `RequestTab.vue` component orchestrates the primary (request builder) and secondary (response viewer) panels:

>
Source: [components/http/RequestTab.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/RequestTab.vue#L1-L54)

vue1<template>
2  <AppPaneLayout layout-id="rest-primary">
3    <template #primary>
4      <HttpRequest v-model="tab" />
5      <HttpRequestOptions
6        v-model="tab.document.request"
7        v-model:option-tab="tab.document.optionTabPreference!"
8        v-model:inherited-properties="tab.document.inheritedProperties"
9      />
10    </template>
11    <template #secondary>
12      <HttpResponse
13        v-model:document="tab.document"
14        :tab-id="tab.id"
15        :is-embed="false"
16      />
17    </template>
18  </AppPaneLayout>
19</template>
20
21<script setup lang="ts">
22import { watch } from "vue"
23import { cloneDeep } from "lodash-es"
24import { isEqualHoppRESTRequest } from "@hoppscotch/data"
25
26// Dirty check: watch for request changes to mark as unsaved
27let oldRequest = cloneDeep(tab.value.document.request)
28watch(
29  () => tab.value.document.request,
30  (updatedValue) => {
31    if (!tab.value.document.isDirty && !isEqualHoppRESTRequest(oldRequest, updatedValue)) {
32      tab.value.document.isDirty = true
33    }
34    oldRequest = cloneDeep(updatedValue)
35  },
36  { deep: true }
37)
38</script>
### Request Options Tabs
The `RequestOptions.vue` component displays all configuration tabs:

>
Source: [components/http/RequestOptions.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/RequestOptions.vue#L1-L96)

The available option tabs are:

Tab IDComponentPurpose`params``HttpParameters`Query parameters editor with key-value pairs, bulk mode, drag-and-drop`bodyParams``HttpBody`Request body editor with content type selection`headers``HttpHeaders`HTTP headers editor with auto-complete for common headers`authorization``HttpAuthorization`Authentication type selector with type-specific configuration`preRequestScript``HttpPreRequestScript`JavaScript editor for pre-request scripting`tests``HttpTests`JavaScript editor for post-request testing`requestVariables``HttpRequestVariables`Request-scoped variable definitions
Each tab intelligently shows/hides based on the request data. For example, the pre-request script tab dynamically shows based on whether the request has the `preRequestScript` property or if inherited scripts exist:

typescript1const showPreRequestScriptTab = computed(() => {
2  return (
3    props.properties?.includes("preRequestScript") ??
4    "preRequestScript" in request.value
5  )
6})
### Request URL Bar (Request.vue)
The `Request.vue` component provides the HTTP method selector and URL input with environment variable auto-complete support:

>
Source: [components/http/Request.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Request.vue#L1-L68)

Key features:

- Method selector dropdown with color-coded HTTP methods
- Custom method input support
- URL input with `SmartEnvInput` for environment variable interpolation
- Auto-complete from request history
- URL paste detection for quick request import
- Send/Cancel button with keyboard shortcut support

## Usage Examples
### Creating a New REST Request Programmatically
>
Source: [helpers/rest/default.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/default.ts#L1-L22)
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L252-L276)

typescript1import { makeRESTRequest, getDefaultRESTRequest } from "@hoppscotch/data"
2
3// Get a default request
4const defaultReq = getDefaultRESTRequest()
5// {
6//   v: "17",
7//   endpoint: "https://echo.hoppscotch.io",
8//   name: "Untitled",
9//   method: "GET",
10//   params: [],
11//   headers: [],
12//   auth: { authType: "inherit", authActive: true },
13//   preRequestScript: "",
14//   testScript: "",
15//   body: { contentType: null, body: null },
16//   requestVariables: [],
17//   responses: {},
18//   _ref_id: "req_...",
19// }
20
21// Create a custom request
22const customReq = makeRESTRequest({
23  endpoint: "https://api.example.com/users",
24  name: "Get Users",
25  method: "GET",
26  params: [{ key: "limit", value: "10", active: true }],
27  headers: [
28    { key: "Authorization", value: "Bearer {{token}}", active: true },
29  ],
30  auth: { authType: "inherit", authActive: true },
31  preRequestScript: "",
32  testScript: "",
33  body: { contentType: null, body: null },
34  requestVariables: [],
35  responses: {},
36})
### Comparing Two Requests for Equality
>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L118-L152)

typescript1import { isEqualHoppRESTRequest } from "@hoppscotch/data"
2
3const req1 = getDefaultRESTRequest()
4const req2 = getDefaultRESTRequest()
5
6// Returns true when structurally equal
7// Filters out empty keys/values before comparison
8if (isEqualHoppRESTRequest(req1, req2)) {
9  console.log("Requests are identical")
10}
## Configuration Options
### Request Schema Version History
VersionKey Changes0Initial schema with basic URL, headers, params, body, auth1Introduced structured body types (JSON, form-data, etc.)2Added `requestVariables` array7Added AWS Signature auth, standardized params/headers with `description` field10Added octet-stream (file) body type, `isBulkEditing` and `showIndividualContentType` flags15Added OAuth 2.0 advanced parameters (auth request, token request, refresh request params)16Added `_ref_id` for request reference tracking17Added `description` field for request documentation
### Inherited Properties
>
Source: [helpers/types/HoppInheritedProperties.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/types/HoppInheritedProperties.ts#L1-L32)

PropertyTypeDescription`auth``{ parentID, parentName, inheritedAuth }`Inherited authorization from parent collection`headers``{ parentID, parentName, inheritedHeader }[]`Inherited headers from parent collection`variables``{ parentID, parentName, inheritedVariables }[]`Inherited collection variables`scripts``{ parentID, parentName, preRequestScript, testScript }[]`Inherited pre-request and test scripts
## API Reference
### `getDefaultRESTRequest(): HoppRESTRequest`
Creates a new REST request with default values pointing to the Hoppscotch echo server.

**Returns:** A complete `HoppRESTRequest` with safe defaults for all fields.

>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L252-L276)

### `makeRESTRequest(x: Omit<HoppRESTRequest, "v">): HoppRESTRequest`
Creates a REST request from partial data, auto-generating `_ref_id` and setting the schema version to the latest.

**Parameters:**

- `x` — Request data without the `v` version field

**Returns:** A complete `HoppRESTRequest` with version and ref ID filled in.

>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L242-L250)

### `isEqualHoppRESTRequest(a: HoppRESTRequest, b: HoppRESTRequest): boolean`
Deeply compares two requests for equality, filtering out empty keys/values from headers, params, and request variables.

**Returns:** `true` if the requests are structurally equal.

>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L118-L152)

### `HoppRESTRequest.safeParse(data: unknown): Result<HoppRESTRequest>`
Validates and parses an unknown value against the versioned request schema, automatically migrating from older versions.

**Returns:** A Result type with either the parsed request or validation errors.

### `RESTTabService.createNewTab(document: HoppTabDocument, switchToIt?: boolean): HoppTab<HoppTabDocument>`
Creates a new tab with the given document and optionally switches to it.

**Parameters:**

- `document` — The tab document to open
- `switchToIt` (default: `true`) — Whether to immediately switch to the new tab

>
Source: [services/tab/tab.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/tab.ts#L79-L94)

### `RESTOptionTabs` Type
typescript1export type RESTOptionTabs =
2  | "params"
3  | "bodyParams"
4  | "headers"
5  | "authorization"
6  | "preRequestScript"
7  | "tests"
8  | "requestVariables"
>
Source: [components/http/RequestOptions.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/RequestOptions.vue#L111-L121)

## Related Links

- [REST API Client Overview](./4-rest-api-client)
- [Collections and Organization](../4-rest-api-client/2-collections)
- [Environment Variables](../4-rest-api-client/3-environment-variables)
- [Response Viewer](../4-rest-api-client/4-response-viewer)
- [Source: HoppRESTRequest Data Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts)
- [Source: RESTTabService](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/rest.ts)
- [Source: Request Options Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/RequestOptions.vue)
- [Source: Request Document Types](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/document.ts)
- [Source: Default Request Factory](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/rest/default.ts)
- [Source: Tab Service Base](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/tab.ts)