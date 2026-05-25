# Hoppscotch Schema Versioning (verzod) — Detailed Steps

## Adding a New Field to HoppRESTRequest

Example: Adding `pathParams` field (v18 schema).

### 1. Define the type in a SEPARATE file (avoid circular deps)

**Critical**: Put shared schema definitions in a standalone file (e.g., `v/18/params.ts`)
that does NOT import from the version chain. Other modules that need the type
(like `original-request/v/7.ts`) import from `params.ts`, not from `v/18/index.ts`.

```
v/18/params.ts    ← HoppRESTPathParams definition (only imports zod)
v/18/index.ts     ← imports params.ts + V17_SCHEMA, defines V18_SCHEMA
```

In `packages/hoppscotch-data/src/rest/v/18/params.ts`:

```ts
import { z } from "zod"

export const HoppRESTPathParams = z.array(
  z.object({
    key: z.string().catch(""),
    value: z.string().catch(""),
    active: z.boolean().catch(true),
    description: z.string().catch(""),
  })
)
export type HoppRESTPathParams = z.infer<typeof HoppRESTPathParams>
```

In `packages/hoppscotch-data/src/rest/v/18/index.ts`:

```ts
import { defineVersion } from "verzod"
import { V17_SCHEMA } from "../17"
import { HoppRESTPathParams } from "./params"

export { HoppRESTPathParams } from "./params"

export const V18_SCHEMA = V17_SCHEMA.extend({
  v: z.literal("18"),
  pathParams: HoppRESTPathParams,
})

export default defineVersion({
  schema: V18_SCHEMA,
  initial: false,
  up(old) {
    return { ...old, v: "18" as const, pathParams: [] }
  },
})
```

### Why separate files?

When `original-request/v/7.ts` imports `HoppRESTPathParams` from `rest/v/18/index.ts`,
Rollup traces through both chains and may emit the minified schema variable (`ol`)
at a line AFTER its first usage, causing `ReferenceError: Cannot access 'ol' before
initialization` at runtime → blank page. The standalone `params.ts` has no version-chain
imports, so Rollup can safely place it before any consumer.

### 2. Register in index.ts

In `packages/hoppscotch-data/src/rest/index.ts`:

```ts
import V18_VERSION, { HoppRESTPathParams } from "./v/18"

// In versionMap:
18: V18_VERSION,

// Export:
export { HoppRESTPathParams } from "./v/18"

// Bump:
export const RESTReqSchemaVersion = "18"
```

### 3. Also update original-request schema if needed

If the new field also applies to `HoppRESTResponseOriginalRequest`, update the
corresponding version in `rest-request-response/original-request/v/`:

```ts
// original-request/v/7.ts
import { HoppRESTPathParams } from "../../../rest/v/18/params"  // from params.ts, NOT index.ts!
```

### 4. Eq rule

In `HoppRESTRequestEq`, add:

```ts
pathParams: mapThenEq(
  (arr) => arr.filter((p: any) => p.key !== "" && p.value !== ""),
  lodashIsEqualEq
),
```

### 5. Export new type from rest/index.ts

```ts
export type HoppRESTPathParam = HoppRESTRequest["pathParams"][number]
```

### 6. Update safelyExtractRESTRequest() and getDefaultRESTRequest()

```ts
// In safelyExtractRESTRequest():
if ("pathParams" in x) {
  const result = HoppRESTPathParams.safeParse(x.pathParams)
  if (result.success) { req.pathParams = result.data }
} else {
  req.pathParams = []  // REQUIRED for old data
}

// In getDefaultRESTRequest():
return {
  v: RESTReqSchemaVersion,
  // ...existing fields...
  pathParams: [],
}
```

## Key Points

- Shared schemas (used by multiple modules) MUST be in standalone files with no version-chain imports
- `safelyExtractRESTRequest()` runs through all version `up()` functions in sequence
- `getDefaultRESTRequest()` returns the current version's default — include the new field with `[]`
- localStorage may have older version requests — the `up()` chain handles migration
- Always test with existing tabs open (old schema data) AND new tabs (new schema data)
- After modifying `hoppscotch-data` source, rebuild: `cd packages/hoppscotch-data && pnpm build`
- Verify dist file has no declaration-order issues: `grep -n 'minifiedVar = \|minifiedVar\.' dist/hoppscotch-data.js`
