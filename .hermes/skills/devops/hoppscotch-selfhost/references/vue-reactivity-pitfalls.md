# Vue Reactivity Pitfalls in Hoppscotch

Session-derived patterns from debugging Design mode and response model UI.

## P39: v-if on Named Slots Breaks Splitpanes

**Symptom**: Response panel doesn't appear when switching to debug mode. No error in console.

**Root cause**: `<template v-if="condition" #secondary>` makes the slot undefined when condition is false.
`PaneLayout.vue` computes `hasSecondary = !!slots.secondary && !hideSecondary`. When slot is undefined,
`hasSecondary = false`, so Splitpanes renders only one Pane. Switching condition to true re-defines the
slot, but Splitpanes may not correctly re-initialize the second Pane.

**Fix**: Always define `#secondary` slot. Use `:hide-secondary` prop on `AppPaneLayout` instead.

Before:
```vue
<AppPaneLayout :hide-secondary="currentMode !== 'debug'">
  <template v-if="currentMode === 'debug'" #secondary>
    <HttpResponse ... />
  </template>
</AppPaneLayout>
```

After:
```vue
<AppPaneLayout :hide-secondary="currentMode !== 'debug'">
  <template #secondary>
    <HttpResponse ... />
  </template>
</AppPaneLayout>
```

## P40: Computed ?? [] Creates Detached Array

**Symptom**: Clicking "Add Response Model" button does nothing. No new model appears.

**Root cause**: `computed(() => request.value.responseModels ?? [])` returns a new empty array
when `responseModels` is undefined. Calling `.push()` on this temporary array mutates
a detached object — the reactive `request.value` still has `responseModels: undefined`.

**Fix**: Ensure the array exists on the reactive source before mutating:
```ts
function ensureResponseModels() {
  if (!request.value.responseModels) {
    request.value = { ...request.value, responseModels: [] }
  }
}
```

## P41: v-model on Computed Array Items Fails for Nested Mutations

**Symptom**: Editing status code or description in response model doesn't update the UI.

**Root cause**: `v-model` on items from `computed(() => request.value.arr ?? [])` may bind
to a snapshot. Mutations on nested properties don't propagate through the computed chain.

**Fix**: Use `:value` + `@input` with explicit source mutation. For array sub-properties,
replace the entire array to trigger reactivity.

## Key Files

- `RequestTab.vue` — AppPaneLayout with primary/secondary slots
- `RequestDesignPanel.vue` — Design mode panel (flat sections layout)
- `RequestModeTabs.vue` — Mode tab switcher (Design/Debug/Test Cases)
- `PaneLayout.vue` — Splitpanes wrapper, hasSecondary computed
