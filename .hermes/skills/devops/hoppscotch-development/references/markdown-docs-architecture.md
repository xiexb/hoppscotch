# Markdown Document Feature Architecture

## Overview
Add Markdown document support to Hoppscotch collections — documents live alongside requests and folders in the sidebar tree, editable with md-editor-v3.

## Technology Selection
- **Editor**: `md-editor-v3` (npm package)
  - Vue 3 + TypeScript native
  - Built-in dark theme (`theme="dark"`)
  - Toolbar + live preview + split-screen modes
  - ~150KB gzip
  - Install: `pnpm add md-editor-v3`
  - Usage: `<MdEditor v-model="content" theme="dark" />`
  - CSS: `import "md-editor-v3/lib/style.css"`
  - Preview-only: `<MdPreview :modelValue="content" theme="dark" />`

**Why not editor.md**: jQuery dependency, last updated 2019, no TypeScript types, incompatible with Vue 3 reactivity.

## Data Model Design (verzod v14)

### HoppCollection v14 (from v13)
New field: `markdownDocs: Array<{ id: string, name: string, content: string }>`

```typescript
// packages/hoppscotch-data/src/collection/v/14.ts
export const v14_baseCollectionSchema = v13_baseCollectionSchema.extend({
  v: z.literal(14),
  markdownDocs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    content: z.string(),
  })).catch([]),
})
```

Migration function: `up(old) → { ...old, v: 14, markdownDocs: [] }`
Register: `latestVersion: 14`, `CollectionSchemaVersion = 14`

### Files requiring null-safe guards
1. `makeCollection()` — add `markdownDocs: x.markdownDocs ?? []`
2. `translateToNewRESTCollection()` — add `markdownDocs: x.markdownDocs ?? []`
3. `translateToNewGQLCollection()` — add `markdownDocs: x.markdownDocs ?? []`
4. `persistence/validation-schemas/index.ts` — ensure collection schemas use `z.any()` not `entityReference()`

## Implementation Phases

### Phase 1: Data Model + Editor Component
- Install md-editor-v3
- Create verzod v14 schema
- Build `MarkdownDoc.vue` editor component (edit/preview toggle, auto-save)
- Update persistence schema

### Phase 2: Sidebar + Tab Model
- Add "New Markdown Document" to collection/folder right-click menus
- Render markdownDocs in sidebar tree (icon: lucide/file-text)
- New tab type: `"markdown-doc"` in `HoppTabDocument` union
- Build `MarkdownDocTab.vue` (wraps MarkdownDoc.vue + save logic)
- Wire into tab rendering dispatcher (RequestTab.vue or pages/index.vue)

### Phase 3: Team Collections + Import/Export
- GraphQL mutations for team collection markdownDocs CRUD
- Export: markdownDocs included in collection JSON
- Import: parse markdownDocs from JSON, default `[]` for old versions

## Tab Document Type
```typescript
// helpers/rest/document.ts
export type HoppMarkdownDocDocument = {
  type: "markdown-doc"
  docId: string
  name: string
  content: string
  isDirty: boolean
  saveContext: HoppRESTSaveContext | undefined
  collectionPath: string
  docIndex: number
}
```

## i18n Keys
| Key | EN | CN |
|-----|----|----|
| `collection.markdown_doc` | Markdown Document | Markdown 文档 |
| `collection.add_markdown_doc` | Add Markdown Document | 添加 Markdown 文档 |
| `collection.markdown_doc_name` | Document Name | 文档名称 |
| `collection.edit_doc` | Edit | 编辑 |
| `collection.preview_doc` | Preview | 预览 |
| `collection.delete_doc_confirm` | Delete this document? | 确定删除此文档？ |
| `collection.rename_doc` | Rename Document | 重命名文档 |

## Key Files
| File | Change |
|------|--------|
| `hoppscotch-data/src/collection/v/14.ts` | NEW — verzod v14 schema |
| `hoppscotch-data/src/collection/index.ts` | MODIFY — register v14 |
| `collections/MarkdownDoc.vue` | NEW — editor component |
| `collections/MarkdownDocTab.vue` | NEW — tab wrapper |
| `collections/Collection.vue` | MODIFY — add menu entry + tree rendering |
| `helpers/rest/document.ts` | MODIFY — add HoppMarkdownDocDocument type |
| `services/tab/rest.ts` | MODIFY — support markdown-doc tab type |
| `services/persistence/validation-schemas/index.ts` | MODIFY — schema update |
