# Verzod Migration Checklist

Step-by-step guide for adding new fields to Hoppscotch's versioned data models.

## When You Need This

Any change to the shape of these entities requires a new schema version:
- `HoppRESTRequest` (current: v17, `@hoppscotch/data/rest`)
- `HoppGQLRequest` (current: v9, `@hoppscotch/data/graphql`)
- `HoppCollection` (current: v12, `@hoppscotch/data/collection`)
- `Environment` (current: v2, `@hoppscotch/data/environment`)
- `GlobalEnvironment` (current: v2, `@hoppscotch/data/global-environment`)

## Example: Adding `pathParams` to HoppRESTRequest

### Step 1: Create New Version Schema

Create `packages/hoppscotch-data/src/rest/v/18.ts`:

```ts
import { z } from "zod"
import { HoppRESTRequestV17 } from "./17"

// New schema: extend v17 with new field
export const HoppRESTRequestV18 = HoppRESTRequestV17.extend({
  pathParams: z.array(z.object({
    key: z.string(),
    value: z.string(),
    active: z.boolean().default(true),
    description: z.string().default(""),
  })).default([]),
})

// Migration function: v17 → v18
export function migrateV17ToV18(data: z.infer<typeof HoppRESTRequestV17>): z.infer<typeof HoppRESTRequestV18> {
  return {
    ...data,
    pathParams: [],  // default value for existing data
  }
}
```

### Step 2: Register New Version in Entity Definition

Edit `packages/hoppscotch-data/src/rest/index.ts`:

```ts
// Add import
import { HoppRESTRequestV18, migrateV17ToV18 } from "./v/18"

// Update createVersionedEntity call:
// - Change latestVersion reference from 17 to 18
// - Add version 18 to the chain
```

### Step 3: Update getEffectiveRESTRequest()

File: `packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts`

The `EffectiveHoppRESTRequest` type must include the new field. Update the type and
the `getEffectiveRESTRequest()` function to process `pathParams`.

### Step 4: Update RESTRequest.toRequest() Conversion

File: `packages/hoppscotch-kernel/src/rest/request.ts`

If the new field affects the wire request (e.g., path params modify the URL),
update `toRequest()` to include the transformation logic.

### Step 5: Null-Safe Access in ALL UI Components

**THIS IS THE MOST COMMONLY MISSED STEP.**

Existing users have localStorage data in the OLD format. When they open a tab,
the tab data won't have the new field. Without null-safe access, the app crashes with:

```
TypeError: Cannot read properties of undefined (reading 'filter')
```

Search ALL components that access the new field:

```bash
grep -rn "request\.value\.pathParams" packages/hoppscotch-common/src/
```

For EACH occurrence, add null-safe fallback:
```ts
// BAD: crashes on old data
request.value.pathParams.filter(...)

// GOOD: safe on old data
(request.value.pathParams ?? []).filter(...)
```

Four key locations to check:
1. **Component templates** — v-for, computed properties, method calls
2. **getEffectiveRESTRequest()** — must handle undefined field
3. **toRequest()** — must handle undefined field
4. **Tab restore logic** — must provide default value when loading old tabs

### Step 6: Verify

```bash
cd packages/hoppscotch-data && pnpm run typecheck    # Schema compiles
cd packages/hoppscotch-common && pnpm run typecheck  # UI compiles
pnpm run typecheck                                    # Everything compiles

# Test with old data: clear localStorage or use existing saved tabs
# Must NOT produce blank page or console errors
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing migration function | Old data fails to parse | Add `migrateV[n-1]ToV[n]` function |
| No null-safe access in components | Blank page on existing tabs | Add `?? defaultValue` everywhere |
| Forgetting to update index.ts | New version not registered | Update entity definition file |
| Not updating EffectiveRequest | New field ignored in pipeline | Update `EffectiveHoppRESTRequest` type |
| Circular dependency in hoppscotch-data | Blank page on build | Extract shared schemas to standalone files |

## Directory Structure Reference

```
packages/hoppscotch-data/src/rest/
├── index.ts           # Entity definition (createVersionedEntity)
├── content-types.ts   # Shared content type definitions
└── v/
    ├── 0.ts           # Initial version (initial: true, no migration)
    ├── 1.ts           # V1 schema + migration from V0
    ├── ...
    └── 17.ts          # Latest version (as of this writing)
```

Each version file exports:
- A zod schema (`HoppRESTRequestV[n]`)
- A migration function (`migrateV[n-1]ToV[n]`) — except v0 which has no predecessor
