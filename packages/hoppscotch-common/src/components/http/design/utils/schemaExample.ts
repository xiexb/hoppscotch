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
      const overrides = node.modelOverrides ?? {}
      for (const child of resolvedTree) {
        // Apply overrides from the parent node's modelOverrides
        const override = overrides[child.name]
        let effectiveChild = child
        if (override) {
          effectiveChild = {
            ...child,
            example:
              override.example && override.example !== ""
                ? override.example
                : child.example,
            description:
              override.description && override.description !== ""
                ? override.description
                : child.description,
          }
        }
        obj[effectiveChild.name || "field"] = generateNodeExample(
          effectiveChild,
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
 * Parse a JSON string into a HoppRESTSchemaNode tree.
 * Reverse of generateExampleFromSchema — infers types from actual values.
 *
 * @param json - The JSON string to parse.
 * @returns The inferred schema tree, or null if parsing fails.
 */
export function parseJsonToSchemaTree(
  json: string
): HoppRESTSchemaNode[] | null {
  if (!json || !json.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (parsed === null || parsed === undefined) return []
  if (typeof parsed !== "object") {
    // Root is a primitive — wrap in a single field
    return [inferNode("value", parsed)]
  }
  if (Array.isArray(parsed)) {
    // Root is an array — create an array node with children from first element
    if (parsed.length === 0) return []
    const firstElem = parsed[0]
    let children: HoppRESTSchemaNode[] = []
    if (
      typeof firstElem === "object" &&
      firstElem !== null &&
      !Array.isArray(firstElem)
    ) {
      for (const [k, v] of Object.entries(
        firstElem as Record<string, unknown>
      )) {
        children.push(inferNode(k, v))
      }
    }
    const arrayNode = createSchemaNode("data", "array", "")
    arrayNode.description = "数组数据"
    arrayNode.children = children
    return [arrayNode]
  }
  // Root is an object
  const nodes: HoppRESTSchemaNode[] = []
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    nodes.push(inferNode(key, value))
  }
  return nodes
}

function inferNode(name: string, value: unknown): HoppRESTSchemaNode {
  if (value === null || value === undefined) {
    return createSchemaNode(name, "string", String(value ?? ""))
  }
  if (typeof value === "string") {
    return createSchemaNode(name, "string", value)
  }
  if (typeof value === "number") {
    const isInt = Number.isInteger(value)
    return createSchemaNode(name, isInt ? "integer" : "number", String(value))
  }
  if (typeof value === "boolean") {
    return createSchemaNode(name, "boolean", String(value))
  }
  if (Array.isArray(value)) {
    const node = createSchemaNode(name, "array", "")
    if (value.length > 0) {
      node.children = [inferNode("item", value[0])]
    }
    return node
  }
  if (typeof value === "object") {
    const node = createSchemaNode(name, "object", "")
    node.children = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      node.children.push(inferNode(k, v))
    }
    return node
  }
  return createSchemaNode(name, "string", String(value))
}

function createSchemaNode(
  name: string,
  type: HoppRESTSchemaNode["type"],
  example: string
): HoppRESTSchemaNode {
  return {
    name,
    type,
    mock: "",
    displayName: "",
    description: "",
    required: true,
    children: [],
    example,
    modelRef: "",
    modelOverrides: {},
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
