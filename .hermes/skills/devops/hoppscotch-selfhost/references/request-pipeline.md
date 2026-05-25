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
**Where**: Created by `getEffectiveRESTRequest()` in `RequestRunner.ts` lines 576/876

Transformation (order matters):
1. Resolves `<<env_var>>` placeholders via `parseTemplateString(str, envVars)` — envVars ONLY, never pathParams
2. Replaces `{path_param}` templates via `replacePathParams(str, pathParamsList)` — applied to URL, headers, params, requestVariables, AND body
3. Injects auth-generated headers (Authorization: Bearer xxx) via `getComputedHeaders()`
4. Injects body-generated headers (Content-Type) via `getComputedBodyHeaders()`
5. Filters to `active: true` only

**CRITICAL**: `<<var>>` and `{var}` are STRICTLY SEPARATE resolution mechanisms:
- `parseTemplateString()` resolves `<<var>>` from `environment.variables` ONLY
- `replacePathParams()` resolves `{var}` from `request.pathParams` ONLY
- Even if names collide, there is NO crossover. `<<userId>>` always uses env var, `{userId}` always uses pathParam.
- Body must also go through `replacePathParams()` for string-type bodies (JSON, XML, text)

**Path param regex precision**: Both `REGEX_PATH_PARAM` (in EffectiveURL.ts) and
`HOPP_PATH_PARAM_REGEX` (in environment-regex.ts) use `[a-zA-Z0-9_.-]+` — NOT `[^}]+`.
The broad regex matches JSON braces like `{"key": "value"}`, causing false template
detection warnings and incorrect replacement attempts in body content.

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
const service = getService(KernelInterceptorService)
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

## relayRequestToActualSent() Conversion Function

Defined in `helpers/types/HoppRESTResponse.ts`. Converts kernel `RelayRequest` → display-ready `ActualSentRequest`:

```ts
export type ActualSentRequest = {
  method: string
  url: string
  headers: {
    user: [string, string][]
    system: [string, string][]
  }
  params: [string, string][]
  body: string | null
  bodyMediaType: string | null
}

export function relayRequestToActualSent(
  req: RelayRequest,
  userHeaders: [string, string][] = [],
  systemHeaders: [string, string][] = []
): ActualSentRequest {
  // body extracted from req.content (ContentType union)
  // headers classified into user vs system by classifyHeaders()
}
```

---

## Variable Resolution: `<<variable>>` Syntax Pitfalls

**CRITICAL**: The regex `REGEX_ENV_VAR = /<<([^>]*)>>/g` in `packages/hoppscotch-data/src/environment/index.ts` **only matches `<<variable>>` (double angle brackets), NOT `{{variable}}` (double curly braces).**

Both `parseTemplateString()` (URL/headers/params resolution) and `parseBodyEnvVariables()` (body resolution) share this same regex. SmartEnvInput converts `{{variable}}` to `<<variable>>` internally before storage, but manually typed `{{variable}}` will NEVER resolve.

Additionally, both parsers require `"currentValue" in variable` to be true on the env var object. If `getTransformedEnvs()` doesn't populate `currentValue` (e.g., v1 variables with only `value`), the template key is returned as-is (for `parseBodyEnvVariablesE`) or replaced with empty string (for `parseTemplateStringE` when `showKeyIfNotFound=false`).

**Symptom**: "Actual Request" tab shows templates like `<<userId>>` instead of resolved values like `123`.
**Cause**: Either wrong syntax (`{{}}` instead of `<<>>`) or env vars missing `currentValue`.
**This is correct behavior** — the tab shows what the kernel actually received. If the kernel got unresolved templates, that's what you see.

**Debugging**: Add `console.log` in `network.ts` at the `relayRequestToActualSent()` capture point to inspect `kernelRequest.url` and `kernelRequest.headers` — these are the final resolved values the kernel dispatches.

## Unresolved Template Detection

`ActualRequestRenderer.vue` checks for unresolved templates in the actual sent request data:
- `ENV_TEMPLATE_RE = /<<[^>]*>>/g` — detects unresolvable `<<var>>`
- `PATH_PARAM_RE = /\{[a-zA-Z0-9_.-]+\}/g` — detects unresolvable `{var}` (precise regex, won't match JSON)

If either pattern is found in URL, params, headers, or body, a yellow warning banner is shown:
"Unresolved templates detected: <<variable>> = environment variable, {variable} = path parameter. Configure before sending."

**Common false positive (FIXED)**: Previously `PATH_PARAM_RE` used `[^}]+` which matched JSON braces
like `{"key": "value"}`, triggering the warning on every request with a JSON body. The precise
`[a-zA-Z0-9_.-]+` character class avoids this.

**Another false positive (FIXED)**: Previously `effectiveFinalBody` was not passed through
`replacePathParams()`, so `{var}` in body content was never resolved, always triggering the warning.

## Visual Display Format

The "Actual Request" tab displays in a **structured section format**, not raw HTTP dump:

- **URL section**: `request.url` i18n key, METHOD badge (color-coded), full resolved URL
- **Header section**: `request.header_list` i18n key, Name/Value table with monospace font
  - User headers (expanded by default) vs System headers (collapsible)
  - Host header sorted first in system headers
- **Body section**: `request.body` i18n key with optional `contentMediaType`, pretty-printed JSON, scrollable when large
- Unresolved template warning: yellow banner below URL if `<<var>>` or `{var}` detected

## Key Takeaways

1. **Never use `response.req` for "what was actually sent"** — it's the unresolved UI config. Use `response.actualSentRequest`.
2. **Capture wire data in `network.ts`** between `RESTRequest.toRequest()` and `service.execute()`. The `RelayRequest` is the authoritative source.
3. **`response.req` is typed `HoppRESTRequest` but actually `EffectiveHoppRESTRequest`** — has `effectiveFinalHeaders` etc. as extra properties.
4. **For body display**, extract from `RelayRequest.content` (kernel ContentType union), not from `HoppRESTReqBody`.
5. **Variable syntax**: ONLY `<<variable>>` resolves as env var. `{variable}` resolves as path param. They are STRICTLY SEPARATE — no crossover even when names collide.
6. **Body also gets `replacePathParams()`** — string-type bodies (JSON/XML/text) have `{var}` resolved from pathParams.
7. **Path param regex must use `[a-zA-Z0-9_.-]+`** — broad `[^}]+` matches JSON braces causing false warnings.
8. **i18n keys**: `request.parameter_list` (NOT `query_params`), `request.authorization` (NOT `authorization.label`).
