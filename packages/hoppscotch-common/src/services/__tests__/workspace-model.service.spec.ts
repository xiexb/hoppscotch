import { describe, expect, it, beforeEach, vi } from "vitest"
import { TestContainer } from "dioc/testing"

// Mock the kernel store before importing the service
vi.mock("~/kernel/store", () => ({
  Store: {
    get: vi.fn().mockResolvedValue({ _tag: "Right", right: undefined }),
    set: vi.fn().mockResolvedValue({ _tag: "Right", right: undefined }),
    remove: vi.fn().mockResolvedValue({ _tag: "Right", right: true }),
  },
}))

// Mock the kernel log
vi.mock("~/kernel/log", () => ({
  diag: vi.fn(),
}))

import { WorkspaceModelService } from "../workspace-model.service"
import { Store } from "~/kernel/store"
import * as E from "fp-ts/Either"

describe("WorkspaceModelService", () => {
  let container: TestContainer
  let service: WorkspaceModelService

  beforeEach(() => {
    container = new TestContainer()
    service = container.bind(WorkspaceModelService)
    vi.clearAllMocks()
  })

  describe("createModel", () => {
    it("should create a model with auto-generated id and timestamps", () => {
      const model = service.createModel({ name: "User" })

      expect(model.id).toBeDefined()
      expect(typeof model.id).toBe("string")
      expect(model.id.length).toBeGreaterThan(0)
      expect(model.name).toBe("User")
      expect(model.description).toBe("")
      expect(model.schemaTree).toEqual([])
      expect(model.createdAt).toBeDefined()
      expect(model.updatedAt).toBeDefined()
    })

    it("should create a model with all provided fields", () => {
      const schemaTree = [
        {
          name: "id",
          type: "integer" as const,
          mock: "",
          displayName: "",
          description: "User ID",
          required: true,
          children: [],
          example: "42",
          modelRef: "",
        },
      ]

      const model = service.createModel({
        name: "User",
        description: "A user model",
        schemaTree,
      })

      expect(model.name).toBe("User")
      expect(model.description).toBe("A user model")
      expect(model.schemaTree).toEqual(schemaTree)
    })

    it("should add the model to the models list", () => {
      service.createModel({ name: "User" })
      service.createModel({ name: "Post" })

      expect(service.models.value).toHaveLength(2)
      expect(service.modelCount.value).toBe(2)
    })

    it("should sort models alphabetically by name", () => {
      service.createModel({ name: "Zebra" })
      service.createModel({ name: "Apple" })
      service.createModel({ name: "Mango" })

      const names = service.models.value.map((m) => m.name)
      expect(names).toEqual(["Apple", "Mango", "Zebra"])
    })
  })

  describe("getModelById", () => {
    it("should return the model if it exists", () => {
      const created = service.createModel({ name: "User" })
      const found = service.getModelById(created.id)

      expect(found).toBeDefined()
      expect(found!.name).toBe("User")
      expect(found!.id).toBe(created.id)
    })

    it("should return undefined if model does not exist", () => {
      const found = service.getModelById("non-existent-id")
      expect(found).toBeUndefined()
    })
  })

  describe("getAllModels", () => {
    it("should return all models as a plain array", () => {
      service.createModel({ name: "User" })
      service.createModel({ name: "Post" })

      const all = service.getAllModels()
      expect(all).toHaveLength(2)
      expect(Array.isArray(all)).toBe(true)
    })

    it("should return empty array when no models exist", () => {
      expect(service.getAllModels()).toEqual([])
    })
  })

  describe("updateModel", () => {
    it("should update only the provided fields", async () => {
      const created = service.createModel({
        name: "User",
        description: "Original description",
      })

      // Ensure updatedAt differs from createdAt
      await new Promise((r) => setTimeout(r, 10))

      const updated = service.updateModel(created.id, { name: "Admin" })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe("Admin")
      expect(updated!.description).toBe("Original description")
      expect(updated!.id).toBe(created.id)
      expect(updated!.createdAt).toBe(created.createdAt)
      expect(updated!.updatedAt).not.toBe(created.updatedAt)
    })

    it("should update schemaTree when provided", () => {
      const created = service.createModel({ name: "User" })
      const newSchema = [
        {
          name: "email",
          type: "string" as const,
          mock: "",
          displayName: "",
          description: "",
          required: true,
          children: [],
          example: "user@example.com",
          modelRef: "",
        },
      ]

      const updated = service.updateModel(created.id, {
        schemaTree: newSchema,
      })

      expect(updated!.schemaTree).toEqual(newSchema)
    })

    it("should return null if model does not exist", () => {
      const result = service.updateModel("non-existent", { name: "X" })
      expect(result).toBeNull()
    })

    it("should reflect changes in the reactive models list", () => {
      const created = service.createModel({ name: "User" })
      service.updateModel(created.id, { name: "Admin" })

      const found = service.models.value.find((m) => m.id === created.id)
      expect(found!.name).toBe("Admin")
    })
  })

  describe("deleteModel", () => {
    it("should delete an existing model and return true", () => {
      const created = service.createModel({ name: "User" })
      expect(service.modelCount.value).toBe(1)

      const deleted = service.deleteModel(created.id)

      expect(deleted).toBe(true)
      expect(service.modelCount.value).toBe(0)
      expect(service.getModelById(created.id)).toBeUndefined()
    })

    it("should return false if model does not exist", () => {
      const deleted = service.deleteModel("non-existent")
      expect(deleted).toBe(false)
    })
  })

  describe("hasModel", () => {
    it("should return true for existing models", () => {
      const created = service.createModel({ name: "User" })
      expect(service.hasModel(created.id)).toBe(true)
    })

    it("should return false for non-existing models", () => {
      expect(service.hasModel("non-existent")).toBe(false)
    })
  })

  describe("clearAllModels", () => {
    it("should remove all models", () => {
      service.createModel({ name: "User" })
      service.createModel({ name: "Post" })
      service.createModel({ name: "Comment" })

      expect(service.modelCount.value).toBe(3)

      service.clearAllModels()

      expect(service.modelCount.value).toBe(0)
      expect(service.models.value).toEqual([])
    })
  })

  describe("replaceAllModels", () => {
    it("should replace all existing models with the provided array", () => {
      service.createModel({ name: "Old1" })
      service.createModel({ name: "Old2" })

      const newModels = [
        {
          id: "new-1",
          name: "New1",
          description: "",
          schemaTree: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "new-2",
          name: "New2",
          description: "",
          schemaTree: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]

      service.replaceAllModels(newModels)

      expect(service.modelCount.value).toBe(2)
      expect(service.getModelById("new-1")!.name).toBe("New1")
      expect(service.getModelById("new-2")!.name).toBe("New2")
    })
  })

  describe("exportModels", () => {
    it("should return a plain object snapshot of all models", () => {
      const m1 = service.createModel({ name: "User" })
      const m2 = service.createModel({ name: "Post" })

      const exported = service.exportModels()

      expect(Object.keys(exported)).toHaveLength(2)
      expect(exported[m1.id].name).toBe("User")
      expect(exported[m2.id].name).toBe("Post")
    })
  })

  describe("loadFromPersistence", () => {
    it("should load models from store", async () => {
      const persistedData = {
        "model-1": {
          id: "model-1",
          name: "User",
          description: "A user",
          schemaTree: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        "model-2": {
          id: "model-2",
          name: "Post",
          description: "A post",
          schemaTree: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }

      vi.mocked(Store.get).mockResolvedValueOnce(E.right(persistedData))

      await service.loadFromPersistence()

      expect(service.modelCount.value).toBe(2)
      expect(service.getModelById("model-1")!.name).toBe("User")
      expect(service.getModelById("model-2")!.name).toBe("Post")
      expect(service.loaded.value).toBe(true)
    })

    it("should handle empty store gracefully", async () => {
      vi.mocked(Store.get).mockResolvedValueOnce(E.right(undefined))

      await service.loadFromPersistence()

      expect(service.modelCount.value).toBe(0)
      expect(service.loaded.value).toBe(true)
    })

    it("should handle store errors gracefully", async () => {
      vi.mocked(Store.get).mockResolvedValueOnce(
        E.left({ kind: "StoreError", message: "test error" } as any)
      )

      await service.loadFromPersistence()

      expect(service.modelCount.value).toBe(0)
      expect(service.loaded.value).toBe(true)
    })
  })
})
