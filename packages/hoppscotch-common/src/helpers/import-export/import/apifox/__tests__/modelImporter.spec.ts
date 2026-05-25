import { describe, it, expect } from "vitest"
import { importModels, collectApiRefs } from "../modelImporter"
import type { ApifoxSchemaFolder, ApifoxSchemaModel } from "../types"

// ─── Test Fixtures ────────────────────────────────────────────────

function makeModel(
  id: string,
  name: string,
  jsonSchema: Record<string, unknown>,
  description?: string
): ApifoxSchemaModel {
  return {
    id,
    name,
    description,
    schema: { jsonSchema },
  }
}

function makeFolder(
  name: string,
  items: (ApifoxSchemaFolder | ApifoxSchemaModel)[]
): ApifoxSchemaFolder {
  return { name, items }
}

const SIMPLE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "integer", description: "用户ID" },
    name: { type: "string", description: "用户名" },
  },
  required: ["id"],
  "x-apifox-orders": ["id", "name"],
}

const REF_SCHEMA = {
  type: "object",
  properties: {
    user: { $ref: "#/definitions/100", description: "用户信息" },
    status: { type: "string" },
  },
}

const NESTED_REF_SCHEMA = {
  type: "object",
  properties: {
    order: { $ref: "#/definitions/200" },
  },
}

// ─── importModels ─────────────────────────────────────────────────

describe("importModels", () => {
  it("imports a simple model with no $refs", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA, "用户模型"),
      ]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/100"])

    expect(result.models).toHaveLength(1)
    expect(result.importedCount).toBe(1)
    expect(result.errors).toHaveLength(0)

    const model = result.models[0]
    expect(model.name).toBe("User")
    expect(model.description).toBe("用户模型")
    expect(model.schemaTree).toHaveLength(2) // id and name fields
    expect(model.schemaTree[0].name).toBe("id")
    expect(model.schemaTree[0].type).toBe("integer")
    expect(model.schemaTree[0].required).toBe(true)
    expect(model.schemaTree[1].name).toBe("name")
    expect(model.schemaTree[1].type).toBe("string")
    expect(model.id).toBeTruthy()
    expect(model.createdAt).toBeTruthy()
    expect(model.updatedAt).toBeTruthy()
  })

  it("builds refMap with UUIDs for all models", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA),
        makeModel("#/definitions/200", "Order", REF_SCHEMA),
      ]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/200"])

    // refMap should have entries for both models (even if only one is needed)
    expect(result.refMap.has("#/definitions/100")).toBe(true)
    expect(result.refMap.has("#/definitions/200")).toBe(true)

    // UUIDs should be unique
    const uuid100 = result.refMap.get("#/definitions/100")
    const uuid200 = result.refMap.get("#/definitions/200")
    expect(uuid100).not.toBe(uuid200)
  })

  it("resolves $ref to modelRef using refMap", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA),
        makeModel("#/definitions/200", "Order", REF_SCHEMA),
      ]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/200"])

    // The Order model should have a child with modelRef pointing to User's UUID
    const orderModel = result.models.find((m) => m.name === "Order")
    expect(orderModel).toBeDefined()

    const userChild = orderModel!.schemaTree.find((n) => n.name === "user")
    expect(userChild).toBeDefined()
    expect(userChild!.modelRef).toBe(result.refMap.get("#/definitions/100"))
  })

  it("computes transitive closure — imports transitively referenced models", () => {
    // Model 300 refs Model 200, which refs Model 100
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA),
        makeModel("#/definitions/200", "Order", REF_SCHEMA),
        makeModel("#/definitions/300", "OrderList", NESTED_REF_SCHEMA),
      ]),
    ]

    // Only request Model 300 — should pull in 200 and 100 transitively
    const result = importModels(schemaCollection, ["#/definitions/300"])

    expect(result.models).toHaveLength(3)
    const names = result.models.map((m) => m.name).sort()
    expect(names).toEqual(["Order", "OrderList", "User"])
  })

  it("skips models not in the needed closure", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA),
        makeModel("#/definitions/200", "Order", REF_SCHEMA),
        makeModel("#/definitions/999", "Unused", SIMPLE_SCHEMA),
      ]),
    ]

    // Only need User — Order and Unused should be skipped
    const result = importModels(schemaCollection, ["#/definitions/100"])

    expect(result.models).toHaveLength(1)
    expect(result.models[0].name).toBe("User")
  })

  it("handles empty schemaCollection", () => {
    const result = importModels([], [])

    expect(result.models).toHaveLength(0)
    expect(result.importedCount).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it("handles neededRefs pointing to non-existent models", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeModel("#/definitions/100", "User", SIMPLE_SCHEMA),
      ]),
    ]

    // Reference a model that doesn't exist
    const result = importModels(schemaCollection, ["#/definitions/999"])

    // The non-existent ref is in the closure but has no model → 0 imported
    expect(result.models).toHaveLength(0)
    expect(result.importedCount).toBe(0)
  })

  it("handles deeply nested folder structure", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [
        makeFolder("level1", [
          makeFolder("level2", [
            makeModel("#/definitions/100", "DeepModel", SIMPLE_SCHEMA),
          ]),
        ]),
      ]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/100"])

    expect(result.models).toHaveLength(1)
    expect(result.models[0].name).toBe("DeepModel")
  })

  it("uses displayName when available, falls back to name", () => {
    const modelWithDisplayName: ApifoxSchemaModel = {
      id: "#/definitions/100",
      name: "internal_name",
      displayName: "用户模型",
      schema: { jsonSchema: SIMPLE_SCHEMA },
    }

    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [modelWithDisplayName]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/100"])

    expect(result.models[0].name).toBe("用户模型")
  })

  it("handles model with empty/invalid schema gracefully", () => {
    const schemaCollection: ApifoxSchemaFolder[] = [
      makeFolder("root", [makeModel("#/definitions/100", "EmptyModel", {})]),
    ]

    const result = importModels(schemaCollection, ["#/definitions/100"])

    expect(result.models).toHaveLength(1)
    expect(result.models[0].schemaTree).toEqual([])
  })
})

// ─── collectApiRefs ───────────────────────────────────────────────

describe("collectApiRefs", () => {
  it("collects $ref from nested API structures", () => {
    const apiCollection = [
      {
        name: "APIs",
        items: [
          {
            name: "Get User",
            api: {
              responses: [
                {
                  jsonSchema: {
                    type: "object",
                    properties: {
                      data: { $ref: "#/definitions/100" },
                    },
                  },
                },
              ],
            },
          },
          {
            name: "Get Order",
            api: {
              requestBody: {
                jsonSchema: { $ref: "#/definitions/200" },
              },
              responses: [
                {
                  jsonSchema: { $ref: "#/definitions/200" },
                },
              ],
            },
          },
        ],
      },
    ]

    const refs = collectApiRefs(apiCollection)

    expect(refs).toContain("#/definitions/100")
    expect(refs).toContain("#/definitions/200")
    expect(refs).toHaveLength(2) // deduped
  })

  it("returns empty array for empty collection", () => {
    expect(collectApiRefs([])).toEqual([])
  })

  it("handles items with no $ref", () => {
    const apiCollection = [
      {
        name: "Simple",
        items: [
          {
            name: "Health Check",
            api: {
              responses: [
                {
                  jsonSchema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ]

    const refs = collectApiRefs(apiCollection)
    expect(refs).toHaveLength(0)
  })
})
