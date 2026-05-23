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
import { ref, watch } from "vue"
import type { HoppRESTSchemaNode, HoppWorkspaceModel } from "@hoppscotch/data"
import SchemaTreeEditor from "./SchemaTreeEditor.vue"

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
    }
  ): void
}>()

const isEditing = ref(false)
const editingName = ref("")
const editingDescription = ref("")
const editingSchemaTree = ref<HoppRESTSchemaNode[]>([])
const errorMessage = ref("")
const saving = ref(false)

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      if (props.model) {
        isEditing.value = true
        editingName.value = props.model.name
        editingDescription.value = props.model.description ?? ""
        editingSchemaTree.value = [...(props.model.schemaTree ?? [])]
      } else {
        isEditing.value = false
        editingName.value = ""
        editingDescription.value = ""
        editingSchemaTree.value = []
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

  errorMessage.value = ""
  saving.value = true

  emit("save", {
    id: props.model?.id,
    name,
    description: editingDescription.value.trim(),
    schemaTree: editingSchemaTree.value,
  })

  saving.value = false
}

function close() {
  emit("close")
}
</script>
