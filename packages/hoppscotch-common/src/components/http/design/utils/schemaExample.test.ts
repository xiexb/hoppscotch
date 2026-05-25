import { describe, it, expect } from "vitest"
import {
  parseJsonToSchemaTree,
  generateExampleFromSchema,
} from "./schemaExample"

describe("parseJsonToSchemaTree - array root fix", () => {
  it("wraps object element fields in an item node for array root", () => {
    const tree = parseJsonToSchemaTree('[{"id":1,"name":"test"}]')
    expect(tree).not.toBeNull()
    expect(tree!.length).toBe(1)
    const arrayNode = tree![0]
    expect(arrayNode.type).toBe("array")
    expect(arrayNode.name).toBe("data")
    // children should have a single item object node
    expect(arrayNode.children!.length).toBe(1)
    const itemNode = arrayNode.children![0]
    expect(itemNode.name).toBe("item")
    expect(itemNode.type).toBe("object")
    // item node should contain the actual fields
    expect(itemNode.children!.length).toBe(2)
    expect(itemNode.children![0].name).toBe("id")
    expect(itemNode.children![0].type).toBe("integer")
    expect(itemNode.children![1].name).toBe("name")
    expect(itemNode.children![1].type).toBe("string")
  })

  it("generateExampleFromSchema produces correct array with object elements", () => {
    const tree = parseJsonToSchemaTree('[{"id":1,"name":"test"}]')
    const example = generateExampleFromSchema(tree)
    const parsed = JSON.parse(example)
    expect(parsed).toEqual({ data: [{ id: 1, name: "test" }] })
  })

  it("returns empty array for empty JSON array", () => {
    const tree = parseJsonToSchemaTree("[]")
    expect(tree).toEqual([])
  })

  it("handles primitive array [1,2,3] with empty children", () => {
    const tree = parseJsonToSchemaTree("[1,2,3]")
    expect(tree).not.toBeNull()
    expect(tree!.length).toBe(1)
    const arrayNode = tree![0]
    expect(arrayNode.type).toBe("array")
    expect(arrayNode.children!.length).toBe(0)
  })

  it("normal object JSON is not affected", () => {
    const tree = parseJsonToSchemaTree('{"foo":"bar","num":42}')
    expect(tree).not.toBeNull()
    expect(tree!.length).toBe(2)
    expect(tree![0].name).toBe("foo")
    expect(tree![0].type).toBe("string")
    expect(tree![1].name).toBe("num")
    expect(tree![1].type).toBe("integer")
  })
})
