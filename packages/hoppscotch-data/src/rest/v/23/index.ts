import { z } from "zod"
import { defineVersion } from "verzod"
import { V22_SCHEMA } from "../22"
import { HoppRESTResponseModelV21 } from "../21"

// ─── HoppRESTBodyExample v23 ───────────────────────────────────────
// A named example for the request body, stored at the request level.

export const HoppRESTBodyExample = z.object({
  name: z.string().catch(""),
  body: z.string().catch(""),
  contentType: z.string().catch("application/json"),
})

export type HoppRESTBodyExample = z.infer<typeof HoppRESTBodyExample>

// ─── HoppRESTResponseExample v23 ───────────────────────────────────
// A named example for a response model, stored inside each responseModel.

export const HoppRESTResponseExample = z.object({
  name: z.string().catch(""),
  body: z.string().catch(""),
})

export type HoppRESTResponseExample = z.infer<typeof HoppRESTResponseExample>

// ─── HoppRESTResponseModel v23 ─────────────────────────────────────
// Extends v21 response model with an examples array.

export const HoppRESTResponseModelV23 = HoppRESTResponseModelV21.extend({
  examples: z.array(HoppRESTResponseExample).max(20).catch([]),
})

export type HoppRESTResponseModelV23 = z.infer<typeof HoppRESTResponseModelV23>

// ─── V23 Schema ────────────────────────────────────────────────────
// Adds bodyExamples at the request level and examples inside each responseModel.

export const V23_SCHEMA = V22_SCHEMA.extend({
  v: z.literal("23"),
  /** Named examples for the request body */
  bodyExamples: z.array(HoppRESTBodyExample).max(20).catch([]),
  /** Override responseModels with v23 version (adds examples) */
  responseModels: z.array(HoppRESTResponseModelV23).max(20).catch([]),
})

// ─── Version definition ────────────────────────────────────────────

const V23_VERSION = defineVersion({
  schema: V23_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V22_SCHEMA>) {
    return {
      ...old,
      v: "23" as const,
      bodyExamples: [],
      // Migrate existing responseModels: add empty examples array to each
      responseModels: (old.responseModels ?? []).map((m) => ({
        ...m,
        examples: [],
      })),
    }
  },
})

export default V23_VERSION
