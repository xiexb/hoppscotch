import type { HoppRESTSchemaNode } from "@hoppscotch/data"

/**
 * Generate a JSON example string from a schema tree.
 * Used by EditView, PreviewView, and documentation Response.vue.
 */
export function generateExampleFromSchema(
  tree: HoppRESTSchemaNode[] | null | undefined
): string {
  if (!tree || tree.length === 0) return "{}"
  const obj: Record<string, unknown> = {}
  for (const node of tree) {
    obj[node.name || "field"] = generateNodeExample(node)
  }
  return JSON.stringify(obj, null, 2)
}

function generateNodeExample(node: HoppRESTSchemaNode): unknown {
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
        return [generateNodeExample(node.children[0])]
      }
      return []
    case "object":
      if (node.children && node.children.length > 0) {
        const obj: Record<string, unknown> = {}
        for (const child of node.children) {
          obj[child.name || "field"] = generateNodeExample(child)
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
