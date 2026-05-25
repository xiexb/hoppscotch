import { describe, expect, test } from "vitest"
import {
  jsonSchemaToSchemaNode,
  flattenSchemaCollection,
  buildRefMap,
  type RefMap,
} from "../jsonSchemaToSchemaNode"
import type { ApifoxJsonSchemaProperty } from "../types"

describe("jsonSchemaToSchemaNode", () => {
  // ─── Basic type mapping ──────────────────────────────────────

  test("converts simple object with primitive properties", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        id: { type: "integer", description: "用户ID" },
        name: { type: "string", description: "用户名" },
        active: { type: "boolean" },
        score: { type: "number" },
      },
      required: ["id", "name"],
      "x-apifox-orders": ["id", "name", "active", "score"],
    }

    const result = jsonSchemaToSchemaNode(schema)

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({
      name: "id",
      type: "integer",
      description: "用户ID",
      required: true,
    })
    expect(result[1]).toMatchObject({
      name: "name",
      type: "string",
      description: "用户名",
      required: true,
    })
    expect(result[2]).toMatchObject({
      name: "active",
      type: "boolean",
      required: false,
    })
    expect(result[3]).toMatchObject({
      name: "score",
      type: "number",
      required: false,
    })
  })

  test("preserves x-apifox-orders field ordering", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        c: { type: "string" },
        a: { type: "string" },
        b: { type: "string" },
      },
      "x-apifox-orders": ["b", "a", "c"],
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result.map((n) => n.name)).toEqual(["b", "a", "c"])
  })

  test("falls back to Object.keys order when no x-apifox-orders", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        first: { type: "string" },
        second: { type: "string" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("first")
    expect(result[1].name).toBe("second")
  })

  test("includes extra fields not in x-apifox-orders", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
        c: { type: "string" },
      },
      "x-apifox-orders": ["a"],
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe("a")
    // b and c should still appear after a
    expect(result.map((n) => n.name)).toContain("b")
    expect(result.map((n) => n.name)).toContain("c")
  })

  // ─── Required fields ─────────────────────────────────────────

  test("correctly marks required vs optional fields", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        required_field: { type: "string" },
        optional_field: { type: "string" },
      },
      required: ["required_field"],
    }

    const result = jsonSchemaToSchemaNode(schema)
    const req = result.find((n) => n.name === "required_field")
    const opt = result.find((n) => n.name === "optional_field")

    expect(req?.required).toBe(true)
    expect(opt?.required).toBe(false)
  })

  // ─── Nested objects ──────────────────────────────────────────

  test("converts nested object properties recursively", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        address: {
          type: "object",
          description: "地址信息",
          properties: {
            city: { type: "string", description: "城市" },
            zip: { type: "string" },
          },
          required: ["city"],
          "x-apifox-orders": ["city", "zip"],
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("object")
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children[0]).toMatchObject({
      name: "city",
      type: "string",
      required: true,
    })
    expect(result[0].children[1]).toMatchObject({
      name: "zip",
      type: "string",
      required: false,
    })
  })

  test("handles empty object (no properties)", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {},
      "x-apifox-orders": [],
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(0)
  })

  // ─── Array types ─────────────────────────────────────────────

  test("converts array with primitive items", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "标签列表",
          items: { type: "string" },
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "tags",
      type: "array",
      description: "标签列表",
    })
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0]).toMatchObject({
      name: "item",
      type: "string",
    })
  })

  test("converts array with object items", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
            required: ["id"],
          },
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result[0].type).toBe("array")
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children[0]).toMatchObject({
      name: "id",
      type: "integer",
      required: true,
    })
    expect(result[0].children[1]).toMatchObject({
      name: "name",
      type: "string",
    })
  })

  test("converts array with $ref items", () => {
    const refMap: RefMap = new Map([["#/definitions/12345", "uuid-model-1"]])

    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/definitions/12345" },
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema, refMap)
    expect(result[0].type).toBe("array")
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0]).toMatchObject({
      name: "item",
      type: "object",
      modelRef: "uuid-model-1",
    })
  })

  // ─── $ref handling ───────────────────────────────────────────

  test("converts $ref to modelRef", () => {
    const refMap: RefMap = new Map([
      ["#/definitions/25456063", "uuid-device-hw"],
    ])

    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        data: { $ref: "#/definitions/25456063" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema, refMap)
    expect(result[0]).toMatchObject({
      name: "data",
      type: "object",
      modelRef: "uuid-device-hw",
    })
  })

  test("handles $ref not in refMap (empty modelRef)", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        data: { $ref: "#/definitions/unknown" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result[0]).toMatchObject({
      name: "data",
      type: "object",
      modelRef: "",
    })
  })

  // ─── Example and format ──────────────────────────────────────

  test("converts example values to string", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        count: { type: "integer", example: 42 },
        name: { type: "string", example: "test" },
        flag: { type: "boolean", example: true },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result.find((n) => n.name === "count")?.example).toBe("42")
    expect(result.find((n) => n.name === "name")?.example).toBe("test")
    expect(result.find((n) => n.name === "flag")?.example).toBe("true")
  })

  test("uses default value when no example", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        status: { type: "string", default: "active" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result[0].example).toBe("active")
  })

  test("appends format to description", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        id: { type: "integer", format: "int64", description: "用户ID" },
        date: { type: "string", format: "date-time" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result.find((n) => n.name === "id")?.description).toContain("int64")
    expect(result.find((n) => n.name === "id")?.description).toContain("用户ID")
    expect(result.find((n) => n.name === "date")?.description).toContain(
      "date-time"
    )
  })

  test("can disable format in description via options", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        id: { type: "integer", format: "int64", description: "ID" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema, new Map(), {
      includeFormat: false,
    })
    expect(result[0].description).toBe("ID")
  })

  // ─── Enum handling ───────────────────────────────────────────

  test("includes enum values in description", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "deleted"],
          description: "状态",
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result[0].description).toContain("active")
    expect(result[0].description).toContain("inactive")
    expect(result[0].description).toContain("deleted")
  })

  test("truncates long enum lists", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        code: {
          type: "string",
          enum: Array.from({ length: 50 }, (_, i) => `value_${i}`),
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result[0].description).toContain("50 total")
  })

  // ─── Edge cases ──────────────────────────────────────────────

  test("handles null/undefined schema gracefully", () => {
    const result = jsonSchemaToSchemaNode({})
    expect(result).toEqual([])
  })

  test("handles schema with no properties", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toEqual([])
  })

  test("handles top-level $ref", () => {
    const refMap: RefMap = new Map([["#/definitions/999", "uuid-top"]])

    const schema: ApifoxJsonSchemaProperty = {
      $ref: "#/definitions/999",
      title: "MyModel",
    }

    const result = jsonSchemaToSchemaNode(schema, refMap)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "MyModel",
      type: "object",
      modelRef: "uuid-top",
    })
  })

  test("handles top-level array schema", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "array",
      items: { type: "string" },
      title: "StringList",
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "item",
      type: "string",
    })
  })

  test("guards against excessive recursion depth", () => {
    // Build a deeply nested schema
    const deep: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        level: {
          type: "object",
          properties: {
            level: {
              type: "object",
              properties: {
                level: {
                  type: "object",
                  properties: {
                    level: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }

    // Should not throw, should produce valid output
    const result = jsonSchemaToSchemaNode(deep, new Map(), { maxDepth: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("level")
  })

  test("sets safe defaults on all node fields", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        field: { type: "string" },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    const node = result[0]

    expect(node.mock).toBe("")
    expect(node.displayName).toBe("")
    expect(node.example).toBe("")
    expect(node.modelRef).toBe("")
    expect(node.children).toEqual([])
  })

  // ─── Real-world Apifox schema ────────────────────────────────

  test("converts real Apifox response schema (响应信息主体)", () => {
    const refMap: RefMap = new Map([
      ["#/definitions/25456063", "uuid-device-hw-version"],
    ])

    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        code: {
          type: "integer",
          format: "int32",
          description: "返回标记：OK标记=0 成功标记=200，失败标记=1",
        },
        data: {
          type: "array",
          description: "数据",
          items: { $ref: "#/definitions/25456063" },
        },
        msg: { type: "string", description: "返回信息" },
        result: { type: "boolean", description: "响应结果" },
      },
      title: "响应信息主体«List«DeviceHardwareVersionVo»»",
      "x-apifox-orders": ["code", "data", "msg", "result"],
    }

    const result = jsonSchemaToSchemaNode(schema, refMap)

    expect(result).toHaveLength(4)
    expect(result.map((n) => n.name)).toEqual(["code", "data", "msg", "result"])

    // code
    expect(result[0]).toMatchObject({
      type: "integer",
      description: expect.stringContaining("返回标记"),
    })

    // data (array with $ref)
    expect(result[1]).toMatchObject({
      type: "array",
      description: "数据",
    })
    expect(result[1].children).toHaveLength(1)
    expect(result[1].children[0].modelRef).toBe("uuid-device-hw-version")

    // msg
    expect(result[2]).toMatchObject({ type: "string", description: "返回信息" })

    // result
    expect(result[3]).toMatchObject({
      type: "boolean",
      description: "响应结果",
    })
  })

  test("converts real Apifox request body schema", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        roleIds: {
          type: "array",
          items: { type: "string" },
        },
        lockFlag: { type: "integer" },
        userId: { type: "string" },
        userName: { type: "string" },
        remarks: { type: "string" },
      },
      required: ["roleIds", "lockFlag", "userId", "userName", "remarks"],
      "x-apifox-orders": [
        "roleIds",
        "lockFlag",
        "userId",
        "userName",
        "remarks",
      ],
    }

    const result = jsonSchemaToSchemaNode(schema)

    expect(result).toHaveLength(5)
    expect(result.every((n) => n.required)).toBe(true)

    // roleIds should be array with string item child
    const roleIds = result[0]
    expect(roleIds.type).toBe("array")
    expect(roleIds.children).toHaveLength(1)
    expect(roleIds.children[0]).toMatchObject({
      name: "item",
      type: "string",
    })
  })

  // ─── Composition (allOf) ─────────────────────────────────────

  test("merges allOf sub-schemas", () => {
    const schema: ApifoxJsonSchemaProperty = {
      type: "object",
      properties: {
        merged: {
          allOf: [
            {
              type: "object",
              properties: {
                fieldA: { type: "string" },
              },
              required: ["fieldA"],
            },
            {
              type: "object",
              properties: {
                fieldB: { type: "integer" },
              },
            },
          ],
        },
      },
    }

    const result = jsonSchemaToSchemaNode(schema)
    expect(result).toHaveLength(1)
    const merged = result[0]
    expect(merged.type).toBe("object")
    expect(merged.children).toHaveLength(2)
    expect(merged.children.map((c) => c.name)).toEqual(["fieldA", "fieldB"])
    expect(merged.children[0].required).toBe(true)
  })
})

describe("flattenSchemaCollection", () => {
  test("flattens nested folder structure", () => {
    const items = [
      {
        name: "Schemas",
        items: [
          {
            name: "UserVo",
            id: "#/definitions/111",
            schema: {
              jsonSchema: {
                type: "object",
                properties: { name: { type: "string" } },
              },
            },
          },
          {
            name: "Nested",
            items: [
              {
                name: "OrderVo",
                id: "#/definitions/222",
                schema: {
                  jsonSchema: {
                    type: "object",
                    properties: { orderId: { type: "string" } },
                  },
                },
              },
            ],
          },
        ],
      },
    ]

    const result = flattenSchemaCollection(items as any)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("UserVo")
    expect(result[0].id).toBe("#/definitions/111")
    expect(result[1].name).toBe("OrderVo")
    expect(result[1].id).toBe("#/definitions/222")
  })

  test("handles empty items array", () => {
    const result = flattenSchemaCollection([])
    expect(result).toEqual([])
  })

  test("handles folders with no leaf models", () => {
    const items = [
      {
        name: "EmptyFolder",
        items: [{ name: "SubFolder", items: [] }],
      },
    ]

    const result = flattenSchemaCollection(items as any)
    expect(result).toEqual([])
  })
})

describe("buildRefMap", () => {
  test("builds map from model IDs to UUIDs", () => {
    const models = [
      { id: "#/definitions/111" },
      { id: "#/definitions/222" },
      { id: "#/definitions/333" },
    ]

    let counter = 0
    const uuidGen = () => `uuid-${++counter}`

    const refMap = buildRefMap(models, uuidGen)

    expect(refMap.size).toBe(3)
    expect(refMap.get("#/definitions/111")).toBe("uuid-1")
    expect(refMap.get("#/definitions/222")).toBe("uuid-2")
    expect(refMap.get("#/definitions/333")).toBe("uuid-3")
  })

  test("skips duplicate IDs", () => {
    const models = [{ id: "#/definitions/111" }, { id: "#/definitions/111" }]

    let counter = 0
    const uuidGen = () => `uuid-${++counter}`

    const refMap = buildRefMap(models, uuidGen)
    expect(refMap.size).toBe(1)
  })
})
