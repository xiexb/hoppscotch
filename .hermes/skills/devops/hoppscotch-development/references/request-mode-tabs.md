# Request Mode Tabs Feature (设计/调试/测试用例)

## Overview

Three mode tabs added above the request content area (below URL bar) in the REST request panel:
- **Design** (设计): API description + response model documentation (Apifox-style)
- **Debug** (调试): Normal request editing (existing behavior, default)
- **Test Cases** (测试用例): Structured test assertions against API responses

## Architecture

### Data Model (v19 schema)
- `packages/hoppscotch-data/src/rest/v/19/index.ts` — extends v18 with:
  - `HoppRESTResponseModel`: `{ statusCode, description, headers: Array<{key,description}>, bodySchema, bodyExample }`
  - `HoppRESTTestCase`: `{ id, name, description, expectations: { statusCode, bodyContains: string[], headerExists: string[], jsonPath: Array<{path,operator,value}> } }`
- `responseModels: HoppRESTResponseModel[]` and `testCases: HoppRESTTestCase[]` added to `HoppRESTRequest`
- `modePreference: "debug"|"design"|"testcases"` added to `HoppRequestDocument` (tab-level, not request-level)

### Components
- `RequestModeTabs.vue` — Simple button-based tab bar (NOT HoppSmartTabs — see pitfalls)
- `RequestDesignPanel.vue` — Markdown description editor + response model CRUD
- `RequestTestCasesPanel.vue` — Test case CRUD with structured assertions
- `RequestTab.vue` — Layout: RequestModeTabs → HttpRequest(URL) → conditional content panel

### Key Decisions
- `modePreference` is on `HoppRequestDocument` (persists per tab), not `HoppRESTRequest` (persists per saved request)
- `responseModels` and `testCases` are on `HoppRESTRequest` (saved with the request/exported)
- Params/headers shown as read-only badges in design mode (no description field on HoppRESTParam/HoppRESTHeader)
- Test runner is placeholder (Phase 2 will wire to `runRESTRequest$`)

## Pitfalls Discovered

### HoppSmartTabs causes onMounted warnings
`HoppSmartTabs`/`HoppSmartTab` trigger Vue warnings:
```
onMounted is called when there is no active component instance to be associated with.
```
**Fix:** Replace with simple custom button tabs (see RequestModeTabs.vue pattern).

### HoppRESTReqBody is a zod union type
`body.body` has different shapes depending on `contentType`:
- `null` contentType → `body: null`
- `multipart/form-data` → `body: Array<{key,value}>`
- `application/octet-stream` → `body: File | null`
- Other string contentTypes → `body: string`

Preview must handle all cases with type guards (typeof, Array.isArray, instanceof File).

### v-if reactivity bug (RESOLVED)
**Symptom:** After clicking Design tab, the button shows active state (CSS classes correct) but `v-if="currentMode === 'design'"` does NOT render the design panel. The `currentMode` ref in RequestTab.vue is not updating from the `RequestModeTabs` emit.

**Root cause:** `v-model="currentMode"` on a child component inside a Splitpanes `<template #slot>` silently fails — the child's `emit('update:modelValue', val)` fires, the child's `:class` comparison (`modelValue === mode.id`) works, but the parent's `currentMode` ref is never updated. Likely a Splitpanes rendering context issue where the compiled v-model assignment doesn't execute in the correct scope.

**Fix:** Replace `v-model="currentMode"` with explicit binding:
```vue
<HttpRequestModeTabs
  :model-value="currentMode"
  @update:model-value="onModeChange"
/>
```
```typescript
function onModeChange(newMode: RequestMode) {
  currentMode.value = newMode
}
```

### response.headers vs responseModel.headers type mismatch
`HoppRESTRequestResponse.headers` = `Array<{key, value}>` but `HoppRESTResponseModel.headers` = `Array<{key, description}>`. When importing from saved response, map `{ key: h.key, description: h.value }`.

### JSON i18n duplicate key override
Both `en.json` and `cn.json` had `"response_model": "Response Model"` (string) followed by `"response_model": { "add": "..." }` (object) at the same level. The object silently overwrote the string, causing `t("request_mode.design.response_model")` to return an object instead of a string. **Fix:** Moved the string into the object as `"title"` (`"response_model": { "title": "Response Model", "add": "..." }`), updated component to `t("request_mode.design.response_model.title")`.

### `<icon-lucide>` dynamic component fails at runtime
`<icon-lucide :icon="mode.icon">` and `<icon-lucide icon="trash-2">` produce `Failed to resolve component: icon-lucide` in selfhost-web context (and potentially other entry points). Only `icon-lucide-<name>` (e.g. `<icon-lucide-chevron-right>`) is auto-registered. **Fix:** Import specific icons and use `<component :is>` for dynamic or `<IconXxx>` for static:
```typescript
import IconChevronDown from "~icons/lucide/chevron-down"
import IconTrash2 from "~icons/lucide/trash-2"
```
```vue
<component :is="expanded ? IconChevronDown : IconChevronRight" class="svg-icons" />
<IconTrash2 class="svg-icons w-3.5 h-3.5" />
```
Exception: `:icon="'icon-lucide-plus'"` as a string prop on `HoppButtonSecondary` works fine.

### Response panel visibility (DESIGN DECISION)
The HTTP response panel (`<HttpResponse>` in `#secondary` slot of `AppPaneLayout`) must **only appear in debug mode**. In design and test-cases modes, the request panel takes the full vertical space with no splitter.

**Correct implementation: Always define the `#secondary` slot, use `hide-secondary` prop.**
```vue
<AppPaneLayout layout-id="rest-primary" :hide-secondary="currentMode !== 'debug'">
  <template #primary>
    <HttpRequestModeTabs :model-value="currentMode" @update:model-value="onModeChange" />
    <HttpRequest v-model="tab" />
    <!-- mode-specific panels -->
  </template>
  <template #secondary>
    <HttpResponse v-model:document="tab.document" :tab-id="tab.id" />
  </template>
</AppPaneLayout>
```

**PITFALL: Do NOT put `v-if` on the `<template #secondary>` slot.** This makes the slot undefined when the condition is false, so `!!slots.secondary` is falsy. Even when switching back to debug mode, Splitpanes may not re-create the Pane correctly. Always define the slot unconditionally and let `hide-secondary` control visibility.

**Previous failed approach:** `<template v-if="currentMode === 'debug'" #secondary>` combined with `:hide-secondary="currentMode !== 'debug'"` — the `v-if` on the slot template was the root cause of the response panel not showing. Removing just the `v-if` (keeping hide-secondary) fixed it.

### RequestDesignPanel render error (UNRESOLVED)
After fixing icon-lucide, switching to Design mode still produces `Unhandled error during execution of render function at <RequestDesignPanel>`. The icon resolution error is gone but a new render error appears. Likely cause: `DocumentationMarkdownEditor` import failing in selfhost-web context, or a data shape mismatch (v18 data vs v19 types). **To debug:** Add `onErrorCaptured` in RequestDesignPanel to capture the actual error, or progressively comment out sub-components to isolate the crash source.

### Tab selected text invisible with text-accent / text-accentContrast
Custom mode tab buttons use `border-b-2 border-accentLight` for the selected indicator. The selected text color must be `text-primary` (not `text-accent` or `text-accentContrast`). `text-accentContrast` is white and invisible on light backgrounds; `text-accent` can be too light. Use `font-bold text-primary` for the active tab, `text-secondary` for inactive.

### expandedModels Set reactivity (potential issue)
`RequestDesignPanel.vue` uses `ref<Set<number>>(new Set([0]))` for tracking which response models are expanded. Mutating the Set (`.add()`, `.delete()`) does NOT trigger Vue reactivity — must replace the entire Set: `expandedModels.value = new Set(expandedModels.value)`. The code does this, but the expanded content for newly-added response models may not render if the Set replacement doesn't propagate through the `v-if` correctly. Monitor if "Add Response Model" → expanded detail doesn't appear.

## Files Changed
- `packages/hoppscotch-data/src/rest/v/19/index.ts` (new)
- `packages/hoppscotch-data/src/rest/index.ts` (v19 registration)
- `packages/hoppscotch-common/src/helpers/rest/document.ts` (modePreference)
- `packages/hoppscotch-common/src/services/persistence/validation-schemas/index.ts`
- `packages/hoppscotch-common/src/services/tab/rest.ts` (default modePreference)
- `packages/hoppscotch-common/src/components/http/RequestModeTabs.vue` (new)
- `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue` (new)
- `packages/hoppscotch-common/src/components/http/RequestTestCasesPanel.vue` (new)
- `packages/hoppscotch-common/src/components/http/RequestTab.vue` (modified layout)
- `packages/hoppscotch-common/locales/en.json` + `cn.json` (i18n)
