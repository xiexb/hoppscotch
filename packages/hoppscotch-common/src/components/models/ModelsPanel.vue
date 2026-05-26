<template>
  <div class="flex flex-col flex-1 bg-primary">
    <!-- Section header -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-dividerLight"
    >
      <h3 class="text-sm font-semibold text-secondaryDark">
        {{ t("tab.models") }}
      </h3>
      <HoppButtonSecondary
        :icon="IconPlus"
        :label="t('models_panel.new')"
        class="!py-1 !px-2"
        @click="openCreateModal"
      />
    </div>

    <!-- Search input -->
    <div class="px-4 py-2 border-b border-dividerLight">
      <div class="relative">
        <IconSearch
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondaryLight"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('models_panel.search_placeholder')"
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-primaryLight rounded border border-dividerLight outline-none focus:border-accentLight transition-colors text-secondaryDark placeholder:text-secondaryLight"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-secondaryLight hover:text-secondary transition-colors"
          @click="searchQuery = ''"
        >
          <IconX class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="models.length === 0 && !searchQuery"
      class="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center"
    >
      <IconDatabase class="w-10 h-10 text-secondaryLight mb-3 opacity-50" />
      <p class="text-sm text-secondaryLight mb-1">
        {{ t("models_panel.no_models") }}
      </p>
      <p class="text-xs text-secondaryLight mb-4">
        {{ t("models_panel.no_models_desc") }}
      </p>
      <HoppButtonSecondary
        :icon="IconPlus"
        :label="t('models_panel.create_first')"
        @click="openCreateModal"
      />
    </div>

    <!-- No search results -->
    <div
      v-else-if="filteredPublicModels.length === 0 && filteredCollectionFolderGroups.length === 0"
      class="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center"
    >
      <IconSearch class="w-10 h-10 text-secondaryLight mb-3 opacity-50" />
      <p class="text-sm text-secondaryLight mb-1">
        {{ t("models_panel.no_results") }}
      </p>
      <p class="text-xs text-secondaryLight">
        {{ t("models_panel.no_results_desc") }}
      </p>
    </div>

    <!-- Model list with grouping -->
    <div v-else class="flex-1 overflow-y-auto">
      <!-- Public Models Group -->
      <div v-if="filteredPublicModels.length > 0" class="mb-2">
        <div
          class="sticky top-0 z-[1] flex items-center gap-2 px-4 py-2 bg-primary border-b border-dividerLight cursor-pointer select-none hover:bg-primaryLight/30 transition-colors"
          @click="toggleGroup('public')"
        >
          <IconChevronRight
            class="w-3.5 h-3.5 text-secondaryLight transition-transform shrink-0"
            :class="{ 'rotate-90': !collapsedGroups.has('public') }"
          />
          <IconGlobe class="w-3.5 h-3.5 text-secondaryLight" />
          <span
            class="text-xs font-semibold text-secondary uppercase tracking-wider"
          >
            {{ t("models_panel.public_models") }}
          </span>
          <span class="text-xs text-secondaryLight"
            >({{ filteredPublicModels.length }})</span
          >
        </div>
        <div v-if="!collapsedGroups.has('public')" class="divide-y divide-dividerLight">
          <div
            v-for="model in filteredPublicModels"
            :key="model.id"
            class="group"
          >
            <!-- Model row -->
            <div
              class="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-primaryLight/50 transition-colors"
              @click="toggleExpand(model.id)"
            >
              <!-- Expand icon -->
              <IconChevronRight
                class="w-3.5 h-3.5 text-secondaryLight shrink-0 transition-transform"
                :class="{ 'rotate-90': expandedId === model.id }"
              />
              <!-- Model info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs font-semibold text-secondaryDark truncate"
                  >
                    {{ model.name }}
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium shrink-0"
                  >
                    {{ model.schemaTree?.length ?? 0 }}
                    {{ t("models_panel.fields") }}
                  </span>
                </div>
                <div
                  v-if="model.description"
                  class="text-[11px] text-secondaryLight truncate mt-0.5"
                >
                  {{ model.description }}
                </div>
              </div>
              <!-- Actions -->
              <div
                class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button
                  v-tippy="{
                    theme: 'tooltip',
                    content: t('models_panel.edit'),
                  }"
                  class="p-1.5 text-secondaryLight hover:text-accent transition-colors rounded"
                  @click.stop="openEditModal(model)"
                >
                  <IconEdit class="w-3.5 h-3.5" />
                </button>
                <button
                  v-tippy="{
                    theme: 'tooltip',
                    content: t('models_panel.delete'),
                  }"
                  class="p-1.5 text-secondaryLight hover:text-red-400 transition-colors rounded"
                  @click.stop="confirmDelete(model)"
                >
                  <IconTrash class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Expanded schema preview -->
            <div
              v-if="expandedId === model.id"
              class="px-4 py-2 bg-primaryLight/30 border-t border-dividerLight"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-semibold text-secondary">
                  {{ t("models_panel.schema_preview") }}
                </span>
                <span class="text-[10px] text-secondaryLight">
                  {{ t("models_panel.updated_at") }}
                  {{ formatTime(model.updatedAt) }}
                </span>
              </div>
              <div
                v-if="model.schemaTree && model.schemaTree.length > 0"
              >
                <SchemaTreeReadonly
                  v-for="(node, nIdx) in model.schemaTree"
                  :key="nIdx"
                  :node="node"
                  :depth="0"
                  :model-resolver="readonlyModelResolver"
                />
              </div>
              <div
                v-else
                class="text-[11px] text-secondaryLight py-2 text-center"
              >
                {{ t("models_panel.no_fields") }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Collection Models Group -->
      <div v-if="filteredCollectionFolderGroups.length > 0" class="mb-2">
        <div
          class="sticky top-0 z-[1] flex items-center gap-2 px-4 py-2 bg-primary border-b border-dividerLight cursor-pointer select-none hover:bg-primaryLight/30 transition-colors"
          @click="toggleGroup('collection')"
        >
          <IconChevronRight
            class="w-3.5 h-3.5 text-secondaryLight transition-transform shrink-0"
            :class="{ 'rotate-90': !collapsedGroups.has('collection') }"
          />
          <IconFolders class="w-3.5 h-3.5 text-secondaryLight" />
          <span
            class="text-xs font-semibold text-secondary uppercase tracking-wider"
          >
            {{ t("models_panel.collection_models") }}
          </span>
          <span class="text-xs text-secondaryLight"
            >({{ totalFilteredCollectionModels }})</span
          >
        </div>

        <!-- Collection sub-folders -->
        <div v-if="!collapsedGroups.has('collection')">
          <template
            v-for="folder in filteredCollectionFolderGroups"
            :key="folder.key"
          >
            <!-- Sub-folder header -->
            <div
              class="flex items-center gap-2 px-6 py-1.5 cursor-pointer select-none hover:bg-primaryLight/20 transition-colors"
              @click="toggleGroup('folder:' + folder.key)"
            >
              <IconChevronRight
                class="w-3 h-3 text-secondaryLight transition-transform shrink-0"
                :class="{ 'rotate-90': !collapsedGroups.has('folder:' + folder.key) }"
              />
              <IconFolder class="w-3.5 h-3.5 text-amber-500/70" />
              <span
                class="text-[11px] font-medium text-secondary truncate"
              >
                {{ folder.name }}
              </span>
              <span class="text-[10px] text-secondaryLight"
                >({{ folder.models.length }})</span
              >
            </div>

            <!-- Sub-folder models -->
            <div
              v-if="!collapsedGroups.has('folder:' + folder.key)"
              class="divide-y divide-dividerLight"
            >
              <div
                v-for="model in folder.models"
                :key="model.id"
                class="group"
              >
                <!-- Model row (indented) -->
                <div
                  class="flex items-center gap-2 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-primaryLight/50 transition-colors"
                  @click="toggleExpand(model.id)"
                >
                  <IconChevronRight
                    class="w-3.5 h-3.5 text-secondaryLight shrink-0 transition-transform"
                    :class="{ 'rotate-90': expandedId === model.id }"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-xs font-semibold text-secondaryDark truncate"
                      >
                        {{ model.name }}
                      </span>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium shrink-0"
                      >
                        {{ model.schemaTree?.length ?? 0 }}
                        {{ t("models_panel.fields") }}
                      </span>
                    </div>
                    <div
                      v-if="model.description"
                      class="text-[11px] text-secondaryLight truncate mt-0.5"
                    >
                      {{ model.description }}
                    </div>
                  </div>
                  <div
                    class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      v-tippy="{
                        theme: 'tooltip',
                        content: t('models_panel.edit'),
                      }"
                      class="p-1.5 text-secondaryLight hover:text-accent transition-colors rounded"
                      @click.stop="openEditModal(model)"
                    >
                      <IconEdit class="w-3.5 h-3.5" />
                    </button>
                    <button
                      v-tippy="{
                        theme: 'tooltip',
                        content: t('models_panel.delete'),
                      }"
                      class="p-1.5 text-secondaryLight hover:text-red-400 transition-colors rounded"
                      @click.stop="confirmDelete(model)"
                    >
                      <IconTrash class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Expanded schema preview -->
                <div
                  v-if="expandedId === model.id"
                  class="px-4 py-2 bg-primaryLight/30 border-t border-dividerLight"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-semibold text-secondary">
                      {{ t("models_panel.schema_preview") }}
                    </span>
                    <span class="text-[10px] text-secondaryLight">
                      {{ t("models_panel.updated_at") }}
                      {{ formatTime(model.updatedAt) }}
                    </span>
                  </div>
                  <div
                    v-if="model.schemaTree && model.schemaTree.length > 0"
                  >
                    <SchemaTreeReadonly
                      v-for="(node, nIdx) in model.schemaTree"
                      :key="nIdx"
                      :node="node"
                      :depth="0"
                      :model-resolver="readonlyModelResolver"
                    />
                  </div>
                  <div
                    v-else
                    class="text-[11px] text-secondaryLight py-2 text-center"
                  >
                    {{ t("models_panel.no_fields") }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Edit/Create Modal -->
    <ModelEditModal
      :show="showModal"
      :model="editingModel"
      @close="showModal = false"
      @save="onModelSave"
    />

    <!-- Delete confirm modal -->
    <HoppSmartModal
      v-if="showDeleteConfirm"
      :title="t('models_panel.confirm_delete')"
      @close="showDeleteConfirm = false"
    >
      <template #body>
        <div class="text-sm text-secondary p-2">
          {{
            t("models_panel.confirm_delete_text", {
              name: deletingModel?.name ?? "",
            })
          }}
        </div>
        <div
          v-if="deletingModel && getRefcount(deletingModel.id) > 0"
          class="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600"
        >
          {{
            t("models_panel.delete_ref_warning", {
              count: getRefcount(deletingModel.id),
            })
          }}
        </div>
      </template>
      <template #footer>
        <span class="flex gap-2">
          <HoppButtonPrimary
            :label="t('models_panel.delete')"
            @click="onDeleteConfirm"
          />
          <HoppButtonSecondary
            :label="t('models_panel.cancel')"
            outline
            filled
            @click="showDeleteConfirm = false"
          />
        </span>
      </template>
    </HoppSmartModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, type Component } from "vue"
import { useService } from "dioc/vue"
import { useI18n } from "@composables/i18n"
import type { HoppRESTSchemaNode, HoppWorkspaceModel } from "@hoppscotch/data"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import { TeamCollectionsService } from "~/services/team-collection.service"
import type { TeamCollection } from "~/helpers/teams/TeamCollection"
import type { ReadonlyModelResolver } from "~/components/http/design/SchemaTreeReadonly.vue"
import SchemaTreeReadonly from "~/components/http/design/SchemaTreeReadonly.vue"
import ModelEditModal from "~/components/http/design/ModelEditModal.vue"
import IconPlus from "~icons/lucide/plus"
import IconEdit from "~icons/lucide/pencil"
import IconTrash from "~icons/lucide/trash-2"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconDatabase from "~icons/lucide/database"
import IconGlobe from "~icons/lucide/globe"
import IconFolders from "~icons/lucide/folders"
import IconFolder from "~icons/lucide/folder"
import IconSearch from "~icons/lucide/search"
import IconX from "~icons/lucide/x"

const t = useI18n()
const workspaceModelService = useService(WorkspaceModelService)
const teamCollectionsService = useService(TeamCollectionsService)

/**
 * Resolver for SchemaTreeReadonly: modelRef ID -> { name, schemaTree }
 */
const readonlyModelResolver: ReadonlyModelResolver = (
  modelRefId: string
) => {
  const model = workspaceModelService.getModelById(modelRefId)
  if (!model) return undefined
  return {
    name: model.name,
    schemaTree: (model.schemaTree ?? []) as HoppRESTSchemaNode[],
  }
}

// Reactive model list from service
const models = computed(() => workspaceModelService.models.value)

// Search state
const searchQuery = ref("")

// Group collapse state
const collapsedGroups = reactive(new Set<string>())

function toggleGroup(key: string) {
  if (collapsedGroups.has(key)) {
    collapsedGroups.delete(key)
  } else {
    collapsedGroups.add(key)
  }
}

// Model expand state
const expandedId = ref<string | null>(null)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

// Filtered models by search query
const filteredPublicModels = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  const publicModels = models.value.filter(
    (m) => (m.visibility ?? "public") === "public"
  )
  if (!query) return publicModels
  return publicModels.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      (m.description ?? "").toLowerCase().includes(query)
  )
})

// Collection models grouped by collection folder
const collectionFolderGroups = computed(() => {
  const collectionModels = models.value.filter(
    (m) => m.visibility === "collection"
  )

  // Build a map of collectionId -> models
  const folderMap = new Map<string, HoppWorkspaceModel[]>()
  const uncategorized: HoppWorkspaceModel[] = []
  const seenModelIds = new Set<string>()

  for (const model of collectionModels) {
    const ids = model.collectionIds ?? []
    if (ids.length === 0) {
      uncategorized.push(model)
    } else {
      for (const cid of ids) {
        if (!folderMap.has(cid)) {
          folderMap.set(cid, [])
        }
        // Avoid duplicate model in same folder
        if (!folderMap.get(cid)!.some((m) => m.id === model.id)) {
          folderMap.get(cid)!.push(model)
        }
      }
    }
    seenModelIds.add(model.id)
  }

  // Resolve collection names from TeamCollectionsService
  const tree = teamCollectionsService.collections.value
  const groups: Array<{
    key: string
    name: string
    models: HoppWorkspaceModel[]
  }> = []

  // Sort folders by name
  const sortedEntries = Array.from(folderMap.entries()).sort((a, b) => {
    const nameA = resolveCollectionName(tree, a[0])
    const nameB = resolveCollectionName(tree, b[0])
    return nameA.localeCompare(nameB)
  })

  for (const [cid, models] of sortedEntries) {
    groups.push({
      key: cid,
      name: resolveCollectionName(tree, cid),
      models,
    })
  }

  // Add uncategorized at the end if any
  if (uncategorized.length > 0) {
    groups.push({
      key: "__uncategorized__",
      name: t("models_panel.uncategorized"),
      models: uncategorized,
    })
  }

  return groups
})

// Filtered collection folder groups (applies search filter)
const filteredCollectionFolderGroups = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return collectionFolderGroups.value

  const result: Array<{
    key: string
    name: string
    models: HoppWorkspaceModel[]
  }> = []

  for (const folder of collectionFolderGroups.value) {
    const filtered = folder.models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.description ?? "").toLowerCase().includes(query)
    )
    if (filtered.length > 0) {
      result.push({ ...folder, models: filtered })
    }
  }

  return result
})

// Total count of filtered collection models (deduped by model ID)
const totalFilteredCollectionModels = computed(() => {
  const seen = new Set<string>()
  for (const folder of filteredCollectionFolderGroups.value) {
    for (const m of folder.models) {
      seen.add(m.id)
    }
  }
  return seen.size
})

/**
 * Resolve a collection ID to its name from the TeamCollectionsService tree.
 */
function resolveCollectionName(
  tree: TeamCollection[],
  collectionId: string
): string {
  const found = findCollectionInTree(tree, collectionId)
  return found?.title ?? collectionId.slice(0, 8) + "..."
}

function findCollectionInTree(
  tree: TeamCollection[],
  targetId: string
): TeamCollection | null {
  for (const coll of tree) {
    if (coll.id === targetId) return coll
    if (coll.children) {
      const found = findCollectionInTree(coll.children, targetId)
      if (found) return found
    }
  }
  return null
}

// Modal state
const showModal = ref(false)
const editingModel = ref<HoppWorkspaceModel | null>(null)

// Delete state
const showDeleteConfirm = ref(false)
const deletingModel = ref<HoppWorkspaceModel | null>(null)

function openCreateModal() {
  editingModel.value = null
  showModal.value = true
}

function openEditModal(model: HoppWorkspaceModel) {
  editingModel.value = model
  showModal.value = true
}

function onModelSave(data: {
  id?: string
  name: string
  description: string
  schemaTree: HoppRESTSchemaNode[]
  visibility: "public" | "collection"
  collectionIds: string[]
}) {
  if (data.id) {
    workspaceModelService.updateModel(data.id, {
      name: data.name,
      description: data.description,
      schemaTree: data.schemaTree,
      visibility: data.visibility,
      collectionIds: data.collectionIds,
    })
  } else {
    workspaceModelService.createModel({
      name: data.name,
      description: data.description,
      schemaTree: data.schemaTree,
      visibility: data.visibility,
      collectionIds: data.collectionIds,
    })
  }
  showModal.value = false
}

function confirmDelete(model: HoppWorkspaceModel) {
  deletingModel.value = model
  showDeleteConfirm.value = true
}

function onDeleteConfirm() {
  if (deletingModel.value) {
    workspaceModelService.deleteModel(deletingModel.value.id)
    if (expandedId.value === deletingModel.value.id) {
      expandedId.value = null
    }
  }
  showDeleteConfirm.value = false
  deletingModel.value = null
}

function getRefcount(modelId: string): number {
  let count = 0
  for (const model of models.value) {
    if (model.id === modelId) continue
    count += countRefs(model.schemaTree ?? [], modelId)
  }
  return count
}

function countRefs(
  nodes: HoppRESTSchemaNode[],
  targetId: string
): number {
  let count = 0
  for (const node of nodes) {
    if (node.modelRef === targetId) count++
    if (node.children?.length) {
      count += countRefs(node.children, targetId)
    }
  }
  return count
}

function formatTime(iso: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t("models_panel.time_just_now")
    if (diffMin < 60)
      return t("models_panel.time_minutes_ago", { n: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return t("models_panel.time_hours_ago", { n: diffHr })
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return t("models_panel.time_days_ago", { n: diffDay })
    return d.toLocaleDateString()
  } catch {
    return "—"
  }
}
</script>
