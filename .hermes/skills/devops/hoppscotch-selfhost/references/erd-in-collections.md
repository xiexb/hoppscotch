# ERD Diagram in Collections — Architecture Pattern

## Overview

ERD diagrams (using `@dineug/erd-editor`) are stored as first-class citizens inside
Hoppscotch collections, following the exact same pattern as MarkdownDoc. Each ERD
diagram has a name and a schema JSON string, and appears as a node in the collection
tree alongside requests, folders, and markdown docs.

## Schema Version: v15

Added `erdDiagrams` array to the collection schema (v14 had `markdownDocs`).

### Data Structure
```ts
// In collection/v/15.ts
export const ErdDiagramSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string(), // erd-editor JSON string (SchemaV3 format)
})
export type ErdDiagram = z.infer<typeof ErdDiagramSchema>

// Collection type gains:
erdDiagrams: ErdDiagram[]
```

### Migration (v14 → v15)
In `collection/index.ts` `translateToNewRequest()`:
```ts
const erdDiagrams = x.erdDiagrams ?? []
```

## Document Type: HoppErdDiagramDocument

In `helpers/rest/document.ts`, added to the `HoppTabDocument` union:
```ts
export type HoppErdDiagramDocument = {
  type: "erd-diagram"
  diagramId: string
  name: string
  schema: string          // erd-editor JSON
  isDirty: boolean
  collectionPath: string
  diagramIndex: number
}

export type HoppTabDocument =
  | HoppRequestDocument
  | HoppTestRunnerDocument
  | HoppSavedExampleDocument
  | HoppMarkdownDocDocument
  | HoppErdDiagramDocument    // NEW
```

## Components

### Tree Node: `ErdDiagramNode.vue`
- Location: `components/collections/ErdDiagramNode.vue`
- Pattern: Identical to `MarkdownDocNode.vue` but with `IconDatabase` icon
- Events: `delete-doc`, `rename-doc` (same payload shape)
- Click handler: opens diagram in a new tab (checks for existing tab first)

### Tab Component: `ErdDiagramTab.vue`
- Location: `components/collections/ErdDiagramTab.vue`
- Embeds `<erd-editor>` web component with `setInitialValue(schema)`
- On editor value change → updates `tab.document.schema` + sets `isDirty = true`
- Import/export JSON/SQL toolbar (reuses patterns from `pages/erd.vue`)
- Must call `editor.destroy()` in `onBeforeUnmount`

### Collection Tree Integration

**MyCollections.vue** — add `erdDiagrams` node type:
```vue
<CollectionsErdDiagramNode
  v-if="node.data.type === 'erdDiagrams'"
  :diagram="node.data.data.data"
  :diagram-index="node.data.data.diagramIndex"
  :collection-path="node.data.data.parentIndex"
  @delete-doc="emit('delete-erd-diagram', $event)"
  @rename-doc="emit('rename-erd-diagram', $event)"
/>
```

**TeamCollections.vue** — same pattern.

**Collection.vue** — add "Add ERD Diagram" to context menu:
- Icon: `IconDatabase` from `~icons/lucide/database`
- Event: `add-erd-diagram`
- Both inline hover buttons and dropdown menu items

**index.vue** (collections) — handler functions:
```ts
function addErdDiagram({ path, folder, name }: { path: string; folder: HoppCollection; name: string }) {
  const diagram: ErdDiagram = {
    id: generateUniqueRefId("erd"),
    name: name || "Untitled ERD",
    schema: JSON.stringify(emptyErdSchema),
  }
  // Navigate to collection by path, push to erdDiagrams array
}
```

## Pages Integration

**`pages/index.vue`** (REST page) — render tab content:
```vue
<CollectionsErdDiagramTab
  v-if="tab.document.type === 'erd-diagram'"
  :model-value="tab"
  @update:model-value="onTabUpdate"
/>
```

## Store Operations (My Collections)

For `restCollectionStore`, ERD diagrams live inside `collection.erdDiagrams[]`.
Operations modify the array in-place (reactive):
- Add: `collection.erdDiagrams.push(diagram)`
- Delete: `collection.erdDiagrams.splice(index, 1)`
- Rename: `collection.erdDiagrams[index].name = newName`
- Update schema: `collection.erdDiagrams[index].schema = newSchema`

## Team Collections

Team collections use GraphQL mutations. If `erdDiagrams` is NOT in the backend
schema yet, team ERD diagrams are stored as part of the collection JSON blob
or as a separate entity. Check if `TeamCollection` has an `erdDiagrams` field.

## Empty ERD Schema Template
```json
{
  "canvas": {
    "version": "3.3.0",
    "width": 2000,
    "height": 2000,
    "scrollTop": 0,
    "scrollLeft": 0,
    "zoomLevel": 1,
    "show": {
      "tableProperties": false,
      "columnTypes": true,
      "columnConstraints": true,
      "columnComments": true,
      "relationshipDataType": false,
      "relationshipCardinality": true,
      "columnUnique": false,
      "columnNotNull": true,
      "columnDefault": false,
      "columnAutoIncrement": false
    },
    "database": "MySQL",
    "databaseName": "",
    "setting": {
      "relationshipDataTypeSync": true,
      "relationshipOptimization": false,
      "columnOrder": ["columnName", "columnDefault", "columnNotNull", "columnUnique", "columnAutoIncrement", "columnComment", "columnType"]
    },
    "pluginSerializationMap": {}
  },
  "table": { "entities": {}, "indexes": {} },
  "memo": { "memos": {} },
  "relationship": { "relationships": {} }
}
```

## Import/Export

- **Import JSON**: Read file → `JSON.parse()` → `editor.setInitialValue(text)`
- **Import SQL**: Read file → `editor.setInitialValue(text)` (erd-editor auto-detects SQL)
- **Export JSON**: `editor.value` → download as `.json`
- **Export SQL**: erd-editor provides SQL generation via its internal store

## Files Modified

1. `packages/hoppscotch-data/src/collection/v/15.ts` — new schema version
2. `packages/hoppscotch-data/src/collection/index.ts` — migration + factory
3. `packages/hoppscotch-common/src/helpers/rest/document.ts` — HoppErdDiagramDocument
4. `packages/hoppscotch-common/src/components/collections/ErdDiagramNode.vue` — tree node
5. `packages/hoppscotch-common/src/components/collections/ErdDiagramTab.vue` — tab content
6. `packages/hoppscotch-common/src/components/collections/Collection.vue` — context menu
7. `packages/hoppscotch-common/src/components/collections/MyCollections.vue` — tree render
8. `packages/hoppscotch-common/src/components/collections/TeamCollections.vue` — tree render
9. `packages/hoppscotch-common/src/components/collections/index.vue` — CRUD handlers
10. `packages/hoppscotch-common/src/pages/index.vue` — tab rendering
11. i18n locale files — new keys: `collection.add_erd_diagram`, `erd.*`
