# REST_TAB_STATE_SCHEMA Validation Fix

## Problem
Users see "Schema validation failed for persistence.v1:restTabs" toast on page load.
The app creates a `-backup` copy and starts with empty tabs.

## Root Cause
`REST_TAB_STATE_SCHEMA` in `services/persistence/validation-schemas/index.ts` has
TWO layers of strict validation that both reject unknown/mismatched fields:

1. **Top-level `.strict()`** — rejects any undeclared field on the wrapper object
2. **`entityReference()` calls** — verzod versioned entities that call `entity.is()` +
   `entity.safeParse()`. If the verzod version check fails (old data shape vs new schema),
   the entire doc fails even if only one nested field is wrong

When `HoppRequestDocument` (TypeScript type) gains new fields (e.g., `designSubModePreference`,
`bodyExamples`, `bodyModelRef`), both layers can fail independently or together.

## Known Triggers
1. **Missing schema field**: New field in `HoppRequestDocument` not added to the
   request doc-type schema in the union
2. **Versioned entity mismatch**: `entityReference(HoppRESTRequest)` fails when
   persisted data has a different verzod version than the current schema
3. **Stale persisted data**: Old IndexedDB data with fields from removed/renamed schemas
4. **Nested strict objects**: Inner doc-type schemas in the union also reject unknown fields

## Complete Fix (Applied 2026-05-28)

### Step 1: Replace all `entityReference()` calls with `z.any()`
The verzod `entityReference()` is too strict for persistence validation — it checks
the full versioned entity schema including all nested fields. For tab persistence,
we only need structural validation (the right shape), not full version compliance.

```typescript
// BEFORE (fails on version mismatch)
request: entityReference(HoppRESTRequest),
response: z.nullable(HoppRESTResponseSchema),
collection: HoppRESTCollectionSchema,

// AFTER (permissive, allows any shape)
request: z.any(),
response: z.nullable(z.any()),
collection: z.any(),
```

Replace ALL of these in the REST_TAB_STATE_SCHEMA:
- `entityReference(HoppRESTRequest)` → `z.any()`
- `entityReference(HoppCollection)` → `z.any()`
- `entityReference(HoppRESTRequestResponse)` → `z.any()`
- `HoppRESTResponseSchema` → `z.any()`
- `HoppTestResultSchema` → `z.any()`
- `HoppInheritedPropertySchema` → `z.any()`
- `HoppRESTSaveContextSchema` → `z.any()`

### Step 2: Change `.strict()` to `.passthrough()` at ALL levels
```typescript
export const REST_TAB_STATE_SCHEMA = z
  .object({
    lastActiveTabID: z.string(),
    orderedDocs: z.array(
      z.object({
        tabID: z.string(),
        doc: z.union([
          z.object({ /* test-runner */ }).passthrough(),  // was implicit strict
          z.object({ /* request */ }).passthrough(),      // was implicit strict
          z.object({ /* example-response */ }).passthrough(), // was implicit strict
        ]),
      }).passthrough()  // was implicit strict
    ),
  })
  .passthrough()  // was .strict()
```

### Step 3: Keep known required fields validated
The union discriminator (`type` literal) and structural fields (`tabID`, `lastActiveTabID`,
`isDirty`, `optionTabPreference`, `modePreference`, `designSubModePreference`) should
remain strictly typed — only the deeply-nested entity references become `z.any()`.

## Debugging
Error handler in `services/persistence/index.ts` logs specific Zod issues:
```typescript
console.error(
  `Failed parsing persisted REST_TABS:`,
  JSON.stringify(result.error?.issues?.slice(0, 5))
)
```
This shows field paths like `["orderedDocs", 0, "doc", "designSubModePreference"]`
with expected types.

## Adding New Tab Document Fields — Checklist
1. Add to `HoppRequestDocument` type in `helpers/rest/document.ts`
2. Add to `REST_TAB_STATE_SCHEMA` request branch (around line 601) as `z.optional(...)`
3. If the field has a default, add to `getDefaultRESTRequest()` or RESTTabService constructor
4. Verify: open app, create tab with the field set, close tab, hard-refresh — no toast error

**NOTE**: After the 2026-05-28 fix, step 2 is less critical (since `.passthrough()` allows
unknown fields), but still good practice for documentation and type inference.

## Files Involved
- `packages/hoppscotch-common/src/helpers/rest/document.ts` — TypeScript type definitions
- `packages/hoppscotch-common/src/services/persistence/validation-schemas/index.ts` — Zod schemas (line 566+)
- `packages/hoppscotch-common/src/services/persistence/index.ts` — Load/save logic (line 1066+)
- `packages/hoppscotch-common/src/helpers/fixBrokenRequestVersion.ts` — Data migration helper
