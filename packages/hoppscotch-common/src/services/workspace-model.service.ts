import { Service } from "dioc"
import { reactive, computed, ref } from "vue"
import { watchDebounced } from "@vueuse/core"
import { v4 as uuidv4 } from "uuid"
import * as E from "fp-ts/Either"
import type { HoppWorkspaceModel, HoppRESTSchemaNode } from "@hoppscotch/data"
import { Store } from "~/kernel/store"
import { diag } from "~/kernel/log"

const STORE_NAMESPACE = "workspace-models.v1"
const STORE_KEY = "models"

/**
 * Events emitted by WorkspaceModelService when models change.
 */
export type WorkspaceModelServiceEvent =
  | { type: "model-created"; model: HoppWorkspaceModel }
  | { type: "model-updated"; model: HoppWorkspaceModel }
  | { type: "model-deleted"; modelId: string }
  | { type: "models-loaded"; count: number }

/**
 * Input shape for creating a new workspace model.
 * The `id`, `createdAt`, and `updatedAt` fields are generated automatically.
 */
export type CreateWorkspaceModelInput = {
  name: string
  description?: string
  schemaTree?: HoppRESTSchemaNode[]
}

/**
 * Input shape for updating an existing workspace model.
 * Only the provided fields are updated; others remain unchanged.
 */
export type UpdateWorkspaceModelInput = {
  name?: string
  description?: string
  schemaTree?: HoppRESTSchemaNode[]
}

/**
 * WorkspaceModelService manages reusable schema models (HoppWorkspaceModel)
 * at the workspace level. Models are persisted to IndexedDB via the kernel
 * Store abstraction and can be referenced by schema nodes via `modelRef`.
 *
 * Usage:
 *   const modelService = useService(WorkspaceModelService)
 *   const model = modelService.createModel({ name: "User", schemaTree: [...] })
 *   const all = modelService.models.value  // reactive array
 *   const resolved = modelService.getModelById("some-id")
 */
export class WorkspaceModelService extends Service<WorkspaceModelServiceEvent> {
  public static readonly ID = "WORKSPACE_MODEL_SERVICE"

  /**
   * Internal reactive map of models keyed by model ID.
   */
  private modelsMap = reactive(new Map<string, HoppWorkspaceModel>())

  /**
   * Reactive computed array of all workspace models, sorted by name.
   */
  public models = computed(() =>
    Array.from(this.modelsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  )

  /**
   * Reactive computed count of all workspace models.
   */
  public modelCount = computed(() => this.modelsMap.size)

  /**
   * Whether the service has finished loading models from persistence.
   */
  private _loaded = ref(false)
  public loaded = computed(() => this._loaded.value)

  // ─── CRUD Operations ────────────────────────────────────────────

  /**
   * Creates a new workspace model and persists it.
   * @returns The newly created model.
   */
  public createModel(input: CreateWorkspaceModelInput): HoppWorkspaceModel {
    const now = new Date().toISOString()
    const model: HoppWorkspaceModel = {
      id: uuidv4(),
      name: input.name,
      description: input.description ?? "",
      schemaTree: input.schemaTree ?? [],
      createdAt: now,
      updatedAt: now,
    }

    this.modelsMap.set(model.id, model)
    this.emit({ type: "model-created", model })
    diag("workspace-model", "model created:", model.id, model.name)

    return model
  }

  /**
   * Retrieves a model by its ID.
   * @returns The model if found, undefined otherwise.
   */
  public getModelById(id: string): HoppWorkspaceModel | undefined {
    return this.modelsMap.get(id)
  }

  /**
   * Returns all models as a plain array (non-reactive snapshot).
   */
  public getAllModels(): HoppWorkspaceModel[] {
    return Array.from(this.modelsMap.values())
  }

  /**
   * Updates an existing model. Only provided fields are changed.
   * @returns The updated model, or null if the model was not found.
   */
  public updateModel(
    id: string,
    input: UpdateWorkspaceModelInput
  ): HoppWorkspaceModel | null {
    const existing = this.modelsMap.get(id)
    if (!existing) {
      diag("workspace-model", "update failed, model not found:", id)
      return null
    }

    const updated: HoppWorkspaceModel = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.schemaTree !== undefined
        ? { schemaTree: input.schemaTree }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    this.modelsMap.set(id, updated)
    this.emit({ type: "model-updated", model: updated })
    diag("workspace-model", "model updated:", id)

    return updated
  }

  /**
   * Deletes a model by ID.
   * @returns true if the model existed and was deleted, false otherwise.
   */
  public deleteModel(id: string): boolean {
    const existing = this.modelsMap.get(id)
    if (!existing) {
      diag("workspace-model", "delete failed, model not found:", id)
      return false
    }

    this.modelsMap.delete(id)
    this.emit({ type: "model-deleted", modelId: id })
    diag("workspace-model", "model deleted:", id)

    return true
  }

  /**
   * Checks whether a model with the given ID exists.
   */
  public hasModel(id: string): boolean {
    return this.modelsMap.has(id)
  }

  // ─── Persistence ────────────────────────────────────────────────

  /**
   * Loads models from IndexedDB persistence. Called during app initialization.
   */
  public async loadFromPersistence(): Promise<void> {
    diag("workspace-model", "loading models from persistence")

    try {
      const result = await Store.get<Record<string, HoppWorkspaceModel>>(
        STORE_NAMESPACE,
        STORE_KEY
      )

      if (E.isRight(result) && result.right) {
        const data = result.right

        for (const [id, model] of Object.entries(data)) {
          // Basic validation — ensure required fields exist
          if (model && typeof model === "object" && model.id && model.name) {
            this.modelsMap.set(id, {
              id: model.id,
              name: model.name ?? "",
              description: model.description ?? "",
              schemaTree: Array.isArray(model.schemaTree)
                ? model.schemaTree
                : [],
              createdAt: model.createdAt ?? "",
              updatedAt: model.updatedAt ?? "",
            })
          }
        }

        diag(
          "workspace-model",
          "loaded",
          this.modelsMap.size,
          "models from persistence"
        )
        this.emit({ type: "models-loaded", count: this.modelsMap.size })
      } else if (E.isLeft(result)) {
        diag("workspace-model", "persistence load failed:", result.left)
      }
    } catch (err) {
      console.error(
        "[WorkspaceModelService] Failed to load models from persistence:",
        err
      )
    }

    this._loaded.value = true
  }

  /**
   * Persists the current models map to IndexedDB.
   */
  private async persistToStorage(): Promise<void> {
    const data: Record<string, HoppWorkspaceModel> = {}
    for (const [id, model] of this.modelsMap.entries()) {
      data[id] = model
    }

    const result = await Store.set(STORE_NAMESPACE, STORE_KEY, data)
    if (E.isLeft(result)) {
      console.error(
        "[WorkspaceModelService] Failed to persist models:",
        result.left
      )
    }
  }

  /**
   * Sets up debounced auto-persistence. Watches the models map and
   * writes to IndexedDB whenever it changes (debounced by 500ms).
   */
  public setupPersistence(): void {
    watchDebounced(
      () => this.modelsMap,
      () => {
        if (this._loaded.value) {
          this.persistToStorage()
        }
      },
      { debounce: 500, deep: true }
    )
  }

  // ─── Bulk Operations ────────────────────────────────────────────

  /**
   * Replaces all models with the provided array. Used for import/restore.
   */
  public replaceAllModels(models: HoppWorkspaceModel[]): void {
    this.modelsMap.clear()
    for (const model of models) {
      if (model.id) {
        this.modelsMap.set(model.id, model)
      }
    }
    diag("workspace-model", "replaced all models, count:", models.length)
  }

  /**
   * Removes all models. Used for workspace reset.
   */
  public clearAllModels(): void {
    this.modelsMap.clear()
    diag("workspace-model", "all models cleared")
  }

  /**
   * Returns a plain-object snapshot suitable for serialization/export.
   */
  public exportModels(): Record<string, HoppWorkspaceModel> {
    const data: Record<string, HoppWorkspaceModel> = {}
    for (const [id, model] of this.modelsMap.entries()) {
      data[id] = { ...model }
    }
    return data
  }
}
