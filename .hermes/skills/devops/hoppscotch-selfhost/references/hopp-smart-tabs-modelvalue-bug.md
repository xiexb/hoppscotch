# HoppSmartTabs modelValue Bug — Root Cause Analysis

## Symptom

All tab content areas in RequestOptions are empty/blank. Clicking tab buttons highlights them but no content renders. Path Params tab was particularly affected because it was added later to the codebase.

## Root Cause (Verified)

The bug is a chain of issues that combine to make `selectedOptionTab` evaluate to `undefined`, which breaks HoppSmartTabs' strict `===` comparison.

### Issue 1: `optionTabPreference` is Optional

`HoppRequestDocument.optionTabPreference` is typed as `RESTOptionTabs | undefined` (the `?` modifier):

```typescript
// helpers/rest/document.ts
export type HoppRequestDocument = {
  optionTabPreference?: RESTOptionTabs  // optional!
  // ...
}
```

When tabs are restored from localStorage that were saved by older versions lacking this field, `optionTabPreference` is `undefined`.

### Issue 2: Zod Validation Schema Strips Unknown Tab IDs

The persistence validation schema defines allowed values for `optionTabPreference`:

```typescript
// services/persistence/validation-schemas/index.ts
const validRestOperations = [
  "params",
  "bodyParams",
  "headers",
  "authorization",
  "preRequestScript",
  "tests",
  "requestVariables",
] as const
```

Since `optionTabPreference: z.optional(z.enum(validRestOperations))`, any value not in the enum gets stripped by zod validation, becoming `undefined`. This applies to old values like `"pathParams"` (now removed) and any future tab ID not yet added to the enum.

### Issue 3: Vue `withDefaults` Does NOT Handle `undefined`

In `RequestTab.vue`:
```html
<HttpRequestOptions
  v-model:option-tab="tab.document.optionTabPreference"
/>
```

When `optionTabPreference` is `undefined`, the prop `optionTab` receives `undefined`. In `RequestOptions.vue`, `withDefaults` only applies when a prop is entirely absent — passing `undefined` explicitly IS passing the prop, so the default `"params"` is skipped.

### The Cascade

1. `selectedOptionTab = undefined`
2. `HoppSmartTabs` receives `modelValue = undefined`
3. `activeTabID = computed(() => props.modelValue)` becomes `undefined`
4. Each tab: `activeTabID.value === props.id` becomes `false`
5. All tabs: `shouldRender = false` — nothing rendered

## Fix

### 1. Wrap useVModel with a computed fallback (RequestOptions.vue)

```typescript
const selectedOptionTabRaw = useVModel(props, "optionTab", emit)

const selectedOptionTab = computed({
  get: () => {
    const raw = selectedOptionTabRaw.value
    if (raw === "pathParams") return "params" as RESTOptionTabs  // migration
    return raw ?? ("params" as RESTOptionTabs)                   // fallback
  },
  set: (val: RESTOptionTabs) => { selectedOptionTabRaw.value = val },
})
```

This ensures `undefined` falls back to `"params"`, so HoppSmartTabs always receives a valid string. Apply the same pattern in GraphQL RequestOptions with `"query"` as default.

### 2. Keep validRestOperations in sync with tab IDs

When adding a tab: add the ID to the enum.
When removing/merging a tab: remove the ID from the enum, and add a migration mapping in the computed (as shown above for `"pathParams"` to `"params"`).

### 3. Remove non-null assertions on optional bindings

The `!` in `v-model:option-tab="tab.document.optionTabPreference!"` is compile-time only. Remove it. The real safety comes from the computed fallback.

## Resolution: Path Params Merged Into Parameters Tab (readOnlyKeys Mode)

Path Params is no longer a standalone tab. It's embedded inside the Parameters tab below query params, with its own section header. Key changes:

- `PathParams.vue`: added `hideHeader` and `readOnlyKeys` props for embedded mode
- `RequestOptions.vue`: removed `HoppSmartTab id="pathParams"`, embedded `<HttpPathParams>` inside the params tab with section separator (always visible, no `v-if`), passed `hide-header read-only-keys`
- `validRestOperations`: `"pathParams"` removed (no longer a valid tab option)
- `selectedOptionTab` computed maps legacy `"pathParams"` to `"params"`
- `newActiveParamsCount` merged to include both query + path params count
- `Request.vue` watcher: bidirectional sync (add new path params, remove stale ones)
- `KeyValue.vue`: added `nameReadOnly` and `deleteDisabled` props — `nameReadOnly` passes through to `SmartEnvInput :read-only`, `deleteDisabled` hides drag handle and delete button
- When `readOnlyKeys=true` on PathParams: no add/delete/drag/clear/bulk buttons, key fields read-only, empty trailing-row watcher skipped, empty-state placeholder has no "Add" button
- i18n: added `request.path_parameter_list`, `empty.path_parameters`, `tab.path_params` to cn.json and tw.json

**Known issue**: The `SmartEnvInput :read-only` prop may not take effect via the kebab-case chain (`:name-read-only` → `nameReadOnly` → `:read-only`). If key fields remain editable, try camelCase in template (`:nameReadOnly`), or verify with `.cm-editor .cm-readonly` class check in browser console.

## General Lesson: Vue `withDefaults` + `undefined` Pitfall

**Rule**: In Vue 3, `withDefaults` defaults ONLY apply when a prop is not passed at all. If the parent template binds `v-model:prop="someValue"` and `someValue` is `undefined`, the prop receives `undefined` — the default is ignored.

**Safe pattern**: When a v-model binding may produce `undefined` (optional fields on persisted objects), always add a `?? fallback` at the consumption site — either in the component's setup or via a computed wrapper around `useVModel`.

## Diagnosis via Browser Console

```js
// 1. Find the HoppSmartTabs root element
const tabsRoot = document.querySelector('.tabs.relative')

// 2. Inspect VNode props
const vNode = tabsRoot.__vnode
console.log('modelValue:', vNode.component.props.modelValue)  // undefined = broken, "params" = correct
console.log('type:', typeof vNode.component.props.modelValue)  // "undefined" = broken

// 3. Check selectedOptionTab in parent RequestOptions
const parent = tabsRoot.parentElement.__vnode.component
console.log('selectedOptionTab:', parent.setupState.selectedOptionTab)
```
