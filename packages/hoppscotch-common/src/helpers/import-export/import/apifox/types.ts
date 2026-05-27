/**
 * Apifox export format type definitions.
 *
 * Based on analysis of Apifox v1.2.0 export format (久婵平台.apifox.json).
 * Only covers the subset needed for JSON Schema → HoppRESTSchemaNode conversion.
 */

/**
 * JSON Schema property as used in Apifox exports.
 * Covers standard JSON Schema draft-07 fields plus Apifox extensions.
 */
export type ApifoxJsonSchemaProperty = {
  type?: string | string[]
  description?: string
  title?: string
  format?: string
  example?: unknown
  default?: unknown
  enum?: unknown[]
  $ref?: string

  // Object fields
  properties?: Record<string, ApifoxJsonSchemaProperty>
  required?: string[]

  // Array fields
  items?: ApifoxJsonSchemaProperty

  // Composition (rare in practice — 0 occurrences in 久婵平台)
  allOf?: ApifoxJsonSchemaProperty[]
  oneOf?: ApifoxJsonSchemaProperty[]
  anyOf?: ApifoxJsonSchemaProperty[]

  // Apifox extensions
  "x-apifox-orders"?: string[]
  "x-apifox-folder"?: string

  // Catch-all for unknown fields
  [key: string]: unknown
}

/**
 * A leaf schema model in the schemaCollection tree.
 * Has a `schema` field containing the JSON Schema definition.
 */
export type ApifoxSchemaModel = {
  name: string
  displayName?: string
  id: string // e.g. "#/definitions/25444390"
  description?: string
  schema: {
    jsonSchema: ApifoxJsonSchemaProperty
  }
  visibility?: string
  moduleId?: number
}

/**
 * A folder node in the schemaCollection tree.
 * Contains nested `items[]` which can be folders or leaf models.
 */
export type ApifoxSchemaFolder = {
  id?: number
  name: string
  visibility?: string
  moduleId?: number
  items: (ApifoxSchemaFolder | ApifoxSchemaModel)[]
}

/**
 * Type guard: checks if an item is a leaf schema model (has `schema` field).
 */
export function isSchemaModel(
  item: ApifoxSchemaFolder | ApifoxSchemaModel
): item is ApifoxSchemaModel {
  return "schema" in item && item.schema !== null && item.schema !== undefined
}

/**
 * Top-level Apifox project export structure.
 */
export type ApifoxProject = {
  apifoxProject: string
  $schema?: { app: string; type: string; version: string }
  info?: { name: string; description?: string }
  apiCollection?: unknown[]
  schemaCollection?: ApifoxSchemaFolder[]
  environments?: unknown[]
  globalVariables?: unknown[]
  responseCollection?: unknown[]
  requestCollection?: unknown[]
  securitySchemeCollection?: unknown[]
  projectSetting?: Record<string, unknown>
}
