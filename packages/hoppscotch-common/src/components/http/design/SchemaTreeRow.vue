<template>
  <div>
    <div
      class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight hover:bg-primaryLight/50 transition-colors"
      :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
    >
      <!-- Expand/collapse for object/array -->
      <button
        v-if="hasChildren"
        class="text-secondary transition-transform"
        :class="{ 'rotate-90': expanded }"
        @click="expanded = !expanded"
      >
        <IconChevronRight class="w-3 h-3" />
      </button>
      <span v-else class="w-3" />

      <!-- Field name -->
      <input
        :value="node.name"
        class="text-xs font-mono text-accent bg-transparent outline-none w-28 min-w-[60px]"
        placeholder="字段名"
        @input="onField('name', $event)"
      />

      <!-- Type selector -->
      <select
        :value="node.type"
        class="text-xs text-accent bg-transparent outline-none w-20"
        @change="onField('type', $event)"
      >
        <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Example value -->
      <input
        :value="node.example ?? ''"
        class="text-xs bg-transparent outline-none w-20 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="示例值"
        @input="onField('example', $event)"
      />

      <!-- Display name -->
      <input
        :value="node.displayName"
        class="text-xs bg-transparent outline-none w-24 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="中文名"
        @input="onField('displayName', $event)"
      />

      <!-- Description -->
      <input
        :value="node.description"
        class="text-xs bg-transparent outline-none flex-1 min-w-[60px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="说明"
        @input="onField('description', $event)"
      />

      <!-- ModelRef badge -->
      <button
        v-if="node.modelRef"
        class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 shrink-0 flex items-center gap-0.5"
        :title="`引用模型: ${modelRefName}（点击清除）`"
        @click="clearModelRef"
      >
        <IconLink class="w-2.5 h-2.5" />
        {{ modelRefName }}
      </button>

      <!-- Required toggle -->
      <button
        class="px-1.5 py-0.5 text-[10px] rounded transition-colors shrink-0"
        :class="
          node.required
            ? 'bg-orange-500/15 text-orange-500'
            : 'bg-secondaryLight/10 text-secondaryLight hover:text-secondary'
        "
        :title="node.required ? '必填（点击取消）' : '非必填（点击设为必填）'"
        @click="toggleRequired"
      >
        {{ node.required ? "必填" : "可选" }}
      </button>

      <!-- Actions -->
      <div class="flex items-center gap-1 ml-1 shrink-0">
        <button
          v-if="canAddChild"
          class="text-secondaryLight hover:text-accent transition-colors"
          title="添加子字段"
          @click="addChild"
        >
          <IconPlus class="w-3 h-3" />
        </button>
        <button
          class="text-secondaryLight hover:text-red-400 transition-colors"
          title="删除"
          @click="emit('delete')"
        >
          <IconTrash class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Children (recursive) -->
    <div v-if="hasChildren && expanded">
      <SchemaTreeRow
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :depth="depth + 1"
        @update="(updated) => updateChild(index, updated)"
        @delete="removeChild(index)"
        @add-child="() => addChildToChild(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue"
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconPlus from "~icons/lucide/plus"
import IconTrash from "~icons/lucide/trash-2"
import IconLink from "~icons/lucide/link"

const props = defineProps<{
  node: HoppRESTSchemaNode
  depth: number
}>()

const emit = defineEmits<{
  (e: "update", val: HoppRESTSchemaNode): void
  (e: "delete"): void
  (e: "add-child"): void
}>()

const expanded = ref(true)

const typeOptions = [
  "object",
  "string",
  "integer",
  "number",
  "boolean",
  "array",
  "file",
]

const hasChildren = computed(
  () =>
    (props.node.type === "object" || props.node.type === "array") &&
    (props.node.children?.length ?? 0) > 0
)

const canAddChild = computed(
  () => props.node.type === "object" || props.node.type === "array"
)

// Model ref support - injected from parent SchemaTreeEditor
const modelResolver = inject<((id: string) => string) | null>(
  "schemaModelResolver",
  null
)

const modelRefName = computed(() => {
  if (!props.node.modelRef) return ""
  if (modelResolver) return modelResolver(props.node.modelRef)
  return props.node.modelRef.substring(0, 8)
})

function clearModelRef() {
  const updated = { ...props.node, modelRef: "" }
  emit("update", updated)
}

function onField(field: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  const updated = { ...props.node, [field]: target.value }
  // If type changed to object/array, ensure children array exists
  if (
    field === "type" &&
    (target.value === "object" || target.value === "array")
  ) {
    updated.children = updated.children ?? []
  }
  emit("update", updated)
}

function toggleRequired() {
  const updated = { ...props.node, required: !props.node.required }
  emit("update", updated)
}

function addChild() {
  emit("add-child")
}

function updateChild(index: number, updated: HoppRESTSchemaNode) {
  const children = [...(props.node.children ?? [])]
  children[index] = updated
  emit("update", { ...props.node, children })
}

function removeChild(index: number) {
  const children = [...(props.node.children ?? [])]
  children.splice(index, 1)
  emit("update", { ...props.node, children })
}

function addChildToChild(index: number) {
  const children = [...(props.node.children ?? [])]
  const child = { ...children[index] }
  child.children = [
    ...(child.children ?? []),
    {
      name: "childField",
      type: "string" as const,
      mock: "",
      displayName: "",
      description: "",
      required: true,
      children: [],
      example: "",
      modelRef: "",
    },
  ]
  child.type = child.type === "array" ? "array" : "object"
  children[index] = child
  emit("update", { ...props.node, children })
}
</script>
