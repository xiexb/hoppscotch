---
name: hoppscotch-development
description: "Hoppscotch frontend feature development: data model extension (verzod), Vue 3 components, i18n, tab/document model patterns."
version: 1.5.0
author: Hermes Agent
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [hoppscotch, vue3, typescript, verzod, api-client, feature-development, web-component, erd-editor, custom-element]
    related_skills: [docker-web-app-selfhost]
---

# Hoppscotch Feature Development

Developing features on the Hoppscotch codebase (fork at /home/jcwl/workspace/hoppscotch).

## Project Basics

- **Repo**: GitHub `https://github.com/xiexb/hoppscotch.git` (NOT GitLab)
- **Frontend dev**: `pnpm run dev`
- **Prod build**: `pnpm run generate`
- **Typecheck**: `pnpm run typecheck` (runs across all packages)
- **No top-level `build` script** — use `pnpm run generate` or per-package scripts
- **Claude Code**: requires `source .claude/env.sh` for DeepSeek proxy

## Architecture Overview

### Package Structure
```
packages/
  hoppscotch-data/      # Shared data models (verzod versioned entities)
  hoppscotch-common/    # Main frontend (Vue 3 + TypeScript)
  hoppscotch-app/       # Shell app
  hoppscotch-sh-admin/  # Self-host admin panel
```

### Key Directories in hoppscotch-common
```
src/components/http/           # REST request UI components
src/components/collections/    # Collection management + documentation
src/helpers/rest/              # Document types (HoppRequestDocument etc.)
src/services/tab/              # Tab management (RESTTabService)
src/services/persistence/      # localStorage persistence + validation schemas
src/composables/               # Vue composables (useI18n, etc.)
locales/                       # i18n JSON files (en.json, cn.json, etc.)
```

## Data Model Extension (verzod)

Hoppscotch uses `verzod` for versioned entity schemas. The REST request model is currently at **v20**.

### How to Add a New Version

1. **Create version module** at `packages/hoppscotch-data/src/rest/v/<N>/index.ts` (directory) or `v/<N>.ts` (file). Use directory if the version has sub-modules.

2. **Version module template**:
```typescript
import { z } from "zod"
import { defineVersion } from "verzod"
import { V_PREV_SCHEMA } from "../<N-1>"  // or "../<N-1>/index" if directory

export const V<N>_SCHEMA = V_PREV_SCHEMA.extend({
  v: z.literal("<N>"),
  newField: z.array(NewType).catch([]),
})

const V<N>_VERSION = defineVersion({
  schema: V<N>_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V_PREV_SCHEMA>) {
    return { ...old, v: "<N>" as const, newField: [] }
  },
})

export default V<N>_VERSION
```

3. **PITFALL: Directory vs file version modules**. Older versions (v0-v17) are `.ts` files. v18+ are directories with `index.ts`. When importing from a directory version in a sibling, use `"../18"` (resolves to `../18/index.ts`). If TypeScript complains, try `"../18/index"` explicitly.

4. **Register in `rest/index.ts`**:
   - Add import of `V<N>_VERSION` and any new exported types
   - Add to `versionMap: { ... <N-1>: V_PREV, <N>: V<N>_VERSION }`
   - Update `latestVersion: <N>`
   - Update `RESTReqSchemaVersion = "<N>"`
   - Add new fields to `HoppRESTRequestEq` (use `lodashIsEqualEq` for complex types) — **MANDATORY: Eq.struct requires ALL fields; omitting any causes a TS error listing the missing properties**
   - Add to `getDefaultRESTRequest()` with default values
   - Add to `safelyExtractRESTRequest()` if needed for legacy parsing

5. **Export new types**: Define zod schemas in the version module, then re-export from `rest/index.ts`. Use `export type { ... }` for type-only exports (interfaces/type aliases) and `export { ... }` for value exports (zod schemas, enums). Mixing them in a single `export { ... }` block causes TS2693 "only refers to a type, but is being used as a value".

## UI Components

### Auto-imported from @hoppscotch/ui
Components like `HoppSmartTabs`, `HoppSmartTab`, `HoppButtonSecondary`, `HoppSmartToggle`, etc. are auto-registered — no manual import needed in Vue SFCs. Check `components.d.ts` for the full list.

### HoppSmartTabs API
```vue
<HoppSmartTabs v-model="selectedTab" styles="sticky overflow-x-auto ...">
  <HoppSmartTab id="tabId" :label="t('tab.label')" :info="count" :indicator="isSet">
    <!-- content -->
  </HoppSmartTab>
</HoppSmartTabs>
```
- `v-model`: string (active tab ID)
- `styles`: CSS classes for the tab bar
- `renderInactiveTabs`: boolean (render hidden tab content)
- `:info`: badge count string
- `:indicator`: boolean dot

### Component Pattern
```vue
<script setup lang="ts">
import { useI18n } from "@composables/i18n"  // NOT vue-i18n directly
import { useVModel } from "@vueuse/core"

const props = defineProps<{ modelValue: SomeType }>()
const emit = defineEmits<{ (e: "update:modelValue", val: SomeType): void }>()
const value = useVModel(props, "modelValue", emit)
const t = useI18n()
</script>
```

### Theme-Aware Styling
Use semantic CSS classes (not hardcoded colors):
- `bg-primary`, `bg-primaryLight` — backgrounds
- `text-secondaryDark`, `text-secondary`, `text-secondaryLight` — text hierarchy
- `border-dividerLight`, `border-divider` — borders
- `text-accent`, `text-accentLight` — accent colors
- `hover:bg-primaryLight` — hover states

## Tab/Document Model

`HoppRequestDocument` in `helpers/rest/document.ts` defines per-tab state:
- `request`: HoppRESTRequest (the actual request data)
- `isDirty`: boolean
- `optionTabPreference`: which sub-tab is active
- `modePreference`: "debug" | "design" | "testcases"
- `saveContext`: where the request is saved
- `response`: live response data

**Adding tab-level state**: Add the field to `HoppRequestDocument`, add default in `RESTTabService` constructor, add validation in `persistence/validation-schemas/index.ts`.

## i18n

### Structure
Locale files are **nested JSON objects** at `locales/en.json`, `locales/cn.json`, etc.

```json
{
  "request_mode": {
    "debug": "Debug",
    "design_tab": "Design",
    "design": {
      "description": "Description"
    }
  }
}
```

Usage in Vue: `t("request_mode.design.description")`

### PITFALL: Duplicate keys in JSON
JSON does not forbid duplicate keys but behavior is undefined. If you have both `"design": "Design"` and `"design": { ... }` at the same level, the second overwrites the first. Use `"design_tab"` for the string label and `"design"` for the nested object.

### Adding translations
1. Add keys to `en.json` first
2. Add matching keys to `cn.json`
3. Insert near related existing keys (e.g., near `"request"` section)

## Persistence Validation

`services/persistence/validation-schemas/index.ts` defines zod schemas for tab state persisted to IndexedDB/localStorage. Any new field on `HoppRequestDocument` must be added here as `z.optional(...)` to avoid breaking existing persisted state.

**CRITICAL: `.strict()` vs `.passthrough()` on REST_TAB_STATE_SCHEMA**
The `REST_TAB_STATE_SCHEMA` uses TWO layers of strict validation that both reject
unknown/mismatched fields:
1. Top-level `.strict()` — rejects undeclared fields on the wrapper object
2. `entityReference()` (verzod) — fails when persisted data has different version than schema

**Fix (2026-05-28):** Changed to `.passthrough()` at ALL levels AND replaced ALL
`entityReference()` calls with `z.any()` (they were too strict for persistence).
The union discriminator (`type` literal) and structural fields remain typed; only
deeply-nested entity references become permissive. See `references/persistence-schema-validation.md`
for the complete fix details, file locations, and field-addition checklist.

**Debugging tip:** In `services/persistence/index.ts`, the error handler logs
`JSON.stringify(result.error?.issues?.slice(0, 5))` which shows the first 5 Zod
validation issues (field path + expected type). This is far more useful than
logging the raw persisted data.

## Request Panel Layout

```
RequestTab.vue
├── [debug mode] AppPaneLayout (rest-primary, horizontal split)
│   ├── #primary (top)
│   │   ├── RequestModeTabs.vue (design/debug/testcases tabs, ABOVE URL bar)
│   │   ├── Request.vue (URL bar + method + send)
│   │   └── RequestOptions.vue (params/body/headers/auth/scripts)
│   └── #secondary (bottom)
│       └── Response.vue
│
├── [design mode] Full-height flex column (NO URL bar in RequestTab)
│   ├── RequestModeTabs.vue
│   └── RequestDesignPanel.vue (owns title bar + URL bar + edit content)
│       │ Props: modelValue, tab (HoppTab), inheritedProperties
│       │  Header: [接口名称 input/h1] [StatusBadge] [divider] [模式标签] [预览/编辑按钮]
│  URL bar: HttpRequest via v-show (NOT v-if — keeps action handlers alive)
│  Content: EditView (edit mode) or PreviewView (preview mode)
│  PITFALL: PreviewView must NOT render its own title/status — parent header owns those
│           PreviewView URL row has 手动调试 + 保存 + 另存为 buttons (invokeAction)
│           Edit mode top-right button is "预览" (mode switch), NOT "保存"
│           EditView → MetaInfo + RequestOptions + ResponseSection
│           PreviewView → read-only rendering (Method+URL row, params, response)
│
└── [testcases mode] Full-height flex column (NO URL bar)
    ├── RequestModeTabs.vue
    └── RequestTestCasesPanel.vue
```

## HoppSmartWindows Tab Bar

The `HoppSmartWindows` component (from `@hoppscotch/ui`) is the main tab container used in `pages/index.vue`. Key slots:

```vue
<HoppSmartWindows v-model="currentTabID" @remove-tab="..." @add-tab="..." @sort="...">
  <HoppSmartWindow v-for="tab in activeTabs" :id="tab.id" ...>
    <template #tabhead>...</template>
    <template #suffix>...</template>
    <!-- tab content -->
  </HoppSmartWindow>
  <template #actions>
    <!-- Buttons rendered BETWEEN the "+" button and environment selector -->
  </template>
</HoppSmartWindows>
```

**`#actions` slot**: Use this to add toolbar buttons (like a "..." menu) between the built-in "+" (add tab) button and the environment selector. This is the correct place for tab-bar-level actions.

### RESTTabService Methods

Key methods on `RESTTabService` (injected via `useService(RESTTabService)`):

| Method | Description |
|--------|-------------|
| `createNewTab(document, switchToIt?)` | Create a new tab, optionally switch to it |
| `closeTab(tabID)` | Close a single tab (won't close if only tab) |
| `closeOtherTabs(tabID)` | Close all except the specified tab |
| `getDirtyTabsCount()` | Count of tabs with unsaved changes |
| `getDirtyTabs()` | Returns array of `HoppTab` objects where `document.isDirty === true` |
| `getActiveTabs()` | Returns reactive computed array of tabs |
| `setActiveTab(tabID)` | Switch to a tab |

**PITFALL: No `closeAllTabs()` method exists.** To implement "close all": create a fresh tab first, then `closeOtherTabs(newTab.id)`:
```typescript
const closeAllTabs = () => {
  const newTab = tabs.createNewTab({
    type: "request",
    request: getDefaultRESTRequest(),
    isDirty: false,
  })
  scrollService.cleanupAllScroll(newTab.id)
  tabs.closeOtherTabs(newTab.id)
}
```

### Tippy Dropdown Menu Pattern

For dropdown menus (like a "..." options menu) in the tab bar:

```vue
<tippy trigger="click" interactive theme="popover">
  <button class="flex h-full items-center justify-center px-2 text-secondary hover:text-secondaryDark">
    <component :is="IconMoreHorizontal" class="h-4 w-4" />
  </button>
  <template #content="{ hide }">
    <div class="flex flex-col focus:outline-none" tabindex="0" @keyup.escape="hide()">
      <HoppSmartItem :icon="IconXSquare" :label="t('tab.close_all')" @click="() => { action(); hide() }" />
      <HoppSmartItem :icon="IconXCircle" :label="t('tab.close_others')" @click="() => { action(); hide() }" />
    </div>
  </template>
</tippy>
```

Icon imports: `import IconMoreHorizontal from "~icons/lucide/more-horizontal"` etc.

## Production Build & Deploy

### Build
```bash
export PATH="/home/jcwl/.hermes/node/bin:$PATH"
cd /home/jcwl/workspace/hoppscotch
pnpm run --filter @hoppscotch/selfhost-web build  # ~2 min, outputs to packages/hoppscotch-selfhost-web/dist/
```

### Serve Production Build
```bash
cd packages/hoppscotch-selfhost-web
pnpm run preview --port 3003 --host 0.0.0.0  # background, serves from dist/
```

Nginx proxies port 35051 → 3003. After rebuilding, kill the old preview process and restart.

## Post-Development Verification Workflow

After completing code changes, ALWAYS verify the full stack before considering the task done:

1. **Kill stale processes**: `kill $(lsof -t -i:3170 -i:3003 -i:3101 2>/dev/null) 2>/dev/null`
2. **Start backend** (background): `cd packages/hoppscotch-backend && set -a && source ../../.env && set +a && node dist/src/main.js`
3. **Verify backend health**: `curl -s http://localhost:3170/health` must return `{"status":"ok"}`
4. **Start frontend** (background): `export PATH="$HOME/.hermes/node/bin:$PATH" && cd packages/hoppscotch-selfhost-web && pnpm run dev`
5. **Verify frontend ready**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/` must return `200`
6. **Git commit**: `git add -A && git commit --no-verify -m "..."` (use --no-verify due to pre-existing lint errors)
7. **Git push**: `git push origin dev` — **PITFALL**: GitHub push can hang/timeout in some network conditions. Use `background=true` with `notify_on_complete=true` instead of foreground, or `git push origin dev 2>&1 | cat` with a reasonable timeout. If it times out, retry — transient network issues are common.

**User preference**: The user expects this full verification cycle after every feature update. Do not stop at "code compiles" — verify both services are running and the commit is pushed.

## Common Commands

```bash
cd /home/jcwl/workspace/hoppscotch
pnpm run dev          # Start dev server
pnpm run typecheck    # Type-check all packages
pnpm run generate     # Production build
pnpm run lint         # ESLint
pnpm run lintfix      # Auto-fix lint issues
```

## Pitfalls

### User correction: "Remove X" may not mean remove ALL of X
When the user asks to remove a UI element (e.g., "去除编辑和预览按钮"), they may still want **related functionality** preserved in a simplified form. In this case, the user wanted to remove the separate edit/preview tab buttons but keep:
- The mode toggle action (save/edit buttons)
- A visible indicator of which mode is active (mode badge)

**Lesson:** When removing UI elements, always check if related state indicators or actions should be preserved. Ask "what information does the user still need to see?" and "what actions should remain accessible?" before stripping everything.

### v-model inside Splitpanes slot may silently fail
`v-model="someRef"` on a child component placed inside a `<template #primary>` slot of `AppPaneLayout` (which wraps `splitpanes`) can fail silently — the child emits `update:modelValue` but the parent ref never updates, even though the child's local prop comparison works (so CSS active states look correct). **Fix:** Replace `v-model` with explicit `:model-value` + `@update:model-value="handlerFn"` and a manual handler that does `someRef.value = newVal`. This was the root cause of Design/TestCases panels not rendering despite button active states working.

### JSON i18n duplicate keys silently override
If a locale JSON file has the same key twice at the same nesting level — once as a string (`"response_model": "Response Model"`) and once as an object (`"response_model": { "add": "..." }`) — the object silently overwrites the string. `t("key")` then returns the object (which renders as `[object Object]` or the raw key). **Fix:** Nest the string value inside the object as a sub-key (e.g., `"title"`), and update all `t()` calls to use the deeper path.

### `<icon-lucide>` is NOT a valid component — use specific imports
`<icon-lucide :icon="mode.icon">` or `<icon-lucide icon="trash-2">` will fail at runtime with `Failed to resolve component: icon-lucide`. Only `icon-lucide-<specific-name>` (e.g. `<icon-lucide-chevron-right>`) is auto-registered as a global component by unplugin-icons. The bare `<icon-lucide>` tag does not exist.

**Fix:** Import specific icon components and use `<component :is>` for dynamic icons or the component tag directly:
```vue
<script setup>
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconTrash2 from "~icons/lucide/trash-2"
</script>

<template>
  <!-- Dynamic (conditional): -->
  <component :is="expanded ? IconChevronDown : IconChevronRight" class="svg-icons" />
  <!-- Static: -->
  <IconTrash2 class="svg-icons w-3.5 h-3.5" />
</template>
```

Exception: `:icon="'icon-lucide-plus'"` as a **string prop** passed to `HoppButtonSecondary` works fine — the button component resolves icon strings internally. Only `<icon-lucide>` as a **template element** is broken.

### Conditionally hide a Splitpanes secondary pane
`AppPaneLayout` wraps Splitpanes and provides a `hide-secondary` prop that controls whether the secondary `<Pane>` renders. Under the hood: `hasSecondary = computed(() => !!slots.secondary && !props.hideSecondary)`, and the `<Pane v-if="hasSecondary">`.

**Correct pattern: Always define the `#secondary` slot, use `hide-secondary` prop for visibility.**
```vue
<AppPaneLayout layout-id="rest-primary" :hide-secondary="currentMode !== 'debug'">
  <template #primary>...</template>
  <template #secondary>
    <HttpResponse v-model:document="tab.document" :tab-id="tab.id" />
  </template>
</AppPaneLayout>
```

**PITFALL: Do NOT put `v-if` on the `<template #secondary>` slot.** This makes the slot undefined when the condition is false, so `!!slots.secondary` is falsy and `hasSecondary` is always false — even when `hide-secondary` flips back to false, Splitpanes may not re-create the Pane correctly. Always define the slot unconditionally and let `hide-secondary` control visibility.

**Fallback (if hide-secondary alone has issues):** Component-level `v-if` on `AppPaneLayout` itself with two separate layout trees (one with secondary, one without). This forces full destroy/recreate on mode switch but is heavier and duplicates the primary template.

### Tab selected-state text color — use text-accent, not text-primary
When styling custom tab buttons with a selected (active) state, do NOT use `text-primary` for the selected text color:
- `text-primary` resolves to white in most themes — invisible on white/light backgrounds (the tab has no background fill, only a bottom border indicator).
- `text-accentContrast` is also typically white — same problem.

**Correct pattern (user-corrected):** Use `text-accent font-semibold` for selected tab text with `border-b-2 border-accent` for the bottom indicator line:
```vue
:class="[
  active ? 'border-b-2 border-accent font-semibold text-accent' : 'text-secondary hover:text-secondaryDark'
]"
```

### HoppSmartTabs causes onMounted Vue warnings
`HoppSmartTabs`/`HoppSmartTab` trigger `onMounted is called when there is no active component instance` warnings in certain rendering contexts. If this happens, replace with simple custom button tabs — see `RequestModeTabs.vue` in the mode tabs reference.

### Cookie-based auth login MUST use page reload (CRITICAL)
When implementing any cookie-based login flow (password, SSO callback, etc.), the post-login state sync **must** use `window.location.reload()` — NOT `hideModal()` + `setInitialUser()`.

**Why:** `setInitialUser()` calls the GraphQL `me` query and updates `currentUser$` BehaviorSubject, but the app's reactive watchers (Login button visibility, user avatar, etc.) don't reliably re-evaluate from the in-place update. The login modal closes, but the app still shows the "Login" button and behaves as if the user is not authenticated.

**Why reload works:** Page reload triggers `performAuthInit()` → `setInitialUser()` in the normal app bootstrap sequence, which properly initializes all auth state before any components render.

**Correct pattern in Login.vue:**
```typescript
// CORRECT — matches SSO login behavior (redirect away + back)
await platform.auth.signInWithPassword(email, password)
showLoginSuccess()
window.location.reload()

// WRONG — setInitialUser() doesn't propagate to all watchers
await platform.auth.signInWithPassword(email, password)
await setInitialUser()
hideModal()
```

**In platform auth implementation:** Do NOT call `setInitialUser()` inside `signInWithPassword()` — let the page reload handle it via `performAuthInit()`.

### HoppRESTReqBody is a zod union type
`body.body` shape varies by `contentType`: null, `Array<{key,value}>` (multipart), `File|null` (binary), or `string`. Always use type guards (`typeof`, `Array.isArray`, `instanceof File`) when displaying body previews.

### Recursive Zod schemas cause TS7022 with z.lazy()
When defining a recursive schema (e.g., a tree node with `children: Node[]`), using `z.lazy()` with a self-referencing `z.ZodType<T>` annotation causes TS7022 ("implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer").

**Fix:** Define the TypeScript type separately, use `z.array(z.any())` for the recursive children field in the zod schema, and export both independently:
```typescript
// 1. Define the TS type manually
export type TreeNode = {
  name: string
  children: TreeNode[]
}

// 2. Zod schema uses z.any() for recursive children (avoids TS inference loop)
export const TreeNodeSchema = z.object({
  name: z.string().catch(""),
  children: z.array(z.any()).catch([]),
})

// 3. Use z.array(z.any()).nullable() in parent schemas that contain the tree
bodySchemaTree: z.array(z.any()).nullable().catch(null),
```

### HoppSmartTabs sticky styles break design mode scrolling
`RequestOptions.vue` (shared between debug and design modes) uses `HoppSmartTabs` with
`styles="sticky overflow-x-auto flex-shrink-0 bg-primary top-upperMobilePrimaryStickyFold sm:top-upperPrimaryStickyFold z-10"`.
This makes the tab bar (Parameters/Body/Headers) float at the top during scrolling —
correct behavior in debug mode (where the content area is bounded by the split pane),
but **wrong in design mode's EditView** (where content scrolls freely in a full-height column).

**Fix:** Make the styles conditional on `isDesignMode`:
```vue
<HoppSmartTabs
  v-model="selectedOptionTab"
  :styles="isDesignMode
    ? 'overflow-x-auto flex-shrink-0 bg-primary'
    : 'sticky overflow-x-auto flex-shrink-0 bg-primary top-upperMobilePrimaryStickyFold sm:top-upperPrimaryStickyFold z-10'"
>
```

**General rule:** Any component reused between debug mode (split pane) and design mode
(full-height scroll) must audit its `sticky`/`position: fixed`/`z-index` styles.
Sticky positioning only works correctly when there's a bounded scroll container
(the split pane's primary panel). In unbounded scroll contexts, sticky elements
float and obscure content below them.

### Design Mode (Documentation Mode) component architecture
Design mode has **edit/preview sub-modes** with a visible mode indicator badge. See `references/design-mode-architecture.md` for the full component tree and data flow.

**Key structure:**
```
RequestTab.vue                  # Only renders RequestModeTabs for design mode (NO HttpRequest)
│
RequestDesignPanel.vue          # Orchestrator: title bar + mode indicator + action + URL bar + content
│  Props: modelValue (request), tab (HoppTab), inheritedProperties, initialSubMode
│  Header row: [接口名称 input/h1] [StatusBadge] [divider] [模式标签] [保存/编辑按钮]
│  URL bar: <HttpRequest v-model="tabModel" send-label="手动调试" @send-action→debug>
│  Content: EditView (edit mode) or PreviewView (preview mode)
│
├── design/EditView.vue
│   ├── MetaInfoSection.vue    # Markdown desc (compact 80px) + TagInput + responsibility + base URL
│   ├── HttpRequestOptions.vue # REUSED from debug via properties: ["authorization","params","bodyParams","headers"]
│   └── ResponseSection.vue    # Status code tabs + SchemaTreeEditor + JsonExampleBlock (editable)
│       └── SchemaTreeEditor.vue → SchemaTreeRow.vue (recursive, has required toggle)
│
└── design/PreviewView.vue     # Read-only rendering of all sections
    └── SchemaTreeReadonly.vue + JsonExampleBlock.vue (read-only)
```

**Edit/Preview mode rules:**
- Edit mode: title is `<input>` (editable), StatusBadge `editable=true`, shows HoppButtonPrimary "预览" (switches to preview)
- Preview mode: title is `<h1>` (read-only), StatusBadge `editable=false`, shows HoppButtonSecondary "编辑" (switches to edit)
- Mode indicator badge: "编辑模式" (blue `bg-accentLight/15`) or "预览模式" (gray `bg-secondaryLight/15`)
- Both modes' save buttons call `invokeAction("request-response.save")` — the real save pipeline
- URL bar uses `v-show` (NOT `v-if`) to stay mounted in both modes — critical for action handler registration
- Preview mode URL row has 手动调试 + 保存 + 另存为 buttons (save → invokeAction, saveAs → invokeAction("request.save-as"))
- `subMode` preference persisted via `tab.document.designSubModePreference`

**Principle: Reuse debug components, don't rebuild.** When design mode needs the same CRUD UX as debug mode (Auth, Params, Headers, Body), import the debug component directly (e.g., `HttpRequestOptions`) and configure it via its `properties` prop to show only the relevant tabs.

**Principle: UI consistency across modes.** When a feature exists in both edit and preview mode (e.g., save button, URL display), use the **exact same component and styling** — not a simplified or custom version. User will correct any visual or behavioral inconsistency between modes. If edit mode uses a button group (save + dropdown), preview mode must use the same button group, not separate buttons.

**`tab` prop pattern:** DesignPanel uses `useVModel(props, "tab", emit)` → `tabModel` for the HttpRequest v-model. Never use `v-model="tab"` directly on a prop.

**StatusBadge options (6 values):** 设计中(gray) | 调试中(blue) | 测试中(yellow) | 发布(green) | 将废弃(orange) | 已废弃(red). Type: `ApiStatus = "designing" | "developing" | "testing" | "published" | "about_to_deprecate" | "deprecated"`.

### response.headers vs responseModel.headers type mismatch
`HoppRESTRequestResponse.headers` = `Array<{key, value}>` but `HoppRESTResponseModel.headers` = `Array<{key, description}>`. Map explicitly when importing: `{ key: h.key, description: h.value }`.

### useVModel bridge for embedding components that expect full request v-model
When a child component (like `HttpRequestOptions`) expects `v-model` on the full `HoppRESTRequest`, but the parent only has a prop+emit pattern, create a computed bridge:
```typescript
const localRequest = computed({
  get: () => props.request,
  set: (val: HoppRESTRequest) => emit("update:request", val),
})
```
Then use `v-model="localRequest"` on the child. This proxies all mutations from the child back to the parent's emit without needing `useVModel` at every level.

### MarkdownEditor min-height override
The shared `MarkdownEditor.vue` has `min-h-52` (208px) hardcoded. When embedding it in compact sections, override with scoped `:deep()`:
```css
.desc-editor :deep(.min-h-52) { min-height: 80px !important; padding: 0.5rem 0.75rem !important; }
.desc-editor :deep(textarea) { min-height: 80px !important; }
```

### Request.vue sendLabel prop for custom button per mode
`Request.vue` (the URL bar) accepts a `sendLabel` prop and `@send-action` emit to customize the primary button's behavior per context. When `sendLabel` is set, the button shows that text instead of "Send" and emits `sendAction` instead of firing the HTTP request:

```vue
<!-- In parent (RequestTab.vue): -->
<HttpRequest
  v-model="tab"
  send-label="手动调试"
  @send-action="currentMode = 'debug'"
/>
```

Inside Request.vue, the `onSendClick` handler checks: if `sendLabel` is set, emit `sendAction`; otherwise run normal send/cancel logic. This pattern avoids duplicating the Method+URL bar while giving each mode a context-specific action.

### Tab document preference persistence
To persist a UI preference per-tab (survives tab close/reopen):
1. Add field to `HoppRequestDocument` in `helpers/rest/document.ts`
2. Add to persistence validation schema in `services/persistence/validation-schemas/index.ts` as `z.optional(...)` — **MUST also add to the inner doc-type schema in the union (not just top-level)**
3. Read it in RequestTab via `tab.value.document.fieldName ?? defaultValue`
4. Write it back on change via handler: `tab.value.document.fieldName = newVal`

**PITFALL:** If you forget step 2, the `.strict()` mode on the schema (now changed to `.passthrough()` at top-level but still strict on inner objects) will cause a "Schema validation failed" toast on page load. The error log in the console shows Zod issues — look for the specific field path.

Example: `modePreference?: "debug" | "design" | "testcases"` — persisted so the request opens in the same mode next time.

### Pre-commit hook blocked by pre-existing lint errors
The pre-commit hook runs `pnpm -r do-lint && pnpm -r do-typecheck` which lints ALL packages. Many files in the repo have pre-existing prettier/eslint errors (70+ errors in hoppscotch-common alone). These block YOUR commit even if your own files are clean.

**Fix workflow:**
1. Format your changed files first: `packages/hoppscotch-common/node_modules/.bin/prettier --write <your-files>`
2. Commit with `git commit --no-verify -m "..."` to bypass the pre-commit hook
3. Verify with `pnpm run typecheck` separately (this one should pass)

Note: `pnpm run typecheck` is reliable and should always pass. Only the lint step has pre-existing issues.

### v-model on prop causes Vue compiler error (FATAL)
Using `v-model="someProp"` directly on a prop in a Vue SFC template causes a **fatal compilation error** that blocks the entire app from rendering:
```
v-model cannot be used on a prop, because local prop bindings are not writable.
Use a v-bind binding combined with a v-on listener that emits update:x event instead.
```
This shows as a Vite error overlay that makes the page completely blank.

**Fix:** Use `useVModel` from `@vueuse/core` to create a writable ref, then use that ref in the template:
```vue
<script setup lang="ts">
import { useVModel } from "@vueuse/core"

const props = defineProps<{ tab: SomeType }>()
const emit = defineEmits<{ (e: "update:tab", val: SomeType): void }>()
const tabModel = useVModel(props, "tab", emit)
</script>

<template>
  <ChildComponent v-model="tabModel" />
</template>
```

The parent must also use `v-model:tab="tab"` (not `:tab="tab"`) to establish two-way binding.

**Common trigger:** Passing the `tab` prop through to a child component like `<HttpRequest v-model="tab">`. Always wrap with `useVModel` first.

### Vite HMR fails to detect file changes after edits
After editing `.vue` files via patch/write_file, Vite's HMR sometimes does not recompile the changed files — the old error overlay persists even though the source file has been updated. This is especially common when:
- Multiple files were changed in quick succession
- The error was a compilation error (not a runtime error)

**Fix:** Kill and restart the dev server:
```bash
kill $(lsof -t -i:3003 2>/dev/null) 2>/dev/null
sleep 1
cd packages/hoppscotch-selfhost-web && pnpm run dev  # background
```
Then hard-refresh the browser (navigate to the URL again).

### Custom dropdown components: onClickOutside class must match wrapper
When building a custom dropdown (like `StatusBadge.vue`) with click-outside-to-close behavior, the `onClickOutside` handler typically checks for a CSS class on the wrapper element:
```javascript
function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest(".status-badge-wrapper")) {
    showDropdown.value = false
  }
}
```

**PITFALL:** If the wrapper element doesn't have the expected class, clicking the badge itself will trigger `onClickOutside` and immediately close the dropdown — making it seem like the dropdown doesn't work at all.

**Fix:**
1. Ensure the outermost wrapper element has the class referenced in `onClickOutside`:
   ```vue
   <div class="relative inline-block status-badge-wrapper">
     <span @click="toggleDropdown">...</span>
     <div v-if="showDropdown">...</div>
   </div>
   ```
2. Add `@click.stop` on dropdown item buttons to prevent event bubbling to the document-level click handler:
   ```vue
   <button @click.stop="selectStatus(option.value)">...</button>
   ```
3. The wrapper div must use `position: relative` (via `relative` class) so the absolutely-positioned dropdown anchors correctly.

### invokeAction for save — use request-response.save, not manual mode switching
When implementing a "save" button for request editing, do NOT just switch sub-modes (e.g., `subMode = "preview"`). Instead, call the global save action:

```typescript
import { invokeAction } from "~/helpers/actions"

function onSave() {
  invokeAction("request-response.save")
}

function onSaveAs() {
  invokeAction("request.save-as")  // Always opens save dialog
}
```

`request-response.save` triggers the full pipeline — if the request has a `saveContext`, it updates in-place; if not, it opens the save dialog. `request.save-as` always opens the dialog for choosing a new location. Both actions are registered by `Request.vue` via `defineActionHandler` — **see the v-if vs v-show pitfall below**.

### v-if vs v-show for components that register action handlers (CRITICAL)
`Request.vue` registers global action handlers via `defineActionHandler("request-response.save", saveRequest)` and renders the `CollectionsSaveRequest` modal. If `Request.vue` is conditionally hidden with `v-if`, it gets **unmounted** — which:
1. Unregisters the action handlers → `invokeAction("request-response.save")` silently does nothing
2. Removes the save modal from the DOM → save dialog never appears

**Fix:** Use `v-show` instead of `v-if` to keep the component mounted but visually hidden:
```vue
<!-- WRONG: unmounts in preview mode, save stops working -->
<div v-if="subMode === 'edit'" class="shrink-0">
  <HttpRequest v-model="tabModel" ... />
</div>

<!-- CORRECT: stays mounted, handlers alive, just hidden -->
<div v-show="subMode === 'edit'" class="shrink-0">
  <HttpRequest v-model="tabModel" ... />
</div>
```

**General rule:** Any component that registers global actions, provides context, or renders modals needed by other modes should use `v-show`, not `v-if`.

### input vs h1 conditional rendering causes sibling element misalignment
When a title is conditionally rendered as `<input>` (edit mode) or `<h1>` (preview mode), the two elements have different default box models:
- `<input>`: has browser default padding (~2px), border (~2px), and intrinsic width from `size` attribute (default 20ch)
- `<h1>`: has browser default margin (~0.67em top/bottom) but no padding/border

This causes sibling elements (like StatusBadge) to appear at different horizontal/vertical positions between modes, even with identical flex layout.

**Fix — normalize both elements to the same box model:**
```vue
<input
  :value="title"
  :size="Math.max((title || 'placeholder').length, 4)"
  class="text-lg font-bold bg-transparent outline-none border-0 p-0 m-0 leading-none"
/>
<h1 class="text-lg font-bold truncate m-0 p-0 leading-none">
  {{ title }}
</h1>
```

Key classes: `border-0 p-0 m-0 leading-none` on both elements. Additionally, bind `:size` on `<input>` to the text length so the input width matches the rendered `<h1>` width (otherwise the default size=20 pushes siblings far right).

### save-as-example must include pathParams (CRITICAL)
When implementing "Save as Example" (saving a debug response as a named example), the
`makeHoppRESTResponseOriginalRequest()` call MUST include `pathParams` from the original
request. Omitting pathParams causes the saved example to lose URL path parameter values,
and the "Try" button (which opens the example in a new debug tab) also loses them.

**Affected locations:**
1. `Response.vue` → `onSaveAsExample()` — constructs `HoppRESTResponseOriginalRequest`
2. `Request.vue` → save-as-example dropdown handler — same constructor call
3. `example/ResponseRequest.vue` → `tryExampleResponse()` — opens example in new tab

All three must destructure and pass `pathParams` from the source request. The
`makeHoppRESTResponseOriginalRequest()` helper accepts `pathParams` as an optional field
(added in a later verzod version), so it defaults to `undefined` if omitted — which
means "no path params" rather than "inherit from parent".

### Use HoppButtonPrimary/HoppButtonSecondary instead of raw `<button>`
Raw `<button>` elements have different padding/height than Hoppscotch's button components. When a custom button sits next to a `HoppButtonPrimary` (e.g., the "手动调试" send button in the URL bar), the size mismatch is visually jarring.

**Fix:** Use the auto-imported `HoppButtonPrimary` and `HoppButtonSecondary` components:
```vue
<HoppButtonPrimary :label="'保存'" class="shrink-0" @click="onSave" />
<HoppButtonSecondary :label="'编辑'" class="shrink-0" @click="subMode = 'edit'" />
```
These are auto-imported from `@hoppscotch/ui` — no manual import needed. They match the sizing of buttons in the URL bar and other standard UI elements.

### Conditional UI based on server state — "set" vs "modify" pattern (USER PREFERENCE)
When a feature has a "first-time setup" mode and a "modification" mode (e.g., setting a password for the first time vs. changing an existing password), do NOT show the same form for both. The user expects:

- **First-time setup**: Only the fields needed for the action (e.g., new password + confirm). No "old value" field.
- **Modification**: Includes verification of existing state (e.g., old password + new password + confirm).

**Implementation pattern:**
1. Add a backend `GET /resource/status` endpoint that returns `{ hasX: boolean }`
2. Add the method to `AuthPlatformDef` interface as optional: `getStatus?: () => Promise<{ hasX: boolean }>`
3. Implement in the platform layer (e.g., `selfhost-web/src/platform/auth/web/index.ts`)
4. In the Vue component, use `onMounted` to fetch the status, store in a `ref<boolean>`
5. Conditionally render form fields with `v-if="hasExisting"` / `v-else`
6. Button labels and modal titles also change based on the mode

**Anti-pattern (user-corrected):** Showing the same "change password" form (with old password field) when the user hasn't set a password yet. The user will say "首次设置密码的时候，不应该有新密码的输入框，应该直接设置."

### Cookie-based auth login MUST use page reload (CRITICAL)
When implementing any cookie-based login flow (password, SSO callback, etc.), the post-login state sync **must** use `window.location.reload()` — NOT `hideModal()` + `setInitialUser()`.

**Why:** `setInitialUser()` calls the GraphQL `me` query and updates `currentUser$` BehaviorSubject, but the app's reactive watchers (Login button visibility, user avatar, etc.) don't reliably re-evaluate from the in-place update. The login modal closes, but the app still shows the "Login" button and behaves as if the user is not authenticated.

**Why reload works:** Page reload triggers `performAuthInit()` → `setInitialUser()` in the normal app bootstrap sequence, which properly initializes all auth state before any components render.

**Correct pattern in Login.vue:**
```typescript
// CORRECT — matches SSO login behavior (redirect away + back)
await platform.auth.signInWithPassword(email, password)
showLoginSuccess()
window.location.reload()

// WRONG — setInitialUser() doesn't propagate to all watchers
await platform.auth.signInWithPassword(email, password)
await setInitialUser()
hideModal()
```

**In platform auth implementation:** Do NOT call `setInitialUser()` inside `signInWithPassword()` — let the page reload handle it via `performAuthInit()`.

### ensureMethodInEndpoint adds `https://` to relative paths — breaks service URL resolution
`Request.vue` → `ensureMethodInEndpoint()` (line ~525) auto-adds `https://` to endpoints
that don't start with `http://` or `https://`. But it does NOT skip relative paths
(starting with `/`), causing:
1. `/api/users` → `https:///api/users` (triple slash)
2. `getEffectiveRESTRequest()` detects `https://` prefix → skips service URL prepend
3. Result: prefix URL is lost, request goes to invalid URL

**Fix:** Add early return for relative paths:
```typescript
const ensureMethodInEndpoint = () => {
  const endpoint = newEndpoint.value.trim()
  tab.value.document.request.endpoint = endpoint
  if (!/^http[s]?:\/\//.test(endpoint) && !endpoint.startsWith("<<")) {
    // Relative paths (starting with /) should NOT get protocol prefix
    // — service URL will be prepended by getEffectiveRESTRequest()
    if (endpoint.startsWith("/")) return
    const domain = endpoint.split(/[/:#?]+/)[0]
    // ... rest of existing logic
  }
}
```

**Related:** The same function runs when the user clicks "Send" in debug mode. If design
mode has `v-show` on the URL bar (which keeps HttpRequest mounted), switching to debug
mode and clicking Send will corrupt the endpoint. The design mode's prefix URL (set in
MetaInfoSection via `inheritedBaseUrl`) is preserved on the request object, but the
endpoint field itself gets polluted.

### Background process PATH (Hoppscotch services)
When launching Hoppscotch services via `terminal(background=true)`, the shell PATH does NOT include `/home/jcwl/.hermes/node/bin` where `node` and `pnpm` live. Always prepend:
```bash
export PATH="/home/jcwl/.hermes/node/bin:$PATH" && cd <package> && pnpm run dev
```
Without this, the process exits immediately with `bash: node: command not found` or `bash: pnpm: command not found`.

### Frontend stuck on loading spinner — rebuild hoppscotch-data
**Symptom:** Frontend loads (HTTP 200), shows Hoppscotch logo with spinning loader, but never renders the main UI. No JavaScript errors in console. Vue router shows `currentMatched: 0` (no route matched).

**Root cause:** `hoppscotch-data` package dist is stale — missing newly added exports (e.g., `MarkdownDocSchema`). When a route's lazy-loaded component imports from `hoppscotch-data`, the import fails silently during route resolution, preventing the route from matching.

**Diagnosis:** In browser console, manually trigger a route push:
```javascript
(async () => {
  const vueApp = document.querySelector('#app').__vue_app__;
  const router = vueApp.config.globalProperties.$router;
  try {
    await router.push('/');
    return JSON.stringify({ success: true, matched: router.currentRoute.value.matched.length });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
})()
```
If it returns an error like `"does not provide an export named 'X'"`, the hoppscotch-data package needs rebuilding.

**Fix:**
```bash
cd packages/hoppscotch-data && pnpm run build  # ~2s, rebuilds dist/
# Then kill and restart frontend dev server
kill $(lsof -t -i:3003 2>/dev/null) 2>/dev/null
sleep 1
export PATH="/home/jcwl/.hermes/node/bin:$PATH" && cd packages/hoppscotch-selfhost-web && pnpm run dev  # background
```

**Prevention:** After ANY change to `packages/hoppscotch-data/src/` (new schemas, types, verzod versions), ALWAYS run `pnpm run build` in that package before testing frontend. The dev server does NOT auto-rebuild hoppscotch-data.

### Backend startup — .env file integrity
**Symptom:** Backend crashes immediately with `DATABASE_URL environment variable is not set`.

**Common causes:**
1. **Corrupted .env file** — Check if file has line numbers prepended (e.g., `3|DATABASE_URL=...` instead of `DATABASE_URL=...`). This can happen if the file was accidentally edited with an editor that added line numbers. Fix: copy from root `.env` or restore from git.
2. **Environment variables not loaded** — The backend's `node dist/src/main` does NOT auto-load `.env`. You must either:
   - Use `set -a && source .env && set +a && node dist/src/main` (if .env is clean)
   - Or: `export $(grep -v '^#' .env | grep -v '^$' | xargs) && node dist/src/main` (more robust, handles comments)

**Verification:** Backend logs should show `Port: 3170` (not `Port: undefined`). If Port is undefined, env vars are not loaded correctly.

**Correct startup sequence:**
```bash
# 1. Verify .env file is clean
head -3 packages/hoppscotch-backend/.env  # Should NOT have line numbers

# 2. Start backend with env vars loaded
export PATH="/home/jcwl/.hermes/node/bin:$PATH"
cd packages/hoppscotch-backend
export $(grep -v '^#' .env | grep -v '^$' | xargs) && node dist/src/main  # background

# 3. Verify health
curl -s http://localhost:3170/health  # Should return {"status":"ok"}
```

### Virtual vs stored examples — "auto" badge pattern (USER PREFERENCE)
Design mode examples (both request body and response) use a virtual-to-stored pattern:
- **Virtual default**: Auto-generated from schema tree, shown with an "auto" badge, **fully interactive**
- **Stored examples**: User-created, persisted in `bodyExamples[]` or `responseModels[].examples[]`

**User-corrected behavior:** The default example is NOT read-only. It should be **fully editable, renamable, and deletable** like any other example. The "auto" badge only indicates it was auto-generated, not that it can't be modified. When the user edits or renames the virtual default, it materializes into a stored example.

**CRITICAL: Editing the virtual default must PRESERVE it + create a new tab.**
When the user edits the virtual default example (no stored examples exist yet), the
`onBodyExampleContentUpdate()` handler must:
1. Keep the original auto-generated default as the first example (using `defaultExampleContent.value`)
2. Create a NEW second example with the user's edited content
3. Switch `activeBodyExampleTab` to index 1 (the new edited tab)

```typescript
// CORRECT — preserves auto-generated default + creates user's version
if (!hasStoredBodyExamples.value) {
  const examples = [
    { name: t("body_examples.default_example"), body: defaultExampleContent.value, ... },
    { name: t("body_examples.example_n", { n: "2" }), body: val, ... },
  ]
  updateRequest({ bodyExamples: examples })
  activeBodyExampleTab.value = 1
}

// WRONG — overwrites the default with user content, auto-generated example lost forever
if (!hasStoredBodyExamples.value) {
  const examples = [{ name: "默认示例", body: val, ... }]  // BUG: default gone
  updateRequest({ bodyExamples: examples })
}
```

This ensures the default example always reflects the current schema, while the user's
edit becomes a separate stored example.

**Tab UI:** All examples (virtual + stored) appear in a unified tab bar. Double-click to rename, × button to delete (when >1), + button to add. See `references/design-mode-examples-pattern.md` for the full implementation.

**Edit-only features:** Certain features (like the beautify/format button) should ONLY appear in edit mode, not preview mode. Use `v-if="editable"` on the button. Preview mode is read-only for content modification.

### Tab selected-state styling — use text-accent, not text-primary (USER PREFERENCE)
When styling custom tab buttons (example tabs, status tabs, etc.) with a selected/active state:
- **DO NOT use:** `border-accentLight font-bold text-primary` — `text-primary` resolves to white in most themes, making selected tabs invisible on light backgrounds
- **DO use:** `border-accent font-semibold text-accent` — accent color is visible and consistent

**Correct pattern:**
```vue
:class="[
  activeIndex === idx
    ? 'border-b-2 border-accent font-semibold text-accent'
    : 'text-secondary hover:text-secondaryDark'
]"
```

This applies to any custom tab implementation (example selector tabs, response status tabs, etc.).

### Environment v3 variable shape (NOT legacy { key, value, secret })
When constructing Environment objects programmatically (e.g., in importers like `importEnvironments()`), variables **must** use the v3 shape: `{ key, initialValue, currentValue, secret }`. Do NOT use the legacy `{ key, value, secret }` shape — the `value` field is not recognized by `parseTemplateString()`, which looks for `currentValue`. This causes imported environment variables to silently fail to resolve in template strings.

```typescript
// CORRECT — v3 shape
const envVar = { key: "BASE_URL", initialValue: "https://...", currentValue: "https://...", secret: false }

// WRONG — legacy shape, parseTemplateString() ignores this
const envVar = { key: "BASE_URL", value: "https://...", secret: false }
```

### Typecheck scope is limited (type-check.mjs)
`pnpm run typecheck` (via `type-check.mjs`) only checks `src/services` and `src/helpers/auth` directories. Code in `src/helpers/import-export/` and other directories is **NOT** type-checked. This means type errors (e.g., wrong Environment variable shape) in uncovered directories are silently ignored.

**Fix:** Always manually verify type correctness for code in uncovered directories. Consider adding new directories to `type-check.mjs` if they contain critical logic.

### Subscription lifecycle in async workflows
When creating subscriptions (e.g., `reloadSub` in `ImportApifoxModal.vue`) inside async functions, store the subscription reference at **component scope** and clean it up in `onBeforeUnmount`. Do NOT rely solely on `setTimeout` fallbacks for cleanup — if the component unmounts before the timeout fires, the subscription leaks.

```typescript
// CORRECT
let reloadSub: Subscription | null = null

async function startImport() {
  reloadSub = someObservable$.subscribe(...)
}

onBeforeUnmount(() => { reloadSub?.unsubscribe() })
```

## Skill Appendix（执行提醒）

> 这些是执行层面的提醒，不是 skill 本身的缺陷。在执行任务时注意检查。

- ⚠️ **导出函数必须被调用**：当实现跨文件数据流功能时（如 exporter function + consumer component），务必验证每个导出的工具函数确实在集成点被调用了。曾有 `buildServerToServiceMap()` 被导出但从未调用，导致 service binding 功能完全无效。
- ⚠️ **多环境映射覆盖完整性**：当构建跨实体映射（如 serverId→serviceId）时，验证所有源实体都被覆盖，不仅仅是第一个。曾有 `buildServerToServiceMap()` 只映射第一个环境的 baseUrls，导致其他环境的 collection 无法获取正确的 selectedServiceId。考虑遍历所有环境或使用 per-environment 方案。

### Sequential dirty-tab save prompt pattern
When implementing "close all" or "close others" with per-tab save prompts (instead of a single bulk confirm dialog), use a queue-based approach:

1. **State**: `dirtyTabsQueue: ref<string[]>`, `currentDirtyTabIndex: ref<number>`, `pendingCloseOperation: ref<CloseOperation | null>`
2. **Flow**: Collect dirty tab IDs → show modal for tab at current index → user picks Save/Don't Save/Cancel → advance index → when all processed, execute close operation
3. **Modal**: Show progress (e.g. "2 / 5"), tab name, and 3 buttons (Save / Don't Save / Cancel)
4. **Save path**: If tab has `saveContext`, call `invokeAction("request-response.save")` directly; if not, open `CollectionsSaveRequest` modal and advance on modal close
5. **Cancel**: Aborts entire operation (clears queue and pending operation)

**PITFALL**: `onSaveModalClose` must branch — check if batch mode is active (`showDirtyTabPrompt`) before handling single-tab close. Otherwise saving during batch mode will try to close a `confirmingCloseForTabID` that isn't set.

**i18n**: Add `confirm.save_unsaved_tab_named` with `{name}` interpolation for the per-tab prompt.

### Markdown editor: md-editor-v3 (NOT editor.md)
When adding Markdown editing to Hoppscotch, use **md-editor-v3** — NOT editor.md.

**Why not editor.md**: jQuery dependency (~87KB), last updated 2019, no TypeScript types, incompatible with Vue 3 reactivity. Integration cost is prohibitive.

**md-editor-v3 advantages**:
- Vue 3 + TypeScript native, zero adaptation cost
- Built-in dark theme (`theme="dark"`)
- Toolbar + live preview + split-screen modes
- ~150KB gzip (lighter than editor.md + jQuery)
- Actively maintained (2024+ updates)
- Standard `v-model` support

**Install**: `pnpm add md-editor-v3`
**Usage**:
```vue
<template>
  <MdEditor v-model="content" theme="dark" style="height: 500px" />
</template>
<script setup lang="ts">
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
</script>
```

**Other alternatives evaluated**: @bytemd/vue-next (ByteDance, plugin-based, minimal), cherry-markdown (Tencent, feature-rich but 300KB+), milkdown (framework-agnostic, heavy customization needed). md-editor-v3 is the best balance for Hoppscotch.

### Design mode edit view — disable ALL sticky headers with `:deep()` override
In design mode edit view, ALL section headers (Parameters column header, Headers header, Body header, PathParams header, etc.) should scroll naturally with the page. The debug mode relies on `sticky` positioning for tab bars, but design mode's full-page scroll makes sticky headers float and obstruct content.

**Fix:** Add a scoped CSS override in `EditView.vue` that disables sticky on ALL descendants:
```vue
<style scoped>
:deep(.sticky) {
  position: relative !important;
  top: auto !important;
}
</style>
```

This is a **single-line fix** that covers ALL sub-components (Parameters.vue, Headers.vue, Body.vue, PathParams.vue, DesignBody.vue, etc.) without needing to add an `isDesignMode` prop to each one. The `HoppSmartTabs` in `RequestOptions.vue` should ALSO be conditionally de-sticked via its `styles` prop (as done in the initial sticky fix), but this `:deep()` override catches any remaining sticky elements in child components.

**PITFALL:** Only apply this in `EditView.vue` (design mode edit sub-view). Do NOT put it in `RequestDesignPanel.vue` or `RequestTab.vue` — that would affect debug mode and preview mode too.

### Corrupted persisted tab data causes white screen (CRITICAL)
**Symptom:** Page loads (HTTP 200, Vue app mounts) but crashes to white screen with errors like:
- `Cannot read properties of undefined (reading 'name')` at `index.vue:getTabName`
- `Cannot read properties of undefined (reading 'requestVariables')` at `EnvInput.vue`
- `Cannot read properties of undefined (reading 'pathParams')` at `EnvInput.vue`

**Root cause:** IndexedDB stores tab data (restTabs/gqlTabs). If a tab's `document.request` (or `document.response`, `document.collection`) is `undefined` — e.g., from a partial save, migration bug, or storage corruption — multiple components crash when they access `document.request.name`, `document.request.pathParams`, `document.request.requestVariables` etc.

**Defense-in-depth fix (3 layers):**

1. **Tab loading validation** (`services/tab/tab.ts` → `loadTabsFromPersistedState`):
```typescript
for (const doc of data.orderedDocs) {
  const d = doc.doc as any
  if (!d || !d.type) continue  // skip completely broken docs
  if (d.type === "request" && !d.request) continue  // request tab without request
  if (d.type === "example-response" && !d.response) continue
  if (d.type === "test-runner" && !d.collection) continue
  // ... load valid tab
}
// Fallback if all tabs corrupted:
if (this.tabOrdering.value.length === 0) {
  this.currentTabID.value = ""  // app will create default tab
} else if (!this.tabMap.has(data.lastActiveTabID)) {
  this.setActiveTab(this.tabOrdering.value[0])  // last active was corrupted
} else {
  this.setActiveTab(data.lastActiveTabID)
}
```

2. **UI component defensive access** (`pages/index.vue` → `getTabName`):
```typescript
const getTabName = (tab) => {
  if (tab.document.type === "request") return tab.document.request?.name ?? "Untitled"
  if (tab.document.type === "test-runner") return tab.document.collection?.name ?? "Test Runner"
  if (tab.document.type === "example-response") return tab.document.response?.name ?? "Example"
  if (tab.document.type === "markdown-doc") return tab.document.name ?? "Untitled Doc"
  return "Unnamed tab"
}
```

3. **Computed properties** (`components/smart/EnvInput.vue`):
```typescript
const rawRequestVars = isRequest
  ? document.request?.requestVariables ?? []
  : isExample
    ? document.response?.originalRequest?.requestVariables ?? []
    : []
const pathParams = isRequest
  ? document.request?.pathParams ?? []
  : isExample
    ? document.response?.originalRequest?.pathParams ?? []
    : []
```

**User-facing workaround:** Clear IndexedDB → Application → IndexedDB → delete `121.41.26.6:35051.hoppscotch.store`.

**General rule:** Any code that reads `tab.document.request.*`, `tab.document.response.*`, or `tab.document.collection.*` from persisted data MUST use optional chaining (`?.`) and nullish coalescing (`??`) — persisted data can be partially corrupt.

### Markdown document feature — md-editor-v3 + HoppCollection verzod v14
Hoppscotch supports adding Markdown documents to collections (alongside requests and folders). Technical decisions:

**Editor:** `md-editor-v3` (Vue 3 native, dark theme, toolbar + live preview, ~150KB gzip). NOT editor.md (jQuery dependency, last updated 2019).
```bash
pnpm add md-editor-v3
```
```vue
<MdEditor v-model="content" theme="dark" style="height: 500px" />
import "md-editor-v3/lib/style.css"
```

**Data model:** HoppCollection verzod v14 adds `markdownDocs: Array<{ id: string, name: string, content: string }>`. Migration from v13: `markdownDocs: []` default.

**3-phase implementation:**
1. **Phase 1**: verzod v14 + md-editor-v3 install + base MarkdownDoc.vue editor component
2. **Phase 2**: Sidebar integration (new button in Collection.vue/FolderItem, tree rendering of markdownDocs nodes) + Tab/Document model (`HoppMarkdownDocDocument` type, `MarkdownDocTab.vue`)
3. **Phase 3**: Team collection GraphQL sync + import/export compatibility

**Key files:**
- `packages/hoppscotch-data/src/collection/v/14.ts` — verzod version
- `packages/hoppscotch-data/src/collection/index.ts` — register v14
- `packages/hoppscotch-common/src/components/collections/MarkdownDoc.vue` — editor component
- `packages/hoppscotch-common/src/components/collections/Collection.vue` — sidebar new button
- `packages/hoppscotch-common/src/helpers/rest/document.ts` — HoppMarkdownDocDocument type

### User preference: Direct deploy without kanban
When the user is NOT using the kanban/orchestrator workflow (common for small UI tweaks and quick iterations), implement the change and deploy directly — do NOT create kanban cards or go through the 3-stage delivery flow. The user wants fast feedback: code → build → deploy → test in browser.

### User preference: Direct technology recommendations with comparison
When the user asks "有没有更加适合的X框架", provide a direct comparison table with recommendation — NOT a lengthy research task. Include: library name, size, key features, suitability, and a clear recommendation with reasoning. User makes fast decisions from structured comparisons.

### Design mode sticky tabs — conditional via isDesignMode prop
`RequestOptions.vue` accepts an `isDesignMode` prop. When true, the `HoppSmartTabs` bar removes sticky positioning so tabs scroll naturally with the page content (instead of sticking to the top). This prevents tab bars from overlapping content when scrolling through long API documentation in edit mode.

```vue
<!-- RequestOptions.vue -->
<HoppSmartTabs
  :styles="isDesignMode
    ? 'overflow-x-auto flex-shrink-0 bg-primary'
    : 'sticky overflow-x-auto flex-shrink-0 bg-primary top-upperMobilePrimaryStickyFold sm:top-upperPrimaryStickyFold z-10'"
>
```

In debug mode, `isDesignMode` defaults to `false`, preserving the original sticky behavior.

### Save as Example in debug mode (Request.vue)
The Save button dropdown in `Request.vue` includes a "Save as Example" option (after "Save As"). This saves the current request parameters + response as an example on the request's `responses` object — functionally equivalent to the "Add Example" feature in the sidebar collection tree.

**Conditions:** Only visible/enabled when `response?.type === "success"` (a successful response exists).
**Flow:** Click → SaveResponseName modal → enter name → saves to `request.responses[name]` + updates `responseModels[].examples` for Design mode compatibility.
**Key:** Uses `makeHoppRESTResponseOriginalRequest()` with ALL fields including `pathParams` — omitting pathParams was a bug caught in testing.

**PITFALL: saveContext null causes silent failure.** `onSaveAsExample()` (line ~737) checks `const saveCtx = tab.value.document.saveContext; if (!saveCtx) return` — if the request hasn't been saved to a collection yet, saveContext is null and the function silently returns without saving the example or showing any error. **Fix:** Show a toast error before returning: `toast.error(t("response.save_example_requires_save"))` so the user knows they must save the request to a collection first.

### Example display — full request params + save
`example/ResponseTab.vue` includes `HttpRequestOptions` with editable params/body/headers/auth tabs below the URL bar. `example/ResponseRequest.vue` has both Try and Save buttons. The Save button persists modified `originalRequest` back to the parent request's `responses[exampleName]` in the collection.

**Type bridge:** `RequestOptions.vue` accepts `HoppRESTRequest | HoppRESTResponseOriginalRequest` as `modelValue`. A computed bridge in `ResponseTab.vue` maps `tab.document.response.originalRequest` to the component.

**Save flow:**
1. User-collection: Read parent request from `restCollectionStore` via `navigateToFolderWithIndexPath`, clone, update `responses[name].originalRequest`, call `editRESTRequest(folderPath, requestIndex, updatedRequest)`
2. Team-collection: Fetch via `getSingleRequest(requestID)`, parse JSON, update response, save via `updateTeamRequest(requestID, { request: JSON.stringify(req), title })`
3. Both paths use `taskToPromise()` helper to convert fp-ts `TaskEither` to native `Promise`

**Dirty state:** The existing deep watch on `tab.document.response` (which includes `originalRequest`) automatically sets `isDirty = true` when any request parameter changes. The Save button is disabled when `!isDirty`.

### Web Component (Custom Element) integration in Vue 3
When embedding a third-party Web Component (e.g., `<erd-editor>`) in Hoppscotch's Vue 3 app, Vue will warn "Failed to resolve component" unless you tell the compiler to skip that tag.

**Fix:** Configure `isCustomElement` in `packages/hoppscotch-selfhost-web/vite.config.ts`:
```typescript
Vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'erd-editor',
    },
  },
}),
```

**Closed shadow root:** Some Web Components (like erd-editor) use `shadow: "closed"` mode. This means `element.shadowRoot` returns `null` — this is **normal, not a bug**. The element still renders and functions correctly. Use `customElements.get('erd-editor')` to verify registration.

### pnpm store location mismatch (different HOME)
When running `pnpm` from a shell with a different `$HOME` (e.g., Hermes agent profiles), pnpm may fail with `ERR_PNPM_UNEXPECTED_STORE` because it wants to use the profile-specific store.

**Fix:**
```bash
export HOME="/home/jcwl"  # Set explicit HOME
# OR set store-dir globally:
pnpm config set store-dir /home/jcwl/.local/share/pnpm/store/v10 --global
```

### File-based routing (vite-plugin-pages)
Hoppscotch uses `vite-plugin-pages` with `routeStyle: "nuxt"`. Routes are auto-generated from `.vue` files in `packages/hoppscotch-common/src/pages/`. Adding a new file (e.g., `erd.vue`) automatically registers `/erd`.

**PITFALL:** The dev server must be **restarted** to detect new page files. Vite HMR does NOT pick up new route files — kill and restart the dev server after adding pages.

### Sidebar navigation (Sidenav.vue)
The left sidebar is defined in `components/app/Sidenav.vue` via a `primaryNavigation` array:
```typescript
const primaryNavigation = [
  { target: "/", svg: IconLink2, title: "navigation.rest", exact: true },
  { target: "/graphql", svg: IconGraphql, title: "navigation.graphql", exact: false },
  { target: "/realtime", svg: IconGlobe, title: "navigation.realtime", exact: false },
  { target: "/erd", svg: IconDatabase, title: "navigation.erd", exact: false },
  { target: "/settings", svg: IconSettings, title: "navigation.settings", exact: false },
]
```
Icons use `~icons/lucide/<name>` (unplugin-icons). Add to all 32 locale JSON files under `navigation.<key>`.

### ER Diagram feature (erd-editor)
ER diagram editing is integrated via `@dineug/erd-editor` v3.3.0 Web Component at `/erd`. See `references/erd-editor-integration.md` for full integration details (schema format, API methods, floating toolbar pattern, build output).

### v-tippy does NOT work on native `<button>` in scoped components (use title instead)
When building floating/overlay toolbars with native `<button>` elements inside scoped Vue components, `v-tippy` directives are silently ignored — the tooltip never appears. This is because `v-tippy` (vue-tippy) relies on Vue's directive system which doesn't reliably attach to native elements inside scoped styles.

**Fix:** Use the native `title` attribute instead:
```vue
<!-- WRONG: v-tippy silently ignored on native button -->
<button v-tippy="{ content: t('erd.import_json') }" class="toolbar-icon-btn">

<!-- CORRECT: native title attribute always works -->
<button :title="t('erd.import_json')" class="toolbar-icon-btn">
```

`v-tippy` works fine on Hoppscotch UI components (`HoppButtonSecondary`, `HoppSmartItem`) because they handle the directive internally. Only native HTML elements are affected.

### User preference: Compact icon-only toolbars over text buttons (MINIMAL UI)
When implementing action toolbars, the user prefers **compact icon-only buttons** over labeled text buttons (like `HoppButtonSecondary` with `:label`). Icon buttons should use `title` attribute for hover tooltips. Group related actions with thin dividers. This applies to any floating/overlay toolbar (e.g., over an editor canvas).

**Anti-pattern (user-corrected):** Full-width toolbar row with labeled buttons (`Import JSON | Import SQL | Export SQL | Export JSON | Clear`) — takes too much vertical space and looks cluttered.

**Preferred pattern:** Floating icon toolbar positioned top-right of the content area:
```
[📄] [📄] | [📄⬇] [📄⬇] | [🗑]
```
Semi-transparent dark background with `backdrop-filter: blur()`, 28×28px buttons, danger style (red hover) on destructive actions.

### vue-tippy `<span data-v-tippy>` wrapper breaks flex layouts (CRITICAL)
The `<tippy>` component (vue-tippy) wraps its trigger element AND popup content together inside a `<span data-v-tippy>`. When placed inside a `flex` container with `flex-1` children, this span inherits `flex: 1 0 0%` and stretches to fill available space — far beyond the trigger icon's actual width.

**Symptom:** A 26px icon inside a `<tippy>` stretches to 150px (or more), creating large gaps between adjacent elements. The popup content (menu items, tooltips) inflates the span's intrinsic width.

**Diagnosis:** Walk the DOM with `getComputedStyle` and check the `[data-v-tippy]` span's `flex` property and computed width vs. its child icon's width.

**Fix:** In scoped CSS, force the tippy wrapper to size only by its content:
```css
.parent-selector :deep([data-v-tippy]) {
  flex: 0 0 auto !important;
  width: auto !important;
  display: inline-flex !important;
  vertical-align: middle;
  line-height: 0;
}
```

**PITFALL:** `display: inline-flex` alone is NOT sufficient — the span still has `flex: 1 0 0%` from the parent flex container. You MUST add `flex: 0 0 auto` to prevent stretching.

**When this matters:** Any time `<tippy>` is used as a flex child alongside other `flex-1` elements (URL input fields, text areas, etc.). Common in URL bars where a clickable icon sits next to a text input.

### CodeMirror inputTheme `.cm-line` has 1rem left padding — override at all levels
The `inputTheme` in `helpers/editor/themes/baseTheme.ts` sets `.cm-line` with `paddingLeft: "1rem"` (16px). When you need the text content to sit flush-left against an adjacent element (e.g., a prefix URL icon), you must override padding at MULTIPLE levels:

```css
.flush-left :deep(.cm-line) { padding-left: 0 !important; }
.flush-left :deep(.cm-content) { padding-left: 0 !important; }
.flush-left :deep(.cm-editor) { margin-left: 0 !important; }
.flush-left :deep(.autocomplete-wrapper) { padding-left: 0 !important; }
```

**Why multiple levels:** CodeMirror's internal structure is `autocomplete-wrapper > div.absolute > div > .cm-editor > .cm-scroller > .cm-content > .cm-line`. Each level can add its own padding/margin. The `inputTheme` styles apply to `.cm-line` but other styles may exist at `.cm-content` or wrapper levels.

**PITFALL:** Only overriding `.cm-line` leaves 16px gap because `.cm-content` also has padding in some themes. Override all levels to be safe.

## References

- See `references/verzod-data-model.md` for detailed verzod migration patterns
- See `references/request-mode-tabs.md` for the design/debug/testcases mode tabs feature (data model v19, component structure, known bugs)
- See `references/markdown-docs-architecture.md` for Markdown document feature: verzod v14, md-editor-v3, 3-phase implementation plan
- See `references/design-mode-architecture.md` for the API documentation design mode (v20): component tree, edit/preview sub-modes, data model fields
- See `references/password-auth-architecture.md` for email+password authentication system: API endpoints, Prisma schema, frontend components, platform auth methods
- See `references/design-mode-examples-pattern.md` for the unified examples tabs pattern: virtual-to-stored materialization, tab UI, preview sync, XML/JSON generation
- See `references/persistence-schema-validation.md` for the REST_TAB_STATE_SCHEMA `.strict()` → `.passthrough()` fix and field-addition checklist
- See `references/markdown-docs-feature-plan.md` for the collection markdown document feature plan: md-editor-v3 integration, verzod v14 data model, 3-phase implementation, file list, i18n keys
- See `references/md-editor-v3-theming.md` for CSS variable mapping between md-editor-v3 and Hoppscotch themes (dropdown/modal/toolbar background fix)
