# Markdown Docs Feature Plan (md-editor-v3)

## Overview
Add Markdown document type to Hoppscotch collections (sidebar), alongside requests and folders.

## Tech Selection: md-editor-v3
- **npm:** `pnpm add md-editor-v3`
- **Why not editor.md:** jQuery dependency, last updated 2019, incompatible with Vue 3 + TypeScript
- **Usage:**
  ```vue
  <template>
    <MdEditor v-model="content" theme="dark" style="height: 500px" />
  </template>
  <script setup lang="ts">
  import { MdEditor } from 'md-editor-v3'
  import 'md-editor-v3/lib/style.css'
  </script>
  ```
- **Features:** Edit/preview/split modes, toolbar, dark theme, v-model, ~150KB gzip

## Recommended Data Model (Researcher conclusion)
**Option A (recommended): HoppCollection verzod v14 + `markdownDocs` field**

```typescript
// packages/hoppscotch-data/src/collection/v/14.ts
export const V14_SCHEMA = V13_SCHEMA.extend({
  v: z.literal("14"),
  markdownDocs: z.array(MarkdownDocSchema).catch([]),
})

const MarkdownDocSchema = z.object({
  id: z.string(),           // UUID
  name: z.string(),
  content: z.string(),      // Markdown source
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
```

### Alternatives considered (rejected):
- **Option B: Special request type** — pollutes request model, complicates UI
- **Option C: Independent entity** — requires separate persistence layer

## Implementation Plan (3 phases)

### Phase 1: Data Model + Editor Component
1. `hoppscotch-data`: Collection verzod v13 → v14, add `markdownDocs`
2. `hoppscotch-common`: New `MarkdownDocEditor.vue` component wrapping md-editor-v3
3. `hoppscotch-common`: New `MarkdownDocView.vue` for read-only preview
4. i18n keys (en.json + cn.json)

### Phase 2: Sidebar Integration
1. `collections/index.vue`: Add "New Markdown Doc" to create menu
2. `collections/Collection.vue`: Add "Add Markdown Doc" to right-click menu
3. `collections/MyCollections.vue` + `TeamCollections.vue`: Render markdown doc nodes
4. Tab/Document model: New tab type `"markdown"` with `HoppMarkdownDocument`
5. Sidebar icon: `IconFileText` from lucide

### Phase 3: Team Collection Sync
1. Backend: Prisma schema add `MarkdownDoc` model
2. Backend: GraphQL mutations for CRUD
3. Import/export: Include `markdownDocs` in collection JSON

## Key Files to Modify
| File | Change |
|------|--------|
| `packages/hoppscotch-data/src/collection/v/14.ts` | NEW — verzod v14 |
| `packages/hoppscotch-data/src/collection/index.ts` | Register v14, update latestVersion |
| `packages/hoppscotch-common/src/helpers/rest/document.ts` | Add HoppMarkdownDocument |
| `packages/hoppscotch-common/src/services/tab/rest.ts` | Handle markdown tab type |
| `packages/hoppscotch-common/src/services/persistence/validation-schemas/index.ts` | Add markdown doc to schema |
| `packages/hoppscotch-common/src/components/collections/index.vue` | Create menu + render |
| `packages/hoppscotch-common/src/components/collections/Collection.vue` | Right-click menu |
| `packages/hoppscotch-common/src/components/collections/MyCollections.vue` | Render nodes |
| `packages/hoppscotch-common/src/components/collections/TeamCollections.vue` | Render nodes |
| `packages/hoppscotch-common/locales/en.json` | i18n keys |
| `packages/hoppscotch-common/locales/cn.json` | i18n keys |
| `packages/hoppscotch-selfhost-web/package.json` | Add md-editor-v3 dep |

## i18n Keys (16 total)
```json
{
  "markdown_doc": {
    "add": "Add Markdown Document",
    "edit": "Edit Document",
    "delete": "Delete Document",
    "delete_confirm": "Are you sure you want to delete this document?",
    "name_placeholder": "Document name",
    "content_placeholder": "Write your markdown here...",
    "preview": "Preview",
    "unnamed": "Untitled Document"
  },
  "action": {
    "new_markdown_doc": "New Markdown Document"
  }
}
```

## Risks
1. **verzod v14 migration** — all 4 null-safe guard locations need updating
2. **Team collection backend** — requires Prisma migration + GraphQL schema changes
3. **Tab model extension** — new tab type may conflict with existing example-response type
4. **Import/export** — Apifox importer doesn't have markdown docs; need to handle gracefully
5. **md-editor-v3 bundle size** — 150KB gzip is acceptable but should lazy-load
6. **Dark theme sync** — md-editor-v3 `theme` prop is static; need to watch Hoppscotch theme setting
7. **Persistence schema** — REST_TAB_STATE_SCHEMA needs new union variant for markdown tabs
8. **IndexedDB migration** — existing persisted collections lack markdownDocs; verzod `.catch([])` handles this
