<template>
  <HoppSmartModal
    v-if="show"
    :title="isEditing ? '编辑模型' : '新建模型'"
    :full-width-body="true"
    @close="close"
  >
    <template #body>
      <div class="flex flex-col space-y-4 px-2">
        <!-- Name -->
        <div class="flex items-center gap-3">
          <label class="text-xs font-semibold text-secondary w-16 shrink-0">
            名称
          </label>
          <input
            v-model="editingName"
            type="text"
            class="flex-1 bg-transparent border border-dividerLight rounded px-3 py-1.5 text-sm text-secondaryDark outline-none focus:border-accent"
            placeholder="例如: User, Product, Order"
          />
        </div>

        <!-- Description -->
        <div class="flex items-start gap-3">
          <label
            class="text-xs font-semibold text-secondary w-16 shrink-0 mt-1.5"
          >
            描述
          </label>
          <textarea
            v-model="editingDescription"
            class="flex-1 bg-transparent border border-dividerLight rounded px-3 py-1.5 text-sm text-secondaryDark outline-none focus:border-accent resize-none"
            rows="2"
            placeholder="模型用途说明（可选）"
          />
        </div>

        <!-- Visibility -->
        <div class="flex items-start gap-3">
          <label
            class="text-xs font-semibold text-secondary w-16 shrink-0 mt-1.5"
          >
            可见性
          </label>
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  v-model="editingVisibility"
                  type="radio"
                  value="public"
                  class="accent-accent"
                />
                <span class="text-secondaryDark">公共</span>
                <span class="text-secondaryLight">（所有集合可见）</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  v-model="editingVisibility"
                  type="radio"
                  value="collection"
                  class="accent-accent"
                />
                <span class="text-secondaryDark">集合级</span>
                <span class="text-secondaryLight">（仅指定集合可见）</span>
              </label>
            </div>

            <!-- Collection picker (only when visibility is "collection") -->
            <div
              v-if="editingVisibility === 'collection'"
              :key="'coll-picker-' + allCollections.length"
              class="border border-dividerLight rounded p-2 max-h-[160px] overflow-y-auto"
            >
              <div
                v-if="allCollections.length === 0"
                class="text-xs text-secondaryLight text-center py-2"
              >
                暂无可用集合
              </div>
              <label
                v-for="coll in allCollections"
                :key="coll.id"
                class="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-primaryLight rounded text-xs"
              >
                <input
                  type="checkbox"
                  :checked="editingCollectionIds.includes(coll.id)"
                  class="accent-accent"
                  @change="toggleCollection(coll.id)"
                />
                <span class="text-secondaryDark truncate">{{
                  coll.name
                }}</span>
                <span class="text-secondaryLight text-[10px] shrink-0">{{
                  coll.tag
                }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Schema Tree Editor -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-secondary">数据结构</span>
            <span class="text-xs text-secondaryLight">
              {{ editingSchemaTree.length }} 个字段
            </span>
          </div>
          <SchemaTreeEditor
            :model-value="editingSchemaTree"
            @update:model-value="editingSchemaTree = $event"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <span v-if="errorMessage" class="text-xs text-red-400">
          {{ errorMessage }}
        </span>
        <span v-else />
        <span class="flex gap-2">
          <HoppButtonPrimary
            :label="isEditing ? '保存' : '创建'"
            :loading="saving"
            @click="onSave"
          />
          <HoppButtonSecondary label="取消" outline filled @click="close" />
        </span>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from "vue"
import type { HoppRESTSchemaNode, HoppWorkspaceModel } from "@hoppscotch/data"
import { HoppCollection } from "@hoppscotch/data"
import { restCollections$, restCollectionStore } from "~/newstore/collections"
import SchemaTreeEditor from "./SchemaTreeEditor.vue"

/**
 * Collection item for the picker: id (matching our convention), name, tag.
 */
type CollectionItem = {
  id: string
  name: string
  tag: string
}

const props = defineProps<{
  show: boolean
  model?: HoppWorkspaceModel | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (
    e: "save",
    data: {
      id?: string
      name: string
      description: string
      schemaTree: HoppRESTSchemaNode[]
      visibility: "public" | "collection"
      collectionIds: string[]
    }
  ): void
}>()

const isEditing = ref(false)
const editingName = ref("")
const editingDescription = ref("")
const editingSchemaTree = ref<HoppRESTSchemaNode[]>([])
const editingVisibility = ref<"public" | "collection">("public")
const editingCollectionIds = ref<string[]>([])
const errorMessage = ref("")
const saving = ref(false)

// Manual subscribe for ongoing updates + force refresh on modal open.
// This dual approach ensures collections are always up-to-date regardless of timing.
const existingCollections = ref<HoppCollection[]>([
  ...(restCollectionStore.value.state ?? []),
])
const collectionsSub = restCollections$.subscribe((cols) => {
  existingCollections.value = [...cols]
})
onBeforeUnmount(() => {
  collectionsSub.unsubscribe()
})

const allCollections = computed<CollectionItem[]>(() => {
  return (existingCollections.value ?? []).map((coll, idx) => ({
    id: coll._ref_id || `user:${idx}`,
    name: coll.name || `集合 ${idx + 1}`,
    tag: "本地",
  }))
})

function toggleCollection(id: string) {
  const idx = editingCollectionIds.value.indexOf(id)
  if (idx >= 0) {
    editingCollectionIds.value.splice(idx, 1)
  } else {
    editingCollectionIds.value.push(id)
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      // Force refresh collections from store on every modal open.
      // This bypasses any subscription timing issues.
      existingCollections.value = [...(restCollectionStore.value.state ?? [])]

      if (props.model) {
        isEditing.value = true
        editingName.value = props.model.name
        editingDescription.value = props.model.description ?? ""
        editingSchemaTree.value = [...(props.model.schemaTree ?? [])]
        editingVisibility.value = props.model.visibility ?? "public"
        editingCollectionIds.value = [...(props.model.collectionIds ?? [])]
      } else {
        isEditing.value = false
        editingName.value = ""
        editingDescription.value = ""
        editingSchemaTree.value = []
        editingVisibility.value = "public"
        editingCollectionIds.value = []
      }
      errorMessage.value = ""
      saving.value = false
    }
  }
)

function onSave() {
  const name = editingName.value.trim()
  if (!name) {
    errorMessage.value = "请输入模型名称"
    return
  }

  if (
    editingVisibility.value === "collection" &&
    editingCollectionIds.value.length === 0
  ) {
    errorMessage.value = "集合级可见性至少需要选择一个集合"
    return
  }

  errorMessage.value = ""
  saving.value = true

  emit("save", {
    id: props.model?.id,
    name,
    description: editingDescription.value.trim(),
    schemaTree: editingSchemaTree.value,
    visibility: editingVisibility.value,
    collectionIds:
      editingVisibility.value === "collection"
        ? editingCollectionIds.value
        : [],
  })

  saving.value = false
}

function close() {
  emit("close")
}
</script>
