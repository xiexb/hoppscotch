# erd-editor Integration Reference

## Package Info
- **npm:** `@dineug/erd-editor` v3.3.0
- **GitHub:** dineug/erd-editor (★1653, MIT, TypeScript)
- **Architecture:** Web Component (`<erd-editor>`), closed shadow DOM, zero dependencies
- **Build output:** ~1.1MB chunk (auto code-split by Vite)

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
| `setInitialValue(jsonString)` | Load schema JSON into editor (JSON format only) |
| `setSchemaSQL(sqlString)` | Load PostgreSQL/MySQL DDL SQL into editor |
| `getSchemaSQL()` | Export current schema as SQL DDL string |
| `clear()` | Clear all tables/relationships |
| `destroy()` | Cleanup (call in `onBeforeUnmount`) |
| `focus()` / `blur()` | Focus management |
| `.value` (getter) | Current schema as JSON string |

**CRITICAL**: `setInitialValue()` is for JSON only (SchemaV3 format). To import SQL DDL, use `setSchemaSQL()`. Mixing these up causes silent failures.

### Element Properties
| Prop | Type | Description |
|------|------|-------------|
| `readonly` | boolean | Disable editing |
| `systemDarkMode` | boolean | Use dark theme |
| `enableThemeBuilder` | boolean | Enable theme customization |

### Closed Shadow Root
erd-editor uses `shadow: "closed"` — `element.shadowRoot` returns `null`. This is **normal**, not a bug. Verify registration via `customElements.get('erd-editor')`.

## SchemaV3 JSON Format

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

### Table Entity Structure
```json
{
  "id": "uuid",
  "name": "users",
  "columns": {
    "entities": { "uuid": { "name": "id", "dataType": "BIGINT", "primaryKey": true, ... } },
    "columnIds": ["uuid"]
  },
  "ui": { "x": 100, "y": 100, "width": 200, "height": 300, "color": "" }
}
```

## Floating Toolbar Pattern

For adding action buttons over the editor without a separate toolbar bar:

```css
.erd-icon-toolbar {
  position: absolute;
  top: 6px;
  right: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

Icon buttons (28×28px) with hover effects. Use `title` attribute for tooltips — `v-tippy` does NOT work reliably inside scoped components on native `<button>` elements.

## Page File Location
`packages/hoppscotch-common/src/pages/erd.vue` → auto-registered as `/erd` route.

## Related Packages (monorepo)
- `@dineug/erd-editor-schema` — Schema parsers (V2/V3), LWW operations
- `@dineug/schema-sql-parser` — SQL DDL parser for import
- `@dineug/erd-editor/engine.js` — Engine utilities (replication store)
