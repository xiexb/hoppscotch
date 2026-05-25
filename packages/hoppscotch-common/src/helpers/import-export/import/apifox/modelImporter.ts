/**
 * Imports Apifox schemaCollection models into HoppWorkspaceModel objects.
 *
 * This is the model import phase of the Apifox import pipeline:
 * 1. Flatten the schemaCollection tree into leaf schema models
 * 2. Build a refMap ($ref path → UUID) for all models
 * 3. Convert each model's jsonSchema → HoppRESTSchemaNode[] via the T1 converter
 * 4. Return HoppWorkspaceModel[] ready for WorkspaceModelService.createModel()
 *
 * Depends on:
 * - jsonSchemaToSchemaNode (T1 core converter)
 * - flattenSchemaCollection, buildRefMap (T1 utilities)
 */

import type { HoppWorkspaceModel, HoppRESTSchemaNode } from "@hoppscotch/data"
import {
  jsonSchemaToSchemaNode,
  flattenSchemaCollection,
  buildRefMap,
  type RefMap,
  type ConvertOptions,
} from "./jsonSchemaToSchemaNode"
import type { ApifoxSchemaFolder } from "./types"

/**
 * A flattened model ready for conversion — intermediate shape between
 * flattenSchemaCollection output and HoppWorkspaceModel.
 */
type FlattenedModel = {
  name: string
  id: string
  displayName?: string
  description?: string
  jsonSchema: Record<string, unknown>
}

/**
 * Result of the model import process.
 */
export type ImportModelsResult = {
  /** Array of HoppWorkspaceModel objects ready for persistence */
  models: HoppWorkspaceModel[]
  /** Map of Apifox $ref paths to generated UUIDs — used by API response binding */
  refMap: RefMap
  /** Number of models that were successfully converted */
  importedCount: number
  /** Any errors encountered during conversion (non-fatal) */
  errors: Array<{ modelId: string; modelName: string; error: string }>
}

/**
 * Generates a UUID v4 string. Uses crypto.randomUUID when available,
 * falls back to a random hex generator.
 */
function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }
  // Fallback: v4-like UUID
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0")
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`
}

/**
 * Collects all $ref strings referenced within a JSON Schema tree.
 * Used to determine transitive dependencies between models.
 */
function collectRefsInSchema(schema: unknown): Set<string> {
  const refs = new Set<string>()

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }

    const obj = node as Record<string, unknown>
    if (typeof obj.$ref === "string") {
      refs.add(obj.$ref)
    }

    for (const value of Object.values(obj)) {
      walk(value)
    }
  }

  walk(schema)
  return refs
}

/**
 * Computes the transitive closure of model IDs needed, starting from
 * a set of root $ref paths. If model A references model B, and B references
 * model C, then all three are needed even if only A is in the root set.
 *
 * @param flatModels - All flattened models from schemaCollection
 * @param rootRefs - The directly-referenced $ref paths (from API responses)
 * @returns Set of all $ref paths needed (including transitive deps)
 */
function computeNeededClosure(
  flatModels: FlattenedModel[],
  rootRefs: string[]
): Set<string> {
  const modelById = new Map<string, FlattenedModel>()
  for (const m of flatModels) {
    modelById.set(m.id, m)
  }

  const needed = new Set<string>()
  const queue = [...rootRefs]

  while (queue.length > 0) {
    const ref = queue.pop()!
    if (needed.has(ref)) continue
    needed.add(ref)

    const model = modelById.get(ref)
    if (!model) continue

    // Find all $refs within this model's schema and add to queue
    const childRefs = collectRefsInSchema(model.jsonSchema)
    for (const childRef of childRefs) {
      if (!needed.has(childRef)) {
        queue.push(childRef)
      }
    }
  }

  return needed
}

/**
 * Imports Apifox schemaCollection models into HoppWorkspaceModel objects.
 *
 * This is the main entry point for model import. It:
 * 1. Flattens the schemaCollection tree into leaf models
 * 2. Computes which models are needed (direct refs + transitive deps)
 * 3. Builds a refMap mapping $ref paths → UUIDs for ALL models
 *    (needed for cross-reference resolution during conversion)
 * 4. Converts each needed model's jsonSchema → schemaTree
 * 5. Returns HoppWorkspaceModel[] ready for batch creation
 *
 * @param schemaCollection - The schemaCollection array from Apifox export
 * @param neededRefs - $ref paths directly referenced by API responses
 * @param options - Optional conversion settings passed to jsonSchemaToSchemaNode
 * @returns Import result with models, refMap, count, and any errors
 *
 * @example
 * ```ts
 * const apifoxData = JSON.parse(fileContent)
 * const apiRefs = collectApiRefs(apifoxData.apiCollection)
 * const result = importModels(apifoxData.schemaCollection, apiRefs)
 *
 * // Batch create in WorkspaceModelService
 * for (const model of result.models) {
 *   modelService.createModel({
 *     name: model.name,
 *     description: model.description,
 *     schemaTree: model.schemaTree,
 *   })
 * }
 * ```
 */
export function importModels(
  schemaCollection: ApifoxSchemaFolder[],
  neededRefs: string[],
  options?: ConvertOptions
): ImportModelsResult {
  // Step 1: Flatten the tree into leaf models
  const flatModels = flattenSchemaCollection(
    schemaCollection as Parameters<typeof flattenSchemaCollection>[0]
  ) as FlattenedModel[]

  // Step 2: Compute transitive closure of needed models
  const neededClosure = computeNeededClosure(flatModels, neededRefs)

  // Step 3: Build refMap for ALL models (needed for cross-ref resolution)
  const refMap = buildRefMap(flatModels, generateUUID)

  // Step 4: Convert each needed model
  const models: HoppWorkspaceModel[] = []
  const errors: Array<{ modelId: string; modelName: string; error: string }> =
    []
  const now = new Date().toISOString()

  for (const flat of flatModels) {
    // Only convert models that are in the needed closure
    if (!neededClosure.has(flat.id)) continue

    const uuid = refMap.get(flat.id)
    if (!uuid) {
      errors.push({
        modelId: flat.id,
        modelName: flat.name,
        error: "Missing UUID in refMap",
      })
      continue
    }

    let schemaTree: HoppRESTSchemaNode[]
    try {
      schemaTree = jsonSchemaToSchemaNode(
        flat.jsonSchema as any,
        refMap,
        options
      )
    } catch (err) {
      errors.push({
        modelId: flat.id,
        modelName: flat.name,
        error: err instanceof Error ? err.message : String(err),
      })
      // Still create the model with empty schemaTree so the ref is valid
      schemaTree = []
    }

    const model: HoppWorkspaceModel = {
      id: uuid,
      name: flat.displayName || flat.name,
      description: flat.description ?? "",
      schemaTree,
      createdAt: now,
      updatedAt: now,
    }

    models.push(model)
  }

  return {
    models,
    refMap,
    importedCount: models.length,
    errors,
  }
}

/**
 * Collects all $ref paths from an Apifox apiCollection tree.
 * Utility for building the `neededRefs` parameter for importModels.
 *
 * Walks through all API items' requestBody and responses to find
 * JSON Schema $ref references.
 *
 * @param apiCollection - The apiCollection array from Apifox export
 * @returns Array of unique $ref paths referenced by APIs
 */
export function collectApiRefs(apiCollection: unknown[]): string[] {
  const refs = new Set<string>()

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }

    const obj = node as Record<string, unknown>
    if (typeof obj.$ref === "string") {
      refs.add(obj.$ref)
    }

    for (const value of Object.values(obj)) {
      walk(value)
    }
  }

  for (const coll of apiCollection) {
    walk(coll)
  }

  return Array.from(refs)
}
