# Path Params ReadOnlyKeys Pattern

## Overview

When embedding PathParams inside the Parameters tab (not as a standalone tab), path params are auto-managed from URL `{varName}` patterns. Users should NOT be able to manually add, delete, reorder, or rename path param keys — only the `value` and `description` fields are editable.

**IMPORTANT**: `<<varName>>` in the URL is an environment variable, NOT a path parameter. It is resolved by `parseTemplateString()` from environment settings and does NOT appear in the Path Parameters panel. Only `{varName}` creates a pathParams entry.

## Component Prop Chain

```
RequestOptions.vue
  → <HttpPathParams v-model="pathParams" :hide-header="true" :read-only-keys="true" />
    → PathParams.vue (props: hideHeader, readOnlyKeys)
      → <HttpKeyValue :name-read-only="readOnlyKeys" :delete-disabled="readOnlyKeys" />
        → KeyValue.vue (props: nameReadOnly, deleteDisabled)
          → <SmartEnvInput :read-only="nameReadOnly" />   (key field — readonly)
          → <SmartEnvInput />                              (value field — editable)
```

## What readOnlyKeys Controls in PathParams.vue

| Feature | readOnlyKeys=false | readOnlyKeys=true |
|---------|-------------------|-------------------|
| Header buttons (add/clear/bulk/help) | Visible | Hidden (`v-if="!readOnlyKeys"`) |
| Drag handle on each row | Visible | Hidden (`v-if="!deleteDisabled"` in KeyValue) |
| Delete button on each row | Visible | Hidden (`v-if="!deleteDisabled"` in KeyValue) |
| Active toggle (check/circle) | Visible | Hidden (`v-if="!deleteDisabled"` in KeyValue) |
| Key field | Editable | Read-only (SmartEnvInput :read-only="true") |
| Value field | Editable | Editable |
| Empty trailing row | Auto-appended | Not appended (watcher skipped) |
| Initial workingParams | `[{key:"",...}]` | `[]` (empty — no manual add) |
| Empty-state "Add" button | Shown | Hidden (`v-if="!readOnlyKeys"`) |
| Bulk mode | Available | Unavailable (`v-if="bulkMode && !readOnlyKeys"`) |

## v-model with undefined Fix (RequestOptions.vue)

When `request.pathParams` is `undefined` (v17 schema tabs lack this field), passing it via `v-model` causes Vue prop validation warnings. Fix with a writable computed:

```typescript
const pathParams = computed({
  get: () => request.value.pathParams ?? [],
  set: (val) => {
    request.value.pathParams = val
  },
})
```

Then bind `v-model="pathParams"` instead of `v-model="request.pathParams"` in the template.

## SmartEnvInput readonly Implementation & Root Cause of Bug

`SmartEnvInput` (`packages/hoppscotch-common/src/components/smart/EnvInput.vue`) uses CodeMirror 6 with a `readOnly` Compartment.

### Two bugs that prevent readonly from working:

**Bug 1: Missing `EditorState.readOnly.of()` in initial configs**

In `getExtensions()` at line ~538, the `readOnlyConfigs` array had:
- `EditorView.updateListener` — sets contentDOM attributes
- `EditorState.changeFilter.of(() => !readonly)` — blocks changes
- Theme extension — dimmed appearance

But was **MISSING** `EditorState.readOnly.of(readonly)`. The `changeFilter` alone is not sufficient to block all input paths.

**Bug 2: `watch()` with `immediate: true` fires before `view.value` exists**

The watch at line ~696:
```js
watch(() => props.readonly, (isReadOnly) => {
  if (isReadOnly) {
    view.value?.dispatch({ effects: readOnly.reconfigure([...]) })
    view.value?.contentDOM.setAttribute(...)
  }
}, { immediate: true })
```

During `setup()`, `view.value` is `undefined` (editor not mounted yet). The optional chaining `?.` silently does nothing. Later in `onMounted`, `getExtensions(props.readonly)` passes the correct value — but if the Compartment was initialized with default (non-readonly) extensions from the early watch, the state is already wrong.

### Fix (both changes required):

1. **Add `EditorState.readOnly.of(readonly)` to `getExtensions()` readOnlyConfigs:**
```typescript
const readOnlyConfigs = [
  EditorView.updateListener.of((update) => {
    if (readonly) { update.view.contentDOM.inputMode = "none"; ... }
  }),
  EditorState.changeFilter.of(() => !readonly),
  EditorState.readOnly.of(readonly),  // ← ADD THIS
  readonly ? EditorView.theme({...}) : EditorView.theme({}),
]
```

2. **Re-apply readonly in `onMounted` after view exists:**
```typescript
onMounted(() => {
  if (editor.value) {
    if (!view.value) initView(editor.value)
    // ... existing focus/selection code ...
    
    if (props.readonly && view.value) {
      view.value.dispatch({
        effects: readOnly.reconfigure([
          EditorView.theme({ ".cm-content": { caretColor: "...", ... } }),
          EditorState.changeFilter.of(() => false),
          EditorState.readOnly.of(true),
        ]),
      })
      view.value.contentDOM.setAttribute("inputmode", "none")
      view.value.contentDOM.setAttribute("contenteditable", "false")
    }
  }
})
```

### Browser verification:
```js
// Check all CodeMirror editors on page
document.querySelectorAll('.cm-editor .cm-content').forEach(el => {
  console.log(el.getAttribute('contenteditable'), el.textContent?.substring(0,30))
})
// Path param key fields should show "false" for contenteditable
```

## Plain-Text Key Rendering — Simpler Than Fixing CodeMirror

The CodeMirror `readOnly` Compartment approach in `EnvInput.vue` is fragile (timing issues, missing facets, Vite dev-server caching across workspace packages). A simpler and more robust approach is to **not render SmartEnvInput at all** when the key field should be read-only. Instead, render the key as plain text:

In `KeyValue.vue`:

```html
<!-- When nameReadOnly is true, render plain text — no editor, no keyboard input possible -->
<div
  v-if="nameReadOnly"
  class="flex flex-1 items-center px-4 text-secondaryDark truncate"
  :class="{ 'opacity-50': !entityActive }"
>
  <span class="truncate">{{ name }}</span>
</div>
<SmartEnvInput
  v-else
  :model-value="name"
  :read-only="nameReadOnly"
  ...existing props...
/>
```

**Why this works:**
- No CodeMirror editor is created → no DOM contentEditable area → impossible to type
- No compartment timing issues
- No Vite dev-server caching problems (code is in `KeyValue.vue`, which lives in the common package but is compiled as part of any consuming chunk)
- Values still visible, just not editable
- Environment variable highlighting and inspector annotations aren't needed on read-only key fields (they're literal variable names from the URL)

**When to use each approach:**
- **Plain text in KeyValue.vue** → preferred for path-param keys (readOnlyKeys mode). Simple, guaranteed read-only.
- **CodeMirror fix in EnvInput.vue** → needed when the editor must remain for features like env-var highlighting, inspector annotations, or when the readonly state needs to be toggled dynamically (though for path params it never toggles).

## PathParams Always-Visible Section Header

In `RequestOptions.vue`, the Path Parameters section is always shown (no `v-if="hasPathParams"`) so users can see where path params will appear when they add URL variables. The section header uses:

```html
<div class="flex flex-col">
  <div class="flex flex-shrink-0 items-center ... border-t border-dividerLight bg-primary pl-4">
    <label class="truncate py-2 font-semibold text-secondaryLight">
      {{ t("request.path_parameter_list") }}
    </label>
  </div>
  <HttpPathParams v-model="pathParams" :envs="envs" :hide-header="true" :read-only-keys="true" />
</div>
```

The `border-t` separates it from the query params section above. No action buttons in the header since path params are auto-managed.

## URL Auto-Detection Watcher (Request.vue)

The `watch()` on `tab.value.document.request.endpoint` in `Request.vue` (debounced 300ms)
auto-syncs pathParams entries with URL `{varName}` template variables.

### Only `{var}` is detected — NOT `<<var>>`

The watcher uses `HOPP_PATH_PARAM_REGEX` (`/\{([^}]+)\}/g`) with variable names
extracted via `PATH_PARAM_NAME_REGEX` (`/\{([a-zA-Z0-9_.-]+)\}/`).

`<<var>>` (environment variables) are **NOT** added to pathParams. They are resolved
by `parseTemplateString()` from environment settings. The Path Parameters panel only
shows `{var}` entries.

### Why `<<var>>` must NOT be in the watcher

Including `<<var>>` in the watcher causes env vars to appear in the Path Parameters
panel where users can't meaningfully set them (they're resolved from the environment).
This polluted the panel with irrelevant entries and confused users about where to
configure values.

### Watcher behavior

The watcher:
1. Removes pathParams whose key is no longer in the URL
2. Adds new entries for newly detected `{var}` variables (with empty value, active=true)
3. Preserves existing values for variables that remain

### Regex reference

| Pattern | Regex | Purpose |
|---------|-------|---------|
| `{var}` | `/\{([^}]+)\}/g` | Detect path params in URL |
| `{var}` name | `/\{([a-zA-Z0-9_.-]+)\}/` | Extract variable name |
| `<<var>>` | `/<<([^>]*)>>/g` | Environment variables (NOT used by watcher) |

## Path Parameter Hover Tooltip

When the user hovers over a `{var}` in the URL editor, a tooltip shows:
- "Path Parameter" label with `IconRoute` icon (lucide)
- Variable name (e.g., `userId`)
- Value from pathParams, or `?` if not set

### Architecture

`cursorPathParamsTooltipField()` in `HoppEnvironment.ts` — same `ViewPlugin` + `hover`
pattern as `cursorEnvTooltipField()` (the env var tooltip).

Data flow:
```
EnvInput.vue
  → computed: pathParams (from restRequest.params)
  → HoppReactiveEnvPlugin(pathParamsRef)
    → watch(pathParamsRef) → setPathParams()
    → getExtension() passes pathParams to cursorPathParamsTooltipField
```

### Implementation in HoppEnvironment.ts

```typescript
// In HoppEnvironmentPlugin class:
pathParams: HoppRESTPathParam[] = []
setPathParams(params: HoppRESTPathParam[]) { this.pathParams = params }

// In getExtension():
cursorPathParamsTooltipField(this.pathParams)

// In HoppReactiveEnvPlugin class:
pathParams: HoppRESTPathParam[] = []
constructor(..., pathParamsRef: Ref<HoppRESTPathParam[]>) {
  watch(pathParamsRef, (p) => this.setPathParams(p), { immediate: true })
}
```

### Tooltip value logic

```typescript
const param = pathParams.find(p => p.key === paramName)
const displayValue = param?.value || "?"
```

### PITFALL: DOM elements must be explicitly appended

When building tooltip DOM in CodeMirror widgets, every created element must be
explicitly appended to its parent. For example:

```typescript
const paramNameBlock = document.createElement("span")
paramNameBlock.textContent = paramName
// MUST call: iconNameContainer.appendChild(paramNameBlock)
// Without this, the variable name silently doesn't appear — no error, just missing
```

## Path Parameter Highlighting in URL Editor

The CodeMirror URL editor (SmartEnvInput / EnvInput.vue) highlights `{var}` path
parameters with a distinct cyan background so users can visually differentiate
them from `<<var>>` environment variables.

### Architecture

- **Regex**: `HOPP_PATH_PARAM_REGEX = /(\{[a-zA-Z0-9_.-]+\})/g` in `environment-regex.ts`
- **Plugin**: `pathParamHighlightStyle()` in `HoppEnvironment.ts` — uses CodeMirror
  `MatchDecorator` + `ViewPlugin`, same pattern as environment variable highlights
- **CSS**: `.path-param-highlight` class in `styles.scss` — `bg-cyan-500`, `hover:bg-cyan-600`,
  `text-accentContrast`
- **Integration**: Added to both `HoppEnvironmentPlugin` and `HoppReactiveEnvPlugin`
  compartment configs alongside `cursorTooltipField` and `environmentHighlightStyle`

### Color Scheme (for reference)

| Variable Type | CSS Class | Background Color |
|--------------|-----------|-----------------|
| Request variable | `request-variable-highlight` | amber-500 |
| Collection variable | `collection-variable-highlight` | purple-500 |
| Environment variable | `environment-variable-highlight` | green-500 |
| Global variable | `global-variable-highlight` | blue-500 |
| Not found | `environment-not-found-highlight` | red-500 |
| **Path parameter** | **`path-param-highlight`** | **cyan-500** |

### PITFALL: Function ordering in HoppEnvironment.ts

`pathParamHighlightStyle()` must be defined BEFORE `HoppEnvironmentPlugin` class.
If placed after the class, TypeScript block-scoping causes "Cannot find name" errors.
Do NOT add a separate `import` at the bottom either — it creates duplicate identifiers
since `HOPP_PATH_PARAM_REGEX` is already imported at the top.

## i18n Keys Required

When adding path params UI, ensure these keys exist in `en.json`, `cn.json`, and `tw.json`:

| Key | en | cn | tw |
|-----|----|----|-----|
| `request.path_parameter_list` | Path Parameters | 路径参数 | 路徑參數 |
| `tab.path_params` | Path Params | 路径参数 | 路徑參數 |
| `empty.path_parameters` | This request does not have any path parameters | 此请求没有任何路径参数 | 此請求沒有任何路徑參數 |

## Debugging Notes

### Vite Not Serving Common Package Changes

When modifying files under `packages/hoppscotch-common/src/` while running the Vite dev server from `packages/hoppscotch-selfhost-web/`, changes may not be picked up by HMR. The dev server's file watcher only monitors files within the project root by default — common package files resolved via path aliases (`~` → `../hoppscotch-common/src`) fall outside the watcher scope.

**Diagnostic:** Add a `console.log()` to the modified file. If it never appears in the browser console on reload, the changes aren't being served. The `--force` flag only clears the dependency pre-bundling cache (`node_modules/.vite/deps/`), not the source transform cache for aliased files.

**Reliable workaround:** Run `npx vite build` (production build) which does a full compilation from scratch, then restart the dev server. Or clear all `.vite*` cache directories and restart with `--force`.

### Vue VNode Traversal Fails in Draggable Slots

Components inside `<template #item>` of `vuedraggable-es` have an isolated VNode hierarchy. Walking up the DOM via `el.parentElement.__vnode.component.props` will NOT find the item's component — the scoped slot creates an intermediate rendering boundary.

**Workaround:** Query DOM attributes directly (e.g., `.cm-content[contenteditable]`) instead of trying to read reactive props via `__vnode`.
