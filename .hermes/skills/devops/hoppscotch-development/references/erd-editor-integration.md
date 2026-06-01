# erd-editor Integration Reference

## Package Info
- **npm:** `@dineug/erd-editor` v3.3.0
- **GitHub:** dineug/erd-editor (★1653, MIT, TypeScript)
- **Architecture:** Web Component (`<erd-editor>`), closed shadow DOM, zero dependencies
- **Build output:** ~1.1MB chunk (auto code-split by Vite)

## Two ERD Components (CRITICAL)

There are **two separate ERD components** that both need the same features/fixes:

| Component | Location | Purpose |
|-----------|----------|---------|
| `erd.vue` | `src/pages/erd.vue` | Standalone `/erd` route page |
| `ErdDiagramTab.vue` | `src/components/collections/ErdDiagramTab.vue` | ERD tab inside Collections sidebar |

**PITFALL:** When adding features (save button, PG SQL import, persistence), you MUST update BOTH components. Users test in the Collections sidebar ERD tab, not the standalone page.

## Vue 3 Setup

### 1. Install
```bash
pnpm add @dineug/erd-editor --filter @hoppscotch/common
```

### 2. vite.config.ts — register custom element
```typescript
Vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'erd-editor',
    },
  },
}),
```

### 3. Import in component
```typescript
import "@dineug/erd-editor"  // Side-effect: registers custom element
```

## API

### Element Methods
| Method | Description |
|--------|-------------|
| `.value` (getter/setter) | **PREFERRED**: Get/set current schema as JSON string (v3.0.0 format) |
| `setInitialValue(jsonString)` | Legacy: Load old canvas/table/memo format. Do NOT use for v3.0.0 |
| `setSchemaSQL(sqlString)` | Load SQL DDL — **only works for MySQL**, PG has gaps (see below) |
| `getSchemaSQL()` | Export current schema as SQL DDL string |
| `clear()` | Clear all tables/relationships |
| `destroy()` | Cleanup (call in `onBeforeUnmount`) |

**CRITICAL: Use `editor.value = jsonString` for v3.0.0 format.** `setInitialValue()` expects the old canvas/table/memo/relationship format. Using it with v3.0.0 JSON silently fails to load data.

### Closed Shadow Root
erd-editor uses `shadow: "closed"` — `element.shadowRoot` returns `null`. This is **normal**, not a bug. Verify registration via `customElements.get('erd-editor')`.

## v3.0.0 JSON Format (Current)

```json
{
  "$schema": "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
  "version": "3.0.0",
  "settings": {
    "width": 2000, "height": 2000, "scrollTop": 0, "scrollLeft": 0, "zoomLevel": 1,
    "show": 423,
    "database": 16,
    "databaseName": "",
    "canvasType": "ERD",
    "language": 1,
    "tableNameCase": 4, "columnNameCase": 2, "bracketType": 1,
    "relationshipDataTypeSync": true, "relationshipOptimization": false,
    "columnOrder": [1, 2, 4, 8, 16, 32, 64],
    "maxWidthComment": -1, "ignoreSaveSettings": 0
  },
  "doc": {
    "tableIds": ["t1"],
    "relationshipIds": [],
    "indexIds": [],
    "memoIds": []
  },
  "collections": {
    "tableEntities": { "t1": { ... } },
    "tableColumnEntities": { "c1": { ... } },
    "relationshipEntities": {},
    "indexEntities": {},
    "indexColumnEntities": {},
    "memoEntities": {}
  }
}
```

### Key Enums
| Enum | Values |
|------|--------|
| Database | MariaDB=1, MSSQL=2, MySQL=4, Oracle=8, **PostgreSQL=16**, SQLite=32 |
| Show bitmask | tableComment=1, columnComment=2, columnDataType=4, columnDefault=8, columnPrimaryKey=32, columnNotNull=128, relationship=256 |
| Column order | columnName=1, columnDataType=2, columnNotNull=4, columnUnique=8, columnAutoIncrement=16, columnDefault=32, columnComment=64 |

### Column Options Bitmask (CRITICAL)
| Flag | Value |
|------|-------|
| autoIncrement | **1** |
| primaryKey | **2** |
| unique | **4** |
| notNull | **8** |

**PITFALL:** The bitmask values are NOT sequential powers of 2 in the order you might expect. autoIncrement=1, primaryKey=2 — NOT the other way around. Getting these wrong causes columns to show wrong constraints.

### Table Entity Structure
```json
{
  "id": "t1", "name": "users", "comment": "用户表",
  "columnIds": ["c1", "c2"], "seqColumnIds": ["c1", "c2"],
  "ui": { "x": 100, "y": 100, "zIndex": 2, "widthName": 60, "widthComment": 60, "color": "" },
  "meta": { "updateAt": 1234567890, "createAt": 1234567890 }
}
```

### Column Entity Structure
```json
{
  "id": "c1", "tableId": "t1", "name": "id", "comment": "主键ID",
  "dataType": "BIGSERIAL", "default": "", "options": 3,
  "ui": { "keys": 1, "widthName": 60, "widthComment": 60, "widthDataType": 80, "widthDefault": 60 },
  "meta": { "updateAt": 1234567890, "createAt": 1234567890 }
}
```
- `options`: bitmask (3 = primaryKey|autoIncrement)
- `ui.keys`: 1 for primary key columns, 0 otherwise

## PostgreSQL SQL Import (CUSTOM PARSER)

### Problem
erd-editor's built-in `setSchemaSQL()` has two critical gaps for PostgreSQL:
1. **Does NOT parse `COMMENT ON TABLE/COLUMN`** statements (PG-specific syntax)
2. **Multi-word data types fail** — tokenizer splits `TIMESTAMP WITH TIME ZONE` into separate tokens, doesn't match `TIMESTAMP` alone

### Solution: Custom PG SQL Parser
File: `src/helpers/erdPgSqlParser.ts`

**Exports:**
- `isPgSql(sql: string): boolean` — detects PG-specific syntax (COMMENT ON, BIGSERIAL, TIMESTAMP WITH, etc.)
- `parsePgSqlToErdJson(sql: string): string` — converts PG SQL to erd-editor v3.0.0 JSON

**Usage pattern in both ERD components:**
```typescript
import { parsePgSqlToErdJson, isPgSql } from "~/helpers/erdPgSqlParser"

async function handleImportSQL(event: Event) {
  const sqlText = await file.text()
  if (isPgSql(sqlText)) {
    const erdJson = parsePgSqlToErdJson(sqlText)
    editor.value = erdJson  // v3.0.0 format via value setter
  } else {
    editor.setSchemaSQL(sqlText)  // MySQL: use built-in
  }
}
```

**Parser handles:**
- `CREATE TABLE` with quoted identifiers (`"columnName"`)
- Multi-word types: `TIMESTAMP WITH TIME ZONE`, `DOUBLE PRECISION`, `CHARACTER VARYING`, etc.
- `SERIAL`/`BIGSERIAL` → autoIncrement flag
- `COMMENT ON TABLE/COLUMN` → table/column comments
- `ALTER TABLE ADD PRIMARY KEY` / `FOREIGN KEY` → constraints and relationships
- MySQL-style inline `COMMENT 'xxx'` as fallback

## Persistence Pattern (localStorage)

### erd.vue (standalone page)
Auto-save to localStorage every 3 seconds + on beforeunload + on component unmount:
```typescript
const ERD_DATA_KEY = "erd-editor-data"

function saveToStorage() {
  const val = editor.value
  const parsed = JSON.parse(val)
  if (parsed.collections?.tableEntities && Object.keys(parsed.collections.tableEntities).length > 0) {
    localStorage.setItem(ERD_DATA_KEY, val)
  }
}

// Restore on mount
const saved = localStorage.getItem(ERD_DATA_KEY)
if (saved) editor.value = saved
```

### ErdDiagramTab.vue (Collections tab)
Saves to collection data via `saveToCollection()` (debounced 1s on input event). Schema stored in `tab.value.document.schema`.

### Manual Save Button
Both components have a save button (💾 icon) in the toolbar. Placement: **after export SQL, before clear**.
```
[导入JSON] [导入SQL] | [导出JSON] [导出SQL] [保存] | [清空]
```

## Toolbar Layout (User Preference)

The ERD toolbar uses icon-only buttons grouped with thin dividers:
```
导入JSON | 导入SQL | 导出JSON | 导出SQL | 保存 | 清空
```

**User preference:** Save button goes AFTER export SQL (not after import). The user iterated on this — initially after import, then moved to after export SQL.

## Page File Location
`packages/hoppscotch-common/src/pages/erd.vue` → auto-registered as `/erd` route.

## Table Collapse/Expand Feature (erdCollapse.ts)

File: `src/helpers/erdCollapse.ts`

### Architecture: Data-Model-Driven Manipulation (CRITICAL)

**NEVER use CSS `display: none` to hide columns.** erd-editor's internal layout engine calculates SVG relationship line positions, table heights, and column positions from the JSON data model (`columnIds`). CSS hiding breaks all of this — relationship lines point to invisible/ghost positions.

**Correct approach:** Modify the `columnIds` array in the table entity via `editor.value = JSON.stringify(modifiedSchema)`. The editor re-renders everything from the new model, including recalculating SVG paths.

### Closed Shadow DOM Access (attachShadow patching)

erd-editor uses `shadow: "closed"` — `element.shadowRoot` returns `null`. To inject UI elements (like per-table collapse buttons) into the shadow DOM:

```typescript
// MUST run BEFORE erd-editor is imported
const capturedShadowRoots = new WeakMap<Element, ShadowRoot>()
const originalAttachShadow = Element.prototype.attachShadow
Element.prototype.attachShadow = function (init: ShadowRootInit) {
  const root = originalAttachShadow.call(this, init)
  if (this.tagName?.toLowerCase() === "erd-editor") {
    capturedShadowRoots.set(this, root)
  }
  return root
}
```

**CRITICAL import order:** The patch module (`erdCollapse.ts`) must be imported BEFORE `@dineug/erd-editor`:
```typescript
import { initCollapseFeature } from "~/helpers/erdCollapse"  // patches attachShadow
import "@dineug/erd-editor"  // registers custom element (calls patched attachShadow)
```

### Identifying Relationship Columns

To find which columns participate in relationships for a given table:

```typescript
function getRelationshipColumnIds(schema: any, tableId: string): Set<string> {
  const relColumnIds = new Set<string>()
  const rels = Object.values(schema.collections.relationshipEntities) as any[]
  for (const rel of rels) {
    if (rel.start?.tableId === tableId && Array.isArray(rel.start.columnIds)) {
      for (const cid of rel.start.columnIds) relColumnIds.add(cid)
    }
    if (rel.end?.tableId === tableId && Array.isArray(rel.end.columnIds)) {
      for (const cid of rel.end.columnIds) relColumnIds.add(cid)
    }
  }
  return relColumnIds
}
```

### Collapse Logic

1. **Collapse**: Store original `columnIds` in a Map, replace with only relationship columns
2. **Expand**: Restore original `columnIds` from the Map
3. **MutationObserver** on shadow root injects per-table collapse buttons as new tables render
4. **Max-width**: CSS `.table { max-width: 450px !important }` constrains card width

### Toolbar Toggle Button

A global collapse-all/expand-all button in the toolbar uses `minimize-2` / `maximize-2` icons (lucide). Toggles all tables via `collapseAllTables(editorEl)` / `expandAllTables(editorEl)`.

## UUID Instability (CRITICAL for Version Diff)

erd-editor generates new UUIDs (like `pg123abc456`) for every entity on each SQL import via `parsePgSqlToErdJson()`. Even importing the **same SQL file twice** produces completely different UUIDs for all tables and columns.

**Consequence:** Any diff/comparison feature MUST match entities by **name** (`table.name`, `column.name`), never by UUID. UUIDs are only stable within a single editing session (between imports).

**Matching strategy for diff:**
1. Match tables by `table.name` (case-insensitive recommended)
2. Match columns by `table.name + column.name` composite key
3. Match relationships by four-tuple: `(fromTable.fromColumn → toTable.toColumn)`

## `ui.color` Field — Table-Level Color Annotation

Each table entity has a `ui.color` field (default: `""` = no color). Setting it to a hex color string causes erd-editor to render a colored left border on the table card.

**Usable for diff highlighting:**
```typescript
table.ui.color = "#22c55e"  // green = added
table.ui.color = "#eab308"  // yellow = modified
table.ui.color = "#6b7280"  // gray = deleted
table.ui.color = ""          // unchanged (default)
```

This is an erd-editor native feature — no Shadow DOM hacking needed. The color renders as a ~4px left border on the table card.

## Normalized JSON Pattern (for Clean Diffs)

When storing ERD data for version control or diff, use a **dual-file approach**:

1. **`erd-schema.json`** — Full erd-editor v3.0.0 JSON (for restoration)
2. **`erd-schema.normalized.json`** — Structured summary stripped of UI noise (for diff)

The normalized format removes UUIDs, coordinates, widths, timestamps — anything that changes between sessions without representing a semantic schema change:

```json
{
  "version": "3.0.0",
  "tables": [
    {
      "name": "users",
      "comment": "用户表",
      "columns": [
        { "name": "id", "type": "BIGINT", "pk": true, "notNull": true, "autoIncrement": true, "default": "", "comment": "" }
      ]
    }
  ]
}
```

**Why:** This makes `git diff` produce clean, readable output showing only semantic schema changes (added/removed/modified tables and columns), not UUID or layout churn.

## Related Packages (monorepo)
- `@dineug/erd-editor-schema` — Schema parsers (V2/V3), LWW operations
- `@dineug/schema-sql-parser` — SQL DDL parser for import
- `@dineug/erd-editor/engine.js` — Engine utilities (replication store)
