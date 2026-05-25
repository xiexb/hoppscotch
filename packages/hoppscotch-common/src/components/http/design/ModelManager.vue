<template>
  <div class="p-4 space-y-3">
    <!-- Section header -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-secondaryDark">数据模型</h3>
      <button
        class="text-xs text-accent hover:text-accentDark flex items-center gap-1 transition-colors"
        @click="openCreateModal"
      >
        <IconPlus class="w-3 h-3" />
        新建模型
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="models.length === 0"
      class="text-xs text-secondaryLight py-6 text-center border border-dashed border-dividerLight rounded"
    >
      暂无数据模型。模型是可复用的数据结构，可以在请求和响应的 Schema 中引用。
      <button
        class="ml-1 text-accent hover:text-accentDark"
        @click="openCreateModal"
      >
        创建第一个模型
      </button>
    </div>

    <!-- Model list -->
    <div v-else class="space-y-2">
      <div
        v-for="model in models"
        :key="model.id"
        class="border border-dividerLight rounded hover:border-divider transition-colors"
      >
        <!-- Model row -->
        <div class="flex items-center gap-3 px-3 py-2.5">
          <!-- Expand/collapse toggle -->
          <button
            class="text-secondaryLight hover:text-secondaryDark transition-colors shrink-0"
            @click="toggleExpand(model.id)"
          >
            <IconChevronRight
              class="w-3.5 h-3.5 transition-transform"
              :class="{ 'rotate-90': expandedId === model.id }"
            />
          </button>

          <!-- Model info -->
          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="toggleExpand(model.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-secondaryDark truncate">
                {{ model.name }}
              </span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium shrink-0"
              >
                {{ model.schemaTree?.length ?? 0 }} 字段
              </span>
              <span
                v-if="(model.visibility ?? 'public') === 'collection'"
                class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium shrink-0"
              >
                集合级
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
          <div class="flex items-center gap-1 shrink-0">
            <button
              v-tippy="{ theme: 'tooltip', content: '编辑' }"
              class="p-1 text-secondaryLight hover:text-accent transition-colors rounded"
              @click.stop="openEditModal(model)"
            >
              <IconEdit class="w-3.5 h-3.5" />
            </button>
            <button
              v-tippy="{ theme: 'tooltip', content: '删除' }"
              class="p-1 text-secondaryLight hover:text-red-400 transition-colors rounded"
              @click.stop="confirmDelete(model)"
            >
              <IconTrash class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Expanded schema preview (read-only) -->
        <div
          v-if="expandedId === model.id"
          class="border-t border-dividerLight px-3 py-2 bg-primaryLight/30"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-semibold text-secondary">
              Schema 预览
            </span>
            <span class="text-[10px] text-secondaryLight">
              更新于 {{ formatTime(model.updatedAt) }}
            </span>
          </div>
          <div v-if="model.schemaTree && model.schemaTree.length > 0">
            <SchemaTreeReadonly
              v-for="(node, nIdx) in model.schemaTree"
              :key="nIdx"
              :node="node"
              :depth="0"
              :model-resolver="readonlyModelResolver"
            />
          </div>
          <div v-else class="text-[11px] text-secondaryLight py-2 text-center">
            暂无字段定义
          </div>
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
      title="确认删除"
      @close="showDeleteConfirm = false"
    >
      <template #body>
        <div class="text-sm text-secondary p-2">
          确定删除模型
          <span class="font-semibold text-secondaryDark"
            >"{{ deletingModel?.name }}"</span
          >
          吗？此操作不可撤销。
        </div>
        <div
          v-if="deletingModel && getRefcount(deletingModel.id) > 0"
          class="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600"
        >
          ⚠ 此模型当前被 {{ getRefcount(deletingModel.id) }} 个 Schema
          节点引用。删除后这些引用将失效。
        </div>
      </template>
      <template #footer>
        <span class="flex gap-2">
          <HoppButtonPrimary label="删除" @click="onDeleteConfirm" />
          <HoppButtonSecondary
            label="取消"
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
import { ref, computed } from "vue"
import { useService } from "dioc/vue"
import type { HoppRESTSchemaNode, HoppWorkspaceModel } from "@hoppscotch/data"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import IconPlus from "~icons/lucide/plus"
import IconEdit from "~icons/lucide/pencil"
import IconTrash from "~icons/lucide/trash-2"
import IconChevronRight from "~icons/lucide/chevron-right"
import type { ReadonlyModelResolver } from "./SchemaTreeReadonly.vue"
import SchemaTreeReadonly from "./SchemaTreeReadonly.vue"
import ModelEditModal from "./ModelEditModal.vue"

const workspaceModelService = useService(WorkspaceModelService)

/**
 * Resolver for SchemaTreeReadonly: modelRef ID → { name, schemaTree }
 * Allows model previews to expand referenced models inline.
 */
const readonlyModelResolver: ReadonlyModelResolver = (modelRefId: string) => {
  const model = workspaceModelService.getModelById(modelRefId)
  if (!model) return undefined
  return {
    name: model.name,
    schemaTree: (model.schemaTree ?? []) as HoppRESTSchemaNode[],
  }
}

// Reactive model list from service
const models = computed(() => workspaceModelService.models.value)

// Expand state
const expandedId = ref<string | null>(null)

// Modal state
const showModal = ref(false)
const editingModel = ref<HoppWorkspaceModel | null>(null)

// Delete state
const showDeleteConfirm = ref(false)
const deletingModel = ref<HoppWorkspaceModel | null>(null)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

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

/**
 * Count how many schema nodes across all models reference a given model ID.
 * This is a simple heuristic — we scan all models' schemaTrees recursively.
 */
function getRefcount(modelId: string): number {
  let count = 0
  for (const model of models.value) {
    if (model.id === modelId) continue
    count += countRefs(model.schemaTree ?? [], modelId)
  }
  return count
}

function countRefs(nodes: HoppRESTSchemaNode[], targetId: string): number {
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
    if (diffMin < 1) return "刚刚"
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} 小时前`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay} 天前`
    return d.toLocaleDateString("zh-CN")
  } catch {
    return "—"
  }
}
</script>
