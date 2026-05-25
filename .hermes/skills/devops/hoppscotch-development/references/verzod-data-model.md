# Verzod Data Model Extension — Detailed Pattern

## Adding Fields to HoppRESTRequest

Complete step-by-step for adding `responseModels` and `testCases` fields (v18→v19 migration).

### 1. Create Version Module

**Path**: `packages/hoppscotch-data/src/rest/v/19/index.ts`

Key patterns:
- Define new zod schemas for complex types BEFORE the version schema
- Use `.catch()` on every field for safe migration defaults
- Extend previous version schema with `.extend()`
- Export both the zod schema and the inferred type

```typescript
import { z } from "zod"
import { defineVersion } from "verzod"
import { V18_SCHEMA } from "../18"

// Define sub-types with .catch() defaults
export const HoppRESTResponseModel = z.object({
  statusCode: z.string().catch("200"),
  description: z.string().catch(""),
  headers: z.array(z.object({
    key: z.string().catch(""),
    description: z.string().catch(""),
  })).catch([]),
  bodySchema: z.string().catch(""),
  bodyExample: z.string().catch(""),
})

export type HoppRESTResponseModel = z.infer<typeof HoppRESTResponseModel>

// Version schema extends previous
export const V19_SCHEMA = V18_SCHEMA.extend({
  v: z.literal("19"),
  responseModels: z.array(HoppRESTResponseModel).catch([]),
  testCases: z.array(HoppRESTTestCase).catch([]),
})

const V19_VERSION = defineVersion({
  schema: V19_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V18_SCHEMA>) {
    return { ...old, v: "19" as const, responseModels: [], testCases: [] }
  },
})
```

### 2. Register in rest/index.ts

Changes needed:
- Import V19_VERSION and new types
- Add to versionMap
- Update latestVersion number
- Update RESTReqSchemaVersion string
- Add to Eq struct (use `lodashIsEqualEq` for arrays/objects)
- Add defaults to `getDefaultRESTRequest()`
- Add extraction logic to `safelyExtractRESTRequest()`

### 3. Re-export Pattern

Avoid naming conflicts between zod schemas and TypeScript types:

```typescript
// Export schema with Schema suffix, type separately
export {
  HoppRESTResponseModel as HoppRESTResponseModelSchema,
} from "./v/19"

export type HoppRESTResponseModel = z.infer<typeof HoppRESTResponseModelSchema>
```

### 4. Directory vs File Version Modules

- v0-v17: single `.ts` files (`v/17.ts`)
- v18+: directories with `index.ts` (`v/18/index.ts`)

When a version is a directory, sibling imports use `"../18"` which resolves to `../18/index.ts`.

If TypeScript fails to resolve, try `"../18/index"` explicitly — but the bare directory path usually works with `moduleResolution: "node"`.

### 5. Persistence Schema Update

File: `services/persistence/validation-schemas/index.ts`

Add new document fields as optional:
```typescript
modePreference: z.optional(z.enum(["debug", "design", "testcases"])),
```

New request-level fields (like `responseModels`, `testCases`) do NOT need separate persistence schema entries — they are part of the versioned `HoppRESTRequest` entity and are validated by the verzod schema.
