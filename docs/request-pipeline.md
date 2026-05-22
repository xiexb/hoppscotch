# Hoppscotch REST Request Pipeline

Full data flow from user clicking Send to response display.

## Pipeline Stages

### 1. HoppRESTRequest (UI Config)
**Type**: `HoppRESTRequest` (from `hoppscotch-data/src/rest/index.ts`)
**Where**: The reactive `doc.value.request` object in Vue components

Environment variables are NOT resolved. Auth is a config object, not injected headers.
Headers are `HoppRESTHeaders` (array of `{key, value, active, description}`).

### 2. EffectiveHoppRESTRequest
**Type**: `EffectiveHoppRESTRequest` (from `helpers/utils/EffectiveURL.ts`)
**Where**: Created by `getEffectiveRESTRequest()` in `RequestRunner.ts`

Transformation:
1. Resolves `<<env_var>>` placeholders via `parseTemplateString()`
2. Injects auth-generated headers (Authorization: Bearer xxx) via `getComputedHeaders()`
3. Injects body-generated headers (Content-Type) via `getComputedBodyHeaders()`
4. Filters to `active: true` only
5. Converts path params to env vars so they override same-named env vars

### 3. RelayRequest (Kernel) — THE WIRE-FORMAT DATUM
**Type**: `RelayRequest` (from `@hoppscotch/kernel`)
**Where**: `RESTRequest.toRequest()` in `kernel/rest/request.ts`

```ts
interface RelayRequest {
  id: number
  url: string                    // effectiveFinalURL (resolved, path params substituted)
  method: Method                 // uppercase string
  version: "HTTP/1.1"
  headers: Record<string, string>  // effectiveFinalHeaders as flat Record
  params: Record<string, string>   // effectiveFinalParams (includes auth-injected params)
  content?: ContentType            // serialized body
  auth?: AuthType
}
```

**ContentType union** (from `@hoppscotch/kernel`):
```ts
type ContentType =
  | { kind: "text"; content: string; mediaType: string }
  | { kind: "json"; content: unknown; mediaType: string }
  | { kind: "xml"; content: string; mediaType: string }
  | { kind: "form"; content: FormData; mediaType: string }
  | { kind: "multipart"; content: FormData; mediaType: string }
  | { kind: "binary"; content: Uint8Array; mediaType: string; filename?: string }
  | { kind: "urlencoded"; content: string; mediaType: string }
  | { kind: "stream"; content: ReadableStream; mediaType: string }
```

**IMPORTANT**: `RelayRequest.headers` contains ONLY application-level headers (user-configured + auth-injected + body-content-type). Browser transport headers (User-Agent, Accept, Origin, Sec-*) are NOT here — they're added by the browser's fetch/XHR layer after kernel dispatch.

### 4. Network Dispatch (Capture Point)
**Where**: `network.ts` → `createRESTNetworkRequestStream()`

```ts
const execResult = RESTRequest.toRequest(req).then((kernelRequest) => {
  // CAPTURE POINT: RelayRequest is available here, BEFORE service.execute()
  const actualSent = relayRequestToActualSent(kernelRequest)
  const result = service.execute(kernelRequest)
  result.response.then(async (res) => {
    if (res._tag === "Right") {
      const processedRes = await RESTResponse.toResponse(res.right, req)
      if (processedRes.type === "success") {
        response.next({ ...processedRes, actualSentRequest: actualSent })
      }
    }
    response.complete()
  })
  return result
})
```

### 5. HoppRESTResponse

```ts
type HoppRESTSuccessResponse = {
  type: "success"
  headers: HoppRESTResponseHeader[]
  body: ArrayBuffer
  statusCode: number; statusText: string
  meta: { responseSize: number; responseDuration: number }
  req: HoppRESTRequest              // ORIGINAL UI config, NOT wire request!
  actualSentRequest?: ActualSentRequest  // wire-level data captured above
}
```

---

## Variable Resolution: `<<variable>>` Syntax

The regex `REGEX_ENV_VAR = /<<([^>]*)>>/g` in `packages/hoppscotch-data/src/environment/index.ts`
**only matches `<<variable>>` (double angle brackets), NOT `{{variable}}` (double curly braces).**

Both `parseTemplateString()` (URL/headers/params resolution) and `parseBodyEnvVariables()` (body resolution) share this regex. SmartEnvInput converts `{{variable}}` to `<<variable>>` internally before storage, but manually typed `{{variable}}` will NEVER resolve.

---

## Key Takeaways

1. **Never use `response.req` for "what was actually sent"** — it's the unresolved UI config. Use `response.actualSentRequest`.
2. **Capture wire data in `network.ts`** between `RESTRequest.toRequest()` and `service.execute()`.
3. **`filterActiveParams()`** returns `[string, string][]`, NOT `Record<string, string>`. Always check `Array.isArray()`.
4. **Query params** are NOT in `RelayRequest.url`. Compute: `fullURL = url + "?" + encodeParams(params)`.
5. **Variable syntax**: ONLY `<<variable>>` resolves. `{{variable}}` does NOT.
6. **Adding a response tab** requires: HoppSmartTab in template, computed property, validRenderers registration, and auto-imported renderer.
7. **i18n keys**: `request.parameter_list` (NOT `query_params`), `request.authorization` (NOT `authorization.label`).
