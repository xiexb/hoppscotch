<template>
  <div class="space-y-4">
    <!-- Phase 1: File Selection -->
    <template v-if="phase === 'file-select'">
      <div>
        <p class="flex items-center">
          <span
            class="inline-flex items-center justify-center flex-shrink-0 mr-4 border-4 rounded-full border-primary text-dividerDark"
            :class="{ '!text-green-500': hasFile }"
          >
            <icon-lucide-check-circle class="svg-icons" />
          </span>
          <span>{{ t("import.apifox.select_file") }}</span>
        </p>
        <p class="ml-10 mt-2 text-secondaryLight">
          {{ t("import.apifox.select_file_description") }}
        </p>
      </div>

      <div
        class="flex flex-col border border-dashed rounded border-dividerDark"
      >
        <input
          id="apifoxFileInput"
          ref="fileInput"
          name="apifoxFileInput"
          type="file"
          class="p-4 cursor-pointer transition file:transition file:cursor-pointer text-secondary hover:text-secondaryDark file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-secondary hover:file:text-secondaryDark file:bg-primaryLight hover:file:bg-primaryDark"
          accept=".json"
          @change="onFileChange"
        />
      </div>

      <p v-if="parseError" class="text-red-500 ml-10 text-sm">
        {{ parseError }}
      </p>

      <HoppButtonPrimary
        :disabled="!hasFile || parseError !== ''"
        :label="t('import.apifox.parse_and_preview')"
        :loading="isParsing"
        class="w-full"
        @click="parseAndPreview"
      />
    </template>

    <!-- Phase 2: Parse Preview -->
    <template v-else-if="phase === 'preview'">
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-primary">
          {{ t("import.apifox.preview_title") }}
        </h3>

        <p v-if="projectName" class="text-secondaryLight text-sm">
          {{ t("import.apifox.project_name") }}: {{ projectName }}
        </p>

        <div class="grid grid-cols-3 gap-3">
          <div
            class="flex flex-col items-center p-3 rounded border border-dividerLight bg-primaryLight/30"
          >
            <span class="text-2xl font-bold text-accent">{{
              previewCounts.collections
            }}</span>
            <span class="text-xs text-secondaryLight mt-1">{{
              t("import.apifox.collections")
            }}</span>
          </div>
          <div
            class="flex flex-col items-center p-3 rounded border border-dividerLight bg-primaryLight/30"
          >
            <span class="text-2xl font-bold text-accent">{{
              previewCounts.apis
            }}</span>
            <span class="text-xs text-secondaryLight mt-1">{{
              t("import.apifox.apis")
            }}</span>
          </div>
          <div
            class="flex flex-col items-center p-3 rounded border border-dividerLight bg-primaryLight/30"
          >
            <span class="text-2xl font-bold text-accent">{{
              previewCounts.models
            }}</span>
            <span class="text-xs text-secondaryLight mt-1">{{
              t("import.apifox.models")
            }}</span>
          </div>
        </div>

        <div
          v-if="previewCounts.requests > 0"
          class="flex items-center p-2 rounded border border-dividerLight bg-primaryLight/20"
        >
          <icon-lucide-file-text class="svg-icons mr-2 text-secondaryLight" />
          <span class="text-sm text-secondary">
            {{ previewCounts.requests }}
            {{ t("import.apifox.saved_requests") }}
          </span>
        </div>

        <!-- Target collection selector -->
        <div class="space-y-2 pt-2 border-t border-dividerLight">
          <p class="text-sm font-medium text-primary">
            {{ t("import.apifox.target_label") }}
          </p>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="importTarget"
              value="new"
              :checked="importTarget === 'new'"
              class="accent-accent"
              @change="importTarget = 'new'"
            />
            <span class="text-sm text-secondary">
              {{ t("import.apifox.target_new") }}
            </span>
          </label>

          <!-- Parent collection naming when "new" mode is selected -->
          <div
            v-if="importTarget === 'new'"
            class="space-y-2 ml-6 mt-2"
          >
            <p class="text-xs text-secondaryLight mb-1">
              {{ t("import.apifox.parent_collection_name") }}
            </p>
            <input
              v-model="newCollectionName"
              type="text"
              :placeholder="t('import.apifox.parent_collection_name_placeholder')"
              class="w-full px-3 py-1.5 text-sm rounded border border-dividerLight bg-primaryLight text-secondary focus:outline-none focus:border-accent"
            />
          </div>

          <!-- Folder naming when "new" mode is selected -->
          <div
            v-if="importTarget === 'new' && collectionNames.length > 0"
            class="space-y-2 ml-6 mt-2"
          >
            <p class="text-xs text-secondaryLight mb-2">
              {{ t("import.apifox.edit_folder_names") }}
            </p>
            <div
              v-for="(name, idx) in collectionNames"
              :key="idx"
              class="flex items-center gap-2"
            >
              <input
                v-model="collectionNames[idx]"
                type="text"
                :placeholder="t('import.apifox.folder_name_placeholder')"
                class="flex-1 px-3 py-1.5 text-sm rounded border border-dividerLight bg-primaryLight text-secondary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="radio"
              name="importTarget"
              value="existing"
              :checked="importTarget === 'existing'"
              class="accent-accent"
              @change="importTarget = 'existing'"
            />
            <span class="text-sm text-secondary">
              {{ t("import.apifox.target_existing") }}
            </span>
          </label>
          <select
            v-if="importTarget === 'existing' && existingCollections.length > 0"
            :key="'coll-sel-' + existingCollections.length"
            v-model="selectedTargetIndex"
            class="w-full px-3 py-2 text-sm rounded border border-dividerLight bg-primaryLight text-secondary focus:outline-none focus:border-accent ml-6"
          >
            <option :value="-1" disabled>
              {{ t("import.apifox.select_collection") }}
            </option>
            <option
              v-for="(coll, idx) in existingCollections"
              :key="idx"
              :value="idx"
            >
              {{ coll.name }}
            </option>
          </select>
          <p
            v-else-if="importTarget === 'existing' && existingCollections.length === 0"
            class="text-sm text-secondaryLight ml-6"
          >
            {{ t("import.apifox.no_existing_collections") }}
          </p>
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <HoppButtonSecondary
          :label="t('action.go_back')"
          outline
          class="flex-1"
          @click="phase = 'file-select'"
        />
        <HoppButtonPrimary
          :label="t('import.apifox.check_conflicts')"
          :disabled="
            (importTarget === 'existing' && (selectedTargetIndex === -1 || existingCollections.length === 0)) ||
            (importTarget === 'new' && (!newCollectionName.trim() || collectionNames.some(n => !n.trim())))
          "
          class="flex-1"
          @click="checkConflicts"
        />
      </div>
    </template>

    <!-- Phase 3: Conflict Resolution -->
    <template v-else-if="phase === 'conflicts'">
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-primary">
          {{ t("import.apifox.conflict_title") }}
        </h3>

        <template v-if="conflicts.length === 0">
          <div
            class="flex items-center p-3 rounded border border-green-500/30 bg-green-500/10"
          >
            <icon-lucide-check-circle class="svg-icons mr-2 text-green-500" />
            <span class="text-sm text-green-500">{{
              t("import.apifox.no_conflicts")
            }}</span>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-secondaryLight">
            {{ t("import.apifox.conflict_description") }}
          </p>

          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="(conflict, idx) in conflicts"
              :key="idx"
              class="flex flex-col p-3 rounded border border-dividerLight bg-primaryLight/20"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-primary truncate mr-2">
                  {{ conflict.name }}
                </span>
                <span class="text-xs text-secondaryLight shrink-0">
                  {{ conflict.type }}
                </span>
              </div>
              <div class="flex gap-1">
                <button
                  class="px-2 py-1 text-xs rounded transition"
                  :class="
                    conflict.resolution === 'skip'
                      ? 'bg-accentLight text-white'
                      : 'bg-primaryLight text-secondary hover:bg-primaryDark'
                  "
                  @click="conflict.resolution = 'skip'"
                >
                  {{ t("import.apifox.skip") }}
                </button>
                <button
                  class="px-2 py-1 text-xs rounded transition"
                  :class="
                    conflict.resolution === 'override'
                      ? 'bg-accentLight text-white'
                      : 'bg-primaryLight text-secondary hover:bg-primaryDark'
                  "
                  @click="conflict.resolution = 'override'"
                >
                  {{ t("import.apifox.override") }}
                </button>
                <button
                  class="px-2 py-1 text-xs rounded transition"
                  :class="
                    conflict.resolution === 'rename'
                      ? 'bg-accentLight text-white'
                      : 'bg-primaryLight text-secondary hover:bg-primaryDark'
                  "
                  @click="conflict.resolution = 'rename'"
                >
                  {{ t("import.apifox.rename") }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <HoppButtonSecondary
              :label="t('import.apifox.skip_all')"
              outline
              class="flex-1"
              @click="setAllResolutions('skip')"
            />
            <HoppButtonSecondary
              :label="t('import.apifox.override_all')"
              outline
              class="flex-1"
              @click="setAllResolutions('override')"
            />
            <HoppButtonSecondary
              :label="t('import.apifox.rename_all')"
              outline
              class="flex-1"
              @click="setAllResolutions('rename')"
            />
          </div>
        </template>
      </div>

      <div class="flex gap-2 mt-4">
        <HoppButtonSecondary
          :label="t('action.go_back')"
          outline
          class="flex-1"
          @click="phase = 'preview'"
        />
        <HoppButtonPrimary
          :label="t('import.apifox.start_import')"
          class="flex-1"
          @click="startImport"
        />
      </div>
    </template>

    <!-- Phase 4: Importing with Progress -->
    <template v-else-if="phase === 'importing'">
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-primary">
          {{ t("import.apifox.importing_title") }}
        </h3>

        <!-- Progress stages -->
        <div class="space-y-3">
          <div
            v-for="(stage, idx) in importStages"
            :key="idx"
            class="flex items-center"
          >
            <span
              class="inline-flex items-center justify-center flex-shrink-0 mr-3 w-6 h-6 rounded-full border-2"
              :class="{
                'border-green-500 text-green-500': stage.status === 'done',
                'border-accent text-accent animate-pulse':
                  stage.status === 'active',
                'border-dividerLight text-dividerLight':
                  stage.status === 'pending',
                'border-red-500 text-red-500': stage.status === 'error',
              }"
            >
              <icon-lucide-check
                v-if="stage.status === 'done'"
                class="w-3 h-3"
              />
              <icon-lucide-loader
                v-else-if="stage.status === 'active'"
                class="w-3 h-3 animate-spin"
              />
              <icon-lucide-circle
                v-else-if="stage.status === 'pending'"
                class="w-3 h-3"
              />
              <icon-lucide-x v-else class="w-3 h-3" />
            </span>
            <div class="flex-1">
              <p
                class="text-sm"
                :class="{
                  'text-primary font-medium': stage.status === 'active',
                  'text-secondary': stage.status !== 'active',
                }"
              >
                {{ stage.label }}
              </p>
              <p v-if="stage.detail" class="text-xs text-secondaryLight">
                {{ stage.detail }}
              </p>
            </div>
          </div>
        </div>

        <!-- Overall progress bar -->
        <div class="w-full bg-primaryLight rounded-full h-2 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            :class="importError ? 'bg-red-500' : 'bg-accent'"
            :style="{ width: `${overallProgress}%` }"
          />
        </div>

        <p v-if="importError" class="text-red-500 text-sm">
          {{ importError }}
        </p>
      </div>
    </template>

    <!-- Phase 5: Done -->
    <template v-else-if="phase === 'done'">
      <div class="flex flex-col items-center space-y-4 py-4">
        <span
          class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 text-green-500"
        >
          <icon-lucide-check-circle class="w-8 h-8" />
        </span>
        <h3 class="text-lg font-semibold text-primary">
          {{ t("import.apifox.import_complete") }}
        </h3>
        <div class="text-center text-sm text-secondaryLight space-y-1">
          <p v-if="importResult.collections > 0">
            {{ importResult.collections }}
            {{ t("import.apifox.collections_imported") }}
          </p>
          <p v-if="importResult.apis > 0">
            {{ importResult.apis }} {{ t("import.apifox.apis_imported") }}
          </p>
          <p v-if="importResult.models > 0">
            {{ importResult.models }}
            {{ t("import.apifox.models_imported") }}
          </p>
          <p v-if="importResult.skipped > 0" class="text-secondaryLight">
            {{ importResult.skipped }}
            {{ t("import.apifox.items_skipped") }}
          </p>
        </div>
      </div>

      <HoppButtonPrimary
        :label="t('action.done')"
        class="w-full"
        @click="emit('hide-modal')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { computed, reactive, ref, onBeforeUnmount } from "vue"
import { HoppCollection, makeCollection } from "@hoppscotch/data"
import { restCollections$, restCollectionStore } from "~/newstore/collections"
import { useService } from "dioc/vue"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import {
  hoppApifoxImporter,
  importModels,
  collectApiRefs,
} from "~/helpers/import-export/import/apifox"
import type { ApifoxProject } from "~/helpers/import-export/import/apifox"


const t = useI18n()
const toast = useToast()

const workspaceModelService = useService(WorkspaceModelService)

// Subscribe at setup phase (not onMounted) for reliable reactivity in modal/dialog context.
// Use spread to create new array references so Vue detects changes.
const existingCollections = ref<HoppCollection[]>([
  ...(restCollectionStore.value.state ?? []),
])
const collectionsSub = restCollections$.subscribe((collections) => {
  existingCollections.value = [...collections]
})
onBeforeUnmount(() => {
  collectionsSub.unsubscribe()
})

const emit = defineEmits<{
  (e: "hide-modal"): void
  (
    e: "import-complete",
    collections: HoppCollection[],
    targetIndex?: number
  ): void
}>()

// --- State ---
type Phase = "file-select" | "preview" | "conflicts" | "importing" | "done"

const phase = ref<Phase>("file-select")
const fileInput = ref<HTMLInputElement | null>(null)
const hasFile = ref(false)
const isParsing = ref(false)
const parseError = ref("")
const rawContent = ref<string[]>([])
const parsedData = ref<ApifoxProject | null>(null)
const projectName = ref("")

// Target collection selector state
const importTarget = ref<"new" | "existing">("new")
const selectedTargetIndex = ref<number>(-1)
const newCollectionName = ref("")
const collectionNames = ref<string[]>([])

const previewCounts = reactive({
  collections: 0,
  apis: 0,
  models: 0,
  requests: 0,
})

type ConflictResolution = "skip" | "override" | "rename"

type Conflict = {
  name: string
  type: string
  resolution: ConflictResolution
}

const conflicts = reactive<Conflict[]>([])

type StageStatus = "pending" | "active" | "done" | "error"

type ImportStage = {
  label: string
  detail: string
  status: StageStatus
}

const importStages = reactive<ImportStage[]>([
  { label: t("import.apifox.stage_parse"), detail: "", status: "pending" },
  { label: t("import.apifox.stage_models"), detail: "", status: "pending" },
  {
    label: t("import.apifox.stage_apis"),
    detail: "",
    status: "pending",
  },
  {
    label: t("import.apifox.stage_complete"),
    detail: "",
    status: "pending",
  },
])

const importError = ref("")
const importResult = reactive({
  collections: 0,
  apis: 0,
  models: 0,
  skipped: 0,
})

const overallProgress = computed(() => {
  const total = importStages.length
  const done = importStages.filter(
    (s) => s.status === "done" || s.status === "error"
  ).length
  const active = importStages.filter((s) => s.status === "active").length
  return Math.round(((done + active * 0.5) / total) * 100)
})

// --- Helpers ---

function countApisInCollection(items: any[]): number {
  let count = 0
  if (!items) return count
  for (const item of items) {
    if (item.api) {
      count++
    } else if (item.items) {
      count += countApisInCollection(item.items)
    }
  }
  return count
}

function countRequestsInCollection(nodes: any[]): number {
  let count = 0
  if (!nodes) return count
  for (const node of nodes) {
    if (node.items) count += node.items.length
    if (node.children) count += countRequestsInCollection(node.children)
  }
  return count
}

function countModelsInCollection(schemaCollection: any[]): number {
  let count = 0
  if (!schemaCollection) return count
  for (const item of schemaCollection) {
    if (item.schema) {
      count++
    } else if (item.items) {
      count += countModelsInCollection(item.items)
    }
  }
  return count
}

function getCollectionNames(data: ApifoxProject): string[] {
  const names: string[] = []
  if (data.apiCollection) {
    for (const coll of data.apiCollection) {
      if (coll.name) names.push(coll.name)
    }
  }
  if (data.requestCollection) {
    for (const coll of data.requestCollection) {
      if (coll.name) names.push(coll.name)
    }
  }
  return names
}

// --- File handling ---

async function onFileChange() {
  parseError.value = ""
  hasFile.value = false

  const input = fileInput.value
  if (!input?.files || input.files.length === 0) {
    return
  }

  const file = input.files[0]
  if (file.size > 50 * 1024 * 1024) {
    parseError.value = t("import.apifox.file_too_large").toString()
    return
  }

  try {
    const text = await file.text()
    rawContent.value = [text]

    // Quick validation parse
    const data = JSON.parse(text)

    // Check for Apifox-specific format markers
    // Old format: apifox: {object}
    // New format: apifoxProject: "1.0.0" (string)
    const hasApifoxField =
      typeof data.apifox === "object" && data.apifox !== null
    const hasApifoxProjectField =
      typeof data.apifoxProject === "string"
    const hasApiCollection = Array.isArray(data.apiCollection)
    const hasRequestCollection = Array.isArray(data.requestCollection)
    const hasSchemaCollection = Array.isArray(data.schemaCollection)

    if (
      !hasApifoxField &&
      !hasApifoxProjectField &&
      !hasApiCollection &&
      !hasRequestCollection &&
      !hasSchemaCollection
    ) {
      // Not an Apifox file at all
      parseError.value = t("import.apifox.invalid_file_generic").toString()
      return
    }

    if (!hasApiCollection && !hasRequestCollection) {
      // Has Apifox markers but no actual collections to import
      parseError.value = t("import.apifox.invalid_file").toString()
      return
    }

    hasFile.value = true
  } catch (e) {
    parseError.value = t("import.apifox.parse_error", {
      error: e instanceof Error ? e.message : String(e),
    }).toString()
  }
}

// --- Parse & Preview ---

async function parseAndPreview() {
  isParsing.value = true
  parseError.value = ""

  try {
    const data = JSON.parse(rawContent.value[0]) as ApifoxProject
    parsedData.value = data
    projectName.value = data.info?.name ?? ""
    newCollectionName.value = data.info?.name ?? ""

    // Extract collection names for individual naming UI
    const names: string[] = []
    if (data.apiCollection) {
      for (const coll of data.apiCollection) {
        if (coll.name) names.push(coll.name)
      }
    }
    if (data.requestCollection) {
      for (const coll of data.requestCollection) {
        if (coll.name) names.push(coll.name)
      }
    }
    collectionNames.value = names.length > 0 ? names : [projectName.value || "Imported Collection"]

    // Count items
    let apiCount = 0
    let collCount = 0
    if (data.apiCollection) {
      collCount += data.apiCollection.length
      for (const coll of data.apiCollection) {
        apiCount += countApisInCollection(coll.items)
      }
    }

    let reqCount = 0
    if (data.requestCollection) {
      collCount += data.requestCollection.length
      reqCount = countRequestsInCollection(data.requestCollection)
    }

    let modelCount = 0
    if (data.schemaCollection) {
      modelCount = countModelsInCollection(data.schemaCollection as any[])
    }

    previewCounts.collections = collCount
    previewCounts.apis = apiCount
    previewCounts.models = modelCount
    previewCounts.requests = reqCount

    phase.value = "preview"
  } catch (e) {
    parseError.value = t("import.apifox.parse_error", {
      error: e instanceof Error ? e.message : String(e),
    }).toString()
  } finally {
    isParsing.value = false
  }
}

// --- Conflict detection ---

function checkConflicts() {
  conflicts.length = 0

  if (!parsedData.value) return

  const existingNames = new Set(existingCollections.value.map((c) => c.name))
  const importNames = getCollectionNames(parsedData.value)

  for (const name of importNames) {
    if (existingNames.has(name)) {
      conflicts.push({
        name,
        type: t("import.apifox.collection").toString(),
        resolution: "rename",
      })
    }
  }

  phase.value = "conflicts"
}

function setAllResolutions(resolution: ConflictResolution) {
  for (const c of conflicts) {
    c.resolution = resolution
  }
}

// --- Import execution ---

function setStage(idx: number, status: StageStatus, detail?: string) {
  importStages[idx].status = status
  if (detail !== undefined) {
    importStages[idx].detail = detail
  }
}

async function startImport() {
  phase.value = "importing"
  importError.value = ""
  importResult.collections = 0
  importResult.apis = 0
  importResult.models = 0
  importResult.skipped = 0

  // Reset stages
  for (const stage of importStages) {
    stage.status = "pending"
    stage.detail = ""
  }

  try {
    // Stage 1: Parse
    setStage(0, "active")
    await nextTick()

    const data = parsedData.value!
    const conflictMap = new Map<string, ConflictResolution>()
    for (const c of conflicts) {
      conflictMap.set(c.name, c.resolution)
    }

    // Determine skipped collections
    const skippedNames = new Set<string>()
    for (const c of conflicts) {
      if (c.resolution === "skip") {
        skippedNames.add(c.name)
      }
    }

    setStage(0, "done", `${previewCounts.collections} collections`)

    // Stage 2: Import models
    setStage(1, "active")
    await nextTick()

    let modelCount = 0
    let savedRefMap: Map<string, string> | undefined
    let importedModelIds: string[] = []
    if (
      data.schemaCollection &&
      data.schemaCollection.length > 0 &&
      data.apiCollection
    ) {
      try {
        const apiRefs = collectApiRefs(data.apiCollection)

        // For "existing" mode, scope models to the target collection immediately
        let targetCollectionIds: string[] | undefined
        if (
          importTarget.value === "existing" &&
          selectedTargetIndex.value >= 0
        ) {
          const existingColl =
            existingCollections.value[selectedTargetIndex.value]
          const collId = existingColl?._ref_id ?? existingColl?.id
          if (collId) {
            targetCollectionIds = [collId]
          }
        }

        const modelResult = importModels(
          data.schemaCollection as any,
          apiRefs,
          undefined,
          targetCollectionIds
        )

        for (const model of modelResult.models) {
          workspaceModelService.importModel(model)
        }

        importedModelIds = modelResult.models.map((m) => m.id)

        savedRefMap = modelResult.refMap
        modelCount = modelResult.importedCount
        importResult.models = modelCount

        if (modelResult.errors.length > 0) {
          setStage(
            1,
            "done",
            `${modelCount} models (${modelResult.errors.length} errors)`
          )
        } else {
          setStage(1, "done", `${modelCount} models`)
        }
      } catch (e) {
        setStage(
          1,
          "done",
          `Skipped: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    } else {
      setStage(1, "done", "No models to import")
    }

    // Stage 3: Import APIs (collections)
    setStage(2, "active")
    await nextTick()

    // Filter content based on conflict resolution
    const filteredData = { ...data }

    // Apply rename/override/skip to apiCollection
    if (data.apiCollection) {
      filteredData.apiCollection = data.apiCollection.filter(
        (coll) => !skippedNames.has(coll.name)
      )

      // Apply rename
      filteredData.apiCollection = filteredData.apiCollection.map((coll) => {
        const resolution = conflictMap.get(coll.name)
        if (resolution === "rename") {
          let newName = `${coll.name} (imported)`
          let counter = 1
          while (
            existingCollections.value.some((c) => c.name === newName) ||
            filteredData.apiCollection!.some(
              (c, i) => c !== coll && c.name === newName
            )
          ) {
            newName = `${coll.name} (imported ${++counter})`
          }
          return { ...coll, name: newName }
        }
        return coll
      })
    }

    // Apply same to requestCollection
    if (data.requestCollection) {
      filteredData.requestCollection = data.requestCollection.filter(
        (coll) => !skippedNames.has(coll.name)
      )

      filteredData.requestCollection = filteredData.requestCollection.map(
        (coll) => {
          const resolution = conflictMap.get(coll.name)
          if (resolution === "rename") {
            let newName = `${coll.name} (imported)`
            let counter = 1
            while (
              existingCollections.value.some((c) => c.name === newName) ||
              filteredData.requestCollection!.some(
                (c, i) => c !== coll && c.name === newName
              )
            ) {
              newName = `${coll.name} (imported ${++counter})`
            }
            return { ...coll, name: newName }
          }
          return coll
        }
      )
    }

    // Use the standard importer on the filtered data
    const filteredContent = [JSON.stringify(filteredData)]
    const importRes = await hoppApifoxImporter(filteredContent, savedRefMap)()

    if (importRes._tag === "Right") {
      const importedCollections = importRes.right
      importResult.collections = importedCollections.length

      // Count APIs in imported collections
      let importedApis = 0
      for (const coll of importedCollections) {
        importedApis += countRequestsInHoppCollection(coll)
      }
      importResult.apis = importedApis
      importResult.skipped = skippedNames.size

      setStage(
        2,
        "done",
        `${importedCollections.length} collections, ${importedApis} APIs`
      )

      if (
        importTarget.value === "existing" &&
        selectedTargetIndex.value >= 0
      ) {
        // Wrap imported collections as a subfolder named with project name
        const wrapperCollection = makeCollection({
          name: projectName.value || "Apifox Import",
          folders: importedCollections,
          requests: [],
          auth: { authType: "inherit", authActive: true },
          headers: [],
          variables: [],
          description: null,
          preRequestScript: "",
          testScript: "",
        })
        emit(
          "import-complete",
          [wrapperCollection],
          selectedTargetIndex.value
        )
      } else {
        // Import as new: create a parent collection, put each Apifox collection as a folder.
        // Apply user-edited folder names from collectionNames
        const folders = importedCollections.map((coll, idx) => {
          const editedName = collectionNames.value[idx]
          if (editedName && editedName.trim()) {
            return { ...coll, name: editedName.trim() }
          }
          return coll
        })

        // Create parent collection with all imported collections as folders
        const parentCollection = makeCollection({
          name:
            newCollectionName.value.trim() ||
            projectName.value ||
            "Apifox Import",
          folders: folders,
          requests: [],
          auth: { authType: "inherit", authActive: true },
          headers: [],
          variables: [],
          description: null,
          preRequestScript: "",
          testScript: "",
        })

        // Scope imported models to the parent collection's _ref_id
        const parentRefId = parentCollection._ref_id
        if (parentRefId && importedModelIds.length > 0) {
          for (const modelId of importedModelIds) {
            workspaceModelService.updateModel(modelId, {
              visibility: "collection",
              collectionIds: [parentRefId],
            })
          }
        }

        emit("import-complete", [parentCollection])
      }
    } else {
      setStage(2, "error", "Import failed")
      importError.value = t("import.apifox.import_failed", {
        error: t("import.failed").toString(),
      }).toString()
      return
    }

    // Stage 4: Complete
    setStage(3, "active")
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 300))
    setStage(3, "done")

    phase.value = "done"
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
    const activeIdx = importStages.findIndex((s) => s.status === "active")
    if (activeIdx >= 0) setStage(activeIdx, "error")
  }
}

function countRequestsInHoppCollection(coll: HoppCollection): number {
  let count = coll.requests.length
  for (const folder of coll.folders) {
    count += countRequestsInHoppCollection(folder)
  }
  return count
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
</script>
