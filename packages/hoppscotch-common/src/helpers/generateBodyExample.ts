import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import { generateExampleFromSchema, type ModelResolver } from "~/components/http/design/utils/schemaExample"

/**
 * Generate a JSON example string from a schema tree (bodySchemaTree).
 * Wraps the existing generateExampleFromSchema utility.
 *
 * @param nodes - The schema tree nodes to generate an example from.
 * @param modelResolver - Optional function to resolve modelRef IDs.
 * @returns A formatted JSON string.
 */
export function generateJsonFromSchemaTree(
  nodes: HoppRESTSchemaNode[] | null | undefined,
  modelResolver?: ModelResolver
): string {
  return generateExampleFromSchema(nodes, modelResolver)
}

/**
 * Generate an XML example string from a schema tree (bodySchemaTree).
 * Converts schema nodes into a nested XML representation.
 *
 * @param nodes - The schema tree nodes to generate an example from.
 * @param modelResolver - Optional function to resolve modelRef IDs.
 * @returns An XML string with a root <request> element.
 */
export function generateXmlFromSchemaTree(
  nodes: HoppRESTSchemaNode[] | null | undefined,
  modelResolver?: ModelResolver
): string {
  if (!nodes || nodes.length === 0) return "<request />"

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>']
  lines.push("<request>")
  for (const node of nodes) {
    lines.push(generateXmlNode(node, 1, modelResolver, new Set()))
  }
  lines.push("</request>")
  return lines.join("\n")
}

function generateXmlNode(
  node: HoppRESTSchemaNode,
  indent: number,
  modelResolver?: ModelResolver,
  visited?: Set<string>
): string {
  const pad = "  ".repeat(indent)
  const tagName = sanitizeXmlTag(node.name || "field")

  // Resolve modelRef
  if (node.modelRef && modelResolver) {
    const visitedSet = visited ?? new Set<string>()
    if (visitedSet.has(node.modelRef)) {
      return `${pad}<${tagName}><!-- circular ref --></${tagName}>`
    }
    visitedSet.add(node.modelRef)

    const resolvedTree = modelResolver(node.modelRef)
    if (resolvedTree && resolvedTree.length > 0) {
      const lines: string[] = [`${pad}<${tagName}>`]
      const overrides = node.modelOverrides ?? {}
      for (const child of resolvedTree) {
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
        lines.push(
          generateXmlNode(effectiveChild, indent + 1, modelResolver, new Set(visitedSet))
        )
      }
      lines.push(`${pad}</${tagName}>`)
      return lines.join("\n")
    }
  }

  // Prefer explicit example value
  if (node.example) {
    return `${pad}<${tagName}>${escapeXml(node.example)}</${tagName}>`
  }

  switch (node.type) {
    case "string":
      return `${pad}<${tagName}>${escapeXml(node.mock || "string")}</${tagName}>`
    case "integer":
      return `${pad}<${tagName}>0</${tagName}>`
    case "number":
      return `${pad}<${tagName}>0.0</${tagName}>`
    case "boolean":
      return `${pad}<${tagName}>true</${tagName}>`
    case "array": {
      const lines: string[] = [`${pad}<${tagName}>`]
      if (node.children && node.children.length > 0) {
        lines.push(
          generateXmlNode(
            node.children[0],
            indent + 1,
            modelResolver,
            visited ? new Set(visited) : undefined
          )
        )
      } else {
        lines.push(`${pad}  <item />`)
      }
      lines.push(`${pad}</${tagName}>`)
      return lines.join("\n")
    }
    case "object": {
      const lines: string[] = [`${pad}<${tagName}>`]
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          lines.push(
            generateXmlNode(
              child,
              indent + 1,
              modelResolver,
              visited ? new Set(visited) : undefined
            )
          )
        }
      }
      lines.push(`${pad}</${tagName}>`)
      return lines.join("\n")
    }
    default:
      return `${pad}<${tagName} />`
  }
}

/**
 * Sanitize a string for use as an XML tag name.
 * Replaces invalid characters with underscores.
 */
function sanitizeXmlTag(name: string): string {
  // XML tag names must start with a letter or underscore
  let tag = name.replace(/[^a-zA-Z0-9_.-]/g, "_")
  if (tag && !/^[a-zA-Z_]/.test(tag)) {
    tag = "_" + tag
  }
  return tag || "field"
}

/**
 * Escape special XML characters in a string.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
