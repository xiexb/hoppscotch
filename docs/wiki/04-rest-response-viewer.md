# Response Viewer
The Response Viewer is the core component in Hoppscotch responsible for displaying API responses in a structured, interactive, and content-aware manner. It handles both REST and GraphQL responses, rendering them through a plugin-based lens system that adapts to the response content type, and provides rich functionality for inspecting, saving, copying, and downloading response data.

## Overview
The Response Viewer is designed to be a **universal response display system** that adapts to whatever type of API response is received. Its purpose is to present response data in the most meaningful format for the developer, enabling rapid debugging and analysis.

Key design principles of the Response Viewer:

- **Content-Type Awareness**: The lens system intelligently detects the response content type and offers appropriate visualization options (JSON tree viewer, raw text, image preview, HTML rendering, PDF viewer, audio/video players, etc.)
- **Unified State Handling**: The viewer handles all possible response states — loading, success, failure (HTTP errors), network errors, script execution errors, and extension errors — presenting appropriate UI for each
- **Tab-based Exploration**: Response data is organized into tabs for body content (via lenses), response headers, test results, request headers, and a script console
- **Seamless REST/GraphQL Coverage**: Separate but architecturally consistent implementations serve REST API and GraphQL response viewing needs
- **Save-as-Example**: Allows saving successful responses as reusable examples within the request collection

## Architecture
The Response Viewer follows a layered architecture with clear separation of concerns:

加载图表中...
### Core Architecture
The Response Viewer is built around four main structural components:

-
**Response Meta** — Displays status code, response time, and response size at the top of the viewer. It handles all loading/error states, providing contextual UI such as spinner for loading, placeholder images for network errors, and stack traces for script failures.

-
**Response Body Renderer** — A tab-based container that selects the appropriate lens renderer based on the response's content type. It also provides tabs for response headers, test results (when available), request headers, and a script console for debugging.

-
**Lens System** — A plugin-based rendering architecture where each lens defines a content-type detection method and an async-loaded Vue component renderer. Lenses are ordered by specificity and the system intelligently selects the best lens for the response.

-
**Response Utilities** — Composable functions that provide cross-cutting functionality such as copy-to-clipboard, file download, HTML content preview in an iframe, and response body text extraction.

## Response State Machine
The response viewer handles all possible states of an API request lifecycle:

加载图表中...
## Core Components
### HttpResponse.vue (REST Response Viewer)
The main REST API response viewer orchestrates metadata display, body rendering, and the save-as-example flow. It accepts a `HoppRequestDocument` as input and reacts to changes in the response state.

>
Source: [HttpResponse.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Response.vue)

The component performs three key tasks:

- Computes whether a response exists (`hasResponse`) by checking for `success` or `fail` types
- Determines loading state by checking both response type (`loading`) and test results (`null`)
- Handles the save-as-example flow, constructing a `HoppRESTRequestResponse` object and persisting it to the collection

### HttpResponseMeta.vue (Response Metadata Bar)
This component displays the response status bar, which includes:

- **Status code & reason phrase** (color-coded by status group)
- **Response time** in milliseconds
- **Response size** formatted in human-readable units (B, KB, MB)

>
Source: [HttpResponseMeta.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ResponseMeta.vue)

The metadata bar also integrates with the **Inspection Service** to show contextual alerts about the response (e.g., 401 Unauthorized, 404 Not Found, network errors).

typescript1// Example: Reading response metrics from the meta object
2const readableResponseSize = computed(() => {
3  // Formats response size to human-readable format
4  if (size >= 100000) return (size / 1000000).toFixed(2) + " MB"
5  if (size >= 1000) return (size / 1000).toFixed(2) + " KB"
6  return undefined // Returns undefined if size < 1KB (no conversion needed)
7})
>
Source: [ResponseMeta.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ResponseMeta.vue#L170-L188)

### ResponseBodyRenderer.vue (Tab-based Body Viewer)
The body renderer is the central organizing component for response content display. It presents a tabbed interface with:

>
Source: [ResponseBodyRenderer.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/lenses/ResponseBodyRenderer.vue)

TabConditionContent**Lens Tabs**Always present (auto-selected from valid lenses)Body content rendered via the most appropriate lens**Headers**`response.type === 'success'` or `'fail'`Response headers with count badge**Test Results**`response.type !== 'network_fail'` and not editableTest assertion results with indicator**Request Headers**Test runner mode onlyOriginal request headers**Console**`testResults.consoleEntries.length > 0` and sandbox enabledScript console output (log, warn, error, etc.)
The component watches the `validLenses` computed property and maintains a `responseTabPreference` to remember the user's last selected tab.

## Lens System
The lens system is a plugin-based rendering architecture that provides content-type-aware response body visualization:

加载图表中...
### Lens Definition
Each lens is defined by a `Lens` interface:

typescript1export type Lens = {
2  lensName: string              // i18n translation key for the tab label
3  isSupportedContentType: (contentType: string) => boolean  // Detection function
4  renderer: string              // Unique renderer identifier
5  rendererImport: ReturnType<typeof defineAsyncComponent>   // Async-loaded component
6}
>
Source: [lenses.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/lenses/lenses.ts#L12-L17)

### Available Lenses
LensContent-Type PatternRenderer IDJSON`application/json`, `application/*+json``json`RawAlways matches (universal fallback)`raw`Image`image/gif`, `image/jpeg`, `image/png`, `image/webp`, `image/bmp`, `image/svg+xml`, `image/x-icon``imageres`HTML`text/html`, `application/xhtml+xml``htmlres`XMLAny content-type containing `xml``xmlres`PDF`application/pdf``pdfres`Audio`audio/wav`, `audio/mpeg`, `audio/mp4`, `audio/ogg`, etc.`audiores`Video`video/webm`, `video/mp4`, `video/quicktime`, `video/x-flv`, etc.`videores`
### Smart Lens Selection Logic
The lens selection algorithm (`getSuitableLenses`) implements an intelligent fallback strategy:

- **Error responses** (loading, network_fail, script_fail, etc.) return an empty array — no body to render
- **Content-type based matching** — filters lenses based on the response's `Content-Type` header
- **Text-based content enhancement** — for text/* and certain application/* types, if the body can be parsed as valid JSON, the JSON lens is added as an additional option
- **Fallback to all lenses** — if no lens matches the content type, all lenses are offered, giving the user full control
- **Raw lens always included** — the raw text renderer is always appended to ensure users can always view the unprocessed response

>
Source: [lenses.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/lenses/lenses.ts#L30-L99)

## REST Response Data Types
The `HoppRESTResponse` union type defines all possible response states:

>
Source: [HoppRESTResponse.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/types/HoppRESTResponse.ts)

typescript1export type HoppRESTResponse =
2  | HoppRESTLoadingResponse     // { type: "loading" } - Request in flight
3  | HoppRESTSuccessResponse     // { type: "success" } - Successful HTTP response (2xx/3xx)
4  | HoppRESTFailureResponse     // { type: "failure" } - HTTP error response (4xx/5xx)
5  | HoppRESTFailureNetwork      // { type: "network_fail" } - Network connectivity error
6  | HoppRESTFailureScript       // { type: "script_fail" } - Pre/post-request script error
7  | HoppRESTFailureExtension    // { type: "extension_error" } - Browser extension error
8  | HoppRESTFailureInterceptor  // { type: "interceptor_error" } - Interceptor error
### Response Transform Layer
When a response arrives from the kernel (the underlying networking layer), it is transformed into the appropriate Hoppscotch response type:

>
Source: [kernel/rest/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/response.ts#L72-L100)

typescript1export const RESTResponse = {
2  async toResponse(
3    response: RelayResponse,
4    originalRequest: HoppRESTRequest
5  ): Promise<HoppRESTSuccessResponse | HoppRESTTransformError> {
6    if (!response.body.body || !(response.body.body instanceof Uint8Array)) {
7      return {
8        type: "fail",
9        error: {
10          type: "transform_error",
11          message: "Invalid response body format",
12        },
13      }
14    }
15    return {
16      type: "success",
17      headers: processHeaders(response.headers),
18      body: response.body.body.buffer,
19      statusCode: response.status,
20      statusText: response.statusText ?? "",
21      meta: {
22        responseSize: extractSize(response),
23        responseDuration: extractTiming(response),
24      },
25      req: originalRequest,
26    }
27  },
28}
The transform also handles a special case for `Set-Cookie` headers, which can be concatenated across multiple header entries. The `processHeaders` function splits them back into individual header entries:

>
Source: [kernel/rest/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/response.ts#L47-L70)

## GraphQL Response Viewer
The GraphQL response viewer is a separate but architecturally parallel implementation:

>
Source: [GraphqlResponse.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/graphql/Response.vue)

Key differences from the REST viewer:

- Accepts `GQLResponseEvent[]` (an array of events to support subscriptions with multiple responses)
- Renders response body using CodeMirror with JSON mode (read-only)
- Supports **subscription log view** when multiple responses are received
- Provides line-wrapping toggle and download/copy actions via keyboard shortcuts
- Integrates with the **response data schema generation** feature

## Core Flow (REST Request Response Lifecycle)
加载图表中...
## Save Response as Example
The Response Viewer allows saving successful responses as examples in the request collection. This is useful for documenting expected API behavior.

>
Source: [Response.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Response.vue#L79-L168)

The save flow:

- User triggers "Save as Example" from a lens renderer
- `HttpSaveResponseName` modal appears, pre-filled with the request name
- It checks for name collisions (`hasSameNameResponse`) and shows a warning if a response with the same name already exists
- On submit, it constructs a `HoppRESTRequestResponse` containing the status text, status code, headers, body text, and the original request
- It persists the response either locally (`editRESTRequest` for user collections) or remotely (GraphQL mutation for team collections)

>
Source: [SaveResponseName.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/SaveResponseName.vue)

## Response Data Schema Generation
The **ResponseInterface.vue** component (accessible via the "Generate Data Schema" action) provides functionality to convert JSON response bodies into type definitions for various programming languages:

>
Source: [ResponseInterface.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ResponseInterface.vue)

Supported target languages include TypeScript, JavaScript, Rust, Go, C#, Python, Java, Swift, Kotlin, and others via the `interfaceLanguages` configuration. The component:

- Extracts the current tab's response body (REST or GraphQL)
- Converts JSON to language-specific type definitions using `jsonToLanguage`
- Renders the output in a read-only CodeMirror editor
- Provides copy and download functionality

## Response Inspections
The `ResponseInspectorService` automatically checks responses for common issues and presents alerts in the user interface:

>
Source: [response.inspector.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/response.inspector.ts)

typescript1// Key inspection logic
2getInspections(_req, res) {
3  return computed(() => {
4    const results: InspectorResult[] = []
5    if (!res.value) return results
6
7    const hasErrors =
8      res && (res.value.type !== "success" || res.value.statusCode !== 200)
9
10    let text: string | undefined = undefined
11
12    if (res.value.type === "network_fail" && !navigator.onLine) {
13      text = this.t("inspections.response.network_error")
14    } else if (res.value.type === "fail") {
15      text = this.t("inspections.response.default_error")
16    } else if (res.value.type === "success" && res.value.statusCode === 404) {
17      text = this.t("inspections.response.404_error")
18    } else if (res.value.type === "success" && res.value.statusCode === 401) {
19      text = this.t("inspections.response.401_error")
20    }
21
22    if (hasErrors && text) {
23      results.push({
24        id: "url",
25        icon: markRaw(IconAlertTriangle),
26        text: { type: "text", text },
27        severity: 2,
28        isApplicable: true,
29        locations: { type: "response" },
30      })
31    }
32    return results
33  })
34}
## Response Spotlight Searcher
The `ResponseSpotlightSearcherService` provides quick action shortcuts in the Spotlight search interface:

>
Source: [response.searcher.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/spotlight/searchers/response.searcher.ts)

ActionIDKeyboard TriggerCopy Response`response.copy``Ctrl/Cmd + .`Download Response`response.file.download``Ctrl/Cmd + J`Generate Data Schema`response.schema.toggle`Via menu
## Utility Composables
### useResponseBody
Extracts a text representation from a response body, handling both `ArrayBuffer` and `string` types:

>
Source: [lens-actions.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/lens-actions.ts#L160-L181)

typescript1export function getResponseBodyText(body: ArrayBuffer | string): string {
2  if (typeof body === "string") return body
3  const res = new TextDecoder("utf-8").decode(body)
4  // HACK: Temporary trailing null character issue from the extension fix
5  return res.replace(/\0+$/, "")
6}
### useCopyResponse
Copies the response body text to the clipboard with visual feedback.

>
Source: [lens-actions.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/lens-actions.ts#L37-L53)

### useDownloadResponse
Downloads the response body as a file using the platform's native save dialog.

>
Source: [lens-actions.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/lens-actions.ts#L57-L88)

### usePreview
Provides an HTML preview feature that renders HTML responses inside an iframe, injecting `<base>` tags to resolve relative URLs.

>
Source: [lens-actions.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/lens-actions.ts#L90-L158)

## Configuration Options
Setting KeyScopeDescription`WRAP_LINES` (under `codeGen`)Code generationToggles line wrapping in the generated data schema view`WRAP_LINES` (under `graphqlResponseBody`)GraphQL responseToggles line wrapping in the GraphQL response body view`EXPERIMENTAL_SCRIPTING_SANDBOX`ScriptingEnables the script sandbox, which shows the Console tab in response viewer
## Related Links

- [REST API Client](./4-rest-api-client.1-rest-api-client)
- [Request Builder](./4-rest-api-client.3-request-builder)
- [GraphQL API Client](./5-graphql-api-client.1-graphql-api-client)
- [Test Runner](./4-rest-api-client.4-test-runner)
- [Source: HttpResponse.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Response.vue)
- [Source: ResponseBodyRenderer.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/lenses/ResponseBodyRenderer.vue)
- [Source: Lens System](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/lenses/lenses.ts)
- [Source: HoppRESTResponse Types](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/types/HoppRESTResponse.ts)
- [Source: REST Response Transform](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/rest/response.ts)
- [Source: Response Inspector](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/response.inspector.ts)
- [Source: Lens Actions Composables](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/lens-actions.ts)
- [Source: Response Spotlight Searcher](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/spotlight/searchers/response.searcher.ts)
- [Source: GraphQL Response](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/graphql/Response.vue)
- [Source: Response Interface](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ResponseInterface.vue)