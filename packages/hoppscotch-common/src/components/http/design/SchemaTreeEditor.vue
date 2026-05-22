<template>
  <div class="text-xs">
    <!-- Root node header -->
    <div class="flex items-center gap-2 py-1.5 px-2 bg-primaryLight rounded-t border border-dividerLight">
      <IconChevronDown class="w-3.5 h-3.5 text-accent" />
      <span class="text-accent font-semibold">根节点</span>
      <span class="text-accent text-xs">object</span>
      <span class="flex-1" />
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
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconPlus from "~icons/lucide/plus"
import SchemaTreeRow from "./SchemaTreeRow.vue"

const props = defineProps<{
  modelValue: HoppRESTSchemaNode[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTSchemaNode[]): void
}>()

function createEmptyNode(name = ""): HoppRESTSchemaNode {
  return {
    name,
    type: "string",
    mock: "",
    displayName: "",
    description: "",
    required: true,
    children: [],
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
</script>
