# Design Mode (API Documentation) Architecture

## Overview
Design mode provides an API documentation editing experience within each request tab. It sits alongside Debug and TestCases modes in `RequestModeTabs.vue`.

**Edit/Preview sub-modes with mode indicator.** Design mode toggles between edit and preview views via save/edit action buttons. A visible mode indicator badge shows the current mode ("编辑模式" or "预览模式"). The default mode is "preview" (configurable via `initialSubMode` prop, persisted via `tab.document.designSubModePreference`).

**URL bar:** Design mode renders the shared `HttpRequest.vue` URL bar with `sendLabel="手动调试"` — clicking it switches to debug mode instead of sending a request. **The URL bar uses `v-show` (NOT `v-if`) so it stays mounted in both modes** — this is critical because `Request.vue` registers `defineActionHandler("request-response.save")` and renders the `CollectionsSaveRequest` modal. Using `v-if` would unmount these, making save silently fail in preview mode.

## Data Model (v20)

### New fields on HoppRESTRequest
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `apiTitle` | string | `""` | Chinese/display name for the API |
| `apiStatus` | enum | `"developing"` | Lifecycle status (see StatusBadge below) |
| `tags` | string[] | `[]` | User-defined tags |
| `responsibility` | string | `""` | Owner/responsible person |
| `inheritedBaseUrl` | string | `""` | Base URL override (or inherit from parent collection) |

### Extended HoppRESTResponseModelV20
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `bodySchemaTree` | HoppRESTSchemaNode[] \| null | null | Visual tree representation of response schema |
| `contentType` | string | `"application/json"` | Response content type |

### HoppRESTSchemaNode (recursive)
```typescript
type HoppRESTSchemaNode = {
  name: string
  type: "object" | "string" | "integer" | "number" | "boolean" | "array" | "file"
  mock: string          // Mock rule (e.g. "@string")
  displayName: string   // Chinese name
  description: string   // English/detailed description
  required: boolean
  children: HoppRESTSchemaNode[]
}
```

## Component Tree

```
RequestTab.vue
├── [debug mode] AppPaneLayout split pane
│   ├── #primary: RequestModeTabs + HttpRequest + HttpRequestOptions
│   └── #secondary: HttpResponse
│
├── [design mode] Full-height flex column
│   ├── RequestModeTabs
│   └── RequestDesignPanel.vue       # Edit/Preview mode orchestrator
│       │  Props: modelValue, tab (HoppTab), inheritedProperties, initialSubMode
│       │  Header: [接口名称 input(max-w-[20rem])/h1] [StatusBadge] [flex-1 spacer] [divider] [模式标签] [HoppButtonPrimary/HoppButtonSecondary]
│       │    - Edit mode: title=<input>, StatusBadge editable, shows HoppButtonPrimary "预览" (switches to preview mode)
│       │    - Preview mode: title=<h1>, StatusBadge readonly, shows HoppButtonSecondary "编辑" (switches to edit mode)
│       │    - Mode badge: "编辑模式" (blue) or "预览模式" (gray)
│       │    - Status badge positioned inline after title (gap-2), NOT in separate shrink-0 wrapper
│       │  URL bar: <HttpRequest v-model="tabModel" ...> via v-show (hidden in preview, NOT v-if)
│       │  NOTE: tabModel = useVModel(props, "tab", emit) — NOT v-model="tab" (prop write error)
│       │
│       ├── design/EditView.vue (shown when subMode === 'edit')
│       │   ├── MetaInfoSection.vue
│       │   ├── HttpRequestOptions.vue  # REUSED from debug mode
│       │   └── ResponseSection.vue
│       │       ├── SchemaTreeEditor.vue → SchemaTreeRow.vue (recursive, has required toggle)
│       │       └── JsonExampleBlock.vue (editable=true, inline edit/save/cancel)
│       │
      └── design/PreviewView.vue (shown when subMode === 'preview')
          │  Emits: switchToDebug (save/saveAs handled internally via invokeAction)
          ├── Method + URL row (read-only) + action buttons
          │    - 手动调试: HoppButtonPrimary → emit("switchToDebug") → switches to debug mode
          │    - 保存 + ▼ dropdown: same component style as edit mode's Request.vue save group
          │      (HoppButtonSecondary save + tippy dropdown with 另存为 HoppSmartItem)
          │      保存 → invokeAction("request-response.save") directly
          │      另存为 → invokeAction("request.save-as") directly
          │    NOTE: PreviewView imports invokeAction from "~/helpers/actions" and useI18n
          │          No longer emits save/saveAs to parent — fully self-contained
          ├── Meta info row (responsibility/tags/description)
│           ├── Request params (auth/path/headers/body, two-column layout)
│           └── Response (tabs + SchemaTreeReadonly + JsonExampleBlock readonly)
│
└── [testcases mode] Full-height flex column (NO URL bar)
    ├── RequestModeTabs
    └── RequestTestCasesPanel.vue
```

## Reuse Principle (CRITICAL)

**When design mode needs the same CRUD UX as debug mode, import the debug component directly. Do NOT build parallel custom components.**

For Auth/Params/Headers/Body editing, EditView imports `HttpRequestOptions.vue` (the same component used in debug mode) and restricts visible tabs via the `properties` prop:

```vue
<HttpRequestOptions
  v-model="localRequest"
  v-model:option-tab="optionTab"
  :properties="['authorization', 'params', 'bodyParams', 'headers']"
  :inherited-properties="inheritedProperties"
/>
```

The `localRequest` computed bridges RequestOptions's v-model back to the parent:
```typescript
const localRequest = computed({
  get: () => props.request,
  set: (val: HoppRESTRequest) => emit("update:request", val),
})
```

The legacy `RequestParamsSection.vue` still exists in the `design/` directory but is **no longer imported** by any component. `PreviewView.vue` IS actively used for the preview sub-mode.

## Sub-Components

### StatusBadge.vue
- Color-coded dropdown for API lifecycle status
- **6 options:** 设计中(gray), 调试中(blue), 测试中(yellow), 发布(green), 将废弃(orange), 已废弃(red)
- ApiStatus type: `"designing" | "developing" | "testing" | "published" | "about_to_deprecate" | "deprecated"`
- `editable` prop controls whether clicking opens dropdown
- In design mode, `editable=true` in edit mode, `editable=false` in preview mode
- **Wrapper div:** Must use `<div class="relative inline-block status-badge-wrapper">` — the `onClickOutside` handler depends on this class, and `relative` anchors the dropdown. Without it, dropdown opens and immediately closes.

### TagInput.vue
- Inline tag creation: type text + Enter to add
- Each tag shows with X button for removal
- Emits `update:modelValue` with string array

### JsonExampleBlock.vue
- Renders JSON with syntax highlighting (keys=bold, strings=orange, numbers=green, booleans=purple, null=gray)
- Copy button in top-right corner
- **Inline editing** (`editable=true`): click edit icon → textarea appears with save/cancel buttons → emits `update:content` on save
- Props: `content`, `contentType`, `editable`
- Emits: `update:content` (string)
- `max-h-[400px] overflow-y-auto` on preview to prevent very tall blocks

### SchemaTreeEditor.vue + SchemaTreeRow.vue
- Root node always `object` type, labeled "根节点"
- Each row: name input | type select | mock input | displayName input | description input | **required toggle** | actions
- **Required toggle**: clickable badge showing "必填" (orange `bg-orange-500/15`) or "可选" (gray `bg-secondaryLight/10`), toggles `node.required`
- Actions: add child (only for object/array), delete
- Recursive: SchemaTreeRow imports itself for nested children
- Indentation via `paddingLeft: (depth + 1) * 16 + 8`px

## Data Flow Pattern

```
RequestTab.vue
  │ useVModel(props, "modelValue", emit) → tab
  │ passes: v-model="tab.document.request" v-model:tab="tab"
  │         :initial-sub-mode="tab.document.designSubModePreference ?? 'preview'"
  │         @update:sub-mode="onSubModeChange" → persists designSubModePreference
  │
  └── RequestDesignPanel.vue
      │ useVModel(props, "modelValue", emit) → request
      │ useVModel(props, "tab", emit) → tabModel  (CRITICAL: NOT v-model="tab" on prop)
      │ ref subMode: "edit" | "preview" (initialized from initialSubMode prop)
      │ watch(subMode) → emit("update:subMode", val) → parent persists
      │
      ├── EditView (v-if="subMode === 'edit'")
      │   receives request + inheritedProperties, emits update:request
      │   ├── HttpRequestOptions: v-model proxies via localRequest computed
      │   ├── Each section: emits update:request with { ...request, [field]: value }
      │   └── @save → parent sets subMode = "preview"
      │
      └── PreviewView (v-if="subMode === 'preview'")
          receives request (readonly)
          emits: switchToDebug → parent forwards to RequestTab
          NOTE: save/saveAs handled internally via invokeAction — no parent emit needed
                PreviewView imports: { invokeAction } from "~/helpers/actions"
                                     { useI18n } from "@composables/i18n"
                                     IconSave, IconFolderPlus from "~icons/lucide/..."
```

**Critical:** All mutations use immutable spread: `{ ...request, field: newValue }`. This ensures Vue reactivity detects changes.

**Critical:** The `tab` prop MUST be wrapped with `useVModel` before passing to child components. Direct `v-model="tab"` on a prop causes a fatal Vue compilation error that blanks the entire page.

## File Locations
```
packages/hoppscotch-common/src/components/http/
├── RequestDesignPanel.vue
├── RequestTab.vue
└── design/
    ├── EditView.vue
    ├── PreviewView.vue              # ACTIVE — read-only preview sub-mode
    ├── MetaInfoSection.vue
    ├── RequestParamsSection.vue     # DEPRECATED — no longer imported
    ├── ResponseSection.vue
    ├── SchemaTreeEditor.vue
    ├── SchemaTreeRow.vue
    ├── SchemaTreeReadonly.vue
    ├── StatusBadge.vue
    ├── TagInput.vue
    └── JsonExampleBlock.vue
```

## Optimization Backlog (from UI/UX review, 2026-05-23)

### P0 — COMPLETED
- **✅ SchemaTreeRow required toggle**: Added clickable "必填/可选" badge
- **✅ JsonExampleBlock inline editing**: Replaced raw textarea in ResponseSection

### P1 — Visual noise reduction — ALL COMPLETED
- **✅ Edit/Preview toggle simplified**: Replaced separate tab buttons with mode indicator badge + action buttons. Edit mode shows "preview" button (mode switch), preview mode shows "edit" button
- **✅ Removed duplicate title in PreviewView**: PreviewView no longer renders its own title/status bar — only the parent RequestDesignPanel header shows title + status
- **✅ URL bar hidden in preview mode**: URL bar uses `v-show` (NOT `v-if`) to keep action handlers alive. PreviewView has read-only Method+URL row with debug + save + save-as buttons
- **✅ Removed non-functional buttons in PreviewView**: Star/Share/More buttons removed along with the title bar
- **✅ StatusBadge dropdown fixed**: Added wrapper div with `.status-badge-wrapper` class + `@click.stop` on items
- **✅ Button sizing unified**: All buttons use HoppButtonPrimary/HoppButtonSecondary for consistency with debug mode buttons
- **✅ Status badge inline positioning**: Badge stays next to title via `gap-2` in shared flex container, `max-w-[20rem]` on title input prevents pushing badge away
- **✅ PreviewView action buttons**: debug (switchToDebug), save group (same style as Request.vue: save button + dropdown with 另存为). PreviewView handles save/saveAs internally via invokeAction — no parent emit needed
- **✅ Preview save/saveAs merged into edit-mode-style component**: Replaced separate save+saveAs buttons with a single save button group (HoppButtonSecondary + tippy dropdown containing HoppSmartItem "另存为"), matching Request.vue's save button exactly in both style and functionality
- **✅ input/h1 box model alignment**: Both use `border-0 p-0 m-0 leading-none` + input `:size` binding for consistent StatusBadge position across modes

### P1 — Remaining
- **Remove non-functional buttons in ResponseSection**: "添加示例", "添加描述", "Headers" buttons still have no event handlers

### P2 — Usability improvements
- **Collapsible sections**: MetaInfoSection, RequestOptions, ResponseSection all expand unconditionally
- **SchemaTreeRow layout**: Fixed-width columns break at deep nesting — switch to CSS Grid
- **Theme-aware colors**: "必填" badge uses hardcoded colors

### P3 — Architecture improvements
- **Document-oriented param editing**: Design mode reuses debug's HttpRequestOptions with toggle/batch features
- **Body field parsing**: Prioritize bodySchemaTree over JSON.parse

### P4 — Feature additions
- **OpenAPI import/export**: Convert request data to/from OpenAPI 3.0
