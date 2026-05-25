<template>
  <div class="text-xs">
    <!-- Root node header -->
    <div
      class="flex items-center gap-2 py-1.5 px-2 bg-primaryLight rounded-t border border-dividerLight"
    >
      <IconChevronDown class="w-3.5 h-3.5 text-accent" />
      <span class="text-accent font-semibold">根节点</span>
      <span class="text-accent text-xs">object</span>
      <span class="flex-1" />

      <!-- Insert model button -->
      <div ref="modelPickerRef" class="relative">
        <button
          v-if="availableModels.length > 0"
          class="text-secondaryLight hover:text-purple-500 transition-colors text-xs flex items-center gap-1"
          @click="showModelPicker = !showModelPicker"
        >
          <IconLink class="w-3 h-3" />
          插入模型
        </button>

        <!-- Model picker dropdown -->
        <div
          v-if="showModelPicker"
          class="absolute right-0 top-full mt-1 z-50 bg-popover border border-divider rounded shadow-lg min-w-[180px] max-h-[240px] overflow-y-auto"
        >
          <button
            v-for="model in availableModels"
            :key="model.id"
            class="w-full text-left px-3 py-2 text-xs hover:bg-primaryLight transition-colors flex flex-col"
            @click="insertModelRef(model)"
          >
            <span class="text-accent font-medium">{{ model.name }}</span>
            <span
              v-if="model.description"
              class="text-secondaryLight text-[10px] truncate"
              >{{ model.description }}</span
            >
          </button>
        </div>
      </div>

      <button
        class="text-secondaryLight hover:text-accent transition-colors text-xs flex items-center gap-1"
        @click="addRootField"
      >
        <IconPlus class="w-3 h-3" />
        添加字段
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="!modelValue || modelValue.length === 0"
      class="flex items-center justify-center py-8 border-x border-b border-dividerLight rounded-b text-secondaryLight"
    >
      没有字段
      <button
        class="ml-2 text-accent hover:text-accentDark transition-colors"
        @click="addRootField"
      >
        添加
      </button>
    </div>

    <!-- Field rows -->
    <div v-else class="border-x border-b border-dividerLight rounded-b">
      <SchemaTreeRow
        v-for="(node, index) in modelValue"
        :key="index"
        :node="node"
        :depth="0"
        @update="(updated) => updateNode(index, updated)"
        @delete="removeNode(index)"
        @add-child="(parentIndex) => addChildNode(index, parentIndex)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, onBeforeUnmount } from "vue"
import type { HoppRESTSchemaNode, HoppWorkspaceModel } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconPlus from "~icons/lucide/plus"
import IconLink from "~icons/lucide/link"
import SchemaTreeRow from "./SchemaTreeRow.vue"

const props = defineProps<{
  modelValue: HoppRESTSchemaNode[]
  collectionId?: string
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTSchemaNode[]): void
}>()

// Workspace model service
const workspaceModelService = useService(WorkspaceModelService)

// Available models for insertion — filtered by collection context
const availableModels = computed(() => {
  if (props.collectionId) {
    return workspaceModelService.getModelsForCollection(props.collectionId)
  }
  // No collection context — show only public models
  return workspaceModelService.models.value.filter(
    (m) => (m.visibility ?? "public") === "public"
  )
})

// Model picker state
const showModelPicker = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)

// Provide model name resolver to child SchemaTreeRow components
const modelResolver = (id: string): string => {
  const model = workspaceModelService.getModelById(id)
  return model ? model.name : id.substring(0, 8)
}
provide("schemaModelResolver", modelResolver)

// Provide rich model resolver (name + schemaTree) for expand/collapse in edit mode
const richModelResolver = (
  id: string
): { name: string; schemaTree: HoppRESTSchemaNode[] } | undefined => {
  const model = workspaceModelService.getModelById(id)
  if (!model) return undefined
  return {
    name: model.name,
    schemaTree: (model.schemaTree ?? []) as HoppRESTSchemaNode[],
  }
}
provide("schemaRichModelResolver", richModelResolver)

// Close picker when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (
    modelPickerRef.value &&
    !modelPickerRef.value.contains(event.target as Node)
  ) {
    showModelPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
})

function createEmptyNode(name = ""): HoppRESTSchemaNode {
  return {
    name,
    type: "string",
    mock: "",
    displayName: "",
    description: "",
    required: true,
    children: [],
    example: "",
    modelRef: "",
    modelOverrides: {},
  }
}

function addRootField() {
  const nodes = [...(props.modelValue ?? [])]
  nodes.push(createEmptyNode("newField"))
  emit("update:modelValue", nodes)
}

function updateNode(index: number, updated: HoppRESTSchemaNode) {
  const nodes = [...(props.modelValue ?? [])]
  nodes[index] = updated
  emit("update:modelValue", nodes)
}

function removeNode(index: number) {
  const nodes = [...(props.modelValue ?? [])]
  nodes.splice(index, 1)
  emit("update:modelValue", nodes)
}

function addChildNode(parentIndex: number) {
  const nodes = [...(props.modelValue ?? [])]
  const parent = { ...nodes[parentIndex] }
  parent.children = [...(parent.children ?? []), createEmptyNode("childField")]
  parent.type = parent.type === "array" ? "array" : "object"
  nodes[parentIndex] = parent
  emit("update:modelValue", nodes)
}

/**
 * Insert a model reference node at the root level.
 * Creates a new node with modelRef set to the selected model's ID.
 */
function insertModelRef(model: HoppWorkspaceModel) {
  const nodes = [...(props.modelValue ?? [])]
  const node: HoppRESTSchemaNode = {
    name: model.name,
    type: "object",
    mock: "",
    displayName: "",
    description: model.description ?? "",
    required: true,
    children: [],
    example: "",
    modelRef: model.id,
    modelOverrides: {},
  }
  nodes.push(node)
  emit("update:modelValue", nodes)
  showModelPicker.value = false
}
</script>
