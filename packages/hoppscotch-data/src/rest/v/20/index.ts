import { z } from "zod"
import { defineVersion } from "verzod"
import { V19_SCHEMA } from "../19"

// API Status enum for documentation lifecycle
export const HoppRESTApiStatus = z.enum([
  "designing",
  "developing",
  "testing",
  "published",
  "deprecated",
])
export type HoppRESTApiStatus = z.infer<typeof HoppRESTApiStatus>

// Schema tree node for visual JSON Schema editing
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
}

// Use z.any() for recursive schema to avoid TS inference issues with z.lazy
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
})

export const HoppRESTSchemaNodeSchema = schemaNodeShape
export type _HoppRESTSchemaNodeParsed = z.infer<typeof schemaNodeShape>

// Extended response model with schema tree and content type
export const HoppRESTResponseModelV20 = z.object({
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
  // New fields for v20
  bodySchemaTree: z.array(z.any()).nullable().catch(null),
  contentType: z.string().catch("application/json"),
})

export type HoppRESTResponseModelV20 = z.infer<typeof HoppRESTResponseModelV20>

export const V20_SCHEMA = V19_SCHEMA.extend({
  v: z.literal("20"),
  // Documentation metadata
  apiTitle: z.string().catch(""),
  apiStatus: HoppRESTApiStatus.catch("developing"),
  tags: z.array(z.string()).catch([]),
  responsibility: z.string().catch(""),
  inheritedBaseUrl: z.string().catch(""),
  // Override responseModels with extended version
  responseModels: z.array(HoppRESTResponseModelV20).catch([]),
})

const V20_VERSION = defineVersion({
  schema: V20_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V19_SCHEMA>) {
    return {
      ...old,
      v: "20" as const,
      apiTitle: "",
      apiStatus: "developing" as const,
      tags: [],
      responsibility: "",
      inheritedBaseUrl: "",
      // Migrate existing responseModels to v20 format
      responseModels: (old.responseModels ?? []).map((m) => ({
        ...m,
        bodySchemaTree: null,
        contentType: "application/json",
      })),
    }
  },
})

export default V20_VERSION
