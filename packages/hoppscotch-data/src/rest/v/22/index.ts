import { z } from "zod"
import { defineVersion } from "verzod"
import { V21_SCHEMA } from "../21"

// ─── V22 Schema ────────────────────────────────────────────────────
// Adds top-level request body schema tree and model reference for
// document mode. This mirrors the response model pattern (rootModelRef
// + bodySchemaTree on HoppRESTResponseModelV21) but at the request level.

export const V22_SCHEMA = V21_SCHEMA.extend({
  v: z.literal("22"),
  /** Schema tree for request body documentation (visual editor) */
  bodySchemaTree: z.array(z.any()).nullable().catch(null),
  /** Reference ID of a HoppWorkspaceModel bound to the request body */
  bodyModelRef: z.string().catch(""),
})

// ─── Version definition ────────────────────────────────────────────

const V22_VERSION = defineVersion({
  schema: V22_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V21_SCHEMA>) {
    return {
      ...old,
      v: "22" as const,
      bodySchemaTree: null,
      bodyModelRef: "",
    }
  },
})

export default V22_VERSION
