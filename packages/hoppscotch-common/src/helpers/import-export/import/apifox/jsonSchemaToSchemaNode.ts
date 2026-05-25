/**
 * Converts Apifox JSON Schema to Hoppscotch HoppRESTSchemaNode trees.
 *
 * This is the core utility for the Apifox import pipeline. It handles:
 * - Standard JSON Schema types (object, string, integer, number, boolean, array)
 * - `$ref` references → `modelRef` via a refMap
 * - `x-apifox-orders` field ordering
 * - `required[]` array → per-node required flag
 * - `description`, `example`, `title`, `format`, `enum` mapping
 * - Recursive nested objects and arrays
 *
 * Used by:
 * - schemaCollection → HoppWorkspaceModel import (child task)
 * - API requestBody/response JSON Schema → bodySchemaTree conversion
 */

import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import type { ApifoxJsonSchemaProperty } from "./types"

/**
 * Map of Apifox `$ref` paths (e.g. "#/definitions/25444390") to
 * Hoppscotch workspace model UUIDs. Built during the model import phase
 * before converting individual schemas.
 */
export type RefMap = Map<string, string>

/**
 * Options for the JSON Schema → SchemaNode conversion.
 */
export type ConvertOptions = {
  /**
   * Maximum recursion depth to prevent stack overflow on circular schemas.
   * Default: 20.
   */
  maxDepth?: number

  /**
   * When true, appends format info (e.g. "int64", "date-time") to description.
   * Default: true.
   */
  includeFormat?: boolean

  /**
   * When true, stores enum values in the description field.
   * Default: true.
   */
  includeEnum?: boolean
}

const DEFAULT_OPTIONS: Required<ConvertOptions> = {
  maxDepth: 20,
  includeFormat: true,
  includeEnum: true,
}

/**
 * Maps a JSON Schema `type` string to a HoppRESTSchemaNode type.
 *
 * JSON Schema types: string, number, integer, boolean, object, array, null
 * HoppRESTSchemaNode types: object, string, integer, number, boolean, array, file
 *
 * Mapping:
 * - "string" → "string"
 * - "integer" → "integer"
 * - "number" → "number"
 * - "boolean" → "boolean"
 * - "object" → "object"
 * - "array" → "array"
 * - "null" → "string" (fallback, no null type in HoppRESTSchemaNode)
 * - "file" → "file" (Apifox extension for file uploads)
 * - unknown → "string" (safe fallback)
 */
function mapType(
  type: string | string[] | undefined
): HoppRESTSchemaNode["type"] {
  // Handle array type (e.g. ["string", "null"]) — pick first non-null
  if (Array.isArray(type)) {
    const nonNull = type.find((t) => t !== "null")
    return mapType(nonNull ?? "string")
  }

  switch (type) {
    case "string":
      return "string"
    case "integer":
      return "integer"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "object":
      return "object"
    case "array":
      return "array"
    case "file":
      return "file"
    case "null":
      return "string"
    default:
      return "string"
  }
}

/**
 * Converts an example value to a string representation.
 * Handles numbers, booleans, strings, null, objects, arrays.
 */
function exampleToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  // Objects/arrays → JSON string
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Builds a description string by combining base description with optional
 * format and enum information.
 */
function buildDescription(
  prop: ApifoxJsonSchemaProperty,
  options: Required<ConvertOptions>
): string {
  const parts: string[] = []

  if (prop.description) {
    parts.push(prop.description)
  }

  if (options.includeFormat && prop.format) {
    parts.push(`[format: ${prop.format}]`)
  }

  if (options.includeEnum && prop.enum && prop.enum.length > 0) {
    // Limit to first 10 values to avoid huge descriptions
    const values = prop.enum.slice(0, 10).map(String)
    const suffix =
      prop.enum.length > 10 ? `, ... (${prop.enum.length} total)` : ""
    parts.push(`enum: ${values.join(", ")}${suffix}`)
  }

  return parts.join(" | ")
}

/**
 * Creates an empty HoppRESTSchemaNode with safe defaults.
 */
function makeNode(
  overrides: Partial<HoppRESTSchemaNode> = {}
): HoppRESTSchemaNode {
  return {
    name: "",
    type: "string",
    mock: "",
    displayName: "",
    description: "",
    required: false,
    children: [],
    example: "",
    modelRef: "",
    ...overrides,
  }
}

/**
 * Converts a JSON Schema property into a single HoppRESTSchemaNode.
 * This is the core recursive conversion function.
 *
 * @param name - The field name (key in parent's properties object)
 * @param prop - The JSON Schema property definition
 * @param isRequired - Whether this field is in the parent's required[] array
 * @param refMap - Map of $ref paths to workspace model UUIDs
 * @param options - Conversion options
 * @param depth - Current recursion depth (internal use)
 * @returns A fully populated HoppRESTSchemaNode
 */
function convertProperty(
  name: string,
  prop: ApifoxJsonSchemaProperty,
  isRequired: boolean,
  refMap: RefMap,
  options: Required<ConvertOptions>,
  depth: number
): HoppRESTSchemaNode {
  // Guard against excessive recursion
  if (depth > options.maxDepth) {
    return makeNode({
      name,
      type: "object",
      description: `[max depth ${options.maxDepth} exceeded]`,
      required: isRequired,
    })
  }

  // Handle $ref → modelRef
  if (prop.$ref) {
    const uuid = refMap.get(prop.$ref)
    return makeNode({
      name,
      type: "object",
      description: prop.description ?? "",
      required: isRequired,
      modelRef: uuid ?? "",
    })
  }

  // Handle composition keywords (allOf, oneOf, anyOf)
  if (prop.allOf || prop.oneOf || prop.anyOf) {
    return convertComposition(name, prop, isRequired, refMap, options, depth)
  }

  const type = mapType(prop.type)
  const description = buildDescription(prop, options)
  const example = exampleToString(prop.example ?? prop.default)

  const baseNode = makeNode({
    name,
    type,
    description,
    required: isRequired,
    example,
    displayName: prop.title ?? "",
  })

  // Object with properties → recurse into children
  if (type === "object" && prop.properties) {
    baseNode.children = convertProperties(prop, refMap, options, depth + 1)
  }

  // Array → convert items to children
  if (type === "array" && prop.items) {
    baseNode.children = convertArrayItems(
      name,
      prop.items,
      refMap,
      options,
      depth + 1
    )
  }

  return baseNode
}

/**
 * Converts a JSON Schema's `properties` object into an ordered array
 * of HoppRESTSchemaNode children.
 *
 * Uses `x-apifox-orders` for field ordering when available,
 * falling back to Object.keys() order.
 */
function convertProperties(
  schema: ApifoxJsonSchemaProperty,
  refMap: RefMap,
  options: Required<ConvertOptions>,
  depth: number
): HoppRESTSchemaNode[] {
  const properties = schema.properties ?? {}
  const requiredFields = new Set(schema.required ?? [])

  // Determine field order: prefer x-apifox-orders, fallback to Object.keys
  const apifoxOrders = schema["x-apifox-orders"]
  const orderedKeys =
    apifoxOrders && apifoxOrders.length > 0
      ? [
          // First: fields in x-apifox-orders (preserves Apifox UI order)
          ...apifoxOrders.filter((key) => key in properties),
          // Then: any remaining fields not in x-apifox-orders
          ...Object.keys(properties).filter(
            (key) => !apifoxOrders.includes(key)
          ),
        ]
      : Object.keys(properties)

  return orderedKeys.map((key) =>
    convertProperty(
      key,
      properties[key],
      requiredFields.has(key),
      refMap,
      options,
      depth
    )
  )
}

/**
 * Converts array `items` into child nodes.
 *
 * Array items can be:
 * 1. An object with properties → children are the object's fields
 * 2. A $ref → single child node with modelRef
 * 3. A primitive type → single child node named "item"
 */
function convertArrayItems(
  parentName: string,
  items: ApifoxJsonSchemaProperty,
  refMap: RefMap,
  options: Required<ConvertOptions>,
  depth: number
): HoppRESTSchemaNode[] {
  // Case 1: items is an object with properties
  if (items.type === "object" && items.properties) {
    return convertProperties(items, refMap, options, depth)
  }

  // Case 2: items is a $ref
  if (items.$ref) {
    const uuid = refMap.get(items.$ref)
    return [
      makeNode({
        name: "item",
        type: "object",
        description: items.description ?? "",
        modelRef: uuid ?? "",
      }),
    ]
  }

  // Case 3: items has composition keywords
  if (items.allOf || items.oneOf || items.anyOf) {
    return [convertComposition("item", items, false, refMap, options, depth)]
  }

  // Case 4: primitive array item
  return [
    makeNode({
      name: "item",
      type: mapType(items.type),
      description: items.description ?? "",
      example: exampleToString(items.example ?? items.default),
    }),
  ]
}

/**
 * Handles JSON Schema composition keywords (allOf, oneOf, anyOf).
 *
 * Strategy:
 * - allOf: merge all sub-schemas' properties into one node
 * - oneOf/anyOf: use the first sub-schema (most common in practice)
 */
function convertComposition(
  name: string,
  prop: ApifoxJsonSchemaProperty,
  isRequired: boolean,
  refMap: RefMap,
  options: Required<ConvertOptions>,
  depth: number
): HoppRESTSchemaNode {
  const schemas = prop.allOf ?? prop.oneOf ?? prop.anyOf ?? []

  if (schemas.length === 0) {
    return makeNode({ name, type: "object", required: isRequired })
  }

  // allOf: merge properties from all sub-schemas
  if (prop.allOf) {
    const mergedProperties: Record<string, ApifoxJsonSchemaProperty> = {}
    const mergedRequired: string[] = []
    let mergedDescription = prop.description ?? ""

    for (const sub of schemas) {
      // Handle $ref in allOf — treat as modelRef on the node
      if (sub.$ref) {
        const uuid = refMap.get(sub.$ref)
        if (uuid) {
          return makeNode({
            name,
            type: "object",
            description: mergedDescription || sub.description || "",
            required: isRequired,
            modelRef: uuid,
          })
        }
      }

      if (sub.properties) {
        Object.assign(mergedProperties, sub.properties)
      }
      if (sub.required) {
        mergedRequired.push(...sub.required)
      }
      if (sub.description && !mergedDescription) {
        mergedDescription = sub.description
      }
    }

    const mergedSchema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: mergedProperties,
      required: mergedRequired,
      description: mergedDescription,
    }

    return makeNode({
      name,
      type: "object",
      description: mergedDescription,
      required: isRequired,
      children: convertProperties(mergedSchema, refMap, options, depth + 1),
    })
  }

  // oneOf / anyOf: use the first sub-schema
  const first = schemas[0]
  if (first.$ref) {
    const uuid = refMap.get(first.$ref)
    return makeNode({
      name,
      type: "object",
      description: prop.description ?? first.description ?? "",
      required: isRequired,
      modelRef: uuid ?? "",
    })
  }

  return convertProperty(
    name,
    { ...first, description: prop.description ?? first.description },
    isRequired,
    refMap,
    options,
    depth + 1
  )
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Converts a JSON Schema object into an array of HoppRESTSchemaNode.
 *
 * This is the main entry point for the converter. It takes a JSON Schema
 * (as found in Apifox exports) and produces a tree of HoppRESTSchemaNode
 * suitable for use as bodySchemaTree or workspace model schemaTree.
 *
 * @param schema - The JSON Schema to convert (typically with `type: "object"` and `properties`)
 * @param refMap - Map of `$ref` paths to workspace model UUIDs
 * @param options - Optional conversion settings
 * @returns Array of HoppRESTSchemaNode representing the schema tree
 *
 * @example
 * ```ts
 * const refMap = new Map([["#/definitions/123", "uuid-abc"]])
 * const tree = jsonSchemaToSchemaNode(
 *   {
 *     type: "object",
 *     properties: {
 *       id: { type: "integer", description: "用户ID" },
 *       name: { type: "string", description: "用户名" },
 *     },
 *     required: ["id"],
 *     "x-apifox-orders": ["id", "name"],
 *   },
 *   refMap
 * )
 * // tree[0] = { name: "id", type: "integer", required: true, ... }
 * // tree[1] = { name: "name", type: "string", required: false, ... }
 * ```
 */
export function jsonSchemaToSchemaNode(
  schema: ApifoxJsonSchemaProperty,
  refMap: RefMap = new Map(),
  options: ConvertOptions = {}
): HoppRESTSchemaNode[] {
  const opts: Required<ConvertOptions> = { ...DEFAULT_OPTIONS, ...options }

  // Handle top-level $ref
  if (schema.$ref) {
    const uuid = refMap.get(schema.$ref)
    return [
      makeNode({
        name: schema.title ?? "root",
        type: "object",
        description: schema.description ?? "",
        modelRef: uuid ?? "",
      }),
    ]
  }

  // Handle non-object root (e.g. array schema)
  if (schema.type === "array" && schema.items) {
    return convertArrayItems(
      schema.title ?? "root",
      schema.items,
      refMap,
      opts,
      1
    )
  }

  // Standard object schema → convert properties
  return convertProperties(schema, refMap, opts, 1)
}

/**
 * Flattens a schemaCollection tree into an array of leaf schema models.
 * Utility for the model import phase.
 *
 * @param items - Array of folders/models from schemaCollection
 * @returns Flat array of all leaf schema models
 */
export function flattenSchemaCollection(
  items: Array<
    | { name: string; items?: unknown[]; schema?: unknown }
    | {
        name: string
        schema: { jsonSchema: ApifoxJsonSchemaProperty }
        id: string
      }
  >
): Array<{
  name: string
  id: string
  displayName?: string
  description?: string
  jsonSchema: ApifoxJsonSchemaProperty
}> {
  const result: Array<{
    name: string
    id: string
    displayName?: string
    description?: string
    jsonSchema: ApifoxJsonSchemaProperty
  }> = []

  for (const item of items) {
    if ("schema" in item && item.schema) {
      const model = item as {
        name: string
        id: string
        displayName?: string
        description?: string
        schema: { jsonSchema: ApifoxJsonSchemaProperty }
      }
      result.push({
        name: model.name,
        id: model.id,
        displayName: model.displayName,
        description: model.description,
        jsonSchema: model.schema.jsonSchema,
      })
    }

    if ("items" in item && Array.isArray(item.items)) {
      result.push(...flattenSchemaCollection(item.items as typeof items))
    }
  }

  return result
}

/**
 * Builds a refMap from flattened schema models.
 * Maps Apifox `$ref` paths (e.g. "#/definitions/25444390") to generated UUIDs.
 *
 * @param models - Flattened schema models from flattenSchemaCollection
 * @param uuidGenerator - Function to generate UUIDs (default: crypto.randomUUID or fallback)
 * @returns Map of $ref paths to UUIDs
 */
export function buildRefMap(
  models: Array<{ id: string }>,
  uuidGenerator?: () => string
): RefMap {
  const refMap: RefMap = new Map()
  const generateId = uuidGenerator ?? generateFallbackId

  for (const model of models) {
    if (model.id && !refMap.has(model.id)) {
      refMap.set(model.id, generateId())
    }
  }

  return refMap
}

/**
 * Simple fallback ID generator when crypto.randomUUID is not available.
 * Produces a v4-like UUID string.
 */
function generateFallbackId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0")
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`
}
