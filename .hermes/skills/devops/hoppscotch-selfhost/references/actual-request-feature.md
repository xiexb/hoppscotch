# Actual Request Feature — Complete Implementation Guide

Adds an "Actual Request" tab to the REST response area showing the **actual HTTP
request sent over the wire** (kernel `RelayRequest`), not the UI-configured
`HoppRESTRequest`.

## Data Pipeline

```
HoppRESTRequest           ← UI config (unresolved env vars, auth config object)
       ↓ getEffectiveRESTRequest()
EffectiveHoppRESTRequest  ← env vars resolved, auth headers/params injected
       ↓ RESTRequest.toRequest()
RelayRequest (kernel)     ← url, method, headers(Record), params(Record), content(ContentType)
       ↓ ← CAPTURE HERE in network.ts
       ↓ service.execute()
   ── NETWORK ──
       ↓ RESTResponse.toResponse()
HoppRESTResponse          ← response.req gets HoppRESTRequest (NOT RelayRequest!)
```

## Files Modified

### 1. `helpers/types/HoppRESTResponse.ts`
- Add `ActualSentRequest` type: `{method, url, headers:Record<string,string>, params:[string,string][], body:string|null, bodyMediaType:string|null}`
- Add `relayRequestToActualSent(req: RelayRequest): ActualSentRequest` — converts ContentType union to displayable body string
- Add `normalizeParams()` helper — `filterActiveParams()` returns `[string,string][]` at runtime, NOT `Record<string,string>`. Must use `Array.isArray()` to detect
- Add `actualSentRequest?: ActualSentRequest` to `HoppRESTSuccessResponse` and `HoppRESTFailureResponse`

### 2. `helpers/network.ts`
- Capture `RelayRequest` before `service.execute()`: `const actualSent = relayRequestToActualSent(kernelRequest)`
- Attach to response on success: `response.next({...processedRes, actualSentRequest: actualSent})`

### 3. `components/lenses/ActualRequestRenderer.vue`
- Props: `actualRequest: ActualSentRequest`
- Display format: structured sections
  - **URL**: method badge (color-coded) + full URL with query params appended
  - **Header List**: Name/Value table — if empty shows "None"
  - **Body**: pretty-printed (JSON auto-formatted), wraps in pre with border
- Color-coded method badges (GET=green, POST=yellow, PUT=blue, PATCH=orange, DELETE=red)
- **Unresolved template warning**: yellow banner when `<<key>>` patterns remain in URL/headers/body
- Copy button copies structured text (method URL, headers, body)
- **Do NOT use `sticky` on inner header** — use `flex-shrink-0` to avoid overlapping scrollable content

### 4. `components/lenses/ResponseBodyRenderer.vue`
- New `HoppSmartTab` with `id="actual-request"` (after "Test Results")
- `actualSentRequest` computed reads from `response.actualSentRequest`
- Register `"actual-request"` in `validRenderers` array
- Tab visibility: `v-if="actualSentRequest"` (only when actual wire data exists)

### 5. Locale files (`en.json`, `cn.json`, `tw.json`)
- Add `"response.actual_request": "Actual Request"` / `"实际请求"` / `"實際請求"`

## Key Pitfalls

### P-A1: filterActiveParams() returns array, NOT Record — RelayRequest.params runtime mismatch

`filterActiveParams()` in `helpers/functional/filter-active.ts` returns `[string, string][]` (array of key-value tuples). However, `RelayRequest.params` is typed as `Record<string, string>`. At runtime, `Object.entries()` on the array produces index-value pairs — e.g., `[["0", "a,1"], ["1", "b,2"]]` instead of `[["a", "1"], ["b", "2"]]`.

**Fix**: Use `Array.isArray()` to detect the runtime type before processing:
```ts
function normalizeParams(params: any): [string, string][] {
  if (!params) return []
  if (Array.isArray(params)) return params
  return Object.entries(params).filter(([k]) => k !== "")
}
```
The `ActualSentRequest.params` field should be typed as `[string, string][]` to match runtime reality.

### P-A2: Query Parameters are SEPARATE from URL in RelayRequest
`RelayRequest.url` does NOT include query params. `RelayRequest.params` is a separate
field (see P-A1 for runtime type). Must compute `fullURL = url + "?" + encodeParams(params)` for display.

### P-A3: Env var regex ONLY matches `<<variable>>`, NOT `{{variable}}`
`REGEX_ENV_VAR = /<<([^>]*)>>/g` in `hoppscotch-data/src/environment/index.ts`. Both
`parseTemplateString()` and `parseBodyEnvVariables()` use this same regex. The SmartEnvInput
UI component converts `{{x}}` → `<<x>>` internally, but manual `{{x}}` entries NEVER resolve.
Add `console.log` on `kernelRequest.url` to verify if resolution occurred.

### P-A4: relayRequestToActualSent() ContentType handling
Kernel `ContentType` is a union. Must handle all variants:
- json → JSON.stringify(content, null, 2) for pretty-print
- text/xml/urlencoded → content as-is
- form/multipart → iterate FormData with typed callback: `(value: FormDataEntryValue, key: string)`
- binary → `[Binary N bytes]`
- stream → `[Stream]`

### P-A5: Transport headers NOT in RelayRequest — application-level only
`RelayRequest.headers` contains only application-level headers (user-configured + auth-injected
+ body-generated like Content-Type). Transport-level headers added by axios/browser (User-Agent,
Accept, Accept-Encoding, Origin, Connection, Sec-*) are NOT in `RelayRequest`. The kernel web
relay (`relay/impl/web/v/1.ts`) passes `request.headers` directly to axios config — axios then
adds its own defaults on top. To see transport headers, use browser DevTools Network panel or
compare with echo endpoint response.

### P-A6: i18n `count.*` keys require `{count}` parameter
Keys like `t("count.key")` are template strings (`"Key {count}"` in en.json). Without passing
`{count}`, vue-i18n renders empty string. For table column headers, hardcode "Name"/"Value"
instead of using `t("count.key")`/`t("count.value")`.

### P-A7: Sticky positioning in tab content blocks scrollable area
Inner sticky elements use `top-lowerSecondaryStickyFold` CSS variable, but within
`HoppSmartTab` content this causes overlap with scrollable content below. Remove `sticky`
from inner header bars — use `flex-shrink-0` instead. The parent tab bar already provides
the tab label.

### P-A8: Vue template expressions — no multi-line string literals in interpolation
Template expressions like `{{ "long text" }}` cannot span multiple lines inside Vue
interpolation. Use a computed property (`warningText`) instead of inline multi-line strings.
This avoids "Unterminated string constant" parse errors during build.

## Styling

Use semantic classes, not hardcoded colors:
- `bg-primary`, `text-secondaryLight`, `border-dividerLight`
- `text-primary`, `text-secondary`, `bg-primaryLight`
- `font-mono` for code/data, `font-semibold` for labels
- Tables: `border-collapse` with `border-dividerLight` borders
- Method badges: `bg-{color}-500/20 text-{color}-500` (20% opacity bg, full color text)
