import { z } from "zod"
import { defineVersion } from "verzod"
import { V20_SCHEMA } from "../20"

// ─── HoppRESTSchemaNode v21 ────────────────────────────────────────
// Added `example` (documentation example value) and `modelRef` (reference
// to a reusable HoppWorkspaceModel by ID) on top of the v20 shape.

export type HoppRESTSchemaNode = {
  name: string
  type:
    | "object"
    | "string"
    | "integer"
    | "number"
    | "boolean"
    | "array"
    | "file"
  mock: string
  displayName: string
  description: string
  required: boolean
  children: HoppRESTSchemaNode[]
  /** Example value for documentation (distinct from mock which drives generation) */
  example: string
  /** Reference ID of a HoppWorkspaceModel — when set, the node's children are resolved from that model */
  modelRef: string
}

const schemaNodeShape = z.object({
  name: z.string().catch(""),
  type: z
    .enum(["object", "string", "integer", "number", "boolean", "array", "file"])
    .catch("string"),
  mock: z.string().catch(""),
  displayName: z.string().catch(""),
  description: z.string().catch(""),
  required: z.boolean().catch(true),
  children: z.array(z.any()).catch([]),
  // v21 additions
  example: z.string().catch(""),
  modelRef: z.string().catch(""),
})

export const HoppRESTSchemaNodeSchema = schemaNodeShape
export type _HoppRESTSchemaNodeParsed = z.infer<typeof schemaNodeShape>

// ─── HoppWorkspaceModel ────────────────────────────────────────────
// A reusable model definition stored at workspace level. Schema nodes
// reference these via `modelRef` (the `id` field). Managed by
// WorkspaceModelService (Dioc) with IndexedDB persistence.

export const HoppWorkspaceModel = z.object({
  /** Unique identifier — used as modelRef in HoppRESTSchemaNode */
  id: z.string(),
  /** Human-readable name shown in model picker UI */
  name: z.string().catch(""),
  /** Optional description for documentation */
  description: z.string().catch(""),
  /** The schema tree that defines this model's structure */
  schemaTree: z.array(z.any()).catch([]),
  /** ISO timestamp of creation */
  createdAt: z.string().catch(""),
  /** ISO timestamp of last modification */
  updatedAt: z.string().catch(""),
})

export type HoppWorkspaceModel = z.infer<typeof HoppWorkspaceModel>

// ─── HoppRESTResponseModel v21 ─────────────────────────────────────
// Identical shape to v20 — the schema-node changes are inside
// bodySchemaTree (z.any[]) so no response-model schema change needed.
// Re-exported for consistency.

export const HoppRESTResponseModelV21 = z.object({
  statusCode: z.string().catch("200"),
  description: z.string().catch(""),
  headers: z
    .array(
      z.object({
        key: z.string().catch(""),
        description: z.string().catch(""),
      })
    )
    .catch([]),
  bodySchema: z.string().catch(""),
  bodyExample: z.string().catch(""),
  bodySchemaTree: z.array(z.any()).nullable().catch(null),
  contentType: z.string().catch("application/json"),
})

export type HoppRESTResponseModelV21 = z.infer<typeof HoppRESTResponseModelV21>

// ─── V21 Schema ────────────────────────────────────────────────────
// The only structural change at the request level is the version bump.
// Schema-node fields (example, modelRef) live inside bodySchemaTree
// which is z.array(z.any()), so they don't affect the top-level zod
// schema. The migration still needs to run so that existing
// bodySchemaTree nodes get default values for the new fields.

export const V21_SCHEMA = V20_SCHEMA.extend({
  v: z.literal("21"),
  responseModels: z.array(HoppRESTResponseModelV21).catch([]),
})

// ─── Migration helper ──────────────────────────────────────────────
// Recursively patches every node in a schema tree to include the v21
// fields with safe defaults.

function migrateSchemaNode(node: Record<string, unknown>): Record<string, unknown> {
  return {
    ...node,
    example: typeof node.example === "string" ? node.example : "",
    modelRef: typeof node.modelRef === "string" ? node.modelRef : "",
    children: Array.isArray(node.children)
      ? node.children.map((child: Record<string, unknown>) => migrateSchemaNode(child))
      : [],
  }
}

// ─── Version definition ────────────────────────────────────────────

const V21_VERSION = defineVersion({
  schema: V21_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V20_SCHEMA>) {
    return {
      ...old,
      v: "21" as const,
      // Migrate responseModels: patch bodySchemaTree nodes with new fields
      responseModels: (old.responseModels ?? []).map((m) => ({
        ...m,
        bodySchemaTree: Array.isArray(m.bodySchemaTree)
          ? m.bodySchemaTree.map((node: Record<string, unknown>) =>
              migrateSchemaNode(node)
            )
          : m.bodySchemaTree,
      })),
    }
  },
})

export default V21_VERSION
