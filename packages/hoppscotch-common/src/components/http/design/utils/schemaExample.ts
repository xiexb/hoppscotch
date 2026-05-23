import type { HoppRESTSchemaNode } from "@hoppscotch/data"

/**
 * Resolves a modelRef ID to its schema tree.
 * Used by generateExampleFromSchema to expand model references.
 */
export type ModelResolver = (
  modelRefId: string
) => HoppRESTSchemaNode[] | undefined

/**
 * Generate a JSON example string from a schema tree.
 * Used by EditView, PreviewView, and documentation Response.vue.
 *
 * @param tree - The schema tree to generate an example from.
 * @param modelResolver - Optional function to resolve modelRef IDs to their
 *   schema trees. When provided, nodes with `modelRef` set will be expanded
 *   using the referenced model's schema instead of returning an empty object.
 */
export function generateExampleFromSchema(
  tree: HoppRESTSchemaNode[] | null | undefined,
  modelResolver?: ModelResolver
): string {
  if (!tree || tree.length === 0) return "{}"
  const obj: Record<string, unknown> = {}
  for (const node of tree) {
    obj[node.name || "field"] = generateNodeExample(
      node,
      modelResolver,
      new Set()
    )
  }
  return JSON.stringify(obj, null, 2)
}

function generateNodeExample(
  node: HoppRESTSchemaNode,
  modelResolver?: ModelResolver,
  visited?: Set<string>
): unknown {
  // v21: resolve modelRef — use the referenced model's schema tree
  if (node.modelRef && modelResolver) {
    // Guard against circular references
    const visitedSet = visited ?? new Set<string>()
    if (visitedSet.has(node.modelRef)) {
      return { __circular_ref: node.modelRef }
    }
    visitedSet.add(node.modelRef)

    const resolvedTree = modelResolver(node.modelRef)
    if (resolvedTree && resolvedTree.length > 0) {
      const obj: Record<string, unknown> = {}
      for (const child of resolvedTree) {
        obj[child.name || "field"] = generateNodeExample(
          child,
          modelResolver,
          new Set(visitedSet)
        )
      }
      return obj
    }
    // If resolver returned empty/undefined, fall through to normal handling
  }

  // v21: prefer explicit example value if provided
  if (node.example) {
    // Try to parse as JSON for proper typing (numbers, booleans, etc.)
    try {
      return JSON.parse(node.example)
    } catch {
      return node.example
    }
  }

  switch (node.type) {
    case "string":
      return node.mock || "string"
    case "integer":
      return 0
    case "number":
      return 0.0
    case "boolean":
      return true
    case "array":
      if (node.children && node.children.length > 0) {
        return [
          generateNodeExample(
            node.children[0],
            modelResolver,
            visited ? new Set(visited) : undefined
          ),
        ]
      }
      return []
    case "object":
      if (node.children && node.children.length > 0) {
        const obj: Record<string, unknown> = {}
        for (const child of node.children) {
          obj[child.name || "field"] = generateNodeExample(
            child,
            modelResolver,
            visited ? new Set(visited) : undefined
          )
        }
        return obj
      }
      return {}
    default:
      return null
  }
}

/**
 * Return CSS class string for status-code-based tab styling.
 * Used consistently across edit mode and preview mode.
 */
export function statusTabClass(code: string | number): string {
  const num = typeof code === "string" ? parseInt(code, 10) : code
  if (num >= 200 && num < 300) return "border-green-500 text-green-500"
  if (num >= 300 && num < 400) return "border-blue-500 text-blue-500"
  if (num >= 400 && num < 500) return "border-yellow-500 text-yellow-500"
  if (num >= 500) return "border-red-500 text-red-500"
  return "border-secondary text-secondary"
}

/**
 * Return CSS class string for status-code dot indicator.
 */
export function statusDotClass(code: string | number): string {
  const num = typeof code === "string" ? parseInt(code, 10) : code
  if (num >= 200 && num < 300) return "bg-green-500"
  if (num >= 300 && num < 400) return "bg-blue-500"
  if (num >= 400 && num < 500) return "bg-yellow-500"
  if (num >= 500) return "bg-red-500"
  return "bg-secondary"
}

/**
 * Return CSS class string for status-code badge (pill style).
 * Used in documentation mode.
 */
export function statusCodeBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return "bg-green-500/10 text-green-500"
  if (code >= 300 && code < 400) return "bg-blue-500/10 text-blue-500"
  if (code >= 400 && code < 500) return "bg-orange-500/10 text-orange-500"
  if (code >= 500) return "bg-red-500/10 text-red-500"
  return "bg-secondaryLight/20 text-secondaryLight"
}
